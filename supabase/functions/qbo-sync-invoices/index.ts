/**
 * QuickBooks Online Invoice Sync Function
 *
 * Handles bidirectional synchronization of invoices between Batchly and QuickBooks Online.
 * Supports pull (QBO -> Batchly), push (Batchly -> QBO), and both directions.
 *
 * Key Features:
 * - Pull invoices from QBO and create/update in Batchly
 * - Push new/modified invoices from Batchly to QBO
 * - Sync invoice line items with full details
 * - Handle linked transactions (payments, estimates, sales orders)
 * - Optimistic locking with SyncToken
 * - Error handling and partial success tracking
 * - Automatic token refresh
 *
 * @endpoint POST /functions/v1/qbo-sync-invoices
 * @body {organizationId: string, direction: 'pull' | 'push' | 'both'}
 * @returns {success: boolean, results: {pulled: number, pushed: number, errors: any[]}}
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  organizationId: string;
  direction: 'pull' | 'push' | 'both';
  invoiceIds?: string[]; // Optional: sync specific invoices only
}

interface QBOInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  CustomerRef: { value: string; name: string };
  Line: QBOInvoiceLine[];
  TxnTaxDetail?: {
    TotalTax: number;
    TaxLine?: Array<{
      DetailType: string;
      Amount: number;
      TaxLineDetail?: {
        TaxRateRef?: { value: string; name: string };
        PercentBased?: boolean;
        TaxPercent?: number;
      };
    }>;
  };
  CustomerMemo?: { value: string };
  PrivateNote?: string;
  BillEmail?: { Address: string };
  BillEmailCc?: string;
  BillEmailBcc?: string;
  ShipAddr?: QBOAddress;
  BillAddr?: QBOAddress;
  ShipFromAddr?: QBOAddress;
  TotalAmt: number;
  Balance: number;
  Deposit?: number;
  ApplyTaxAfterDiscount?: boolean;
  PrintStatus?: string;
  EmailStatus?: string;
  AllowOnlinePayment?: boolean;
  AllowOnlineCreditCardPayment?: boolean;
  AllowOnlineACHPayment?: boolean;
  AllowIPNPayment?: boolean;
  SalesTermRef?: { value: string; name: string };
  DepartmentRef?: { value: string; name: string };
  ClassRef?: { value: string; name: string };
  ARAccountRef?: { value: string; name: string };
  CurrencyRef?: { value: string; name: string };
  ExchangeRate?: number;
  GlobalTaxCalculation?: string;
  LinkedTxn?: Array<{ TxnId: string; TxnType: string; TxnLineId?: string }>;
  CustomField?: Array<{ DefinitionId: string; Name: string; Type: string; StringValue?: string }>;
  SyncToken: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface QBOInvoiceLine {
  Id: string;
  LineNum: number;
  Amount: number;
  DetailType: string;
  Description?: string;
  SalesItemLineDetail?: {
    ItemRef: { value: string; name: string };
    Qty?: number;
    UnitPrice?: number;
    TaxCodeRef?: { value: string; name: string };
    ClassRef?: { value: string; name: string };
    ServiceDate?: string;
  };
  SubTotalLineDetail?: {
    ItemRef?: { value: string; name: string };
  };
  DiscountLineDetail?: {
    PercentBased?: boolean;
    DiscountPercent?: number;
    DiscountAccountRef?: { value: string; name: string };
  };
}

interface QBOAddress {
  Line1?: string;
  Line2?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
  Lat?: string;
  Long?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { organizationId, direction, invoiceIds } = await req.json() as SyncRequest;

    if (!organizationId || !direction) {
      return new Response(
        JSON.stringify({ error: 'organizationId and direction are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate direction
    if (!['pull', 'push', 'both'].includes(direction)) {
      return new Response(
        JSON.stringify({ error: 'direction must be pull, push, or both' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting invoice sync for organization ${organizationId}, direction: ${direction}`);

    // Get QBO connection details
    const { data: connection, error: connError } = await supabaseClient.rpc(
      'get_qbo_connection_for_sync',
      { p_organization_id: organizationId }
    );

    if (connError || !connection || connection.length === 0) {
      console.error('Failed to get QBO connection:', connError);
      return new Response(
        JSON.stringify({ error: 'QuickBooks connection not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qboConnection = connection[0];
    const { qbo_access_token, qbo_realm_id, environment, qbo_token_expires_at } = qboConnection;

    // Check if token needs refresh (within 10 minutes of expiration)
    const tokenExpiresAt = new Date(qbo_token_expires_at);
    const now = new Date();
    const minutesUntilExpiry = (tokenExpiresAt.getTime() - now.getTime()) / 1000 / 60;

    if (minutesUntilExpiry < 10) {
      console.log('Token expires soon, refreshing...');
      const refreshResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/qbo-token-refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') ?? '',
          },
          body: JSON.stringify({ organizationId }),
        }
      );

      if (!refreshResponse.ok) {
        console.error('Failed to refresh token');
        return new Response(
          JSON.stringify({ error: 'Failed to refresh access token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Re-fetch connection with new token
      const { data: newConnection } = await supabaseClient.rpc(
        'get_qbo_connection_for_sync',
        { p_organization_id: organizationId }
      );
      qboConnection.qbo_access_token = newConnection[0].qbo_access_token;
    }

    const baseUrl = environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

    const results = {
      pulled: 0,
      pushed: 0,
      errors: [] as any[],
    };

    // Start sync operation tracking
    const syncHistoryId = crypto.randomUUID();
    const syncStartTime = new Date().toISOString();

    // PULL: Fetch invoices from QBO
    if (direction === 'pull' || direction === 'both') {
      console.log('Pulling invoices from QuickBooks...');

      try {
        // Build query for specific invoices or all invoices
        let query = 'SELECT * FROM Invoice';
        if (invoiceIds && invoiceIds.length > 0) {
          const idList = invoiceIds.map(id => `'${id}'`).join(', ');
          query += ` WHERE Id IN (${idList})`;
        }
        query += ' MAXRESULTS 1000';

        const queryUrl = `${baseUrl}/v3/company/${qbo_realm_id}/query?query=${encodeURIComponent(query)}`;

        const qboResponse = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${qboConnection.qbo_access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!qboResponse.ok) {
          const errorText = await qboResponse.text();
          console.error('QBO API error:', errorText);
          throw new Error(`QBO API error: ${qboResponse.status} ${errorText}`);
        }

        const qboData = await qboResponse.json();
        const invoices: QBOInvoice[] = qboData.QueryResponse?.Invoice || [];

        console.log(`Found ${invoices.length} invoices in QuickBooks`);

        // Process each invoice
        for (const qboInvoice of invoices) {
          try {
            // Find customer by QBO ID
            const { data: customers } = await supabaseClient
              .from('customer_profile')
              .select('id')
              .eq('organization_id', organizationId)
              .eq('qbo_id', qboInvoice.CustomerRef.value)
              .limit(1);

            if (!customers || customers.length === 0) {
              console.warn(`Customer not found for QBO ID ${qboInvoice.CustomerRef.value}, skipping invoice ${qboInvoice.DocNumber}`);
              results.errors.push({
                invoice: qboInvoice.DocNumber,
                error: 'Customer not found in Batchly',
              });
              continue;
            }

            const customerId = customers[0].id;

            // Calculate totals from lines
            const lines = qboInvoice.Line || [];
            let subtotal = 0;
            let discount_total = 0;

            for (const line of lines) {
              if (line.DetailType === 'SalesItemLineDetail') {
                subtotal += line.Amount;
              } else if (line.DetailType === 'DiscountLineDetail') {
                discount_total += line.Amount;
              }
            }

            const tax_total = qboInvoice.TxnTaxDetail?.TotalTax || 0;
            const total = qboInvoice.TotalAmt;
            const balance_due = qboInvoice.Balance;
            const amount_paid = total - balance_due;
            const deposit = qboInvoice.Deposit || 0;
            const remaining_balance = total - deposit - amount_paid;

            // Convert custom fields to JSON
            const customFields = qboInvoice.CustomField
              ? qboInvoice.CustomField.reduce((acc, field) => {
                  acc[field.Name] = field.StringValue || '';
                  return acc;
                }, {} as Record<string, string>)
              : null;

            // Prepare invoice data
            const invoiceData = {
              organization_id: organizationId,
              qbo_id: qboInvoice.Id,
              qbo_doc_number: qboInvoice.DocNumber,
              qbo_sync_token: qboInvoice.SyncToken,
              qbo_created_at: qboInvoice.MetaData.CreateTime,
              qbo_updated_at: qboInvoice.MetaData.LastUpdatedTime,
              invoice_number: qboInvoice.DocNumber,
              invoice_date: qboInvoice.TxnDate,
              qbo_txn_date: qboInvoice.TxnDate,
              due_date: qboInvoice.DueDate || null,
              qbo_due_date: qboInvoice.DueDate || null,
              customer_id: customerId,
              subtotal,
              discount_total: Math.abs(discount_total), // Discount is negative in QBO
              tax_total,
              total,
              balance_due,
              amount_paid,
              deposit,
              remaining_balance,
              status: balance_due === 0 ? 'paid' : balance_due < total ? 'partial' : 'sent',
              memo: qboInvoice.CustomerMemo?.value || null,
              private_note: qboInvoice.PrivateNote || null,
              bill_email: qboInvoice.BillEmail?.Address || null,
              bill_email_cc: qboInvoice.BillEmailCc || null,
              bill_email_bcc: qboInvoice.BillEmailBcc || null,
              billing_address: qboInvoice.BillAddr ? formatAddress(qboInvoice.BillAddr) : null,
              shipping_address: qboInvoice.ShipAddr ? formatAddress(qboInvoice.ShipAddr) : null,
              ship_from_address: qboInvoice.ShipFromAddr ? formatAddress(qboInvoice.ShipFromAddr) : null,
              apply_tax_after_discount: qboInvoice.ApplyTaxAfterDiscount ?? true,
              print_status: qboInvoice.PrintStatus || 'NotSet',
              email_status: qboInvoice.EmailStatus || 'NotSet',
              allow_online_payment: qboInvoice.AllowOnlinePayment || false,
              allow_online_credit_card_payment: qboInvoice.AllowOnlineCreditCardPayment || false,
              allow_online_ach_payment: qboInvoice.AllowOnlineACHPayment || false,
              allow_ipn_payment: qboInvoice.AllowIPNPayment || false,
              sales_term_ref: qboInvoice.SalesTermRef || null,
              department_ref: qboInvoice.DepartmentRef || null,
              class_ref: qboInvoice.ClassRef || null,
              ar_account_ref: qboInvoice.ARAccountRef || null,
              global_tax_calculation: qboInvoice.GlobalTaxCalculation || null,
              linked_txn: qboInvoice.LinkedTxn || null,
              custom_fields: customFields,
              currency_id: null, // Will need to lookup currency by code
              exchange_rate: qboInvoice.ExchangeRate || 1,
              home_balance: qboInvoice.Balance, // In home currency
              home_currency: 'USD', // Default, should be fetched from org settings
              qbo_sync_status: 'synced',
              last_sync_at: new Date().toISOString(),
              source_system: 'quickbooks',
            };

            // Upsert invoice
            const { data: upsertedInvoice, error: upsertError } = await supabaseClient
              .from('invoice_record')
              .upsert(invoiceData, {
                onConflict: 'organization_id,qbo_id',
                ignoreDuplicates: false,
              })
              .select('id')
              .single();

            if (upsertError) {
              console.error(`Error upserting invoice ${qboInvoice.DocNumber}:`, upsertError);
              results.errors.push({
                invoice: qboInvoice.DocNumber,
                error: upsertError.message,
              });
              continue;
            }

            const invoiceId = upsertedInvoice.id;

            // Sync invoice line items
            await syncInvoiceLines(
              supabaseClient,
              invoiceId,
              organizationId,
              qboInvoice.Line || [],
              results
            );

            results.pulled++;
          } catch (error) {
            console.error(`Error processing invoice ${qboInvoice.DocNumber}:`, error);
            results.errors.push({
              invoice: qboInvoice.DocNumber,
              error: error.message,
            });
          }
        }
      } catch (error) {
        console.error('Error pulling invoices from QBO:', error);
        results.errors.push({
          operation: 'pull',
          error: error.message,
        });
      }
    }

    // PUSH: Send new/modified invoices to QBO
    if (direction === 'push' || direction === 'both') {
      console.log('Pushing invoices to QuickBooks...');

      try {
        // Find invoices that need to be pushed
        let query = supabaseClient
          .from('invoice_record')
          .select(`
            *,
            customer:customer_profile!invoice_record_customer_id_fkey(id, qbo_id, display_name)
          `)
          .eq('organization_id', organizationId)
          .not('status', 'in', '(draft,cancelled)')
          .eq('is_voided', false);

        // If specific invoice IDs provided, filter by them
        if (invoiceIds && invoiceIds.length > 0) {
          query = query.in('id', invoiceIds);
        } else {
          // Otherwise, find invoices needing sync
          query = query.or('qbo_id.is.null,last_sync_at.is.null,updated_at.gt.last_sync_at');
        }

        const { data: invoicesToPush, error: fetchError } = await query;

        if (fetchError) {
          throw new Error(`Failed to fetch invoices to push: ${fetchError.message}`);
        }

        console.log(`Found ${invoicesToPush?.length || 0} invoices to push to QuickBooks`);

        for (const invoice of invoicesToPush || []) {
          try {
            // Validate customer has QBO ID
            if (!invoice.customer?.qbo_id) {
              console.warn(`Invoice ${invoice.invoice_number} customer has no QBO ID, skipping`);
              results.errors.push({
                invoice: invoice.invoice_number,
                error: 'Customer not synced to QuickBooks',
              });
              continue;
            }

            // Fetch invoice line items
            const { data: lineItems, error: lineError } = await supabaseClient
              .from('invoice_line_item')
              .select(`
                *,
                item:item_record!invoice_line_item_item_id_fkey(id, qbo_id, name, description)
              `)
              .eq('invoice_id', invoice.id)
              .order('line_number', { ascending: true });

            if (lineError) {
              throw new Error(`Failed to fetch line items: ${lineError.message}`);
            }

            if (!lineItems || lineItems.length === 0) {
              console.warn(`Invoice ${invoice.invoice_number} has no line items, skipping`);
              results.errors.push({
                invoice: invoice.invoice_number,
                error: 'Invoice has no line items',
              });
              continue;
            }

            // Build QBO invoice object
            const qboInvoicePayload: any = {
              CustomerRef: {
                value: invoice.customer.qbo_id,
                name: invoice.customer.display_name,
              },
              TxnDate: invoice.invoice_date || new Date().toISOString().split('T')[0],
              DueDate: invoice.due_date || null,
              DocNumber: invoice.invoice_number,
              Line: [],
            };

            // Add line items
            let lineNum = 1;
            for (const line of lineItems) {
              if (!line.item?.qbo_id) {
                console.warn(`Line item ${line.id} has no QBO item ID, using description-only line`);
                qboInvoicePayload.Line.push({
                  DetailType: 'DescriptionOnly',
                  Description: line.description || line.item?.name || 'Item',
                  Amount: line.total || 0,
                  LineNum: lineNum++,
                });
              } else {
                qboInvoicePayload.Line.push({
                  DetailType: 'SalesItemLineDetail',
                  Amount: line.total || 0,
                  LineNum: lineNum++,
                  Description: line.description || line.item?.description || '',
                  SalesItemLineDetail: {
                    ItemRef: {
                      value: line.item.qbo_id,
                      name: line.item.name,
                    },
                    Qty: line.quantity || 1,
                    UnitPrice: line.unit_price || 0,
                  },
                });
              }
            }

            // Add optional fields
            if (invoice.memo) {
              qboInvoicePayload.CustomerMemo = { value: invoice.memo };
            }
            if (invoice.private_note) {
              qboInvoicePayload.PrivateNote = invoice.private_note;
            }
            if (invoice.bill_email) {
              qboInvoicePayload.BillEmail = { Address: invoice.bill_email };
            }
            if (invoice.billing_address) {
              qboInvoicePayload.BillAddr = formatAddressToQBO(invoice.billing_address);
            }
            if (invoice.shipping_address) {
              qboInvoicePayload.ShipAddr = formatAddressToQBO(invoice.shipping_address);
            }
            if (invoice.sales_term_ref) {
              qboInvoicePayload.SalesTermRef = invoice.sales_term_ref;
            }
            if (invoice.apply_tax_after_discount !== null) {
              qboInvoicePayload.ApplyTaxAfterDiscount = invoice.apply_tax_after_discount;
            }
            if (invoice.allow_online_payment) {
              qboInvoicePayload.AllowOnlinePayment = invoice.allow_online_payment;
            }
            if (invoice.allow_online_credit_card_payment) {
              qboInvoicePayload.AllowOnlineCreditCardPayment = invoice.allow_online_credit_card_payment;
            }
            if (invoice.allow_online_ach_payment) {
              qboInvoicePayload.AllowOnlineACHPayment = invoice.allow_online_ach_payment;
            }

            // If updating existing invoice, include ID and SyncToken
            if (invoice.qbo_id && invoice.qbo_sync_token) {
              qboInvoicePayload.Id = invoice.qbo_id;
              qboInvoicePayload.SyncToken = invoice.qbo_sync_token;
              qboInvoicePayload.sparse = true; // Sparse update
            }

            // Send to QuickBooks
            const qboUrl = `${baseUrl}/v3/company/${qbo_realm_id}/invoice`;
            const qboMethod = invoice.qbo_id ? 'POST' : 'POST'; // Both create and update use POST

            console.log(`${invoice.qbo_id ? 'Updating' : 'Creating'} invoice ${invoice.invoice_number} in QuickBooks...`);

            const qboResponse = await fetch(qboUrl, {
              method: qboMethod,
              headers: {
                'Authorization': `Bearer ${qboConnection.qbo_access_token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(qboInvoicePayload),
            });

            if (!qboResponse.ok) {
              const errorText = await qboResponse.text();
              console.error(`QBO API error for invoice ${invoice.invoice_number}:`, errorText);
              results.errors.push({
                invoice: invoice.invoice_number,
                error: `QBO API error: ${errorText}`,
              });
              continue;
            }

            const qboResult = await qboResponse.json();
            const createdInvoice = qboResult.Invoice;

            // Update local invoice with QBO IDs and sync token
            const { error: updateError } = await supabaseClient
              .from('invoice_record')
              .update({
                qbo_id: createdInvoice.Id,
                qbo_doc_number: createdInvoice.DocNumber,
                qbo_sync_token: createdInvoice.SyncToken,
                qbo_created_at: createdInvoice.MetaData.CreateTime,
                qbo_updated_at: createdInvoice.MetaData.LastUpdatedTime,
                qbo_sync_status: 'synced',
                last_sync_at: new Date().toISOString(),
              })
              .eq('id', invoice.id);

            if (updateError) {
              console.error(`Error updating invoice ${invoice.invoice_number} after push:`, updateError);
              results.errors.push({
                invoice: invoice.invoice_number,
                error: `Failed to update after push: ${updateError.message}`,
              });
            } else {
              results.pushed++;
            }
          } catch (error) {
            console.error(`Error pushing invoice ${invoice.invoice_number}:`, error);
            results.errors.push({
              invoice: invoice.invoice_number,
              error: error.message,
            });
          }
        }
      } catch (error) {
        console.error('Error pushing invoices to QBO:', error);
        results.errors.push({
          operation: 'push',
          error: error.message,
        });
      }
    }

    // Update sync history
    const syncEndTime = new Date().toISOString();
    const syncStatus = results.errors.length === 0
      ? 'completed'
      : results.pulled + results.pushed > 0
      ? 'partial_success'
      : 'failed';

    await supabaseClient.from('qbo_sync_history').insert({
      id: syncHistoryId,
      organization_id: organizationId,
      sync_type: 'manual',
      entity_types: ['invoice'],
      status: syncStatus,
      entity_count: results.pulled + results.pushed,
      success_count: results.pulled + results.pushed,
      failure_count: results.errors.length,
      started_at: syncStartTime,
      completed_at: syncEndTime,
      error_summary: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
    });

    // Update connection last_sync_at
    await supabaseClient
      .from('qbo_connection')
      .update({ last_sync_at: syncEndTime })
      .eq('organization_id', organizationId);

    console.log(`Invoice sync completed: ${results.pulled} pulled, ${results.pushed} pushed, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        syncHistoryId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unhandled error in qbo-sync-invoices:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Sync invoice line items from QBO to Batchly
 */
