-- Update sales_order table to align with Order Taking Hub workflow
-- 1. Change default status to 'pending' instead of 'draft'
-- 2. Add approval tracking
-- 3. Ensure customer template requirement

-- First, let's add an approval tracking column
ALTER TABLE sales_order 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Update the default status to 'pending'
ALTER TABLE sales_order 
ALTER COLUMN status SET DEFAULT 'pending';

-- Create a function to validate customer has template requirement
CREATE OR REPLACE FUNCTION validate_customer_template_exists()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check if customer has at least one template (even if inactive)
  IF NOT EXISTS (
    SELECT 1 FROM customer_templates 
    WHERE customer_id = NEW.customer_id 
    AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Customer must have a customer template before creating sales orders. Please create a customer template first.';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to validate customer template exists
DROP TRIGGER IF EXISTS validate_customer_template_trigger ON sales_order;
CREATE TRIGGER validate_customer_template_trigger
  BEFORE INSERT ON sales_order
  FOR EACH ROW
  EXECUTE FUNCTION validate_customer_template_exists();

-- Create a function to handle sales order approval
CREATE OR REPLACE FUNCTION approve_sales_order(
  p_sales_order_id uuid,
  p_approved_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update the sales order to approved status
  UPDATE sales_order 
  SET 
    status = 'approved',
    approved_at = now(),
    approved_by = p_approved_by,
    updated_at = now()
  WHERE id = p_sales_order_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or could not be updated';
  END IF;
END;
$function$;