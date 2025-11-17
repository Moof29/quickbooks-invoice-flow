/*
  # WORKAROUND: Hardcoded Cron Jobs for QB Sync

  Purpose: Enable cron jobs immediately without waiting for Supabase support
           to configure app.settings

  Trade-off: Less flexible (URLs hardcoded) but works immediately

  Note: Replace this with app.settings version once support configures database

  Migration Date: 2025-11-16
*/

-- =====================================================================
-- Drop existing cron jobs that use current_setting()
-- =====================================================================

SELECT cron.unschedule('qbo-token-refresh-check');
SELECT cron.unschedule('qbo-continue-sync-sessions');
SELECT cron.unschedule('qbo-sync-customers-daily');
SELECT cron.unschedule('qbo-sync-items-daily');
SELECT cron.unschedule('qbo-sync-payments-business-hours');
SELECT cron.unschedule('qbo-sync-payments-off-hours');

-- =====================================================================
-- Recreate cron jobs with hardcoded URLs (WORKAROUND)
-- =====================================================================

-- Job 1: Token Refresh Check (Every 30 minutes)
-- =====================================================================
SELECT cron.schedule(
  'qbo-token-refresh-check',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw'
    ),
    body := jsonb_build_object('organizationId', organization_id::text)
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- Job 2: Continue Sync Sessions (Every 2 minutes)
-- =====================================================================
SELECT cron.schedule(
  'qbo-continue-sync-sessions',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-continue-sync-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Job 3: Daily Customer Sync (2am daily)
-- =====================================================================
SELECT cron.schedule(
  'qbo-sync-customers-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-customers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw'
    ),
    body := jsonb_build_object(
      'organizationId', organization_id::text,
      'direction', 'pull'
    )
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- Job 4: Daily Item Sync (3am daily)
-- =====================================================================
SELECT cron.schedule(
  'qbo-sync-items-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-items',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw'
    ),
    body := jsonb_build_object(
      'organizationId', organization_id::text,
      'direction', 'pull'
    )
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- Job 5: Payment Sync - Business Hours (Every 30 min, 8am-6pm weekdays)
-- =====================================================================
SELECT cron.schedule(
  'qbo-sync-payments-business-hours',
  '*/30 8-18 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw'
    ),
    body := jsonb_build_object(
      'organizationId', organization_id::text,
      'direction', 'pull'
    )
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- Job 6: Payment Sync - Off Hours (Every 2 hours, off business hours)
-- =====================================================================
SELECT cron.schedule(
  'qbo-sync-payments-off-hours',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/qbo-sync-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw'
    ),
    body := jsonb_build_object(
      'organizationId', organization_id::text,
      'direction', 'pull'
    )
  )
  FROM qbo_connection
  WHERE is_active = true
    AND EXTRACT(HOUR FROM NOW()) NOT BETWEEN 8 AND 18;
  $$
);

-- =====================================================================
-- Verify Cron Jobs
-- =====================================================================

-- List all QB sync cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  active,
  'Now active with hardcoded URLs' AS status
FROM cron.job
WHERE jobname LIKE 'qbo-%'
ORDER BY jobname;

-- =====================================================================
-- NOTES FOR FUTURE CLEANUP
-- =====================================================================

/*
  When Supabase support configures app.settings, replace this migration with:

  1. Drop these hardcoded jobs
  2. Recreate using current_setting() pattern
  3. Update service_role_key if it changes

  See: docs/supabase-support-ticket-template.md
*/

COMMENT ON FUNCTION cron.schedule IS
  'TEMPORARY: Using hardcoded URLs until app.settings configured. See migration 20251116_workaround_cron_hardcoded_urls.sql';
