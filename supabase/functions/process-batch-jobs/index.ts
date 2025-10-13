import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('=== Batch Job Processor Starting ===');

    // Get next pending job
    const { data: jobs, error: jobError } = await supabase.rpc('get_next_batch_job');
    
    if (jobError) {
      console.error('Error fetching batch job:', jobError);
      throw jobError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No jobs to process');
      return new Response(
        JSON.stringify({ message: 'No jobs pending' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const job = jobs[0];
    console.log(`Processing job ${job.job_id} - type: ${job.job_type}`);

    let result;
    
    // Process based on job type
    if (job.job_type === 'bulk_invoice_generation' || job.job_type === 'invoice_generation') {
      console.log('Processing invoice generation batch...');
      
      const { data, error } = await supabase.rpc('process_invoice_batch', {
        p_batch_payload: job.payload,
      });
      
      if (error) {
        console.error('Error processing invoice batch:', error);
        throw error;
      }
      
      result = data;
      console.log(`Batch completed: ${result?.batch_successful || 0} successful, ${result?.batch_failed || 0} failed`);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark job as completed
    console.log(`Marking job ${job.job_id} as completed...`);
    const { error: completeError } = await supabase.rpc('complete_batch_job', {
      p_job_id: job.job_id,
      p_result: result,
    });

    if (completeError) {
      console.error('Error marking job as complete:', completeError);
      throw completeError;
    }

    console.log('=== Batch Job Completed Successfully ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.job_id,
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('=== Batch Processing Error ===');
    console.error(error);
    
    // Try to mark job as failed if we have a job ID
    if (error.job_id) {
      try {
        console.log(`Marking job ${error.job_id} as failed...`);
        await supabase.rpc('fail_batch_job', {
          p_job_id: error.job_id,
          p_error_message: error.message,
        });
      } catch (failError) {
        console.error('Failed to mark job as failed:', failError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
