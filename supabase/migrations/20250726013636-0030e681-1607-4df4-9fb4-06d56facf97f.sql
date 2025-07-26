-- Update ALL RLS policies to use the profiles table instead of JWT claims

-- Helper function to get user's organization ID (already exists but ensuring it's correct)
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT organization_id FROM public.profiles WHERE id = user_id LIMIT 1);
END;
$$;

-- Update customer_profile policies (even though it looks correct, let's ensure)
DROP POLICY IF EXISTS "customer_profile_org_access" ON customer_profile;
CREATE POLICY "customer_profile_org_access" ON customer_profile
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

-- Also check if there's an invoice_record table that might need the same fix
DROP POLICY IF EXISTS "org_isolation_invoice_record" ON invoice_record;
CREATE POLICY "org_isolation_invoice_record" ON invoice_record
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_select_invoice_record" ON invoice_record;
CREATE POLICY "org_select_invoice_record" ON invoice_record
FOR SELECT 
USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_modify_invoice_record" ON invoice_record;
CREATE POLICY "org_modify_invoice_record" ON invoice_record
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

-- Update other critical tables that might be causing issues
DROP POLICY IF EXISTS "org_isolation_customer_payment_methods" ON customer_payment_methods;
CREATE POLICY "org_isolation_customer_payment_methods" ON customer_payment_methods
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_customer_portal_user_links" ON customer_portal_user_links;
CREATE POLICY "org_isolation_customer_portal_user_links" ON customer_portal_user_links
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

-- Update payment_receipt policies  
DROP POLICY IF EXISTS "org_select_payment_receipt" ON payment_receipt;
CREATE POLICY "org_select_payment_receipt" ON payment_receipt
FOR SELECT 
USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_modify_payment_receipt" ON payment_receipt;
CREATE POLICY "org_modify_payment_receipt" ON payment_receipt
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));