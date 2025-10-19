import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchInvoiceRequest {
  sales_order_ids: string[];
  invoice_date?: string;
  due_days?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Batch Invoice Orders (Immediate Processing) ===');

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
    const { sales_order_ids, invoice_date, due_days = 0 }: BatchInvoiceRequest = await req.json();

    if (!sales_order_ids || !Array.isArray(sales_order_ids) || sales_order_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'sales_order_ids is required and must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow large batches - they will be processed in chunks of 50 by the SQL function
    if (sales_order_ids.length > 10000) {
      return new Response(
        JSON.stringify({ 
          error: 'Batch size exceeds maximum of 10,000 orders',
          details: 'Orders will be processed in micro-batches of 50 for optimal database performance'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating batch job for ${sales_order_ids.length} orders`);

    // Create job in queue
    const { data: insertedJob, error: insertError } = await supabase
      .from('batch_job_queue')
      .insert({
        organization_id: profile.organization_id,
        job_type: 'batch_invoice_orders',
        total_items: sales_order_ids.length,
        job_data: {
          order_ids: sales_order_ids,
          invoice_date: invoice_date || new Date().toISOString().split('T')[0],
          due_days: due_days,
          user_id: user.id,
        },
        status: 'pending',
        created_by: user.id,
        estimated_duration_seconds: Math.ceil(sales_order_ids.length * 0.5), // ~0.5s per invoice
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
        const { error: triggerError } = await serviceSupabase.rpc('trigger_batch_invoice_processing');
        
        if (triggerError) {
          console.error('❌ Background processing error:', triggerError);
        } else {
          console.log('✅ Background processing completed successfully');
        }
      } catch (error) {
        console.error('❌ Background processing exception:', error);
      }
    };
    
    // Start processing in background (non-blocking)
    EdgeRuntime.waitUntil(processInBackground());
    
    console.log('📋 Immediate response sent, processing continues in background');
    
    return new Response(
      JSON.stringify({
        success: true,
        job_id: insertedJob.id,
        total_orders: sales_order_ids.length,
        estimated_duration_seconds: insertedJob.estimated_duration_seconds,
        message: `Processing started immediately in background. Job will be processed in chunks of 50 orders.`,
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
