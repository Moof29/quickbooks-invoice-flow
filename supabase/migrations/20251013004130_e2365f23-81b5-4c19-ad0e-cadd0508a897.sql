-- Create trigger function to update invoice totals when line items change
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_subtotal NUMERIC;
  target_invoice_id UUID;
BEGIN
  -- Get the invoice ID (works for INSERT, UPDATE, DELETE)
  target_invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate new subtotal from all line items
  SELECT COALESCE(SUM(amount), 0) INTO calculated_subtotal
  FROM invoice_line_item 
  WHERE invoice_id = target_invoice_id;
  
  -- Update invoice totals
  UPDATE invoice_record 
  SET 
    subtotal = calculated_subtotal,
    total = calculated_subtotal + COALESCE(tax_total, 0),
    updated_at = NOW()
  WHERE id = target_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_line_item;

-- Create trigger that fires after INSERT, UPDATE, or DELETE on invoice_line_item
CREATE TRIGGER trigger_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_line_item
FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();