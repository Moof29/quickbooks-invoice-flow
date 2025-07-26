import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const realmId = url.searchParams.get("realmId");
    const error = url.searchParams.get("error");

    console.log("OAuth callback received:", { code, state, realmId, error });

    if (error) {
      console.error("OAuth error:", error);
      return new Response("OAuth authorization failed", { status: 400 });
    }

    if (!code || !state || !realmId) {
      console.error("Missing required parameters:", { code, state, realmId });
      return new Response("Missing required parameters", { status: 400 });
    }

    // Extract organization ID from state
    const [stateToken, organizationId] = state.split("|");
    
    if (!organizationId) {
      console.error("Invalid state parameter:", state);
      return new Response("Invalid state parameter", { status: 400 });
    }

    // Exchange authorization code for access token
    const clientId = Deno.env.get("QB_CLIENT_ID");
    const clientSecret = Deno.env.get("QB_CLIENT_SECRET");
    const redirectUri = `${supabaseUrl}/functions/v1/qbo-oauth-callback`;

    if (!clientId || !clientSecret) {
      throw new Error("QuickBooks credentials not configured");
    }

    const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Token exchange successful:", { 
      access_token: tokenData.access_token ? "present" : "missing",
      refresh_token: tokenData.refresh_token ? "present" : "missing",
      expires_in: tokenData.expires_in 
    });

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Update the qbo_connection record
    const { error: updateError } = await supabase
      .from("qbo_connection")
      .upsert({
        organization_id: organizationId,
        qbo_access_token: tokenData.access_token,
        qbo_refresh_token: tokenData.refresh_token,
        qbo_token_expires_at: expiresAt.toISOString(),
        qbo_realm_id: realmId,
        qbo_company_id: realmId, // QuickBooks uses realmId as company identifier
        is_active: true,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        environment: "production",
      }, {
        onConflict: 'organization_id'
      });

    if (updateError) {
      console.error("Failed to update connection:", updateError);
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    console.log("QuickBooks connection updated successfully");

    // Redirect to the frontend with success
    const frontendUrl = supabaseUrl.replace('.supabase.co', '.lovableproject.com');
    const redirectUrl = `${frontendUrl}/quickbooks-integration?success=true`;
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in qbo-oauth-callback:", error);
    
    // Redirect to frontend with error
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const frontendUrl = supabaseUrl.replace('.supabase.co', '.lovableproject.com');
    const redirectUrl = `${frontendUrl}/quickbooks-integration?error=${encodeURIComponent(error.message)}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
        ...corsHeaders,
      },
    });
  }
};

serve(handler);