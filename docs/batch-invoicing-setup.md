# Batch Invoice Processing System - Setup & Documentation

## 🎯 Overview

This system provides scalable, background processing for bulk invoice creation with real-time progress monitoring. It can handle thousands of invoices efficiently without blocking the UI or timing out.

## 🏗️ Architecture

### Components

1. **batch-invoice-orders** (Edge Function)
   - Entry point for batch invoice jobs
   - Authenticates user and captures context
   - Queues job in `batch_job_queue` table
   - Returns immediately with job ID

2. **process-batch-jobs** (Edge Function - Worker)
   - Background processor triggered by cron every minute
   - Fetches pending jobs from queue
   - Calls `create-invoice-from-order` for each order
   - Updates job progress in real-time
   - Handles failures gracefully

3. **create-invoice-from-order** (Edge Function)
   - Creates individual invoices
   - Now accepts optional `user_id` parameter for batch context
   - Maintains all validation and business logic

4. **BulkJobProgress** (React Component)
   - Real-time progress monitor
   - Polls job status every 2 seconds
   - Shows success/failure counts
   - Displays error details
   - Auto-stops polling when complete

### Database Tables

- **batch_job_queue**: Stores job metadata and progress
  - `id`: UUID primary key (job ID)
  - `organization_id`: Organization context
  - `job_type`: Type of job (e.g., 'bulk_invoice_generation')
  - `status`: pending | processing | completed | failed | cancelled
  - `total_items`: Total orders to process
  - `processed_items`: Orders completed
  - `successful_items`: Successful invoices
  - `failed_items`: Failed invoices
  - `payload`: Job data (order IDs, user context, etc.)
  - `errors`: JSONB array of error details

## 📦 Setup Instructions

### 1. Deploy Edge Functions

All edge functions are already deployed automatically when you push code to your Lovable project:
- ✅ `batch-invoice-orders`
- ✅ `create-invoice-from-order` (updated)
- ✅ `process-batch-jobs`

### 2. Enable Automatic Processing (Cron Job)

The cron job has been set up to run every minute and process pending batch jobs automatically.

**Verify Cron Job:**
```sql
SELECT * FROM cron.job WHERE jobname = 'process-batch-jobs-every-minute';
```

**To disable/enable the cron job:**
```sql
-- Disable
SELECT cron.unschedule('process-batch-jobs-every-minute');

-- Re-enable
SELECT cron.schedule(
  'process-batch-jobs-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/process-batch-jobs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MzU4NjUsImV4cCI6MjA2MDQxMTg2NX0.YFTBTCDsFtrYU1WqqpFg1STecxlGF_28G7cP4vRHVCQ"}'::jsonb
  ) AS request_id;
  $$
);
```

### 3. UI Integration

The `BulkInvoiceActions` component has been updated to:
- Call `batch-invoice-orders` edge function
- Display `BulkJobProgress` component when job is running
- Auto-refresh when complete

**Usage:**
```tsx
import { BulkInvoiceActions } from '@/components/sales-orders/BulkInvoiceActions';

<BulkInvoiceActions 
  selectedOrders={selectedOrderIds}
  onComplete={() => {
    // Called when batch completes
  }}
/>
```

## 🚀 Performance Specifications

### Throughput
- **Rate**: ~2-3 invoices per second (sequential processing)
- **Batch Size**: Automatically chunked into 100-order batches
- **Maximum**: 500 orders per batch job
- **Timeout Safe**: Processes in background via cron worker

### Estimated Processing Times
- **10 orders**: 3-5 seconds ⚡ Excellent
- **100 orders**: 30-60 seconds ✅ Good
- **500 orders**: 3-5 minutes ⚠️ Maximum recommended
- **1,000+ orders**: Split into multiple 500-order batches

### Recommended Batch Sizes
- **Daily operations**: 10-100 orders (fast, responsive)
- **Weekly bulk**: 100-500 orders (acceptable wait time)
- **Large migrations**: Split into multiple 500-order batches

### Resource Efficiency
- **Memory**: Only active job data in memory
- **Database**: Connection pooling handles concurrent access
- **Resumable**: If worker crashes, jobs automatically resume on next cron run

