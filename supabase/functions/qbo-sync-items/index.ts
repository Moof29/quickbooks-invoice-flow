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

async function pullItemsFromQB(supabase: any, connection: any): Promise<number> {
  console.log("Pulling items from QuickBooks...");
  console.log("Connection details:", {
    environment: connection.environment,
    realm_id: connection.qbo_realm_id,
    has_token: !!connection.qbo_access_token,
    token_preview: connection.qbo_access_token?.substring(0, 10) + "..."
  });
  
  // Use sandbox URL for testing, production for live
  const baseUrl = connection.environment === 'sandbox' 
    ? 'https://sandbox-quickbooks.api.intuit.com' 
    : 'https://quickbooks-api.intuit.com';
  const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/query`;
  const query = "SELECT * FROM Item MAXRESULTS 1000";

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
    console.log("QuickBooks API full response:", JSON.stringify(data, null, 2));
    
    // Check if QueryResponse exists
    if (!data.QueryResponse) {
      console.log("No QueryResponse in API response");
      return 0;
    }
    
    const items = data.QueryResponse?.Item || [];
    
    console.log(`Found ${items.length} items in QuickBooks`);
    
    // If no items, let's also check what's in the QueryResponse
    if (items.length === 0) {
      console.log("QueryResponse content:", JSON.stringify(data.QueryResponse, null, 2));
    }

    // Save items to database
    let savedCount = 0;
    for (const qbItem of items) {
      try {
        // Map QB item to our database structure - FIXED PRICING BUG
        const itemData = {
          organization_id: connection.organization_id,
          qbo_id: qbItem.Id.toString(),
          name: qbItem.Name,
          sku: qbItem.Sku || null,
          description: qbItem.Description || null,
          item_type: qbItem.Type || null,
          is_active: qbItem.Active !== false,
          // CRITICAL FIX: UnitPrice is selling price, not cost price
          unit_price: qbItem.UnitPrice ? parseFloat(qbItem.UnitPrice.toString()) : null,
          purchase_cost: qbItem.PurchaseCost ? parseFloat(qbItem.PurchaseCost.toString()) : null,
          // Inventory tracking
          quantity_on_hand: qbItem.QtyOnHand ? parseFloat(qbItem.QtyOnHand.toString()) : null,
          track_qty_on_hand: qbItem.TrackQtyOnHand || false,
          // Tax configuration
          taxable: qbItem.Taxable !== false,
          sales_tax_code_ref: qbItem.SalesTaxCodeRef ? qbItem.SalesTaxCodeRef : null,
          // Account references (stored as JSONB)
          income_account_ref: qbItem.IncomeAccountRef ? qbItem.IncomeAccountRef : null,
          expense_account_ref: qbItem.ExpenseAccountRef ? qbItem.ExpenseAccountRef : null,
          asset_account_ref: qbItem.AssetAccountRef ? qbItem.AssetAccountRef : null,
          // Sync metadata
          qbo_sync_token: qbItem.SyncToken ? parseInt(qbItem.SyncToken) : null,
          qbo_created_at: qbItem.MetaData?.CreateTime || null,
          qbo_updated_at: qbItem.MetaData?.LastUpdatedTime || null,
          sync_status: 'synced',
          last_sync_at: new Date().toISOString(),
        };

        // Insert or update item - try insert first, then update if exists
        const { error } = await supabase
          .from('item_record')
          .upsert(itemData, {
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Failed to save item ${qbItem.Name}:`, error);
        } else {
          savedCount++;
        }
      } catch (itemError: any) {
        console.error(`Error processing item ${qbItem.Name}:`, itemError);
      }
    }

    console.log(`Successfully saved ${savedCount} items to database`);
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

