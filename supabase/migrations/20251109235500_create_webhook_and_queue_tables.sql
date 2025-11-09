-- Migration: Create tables for webhook processing and sync queue
-- Purpose: Support real-time webhook notifications and background sync processing
-- Date: 2025-11-09

-- ============================================================================
-- PART 1: Create qbo_webhook_log table
-- Stores all webhook notifications received from QuickBooks
-- ============================================================================

CREATE TABLE IF NOT EXISTS qbo_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  signature TEXT,
  processed_events JSONB,
  errors JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE qbo_webhook_log IS
  'Audit log of all webhook notifications received from QuickBooks Online.';

COMMENT ON COLUMN qbo_webhook_log.payload IS
  'Full webhook payload from QuickBooks.';

COMMENT ON COLUMN qbo_webhook_log.signature IS
  'HMAC signature for webhook verification.';

COMMENT ON COLUMN qbo_webhook_log.processed_events IS
  'Array of successfully processed events from this webhook.';

COMMENT ON COLUMN qbo_webhook_log.errors IS
  'Array of errors encountered while processing this webhook.';

-- Index for querying webhooks by status
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_log_status
  ON qbo_webhook_log(status, received_at DESC);

-- Index for querying recent webhooks
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_log_received_at
  ON qbo_webhook_log(received_at DESC);

-- GIN index for searching payload
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_log_payload
  ON qbo_webhook_log USING gin(payload);

-- ============================================================================
-- PART 2: Create qbo_webhook_processed table
-- Tracks processed webhook events for idempotency (prevent duplicate processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS qbo_webhook_processed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('Create', 'Update', 'Delete', 'Merge', 'Void')),
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE qbo_webhook_processed IS
  'Tracks processed webhook events to prevent duplicate processing (idempotency).';

COMMENT ON COLUMN qbo_webhook_processed.event_id IS
  'Unique identifier for this event: {realmId}-{entityType}-{entityId}-{lastUpdated}';

COMMENT ON COLUMN qbo_webhook_processed.organization_id IS
  'Organization that owns this entity.';

COMMENT ON COLUMN qbo_webhook_processed.realm_id IS
  'QuickBooks realm (company) ID.';

COMMENT ON COLUMN qbo_webhook_processed.entity_type IS
  'Type of entity that changed (Customer, Invoice, Item, Payment, etc.)';

COMMENT ON COLUMN qbo_webhook_processed.entity_id IS
  'QuickBooks ID of the entity that changed.';

COMMENT ON COLUMN qbo_webhook_processed.operation IS
  'Operation that occurred: Create, Update, Delete, Merge, or Void.';

-- Unique index to prevent duplicate event processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_qbo_webhook_processed_event_id
  ON qbo_webhook_processed(event_id);

-- Index for querying by organization and entity
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_processed_org_entity
  ON qbo_webhook_processed(organization_id, entity_type, entity_id);

-- Index for cleanup queries (delete old processed events)
CREATE INDEX IF NOT EXISTS idx_qbo_webhook_processed_processed_at
  ON qbo_webhook_processed(processed_at);

