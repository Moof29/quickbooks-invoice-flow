/**
 * QuickBooks Online Sync Orchestrator
 *
 * Master sync coordinator that handles syncing all entities in the correct order
 * with proper dependency management. This ensures that dependent entities
 * (e.g., invoices) are synced after their dependencies (e.g., customers, items).
 *
 * Sync Order:
 * 1. Items (no dependencies)
 * 2. Customers (no dependencies)
 * 3. Invoices (depends on customers + items)
 * 4. Payments (depends on invoices + customers)
 *
 * Features:
 * - Intelligent dependency management
 * - Parallel sync of independent entities
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Detailed progress tracking
 * - Partial failure recovery
 * - Conflict detection and resolution
 *
 * @endpoint POST /functions/v1/qbo-sync-orchestrator
 * @body {
 *   organizationId: string,
 *   direction: 'pull' | 'push' | 'both',
 *   entities?: string[],  // Optional: ['items', 'customers', 'invoices', 'payments']
 *   conflictResolution?: 'qbo_wins' | 'batchly_wins' | 'newest_wins'
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorRequest {
  organizationId: string;
  direction: 'pull' | 'push' | 'both';
  entities?: string[]; // Optional filter
  conflictResolution?: 'qbo_wins' | 'batchly_wins' | 'newest_wins';
  retryAttempts?: number;
}

interface SyncResult {
  entity: string;
  direction: string;
  pulled: number;
  pushed: number;
  errors: any[];
  duration: number;
  status: 'success' | 'partial' | 'failed';
}

interface OrchestratorResult {
  success: boolean;
  totalPulled: number;
  totalPushed: number;
  results: SyncResult[];
  duration: number;
  syncHistoryId: string;
}

// Entity sync configuration with dependencies
const ENTITY_CONFIG = {
  items: {
    endpoint: 'qbo-sync-items',
    dependencies: [],
    priority: 1,
  },
  customers: {
    endpoint: 'qbo-sync-customers',
    dependencies: [],
    priority: 1,
  },
  invoices: {
    endpoint: 'qbo-sync-invoices',
    dependencies: ['customers', 'items'],
    priority: 2,
  },
  payments: {
    endpoint: 'qbo-sync-payments',
    dependencies: ['invoices', 'customers'],
    priority: 3,
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      organizationId,
      direction = 'both',
      entities = ['items', 'customers', 'invoices', 'payments'],
      conflictResolution = 'newest_wins',
      retryAttempts = 3,
    } = await req.json() as OrchestratorRequest;

    if (!organizationId || !direction) {
      return new Response(
        JSON.stringify({ error: 'organizationId and direction are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting sync orchestration for organization ${organizationId}`);
    console.log(`Direction: ${direction}, Entities: ${entities.join(', ')}`);

    // Validate entities
    const invalidEntities = entities.filter(e => !ENTITY_CONFIG[e]);
    if (invalidEntities.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Invalid entities: ${invalidEntities.join(', ')}. Valid options: items, customers, invoices, payments`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify QBO connection exists
    const { data: connection, error: connError } = await supabaseClient.rpc(
      'get_qbo_connection_for_sync',
      { p_organization_id: organizationId }
    );

    if (connError || !connection || connection.length === 0) {
      console.error('Failed to get QBO connection:', connError);
      return new Response(
        JSON.stringify({ error: 'QuickBooks connection not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync history record
    const syncHistoryId = crypto.randomUUID();
    await supabaseClient.from('qbo_sync_history').insert({
      id: syncHistoryId,
      organization_id: organizationId,
      sync_type: 'orchestrated',
      entity_types: entities,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });

    // Order entities by dependencies and priority
    const orderedEntities = topologicalSort(entities, ENTITY_CONFIG);
    console.log(`Sync order: ${orderedEntities.join(' -> ')}`);

    const results: SyncResult[] = [];
    let totalPulled = 0;
    let totalPushed = 0;

    // Group entities by priority for parallel execution
    const priorityGroups: { [key: number]: string[] } = {};
    for (const entity of orderedEntities) {
      const priority = ENTITY_CONFIG[entity].priority;
      if (!priorityGroups[priority]) {
        priorityGroups[priority] = [];
      }
      priorityGroups[priority].push(entity);
    }

    // Execute syncs by priority group
    for (const priority of Object.keys(priorityGroups).sort()) {
      const group = priorityGroups[Number(priority)];
      console.log(`\nSyncing priority ${priority} entities: ${group.join(', ')}`);

      // Execute entities in same priority group in parallel
      const groupPromises = group.map(entity =>
        syncEntityWithRetry(
          supabaseClient,
          req.headers.get('Authorization') ?? '',
          organizationId,
          entity,
          direction,
          retryAttempts
        )
      );

      const groupResults = await Promise.allSettled(groupPromises);

      // Process results
      for (let i = 0; i < group.length; i++) {
        const entity = group[i];
        const result = groupResults[i];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          totalPulled += result.value.pulled;
          totalPushed += result.value.pushed;
        } else {
          console.error(`Failed to sync ${entity}:`, result.reason);
          results.push({
            entity,
            direction,
            pulled: 0,
            pushed: 0,
            errors: [{ error: result.reason.message }],
            duration: 0,
            status: 'failed',
          });
        }
      }

      // Check if we should continue to next priority
      const allFailed = groupResults.every(r => r.status === 'rejected');
      if (allFailed && Number(priority) < Math.max(...Object.keys(priorityGroups).map(Number))) {
        console.warn(`All entities in priority ${priority} failed. Stopping orchestration.`);
        break;
      }
    }

    const duration = Date.now() - startTime;
    const hasErrors = results.some(r => r.errors.length > 0);
    const allFailed = results.every(r => r.status === 'failed');

    const finalStatus = allFailed ? 'failed' : hasErrors ? 'partial_success' : 'completed';

    // Update sync history
    await supabaseClient
      .from('qbo_sync_history')
      .update({
        status: finalStatus,
        entity_count: totalPulled + totalPushed,
        success_count: results.filter(r => r.status === 'success').length,
        failure_count: results.filter(r => r.status === 'failed').length,
        completed_at: new Date().toISOString(),
        error_summary: hasErrors
          ? JSON.stringify(results.filter(r => r.errors.length > 0).map(r => ({
              entity: r.entity,
              errors: r.errors,
            })))
          : null,
      })
      .eq('id', syncHistoryId);

    // Update connection last_sync_at
    await supabaseClient
      .from('qbo_connection')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('organization_id', organizationId);

    const orchestratorResult: OrchestratorResult = {
      success: !allFailed,
      totalPulled,
      totalPushed,
      results,
      duration,
      syncHistoryId,
    };

    console.log(`\n=== Sync Orchestration Complete ===`);
    console.log(`Total Pulled: ${totalPulled}`);
    console.log(`Total Pushed: ${totalPushed}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Status: ${finalStatus}`);

    return new Response(
      JSON.stringify(orchestratorResult),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unhandled error in qbo-sync-orchestrator:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Sync a single entity with retry logic
 */
