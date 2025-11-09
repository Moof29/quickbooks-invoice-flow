import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Authenticate the user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;
    console.log('Clearing all data for organization:', organizationId);

    const deletionCounts: Record<string, number> = {};

    // Delete in correct dependency order
    // With CASCADE foreign keys, many deletions happen automatically

    // 1. Delete template items first
    console.log('Deleting customer template items...');
    const { count: templateItemsCount } = await supabase
      .from('customer_template_items')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.customer_template_items = templateItemsCount || 0;

    // 2. Delete customer templates
    console.log('Deleting customer templates...');
    const { count: templatesCount } = await supabase
      .from('customer_templates')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.customer_templates = templatesCount || 0;

    // 3. Delete invoice payments and line items (before invoices)
    console.log('Deleting invoice payments...');
    const { count: paymentsCount } = await supabase
      .from('invoice_payment')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.invoice_payments = paymentsCount || 0;

    console.log('Deleting invoice line items...');
    const { count: lineItemsCount } = await supabase
      .from('invoice_line_item')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.invoice_line_items = lineItemsCount || 0;

    // 4. Delete invoices (before customers if no CASCADE)
    console.log('Deleting invoices...');
    const { count: invoicesCount } = await supabase
      .from('invoice_record')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.invoices = invoicesCount || 0;

    // 5. Delete customer-related records
    console.log('Deleting customer-related records...');
    const customerDeletions = await Promise.all([
      supabase.from('payment_receipt_record').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('credit_memo_record').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('estimate_record').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('sales_receipt_record').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('customer_messages').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('customer_payment_methods').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('customer_item_price').delete({ count: 'exact' }).eq('organization_id', organizationId),
      supabase.from('customer_portal_user_links').delete({ count: 'exact' }).eq('organization_id', organizationId),
    ]);

    deletionCounts.payment_receipts = customerDeletions[0].count || 0;
    deletionCounts.credit_memos = customerDeletions[1].count || 0;
    deletionCounts.estimates = customerDeletions[2].count || 0;
    deletionCounts.sales_receipts = customerDeletions[3].count || 0;
    deletionCounts.customer_messages = customerDeletions[4].count || 0;
    deletionCounts.payment_methods = customerDeletions[5].count || 0;
    deletionCounts.customer_item_prices = customerDeletions[6].count || 0;
    deletionCounts.portal_user_links = customerDeletions[7].count || 0;

    // 6. Delete customers (invoices will cascade if foreign key is set up)
    console.log('Deleting customers...');
    const { count: customersCount } = await supabase
      .from('customer_profile')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.customers = customersCount || 0;

    // 7. Delete items
    console.log('Deleting items...');
    const { count: itemsCount } = await supabase
      .from('item_record')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.items = itemsCount || 0;

    // 8. Delete batch jobs
    console.log('Deleting batch jobs...');
    const { count: batchJobsCount } = await supabase
      .from('batch_job_queue')
      .delete({ count: 'exact' })
      .eq('organization_id', organizationId);
    deletionCounts.batch_jobs = batchJobsCount || 0;

    console.log('All data cleared successfully:', deletionCounts);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'All data cleared successfully',
        deletionCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error clearing data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
