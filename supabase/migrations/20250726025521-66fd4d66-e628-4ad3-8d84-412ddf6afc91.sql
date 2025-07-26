-- Fix the validate_invoice_totals function - it has syntax errors in the format() call
CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM invoice_line_item
  WHERE invoice_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 
      USING MESSAGE = format('Invoice total (%s) does not match line items total (%s)', NEW.total, calculated_total),
            HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;