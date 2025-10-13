import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateInvoiceRequest {
  order_id: string;
  user_id?: string; // Optional: for batch jobs with user context
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Create Invoice from Order Function Started ===');

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

    // Parse request body
    const { order_id, user_id }: CreateInvoiceRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order ID:', order_id);
    
    // Use provided user_id or fall back to authenticated user
    const createdBy = user_id || user.id;
    console.log('Created by user:', createdBy);

    // Validate order can be invoiced
    const { data: validationResult } = await supabaseClient.rpc('validate_order_before_invoice', {
      p_order_id: order_id,
    });

    console.log('Validation result:', validationResult);

    if (!validationResult?.can_invoice) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validationResult?.error_message || 'Order cannot be invoiced',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('sales_order')
      .select(`
        *,
        customer_profile!inner(id, company_name, email)
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

    console.log('Order fetched:', order.order_number);

    // Get line items
    const { data: lineItems, error: lineItemsError } = await supabaseClient
      .from('sales_order_line_item')
      .select(`
        *,
        item_record!inner(id, name, sku)
      `)
      .eq('sales_order_id', order_id)
      .eq('organization_id', order.organization_id);

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch order line items' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${lineItems?.length || 0} line items`);

    // Create invoice record
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoice_record')
      .insert({
        organization_id: order.organization_id,
        customer_id: order.customer_id,
        invoice_number: invoiceNumber,
        invoice_date: order.delivery_date, // Invoice date = delivery date
        due_date: order.delivery_date, // Could add payment terms here
        subtotal: order.subtotal,
        tax_total: order.tax_total || 0,
        total: order.total,
        status: 'draft', // Valid status: draft, sent, paid, partial, void, overdue
        source_system: 'ERP',
        memo: `Generated from Sales Order ${order.order_number}`,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invoice' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invoice created:', invoice.id, invoiceNumber);

    // Create invoice line items
    let invoiceLineItems;
    
    if (order.is_no_order_today) {
      // For "No Order Today" orders, create a special line item
      console.log('Creating "No Order Today" invoice line item');
      invoiceLineItems = [{
        organization_id: order.organization_id,
        invoice_id: invoice.id,
        item_id: null, // No actual item
        description: 'No Order Today - Customer Confirmed',
        quantity: 0,
        unit_price: 0,
        // amount and tax_amount are GENERATED columns - don't include them
        tax_rate: 0,
      }];
    } else {
      // Normal orders: create line items from sales order line items
      // NOTE: amount and tax_amount are GENERATED columns - database calculates them
      invoiceLineItems = lineItems?.map((item: any) => ({
        organization_id: order.organization_id,
        invoice_id: invoice.id,
        item_id: item.item_id,
        description: item.item_record?.name || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        // amount is auto-calculated by database
        tax_rate: item.tax_rate || 0,
        // tax_amount is auto-calculated by database
      })) || [];
    }

    console.log('Invoice line items to insert:', JSON.stringify(invoiceLineItems, null, 2));

    if (invoiceLineItems.length > 0) {
      const { error: invoiceLineError } = await supabaseClient
        .from('invoice_line_item')
        .insert(invoiceLineItems);

      if (invoiceLineError) {
        console.error('Error creating invoice line items:', invoiceLineError);
        console.error('Error details:', JSON.stringify(invoiceLineError, null, 2));
        // Rollback: delete the invoice
        await supabaseClient.from('invoice_record').delete().eq('id', invoice.id);
        return new Response(
          JSON.stringify({ error: 'Failed to create invoice line items', details: invoiceLineError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Created ${invoiceLineItems.length} invoice line items`);
    }

    // Create sales_order_invoice_link
    const { error: linkError } = await supabaseClient
      .from('sales_order_invoice_link')
      .insert({
        organization_id: order.organization_id,
        sales_order_id: order_id,
        invoice_id: invoice.id,
        created_by: createdBy,
      });

    if (linkError) {
      console.error('Error creating order-invoice link:', linkError);
      // Don't rollback, just log - the link is not critical
    }

    // Update sales order status to 'invoiced' and set invoiced flag
    const { error: updateError } = await supabaseClient
      .from('sales_order')
      .update({
        status: 'invoiced',
        invoiced: true,
        invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      // Don't rollback invoice creation - just log the error
    }

    console.log('=== Invoice Creation Complete ===');

    return new Response(
      JSON.stringify({
        success: true,
        invoice: {
          id: invoice.id,
          invoice_number: invoiceNumber,
          total: invoice.total,
          customer_name: (order.customer_profile as any)?.company_name,
          delivery_date: order.delivery_date,
        },
        order: {
          id: order.id,
          order_number: order.order_number,
        },
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
