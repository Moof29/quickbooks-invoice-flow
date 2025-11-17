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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, direction = "both" }: SyncRequest = await req.json();

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

    // Pull items from QuickBooks
    if (direction === "pull" || direction === "both") {
      try {
        const pullResult = await pullItemsFromQB(supabase, connection);
        syncResults.pulled = pullResult;
      } catch (error: any) {
        syncResults.errors.push(`Pull error: ${error.message}`);
      }
    }

    // Push items to QuickBooks (for future implementation)
    if (direction === "push" || direction === "both") {
      try {
        const pushResult = await pushItemsToQB(supabase, connection);
        syncResults.pushed = pushResult;
      } catch (error: any) {
        syncResults.errors.push(`Push error: ${error.message}`);
      }
    }

    // Log sync history
    await supabase.from("qbo_sync_history").insert({
      organization_id: organizationId,
      sync_type: "manual",
      entity_types: ["item"],
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
    console.error("Error in qbo-sync-items:", error);
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

async function pullItemsFromQB(supabase: any, connection: any): Promise<number> {
  console.log("Pulling items from QuickBooks...");

  const baseUrl = getQBApiBaseUrl(connection.environment);
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;

  let pagination = initPagination(1000);
  let allItems: any[] = [];

  // Paginated fetch from QB
  while (pagination.hasMore) {
    try {
      // Rate limiting
      await QBRateLimiter.checkLimit(connection.organization_id);

      const query = buildQBQuery("Item", "Active IN (true, false)", pagination);
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
      const items = data.QueryResponse?.Item || [];

      allItems = allItems.concat(items);

      // Update pagination state
      pagination = updatePagination(pagination, data);

      // Log progress
      logProgress("Item", allItems.length, pagination.totalCount, items.length);

      // Break if no more records
      if (items.length === 0 || !pagination.hasMore) {
        break;
      }

    } catch (error: any) {
      console.error("Error fetching item page:", error.message);
      throw error;
    }
  }

  console.log(`Fetched ${allItems.length} items from QuickBooks`);

  // CRITICAL FIX: Map QB items to Batchly schema
  const mappedItems = allItems.map(qbItem => mapQBItemToBatchly(qbItem, connection.organization_id));

  // CRITICAL FIX: Batch upsert to database
  const savedCount = await batchUpsert(
    supabase,
    'item_record',
    mappedItems,
    'organization_id,qbo_id',
    500
  );

  console.log(`✓ Successfully saved ${savedCount} items to database`);
  return savedCount;
}

/**
 * Map QuickBooks Item to Batchly item_record schema
 * Complete field mapping per QB Item API specification
 */
function mapQBItemToBatchly(qbItem: any, organizationId: string): any {
  return {
    organization_id: organizationId,
    qbo_id: qbItem.Id.toString(),

    // Basic Info
    name: qbItem.Name || null,
    sku: qbItem.Sku || null,
    description: qbItem.Description || null,
    item_type: qbItem.Type || null,
    is_active: qbItem.Active !== false,

    // Pricing (CRITICAL: UnitPrice is selling price, not cost)
    unit_price: parseQBAmount(qbItem.UnitPrice),
    purchase_cost: parseQBAmount(qbItem.PurchaseCost),

    // Inventory Tracking
    quantity_on_hand: parseQBAmount(qbItem.QtyOnHand),
    track_qty_on_hand: qbItem.TrackQtyOnHand || false,
    reorder_point: parseQBAmount(qbItem.ReorderPoint),
    inv_start_date: qbItem.InvStartDate || null,

    // Account References (stored as JSONB)
    income_account_ref: qbItem.IncomeAccountRef ? {
      value: qbItem.IncomeAccountRef.value,
      name: qbItem.IncomeAccountRef.name
    } : null,
    expense_account_ref: qbItem.ExpenseAccountRef ? {
      value: qbItem.ExpenseAccountRef.value,
      name: qbItem.ExpenseAccountRef.name
    } : null,
    asset_account_ref: qbItem.AssetAccountRef ? {
      value: qbItem.AssetAccountRef.value,
      name: qbItem.AssetAccountRef.name
    } : null,

    // Tax Configuration
    taxable: qbItem.Taxable !== false,
    sales_tax_code_ref: qbItem.SalesTaxCodeRef ? {
      value: qbItem.SalesTaxCodeRef.value,
      name: qbItem.SalesTaxCodeRef.name
    } : null,
    purchase_tax_code_ref: qbItem.PurchaseTaxCodeRef ? {
      value: qbItem.PurchaseTaxCodeRef.value,
      name: qbItem.PurchaseTaxCodeRef.name
    } : null,
    sales_tax_included: qbItem.SalesTaxIncluded || false,

    // Item Hierarchy
    parent_ref: qbItem.ParentRef ? {
      value: qbItem.ParentRef.value,
      name: qbItem.ParentRef.name
    } : null,
    sub_item: qbItem.SubItem || false,
    level: parseQBInt(qbItem.Level) || 0,
    fully_qualified_name: qbItem.FullyQualifiedName || qbItem.Name || null,

    // Vendor and Purchasing
    pref_vendor_ref: qbItem.PrefVendorRef ? {
      value: qbItem.PrefVendorRef.value,
      name: qbItem.PrefVendorRef.name
    } : null,
    purchase_desc: qbItem.PurchaseDesc || null,
    man_part_num: qbItem.ManPartNum || null,

    // Unit of Measure
    uom_set_ref: qbItem.UOMSetRef ? {
      value: qbItem.UOMSetRef.value,
      name: qbItem.UOMSetRef.name
    } : null,

    // QB Sync Metadata
    qbo_sync_token: parseQBInt(qbItem.SyncToken),
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    qbo_created_at: formatQBTimestamp(qbItem.MetaData?.CreateTime),
    qbo_updated_at: formatQBTimestamp(qbItem.MetaData?.LastUpdatedTime),
  };
}

async function pushItemsToQB(supabase: any, connection: any): Promise<number> {
  console.log("Pushing items to QuickBooks...");

  // Get items that need to be pushed (no qbo_id or sync_status = pending)
  const { data: items, error } = await supabase
    .from("item_record")
    .select("*")
    .eq("organization_id", connection.organization_id)
    .eq("is_active", true)
    .or("qbo_id.is.null,sync_status.eq.pending")
    .limit(100); // Process in batches

  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }

  console.log(`Found ${items.length} items to push to QuickBooks`);

  let syncedCount = 0;
  const baseUrl = getQBApiBaseUrl(connection.environment);
  const rateLimiter = new QBRateLimiter();

  for (const item of items) {
    try {
      await rateLimiter.waitIfNeeded();

      // Map Batchly item to QB Item format
      const qbItemData: any = {
        Name: item.name,
        Type: item.item_type || "NonInventory", // Default to NonInventory if not specified
        Active: item.is_active,
      };

      // Optional fields
      if (item.sku) qbItemData.Sku = item.sku;
      if (item.description) qbItemData.Description = item.description;
      if (item.unit_price !== null) qbItemData.UnitPrice = item.unit_price;
      if (item.purchase_cost !== null) qbItemData.PurchaseCost = item.purchase_cost;
      if (item.track_qty_on_hand) qbItemData.TrackQtyOnHand = item.track_qty_on_hand;
      if (item.quantity_on_hand !== null) qbItemData.QtyOnHand = item.quantity_on_hand;
      if (item.reorder_point !== null) qbItemData.ReorderPoint = item.reorder_point;
      if (item.taxable !== null) qbItemData.Taxable = item.taxable;

      // Reference fields (if they exist in Batchly)
      if (item.income_account_ref) qbItemData.IncomeAccountRef = item.income_account_ref;
      if (item.expense_account_ref) qbItemData.ExpenseAccountRef = item.expense_account_ref;
      if (item.asset_account_ref) qbItemData.AssetAccountRef = item.asset_account_ref;
      if (item.sales_tax_code_ref) qbItemData.SalesTaxCodeRef = item.sales_tax_code_ref;

      const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/item`;

      // If item has qbo_id, update instead of create
      if (item.qbo_id && item.qbo_sync_token) {
        qbItemData.Id = item.qbo_id;
        qbItemData.SyncToken = item.qbo_sync_token;
        qbItemData.sparse = true;
      }

      const response = await retryableQBApiCall(async () => {
        return fetch(qbApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${connection.qbo_access_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(qbItemData),
        });
      });

      if (!response.ok) {
        const error = await parseQBError(response);
        console.error(`Failed to push item ${item.id}:`, error);
        continue;
      }

      const responseData = await response.json();
      const qbItem = responseData.Item;

      if (qbItem) {
        // Update item with QB data
        await supabase
          .from("item_record")
          .update({
            qbo_id: qbItem.Id.toString(),
            qbo_sync_token: parseQBInt(qbItem.SyncToken),
            sync_status: 'synced',
            last_sync_at: new Date().toISOString(),
            qbo_created_at: formatQBTimestamp(qbItem.MetaData?.CreateTime),
            qbo_updated_at: formatQBTimestamp(qbItem.MetaData?.LastUpdatedTime),
          })
          .eq("id", item.id);

        syncedCount++;
        console.log(`✓ Pushed item ${item.name}`);
      }
    } catch (error: any) {
      console.error(`Failed to push item ${item.id}:`, error.message);
    }
  }

  console.log(`Successfully pushed ${syncedCount} items to QuickBooks`);
  return syncedCount;
}

serve(handler);