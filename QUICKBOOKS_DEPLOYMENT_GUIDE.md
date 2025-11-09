# QuickBooks Online Integration - Deployment Guide

This guide will help you deploy the comprehensive 2-way sync system that solves all current issues.

## 🎯 What This Fixes

✅ **Automatic Token Refresh** - Tokens refresh every 5 minutes before expiration
✅ **Smart Connection Status** - Proper `is_active` flag management
✅ **Real-time Webhooks** - Instant sync when QBO data changes
✅ **Scheduled Syncs** - Automated background synchronization
✅ **Better UI** - Clear status indicators and manual controls
✅ **Error Handling** - Automatic retries and error tracking

---

## 📋 Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Access to your Supabase project dashboard
- QuickBooks Developer account
- Your app's Client ID and Client Secret

---

## 🚀 Step 1: Apply Database Migrations

Run these migrations **in order** in your Supabase SQL Editor:

### Migration 1: Invoice Schema Enhancement
```bash
# File: supabase/migrations/20251109235000_enhance_invoice_record_for_qbo_sync.sql
```

This adds:
- 42 new QBO fields to `invoice_record`
- 8 new fields to `invoice_line_item`
- Helper functions and views
- Performance indexes

**To apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `20251109235000_enhance_invoice_record_for_qbo_sync.sql`
3. Paste and run

### Migration 2: Webhook & Queue Infrastructure
```bash
# File: supabase/migrations/20251109235500_create_webhook_and_queue_tables.sql
```

This creates:
- `qbo_webhook_log` - Webhook audit trail
- `qbo_webhook_processed` - Idempotency tracking
- `qbo_sync_queue` - Background job queue
- Helper functions for queue management

**To apply:**
1. Copy contents of `20251109235500_create_webhook_and_queue_tables.sql`
2. Paste in SQL Editor and run

### Migration 3: Scheduled Jobs (Token Auto-Refresh!)
```bash
# File: supabase/migrations/20251109235900_setup_scheduled_sync_jobs.sql
```

This sets up:
- **Token refresh every 5 minutes** ⭐ (Fixes your issue!)
- Queue processor (every 1 minute)
- Scheduled syncs (hourly/daily)
- Cleanup jobs

**To apply:**
1. Copy contents of `20251109235900_setup_scheduled_sync_jobs.sql`
2. Paste in SQL Editor and run

**IMPORTANT:** After running migration 3, configure database settings:

```sql
ALTER DATABASE postgres
SET app.settings.supabase_url = 'https://pnqcbnmrfzqihymmzhkb.supabase.co';

ALTER DATABASE postgres
SET app.settings.supabase_service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
```

Replace `<YOUR_SERVICE_ROLE_KEY>` with your actual service role key from:
**Supabase Dashboard → Project Settings → API → service_role key**

---

## 🔧 Step 2: Deploy Edge Functions

Deploy all the new sync functions:

```bash
# Navigate to project root
cd /home/user/quickbooks-invoice-flow

# Deploy invoice sync (NEW - bidirectional)
supabase functions deploy qbo-sync-invoices

# Deploy updated items sync (NOW supports push!)
supabase functions deploy qbo-sync-items

# Deploy orchestrator (coordinates all syncs)
supabase functions deploy qbo-sync-orchestrator

# Deploy webhook listener (real-time sync)
supabase functions deploy qbo-webhook-listener

# Deploy sync worker (background processor)
supabase functions deploy qbo-sync-worker
```

---

## 🔐 Step 3: Configure Secrets

Set the webhook verifier token (get this from QuickBooks Developer Portal):

```bash
supabase secrets set QBO_WEBHOOK_VERIFIER_TOKEN=<your-webhook-token>
```

---

## 🌐 Step 4: Configure QuickBooks Webhooks