async function pushItemsToQB(supabase: any, connection: any): Promise<number> {
  console.log("Pushing items to QuickBooks...");

  // Use sandbox URL for testing, production for live
  const baseUrl = connection.environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks-api.intuit.com';

  // Find items that need to be pushed (new items without qbo_id or updated items)
  const { data: itemsToPush, error: fetchError } = await supabase
    .from('item_record')
    .select('*')
    .eq('organization_id', connection.organization_id)
    .eq('is_active', true)
    .or('qbo_id.is.null,last_sync_at.is.null,updated_at.gt.last_sync_at');

  if (fetchError) {
    console.error("Error fetching items to push:", fetchError);
    throw new Error(`Failed to fetch items to push: ${fetchError.message}`);
  }

  if (!itemsToPush || itemsToPush.length === 0) {
    console.log("No items need to be pushed to QuickBooks");
    return 0;
  }

  console.log(`Found ${itemsToPush.length} items to push to QuickBooks`);

  let pushedCount = 0;

  for (const item of itemsToPush) {
    try {
      // Validate required fields
      if (!item.name) {
        console.warn(`Item ${item.id} has no name, skipping`);
        continue;
      }

      // Build QuickBooks Item object
      const qbItemPayload: any = {
        Name: item.name,
        Type: item.item_type || 'NonInventory', // Default to NonInventory if not specified
        Active: item.is_active !== false,
      };

      // Add optional fields
      if (item.sku) qbItemPayload.Sku = item.sku;
      if (item.description) qbItemPayload.Description = item.description;

      // Add pricing - CRITICAL: UnitPrice is selling price
      if (item.unit_price !== null && item.unit_price !== undefined) {
        qbItemPayload.UnitPrice = item.unit_price;
      }

      // Add purchase cost
      if (item.purchase_cost !== null && item.purchase_cost !== undefined) {
        qbItemPayload.PurchaseCost = item.purchase_cost;
      }

      // Add tax information
      if (item.taxable !== null) {
        qbItemPayload.Taxable = item.taxable;
      }

      // Add tax code reference
      if (item.sales_tax_code_ref) {
        qbItemPayload.SalesTaxCodeRef = item.sales_tax_code_ref;
      }

      // Add account references
      if (item.income_account_ref) {
        qbItemPayload.IncomeAccountRef = item.income_account_ref;
      }
      if (item.expense_account_ref) {
        qbItemPayload.ExpenseAccountRef = item.expense_account_ref;
      }
      if (item.asset_account_ref) {
        qbItemPayload.AssetAccountRef = item.asset_account_ref;
      }

      // Add inventory tracking
      if (item.track_qty_on_hand) {
        qbItemPayload.TrackQtyOnHand = true;
        if (item.quantity_on_hand !== null) {
          qbItemPayload.QtyOnHand = item.quantity_on_hand;
        }
      }

      // For updates: Include Id and SyncToken
      if (item.qbo_id && item.qbo_sync_token) {
        qbItemPayload.Id = item.qbo_id;
        qbItemPayload.SyncToken = item.qbo_sync_token.toString();
        qbItemPayload.sparse = true; // Sparse update - only update provided fields
      }

      // Determine if this is a create or update
      const isUpdate = !!item.qbo_id;
      const qbApiUrl = `${baseUrl}/v3/company/${connection.qbo_realm_id}/item`;

      console.log(`${isUpdate ? 'Updating' : 'Creating'} item "${item.name}" in QuickBooks...`);
      console.log('Payload:', JSON.stringify(qbItemPayload, null, 2));

      const response = await fetch(qbApiUrl, {
        method: 'POST', // Both create and update use POST in QBO API
        headers: {
          'Authorization': `Bearer ${connection.qbo_access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Batchly-Sync/1.0',
        },
        body: JSON.stringify(qbItemPayload),
      });

      console.log(`QuickBooks API response status for ${item.name}:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`QuickBooks API error for item ${item.name}:`, response.status, errorText);

        // Check for common errors
        if (errorText.includes('Duplicate Name Exists Error')) {
          console.warn(`Item ${item.name} already exists in QuickBooks with a different ID. Consider manual reconciliation.`);
        } else if (errorText.includes('Stale Object Error')) {
          console.warn(`Item ${item.name} has been modified in QuickBooks. Pull latest version and retry.`);
        }

        continue; // Skip this item and continue with others
      }

      const qbResult = await response.json();
      const qbItem = qbResult.Item;

      console.log(`Successfully ${isUpdate ? 'updated' : 'created'} item ${item.name} in QuickBooks`);

      // Update local item with QBO ID and sync metadata
      const updateData = {
        qbo_id: qbItem.Id.toString(),
        qbo_sync_token: qbItem.SyncToken ? parseInt(qbItem.SyncToken) : null,
        qbo_created_at: qbItem.MetaData?.CreateTime || null,
        qbo_updated_at: qbItem.MetaData?.LastUpdatedTime || null,
        sync_status: 'synced',
        last_sync_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('item_record')
        .update(updateData)
        .eq('id', item.id);

      if (updateError) {
        console.error(`Error updating item ${item.name} after push:`, updateError);
      } else {
        pushedCount++;
      }

    } catch (itemError: any) {
      console.error(`Error pushing item ${item.name}:`, itemError);
    }
  }

  console.log(`Successfully pushed ${pushedCount} items to QuickBooks`);
  return pushedCount;
}

serve(handler);