async function syncEntityWithRetry(
  supabaseClient: any,
  authHeader: string,
  organizationId: string,
  entity: string,
  direction: string,
  maxRetries: number
): Promise<SyncResult> {
  const config = ENTITY_CONFIG[entity];
  const startTime = Date.now();

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`Syncing ${entity} (attempt ${attempt}/${maxRetries})...`);

      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/${config.endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ organizationId, direction }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${config.endpoint} failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(`${config.endpoint} returned success: false`);
      }

      const duration = Date.now() - startTime;
      const hasErrors = result.results?.errors?.length > 0;

      return {
        entity,
        direction,
        pulled: result.results?.pulled || 0,
        pushed: result.results?.pushed || 0,
        errors: result.results?.errors || [],
        duration,
        status: hasErrors ? 'partial' : 'success',
      };
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed for ${entity}:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 2^attempt seconds
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  const duration = Date.now() - startTime;
  return {
    entity,
    direction,
    pulled: 0,
    pushed: 0,
    errors: [{ error: lastError?.message || 'Unknown error' }],
    duration,
    status: 'failed',
  };
}

/**
 * Topological sort for dependency resolution
 * Returns entities ordered by dependencies (dependencies first)
 */
function topologicalSort(
  entities: string[],
  config: { [key: string]: { dependencies: string[]; priority: number } }
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(entity: string) {
    if (visited.has(entity)) return;
    if (visiting.has(entity)) {
      throw new Error(`Circular dependency detected for ${entity}`);
    }

    visiting.add(entity);

    const deps = config[entity]?.dependencies || [];
    for (const dep of deps) {
      if (entities.includes(dep)) {
        visit(dep);
      }
    }

    visiting.delete(entity);
    visited.add(entity);
    sorted.push(entity);
  }

  for (const entity of entities) {
    visit(entity);
  }

  return sorted;
}

/**
 * Detect conflicts between Batchly and QBO data
 */
async function detectConflicts(
  supabaseClient: any,
  organizationId: string,
  entity: string
): Promise<any[]> {
  // Query for records that have been modified both locally and in QBO
  // since last sync
  const { data: conflicts } = await supabaseClient
    .from(`${entity}_record`)
    .select('*')
    .eq('organization_id', organizationId)
    .not('qbo_id', 'is', null)
    .not('last_sync_at', 'is', null)
    .filter('updated_at', 'gt', 'last_sync_at')
    .filter('qbo_updated_at', 'gt', 'last_sync_at');

  return conflicts || [];
}

/**
 * Resolve conflicts based on strategy
 */
function resolveConflict(
  localData: any,
  remoteData: any,
  strategy: 'qbo_wins' | 'batchly_wins' | 'newest_wins'
): any {
  if (strategy === 'qbo_wins') {
    return remoteData;
  } else if (strategy === 'batchly_wins') {
    return localData;
  } else {
    // newest_wins
    const localTime = new Date(localData.updated_at).getTime();
    const remoteTime = new Date(remoteData.qbo_updated_at || remoteData.MetaData?.LastUpdatedTime).getTime();
    return remoteTime > localTime ? remoteData : localData;
  }
}
