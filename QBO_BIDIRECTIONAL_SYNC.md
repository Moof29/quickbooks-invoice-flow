# QuickBooks Bi-Directional Sync & Long-Running Batch Operations

**Your Concerns:**
1. Need to sync both directions (Batchly ↔ QuickBooks)
2. Batch operations might be too long for Edge Function 6-minute timeout

**TL;DR Solution:**
- Use **chunked processing** for large batches (stay within 6-min limit)
- Implement **true bi-directional sync** with conflict resolution
- Hybrid approach: Edge Functions for most, optional Node.js for massive batches (1000+)

---

## Part 1: Bi-Directional Sync Strategy

### What "Bi-Directional" Means Per Entity

Not all entities need true bi-directional sync. Let's break it down:

---

### 1. Customers - TRUE BI-DIRECTIONAL ✅

**Scenario:**
```
You create customers in Batchly (operational flow)
  → Sync to QuickBooks (for invoicing)

Accountant creates customers in QuickBooks (accounting flow)
  → Sync to Batchly (so you can create orders)

Customer info updated in either system
  → Sync changes to the other
```

**Direction: Both Ways**
```
BATCHLY ←→ QUICKBOOKS

Push: Batchly → QB
  - New customer created in Batchly
  - Customer updated in Batchly (address, phone, email)

Pull: QB → Batchly
  - New customer created in QB (by accountant)
  - Customer updated in QB (by accountant)
```

**Conflict Resolution:**
```
If customer edited in BOTH systems:
  - Use "last modified wins" strategy
  - Compare last_updated_at timestamps
  - Newer timestamp wins
  - Log conflicts for review
  - Option: Manual review for critical conflicts
```

**Implementation:**
```typescript
// Bi-directional customer sync
async function syncCustomersBidirectional(organizationId: string) {
  const connection = await getQBConnection(organizationId);

  // STEP 1: Pull changes from QB
  const qbCustomers = await fetchQBCustomers(connection, {
    changedSince: lastSyncTime
  });

  for (const qbCustomer of qbCustomers) {
    const batchlyCustomer = await findCustomerByQBOId(qbCustomer.Id);

    if (!batchlyCustomer) {
      // New in QB → Create in Batchly
      await createCustomerInBatchly(qbCustomer);
    } else {
      // Exists in both → Check timestamps
      const qbLastModified = new Date(qbCustomer.MetaData.LastUpdatedTime);
      const batchlyLastModified = new Date(batchlyCustomer.updated_at);

      if (qbLastModified > batchlyLastModified) {
        // QB is newer → Update Batchly
        await updateCustomerInBatchly(batchlyCustomer.id, qbCustomer);
      }
      // If Batchly is newer, do nothing (will push in Step 2)
    }
  }

  // STEP 2: Push changes to QB
  const batchlyCustomers = await fetchBatchlyCustomers({
    updatedSince: lastSyncTime
  });

  for (const batchlyCustomer of batchlyCustomers) {
    if (!batchlyCustomer.qbo_id) {
      // New in Batchly → Create in QB
      const qbCustomer = await createCustomerInQB(connection, batchlyCustomer);
      await storeQBOMapping(batchlyCustomer.id, qbCustomer.Id);
    } else {
      // Exists in both → Check timestamps
      const qbCustomer = await fetchQBCustomer(connection, batchlyCustomer.qbo_id);
      const qbLastModified = new Date(qbCustomer.MetaData.LastUpdatedTime);
      const batchlyLastModified = new Date(batchlyCustomer.updated_at);

      if (batchlyLastModified > qbLastModified) {
        // Batchly is newer → Update QB
        await updateCustomerInQB(connection, batchlyCustomer);
      }
    }
  }

  return { pushed: X, pulled: Y, conflicts: Z };
}
```

**Sync Frequency:**
- Push: Real-time (when customer created/updated in Batchly)
- Pull: Daily at 3 AM (check for QB changes)
- Manual: "Sync Customers Now" button

---

### 2. Items/Products - TRUE BI-DIRECTIONAL ✅

**Scenario:**
```
Accountant creates items in QuickBooks (sets up chart of accounts)
  → Sync to Batchly (for order creation)

You create item in Batchly (new product, urgent need)
  → Sync to QuickBooks (for invoicing)

Price updated in QuickBooks
  → Sync to Batchly (use updated pricing)
```

