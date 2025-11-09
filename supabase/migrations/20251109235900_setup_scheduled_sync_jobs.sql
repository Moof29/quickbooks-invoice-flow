-- Migration: Setup scheduled sync jobs using pg_cron
-- Purpose: Automate QuickBooks sync operations with scheduled background jobs
-- Date: 2025-11-09

-- ============================================================================
-- IMPORTANT: This migration requires pg_cron extension
-- Supabase Pro plans include pg_cron by default
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- PART 1: Scheduled job to process sync queue
-- Runs every 1 minute to process pending sync jobs
-- ============================================================================

SELECT cron.schedule(
  'process-qbo-sync-queue',           -- Job name
  '* * * * *',                         -- Cron expression: every minute
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-sync-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'maxConcurrent', 5,
        'maxJobs', 20
      )
    ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Job scheduler for PostgreSQL. Used to run QuickBooks sync jobs periodically.';

-- ============================================================================
-- PART 2: Scheduled job for full sync (items and customers)
-- Runs every 6 hours to pull latest items and customers from QuickBooks
-- ============================================================================

SELECT cron.schedule(
  'qbo-sync-items-customers-pull',
  '0 */6 * * *',                       -- Every 6 hours at minute 0
  $$
  -- Queue items sync
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-items' AS sync_endpoint,
    'pull' AS direction,
    'normal' AS priority
  FROM qbo_connection
  WHERE is_active = true;

  -- Queue customers sync
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-customers' AS sync_endpoint,
    'pull' AS direction,
    'normal' AS priority
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- ============================================================================
-- PART 3: Scheduled job for invoice and payment sync
-- Runs every hour to sync invoices and payments
-- ============================================================================

SELECT cron.schedule(
  'qbo-sync-invoices-payments',
  '15 * * * *',                        -- Every hour at minute 15
  $$
  -- Queue invoice sync (both directions)
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-invoices' AS sync_endpoint,
    'both' AS direction,
    'high' AS priority
  FROM qbo_connection
  WHERE is_active = true;

  -- Queue payments sync (pull only)
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-payments' AS sync_endpoint,
    'pull' AS direction,
    'high' AS priority
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- ============================================================================
-- PART 4: Scheduled job to push new/modified records
-- Runs every 30 minutes to push local changes to QuickBooks
-- ============================================================================

SELECT cron.schedule(
  'qbo-push-local-changes',
  '*/30 * * * *',                      -- Every 30 minutes
  $$
  -- Push customers
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-customers' AS sync_endpoint,
    'push' AS direction,
    'normal' AS priority
  FROM qbo_connection
  WHERE is_active = true;

  -- Push items
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-items' AS sync_endpoint,
    'push' AS direction,
    'normal' AS priority
  FROM qbo_connection
  WHERE is_active = true;

  -- Push invoices
  INSERT INTO qbo_sync_queue (organization_id, sync_endpoint, direction, priority)
  SELECT
    organization_id,
    'qbo-sync-invoices' AS sync_endpoint,
    'push' AS direction,
    'normal' AS priority
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

-- ============================================================================
-- PART 5: Scheduled cleanup jobs
-- Run daily at 2 AM to clean up old records
-- ============================================================================

-- Clean up old webhook logs (older than 30 days)
SELECT cron.schedule(
  'cleanup-old-webhook-logs',
  '0 2 * * *',                         -- Daily at 2:00 AM
  $$
  SELECT cleanup_old_webhook_logs();
  $$
);

-- Clean up old processed webhook events (older than 60 days)
SELECT cron.schedule(
  'cleanup-old-webhook-processed',
  '15 2 * * *',                        -- Daily at 2:15 AM
  $$
  SELECT cleanup_old_webhook_processed();
  $$
);

-- Clean up old completed sync jobs (older than 7 days)
SELECT cron.schedule(
  'cleanup-old-sync-jobs',
  '30 2 * * *',                        -- Daily at 2:30 AM
  $$
  SELECT cleanup_old_sync_jobs();
  $$
);

-- Clean up old sync history (older than 90 days)
SELECT cron.schedule(
  'cleanup-old-sync-history',
  '45 2 * * *',                        -- Daily at 2:45 AM
  $$
  DELETE FROM qbo_sync_history
  WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);

-- ============================================================================
-- PART 6: Scheduled token refresh check
-- Runs every 5 minutes to check for expiring tokens and refresh them
-- ============================================================================

SELECT cron.schedule(
  'qbo-check-token-expiry',
  '*/5 * * * *',                       -- Every 5 minutes
  $$
  -- Queue token refresh for connections expiring in next 10 minutes
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-token-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'organizationId', organization_id::text
      )
    ) AS request_id
  FROM qbo_connection
  WHERE is_active = true
    AND qbo_token_expires_at < NOW() + INTERVAL '10 minutes'
    AND qbo_token_expires_at > NOW();
  $$
);

-- ============================================================================
-- PART 7: Create table to track cron job execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS qbo_cron_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  records_processed INTEGER,
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE qbo_cron_execution_log IS
  'Tracks execution of cron jobs for monitoring and debugging.';

-- Index for querying job execution history
CREATE INDEX IF NOT EXISTS idx_qbo_cron_execution_log_job_name
  ON qbo_cron_execution_log(job_name, executed_at DESC);

-- Index for querying failed jobs
CREATE INDEX IF NOT EXISTS idx_qbo_cron_execution_log_failed
  ON qbo_cron_execution_log(status, executed_at DESC)
  WHERE status = 'failed';

-- ============================================================================
-- PART 8: Create function to view scheduled jobs
-- ============================================================================

CREATE OR REPLACE FUNCTION get_qbo_scheduled_jobs()
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN,
  jobname TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM cron.job
  WHERE jobname LIKE 'qbo-%' OR jobname LIKE '%qbo%'
  ORDER BY jobid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_qbo_scheduled_jobs IS
  'Returns all QuickBooks-related scheduled jobs from pg_cron.';

-- Grant execute to authenticated users (for monitoring)
GRANT EXECUTE ON FUNCTION get_qbo_scheduled_jobs TO authenticated;

-- ============================================================================
-- PART 9: Create function to manually trigger a sync job
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_qbo_sync(
  p_organization_id UUID,
  p_entity_type TEXT,
  p_direction TEXT DEFAULT 'both',
  p_priority TEXT DEFAULT 'urgent'
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
  v_sync_endpoint TEXT;
BEGIN
  -- Map entity type to sync endpoint
  v_sync_endpoint := CASE p_entity_type
    WHEN 'items' THEN 'qbo-sync-items'
    WHEN 'customers' THEN 'qbo-sync-customers'
    WHEN 'invoices' THEN 'qbo-sync-invoices'
    WHEN 'payments' THEN 'qbo-sync-payments'
    ELSE NULL
  END;

  IF v_sync_endpoint IS NULL THEN
    RAISE EXCEPTION 'Invalid entity type: %. Valid options: items, customers, invoices, payments', p_entity_type;
  END IF;

  -- Validate direction
  IF p_direction NOT IN ('pull', 'push', 'both') THEN
    RAISE EXCEPTION 'Invalid direction: %. Valid options: pull, push, both', p_direction;
  END IF;

  -- Validate priority
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %. Valid options: low, normal, high, urgent', p_priority;
  END IF;

  -- Insert sync job
  INSERT INTO qbo_sync_queue (
    organization_id,
    sync_endpoint,
    direction,
    priority,
    status
  )
  VALUES (
    p_organization_id,
    v_sync_endpoint,
    p_direction,
    p_priority,
    'pending'
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_qbo_sync IS
  'Manually trigger a QuickBooks sync job. Returns the job ID. Usage: SELECT trigger_qbo_sync(''org-id'', ''invoices'', ''both'', ''urgent'')';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION trigger_qbo_sync TO authenticated;

-- ============================================================================
-- PART 10: Create helper view for monitoring sync jobs
-- ============================================================================

CREATE OR REPLACE VIEW qbo_sync_status AS
SELECT
  qc.organization_id,
  o.name as organization_name,
  qc.is_active as connection_active,
  qc.last_sync_at,
  qc.qbo_token_expires_at,
  CASE
    WHEN qc.qbo_token_expires_at < NOW() THEN 'expired'
    WHEN qc.qbo_token_expires_at < NOW() + INTERVAL '1 hour' THEN 'expiring_soon'
    ELSE 'valid'
  END as token_status,
  (SELECT COUNT(*) FROM qbo_sync_queue WHERE organization_id = qc.organization_id AND status = 'pending') as pending_jobs,
  (SELECT COUNT(*) FROM qbo_sync_queue WHERE organization_id = qc.organization_id AND status = 'processing') as processing_jobs,
  (SELECT COUNT(*) FROM qbo_sync_queue WHERE organization_id = qc.organization_id AND status = 'failed' AND retry_count >= max_retries) as failed_jobs,
  (SELECT completed_at FROM qbo_sync_history WHERE organization_id = qc.organization_id ORDER BY completed_at DESC LIMIT 1) as last_successful_sync
FROM qbo_connection qc
JOIN organizations o ON qc.organization_id = o.id
WHERE qc.is_active = true;

COMMENT ON VIEW qbo_sync_status IS
  'Monitoring view showing QuickBooks sync status for all active connections.';

-- Grant select to authenticated users
GRANT SELECT ON qbo_sync_status TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- - Enabled pg_cron extension
-- - Created 7 scheduled jobs:
--   1. Process sync queue (every 1 minute)
--   2. Full sync items/customers (every 6 hours)
--   3. Sync invoices/payments (every hour)
--   4. Push local changes (every 30 minutes)
--   5-7. Cleanup jobs (daily at 2 AM)
--   8. Token refresh check (every 5 minutes)
-- - Created 1 execution log table
-- - Created 3 helper functions for monitoring and manual triggers
-- - Created 1 monitoring view
-- Total: 1 extension, 8 cron jobs, 1 table, 3 functions, 1 view

-- Note: To configure Supabase settings, run:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'your-service-role-key';
