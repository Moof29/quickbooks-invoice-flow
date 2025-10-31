import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertOrderRequest {
  invoice_id: string;
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

    // Parse request body
    const { invoice_id, action } = await req.json() as ConvertOrderRequest;

    if (!invoice_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: invoice_id and action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Converting invoice ${invoice_id} with action: ${action}`);

    // Fetch the invoice from invoice_record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoice_record')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invoice is still pending
    if (invoice.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Invoice is already ${invoice.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pending invoice found:', invoice.invoice_number);

    // Handle invoice action - simple status update
    if (action === 'invoice') {
      // Simply update the status (no need to copy data to new record)
      const { error: updateError } = await supabase
        .from('invoice_record')
        .update({
          status: 'invoiced',
          invoice_date: invoice.delivery_date,
          due_date: invoice.delivery_date,  // Or calculate due date
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          updated_by: user.id,  // Required for audit trigger
        })
        .eq('id', invoice_id)
        .eq('status', 'pending');  // Safety check

      if (updateError) {
        console.error('Error converting to invoice:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to convert to invoice' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Invoice conversion complete');

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: invoice_id,
          invoice_number: invoice.invoice_number,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    // Handle cancel action - call RPC
    } else if (action === 'cancel') {
      // Use the cancel RPC function
      const { error: cancelError } = await supabase.rpc('cancel_invoice_order', {
        p_invoice_id: invoice_id,
        p_cancelled_by: user.id
      });

      if (cancelError) {
        console.error('Error cancelling invoice:', cancelError);
        return new Response(
          JSON.stringify({ error: 'Failed to cancel invoice' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Invoice cancelled and no-order invoice created');

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: invoice_id,
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
