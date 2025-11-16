import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Note: Resend integration temporarily disabled due to build issues
// To enable email sending, configure RESEND_API_KEY and uncomment:
// import { Resend } from "npm:resend@2.0.0";
// const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PortalInvitationRequest {
  email: string;
  customerName: string;
  temporaryPassword: string;
  portalUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, customerName, temporaryPassword, portalUrl }: PortalInvitationRequest = await req.json();

    // TODO: Enable actual email sending once Resend is configured
    // For now, log the invitation details
    console.log("Portal invitation requested:", {
      email,
      customerName,
      temporaryPassword: "***",
      portalUrl
    });

    // Return success with invitation details
    const response = {
      success: true,
      message: "Portal invitation created (email sending disabled)",
      details: {
        email,
        portalUrl,
        note: "Configure RESEND_API_KEY to enable email delivery"
      }
    };

    console.log("Portal invitation prepared:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending portal invitation:", error);
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
