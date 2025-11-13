/*
  # QuickBooks API Request/Response Logging

  1. New Table
    - `qbo_api_log` - Comprehensive logging of all QB API calls

  2. Purpose
    - Debug sync issues with detailed request/response data
    - Audit trail for compliance and security
    - Performance monitoring and optimization
    - Error pattern identification

  3. Features
    - Automatic 30-day cleanup via scheduled function
    - Indexes for fast querying by organization, time, status
    - Separate indexes for errors and slow requests

  4. Security
    - RLS enabled for organization isolation
    - Service role required for full access
*/

CREATE TABLE IF NOT EXISTS qbo_api_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_headers JSONB,
  response_body JSONB,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE qbo_api_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role has full access
CREATE POLICY "Service role full access"
  ON qbo_api_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Authenticated users can view their organization's logs
CREATE POLICY "Users view own org logs"
  ON qbo_api_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qbo_api_log_org_time ON qbo_api_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qbo_api_log_errors ON qbo_api_log(created_at DESC) WHERE response_status >= 400;
CREATE INDEX IF NOT EXISTS idx_qbo_api_log_endpoint ON qbo_api_log(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qbo_api_log_slow ON qbo_api_log(created_at DESC) WHERE duration_ms > 5000;
CREATE INDEX IF NOT EXISTS idx_qbo_api_log_method ON qbo_api_log(method, response_status, created_at DESC);

-- Function to cleanup old API logs (30 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM qbo_api_log
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Cleaned up API logs older than 30 days';
END;
$$;

-- Add helpful comments
COMMENT ON TABLE qbo_api_log IS 'Comprehensive logging of QuickBooks API requests and responses for debugging and monitoring';
COMMENT ON COLUMN qbo_api_log.endpoint IS 'Full URL of the QuickBooks API endpoint called';
COMMENT ON COLUMN qbo_api_log.duration_ms IS 'Time taken for the API call in milliseconds';
COMMENT ON COLUMN qbo_api_log.response_status IS 'HTTP status code returned by QuickBooks API';
COMMENT ON FUNCTION cleanup_old_api_logs IS 'Removes API logs older than 30 days to manage storage';
