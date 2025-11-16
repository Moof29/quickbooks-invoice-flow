-- Prompt 6: Delta sync columns + functions + status view
ALTER TABLE qbo_connection 
ADD COLUMN IF NOT EXISTS last_customer_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_item_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_invoice_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_sync_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION get_delta_sync_timestamp(p_organization_id UUID, p_entity_type TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timestamp TIMESTAMPTZ;
BEGIN
  EXECUTE format('SELECT last_%s_sync_at FROM qbo_connection WHERE organization_id=$1 AND is_active=true', p_entity_type)
  INTO v_timestamp
  USING p_organization_id;
  RETURN COALESCE(v_timestamp, '1970-01-01'::TIMESTAMPTZ);
END;
$$;

CREATE OR REPLACE FUNCTION update_delta_sync_timestamp(p_organization_id UUID, p_entity_type TEXT, p_timestamp TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('UPDATE qbo_connection SET last_%s_sync_at=$1, updated_at=NOW() WHERE organization_id=$2 AND is_active=true', p_entity_type)
  USING p_timestamp, p_organization_id;
END;
$$;

CREATE OR REPLACE VIEW delta_sync_status AS
SELECT 
  organization_id,
  last_customer_sync_at,
  last_item_sync_at,
  last_invoice_sync_at,
  last_payment_sync_at,
  GREATEST(
    COALESCE(last_customer_sync_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(last_item_sync_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(last_invoice_sync_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(last_payment_sync_at, '1970-01-01'::TIMESTAMPTZ)
  ) AS most_recent_sync,
  NOW() - GREATEST(
    COALESCE(last_customer_sync_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(last_item_sync_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(last_invoice_sync_at, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(last_payment_sync_at, '1970-01-01'::TIMESTAMPTZ)
  ) AS time_since_last_sync
FROM qbo_connection
WHERE is_active = true;