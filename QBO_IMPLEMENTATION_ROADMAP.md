# QuickBooks Online Implementation Roadmap

**Goal:** Make Batchly your operational hub, QuickBooks purely for financials
**Current Status:** 45% complete (infrastructure solid, core syncs missing)
**Timeline:** 2-3 weeks to complete critical features

---

## Executive Summary

### What's Working ✅
- OAuth connection and token management (100%)
- Database infrastructure (90%)
- Customer sync to QB - push direction (70%)
- Item sync from QB - pull direction (80%)
- Security and RLS policies (100%)

### What's Missing ❌
- **Invoice sync to QB** (0%) - CRITICAL
- **Payment sync from QB** (0%) - CRITICAL
- **Sync queue processor** (0%) - CRITICAL
- Scheduled sync jobs (0%)
- Tax rate sync (0%)
- Credit memo sync (0%)

### Impact on Internal Launch
**Can you launch without completing QB sync?** YES, but limited:
- ✅ You can use Batchly for orders and invoices
- ⚠️ You'll have to manually create invoices in QB (defeats the purpose)
- ❌ Payment status won't update automatically
- ❌ You'll still be doing dual entry (Batchly + QB)

**Recommendation:** Complete Phase 1 (invoice sync) before internal launch for maximum value.

---

## Phase 1: Critical Sync Features (Week 1)

**Timeline:** 5-7 days
**Priority:** MUST HAVE for internal launch
**Goal:** Never touch QuickBooks for invoice creation

### 1.1 Invoice Sync to QuickBooks (Day 1-3)

**Estimated Time:** 2-3 days

**Tasks:**

#### A. Create Edge Function: `qbo-sync-invoices`
**File:** `supabase/functions/qbo-sync-invoices/index.ts`

```typescript
/**
 * Syncs invoices from Batchly to QuickBooks Online
 * Direction: Batchly → QuickBooks (one-way push)
 * Trigger: Database trigger on invoice creation or manual sync
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface InvoiceSyncRequest {
  organization_id: string;
  invoice_ids?: string[]; // If provided, sync specific invoices; otherwise sync all pending
}

serve(async (req) => {
  // 1. Validate request and extract organization_id
  // 2. Get QB connection with tokens
  // 3. Fetch invoices to sync (either specified IDs or all pending)
  // 4. For each invoice:
  //    a. Validate: customer has qbo_id
  //    b. Validate: all line items have qbo_id for items
  //    c. Build QB invoice payload
  //    d. POST to QuickBooks API: /v3/company/{realmId}/invoice
  //    e. Store QB Invoice ID in qbo_entity_mapping
  //    f. Update qbo_sync_history
  //    g. Handle errors (retry queue or mark failed)
  // 5. Return sync results
});
```

**Implementation Steps:**
- [ ] Create function file
- [ ] Implement QB API call to create invoice
- [ ] Map Batchly invoice fields → QB invoice fields:
  - DocNumber = Batchly invoice_number
  - TxnDate = invoice_date
  - DueDate = due_date
  - CustomerRef = QB customer ID (from qbo_entity_mapping)
  - Line[] = map invoice_line_items
  - Memo = memo field
- [ ] Validate dependencies:
  - Check customer has qbo_id (else fail with message)
  - Check all items have qbo_id (else fail with message)
- [ ] Store QB Invoice ID in qbo_entity_mapping table
- [ ] Update qbo_sync_history with results
- [ ] Error handling:
  - Network timeout → retry queue
  - Validation error → mark failed with details
  - Duplicate invoice → check if already synced, skip
- [ ] Test with 5-10 test invoices
- [ ] Deploy to Supabase

**Database Changes:**
```sql
-- Add trigger to queue invoice sync on creation
CREATE OR REPLACE FUNCTION queue_invoice_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if invoice status is not 'draft'
  IF NEW.status != 'draft' THEN
    INSERT INTO qbo_sync_queue (
      organization_id,
      entity_type,
      entity_id,
      operation_type,
      status
    ) VALUES (
      NEW.organization_id,
      'invoice',
      NEW.id,
      'push',
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_queue_invoice_sync
AFTER INSERT OR UPDATE ON invoice_record
FOR EACH ROW
EXECUTE FUNCTION queue_invoice_sync();
```

---

