-- =====================================================================
-- SUPABASE PHASE 1 QB SYNC VERIFICATION AUDIT
-- Project: pnqcbnmrfzqihymmzhkb
-- Date: 2025-11-16
-- Purpose: Comprehensive verification of QuickBooks sync infrastructure
-- =====================================================================

-- Section 1: Extensions Check
-- =====================================================================
SELECT '=== SECTION 1: EXTENSIONS ===' AS section;

SELECT
  extname AS extension_name,
  extversion AS version,
  CASE WHEN extname IN ('pg_cron', 'pg_net', 'pgsodium') THEN '✅' ELSE '⚠️' END AS status
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'pgsodium', 'pgcrypto')
ORDER BY extname;

-- Section 2: Core Business Tables
-- =====================================================================
SELECT '=== SECTION 2: CORE BUSINESS TABLES ===' AS section;

SELECT
  schemaname,
  tablename,
  CASE WHEN tablename IN (
    'organizations', 'profiles', 'customer_profile', 'item_record',
    'invoice_record', 'invoice_line_item', 'invoice_payment', 'qbo_connection'
  ) THEN '✅' ELSE '⚠️' END AS required_table
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'profiles', 'customer_profile', 'item_record',
    'invoice_record', 'invoice_line_item', 'invoice_payment', 'qbo_connection'
  )
ORDER BY tablename;

-- Section 3: QB Sync Infrastructure Tables
-- =====================================================================
SELECT '=== SECTION 3: SYNC INFRASTRUCTURE TABLES ===' AS section;

SELECT
  tablename,
  CASE WHEN relrowsecurity THEN '✅ RLS Enabled' ELSE '❌ RLS Disabled' END AS rls_status
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
  AND tablename LIKE '%qbo%' OR tablename LIKE '%sync%'
ORDER BY tablename;

-- Section 4: QB Connection Table Details
-- =====================================================================
SELECT '=== SECTION 4: QBO_CONNECTION TABLE DETAILS ===' AS section;

SELECT
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN column_name LIKE 'last_%_sync_at' THEN '✅ Delta Sync'
    WHEN column_name LIKE 'encrypted_%' THEN '🔒 Encryption'
    WHEN column_name LIKE 'qbo_%' THEN '📡 QB Field'
    ELSE '📋 Standard'
  END AS column_category
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'qbo_connection'
ORDER BY ordinal_position;

-- Section 5: Delta Sync Infrastructure
-- =====================================================================
SELECT '=== SECTION 5: DELTA SYNC INFRASTRUCTURE ===' AS section;

-- Check for delta sync columns
SELECT
  column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN '✅ Nullable' ELSE '❌ Required' END AS nullable_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'qbo_connection'
  AND column_name IN ('last_customer_sync_at', 'last_item_sync_at', 'last_invoice_sync_at', 'last_payment_sync_at');

-- Check for delta sync functions
SELECT
  routine_name,
  routine_type,
  '✅' AS exists
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_delta_sync_timestamp', 'update_delta_sync_timestamp');

-- Check for delta sync view
SELECT
  table_name,
  table_type,
  '✅' AS exists
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'delta_sync_status';

-- Section 6: Token Encryption Status
-- =====================================================================
SELECT '=== SECTION 6: TOKEN ENCRYPTION STATUS ===' AS section;

-- Check encryption columns
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_name = 'encrypted_access_token' THEN '🔒 Access Token Encrypted'
    WHEN column_name = 'encrypted_refresh_token' THEN '🔒 Refresh Token Encrypted'
    WHEN column_name = 'encryption_key_id' THEN '🔑 Key ID'
    WHEN column_name = 'qbo_access_token' THEN '⚠️ Plaintext Access'
    WHEN column_name = 'qbo_refresh_token' THEN '⚠️ Plaintext Refresh'
    ELSE 'Other'
  END AS security_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'qbo_connection'
  AND (column_name LIKE '%token%' OR column_name = 'encryption_key_id');

-- Check encryption functions
SELECT
  routine_name,
  '✅' AS exists
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'encrypt_qbo_token', 'decrypt_qbo_token',
    'get_qbo_tokens_decrypted', 'migrate_tokens_to_encrypted'
  );

