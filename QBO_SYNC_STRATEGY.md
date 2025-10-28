# QuickBooks Online Integration Strategy

**Philosophy:** Batchly is your operational system. QuickBooks is your financial reporting system.

**Goal:** Never touch QuickBooks for daily operations. Only use it for viewing financials, running reports, and accounting tasks.

---

## Core Principle: One-Way Data Flow

```
BATCHLY (Operations)  →  QUICKBOOKS (Financials)
    ↓                         ↓
All daily work          View reports only
Create customers        Run tax reports
Create orders           Bank reconciliation
Create invoices         Financial statements
Manage operations       Accountant tasks
```

**You should NEVER need to:**
- ❌ Create invoices in QuickBooks
- ❌ Create customers in QuickBooks
- ❌ Edit customer data in QuickBooks
- ❌ Manually enter sales data in QuickBooks
- ❌ Duplicate any operational work in QuickBooks

**QuickBooks is ONLY for:**
- ✅ Viewing financial reports
- ✅ Bank reconciliation
- ✅ Tax preparation
- ✅ Expense tracking (bills, purchases)
- ✅ Payroll (if applicable)
- ✅ Accountant/bookkeeper tasks

---

## What Syncs and In Which Direction

### 1. Customers (Batchly → QuickBooks) - ONE WAY

**Direction:** Batchly is source of truth → Push to QuickBooks

**Why:** You create and manage customers in Batchly during daily operations. QuickBooks just needs them for invoice records.

**Sync Strategy:**
```
CREATE in Batchly:
  → Automatically sync to QuickBooks
  → Store QBO Customer ID in Batchly
  → Never create customers in QB manually

UPDATE in Batchly (address, phone, email):
  → Automatically sync changes to QuickBooks
  → Keep both systems in sync

QuickBooks customer data:
  → Read-only from operations perspective
  → If accountant changes in QB, don't sync back (rare edge case)
```

**Implementation:**
- Auto-sync on customer creation (immediate or nightly batch)
- Auto-sync on customer update (immediate or nightly batch)
- Show sync status in Batchly UI (synced, pending, failed)
- Manual retry for failed syncs

**Data Mapped:**
- Display Name → QB Customer Name
- Company Name → QB Company Name
- Email → QB Primary Email
- Phone → QB Primary Phone
- Billing Address → QB Billing Address
- Active Status → QB Active/Inactive

---

### 2. Items/Products (QuickBooks → Batchly) - ONE WAY

**Direction:** QuickBooks is source of truth → Pull into Batchly

**Why:** Your accountant sets up the chart of accounts and item categories in QuickBooks for proper financial reporting. Batchly uses these for pricing and invoicing.

**Sync Strategy:**
```
CREATE in QuickBooks:
  → Pull into Batchly (daily sync)
  → Use for order creation in Batchly
  → Store QBO Item ID in Batchly

UPDATE in QuickBooks (price, description):
  → Pull changes into Batchly (daily sync)
  → Batchly uses updated prices

CREATE in Batchly (rare):
  → If needed, create in Batchly first
  → Sync to QuickBooks
  → Pull back QBO Item ID
  → Usually accountant creates items in QB though
```

**Implementation:**
- Daily pull sync (automated, runs nightly)
- Manual "Sync Items Now" button for immediate sync
- Show last sync time in UI
- Match items by SKU or Name

**Data Mapped:**
- QB Item Name → Batchly Item Name
- QB SKU → Batchly SKU
- QB Description → Batchly Description
- QB Unit Price → Batchly Default Price
- QB Income Account → Store for reference
- QB Active/Inactive → Batchly Active Status

**Special Handling:**
- Only sync "Product" and "Service" items (not "Non-Inventory")
- Only sync active items by default
- Allow manual override of QB prices in Batchly (per customer pricing)

---

### 3. Invoices (Batchly → QuickBooks) - ONE WAY

**Direction:** Batchly is source of truth → Push to QuickBooks

**Why:** Invoices are created in Batchly as part of your operational workflow. QuickBooks just needs them for financial records.

