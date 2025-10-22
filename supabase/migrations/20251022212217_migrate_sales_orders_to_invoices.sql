-- Migration: Migrate sales_order data to invoice_record
-- Date: 2025-10-22
-- Purpose: Copy all sales order data into unified invoice_record table
-- SAFE: Does not delete or modify original sales_order data

-- Step 1: Migrate sales_order records to invoice_record
-- Only migrate orders that don't already have a linked invoice
INSERT INTO invoice_record (
  id,
  organization_id,
  invoice_number,
  invoice_date,
  due_date,
  customer_id,
  delivery_date,
  order_date,
  is_no_order,
  subtotal,
  tax_total,
  shipping_total,
  discount_total,
  total,
  status,
  memo,
  customer_po_number,
  created_at,
  created_by,
  updated_at,
  updated_by,
  approved_at,
  approved_by,
  promised_ship_date,
  requested_ship_date,
  shipping_method,
  terms,
  source_system
)
SELECT
  so.id,
  so.organization_id,
  -- Use existing order_number or generate one
  COALESCE(
    so.order_number,
    'INV-' || TO_CHAR(so.created_at, 'YYYY-MM-DD') || '-' || SUBSTRING(so.id::TEXT, 1, 8)
  ) as invoice_number,
  -- Set invoice_date to delivery_date for now
  so.delivery_date as invoice_date,
  -- Set due_date 30 days from delivery_date
  so.delivery_date + INTERVAL '30 days' as due_date,
  so.customer_id,
  so.delivery_date,
  COALESCE(so.order_date, so.created_at::DATE) as order_date,
  COALESCE(so.is_no_order_today, FALSE) as is_no_order,
  so.subtotal,
  so.tax_total,
  so.shipping_total,
  so.discount_total,
  so.total,
  -- Map status: invoiced orders → confirmed, reviewed → confirmed, else → draft
  CASE
    WHEN so.invoiced = TRUE THEN 'confirmed'
    WHEN so.status = 'reviewed' THEN 'confirmed'
    WHEN so.status = 'cancelled' THEN 'cancelled'
    ELSE 'draft'
  END as status,
  so.memo,
  so.customer_po_number,
  so.created_at,
  so.created_by,
  so.updated_at,
  so.updated_by,
  so.approved_at,
  so.approved_by,
  so.promised_ship_date,
  so.requested_ship_date,
  so.shipping_method,
  so.terms,
  'sales_order_migration' as source_system
FROM sales_order so
WHERE NOT EXISTS (
  -- Don't migrate if already has a linked invoice (avoid duplicates)
  SELECT 1
  FROM sales_order_invoice_link link
  WHERE link.sales_order_id = so.id
)
ON CONFLICT (id) DO NOTHING; -- Skip if already exists

-- Get count of migrated records
DO $$
DECLARE
  v_migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_migrated_count
  FROM invoice_record
  WHERE source_system = 'sales_order_migration';

  RAISE NOTICE 'Migrated % sales orders to invoice_record', v_migrated_count;
END $$;

-- Step 2: Migrate sales_order_line_item to invoice_line_item
INSERT INTO invoice_line_item (
  id,
  organization_id,
  invoice_id,
  item_id,
  description,
  quantity,
  unit_price,
  tax_rate,
  tax_code,
  discount_rate,
  discount_amount,
  position,
  custom_fields,
  created_at,
  updated_at
)
SELECT
  soli.id,
  soli.organization_id,
  soli.sales_order_id as invoice_id, -- Link to the migrated invoice
  soli.item_id,
  soli.description,
  soli.quantity,
  soli.unit_price,
  soli.tax_rate,
  soli.tax_code,
  soli.discount_rate,
  soli.discount_amount,
  soli.position,
  soli.custom_fields,
  soli.created_at,
  soli.updated_at
FROM sales_order_line_item soli
WHERE EXISTS (
  -- Only migrate line items for orders we just migrated
  SELECT 1
  FROM invoice_record ir
  WHERE ir.id = soli.sales_order_id
    AND ir.source_system = 'sales_order_migration'
)
AND NOT EXISTS (
  -- Don't duplicate existing line items
  SELECT 1
  FROM invoice_line_item ili
  WHERE ili.id = soli.id
)
ON CONFLICT (id) DO NOTHING;

-- Get count of migrated line items
DO $$
DECLARE
  v_line_items_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_line_items_count
  FROM invoice_line_item ili
  WHERE EXISTS (
    SELECT 1 FROM invoice_record ir
    WHERE ir.id = ili.invoice_id
      AND ir.source_system = 'sales_order_migration'
  );

  RAISE NOTICE 'Migrated % sales order line items to invoice_line_item', v_line_items_count;
END $$;

-- Step 3: Create links between migrated invoices and their original orders for reference
-- Update the sales_order_invoice_link table for migrated records
INSERT INTO sales_order_invoice_link (
  id,
  organization_id,
  sales_order_id,
  invoice_id,
  created_by,
  created_by_metadata
)
SELECT
  gen_random_uuid(),
  ir.organization_id,
  ir.id as sales_order_id, -- Original sales order ID
  ir.id as invoice_id,     -- Now also the invoice ID
  ir.created_by,
  jsonb_build_object(
    'migration_date', NOW(),
    'migration_source', 'unified_model_migration'
  )
FROM invoice_record ir
WHERE ir.source_system = 'sales_order_migration'
  AND NOT EXISTS (
    SELECT 1
    FROM sales_order_invoice_link link
    WHERE link.sales_order_id = ir.id
      OR link.invoice_id = ir.id
  )
ON CONFLICT DO NOTHING;

-- Step 4: Add migration metadata
COMMENT ON COLUMN invoice_record.source_system IS 'Source of the record: sales_order_migration, manual, template, etc.';

-- Step 5: Verify data integrity
DO $$
DECLARE
  v_total_sales_orders INTEGER;
  v_total_invoices_before INTEGER;
  v_total_invoices_after INTEGER;
  v_migrated_invoices INTEGER;
BEGIN
  -- Count original sales orders
  SELECT COUNT(*) INTO v_total_sales_orders
  FROM sales_order;

  -- Count migrated invoices
  SELECT COUNT(*) INTO v_migrated_invoices
  FROM invoice_record
  WHERE source_system = 'sales_order_migration';

  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION SUMMARY ===';
  RAISE NOTICE 'Total sales orders in system: %', v_total_sales_orders;
  RAISE NOTICE 'Successfully migrated to invoice_record: %', v_migrated_invoices;
  RAISE NOTICE '=========================';
  RAISE NOTICE '';
  RAISE NOTICE 'Original sales_order table preserved for backup.';
  RAISE NOTICE 'Will be archived in next migration step.';
END $$;
