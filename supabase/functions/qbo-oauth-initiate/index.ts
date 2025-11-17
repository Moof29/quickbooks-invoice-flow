import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthInitiateRequest {
  organizationId?: string;
  userId?: string;
  checkOnly?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, userId, checkOnly }: OAuthInitiateRequest = await req.json();

    const clientId = Deno.env.get("QB_CLIENT_ID");
    const clientSecret = Deno.env.get("QB_CLIENT_SECRET");
    const redirectUri = `${supabaseUrl}/functions/v1/qbo-oauth-callback`;
    
    if (checkOnly) {
      return new Response(
        JSON.stringify({
          configured: Boolean(clientId && Deno.env.get("QB_CLIENT_SECRET")),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!organizationId || organizationId.length !== 36) {
      throw new Error("Invalid organizationId provided");
    }

    if (!clientId || !clientSecret) {
      throw new Error("QuickBooks credentials not configured");
    }

    // Generate a random state parameter for security and persist it for validation
    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Clean up expired states for this organization to avoid clutter
    await supabase
      .from("qbo_oauth_state")
      .delete()
      .eq("organization_id", organizationId)
      .lt("expires_at", new Date().toISOString());

    const { error: stateError } = await supabase.from("qbo_oauth_state").insert({
      organization_id: organizationId,
      state_token: state,
      expires_at: expiresAt,
      created_by: userId || null,
      ip_address:
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for") ||
        undefined,
    });

    if (stateError) {
      console.error("Failed to persist OAuth state:", stateError);
      throw new Error("Unable to start QuickBooks authorization");
    }

    // Don't modify existing connection during initiate - just generate the auth URL
    // The callback will handle storing/updating the connection
    console.log("Initiating OAuth for organization:", organizationId);

    // QuickBooks OAuth URL
    const scope = "com.intuit.quickbooks.accounting";
    const baseUrl = "https://appcenter.intuit.com/connect/oauth2";
    
    const authUrl = new URL(baseUrl);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("state", `${state}|${organizationId}`);

    console.log("Generated OAuth URL:", authUrl.toString());

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        state: state
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in qbo-oauth-initiate:", error);
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
