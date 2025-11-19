import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.5/+esm';

/**
 * PRODUCTION SAFEGUARD: Clear Items
 * 
 * Deletes all items for an organization.
 * 
 * Security Requirements:
 * 1. User must be authenticated
 * 2. User must have admin role
 * 3. Must provide confirmation parameter
 * 4. Environment check (warning for production)
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Get user's profile and organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Check admin role
    if (profile.role !== 'admin') {
      console.warn(`Non-admin user ${user.id} attempted to clear items`);
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Check confirmation parameter
    const url = new URL(req.url);
    const confirmed = url.searchParams.get('confirm') === 'DELETE_ITEMS';
    
    if (!confirmed) {
      return new Response(
        JSON.stringify({ 
          error: 'Confirmation required',
          message: 'Add ?confirm=DELETE_ITEMS to the request to proceed'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Environment warning
    const environment = Deno.env.get('ENVIRONMENT') || 'development';
    if (environment === 'production') {
      console.warn(`⚠️ PRODUCTION ITEM DELETION - Organization: ${profile.organization_id}, User: ${user.email}`);
    }

    const organizationId = profile.organization_id;
    console.log(`🗑️ Clearing items for organization: ${organizationId}`);
    console.log(`Environment: ${environment}`);
    console.log(`Initiated by: ${user.email}`);

    // Delete all items for this organization in batches
    let totalDeleted = 0;
    const batchSize = 500;

    while (true) {
      const { data: itemsToDelete, error: fetchError } = await supabase
        .from('item_record')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(batchSize);

      if (fetchError) {
        throw fetchError;
      }

      if (!itemsToDelete || itemsToDelete.length === 0) {
        break;
      }

      const itemIds = itemsToDelete.map((item: any) => item.id);
      const { error: deleteError } = await supabase
        .from('item_record')
        .delete()
        .in('id', itemIds);

      if (deleteError) {
        throw deleteError;
      }

      totalDeleted += itemsToDelete.length;
      console.log(`Deleted ${itemsToDelete.length} items, total: ${totalDeleted}`);
    }

    console.log(`✅ Successfully deleted ${totalDeleted} items`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${totalDeleted} items`,
        environment,
        deleted_count: totalDeleted,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error clearing items:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
