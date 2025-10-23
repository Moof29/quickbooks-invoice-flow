# Lovable Prompts - Sales Order → Invoice Unification

## ⚠️ PRE-REQUISITES (MUST BE DONE FIRST)

Before giving Lovable ANY of these prompts:

1. ✅ Apply database migration: `supabase/migrations/20251023000000_unify_sales_order_invoice.sql`
2. ✅ Regenerate types: `npx supabase gen types typescript --project-id pnqcbnmrfzqihymmzhkb > src/integrations/supabase/types.ts`
3. ✅ Verify in Supabase dashboard that `invoice_record` has these columns:
   - delivery_date, order_date, is_no_order, approved_at, approved_by, promised_ship_date, requested_ship_date, customer_po_number

---

## 📋 PHASE 0: Apply Migration & Regenerate Types

**Copy this to Lovable FIRST:**

```
TASK: Apply Database Migration and Regenerate Types

STEPS:

1. Apply the migration file to the database:
   - File: supabase/migrations/20251023000000_unify_sales_order_invoice.sql
   - Use Supabase CLI: npx supabase db push --linked
   - OR tell me the migration SQL and I'll apply it via dashboard

2. After migration succeeds, regenerate TypeScript types:
   - Run: npx supabase gen types typescript --project-id pnqcbnmrfzqihymmzhkb > src/integrations/supabase/types.ts

3. Verify the types file includes:
   - invoice_record.Row.delivery_date
   - invoice_record.Row.order_date
   - invoice_record.Row.is_no_order
   - invoice_record.Row.approved_at
   - invoice_record.Row.approved_by

4. Report back what you found.

DO NOT proceed to Phase 1 until this is complete.
```

---

## 📦 PHASE 1: Fix Existing Updated Files

**Only run this AFTER Phase 0 is complete.**

```
PHASE 1: Fix files that were partially updated

CONTEXT:
The following files were updated to use invoice_record instead of sales_order, but have errors because they were updated BEFORE the database migration was applied. Now that the migration is complete and types are regenerated, fix these files.

FILES TO FIX:

1. src/components/CreateSalesOrderDialog.tsx
2. src/components/CreateSalesOrderSheet.tsx
3. src/components/ModernSalesOrdersList.tsx
4. src/hooks/useSalesOrderEdit.tsx

TASKS:

1. REMOVE all @ts-ignore comments - they should no longer be needed

2. FIX column references:
   - Ensure all references use the correct column names from invoice_record:
     * order_date (not invoice_date for order creation)
     * delivery_date
     * is_no_order (not is_no_order_today)
     * customer_po_number

3. FIX status checks:
   Replace references to order.invoiced (boolean) with status-based checks:

   OLD:
   if (order.invoiced) { ... }

   NEW:
   if (['confirmed', 'delivered', 'paid'].includes(order.status)) { ... }

4. FIX query keys:
   Replace: queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
   With: queryClient.invalidateQueries({ queryKey: ['invoices'] })

5. ADD invoice_number generation:
   In CreateSalesOrderDialog and CreateSalesOrderSheet, when creating a new invoice:
   - Call the database function: supabase.rpc('get_next_invoice_number', { p_organization_id })
   - Use the returned invoice_number in the insert

6. UPDATE UI text (optional for now, can do later):
   - Keep "Sales Order" terminology for now
   - We'll update all UI text in Phase 4

VERIFICATION:
- npm run build should succeed with NO TypeScript errors
- Test creating a new order via the dialog
- Verify it inserts into invoice_record with status='draft'

Show me:
1. Summary of changes made
2. Any remaining TypeScript errors
3. Build output
```

---

## 📦 PHASE 2: Update Remaining Components

```
PHASE 2: Update components that still reference sales_order table

Update the following components to use invoice_record instead of sales_order:

FILES TO UPDATE:

1. src/components/SalesOrdersList.tsx
2. src/components/SalesOrderDialog.tsx
3. src/components/SalesOrderApprovalButton.tsx
4. src/components/SalesOrderConvertToInvoiceButton.tsx

RULES FOR EACH FILE:

1. TABLE REFERENCES:
   - Change: .from('sales_order') → .from('invoice_record')
   - Change: .from('sales_order_line_item') → .from('invoice_line_item')

2. COLUMN NAME MAPPINGS:
   - order_number → invoice_number
   - is_no_order_today → is_no_order
   - Keep: delivery_date, order_date, customer_po_number (same names)

3. STATUS MAPPINGS:
   - 'pending' → 'draft'
   - 'reviewed' → 'confirmed'
   - invoiced=true → status IN ('confirmed', 'delivered', 'paid')

4. SPECIAL HANDLING:

   For SalesOrderApprovalButton.tsx:
   - Update approve logic to set:
     * status = 'confirmed' (instead of status = 'reviewed')
     * approved_at = NOW()
     * approved_by = user_id

   For SalesOrderConvertToInvoiceButton.tsx:
   - This component may no longer be needed since orders ARE invoices now
   - Instead, it should change status from 'draft' → 'confirmed'
   - OR we may delete this component entirely
   - Ask me which approach to take before proceeding

5. QUERY KEYS:
   - Replace: ['sales-orders'] → ['invoices']
   - Replace: ['sales-order', id] → ['invoice', id]

VERIFICATION:
- Build succeeds
- No TypeScript errors
- Components still render

Show me what you changed.
```