-- ============================================================================
-- PART 3: Create qbo_sync_queue table
-- Queue for background sync processing (triggered by webhooks or scheduled jobs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS qbo_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sync_endpoint TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('pull', 'push', 'both')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  entity_ids TEXT[], -- Optional: specific entity IDs to sync
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE qbo_sync_queue IS
  'Queue for background sync jobs. Jobs can be triggered by webhooks, scheduled tasks, or manual requests.';

COMMENT ON COLUMN qbo_sync_queue.sync_endpoint IS
  'Name of the sync function to invoke (e.g., qbo-sync-customers, qbo-sync-invoices).';

COMMENT ON COLUMN qbo_sync_queue.direction IS
  'Sync direction: pull (QBO -> Batchly), push (Batchly -> QBO), or both.';

COMMENT ON COLUMN qbo_sync_queue.priority IS
  'Job priority: low, normal, high, or urgent. Higher priority jobs are processed first.';

COMMENT ON COLUMN qbo_sync_queue.status IS
  'Current status of the sync job.';

COMMENT ON COLUMN qbo_sync_queue.entity_ids IS
  'Optional array of specific entity IDs to sync. If null, syncs all entities.';

COMMENT ON COLUMN qbo_sync_queue.retry_count IS
  'Number of times this job has been retried after failure.';

COMMENT ON COLUMN qbo_sync_queue.max_retries IS
  'Maximum number of retry attempts before marking job as failed.';

COMMENT ON COLUMN qbo_sync_queue.scheduled_at IS
  'When this job is scheduled to run. If null, run immediately.';

-- Index for fetching next pending job
CREATE INDEX IF NOT EXISTS idx_qbo_sync_queue_pending
  ON qbo_sync_queue(status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for organization sync jobs
CREATE INDEX IF NOT EXISTS idx_qbo_sync_queue_org
  ON qbo_sync_queue(organization_id, status);

-- Index for cleanup (delete old completed jobs)
CREATE INDEX IF NOT EXISTS idx_qbo_sync_queue_completed_at
  ON qbo_sync_queue(completed_at)
  WHERE status IN ('completed', 'failed', 'cancelled');

-- ============================================================================
-- PART 4: Create function to get next sync job from queue
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_sync_job()
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  sync_endpoint TEXT,
  direction TEXT,
  entity_ids TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  UPDATE qbo_sync_queue
  SET
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE qbo_sync_queue.id = (
    SELECT qbo_sync_queue.id
    FROM qbo_sync_queue
    WHERE qbo_sync_queue.status = 'pending'
      AND (qbo_sync_queue.scheduled_at IS NULL OR qbo_sync_queue.scheduled_at <= NOW())
      AND qbo_sync_queue.retry_count < qbo_sync_queue.max_retries
    ORDER BY
      CASE qbo_sync_queue.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      qbo_sync_queue.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    qbo_sync_queue.id,
    qbo_sync_queue.organization_id,
    qbo_sync_queue.sync_endpoint,
    qbo_sync_queue.direction,
    qbo_sync_queue.entity_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_next_sync_job IS
  'Gets the next pending sync job from the queue and marks it as processing. Uses FOR UPDATE SKIP LOCKED for concurrency safety.';

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION get_next_sync_job TO service_role;

-- ============================================================================
-- PART 5: Create function to mark sync job as completed
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_sync_job(
  p_job_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE qbo_sync_queue
  SET
    status = p_status,
    error_message = p_error_message,
    completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
    retry_count = CASE WHEN p_status = 'failed' THEN retry_count + 1 ELSE retry_count END,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_sync_job IS
  'Marks a sync job as completed, failed, or cancelled. Increments retry_count on failure.';

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION complete_sync_job TO service_role;

-- ============================================================================
-- PART 6: Create function to requeue failed jobs
-- ============================================================================

CREATE OR REPLACE FUNCTION requeue_failed_job(p_job_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE qbo_sync_queue
  SET
    status = 'pending',
    started_at = NULL,
    error_message = NULL,
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'failed'
    AND retry_count < max_retries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION requeue_failed_job IS
  'Requeues a failed sync job for retry. Only works if retry_count < max_retries.';

-- Grant execute to service role and authenticated users
GRANT EXECUTE ON FUNCTION requeue_failed_job TO service_role;
GRANT EXECUTE ON FUNCTION requeue_failed_job TO authenticated;

-- ============================================================================
-- PART 7: Create trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_qbo_sync_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qbo_sync_queue_updated_at ON qbo_sync_queue;
CREATE TRIGGER trg_qbo_sync_queue_updated_at
  BEFORE UPDATE ON qbo_sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_qbo_sync_queue_updated_at();

-- ============================================================================
-- PART 8: Create cleanup functions for old records
-- ============================================================================

-- Function to clean up old webhook logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM qbo_webhook_log
  WHERE received_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webhook_logs IS
  'Deletes webhook logs older than 30 days. Returns number of deleted records.';

-- Function to clean up old processed webhook events (older than 60 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_processed()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM qbo_webhook_processed
  WHERE processed_at < NOW() - INTERVAL '60 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webhook_processed IS
  'Deletes processed webhook events older than 60 days. Returns number of deleted records.';

-- Function to clean up old completed sync jobs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_sync_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM qbo_sync_queue
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_sync_jobs IS
  'Deletes completed/failed/cancelled sync jobs older than 7 days. Returns number of deleted records.';

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_logs TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_processed TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_sync_jobs TO service_role;

-- ============================================================================
-- PART 9: Enable RLS on new tables
-- ============================================================================

ALTER TABLE qbo_webhook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_webhook_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_sync_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY service_role_all_webhook_log ON qbo_webhook_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_all_webhook_processed ON qbo_webhook_processed
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_all_sync_queue ON qbo_sync_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view their own organization's sync queue
CREATE POLICY org_members_view_sync_queue ON qbo_sync_queue
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- - Created qbo_webhook_log table for webhook audit trail
-- - Created qbo_webhook_processed table for idempotency tracking
-- - Created qbo_sync_queue table for background sync processing
-- - Created 6 helper functions for queue management and cleanup
-- - Created 1 trigger for automatic timestamp updates
-- - Created 10 indexes for query performance
-- - Enabled RLS with appropriate policies
-- Total: 3 tables, 6 functions, 1 trigger, 10 indexes, 4 RLS policies
