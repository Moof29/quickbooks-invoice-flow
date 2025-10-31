import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOrdersRequest {
  target_date?: string;
  target_dates?: string[];
  customer_id?: string;
  customer_ids?: string[];
}

interface BatchGenerationResult {
  success: boolean;
  orders_created: number;
  dates_processed: number;
  orders: any[];
  errors: any[];
}

// All processing logic moved to database function for performance

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Generate Daily Orders Function Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get organization
    const { data: profile, error: profileError } = await supabaseClient
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

    const organizationId = profile.organization_id;
    console.log('Organization ID:', organizationId);

    // Parse request
    const { target_date, target_dates, customer_id, customer_ids }: GenerateOrdersRequest = await req.json().catch(() => ({}));

    const targetDates = target_dates 
      ? (Array.isArray(target_dates) ? target_dates : [target_dates])
      : (target_date ? [target_date] : [new Date().toISOString().split('T')[0]]);

    const customerIdsFilter = customer_ids 
      ? (Array.isArray(customer_ids) ? customer_ids : [customer_ids])
      : (customer_id ? [customer_id] : null);

    console.log('Target dates:', targetDates);
    console.log('Customer IDs filter:', customerIdsFilter);

    // Call the high-performance database function
    console.log('=== Calling database batch generation function ===');
    const { data, error: rpcError } = await supabaseClient
      .rpc('generate_daily_orders_batch', {
        p_organization_id: organizationId,
        p_target_dates: targetDates,
        p_customer_ids: customerIdsFilter
      })
      .single();

    if (rpcError) {
      console.error('Database function error:', rpcError);
      throw new Error(`Failed to generate orders: ${rpcError.message}`);
    }

    const result: BatchGenerationResult = data;
    console.log('=== Generation Complete ===');
    console.log(`Orders created: ${result.orders_created}`);
    console.log(`Dates processed: ${result.dates_processed}`);
    console.log(`Errors: ${result.errors?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: result.success,
        orders_created: result.orders_created,
        orders: result.orders,
        errors: result.errors,
        dates_processed: targetDates,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