#### B. Add Validation Function
**File:** `supabase/functions/qbo-sync-invoices/validate.ts`

```typescript
/**
 * Validates invoice is ready to sync to QB
 * Returns: { valid: boolean, errors: string[] }
 */
export async function validateInvoiceForSync(
  supabase: SupabaseClient,
  invoiceId: string,
  organizationId: string
) {
  const errors: string[] = [];

  // 1. Fetch invoice with customer and line items
  const { data: invoice, error } = await supabase
    .from('invoice_record')
    .select(`
      *,
      customer:customer_profile!inner(*),
      line_items:invoice_line_item(*)
    `)
    .eq('id', invoiceId)
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    errors.push(`Invoice not found: ${error.message}`);
    return { valid: false, errors };
  }

  // 2. Check customer has QB ID
  const { data: customerMapping } = await supabase
    .from('qbo_entity_mapping')
    .select('qbo_id')
    .eq('batchly_entity_type', 'customer')
    .eq('batchly_entity_id', invoice.customer_id)
    .single();

  if (!customerMapping?.qbo_id) {
    errors.push(`Customer "${invoice.customer.display_name}" not synced to QuickBooks. Sync customer first.`);
  }

  // 3. Check all line items have QB item IDs
  for (const lineItem of invoice.line_items) {
    const { data: itemMapping } = await supabase
      .from('qbo_entity_mapping')
      .select('qbo_id')
      .eq('batchly_entity_type', 'item')
      .eq('batchly_entity_id', lineItem.item_id)
      .single();

    if (!itemMapping?.qbo_id) {
      errors.push(`Item "${lineItem.description}" not synced to QuickBooks. Sync items first.`);
    }
  }

  // 4. Check invoice has required fields
  if (!invoice.invoice_number) errors.push('Invoice number missing');
  if (!invoice.invoice_date) errors.push('Invoice date missing');
  if (!invoice.customer_id) errors.push('Customer missing');
  if (invoice.line_items.length === 0) errors.push('No line items');

  return {
    valid: errors.length === 0,
    errors,
    invoice: errors.length === 0 ? invoice : null
  };
}
```

---

#### C. Update UI: Invoices Page
**File:** `src/pages/Invoices.tsx`

**Add:**
- [ ] Sync status badge per invoice (Synced/Pending/Failed/Not Sent)
- [ ] "Sync to QuickBooks" button (bulk action)
- [ ] Filter: Show only unsynced invoices
- [ ] Error details tooltip (if sync failed)

**Example:**
```tsx
// In invoice table row
<SyncStatusBadge
  entityType="invoice"
  entityId={invoice.id}
  onRetry={() => handleRetrySync(invoice.id)}
/>

// Bulk action toolbar
<Button onClick={handleBulkSync}>
  <CloudUpload className="mr-2 h-4 w-4" />
  Sync {selectedInvoices.length} to QuickBooks
</Button>
```

---

### 1.2 Sync Queue Processor (Day 4-5)

**Estimated Time:** 1-2 days

**Purpose:** Automatically process pending syncs in background

**Options:**

#### Option A: Scheduled Edge Function (Recommended)
**File:** `supabase/functions/qbo-sync-processor/index.ts`

```typescript
/**
 * Runs every 1-5 minutes via cron
 * Processes pending items in qbo_sync_queue
 */
serve(async (req) => {
  // 1. Fetch pending sync items (limit 50)
  // 2. For each item:
  //    - Update status to 'processing'
  //    - Call appropriate sync function (invoice, customer, etc.)
  //    - Update status to 'completed' or 'failed'
  //    - Increment retry_count if failed
  //    - If retry_count >= max_retries, mark as 'failed' permanently
  // 3. Return summary
});
```

**Setup:**
```bash
# Deploy function
supabase functions deploy qbo-sync-processor

# Schedule via pg_cron
SELECT cron.schedule(
  'process-qbo-sync-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/qbo-sync-processor',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

#### Option B: Database Trigger + Edge Function
- Trigger on INSERT into qbo_sync_queue
- Calls edge function immediately
- More complex, less reliable than scheduled

**Recommendation:** Use Option A (scheduled) for reliability

---

### 1.3 Payment Sync from QuickBooks (Day 6-7)

**Estimated Time:** 1-2 days

**Purpose:** Pull payment status from QB to update invoice status in Batchly

**Tasks:**

#### A. Create Edge Function: `qbo-sync-payments`
**File:** `supabase/functions/qbo-sync-payments/index.ts`

```typescript
/**
 * Syncs payment status from QuickBooks to Batchly
 * Direction: QuickBooks → Batchly (one-way pull)
 * Trigger: Scheduled daily at 2 AM or manual sync
 */
