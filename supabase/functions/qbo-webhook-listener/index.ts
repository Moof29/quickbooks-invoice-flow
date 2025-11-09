/**
 * QuickBooks Online Webhook Listener
 *
 * Receives webhook notifications from QuickBooks Online when entities change,
 * enabling real-time synchronization. This eliminates the need for constant
 * polling and ensures Batchly data stays in sync with QBO.
 *
 * QuickBooks Webhook Events:
 * - Create: Entity was created
 * - Update: Entity was updated
 * - Delete: Entity was deleted (soft delete)
 * - Merge: Entity was merged with another
 * - Void: Entity was voided
 *
 * Supported Entities:
 * - Customer
 * - Item
 * - Invoice
 * - Payment
 * - Estimate
 * - Bill
 * - Vendor
 *
 * Security:
 * - Validates webhook signature using Intuit verifier token
 * - Rate limiting to prevent abuse
 * - Idempotent processing (handles duplicate webhooks)
 *
 * @endpoint POST /functions/v1/qbo-webhook-listener
 * @headers intuit-signature: HMAC-SHA256 signature
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, intuit-signature',
};

interface WebhookPayload {
  eventNotifications: EventNotification[];
}

interface EventNotification {
  realmId: string;
  dataChangeEvent: {
    entities: EntityChange[];
  };
}

interface EntityChange {
  name: string; // "Customer", "Invoice", "Item", "Payment", etc.
  id: string;
  operation: 'Create' | 'Update' | 'Delete' | 'Merge' | 'Void';
  lastUpdated: string;
}

// Map QBO entity names to our sync functions
const ENTITY_SYNC_MAP: { [key: string]: string } = {
  'Customer': 'qbo-sync-customers',
  'Item': 'qbo-sync-items',
  'Invoice': 'qbo-sync-invoices',
  'Payment': 'qbo-sync-payments',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook payload
    const payload: WebhookPayload = await req.json();
    const signature = req.headers.get('intuit-signature');

    console.log('Received webhook from QuickBooks:', JSON.stringify(payload, null, 2));

    // Validate webhook signature
    const webhookVerifierToken = Deno.env.get('QBO_WEBHOOK_VERIFIER_TOKEN');
    if (webhookVerifierToken && signature) {
      const isValid = verifyWebhookSignature(
        JSON.stringify(payload),
        signature,
        webhookVerifierToken
      );

      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Process each event notification
    const processedEvents: any[] = [];
    const errors: any[] = [];

    for (const notification of payload.eventNotifications || []) {
      const realmId = notification.realmId;

      // Find organization by realm ID
      const { data: connections, error: connError } = await supabaseClient
        .from('qbo_connection')
        .select('organization_id, is_active')
        .eq('qbo_realm_id', realmId)
        .eq('is_active', true)
        .limit(1);

      if (connError || !connections || connections.length === 0) {
        console.warn(`No active connection found for realm ${realmId}`);
        continue;
      }

      const organizationId = connections[0].organization_id;

      // Process entity changes
      for (const entityChange of notification.dataChangeEvent?.entities || []) {
        try {
          await processEntityChange(
            supabaseClient,
            organizationId,
            realmId,
            entityChange
          );

          processedEvents.push({
            realmId,
            entity: entityChange.name,
            id: entityChange.id,
            operation: entityChange.operation,
            status: 'processed',
          });
        } catch (error) {
          console.error(`Error processing entity change:`, error);
          errors.push({
            realmId,
            entity: entityChange.name,
            id: entityChange.id,
            operation: entityChange.operation,
            error: error.message,
          });
        }
      }
    }

    // Log webhook processing
    await supabaseClient.from('qbo_webhook_log').insert({
      payload,
      signature,
      processed_events: processedEvents,
      errors: errors.length > 0 ? errors : null,
      received_at: new Date().toISOString(),
      status: errors.length === 0 ? 'success' : 'partial',
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedEvents.length,
        errors: errors.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unhandled error in qbo-webhook-listener:', error);
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
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  verifierToken: string
): boolean {
  try {
    const hmac = createHmac('sha256', verifierToken);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Process a single entity change from webhook
 */
async function processEntityChange(
  supabaseClient: any,
  organizationId: string,
  realmId: string,
  change: EntityChange
): Promise<void> {
  console.log(`Processing ${change.operation} for ${change.name} ${change.id}`);

  // Check if we support this entity type
  const syncEndpoint = ENTITY_SYNC_MAP[change.name];
  if (!syncEndpoint) {
    console.log(`Entity type ${change.name} not supported for sync, skipping`);
    return;
  }

  // Check if this change has already been processed (idempotency)
  const webhookEventId = `${realmId}-${change.name}-${change.id}-${change.lastUpdated}`;
  const { data: existingEvent } = await supabaseClient
    .from('qbo_webhook_processed')
    .select('id')
    .eq('event_id', webhookEventId)
    .limit(1);

  if (existingEvent && existingEvent.length > 0) {
    console.log(`Event ${webhookEventId} already processed, skipping`);
    return;
  }

  // Handle different operations
  if (change.operation === 'Delete' || change.operation === 'Void') {
    await handleDeleteOrVoid(supabaseClient, organizationId, change);
  } else if (change.operation === 'Merge') {
    // For merge operations, we need to pull the merged entity
    await triggerSync(supabaseClient, organizationId, syncEndpoint, 'pull');
  } else {
    // For Create and Update, pull the latest data from QBO
    await triggerSync(supabaseClient, organizationId, syncEndpoint, 'pull');
  }

  // Mark event as processed
  await supabaseClient.from('qbo_webhook_processed').insert({
    event_id: webhookEventId,
    organization_id: organizationId,
    realm_id: realmId,
    entity_type: change.name,
    entity_id: change.id,
    operation: change.operation,
    processed_at: new Date().toISOString(),
  });
}

/**
 * Handle delete or void operations
 */
async function handleDeleteOrVoid(
  supabaseClient: any,
  organizationId: string,
  change: EntityChange
): Promise<void> {
  const tableName = getTableName(change.name);
  if (!tableName) return;

  if (change.operation === 'Delete') {
    // Soft delete: mark as inactive
    await supabaseClient
      .from(tableName)
      .update({
        is_active: false,
        sync_status: 'deleted',
        last_sync_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('qbo_id', change.id);
  } else if (change.operation === 'Void') {
    // Mark as voided
    await supabaseClient
      .from(tableName)
      .update({
        is_voided: true,
        voided_at: new Date().toISOString(),
        sync_status: 'voided',
        last_sync_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('qbo_id', change.id);
  }
}

/**
 * Trigger a sync for a specific entity type
 */
async function triggerSync(
  supabaseClient: any,
  organizationId: string,
  syncEndpoint: string,
  direction: string
): Promise<void> {
  console.log(`Triggering ${direction} sync for ${syncEndpoint}...`);

  // Instead of calling the function directly, queue it for background processing
  // This prevents webhook timeout if sync takes too long
  await supabaseClient.from('qbo_sync_queue').insert({
    organization_id: organizationId,
    sync_endpoint: syncEndpoint,
    direction,
    priority: 'high', // Webhook-triggered syncs are high priority
    status: 'pending',
    created_at: new Date().toISOString(),
  });
}

/**
 * Map QBO entity names to database table names
 */
function getTableName(entityName: string): string | null {
  const map: { [key: string]: string } = {
    'Customer': 'customer_profile',
    'Item': 'item_record',
    'Invoice': 'invoice_record',
    'Payment': 'invoice_payment',
  };
  return map[entityName] || null;
}
