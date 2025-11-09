import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) throw new Error('No organization found');

    const { filePath, dataType, progressId, options, columnMappings } = await req.json();
    console.log(`Starting streaming import for ${dataType} from storage: ${filePath}`);
    console.log('Import options:', options);
    console.log('Column mappings:', columnMappings ? 'present' : 'not provided');

    // Validate dataType
    const validTypes = ['items', 'customers', 'invoices', 'invoice_line_items'];
    if (!validTypes.includes(dataType)) {
      throw new Error(`Invalid data type: ${dataType}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Update progress to processing and store settings
    await supabaseClient
      .from('csv_import_progress')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString(),
        import_settings: {
          options: options || {},
          columnMappings: columnMappings || [],
        }
      })
      .eq('id', progressId);

    // Start background streaming processing
    EdgeRuntime.waitUntil(
      processImportStreaming(supabaseClient, profile.organization_id, filePath, dataType, progressId, options, columnMappings)
    );

    return new Response(
      JSON.stringify({
        success: true,
        progressId,
        message: 'Import started in background with streaming',
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

async function processImportStreaming(
  supabase: any,
  orgId: string,
  filePath: string,
  dataType: string,
  progressId: string,
  options?: any,
  columnMappings?: any[]
) {
  let processedRows = 0;
  let successfulRows = 0;
  let failedRows = 0;
  const errors: Array<{ row: number; error: string }> = [];
  let totalRows = 0;
  let headers: string[] = [];

  try {
    console.log('Starting true streaming download...');
    
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('csv-imports')
      .download(filePath);

    if (downloadError) throw new Error(`Failed to download file: ${downloadError.message}`);

    console.log('File downloaded, starting chunk processing...');
    
    // Read file as stream in chunks to avoid loading entire file into memory
    const stream = fileData.stream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let lineCount = 0;
    let isFirstLine = true;
    const BATCH_SIZE = 10; // Ultra-small batches to minimize memory
    const UPDATE_INTERVAL = 50;
    let batchRows: any[] = [];

    // Process chunks as they arrive
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const values = parseCSVLine(buffer);
          if (!isFirstLine && values.length === headers.length) {
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            batchRows.push(row);
            lineCount++;
          }
        }
        break;
      }

      // Check if import was cancelled
      const { data: progressCheck } = await supabase
        .from('csv_import_progress')
        .select('status')
        .eq('id', progressId)
        .single();
      
      if (progressCheck?.status === 'cancelled') {
        console.log('Import cancelled by user');
        return; // Exit early
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);
        
        if (!line) continue;
        
        if (isFirstLine) {
          // Parse headers
          headers = parseCSVLine(line);
          isFirstLine = false;
          console.log(`CSV headers: ${headers.length} columns`);
          continue;
        }
        
        const values = parseCSVLine(line);
        if (values.length !== headers.length) continue;
        
        let row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        // Apply column mappings if provided
        if (columnMappings && columnMappings.length > 0) {
          const mappedRow: any = {};
          columnMappings.forEach((mapping: any) => {
            if (row[mapping.sourceColumn] !== undefined) {
              mappedRow[mapping.targetField] = row[mapping.sourceColumn];
            }
          });
          row = mappedRow;
        }
        
        batchRows.push(row);
        lineCount++;
        
        // Process batch when full
        if (batchRows.length >= BATCH_SIZE) {
          // Check if cancelled before processing batch
          const { data: cancelCheck } = await supabase
            .from('csv_import_progress')
            .select('status')
            .eq('id', progressId)
            .single();
          
          if (cancelCheck?.status === 'cancelled') {
            console.log('Import cancelled by user - stopping batch processing');
            return;
          }

          const batchResult = await processBatch(
            supabase,
            orgId,
            batchRows,
            dataType,
            processedRows,
            options
          );

          successfulRows += batchResult.successful;
          failedRows += batchResult.failed;
          processedRows += batchResult.processed;
          errors.push(...batchResult.errors);

          // Update progress periodically
          if (processedRows % UPDATE_INTERVAL === 0) {
            await supabase
              .from('csv_import_progress')
              .update({
                processed_rows: processedRows,
                successful_rows: successfulRows,
                failed_rows: failedRows,
                total_rows: lineCount, // Update estimated total
                errors: errors.slice(-100),
              })
              .eq('id', progressId);
            
            console.log(`Progress: ${processedRows} rows processed (${successfulRows} successful, ${failedRows} failed)`);
          }

          batchRows = []; // Clear batch immediately to free memory
        }
      }
    }

    // Process any remaining rows in final batch
    if (batchRows.length > 0) {
      // Check if cancelled before processing final batch
      const { data: cancelCheck } = await supabase
        .from('csv_import_progress')
        .select('status')
        .eq('id', progressId)
        .single();
      
      if (cancelCheck?.status === 'cancelled') {
        console.log('Import cancelled by user - stopping final batch processing');
        return;
      }

      const batchResult = await processBatch(
        supabase,
        orgId,
        batchRows,
        dataType,
        processedRows,
        options
      );

      successfulRows += batchResult.successful;
      failedRows += batchResult.failed;
      processedRows += batchResult.processed;
      errors.push(...batchResult.errors);
      
      batchRows = []; // Clear memory
    }

    totalRows = lineCount;

    // Check one final time before marking complete (don't overwrite 'cancelled')
    const { data: finalCheck } = await supabase
      .from('csv_import_progress')
      .select('status')
      .eq('id', progressId)
      .single();
    
    if (finalCheck?.status === 'cancelled') {
      console.log('Import was cancelled - not marking as completed');
      return;
    }

    // Mark as completed
    await supabase
      .from('csv_import_progress')
      .update({
        status: 'completed',
        total_rows: totalRows,
        processed_rows: processedRows,
        successful_rows: successfulRows,
        failed_rows: failedRows,
        errors: errors.slice(-100),
        completed_at: new Date().toISOString(),
      })
      .eq('id', progressId);

    console.log(`Import completed: ${successfulRows} successful, ${failedRows} failed out of ${processedRows} processed`);
  } catch (error: any) {
    console.error('Import processing error:', error);
    await supabase
      .from('csv_import_progress')
      .update({
        status: 'failed',
        errors: [{ row: -1, error: error.message }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', progressId);
  }
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));

  return values;
}

async function processBatch(
  supabase: any,
  orgId: string,
  rows: any[],
  dataType: string,
  startIndex: number,
  options?: any
): Promise<{ successful: number; failed: number; processed: number; errors: Array<{ row: number; error: string }> }> {
  let successful = 0;
  let failed = 0;
  let processed = 0;
  const errors: Array<{ row: number; error: string }> = [];

  // If dry run mode, just count as successful without saving
  if (options?.dryRun) {
    console.log(`Dry run mode: Skipping database operations for ${rows.length} rows`);
    return {
      successful: rows.length,
      failed: 0,
      processed: rows.length,
      errors: []
    };
  }

  if (dataType === 'items') {
    const items = rows
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

    if (items.length > 0) {
      // Determine upsert options based on duplicate strategy
      const upsertConfig = options?.duplicateStrategy === 'skip'
        ? { onConflict: 'organization_id,qbo_id', ignoreDuplicates: true }
        : { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false };

      const { error } = await supabase
        .from('item_record')
        .upsert(items, upsertConfig);

      if (error) {
        // Retry individually on batch failure
        for (let i = 0; i < items.length; i++) {
          const { error: itemError } = await supabase
            .from('item_record')
            .upsert([items[i]], {
              onConflict: 'organization_id,qbo_id',
              ignoreDuplicates: false,
            });

          if (itemError) {
            failed++;
            errors.push({ row: startIndex + i, error: itemError.message });
          } else {
            successful++;
          }
          processed++;
        }
      } else {
        successful += items.length;
        processed += items.length;
      }
    }
    
    const skipped = rows.length - items.length;
    successful += skipped;
    processed += skipped;
  } else if (dataType === 'customers') {
    const customers = rows.map(row => {
      const displayName = row.display_name || row.company_name || 'Unnamed Customer';
      return {
        organization_id: orgId,
        qbo_id: row.id?.toString(),
        display_name: displayName.length > 50 ? displayName.substring(0, 50) : displayName,
        company_name: (row.company_name && row.company_name !== 'null') ? row.company_name : null,
        email: (row.email && row.email !== 'null') ? row.email : null,
        phone: null,
        billing_address_line1: (row.bill_addr_line1 && row.bill_addr_line1 !== 'null') ? row.bill_addr_line1 : null,
        billing_city: (row.bill_addr_city && row.bill_addr_city !== 'null') ? row.bill_addr_city : null,
        billing_state: (row.bill_addr_state && row.bill_addr_state !== 'null') ? row.bill_addr_state : null,
        billing_postal_code: (row.bill_addr_postal_code && row.bill_addr_postal_code !== 'null') ? row.bill_addr_postal_code : null,
        is_active: row.active === 'true' || row.active === true,
        balance: row.balance ? parseFloat(row.balance) : 0,
        qbo_sync_status: 'synced',
        source_system: 'QBO',
        portal_enabled: false,
      };
    });

    // Determine upsert options based on duplicate strategy
    const upsertConfig = options?.duplicateStrategy === 'skip'
      ? { onConflict: 'organization_id,qbo_id', ignoreDuplicates: true }
      : { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false };

    const { error } = await supabase
      .from('customer_profile')
      .upsert(customers, upsertConfig);

    if (error) {
      for (let i = 0; i < customers.length; i++) {
        const { error: custError } = await supabase
          .from('customer_profile')
          .upsert([customers[i]], {
            onConflict: 'organization_id,qbo_id',
            ignoreDuplicates: false,
          });

        if (custError) {
          failed++;
          errors.push({ row: startIndex + i, error: custError.message });
        } else {
          successful++;
        }
        processed++;
      }
    } else {
      successful += customers.length;
      processed += customers.length;
    }
  } else if (dataType === 'invoices') {
    // Log column names from first row to debug
    if (startIndex === 0 && rows.length > 0) {
      console.log('Invoice CSV columns:', Object.keys(rows[0]));
    }
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Get customer name and clean it
        let customerName = row.customer_ref_name || row.Customer || row.customer;
        
        if (!customerName) {
          failed++;
          errors.push({ row: startIndex + i, error: `No customer name found` });
          processed++;
          continue;
        }
        
        // Strip "(deleted)" suffix from customer names
        customerName = customerName.replace(/\s*\(deleted\)\s*$/i, '').trim();
        
        // Try exact match first
        let customer = await supabase
          .from('customer_profile')
          .select('id')
          .eq('organization_id', orgId)
          .eq('display_name', customerName)
          .maybeSingle();

        // If no exact match, try fuzzy matching (case insensitive, partial match)
        if (!customer.data) {
          const { data: fuzzyCustomers } = await supabase
            .from('customer_profile')
            .select('id, display_name')
            .eq('organization_id', orgId)
            .ilike('display_name', `%${customerName}%`)
            .limit(1);
          
          if (fuzzyCustomers && fuzzyCustomers.length > 0) {
            customer.data = fuzzyCustomers[0];
          }
        }

        if (!customer.data) {
          failed++;
          errors.push({ row: startIndex + i, error: `Customer not found: "${customerName}"` });
          processed++;
          continue;
        }

        // Parse dates with better error handling
        let invoiceDate = new Date();
        let dueDate = null;
        
        try {
          if (row.txn_date) {
            const parsed = new Date(row.txn_date);
            if (!isNaN(parsed.getTime())) {
              invoiceDate = parsed;
            }
          }
        } catch (e) {
          console.warn(`Invalid invoice date for row ${startIndex + i}: ${row.txn_date}`);
        }
        
        try {
          if (row.due_date) {
            const parsed = new Date(row.due_date);
            if (!isNaN(parsed.getTime())) {
              dueDate = parsed;
            }
          }
        } catch (e) {
          console.warn(`Invalid due date for row ${startIndex + i}: ${row.due_date}`);
        }

        const totalAmt = parseFloat(row.total_amt || row.total_amount || row.total || 0);
        const balance = parseFloat(row.balance || 0);

        const invoice = {
          organization_id: orgId,
          qbo_id: row.id?.toString(),
          invoice_number: row.doc_number || `INV-${row.id}`,
          invoice_date: invoiceDate.toISOString(),
          due_date: dueDate ? dueDate.toISOString() : null,
          customer_id: customer.data.id,
          subtotal: totalAmt,
          tax_total: 0,
          total: totalAmt,
          amount_paid: totalAmt - balance,
          // amount_due is a GENERATED column - database calculates it automatically
          status: balance === 0 ? 'paid' : 'invoiced',
          qbo_sync_status: 'synced',
          source_system: 'QBO',
          memo: row.customer_memo || null,
        };

        const { error } = await supabase
          .from('invoice_record')
          .upsert(invoice, { onConflict: 'organization_id,qbo_id', ignoreDuplicates: false });

        if (error) {
          failed++;
          errors.push({ row: startIndex + i, error: error.message });
        } else {
          successful++;
        }
        processed++;
      } catch (err: any) {
        failed++;
        errors.push({ row: startIndex + i, error: err.message });
        processed++;
      }
    }
  } else if (dataType === 'invoice_line_items') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { data: invoice } = await supabase
          .from('invoice_record')
          .select('id')
          .eq('organization_id', orgId)
          .eq('qbo_id', row.invoice_id?.toString())
          .single();

        if (!invoice) {
          failed++;
          errors.push({ row: startIndex + i, error: `Invoice not found: ${row.invoice_id}` });
          processed++;
          continue;
        }

        const { data: item } = await supabase
          .from('item_record')
          .select('id')
          .eq('organization_id', orgId)
          .eq('qbo_id', row.item_id?.toString())
          .single();

        if (!item) {
          failed++;
          errors.push({ row: startIndex + i, error: `Item not found: ${row.item_id}` });
          processed++;
          continue;
        }

        const lineItem = {
          organization_id: orgId,
          invoice_id: invoice.id,
          item_id: item.id,
          description: row.description || row.item_name || null,
          quantity: parseFloat(row.quantity) || 0,
          unit_price: parseFloat(row.unit_price || row.rate) || 0,
          discount_amount: parseFloat(row.discount_amount) || 0,
          tax_rate: parseFloat(row.tax_rate) || 0,
        };

        const { error } = await supabase
          .from('invoice_line_item')
          .insert(lineItem);

        if (error) {
          failed++;
          errors.push({ row: startIndex + i, error: error.message });
        } else {
          successful++;
        }
        processed++;
      } catch (err: any) {
        failed++;
        errors.push({ row: startIndex + i, error: err.message });
        processed++;
      }
    }
  }

  return { successful, failed, processed, errors };
}
