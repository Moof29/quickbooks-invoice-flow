-- Drop existing function first
DROP FUNCTION IF EXISTS get_qbo_connection_for_sync(uuid);

-- Recreate with consistent field names with qbo_ prefix
CREATE OR REPLACE FUNCTION get_qbo_connection_for_sync(p_organization_id UUID)
RETURNS TABLE(
  organization_id UUID,
  qbo_access_token TEXT,
  qbo_refresh_token TEXT,
  qbo_realm_id TEXT,
  qbo_token_expires_at TIMESTAMPTZ,
  environment TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qc.organization_id,
    qc.qbo_access_token::TEXT,
    qc.qbo_refresh_token::TEXT,
    qc.qbo_realm_id::TEXT,
    qc.qbo_token_expires_at,
    qc.environment::TEXT
  FROM qbo_connection qc
  WHERE qc.organization_id = p_organization_id
    AND qc.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';