/*
  # Implement Full Fidelity Invoice Sync (Option A)

  ## Problem
  Current sync logic skips line items when the item doesn't exist in Batchly,
  then overrides QuickBooks totals with calculated values from partial line items.
  This corrupts financial data - invoices show wrong totals.

  ## Solution (Option A: Full Fidelity Sync)
  1. Sync ALL line items from QuickBooks, even if items don't exist in Batchly
  2. Store line items with item_id = NULL for unmapped items
  3. Keep QuickBooks total as source of truth (never override)
  4. Update validation trigger to trust QBO totals
  5. Track which invoices have unmapped items for review

  ## Changes
  - Make invoice_line_item.item_id nullable
  - Add qbo_line_amount to store exact QB line amounts
  - Add sync warning tracking to invoice_record
  - Update validate_invoice_totals() to trust QBO source_system invoices
  - Add constraint to ensure line items have either item_id OR description
*/

-- =====================================================================
-- Step 1: Update invoice_line_item schema
-- =====================================================================

-- Make item_id nullable (allow unmapped items from QB)
ALTER TABLE invoice_line_item
ALTER COLUMN item_id DROP NOT NULL;

-- Add column to store exact QuickBooks line amount
-- (QB may round differently than quantity * unit_price)
ALTER TABLE invoice_line_item
ADD COLUMN IF NOT EXISTS qbo_line_amount NUMERIC(10,2);

COMMENT ON COLUMN invoice_line_item.qbo_line_amount IS
  'Exact line amount from QuickBooks API. May differ from (quantity * unit_price) due to QB rounding. NULL for ERP-created line items.';

-- Add constraint: line items must have EITHER item_id OR description
ALTER TABLE invoice_line_item
DROP CONSTRAINT IF EXISTS line_item_has_reference;

ALTER TABLE invoice_line_item
ADD CONSTRAINT line_item_has_reference
CHECK (
  item_id IS NOT NULL
  OR (description IS NOT NULL AND description != '')
);

COMMENT ON CONSTRAINT line_item_has_reference ON invoice_line_item IS
  'Ensures line items have either a valid item reference OR a description (for unmapped QB items)';

-- =====================================================================
-- Step 2: Add invoice sync tracking columns
-- =====================================================================

-- Track warnings and unmapped items
ALTER TABLE invoice_record
ADD COLUMN IF NOT EXISTS sync_warnings JSONB DEFAULT '[]'::jsonb;

ALTER TABLE invoice_record
ADD COLUMN IF NOT EXISTS has_unmapped_items BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN invoice_record.sync_warnings IS
  'Array of warning messages from QuickBooks sync (e.g., unmapped items, rounding differences)';

COMMENT ON COLUMN invoice_record.has_unmapped_items IS
  'True if any line items have NULL item_id (items not in Batchly catalog)';

-- Index for finding invoices needing review
CREATE INDEX IF NOT EXISTS idx_invoices_unmapped
ON invoice_record(has_unmapped_items)
WHERE has_unmapped_items = TRUE;

-- =====================================================================
-- Step 3: Update validate_invoice_totals() to trust QBO
-- =====================================================================

CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_total NUMERIC;
  line_item_count INTEGER;
  discount_total NUMERIC;
  expected_total NUMERIC;
BEGIN
  -- For QuickBooks-synced invoices, TRUST the QuickBooks total
  -- Do not validate against line items because:
  -- 1. Some line items may have NULL item_id (unmapped items)
  -- 2. QuickBooks handles rounding/discounts/taxes in its own way
  -- 3. QuickBooks is the source of truth for financial data
  IF NEW.source_system = 'QBO' THEN
    RETURN NEW;
  END IF;

  -- For ERP-created invoices, validate totals match line items
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO calculated_total, line_item_count
  FROM invoice_line_item
  WHERE invoice_id = NEW.id
    AND organization_id = NEW.organization_id;

  -- Get invoice-level discount
  discount_total := COALESCE(NEW.discount_total, 0);

  -- Calculate expected total (line items - discount)
  expected_total := calculated_total - discount_total;

  -- Only validate if there are line items
  -- Use 2-cent tolerance for rounding differences
  IF line_item_count > 0 AND ABS(NEW.total - expected_total) > 0.02 THEN
    RAISE EXCEPTION 'Invoice total does not match line items total. Invoice total: %, Line items total: %, Discount: %, Calculated (items - discount): %',
      NEW.total, calculated_total, discount_total, expected_total
      USING HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id, and invoice-level discounts are properly recorded.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_invoice_totals IS
  'Validates invoice totals. For QBO-synced invoices, trusts QuickBooks totals. For ERP-created invoices, validates against line items with 2-cent tolerance.';

