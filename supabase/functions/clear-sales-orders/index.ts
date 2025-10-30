import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's organization
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('No organization found');
    }

    const organizationId = profile.organization_id;

    console.log('Clearing sales orders for organization:', organizationId);

    // Delete in batches to avoid timeout
    let salesOrderLineItemsCount = 0;
    let salesOrdersCount = 0;

    // Delete sales order line items in batches of 500
    while (true) {
      const { data: batch, error: selectError } = await supabaseClient
        .from('sales_order_line_item')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(500);

      if (selectError) {
        throw new Error(`Failed to fetch sales order line items: ${selectError.message}`);
      }

      if (!batch || batch.length === 0) break;

      const { error: deleteError } = await supabaseClient
        .from('sales_order_line_item')
        .delete()
        .in('id', batch.map(item => item.id));

      if (deleteError) {
        throw new Error(`Failed to delete sales order line items batch: ${deleteError.message}`);
      }

      salesOrderLineItemsCount += batch.length;
      console.log(`Deleted ${batch.length} sales order line items`);
    }

    // Delete sales orders in batches of 500
    while (true) {
      const { data: batch, error: selectError } = await supabaseClient
        .from('sales_order')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(500);

      if (selectError) {
        throw new Error(`Failed to fetch sales orders: ${selectError.message}`);
      }

      if (!batch || batch.length === 0) break;

      const { error: deleteError } = await supabaseClient
        .from('sales_order')
        .delete()
        .in('id', batch.map(order => order.id));

      if (deleteError) {
        throw new Error(`Failed to delete sales orders batch: ${deleteError.message}`);
      }

      salesOrdersCount += batch.length;
      console.log(`Deleted ${batch.length} sales orders`);
    }

    console.log('✅ Clearing complete:', { salesOrdersCount, salesOrderLineItemsCount });

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          sales_orders: salesOrdersCount || 0,
          line_items: salesOrderLineItemsCount || 0,
        },
        message: `Successfully cleared ${salesOrdersCount} sales orders and ${salesOrderLineItemsCount} line items`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error clearing sales orders:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
