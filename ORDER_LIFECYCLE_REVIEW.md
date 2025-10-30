# Order Lifecycle Implementation Review Checklist

**Feature:** Order Stages & Lifecycle System
**Date:** TBD (when Lovable completes)
**Reviewer:** Use this checklist to verify implementation

---

## Quick Review Summary

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Overall Assessment:**
- [ ] Database schema correct
- [ ] Order status flow works
- [ ] Date-based filtering works
- [ ] Editing restrictions enforced
- [ ] Invoice generation works
- [ ] UI/UX polished
- [ ] Edge cases handled

---

## Part 1: Database Schema (CRITICAL)

### Check Schema Changes

```sql
-- Run this to verify schema
\d sales_order

-- Should see:
-- status column (VARCHAR(20), default 'pending')
-- delivery_date column (DATE, NOT NULL)
-- created_from_template column (BOOLEAN, default false)
-- template_id column (UUID, references customer_template)
```

**Verification Steps:**

- [ ] **status column exists**
  - Type: VARCHAR(20)
  - Default: 'pending'
  - Check constraint: status IN ('pending', 'invoiced', 'cancelled')
  - Run: `SELECT status FROM sales_order LIMIT 1;`

- [ ] **delivery_date column exists**
  - Type: DATE
  - NOT NULL constraint
  - Run: `SELECT delivery_date FROM sales_order LIMIT 1;`

- [ ] **created_from_template column exists**
  - Type: BOOLEAN
  - Default: false

- [ ] **template_id column exists**
  - Type: UUID
  - References customer_template(id)
  - Foreign key constraint working

- [ ] **Indexes created**
  ```sql
  -- Check indexes exist
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'sales_order';

  -- Should see:
  -- idx_sales_order_delivery_date
  -- idx_sales_order_org_delivery
  ```

**Test:**
```sql
-- Try creating order with invalid status (should fail)
INSERT INTO sales_order (status, delivery_date, customer_id, organization_id)
VALUES ('invalid_status', '2025-11-01', '...', '...');
-- Expected: Check constraint violation error

-- Try creating order without delivery_date (should fail)
INSERT INTO sales_order (status, customer_id, organization_id)
VALUES ('pending', '...', '...');
-- Expected: NOT NULL constraint violation
```

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 2: Order Status Flow (CRITICAL)

### Check Status Transitions

**Test Scenario 1: PENDING → INVOICED**

- [ ] **Create order in PENDING status**
  - Go to Orders page
  - Create new order
  - Verify status badge shows "Pending" (blue)
  - Verify can edit quantities
  - Verify can add/remove items
  - Verify CANNOT edit prices (grayed out or disabled)

- [ ] **Mark order as INVOICED**
  - Click "Mark as Invoiced" button
  - Verify confirmation dialog appears
  - Confirm action
  - Verify order status changes to "Invoiced" (green badge)
  - Verify invoice is created in Invoice Module
  - Check invoice has correct:
    - Customer
    - Delivery date
    - Line items (only qty > 0)
    - Totals
    - Reference to order ID

- [ ] **Verify order disappears after delivery date**
  - Wait until delivery_date < today (or manually change date in DB)
  - Refresh Orders page
  - Verify order no longer shows in default view
  - Verify can still find via "Show all orders" or status filter

**Test Scenario 2: PENDING → CANCELLED**

- [ ] **Create order in PENDING status**
- [ ] **Click "Cancel Order" button**
  - Verify confirmation dialog: "Confirm cancellation? This will create a No Order invoice."
  - Confirm action
  - Verify order status changes to "Cancelled" (gray badge)
  - Verify "No Order" invoice created
  - Check invoice has:
    - Customer
    - Delivery date
    - $0 total
    - Notes: "Customer declined order - No delivery"
    - Status: cancelled

**Test Scenario 3: Cannot edit after INVOICED**

