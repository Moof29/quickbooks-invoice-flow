import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("NODE_ENV") === "production" 
    ? "https://id-preview--3274bdad-c9e4-429c-9ae4-5beb2ed291db.lovable.app"
    : "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Rate limiting store (in-memory for this demo)
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(clientIP) || { count: 0, lastReset: now };
  
  // Reset if window has passed
  if (now - current.lastReset > RATE_LIMIT_WINDOW) {
    current.count = 0;
    current.lastReset = now;
  }
  
  current.count++;
  rateLimitStore.set(clientIP, current);
  
  return current.count <= RATE_LIMIT_MAX_REQUESTS;
}

function validateInput(value: string | null, name: string, maxLength: number = 1000): string {
  if (!value) {
    throw new Error(`Missing required parameter: ${name}`);
  }
  if (value.length > maxLength) {
    throw new Error(`Parameter ${name} exceeds maximum length`);
  }
  // Basic sanitization
  const sanitized = value.replace(/[<>'"]/g, '');
  return sanitized;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const clientIP = req.headers.get("cf-connecting-ip") || 
                   req.headers.get("x-forwarded-for") || 
                   "unknown";
  
  if (!checkRateLimit(clientIP)) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const code = validateInput(url.searchParams.get("code"), "code", 2000);
    const state = validateInput(url.searchParams.get("state"), "state", 500);
    const realmId = validateInput(url.searchParams.get("realmId"), "realmId", 100);
    const error = url.searchParams.get("error");

    console.log("OAuth callback received:", { 
      code: code ? "present" : "missing", 
      state: state ? "present" : "missing", 
      realmId: realmId ? "present" : "missing", 
      error,
      clientIP 
    });

    if (error) {
      console.error("OAuth error:", error);
      // Log security event
      await logSecurityEvent(supabase, null, 'oauth_error', error, clientIP);
      return redirectToFrontend(supabaseUrl, `OAuth authorization failed: ${error}`);
    }

    // Extract organization ID from state with validation
    const [stateToken, organizationId] = state.split("|");
    
    if (!organizationId || organizationId.length !== 36) { // UUID length check
      console.error("Invalid state parameter:", state);
      await logSecurityEvent(supabase, null, 'invalid_state', state, clientIP);
      return redirectToFrontend(supabaseUrl, "Invalid state parameter");
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

    // Log successful connection
    await logSecurityEvent(supabase, organizationId, 'qbo_connection_success', 'QuickBooks connected successfully', clientIP);

    // Redirect to the frontend with success
    return redirectToFrontend(supabaseUrl, null, true);

  } catch (error: any) {
    console.error("Error in qbo-oauth-callback:", error);
    
    // Log security event for errors
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    try {
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await logSecurityEvent(supabase, null, 'oauth_callback_error', error.message, clientIP);
    } catch (logError) {
      console.error("Failed to log security event:", logError);
    }
    
    // Redirect to frontend with error
    return redirectToFrontend(supabaseUrl, error.message);
  }
};

async function logSecurityEvent(
  supabase: any, 
  organizationId: string | null, 
  eventType: string, 
  detail: string, 
  clientIP: string
) {
  try {
    await supabase.from('security_audit_log').insert({
      organization_id: organizationId,
      accessed_table: 'qbo_connection',
      access_type: 'OAUTH_CALLBACK',
      ip_address: clientIP,
      user_agent: 'QuickBooks OAuth Callback',
      sensitive_data_accessed: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

function redirectToFrontend(supabaseUrl: string, error?: string | null, success?: boolean) {
  const frontendUrl = supabaseUrl.replace('.supabase.co', '.lovableproject.com');
  let redirectUrl = `${frontendUrl}/quickbooks`;
  
  if (success) {
    redirectUrl += '?success=true';
  } else if (error) {
    redirectUrl += `?error=${encodeURIComponent(error)}`;
  }
  
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