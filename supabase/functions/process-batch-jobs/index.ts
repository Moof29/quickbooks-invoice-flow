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

    // Get the next job from batch_processing_queue
    const { data: job, error: jobError } = await supabase.rpc('get_next_batch_job');
    
    if (jobError) {
      console.error('Error getting next job:', jobError);
      throw jobError;
    }

    // If no jobs were found, return early
    if (!job || job.length === 0) {
      console.log('No jobs to process');
      return new Response(
        JSON.stringify({ message: 'No jobs pending' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const currentJob = job[0];
    console.log(`Processing job ${currentJob.job_id} of type ${currentJob.job_type}`);

    // Process the job based on type
    if (currentJob.job_type === 'invoice_generation') {
      // Call process_invoice_batch with the job payload
      const { data: result, error: processError } = await supabase
        .rpc('process_invoice_batch', { p_batch_payload: currentJob.payload });
      
      if (processError) {
        console.error('Error processing invoice batch:', processError);
        
        // Mark job as failed
        await supabase.rpc('fail_batch_job', {
          p_job_id: currentJob.job_id,
          p_error_message: processError.message
        });
        
        throw processError;
      }

      // Mark job as completed
      await supabase.rpc('complete_batch_job', {
        p_job_id: currentJob.job_id,
        p_result: result
      });

      console.log(`✅ Job ${currentJob.job_id} completed successfully`);
      console.log(`Batch ${result.batch_number}/${result.batch_total}: ${result.batch_successful} successful, ${result.batch_failed} failed`);
      
      return new Response(
        JSON.stringify({
          success: true,
          job_id: currentJob.job_id,
          result: result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error(`Unknown job type: ${currentJob.job_type}`);
      await supabase.rpc('fail_batch_job', {
        p_job_id: currentJob.job_id,
        p_error_message: `Unknown job type: ${currentJob.job_type}`
      });
      
      return new Response(
        JSON.stringify({ error: `Unknown job type: ${currentJob.job_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error: any) {
    console.error('=== Batch Processing Error ===');
    console.error(error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