- [ ] **Create order and mark as INVOICED**
- [ ] **Try to edit the order**
  - Click edit button (should be disabled or hidden)
  - OR if edit opens, verify all fields are read-only
  - Verify message: "Cannot edit invoiced order. Edit invoice instead."

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 3: Date-Based Filtering (HIGH PRIORITY)

### Check Visibility Rules

**Test each day of the week:**

**Thursday:**
- [ ] Orders view shows Friday delivery orders only
- [ ] Does NOT show Saturday, Sunday, Monday orders yet

**Friday:**
- [ ] Orders view shows Saturday delivery orders
- [ ] Orders view shows Sunday delivery orders
- [ ] Orders view shows Monday delivery orders
- [ ] Does NOT show Tuesday orders

**Saturday:**
- [ ] Orders view shows Sunday delivery orders
- [ ] Orders view shows Monday delivery orders
- [ ] Does NOT show Tuesday orders

**Sunday:**
- [ ] Orders view shows Monday delivery orders only
- [ ] Does NOT show Tuesday orders

**Monday:**
- [ ] Orders view shows Tuesday delivery orders only

**Code Check:**
```typescript
// Find this function in the codebase
const getVisibleDeliveryDates = (currentDate: Date) => {
  // Verify logic matches the spec
  // Thursday: show Friday only
  // Friday: show Sat + Sun + Mon
  // Saturday: show Sun + Mon
  // Sunday: show Mon only
  // Monday: show Tue only
  // Tuesday-Wednesday: show next day only
};
```

**Manual Test:**
1. Create orders with different delivery dates (today, tomorrow, +2 days, +3 days)
2. Check which orders are visible in Orders view
3. Change your computer date to different days of week
4. Verify correct orders show each day

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 4: Order Editing Capabilities (CRITICAL)

### Check Edit Restrictions

**Test PENDING order editing:**

- [ ] **Quantity editing works**
  - Open order in edit mode
  - Change quantity from 10 to 5
  - Save
  - Verify quantity updated in database
  - Verify total recalculated

- [ ] **Can set quantity to 0**
  - Set a line item quantity to 0
  - Save
  - Verify line item still exists in order
  - Mark order as Invoiced
  - Verify qty=0 item NOT included in invoice

- [ ] **Can add new items**
  - Click "Add Item" button
  - Search for item in catalog
  - Select item, set quantity
  - Verify item added to order
  - Verify price populated from item catalog

- [ ] **Can remove items**
  - Click "Remove" button on line item
  - OR set quantity to 0
  - Verify item removed or ignored

- [ ] **CANNOT edit prices**
  - Find price column in line items table
  - Verify input is disabled or grayed out
  - Try to click/edit price field
  - Verify price does not change
  - Verify tooltip/message: "Price changes only in Invoice Module"

- [ ] **Database-level price protection**
  ```sql
  -- Try to update price directly in DB (should fail or be ignored)
  UPDATE sales_order_line_items
  SET unit_price = 999.99
  WHERE id = '[some_line_item_id]';

  -- If there's a trigger or RLS policy preventing this, should fail
  -- If no database protection, THIS IS A BUG
  ```

**Test INVOICED order editing:**

- [ ] **Cannot edit invoiced order**
  - Mark order as Invoiced
  - Try to open edit mode
  - Verify edit button disabled or modal is read-only
  - Verify message: "Cannot edit invoiced order"

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 5: Invoice Generation (CRITICAL)

### Check Invoice Creation Logic

**Test Scenario 1: Standard Invoice**

- [ ] **Create order with 3 line items**
  - Item A: qty 10, price $5
  - Item B: qty 5, price $10
  - Item C: qty 0, price $20 (should be ignored)

- [ ] **Mark order as INVOICED**
- [ ] **Verify invoice created with:**
  - Item A: qty 10, price $5, amount $50
  - Item B: qty 5, price $10, amount $50
  - Item C: NOT included (qty was 0)
  - Subtotal: $100
  - Total: $100 (+ tax if applicable)

