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
  dryRun?: boolean;
  limit?: number;
}

interface InvoiceRecordPayload {
  organization_id: string;
  qbo_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  customer_id: string;
  subtotal: number;
  tax_total: number;
  total: number;
  balance_due: number;
  status: string;
  memo?: string;
  qbo_sync_token: number | null;
  qbo_sync_status: string;
  source_system: string;
  last_sync_at: string;
  qbo_created_at: string | null;
  qbo_updated_at: string | null;
  currency_code: string;
  exchange_rate: number | null;
  terms_ref: Record<string, unknown> | null;
  billing_address: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
  txn_tax_detail: Record<string, unknown> | null;
}

interface InvoiceLineRecordPayload {
  organization_id: string;
  invoice_qbo_id?: string;
  invoice_id?: string;
  item_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  position: number;
  tax_rate: number;
  tax_code?: string;
  last_sync_at: string;
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
      batchSize = 50, // Smaller batches for invoices (larger objects)
      dryRun = false,
      limit
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

    const syncResults = {
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
          batchSize,
          {
            dryRun,
            limit
          }
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

interface PullOptions {
  dryRun: boolean;
  limit?: number;
}

async function pullInvoicesFromQB(
  supabase: any,
  connection: any,
  sessionId: string | null,
  startOffset: number,
  batchSize: number,
  options: PullOptions
): Promise<number> {
  console.log("Pulling invoices from QuickBooks...");

  const rateLimiter = new QBRateLimiter();
  const baseUrl = getQBApiBaseUrl(connection.environment);
  let totalPulled = 0;
  let currentOffset = startOffset;
  let hasMore = true;
  const maxToProcess = typeof options.limit === "number" ? Math.max(options.limit, 0) : null;

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
    if (maxToProcess !== null && totalPulled >= maxToProcess) {
      console.log(`Reached requested invoice limit (${maxToProcess}). Stopping pull.`);
      break;
    }

    await QBRateLimiter.checkLimit(connection.organization_id);

    const remainingBudget =
      maxToProcess === null ? null : Math.max(maxToProcess - totalPulled, 0);

    if (remainingBudget !== null && remainingBudget === 0) {
      console.log("No remaining invoices requested. Stopping pull loop.");
      break;
    }

    const currentBatchSize =
      remainingBudget === null ? batchSize : Math.min(batchSize, Math.max(remainingBudget, 1));

    // Build query with pagination
    // NOTE: Unlike Customers, Invoices don't have an "Active" filter by default
    // All invoices (including voided/deleted) should be retrieved
    const query = `SELECT * FROM Invoice STARTPOSITION ${currentOffset + 1} MAXRESULTS ${currentBatchSize}`;
    
    console.log(`=== Fetching invoices: offset=${currentOffset}, batch=${currentBatchSize} ===`);
    console.log(`Query: ${query}`);

    try {
      const response = await retryableQBApiCall(async () => {
        return await fetch(
          `${baseUrl}/v3/company/${connection.qbo_realm_id}/query?query=${encodeURIComponent(query)}`,
          {
            headers: {
              "Authorization": `Bearer ${connection.qbo_access_token}`,
              "Accept": "application/json",
              "User-Agent": "Batchly-Sync/1.0"
            }
          }
        );
      });

      if (!response.ok) {
        const errorMessage = await parseQBError(response);
        
        // Enhanced error logging for debugging
        if (response.status === 403 || response.status === 401) {
          console.error("=== AUTHENTICATION ERROR ===");
          console.error("Status:", response.status);
          console.error("Realm ID:", connection.qbo_realm_id);
          console.error("Environment:", connection.environment);
          console.error("Base URL:", baseUrl);
          console.error("Error:", errorMessage);
          console.error("============================");
        }
        
        throw new Error(`QuickBooks API error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      const invoices = data.QueryResponse?.Invoice || [];
      const maxResults = data.QueryResponse?.maxResults;
      const totalCount = data.QueryResponse?.totalCount;
      
      console.log(`✓ Received ${invoices.length} invoices`);
      console.log(`  Total count: ${totalCount}, Max results: ${maxResults}`);

      if (invoices.length === 0) {
        console.log("No more invoices to fetch - reached end of results");
        hasMore = false;
        break;
      }

      // Transform and prepare invoices for upsert
      const invoiceRecords: InvoiceRecordPayload[] = [];
      const lineItemRecords: InvoiceLineRecordPayload[] = [];
      const lineItemPositionMap = new Map<string, number[]>();
      const invoicesWithLinePayload = new Set<string>();
      let skippedCount = 0;
      const batchSyncTimestamp = new Date().toISOString();

      console.log("Processing invoices...");
      for (const qbInvoice of invoices) {
        // Map customer
        const customerBatchlyId = customerMap.get(qbInvoice.CustomerRef?.value);
        if (!customerBatchlyId) {
          console.warn(`⚠ Customer not found for QB ID: ${qbInvoice.CustomerRef?.value}, skipping invoice ${qbInvoice.Id} (DocNumber: ${qbInvoice.DocNumber})`);
          skippedCount++;
          continue;
        }

        // Calculate monetary fields
        const totalAmount = parseQBAmount(qbInvoice.TotalAmt) ?? 0;
        const taxAmount = parseQBAmount(qbInvoice.TxnTaxDetail?.TotalTax) ?? 0;
        const subtotalAmount =
          parseQBAmount(qbInvoice.SubTotalAmt) ?? Math.max(totalAmount - taxAmount, 0);
        const balanceAmount = parseQBAmount(qbInvoice.Balance) ?? 0;

        let status = "sent";
        if (balanceAmount === 0) {
          status = "paid";
        } else if (totalAmount !== null && balanceAmount < totalAmount) {
          status = "partial";
        }

        if (status !== "paid" && qbInvoice.DueDate) {
          const due = new Date(qbInvoice.DueDate);
          if (!isNaN(due.getTime()) && due < new Date()) {
            status = "overdue";
          }
        }

        // Prepare invoice record
        const invoiceRecord = {
          organization_id: connection.organization_id,
          qbo_id: qbInvoice.Id,
          invoice_number: qbInvoice.DocNumber || `INV-${qbInvoice.Id}`,
          invoice_date: qbInvoice.TxnDate || new Date().toISOString().split('T')[0],
          due_date: qbInvoice.DueDate,
          customer_id: customerBatchlyId,
          subtotal: subtotalAmount,
          tax_total: taxAmount,
          total: totalAmount,
          balance_due: balanceAmount,
          status,
          memo: qbInvoice.CustomerMemo?.value,
          qbo_sync_token: parseQBInt(qbInvoice.SyncToken),
          qbo_sync_status: 'synced',
          source_system: 'QBO',
          last_sync_at: batchSyncTimestamp,
          qbo_created_at: formatQBTimestamp(qbInvoice.MetaData?.CreateTime),
          qbo_updated_at: formatQBTimestamp(qbInvoice.MetaData?.LastUpdatedTime),
          currency_code: qbInvoice.CurrencyRef?.value || 'USD',
          exchange_rate: parseQBAmount(qbInvoice.ExchangeRate),
          terms_ref: qbInvoice.SalesTermRef ? qbInvoice.SalesTermRef : null,
          billing_address: qbInvoice.BillAddr ? qbInvoice.BillAddr : null,
          shipping_address: qbInvoice.ShipAddr ? qbInvoice.ShipAddr : null,
          txn_tax_detail: qbInvoice.TxnTaxDetail ? qbInvoice.TxnTaxDetail : null
        };

        invoiceRecords.push(invoiceRecord);

        // Prepare line items
        const lines = qbInvoice.Line || [];
        let skippedLineItems = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Only process SalesItemLineDetail (not SubTotal, Discount, etc.)
          if (line.DetailType !== 'SalesItemLineDetail') {
            continue;
          }

          const detail = line.SalesItemLineDetail;
          
          // Check if item reference exists
          if (!detail.ItemRef?.value) {
            console.warn(`⚠ Invoice ${qbInvoice.DocNumber}: Line ${i+1} has no item reference, skipping`);
            skippedLineItems++;
            continue;
          }
          
          const itemBatchlyId = itemMap.get(detail.ItemRef.value);

          if (!itemBatchlyId) {
            console.warn(`⚠ Invoice ${qbInvoice.DocNumber}: Item not found for QB ID: ${detail.ItemRef.value}, skipping line item`);
            skippedLineItems++;
            continue;
          }

          const quantity = parseQBAmount(detail.Qty);
          const unitPrice = parseQBAmount(detail.UnitPrice);
          const lineAmount = parseQBAmount(line.Amount);
          const lineTaxRate = parseQBAmount(detail.TaxRate);

          if (!lineItemPositionMap.has(qbInvoice.Id)) {
            lineItemPositionMap.set(qbInvoice.Id, []);
          }
          lineItemPositionMap.get(qbInvoice.Id)!.push(i + 1);
          invoicesWithLinePayload.add(qbInvoice.Id);

          lineItemRecords.push({
            organization_id: connection.organization_id,
            // invoice_id will be set after invoice upsert
            invoice_qbo_id: qbInvoice.Id, // Temporary field for mapping
            item_id: itemBatchlyId,
            description: line.Description || detail.ItemRef.name || '',
            quantity: quantity ?? 1,
            unit_price: unitPrice ?? 0,
            amount: lineAmount ?? 0,
            position: i + 1,
            tax_rate: lineTaxRate ?? 0,
            tax_code: detail.TaxCodeRef?.value,
            last_sync_at: batchSyncTimestamp
          });
        }
        
        if (skippedLineItems > 0) {
          console.warn(`⚠ Invoice ${qbInvoice.DocNumber}: Skipped ${skippedLineItems} line items due to missing items`);
        }
      }
      
      if (skippedCount > 0) {
        console.warn(`⚠ Skipped ${skippedCount} invoices due to missing customers in this batch`);
      }

      const validInvoiceRecords = invoiceRecords.filter(record => {
        if (!record.qbo_id) {
          console.warn("Skipping invoice with missing qbo_id", record);
          return false;
        }
        if (!record.customer_id) {
          console.warn(`Skipping invoice ${record.qbo_id} - missing customer mapping`);
          return false;
        }
        if (!record.invoice_number) {
          console.warn(`Skipping invoice ${record.qbo_id} - missing invoice_number`);
          return false;
        }
        return true;
      });

      if (validInvoiceRecords.length !== invoiceRecords.length) {
        console.warn(
          `Filtered out ${invoiceRecords.length - validInvoiceRecords.length} invalid invoices before persistence`
        );
      }

      if (options.dryRun) {
        console.log(
          `[DRY RUN] Prepared ${validInvoiceRecords.length} invoices and ${lineItemRecords.length} line items (offset ${currentOffset})`
        );
        if (validInvoiceRecords[0]) {
          console.log("Sample invoice payload:", JSON.stringify(validInvoiceRecords[0], null, 2));
        }
        totalPulled += validInvoiceRecords.length;
        currentOffset += invoices.length;
        continue;
      }

      const validInvoiceQboIds = new Set(validInvoiceRecords.map(record => record.qbo_id));
      const filteredLineItems = lineItemRecords.filter(item => validInvoiceQboIds.has(item.invoice_qbo_id));
      const filteredPositionMap = new Map(
        Array.from(validInvoiceQboIds).map(qboId => [qboId, lineItemPositionMap.get(qboId) || []])
      );

      // Upsert invoices
      if (validInvoiceRecords.length > 0) {
        const { data: upsertedInvoices, error: invoiceError } = await supabase
          .from('invoice_record')
          .upsert(validInvoiceRecords, {
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
        const mappedLineItems = filteredLineItems
          .map(item => {
            const invoiceId = invoiceIdMap.get(item.invoice_qbo_id);
            if (!invoiceId) return null;

            const { invoice_qbo_id, ...rest } = item;
            return {
              ...rest,
              invoice_id: invoiceId
            };
          })
          .filter((item): item is InvoiceLineRecordPayload => Boolean(item));

        const linePositionsByInvoiceId = new Map(
          Array.from(invoiceIdMap.entries())
            .filter(([qboId]) => invoicesWithLinePayload.has(qboId))
            .map(([qboId, invoiceId]) => [
              invoiceId,
              filteredPositionMap.get(qboId) || []
            ])
            .filter(([, positions]) => positions.length > 0)
        );

        if (mappedLineItems.length > 0) {
          const { error: lineError } = await supabase
            .from('invoice_line_item')
            .upsert(mappedLineItems, {
              onConflict: 'invoice_id,position',
              ignoreDuplicates: false
            });

          if (lineError) {
            console.error("Line item upsert error:", lineError);
            throw lineError;
          }

          console.log(`✓ Upserted ${mappedLineItems.length} line items`);
        }

        // Remove orphaned line items whose positions were not present in the QB payload
        for (const [invoiceId, positions] of linePositionsByInvoiceId.entries()) {
          if (!invoiceId) continue;

          if (!positions || positions.length === 0) {
            const { error: clearError } = await supabase
              .from('invoice_line_item')
              .delete()
              .eq('invoice_id', invoiceId);
            if (clearError) {
              console.error(`Line item cleanup error for invoice ${invoiceId}:`, clearError);
              throw clearError;
            }
            continue;
          }

          const uniquePositions = Array.from(new Set(positions));
          const inList = `(${uniquePositions.join(',')})`;
          const { error: pruneError } = await supabase
            .from('invoice_line_item')
            .delete()
            .eq('invoice_id', invoiceId)
            .not('position', 'in', inList);
          if (pruneError) {
            console.error(`Line item prune error for invoice ${invoiceId}:`, pruneError);
            throw pruneError;
          }
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
      if (invoices.length < currentBatchSize) {
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