**Direction: Both Ways (QB is primary)**
```
BATCHLY ←→ QUICKBOOKS

Pull: QB → Batchly (PRIMARY)
  - New item created in QB
  - Item price updated in QB
  - Item status changed (active/inactive)

Push: Batchly → QB (SECONDARY)
  - New item created in Batchly (rare, urgent cases)
  - Item description updated in Batchly
```

**Conflict Resolution:**
```
If item edited in BOTH systems:
  - QuickBooks ALWAYS wins for pricing (accountant controls pricing)
  - Batchly can override description (operational details)
  - Active/inactive status: QB wins (accounting control)
```

**Implementation:**
```typescript
async function syncItemsBidirectional(organizationId: string) {
  const connection = await getQBConnection(organizationId);

  // STEP 1: Pull from QB (primary)
  const qbItems = await fetchQBItems(connection, {
    changedSince: lastSyncTime
  });

  for (const qbItem of qbItems) {
    await upsertItemInBatchly({
      organization_id: organizationId,
      qbo_id: qbItem.Id,
      sku: qbItem.Sku,
      name: qbItem.Name,
      description: qbItem.Description,
      unit_price: qbItem.UnitPrice, // QB price wins
      is_active: qbItem.Active,
      last_sync_at: new Date()
    });
  }

  // STEP 2: Push new items to QB (if created in Batchly)
  const newBatchlyItems = await fetchNewBatchlyItems({
    noQBOId: true,
    createdSince: lastSyncTime
  });

  for (const batchlyItem of newBatchlyItems) {
    const qbItem = await createItemInQB(connection, batchlyItem);
    await storeQBOMapping(batchlyItem.id, qbItem.Id);
  }

  return { pulled: qbItems.length, pushed: newBatchlyItems.length };
}
```

**Sync Frequency:**
- Pull: Daily at 4 AM (check for QB changes)
- Push: Real-time (when item created in Batchly - rare)
- Manual: "Sync Items Now" button

---

### 3. Invoices - ONE-WAY ONLY (Batchly → QB) ✅

**Scenario:**
```
You create invoices in Batchly
  → Sync to QuickBooks

Accountant views invoice in QuickBooks (read-only)
  → Never syncs back to Batchly

If invoice needs correction:
  → Cancel in Batchly, create new invoice
  → Both sync to QuickBooks
```

**Direction: One-Way Push**
```
BATCHLY → QUICKBOOKS (only)

Push: Batchly → QB
  - New invoice created
  - Invoice voided/cancelled

NEVER Pull: QB → Batchly
  - Invoices are immutable once created
  - No updates allowed in either system
  - Corrections = void old + create new
```

**Why One-Way?**
- Invoices should be immutable (accounting best practice)
- Batchly is the operational source of truth
- QuickBooks is the financial record (view only)
- No edits allowed in QB to avoid discrepancies

**Implementation:**
```typescript
async function syncInvoicesToQB(organizationId: string) {
  const connection = await getQBConnection(organizationId);

  // Only push, never pull
  const pendingInvoices = await fetchPendingInvoices(organizationId);

  for (const invoice of pendingInvoices) {
    // Validate before sync
    const validation = await validateInvoiceForSync(invoice);
    if (!validation.valid) {
      await logSyncError(invoice.id, validation.errors);
      continue;
    }

    // Create in QB
    const qbInvoice = await createInvoiceInQB(connection, invoice);

    // Store mapping
    await storeQBOMapping(invoice.id, qbInvoice.Id);

    // Mark as synced
    await markInvoiceSynced(invoice.id);
  }

  return { synced: pendingInvoices.length };
}
```

**Sync Frequency:**
- Push: Real-time (1-5 min after invoice creation)
- Pull: NEVER
- Manual: "Sync to QuickBooks" button per invoice

---

### 4. Payments - ONE-WAY ONLY (QB → Batchly) ✅

**Scenario:**
```
Customer pays invoice (check, credit card, ACH)
  → Payment recorded in QuickBooks (by accountant)
  → Sync payment status to Batchly

Payment status updates in Batchly:
  - Invoice status: Paid, Partial, Overdue
  - Amount paid and amount due
  → Display in Batchly dashboard
```

