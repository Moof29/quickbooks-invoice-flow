import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

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

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const organizationId = profile.organization_id;

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

      const itemIds = itemsToDelete.map(item => item.id);
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${totalDeleted} items`,
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
      JSON.stringify({ error: error.message }),
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
