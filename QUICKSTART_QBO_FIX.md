# QuickBooks Integration - Quick Start Fix

## 🚨 Current Problem

Your QuickBooks token expired on **2025-11-09 at 00:42 UTC** (~9 minutes ago).

**Status:**
- `is_active`: FALSE ❌
- Token: EXPIRED ❌
- Organization: `9af4c081-7379-4e41-8dfb-924e2518e3c6`

---

## ⚡ Quick Fix (5 minutes)

### Option 1: Reconnect (Easiest)

1. Go to your app: https://3274bdad-c9e4-429c-9ae4-5beb2ed291db.lovableproject.com/quickbooks
2. Click **"Connect to QuickBooks"**
3. Authorize with QuickBooks
4. You'll be redirected back with fresh tokens ✅

**Done!** Token will be valid for 1 hour.

### Option 2: SQL Refresh (If refresh token still valid)

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste from: `scripts/fix-connection-status.sql`
3. Run the script
4. Follow the recommendations at the end

---

## 🛡️ Permanent Fix (30 minutes)

To **never have this problem again**, deploy the new auto-refresh system I built:

### What You Get:

✅ **Automatic token refresh every 5 minutes**
✅ **Bidirectional sync** for invoices, customers, items, payments
✅ **Real-time webhooks** when QBO data changes
✅ **Background job queue** with retry logic
✅ **Comprehensive monitoring** dashboard

### Deployment Steps:

📖 **Full guide:** See `QUICKBOOKS_DEPLOYMENT_GUIDE.md`

**Quick summary:**

1. **Apply 3 database migrations** (via SQL Editor)
   - `20251109235000_enhance_invoice_record_for_qbo_sync.sql`
   - `20251109235500_create_webhook_and_queue_tables.sql`
   - `20251109235900_setup_scheduled_sync_jobs.sql` ⭐ (Token auto-refresh!)

2. **Deploy 5 edge functions** (via CLI)
   ```bash
   supabase functions deploy qbo-sync-invoices
   supabase functions deploy qbo-sync-items
   supabase functions deploy qbo-sync-orchestrator
   supabase functions deploy qbo-webhook-listener
   supabase functions deploy qbo-sync-worker
   ```

3. **Configure database settings** (in SQL Editor)
   ```sql
   ALTER DATABASE postgres
   SET app.settings.supabase_url = 'https://pnqcbnmrfzqihymmzhkb.supabase.co';

   ALTER DATABASE postgres
   SET app.settings.supabase_service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
   ```

4. **Set up QuickBooks webhooks**
   - Webhook URL: `https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-webhook-listener`
   - Subscribe to: Customer, Item, Invoice, Payment

**Time investment:** 30 minutes
**Benefit:** Never worry about tokens expiring again! Plus full 2-way sync.

---

## 🔍 What I Built For You

The comprehensive sync system includes:

### Database Enhancements
- 50+ new fields for perfect QBO alignment
- Webhook tracking tables
- Sync queue for background processing
- **8 scheduled cron jobs** (including token auto-refresh!)

### Edge Functions
- **qbo-sync-invoices** - Full bidirectional invoice sync
- **qbo-sync-items** - Now supports pushing items to QBO
- **qbo-sync-orchestrator** - Coordinates all syncs with dependency management
- **qbo-webhook-listener** - Real-time sync on QBO changes
- **qbo-sync-worker** - Background job processor with retries

### UI Components
- **SyncDashboard** - Real-time monitoring and manual controls

### Automation
- Token refresh: Every 5 minutes ⭐
- Process queue: Every 1 minute
- Full sync: Every 6 hours
- Invoice sync: Every hour
- Push changes: Every 30 minutes
- Cleanup: Daily

---

## 📊 How It Works After Deployment

```
┌─────────────────────────────────────────────────┐
│         Token Auto-Refresh (Every 5 min)        │
│  Checks if token expires in <10 minutes         │
│  Automatically refreshes before expiration      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              Sync Orchestrator                  │
│  Syncs entities in correct order:               │
│  1. Items + Customers (parallel)                │
│  2. Invoices (needs customers + items)          │
│  3. Payments (needs invoices)                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              Webhook Listener                   │
│  QBO changes → Instant sync queue               │
│  Real-time updates from QuickBooks              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│               Sync Worker                       │
│  Processes queue with retries                   │
│  Handles errors gracefully                      │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Decision Matrix

| If you want... | Choose... | Time | Benefit |
|----------------|-----------|------|---------|
| **Quick fix now** | Reconnect via OAuth | 1 min | Works for 1 hour |
| **Fix + prevent** | Deploy full system | 30 min | Never expires! |
| **Just test** | SQL refresh script | 2 min | Diagnostic info |

---

## 📞 Next Steps

1. **Immediate:** Reconnect to get working again (1 minute)
2. **This week:** Deploy full system to prevent recurrence (30 minutes)
3. **Optional:** Add UI dashboard for monitoring

---

## 📁 File Locations

```
quickbooks-invoice-flow/
├── QUICKSTART_QBO_FIX.md (← You are here)
├── QUICKBOOKS_DEPLOYMENT_GUIDE.md (← Full deployment guide)
├── scripts/
│   ├── fix-connection-status.sql (← Diagnostic script)
│   └── emergency-token-refresh.sql (← Emergency refresh)
├── supabase/
│   ├── migrations/
│   │   ├── 20251109235000_enhance_invoice_record_for_qbo_sync.sql
│   │   ├── 20251109235500_create_webhook_and_queue_tables.sql
│   │   └── 20251109235900_setup_scheduled_sync_jobs.sql
│   └── functions/
│       ├── qbo-sync-invoices/
│       ├── qbo-sync-orchestrator/
│       ├── qbo-webhook-listener/
│       └── qbo-sync-worker/
└── src/
    └── components/
        └── quickbooks/
            └── SyncDashboard.tsx
```

---

## ✅ Verification After Fix

Run this to verify everything is working:

```sql
SELECT
  is_active,
  qbo_token_expires_at > NOW() as token_valid,
  EXTRACT(EPOCH FROM (qbo_token_expires_at - NOW()))/60 as minutes_remaining,
  CASE
    WHEN is_active AND qbo_token_expires_at > NOW() THEN '✅ ALL GOOD'
    ELSE '❌ NEEDS ATTENTION'
  END as status
FROM qbo_connection
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';
```

Expected:
- `is_active`: `true` ✅
- `token_valid`: `true` ✅
- `minutes_remaining`: ~60 ✅
- `status`: `✅ ALL GOOD`

---

## 💡 Pro Tips

1. **After reconnecting:** Deploy the full system to prevent this happening again
2. **Monitor tokens:** After deployment, check that auto-refresh is working
3. **Test webhooks:** Manually trigger a change in QBO to test real-time sync
4. **Use the dashboard:** Provides visibility into sync status and errors

---

**Need help?** See `QUICKBOOKS_DEPLOYMENT_GUIDE.md` for detailed instructions.
