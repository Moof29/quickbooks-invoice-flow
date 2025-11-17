import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Generate Template Test Data Function Started ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }
    console.log('User authenticated:', user.id);

    // Get organization_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }
    const organizationId = profile.organization_id;
    console.log('Organization ID:', organizationId);

    // Get all customers
    const { data: customers, error: customersError } = await supabase
      .from('customer_profile')
      .select('id, company_name')
      .eq('organization_id', organizationId)
      .limit(10);

    if (customersError || !customers || customers.length === 0) {
      throw new Error('No customers found');
    }
    console.log(`Found ${customers.length} customers`);

    // Get all items
    const { data: items, error: itemsError } = await supabase
      .from('item_record')
      .select('id, name, description')
      .eq('organization_id', organizationId)
      .limit(20);

    if (itemsError || !items || items.length === 0) {
      throw new Error('No items found');
    }
    console.log(`Found ${items.length} items`);

    let templatesCreated = 0;
    let itemsCreated = 0;

    // For each customer, create a template
    for (const customer of customers) {
      console.log(`\nProcessing customer: ${customer.company_name}`);

      // Delete existing templates for this customer
      const { error: deleteTemplateError } = await supabase
        .from('customer_templates')
        .delete()
        .eq('customer_id', customer.id)
        .eq('organization_id', organizationId);

      if (deleteTemplateError) {
        console.error('Error deleting old templates:', deleteTemplateError);
      }

      // Create template
      const { data: template, error: templateError } = await supabase
        .from('customer_templates')
        .insert({
          organization_id: organizationId,
          customer_id: customer.id,
          name: `${customer.company_name} - Daily Template`,
          description: 'Auto-generated template for testing',
          is_active: true,
        })
        .select()
        .single();

      if (templateError || !template) {
        console.error('Error creating template:', templateError);
        continue;
      }
      console.log(`Created template: ${template.name}`);
      templatesCreated++;

      // Add 5-10 random items to this template
      const numItems = Math.floor(Math.random() * 6) + 5;
      const selectedItems = items
        .sort(() => Math.random() - 0.5)
        .slice(0, numItems);

      for (const item of selectedItems) {
        // Random quantities for each day (0-10)
        const templateItem = {
          organization_id: organizationId,
          template_id: template.id,
          item_id: item.id,
          monday_qty: Math.floor(Math.random() * 11),
          tuesday_qty: Math.floor(Math.random() * 11),
          wednesday_qty: Math.floor(Math.random() * 11),
          thursday_qty: Math.floor(Math.random() * 11),
          friday_qty: Math.floor(Math.random() * 11),
          saturday_qty: Math.floor(Math.random() * 8), // Lower weekend quantities
          sunday_qty: Math.floor(Math.random() * 5), // Lower weekend quantities
          unit_price: (Math.random() * 50 + 10).toFixed(2), // Random price between 10-60
        };

        const { error: itemError } = await supabase
          .from('customer_template_items')
          .insert(templateItem);

        if (itemError) {
          console.error('Error adding item to template:', itemError);
        } else {
          itemsCreated++;
          console.log(`Added item: ${item.name}`);
        }
      }
    }

    console.log(`\n=== Templates created: ${templatesCreated} ===`);
    console.log(`=== Template items created: ${itemsCreated} ===`);

    // Now generate sales orders from these templates for today
    console.log('\n=== Generating Sales Orders from Templates ===');
    const { data: ordersData, error: ordersError } = await supabase.functions.invoke(
      'generate-daily-orders',
      {
        body: { target_date: new Date().toISOString().split('T')[0] },
      }
    );

    if (ordersError) {
      console.error('Error generating orders:', ordersError);
    } else {
      console.log('Orders generated:', ordersData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        templates_created: templatesCreated,
        items_created: itemsCreated,
        orders_generated: ordersData?.orders_created || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
