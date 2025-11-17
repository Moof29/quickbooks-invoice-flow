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
  createSupabaseClient,
  createLookupMap
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, direction = "both" }: SyncRequest = await req.json();

    console.log("=== Starting Payment Sync ===");
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

    // Pull payments from QuickBooks
    if (direction === "pull" || direction === "both") {
      try {
        const pullResult = await pullPaymentsFromQB(supabase, connection);
        syncResults.pulled = pullResult;
      } catch (error: any) {
        console.error("Pull error:", error);
        syncResults.errors.push(`Pull error: ${error.message}`);
      }
    }

    // Push payments to QuickBooks (for future implementation)
    if (direction === "push" || direction === "both") {
      console.log("Push to QuickBooks not yet implemented for payments");
      syncResults.pushed = 0;
    }

    // Log sync history
    await supabase.from("qbo_sync_history").insert({
      organization_id: organizationId,
      sync_type: "manual",
      entity_types: ["payment"],
      status: syncResults.errors.length > 0 ? "partial_success" : "completed",
      entity_count: syncResults.pulled + syncResults.pushed,
      success_count: syncResults.pulled + syncResults.pushed,
      failure_count: syncResults.errors.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_summary: syncResults.errors.length > 0 ? syncResults.errors.join("; ") : null,
    });

    console.log("=== Payment Sync Complete ===");
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
    console.error("Error in qbo-sync-payments:", error);
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
  // ✅ FIX: Check for null/undefined token expiration
  if (!connection.qbo_token_expires_at) {
    console.log("No token expiration date found, skipping refresh check");
    return;
  }

  const expiresAt = new Date(connection.qbo_token_expires_at);

  // ✅ FIX: Validate the date is valid
  if (isNaN(expiresAt.getTime())) {
    console.error("Invalid token expiration date:", connection.qbo_token_expires_at);
    return;
  }

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

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

async function pullPaymentsFromQB(supabase: any, connection: any): Promise<number> {
  console.log("Pulling payments from QuickBooks...");

  // CRITICAL FIX (Task 1.14): Create lookup maps to eliminate N+1 queries
  console.log("Creating lookup maps for customers and invoices...");
  const customerLookup = await createLookupMap(
    supabase,
    'customer_profile',
    connection.organization_id,
    'qbo_id',
    'id'
  );
  const invoiceLookup = await createLookupMap(
    supabase,
    'invoice_record',
    connection.organization_id,
    'qbo_id',
    'id'
  );
  console.log(`✓ Created lookup maps: ${customerLookup.size} customers, ${invoiceLookup.size} invoices`);

  const baseUrl = getQBApiBaseUrl(connection.environment);
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;

  let pagination = initPagination(1000);
  let allPayments: any[] = [];

  // Paginated fetch from QB
  while (pagination.hasMore) {
    try {
      // Rate limiting
      await QBRateLimiter.checkLimit(connection.organization_id);

      const query = buildQBQuery("Payment", "", pagination);
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
      const payments = data.QueryResponse?.Payment || [];

      allPayments = allPayments.concat(payments);

      // Update pagination state
      pagination = updatePagination(pagination, data);

      // Log progress
      logProgress("Payment", allPayments.length, pagination.totalCount, payments.length);

      // Break if no more records
      if (payments.length === 0 || !pagination.hasMore) {
        break;
      }

    } catch (error: any) {
      console.error("Error fetching payment page:", error.message);
      throw error;
    }
  }

  console.log(`Fetched ${allPayments.length} payments from QuickBooks`);

  // CRITICAL FIX: Map QB payments to Batchly schema using lookup maps (no N+1 queries!)
  const mappedPayments = allPayments.map(qbPayment =>
    mapQBPaymentToBatchly(qbPayment, connection.organization_id, customerLookup, invoiceLookup)
  );

  // CRITICAL FIX: Batch upsert to database
  const savedCount = await batchUpsert(
    supabase,
    'invoice_payment',
    mappedPayments,
    'organization_id,qbo_id',
    500
  );

  console.log(`✓ Successfully saved ${savedCount} payments to database`);
  return savedCount;
}

/**
 * Map QuickBooks Payment to Batchly invoice_payment schema
 * Uses lookup maps to avoid N+1 queries (Task 1.14)
 */
function mapQBPaymentToBatchly(
  qbPayment: any,
  organizationId: string,
  customerLookup: Map<string, string>,
  invoiceLookup: Map<string, string>
): any {
  // Resolve customer ID using lookup map (no DB query!)
  const customerId = qbPayment.CustomerRef
    ? customerLookup.get(qbPayment.CustomerRef.value.toString()) || null
    : null;

  // Resolve invoice ID from line items using lookup map (no DB query!)
  let invoiceId = null;
  let unapplied = true;

  if (qbPayment.Line && qbPayment.Line.length > 0) {
    for (const line of qbPayment.Line) {
      if (line.LinkedTxn && line.LinkedTxn.length > 0) {
        for (const linkedTxn of line.LinkedTxn) {
          if (linkedTxn.TxnType === 'Invoice') {
            invoiceId = invoiceLookup.get(linkedTxn.TxnId.toString()) || null;
            if (invoiceId) {
              unapplied = false;
              break;
            }
          }
        }
      }
      if (invoiceId) break;
    }
  }

  // Override with QB's Unapplied flag if present
  if (qbPayment.Unapplied !== undefined) {
    unapplied = qbPayment.Unapplied;
  }

  // Map payment method
  let paymentMethod = 'other';
  if (qbPayment.PaymentMethodRef) {
    const methodName = qbPayment.PaymentMethodRef.name?.toLowerCase() || '';
    if (methodName.includes('cash')) paymentMethod = 'cash';
    else if (methodName.includes('check')) paymentMethod = 'check';
    else if (methodName.includes('credit') || methodName.includes('card')) paymentMethod = 'credit_card';
    else if (methodName.includes('ach') || methodName.includes('bank')) paymentMethod = 'ach';
    else paymentMethod = 'other';
  }

  return {
    organization_id: organizationId,
    qbo_id: qbPayment.Id.toString(),
    customer_id: customerId,
    invoice_id: invoiceId,
    payment_date: qbPayment.TxnDate || new Date().toISOString().split('T')[0],
    amount: parseQBAmount(qbPayment.TotalAmt) || 0,
    payment_method: paymentMethod,
    reference_number: qbPayment.PaymentRefNum || null,
    notes: qbPayment.PrivateNote || null,

    // QB Sync Metadata
    qbo_sync_status: 'synced',
    qbo_sync_token: parseQBInt(qbPayment.SyncToken),
    qbo_created_at: formatQBTimestamp(qbPayment.MetaData?.CreateTime),
    qbo_updated_at: formatQBTimestamp(qbPayment.MetaData?.LastUpdatedTime),
    last_sync_at: new Date().toISOString(),

    // Deposit Account (JSONB)
    deposit_account_ref: qbPayment.DepositToAccountRef ? {
      value: qbPayment.DepositToAccountRef.value,
      name: qbPayment.DepositToAccountRef.name
    } : null,

    // Unapplied Payment Tracking
    unapplied: unapplied,
    unapplied_amount: unapplied ? parseQBAmount(qbPayment.TotalAmt) : null,

    // Payment Status
    payment_status: 'completed',

    // Reconciliation
    reconciliation_status: 'unreconciled',
  };
}

serve(handler);
