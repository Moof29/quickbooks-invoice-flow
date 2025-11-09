-- Function to reactivate existing valid QBO connections
CREATE OR REPLACE FUNCTION public.reactivate_qbo_connection(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_is_active BOOLEAN;
BEGIN
  -- Get current connection status
  SELECT qbo_token_expires_at, is_active 
  INTO v_expires_at, v_is_active
  FROM qbo_connection
  WHERE organization_id = p_organization_id;
  
  -- Check if connection exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if token is still valid
  IF v_expires_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Reactivate if token is valid but is_active is false
  IF NOT v_is_active THEN
    UPDATE qbo_connection
    SET 
      is_active = TRUE,
      updated_at = NOW()
    WHERE organization_id = p_organization_id;
    
    RETURN TRUE;
  END IF;
  
  -- Already active
  RETURN TRUE;
END;
$$;