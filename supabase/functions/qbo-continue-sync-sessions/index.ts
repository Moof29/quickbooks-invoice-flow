import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader?.includes(serviceRoleKey!)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: incompleteSessions, error: fetchError } = await supabase
    .from("qbo_sync_sessions")
    .select("*")
    .eq("status", "in_progress")
    .lt("last_chunk_at", twoMinutesAgo)
    .limit(10);

  if (fetchError) {
    console.error("Error fetching incomplete sessions:", fetchError);
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!incompleteSessions || incompleteSessions.length === 0) {
    return new Response(
      JSON.stringify({ message: "No incomplete sessions to resume" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`Found ${incompleteSessions.length} incomplete sync sessions`);

  const results = [];

  for (const session of incompleteSessions) {
    try {
      const functionName = `qbo-sync-${session.entity_type}s`;

      console.log(
        `Resuming session ${session.id} for ${session.entity_type} at offset ${session.current_offset}`
      );

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          organizationId: session.organization_id,
          sessionId: session.id,
          offset: session.current_offset,
          direction: session.sync_type,
        },
      });

      if (error) {
        console.error(`Failed to continue session ${session.id}:`, error);
        results.push({
          sessionId: session.id,
          success: false,
          error: error.message,
        });
      } else {
        results.push({
          sessionId: session.id,
          success: true,
          ...data,
        });
      }
    } catch (error: any) {
      console.error(`Error processing session ${session.id}:`, error);
      results.push({
        sessionId: session.id,
        success: false,
        error: error.message,
      });
    }
  }

  return new Response(
    JSON.stringify({
      processed: incompleteSessions.length,
      results,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
};

serve(handler);
