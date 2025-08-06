-- Create trigger to auto-generate order numbers when sales orders are created
CREATE OR REPLACE FUNCTION public.auto_generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate if order_number is null or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_sales_order_number(NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger that runs before insert
CREATE TRIGGER auto_generate_order_number_trigger
  BEFORE INSERT ON sales_order
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_order_number();