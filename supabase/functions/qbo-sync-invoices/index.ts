import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.5/+esm";
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
  sessionId?: string;
  offset?: number;
  direction?: "push" | "pull" | "both";
  batchSize?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    const { 
      organizationId, 
      sessionId,
      offset = 0,
      direction = "pull",
      batchSize = 50 // Smaller batches for invoices (larger objects)
    }: SyncRequest = await req.json();

    console.log("=== Starting Invoice Sync ===");
    console.log("Organization ID:", organizationId);
    console.log("Direction:", direction);
    console.log("Session ID:", sessionId);
    console.log("Offset:", offset);
    console.log("Batch Size:", batchSize);

    // Get QuickBooks connection
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

    // Pull invoices from QuickBooks
    if (direction === "pull" || direction === "both") {
      try {
        const pullResult = await pullInvoicesFromQB(
          supabase, 
          connection, 
          sessionId || null,
          offset,
          batchSize
        );
        syncResults.pulled = pullResult;
      } catch (error: any) {
        console.error("Pull error:", error);
        syncResults.errors.push(`Pull error: ${error.message}`);
      }
    }

    // Push invoices to QuickBooks (create/update invoices in QB)
    if (direction === "push" || direction === "both") {
      try {
        const pushResult = await pushInvoicesToQB(supabase, connection);
        syncResults.pushed = pushResult;
      } catch (error: any) {
        console.error("Push error:", error);
        syncResults.errors.push(`Push error: ${error.message}`);
      }
    }

    // Log sync history
    await supabase.from("qbo_sync_history").insert({
      organization_id: organizationId,
      sync_type: sessionId ? "chunked" : "manual",
      entity_types: ["invoice"],
      status: syncResults.errors.length > 0 ? "partial_success" : "completed",
      entity_count: syncResults.pulled + syncResults.pushed,
      success_count: syncResults.pulled + syncResults.pushed,
      failure_count: syncResults.errors.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_summary: syncResults.errors.length > 0 ? syncResults.errors.join("; ") : null,
    });

    console.log("=== Invoice Sync Complete ===");
    console.log("Results:", syncResults);

    return new Response(
      JSON.stringify({
        success: true,
        results: syncResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Invoice sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

async function refreshTokenIfNeeded(supabase: any, connection: any): Promise<void> {
  if (!connection.qbo_token_expires_at) {
    console.log("No token expiration date found, skipping refresh check");
    return;
  }

  const expiresAt = new Date(connection.qbo_token_expires_at);
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
      .select("qbo_access_token, qbo_token_expires_at")
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

async function pullInvoicesFromQB(
  supabase: any,
  connection: any,
  sessionId: string | null,
  startOffset: number,
  batchSize: number
): Promise<number> {
  console.log("Pulling invoices from QuickBooks...");
  
  const rateLimiter = new QBRateLimiter();
  const baseUrl = getQBApiBaseUrl(connection.environment);
  let totalPulled = 0;
  let currentOffset = startOffset;
  let hasMore = true;

  // Get or create session
  let session = null;
  if (sessionId) {
    const { data } = await supabase
      .from('qbo_sync_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    session = data;
  }

  // Build customer and item lookups for foreign key mapping
  // Fetch all customers and items first to build lookup maps
  const { data: customers } = await supabase
    .from('customer_profile')
    .select('id, qbo_id')
    .eq('organization_id', connection.organization_id)
    .not('qbo_id', 'is', null);
  
  const { data: items } = await supabase
    .from('item_record')
    .select('id, qbo_id')
    .eq('organization_id', connection.organization_id)
    .not('qbo_id', 'is', null);

  const customerMap = new Map(customers?.map((c: any) => [c.qbo_id!, c.id]) || []);
  const itemMap = new Map(items?.map((i: any) => [i.qbo_id!, i.id]) || []);

  while (hasMore) {
    await QBRateLimiter.checkLimit(connection.organization_id);

    // Build query with pagination
    const query = `SELECT * FROM Invoice STARTPOSITION ${currentOffset + 1} MAXRESULTS ${batchSize}`;
    
    console.log(`Fetching invoices: offset=${currentOffset}, batch=${batchSize}`);

    try {
      const response = await retryableQBApiCall(async () => {
        return await fetch(
          `${baseUrl}/v3/company/${connection.qbo_realm_id}/query?query=${encodeURIComponent(query)}`,
          {
            headers: {
              "Authorization": `Bearer ${connection.qbo_access_token}`,
              "Accept": "application/json"
            }
          }
        );
      });

      if (!response.ok) {
        const errorMessage = await parseQBError(response);
        throw new Error(`QuickBooks API error: ${errorMessage}`);
      }

      const data = await response.json();
      const invoices = data.QueryResponse?.Invoice || [];
      
      console.log(`Received ${invoices.length} invoices`);

      if (invoices.length === 0) {
        hasMore = false;
        break;
      }

      // Transform and prepare invoices for upsert
      const invoiceRecords = [];
      const lineItemRecords = [];

      for (const qbInvoice of invoices) {
        // Map customer
        const customerBatchlyId = customerMap.get(qbInvoice.CustomerRef?.value);
        if (!customerBatchlyId) {
          console.warn(`Customer not found for QB ID: ${qbInvoice.CustomerRef?.value}, skipping invoice ${qbInvoice.Id}`);
          continue;
        }

        // Prepare invoice record
        const invoiceRecord = {
          organization_id: connection.organization_id,
          qbo_id: qbInvoice.Id,
          invoice_number: qbInvoice.DocNumber || `INV-${qbInvoice.Id}`,
          invoice_date: qbInvoice.TxnDate || new Date().toISOString().split('T')[0],
          due_date: qbInvoice.DueDate,
          customer_id: customerBatchlyId,
          subtotal: parseQBAmount(qbInvoice.TotalAmt) || 0,
          tax_total: parseQBAmount(qbInvoice.TxnTaxDetail?.TaxLine[0]?.TaxLineDetail?.TaxPercent) || 0,
          total: parseQBAmount(qbInvoice.TotalAmt) || 0,
          balance_due: parseQBAmount(qbInvoice.Balance) || 0,
          status: parseQBAmount(qbInvoice.Balance) === 0 ? 'paid' : 'open',
          memo: qbInvoice.CustomerMemo?.value,
          qbo_sync_token: qbInvoice.SyncToken,
          qbo_sync_status: 'synced',
          source_system: 'QBO',
          last_sync_at: new Date().toISOString()
        };

        invoiceRecords.push(invoiceRecord);

        // Prepare line items
        const lines = qbInvoice.Line || [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.DetailType !== 'SalesItemLineDetail') continue;

          const detail = line.SalesItemLineDetail;
          const itemBatchlyId = itemMap.get(detail.ItemRef?.value);
          
          if (!itemBatchlyId) {
            console.warn(`Item not found for QB ID: ${detail.ItemRef?.value}, skipping line item`);
            continue;
          }

          lineItemRecords.push({
            organization_id: connection.organization_id,
            // invoice_id will be set after invoice upsert
            invoice_qbo_id: qbInvoice.Id, // Temporary field for mapping
            item_id: itemBatchlyId,
            description: line.Description,
            quantity: parseQBAmount(detail.Qty) || 1,
            unit_price: parseQBAmount(detail.UnitPrice) || 0,
            amount: parseQBAmount(line.Amount) || 0,
            position: i + 1,
            tax_rate: detail.TaxCodeRef?.value === 'TAX' ? 10 : 0, // Simplified
            last_sync_at: new Date().toISOString()
          });
        }
      }

      // Upsert invoices
      if (invoiceRecords.length > 0) {
        const { data: upsertedInvoices, error: invoiceError } = await supabase
          .from('invoice_record')
          .upsert(invoiceRecords, { 
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false 
          })
          .select('id, qbo_id');

        if (invoiceError) {
          console.error("Invoice upsert error:", invoiceError);
          throw invoiceError;
        }

        console.log(`✓ Upserted ${upsertedInvoices.length} invoices`);

        // Create mapping of qbo_id to Batchly invoice_id
        const invoiceIdMap = new Map(
          upsertedInvoices.map((inv: any) => [inv.qbo_id, inv.id])
        );

        // Map line items to actual invoice IDs
        const mappedLineItems = lineItemRecords.map(item => ({
          ...item,
          invoice_id: invoiceIdMap.get(item.invoice_qbo_id),
          invoice_qbo_id: undefined // Remove temporary field
        })).filter(item => item.invoice_id); // Only items with valid invoice_id

        // Delete existing line items for these invoices
        const invoiceIds = Array.from(invoiceIdMap.values());
        if (invoiceIds.length > 0) {
          await supabase
            .from('invoice_line_item')
            .delete()
            .in('invoice_id', invoiceIds);
        }

        // Insert new line items
        if (mappedLineItems.length > 0) {
          const { error: lineError } = await supabase
            .from('invoice_line_item')
            .insert(mappedLineItems);

          if (lineError) {
            console.error("Line item insert error:", lineError);
            throw lineError;
          }

          console.log(`✓ Inserted ${mappedLineItems.length} line items`);
        }

        totalPulled += upsertedInvoices.length;
      }

      // Update session if exists
      if (session) {
        await supabase
          .from('qbo_sync_sessions')
          .update({
            total_processed: session.total_processed + invoices.length,
            current_offset: currentOffset + invoices.length,
            last_chunk_at: new Date().toISOString()
          })
          .eq('id', session.id);
      }

      currentOffset += invoices.length;

      // Check if we should continue
      if (invoices.length < batchSize) {
        hasMore = false;
      }

      // Rate limiting pause between batches
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      throw error;
    }
  }

  console.log(`✓ Total invoices pulled: ${totalPulled}`);
  return totalPulled;
}

async function pushInvoicesToQB(supabase: any, connection: any): Promise<number> {
  console.log("Pushing invoices to QuickBooks...");

  // Get invoices that need to be pushed
  const { data: invoices, error } = await supabase
    .from("invoice_record")
    .select(`
      *,
      customer:customer_profile!inner(qbo_id, display_name),
      line_items:invoice_line_item(
        *,
        item:item_record!inner(qbo_id, name)
      )
    `)
    .eq("organization_id", connection.organization_id)
    .or("qbo_id.is.null,qbo_sync_status.eq.pending")
    .limit(50); // Smaller batches for invoices

  if (error) {
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  console.log(`Found ${invoices.length} invoices to push to QuickBooks`);

  let syncedCount = 0;
  const baseUrl = getQBApiBaseUrl(connection.environment);
  const rateLimiter = new QBRateLimiter();

  for (const invoice of invoices) {
    try {
      await QBRateLimiter.checkLimit(connection.organization_id);

      // Validate required QB references
      if (!invoice.customer?.qbo_id) {
        console.error(`Invoice ${invoice.id} missing customer QB ID, skipping`);
        continue;
      }

      // Build QB Invoice object
      const qbInvoiceData: any = {
        CustomerRef: {
          value: invoice.customer.qbo_id
        },
        TxnDate: invoice.invoice_date || new Date().toISOString().split('T')[0],
        DueDate: invoice.due_date,
        DocNumber: invoice.invoice_number,
      };

      // Add line items
      const lines = [];
      for (let i = 0; i < invoice.line_items.length; i++) {
        const lineItem = invoice.line_items[i];
        
        if (!lineItem.item?.qbo_id) {
          console.warn(`Line item ${lineItem.id} missing item QB ID, skipping`);
          continue;
        }

        lines.push({
          DetailType: "SalesItemLineDetail",
          Amount: lineItem.amount,
          Description: lineItem.description || undefined,
          SalesItemLineDetail: {
            ItemRef: {
              value: lineItem.item.qbo_id
            },
            Qty: lineItem.quantity,
            UnitPrice: lineItem.unit_price,
            TaxCodeRef: lineItem.tax_rate > 0 ? { value: "TAX" } : { value: "NON" }
          }
        });
      }

      if (lines.length === 0) {
        console.error(`Invoice ${invoice.id} has no valid line items, skipping`);
        continue;
      }

      qbInvoiceData.Line = lines;

      // Add optional fields
      if (invoice.memo) qbInvoiceData.CustomerMemo = { value: invoice.memo };
      if (invoice.private_note) qbInvoiceData.PrivateNote = invoice.private_note;

      const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/invoice`;

      // If invoice has qbo_id, update instead of create
      if (invoice.qbo_id && invoice.qbo_sync_token) {
        qbInvoiceData.Id = invoice.qbo_id;
        qbInvoiceData.SyncToken = invoice.qbo_sync_token;
        qbInvoiceData.sparse = true;
      }

      const response = await retryableQBApiCall(async () => {
        return fetch(qbApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${connection.qbo_access_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(qbInvoiceData),
        });
      });

      if (!response.ok) {
        const error = await parseQBError(response);
        console.error(`Failed to push invoice ${invoice.id}:`, error);
        continue;
      }

      const responseData = await response.json();
      const qbInvoice = responseData.Invoice;

      if (qbInvoice) {
        // Update invoice with QB data
        await supabase
          .from("invoice_record")
          .update({
            qbo_id: qbInvoice.Id.toString(),
            qbo_sync_token: qbInvoice.SyncToken,
            qbo_sync_status: 'synced',
            source_system: 'ERP',
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", invoice.id);

        syncedCount++;
        console.log(`✓ Pushed invoice ${invoice.invoice_number}`);
      }
    } catch (error: any) {
      console.error(`Failed to push invoice ${invoice.id}:`, error.message);
    }
  }

  console.log(`Successfully pushed ${syncedCount} invoices to QuickBooks`);
  return syncedCount;
}

serve(handler);