**Sync Strategy:**
```
CREATE Invoice in Batchly:
  → Automatically sync to QuickBooks
  → Store QBO Invoice ID in Batchly
  → QB Invoice Number matches Batchly Invoice Number
  → NEVER create invoices in QuickBooks manually

UPDATE Invoice in Batchly:
  → DO NOT sync updates (invoices are immutable in both systems)
  → If correction needed: Cancel in Batchly, create credit memo, sync both

PAYMENT in QuickBooks:
  → Sync payment status back to Batchly (see Payment Tracking below)
```

**Implementation:**
- Auto-sync after invoice creation (immediate or batched)
- Batch sync option: "Sync All Unsent Invoices"
- Show sync status per invoice (synced, pending, failed, not sent)
- Manual retry for failed syncs
- Sync history log (timestamp, success/failure, error details)

**Data Mapped:**
- Batchly Invoice Number → QB Invoice Number (MUST match exactly)
- Customer → QB Customer Reference
- Invoice Date → QB Invoice Date
- Due Date → QB Due Date
- Line Items → QB Line Items (Description, Qty, Rate, Amount)
- Subtotal → QB Subtotal
- Tax → QB Tax Line (if applicable)
- Total → QB Total
- Memo/Notes → QB Memo
- Terms → QB Payment Terms

**Critical Requirements:**
- Invoice numbers MUST be sequential in Batchly (already implemented)
- Invoice numbers MUST sync to QB exactly (no QB auto-numbering)
- Line item order must match (position matters for reconciliation)
- Totals must match exactly (penny-perfect)

---

### 4. Payment Tracking (QuickBooks → Batchly) - BI-DIRECTIONAL

**Direction:** QuickBooks ← → Batchly (two-way sync)

**Why:** Payments may be recorded in QuickBooks (bank deposits, credit cards) OR in Batchly (customer portal payments). Both systems need to know payment status.

**Sync Strategy:**
```
PAYMENT recorded in QuickBooks:
  → Pull payment status to Batchly (daily sync)
  → Update invoice status: Paid, Partial, Overdue
  → Update amount paid and amount due
  → Show payment date in Batchly

PAYMENT recorded in Batchly (future - customer portal):
  → Push payment to QuickBooks
  → Link payment to invoice
  → Update both systems

REFUND in QuickBooks:
  → Pull to Batchly
  → Update invoice status
```

**Implementation:**
- Daily payment sync (automated, runs nightly)
- Pull all invoice payment statuses from QB
- Match by QB Invoice ID
- Update Batchly invoice status and amounts
- Show last payment sync time in UI

**Data Mapped:**
- QB Payment Amount → Batchly Amount Paid
- QB Payment Date → Batchly Payment Date
- QB Payment Method → Batchly Payment Method
- QB Invoice Status → Batchly Invoice Status
  - QB "Paid" → Batchly "Paid"
  - QB "Partial" → Batchly "Partial"
  - QB "Unpaid" + Past Due → Batchly "Overdue"

**Payment Status Logic:**
```
Batchly Invoice Status:
- Draft: Not synced to QB yet
- Sent: Synced to QB, unpaid
- Partial: QB shows partial payment
- Paid: QB shows full payment
- Overdue: QB shows unpaid + past due date
- Cancelled: Voided in Batchly (sync void to QB)
```

---

### 5. Sales Tax (QuickBooks → Batchly) - ONE WAY

**Direction:** QuickBooks is source of truth → Pull into Batchly

**Why:** Tax rates and rules are set up in QuickBooks by your accountant for compliance. Batchly uses these rates for calculating invoice totals.

**Sync Strategy:**
```
Tax Rates in QuickBooks:
  → Pull into Batchly (weekly sync)
  → Apply to invoices based on customer location
  → Use QB tax calculation rules

Tax Settings:
  → Pull from QB (tax agency, rates, rules)
  → Apply automatically in Batchly
```

**Implementation:**
- Weekly tax rate sync (automated)
- Manual "Sync Tax Rates" button
- Apply tax to invoices based on QB rules
- Default tax rate per customer (if QB supports)

**Data Mapped:**
- QB Tax Rate Name → Batchly Tax Rate Name
- QB Tax Percentage → Batchly Tax Rate
- QB Tax Agency → Reference only
- QB Tax Applicability → Apply to correct items

---

