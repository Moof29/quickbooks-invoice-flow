-- Fix validate_invoice_totals to use NEW.id instead of NEW.invoice_id
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
  -- Get sum of line item amounts and count
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