-- Fix RLS blocking SECURITY DEFINER function access to sequence table
-- Allow postgres/service role to bypass RLS for the atomic function
CREATE POLICY "Allow function owner access to sequences"
ON sales_order_number_sequences
FOR ALL
TO postgres
USING (true)
WITH CHECK (true);

-- Also allow service_role for edge function access
CREATE POLICY "Allow service role access to sequences"
ON sales_order_number_sequences
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);