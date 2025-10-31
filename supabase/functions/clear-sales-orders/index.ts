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

    console.log('Clearing pending invoices (sales orders) for organization:', organizationId);

    // Delete in batches to avoid timeout
    let invoiceLineItemsCount = 0;
    let pendingInvoicesCount = 0;

    // First, get all pending invoice IDs
    const { data: allPendingInvoices, error: fetchError } = await supabaseClient
      .from('invoice_record')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('status', 'pending');

    if (fetchError) {
      throw new Error(`Failed to fetch pending invoices: ${fetchError.message}`);
    }

    if (!allPendingInvoices || allPendingInvoices.length === 0) {
      console.log('No pending invoices to clear');
      return new Response(
        JSON.stringify({
          success: true,
          deleted: {
            pending_invoices: 0,
            line_items: 0,
          },
          message: 'No pending orders to clear',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const pendingInvoiceIds = allPendingInvoices.map(inv => inv.id);
    console.log(`Found ${pendingInvoiceIds.length} pending invoices to clear`);

    // Delete invoice line items for pending invoices in batches of 500
    while (true) {
      const { data: batch, error: selectError } = await supabaseClient
        .from('invoice_line_item')
        .select('id')
        .eq('organization_id', organizationId)
        .in('invoice_id', pendingInvoiceIds)
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

      invoiceLineItemsCount += batch.length;
      console.log(`Deleted ${batch.length} invoice line items`);
    }

    // Delete pending invoices in batches of 500
    for (let i = 0; i < pendingInvoiceIds.length; i += 500) {
      const batchIds = pendingInvoiceIds.slice(i, i + 500);
      
      const { error: deleteError } = await supabaseClient
        .from('invoice_record')
        .delete()
        .in('id', batchIds);

      if (deleteError) {
        throw new Error(`Failed to delete pending invoices batch: ${deleteError.message}`);
      }

      pendingInvoicesCount += batchIds.length;
      console.log(`Deleted ${batchIds.length} pending invoices`);
    }

    console.log('✅ Clearing complete:', { pendingInvoicesCount, invoiceLineItemsCount });

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          pending_invoices: pendingInvoicesCount || 0,
          line_items: invoiceLineItemsCount || 0,
        },
        message: `Successfully cleared ${pendingInvoicesCount} pending orders and ${invoiceLineItemsCount} line items`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error clearing pending invoices:', error);
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