- [ ] **Verify order reference**
  - Invoice has order_reference_id or similar field
  - Can navigate from invoice back to order

- [ ] **Verify order status updated**
  - Order status is now 'invoiced'
  - Order disappears from Orders view (after delivery date)

**Test Scenario 2: No Order Invoice**

- [ ] **Create order**
- [ ] **Mark order as CANCELLED**
- [ ] **Verify "No Order" invoice created:**
  - Customer correct
  - Delivery date correct
  - Total: $0
  - Status: 'cancelled'
  - Notes: "Customer declined order - No delivery"
  - NO line items (or empty line items)

- [ ] **Verify order status updated**
  - Order status is now 'cancelled'
  - Order disappears from Orders view (after delivery date)

**Test Scenario 3: All items qty = 0**

- [ ] **Create order with 2 items, both qty = 0**
- [ ] **Mark order as INVOICED**
- [ ] **Verify:**
  - Invoice created with $0 total OR
  - System treats as "No Order" OR
  - System shows warning: "All items have qty 0, mark as Cancelled instead?"

**Code Check:**
```typescript
// Find invoice generation functions
generateInvoiceFromOrder(orderId)
generateNoOrderInvoice(orderId)

// Verify:
// 1. Filters line items where qty > 0
// 2. Copies correct fields (customer_id, delivery_date, etc.)
// 3. Updates order status atomically
// 4. Handles errors (transaction rollback if invoice creation fails)
```

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 6: UI Components (HIGH PRIORITY)

### Orders List View

- [ ] **Visual design**
  - Clean, scannable layout
  - Delivery dates prominently displayed
  - Group by delivery date (optional but nice)
  - Status badges color-coded:
    - Pending: Blue
    - Invoiced: Green
    - Cancelled: Gray

- [ ] **Columns shown**
  - Delivery Date
  - Customer Name
  - Status
  - Total Amount
  - Quick Actions (Edit, Mark as Invoiced, Cancel)

- [ ] **Filters work**
  - Delivery date filter (auto-set based on day of week)
  - Customer name search
  - Status filter (pending, invoiced, cancelled, all)
  - Multiple filters work together

- [ ] **Sorting**
  - Default: delivery_date ASC, customer_name ASC
  - Can click column headers to sort

- [ ] **Empty states**
  - No orders for today: "No orders for upcoming deliveries"
  - No search results: "No orders match your filters"

- [ ] **Performance**
  - List loads quickly (< 1 second for 100 orders)
  - Pagination if > 50 orders
  - Loading states shown during fetch

### Order Edit Modal/Page

- [ ] **Layout**
  - Delivery date shown (read-only)
  - Customer name shown (read-only)
  - Line items table with columns:
    - Item Name
    - Quantity (editable if pending)
    - Price (read-only, grayed out)
    - Amount (calculated)
  - Add Item button
  - Remove Item button (per row)
  - Status change buttons at bottom

- [ ] **Interactions**
  - Quantity inputs are number type
  - Can type or use increment/decrement
  - Price column is visually disabled (grayed text)
  - Tooltip on price: "Price changes only in Invoice Module"

- [ ] **Validation**
  - Quantity must be >= 0
  - Cannot save with negative quantities
  - Shows error message if validation fails

- [ ] **Status Change Buttons**
  - "Mark as Invoiced" button (primary/green)
  - "Cancel Order" button (secondary/red)
  - Confirmation dialogs before status change
  - Loading state during invoice generation

### Confirmation Dialogs

- [ ] **Mark as Invoiced confirmation**
  - Title: "Confirm Delivery"
  - Message: "Confirm products delivered? This will create an invoice."
  - Buttons: "Yes, Create Invoice" (primary) | "Cancel" (secondary)

- [ ] **Cancel Order confirmation**
  - Title: "Cancel Order"
  - Message: "Confirm cancellation? This will create a No Order invoice for record keeping."
  - Buttons: "Yes, Cancel Order" (danger) | "Keep Order" (secondary)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 7: Edge Cases & Validation (IMPORTANT)

