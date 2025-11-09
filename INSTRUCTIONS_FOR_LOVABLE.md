# Implementation Instructions for Lovable

**Date:** November 9, 2025
**Task:** Apply QuickBooks API alignment changes to Batchly Supabase instance
**Review:** Claude will review your work after completion

---

## 📋 Overview

You need to implement database schema changes and deploy new/updated functions to align Batchly with the QuickBooks Online API. These changes fix critical bugs and add missing functionality for order-taking and payment tracking.

**CRITICAL:** These changes include a database schema change that renames a column. Follow the steps EXACTLY in the order given.

---

## ✅ Pre-Implementation Checklist

Before you start, verify:
- [ ] You have access to the Supabase dashboard
- [ ] You have the Supabase CLI installed and configured
- [ ] You are connected to the correct Supabase project
- [ ] You have a database backup or can restore if needed
- [ ] All migrations files exist in `supabase/migrations/` directory

---

## 🗄️ PART 1: Apply Database Migrations

### **IMPORTANT: Run migrations in EXACT order**

These migrations must be applied sequentially because they build on each other.

### **Step 1.1: Apply Item Table Migration**

**File:** `supabase/migrations/20251109120000_align_items_with_qbo_api.sql`

**What it does:**
- Renames `item_record.purchase_cost` → `item_record.unit_price` (CRITICAL BUG FIX)
- Adds new `purchase_cost` column (for actual cost price)
- Adds 28 new fields for inventory, accounting, tax, hierarchy, vendor tracking
- Creates 6 performance indexes

**How to apply:**

**Option A: Using Supabase Dashboard (RECOMMENDED)**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the ENTIRE contents of `supabase/migrations/20251109120000_align_items_with_qbo_api.sql`
4. Paste into the SQL editor
5. Click "Run" or press Ctrl/Cmd + Enter
6. **VERIFY:** You should see "Success. No rows returned" or similar success message
7. **VERIFY:** Check that no errors appeared

**Option B: Using Supabase CLI**
```bash
# Run this specific migration
supabase db push --file supabase/migrations/20251109120000_align_items_with_qbo_api.sql
```

**Verification Steps:**
Run this query to verify the changes:
```sql
-- Check that unit_price column exists and purchase_cost was renamed
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'item_record'
  AND column_name IN ('unit_price', 'purchase_cost', 'quantity_on_hand', 'taxable')
ORDER BY column_name;
```

**Expected result:** You should see these 4 columns exist.

---

### **Step 1.2: Apply Payment Tracking Migration**

**File:** `supabase/migrations/20251109120001_enhance_payment_tracking.sql`

**What it does:**
- Adds 16 new fields to `invoice_payment` table for QBO sync, gateway integration, reconciliation
- Creates unique constraint on `(organization_id, qbo_id)`
- Creates 6 performance indexes

**How to apply:**

**Option A: Using Supabase Dashboard (RECOMMENDED)**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the ENTIRE contents of `supabase/migrations/20251109120001_enhance_payment_tracking.sql`
4. Paste into the SQL editor
5. Click "Run"
6. **VERIFY:** Success message appears

**Option B: Using Supabase CLI**
```bash
supabase db push --file supabase/migrations/20251109120001_enhance_payment_tracking.sql
```

**Verification Steps:**
Run this query:
```sql
-- Check that new payment columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoice_payment'
  AND column_name IN ('qbo_id', 'qbo_sync_status', 'deposit_account_ref', 'unapplied', 'payment_status')
ORDER BY column_name;
```

**Expected result:** All 5 columns should exist.

---

### **Step 1.3: Apply Customer Billing Migration**

**File:** `supabase/migrations/20251109120002_enhance_customer_billing.sql`

**What it does:**
- Adds 30+ fields to `customer_profile` table for credit management, shipping, tax, billing
- Creates 7 performance indexes

**How to apply:**

**Option A: Using Supabase Dashboard (RECOMMENDED)**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the ENTIRE contents of `supabase/migrations/20251109120002_enhance_customer_billing.sql`
4. Paste into the SQL editor
5. Click "Run"
6. **VERIFY:** Success message appears

**Option B: Using Supabase CLI**
```bash
supabase db push --file supabase/migrations/20251109120002_enhance_customer_billing.sql
```

**Verification Steps:**
Run this query:
```sql
-- Check that new customer columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customer_profile'
  AND column_name IN ('payment_terms', 'credit_limit', 'shipping_address_line1', 'tax_exempt', 'overdue_balance')
ORDER BY column_name;
```

**Expected result:** All 5 columns should exist.

---

## 🚀 PART 2: Deploy Edge Functions

### **Step 2.1: Deploy Updated Item Sync Function**

**File:** `supabase/functions/qbo-sync-items/index.ts`

