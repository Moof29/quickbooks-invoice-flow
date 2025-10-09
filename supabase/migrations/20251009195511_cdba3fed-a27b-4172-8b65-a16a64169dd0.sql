-- Add RLS policies to sales_order_number_sequences table
ALTER TABLE sales_order_number_sequences ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sequences for their organization
CREATE POLICY "Users can view their org sequences"
ON sales_order_number_sequences
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Allow authenticated users to insert/update sequences for their organization
CREATE POLICY "Users can manage their org sequences"
ON sales_order_number_sequences
FOR ALL
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = get_user_organization_id(auth.uid()));