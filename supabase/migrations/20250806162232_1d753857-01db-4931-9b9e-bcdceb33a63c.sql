-- Update the sales_order status check constraint to allow only pending, approved, invoiced
ALTER TABLE sales_order DROP CONSTRAINT IF EXISTS sales_order_status_check;

ALTER TABLE sales_order ADD CONSTRAINT sales_order_status_check 
  CHECK (status IN ('pending', 'approved', 'invoiced'));