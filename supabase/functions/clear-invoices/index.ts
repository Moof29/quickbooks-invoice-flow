import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function clearInvoicesInBackground(organizationId: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const batchSize = 500;
  let deletedLineItems = 0;
  let deletedInvoices = 0;
  let deletedLinks = 0;

  try {
    // Delete invoice line items in batches
    console.log('Starting batched deletion of invoice line items...');
    while (true) {
      const { data: items, error: fetchError } = await supabase
        .from('invoice_line_item')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(batchSize);

      if (fetchError) throw fetchError;
      if (!items || items.length === 0) break;

      const ids = items.map(item => item.id);
      const { error: deleteError } = await supabase
        .from('invoice_line_item')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;
      
      deletedLineItems += items.length;
      console.log(`Deleted ${deletedLineItems} line items so far...`);
    }

    // Delete sales order invoice links in batches
    console.log('Starting batched deletion of sales order invoice links...');
    while (true) {
      const { data: links, error: fetchError } = await supabase
        .from('sales_order_invoice_link')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(batchSize);

      if (fetchError) throw fetchError;
      if (!links || links.length === 0) break;

      const ids = links.map(link => link.id);
      const { error: deleteError } = await supabase
        .from('sales_order_invoice_link')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;
      
      deletedLinks += links.length;
      console.log(`Deleted ${deletedLinks} invoice links so far...`);
    }

    // Delete invoices in batches
    console.log('Starting batched deletion of invoices...');
    while (true) {
      const { data: invoices, error: fetchError } = await supabase
        .from('invoice_record')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(batchSize);

      if (fetchError) throw fetchError;
      if (!invoices || invoices.length === 0) break;

      const ids = invoices.map(inv => inv.id);
      const { error: deleteError } = await supabase
        .from('invoice_record')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;
      
      deletedInvoices += invoices.length;
      console.log(`Deleted ${deletedInvoices} invoices so far...`);
    }

    // Reset sales orders back to reviewed status
    console.log('Resetting sales orders to reviewed status...');
    const { error: resetError, count } = await supabase
      .from('sales_order')
      .update({ 
        status: 'reviewed',
        invoiced: false,
        invoice_id: null
      })
      .eq('organization_id', organizationId)
      .eq('invoiced', true);

    if (resetError) throw resetError;

    console.log('=== Background Clear Completed ===');
    console.log(`Total deleted: ${deletedLineItems} line items, ${deletedLinks} links, ${deletedInvoices} invoices`);
    console.log(`Reset ${count || 0} sales orders to reviewed status`);
  } catch (error) {
    console.error('=== Background Clear Error ===');
    console.error(error);
  }
}

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

    // Start background task for clearing invoices
    console.log('Starting background clear task...');
    EdgeRuntime.waitUntil(clearInvoicesInBackground(organizationId));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invoice clearing started in background. This may take a few minutes.'
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
