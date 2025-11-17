# Manual QuickBooks Sync Testing Guide

**Purpose**: Validate QB sync edge functions work correctly before enabling automated cron jobs

**Prerequisites**:
- Active QB sandbox connection in `qbo_connection` table
- Valid OAuth tokens (not expired)
- Service role key available

---

## Test Environment Setup

### 1. Get Your Organization ID

```sql
-- Run in Supabase SQL Editor
SELECT
  organization_id,
  qbo_realm_id,
  qbo_company_name,
  environment,
  qbo_token_expires_at,
  CASE
    WHEN qbo_token_expires_at < NOW() THEN '❌ EXPIRED - Reconnect QB first'
    WHEN qbo_token_expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ Expires soon'
    ELSE '✅ Valid'
  END AS token_status
FROM qbo_connection
WHERE is_active = true;
```

**Save the `organization_id`** - you'll need it for all tests below.

---

## Test 1: Customer Sync (Pull from QuickBooks)

### Manual Trigger via cURL

```bash
curl -X POST 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-customers' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw' \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationId": "YOUR_ORG_ID_HERE",
    "direction": "pull"
  }'
```

### Expected Success Response

```json
{
  "success": true,
  "entity_type": "customer",
  "direction": "pull",
  "total_processed": 5,
  "successful": 5,
  "failed": 0,
  "duration_seconds": 3.2,
  "pagination": {
    "total_pages": 1,
    "current_batch": 500
  }
}
```

### Verify Results in Database

```sql
-- Check synced customers
SELECT
  id,
  name,
  email,
  qbo_id,
  qbo_sync_status,
  last_sync_at
FROM customer_profile
WHERE organization_id = 'YOUR_ORG_ID_HERE'
  AND qbo_id IS NOT NULL
ORDER BY last_sync_at DESC;
```

**Expected**: New customers with `qbo_id` populated and `qbo_sync_status = 'synced'`

### Check Sync History

```sql
SELECT
  entity_type,
  sync_type,
  status,
  entity_count,
  success_count,
  failure_count,
  started_at,
  completed_at,
  error_summary
FROM qbo_sync_history
WHERE entity_type = 'customer'
ORDER BY started_at DESC
LIMIT 5;
```

---

## Test 2: Item Sync (Pull from QuickBooks)

### Manual Trigger

```bash
curl -X POST 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-items' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw' \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationId": "YOUR_ORG_ID_HERE",
    "direction": "pull"
  }'
```

### Verify Results

```sql
SELECT
  id,
  name,
  sku,
  unit_price,
  qbo_id,
  sync_status,
  last_sync_at
FROM item_record
WHERE organization_id = 'YOUR_ORG_ID_HERE'
  AND qbo_id IS NOT NULL
ORDER BY last_sync_at DESC;
```

---

## Test 3: Payment Sync (Pull from QuickBooks)

### Manual Trigger

```bash
curl -X POST 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-payments' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw' \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationId": "YOUR_ORG_ID_HERE",
    "direction": "pull"
  }'
```

### Verify Results

```sql
SELECT
  id,
  amount,
  payment_date,
  payment_method,
  qbo_id,
  qbo_sync_status,
  last_sync_at
FROM invoice_payment
WHERE organization_id = 'YOUR_ORG_ID_HERE'
  AND qbo_id IS NOT NULL
ORDER BY last_sync_at DESC;
```

---

## Test 4: Comprehensive Sync Status Check

### Call Dashboard Status Function

```sql
SELECT get_qb_sync_status('YOUR_ORG_ID_HERE');
```

### Expected Output Structure

```json
{
  "organization_id": "...",
  "generated_at": "2025-11-16T...",
  "connection": {
    "is_connected": true,
    "environment": "sandbox",
    "company_name": "Sandbox Company",
    "token_expires_soon": false
  },
  "entities": {
    "customers": {
      "total": 5,
      "synced": 5,
      "pending": 0,
      "failed": 0,
      "with_qbo_id": 5
    },
    "items": {
      "total": 10,
      "synced": 10,
      "pending": 0,
      "failed": 0
    },
    "invoices": { ... },
    "payments": { ... }
  },
  "health": {
    "overall_status": "healthy",
    "needs_attention": false
  }
}
```