1. Go to [QuickBooks Developer Portal](https://developer.intuit.com/)
2. Select your app
3. Go to **Webhooks** section
4. Set webhook URL:
   ```
   https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-webhook-listener
   ```

5. Subscribe to entities:
   - ✅ Customer
   - ✅ Item
   - ✅ Invoice
   - ✅ Payment

6. Save and activate webhooks

---

## 🎨 Step 5: Update UI (Optional)

You can replace the existing QuickBooks integration page with the enhanced dashboard:

**Option A: Replace existing page**

Edit `src/pages/QuickBooksIntegration.tsx`:

```tsx
import { SyncDashboard } from '@/components/quickbooks/SyncDashboard';

const QuickBooksIntegration = () => {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      {/* Keep existing connection header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          QuickBooks Integration
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect and sync your data with QuickBooks Online
        </p>
      </div>

      {/* Add new sync dashboard */}
      <SyncDashboard />
    </div>
  );
};

export default QuickBooksIntegration;
```

**Option B: Add as a tab**

Keep existing page and add dashboard as a new tab using `<Tabs>` component.

---

## ✅ Step 6: Verify Deployment

Run these checks to confirm everything is working:

### Check 1: Verify Migrations Applied

```sql
-- Should return 3 rows (one for each new migration)
SELECT * FROM migrations
WHERE name LIKE '%qbo%' OR name LIKE '%webhook%'
ORDER BY created_at DESC
LIMIT 5;
```

### Check 2: Verify Cron Jobs Created

```sql
-- Should show all scheduled jobs
SELECT * FROM cron.job
WHERE jobname LIKE '%qbo%';
```

Expected jobs:
- `process-qbo-sync-queue` (every 1 minute)
- `qbo-sync-items-customers-pull` (every 6 hours)
- `qbo-sync-invoices-payments` (every hour)
- `qbo-push-local-changes` (every 30 minutes)
- `cleanup-old-webhook-logs` (daily)
- `cleanup-old-webhook-processed` (daily)
- `cleanup-old-sync-jobs` (daily)
- `cleanup-old-sync-history` (daily)
- `qbo-check-token-expiry` (every 5 minutes) ⭐

### Check 3: Verify Functions Deployed

```bash
supabase functions list
```

Should show:
- `qbo-oauth-initiate`
- `qbo-oauth-callback`
- `qbo-token-refresh`
- `qbo-sync-items`
- `qbo-sync-customers`
- `qbo-sync-payments`
- `qbo-sync-invoices` ⭐ NEW
- `qbo-sync-orchestrator` ⭐ NEW
- `qbo-webhook-listener` ⭐ NEW
- `qbo-sync-worker` ⭐ NEW

### Check 4: Test Token Refresh

```sql
-- Manually trigger token refresh
SELECT supabase.functions.invoke(
  'qbo-token-refresh',
  '{"organizationId": "9af4c081-7379-4e41-8dfb-924e2518e3c6"}'::jsonb
);

-- Verify token was refreshed
SELECT
  is_active,
  qbo_token_expires_at,
  qbo_token_expires_at > NOW() as is_valid,
  EXTRACT(EPOCH FROM (qbo_token_expires_at - NOW()))/60 as minutes_remaining
FROM qbo_connection
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';
```

Expected result:
- `is_active`: `true`
- `is_valid`: `true`
- `minutes_remaining`: ~60

---

## 🔧 Step 7: Fix Current Expired Token

Since your token is currently expired, you have two options:

### Option A: Reconnect (Recommended for now)

1. Go to QuickBooks Integration page
2. Click "Connect to QuickBooks"
3. Authorize again
4. You'll be redirected back with fresh tokens

### Option B: Manual Refresh (If refresh token still valid)

Run in Supabase SQL Editor:

```sql
-- Try to refresh with existing refresh token
SELECT supabase.functions.invoke(
  'qbo-token-refresh',
  '{"organizationId": "9af4c081-7379-4e41-8dfb-924e2518e3c6"}'::jsonb
);
```

If this fails, use Option A.

---

## 📊 Step 8: Monitor Sync Status

After deployment, you can monitor everything:

### Via SQL:

```sql
-- Check overall sync status
SELECT * FROM qbo_sync_status;

-- View sync queue
SELECT
  sync_endpoint,
  direction,
  priority,
  status,
  created_at
FROM qbo_sync_queue
ORDER BY priority DESC, created_at DESC
LIMIT 10;

-- View sync history
SELECT
  sync_type,
  entity_types,
  status,
  success_count,
  failure_count,
  completed_at
FROM qbo_sync_history
ORDER BY completed_at DESC
LIMIT 10;
```

### Via UI (if you added SyncDashboard):

The dashboard shows:
- Connection status with token expiration
- Pending/processing/failed job counts
- Entity-specific sync controls
- Real-time queue status
- Last sync times

---

## 🎯 Step 9: Test the System

### Test 1: Manual Sync

```sql
-- Queue a manual sync for invoices
SELECT trigger_qbo_sync(
  '9af4c081-7379-4e41-8dfb-924e2518e3c6'::uuid,
  'invoices',
  'both',
  'urgent'
);

-- Watch it process (wait ~30 seconds)
SELECT * FROM qbo_sync_queue
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
ORDER BY created_at DESC
LIMIT 5;
```

### Test 2: Full Orchestrated Sync

Call the orchestrator to sync all entities:

```bash
curl -X POST \
  https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-orchestrator \
  -H "Authorization: Bearer <YOUR_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "9af4c081-7379-4e41-8dfb-924e2518e3c6",
    "direction": "both",
    "entities": ["items", "customers", "invoices", "payments"]
  }'
```

### Test 3: Webhook Simulation

Create a test webhook payload:

```bash
curl -X POST \
  https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-webhook-listener \
  -H "Content-Type: application/json" \
  -d '{
    "eventNotifications": [{
      "realmId": "4620816365298360990",
      "dataChangeEvent": {
        "entities": [{
          "name": "Customer",
          "id": "123",
          "operation": "Update",
          "lastUpdated": "2025-11-09T12:00:00Z"
        }]
      }
    }]
  }'
```

Check webhook log:

```sql
SELECT * FROM qbo_webhook_log
ORDER BY received_at DESC
LIMIT 1;
```

---

## 🐛 Troubleshooting

### Issue: Token still expiring

**Check:** Is the cron job running?

```sql
-- View cron job history
SELECT * FROM cron.job_run_details
WHERE jobname = 'qbo-check-token-expiry'
ORDER BY start_time DESC
LIMIT 5;
```

**Fix:** Ensure `app.settings` are configured (Step 1, Migration 3).

### Issue: Syncs not running

**Check:** Is the worker processing the queue?

```sql
-- Check queue status
SELECT status, COUNT(*)
FROM qbo_sync_queue
GROUP BY status;
```

**Fix:** Ensure `qbo-sync-worker` is deployed and cron job is running.

### Issue: Webhooks not working

**Check:** Are webhooks configured in QBO?

**Fix:**
1. Verify webhook URL in QuickBooks Developer Portal
2. Check webhook logs: `SELECT * FROM qbo_webhook_log;`
3. Ensure `QBO_WEBHOOK_VERIFIER_TOKEN` is set

---

## 📈 What Happens After Deployment

Once deployed, here's what runs automatically:

| Frequency | Job | Purpose |
|-----------|-----|---------|
| **Every 1 min** | Process sync queue | Execute pending sync jobs |
| **Every 5 min** | Check token expiry | Auto-refresh expiring tokens ⭐ |
| **Every 30 min** | Push local changes | Send Batchly data → QBO |
| **Every hour** | Sync invoices/payments | Two-way invoice sync |
| **Every 6 hours** | Pull items/customers | Get latest from QBO |
| **Daily 2 AM** | Cleanup old logs | Maintain database size |
| **Real-time** | Webhook listener | Instant sync on QBO changes |

---

## ✅ Success Criteria

After deployment, verify:

- [ ] All 3 migrations applied successfully
- [ ] All 10 edge functions deployed
- [ ] Cron jobs created (8 jobs total)
- [ ] Database settings configured
- [ ] QBO webhook verifier token set
- [ ] QuickBooks webhook URL configured
- [ ] Token auto-refresh working (check every 5 min)
- [ ] Manual sync test successful
- [ ] Webhook test successful (if applicable)
- [ ] UI dashboard accessible (if implemented)

---

## 🎉 You're Done!

Your QuickBooks integration now has:

✅ **Automatic token refresh** - Never expires again!
✅ **Bidirectional sync** - Invoices, customers, items, payments
✅ **Real-time updates** - Via webhooks
✅ **Background jobs** - Automated syncing
✅ **Error handling** - Retries and logging
✅ **Monitoring** - Full visibility into sync status

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. View logs in Supabase Dashboard → Edge Functions → Logs
3. Query sync history: `SELECT * FROM qbo_sync_history ORDER BY completed_at DESC;`
4. Check error summary: `SELECT error_summary FROM qbo_sync_history WHERE status = 'failed';`

---

## 🔄 Regular Maintenance

**Weekly:**
- Review failed syncs: `SELECT * FROM qbo_sync_queue WHERE status = 'failed';`
- Check error rates: `SELECT status, COUNT(*) FROM qbo_sync_history GROUP BY status;`

**Monthly:**
- Review webhook logs for patterns
- Optimize cron schedules if needed
- Clean up old test data

**Quarterly:**
- Review QuickBooks API usage
- Update field mappings if QBO API changes
- Performance optimization

---

**Last Updated:** 2025-11-09
**Version:** 2.0 - Comprehensive 2-way Sync System
