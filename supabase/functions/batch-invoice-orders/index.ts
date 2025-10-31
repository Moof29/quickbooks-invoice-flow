import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchInvoiceRequest {
  invoice_ids: string[];  // Changed from sales_order_ids
  invoice_date?: string;
  due_days?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Batch Invoice Orders (Status Update) ===');

    // Authenticate user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Organization ID:', profile.organization_id);

    // Parse request
    const { invoice_ids, invoice_date, due_days = 0 }: BatchInvoiceRequest = await req.json();

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'invoice_ids is required and must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invoice_ids.length > 1000) {
      return new Response(
        JSON.stringify({ 
          error: 'Batch size exceeds maximum of 1,000 invoices',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating batch job for ${invoice_ids.length} invoices`);

    // Create job in queue
    const { data: insertedJob, error: insertError } = await supabase
      .from('batch_job_queue')
      .insert({
        organization_id: profile.organization_id,
        job_type: 'batch_invoice_conversion',
        total_items: invoice_ids.length,
        job_data: {
          invoice_ids: invoice_ids,
          invoice_date: invoice_date || new Date().toISOString().split('T')[0],
          due_days: due_days,
          user_id: user.id,
        },
        status: 'pending',
        created_by: user.id,
        estimated_duration_seconds: Math.ceil(invoice_ids.length * 0.2), // ~0.2s per status update
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating batch job:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create batch job', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Batch job created:', insertedJob.id);
    
    // Trigger immediate background processing
    const processInBackground = async () => {
      console.log('🚀 Starting background processing...');
      
      // Create a service role client for background processing
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      try {
        // Update job status to processing
        await serviceSupabase
          .from('batch_job_queue')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString() 
          })
          .eq('id', insertedJob.id);

        let successCount = 0;
        let failureCount = 0;
        const errors: any[] = [];

        // Process in chunks of 50 for better performance
        const chunkSize = 50;
        for (let i = 0; i < invoice_ids.length; i += chunkSize) {
          const chunk = invoice_ids.slice(i, i + chunkSize);
          
          console.log(`Processing chunk ${i / chunkSize + 1} of ${Math.ceil(invoice_ids.length / chunkSize)}`);
          
          // Update status from pending to invoiced for this chunk
          const { data: updated, error: updateError } = await serviceSupabase
            .from('invoice_record')
            .update({
              status: 'invoiced',
              invoice_date: invoice_date || new Date().toISOString().split('T')[0],
              due_date: invoice_date || new Date().toISOString().split('T')[0],  // Or calculate based on due_days
              approved_at: new Date().toISOString(),
              approved_by: user.id,
            })
            .in('id', chunk)
            .eq('status', 'pending')  // Safety: only convert pending
            .select('id');

          if (updateError) {
            console.error('Chunk update error:', updateError);
            failureCount += chunk.length;
            errors.push({
              chunk_index: i / chunkSize,
              error: updateError.message,
              invoice_ids: chunk
            });
          } else {
            const actualUpdated = updated?.length || 0;
            successCount += actualUpdated;
            failureCount += (chunk.length - actualUpdated);
            
            if (actualUpdated < chunk.length) {
              console.warn(`Only ${actualUpdated}/${chunk.length} invoices updated in chunk`);
            }
          }

          // Update job progress
          await serviceSupabase
            .from('batch_job_queue')
            .update({
              processed_items: i + chunk.length,
              successful_items: successCount,
              failed_items: failureCount,
            })
            .eq('id', insertedJob.id);
        }

        // Mark job as complete
        await serviceSupabase
          .from('batch_job_queue')
          .update({
            status: successCount === invoice_ids.length ? 'completed' : 'completed_with_errors',
            completed_at: new Date().toISOString(),
            errors: errors.length > 0 ? { errors } : null,
          })
          .eq('id', insertedJob.id);

        console.log(`✅ Background processing completed. Success: ${successCount}, Failures: ${failureCount}`);
      } catch (error) {
        console.error('❌ Background processing exception:', error);
        
        // Mark job as failed
        await serviceSupabase
          .from('batch_job_queue')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            last_error: error.message,
          })
          .eq('id', insertedJob.id);
      }
    };
    
    // Start processing in background (non-blocking)
    EdgeRuntime.waitUntil(processInBackground());
    
    console.log('📋 Immediate response sent, processing continues in background');
    
    return new Response(
      JSON.stringify({
        success: true,
        job_id: insertedJob.id,
        total_orders: invoice_ids.length,
        estimated_duration_seconds: insertedJob.estimated_duration_seconds,
        message: `Processing started immediately in background. Converting ${invoice_ids.length} pending invoices.`,
        polling_info: {
          check_status_table: 'batch_job_queue',
          check_status_query: `SELECT * FROM batch_job_queue WHERE id = '${insertedJob.id}'`
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('=== Fatal Error ===');
    console.error(error);

    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        details: { stack: error.stack }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