serve(async (req) => {
  // 1. Get QB connection
  // 2. Fetch all invoices synced to QB (have qbo_id in mapping)
  // 3. For each invoice:
  //    - Query QB API: /v3/company/{realmId}/invoice/{invoiceId}
  //    - Extract: Balance, TotalAmt, Paid status
  //    - Calculate: amount_paid = TotalAmt - Balance
  //    - Update Batchly invoice_record:
  //      - amount_paid
  //      - amount_due = Balance
  //      - status = (Balance == 0 ? 'paid' : TotalAmt > 0 ? 'partial' : 'sent')
  //      - payment_date (if paid)
  // 4. Return summary (X invoices updated, Y paid, Z partial)
});
```

**QB API Query:**
```
GET /v3/company/{realmId}/invoice/{invoiceId}

Response:
{
  "Invoice": {
    "Id": "123",
    "DocNumber": "INV-0045",
    "Balance": 0.00,  // Amount due
    "TotalAmt": 150.00,  // Invoice total
    "LinkedTxn": [  // Linked payments
      {
        "TxnId": "456",
        "TxnType": "Payment",
        "TxnDate": "2025-10-20"
      }
    ]
  }
}
```

**Status Logic:**
```typescript
function calculateInvoiceStatus(invoice: QBInvoice, dueDate: Date): InvoiceStatus {
  const amountPaid = invoice.TotalAmt - invoice.Balance;
  const amountDue = invoice.Balance;

  if (amountDue === 0) return 'paid';
  if (amountPaid > 0 && amountDue > 0) return 'partial';
  if (new Date() > dueDate && amountDue > 0) return 'overdue';
  return 'sent';
}
```

**Schedule:**
```sql
-- Schedule daily at 2 AM
SELECT cron.schedule(
  'sync-qbo-payments-daily',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/qbo-sync-payments',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

### Phase 1 Acceptance Criteria

**Before moving to Phase 2, verify:**
- [ ] Creating invoice in Batchly → automatically syncs to QB
- [ ] Invoice appears in QB with correct data (customer, items, totals)
- [ ] Invoice numbers match exactly (Batchly INV-0045 = QB INV-0045)
- [ ] Sync status visible in Batchly UI (synced/pending/failed)
- [ ] Payments recorded in QB → update invoice status in Batchly (next day)
- [ ] Failed syncs can be retried manually
- [ ] Sync history shows all operations

**Test Scenario:**
```
1. Create 10 invoices in Batchly
2. Wait 5 minutes (sync processor runs)
3. Check QuickBooks → All 10 invoices exist
4. Record payment in QB for 3 invoices
5. Run payment sync (manual or wait until 2 AM)
6. Check Batchly → 3 invoices marked "Paid"
7. Success! ✅
```

---

## Phase 2: Complete Sync Coverage (Week 2)

**Timeline:** 5-7 days
**Priority:** HIGH for full operations
**Goal:** Never touch QuickBooks for any operational task

### 2.1 Customer Sync - Pull Direction (Day 1-2)

**Current Status:** Push works, Pull is placeholder

**Fix:**
- [ ] Update `qbo-sync-customers/index.ts` line 189
- [ ] Replace `return customers.length;` with actual upsert logic
- [ ] Map QB Customer → Batchly customer_profile
- [ ] Handle duplicates (match by email, link instead of create)
- [ ] Test pulling 50+ customers from QB

**Code Fix:**
```typescript
// Current (line 189):
return customers.length;

// Replace with:
const upsertResults = await Promise.all(
  customers.map(async (qbCustomer) => {
    // Map QB fields to Batchly
    const batchlyCustomer = {
      organization_id: organizationId,
      display_name: qbCustomer.DisplayName,
      company_name: qbCustomer.CompanyName || qbCustomer.DisplayName,
      email: qbCustomer.PrimaryEmailAddr?.Address,
      phone: qbCustomer.PrimaryPhone?.FreeFormNumber,
      billing_street: qbCustomer.BillAddr?.Line1,
      billing_city: qbCustomer.BillAddr?.City,
      billing_state: qbCustomer.BillAddr?.CountrySubDivisionCode,
      billing_postal_code: qbCustomer.BillAddr?.PostalCode,
      is_active: qbCustomer.Active ?? true,
    };

    // Upsert to customer_profile
    const { data, error } = await supabase
      .from('customer_profile')
      .upsert(batchlyCustomer, {
        onConflict: 'organization_id,email', // Or use unique constraint
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert customer:', error);
      return { success: false, error: error.message };
    }

    // Store mapping
    await supabase.from('qbo_entity_mapping').upsert({
      organization_id: organizationId,
      batchly_entity_type: 'customer',
      batchly_entity_id: data.id,
      qbo_id: qbCustomer.Id,
      last_sync_at: new Date().toISOString(),
    });

    return { success: true, customerId: data.id };
  })
);

return upsertResults.filter(r => r.success).length;
```

---

### 2.2 Item Sync - Push Direction (Day 3)

**Current Status:** Pull works, Push returns 0

**Add:**
- [ ] Implement push logic in `qbo-sync-items/index.ts`
- [ ] Create items in QB if created in Batchly
- [ ] Map Batchly item → QB Item fields
- [ ] Store QB Item ID

**When to use:**
- Rare case: If you create items in Batchly first
- Most common: Items created by accountant in QB, pulled to Batchly

---

### 2.3 Scheduled Sync Jobs (Day 4-5)

**Setup automatic syncs:**

```sql
-- 1. Daily customer updates (3 AM)
SELECT cron.schedule(
  'sync-qbo-customers-daily',
  '0 3 * * *',
  $$SELECT net.http_post(...)$$
);

-- 2. Daily item updates (4 AM)
SELECT cron.schedule(
  'sync-qbo-items-daily',
  '0 4 * * *',
  $$SELECT net.http_post(...)$$
);

-- 3. Daily payment sync (2 AM)
SELECT cron.schedule(
  'sync-qbo-payments-daily',
  '0 2 * * *',
  $$SELECT net.http_post(...)$$
);

-- 4. Weekly tax rate sync (Sunday 2 AM)
SELECT cron.schedule(
  'sync-qbo-tax-rates-weekly',
  '0 2 * * 0',
  $$SELECT net.http_post(...)$$
);
```

---

### 2.4 Tax Rate Sync (Day 6)

**Create:** `supabase/functions/qbo-sync-tax-rates/index.ts`

**Purpose:** Pull tax rates from QB to apply to Batchly invoices

**Implementation:**
- [ ] Query QB API: /v3/company/{realmId}/taxrate
- [ ] Store in new table: `tax_rate` (name, percentage, agency)
- [ ] Link to organization
- [ ] Apply to invoices based on customer location

---

### 2.5 Error Recovery UI (Day 7)

**Add to QuickBooks Integration page:**
- [ ] Failed syncs section
- [ ] Error details (expandable)
- [ ] Retry button per failed item
- [ ] "Retry All" button
- [ ] Success/failure notifications

**Example:**
```tsx
<div className="border-l-4 border-red-500 p-4">
  <h3>Failed Syncs (3)</h3>
  {failedSyncs.map(sync => (
    <div key={sync.id}>
      <span>{sync.entity_type} - {sync.entity_id}</span>
      <span>{sync.error_message}</span>
      <Button onClick={() => retrySync(sync.id)}>Retry</Button>
    </div>
  ))}
  <Button onClick={retryAllFailedSyncs}>Retry All</Button>
</div>
```

---

## Phase 3: Advanced Features (Week 3+)

**Timeline:** Ongoing
**Priority:** NICE TO HAVE
**Goal:** Complete automation and polish

### 3.1 Credit Memo Sync

- [ ] Create credit memo UI in Batchly
- [ ] Link to original invoice
- [ ] Sync to QB (push only)
- [ ] Update customer balance

### 3.2 Webhook Integration

**Current:** Webhook tables exist, handler missing

**Add:**
- [ ] Webhook endpoint: `supabase/functions/qbo-webhook/index.ts`
- [ ] Signature validation (QB signs webhooks)
- [ ] Event routing based on entity type
- [ ] Trigger pull syncs on QB changes

**Benefits:**
- Near real-time payment updates (instead of daily)
- Detect when data changed in QB
- Proactive sync instead of scheduled

### 3.3 Advanced Sync Dashboard

**Add:**
- [ ] Sync metrics (avg sync time, success rate)
- [ ] Charts (syncs per day, errors over time)
- [ ] Entity-specific sync controls
- [ ] Manual sync buttons per entity type
- [ ] Sync configuration (enable/disable per entity)

### 3.4 Conflict Resolution

**Handle:**
- Customer edited in both Batchly and QB (who wins?)
- Invoice edited in QB after sync (sync back?)
- Deleted entities (soft delete vs hard delete)

**Strategy:**
- Define "source of truth" per entity type
- Batchly wins for: Customers, Invoices, Orders
- QB wins for: Items, Tax Rates, Payments
- UI to review conflicts and choose resolution

---

## Testing Strategy

### Unit Tests
- [ ] Invoice validation logic
- [ ] QB API payload building
- [ ] Field mapping (Batchly → QB)
- [ ] Error handling and retry logic

### Integration Tests
- [ ] Full invoice sync (Batchly → QB)
- [ ] Payment sync (QB → Batchly)
- [ ] Customer sync (bidirectional)
- [ ] Item sync (QB → Batchly)

### End-to-End Tests
```
Scenario 1: New Customer Order to Invoice
1. Create customer in Batchly
2. Wait for sync → Verify customer in QB
3. Create order in Batchly
4. Approve order
5. Create invoice
6. Wait for sync → Verify invoice in QB
7. Record payment in QB
8. Wait for payment sync → Verify status "Paid" in Batchly

Scenario 2: Item Sync
1. Create item in QB
2. Run item sync
3. Verify item appears in Batchly
4. Update item price in QB
5. Run item sync
6. Verify price updated in Batchly

Scenario 3: Error Handling
1. Create invoice with customer not synced to QB
2. Verify sync fails with clear error
3. Sync customer to QB
4. Retry invoice sync
5. Verify success
```

---

## Deployment Checklist

**Before deploying to production:**
- [ ] All edge functions deployed
- [ ] Database migrations run
- [ ] Scheduled jobs configured (cron)
- [ ] Environment variables set (QB client ID, secret)
- [ ] OAuth credentials (production, not sandbox)
- [ ] Test with real QuickBooks account (not sandbox)
- [ ] Verify invoice numbers don't conflict with existing QB data
- [ ] Backup database before first sync
- [ ] Monitor logs for first 24 hours

---

## Rollback Plan

**If sync causes issues:**
```
1. Disable scheduled syncs (delete cron jobs)
2. Mark qbo_connection.is_active = false (stops all syncs)
3. Investigate error logs
4. Fix issue
5. Re-enable connection
6. Retry failed syncs manually
7. Re-enable scheduled syncs
```

---

## Success Metrics

**After implementation, measure:**
- ✅ 100% of invoices synced to QB automatically
- ✅ 0% manual invoice creation in QB
- ✅ < 5 min sync latency (invoice created → appears in QB)
- ✅ > 99% sync success rate
- ✅ Payment status updated daily
- ✅ 0 hours/week spent on QB data entry

---

## Cost Estimate

**Development Time:**
- Phase 1 (Critical): 40-50 hours (1 week full-time)
- Phase 2 (Complete): 40-50 hours (1 week full-time)
- Phase 3 (Advanced): 20-30 hours (ongoing)
- **Total:** 100-130 hours (~2-3 weeks)

**Operational Costs:**
- QuickBooks API: Free (included with QB subscription)
- Supabase edge functions: ~$0-25/month (free tier sufficient)
- Scheduled jobs: Free (pg_cron included)

---

## Quick Start (Internal Launch)

**Minimum to launch:**
1. Complete Phase 1.1 (Invoice Sync) - 2-3 days
2. Complete Phase 1.2 (Sync Queue Processor) - 1-2 days
3. Test with 10-20 real invoices
4. Deploy and monitor for 1 week

**Then:**
- Add payment sync (Phase 1.3)
- Add scheduled syncs (Phase 2.3)
- Iterate based on real usage

---

**Next Step:** Start with Phase 1.1 (Invoice Sync) - this is the highest value feature that will save you the most time immediately.