### 6. Credit Memos/Refunds (Batchly → QuickBooks) - ONE WAY

**Direction:** Batchly is source of truth → Push to QuickBooks

**Why:** If you need to issue credits or refunds, create them in Batchly and sync to QuickBooks for financial records.

**Sync Strategy:**
```
CREATE Credit Memo in Batchly:
  → Automatically sync to QuickBooks
  → Link to original invoice (if applicable)
  → Store QBO Credit Memo ID in Batchly
  → Apply to customer balance in QB

REFUND in Batchly:
  → Sync to QuickBooks
  → Update customer balance
```

**Implementation (Future Enhancement):**
- Create credit memo module in Batchly
- Link to original invoice
- Auto-sync to QuickBooks
- Show in customer account history

---

### 7. Sales Orders (No Sync) - BATCHLY ONLY

**Direction:** Stay in Batchly only, never sync to QuickBooks

**Why:** QuickBooks doesn't need sales orders - only invoices matter for financials. Sales orders are operational data.

**Strategy:**
```
Sales Orders in Batchly:
  → Track delivery dates, fulfillment status
  → Approve orders
  → Convert to invoices
  → DO NOT sync orders to QuickBooks

Only sync when:
  → Order becomes invoice
  → Invoice syncs to QB
```

**Benefit:** Keep QuickBooks clean - only financial transactions, no operational clutter

---

## Sync Frequency & Timing

### Real-Time Syncs (Immediate):
- ✅ Invoice creation (sync within 1 minute)
- ✅ Customer creation (sync within 1 minute)
- ✅ Credit memo creation (sync within 1 minute)

**Why:** Financial data should be immediately available in QuickBooks for accuracy.

### Scheduled Syncs (Daily/Weekly):
- ⏰ Payment status (daily, 2 AM)
- ⏰ Customer updates (daily, 3 AM)
- ⏰ Item/Product sync (daily, 4 AM)
- ⏰ Tax rate sync (weekly, Sunday 2 AM)

**Why:** Non-critical updates can batch for performance.

### Manual Syncs (On-Demand):
- 🔄 "Sync All Customers Now"
- 🔄 "Sync All Items Now"
- 🔄 "Sync All Invoices Now"
- 🔄 "Retry Failed Syncs"

**Why:** Troubleshooting and immediate needs.

---

## Sync Status & Monitoring

### Per-Entity Sync Status

**Customer Sync Status:**
```
✅ Synced (green checkmark + QBO ID)
⏳ Pending (yellow clock)
❌ Failed (red X + error message)
⚠️ Not Synced (gray, not sent yet)
```

**Invoice Sync Status:**
```
✅ Synced to QB (green checkmark + QB Invoice #)
⏳ Sync Pending (yellow clock)
❌ Sync Failed (red X + error + retry button)
⚠️ Draft (gray, not ready to sync)
🔄 Retry Available (clickable)
```

### Sync Dashboard (New Feature)

**Location:** QuickBooks page in Batchly

**Features:**
```
┌─────────────────────────────────────────┐
│   QuickBooks Sync Dashboard             │
├─────────────────────────────────────────┤
│ Connection Status: ✅ Connected         │
│ Last Sync: 2 minutes ago                │
│                                         │
│ Recent Syncs:                           │
│ - Invoices: 45 synced, 0 failed        │
│ - Customers: 12 synced, 0 failed       │
│ - Items: 156 synced, 0 failed          │
│ - Payments: 8 updated                  │
│                                         │
│ Pending Syncs:                          │
│ - 3 invoices queued                    │
│ - 0 customers queued                   │
│                                         │
│ Failed Syncs (Last 7 Days):            │
│ - 2 invoices failed (view details)    │
│   → Retry All                          │
│                                         │
│ Manual Sync:                            │
│ [Sync Customers] [Sync Items]          │
│ [Sync Invoices] [Sync Payments]        │
│                                         │
│ Sync History (view all)                │
└─────────────────────────────────────────┘
```

---

## Error Handling & Retry Logic

### Common Sync Errors

**1. Customer Already Exists in QB**
```
Error: Customer with email "john@example.com" already exists
Resolution:
  → Pull QB customer into Batchly
  → Link by email or name match
  → Store QB ID
  → Mark as synced
```

