import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DisconnectRequest {
  organizationId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { organizationId } = await req.json() as DisconnectRequest;

    console.log('=== QuickBooks Disconnect Request ===');
    console.log('Organization ID:', organizationId);

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark the connection as inactive
    const { data: connection, error: updateError } = await supabase
      .from('qbo_connection')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating connection:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to disconnect: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Connection deactivated:', connection);

    // Log the disconnect event
    await supabase
      .from('audit_events')
      .insert({
        organization_id: organizationId,
        event_type: 'qbo_disconnected',
        entity_type: 'qbo_connection',
        entity_id: connection.id,
        severity: 'info',
        detail: {
          disconnected_at: new Date().toISOString(),
          company_id: connection.qbo_company_id,
        },
      });

    console.log('=== Disconnect Completed Successfully ===');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Successfully disconnected from QuickBooks Online' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in qbo-disconnect:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
