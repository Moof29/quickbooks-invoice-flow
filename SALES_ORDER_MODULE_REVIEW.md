# Sales Order Module - Comprehensive Review

**Date**: October 23, 2025
**Status**: Ready for Review

---

## 📋 Action Inventory

### ✅ Order Creation Actions
| Action | Component | Expected Behavior | Status | Notes |
|--------|-----------|-------------------|--------|-------|
| Create Order (Manual) | CreateSalesOrderDialog.tsx | Creates order with status='confirmed' | ✅ Fixed | |
| Create Order (Sheet) | CreateSalesOrderSheet.tsx | Creates order with status='confirmed' | ✅ Fixed | |
| Generate from Templates | GenerateDailyOrdersButton.tsx | Creates orders with status='draft' | ✅ Fixed | |
| Copy from Yesterday | CreateSalesOrderDialog.tsx | Copies line items from previous order | 🔍 Review | |
| Duplicate Order Check | CreateSalesOrderDialog.tsx | Warns if duplicate exists | 🔍 Review | |

### 🔍 Status Transition Actions
| Action | From Status | To Status | Component | Notes |
|--------|-------------|-----------|-----------|-------|
| Confirm Order | draft | confirmed | SalesOrderApprovalButton.tsx | 🔍 Review |
| Mark as Delivered | confirmed | delivered | ? | ❓ Missing? |
| Record Payment | delivered | paid | ? | ❓ Missing? |
| Cancel Order | any | cancelled | ? | ❓ Missing? |

### 📝 Order Management Actions
| Action | Component/Page | Expected Behavior | Status | Notes |
|--------|----------------|-------------------|--------|-------|
| View Order List | SalesOrders.tsx | Shows filtered list by status | 🔍 Review | |
| View Order Details | SalesOrderDetails.tsx | Shows full order info + line items | 🔍 Review | |
| Edit Order | ? | Modify order fields | ❓ Missing? | Can orders be edited? |
| Delete Order | SalesOrders.tsx | Delete order (with confirmation) | 🔍 Review | |
| Filter by Status | SalesOrders.tsx | Tabs: draft/confirmed/delivered/paid | 🔍 Review | |
| Search Orders | ? | Search by customer/order# | ❓ Missing? | |
| Sort Orders | ? | Sort by date/customer/total | 🔍 Review | |

### 🔢 Bulk Actions
| Action | Component | Expected Behavior | Status | Notes |
|--------|-----------|-------------------|--------|-------|
| Bulk Select | SalesOrders.tsx | Select multiple orders | 🔍 Review | |
| Bulk Confirm | SalesOrders.tsx | draft → confirmed (multiple) | 🔍 Review | |
| Bulk Deliver | SalesOrders.tsx | confirmed → delivered (multiple) | 🔍 Review | |
| Bulk Delete | SalesOrders.tsx | Delete multiple orders | 🔍 Review | |

---

## 🔍 DETAILED REVIEW TASKS

### Task 1: Verify Create Order Flow
**Status**: ✅ Already Fixed

- [x] Manual creation → status='confirmed'
- [x] Template generation → status='draft'
- [x] Invoice number auto-generated
- [x] Line items save correctly

---

### Task 2: Review "Confirm Order" Button
**Component**: `SalesOrderApprovalButton.tsx`

**Questions to Answer:**
1. Does it only show for `status='draft'` orders?
2. Does it update to `status='confirmed'`?
3. Does it set `approved_at` and `approved_by`?
4. Does it refresh the list after confirmation?
5. Is there a loading state?
6. Is there error handling?

**Test Scenario:**
1. Generate orders from templates
2. Find a draft order
3. Click "Confirm Order" button
4. Verify status changes to 'confirmed'
5. Verify approved_at/approved_by are set

---

### Task 3: Check for "Mark as Delivered" Button
**Expected**: Button to transition confirmed → delivered

**Questions:**
1. Does this button exist? Where?
2. What component handles this?
3. Is it only visible for 'confirmed' status?
4. Does it update status to 'delivered'?

