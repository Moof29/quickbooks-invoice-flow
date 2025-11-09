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

    // With CASCADE foreign key, invoices are automatically deleted when customers are deleted
    // We only need to delete customer-related data that won't cascade

    // Step 1: Get all customer IDs for this organization
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
      // Step 2: Delete customer-related records (invoices will cascade automatically)
      console.log('Deleting customer-related records in parallel...');
      
      await Promise.all([
        supabase.from('payment_receipt_record').delete().in('customer_id', customerIds),
        supabase.from('credit_memo_record').delete().in('customer_id', customerIds),
        supabase.from('estimate_record').delete().in('customer_id', customerIds),
        supabase.from('sales_receipt_record').delete().in('customer_id', customerIds),
        supabase.from('employee_time_tracking').delete().in('customer_id', customerIds),
        supabase.from('customer_messages').delete().in('customer_id', customerIds),
        supabase.from('customer_payment_methods').delete().in('customer_id', customerIds),
        supabase.from('customer_item_price').delete().in('customer_id', customerIds),
        supabase.from('customer_portal_user_links').delete().in('customer_id', customerIds),
      ]);
      
      console.log('Customer-related records deleted');
    }

    // Step 3: Delete customer template items
    console.log('Deleting customer template items...');
    const { error: templateItemsError } = await supabase
      .from('customer_template_items')
      .delete()
      .eq('organization_id', organizationId);

    if (templateItemsError) {
      console.error('Error deleting template items:', templateItemsError);
      throw templateItemsError;
    }

    // Step 4: Delete customer templates
    console.log('Deleting customer templates...');
    const { error: templatesError } = await supabase
      .from('customer_templates')
      .delete()
      .eq('organization_id', organizationId);

    if (templatesError) {
      console.error('Error deleting templates:', templatesError);
      throw templatesError;
    }

    // Step 5: Delete all customers (invoices will cascade automatically)
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
