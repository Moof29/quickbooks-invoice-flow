import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertOrderRequest {
  order_id: string;
  action: 'invoice' | 'cancel';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id, action } = await req.json() as ConvertOrderRequest;

    if (!order_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: order_id and action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Converting order ${order_id} with action: ${action}`);

    // Fetch the order with line items and customer info
    const { data: order, error: orderError } = await supabase
      .from('sales_order')
      .select(`
        *,
        customer:customer_profile!customer_id(*)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order is still pending
    if (order.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Order is already ${order.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'invoice') {
      // Fetch line items (only non-zero quantities)
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('sales_order_line_item')
        .select('*, item:item!item_id(*)')
        .eq('sales_order_id', order_id)
        .gt('quantity', 0);

      if (lineItemsError) {
        console.error('Error fetching line items:', lineItemsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch order line items' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('get_next_invoice_number', { org_id: order.organization_id });

      if (invoiceNumberError) {
        console.error('Error generating invoice number:', invoiceNumberError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate invoice number' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoice_record')
        .insert({
          organization_id: order.organization_id,
          customer_id: order.customer_id,
          invoice_number: invoiceNumber,
          delivery_date: order.delivery_date,
          invoice_date: order.delivery_date,
          due_date: order.delivery_date,
          subtotal: order.subtotal,
          tax_total: order.tax_total,
          total: order.total,
          status: 'open',
          memo: order.memo,
          customer_po_number: order.customer_po_number,
          source_system: 'ERP',
        })
        .select()
        .single();

      if (invoiceError || !invoice) {
        console.error('Error creating invoice:', invoiceError);
        return new Response(
          JSON.stringify({ error: 'Failed to create invoice' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Invoice created:', invoice.id);

      // Create invoice line items
      if (lineItems && lineItems.length > 0) {
        const invoiceLineItems = lineItems.map((item, index) => ({
          organization_id: order.organization_id,
          invoice_id: invoice.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          line_number: index + 1,
        }));

        const { error: lineItemsInsertError } = await supabase
          .from('invoice_line_item')
          .insert(invoiceLineItems);

        if (lineItemsInsertError) {
          console.error('Error creating invoice line items:', lineItemsInsertError);
          return new Response(
            JSON.stringify({ error: 'Failed to create invoice line items' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update order status to 'invoiced' and link to invoice
      const { error: updateOrderError } = await supabase
        .from('sales_order')
        .update({
          status: 'invoiced',
          invoice_id: invoice.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', order_id);

      if (updateOrderError) {
        console.error('Error updating order status:', updateOrderError);
        return new Response(
          JSON.stringify({ error: 'Failed to update order status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Order converted to invoice successfully');

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'cancel') {
      // Create "No Order" invoice for record keeping
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('get_next_invoice_number', { org_id: order.organization_id });

      if (invoiceNumberError) {
        console.error('Error generating invoice number:', invoiceNumberError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate invoice number' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoice_record')
        .insert({
          organization_id: order.organization_id,
          customer_id: order.customer_id,
          invoice_number: invoiceNumber,
          delivery_date: order.delivery_date,
          invoice_date: order.delivery_date,
          due_date: order.delivery_date,
          subtotal: 0,
          tax_total: 0,
          total: 0,
          status: 'cancelled',
          memo: order.memo ? `${order.memo}\n\n[NO ORDER - Customer declined delivery]` : '[NO ORDER - Customer declined delivery]',
          source_system: 'ERP',
        })
        .select()
        .single();

      if (invoiceError || !invoice) {
        console.error('Error creating no-order invoice:', invoiceError);
        return new Response(
          JSON.stringify({ error: 'Failed to create no-order invoice' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order status to 'cancelled' and link to invoice
      const { error: updateOrderError } = await supabase
        .from('sales_order')
        .update({
          status: 'cancelled',
          invoice_id: invoice.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', order_id);

      if (updateOrderError) {
        console.error('Error updating order status:', updateOrderError);
        return new Response(
          JSON.stringify({ error: 'Failed to update order status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Order cancelled and no-order invoice created');

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          cancelled: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in convert-order-to-invoice function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