---

## 📦 PHASE 3: Update Pages

```
PHASE 3: Update page components

Update the following pages to use invoice_record:

FILES TO UPDATE:

1. src/pages/SalesOrders.tsx
2. src/pages/SalesOrderDetails.tsx
3. src/pages/NewSalesOrder.tsx
4. src/pages/Dashboard.tsx (only sales order references)

FOR EACH PAGE:

1. Update all queries:
   - .from('sales_order') → .from('invoice_record')
   - .from('sales_order_line_item') → .from('invoice_line_item')

2. Update column references:
   - order_number → invoice_number
   - is_no_order_today → is_no_order

3. Update status checks:
   - Replace .invoiced boolean checks with status checks
   - Use status values: 'draft', 'confirmed', 'delivered', 'paid'

4. Update query keys:
   - ['sales-orders'] → ['invoices']
   - ['sales-order', id] → ['invoice', id]

5. KEEP existing UI text for now:
   - Still say "Sales Orders" in headers
   - Still say "Order" in forms
   - We'll update UI text in Phase 4

VERIFICATION:
- Pages load without errors
- Data displays correctly
- Filters and searches work

Show me the updated pages.
```

---

## 📦 PHASE 4: Update Navigation & Routing

```
PHASE 4: Update navigation, routing, and UI terminology

PART A: Update Routes in src/App.tsx

CURRENT routes to KEEP:
- /sales-orders → SalesOrders (keep for backward compatibility)
- /sales-orders/new → NewSalesOrder (keep for backward compatibility)
- /sales-orders/:id → SalesOrderDetails (keep for backward compatibility)

NEW routes to ADD (aliases to same components):
- /orders → SalesOrders component
- /orders/new → NewSalesOrder component
- /orders/:id → SalesOrderDetails component

Why: This maintains backward compatibility while adding cleaner URLs.

PART B: Update Navigation in src/components/AppSidebar.tsx

CHANGE:
{ name: 'Sales Orders', href: '/sales-orders', icon: ShoppingCart }

TO:
{ name: 'Orders', href: '/orders', icon: ShoppingCart }

PART C: Update UI Terminology

Search and replace across ALL components:
- "Sales Order" → "Order" (in UI text, not file names)
- "sales order" → "order"
- Keep code/file names unchanged for now

Examples:
- Dialog title: "Create Sales Order" → "Create Order"
- Button: "New Sales Order" → "New Order"
- Page header: "Sales Orders" → "Orders"

VERIFICATION:
- Navigation links work
- Both /sales-orders and /orders go to same page
- UI text reads "Orders" not "Sales Orders"

Show me the changes.
```

---

## 📦 PHASE 5: Update Template Generation

```
PHASE 5: Update daily order template generation

Find and update template generation code. Likely in:
- src/components/GenerateDailyOrdersButton.tsx
- src/components/GenerateTemplateTestDataButton.tsx
- Any file with "generate" and "template" or "daily"

UPDATES NEEDED:

1. Change table references:
   FROM: .from('sales_order')
   TO: .from('invoice_record')

   FROM: .from('sales_order_line_item')
   TO: .from('invoice_line_item')

2. Update insert data structure:

   OLD fields to REMOVE or RENAME:
   - is_no_order_today → is_no_order
   - sales_order_id → invoice_id

   NEW fields to ADD:
   - status: 'draft'
   - order_date: new Date().toISOString().split('T')[0]
   - source_system: 'template'

3. Generate invoice_number:
   BEFORE inserting, call:
   const { data: invNum } = await supabase.rpc('get_next_invoice_number', {
     p_organization_id: organization.id
   });

   Then use invNum in the insert.

4. Update line items insert:
   - Field name: sales_order_id → invoice_id
   - Reference the returned invoice.id from the insert

5. Update success messages:
   - "Created X sales orders" → "Created X draft orders"
   - "Generated X sales orders from templates" → "Generated X orders from templates"

VERIFICATION:
- Generate orders from templates
- Verify they appear in invoice_record with status='draft'
- Verify is_no_order flag works correctly
- Verify line items are created in invoice_line_item

Show me what files you updated and what changed.
```

