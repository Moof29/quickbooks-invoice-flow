-- Migration: Create get_qb_sync_status Database Function
-- Purpose: Provide comprehensive QB sync status for dashboard (Task 1.2)
-- Date: 2025-11-13

-- ==============================================================================
-- Drop existing function if exists
-- ==============================================================================
DROP FUNCTION IF EXISTS get_qb_sync_status(uuid);

-- ==============================================================================
-- Create get_qb_sync_status function
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_qb_sync_status(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_customer_stats jsonb;
  v_item_stats jsonb;
  v_invoice_stats jsonb;
  v_payment_stats jsonb;
  v_last_sync jsonb;
  v_connection_status jsonb;
BEGIN
  -- Check if organization exists
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Get QuickBooks connection status
  SELECT jsonb_build_object(
    'is_connected', COUNT(*) > 0,
    'environment', MAX(environment),
    'company_name', MAX(qbo_company_name),
    'realm_id', MAX(qbo_realm_id),
    'token_expires_at', MAX(qbo_token_expires_at),
    'token_expires_soon', MAX(qbo_token_expires_at) < (NOW() + interval '1 hour'),
    'last_connected_at', MAX(created_at)
  )
  INTO v_connection_status
  FROM qbo_connection
  WHERE organization_id = p_organization_id
    AND is_active = true;

  -- Get customer sync statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'synced', COUNT(*) FILTER (WHERE qbo_sync_status = 'synced'),
    'pending', COUNT(*) FILTER (WHERE qbo_sync_status = 'pending' OR qbo_sync_status IS NULL),
    'failed', COUNT(*) FILTER (WHERE qbo_sync_status = 'failed'),
    'with_qbo_id', COUNT(*) FILTER (WHERE qbo_id IS NOT NULL),
    'last_synced', MAX(last_sync_at),
    'oldest_pending', MIN(updated_at) FILTER (WHERE qbo_sync_status = 'pending')
  )
  INTO v_customer_stats
  FROM customer_profile
  WHERE organization_id = p_organization_id
    AND is_active = true;

  -- Get item sync statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'synced', COUNT(*) FILTER (WHERE sync_status = 'synced'),
    'pending', COUNT(*) FILTER (WHERE sync_status = 'pending' OR sync_status IS NULL),
    'failed', COUNT(*) FILTER (WHERE sync_status = 'failed'),
    'with_qbo_id', COUNT(*) FILTER (WHERE qbo_id IS NOT NULL),
    'tracked_inventory', COUNT(*) FILTER (WHERE track_qty_on_hand = true),
    'low_stock', COUNT(*) FILTER (
      WHERE track_qty_on_hand = true
        AND quantity_on_hand IS NOT NULL
        AND reorder_point IS NOT NULL
        AND quantity_on_hand <= reorder_point
    ),
    'last_synced', MAX(last_sync_at),
    'oldest_pending', MIN(updated_at) FILTER (WHERE sync_status = 'pending')
  )
  INTO v_item_stats
  FROM item_record
  WHERE organization_id = p_organization_id
    AND is_active = true;

  -- Get invoice sync statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'synced', COUNT(*) FILTER (WHERE qbo_sync_status = 'synced'),
    'pending', COUNT(*) FILTER (WHERE qbo_sync_status = 'pending' OR qbo_sync_status IS NULL),
    'failed', COUNT(*) FILTER (WHERE qbo_sync_status = 'failed'),
    'with_qbo_id', COUNT(*) FILTER (WHERE qbo_id IS NOT NULL),
    'draft', COUNT(*) FILTER (WHERE status = 'draft'),
    'sent', COUNT(*) FILTER (WHERE status = 'sent'),
    'paid', COUNT(*) FILTER (WHERE status = 'paid'),
    'overdue', COUNT(*) FILTER (WHERE status = 'overdue'),
    'total_amount', COALESCE(SUM(total_amount), 0),
    'unpaid_amount', COALESCE(SUM(balance), 0),
    'last_synced', MAX(last_sync_at),
    'oldest_pending', MIN(updated_at) FILTER (WHERE qbo_sync_status = 'pending')
  )
  INTO v_invoice_stats
  FROM invoice_record
  WHERE organization_id = p_organization_id;

  -- Get payment sync statistics
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'synced', COUNT(*) FILTER (WHERE qbo_sync_status = 'synced'),
    'pending', COUNT(*) FILTER (WHERE qbo_sync_status = 'pending' OR qbo_sync_status IS NULL),
    'failed', COUNT(*) FILTER (WHERE qbo_sync_status = 'failed'),
    'with_qbo_id', COUNT(*) FILTER (WHERE qbo_id IS NOT NULL),
    'unapplied', COUNT(*) FILTER (WHERE unapplied = true),
    'total_amount', COALESCE(SUM(amount), 0),
    'unapplied_amount', COALESCE(SUM(unapplied_amount), 0),
    'last_synced', MAX(last_sync_at),
    'oldest_pending', MIN(created_at) FILTER (WHERE qbo_sync_status = 'pending')
  )
  INTO v_payment_stats
  FROM invoice_payment
  WHERE organization_id = p_organization_id;

  -- Get recent sync history (last 10 syncs)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'sync_type', sync_type,
      'entity_types', entity_types,
      'status', status,
      'entity_count', entity_count,
      'success_count', success_count,
      'failure_count', failure_count,
      'started_at', started_at,
      'completed_at', completed_at,
      'duration_seconds', EXTRACT(EPOCH FROM (completed_at - started_at)),
      'error_summary', error_summary
    )
    ORDER BY started_at DESC
  )
  INTO v_last_sync
  FROM (
    SELECT *
    FROM qbo_sync_history
    WHERE organization_id = p_organization_id
    ORDER BY started_at DESC
    LIMIT 10
  ) recent_syncs;

  -- Build final result
  v_result := jsonb_build_object(
    'organization_id', p_organization_id,
    'generated_at', NOW(),
    'connection', v_connection_status,
    'entities', jsonb_build_object(
      'customers', v_customer_stats,
      'items', v_item_stats,
      'invoices', v_invoice_stats,
      'payments', v_payment_stats
    ),
    'recent_syncs', COALESCE(v_last_sync, '[]'::jsonb),
    'health', jsonb_build_object(
      'overall_status', CASE
        WHEN (v_connection_status->>'is_connected')::boolean = false THEN 'disconnected'
        WHEN (v_connection_status->>'token_expires_soon')::boolean = true THEN 'token_expiring'
        WHEN (
          COALESCE((v_customer_stats->>'failed')::int, 0) +
          COALESCE((v_item_stats->>'failed')::int, 0) +
          COALESCE((v_invoice_stats->>'failed')::int, 0) +
          COALESCE((v_payment_stats->>'failed')::int, 0)
        ) > 0 THEN 'has_failures'
        WHEN (
          COALESCE((v_customer_stats->>'pending')::int, 0) +
          COALESCE((v_item_stats->>'pending')::int, 0) +
          COALESCE((v_invoice_stats->>'pending')::int, 0) +
          COALESCE((v_payment_stats->>'pending')::int, 0)
        ) > 0 THEN 'pending_sync'
        ELSE 'healthy'
      END,
      'total_pending', (
        COALESCE((v_customer_stats->>'pending')::int, 0) +
        COALESCE((v_item_stats->>'pending')::int, 0) +
        COALESCE((v_invoice_stats->>'pending')::int, 0) +
        COALESCE((v_payment_stats->>'pending')::int, 0)
      ),
      'total_failed', (
        COALESCE((v_customer_stats->>'failed')::int, 0) +
        COALESCE((v_item_stats->>'failed')::int, 0) +
        COALESCE((v_invoice_stats->>'failed')::int, 0) +
        COALESCE((v_payment_stats->>'failed')::int, 0)
      ),
      'needs_attention', (
        (v_connection_status->>'is_connected')::boolean = false OR
        (v_connection_status->>'token_expires_soon')::boolean = true OR
        (
          COALESCE((v_customer_stats->>'failed')::int, 0) +
          COALESCE((v_item_stats->>'failed')::int, 0) +
          COALESCE((v_invoice_stats->>'failed')::int, 0) +
          COALESCE((v_payment_stats->>'failed')::int, 0)
        ) > 0
      )
    )
  );

  RETURN v_result;
END;
$$;

-- ==============================================================================
-- Grant execute permission
-- ==============================================================================
GRANT EXECUTE ON FUNCTION get_qb_sync_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_qb_sync_status(uuid) TO service_role;

-- ==============================================================================
-- Add helpful comment
-- ==============================================================================
COMMENT ON FUNCTION get_qb_sync_status(uuid) IS
  'Returns comprehensive QuickBooks sync status for an organization including entity counts, sync history, and health metrics';

-- ==============================================================================
-- ROLLBACK SCRIPT (for reference)
-- ==============================================================================
/*
-- To rollback this migration, run:
DROP FUNCTION IF EXISTS get_qb_sync_status(uuid);
*/
