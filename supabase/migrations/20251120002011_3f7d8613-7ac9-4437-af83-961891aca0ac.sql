-- Adjust invoice validation tolerance to $0.02 for reasonable QuickBooks rounding
-- This handles minor rounding differences while keeping validation strict

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

  -- Tolerance of $0.02 to handle QuickBooks rounding differences
  IF line_item_count > 0 AND ABS(NEW.total - calculated_total) > 0.02 THEN
    RAISE EXCEPTION 'Invoice total does not match line items total. Invoice total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;