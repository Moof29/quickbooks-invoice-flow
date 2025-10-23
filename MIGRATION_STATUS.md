# Sales Order → Invoice Unification Migration Status

## Current State Analysis (2025-10-23)

### ❌ DATABASE MIGRATION: **NOT APPLIED**

The database migration file exists but has NOT been applied:
- **File**: `supabase/migrations/20251023000000_unify_sales_order_invoice.sql`
- **Status**: Created, committed, but not yet run against the database

**Evidence**:
- `invoice_record` table is **missing** these columns:
  - `delivery_date`
  - `order_date`
  - `is_no_order`
  - `approved_at`, `approved_by`
  - `promised_ship_date`, `requested_ship_date`
  - `customer_po_number`

- `sales_order` table **still exists** (should be renamed to `sales_order_archived`)

### ⚠️ FRONTEND MIGRATION: **PARTIALLY COMPLETE** (Phase 1 only, ~40%)

#### Files Updated by Lovable:
1. ✅ `src/hooks/useSalesOrderEdit.tsx` - Updated to use invoice_record
2. ⚠️ `src/components/CreateSalesOrderDialog.tsx` - Updated but has TypeScript errors
3. ⚠️ `src/components/CreateSalesOrderSheet.tsx` - Updated but has TypeScript errors
4. ⚠️ `src/components/ModernSalesOrdersList.tsx` - Partially updated (still references .invoiced field)

#### Files NOT Updated (Still use sales_order):
1. ❌ `src/components/SalesOrdersList.tsx`
2. ❌ `src/components/SalesOrderConvertToInvoiceButton.tsx`
3. ❌ `src/components/SalesOrderApprovalButton.tsx`
4. ❌ `src/components/SalesOrderDialog.tsx`
5. ❌ `src/pages/SalesOrders.tsx`
6. ❌ `src/pages/SalesOrderDetails.tsx`
7. ❌ `src/pages/NewSalesOrder.tsx`
8. ❌ `src/pages/Dashboard.tsx` (references to sales orders)
9. ❌ Portal pages (PortalOrders.tsx, PortalDashboard.tsx)

#### Navigation/Routing NOT Updated:
1. ❌ `src/App.tsx` - Still has `/sales-orders` routes
2. ❌ `src/components/AppSidebar.tsx` - Still has "Sales Orders" menu item

### Issues with Current Phase 1 Changes:

1. **Column Mismatch**: Code references columns that don't exist in invoice_record
2. **TypeScript Errors**: Using `@ts-ignore` to bypass deep type instantiation errors
3. **Query Key Mismatch**: Still invalidating `['sales-orders']` instead of `['invoices']`
4. **Mixed References**: Some files use invoice_record, others still use sales_order
5. **Boolean → Status Migration Incomplete**: References to `.invoiced` field still exist

---

## Correct Migration Order

### STEP 1: Apply Database Migration FIRST ⚠️ **MUST DO THIS FIRST**

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to: https://supabase.com/dashboard/project/pnqcbnmrfzqihymmzhkb/sql/new
2. Copy entire contents of: `supabase/migrations/20251023000000_unify_sales_order_invoice.sql`
3. Paste and run
4. Verify in Table Editor that:
   - `sales_order` → `sales_order_archived`
   - `invoice_record` has new columns

**Option B: Via Lovable**
Ask Lovable to run the migration using Supabase CLI

**Option C: Via CLI (if you have access)**
```bash
npx supabase db push --linked
```

### STEP 2: Regenerate TypeScript Types

After migration is applied:
```bash
npx supabase gen types typescript --project-id pnqcbnmrfzqihymmzhkb > src/integrations/supabase/types.ts
```

### STEP 3: Then Complete Frontend Migration (Phases 1-6)

Only AFTER Steps 1-2 are complete, proceed with the 6 phases.

---

## Why This Order Matters

1. **Database changes must come first** - The frontend code depends on database structure
2. **Type generation must be second** - TypeScript types are generated from database schema
3. **Frontend updates must be last** - Code references database columns that must exist first

Attempting to update the frontend before the database migration causes:
- TypeScript type errors
- Runtime errors (missing columns)
- Need for temporary `@ts-ignore` workarounds
- Data loss risk if migrations run out of order

---

## Next Steps

1. **STOP all frontend work**
2. **Apply the database migration** (Step 1 above)
3. **Regenerate types** (Step 2 above)
4. **THEN** proceed with clean Phase 1-6 prompts (see LOVABLE_PROMPTS.md)
