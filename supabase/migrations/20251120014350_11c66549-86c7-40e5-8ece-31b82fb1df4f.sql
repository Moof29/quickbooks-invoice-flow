-- Clear stuck invoice sync sessions that are blocking new syncs
-- These sessions show status='in_progress' but total_processed=0 (no actual progress)
UPDATE qbo_sync_sessions
SET status = 'failed',
    error_message = 'Cleared for fresh sync - session was stale with no progress',
    completed_at = NOW()
WHERE entity_type = 'invoice'
  AND status = 'in_progress'
  AND total_processed = 0
  AND started_at < NOW() - INTERVAL '2 minutes';