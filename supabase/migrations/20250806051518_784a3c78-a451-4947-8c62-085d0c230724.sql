-- Update existing sales orders to use pending status
UPDATE sales_order 
SET status = 'pending' 
WHERE status IN ('draft', 'template_generated');