---

## 📦 PHASE 6: Update QuickBooks Sync (If Exists)

```
PHASE 6: Update QuickBooks sync to only sync confirmed+ invoices

FIRST: Search for QuickBooks sync code:
- Files with "quickbooks" or "qbo" in name
- Edge functions in supabase/functions/
- Components with "sync" in name

IF NO SYNC CODE EXISTS: Skip this phase and report "No QBO sync code found"

IF SYNC CODE EXISTS:

1. Add status filter to queries that fetch invoices to sync:

   BEFORE:
   const invoices = await supabase
     .from('invoice_record')
     .select('*')
     .is('qbo_id', null);

   AFTER:
   const invoices = await supabase
     .from('invoice_record')
     .select('*')
     .in('status', ['confirmed', 'delivered', 'paid', 'partial'])
     .is('qbo_id', null);

2. CRITICAL RULE:
   - DO NOT sync invoices with status = 'draft'
   - Only sync when status is 'confirmed' or later in the workflow

3. If there's a manual "Sync to QBO" button:
   - Add validation before syncing
   - Check: if (invoice.status === 'draft') throw error
   - Error message: "Cannot sync draft invoices. Please confirm the invoice first."

4. Update any sync documentation or code comments

VERIFICATION:
- Draft invoices are NOT synced to QuickBooks
- Confirmed+ invoices ARE synced
- Error shown if trying to manually sync a draft

Show me what sync code you found and updated.
```

---

## 📦 PHASE 7: Create Unified Invoice List Page (NEW PAGE)

**This replaces the separate Sales Orders and Invoices pages with a unified view.**

```
PHASE 7: Create unified Orders & Invoices page with status tabs

CREATE NEW FILE: src/pages/UnifiedInvoices.tsx

This page shows ALL invoice_record entries (both draft orders and sent invoices) with status-based filtering.

REQUIREMENTS:

1. STATUS TABS using shadcn/ui Tabs component:
   Tabs: All | Draft | Confirmed | Delivered | Paid | Cancelled
   - Show count badge on each tab
   - Filter invoices by selected status
   - "All" shows everything

2. DATA FETCHING using TanStack Query:
   ```typescript
   const { data: invoices } = useQuery({
     queryKey: ['invoices', selectedStatus],
     queryFn: async () => {
       let query = supabase
         .from('invoice_record')
         .select(`
           id,
           invoice_number,
           status,
           order_date,
           delivery_date,
           total,
           is_no_order,
           customer:customer_profile(id, company_name)
         `)
         .order('created_at', { ascending: false });

       if (selectedStatus !== 'all') {
         query = query.eq('status', selectedStatus);
       }

       const { data, error } = await query;
       if (error) throw error;
       return data;
     }
   });
   ```

3. LIST DISPLAY:

   DESKTOP (Table):
   Columns:
   - Checkbox (for bulk selection)
   - Invoice/Order # (invoice_number)
   - Status (colored badge)
   - Customer Name
   - Order Date
   - Delivery Date
   - Total Amount
   - Actions (View, Edit, Delete if draft)

   MOBILE (Cards):
   Same info in compact card format

4. STATUS BADGES (follow existing design system):
   ```typescript
   const statusColors = {
     draft: 'bg-slate-100 text-slate-800',
     confirmed: 'bg-blue-100 text-blue-800',
     delivered: 'bg-green-100 text-green-800',
     paid: 'bg-emerald-100 text-emerald-800',
     cancelled: 'bg-red-100 text-red-800',
     partial: 'bg-yellow-100 text-yellow-800',
     sent: 'bg-purple-100 text-purple-800',
     overdue: 'bg-red-100 text-red-800'
   };
   ```

5. SPECIAL BADGE:
   If is_no_order = true, show additional badge:
   <Badge variant="outline">NO ORDER</Badge>

6. BULK SELECTION:
   - Add checkbox column to table
   - "Select All" checkbox in header
   - Track selected invoice IDs in state: const [selectedIds, setSelectedIds] = useState<string[]>([])

7. BULK ACTIONS BAR (show when selectedIds.length > 0):
   Conditionally show buttons based on selected items' status:

   - If all selected are 'draft': Show "Confirm Selected" button
   - If all selected are 'confirmed': Show "Mark as Delivered" button
   - If all selected are 'delivered': Show "Record Payment" button
   - Always show: "Cancel Selection" button
   - Display: "{selectedIds.length} items selected"

8. FILTERS (above table):
   - Date range picker (filter by delivery_date)
   - Customer dropdown filter
   - Search input (filter by invoice_number)

9. FAB BUTTON (floating action button, bottom right):
   - Button text: "+ New Order"
   - Opens CreateSalesOrderDialog
   - Uses existing component

10. FOLLOW PATTERNS FROM:
   - src/pages/Invoices.tsx (for table structure)
   - src/components/ModernSalesOrdersList.tsx (for list patterns)
   - Reference BATCHLY_PROJECT_KNOWLEDGE_BASE.md if it exists

DO NOT implement bulk actions functionality yet - just show the UI.
We'll implement bulk actions in Phase 8.

VERIFICATION:
- Page loads and displays invoices
- Tabs filter by status correctly
- Bulk selection checkboxes work
- Filters work
- Mobile responsive

Show me the new page.
```

