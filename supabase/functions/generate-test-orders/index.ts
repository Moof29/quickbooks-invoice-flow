import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.5/+esm';

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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('No organization found');
    }

    const organizationId = profile.organization_id;

    console.log('Generating test orders for organization:', organizationId);

    // Fetch customers
    const { data: customers, error: customersError } = await supabaseClient
      .from('customer_profile')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(10);

    if (customersError) throw customersError;
    if (!customers || customers.length === 0) {
      throw new Error('No customers found. Please add customers first.');
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabaseClient
      .from('item_record')
      .select('id, unit_price')
      .eq('organization_id', organizationId)
      .limit(20);

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      throw new Error('No items found. Please add items first.');
    }

    const statuses = ['pending', 'pending', 'pending', 'invoiced', 'invoiced'];
    let ordersCreated = 0;
    let lineItemsCreated = 0;

    // Create 20 test orders
    for (let i = 0; i < 20; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const daysOffset = Math.floor(Math.random() * 30) - 15; // -15 to +15 days
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() + daysOffset);
      
      const deliveryDate = new Date(orderDate);
      deliveryDate.setDate(deliveryDate.getDate() + 1);

      // Generate invoice number
      const year = new Date().getFullYear();
      const { data: maxInvoice } = await supabaseClient
        .from('invoice_record')
        .select('invoice_number')
        .eq('organization_id', organizationId)
        .like('invoice_number', `INV-${year}-%`)
        .order('invoice_number', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (maxInvoice && maxInvoice.length > 0) {
        const match = maxInvoice[0].invoice_number.match(/INV-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(6, '0')}`;

      // Create order
      const { data: order, error: orderError } = await supabaseClient
        .from('invoice_record')
        .insert({
          organization_id: organizationId,
          customer_id: customer.id,
          invoice_number: invoiceNumber,
          order_date: orderDate.toISOString(),
          delivery_date: deliveryDate.toISOString(),
          status: status,
          subtotal: 0,
          tax_total: 0,
          total: 0,
          amount_paid: 0,
          amount_due: 0,
          memo: `Test order ${i + 1}`,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        continue;
      }

      ordersCreated++;

      // Add 3-8 random line items
      const numItems = Math.floor(Math.random() * 6) + 3;
      for (let j = 0; j < numItems; j++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const quantity = Math.floor(Math.random() * 20) + 1;

        const { error: lineItemError } = await supabaseClient
          .from('invoice_line_item')
          .insert({
            organization_id: organizationId,
            invoice_id: order.id,
            item_id: item.id,
            quantity: quantity,
            unit_price: item.unit_price,
          });

        if (!lineItemError) {
          lineItemsCreated++;
        }
      }
    }

    console.log(`✅ Created ${ordersCreated} test orders with ${lineItemsCreated} line items`);

    return new Response(
      JSON.stringify({
        success: true,
        orders: ordersCreated,
        lineItems: lineItemsCreated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error generating test orders:', error);
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
