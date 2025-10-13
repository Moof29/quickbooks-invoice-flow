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
    console.log('=== Clear Invoices Function Started ===');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
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
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;
    console.log('Organization ID:', organizationId);

    // Delete invoice line items first (foreign key constraint)
    console.log('Deleting invoice line items...');
    const { error: lineItemsError } = await supabase
      .from('invoice_line_item')
      .delete()
      .eq('organization_id', organizationId);

    if (lineItemsError) {
      console.error('Error deleting line items:', lineItemsError);
      throw lineItemsError;
    }

    // Delete sales order invoice links
    console.log('Deleting sales order invoice links...');
    const { error: linksError } = await supabase
      .from('sales_order_invoice_link')
      .delete()
      .eq('organization_id', organizationId);

    if (linksError) {
      console.error('Error deleting links:', linksError);
      throw linksError;
    }

    // Delete all invoices
    console.log('Deleting invoices...');
    const { error: invoicesError } = await supabase
      .from('invoice_record')
      .delete()
      .eq('organization_id', organizationId);

    if (invoicesError) {
      console.error('Error deleting invoices:', invoicesError);
      throw invoicesError;
    }

    // Reset sales orders back to reviewed status
    console.log('Resetting sales orders...');
    const { error: resetError } = await supabase
      .from('sales_order')
      .update({
        status: 'reviewed',
        invoiced: false,
        invoice_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('invoiced', true);

    if (resetError) {
      console.error('Error resetting orders:', resetError);
      throw resetError;
    }

    // Get counts
    const { count: reviewedCount } = await supabase
      .from('sales_order')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'reviewed');

    console.log('=== Clear Invoices Completed ===');
    console.log(`Reset ${reviewedCount} orders to reviewed status`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All invoices cleared successfully',
        reviewed_orders: reviewedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== Clear Invoices Error ===');
    console.error(error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