-- =====================================================================
-- Step 4: Add helper function to check invoice data integrity
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_invoice_data_integrity(p_invoice_id UUID)
RETURNS TABLE(
  issue_type TEXT,
  severity TEXT,
  message TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice RECORD;
  v_line_items_total NUMERIC;
  v_unmapped_count INTEGER;
BEGIN
  -- Get invoice
  SELECT * INTO v_invoice
  FROM invoice_record
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'not_found'::TEXT,
      'error'::TEXT,
      'Invoice not found'::TEXT,
      NULL::JSONB;
    RETURN;
  END IF;

  -- Check for unmapped items
  SELECT COUNT(*) INTO v_unmapped_count
  FROM invoice_line_item
  WHERE invoice_id = p_invoice_id
    AND item_id IS NULL;

  IF v_unmapped_count > 0 THEN
    RETURN QUERY SELECT
      'unmapped_items'::TEXT,
      'warning'::TEXT,
      format('%s line items have no item mapping', v_unmapped_count)::TEXT,
      jsonb_build_object('unmapped_count', v_unmapped_count);
  END IF;

  -- Check total mismatch (for QBO invoices, compare against QB data)
  IF v_invoice.source_system = 'QBO' THEN
    SELECT COALESCE(SUM(COALESCE(qbo_line_amount, amount)), 0)
    INTO v_line_items_total
    FROM invoice_line_item
    WHERE invoice_id = p_invoice_id;

    IF ABS(v_invoice.total - v_line_items_total) > 0.02 THEN
      RETURN QUERY SELECT
        'total_mismatch'::TEXT,
        'info'::TEXT,
        format('Invoice total (%s) differs from line items sum (%s) by %s',
          v_invoice.total,
          v_line_items_total,
          ABS(v_invoice.total - v_line_items_total))::TEXT,
        jsonb_build_object(
          'invoice_total', v_invoice.total,
          'line_items_total', v_line_items_total,
          'difference', ABS(v_invoice.total - v_line_items_total)
        );
    END IF;
  END IF;

  -- If no issues found
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'ok'::TEXT,
      'success'::TEXT,
      'Invoice data integrity check passed'::TEXT,
      NULL::JSONB;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.check_invoice_data_integrity IS
  'Checks data integrity for an invoice, including unmapped items and total mismatches. Returns rows for each issue found.';

-- =====================================================================
-- Step 5: Clear corrupted data from previous sync attempts
-- =====================================================================

-- Mark invoices with potential data corruption for re-sync
UPDATE invoice_record
SET qbo_sync_status = 'pending',
    sync_warnings = jsonb_build_array(
      jsonb_build_object(
        'timestamp', NOW(),
        'message', 'Marked for re-sync after implementing full fidelity sync',
        'migration', '20251120015816'
      )
    )
WHERE source_system = 'QBO'
  AND qbo_sync_status = 'synced'
  AND updated_at > NOW() - INTERVAL '24 hours'; -- Only recent syncs

-- =====================================================================
-- Verification queries (commented out - run manually if needed)
-- =====================================================================

-- Check schema changes applied
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'invoice_line_item'
--   AND column_name IN ('item_id', 'qbo_line_amount')
-- ORDER BY column_name;

-- Find invoices with unmapped items (after sync)
-- SELECT
--   ir.invoice_number,
--   ir.total,
--   COUNT(ili.id) as total_line_items,
--   COUNT(ili.item_id) as mapped_items,
--   COUNT(*) FILTER (WHERE ili.item_id IS NULL) as unmapped_items
-- FROM invoice_record ir
-- LEFT JOIN invoice_line_item ili ON ir.id = ili.invoice_id
-- WHERE ir.source_system = 'QBO'
-- GROUP BY ir.id, ir.invoice_number, ir.total
-- HAVING COUNT(*) FILTER (WHERE ili.item_id IS NULL) > 0
-- ORDER BY ir.invoice_date DESC
-- LIMIT 20;