**Direction: One-Way Pull**
```
QUICKBOOKS → BATCHLY (only)

Pull: QB → Batchly
  - Payment applied to invoice
  - Partial payment recorded
  - Refund issued

NEVER Push: Batchly → QB
  - Payments recorded in QB only (by accountant)
  - Exception: Customer portal payments (future feature)
```

**Why One-Way?**
- QuickBooks is source of truth for payments (accounting system)
- Bank deposits recorded in QB
- Reconciliation done in QB
- Batchly just displays payment status (read-only)

**Future: Customer Portal Payments (Bi-Directional)**
```
When you add Stripe/customer portal payments:
  - Payment processed in Batchly → Push to QB
  - Payment recorded in QB → Pull to Batchly
  Then it becomes bi-directional
```

**Implementation:**
```typescript
async function syncPaymentsFromQB(organizationId: string) {
  const connection = await getQBConnection(organizationId);

  // Only pull, never push
  const syncedInvoices = await fetchSyncedInvoices(organizationId);

  for (const invoice of syncedInvoices) {
    // Query QB for invoice status
    const qbInvoice = await fetchQBInvoice(connection, invoice.qbo_id);

    // Calculate payment status
    const amountPaid = qbInvoice.TotalAmt - qbInvoice.Balance;
    const amountDue = qbInvoice.Balance;
    const status = calculateInvoiceStatus(qbInvoice, invoice.due_date);

    // Get payment details (if paid)
    const payments = qbInvoice.LinkedTxn?.filter(txn => txn.TxnType === 'Payment') || [];
    const lastPayment = payments[payments.length - 1];

    // Update Batchly
    await updateInvoicePaymentStatus(invoice.id, {
      amount_paid: amountPaid,
      amount_due: amountDue,
      status: status,
      payment_date: lastPayment?.TxnDate || null,
      qb_payment_id: lastPayment?.TxnId || null,
      last_payment_sync_at: new Date()
    });
  }

  return { updated: syncedInvoices.length };
}
```

**Sync Frequency:**
- Pull: Daily at 2 AM (check for payment updates)
- Pull: After manual "Sync Payments" button
- Push: NEVER (until customer portal payments added)

---

### 5. Sales Orders - NEVER SYNC ✅

**Scenario:**
```
You create sales orders in Batchly
  → Track delivery dates, fulfillment, approval
  → Convert to invoices

Sales orders NEVER sync to QuickBooks
  → Only invoices sync (when order becomes invoice)
```

**Direction: None**
```
BATCHLY ONLY (never sync)

Sales orders are operational data:
  - Order approval workflow
  - Delivery scheduling
  - Fulfillment tracking
  - Status: Draft, Approved, Invoiced

QuickBooks doesn't need sales orders:
  - Only cares about invoices (financial transactions)
  - Sales orders are "pre-invoice" data
  - Keep operations separate from financials
```

**Why Never Sync?**
- QuickBooks doesn't have good sales order support
- Orders are operational, not financial
- Reduces clutter in QuickBooks
- Keep QB clean and simple

---

## Summary: Sync Direction Per Entity

| Entity | Direction | Frequency | Primary Source |
|--------|-----------|-----------|----------------|
| **Customers** | ← → Bi-directional | Push: Real-time<br>Pull: Daily 3 AM | Batchly (operations) |
| **Items** | ← → Bi-directional | Pull: Daily 4 AM<br>Push: Real-time (rare) | QuickBooks (pricing) |
| **Invoices** | → Push only | Real-time (1-5 min) | Batchly (immutable) |
| **Payments** | ← Pull only | Daily 2 AM | QuickBooks (accounting) |
| **Sales Orders** | None | N/A | Batchly only |

---

## Part 2: Handling Long-Running Batch Operations

### The 6-Minute Timeout Challenge

**Edge Functions limit:** 6 minutes max execution time

**What happens if you need longer?**
- Sync 1000+ invoices at once
- Sync 5000+ customers at once
- Initial data migration from QuickBooks

**Solutions:**

---

### Solution 1: Chunked Processing (Recommended)

**Concept:** Break large batches into small chunks, process sequentially

