-- Temporarily increase tolerance for invoice validation to handle QuickBooks rounding
-- This allows for small discrepancies (up to $1.00) that can occur due to how QuickBooks
-- handles discounts, taxes, and rounding across multiple line items

CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  calculated_total NUMERIC;
  line_item_count INTEGER;
BEGIN
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO calculated_total, line_item_count
  FROM invoice_line_item
  WHERE invoice_id = NEW.id
    AND organization_id = NEW.organization_id;

  -- Increased tolerance from 0.01 to 1.00 to handle QuickBooks rounding differences
  -- QuickBooks may have legitimate discrepancies due to discount/tax calculations
  IF line_item_count > 0 AND ABS(NEW.total - calculated_total) > 1.00 THEN
    RAISE EXCEPTION 'Invoice total does not match line items total. Invoice total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;