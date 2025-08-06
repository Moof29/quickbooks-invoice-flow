-- Temporarily remove the constraint to allow status updates
ALTER TABLE sales_order DROP CONSTRAINT IF EXISTS sales_order_status_check;

-- Update the default value for new orders
ALTER TABLE sales_order ALTER COLUMN status SET DEFAULT 'pending';