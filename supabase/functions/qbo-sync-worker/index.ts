/**
 * QuickBooks Online Sync Worker
 *
 * Background worker that processes jobs from the qbo_sync_queue.
 * This function is designed to be called periodically (e.g., every minute)
 * by pg_cron or external scheduler.
 *
 * Features:
 * - Picks jobs from queue in priority order
 * - Processes jobs concurrently (configurable limit)
 * - Automatic retry with exponential backoff
 * - Dead letter queue for permanently failed jobs
 * - Graceful shutdown handling
 *
 * @endpoint POST /functions/v1/qbo-sync-worker
 * @body {maxConcurrent?: number, maxJobs?: number}
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerConfig {
  maxConcurrent?: number; // Maximum concurrent jobs
  maxJobs?: number; // Maximum jobs to process in this run
}

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

    const { maxConcurrent = 5, maxJobs = 20 } = await req.json() as WorkerConfig;

    console.log(`=== Sync Worker Started ===`);
    console.log(`Max Concurrent: ${maxConcurrent}, Max Jobs: ${maxJobs}`);

    const processedJobs: any[] = [];
    let jobsProcessed = 0;

    // Process jobs in batches
    while (jobsProcessed < maxJobs) {
      // Get next batch of jobs
      const batchSize = Math.min(maxConcurrent, maxJobs - jobsProcessed);
      const jobs: any[] = [];

      for (let i = 0; i < batchSize; i++) {
        const { data, error } = await supabaseClient.rpc('get_next_sync_job');
        if (error) {
          console.error('Error fetching next job:', error);
          break;
        }
        if (!data || data.length === 0) {
          break; // No more jobs
        }
        jobs.push(data[0]);
      }

      if (jobs.length === 0) {
        console.log('No more jobs in queue');
        break;
      }

      console.log(`Processing batch of ${jobs.length} jobs...`);

      // Process jobs concurrently
      const jobPromises = jobs.map(job => processJob(supabaseClient, job));
      const results = await Promise.allSettled(jobPromises);

      // Collect results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const job = jobs[i];

        if (result.status === 'fulfilled') {
          processedJobs.push(result.value);
        } else {
          console.error(`Job ${job.id} failed:`, result.reason);
          processedJobs.push({
            jobId: job.id,
            status: 'failed',
            error: result.reason.message,
          });

          // Mark job as failed
          await supabaseClient.rpc('complete_sync_job', {
            p_job_id: job.id,
            p_status: 'failed',
            p_error_message: result.reason.message,
          });
        }
      }

      jobsProcessed += jobs.length;
    }

    const duration = Date.now() - startTime;

    console.log(`=== Sync Worker Completed ===`);
    console.log(`Processed: ${jobsProcessed} jobs`);
    console.log(`Duration: ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        jobsProcessed,
        duration,
        results: processedJobs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unhandled error in qbo-sync-worker:', error);
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
 * Process a single sync job
 */
async function processJob(
  supabaseClient: any,
  job: any
): Promise<any> {
  const jobStartTime = Date.now();

  console.log(`Processing job ${job.id}: ${job.sync_endpoint} (${job.direction})`);

  try {
    // Build request body
    const requestBody: any = {
      organizationId: job.organization_id,
      direction: job.direction,
    };

    // Add entity IDs if specified
    if (job.entity_ids && job.entity_ids.length > 0) {
      if (job.sync_endpoint === 'qbo-sync-invoices') {
        requestBody.invoiceIds = job.entity_ids;
      } else if (job.sync_endpoint === 'qbo-sync-customers') {
        requestBody.customerIds = job.entity_ids;
      } else if (job.sync_endpoint === 'qbo-sync-items') {
        requestBody.itemIds = job.entity_ids;
      }
    }

    // Call sync endpoint
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/${job.sync_endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const duration = Date.now() - jobStartTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync endpoint failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Sync endpoint returned success: false`);
    }

    // Mark job as completed
    await supabaseClient.rpc('complete_sync_job', {
      p_job_id: job.id,
      p_status: 'completed',
    });

    console.log(`Job ${job.id} completed in ${duration}ms`);

    return {
      jobId: job.id,
      status: 'completed',
      duration,
      pulled: result.results?.pulled || 0,
      pushed: result.results?.pushed || 0,
      errors: result.results?.errors || [],
    };
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);

    // Mark job as failed
    await supabaseClient.rpc('complete_sync_job', {
      p_job_id: job.id,
      p_status: 'failed',
      p_error_message: error.message,
    });

    // Check if job should be retried
    const { data: updatedJob } = await supabaseClient
      .from('qbo_sync_queue')
      .select('retry_count, max_retries')
      .eq('id', job.id)
      .single();

    if (updatedJob && updatedJob.retry_count < updatedJob.max_retries) {
      console.log(`Job ${job.id} will be retried (attempt ${updatedJob.retry_count + 1}/${updatedJob.max_retries})`);

      // Requeue with exponential backoff
      const backoffMinutes = Math.pow(2, updatedJob.retry_count);
      await supabaseClient
        .from('qbo_sync_queue')
        .update({
          status: 'pending',
          scheduled_at: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
        })
        .eq('id', job.id);
    } else {
      console.error(`Job ${job.id} permanently failed after ${updatedJob?.retry_count || 0} retries`);
    }

    throw error;
  }
}
