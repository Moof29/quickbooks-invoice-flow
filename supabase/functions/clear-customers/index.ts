import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const organizationId = profile.organization_id;

    console.log('Starting customer deletion for organization:', organizationId);

    // Step 1: Delete ALL invoices and related records FIRST (before getting customer list)
    // This prevents the check_organization_references trigger from firing during customer deletion
    
    console.log('Deleting invoice line items...');
    const { error: invoiceLineItemsError } = await supabase
      .from('invoice_line_item')
      .delete()
      .eq('organization_id', organizationId);

    if (invoiceLineItemsError) {
      console.error('Error deleting invoice line items:', invoiceLineItemsError);
      throw invoiceLineItemsError;
    }

    console.log('Deleting invoice payments...');
    const { error: invoicePaymentsError } = await supabase
      .from('invoice_payment')
      .delete()
      .eq('organization_id', organizationId);

    if (invoicePaymentsError) {
      console.error('Error deleting invoice payments:', invoicePaymentsError);
      throw invoicePaymentsError;
    }

    console.log('Deleting ALL invoices for organization...');
    const { error: invoicesError } = await supabase
      .from('invoice_record')
      .delete()
      .eq('organization_id', organizationId);

    if (invoicesError) {
      console.error('Error deleting invoices:', invoicesError);
      throw invoicesError;
    }

    // Delete sales order line items
    console.log('Deleting sales order line items...');
    const { error: salesOrderLineItemsError } = await supabase
      .from('sales_order_line_item')
      .delete()
      .eq('organization_id', organizationId);

    if (salesOrderLineItemsError) {
      console.error('Error deleting sales order line items:', salesOrderLineItemsError);
      throw salesOrderLineItemsError;
    }

    // Delete sales orders
    console.log('Deleting ALL sales orders for organization...');
    const { error: salesOrdersError } = await supabase
      .from('sales_order')
      .delete()
      .eq('organization_id', organizationId);

    if (salesOrdersError) {
      console.error('Error deleting sales orders:', salesOrdersError);
      throw salesOrdersError;
    }

    // Step 2: Get all customer IDs for this organization
    const { data: customers, error: customersError } = await supabase
      .from('customer_profile')
      .select('id')
      .eq('organization_id', organizationId);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    const customerIds = customers?.map(c => c.id) || [];
    console.log(`Found ${customerIds.length} customers to process`);

    if (customerIds.length > 0) {
      // Step 3: Delete other records that reference customers
      console.log('Deleting payment receipts...');
      const { error: paymentReceiptsError } = await supabase
        .from('payment_receipt')
        .delete()
        .in('customer_id', customerIds);

      if (paymentReceiptsError && paymentReceiptsError.code !== 'PGRST116') {
        console.error('Error deleting payment receipts:', paymentReceiptsError);
        throw paymentReceiptsError;
      }

      console.log('Deleting credit memos...');
      const { error: creditMemosError } = await supabase
        .from('credit_memo_record')
        .delete()
        .in('customer_id', customerIds);

      if (creditMemosError && creditMemosError.code !== 'PGRST116') {
        console.error('Error deleting credit memos:', creditMemosError);
        throw creditMemosError;
      }

      console.log('Deleting estimates...');
      const { error: estimatesError } = await supabase
        .from('estimate_record')
        .delete()
        .in('customer_id', customerIds);

      if (estimatesError && estimatesError.code !== 'PGRST116') {
        console.error('Error deleting estimates:', estimatesError);
        throw estimatesError;
      }

      console.log('Deleting sales receipts...');
      const { error: salesReceiptsError } = await supabase
        .from('sales_receipt_record')
        .delete()
        .in('customer_id', customerIds);

      if (salesReceiptsError && salesReceiptsError.code !== 'PGRST116') {
        console.error('Error deleting sales receipts:', salesReceiptsError);
        throw salesReceiptsError;
      }

      console.log('Deleting time activities...');
      const { error: timeActivitiesError } = await supabase
        .from('time_activity_record')
        .delete()
        .in('customer_id', customerIds);

      if (timeActivitiesError && timeActivitiesError.code !== 'PGRST116') {
        console.error('Error deleting time activities:', timeActivitiesError);
        throw timeActivitiesError;
      }

      console.log('Deleting customer messages...');
      const { error: messagesError } = await supabase
        .from('customer_messages')
        .delete()
        .in('customer_id', customerIds);

      if (messagesError && messagesError.code !== 'PGRST116') {
        console.error('Error deleting customer messages:', messagesError);
        throw messagesError;
      }

      console.log('Deleting customer payment methods...');
      const { error: paymentMethodsError } = await supabase
        .from('customer_payment_methods')
        .delete()
        .in('customer_id', customerIds);

      if (paymentMethodsError && paymentMethodsError.code !== 'PGRST116') {
        console.error('Error deleting customer payment methods:', paymentMethodsError);
        throw paymentMethodsError;
      }

      console.log('Deleting customer item prices...');
      const { error: itemPricesError } = await supabase
        .from('customer_item_price')
        .delete()
        .in('customer_id', customerIds);

      if (itemPricesError && itemPricesError.code !== 'PGRST116') {
        console.error('Error deleting customer item prices:', itemPricesError);
        throw itemPricesError;
      }
    }

    // Step 4: Delete customer template items
    console.log('Deleting customer template items...');
    const { error: templateItemsError } = await supabase
      .from('customer_template_items')
      .delete()
      .eq('organization_id', organizationId);

    if (templateItemsError) {
      console.error('Error deleting template items:', templateItemsError);
      throw templateItemsError;
    }

    // Step 5: Delete customer templates
    console.log('Deleting customer templates...');
    const { error: templatesError } = await supabase
      .from('customer_templates')
      .delete()
      .eq('organization_id', organizationId);

    if (templatesError) {
      console.error('Error deleting templates:', templatesError);
      throw templatesError;
    }

    // Step 6: Delete all customers for this organization in batches
    let totalDeleted = 0;
    const batchSize = 500;

    while (true) {
      const { data: customersToDelete, error: fetchError } = await supabase
        .from('customer_profile')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(batchSize);

      if (fetchError) {
        throw fetchError;
      }

      if (!customersToDelete || customersToDelete.length === 0) {
        break;
      }

      const customerIds = customersToDelete.map(customer => customer.id);
      const { error: deleteError } = await supabase
        .from('customer_profile')
        .delete()
        .in('id', customerIds);

      if (deleteError) {
        throw deleteError;
      }

      totalDeleted += customersToDelete.length;
      console.log(`Deleted ${customersToDelete.length} customers, total: ${totalDeleted}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${totalDeleted} customers and their templates`,
        deleted_count: totalDeleted,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error clearing customers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
