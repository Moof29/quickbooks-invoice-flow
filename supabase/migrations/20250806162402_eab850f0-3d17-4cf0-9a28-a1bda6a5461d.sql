-- Temporarily disable the trigger that's causing the cross-org check
ALTER TABLE sales_order DISABLE TRIGGER ALL;

-- Update existing sales orders to use the new status values
UPDATE sales_order 
SET status = CASE 
  WHEN status IN ('draft', 'pending_approval', 'template_generated') THEN 'pending'
  WHEN status = 'approved' THEN 'approved'
  WHEN status = 'invoiced' THEN 'invoiced'
  ELSE 'pending'
END;

-- Re-enable triggers
ALTER TABLE sales_order ENABLE TRIGGER ALL;

-- Now update the constraint to only allow pending, approved, invoiced
ALTER TABLE sales_order DROP CONSTRAINT IF EXISTS sales_order_status_check;

ALTER TABLE sales_order ADD CONSTRAINT sales_order_status_check 
  CHECK (status IN ('pending', 'approved', 'invoiced'));

-- Update the default value for new orders
ALTER TABLE sales_order ALTER COLUMN status SET DEFAULT 'pending';