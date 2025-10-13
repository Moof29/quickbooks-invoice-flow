import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('=== Batch Processor: Starting job processing ===');

    // Get next job from queue
    const { data: jobs, error } = await supabase.rpc('get_next_batch_job');
    
    if (error) {
      console.error('Error fetching batch job:', error);
      throw error;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No jobs in queue to process');
      return new Response(
        JSON.stringify({ message: 'No jobs to process' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const job = jobs[0];
    console.log('Processing job:', { 
      job_id: job.job_id, 
      job_type: job.job_type,
      organization_id: job.organization_id 
    });

    // Process based on job type
    let result;
    switch (job.job_type) {
      case 'invoice_generation':
        result = await processInvoiceGeneration(supabase, job);
        break;
      case 'qb_sync':
        result = await processQBSync(supabase, job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    console.log('Job processing completed:', { job_id: job.job_id, result });

    // Mark as completed
    const { error: completeError } = await supabase.rpc('complete_batch_job', {
      p_job_id: job.job_id,
      p_result: result,
    });

    if (completeError) {
      console.error('Error marking job as complete:', completeError);
      throw completeError;
    }

    console.log('=== Batch Processor: Job completed successfully ===');

    return new Response(
      JSON.stringify({ success: true, job_id: job.job_id, result }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('=== Batch processing error ===');
    console.error(error);
    
    // Try to fail the job if we have a job_id
    if (error.job_id) {
      try {
        await supabase.rpc('fail_batch_job', {
          p_job_id: error.job_id,
          p_error_message: error.message,
        });
      } catch (failError) {
        console.error('Error marking job as failed:', failError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processInvoiceGeneration(supabase: any, job: any) {
  console.log('=== Processing Invoice Generation ===');
  
  const orderIds = job.payload.sales_order_ids || [];
  console.log(`Processing ${orderIds.length} orders`);

  if (!orderIds || orderIds.length === 0) {
    throw new Error('No sales order IDs provided in job payload');
  }

  const { data, error } = await supabase.rpc('batch_create_invoices_from_orders', {
    p_sales_order_ids: orderIds,
    p_invoice_date: job.payload.invoice_date || new Date().toISOString().split('T')[0],
    p_due_days: job.payload.due_days || 30,
  });

  if (error) {
    console.error('Invoice generation error:', error);
    throw error;
  }

  const successful = data?.filter((r: any) => r.success).length || 0;
  const failed = data?.filter((r: any) => !r.success).length || 0;

  console.log(`Invoice generation complete: ${successful} succeeded, ${failed} failed`);

  return {
    total: orderIds.length,
    successful,
    failed,
    results: data,
  };
}

async function processQBSync(supabase: any, job: any) {
  console.log('=== Processing QuickBooks Sync ===');
  
  const { entity_type, entity_ids } = job.payload;
  
  if (!entity_type || !entity_ids || entity_ids.length === 0) {
    throw new Error('Missing entity_type or entity_ids in job payload');
  }

  console.log(`Syncing ${entity_ids.length} ${entity_type} entities to QuickBooks`);

  // Queue each entity for sync
  const results = [];
  for (const entityId of entity_ids) {
    try {
      const { data, error } = await supabase.rpc('queue_qb_sync', {
        p_entity_type: entity_type,
        p_entity_id: entityId,
        p_organization_id: job.organization_id,
        p_operation: 'sync',
        p_priority: 5,
      });

      if (error) throw error;

      results.push({ entity_id: entityId, success: true, queue_id: data });
    } catch (error: any) {
      console.error(`Failed to queue sync for ${entityId}:`, error);
      results.push({ entity_id: entityId, success: false, error: error.message });
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`QB sync queueing complete: ${successful} succeeded, ${failed} failed`);

  return {
    total: entity_ids.length,
    successful,
    failed,
    results,
  };
}
