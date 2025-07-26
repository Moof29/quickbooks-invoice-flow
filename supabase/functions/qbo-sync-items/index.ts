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
    console.log("QuickBooks API response data:", JSON.stringify(data, null, 2));
    
    const items = data.QueryResponse?.Item || [];
    
    console.log(`Found ${items.length} items in QuickBooks`);

    // Save items to database
    let savedCount = 0;
    for (const qbItem of items) {
      try {
        // Map QB item to our database structure
        const itemData = {
          organization_id: connection.organization_id,
          qbo_id: qbItem.Id.toString(),
          name: qbItem.Name,
          sku: qbItem.Sku || null,
          description: qbItem.Description || null,
          item_type: qbItem.Type || null,
          is_active: qbItem.Active !== false,
          purchase_cost: qbItem.UnitPrice ? parseFloat(qbItem.UnitPrice.toString()) : null,
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
  console.log("Push to QuickBooks not yet implemented for items");
  return 0;
}

serve(handler);