**What changed:**
- Fixed incorrect `UnitPrice` → `purchase_cost` mapping (now correctly maps to `unit_price`)
- Added mapping for 28+ new fields (inventory, accounts, tax, hierarchy, vendor, sync metadata)

**How to deploy:**

```bash
# Navigate to project root
cd /home/user/quickbooks-invoice-flow

# Deploy the updated function
supabase functions deploy qbo-sync-items
```

**Expected output:**
```
Deploying qbo-sync-items (project ref: your-project-ref)
✓ Deployed function qbo-sync-items
```

**Verification:**
1. Go to Supabase Dashboard → Edge Functions
2. Find `qbo-sync-items` in the list
3. Check that "Last deployed" timestamp is recent (within last few minutes)

---

### **Step 2.2: Deploy New Payment Sync Function**

**File:** `supabase/functions/qbo-sync-payments/index.ts` (NEW)

**What it does:**
- Pulls payment records from QuickBooks API
- Maps QBO Payment entity to `invoice_payment` table
- Handles payments applied to multiple invoices
- Handles unapplied payments (advance payments)
- Links payments to customers and invoices

**How to deploy:**

```bash
# Deploy the NEW payment sync function
supabase functions deploy qbo-sync-payments
```

**Expected output:**
```
Deploying qbo-sync-payments (project ref: your-project-ref)
✓ Deployed function qbo-sync-payments
```

**Verification:**
1. Go to Supabase Dashboard → Edge Functions
2. Confirm `qbo-sync-payments` appears in the list
3. Check that status is "Active" or "Ready"

---

## 🧪 PART 3: Test the Implementation

### **Test 3.1: Verify Item Sync Works**

**Goal:** Ensure the updated item sync function works with new schema

**Steps:**

1. **Trigger item sync** (use your existing UI or API endpoint):
   ```javascript
   // Example API call (adjust endpoint as needed)
   await fetch('/api/qbo-sync-items', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       organizationId: 'YOUR_ORG_ID',
       direction: 'pull'
     })
   });
   ```

2. **Check sync results:**
   ```sql
   -- Check if items were synced recently
   SELECT
     id,
     name,
     unit_price,        -- Should have selling price
     purchase_cost,     -- Should have cost price (may be null)
     quantity_on_hand,  -- Should have inventory qty
     taxable,           -- Should be true/false
     last_sync_at       -- Should be recent timestamp
   FROM item_record
   WHERE organization_id = 'YOUR_ORG_ID'
   ORDER BY last_sync_at DESC
   LIMIT 5;
   ```

3. **Verify no errors in function logs:**
   - Go to Supabase Dashboard → Edge Functions → qbo-sync-items → Logs
   - Check for any error messages
   - Successful sync should show "Successfully saved X items to database"

**Expected results:**
- ✅ Items sync without errors
- ✅ `unit_price` contains selling prices (not null for most items)
- ✅ `quantity_on_hand` contains inventory quantities
- ✅ `last_sync_at` is a recent timestamp

---

### **Test 3.2: Verify Payment Sync Works (NEW)**

**Goal:** Ensure the new payment sync function pulls payments from QuickBooks

**Steps:**

1. **Trigger payment sync:**
   ```javascript
   // Example API call (adjust endpoint as needed)
   await fetch('/api/qbo-sync-payments', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       organizationId: 'YOUR_ORG_ID',
       direction: 'pull'
     })
   });
   ```

2. **Check sync results:**
   ```sql
   -- Check if payments were synced
   SELECT
     id,
     qbo_id,              -- Should have QB payment ID
     customer_id,         -- Should link to customer
     invoice_id,          -- Should link to invoice (or null for unapplied)
     payment_date,
     amount,
     payment_method,
     qbo_sync_status,     -- Should be 'synced'
     unapplied            -- Should be true/false
   FROM invoice_payment
   WHERE organization_id = 'YOUR_ORG_ID'
     AND qbo_id IS NOT NULL
   ORDER BY payment_date DESC
   LIMIT 10;
   ```

3. **Verify invoice amounts updated:**
   ```sql
   -- Check that invoice amount_paid was updated by trigger
   SELECT
     i.invoice_number,
     i.total,
     i.amount_paid,
     i.amount_due,        -- Should be total - amount_paid
     i.status,            -- Should be 'paid' if amount_due = 0
     COUNT(p.id) as payment_count
   FROM invoice_record i
   LEFT JOIN invoice_payment p ON p.invoice_id = i.id
   WHERE i.organization_id = 'YOUR_ORG_ID'
     AND i.amount_paid > 0
   GROUP BY i.id, i.invoice_number, i.total, i.amount_paid, i.amount_due, i.status
   ORDER BY i.invoice_date DESC
   LIMIT 10;
   ```

