# Supabase Support Ticket - Database Configuration Request

## Project Information
- **Project Reference**: `pnqcbnmrfzqihymmzhkb`
- **Project Name**: Batchly ERP
- **Plan**: [Your plan - Free/Pro/Team/Enterprise]
- **Region**: [Your region]

## Request Type
Database Configuration - Set Application Settings for pg_cron

## Request Details

We need to configure database-level settings to enable our pg_cron jobs to make HTTP calls to Supabase Edge Functions. These settings are required for automated QuickBooks sync operations.

### SQL Commands to Execute (Superuser Required)

Please run the following SQL commands as a database superuser:

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://pnqcbnmrfzqihymmzhkb.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw';
```

### Verification Query

After setting, please confirm with:

```sql
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'app.settings.%';
```

Expected output:
```
name                           | setting
-------------------------------|------------------------------------------
app.settings.supabase_url      | https://pnqcbnmrfzqihymmzhkb.supabase.co
app.settings.service_role_key  | eyJhbGciOiJ...
```

## Business Context

We have 6 pg_cron jobs configured for automated QuickBooks data synchronization:
1. Token refresh (every 30 minutes)
2. Sync session continuation (every 2 minutes)
3. Customer sync (daily at 2am)
4. Item sync (daily at 3am)
5. Payment sync during business hours (every 30 min)
6. Payment sync off-hours (every 2 hours)

These jobs use `pg_net.http_post()` to call edge functions, which requires accessing these database settings via `current_setting('app.settings.supabase_url')`.

## Technical Background

The `ALTER DATABASE` command requires superuser privileges which are not available through the SQL Editor. This is a standard configuration for pg_cron + pg_net + edge function integration patterns.

## Impact if Not Configured

Without these settings, all 6 cron jobs will fail with:
```
ERROR: unrecognized configuration parameter "app.settings.supabase_url"
```

This blocks our automated sync system from functioning.

## Urgency
**Medium-High** - We can manually trigger syncs in the interim, but automation is critical for Phase 1 production launch.

## References
- pg_cron documentation: https://github.com/citusdata/pg_cron
- pg_net documentation: https://github.com/supabase/pg_net
- Our cron job implementation: `/supabase/migrations/` (multiple files)

---

**Submitted by**: [Your name/email]
**Date**: 2025-11-16
**Expected Response Time**: [Based on your plan SLA]
