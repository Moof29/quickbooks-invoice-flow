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
    console.log('=== Batch Invoice Orders (Pure PostgreSQL) ===');

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

    // Validate batch size (500 max per best practices)
    if (sales_order_ids.length > 500) {
      return new Response(
        JSON.stringify({ 
          error: 'Batch size exceeds maximum of 500 orders',
          details: 'For batches larger than 500 orders, split into multiple smaller batches'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating batch job for ${sales_order_ids.length} orders`);

    // Create job in queue (PostgreSQL will process it via pg_cron)
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
    console.log('📊 Job will be processed by PostgreSQL cron (every 60 seconds)');

    return new Response(
      JSON.stringify({
        success: true,
        job_id: insertedJob.id,
        total_orders: sales_order_ids.length,
        estimated_duration_seconds: insertedJob.estimated_duration_seconds,
        message: 'Batch job queued. Processing will begin within 60 seconds via PostgreSQL.',
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
