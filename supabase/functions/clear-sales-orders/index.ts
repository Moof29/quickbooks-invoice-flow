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

    // Delete sales order line items first (foreign key constraint)
    const { error: lineItemsError, count: lineItemsCount } = await supabaseClient
      .from('sales_order_line_item')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);

    if (lineItemsError) {
      throw new Error(`Failed to delete line items: ${lineItemsError.message}`);
    }

    // Delete sales order invoice links
    const { error: linksError, count: linksCount } = await supabaseClient
      .from('sales_order_invoice_link')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);

    if (linksError) {
      throw new Error(`Failed to delete invoice links: ${linksError.message}`);
    }

    // Delete sales orders
    const { error: ordersError, count: ordersCount } = await supabaseClient
      .from('sales_order')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);

    if (ordersError) {
      throw new Error(`Failed to delete sales orders: ${ordersError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          sales_orders: ordersCount || 0,
          line_items: lineItemsCount || 0,
          invoice_links: linksCount || 0,
        },
        message: `Successfully cleared all sales orders for organization`,
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
