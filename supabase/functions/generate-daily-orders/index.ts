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
  
  // Batch process templates in parallel (groups of 5)
  const createdOrders = [];
  const errors = [];
  const orderDate = new Date().toISOString().split('T')[0];
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < validTemplates.length; i += BATCH_SIZE) {
    const batch = validTemplates.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (template) => {
        const lineItems = await getTemplateLineItems(
          template.id,
          targetDate,
          organizationId,
          supabaseClient
        );
        
        const isNoOrder = lineItems.length === 0;
        
        // Generate invoice number
        const { data: invoiceNumber, error: invoiceNumberError } = await supabaseClient
          .rpc('get_next_invoice_number', { p_organization_id: organizationId });

        if (invoiceNumberError || !invoiceNumber) {
          throw new Error('Failed to generate invoice number');
        }

        // Create invoice with pending status
        const { data: newInvoiceId, error: invoiceError } = await supabaseClient.rpc(
          'create_invoice_atomic',
          {
            p_organization_id: organizationId,
            p_customer_id: template.customer_id,
            p_invoice_number: invoiceNumber,
            p_status: 'pending',
            p_order_date: orderDate,
            p_delivery_date: targetDate,
            p_memo: `Auto-generated from template: ${template.name}`,
            p_is_no_order: isNoOrder,
            p_created_from_template: true,
            p_template_id: template.id
          }
        );
        
        if (invoiceError || !newInvoiceId) {
          throw new Error(invoiceError?.message || 'Failed to create invoice');
        }
        
        const invoiceId = newInvoiceId;
        
        // Create line items if there are any
        if (lineItems.length > 0) {
          const { error: lineItemsError } = await supabaseClient
            .from('invoice_line_item')
            .insert(
              lineItems.map(item => ({
                ...item,
                invoice_id: invoiceId,
                organization_id: organizationId
              }))
            );
          
          if (lineItemsError) {
            // Rollback: delete the invoice
            await supabaseClient.from('invoice_record').delete().eq('id', invoiceId);
            throw new Error('Failed to create line items');
          }
        }
        
        console.log(`✅ Created pending invoice ${invoiceNumber} for customer ${template.customer_id}`);
        const customer = customerMap.get(template.customer_id);
        return {
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          customer_id: template.customer_id,
          customer_name: customer?.company_name || 'Unknown',
          delivery_date: targetDate,
        };
      })
    );
    
    // Process batch results
    batchResults.forEach((result, index) => {
      const template = batch[index];
      if (result.status === 'fulfilled') {
        createdOrders.push(result.value);
      } else {
        console.error('Error creating order for template:', template.id, result.reason);
        errors.push({
          date: targetDate,
          customer_id: template.customer_id,
          error: result.reason.message
        });
      }
    });
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

    // Add limit check to prevent timeouts
    if (targetDates.length > 14) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many dates selected. Please select 14 or fewer dates to avoid timeouts.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process dates in parallel (in groups of 3)
    const ordersCreated: any[] = [];
    const errors: any[] = [];
    const DATE_BATCH_SIZE = 3;

    for (let i = 0; i < targetDates.length; i += DATE_BATCH_SIZE) {
      const dateBatch = targetDates.slice(i, i + DATE_BATCH_SIZE);
      
      const results = await Promise.all(
        dateBatch.map(targetDate => 
          processDateOrders(targetDate, organizationId, customerIdsFilter, supabaseClient)
        )
      );
      
      results.forEach(result => {
        ordersCreated.push(...result.orders);
        errors.push(...result.errors);
      });
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