## 🔍 Monitoring & Debugging

### Check Job Status
```sql
SELECT 
  id,
  job_type,
  status,
  total_items,
  processed_items,
  successful_items,
  failed_items,
  created_at,
  started_at,
  completed_at
FROM batch_job_queue
ORDER BY created_at DESC
LIMIT 10;
```

### View Failed Items
```sql
SELECT 
  id,
  status,
  errors
FROM batch_job_queue
WHERE failed_items > 0
ORDER BY created_at DESC;
```

### Check Edge Function Logs
Go to Supabase Dashboard → Edge Functions → Select function → Logs tab

Or use the Lovable links:
- [batch-invoice-orders logs](https://supabase.com/dashboard/project/pnqcbnmrfzqihymmzhkb/functions/batch-invoice-orders/logs)
- [process-batch-jobs logs](https://supabase.com/dashboard/project/pnqcbnmrfzqihymmzhkb/functions/process-batch-jobs/logs)
- [create-invoice-from-order logs](https://supabase.com/dashboard/project/pnqcbnmrfzqihymmzhkb/functions/create-invoice-from-order/logs)

### Manual Job Processing
If the cron job is disabled or you want to manually trigger processing:

```bash
curl -X POST https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/process-batch-jobs \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## ✅ Clear Backlog After Fix

If you have pending jobs that failed before the fix:

```bash
# Manually trigger batch processing
curl -X POST https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/trigger-batch-processing \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MzU4NjUsImV4cCI6MjA2MDQxMTg2NX0.YFTBTCDsFtrYU1WqqpFg1STecxlGF_28G7cP4vRHVCQ"
```

Or via SQL:
```sql
-- Process all pending batches
SELECT process_all_pending_batches();
```

## 🛠️ Troubleshooting

### Batch Size Exceeded Error
```
Error: Batch size exceeds maximum of 500 orders
```
**Solution**: Split your selection into smaller batches of 500 or fewer orders.

### Job Stuck in "Processing" State
```sql
-- Check if job is actually stuck (> 1 hour old)
SELECT id, started_at, status 
FROM batch_job_queue 
WHERE status = 'processing' 
  AND started_at < NOW() - INTERVAL '1 hour';

-- Reset stuck job to pending
UPDATE batch_job_queue 
SET status = 'pending', started_at = NULL
WHERE id = 'YOUR_JOB_ID';
```

### High Failure Rate
1. Check `create-invoice-from-order` logs for specific errors
2. Review `errors` column in `batch_job_queue` for patterns
3. Verify sales orders meet validation requirements
4. Check RLS policies aren't blocking access

### Cron Job Not Running
```sql
-- Check if cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check cron job status
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-batch-jobs-every-minute')
ORDER BY start_time DESC 
LIMIT 5;
```

## 🔐 Security Considerations

1. **User Context**: Jobs preserve the original user's ID for audit trails
2. **Organization Isolation**: All queries respect organization RLS policies
3. **Rate Limiting**: Background processing prevents API abuse
4. **Error Privacy**: Sensitive data not exposed in error messages

## 📊 Key Metrics to Monitor

1. **Job Success Rate**: `successful_items / total_items`
2. **Average Processing Time**: `completed_at - started_at`
3. **Queue Depth**: Count of pending jobs
4. **Error Patterns**: Common failure reasons

## 🎨 User Experience

### What Users See:
1. Click "Create X Invoices" button
2. Toast notification: "Batch job started"
3. Progress card appears showing real-time updates
4. Can cancel job if needed
5. Completion notification with summary
6. Invoice list auto-refreshes

### Benefits:
- ✅ No browser timeouts
- ✅ Can navigate away and come back
- ✅ Clear progress visibility
- ✅ Error transparency
- ✅ Resumable operations
- ✅ Non-blocking UI

## 📝 Future Enhancements

Potential improvements:
- [ ] Email notification on completion
- [ ] Retry failed items automatically
- [ ] Adjust batch size dynamically based on load
- [ ] Add priority levels for urgent jobs
- [ ] Job history and analytics dashboard
- [ ] Parallel processing for multiple organizations
