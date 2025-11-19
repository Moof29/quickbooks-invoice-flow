import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createSupabaseClient, getQBApiBaseUrl } from "../_shared/sync-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  organizationId: string;
}

interface ValidationTests {
  token_expired: boolean;
  company_info: boolean;
  customer_query: boolean;
  item_query: boolean;
  invoice_query: boolean;
}

interface ValidationDiagnostics {
  realm_id: string;
  environment: string;
  token_expires_at: string;
  last_connected_at: string;
  company_status: number;
  customer_status: number;
  item_status: number;
  invoice_status: number;
  customer_error: string | null;
  item_error: string | null;
  invoice_error: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient();
    const { organizationId }: ValidationRequest = await req.json();

    console.log("=== QuickBooks Connection Validation ===");
    console.log("Organization ID:", organizationId);

    // Get QuickBooks connection using secure function
    const { data: connections, error: connectionError } = await supabase
      .rpc("get_qbo_connection_for_sync", { p_organization_id: organizationId });

    if (connectionError || !connections || connections.length === 0) {
      console.error("Connection fetch error:", connectionError);
      return new Response(
        JSON.stringify({
          valid: false,
          error: "No active QuickBooks connection found"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const connection = connections[0];
    const baseUrl = getQBApiBaseUrl(connection.environment);

    console.log("Connection found:", {
      realm_id: connection.qbo_realm_id,
      environment: connection.environment,
      token_expires_at: connection.qbo_token_expires_at
    });

    // Initialize test results
    const tests: ValidationTests = {
      token_expired: false,
      company_info: false,
      customer_query: false,
      item_query: false,
      invoice_query: false
    };

    const diagnostics: ValidationDiagnostics = {
      realm_id: connection.qbo_realm_id,
      environment: connection.environment,
      token_expires_at: connection.qbo_token_expires_at,
      last_connected_at: connection.last_connected_at,
      company_status: 0,
      customer_status: 0,
      item_status: 0,
      invoice_status: 0,
      customer_error: null,
      item_error: null,
      invoice_error: null
    };

    // Test 1: Check if token is expired
    const tokenExpiresAt = new Date(connection.qbo_token_expires_at);
    const now = new Date();
    tests.token_expired = tokenExpiresAt < now;

    if (tests.token_expired) {
      console.warn("⚠️ Token is expired!");
      return new Response(
        JSON.stringify({
          valid: false,
          tests,
          diagnostics,
          recommendations: ["Token has expired. Click 'Refresh Token' button to renew."]
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✓ Token is valid (expires at:", tokenExpiresAt.toISOString(), ")");

    // Test 2: Company Info (basic connectivity)
    console.log("Testing Company Info API...");
    try {
      const companyRes = await fetch(
        `${baseUrl}/v3/company/${connection.qbo_realm_id}/companyinfo/${connection.qbo_realm_id}`,
        {
          headers: {
            'Authorization': `Bearer ${connection.qbo_access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      diagnostics.company_status = companyRes.status;
      tests.company_info = companyRes.ok;

      if (companyRes.ok) {
        console.log("✓ Company Info API: SUCCESS");
      } else {
        const errorText = await companyRes.text();
        console.error("✗ Company Info API failed:", companyRes.status, errorText);
      }
    } catch (error: any) {
      console.error("✗ Company Info API error:", error.message);
      diagnostics.company_status = 0;
    }

    // Test 3: Customer query (read permission)
    console.log("Testing Customer Query API...");
    try {
      const custQuery = encodeURIComponent('SELECT * FROM Customer MAXRESULTS 1');
      const custRes = await fetch(
        `${baseUrl}/v3/company/${connection.qbo_realm_id}/query?query=${custQuery}`,
        {
          headers: {
            'Authorization': `Bearer ${connection.qbo_access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      diagnostics.customer_status = custRes.status;
      tests.customer_query = custRes.ok;

      if (custRes.ok) {
        console.log("✓ Customer Query API: SUCCESS");
      } else {
        const errorText = await custRes.text();
        diagnostics.customer_error = errorText;
        console.error("✗ Customer Query API failed:", custRes.status, errorText);
      }
    } catch (error: any) {
      diagnostics.customer_error = error.message;
      console.error("✗ Customer Query API error:", error.message);
    }

    // Test 4: Item query
    console.log("Testing Item Query API...");
    try {
      const itemQuery = encodeURIComponent('SELECT * FROM Item MAXRESULTS 1');
      const itemRes = await fetch(
        `${baseUrl}/v3/company/${connection.qbo_realm_id}/query?query=${itemQuery}`,
        {
          headers: {
            'Authorization': `Bearer ${connection.qbo_access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      diagnostics.item_status = itemRes.status;
      tests.item_query = itemRes.ok;

      if (itemRes.ok) {
        console.log("✓ Item Query API: SUCCESS");
      } else {
        const errorText = await itemRes.text();
        diagnostics.item_error = errorText;
        console.error("✗ Item Query API failed:", itemRes.status, errorText);
      }
    } catch (error: any) {
      diagnostics.item_error = error.message;
      console.error("✗ Item Query API error:", error.message);
    }

    // Test 5: Invoice query
    console.log("Testing Invoice Query API...");
    try {
      const invQuery = encodeURIComponent('SELECT * FROM Invoice MAXRESULTS 1');
      const invRes = await fetch(
        `${baseUrl}/v3/company/${connection.qbo_realm_id}/query?query=${invQuery}`,
        {
          headers: {
            'Authorization': `Bearer ${connection.qbo_access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      diagnostics.invoice_status = invRes.status;
      tests.invoice_query = invRes.ok;

      if (invRes.ok) {
        console.log("✓ Invoice Query API: SUCCESS");
      } else {
        const errorText = await invRes.text();
        diagnostics.invoice_error = errorText;
        console.error("✗ Invoice Query API failed:", invRes.status, errorText);
      }
    } catch (error: any) {
      diagnostics.invoice_error = error.message;
      console.error("✗ Invoice Query API error:", error.message);
    }

    // Determine if all tests passed
    const allPassed = !tests.token_expired &&
                       tests.company_info &&
                       tests.customer_query &&
                       tests.item_query &&
                       tests.invoice_query;

    // Generate recommendations for failed tests
    const recommendations: string[] = [];
    if (!tests.company_info) {
      recommendations.push("Company Info failed - check realm ID and environment setting");
    }
    if (!tests.customer_query) {
      recommendations.push("Customer access denied - verify OAuth scope includes 'com.intuit.quickbooks.accounting'");
    }
    if (!tests.item_query) {
      recommendations.push("Item access denied - verify OAuth scope");
    }
    if (!tests.invoice_query) {
      recommendations.push("Invoice access denied - verify OAuth scope");
    }

    console.log("=== Validation Summary ===");
    console.log("All tests passed:", allPassed);
    console.log("Failed tests:", Object.entries(tests).filter(([key, value]) => !value).map(([key]) => key));
    console.log("========================");

    return new Response(
      JSON.stringify({
        valid: allPassed,
        tests,
        diagnostics,
        recommendations: recommendations.length > 0 ? recommendations : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in qbo-validate-connection:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