---

## 📦 PHASE 8: Implement Bulk Status Updates

```
PHASE 8: Add bulk status update functionality

CREATE NEW HOOK: src/hooks/useBulkStatusUpdate.ts

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useBulkStatusUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceIds,
      newStatus,
      userId
    }: {
      invoiceIds: string[],
      newStatus: string,
      userId: string
    }) => {
      const { data, error } = await supabase.rpc('bulk_update_invoice_status', {
        p_invoice_ids: invoiceIds,
        p_new_status: newStatus,
        p_updated_by: userId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const successCount = data.filter((r: any) => r.success).length;
      const failCount = data.filter((r: any) => !r.success).length;

      if (successCount > 0) {
        toast.success(`Updated ${successCount} invoice(s)`);
      }
      if (failCount > 0) {
        const errors = data.filter((r: any) => !r.success);
        toast.error(`Failed to update ${failCount} invoice(s)`);
        console.error('Failed updates:', errors);
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update invoices: ' + error.message);
    }
  });
}
```

THEN UPDATE: src/pages/UnifiedInvoices.tsx

1. Import the hook and auth:
   ```typescript
   import { useBulkStatusUpdate } from '@/hooks/useBulkStatusUpdate';
   import { useAuthProfile } from '@/hooks/useAuthProfile';
   ```

2. Use the hook:
   ```typescript
   const { profile } = useAuthProfile();
   const bulkUpdateMutation = useBulkStatusUpdate();
   ```

3. Wire up bulk action buttons:

   "Confirm Selected" button onClick:
   ```typescript
   bulkUpdateMutation.mutate({
     invoiceIds: selectedIds,
     newStatus: 'confirmed',
     userId: profile.id
   })
   ```

   "Mark Delivered" button onClick:
   ```typescript
   bulkUpdateMutation.mutate({
     invoiceIds: selectedIds,
     newStatus: 'delivered',
     userId: profile.id
   })
   ```

   "Record Payment" button - for now just show toast:
   ```typescript
   toast.info('Payment recording will be implemented later')
   ```

4. Add loading states:
   - Disable buttons when: bulkUpdateMutation.isPending
   - Show spinner on active button

5. Clear selection after success:
   In mutation onSuccess, add: setSelectedIds([])

VERIFICATION:
- Bulk confirm works (draft → confirmed)
- Bulk deliver works (confirmed → delivered)
- Loading states show correctly
- Toast notifications appear
- Selection clears after success

Show me the implementation.
```

---

## ✅ COMPLETION CHECKLIST

After all phases:

- [ ] Phase 0: Migration applied, types regenerated
- [ ] Phase 1: Fixed partially updated files
- [ ] Phase 2: Updated remaining components
- [ ] Phase 3: Updated pages
- [ ] Phase 4: Updated navigation/routing/terminology
- [ ] Phase 5: Updated template generation
- [ ] Phase 6: Updated QuickBooks sync (if exists)
- [ ] Phase 7: Created unified invoice list page
- [ ] Phase 8: Implemented bulk status updates

FINAL VERIFICATION:
- `npm run build` succeeds with ZERO TypeScript errors
- All pages load without errors
- Can create new orders (they insert as draft invoices)
- Can view/edit orders
- Can bulk update status
- Template generation creates draft invoices
- Navigation works from both /orders and /sales-orders

---

## 🔄 ROLLBACK PLAN

If something goes wrong:

```bash
git reset --hard 5586047
git push -f origin claude/incomplete-description-011CUPKpNWzk6NttzmisLgty
```

This returns to the last known good state before the unification work started.