**2. Item Not Found in QB**
```
Error: Item "SKU-123" not found in QuickBooks
Resolution:
  → Create item in QB first
  → Run item sync in Batchly
  → Retry invoice sync
  OR
  → Create item in Batchly → sync to QB → retry
```

**3. Invoice Number Conflict**
```
Error: Invoice number "INV-0045" already exists in QB
Resolution:
  → This should NEVER happen (Batchly controls numbering)
  → If it does: Pull QB invoices, check for gaps
  → Reset Batchly invoice counter to max(QB invoice #) + 1
```

**4. Network Timeout**
```
Error: QuickBooks API request timed out
Resolution:
  → Automatic retry (3 attempts with exponential backoff)
  → If still fails: Mark as "Retry Available"
  → User can manually retry later
```

**5. QB Authentication Expired**
```
Error: Access token expired or invalid
Resolution:
  → Automatic token refresh (if refresh token valid)
  → If refresh fails: Prompt to reconnect QB
  → Show prominent banner: "Reconnect QuickBooks"
```

### Retry Strategy

**Automatic Retries (System):**
```
1st attempt: Immediate
   ↓ Failed
2nd attempt: Wait 30 seconds
   ↓ Failed
3rd attempt: Wait 2 minutes
   ↓ Failed
Mark as "Failed - Manual Retry Available"
```

**Manual Retries (User):**
```
User clicks "Retry" button
  → Attempt sync again
  → Show loading spinner
  → Show success/failure message
  → If fails again: Show error details
```

**Bulk Retry:**
```
"Retry All Failed Syncs" button
  → Queues all failed syncs
  → Processes one by one
  → Shows progress (3/10 retried...)
  → Shows final summary (7 succeeded, 3 still failed)
```

---

## Data Integrity & Validation

### Pre-Sync Validation

**Before syncing invoice to QB:**
```
✅ Customer exists and is synced to QB
✅ All line items reference synced QB items
✅ Invoice number is sequential (no gaps)
✅ Totals calculated correctly
✅ Customer has QB ID stored
✅ All items have QB IDs stored
✅ Invoice date is valid
✅ Due date is after invoice date
```

**Before syncing customer to QB:**
```
✅ Email is valid format (if provided)
✅ Display name is not empty
✅ Address is properly formatted (if provided)
✅ No duplicate customer in QB (check by email/name)
```

### Post-Sync Verification

**After invoice sync:**
```
✅ QB Invoice ID stored in Batchly
✅ QB Invoice Number matches Batchly Invoice Number
✅ Total amounts match (penny-perfect)
✅ Line item count matches
✅ Customer reference is correct
✅ Sync timestamp recorded
```

**Mismatch Handling:**
```
If totals don't match:
  → Flag invoice with warning
  → Log discrepancy details
  → Alert admin
  → Require manual review
```

---

## QuickBooks Setup Requirements

### Initial QB Setup (One-Time)

**1. Enable Features in QB:**
- ✅ Sales Tax (if applicable)
- ✅ Custom Transaction Numbers (for invoice numbering)
- ✅ API Access enabled

**2. Configure Settings:**
```
QuickBooks Settings → Sales:
  → Custom Transaction Numbers: ON
  → Allow Batchly to set invoice numbers

QuickBooks Settings → Advanced:
  → Automation: Allow apps to create transactions
```

**3. Create QB Items (if not already exists):**
```
Your accountant should create:
  → All products/services you sell
  → Assign correct income accounts
  → Set default prices (can override in Batchly)
  → Activate/inactivate as needed
```

**4. Set Up Tax Rates (if applicable):**
```
QuickBooks Settings → Taxes:
  → Add tax rates for your jurisdictions
  → Assign to customers by location
  → Batchly will use these automatically
```

---

## User Workflows (Never Touch QB for Operations)

### Daily Order & Invoice Workflow

```
MORNING (All in Batchly):
8:00 AM - Generate daily orders from templates
8:05 AM - Review and adjust quantities
8:15 AM - Approve all orders
8:20 AM - Bulk create invoices
8:22 AM - Invoices automatically sync to QB ✅
8:25 AM - Done! ☕️

NEVER NEEDED IN QUICKBOOKS:
  ❌ Don't create invoices in QB
  ❌ Don't edit invoices in QB
  ❌ Don't enter customer data in QB
```

