-- Fix the validate_sales_order_totals function to avoid format() issues
CREATE OR REPLACE FUNCTION public.validate_sales_order_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM sales_order_line_item
  WHERE sales_order_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Sales order total does not match line items total. Order total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all sales_order_line_item rows match the sales_order_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER validate_sales_order_totals_trigger
  BEFORE INSERT OR UPDATE ON sales_order
  FOR EACH ROW
  EXECUTE FUNCTION validate_sales_order_totals();