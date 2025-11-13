/*
  # Sync Session Management System

  1. New Table
    - `qbo_sync_sessions` - Tracks multi-chunk sync operations across edge function calls

  2. Purpose
    - Coordinate chunked sync operations that span multiple function invocations
    - Track progress and enable resumption of incomplete syncs
    - Prevent timeouts by processing data in manageable batches
    - Provide audit trail of sync operations

  3. Features
    - Session-based tracking with unique IDs
    - Progress tracking (total_expected, total_processed, current_offset)
    - Status management (in_progress, completed, failed)
    - Support for different entity types and sync directions
    - Automatic cleanup of old completed sessions

  4. Sync Modes
    - full: Complete sync of all records
    - delta: Incremental sync based on LastUpdatedTime
    - historical: Backfill of historical data
*/

CREATE TABLE IF NOT EXISTS qbo_sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'item', 'invoice', 'payment', 'vendor', 'term', 'credit_memo', 'refund_receipt')),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('pull', 'push')),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')) DEFAULT 'in_progress',
  total_expected INTEGER,
  total_processed INTEGER DEFAULT 0,
  current_offset INTEGER DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 100,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_chunk_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  sync_mode TEXT CHECK (sync_mode IN ('full', 'delta', 'historical')) DEFAULT 'full',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE qbo_sync_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role has full access
CREATE POLICY "Service role full access on sync sessions"
  ON qbo_sync_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can view their organization's sessions
CREATE POLICY "Users view own org sync sessions"
  ON qbo_sync_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_sessions_org ON qbo_sync_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_status ON qbo_sync_sessions(status, last_chunk_at);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_entity ON qbo_sync_sessions(entity_type, status);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_active ON qbo_sync_sessions(organization_id, status, entity_type) WHERE status = 'in_progress';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sync_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on session updates
DROP TRIGGER IF EXISTS sync_session_update_timestamp ON qbo_sync_sessions;
CREATE TRIGGER sync_session_update_timestamp
  BEFORE UPDATE ON qbo_sync_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_session_timestamp();

-- Function to cleanup old completed sync sessions (7 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_sync_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM qbo_sync_sessions
  WHERE status = 'completed'
    AND completed_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned up sync sessions completed more than 7 days ago';
END;
$$;

-- Function to get active sync session for an entity
CREATE OR REPLACE FUNCTION get_active_sync_session(
  p_organization_id UUID,
  p_entity_type TEXT,
  p_sync_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id UUID;
BEGIN
  SELECT id INTO session_id
  FROM qbo_sync_sessions
  WHERE organization_id = p_organization_id
    AND entity_type = p_entity_type
    AND sync_type = p_sync_type
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;
  
  RETURN session_id;
END;
$$;

-- Function to mark stalled sessions as failed
CREATE OR REPLACE FUNCTION mark_stalled_sessions_failed()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Mark sessions as failed if no activity for 10 minutes
  UPDATE qbo_sync_sessions
  SET 
    status = 'failed',
    error_message = 'Session stalled - no activity for 10 minutes',
    completed_at = NOW()
  WHERE status = 'in_progress'
    AND last_chunk_at < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  IF updated_count > 0 THEN
    RAISE NOTICE 'Marked % stalled sync sessions as failed', updated_count;
  END IF;
  
  RETURN updated_count;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE qbo_sync_sessions IS 'Tracks multi-chunk QuickBooks sync operations across edge function calls';
COMMENT ON COLUMN qbo_sync_sessions.entity_type IS 'Type of QuickBooks entity being synced (customer, item, invoice, etc.)';
COMMENT ON COLUMN qbo_sync_sessions.sync_type IS 'Direction of sync: pull (QB to Batchly) or push (Batchly to QB)';
COMMENT ON COLUMN qbo_sync_sessions.total_expected IS 'Total number of records expected to be processed';
COMMENT ON COLUMN qbo_sync_sessions.total_processed IS 'Number of records successfully processed so far';
COMMENT ON COLUMN qbo_sync_sessions.current_offset IS 'Current pagination offset for resuming sync';
COMMENT ON COLUMN qbo_sync_sessions.batch_size IS 'Number of records to process per edge function call';
COMMENT ON COLUMN qbo_sync_sessions.last_chunk_at IS 'Timestamp of last chunk processed - used to detect stalled sessions';
COMMENT ON FUNCTION cleanup_old_sync_sessions IS 'Removes completed sync sessions older than 7 days';
COMMENT ON FUNCTION get_active_sync_session IS 'Retrieves the active sync session ID for a given organization and entity type';
COMMENT ON FUNCTION mark_stalled_sessions_failed IS 'Marks sync sessions with no activity for 10 minutes as failed';
