import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaveSecretRequest {
  name: string;
  value: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const { name, value }: SaveSecretRequest = await req.json();

    if (!name || !value) {
      throw new Error("Secret name and value are required");
    }

    // Store as environment variable for this project
    // In production, this would use Supabase's vault or secrets management
    console.log(`Saving secret: ${name}`);
    
    // For now, we'll use Deno.env to set it for the current process
    Deno.env.set(name, value);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Secret ${name} saved successfully`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in save-secret:", error);
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
