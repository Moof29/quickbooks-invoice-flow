import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PRODUCTION SAFEGUARD: Clear Pending Orders
 * 
 * Deletes all pending orders for an organization.
 * 
 * Security Requirements:
 * 1. User must be authenticated
 * 2. User must have admin role
 * 3. Must provide confirmation parameter
 * 4. Environment check (warning for production)
 */

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

    // 1. Get the authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // 2. Get user's profile and organization
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('No organization found');
    }

    // 3. Check admin role
    if (profile.role !== 'admin') {
      console.warn(`Non-admin user ${user.id} attempted to clear pending orders`);
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check confirmation parameter
    const url = new URL(req.url);
    const confirmed = url.searchParams.get('confirm') === 'DELETE_PENDING';
    
    if (!confirmed) {
      return new Response(
        JSON.stringify({ 
          error: 'Confirmation required',
          message: 'Add ?confirm=DELETE_PENDING to the request to proceed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Environment warning
    const environment = Deno.env.get('ENVIRONMENT') || 'development';
    if (environment === 'production') {
      console.warn(`⚠️ PRODUCTION PENDING ORDER DELETION - Organization: ${profile.organization_id}, User: ${user.email}`);
    }

    const organizationId = profile.organization_id;
    console.log(`🗑️ Clearing pending orders for organization: ${organizationId}`);
    console.log(`Environment: ${environment}`);
    console.log(`Initiated by: ${user.email}`);

    // Delete in batches to avoid timeout
    let lineItemsCount = 0;
    let pendingOrdersCount = 0;

    // First, get all pending order IDs
    const { data: allPendingOrders, error: fetchError } = await supabaseClient
      .from('invoice_record')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('status', 'pending');

    if (fetchError) {
      throw new Error(`Failed to fetch pending orders: ${fetchError.message}`);
    }

    if (!allPendingOrders || allPendingOrders.length === 0) {
      console.log('No pending orders to clear');
      return new Response(
        JSON.stringify({
          success: true,
          deleted: {
            pending_orders: 0,
            line_items: 0,
          },
          environment,
          message: 'No pending orders to clear',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const pendingOrderIds = allPendingOrders.map(inv => inv.id);
    console.log(`Found ${pendingOrderIds.length} pending orders to clear`);

    // Delete invoice line items for pending orders in batches of 500
    while (true) {
      const { data: batch, error: selectError } = await supabaseClient
        .from('invoice_line_item')
        .select('id')
        .eq('organization_id', organizationId)
        .in('invoice_id', pendingOrderIds)
        .limit(500);

      if (selectError) {
        console.error('Error fetching line items:', selectError);
        break;
      }

      if (!batch || batch.length === 0) break;

      const { error: deleteError } = await supabaseClient
        .from('invoice_line_item')
        .delete()
        .in('id', batch.map(item => item.id));

      if (deleteError) {
        throw new Error(`Failed to delete invoice line items batch: ${deleteError.message}`);
      }

      lineItemsCount += batch.length;
      console.log(`Deleted ${batch.length} invoice line items`);
    }

    // Delete pending orders in batches of 500
    for (let i = 0; i < pendingOrderIds.length; i += 500) {
      const batchIds = pendingOrderIds.slice(i, i + 500);
      
      const { error: deleteError } = await supabaseClient
        .from('invoice_record')
        .delete()
        .in('id', batchIds);

      if (deleteError) {
        throw new Error(`Failed to delete pending orders batch: ${deleteError.message}`);
      }

      pendingOrdersCount += batchIds.length;
      console.log(`Deleted ${batchIds.length} pending orders`);
    }

    console.log('✅ Clearing complete:', { pendingOrdersCount, lineItemsCount });

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          pending_orders: pendingOrdersCount || 0,
          line_items: lineItemsCount || 0,
        },
        message: `Successfully cleared ${pendingOrdersCount} pending orders and ${lineItemsCount} line items`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error clearing pending orders:', error);
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
