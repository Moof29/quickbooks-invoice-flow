import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, direction = "both" }: SyncRequest = await req.json();

    // Get QuickBooks connection
    const { data: connection, error: connectionError } = await supabase
      .from("qbo_connection")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .single();

    if (connectionError || !connection) {
      throw new Error("Active QuickBooks connection not found");
    }

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
        syncResults.errors.push(`Pull error: ${error.message}`);
      }
    }

    // Push customers to QuickBooks
    if (direction === "push" || direction === "both") {
      try {
        const pushResult = await pushCustomersToQB(supabase, connection);
        syncResults.pushed = pushResult;
      } catch (error: any) {
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
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log("Token expired, refreshing...");
    const refreshResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/qbo-token-refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        organizationId: connection.organization_id
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh token");
    }
  }
}

async function pullCustomersFromQB(supabase: any, connection: any): Promise<number> {
  console.log("Pulling customers from QuickBooks...");
  
  const qbApiUrl = `https://quickbooks-api.intuit.com/v3/company/${connection.qbo_realm_id}/query`;
  const query = "SELECT * FROM Customer MAXRESULTS 1000";

  const response = await fetch(`${qbApiUrl}?query=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${connection.qbo_access_token}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error: ${errorText}`);
  }

  const data = await response.json();
  const customers = data.QueryResponse?.Customer || [];
  
  console.log(`Found ${customers.length} customers in QuickBooks`);

  let syncedCount = 0;
  for (const qbCustomer of customers) {
    try {
      // Map QuickBooks customer to Batchly format
      const customerData = {
        organization_id: connection.organization_id,
        display_name: qbCustomer.Name || "",
        company_name: qbCustomer.CompanyName || qbCustomer.Name || "",
        email: qbCustomer.PrimaryEmailAddr?.Address || "",
        phone: qbCustomer.PrimaryPhone?.FreeFormNumber || "",
        address_line1: qbCustomer.BillAddr?.Line1 || "",
        address_line2: qbCustomer.BillAddr?.Line2 || "",
        city: qbCustomer.BillAddr?.City || "",
        state: qbCustomer.BillAddr?.CountrySubDivisionCode || "",
        postal_code: qbCustomer.BillAddr?.PostalCode || "",
        country: qbCustomer.BillAddr?.Country || "",
        is_active: qbCustomer.Active !== false,
        qbo_id: qbCustomer.Id.toString(),
        last_sync_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Check if customer already exists
      const { data: existingCustomer } = await supabase
        .from("customer_profile")
        .select("id")
        .eq("qbo_id", qbCustomer.Id.toString())
        .eq("organization_id", connection.organization_id)
        .single();

      if (existingCustomer) {
        // Update existing customer
        await supabase
          .from("customer_profile")
          .update(customerData)
          .eq("id", existingCustomer.id);
      } else {
        // Insert new customer
        await supabase
          .from("customer_profile")
          .insert(customerData);
      }

      syncedCount++;
    } catch (error: any) {
      console.error(`Failed to sync customer ${qbCustomer.Id}:`, error);
    }
  }

  console.log(`Successfully synced ${syncedCount} customers from QuickBooks`);
  return syncedCount;
}

async function pushCustomersToQB(supabase: any, connection: any): Promise<number> {
  console.log("Pushing customers to QuickBooks...");
  
  // Get customers that need to be pushed (no qbo_id or updated since last sync)
  const { data: customers, error } = await supabase
    .from("customer_profile")
    .select("*")
    .eq("organization_id", connection.organization_id)
    .eq("is_active", true)
    .or("qbo_id.is.null,last_sync_at.is.null,updated_at.gt.last_sync_at");

  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }

  console.log(`Found ${customers.length} customers to push to QuickBooks`);

  let syncedCount = 0;
  for (const customer of customers) {
    try {
      const qbCustomerData = {
        Name: customer.display_name || customer.company_name,
        CompanyName: customer.company_name || "",
        PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
        PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
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

      const qbApiUrl = `https://quickbooks-api.intuit.com/v3/company/${connection.qbo_realm_id}/customer`;
      
      let method = "POST";
      let url = qbApiUrl;
      
      // If customer has qbo_id, update instead of create
      if (customer.qbo_id) {
        // First get the current customer data to get the SyncToken
        const getResponse = await fetch(`${qbApiUrl}/${customer.qbo_id}`, {
          headers: {
            "Authorization": `Bearer ${connection.qbo_access_token}`,
            "Accept": "application/json",
          },
        });

        if (getResponse.ok) {
          const getCurrentData = await getResponse.json();
          const currentCustomer = getCurrentData.QueryResponse?.Customer?.[0];
          if (currentCustomer) {
            qbCustomerData.Id = customer.qbo_id;
            qbCustomerData.SyncToken = currentCustomer.SyncToken;
            method = "POST"; // QuickBooks uses POST for updates too
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${connection.qbo_access_token}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(qbCustomerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to push customer ${customer.id}:`, errorText);
        continue;
      }

      const responseData = await response.json();
      const qbCustomer = responseData.QueryResponse?.Customer?.[0];

      if (qbCustomer) {
        // Update customer with QB ID and sync timestamp
        await supabase
          .from("customer_profile")
          .update({
            qbo_id: qbCustomer.Id.toString(),
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", customer.id);

        syncedCount++;
      }
    } catch (error: any) {
      console.error(`Failed to push customer ${customer.id}:`, error);
    }
  }

  console.log(`Successfully pushed ${syncedCount} customers to QuickBooks`);
  return syncedCount;
}

serve(handler);