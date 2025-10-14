-- Add portal management fields to customer_profile
ALTER TABLE customer_profile 
ADD COLUMN IF NOT EXISTS portal_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS portal_invitation_sent_at timestamp with time zone;

-- Create index for faster portal user lookups
CREATE INDEX IF NOT EXISTS idx_customer_portal_user_links_customer_id 
ON customer_portal_user_links(customer_id);

-- Add a function to get portal status for a customer
CREATE OR REPLACE FUNCTION get_customer_portal_status(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'portal_enabled', cp.portal_enabled,
    'has_portal_user', EXISTS(
      SELECT 1 FROM customer_portal_user_links 
      WHERE customer_id = p_customer_id
    ),
    'portal_user_id', cpul.portal_user_id,
    'email_verified', cpul.email_verified,
    'last_login_at', cpul.last_login_at
  ) INTO v_result
  FROM customer_profile cp
  LEFT JOIN customer_portal_user_links cpul ON cpul.customer_id = cp.id
  WHERE cp.id = p_customer_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;