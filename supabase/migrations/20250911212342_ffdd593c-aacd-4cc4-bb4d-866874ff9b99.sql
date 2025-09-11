-- Add delivery_date field to sales_order table
ALTER TABLE sales_order 
ADD COLUMN delivery_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 day');

-- Create index on delivery_date for performance
CREATE INDEX idx_sales_order_delivery_date ON sales_order(delivery_date, organization_id);

-- Update existing orders to have delivery_date = order_date + 1 day
UPDATE sales_order 
SET delivery_date = order_date + INTERVAL '1 day' 
WHERE delivery_date IS NULL;

-- Make delivery_date NOT NULL after setting defaults
ALTER TABLE sales_order 
ALTER COLUMN delivery_date SET NOT NULL;