4. **Check function logs:**
   - Go to Supabase Dashboard → Edge Functions → qbo-sync-payments → Logs
   - Look for "Successfully saved X payment records to database"
   - Check for any errors

**Expected results:**
- ✅ Payments sync from QuickBooks without errors
- ✅ `invoice_payment` records have `qbo_id` populated
- ✅ Payments link to correct customers and invoices
- ✅ Invoice `amount_paid` and `status` update automatically
- ✅ Unapplied payments are stored with `customer_id` but no `invoice_id`

---

### **Test 3.3: Verify Customer Fields Are Available**

**Goal:** Confirm new customer fields can be accessed

**Steps:**

1. **Check customer table structure:**
   ```sql
   -- List all new customer columns
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'customer_profile'
     AND column_name IN (
       'payment_terms',
       'credit_limit',
       'credit_hold',
       'shipping_address_line1',
       'tax_exempt',
       'overdue_balance',
       'days_past_due',
       'billing_frequency'
     )
   ORDER BY column_name;
   ```

2. **Test updating a customer with new fields:**
   ```sql
   -- Update a test customer (replace with real customer ID)
   UPDATE customer_profile
   SET
     payment_terms = 'Net 30',
     credit_limit = 10000.00,
     shipping_address_line1 = '123 Shipping St',
     tax_exempt = false,
     billing_frequency = 'monthly'
   WHERE id = 'TEST_CUSTOMER_ID'
   RETURNING id, display_name, payment_terms, credit_limit;
   ```

**Expected results:**
- ✅ All 8 columns exist
- ✅ Update query succeeds without errors
- ✅ Values are stored correctly

---

## 📊 PART 4: Data Validation

### **Step 4.1: Check for Data Integrity Issues**

Run these queries to ensure data is consistent:

```sql
-- 1. Check for items with missing prices after migration
SELECT COUNT(*) as items_without_price
FROM item_record
WHERE is_active = true
  AND unit_price IS NULL
  AND item_type IN ('Service', 'NonInventory', 'Inventory');
-- Should be low or 0

-- 2. Check for duplicate QBO payment IDs (should be 0)
SELECT qbo_id, COUNT(*) as duplicate_count
FROM invoice_payment
WHERE qbo_id IS NOT NULL
GROUP BY qbo_id, organization_id
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- 3. Check invoice payment totals match
SELECT
  i.invoice_number,
  i.amount_paid as invoice_amount_paid,
  COALESCE(SUM(p.amount), 0) as calculated_payment_total,
  i.amount_paid - COALESCE(SUM(p.amount), 0) as difference
FROM invoice_record i
LEFT JOIN invoice_payment p ON p.invoice_id = i.id
WHERE i.organization_id = 'YOUR_ORG_ID'
GROUP BY i.id, i.invoice_number, i.amount_paid
HAVING ABS(i.amount_paid - COALESCE(SUM(p.amount), 0)) > 0.01
ORDER BY difference DESC;
-- Should return 0 rows or very few (minor rounding differences OK)

-- 4. Check that all QBO-synced items have sync_token
SELECT COUNT(*) as items_without_sync_token
FROM item_record
WHERE qbo_id IS NOT NULL
  AND qbo_sync_token IS NULL;
-- Should decrease after re-sync
```

---

## 📝 PART 5: Documentation & Completion Report

### **Step 5.1: Create Completion Summary**

After completing all steps, create a file documenting what was done:

**Create file:** `IMPLEMENTATION_REPORT.md`

**Contents should include:**

```markdown
# Implementation Report: QuickBooks API Alignment

**Date:** [Current Date]
**Implemented by:** Lovable
**To be reviewed by:** Claude

## ✅ Completed Tasks

### Database Migrations
- [ ] Applied: 20251109120000_align_items_with_qbo_api.sql
  - Result: Success / Error (describe any issues)
  - Verification query result: [paste result]

- [ ] Applied: 20251109120001_enhance_payment_tracking.sql
  - Result: Success / Error
  - Verification query result: [paste result]

- [ ] Applied: 20251109120002_enhance_customer_billing.sql
  - Result: Success / Error
  - Verification query result: [paste result]

### Function Deployments
- [ ] Deployed: qbo-sync-items (updated)
  - Deployment timestamp: [timestamp]
  - Test sync result: Success / Error
  - Number of items synced: [number]

- [ ] Deployed: qbo-sync-payments (new)
  - Deployment timestamp: [timestamp]
  - Test sync result: Success / Error
  - Number of payments synced: [number]

### Testing Results
- [ ] Item sync test: PASS / FAIL
  - Details: [any issues or notes]

- [ ] Payment sync test: PASS / FAIL
  - Details: [any issues or notes]

- [ ] Customer fields test: PASS / FAIL
  - Details: [any issues or notes]

### Data Validation
- [ ] Items without price: [count]
- [ ] Duplicate payment QBO IDs: [count] (should be 0)
- [ ] Invoice payment total mismatches: [count] (should be 0)

## 🐛 Issues Encountered

[List any errors, warnings, or unexpected behavior]

## 📊 Statistics

- Total items in database: [count]
- Items with unit_price: [count]
- Items with quantity_on_hand: [count]
- Total payments synced from QBO: [count]
- Total customers with new fields: [count]

## 🔄 Next Steps

[Any recommendations or follow-up actions needed]

## 📎 Logs & Evidence

[Attach or paste relevant log excerpts, error messages, query results]
```

