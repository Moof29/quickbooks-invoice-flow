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

    const { organizationId, direction = "pull" }: SyncRequest = await req.json();

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
        syncResults.errors.push(`Pull error: ${error.message}`);
      }
    }

    // Push payments to QuickBooks (for future implementation)
    if (direction === "push" || direction === "both") {
      try {
        const pushResult = await pushPaymentsToQB(supabase, connection);
        syncResults.pushed = pushResult;
      } catch (error: any) {
        syncResults.errors.push(`Push error: ${error.message}`);
      }
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
  const expiresAt = new Date(connection.qbo_token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    console.log("Token expired, refreshing...");

    const { data: refreshData, error: refreshError } = await supabase.functions.invoke('qbo-token-refresh', {
      body: {
        organizationId: connection.organization_id
      }
    });

    if (refreshError) {
      throw new Error(`Failed to refresh token: ${refreshError.message}`);
    }

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
    }
  }
}

async function pullPaymentsFromQB(supabase: any, connection: any): Promise<number> {
  console.log("Pulling payments from QuickBooks...");

  const baseUrl = connection.environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks-api.intuit.com';
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;
  const query = "SELECT * FROM Payment MAXRESULTS 1000";

  console.log("Making request to:", qbApiUrl);

  try {
    const response = await fetch(`${qbApiUrl}?query=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${connection.qbo_access_token}`,
        "Accept": "application/json",
        "User-Agent": "Batchly-Sync/1.0",
      },
    });

    console.log("QuickBooks API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("QuickBooks API error response:", response.status, errorText);
      throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`Found ${data.QueryResponse?.Payment?.length || 0} payments in QuickBooks`);

    const payments = data.QueryResponse?.Payment || [];

    // Get mapping of QBO invoice IDs to local invoice IDs
    const { data: invoices } = await supabase
      .from('invoice_record')
      .select('id, qbo_id')
      .eq('organization_id', connection.organization_id)
      .not('qbo_id', 'is', null);

    const qboInvoiceMap = new Map(
      (invoices || []).map((inv: any) => [inv.qbo_id, inv.id])
    );

    // Get mapping of QBO customer IDs to local customer IDs
    const { data: customers } = await supabase
      .from('customer_profile')
      .select('id, qbo_id')
      .eq('organization_id', connection.organization_id)
      .not('qbo_id', 'is', null);

    const qboCustomerMap = new Map(
      (customers || []).map((cust: any) => [cust.qbo_id, cust.id])
    );

    let savedCount = 0;
    for (const qbPayment of payments) {
      try {
        // Get customer ID
        const customerId = qbPayment.CustomerRef?.value
          ? qboCustomerMap.get(qbPayment.CustomerRef.value)
          : null;

        if (!customerId) {
          console.warn(`Customer not found for payment ${qbPayment.Id}, skipping`);
          continue;
        }

        // Process each line item (payment can be applied to multiple invoices)
        const lines = qbPayment.Line || [];

        for (const line of lines) {
          // Only process invoice line items (LinkedTxn type)
          if (!line.LinkedTxn || line.LinkedTxn.length === 0) {
            // This is an unapplied payment
            const paymentData = {
              organization_id: connection.organization_id,
              qbo_id: qbPayment.Id.toString(),
              customer_id: customerId,
              invoice_id: null, // Unapplied payment
              payment_date: qbPayment.TxnDate || new Date().toISOString().split('T')[0],
              amount: qbPayment.TotalAmt ? parseFloat(qbPayment.TotalAmt.toString()) : 0,
              payment_method: mapPaymentMethod(qbPayment.PaymentMethodRef?.name),
              reference_number: qbPayment.PaymentRefNum || null,
              notes: qbPayment.PrivateNote || null,

              // Payment tracking fields
              unapplied: true,
              unapplied_amount: qbPayment.UnappliedAmt ? parseFloat(qbPayment.UnappliedAmt.toString()) : 0,
              payment_status: 'completed',

              // Deposit account
              deposit_account_ref: qbPayment.DepositToAccountRef ? {
                value: qbPayment.DepositToAccountRef.value,
                name: qbPayment.DepositToAccountRef.name
              } : null,

              // QBO sync fields
              qbo_sync_status: 'synced',
              qbo_sync_token: qbPayment.SyncToken ? parseInt(qbPayment.SyncToken.toString()) : null,
              qbo_created_at: qbPayment.MetaData?.CreateTime || null,
              qbo_updated_at: qbPayment.MetaData?.LastUpdatedTime || null,
              last_sync_at: new Date().toISOString(),
            };

            const { error } = await supabase
              .from('invoice_payment')
              .upsert(paymentData, {
                onConflict: 'organization_id,qbo_id',
                ignoreDuplicates: false
              });

            if (error) {
              console.error(`Failed to save unapplied payment ${qbPayment.Id}:`, error);
            } else {
              savedCount++;
            }

            continue;
          }

          // Process linked invoices
          for (const linkedTxn of line.LinkedTxn) {
            if (linkedTxn.TxnType !== 'Invoice') continue;

            const invoiceId = qboInvoiceMap.get(linkedTxn.TxnId);
            if (!invoiceId) {
              console.warn(`Invoice ${linkedTxn.TxnId} not found locally, skipping payment link`);
              continue;
            }

            const paymentData = {
              organization_id: connection.organization_id,
              qbo_id: `${qbPayment.Id}-${linkedTxn.TxnId}`, // Composite ID for linked payments
              customer_id: customerId,
              invoice_id: invoiceId,
              payment_date: qbPayment.TxnDate || new Date().toISOString().split('T')[0],
              amount: line.Amount ? parseFloat(line.Amount.toString()) : 0,
              payment_method: mapPaymentMethod(qbPayment.PaymentMethodRef?.name),
              reference_number: qbPayment.PaymentRefNum || null,
              notes: qbPayment.PrivateNote || null,

              // Payment tracking fields
              unapplied: false,
              payment_status: 'completed',

              // Deposit account
              deposit_account_ref: qbPayment.DepositToAccountRef ? {
                value: qbPayment.DepositToAccountRef.value,
                name: qbPayment.DepositToAccountRef.name
              } : null,

              // QBO sync fields
              qbo_sync_status: 'synced',
              qbo_sync_token: qbPayment.SyncToken ? parseInt(qbPayment.SyncToken.toString()) : null,
              qbo_created_at: qbPayment.MetaData?.CreateTime || null,
              qbo_updated_at: qbPayment.MetaData?.LastUpdatedTime || null,
              last_sync_at: new Date().toISOString(),
            };

            const { error } = await supabase
              .from('invoice_payment')
              .upsert(paymentData, {
                onConflict: 'organization_id,qbo_id',
                ignoreDuplicates: false
              });

            if (error) {
              console.error(`Failed to save payment ${qbPayment.Id} for invoice ${invoiceId}:`, error);
            } else {
              savedCount++;
            }
          }
        }
      } catch (paymentError: any) {
        console.error(`Error processing payment ${qbPayment.Id}:`, paymentError);
      }
    }

    console.log(`Successfully saved ${savedCount} payment records to database`);
    return savedCount;

  } catch (error: any) {
    console.error("Detailed error calling QuickBooks API:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw new Error(`Network error: ${error.message}`);
  }
}

function mapPaymentMethod(qboMethod?: string): string {
  if (!qboMethod) return 'other';

  const methodMap: { [key: string]: string } = {
    'cash': 'cash',
    'check': 'check',
    'credit card': 'credit_card',
    'debit card': 'debit_card',
    'ach': 'ach',
    'wire': 'wire_transfer',
    'paypal': 'paypal',
    'stripe': 'stripe',
  };

  const normalized = qboMethod.toLowerCase();
  return methodMap[normalized] || 'other';
}

async function pushPaymentsToQB(supabase: any, connection: any): Promise<number> {
  console.log("Push to QuickBooks not yet implemented for payments");
  return 0;
}

serve(handler);