**Implementation:**
```typescript
// Edge Function: qbo-sync-invoices-chunked
serve(async (req) => {
  const { organization_id, invoice_ids } = await req.json();

  const CHUNK_SIZE = 100; // Process 100 invoices per function call
  const chunks = chunkArray(invoice_ids, CHUNK_SIZE);

  let totalSynced = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} invoices)`);

    // Process this chunk (should take 2-3 minutes)
    const result = await syncInvoiceChunk(organization_id, chunk);

    totalSynced += result.synced;

    // If we're approaching timeout, spawn new function for remaining chunks
    const elapsed = Date.now() - startTime;
    if (elapsed > 4.5 * 60 * 1000 && i < chunks.length - 1) {
      // 4.5 minutes elapsed, more chunks remaining
      // Queue remaining chunks for next function call
      const remainingChunks = chunks.slice(i + 1);
      await spawnNextChunkProcessor(organization_id, remainingChunks.flat());

      return {
        success: true,
        synced: totalSynced,
        remaining: remainingChunks.flat().length,
        message: 'Partial sync complete, remaining queued'
      };
    }
  }

  return {
    success: true,
    synced: totalSynced,
    message: 'All invoices synced'
  };
});
```

**How it works:**
```
1. User clicks "Sync 500 Invoices"
   ↓
2. Edge Function receives request
   ↓
3. Split 500 into chunks of 100
   ↓
4. Process chunk 1 (100 invoices) → 2 min
5. Process chunk 2 (100 invoices) → 2 min
6. Process chunk 3 (100 invoices) → 2 min
   ↓ Total: 4 minutes (still under 6 min limit) ✅
7. Return success

If 1000 invoices:
   ↓
3. Split 1000 into chunks of 100
   ↓
4-8. Process chunks 1-5 (500 invoices) → 4.5 min
9. Approaching timeout? Spawn new function call
   ↓
10. New function call processes chunks 6-10
11. Return success from both
```

**Advantages:**
- ✅ Stays within 6-minute limit
- ✅ No infrastructure changes needed
- ✅ Works with Edge Functions
- ✅ Handles any batch size

**Example: Sync 5000 Invoices**
```
Function Call 1: Process 500 invoices (chunks 1-5) → 4.5 min
  → Spawn Function Call 2 with remaining 4500

Function Call 2: Process 500 invoices (chunks 6-10) → 4.5 min
  → Spawn Function Call 3 with remaining 4000

...continues until all 5000 synced

Total time: ~45 minutes (5000 / 100 per chunk * 2 min per chunk)
Wall clock time: Same (but no single function exceeds 6 min)
```

---

### Solution 2: Queue-Based Processing (Best for Background Jobs)

**Concept:** Add items to queue, worker processes them one-by-one or in mini-batches

**Implementation:**
```typescript
// User action: Queue 1000 invoices for sync
async function queueInvoicesForSync(invoiceIds: string[]) {
  for (const invoiceId of invoiceIds) {
    await supabase.from('qbo_sync_queue').insert({
      entity_type: 'invoice',
      entity_id: invoiceId,
      operation_type: 'push',
      status: 'pending'
    });
  }

  return { queued: invoiceIds.length };
}

