-- Drop and recreate the get_qbo_connection_for_sync function with correct types
DROP FUNCTION IF EXISTS get_qbo_connection_for_sync(uuid);

CREATE OR REPLACE FUNCTION get_qbo_connection_for_sync(org_id uuid)
RETURNS TABLE (
  access_token text,
  refresh_token text,
  realm_id text,
  token_expires_at timestamptz,
  environment text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qc.qbo_access_token::text,
    qc.qbo_refresh_token::text,
    qc.qbo_realm_id::text,
    qc.qbo_token_expires_at,
    qc.environment::text
  FROM qbo_connection qc
  WHERE qc.organization_id = org_id
    AND qc.is_active = true
  LIMIT 1;
END;
$$;