### Test Each Edge Case

**1. Multiple orders per customer**
- [ ] Create 2 orders for same customer, different delivery dates
- [ ] Verify both show in Orders list
- [ ] Verify can edit both independently
- [ ] Mark one as Invoiced
- [ ] Verify other still in Pending status

**2. Edit after invoiced (should fail)**
- [ ] Mark order as Invoiced
- [ ] Try to edit order
- [ ] Verify edit blocked with message
- [ ] Verify can view order (read-only)

**3. Zero quantity items**
- [ ] Create order with 3 items: qty 10, qty 0, qty 5
- [ ] Mark as Invoiced
- [ ] Verify invoice has only 2 line items (qty 10 and qty 5)
- [ ] Verify qty 0 item excluded

**4. Price changes (should fail in Orders)**
- [ ] Open order in edit mode
- [ ] Try to change price
- [ ] Verify input disabled
- [ ] OR if somehow able to change, verify save fails
- [ ] Verify error message: "Price changes only in Invoice Module"

**5. Missing delivery date (should fail)**
- [ ] Try to create order without delivery date
- [ ] Verify validation error
- [ ] Verify cannot save
- [ ] Message: "Delivery date is required"

**6. Past delivery dates (should fail)**
- [ ] Try to create order with delivery_date < today
- [ ] Verify validation warning or error
- [ ] Message: "Cannot create orders for past dates"
- [ ] OR allow but show warning

**7. Order visibility after delivery date**
- [ ] Create order with delivery_date = today
- [ ] Mark as Invoiced
- [ ] Change system date to tomorrow (or wait)
- [ ] Verify order no longer in default Orders view
- [ ] Verify can still find via "Show all orders" filter

**8. Concurrent edits (optional but important)**
- [ ] Open same order in 2 browser tabs
- [ ] Edit quantity in tab 1, save
- [ ] Edit quantity in tab 2, save
- [ ] Verify: Last write wins OR optimistic locking error
- [ ] No data corruption

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 8: Integration with Existing Features

### Check Integration Points

**Orders → Invoices**
- [ ] Invoice created from order has correct data
- [ ] Invoice references original order (order_reference_id or similar)
- [ ] Can navigate from invoice back to order
- [ ] Invoice sync to QuickBooks works (if QB sync implemented)

**Orders → Customer Templates**
- [ ] Order created from template has template_id set
- [ ] Order has created_from_template = true
- [ ] Can see which template was used (in UI or DB)

**Orders → Dashboard**
- [ ] Dashboard shows order counts
- [ ] "Pending Orders" widget shows correct count
- [ ] Clicking widget navigates to Orders page

**Orders → Customer Portal (if implemented)**
- [ ] Customers can see their pending orders
- [ ] Customers can see order status
- [ ] Customers CANNOT edit orders (read-only)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 9: Security & Permissions (CRITICAL)

### Check RLS Policies

**Organization-level isolation:**
```sql
-- Test: User from Org A cannot see Org B's orders
-- 1. Create order in Org A
-- 2. Switch to user from Org B
-- 3. Try to query sales_order table
-- Expected: Cannot see Org A's order
```

- [ ] **Verify RLS policy on sales_order table**
  ```sql
  SELECT * FROM sales_order WHERE organization_id != '[your_org_id]';
  -- Should return 0 rows (RLS blocks it)
  ```

- [ ] **Verify RLS policy on sales_order_line_items table**
  ```sql
  -- Same test for line items
  ```

**Role-based permissions:**
- [ ] **Admin role**
  - Can create orders
  - Can edit orders (pending status)
  - Can mark as invoiced
  - Can cancel orders

- [ ] **Manager role**
  - Can create orders
  - Can edit orders (pending status)
  - Can mark as invoiced
  - Can cancel orders

