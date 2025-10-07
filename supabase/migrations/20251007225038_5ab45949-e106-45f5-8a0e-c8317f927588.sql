-- Add RLS policy to prevent deletion of invoiced orders
-- This enforces the business rule at the database level

-- Drop the existing delete policy if it exists
DROP POLICY IF EXISTS "Users delete non-invoiced orders" ON sales_order;

-- Create new policy that only allows deletion of non-invoiced orders
CREATE POLICY "Users can only delete non-invoiced orders"
ON sales_order
FOR DELETE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND invoiced = false
);