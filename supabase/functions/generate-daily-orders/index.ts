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
  
  // Prepare all orders with line items in memory
  const ordersToCreate = await prepareOrdersBatch(
    validTemplates,
    targetDate,
    organizationId,
    customerMap,
    supabaseClient
  );
  
  if (ordersToCreate.length === 0) {
    return { date: targetDate, orders: [], errors: [] };
  }
  
  // Bulk create all orders in one database call
  console.log(`Creating ${ordersToCreate.length} orders in bulk`);
  const { data: bulkResult, error: bulkError } = await supabaseClient.rpc(
    'bulk_create_sales_orders_from_templates',
    { p_orders: ordersToCreate }
  );
  
  if (bulkError || !bulkResult?.success) {
    console.error('Bulk creation error:', bulkError || bulkResult?.error);
    return {
      date: targetDate,
      orders: [],
      errors: [{ date: targetDate, error: bulkError?.message || bulkResult?.error || 'Bulk creation failed' }]
    };
  }
  
  console.log(`✅ Successfully created ${bulkResult.orders_created} orders`);
  
  // Format response
  const orders = bulkResult.orders.map((order: any) => {
    const customer = customerMap.get(order.customer_id);
    return {
      order_id: order.order_id,
      order_number: order.order_number,
      customer_id: order.customer_id,
      customer_name: customer?.company_name || 'Unknown',
      delivery_date: targetDate,
    };
  });
  
  return { date: targetDate, orders, errors: [] };
}

async function prepareOrdersBatch(
  templates: any[],
  targetDate: string,
  organizationId: string,
  customerMap: Map<string, any>,
  supabaseClient: any
) {
  const dayOfWeek = new Date(targetDate).getDay();
  const dayColumns = ['sunday_qty', 'monday_qty', 'tuesday_qty', 'wednesday_qty', 'thursday_qty', 'friday_qty', 'saturday_qty'];
  const dayColumn = dayColumns[dayOfWeek];
  
  // Fetch all template items for all templates in one query
  const templateIds = templates.map(t => t.id);
  const { data: allTemplateItems, error: itemsError } = await supabaseClient
    .from('customer_template_items')
    .select(`template_id, item_id, unit_price, ${dayColumn}`)
    .in('template_id', templateIds)
    .eq('organization_id', organizationId);
  
  if (itemsError) {
    console.error('Error fetching template items:', itemsError);
    return [];
  }
  
  // Group items by template
  const itemsByTemplate = new Map();
  allTemplateItems?.forEach((item: any) => {
    if (!itemsByTemplate.has(item.template_id)) {
      itemsByTemplate.set(item.template_id, []);
    }
    const qty = item[dayColumn] || 0;
    if (qty > 0) {
      itemsByTemplate.get(item.template_id).push({
        item_id: item.item_id,
        quantity: qty,
        unit_price: item.unit_price
      });
    }
  });
  
  // Build orders array
  const ordersToCreate = [];
  const orderDate = new Date().toISOString().split('T')[0];
  
  for (const template of templates) {
    const lineItems = itemsByTemplate.get(template.id) || [];
    const isNoOrderToday = lineItems.length === 0;
    
    ordersToCreate.push({
      organization_id: organizationId,
      customer_id: template.customer_id,
      order_date: orderDate,
      delivery_date: targetDate,
      status: 'pending',
      is_no_order_today: isNoOrderToday,
      memo: `Auto-generated from template: ${template.name}`,
      line_items: lineItems
    });
  }
  
  return ordersToCreate;
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
