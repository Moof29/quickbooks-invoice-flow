import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Batch Invoice Orders Function Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get user's organization
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.error('User profile not found');
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sales_order_ids, invoice_date, due_days } = await req.json();

    if (!sales_order_ids || !Array.isArray(sales_order_ids) || sales_order_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'sales_order_ids array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Queueing ${sales_order_ids.length} invoices for user ${user.id}`);

    const userContext = {
      user_id: user.id,
      email: user.email,
      source: 'batch-invoice-orders',
      timestamp: new Date().toISOString(),
    };

    // Use service role to create bulk job
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: jobId, error } = await supabaseAdmin.rpc('create_bulk_invoice_job', {
      p_sales_order_ids: sales_order_ids,
      p_organization_id: profile.organization_id,
      p_invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      p_due_days: due_days || 30,
      p_user_context: userContext,
    });

    if (error) {
      console.error('Error creating bulk job:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Bulk job created: ${jobId}, processing ${sales_order_ids.length} orders`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        total_orders: sales_order_ids.length,
        message: 'Job queued successfully. Processing will begin shortly.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error queueing bulk job:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
