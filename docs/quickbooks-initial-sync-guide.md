# QuickBooks Initial Sync Guide

## Overview
This guide explains how to perform the initial data sync when connecting your QuickBooks account to Batchly for the first time. The initial sync is designed to handle large datasets intelligently.

## What Gets Synced

### Phase 1: Foundation Data (Fast - ~2-5 minutes)
1. **Customers** - All QB customers → Batchly customer_profile
2. **Items** - All QB items/products → Batchly item_record

### Phase 2: Transaction Data (Slower - depends on volume)
3. **Invoices** - All QB invoices + line items
4. **Payments** - Recent payments (last 90 days by default)

## For Large Datasets (1000+ Invoices)

### Intelligent Batching Strategy

**Why batching matters:**
- QuickBooks API rate limits: 500 requests/minute
- Typical invoice with 5 line items = ~1 request
- 10,000 invoices = ~10,000 requests = 20 minutes minimum
- Network timeouts, retries, and validation add time

**Our approach:**
1. **Resumable sessions** - If sync fails partway through, it resumes where it stopped
2. **Chunked processing** - Processes 50 invoices at a time (configurable)
3. **Progress tracking** - Real-time updates in the UI
4. **Smart scheduling** - Spreads load to avoid rate limiting

### Recommended Initial Sync for Large Datasets

```typescript
// Option 1: Sync everything (use for < 5,000 invoices)
await initialSync({
  entityTypes: ['customer', 'item', 'invoice', 'payment'],
  batchSize: 50
});

// Option 2: Sync in stages (use for > 5,000 invoices)
// Stage 1: Foundation (run immediately)
await initialSync({
  entityTypes: ['customer', 'item'],
  batchSize: 100
});

// Stage 2: Recent invoices only (run next)
await syncRecentInvoices({
  startDate: '2024-01-01',
  batchSize: 50
});

// Stage 3: Historical invoices (run overnight)
await syncHistoricalInvoices({
  endDate: '2023-12-31',
  batchSize: 25 // Smaller batches for stability
});
```

## Time Estimates

| Dataset Size | Estimated Time | Recommended Approach |
|-------------|----------------|---------------------|
| < 1,000 invoices | 5-10 minutes | Single sync, all entities |
| 1,000-5,000 invoices | 30-60 minutes | Single sync, monitor progress |
| 5,000-10,000 invoices | 1-2 hours | Staged sync (recent first) |
| > 10,000 invoices | 2-4 hours | Staged + overnight historical |

## Monitoring Progress

### Via UI (Recommended)
1. Go to QuickBooks Integration page
2. Click "Initial Sync Status"
3. View real-time progress bars for each entity type

### Via Database Query
```sql
SELECT 
  entity_type,
  total_processed,
  total_expected,
  ROUND((total_processed::numeric / NULLIF(total_expected, 0)) * 100, 1) as progress_pct,
  status,
  started_at,
  last_chunk_at,
  EXTRACT(EPOCH FROM (NOW() - started_at))/60 as elapsed_minutes
FROM qbo_sync_sessions
WHERE status = 'in_progress'
  AND organization_id = 'your-org-id'
ORDER BY started_at DESC;
```

## Handling Failures

### Automatic Resume
- Sync sessions are tracked in `qbo_sync_sessions` table
- Every 2 minutes, `qbo-continue-sync-sessions` cron job checks for stalled sessions
- Automatically resumes where it left off

### Manual Resume
If you need to manually trigger a resume:

```typescript
// Get the session ID from the database
const sessionId = 'uuid-from-qbo_sync_sessions';

// Resume the sync
await resumeSync({
  sessionId,
  organizationId: 'your-org-id'
});
```

### Common Issues

**1. "QuickBooks connection not found"**
- Solution: Reconnect to QuickBooks via OAuth flow

**2. "Token expired"**
- Solution: Automatic token refresh should handle this
- Manual fix: Go to QB Integration page → Reconnect

**3. "Rate limit exceeded"**
- Solution: Reduce `batchSize` from 50 to 25
- Wait 1 minute, then resume

**4. "Customer not found for invoice"**
- Root cause: Invoice references QB customer that doesn't exist in Batchly
- Solution: Sync customers first (they're synced in Phase 1)
- Manual fix: Create missing customer manually or re-run customer sync

## Delta Sync After Initial Sync

Once initial sync completes, automated delta syncs run:

| Entity | Frequency | What Syncs |
|--------|-----------|------------|
| Customers | Daily 8 AM | Only customers modified since last sync |
| Items | Daily 8 AM | Only items modified since last sync |
| Invoices | TBD (not automated yet) | Only invoices modified since last sync |
| Payments | Every 15 min (business hours) | Payments from last 24 hours |

## Best Practices

### Before Starting Initial Sync
1. ✅ Verify QuickBooks connection is active
2. ✅ Check you have stable internet
3. ✅ Plan for downtime (don't start during business-critical hours)
4. ✅ Back up your Batchly data (optional but recommended)

### During Initial Sync
1. ✅ Keep browser tab open (for progress monitoring)
2. ✅ Don't disconnect from QuickBooks
3. ✅ Monitor for errors in the sync status UI
4. ❌ Don't manually modify data in either system

### After Initial Sync
1. ✅ Verify record counts match (use sync summary)
2. ✅ Spot-check a few invoices/customers
3. ✅ Test creating a new invoice (to verify mapping works)
4. ✅ Enable automated delta syncs

## Sync Summary Report

After initial sync completes, you'll see:

```
✓ Initial Sync Complete

Customers: 450 synced (0 errors)
Items: 1,250 synced (0 errors)
Invoices: 8,945 synced (12 errors)
Payments: 1,523 synced (0 errors)

Total Time: 1h 23m
Errors: 12 (see details below)

Error Details:
- Invoice INV-12345: Customer not mapped
- Invoice INV-23456: Item not found
...
```

## Troubleshooting

### Sync Appears Stuck
**Check if it's actually stuck:**
```sql
SELECT 
  entity_type,
  last_chunk_at,
  NOW() - last_chunk_at as time_since_last_update
FROM qbo_sync_sessions
WHERE status = 'in_progress';
```

If `time_since_last_update` > 10 minutes:
1. Check edge function logs for errors
2. Manually resume the sync
3. Contact support if issue persists

### Partial Sync Success
If some entities sync but others fail:
1. Check error messages in `qbo_sync_history.error_summary`
2. Fix root cause (usually missing mapping or invalid data)
3. Re-run sync for failed entities only

### Need to Start Over
To reset and re-run initial sync:

```sql
-- 1. Delete existing mappings (optional, be careful!)
DELETE FROM qbo_entity_mapping WHERE organization_id = 'your-org-id';

-- 2. Clear sync sessions
DELETE FROM qbo_sync_sessions WHERE organization_id = 'your-org-id';

-- 3. Re-run initial sync from UI
```

## Support

For issues not covered here:
1. Check edge function logs in Supabase Dashboard
2. Review `qbo_sync_history` table for detailed error messages
3. Contact support with your `sync_id` from the initial sync

---

**Note:** This is an initial sync guide. After the first sync completes, all subsequent syncs use delta sync (only changed records), which is much faster.
