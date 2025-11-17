import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenRefreshRequest {
  organizationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId }: TokenRefreshRequest = await req.json();

    // Get current connection using secure function
    const { data: connections, error: fetchError } = await supabase
      .rpc("get_qbo_connection_for_sync", { p_organization_id: organizationId });

    if (fetchError || !connections || connections.length === 0) {
      console.error("Connection fetch error:", fetchError);
      throw new Error("QuickBooks connection not found");
    }

    const connection = connections[0];

    if (!connection.qbo_refresh_token) {
      throw new Error("No refresh token available");
    }

    // Check if token needs refresh (refresh if expires within 10 minutes)
    // ✅ FIX: Check for null/undefined token expiration
    if (!connection.qbo_token_expires_at) {
      console.log("No token expiration date found, forcing refresh");
      // Continue to refresh instead of throwing error
    } else {
      const expiresAt = new Date(connection.qbo_token_expires_at);

      // ✅ FIX: Validate the date is valid
      if (!isNaN(expiresAt.getTime())) {
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        if (expiresAt > tenMinutesFromNow) {
          console.log("Token is still valid, no refresh needed");
          return new Response(
            JSON.stringify({
              success: true,
              message: "Token is still valid",
              expiresAt: expiresAt.toISOString()
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
      }
    }

    console.log("Refreshing QuickBooks token for organization:", organizationId);

    const clientId = Deno.env.get("QB_CLIENT_ID");
    const clientSecret = Deno.env.get("QB_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("QuickBooks credentials not configured");
    }

    // Refresh the token
    const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.qbo_refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);
      
      // If refresh fails, mark connection as inactive
      // Note: This requires direct access with service_role which we still have
      try {
        await supabase
          .from("qbo_connection")
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq("organization_id", organizationId);
      } catch (inactiveError) {
        console.error("Failed to mark connection as inactive:", inactiveError);
      }
      
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Token refresh successful");

    // Calculate new expiration
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

    // Update the connection with new tokens using secure function
    const { error: updateError } = await supabase
      .rpc("update_qbo_connection_tokens", {
        p_organization_id: organizationId,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token || connection.qbo_refresh_token,
        p_token_expires_at: newExpiresAt.toISOString()
      });

    if (updateError) {
      console.error("Failed to update connection:", updateError);
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Token refreshed successfully",
        expiresAt: newExpiresAt.toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in qbo-token-refresh:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);