import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportProgress {
  progressId: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
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

    const { filePath, dataType, progressId } = await req.json();
    console.log(`Starting import for ${dataType} from storage: ${filePath}`);

    // Update progress to processing
    await supabaseClient
      .from('csv_import_progress')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', progressId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('csv-imports')
      .download(filePath);

    if (downloadError) throw new Error(`Failed to download file: ${downloadError.message}`);

    // Read file content
    const text = await fileData.text();
    const rows = parseCSV(text);

    console.log(`Parsed ${rows.length} rows from CSV`);

    // Update total rows
    await supabaseClient
      .from('csv_import_progress')
      .update({ total_rows: rows.length })
      .eq('id', progressId);

    const progress: ImportProgress = {
      progressId,
      totalRows: rows.length,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
    };

    // Start background processing
    EdgeRuntime.waitUntil(
      processImport(supabaseClient, profile.organization_id, rows, dataType, progress)
    );

    return new Response(
      JSON.stringify({
        success: true,
        progressId,
        message: 'Import started in background',
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

async function processImport(
  supabase: any,
  orgId: string,
  rows: any[],
  dataType: string,
  progress: ImportProgress
) {
  try {
    if (dataType === 'items') {
      await importItems(supabase, orgId, rows, progress);
    } else if (dataType === 'customers') {
      await importCustomers(supabase, orgId, rows, progress);
    } else if (dataType === 'invoices') {
      await importInvoices(supabase, orgId, rows, progress);
    }

    // Mark as completed
    await supabase
      .from('csv_import_progress')
      .update({
        status: 'completed',
        processed_rows: progress.processedRows,
        successful_rows: progress.successfulRows,
        failed_rows: progress.failedRows,
        errors: progress.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', progress.progressId);

    console.log(`Import completed: ${progress.successfulRows} successful, ${progress.failedRows} failed`);
  } catch (error: any) {
    console.error('Import processing error:', error);
    await supabase
      .from('csv_import_progress')
      .update({
        status: 'failed',
        errors: [{ row: -1, error: error.message }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', progress.progressId);
  }
}

async function importItems(supabase: any, orgId: string, rows: any[], progress: ImportProgress) {
  const BATCH_SIZE = 100;
  const UPDATE_INTERVAL = 50; // Update progress every 50 rows

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const items = batch
      .filter(row => row.type !== 'Category')
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
      progress.successfulRows += batch.filter(row => row.type === 'Category').length;
      progress.processedRows += batch.length;
      continue;
    }

    const { error } = await supabase
      .from('item_record')
      .upsert(items, {
        onConflict: 'organization_id,qbo_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed, retrying individually:`, error.message);
      for (let j = 0; j < items.length; j++) {
        const { error: itemError } = await supabase
          .from('item_record')
          .upsert([items[j]], {
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false,
          });

        if (itemError) {
          progress.failedRows++;
          progress.errors.push({ row: i + j, error: `${batch[j].name}: ${itemError.message}` });
        } else {
          progress.successfulRows++;
        }
        progress.processedRows++;
      }
    } else {
      progress.successfulRows += items.length;
      const skippedCategories = batch.length - items.length;
      if (skippedCategories > 0) {
        progress.successfulRows += skippedCategories;
      }
      progress.processedRows += batch.length;
    }

    // Update progress periodically
    if (progress.processedRows % UPDATE_INTERVAL === 0) {
      await supabase
        .from('csv_import_progress')
        .update({
          processed_rows: progress.processedRows,
          successful_rows: progress.successfulRows,
          failed_rows: progress.failedRows,
          errors: progress.errors.slice(-100), // Keep last 100 errors
        })
        .eq('id', progress.progressId);
    }
  }
}

async function importCustomers(supabase: any, orgId: string, rows: any[], progress: ImportProgress) {
  const BATCH_SIZE = 50;
  const UPDATE_INTERVAL = 25;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const customers = batch.map(row => {
      const displayName = row.display_name || row.company_name || 'Unnamed Customer';
      return {
        organization_id: orgId,
        qbo_id: row.id?.toString(),
        display_name: displayName.length > 50 ? displayName.substring(0, 50) : displayName,
        company_name: (row.company_name && row.company_name !== 'null') ? row.company_name : null,
        email: (row.email && row.email !== 'null') ? row.email : null,
        phone: null,
        billing_address_line1: (row.bill_addr_line1 && row.bill_addr_line1 !== 'null') ? row.bill_addr_line1 : null,
        billing_address_line2: (row.bill_addr_line2 && row.bill_addr_line2 !== 'null') ? row.bill_addr_line2 : null,
        billing_city: (row.bill_addr_city && row.bill_addr_city !== 'null') ? row.bill_addr_city : null,
        billing_state: (row.bill_addr_state && row.bill_addr_state !== 'null') ? row.bill_addr_state : null,
        billing_postal_code: (row.bill_addr_postal_code && row.bill_addr_postal_code !== 'null') ? row.bill_addr_postal_code : null,
        shipping_address_line1: (row.ship_addr_line1 && row.ship_addr_line1 !== 'null') ? row.ship_addr_line1 : null,
        shipping_address_line2: (row.ship_addr_line2 && row.ship_addr_line2 !== 'null') ? row.ship_addr_line2 : null,
        shipping_city: (row.ship_addr_city && row.ship_addr_city !== 'null') ? row.ship_addr_city : null,
        shipping_state: (row.ship_addr_state && row.ship_addr_state !== 'null') ? row.ship_addr_state : null,
        shipping_postal_code: (row.ship_addr_postal_code && row.ship_addr_postal_code !== 'null') ? row.ship_addr_postal_code : null,
        notes: (row.notes && row.notes !== 'null') ? row.notes : null,
        is_active: row.active === 'true' || row.active === true,
        balance: row.balance ? parseFloat(row.balance) : 0,
        qbo_sync_status: 'synced',
        source_system: 'QBO',
        portal_enabled: false,
      };
    });

    const { error } = await supabase
      .from('customer_profile')
      .upsert(customers, { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false });

    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed, retrying individually:`, error.message);
      for (let j = 0; j < customers.length; j++) {
        const { error: customerError } = await supabase
          .from('customer_profile')
          .upsert([customers[j]], {
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false,
          });

        if (customerError) {
          progress.failedRows++;
          progress.errors.push({ row: i + j, error: `${batch[j].display_name}: ${customerError.message}` });
        } else {
          progress.successfulRows++;
        }
        progress.processedRows++;
      }
    } else {
      progress.successfulRows += batch.length;
      progress.processedRows += batch.length;
    }

    if (progress.processedRows % UPDATE_INTERVAL === 0) {
      await supabase
        .from('csv_import_progress')
        .update({
          processed_rows: progress.processedRows,
          successful_rows: progress.successfulRows,
          failed_rows: progress.failedRows,
          errors: progress.errors.slice(-100),
        })
        .eq('id', progress.progressId);
    }
  }
}

async function importInvoices(supabase: any, orgId: string, rows: any[], progress: ImportProgress) {
  const BATCH_SIZE = 50;
  const UPDATE_INTERVAL = 25;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const { data: customer } = await supabase
          .from('customer_profile')
          .select('id')
          .eq('organization_id', orgId)
          .eq('qbo_id', row.customer_ref_value?.toString())
          .single();

        if (!customer) {
          progress.failedRows++;
          progress.errors.push({ row: i, error: `Customer not found: ${row.customer_ref_value}` });
          progress.processedRows++;
          continue;
        }

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
          progress.failedRows++;
          progress.errors.push({ row: i, error: error.message });
        } else {
          progress.successfulRows++;
        }
        progress.processedRows++;
      } catch (err: any) {
        progress.failedRows++;
        progress.errors.push({ row: i, error: err.message });
        progress.processedRows++;
      }

      if (progress.processedRows % UPDATE_INTERVAL === 0) {
        await supabase
          .from('csv_import_progress')
          .update({
            processed_rows: progress.processedRows,
            successful_rows: progress.successfulRows,
            failed_rows: progress.failedRows,
            errors: progress.errors.slice(-100),
          })
          .eq('id', progress.progressId);
      }
    }
  }
}

function parseCSV(text: string): any[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.replace(/^"|"$/g, '') || '';
      });
      rows.push(row);
    }
  }

  return rows;
}