// Worker: Runs every 1 minute via pg_cron
async function processSyncQueue() {
  // Fetch next 50 items from queue
  const items = await supabase
    .from('qbo_sync_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(50);

  for (const item of items) {
    await markAsProcessing(item.id);

    try {
      await syncInvoice(item.entity_id);
      await markAsComplete(item.id);
    } catch (error) {
      await handleError(item.id, error);
    }
  }

  return { processed: items.length };
}
```

**How it works:**
```
User action: "Sync 1000 Invoices"
  ↓
1. Add 1000 items to qbo_sync_queue (instant)
2. Return to user: "Queued for sync"
   ↓
Background (every 1 minute):
3. Worker picks up 50 items from queue
4. Syncs each invoice (1 min total)
5. Marks as complete
   ↓
6. Next minute: Worker picks up next 50 items
7. Repeat until queue is empty
   ↓
Total time: 1000 / 50 per minute = 20 minutes
User sees progress in real-time
```

**Advantages:**
- ✅ No timeout issues (each worker run < 2 min)
- ✅ Automatic retries (if item fails, retry later)
- ✅ Progress tracking (show "500/1000 synced")
- ✅ No user waiting (fire and forget)
- ✅ Works with Edge Functions

**UI Implementation:**
```tsx
// Show progress in UI
function InvoiceSyncProgress() {
  const { data: queueStatus } = useQuery({
    queryKey: ['sync-queue-status'],
    queryFn: async () => {
      const pending = await supabase
        .from('qbo_sync_queue')
        .select('id', { count: 'exact' })
        .eq('entity_type', 'invoice')
        .eq('status', 'pending');

      const processing = await supabase
        .from('qbo_sync_queue')
        .select('id', { count: 'exact' })
        .eq('entity_type', 'invoice')
        .eq('status', 'processing');

      const completed = await supabase
        .from('qbo_sync_queue')
        .select('id', { count: 'exact' })
        .eq('entity_type', 'invoice')
        .eq('status', 'completed');

      return {
        pending: pending.count,
        processing: processing.count,
        completed: completed.count,
        total: pending.count + processing.count + completed.count
      };
    },
    refetchInterval: 5000 // Poll every 5 seconds
  });

  return (
    <div>
      <Progress value={(queueStatus.completed / queueStatus.total) * 100} />
      <p>{queueStatus.completed} / {queueStatus.total} invoices synced</p>
      <p>Estimated time remaining: {queueStatus.pending} minutes</p>
    </div>
  );
}
```

---

### Solution 3: Recursive Edge Functions

**Concept:** Edge Function calls itself with remaining work

**Implementation:**
```typescript
serve(async (req) => {
  const { organization_id, invoice_ids, batch_id } = await req.json();

  const BATCH_SIZE = 200;
  const currentBatch = invoice_ids.slice(0, BATCH_SIZE);
  const remaining = invoice_ids.slice(BATCH_SIZE);

  // Process current batch
  const result = await syncInvoiceBatch(organization_id, currentBatch);

  // If more remaining, spawn new function call
  if (remaining.length > 0) {
    // Call this same function again with remaining invoices
    await fetch(`${SUPABASE_FUNCTION_URL}/qbo-sync-invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization_id,
        invoice_ids: remaining,
        batch_id
      })
    });

    return {
      success: true,
      synced: result.synced,
      remaining: remaining.length,
      message: `Batch ${batch_id} complete, spawned next batch`
    };
  }

  return {
    success: true,
    synced: result.synced,
    message: 'All batches complete'
  };
});
```

**Advantages:**
- ✅ Automatic continuation
- ✅ No queue table needed
- ✅ Works with Edge Functions

**Disadvantages:**
- ⚠️ Less visibility into progress
- ⚠️ Harder to track failures
- ⚠️ Can't easily cancel mid-process

---

### Solution 4: Hybrid Approach (Edge Functions + Node.js)

**Use Edge Functions for normal operations, Node.js for massive batches**

**Decision Logic:**
```typescript
async function syncInvoices(invoiceIds: string[]) {
  if (invoiceIds.length <= 500) {
    // Small/medium batch → Use Edge Function (chunked)
    return await edgeFunctionChunkedSync(invoiceIds);
  } else {
    // Large batch (500+) → Use Node.js service
    return await nodejsLargeBlockSync(invoiceIds);
  }
}
```

**When to use:**
- Normal operations (10-500 invoices): Edge Functions
- Initial migration (1000+ invoices): Node.js
- Rare large batches: Node.js

**Advantages:**
- ✅ Best of both worlds
- ✅ Edge Functions for 99% of use cases
- ✅ Node.js only when actually needed

**Disadvantages:**
- ⚠️ More complex (two systems to maintain)
- ⚠️ Extra cost for Node.js hosting
- ⚠️ Only needed for edge cases

---

## Recommended Architecture: Chunked + Queue-Based

**For your use case, combine two approaches:**

### Normal Operations (Real-Time Sync)
```
User creates invoice
  ↓
Trigger adds to qbo_sync_queue (instant)
  ↓
Worker processes queue every 1-5 minutes
  ↓
Invoice synced to QB
  ↓
User sees "Synced" badge in UI
```

### Bulk Operations (Manual Sync)
```
User clicks "Sync 500 Invoices"
  ↓
Add 500 items to queue (instant)
  ↓
Show progress UI (updates every 5 sec)
  ↓
Worker processes 50 at a time
  ↓
Complete in ~10 minutes
```

### Massive Operations (Initial Migration)
```
User clicks "Import from QuickBooks" (5000 customers)
  ↓
Add 5000 items to queue (instant)
  ↓
Show progress UI with ETA
  ↓
Worker processes 100 at a time
  ↓
Complete in ~100 minutes (1.5 hours)
  ↓
User can close browser, comes back later
```

**Code Implementation:**
```typescript
// Queue processor (runs every 1-5 minutes)
serve(async (req) => {
  const BATCH_SIZE = 50;
  const MAX_EXECUTION_TIME = 4.5 * 60 * 1000; // 4.5 minutes
  const startTime = Date.now();

  let totalProcessed = 0;

  while (Date.now() - startTime < MAX_EXECUTION_TIME) {
    // Fetch next batch from queue
    const items = await fetchPendingQueueItems(BATCH_SIZE);

    if (items.length === 0) {
      break; // Queue empty
    }

    // Process each item
    for (const item of items) {
      await markAsProcessing(item.id);

      try {
        await syncEntity(item);
        await markAsComplete(item.id);
        totalProcessed++;
      } catch (error) {
        await handleSyncError(item.id, error);
      }

      // Check timeout
      if (Date.now() - startTime >= MAX_EXECUTION_TIME) {
        break;
      }
    }
  }

  return {
    success: true,
    processed: totalProcessed,
    message: `Processed ${totalProcessed} items, queue will continue on next run`
  };
});
```

---

## Performance Estimates

### Edge Functions (Chunked + Queue)

| Batch Size | Processing Time | Method |
|-----------|----------------|--------|
| 10 invoices | 30 sec | Real-time (direct) |
| 50 invoices | 2 min | Real-time (direct) |
| 100 invoices | 3 min | Real-time (chunked) |
| 500 invoices | 10 min | Queue-based (50/min) |
| 1000 invoices | 20 min | Queue-based (50/min) |
| 5000 invoices | 100 min | Queue-based (50/min) |

### Node.js Service (If Needed)

| Batch Size | Processing Time | Method |
|-----------|----------------|--------|
| 10 invoices | 30 sec | Direct |
| 50 invoices | 2 min | Direct |
| 100 invoices | 3 min | Direct |
| 500 invoices | 8 min | Parallel (100 workers) |
| 1000 invoices | 15 min | Parallel (100 workers) |
| 5000 invoices | 60 min | Parallel (100 workers) |

**Verdict:** Edge Functions with queue-based processing handle your scale perfectly. Node.js only saves ~30-40% time for massive batches (1000+), which are rare.

---

## Final Recommendation

### Use Edge Functions with Chunked Queue Processing ✅

**Implementation Plan:**

**Phase 1 (Week 1): Core Sync**
1. Invoice sync (push only)
2. Payment sync (pull only)
3. Queue-based processor (runs every 5 min)

**Phase 2 (Week 2): Bi-Directional**
4. Customer sync (bi-directional with conflict resolution)
5. Item sync (bi-directional, QB primary)
6. Progress tracking UI

**Phase 3 (Week 3+): Optimization**
7. Chunked processing for large batches
8. Real-time progress updates (WebSocket or polling)
9. Conflict resolution UI

**Fallback Plan:**
If you consistently process 1000+ invoices AND hit performance issues:
- Add Node.js service for large batches only
- Keep Edge Functions for normal operations
- Decision logic: < 500 = Edge Functions, 500+ = Node.js

But honestly, queue-based Edge Functions will handle even 5000 invoices (just takes 100 minutes). That's fine for a background job.

---

**Bottom Line:**

1. **Bi-directional sync:** Implemented for Customers and Items (with conflict resolution)
2. **Long-running batches:** Solved with chunked queue-based processing (no timeout issues)
3. **Architecture:** Stick with Edge Functions (can handle your scale)
4. **Fallback:** Add Node.js only if you consistently sync 1000+ items (unlikely)

**Ready to implement this?** I can build the bi-directional sync with chunked processing using Edge Functions. It'll handle everything you need! 🚀
