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

    // Delete in direct SQL operations using service role for speed
    console.log('Deleting invoice line items...');
    const { error: lineItemError } = await supabase
      .from('invoice_line_item')
      .delete()
      .eq('organization_id', organizationId);
    
    if (lineItemError) {
      console.error('Error deleting line items:', lineItemError);
      throw lineItemError;
    }

    console.log('Deleting sales order invoice links...');
    const { error: linkError } = await supabase
      .from('sales_order_invoice_link')
      .delete()
      .eq('organization_id', organizationId);
    
    if (linkError) {
      console.error('Error deleting links:', linkError);
      throw linkError;
    }

    console.log('Deleting invoices...');
    const { error: invoiceError } = await supabase
      .from('invoice_record')
      .delete()
      .eq('organization_id', organizationId);
    
    if (invoiceError) {
      console.error('Error deleting invoices:', invoiceError);
      throw invoiceError;
    }

    console.log('Resetting sales orders...');
    const { error: orderError } = await supabase
      .from('sales_order')
      .update({ 
        status: 'reviewed',
        invoiced: false,
        invoice_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('invoiced', true);
    
    if (orderError) {
      console.error('Error resetting orders:', orderError);
      throw orderError;
    }

    console.log('=== Clear Invoices Completed ===');


    return new Response(
      JSON.stringify({
        success: true,
        message: 'All invoices cleared successfully'
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