---

## 🚨 Troubleshooting Guide

### **Issue: Migration fails with "column already exists"**

**Cause:** Migration was partially applied before
**Solution:**
```sql
-- Check what columns already exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'item_record'
ORDER BY column_name;

-- If column exists, comment out that specific ALTER TABLE line in migration
-- Then re-run the migration
```

---

### **Issue: Function deployment fails**

**Cause:** Supabase CLI not authenticated or wrong project
**Solution:**
```bash
# Re-login to Supabase
supabase login

# Link to correct project
supabase link --project-ref YOUR_PROJECT_REF

# Try deployment again
supabase functions deploy qbo-sync-items
```

---

### **Issue: Item sync fails with "column does not exist"**

**Cause:** Migration wasn't applied before deploying function
**Solution:**
1. Check that migration was applied successfully
2. Re-run migration if needed
3. Re-deploy function

---

### **Issue: Payment sync returns "Customer not found"**

**Cause:** Customer records from QBO haven't been synced yet
**Solution:**
```javascript
// Sync customers first, then payments
await fetch('/api/qbo-sync-customers', {
  method: 'POST',
  body: JSON.stringify({ organizationId: 'XXX', direction: 'pull' })
});

// Then sync payments
await fetch('/api/qbo-sync-payments', {
  method: 'POST',
  body: JSON.stringify({ organizationId: 'XXX', direction: 'pull' })
});
```

---

### **Issue: Invoice amounts don't update after payment sync**

**Cause:** Trigger `update_invoice_payment_totals` may not be working
**Solution:**
```sql
-- Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%invoice_payment%';

-- Manually recalculate if needed
UPDATE invoice_record i
SET amount_paid = (
  SELECT COALESCE(SUM(amount), 0)
  FROM invoice_payment p
  WHERE p.invoice_id = i.id
)
WHERE organization_id = 'YOUR_ORG_ID';
```

---

## ✅ Final Checklist

Before reporting completion to Claude:

- [ ] All 3 migrations applied successfully
- [ ] Both functions deployed successfully (qbo-sync-items updated, qbo-sync-payments new)
- [ ] Item sync test passed (items have unit_price, quantity_on_hand populated)
- [ ] Payment sync test passed (payments linked to invoices, amounts updated)
- [ ] Customer fields test passed (new columns exist and writable)
- [ ] Data validation queries show no major issues
- [ ] Implementation report created with results
- [ ] All errors/warnings documented
- [ ] Function logs reviewed for errors

---

## 📞 Handoff to Claude

Once all steps are complete, create a message for Claude that includes:

1. **Status:** All complete / Partial completion / Blocked
2. **Summary:** Brief description of what was done
3. **Results:** Key statistics (items synced, payments synced, etc.)
4. **Issues:** Any errors or unexpected behavior
5. **Questions:** Anything that needs clarification

**Example handoff message:**

```
Claude,

I've completed the QuickBooks API alignment implementation:

✅ STATUS: All steps completed successfully

📊 RESULTS:
- Applied all 3 database migrations without errors
- Deployed qbo-sync-items (updated) and qbo-sync-payments (new)
- Item sync: 247 items synced, all have unit_price populated
- Payment sync: 1,432 payment records synced from QuickBooks
- Invoice amounts updated automatically via trigger

⚠️ NOTES:
- 12 items don't have quantity_on_hand (they are Service type items, which is expected)
- 3 payments couldn't be linked to invoices (invoices don't exist locally yet)

📎 DETAILS:
See IMPLEMENTATION_REPORT.md for full results and logs.

Ready for your review.
```

---

## 📚 Reference Files

- **Analysis:** `ALIGNMENT_ANALYSIS.md` (comprehensive background)
- **Migration 1:** `supabase/migrations/20251109120000_align_items_with_qbo_api.sql`
- **Migration 2:** `supabase/migrations/20251109120001_enhance_payment_tracking.sql`
- **Migration 3:** `supabase/migrations/20251109120002_enhance_customer_billing.sql`
- **Updated Function:** `supabase/functions/qbo-sync-items/index.ts`
- **New Function:** `supabase/functions/qbo-sync-payments/index.ts`

---

**Good luck with the implementation! Follow the steps carefully and document everything.**
