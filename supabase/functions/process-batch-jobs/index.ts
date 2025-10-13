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

    // Process invoice generation jobs with incremental progress
    if (job.job_type === 'bulk_invoice_generation' || job.job_type === 'invoice_generation') {
      console.log('Processing invoice generation batch with incremental updates...');
      
      const orderIds = job.payload?.sales_order_ids || [];
      const CHUNK_SIZE = 10; // Process 10 orders at a time
      
      let processed = 0;
      let successful = 0;
      let failed = 0;
      const errors: any[] = [];

      console.log(`Total orders to process: ${orderIds.length}`);

      // Process orders in chunks
      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        // Check if job was cancelled
        const { data: jobStatus } = await supabase
          .from('batch_job_queue')
          .select('status')
          .eq('id', job.job_id)
          .single();
        
        if (jobStatus?.status === 'cancelled') {
          console.log('Job cancelled by user, stopping...');
          return new Response(
            JSON.stringify({ 
              success: true, 
              job_id: job.job_id,
              message: 'Job cancelled',
              processed,
              successful,
              failed
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const chunk = orderIds.slice(i, Math.min(i + CHUNK_SIZE, orderIds.length));
        console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}: orders ${i + 1}-${i + chunk.length}`);

        // Process each order in the chunk
        for (const orderId of chunk) {
          try {
            const { data: result, error: invoiceError } = await supabase.functions.invoke(
              'create-invoice-from-order',
              {
                body: { order_id: orderId },
              }
            );

            processed++;

            if (result?.success) {
              successful++;
              console.log(`✓ Invoice created for order ${orderId}`);
            } else {
              failed++;
              const errorInfo = {
                order_id: orderId,
                error_code: result?.error?.code || 'UNKNOWN',
                message: result?.error?.message || 'Unknown error',
                timestamp: new Date().toISOString()
              };
              errors.push(errorInfo);
              console.log(`✗ Failed to create invoice for order ${orderId}:`, errorInfo.message);
            }
          } catch (err: any) {
            processed++;
            failed++;
            const errorInfo = {
              order_id: orderId,
              error_code: 'PROCESSING_ERROR',
              message: err.message || 'Failed to process order',
              timestamp: new Date().toISOString()
            };
            errors.push(errorInfo);
            console.error(`✗ Error processing order ${orderId}:`, err);
          }
        }

        // Update progress after each chunk
        console.log(`Progress: ${processed}/${orderIds.length} (${successful} successful, ${failed} failed)`);
        await supabase.rpc('update_batch_job_progress', {
          p_job_id: job.job_id,
          p_processed: processed,
          p_successful: successful,
          p_failed: failed,
          p_errors: errors
        });
      }

      // Mark job as completed
      console.log(`Marking job ${job.job_id} as completed...`);
      const { error: completeError } = await supabase.rpc('complete_batch_job', {
        p_job_id: job.job_id,
        p_result: {
          total: orderIds.length,
          successful,
          failed,
          errors: errors.slice(0, 100) // Limit stored errors to first 100
        }
      });

      if (completeError) {
        console.error('Error marking job as complete:', completeError);
        throw completeError;
      }

      console.log('=== Batch Job Completed Successfully ===');
      console.log(`Final results: ${successful}/${orderIds.length} successful, ${failed} failed`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          job_id: job.job_id,
          processed,
          successful,
          failed,
          errors: errors.slice(0, 10) // Return first 10 errors in response
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
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
