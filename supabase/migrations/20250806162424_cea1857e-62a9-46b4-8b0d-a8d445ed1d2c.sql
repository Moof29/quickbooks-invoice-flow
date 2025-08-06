-- First drop the old constraint
ALTER TABLE sales_order DROP CONSTRAINT IF EXISTS sales_order_status_check;

-- Update existing sales orders to use the new status values
UPDATE sales_order 
SET status = CASE 
  WHEN status IN ('draft', 'pending_approval', 'template_generated') THEN 'pending'
  WHEN status = 'approved' THEN 'approved'  
  WHEN status = 'invoiced' THEN 'invoiced'
  ELSE 'pending'
END
WHERE status NOT IN ('pending', 'approved', 'invoiced');

-- Add the new constraint
ALTER TABLE sales_order ADD CONSTRAINT sales_order_status_check 
  CHECK (status IN ('pending', 'approved', 'invoiced'));

-- Update the default value for new orders  
ALTER TABLE sales_order ALTER COLUMN status SET DEFAULT 'pending';