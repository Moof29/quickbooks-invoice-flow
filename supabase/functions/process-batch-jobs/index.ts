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

    // Call the database function to process jobs
    const { data, error } = await supabase.rpc('process_pending_batch_jobs');
    
    if (error) {
      console.error('Error processing batch jobs:', error);
      throw error;
    }

    console.log('Processing result:', data);

    // If no jobs were found, return early
    if (data?.message === 'No jobs pending') {
      console.log('No jobs to process');
      return new Response(
        JSON.stringify({ message: 'No jobs pending' }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Job was processed
    if (data?.success) {
      console.log(`✅ Job ${data.job_id} completed: ${data.successful}/${data.processed} successful`);
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('Job processing failed:', data?.error);
      return new Response(
        JSON.stringify({ error: data?.error || 'Processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
