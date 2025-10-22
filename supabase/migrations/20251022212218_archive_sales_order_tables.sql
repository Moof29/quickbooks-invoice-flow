-- Migration: Archive old sales_order tables
-- Date: 2025-10-22
-- Purpose: Rename and preserve old tables for backup (DO NOT DROP)
-- WARNING: This makes sales_order tables read-only. Keep for 90 days minimum.

-- Step 1: Disable all triggers on sales_order tables before archiving
ALTER TABLE sales_order DISABLE TRIGGER ALL;
ALTER TABLE sales_order_line_item DISABLE TRIGGER ALL;
ALTER TABLE sales_order_invoice_link DISABLE TRIGGER ALL;

-- Step 2: Rename tables to _archived suffix
ALTER TABLE sales_order RENAME TO sales_order_archived;
ALTER TABLE sales_order_line_item RENAME TO sales_order_line_item_archived;
ALTER TABLE sales_order_invoice_link RENAME TO sales_order_invoice_link_archived;

-- Step 3: Rename associated indexes
-- Sales order indexes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'sales_order_archived'
      AND schemaname = 'public'
      AND indexname NOT LIKE '%_archived'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I',
      r.indexname,
      r.indexname || '_archived'
    );
  END LOOP;
END $$;

-- Sales order line item indexes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'sales_order_line_item_archived'
      AND schemaname = 'public'
      AND indexname NOT LIKE '%_archived'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I',
      r.indexname,
      r.indexname || '_archived'
    );
  END LOOP;
END $$;

-- Sales order invoice link indexes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'sales_order_invoice_link_archived'
      AND schemaname = 'public'
      AND indexname NOT LIKE '%_archived'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I',
      r.indexname,
      r.indexname || '_archived'
    );
  END LOOP;
END $$;

-- Step 4: Rename constraints
-- Note: Foreign key constraints are automatically renamed with the table

-- Step 5: Add comments with archive information
COMMENT ON TABLE sales_order_archived IS
  'ARCHIVED on ' || CURRENT_DATE ||
  ' - Data migrated to invoice_record table (unified model). ' ||
  'Keep for 90 days minimum for rollback capability. ' ||
  'All triggers disabled. Read-only backup.';

COMMENT ON TABLE sales_order_line_item_archived IS
  'ARCHIVED on ' || CURRENT_DATE ||
  ' - Data migrated to invoice_line_item table. ' ||
  'Keep for 90 days minimum. All triggers disabled.';

COMMENT ON TABLE sales_order_invoice_link_archived IS
  'ARCHIVED on ' || CURRENT_DATE ||
  ' - Preserved for historical reference. ' ||
  'New links created in existing table for migrated records.';

-- Step 6: Create view for easy access to archived data (read-only)
CREATE OR REPLACE VIEW sales_order_archive_view AS
SELECT
  soa.*,
  'ARCHIVED - Migrated to invoice_record' as archive_status
FROM sales_order_archived soa;

COMMENT ON VIEW sales_order_archive_view IS 'Read-only view of archived sales orders. For reference only.';

-- Step 7: Archive old functions that reference sales_order
-- Rename functions instead of dropping them
DO $$
BEGIN
  -- Rename create_invoice_from_sales_order if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_invoice_from_sales_order'
  ) THEN
    ALTER FUNCTION create_invoice_from_sales_order
      RENAME TO create_invoice_from_sales_order_archived;

    COMMENT ON FUNCTION create_invoice_from_sales_order_archived IS
      'ARCHIVED - Replaced by bulk_update_invoice_status. Kept for reference.';
  END IF;

  -- Rename create_invoice_from_sales_order_sql if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_invoice_from_sales_order_sql'
  ) THEN
    ALTER FUNCTION create_invoice_from_sales_order_sql
      RENAME TO create_invoice_from_sales_order_sql_archived;

    COMMENT ON FUNCTION create_invoice_from_sales_order_sql_archived IS
      'ARCHIVED - No longer needed in unified model. Kept for reference.';
  END IF;

  -- Rename batch_create_invoices_from_orders if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'batch_create_invoices_from_orders'
  ) THEN
    ALTER FUNCTION batch_create_invoices_from_orders
      RENAME TO batch_create_invoices_from_orders_archived;

    COMMENT ON FUNCTION batch_create_invoices_from_orders_archived IS
      'ARCHIVED - Replaced by bulk_update_invoice_status. Kept for reference.';
  END IF;
END $$;

-- Step 8: Create rollback instructions as a function
CREATE OR REPLACE FUNCTION rollback_to_sales_order_model()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN '
  -- ROLLBACK INSTRUCTIONS (if needed)
  -- Run these commands to restore original sales_order model:

  -- 1. Restore table names
  ALTER TABLE sales_order_archived RENAME TO sales_order;
  ALTER TABLE sales_order_line_item_archived RENAME TO sales_order_line_item;
  ALTER TABLE sales_order_invoice_link_archived RENAME TO sales_order_invoice_link;

  -- 2. Re-enable triggers
  ALTER TABLE sales_order ENABLE TRIGGER ALL;
  ALTER TABLE sales_order_line_item ENABLE TRIGGER ALL;
  ALTER TABLE sales_order_invoice_link ENABLE TRIGGER ALL;

  -- 3. Restore function names
  ALTER FUNCTION create_invoice_from_sales_order_archived
    RENAME TO create_invoice_from_sales_order;
  ALTER FUNCTION create_invoice_from_sales_order_sql_archived
    RENAME TO create_invoice_from_sales_order_sql;
  ALTER FUNCTION batch_create_invoices_from_orders_archived
    RENAME TO batch_create_invoices_from_orders;

  -- 4. Delete migrated records from invoice_record
  DELETE FROM invoice_record WHERE source_system = ''sales_order_migration'';

  -- NOTE: You may need to update frontend code back to use sales_order endpoints
  ';
END;
$$;

COMMENT ON FUNCTION rollback_to_sales_order_model IS 'Returns SQL commands to rollback migration if needed';

-- Step 9: Log the archive operation
DO $$
DECLARE
  v_archived_orders INTEGER;
  v_archived_line_items INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_archived_orders FROM sales_order_archived;
  SELECT COUNT(*) INTO v_archived_line_items FROM sales_order_line_item_archived;

  RAISE NOTICE '';
  RAISE NOTICE '=== ARCHIVE COMPLETE ===';
  RAISE NOTICE 'Archived % sales orders', v_archived_orders;
  RAISE NOTICE 'Archived % line items', v_archived_line_items;
  RAISE NOTICE 'Tables renamed with _archived suffix';
  RAISE NOTICE 'All triggers disabled';
  RAISE NOTICE 'Data preserved for 90+ days';
  RAISE NOTICE '';
  RAISE NOTICE 'To view rollback instructions, run:';
  RAISE NOTICE '  SELECT rollback_to_sales_order_model();';
  RAISE NOTICE '========================';
END $$;
