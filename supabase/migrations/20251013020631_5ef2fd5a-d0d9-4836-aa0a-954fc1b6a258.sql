-- Create trigger function to calculate invoice line item amounts
CREATE OR REPLACE FUNCTION public.calculate_invoice_line_item_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.amount = ROUND((NEW.quantity * NEW.unit_price)::numeric, 2);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_calculate_invoice_line_item_amount ON invoice_line_item;

-- Create trigger that fires before INSERT or UPDATE on invoice_line_item
CREATE TRIGGER trigger_calculate_invoice_line_item_amount
BEFORE INSERT OR UPDATE ON invoice_line_item
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_line_item_amount();