- [ ] **User role**
  - Can create orders
  - Can edit orders (pending status)
  - CANNOT mark as invoiced? (check requirements)
  - CANNOT cancel orders? (check requirements)

- [ ] **Customer portal role**
  - Can VIEW orders (read-only)
  - CANNOT edit orders
  - CANNOT change status

**Price change protection:**
- [ ] **UI-level:** Price inputs disabled in Orders edit
- [ ] **Database-level:** Trigger or RLS policy prevents price updates in sales_order context
  ```sql
  -- Test: Try to update price
  UPDATE sales_order_line_items
  SET unit_price = 999.99
  WHERE id = '[line_item_id]';

  -- Expected: Fails or ignored (only Invoice module can change prices)
  ```

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 10: Performance & Optimization

### Check Performance

**Orders List Performance:**
- [ ] Query time < 500ms for 100 orders
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM sales_order
  WHERE delivery_date IN ('[dates]')
    AND organization_id = '[org_id]'
  ORDER BY delivery_date ASC, customer_name ASC;

  -- Check: Uses idx_sales_order_org_delivery index
  ```

- [ ] Page load time < 2 seconds
- [ ] Pagination implemented if > 50 orders
- [ ] Loading states shown during fetch

**Order Edit Performance:**
- [ ] Edit modal opens in < 500ms
- [ ] Line item updates optimistic (instant UI feedback)
- [ ] Save operation < 1 second

**Invoice Generation Performance:**
- [ ] Creating invoice from order takes < 2 seconds
- [ ] UI shows loading state during generation
- [ ] Success message shown after completion

**Database Indexes:**
- [ ] `idx_sales_order_delivery_date` exists and used
- [ ] `idx_sales_order_org_delivery` exists and used
- [ ] Query plans use indexes (not sequential scans)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 11: Error Handling

### Check Error Scenarios

**Network Errors:**
- [ ] Order list fails to load → Shows error message
- [ ] Order save fails → Shows error message, data not lost
- [ ] Invoice generation fails → Shows error, order stays in pending

**Validation Errors:**
- [ ] Negative quantity → Error message, cannot save
- [ ] Missing delivery date → Error message, cannot save
- [ ] Missing customer → Error message, cannot save

**Database Errors:**
- [ ] Duplicate order (if constraint exists) → Friendly error message
- [ ] Foreign key violation → User-friendly error (not raw SQL)
- [ ] Transaction rollback → Data consistent, user notified

**Status Change Errors:**
- [ ] Mark as Invoiced fails → Order stays in Pending, error shown
- [ ] Cancel fails → Order stays in Pending, error shown
- [ ] No retry spam (prevent multiple invoice creations)

**User-Friendly Messages:**
- [ ] No raw error messages shown to user
- [ ] Errors are actionable ("Missing delivery date, please select one")
- [ ] Errors are specific (not generic "Something went wrong")

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Part 12: Code Quality (Review with Developer)

### Code Review Checklist

**TypeScript Types:**
- [ ] Order type includes status, delivery_date fields
- [ ] Status is typed enum (not string): `'pending' | 'invoiced' | 'cancelled'`
- [ ] All database queries typed with Supabase types

**React Query Usage:**
- [ ] Orders list uses `useQuery` with proper cache key
- [ ] Mutations use `useMutation` with `onSuccess` invalidation
- [ ] Optimistic updates for status changes
- [ ] Loading and error states handled

**Database Queries:**
- [ ] No N+1 queries (use joins or `select('*, customer(*)'`)
- [ ] Proper error handling with try/catch
- [ ] Transactions for multi-step operations (order → invoice)

**Edge Functions (if used):**
- [ ] Invoice generation in Edge Function or client-side?
- [ ] Proper error handling and logging
- [ ] Timeout handling (Edge Functions have 6-min limit)

**Component Structure:**
- [ ] Orders list component modular and reusable
- [ ] Order edit modal/component separated
- [ ] Shared components used (Button, Dialog, Table, etc.)

**Testing:**
- [ ] Unit tests for date filtering logic
- [ ] Integration tests for invoice generation
- [ ] E2E tests for critical path (create order → invoice)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Fix

**Issues Found:**
```
[Write any issues here]
```

---

## Final Checklist: Ready for Production?

### Must-Have (Blockers)

- [ ] ✅ Database schema correct and migrated
- [ ] ✅ Order status flow works (pending → invoiced/cancelled)
- [ ] ✅ Date-based filtering works correctly
- [ ] ✅ Cannot edit prices in Orders module
- [ ] ✅ Invoice generation creates correct invoices
- [ ] ✅ No Order invoice created on cancellation
- [ ] ✅ Zero quantity items excluded from invoices
- [ ] ✅ RLS policies prevent cross-org data access
- [ ] ✅ Cannot edit invoiced orders

### Should-Have (Important)

- [ ] ✅ Orders disappear after delivery date
- [ ] ✅ Multiple orders per customer supported
- [ ] ✅ UI is polished and intuitive
- [ ] ✅ Error messages are user-friendly
- [ ] ✅ Performance is acceptable (< 2s page loads)
- [ ] ✅ Confirmation dialogs before status changes

### Nice-to-Have (Can Fix Later)

- [ ] ✅ Order history view (see past orders)
- [ ] ✅ Bulk status changes (mark multiple as invoiced)
- [ ] ✅ Email notifications on status changes
- [ ] ✅ Audit log of order changes

---

## Issues Log

### Critical Issues (Fix Before Launch)
```
1. [Issue description]
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:
   - Fix priority: HIGH

2. [Issue description]
   ...
```

### Medium Issues (Fix Soon)
```
1. [Issue description]
   ...
```

### Low Issues (Nice to Fix)
```
1. [Issue description]
   ...
```

---

## Approval & Sign-Off

**Reviewed By:** ___________________
**Date:** ___________________

**Status:**
- [ ] ✅ Approved for Production
- [ ] ⚠️ Approved with Minor Issues (document above)
- [ ] ❌ Not Approved (Critical Issues must be fixed)

**Notes:**
```
[Any final notes or observations]
```

---

## Quick Test Script (Copy-Paste)

Run these commands to quickly test the implementation:

```sql
-- 1. Check schema
\d sales_order

-- 2. Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'sales_order';

-- 3. Test status constraint
INSERT INTO sales_order (status, delivery_date, customer_id, organization_id)
VALUES ('invalid', '2025-11-01', '[uuid]', '[uuid]');
-- Should fail

-- 4. Check existing orders
SELECT id, status, delivery_date, customer_id
FROM sales_order
WHERE organization_id = '[your_org]'
ORDER BY delivery_date DESC
LIMIT 10;

-- 5. Test RLS policy
SET ROLE authenticated;
SELECT * FROM sales_order WHERE organization_id != '[your_org]';
-- Should return 0 rows
```

**UI Test Flow:**
```
1. Go to /orders
2. Click "New Order"
3. Select customer, delivery date (tomorrow)
4. Add 3 items with quantities
5. Save → Verify order shows in list with "Pending" status
6. Click "Edit"
7. Try to change price → Should be disabled
8. Change quantity of one item to 0
9. Save
10. Click "Mark as Invoiced"
11. Confirm → Verify invoice created
12. Check invoice has only 2 line items (qty > 0 items)
13. Go back to /orders
14. Verify order no longer shows (or shows as "Invoiced")
15. ✅ Test complete!
```

---

## Related Documents

- **INTERNAL_LAUNCH.md** - Overall launch plan
- **QBO_SYNC_STRATEGY.md** - QuickBooks integration (invoice sync)
- **SESSION_SUMMARY.md** - Overall Batchly strategy

---

**Next Steps After Review:**
1. Document all issues found
2. Prioritize issues (critical, medium, low)
3. Fix critical issues before launch
4. Test again after fixes
5. Deploy to production when approved ✅
