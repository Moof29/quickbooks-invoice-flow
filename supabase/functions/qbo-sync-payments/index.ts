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
  console.log("Connection details:", {
    environment: connection.environment,
    realm_id: connection.qbo_realm_id,
    has_token: !!connection.qbo_access_token,
  });
  
  // Use sandbox URL for testing, production for live
  const baseUrl = connection.environment === 'sandbox' 
    ? 'https://sandbox-quickbooks.api.intuit.com' 
    : 'https://quickbooks-api.intuit.com';
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;
  const query = "SELECT * FROM Payment MAXRESULTS 1000";

  console.log("Making request to:", qbApiUrl);
  console.log("Query:", query);

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
    console.log("QuickBooks API response received");
    
    // Check if QueryResponse exists
    if (!data.QueryResponse) {
      console.log("No QueryResponse in API response");
      return 0;
    }
    
    const payments = data.QueryResponse?.Payment || [];
    
    console.log(`Found ${payments.length} payments in QuickBooks`);

    // Save payments to database
    let savedCount = 0;
    for (const qbPayment of payments) {
      try {
        console.log(`Processing payment ${qbPayment.Id}...`);
        
        // Get customer ID from customer reference
        let customerId = null;
        if (qbPayment.CustomerRef) {
          const { data: customer } = await supabase
            .from('customer_profile')
            .select('id')
            .eq('organization_id', connection.organization_id)
            .eq('qbo_id', qbPayment.CustomerRef.value)
            .single();
          
          customerId = customer?.id || null;
        }

        // Get invoice ID from line items (if payment is applied to an invoice)
        let invoiceId = null;
        let unapplied = true;
        
        if (qbPayment.Line && qbPayment.Line.length > 0) {
          // Find the line with a LinkedTxn that points to an invoice
          for (const line of qbPayment.Line) {
            if (line.LinkedTxn && line.LinkedTxn.length > 0) {
              for (const linkedTxn of line.LinkedTxn) {
                if (linkedTxn.TxnType === 'Invoice') {
                  // Look up the invoice by QBO ID
                  const { data: invoice } = await supabase
                    .from('invoice_record')
                    .select('id')
                    .eq('organization_id', connection.organization_id)
                    .eq('qbo_id', linkedTxn.TxnId)
                    .single();
                  
                  if (invoice) {
                    invoiceId = invoice.id;
                    unapplied = false;
                    break;
                  }
                }
              }
            }
            if (invoiceId) break;
          }
        }

        // Check if payment is unapplied
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

        // Map QB payment to our database structure
        const paymentData = {
          organization_id: connection.organization_id,
          qbo_id: qbPayment.Id.toString(),
          customer_id: customerId,
          invoice_id: invoiceId,
          payment_date: qbPayment.TxnDate || new Date().toISOString().split('T')[0],
          amount: qbPayment.TotalAmt ? parseFloat(qbPayment.TotalAmt.toString()) : 0,
          payment_method: paymentMethod,
          reference_number: qbPayment.PaymentRefNum || null,
          notes: qbPayment.PrivateNote || null,
          // QBO sync fields
          qbo_sync_status: 'synced',
          qbo_sync_token: qbPayment.SyncToken ? parseInt(qbPayment.SyncToken) : null,
          qbo_created_at: qbPayment.MetaData?.CreateTime || null,
          qbo_updated_at: qbPayment.MetaData?.LastUpdatedTime || null,
          last_sync_at: new Date().toISOString(),
          // Deposit account reference (JSONB)
          deposit_account_ref: qbPayment.DepositToAccountRef || null,
          // Unapplied payment flag
          unapplied: unapplied,
          unapplied_amount: unapplied ? parseFloat(qbPayment.TotalAmt?.toString() || '0') : null,
          // Payment status
          payment_status: 'completed',
          // Reconciliation
          reconciliation_status: 'unreconciled',
        };

        // Insert or update payment
        const { error } = await supabase
          .from('invoice_payment')
          .upsert(paymentData, {
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Failed to save payment ${qbPayment.Id}:`, error);
        } else {
          savedCount++;
          console.log(`✓ Saved payment ${qbPayment.Id}`);
        }
      } catch (paymentError: any) {
        console.error(`Error processing payment ${qbPayment.Id}:`, paymentError);
      }
    }

    console.log(`Successfully saved ${savedCount} payments to database`);
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

serve(handler);