async function syncInvoiceLines(
  supabaseClient: any,
  invoiceId: string,
  organizationId: string,
  lines: QBOInvoiceLine[],
  results: any
): Promise<void> {
  for (const line of lines) {
    try {
      // Skip non-item lines (subtotal, discount handled at invoice level)
      if (line.DetailType !== 'SalesItemLineDetail') {
        continue;
      }

      const detail = line.SalesItemLineDetail;
      if (!detail) continue;

      // Find item by QBO ID
      const { data: items } = await supabaseClient
        .from('item_record')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('qbo_id', detail.ItemRef.value)
        .limit(1);

      if (!items || items.length === 0) {
        console.warn(`Item not found for QBO ID ${detail.ItemRef.value}, skipping line`);
        continue;
      }

      const itemId = items[0].id;
      const quantity = detail.Qty || 1;
      const unitPrice = detail.UnitPrice || 0;
      const total = line.Amount;

      const lineData = {
        invoice_id: invoiceId,
        item_id: itemId,
        qbo_line_id: line.Id,
        qbo_line_num: line.LineNum,
        qbo_detail_type: line.DetailType,
        description: line.Description || detail.ItemRef.name,
        quantity,
        unit_price: unitPrice,
        total,
        item_ref: detail.ItemRef,
        tax_code_ref: detail.TaxCodeRef || null,
        class_ref: detail.ClassRef || null,
        service_date: detail.ServiceDate || null,
      };

      const { error: lineError } = await supabaseClient
        .from('invoice_line_item')
        .upsert(lineData, {
          onConflict: 'invoice_id,qbo_line_id',
          ignoreDuplicates: false,
        });

      if (lineError) {
        console.error(`Error upserting line item:`, lineError);
      }
    } catch (error) {
      console.error(`Error processing line item:`, error);
    }
  }
}

/**
 * Format QBO address to Batchly JSONB format
 */
function formatAddress(addr: QBOAddress): any {
  return {
    line1: addr.Line1 || '',
    line2: addr.Line2 || '',
    city: addr.City || '',
    state: addr.CountrySubDivisionCode || '',
    postal_code: addr.PostalCode || '',
    country: addr.Country || 'US',
    lat: addr.Lat || null,
    long: addr.Long || null,
  };
}

/**
 * Format Batchly address to QBO format
 */
function formatAddressToQBO(addr: any): QBOAddress {
  return {
    Line1: addr.line1 || '',
    Line2: addr.line2 || '',
    City: addr.city || '',
    CountrySubDivisionCode: addr.state || '',
    PostalCode: addr.postal_code || '',
    Country: addr.country || 'US',
  };
}
