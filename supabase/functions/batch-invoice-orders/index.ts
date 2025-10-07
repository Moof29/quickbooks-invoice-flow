import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchInvoiceRequest {
  order_ids: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Batch Invoice Orders Function Started ===');

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
    const { order_ids }: BatchInvoiceRequest = await req.json();

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'order_ids array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${order_ids.length} orders`);

    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    // Process each order sequentially
    for (const orderId of order_ids) {
      try {
        console.log(`\n--- Processing order: ${orderId} ---`);

        // Call the create-invoice-from-order function
        const { data: invoiceResult, error: invoiceError } = await supabaseClient.functions.invoke(
          'create-invoice-from-order',
          {
            body: { order_id: orderId },
          }
        );

        if (invoiceError) {
          console.error(`Error invoicing order ${orderId}:`, invoiceError);
          results.failed.push({
            order_id: orderId,
            error: invoiceError.message || 'Unknown error',
          });
          continue;
        }

        if (!invoiceResult?.success) {
          console.error(`Invoice creation failed for order ${orderId}:`, invoiceResult?.error);
          results.failed.push({
            order_id: orderId,
            error: invoiceResult?.error || 'Invoice creation failed',
          });
          continue;
        }

        console.log(`Successfully invoiced order ${orderId}`);
        results.successful.push({
          order_id: orderId,
          order_number: invoiceResult.order?.order_number,
          invoice_id: invoiceResult.invoice?.id,
          invoice_number: invoiceResult.invoice?.invoice_number,
          total: invoiceResult.invoice?.total,
        });
      } catch (error) {
        console.error(`Unexpected error processing order ${orderId}:`, error);
        results.failed.push({
          order_id: orderId,
          error: error.message,
        });
      }
    }

    console.log('\n=== Batch Invoice Complete ===');
    console.log(`Successful: ${results.successful.length}`);
    console.log(`Failed: ${results.failed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: order_ids.length,
        successful_count: results.successful.length,
        failed_count: results.failed.length,
        results: results,
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
