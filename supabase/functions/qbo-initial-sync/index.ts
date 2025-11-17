import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InitialSyncRequest {
  organizationId: string;
  entityTypes: string[]; // ['customer', 'item', 'invoice', 'payment']
  batchSize?: number;
}

interface SyncProgress {
  phase: string;
  entity_type: string;
  total_expected: number;
  total_processed: number;
  status: 'in_progress' | 'completed' | 'failed';
  started_at: string;
  estimated_completion?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { 
      organizationId, 
      entityTypes = ['customer', 'item', 'invoice', 'payment'],
      batchSize = 100 
    }: InitialSyncRequest = await req.json();

    console.log("=== Starting Initial Sync ===");
    console.log("Organization:", organizationId);
    console.log("Entity Types:", entityTypes);
    console.log("Batch Size:", batchSize);

    // Verify user belongs to organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profile?.organization_id !== organizationId) {
      throw new Error("Access denied: Organization mismatch");
    }

    // Get QB connection
    const { data: connections, error: connError } = await supabase
      .rpc("get_qbo_connection_for_sync", { p_organization_id: organizationId });

    if (connError || !connections || connections.length === 0) {
      throw new Error("Active QuickBooks connection not found");
    }

    // Create initial sync tracking record
    const { data: syncTracker, error: trackerError } = await supabase
      .from('qbo_sync_history')
      .insert({
        organization_id: organizationId,
        sync_type: 'initial_sync',
        entity_types: entityTypes,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        metadata: {
          batch_size: batchSize,
          phase: 'initialization'
        }
      })
      .select()
      .single();

    if (trackerError) {
      console.error("Failed to create sync tracker:", trackerError);
      throw trackerError;
    }

    console.log("Created sync tracker:", syncTracker.id);

    // Define sync order (customers and items first, then invoices and payments)
    const syncOrder = [
      { type: 'customer', function: 'qbo-sync-customers', priority: 1 },
      { type: 'item', function: 'qbo-sync-items', priority: 2 },
      { type: 'invoice', function: 'qbo-sync-invoices', priority: 3 }, // To be created
      { type: 'payment', function: 'qbo-sync-payments', priority: 4 }
    ];

    const results: any[] = [];

    // Sync entities in order
    for (const sync of syncOrder) {
      if (!entityTypes.includes(sync.type)) {
        console.log(`Skipping ${sync.type} - not requested`);
        continue;
      }

      try {
        console.log(`\n=== Syncing ${sync.type}s ===`);
        
        // Create sync session for this entity
        const { data: session, error: sessionError } = await supabase
          .from('qbo_sync_sessions')
          .insert({
            organization_id: organizationId,
            entity_type: sync.type,
            sync_type: 'pull',
            sync_mode: 'full',
            batch_size: batchSize,
            status: 'in_progress',
            started_at: new Date().toISOString(),
            last_chunk_at: new Date().toISOString()
          })
          .select()
          .single();

        if (sessionError) {
          console.error(`Failed to create session for ${sync.type}:`, sessionError);
          results.push({
            entity_type: sync.type,
            status: 'failed',
            error: sessionError.message
          });
          continue;
        }

        // Call the appropriate sync function
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          sync.function,
          {
            body: {
              organizationId,
              sessionId: session.id,
              direction: 'pull',
              batchSize
            }
          }
        );

        if (syncError) {
          console.error(`Sync failed for ${sync.type}:`, syncError);
          
          // Update session as failed
          await supabase
            .from('qbo_sync_sessions')
            .update({
              status: 'failed',
              error_message: syncError.message,
              completed_at: new Date().toISOString()
            })
            .eq('id', session.id);

          results.push({
            entity_type: sync.type,
            status: 'failed',
            error: syncError.message,
            session_id: session.id
          });
        } else {
          console.log(`✓ ${sync.type} sync completed:`, syncResult);
          
          // Update session as completed
          await supabase
            .from('qbo_sync_sessions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', session.id);

          results.push({
            entity_type: sync.type,
            status: 'completed',
            ...syncResult,
            session_id: session.id
          });
        }

        // Brief pause between entity types to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`Error syncing ${sync.type}:`, error);
        results.push({
          entity_type: sync.type,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update overall sync tracker
    const hasErrors = results.some(r => r.status === 'failed');
    await supabase
      .from('qbo_sync_history')
      .update({
        status: hasErrors ? 'partial_success' : 'completed',
        completed_at: new Date().toISOString(),
        entity_count: results.reduce((sum, r) => sum + (r.pulled || 0), 0),
        success_count: results.filter(r => r.status === 'completed').length,
        failure_count: results.filter(r => r.status === 'failed').length,
        error_summary: hasErrors 
          ? results.filter(r => r.error).map(r => `${r.entity_type}: ${r.error}`).join('; ')
          : null,
        metadata: {
          batch_size: batchSize,
          phase: 'completed',
          results
        }
      })
      .eq('id', syncTracker.id);

    console.log("\n=== Initial Sync Complete ===");
    console.log("Results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        sync_id: syncTracker.id,
        results,
        summary: {
          total_entities: results.length,
          completed: results.filter(r => r.status === 'completed').length,
          failed: results.filter(r => r.status === 'failed').length,
          total_records: results.reduce((sum, r) => sum + (r.pulled || 0), 0)
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Initial sync error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
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
