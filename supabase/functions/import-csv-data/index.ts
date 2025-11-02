import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportStats {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) throw new Error('No organization found');

    const { csvData, dataType } = await req.json();
    console.log(`Starting import for ${dataType}, ${csvData.length} rows`);

    const stats: ImportStats = { total: csvData.length, successful: 0, failed: 0, errors: [] };

    if (dataType === 'items') {
      await importItems(supabaseClient, profile.organization_id, csvData, stats);
    } else if (dataType === 'customers') {
      await importCustomers(supabaseClient, profile.organization_id, csvData, stats);
    } else if (dataType === 'invoices') {
      await importInvoices(supabaseClient, profile.organization_id, csvData, stats);
    } else {
      throw new Error(`Unknown data type: ${dataType}`);
    }

    console.log(`Import complete: ${stats.successful} successful, ${stats.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function importItems(supabase: any, orgId: string, rows: any[], stats: ImportStats) {
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const items = batch
      .filter(row => row.type !== 'Category') // Skip Category type items
      .map(row => ({
        organization_id: orgId,
        qbo_id: row.id?.toString(),
        name: row.name || 'Unnamed Item',
        sku: (row.sku && row.sku !== 'null') ? row.sku : null,
        description: (row.description && row.description !== 'null') ? row.description : null,
        purchase_cost: parseFloat(row.unit_price || row.purchase_cost) || 0,
        is_active: row.active === 'true' || row.active === true,
        item_type: row.type || 'NonInventory',
        qbo_sync_status: 'synced',
        source_system: 'QBO',
      }));

    if (items.length === 0) {
      // All items in batch were categories, skip
      stats.successful += batch.filter(row => row.type === 'Category').length;
      continue;
    }

    // Upsert will UPDATE existing records (matching on organization_id,qbo_id) or INSERT new ones
    const { data, error } = await supabase
      .from('item_record')
      .upsert(items, { 
        onConflict: 'organization_id,qbo_id',
        ignoreDuplicates: false  // This ensures duplicates are UPDATED, not ignored
      });

    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed, retrying individually:`, error.message);
      // Try each item individually when batch fails
      for (let j = 0; j < items.length; j++) {
        const { error: itemError } = await supabase
          .from('item_record')
          .upsert([items[j]], { 
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false 
          });
        
        if (itemError) {
          stats.failed++;
          stats.errors.push({ row: i + j, error: `${batch[j].name}: ${itemError.message}` });
        } else {
          stats.successful++;
        }
      }
    } else {
      stats.successful += items.length;
      // Count skipped categories as successful
      const skippedCategories = batch.length - items.length;
      if (skippedCategories > 0) {
        stats.successful += skippedCategories;
      }
    }
  }
}

async function importCustomers(supabase: any, orgId: string, rows: any[], stats: ImportStats) {
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const customers = batch.map(row => ({
      organization_id: orgId,
      qbo_id: row.id?.toString(),
      display_name: row.display_name || row.company_name || 'Unnamed Customer',
      company_name: row.company_name || null,
      email: row.email || null,
      phone: null, // Not in CSV
      billing_address_line1: row.bill_addr_line1 || null,
      billing_address_line2: row.bill_addr_line2 || null,
      billing_city: row.bill_addr_city || null,
      billing_state: row.bill_addr_state || null,
      billing_postal_code: row.bill_addr_postal_code || null,
      shipping_address_line1: row.ship_addr_line1 || null,
      shipping_address_line2: row.ship_addr_line2 || null,
      shipping_city: row.ship_addr_city || null,
      shipping_state: row.ship_addr_state || null,
      shipping_postal_code: row.ship_addr_postal_code || null,
      notes: row.notes || null,
      is_active: row.active === 'true' || row.active === true,
      balance: row.balance ? parseFloat(row.balance) : 0,
      qbo_sync_status: 'synced',
      source_system: 'QBO',
      portal_enabled: false,
    }));

    const { data, error } = await supabase
      .from('customer_profile')
      .upsert(customers, { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false });

    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error);
      stats.failed += batch.length;
      stats.errors.push({ row: i, error: error.message });
    } else {
      stats.successful += batch.length;
    }
  }
}

async function importInvoices(supabase: any, orgId: string, rows: any[], stats: ImportStats) {
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
      try {
        // Find customer by QBO ID
        const { data: customer } = await supabase
          .from('customer_profile')
          .select('id')
          .eq('organization_id', orgId)
          .eq('qbo_id', row.customer_ref_value?.toString())
          .single();

        if (!customer) {
          stats.failed++;
          stats.errors.push({ row: i, error: `Customer not found: ${row.customer_ref_value}` });
          continue;
        }

        // Create invoice
        const invoice = {
          organization_id: orgId,
          qbo_id: row.id?.toString(),
          invoice_number: row.doc_number || `INV-${row.id}`,
          invoice_date: row.txn_date ? new Date(row.txn_date).toISOString() : new Date().toISOString(),
          due_date: row.due_date ? new Date(row.due_date).toISOString() : null,
          customer_id: customer.id,
          subtotal: parseFloat(row.total_amt) || 0,
          tax_total: 0,
          total: parseFloat(row.total_amt) || 0,
          amount_paid: parseFloat(row.balance) ? parseFloat(row.total_amt) - parseFloat(row.balance) : 0,
          amount_due: parseFloat(row.balance) || 0,
          status: row.balance === '0' || row.balance === 0 ? 'paid' : 'invoiced',
          qbo_sync_status: 'synced',
          source_system: 'QBO',
          memo: row.customer_memo || null,
        };

        const { error } = await supabase
          .from('invoice_record')
          .upsert(invoice, { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false });

        if (error) {
          stats.failed++;
          stats.errors.push({ row: i, error: error.message });
        } else {
          stats.successful++;
        }
      } catch (err: any) {
        stats.failed++;
        stats.errors.push({ row: i, error: err.message });
      }
    }
  }
}
