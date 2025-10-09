import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOrdersRequest {
  target_date?: string; // Single date (backwards compatibility)
  target_dates?: string[]; // Array of dates
  customer_id?: string; // Single customer (backwards compatibility)
  customer_ids?: string[]; // Array of customer IDs
}

async function processDateOrders(
  targetDate: string,
  organizationId: string,
  customerIdsFilter: string[] | null,
  supabaseClient: any
) {
  console.log(`\n=== Processing date: ${targetDate} ===`);
  
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
  
  const customerIds = templates?.map((t) => t.customer_id) || [];
  const { data: customers } = await supabaseClient
    .from('customer_profile')
    .select('id, company_name')
    .in('id', customerIds);
  
  const customerMap = new Map(customers?.map((c) => [c.id, c]) || []);
  
  const { data: duplicateResults } = await supabaseClient.rpc('check_duplicate_orders_batch', {
    p_customer_ids: templates.map(t => t.customer_id),
    p_delivery_date: targetDate,
    p_organization_id: organizationId,
  });

  const duplicateCustomerIds = new Set(
    duplicateResults
      ?.filter((r: any) => r.has_duplicate)
      .map((r: any) => r.customer_id) || []
  );

  const validTemplates = templates.filter(t => {
    if (duplicateCustomerIds.has(t.customer_id)) {
      console.log(`Duplicate order exists for customer ${t.customer_id} on ${targetDate}, skipping`);
      return false;
    }
    return true;
  });
  
  const templateResults = await Promise.allSettled(
    validTemplates.map(template => 
      createOrderFromTemplate(template, targetDate, organizationId, customerMap, supabaseClient)
    )
  );
  
  const orders = templateResults
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<any>).value);
  
  const errors = templateResults
    .filter(r => r.status === 'rejected')
    .map(r => ({
      date: targetDate,
      error: (r as PromiseRejectedResult).reason?.message || 'Unknown error'
    }));
  
  return { date: targetDate, orders, errors };
}

async function createOrderFromTemplate(
  template: any,
  targetDate: string,
  organizationId: string,
  customerMap: Map<string, any>,
  supabaseClient: any
) {
  try {
    console.log(`Processing template ${template.id} for customer ${template.customer_id} on ${targetDate}`);

    const dayOfWeek = new Date(targetDate).getDay();
    const dayColumns = ['sunday_qty', 'monday_qty', 'tuesday_qty', 'wednesday_qty', 'thursday_qty', 'friday_qty', 'saturday_qty'];
    const dayColumn = dayColumns[dayOfWeek];

    const { data: templateItems, error: itemsError } = await supabaseClient
      .from('customer_template_items')
      .select(`id, item_id, unit_price, ${dayColumn}`)
      .eq('template_id', template.id)
      .eq('organization_id', organizationId);

    if (itemsError) {
      throw new Error(`Failed to fetch template items: ${itemsError.message}`);
    }

    const itemsWithQuantity = templateItems?.filter((item: any) => {
      const qty = item[dayColumn] || 0;
      return qty > 0;
    }) || [];

    const isNoOrderToday = itemsWithQuantity.length === 0;

    // Retry logic for order number conflicts
    let newOrder = null;
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
      const { data, error: orderError } = await supabaseClient
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

      if (!orderError) {
        newOrder = data;
        break;
      }

      // Retry on unique constraint violations
      if (orderError.code === '23505' && retryCount < maxRetries - 1) {
        retryCount++;
        console.log(`Retry ${retryCount} for template ${template.id} due to order number conflict`);
        await new Promise(resolve => setTimeout(resolve, 50 * retryCount)); // Exponential backoff
        continue;
      }

      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    if (!newOrder) {
      throw new Error('Failed to create order after retries');
    }

    console.log(`Order created: ${newOrder.id}`);

    let calculatedTotal = 0;
    if (itemsWithQuantity.length > 0) {
      const lineItems = itemsWithQuantity.map((item: any) => ({
        organization_id: organizationId,
        sales_order_id: newOrder.id,
        item_id: item.item_id,
        quantity: item[dayColumn],
        unit_price: item.unit_price,
      }));

      const { data: createdItems, error: lineItemsError } = await supabaseClient
        .from('sales_order_line_item')
        .insert(lineItems)
        .select('amount');

      if (lineItemsError) {
        throw new Error(`Failed to create line items: ${lineItemsError.message}`);
      }

      calculatedTotal = createdItems?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0;
      
      console.log(`Created ${lineItems.length} line items, total: ${calculatedTotal}`);
    }

    const customer = customerMap.get(template.customer_id);
    return {
      order_id: newOrder.id,
      order_number: newOrder.order_number,
      customer_id: template.customer_id,
      customer_name: customer?.company_name || 'Unknown',
      delivery_date: targetDate,
      total: calculatedTotal,
      is_no_order_today: isNoOrderToday,
      line_items_count: itemsWithQuantity.length,
    };
  } catch (error: any) {
    console.error(`Error processing template ${template.id}:`, error);
    throw error;
  }
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

    // Parse request body - NOW ACCEPTS ARRAYS
    const { target_date, target_dates, customer_id, customer_ids }: GenerateOrdersRequest = await req.json().catch(() => ({}));

    // Convert to arrays for backwards compatibility
    const targetDates = target_dates 
      ? (Array.isArray(target_dates) ? target_dates : [target_dates])
      : (target_date ? [target_date] : [new Date().toISOString().split('T')[0]]);

    const customerIdsFilter = customer_ids 
      ? (Array.isArray(customer_ids) ? customer_ids : [customer_ids])
      : (customer_id ? [customer_id] : null);

    console.log('Target dates:', targetDates);
    console.log('Customer IDs filter:', customerIdsFilter);

    const dateResults = await Promise.allSettled(
      targetDates.map(targetDate => 
        processDateOrders(targetDate, organizationId, customerIdsFilter, supabaseClient)
      )
    );

    const ordersCreated: any[] = [];
    const errors: any[] = [];

    dateResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        ordersCreated.push(...result.value.orders);
        errors.push(...result.value.errors);
      } else {
        errors.push({
          error: `Failed to process date: ${result.reason?.message || 'Unknown error'}`
        });
      }
    });

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
