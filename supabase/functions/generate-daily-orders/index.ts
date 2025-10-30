import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOrdersRequest {
  target_date?: string;
  target_dates?: string[];
  customer_id?: string;
  customer_ids?: string[];
}

async function processDateOrders(
  targetDate: string,
  organizationId: string,
  customerIdsFilter: string[] | null,
  supabaseClient: any
) {
  console.log(`\n=== Processing date: ${targetDate} ===`);
  
  // Fetch templates
  let templatesQuery = supabaseClient
    .from('customer_templates')
    .select('id, customer_id, name')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  
  if (customerIdsFilter && customerIdsFilter.length > 0) {
    templatesQuery = templatesQuery.in('customer_id', customerIdsFilter);
  }
  
  const { data: templates, error: templatesError } = await templatesQuery;
  
  if (templatesError) {
    console.error('Error fetching templates:', templatesError);
    return {
      date: targetDate,
      orders: [],
      errors: [{ date: targetDate, error: 'Failed to fetch templates' }]
    };
  }
  
  console.log(`Found ${templates?.length || 0} active templates for ${targetDate}`);
  
  if (!templates || templates.length === 0) {
    return { date: targetDate, orders: [], errors: [] };
  }
  
  const customerIds = templates.map((t) => t.customer_id);
  
  // Fetch customers and check for duplicates in parallel
  const [customersResult, duplicateResults] = await Promise.all([
    supabaseClient
      .from('customer_profile')
      .select('id, company_name')
      .in('id', customerIds),
    supabaseClient.rpc('check_duplicate_orders_batch', {
      p_customer_ids: customerIds,
      p_delivery_date: targetDate,
      p_organization_id: organizationId,
    })
  ]);
  
  const customerMap = new Map(customersResult.data?.map((c: any) => [c.id, c]) || []);
  
  const duplicateCustomerIds = new Set(
    duplicateResults.data
      ?.filter((r: any) => r.has_duplicate)
      .map((r: any) => r.customer_id) || []
  );
  
  // Filter out duplicate customers
  const validTemplates = templates.filter(t => {
    if (duplicateCustomerIds.has(t.customer_id)) {
      console.log(`Duplicate order exists for customer ${t.customer_id} on ${targetDate}, skipping`);
      return false;
    }
    return true;
  });
  
  if (validTemplates.length === 0) {
    console.log('No valid templates to process (all duplicates)');
    return { date: targetDate, orders: [], errors: [] };
  }
  
  console.log(`Processing ${validTemplates.length} templates`);
  
  // Create orders one at a time using atomic function
  const createdOrders = [];
  const errors = [];
  const orderDate = new Date().toISOString().split('T')[0];
  
  for (let i = 0; i < validTemplates.length; i++) {
    const template = validTemplates[i];
    
    try {
      const lineItems = await getTemplateLineItems(
        template.id,
        targetDate,
        organizationId,
        supabaseClient
      );
      
      const isNoOrder = lineItems.length === 0;
      
      // Create sales order using atomic function (handles order number generation)
      const { data: newOrder, error: orderError } = await supabaseClient.rpc(
        'create_sales_order_atomic',
        {
          p_organization_id: organizationId,
          p_customer_id: template.customer_id,
          p_order_date: orderDate,
          p_delivery_date: targetDate,
          p_status: 'pending',
          p_is_no_order_today: isNoOrder,
          p_memo: `Auto-generated from template: ${template.name}`,
          p_created_from_template: true,
          p_template_id: template.id
        }
      );
      
      if (orderError || !newOrder) {
        console.error('Failed to create order:', orderError);
        errors.push({
          date: targetDate,
          customer_id: template.customer_id,
          error: orderError?.message || 'Failed to create order'
        });
        continue;
      }
      
      const orderId = newOrder.order_id;
      const orderNumber = newOrder.order_number;
      
      // Create line items if there are any
      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabaseClient
          .from('sales_order_line_item')
          .insert(
            lineItems.map(item => ({
              ...item,
              sales_order_id: orderId,
              organization_id: organizationId
            }))
          );
        
        if (lineItemsError) {
          console.error('Failed to create line items:', lineItemsError);
          // Delete the order since line items failed
          await supabaseClient.from('sales_order').delete().eq('id', orderId);
          errors.push({
            date: targetDate,
            customer_id: template.customer_id,
            error: 'Failed to create line items'
          });
          continue;
        }
      }
      
      console.log(`✅ Created order ${orderNumber} for customer ${template.customer_id}`);
      const customer = customerMap.get(template.customer_id);
      createdOrders.push({
        order_id: orderId,
        order_number: orderNumber,
        customer_id: newOrder.customer_id,
        customer_name: customer?.company_name || 'Unknown',
        delivery_date: targetDate,
      });
      
      console.log(`✅ Created order ${newOrder.order_number} for customer ${template.customer_id}`);
      
    } catch (error) {
      console.error('Error creating order for template:', template.id, error);
      errors.push({
        date: targetDate,
        customer_id: template.customer_id,
        error: error.message
      });
    }
  }
  
  console.log(`✅ Successfully created ${createdOrders.length} orders for ${targetDate}`);
  
  return { date: targetDate, orders: createdOrders, errors };
}

async function getTemplateLineItems(
  templateId: string,
  targetDate: string,
  organizationId: string,
  supabaseClient: any
) {
  const dayOfWeek = new Date(targetDate).getDay();
  const dayColumns = ['sunday_qty', 'monday_qty', 'tuesday_qty', 'wednesday_qty', 'thursday_qty', 'friday_qty', 'saturday_qty'];
  const dayColumn = dayColumns[dayOfWeek];
  
  const { data: templateItems, error: itemsError } = await supabaseClient
    .from('customer_template_items')
    .select(`item_id, unit_price, ${dayColumn}`)
    .eq('template_id', templateId)
    .eq('organization_id', organizationId);
  
  if (itemsError) {
    console.error('Error fetching template items:', itemsError);
    return [];
  }
  
  // Filter items with quantity > 0 for the target day
  const lineItems = (templateItems || [])
    .filter((item: any) => {
      const qty = item[dayColumn] || 0;
      return qty > 0;
    })
    .map((item: any) => ({
      item_id: item.item_id,
      quantity: item[dayColumn],
      unit_price: item.unit_price
    }));
  
  return lineItems;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Generate Daily Orders Function Started ===');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
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

    // Get organization
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

    // Parse request
    const { target_date, target_dates, customer_id, customer_ids }: GenerateOrdersRequest = await req.json().catch(() => ({}));

    const targetDates = target_dates 
      ? (Array.isArray(target_dates) ? target_dates : [target_dates])
      : (target_date ? [target_date] : [new Date().toISOString().split('T')[0]]);

    const customerIdsFilter = customer_ids 
      ? (Array.isArray(customer_ids) ? customer_ids : [customer_ids])
      : (customer_id ? [customer_id] : null);

    console.log('Target dates:', targetDates);
    console.log('Customer IDs filter:', customerIdsFilter);

    // Process all dates sequentially to avoid overwhelming the database
    const ordersCreated: any[] = [];
    const errors: any[] = [];

    for (const targetDate of targetDates) {
      const result = await processDateOrders(targetDate, organizationId, customerIdsFilter, supabaseClient);
      ordersCreated.push(...result.orders);
      errors.push(...result.errors);
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
        dates_processed: targetDates,
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