**Result:** All sales data is in QuickBooks for your accountant, but you never touched it!

---

### New Customer Workflow

```
IN BATCHLY:
1. Customer calls with first order
2. Create customer in Batchly (name, email, address)
3. Customer automatically syncs to QB in background ✅
4. Create first order for customer
5. Approve and invoice
6. Invoice syncs to QB ✅

NEVER NEEDED IN QUICKBOOKS:
  ❌ Don't create customer in QB
  ❌ Don't enter customer details in QB
```

**Result:** Customer exists in QuickBooks for reporting, but you created them in Batchly!

---

### Payment Recording Workflow

**Option 1: Payment via Bank Deposit (Traditional)**
```
IN QUICKBOOKS (Accountant):
1. Receive payment (check, ACH, etc.)
2. Record deposit in QuickBooks
3. Apply payment to invoice(s)
4. Done

IN BATCHLY (Automatic):
1. Daily payment sync runs (2 AM)
2. Invoice status updates to "Paid" ✅
3. Amount paid and due amounts update ✅
4. You see current status in Batchly dashboard
```

**Option 2: Payment via Customer Portal (Future)**
```
IN BATCHLY (Customer):
1. Customer logs into portal
2. Clicks "Pay Invoice"
3. Enters credit card (Stripe integration)
4. Payment processed ✅

IN BATCHLY (Automatic):
1. Invoice status → "Paid"
2. Payment syncs to QuickBooks ✅
3. Applied to invoice in QB

IN QUICKBOOKS (Automatic):
1. Payment appears in QB
2. Applied to correct invoice
3. Ready for reconciliation
```

**Result:** No matter where payment is recorded, both systems stay in sync!

---

## What Your Accountant Does in QuickBooks

**Your accountant ONLY uses QB for:**

### 1. Financial Reports
```
- Profit & Loss statement
- Balance sheet
- Cash flow statement
- Sales by customer report
- Sales by item report
- Aging receivables report
```

**All sales data is there from Batchly syncs!**

---

### 2. Bank Reconciliation
```
- Match bank deposits to QB payments
- Reconcile checking account
- Reconcile credit card accounts
```

**Invoice data synced from Batchly makes this easy!**

---

### 3. Expense Tracking
```
- Enter bills from vendors
- Record purchases
- Track expenses by category
- NOT related to Batchly (separate workflow)
```

---

### 4. Tax Preparation
```
- Generate tax reports
- Sales tax liability
- Income by category
- Prepare for CPA
```

**All sales data from Batchly is properly categorized!**

---

### 5. Payroll (if applicable)
```
- Process payroll
- Track labor costs
- NOT related to Batchly
```

---

## Sync Architecture (Technical)

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    BATCHLY (Operations)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │Customers │  │  Orders  │  │ Invoices │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │             │              │                    │
│       └─────────────┴──────────────┘                    │
│                     │                                   │
│              ┌──────▼──────┐                           │
│              │  Sync Queue │                           │
│              │  (Database) │                           │
│              └──────┬──────┘                           │
│                     │                                   │
│              ┌──────▼──────────┐                       │
│              │  Edge Function  │                       │
│              │  (qbo-sync)     │                       │
│              └──────┬──────────┘                       │
└─────────────────────┼───────────────────────────────────┘
                      │
                      │ HTTPS/OAuth
                      │