**Search Needed:**
```bash
grep -r "delivered\|Delivered" src/components/SalesOrder*.tsx
grep -r "status.*delivered" src/pages/SalesOrder*.tsx
```

---

### Task 4: Check for "Record Payment" Button
**Expected**: Button to transition delivered → paid

**Questions:**
1. Does this button exist?
2. Should it create a payment_record entry?
3. Or just manually set status='paid'?
4. Where should this button appear?

**Decision Needed:**
- Should payment recording be manual OR automatic via payment_record table?

---

### Task 5: Review Bulk Actions
**Component**: `SalesOrders.tsx` (lines 70-100)

**Current Implementation:**
- Has bulk selection checkboxes
- Has `bulkUpdateMutation` function
- Manually updates each invoice in loop

**Issues to Check:**
1. Are bulk action buttons visible?
2. Do they only show for appropriate statuses?
3. Is there a progress indicator for bulk operations?
4. What happens if some succeed and some fail?
5. Are there race conditions with concurrent updates?

**Performance Concern:**
- Currently updates in a loop (sequential)
- Should use `bulk_update_invoice_status()` RPC function instead
- Will be slow with 50+ orders

---

### Task 6: Review Delete Order Functionality
**Component**: `SalesOrders.tsx`

**Questions:**
1. Is there a delete button?
2. Does it require confirmation?
3. Can all statuses be deleted or only draft?
4. Does it delete line items too (cascade)?
5. Is there an undo option?

**Test Scenario:**
1. Try to delete a draft order
2. Try to delete a confirmed order
3. Try to delete a delivered order
4. Verify confirmation dialog appears
5. Verify line items are also deleted

---

### Task 7: Test Filters and Search
**Component**: `SalesOrders.tsx`

**Current Filters:**
- Status tabs: draft, confirmed, delivered, paid, cancelled, partial, all, templates

**Missing:**
- Date range filter
- Customer filter
- Search by order number
- Search by customer name

**Questions:**
1. Can users easily find "today's orders"?
2. Can users find orders for a specific customer?
3. Can users search by order number?

---

### Task 8: Review Order Details Page
**Component**: `SalesOrderDetails.tsx`

**Expected Features:**
- View all order fields
- View line items table
- Action buttons based on status
- Edit capability (?)
- Back to list link

**Questions:**
1. Does it load correctly?
2. Are line items displayed in a table?
3. Are action buttons appropriate for status?
4. Can users navigate back easily?
5. Is there a "Edit Order" button?

---

### Task 9: Test Duplicate Order Prevention
**Component**: `CreateSalesOrderDialog.tsx` (lines 345-365)

**Current Implementation:**
- Calls `check_duplicate_orders` RPC
- Shows warning dialog if duplicate found
- Allows user to create anyway

**Questions:**
1. Does the duplicate check work?
2. Is the warning dialog clear?
3. What defines a "duplicate"? (same customer + same delivery date)
4. Should templates also check for duplicates? (they do in GenerateDailyOrdersButton)

---

### Task 10: Verify "Copy from Yesterday" Feature
**Component**: `CreateSalesOrderDialog.tsx` (lines 165-180)

**Current Implementation:**
- Queries yesterday's order for selected customer
- Button appears if found
- Copies line items when clicked

**Questions:**
1. Does the query work correctly?
2. Does the button appear when expected?
3. Do line items copy correctly?
4. Does it preserve quantities and prices?

---

## 🎯 Success Criteria

Module review complete when:

- [ ] All actions tested and working correctly
- [ ] Status transitions work as expected
- [ ] Bulk operations are performant (< 5 sec for 50 orders)
- [ ] Error handling is robust
- [ ] UI is intuitive (users don't get confused)
- [ ] No missing critical functionality
- [ ] All edge cases handled

---

## 📝 Issues Found

### Critical Issues
*To be filled during review*

### Medium Priority
*To be filled during review*

### Nice-to-Have Improvements
*To be filled during review*

---

## 🚀 Next Steps

1. Work through Tasks 2-10 with Lovable
2. Document any issues found
3. Fix critical issues
4. Consider performance optimizations
5. Move to Invoice Module review

---

**Status**: Ready to begin systematic review