---

## Test 5: Token Refresh

### Manual Token Refresh

```bash
curl -X POST 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-token-refresh' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw' \
  -H 'Content-Type: application/json' \
  -d '{
    "organizationId": "YOUR_ORG_ID_HERE"
  }'
```

### Verify Token Updated

```sql
SELECT
  organization_id,
  qbo_token_expires_at AS old_expiry,
  NOW() + INTERVAL '1 hour' AS expected_new_expiry,
  updated_at
FROM qbo_connection
WHERE organization_id = 'YOUR_ORG_ID_HERE'
  AND is_active = true;
```

**Expected**: `qbo_token_expires_at` should be ~1 hour from now

---

## Test 6: Delta Sync Infrastructure

### Check Delta Sync Timestamps

```sql
SELECT * FROM delta_sync_status
WHERE organization_id = 'YOUR_ORG_ID_HERE';
```

### Test Delta Sync Helpers

```sql
-- Get last customer sync time
SELECT get_delta_sync_timestamp('YOUR_ORG_ID_HERE', 'customer');

-- Update customer sync timestamp
SELECT update_delta_sync_timestamp('YOUR_ORG_ID_HERE', 'customer', NOW());

-- Verify it updated
SELECT last_customer_sync_at
FROM qbo_connection
WHERE organization_id = 'YOUR_ORG_ID_HERE';
```

---

## Common Issues & Troubleshooting

### Issue 1: Token Expired

**Symptom**: Edge function returns 401 Unauthorized

**Fix**:
1. Go to QB Integration page in app
2. Click "Disconnect"
3. Click "Connect to QuickBooks"
4. Complete OAuth flow
5. Retry sync

### Issue 2: Rate Limit (429)

**Symptom**: Edge function returns 429 Too Many Requests

**Expected**: Rate limiter should auto-retry with backoff

**Check**: Look for retries in response:
```json
{
  "retries": 2,
  "final_status": "success"
}
```

### Issue 3: No Data Synced

**Symptom**: Success response but no records in database

**Check**:
1. Verify QB Sandbox has data:
   - Log into QB Sandbox
   - Check Customers, Items, Invoices exist
2. Check sync history for errors:
   ```sql
   SELECT error_summary FROM qbo_sync_history ORDER BY started_at DESC LIMIT 1;
   ```

### Issue 4: Edge Function Timeout

**Symptom**: Request times out after 60 seconds

**Expected**: Large syncs (>1000 records) should paginate automatically

**Check**: Response should show pagination:
```json
{
  "pagination": {
    "total_pages": 3,
    "current_page": 1
  }
}
```

---

## Success Criteria

Before enabling cron jobs, all tests should pass:

- ✅ Test 1: Customers sync successfully
- ✅ Test 2: Items sync successfully
- ✅ Test 3: Payments sync successfully (if QB has payment data)
- ✅ Test 4: Dashboard status returns accurate counts
- ✅ Test 5: Token refresh works
- ✅ Test 6: Delta sync timestamps update correctly

---

## Next Steps After Manual Tests Pass

1. **Enable Cron Jobs**: Run the workaround migration
   ```bash
   # Apply the hardcoded cron migration
   supabase db push
   ```

2. **Monitor First Automated Run**:
   ```sql
   -- Check cron job history (refresh every minute)
   SELECT
     j.jobname,
     jrd.status,
     jrd.return_message,
     jrd.start_time,
     jrd.end_time
   FROM cron.job_run_details jrd
   JOIN cron.job j ON j.jobid = jrd.jobid
   WHERE j.jobname LIKE 'qbo-%'
   ORDER BY jrd.start_time DESC
   LIMIT 10;
   ```

3. **Watch for Issues**:
   - Token refresh should run every 30 minutes
   - Sync session continuation every 2 minutes
   - First daily syncs at 2am, 3am next day

---

## Support Resources

- **Edge Function Logs**: Supabase Dashboard → Edge Functions → Logs
- **Database Logs**: Supabase Dashboard → Database → Logs
- **QB API Docs**: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/customer
- **Rate Limits**: 500 requests/minute per app

---

**Last Updated**: 2025-11-16