┌─────────────────────▼───────────────────────────────────┐
│              QUICKBOOKS ONLINE API                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │Customers │  │  Items   │  │ Invoices │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  Used by accountant for reports, reconciliation, taxes │
└─────────────────────────────────────────────────────────┘
```

### Sync Queue Table

**Purpose:** Track all syncs for reliability and retry logic

```sql
CREATE TABLE qbo_sync_queue (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'customer', 'invoice', 'payment', 'item'
  entity_id UUID NOT NULL, -- ID of customer, invoice, etc.
  sync_direction TEXT NOT NULL, -- 'push', 'pull'
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  qbo_id TEXT, -- QuickBooks entity ID (after successful sync)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### Sync Process Flow

**1. User creates invoice in Batchly**
```
1. Invoice saved to database
2. Trigger adds record to qbo_sync_queue:
   - entity_type: 'invoice'
   - entity_id: invoice.id
   - status: 'pending'
   - sync_direction: 'push'
```

**2. Sync worker processes queue (runs every 1 min)**
```
1. Select all 'pending' items from queue (limit 50)
2. Update status to 'processing'
3. For each item:
   - Call Edge Function: qbo-sync-invoice
   - Pass invoice data
   - Edge Function calls QB API
   - If success:
     - Store QB ID in invoice table
     - Update queue status: 'completed'
     - Record completed_at timestamp
   - If failure:
     - Increment attempts
     - Store error_message
     - If attempts < max_attempts:
       - Update status back to 'pending' (retry later)
     - If attempts >= max_attempts:
       - Update status to 'failed'
```

**3. User sees sync status in UI**
```
Batchly UI queries:
  - Invoice table (has qbo_id? synced!)
  - qbo_sync_queue (status? pending/failed?)
  - Shows appropriate badge/icon
```

---

## Implementation Checklist

### Phase 1: Core Sync (Week 1)

**Customer Sync (Push):**
- [ ] Create Edge Function: `qbo-sync-customer-push`
- [ ] Add trigger: On customer create → add to sync queue
- [ ] Add trigger: On customer update → add to sync queue
- [ ] Implement sync worker (process queue every 1 min)
- [ ] Map Batchly customer → QB customer fields
- [ ] Handle duplicate customer errors (match by email)
- [ ] Store QB Customer ID in Batchly
- [ ] Add sync status indicator in Customers list
- [ ] Add manual "Sync to QB" button per customer
- [ ] Test with 10 customers

**Invoice Sync (Push):**
- [ ] Create Edge Function: `qbo-sync-invoice-push`
- [ ] Add trigger: On invoice create → add to sync queue
- [ ] Validate: Customer has QB ID before syncing invoice
- [ ] Validate: All items have QB IDs before syncing invoice
- [ ] Map Batchly invoice → QB invoice fields
- [ ] Map line items correctly (maintain order)
- [ ] Ensure invoice numbers match exactly
- [ ] Store QB Invoice ID in Batchly
- [ ] Add sync status indicator in Invoices list
- [ ] Add manual "Sync to QB" button per invoice
- [ ] Test with 20 invoices

---

### Phase 2: Item & Payment Sync (Week 2)

**Item Sync (Pull):**
- [ ] Create Edge Function: `qbo-sync-items-pull`
- [ ] Schedule: Daily at 4 AM (cron job)
- [ ] Pull all active items from QB
- [ ] Match by SKU (primary) or Name (fallback)
- [ ] Create new items in Batchly if not exists
- [ ] Update existing items (price, description)
- [ ] Store QB Item ID in Batchly
- [ ] Add "Last Synced" timestamp in Items list
- [ ] Add manual "Sync Items Now" button
- [ ] Test with 50+ items

**Payment Sync (Pull):**
- [ ] Create Edge Function: `qbo-sync-payments-pull`
- [ ] Schedule: Daily at 2 AM (cron job)
- [ ] Pull all invoices with payment updates
- [ ] Match by QB Invoice ID
- [ ] Update Batchly invoice:
  - amount_paid
  - amount_due
  - status (paid/partial/overdue)
  - payment_date
- [ ] Add "Last Payment Sync" timestamp in UI
- [ ] Add manual "Sync Payments Now" button
- [ ] Test with 10 paid invoices

---

### Phase 3: Monitoring & Reliability (Week 3)

**Sync Dashboard:**
- [ ] Create QuickBooks page in Batchly
- [ ] Show connection status (connected/disconnected)
- [ ] Show last sync times per entity type
- [ ] Show sync statistics (success/failure counts)
- [ ] Show pending sync queue count
- [ ] Show failed syncs with retry button
- [ ] Add "Retry All" button
- [ ] Add manual sync buttons (Customers, Items, Invoices, Payments)
- [ ] Add sync history log (last 100 syncs)

**Error Handling:**
- [ ] Implement retry logic (3 attempts with backoff)
- [ ] Add error logging to database
- [ ] Add error notifications (email admin on repeated failures)
- [ ] Create troubleshooting guide for common errors
- [ ] Add "View Error Details" in UI for failed syncs

**Testing:**
- [ ] Test network failures (simulate timeout)
- [ ] Test QB auth expiry (simulate expired token)
- [ ] Test duplicate data (customer already exists)
- [ ] Test missing dependencies (item not in QB)
- [ ] Test large batches (100+ invoices)
- [ ] Test sync performance (time to sync 100 invoices)

---

### Phase 4: Advanced Features (Week 4+)

**Tax Rate Sync:**
- [ ] Pull tax rates from QB (weekly)
- [ ] Apply to invoices automatically
- [ ] Match customers to tax rates by location

**Credit Memo Sync:**
- [ ] Create credit memo module in Batchly
- [ ] Sync credit memos to QB
- [ ] Link to original invoices

**Bulk Operations:**
- [ ] "Sync All Customers" (batch process)
- [ ] "Sync All Invoices" (batch process)
- [ ] Progress indicator for bulk syncs

---

## Success Metrics

**After implementation, you should achieve:**

✅ **Zero manual data entry in QuickBooks**
- 100% of invoices created in Batchly, synced automatically
- 100% of customers created in Batchly, synced automatically
- 0% of operational work done in QuickBooks

✅ **Near-perfect sync reliability**
- 99%+ sync success rate
- < 1% failed syncs (retry and resolve)
- < 5 minute sync latency for invoices

✅ **Complete financial visibility in QB**
- All sales data in QuickBooks
- Ready for accountant to use
- No discrepancies between systems

✅ **Time savings**
- 2-3 hours/day saved (no QB data entry)
- 10-15 hours/week saved
- 40-60 hours/month saved

---

## Troubleshooting Guide

### "Customer not syncing to QuickBooks"

**Check:**
1. QuickBooks connection active? (Settings → QuickBooks)
2. Customer has valid email? (QB requires email for some operations)
3. Duplicate customer in QB? (check by email/name, link instead)
4. Check sync queue status (QuickBooks page)
5. Check error message in sync queue
6. Try manual "Sync to QB" button

---

### "Invoice sync failed"

**Check:**
1. Customer has QB ID? (must sync customer first)
2. All items have QB IDs? (must sync items first)
3. Invoice number unique? (shouldn't happen, but check)
4. Totals calculated correctly? (verify math)
5. Check error message in sync queue
6. Try manual "Retry Sync" button

---

### "Payment status not updating in Batchly"

**Check:**
1. Payment recorded in QB? (verify in QuickBooks)
2. Last payment sync time? (should run daily at 2 AM)
3. Invoice has QB ID? (must be synced to QB first)
4. QB Invoice ID matches? (check invoices table)
5. Run manual "Sync Payments Now"
6. Check sync queue for errors

---

### "Items not appearing in Batchly"

**Check:**
1. Items active in QuickBooks? (inactive items may not sync)
2. Items are "Product" or "Service" type? (not "Non-Inventory")
3. Last item sync time? (should run daily at 4 AM)
4. Run manual "Sync Items Now"
5. Check sync queue for errors
6. Create item in QB first, then sync

---

## Final Checklist: Never Touch QB Again

**After setup, you should NEVER need to:**
- [ ] Create invoices in QuickBooks ✅ Done in Batchly
- [ ] Create customers in QuickBooks ✅ Done in Batchly
- [ ] Edit customer data in QuickBooks ✅ Done in Batchly
- [ ] Enter sales transactions in QuickBooks ✅ Synced from Batchly
- [ ] Manually sync data between systems ✅ Automatic
- [ ] Reconcile invoice numbers ✅ Always match
- [ ] Fix data discrepancies ✅ Single source of truth

**You ONLY use QuickBooks for:**
- [ ] Viewing financial reports ✅ Accountant task
- [ ] Bank reconciliation ✅ Accountant task
- [ ] Tax preparation ✅ Accountant task
- [ ] Expense tracking (bills, purchases) ✅ Separate workflow

---

**Result: Batchly is your operational hub. QuickBooks is your financial reporting tool. They work together seamlessly, and you never have to touch QuickBooks for daily operations!** 🎉
