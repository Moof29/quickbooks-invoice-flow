-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_qbo_connection_secure(uuid);

-- Step 1: Create a secure view that excludes sensitive token data
CREATE OR REPLACE VIEW qbo_connection_safe AS
SELECT 
  id,
  organization_id,
  qbo_realm_id,
  qbo_company_id,
  is_active,
  last_connected_at,
  last_sync_at,
  created_at,
  updated_at,
  environment,
  qbo_token_expires_at,
  CASE WHEN qbo_access_token IS NOT NULL THEN true ELSE false END AS has_access_token,
  CASE WHEN qbo_refresh_token IS NOT NULL THEN true ELSE false END AS has_refresh_token
FROM qbo_connection;

-- Step 2: Drop the existing permissive RLS policy
DROP POLICY IF EXISTS qbo_connection_admin_only ON qbo_connection;

-- Step 3: Create strict RLS policy - only service_role can access tokens
CREATE POLICY "Service role can manage qbo_connection"
ON qbo_connection
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 4: Grant permissions on the safe view
GRANT SELECT ON qbo_connection_safe TO authenticated;

-- Step 5: Create secure function for edge functions to get tokens
CREATE OR REPLACE FUNCTION public.get_qbo_connection_for_sync(p_organization_id UUID)
RETURNS TABLE(
  id uuid,
  organization_id uuid,
  qbo_realm_id text,
  qbo_company_id text,
  qbo_access_token text,
  qbo_refresh_token text,
  qbo_token_expires_at timestamptz,
  environment text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Service role only';
  END IF;

  RETURN QUERY
  SELECT c.id, c.organization_id, c.qbo_realm_id, c.qbo_company_id, 
         c.qbo_access_token, c.qbo_refresh_token, c.qbo_token_expires_at,
         c.environment, c.is_active
  FROM qbo_connection c
  WHERE c.organization_id = p_organization_id AND c.is_active = true
  LIMIT 1;
END;
$$;

-- Step 6: Create function to update tokens
CREATE OR REPLACE FUNCTION public.update_qbo_connection_tokens(
  p_organization_id UUID,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_token_expires_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Service role only';
  END IF;

  UPDATE qbo_connection
  SET qbo_access_token = p_access_token,
      qbo_refresh_token = p_refresh_token,
      qbo_token_expires_at = p_token_expires_at,
      updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO audit_events (organization_id, event_type, entity_type, severity, detail)
  VALUES (p_organization_id, 'qbo_tokens_updated', 'qbo_connection', 'info',
          jsonb_build_object('timestamp', now()));
END;
$$;

-- Step 7: Create safe function for UI (returns connection status only, no tokens)
CREATE OR REPLACE FUNCTION public.get_qbo_connection_secure(org_id uuid)
RETURNS TABLE(
  id uuid, 
  organization_id uuid, 
  qbo_realm_id text, 
  qbo_company_id text, 
  is_active boolean, 
  last_connected_at timestamptz, 
  last_sync_at timestamptz,
  has_access_token boolean,
  has_refresh_token boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND organization_id = org_id
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  SELECT c.id, c.organization_id, c.qbo_realm_id, c.qbo_company_id, c.is_active,
         c.last_connected_at, c.last_sync_at,
         (c.qbo_access_token IS NOT NULL) as has_access_token,
         (c.qbo_refresh_token IS NOT NULL) as has_refresh_token
  FROM qbo_connection c
  WHERE c.organization_id = org_id;
END;
$$;

-- Step 8: Add audit trigger
CREATE OR REPLACE FUNCTION public.audit_qbo_token_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    INSERT INTO audit_events (organization_id, event_type, entity_type, entity_id, severity, detail)
    VALUES (COALESCE(NEW.organization_id, OLD.organization_id), 'qbo_token_access', 
            'qbo_connection', COALESCE(NEW.id, OLD.id), 'info',
            jsonb_build_object('operation', TG_OP, 'timestamp', now()));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_qbo_token_access_trigger ON qbo_connection;
CREATE TRIGGER audit_qbo_token_access_trigger
  AFTER UPDATE ON qbo_connection
  FOR EACH ROW EXECUTE FUNCTION audit_qbo_token_access();

-- Add comments
COMMENT ON VIEW qbo_connection_safe IS 'Safe view without tokens - use for UI';
COMMENT ON FUNCTION public.get_qbo_connection_for_sync IS 'INTERNAL: Service role only';
COMMENT ON FUNCTION public.update_qbo_connection_tokens IS 'INTERNAL: Service role only';