-- Section 7: RPC Functions for QB Sync
-- =====================================================================
SELECT '=== SECTION 7: QB SYNC RPC FUNCTIONS ===' AS section;

SELECT
  routine_name,
  routine_type,
  data_type AS return_type,
  CASE
    WHEN routine_name = 'get_qbo_connection_for_sync' THEN '🔌 Connection RPC'
    WHEN routine_name = 'get_qb_sync_status' THEN '📊 Dashboard Status'
    WHEN routine_name LIKE '%delta%' THEN '📅 Delta Sync'
    ELSE '🔧 Utility'
  END AS function_category
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%qbo%' OR
    routine_name LIKE '%qb_%' OR
    routine_name LIKE '%delta%sync%'
  )
ORDER BY routine_name;

-- Section 8: pg_cron Jobs
-- =====================================================================
SELECT '=== SECTION 8: PG_CRON SCHEDULED JOBS ===' AS section;

SELECT
  jobid,
  jobname,
  schedule,
  active,
  CASE
    WHEN jobname LIKE '%qbo%' OR jobname LIKE '%qb%' THEN '📡 QB Sync Job'
    WHEN jobname LIKE '%token%' THEN '🔑 Token Management'
    WHEN jobname LIKE '%batch%' THEN '📦 Batch Processing'
    ELSE '🔧 Other'
  END AS job_category
FROM cron.job
ORDER BY jobname;

-- Section 9: Recent Cron Job Execution History
-- =====================================================================
SELECT '=== SECTION 9: CRON JOB EXECUTION HISTORY (Last 10) ===' AS section;

SELECT
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) AS duration_seconds
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
ORDER BY jrd.start_time DESC
LIMIT 10;

-- Section 10: Active QB Connections
-- =====================================================================
SELECT '=== SECTION 10: ACTIVE QB CONNECTIONS ===' AS section;

SELECT
  organization_id,
  qbo_realm_id,
  qbo_company_name,
  environment,
  is_active,
  qbo_token_expires_at,
  CASE
    WHEN qbo_token_expires_at < NOW() THEN '❌ Token Expired'
    WHEN qbo_token_expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ Expires Soon'
    ELSE '✅ Token Valid'
  END AS token_status,
  last_sync_at
FROM qbo_connection
WHERE is_active = true;

-- Section 11: Data Health - Entity Counts
-- =====================================================================
SELECT '=== SECTION 11: DATA HEALTH - ENTITY COUNTS ===' AS section;

-- Customers with QB sync status
SELECT
  'Customers' AS entity_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE qbo_id IS NOT NULL) AS with_qbo_id,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'synced') AS synced,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'failed') AS failed
FROM customer_profile
WHERE is_active = true;

-- Items with QB sync status
SELECT
  'Items' AS entity_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE qbo_id IS NOT NULL) AS with_qbo_id,
  COUNT(*) FILTER (WHERE sync_status = 'synced') AS synced,
  COUNT(*) FILTER (WHERE sync_status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE sync_status = 'failed') AS failed
FROM item_record
WHERE is_active = true;

-- Invoices
SELECT
  'Invoices' AS entity_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE qbo_id IS NOT NULL) AS with_qbo_id,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'synced') AS synced,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'failed') AS failed
FROM invoice_record;

-- Payments
SELECT
  'Payments' AS entity_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE qbo_id IS NOT NULL) AS with_qbo_id,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'synced') AS synced,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE qbo_sync_status = 'failed') AS failed
FROM invoice_payment;

-- Section 12: RLS Policy Check
-- =====================================================================
SELECT '=== SECTION 12: RLS POLICIES ON SENSITIVE TABLES ===' AS section;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename LIKE '%qbo%' OR tablename IN ('customer_profile', 'invoice_record', 'invoice_payment'))
ORDER BY tablename, policyname;

-- Section 13: Recent Sync History
-- =====================================================================
SELECT '=== SECTION 13: RECENT SYNC HISTORY ===' AS section;

SELECT
  entity_type,
  sync_type,
  status,
  entity_count,
  success_count,
  failure_count,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds
FROM qbo_sync_history
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC
LIMIT 20;

-- =====================================================================
-- END OF VERIFICATION AUDIT
-- =====================================================================
