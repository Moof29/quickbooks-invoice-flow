-- Restore the sales order validation trigger now that the function is fixed
CREATE TRIGGER validate_sales_order_totals_trigger
  BEFORE INSERT OR UPDATE ON sales_order
  FOR EACH ROW
  EXECUTE FUNCTION validate_sales_order_totals();