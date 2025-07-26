-- Enable RLS on customer_item_price table (only this one since others already exist)
ALTER TABLE customer_item_price ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for customer_item_price
CREATE POLICY "org_isolation_customer_item_price" ON customer_item_price
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));