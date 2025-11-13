import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import QBRateLimiter from "../_shared/qb-rate-limiter.ts";
import { retryableQBApiCall, parseQBError } from "../_shared/qb-api-helper.ts";
import {
  initPagination,
  updatePagination,
  buildQBQuery,
  logProgress,
  batchUpsert,
  formatQBTimestamp,
  parseQBAmount,
  parseQBInt,
  getQBApiBaseUrl,
  createSupabaseClient
} from "../_shared/sync-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  organizationId: string;
  direction?: "push" | "pull" | "both";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    const { organizationId, direction = "both" }: SyncRequest = await req.json();

    console.log("=== Starting Customer Sync ===");
    console.log("Organization ID:", organizationId);
    console.log("Direction:", direction);

    // Get QuickBooks connection using secure function
    const { data: connections, error: connectionError } = await supabase
      .rpc("get_qbo_connection_for_sync", { p_organization_id: organizationId });

    if (connectionError || !connections || connections.length === 0) {
      console.error("Connection fetch error:", connectionError);
      throw new Error("Active QuickBooks connection not found");
    }

    const connection = connections[0];

    // Refresh token if needed
    await refreshTokenIfNeeded(supabase, connection);

    let syncResults = {
      pulled: 0,
      pushed: 0,
      errors: [] as string[]
    };

    // Pull customers from QuickBooks
    if (direction === "pull" || direction === "both") {
      try {
        const pullResult = await pullCustomersFromQB(supabase, connection);
        syncResults.pulled = pullResult;
      } catch (error: any) {
        console.error("Pull error:", error);
        syncResults.errors.push(`Pull error: ${error.message}`);
      }
    }

    // Push customers to QuickBooks
    if (direction === "push" || direction === "both") {
      try {
        const pushResult = await pushCustomersToQB(supabase, connection);
        syncResults.pushed = pushResult;
      } catch (error: any) {
        console.error("Push error:", error);
        syncResults.errors.push(`Push error: ${error.message}`);
      }
    }

    // Log sync history
    await supabase.from("qbo_sync_history").insert({
      organization_id: organizationId,
      sync_type: "manual",
      entity_types: ["customer"],
      status: syncResults.errors.length > 0 ? "partial_success" : "completed",
      entity_count: syncResults.pulled + syncResults.pushed,
      success_count: syncResults.pulled + syncResults.pushed,
      failure_count: syncResults.errors.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_summary: syncResults.errors.length > 0 ? syncResults.errors.join("; ") : null,
    });

    console.log("=== Customer Sync Complete ===");
    console.log("Results:", syncResults);

    return new Response(
      JSON.stringify({
        success: true,
        results: syncResults
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in qbo-sync-customers:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function refreshTokenIfNeeded(supabase: any, connection: any) {
  const expiresAt = new Date(connection.qbo_token_expires_at);
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // FIXED: Changed from 5 minutes to 1 hour

  console.log("Token check:", {
    expiresAt: expiresAt.toISOString(),
    now: now.toISOString(),
    oneHourFromNow: oneHourFromNow.toISOString(),
    needsRefresh: expiresAt <= oneHourFromNow
  });

  if (expiresAt <= oneHourFromNow) {
    console.log("Token expiring soon, refreshing...");

    const { data: refreshData, error: refreshError } = await supabase.functions.invoke('qbo-token-refresh', {
      body: {
        organizationId: connection.organization_id
      }
    });

    if (refreshError) {
      console.error("Token refresh error:", refreshError);
      throw new Error(`Failed to refresh token: ${refreshError.message}`);
    }

    console.log("Token refreshed successfully");

    // Get the updated connection after refresh
    const { data: updatedConnection } = await supabase
      .from("qbo_connection")
      .select("*")
      .eq("organization_id", connection.organization_id)
      .eq("is_active", true)
      .single();

    if (updatedConnection) {
      connection.qbo_access_token = updatedConnection.qbo_access_token;
      connection.qbo_token_expires_at = updatedConnection.qbo_token_expires_at;
      console.log("Updated connection with new token");
    }
  }
}

async function pullCustomersFromQB(supabase: any, connection: any): Promise<number> {
  console.log("Pulling customers from QuickBooks...");

  const baseUrl = getQBApiBaseUrl(connection.environment);
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;

  let pagination = initPagination(1000);
  let allCustomers: any[] = [];

  // Paginated fetch from QB
  while (pagination.hasMore) {
    try {
      // Rate limiting
      await QBRateLimiter.checkLimit(connection.organization_id);

      const query = buildQBQuery("Customer", "Active = true", pagination);
      console.log("QB Query:", query);

      // Retry logic with exponential backoff
      const response = await retryableQBApiCall(async () => {
        return fetch(`${qbApiUrl}?query=${encodeURIComponent(query)}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${connection.qbo_access_token}`,
            "Accept": "application/json",
            "User-Agent": "Batchly-Sync/1.0",
          },
        });
      });

      if (!response.ok) {
        const errorText = await parseQBError(response);
        throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const customers = data.QueryResponse?.Customer || [];

      allCustomers = allCustomers.concat(customers);

      // Update pagination state
      pagination = updatePagination(pagination, data);

      // Log progress
      logProgress("Customer", allCustomers.length, pagination.totalCount, customers.length);

      // Break if no more records
      if (customers.length === 0 || !pagination.hasMore) {
        break;
      }

    } catch (error: any) {
      console.error("Error fetching customer page:", error.message);
      throw error;
    }
  }

  console.log(`Fetched ${allCustomers.length} customers from QuickBooks`);

  // CRITICAL FIX: Map QB customers to Batchly schema
  const mappedCustomers = allCustomers.map(qbCustomer => mapQBCustomerToBatchly(qbCustomer, connection.organization_id));

  // CRITICAL FIX: Batch upsert to database (was missing!)
  const savedCount = await batchUpsert(
    supabase,
    'customer_profile',
    mappedCustomers,
    'organization_id,qbo_id',
    500
  );

  console.log(`✓ Successfully saved ${savedCount} customers to database`);
  return savedCount;
}

/**
 * Map QuickBooks Customer to Batchly customer_profile schema
 * Complete field mapping per Task 1.1
 */
function mapQBCustomerToBatchly(qbCustomer: any, organizationId: string): any {
  return {
    organization_id: organizationId,
    qbo_id: qbCustomer.Id.toString(),

    // Basic Info
    display_name: qbCustomer.DisplayName || null,
    company_name: qbCustomer.CompanyName || null,
    first_name: qbCustomer.GivenName || null,
    last_name: qbCustomer.FamilyName || null,

    // Contact Info
    email: qbCustomer.PrimaryEmailAddr?.Address || null,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
    mobile_phone: qbCustomer.Mobile?.FreeFormNumber || null,
    fax_number: qbCustomer.Fax?.FreeFormNumber || null,
    website_url: qbCustomer.WebAddr?.URI || null,

    // Billing Address
    address_line1: qbCustomer.BillAddr?.Line1 || null,
    address_line2: qbCustomer.BillAddr?.Line2 || null,
    city: qbCustomer.BillAddr?.City || null,
    state: qbCustomer.BillAddr?.CountrySubDivisionCode || null,
    postal_code: qbCustomer.BillAddr?.PostalCode || null,
    country: qbCustomer.BillAddr?.Country || null,

    // Shipping Address
    shipping_address_line1: qbCustomer.ShipAddr?.Line1 || null,
    shipping_address_line2: qbCustomer.ShipAddr?.Line2 || null,
    shipping_city: qbCustomer.ShipAddr?.City || null,
    shipping_state: qbCustomer.ShipAddr?.CountrySubDivisionCode || null,
    shipping_postal_code: qbCustomer.ShipAddr?.PostalCode || null,
    shipping_country: qbCustomer.ShipAddr?.Country || null,

    // Financial Info
    credit_limit: parseQBAmount(qbCustomer.CreditLimit),
    current_balance: parseQBAmount(qbCustomer.Balance),
    balance_with_jobs: parseQBAmount(qbCustomer.BalanceWithJobs),
    open_balance_date: qbCustomer.OpenBalanceDate || null,

    // Payment Terms
    payment_terms_ref: qbCustomer.SalesTermRef ? {
      value: qbCustomer.SalesTermRef.value,
      name: qbCustomer.SalesTermRef.name
    } : null,

    // Pricing & Billing
    price_level_ref: qbCustomer.PriceLevelRef ? {
      value: qbCustomer.PriceLevelRef.value,
      name: qbCustomer.PriceLevelRef.name
    } : null,
    invoice_delivery_method: qbCustomer.PreferredDeliveryMethod?.toLowerCase() || 'email',
    currency_code: qbCustomer.CurrencyRef?.value || 'USD',

    // Tax Configuration
    tax_exempt: qbCustomer.Taxable === false,
    resale_number: qbCustomer.ResaleNum || null,

    // Status & Hierarchy
    is_active: qbCustomer.Active !== false,
    is_job: qbCustomer.Job === true,
    bill_with_parent: qbCustomer.BillWithParent === true,
    parent_ref: qbCustomer.ParentRef ? {
      value: qbCustomer.ParentRef.value,
      name: qbCustomer.ParentRef.name
    } : null,

    // Notes
    customer_notes: qbCustomer.Notes || null,

    // QB Sync Metadata
    qbo_sync_token: parseQBInt(qbCustomer.SyncToken),
    qbo_sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    qbo_created_at: formatQBTimestamp(qbCustomer.MetaData?.CreateTime),
    qbo_updated_at: formatQBTimestamp(qbCustomer.MetaData?.LastUpdatedTime),
  };
}

async function pushCustomersToQB(supabase: any, connection: any): Promise<number> {
  console.log("Pushing customers to QuickBooks...");

  // Get customers that need to be pushed
  const { data: customers, error } = await supabase
    .from("customer_profile")
    .select("*")
    .eq("organization_id", connection.organization_id)
    .eq("is_active", true)
    .or("qbo_id.is.null,qbo_sync_status.eq.pending")
    .limit(100); // Process in batches

  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }

  console.log(`Found ${customers.length} customers to push to QuickBooks`);

  let syncedCount = 0;
  const baseUrl = getQBApiBaseUrl(connection.environment);

  for (const customer of customers) {
    try {
      // Rate limiting
      await QBRateLimiter.checkLimit(connection.organization_id);

      const qbCustomerData: any = {
        DisplayName: customer.display_name || customer.company_name,
        CompanyName: customer.company_name || "",
        GivenName: customer.first_name || undefined,
        FamilyName: customer.last_name || undefined,
        PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
        PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
        Mobile: customer.mobile_phone ? { FreeFormNumber: customer.mobile_phone } : undefined,
        Fax: customer.fax_number ? { FreeFormNumber: customer.fax_number } : undefined,
        WebAddr: customer.website_url ? { URI: customer.website_url } : undefined,
        BillAddr: {
          Line1: customer.address_line1 || "",
          Line2: customer.address_line2 || "",
          City: customer.city || "",
          CountrySubDivisionCode: customer.state || "",
          PostalCode: customer.postal_code || "",
          Country: customer.country || "USA",
        },
        Active: customer.is_active,
      };

      const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/customer`;

      // If customer has qbo_id, update instead of create
      if (customer.qbo_id && customer.qbo_sync_token) {
        qbCustomerData.Id = customer.qbo_id;
        qbCustomerData.SyncToken = customer.qbo_sync_token;
        qbCustomerData.sparse = true; // Enable sparse update
      }

      const response = await retryableQBApiCall(async () => {
        return fetch(qbApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${connection.qbo_access_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(qbCustomerData),
        });
      });

      if (!response.ok) {
        const errorText = await parseQBError(response);
        console.error(`Failed to push customer ${customer.id}:`, errorText);
        continue;
      }

      const responseData = await response.json();
      const qbCustomer = responseData.Customer;

      if (qbCustomer) {
        // Update customer with QB data
        await supabase
          .from("customer_profile")
          .update({
            qbo_id: qbCustomer.Id.toString(),
            qbo_sync_token: parseQBInt(qbCustomer.SyncToken),
            qbo_sync_status: 'synced',
            last_sync_at: new Date().toISOString(),
            qbo_created_at: formatQBTimestamp(qbCustomer.MetaData?.CreateTime),
            qbo_updated_at: formatQBTimestamp(qbCustomer.MetaData?.LastUpdatedTime),
          })
          .eq("id", customer.id);

        syncedCount++;
        console.log(`✓ Pushed customer ${customer.display_name || customer.company_name}`);
      }
    } catch (error: any) {
      console.error(`Failed to push customer ${customer.id}:`, error.message);
    }
  }

  console.log(`Successfully pushed ${syncedCount} customers to QuickBooks`);
  return syncedCount;
}

serve(handler);
