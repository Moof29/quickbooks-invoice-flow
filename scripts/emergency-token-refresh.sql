-- Emergency token refresh script
-- Run this in Supabase SQL Editor to immediately refresh your expired token

-- Call the token refresh function for your organization
SELECT supabase.functions.invoke(
  'qbo-token-refresh',
  '{"organizationId": "9af4c081-7379-4e41-8dfb-924e2518e3c6"}'::jsonb
);

-- Check if it worked
SELECT
  organization_id,
  is_active,
  qbo_token_expires_at,
  qbo_token_expires_at > NOW() as token_is_valid,
  EXTRACT(EPOCH FROM (qbo_token_expires_at - NOW()))/60 as minutes_until_expiry
FROM qbo_connection
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';
