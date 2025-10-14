import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    const emailResponse = await resend.emails.send({
      from: "Customer Portal <onboarding@resend.dev>",
      to: [email],
      subject: "Your Customer Portal Access",
      html: `
        <h1>Welcome to the Customer Portal!</h1>
        <p>Hello,</p>
        <p>You have been granted access to the ${customerName} customer portal.</p>
        
        <h2>Login Credentials:</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        
        <p><strong>Portal URL:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
        
        <p><em>Please change your password after your first login for security.</em></p>
        
        <p>If you have any questions, please contact your account manager.</p>
        
        <p>Best regards,<br>Customer Support Team</p>
      `,
    });

    console.log("Portal invitation sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
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
