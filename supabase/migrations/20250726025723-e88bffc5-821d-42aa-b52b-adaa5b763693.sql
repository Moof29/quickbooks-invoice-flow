-- Modify the validate_invoice_totals function to allow invoices with zero line items during creation
-- This handles the case where invoices are created before line items are inserted
CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
  line_item_count INTEGER;
BEGIN
  -- Get the calculated total and count of line items
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO calculated_total, line_item_count
  FROM invoice_line_item
  WHERE invoice_id = NEW.id
    AND organization_id = NEW.organization_id;

  -- Allow invoices with no line items (during creation process)
  -- But validate totals when line items exist
  IF line_item_count > 0 AND ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 
      USING MESSAGE = format('Invoice total (%s) does not match line items total (%s)', NEW.total, calculated_total),
            HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;