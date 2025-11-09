-- QuickBooks Connection Status Fix
-- Run this script to diagnose and fix connection issues

-- ===========================================================================
-- STEP 1: Check current connection status
-- ===========================================================================
SELECT
  '=== Current Connection Status ===' as step,
  organization_id,
  is_active,
  qbo_token_expires_at,
  NOW() as current_time,
  qbo_token_expires_at < NOW() as is_expired,
  CASE
    WHEN qbo_token_expires_at < NOW() THEN 'EXPIRED - Need to reconnect or refresh'
    WHEN qbo_token_expires_at < NOW() + INTERVAL '10 minutes' THEN 'EXPIRING SOON - Will auto-refresh'
    ELSE 'VALID'
  END as token_status,
  EXTRACT(EPOCH FROM (qbo_token_expires_at - NOW()))/60 as minutes_until_expiry,
  (qbo_access_token IS NOT NULL) as has_access_token,
  (qbo_refresh_token IS NOT NULL) as has_refresh_token,
  last_connected_at,
  last_sync_at
FROM qbo_connection
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';

-- ===========================================================================
-- STEP 2: Try to refresh the token
-- ===========================================================================
-- This will only work if refresh token is still valid
SELECT '=== Attempting Token Refresh ===' as step;

-- NOTE: This requires qbo-token-refresh edge function to be deployed
-- If you get an error, the function may not be deployed yet
DO $$
BEGIN
  PERFORM supabase.functions.invoke(
    'qbo-token-refresh',
    '{"organizationId": "9af4c081-7379-4e41-8dfb-924e2518e3c6"}'::jsonb
  );
  RAISE NOTICE 'Token refresh initiated. Check results in step 3.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Token refresh failed: %. You need to reconnect via OAuth.', SQLERRM;
END $$;

-- ===========================================================================
-- STEP 3: Check if refresh worked
-- ===========================================================================
SELECT
  '=== After Refresh Attempt ===' as step,
  is_active,
  qbo_token_expires_at > NOW() as is_valid,
  EXTRACT(EPOCH FROM (qbo_token_expires_at - NOW()))/60 as minutes_remaining,
  CASE
    WHEN is_active AND qbo_token_expires_at > NOW() THEN '✅ CONNECTION RESTORED'
    WHEN qbo_token_expires_at < NOW() THEN '❌ STILL EXPIRED - Reconnect needed'
    WHEN NOT is_active THEN '⚠️ TOKEN VALID BUT INACTIVE - Run Step 4'
    ELSE '⚠️ UNKNOWN STATE'
  END as status
FROM qbo_connection
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';

-- ===========================================================================
-- STEP 4: Force reactivate if token is valid but connection is inactive
-- ===========================================================================
-- ONLY run this if Step 3 shows "TOKEN VALID BUT INACTIVE"
-- This requires service_role permissions

-- UNCOMMENT if needed:
-- UPDATE qbo_connection
-- SET is_active = true
-- WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
--   AND qbo_token_expires_at > NOW();

-- ===========================================================================
-- STEP 5: Check for pending sync jobs
-- ===========================================================================
SELECT
  '=== Pending Sync Jobs ===' as step,
  COUNT(*) as total_pending,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM qbo_sync_queue
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
  AND status IN ('pending', 'processing', 'failed');

-- ===========================================================================
-- STEP 6: View recent sync history
-- ===========================================================================
SELECT
  '=== Recent Sync History ===' as step,
  sync_type,
  entity_types,
  status,
  success_count,
  failure_count,
  completed_at
FROM qbo_sync_history
WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
ORDER BY completed_at DESC
LIMIT 5;

-- ===========================================================================
-- RECOMMENDATIONS
-- ===========================================================================
SELECT
  '=== RECOMMENDATIONS ===' as heading,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM qbo_connection
      WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
        AND qbo_token_expires_at < NOW()
    ) THEN '1. Token is EXPIRED. You need to reconnect via QuickBooks OAuth.
           Go to QuickBooks Integration page and click "Connect to QuickBooks".

2. After reconnecting, deploy the new auto-refresh system to prevent this:
   - Apply migration: 20251109235900_setup_scheduled_sync_jobs.sql
   - This adds automatic token refresh every 5 minutes

3. Configure database settings:
   ALTER DATABASE postgres SET app.settings.supabase_url = ''your-url'';
   ALTER DATABASE postgres SET app.settings.supabase_service_role_key = ''your-key'';'

    WHEN EXISTS (
      SELECT 1 FROM qbo_connection
      WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
        AND qbo_token_expires_at > NOW()
        AND NOT is_active
    ) THEN 'Token is valid but connection is inactive.
           Run Step 4 above to reactivate the connection.'

    ELSE 'Connection appears to be working!

Next steps:
1. Deploy new sync system (see QUICKBOOKS_DEPLOYMENT_GUIDE.md)
2. Enable automatic token refresh
3. Set up webhooks for real-time sync'
  END as recommendation;
