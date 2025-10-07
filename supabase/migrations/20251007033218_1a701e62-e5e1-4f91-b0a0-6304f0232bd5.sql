-- PROMPT 1: Database Schema Migration - Core Fields (with data cleanup)

-- Step 0: Clean out existing dummy data
DELETE FROM sales_order_line_item;
DELETE FROM sales_order;

-- Step 1: Add new columns
ALTER TABLE sales_order 
ADD COLUMN IF NOT EXISTS is_no_order_today BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS invoiced BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoice_record(id) ON DELETE SET NULL;

-- Step 2: Add status CHECK constraint (no data to migrate since we cleared it)
ALTER TABLE sales_order
ADD CONSTRAINT sales_order_status_check 
CHECK (status IN ('pending', 'reviewed', 'invoiced', 'canceled'));

-- Step 3: Add deletion protection constraint
ALTER TABLE sales_order
ADD CONSTRAINT no_delete_invoiced
CHECK (
  (invoiced = false) OR 
  (invoiced = true AND id IS NOT NULL)
);

-- Step 4: Add composite indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_order_delivery_customer 
ON sales_order(delivery_date, customer_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_status_delivery 
ON sales_order(status, delivery_date, organization_id);

-- Step 5: Update RLS policy for deletion protection
DROP POLICY IF EXISTS "Users delete non-invoiced orders" ON sales_order;

CREATE POLICY "Users delete non-invoiced orders"
ON sales_order FOR DELETE
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND invoiced = false
);

-- Step 6: Create helper function for status validation
CREATE OR REPLACE FUNCTION can_delete_sales_order(order_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM sales_order 
    WHERE id = order_id AND invoiced = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;