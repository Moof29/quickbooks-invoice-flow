-- =====================================================================
-- Full Fidelity Invoice Sync Migration
-- =====================================================================
-- Problem: Invoice sync skips line items when items don't exist in Batchly,
-- then overrides QuickBooks totals with partial calculations. This corrupts data.
--
-- Solution: Sync ALL line items (even with NULL item_id), trust QB totals,
-- and track which invoices have unmapped items for review.
-- =====================================================================

-- Step 1: Add qbo_line_amount to invoice_line_item
-- =====================================================================
ALTER TABLE invoice_line_item
ADD COLUMN IF NOT EXISTS qbo_line_amount NUMERIC(10,2);

COMMENT ON COLUMN invoice_line_item.qbo_line_amount IS
  'Exact line amount from QuickBooks API. May differ from (quantity * unit_price) due to QB rounding.';

-- Step 2: Ensure item_id is nullable
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoice_line_item' 
      AND column_name = 'item_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE invoice_line_item ALTER COLUMN item_id DROP NOT NULL;
  END IF;
END $$;

-- Step 3: Add constraint - must have either item_id OR description
-- =====================================================================
ALTER TABLE invoice_line_item
DROP CONSTRAINT IF EXISTS line_item_has_reference;

ALTER TABLE invoice_line_item
ADD CONSTRAINT line_item_has_reference
CHECK (
  item_id IS NOT NULL
  OR (description IS NOT NULL AND description != '')
);

-- Step 4: Add tracking columns to invoice_record
-- =====================================================================
ALTER TABLE invoice_record
ADD COLUMN IF NOT EXISTS sync_warnings JSONB DEFAULT '[]'::jsonb;

ALTER TABLE invoice_record
ADD COLUMN IF NOT EXISTS has_unmapped_items BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN invoice_record.sync_warnings IS
  'Array of warnings from QuickBooks sync (e.g., unmapped items, rounding differences)';

COMMENT ON COLUMN invoice_record.has_unmapped_items IS
  'True if invoice has line items with NULL item_id (items not in Batchly catalog)';

-- Step 5: Create index for finding invoices needing review
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_unmapped
ON invoice_record(organization_id, has_unmapped_items)
WHERE has_unmapped_items = TRUE;

-- Step 6: Update validate_invoice_totals() to trust QBO
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  calculated_total NUMERIC;
  line_item_count INTEGER;
  discount_total NUMERIC;
  expected_total NUMERIC;
BEGIN
  -- CRITICAL: Trust QuickBooks totals - do not validate QBO invoices
  -- QuickBooks is the source of truth for financial data
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

  discount_total := COALESCE(NEW.discount_total, 0);
  expected_total := calculated_total - discount_total;

  -- Use 2-cent tolerance for rounding
  IF line_item_count > 0 AND ABS(NEW.total - expected_total) > 0.02 THEN
    RAISE EXCEPTION 'Invoice total mismatch. Invoice: %, Line items: %, Discount: %, Expected: %',
      NEW.total, calculated_total, discount_total, expected_total
      USING HINT = 'Verify all line items and invoice-level discounts.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_invoice_totals IS
  'Validates invoice totals. Trusts QBO invoices. Validates ERP invoices against line items with 2-cent tolerance.';