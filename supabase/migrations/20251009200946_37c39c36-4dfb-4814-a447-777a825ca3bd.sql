-- Disable RLS on sequence table - it's only accessed by SECURITY DEFINER functions
ALTER TABLE sales_order_number_sequences DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their org sequences" ON sales_order_number_sequences;
DROP POLICY IF EXISTS "Users can manage their org sequences" ON sales_order_number_sequences;
DROP POLICY IF EXISTS "Allow function owner access to sequences" ON sales_order_number_sequences;
DROP POLICY IF EXISTS "Allow service role access to sequences" ON sales_order_number_sequences;

-- Reset the sequence to 0 to start fresh
DELETE FROM sales_order_number_sequences WHERE organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';