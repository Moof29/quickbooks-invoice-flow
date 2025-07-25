import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthInitiateRequest {
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

    const { organizationId }: OAuthInitiateRequest = await req.json();

    const clientId = Deno.env.get("QB_CLIENT_ID");
    const redirectUri = `${supabaseUrl}/functions/v1/qbo-oauth-callback`;
    
    if (!clientId) {
      throw new Error("QuickBooks Client ID not configured");
    }

    // Generate a random state parameter for security
    const state = crypto.randomUUID();

    // Store the state and organization ID in the database temporarily
    await supabase.from("qbo_connection").upsert({
      organization_id: organizationId,
      qbo_access_token: null, // Clear any existing token
      qbo_refresh_token: null,
      is_active: false,
      last_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      qbo_realm_id: state, // Temporarily store state here
      qbo_company_id: "pending", // Will be updated after callback
    });

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