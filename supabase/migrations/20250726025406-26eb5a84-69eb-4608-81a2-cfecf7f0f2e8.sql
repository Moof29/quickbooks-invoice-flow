-- Clean up redundant invoice policies
-- Remove duplicate/redundant policies for invoice tables

-- Clean up invoice_record policies (should only have one comprehensive policy)
DROP POLICY IF EXISTS "invoice_record_org_access" ON invoice_record;
DROP POLICY IF EXISTS "org_isolation_invoice_record" ON invoice_record;
DROP POLICY IF EXISTS "org_modify_invoice_record" ON invoice_record;
DROP POLICY IF EXISTS "org_select_invoice_record" ON invoice_record;

-- Create single comprehensive policy for invoice_record
CREATE POLICY "invoice_record_org_access" ON invoice_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- Ensure invoice_line_item has proper policies
-- (Keep existing admin and org policies as they seem appropriate)