-- Temporarily disable the problematic validation trigger
DROP TRIGGER IF EXISTS validate_sales_order_totals_trigger ON sales_order;

-- Also check if there are any other triggers that might use format()
DROP TRIGGER IF EXISTS sales_order_totals_validation ON sales_order;