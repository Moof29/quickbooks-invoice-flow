import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOrdersRequest {
  target_date?: string; // ISO date string, defaults to today
  customer_id?: string; // Optional: generate for specific customer only
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Generate Daily Orders Function Started ===');

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication and get user's organization
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get user's profile and organization
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;
    console.log('Organization ID:', organizationId);

    // Parse request body
    const { target_date, customer_id }: GenerateOrdersRequest = await req.json().catch(() => ({}));
    const targetDate = target_date || new Date().toISOString().split('T')[0];

    console.log('Target date:', targetDate);
    console.log('Customer ID filter:', customer_id || 'All customers');

    // Get active customer templates
    let templatesQuery = supabaseClient
      .from('customer_templates')
      .select('id, customer_id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (customer_id) {
      templatesQuery = templatesQuery.eq('customer_id', customer_id);
    }

    const { data: templates, error: templatesError } = await templatesQuery;

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customer templates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${templates?.length || 0} active templates`);

    // Fetch customer data for all templates
    const customerIds = templates?.map(t => t.customer_id) || [];
    const { data: customers, error: customersError } = await supabaseClient
      .from('customer_profile')
      .select('id, company_name')
      .in('id', customerIds);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
    }

    // Create a map of customer data
    const customerMap = new Map(
      customers?.map(c => [c.id, c]) || []
    );

    const ordersCreated: any[] = [];
    const errors: any[] = [];

    // Process each template
    for (const template of templates || []) {
      try {
        console.log(`Processing template ${template.id} for customer ${template.customer_id}`);

        // Check for duplicate order
        const { data: duplicateCheck } = await supabaseClient.rpc('check_duplicate_orders', {
          p_customer_id: template.customer_id,
          p_delivery_date: targetDate,
          p_organization_id: organizationId,
        });

        if (duplicateCheck?.has_duplicate) {
          console.log(`Duplicate order exists for customer ${template.customer_id}, skipping`);
          continue;
        }

        // Get template items for this date
        const dayOfWeek = new Date(targetDate).getDay(); // 0=Sunday, 6=Saturday
        const dayColumns = ['sunday_qty', 'monday_qty', 'tuesday_qty', 'wednesday_qty', 'thursday_qty', 'friday_qty', 'saturday_qty'];
        const dayColumn = dayColumns[dayOfWeek];

        const { data: templateItems, error: itemsError } = await supabaseClient
          .from('customer_template_items')
          .select(`
            id,
            item_id,
            unit_price,
            ${dayColumn}
          `)
          .eq('template_id', template.id)
          .eq('organization_id', organizationId);

        if (itemsError) {
          console.error(`Error fetching template items for ${template.id}:`, itemsError);
          errors.push({ template_id: template.id, error: itemsError.message });
          continue;
        }

        // Filter items with quantity > 0 for this day
        const itemsWithQuantity = templateItems?.filter((item: any) => {
          const qty = item[dayColumn] || 0;
          return qty > 0;
        }) || [];

        const isNoOrderToday = itemsWithQuantity.length === 0;
        const subtotal = itemsWithQuantity.reduce((sum: number, item: any) => {
          const qty = item[dayColumn] || 0;
          return sum + (qty * item.unit_price);
        }, 0);

        console.log(`Creating order: ${itemsWithQuantity.length} items, no_order: ${isNoOrderToday}`);

      // Create sales order with 0 totals - triggers will update after line items are inserted
        const { data: newOrder, error: orderError } = await supabaseClient
          .from('sales_order')
          .insert({
            organization_id: organizationId,
            customer_id: template.customer_id,
            order_date: new Date().toISOString().split('T')[0],
            delivery_date: targetDate,
            status: 'pending',
            subtotal: 0,
            total: 0,
            is_no_order_today: isNoOrderToday,
            invoiced: false,
            memo: `Auto-generated from template: ${template.name}`,
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Error creating order for customer ${template.customer_id}:`, orderError);
          errors.push({ customer_id: template.customer_id, error: orderError.message });
          continue;
        }

        console.log(`Order created: ${newOrder.id}`);

        // Create line items if there are quantities
        if (itemsWithQuantity.length > 0) {
          const lineItems = itemsWithQuantity.map((item: any) => ({
            organization_id: organizationId,
            sales_order_id: newOrder.id,
            item_id: item.item_id,
            quantity: item[dayColumn],
            unit_price: item.unit_price,
          }));

          const { error: lineItemsError } = await supabaseClient
            .from('sales_order_line_item')
            .insert(lineItems);

          if (lineItemsError) {
            console.error(`Error creating line items for order ${newOrder.id}:`, lineItemsError);
            errors.push({ order_id: newOrder.id, error: lineItemsError.message });
            continue;
          }

          console.log(`Created ${lineItems.length} line items`);
          
          // Fetch the updated order with correct totals (calculated by triggers)
          const { data: updatedOrder } = await supabaseClient
            .from('sales_order')
            .select('total')
            .eq('id', newOrder.id)
            .single();
          
          if (updatedOrder) {
            subtotal = updatedOrder.total;
          }
        }

        const customer = customerMap.get(template.customer_id);
        ordersCreated.push({
          order_id: newOrder.id,
          order_number: newOrder.order_number,
          customer_id: template.customer_id,
          customer_name: customer?.company_name || 'Unknown',
          delivery_date: targetDate,
          total: subtotal,
          is_no_order_today: isNoOrderToday,
          line_items_count: itemsWithQuantity.length,
        });
      } catch (error) {
        console.error(`Unexpected error processing template ${template.id}:`, error);
        errors.push({ template_id: template.id, error: error.message });
      }
    }

    console.log('=== Generation Complete ===');
    console.log(`Orders created: ${ordersCreated.length}`);
    console.log(`Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        orders_created: ordersCreated.length,
        orders: ordersCreated,
        errors: errors,
        target_date: targetDate,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
