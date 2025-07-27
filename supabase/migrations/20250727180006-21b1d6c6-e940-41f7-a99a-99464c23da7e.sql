-- Auto-calculate line item amount when quantity/price changes
CREATE OR REPLACE FUNCTION calculate_line_item_amount()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.amount = ROUND((NEW.quantity * NEW.unit_price)::numeric, 2);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calculate_line_item_amount
  BEFORE INSERT OR UPDATE OF quantity, unit_price
  ON sales_order_line_item
  FOR EACH ROW
  EXECUTE FUNCTION calculate_line_item_amount();

-- Auto-update sales_order totals when line items change
CREATE OR REPLACE FUNCTION update_sales_order_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  calculated_subtotal NUMERIC;
  target_order_id UUID;
BEGIN
  -- Get the order ID (works for INSERT, UPDATE, DELETE)
  target_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  
  -- Calculate new subtotal from all line items
  SELECT COALESCE(SUM(amount), 0) INTO calculated_subtotal
  FROM sales_order_line_item 
  WHERE sales_order_id = target_order_id;
  
  -- Update sales_order totals
  UPDATE sales_order 
  SET 
    subtotal = calculated_subtotal,
    total = calculated_subtotal + COALESCE(tax_total, 0) + COALESCE(shipping_total, 0) - COALESCE(discount_total, 0),
    updated_at = NOW()
  WHERE id = target_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_sales_order_totals
  AFTER INSERT OR UPDATE OR DELETE
  ON sales_order_line_item
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_totals();