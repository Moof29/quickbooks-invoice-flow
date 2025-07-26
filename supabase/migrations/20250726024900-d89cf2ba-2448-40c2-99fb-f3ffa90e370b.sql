-- COMPREHENSIVE FIX: Update ALL RLS policies to use get_user_organization_id function
-- This will eliminate ALL "unrecognized configuration parameter" errors

-- First, ensure our helper function exists with proper security
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT organization_id FROM public.profiles WHERE id = user_id LIMIT 1);
END;
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role = 'admin' FROM public.profiles WHERE id = user_id LIMIT 1);
END;
$$;

-- Enable RLS on tables that don't have it
ALTER TABLE public.customer_price_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_function_control ENABLE ROW LEVEL SECURITY;

-- Now fix ALL policies systematically
-- 1. ACCOUNT_RECORD
DROP POLICY IF EXISTS "org_isolation_account_record" ON account_record;
CREATE POLICY "org_isolation_account_record" ON account_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 2. ACCOUNT_TRANSACTION  
DROP POLICY IF EXISTS "org_isolation_account_transaction" ON account_transaction;
CREATE POLICY "org_isolation_account_transaction" ON account_transaction
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 3. ATTACHMENTS
DROP POLICY IF EXISTS "admin_all_access_attachments" ON attachments;
DROP POLICY IF EXISTS "org_isolation_attachments" ON attachments;
DROP POLICY IF EXISTS "org_modify_attachments" ON attachments;
DROP POLICY IF EXISTS "org_select_attachments" ON attachments;

CREATE POLICY "admin_all_access_attachments" ON attachments
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_attachments" ON attachments
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 4. BILL_LINE_ITEM
DROP POLICY IF EXISTS "org_isolation_bill_line_item" ON bill_line_item;
CREATE POLICY "org_isolation_bill_line_item" ON bill_line_item
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 5. BILL_RECORD
DROP POLICY IF EXISTS "admin_all_access_bill_record" ON bill_record;
DROP POLICY IF EXISTS "org_isolation_bill_record" ON bill_record;
DROP POLICY IF EXISTS "org_modify_bill_record" ON bill_record;
DROP POLICY IF EXISTS "org_select_bill_record" ON bill_record;

CREATE POLICY "admin_all_access_bill_record" ON bill_record
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_bill_record" ON bill_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 6. CHANGE_LOG
DROP POLICY IF EXISTS "org_isolation_change_log" ON change_log;
CREATE POLICY "org_isolation_change_log" ON change_log
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 7. CREDIT_MEMO_RECORD
DROP POLICY IF EXISTS "org_isolation_credit_memo_record" ON credit_memo_record;
CREATE POLICY "org_isolation_credit_memo_record" ON credit_memo_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 8. CURRENCIES
DROP POLICY IF EXISTS "org_isolation_currencies" ON currencies;
CREATE POLICY "org_isolation_currencies" ON currencies
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 9. CUSTOM_ROLE_PERMISSIONS
DROP POLICY IF EXISTS "org_isolation_custom_role_permissions" ON custom_role_permissions;
CREATE POLICY "org_isolation_custom_role_permissions" ON custom_role_permissions
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 10. CUSTOM_ROLES
DROP POLICY IF EXISTS "org_isolation_custom_roles" ON custom_roles;
CREATE POLICY "org_isolation_custom_roles" ON custom_roles
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 11. CUSTOMER_MESSAGES
DROP POLICY IF EXISTS "admin_all_access_customer_messages" ON customer_messages;
DROP POLICY IF EXISTS "org_isolation_customer_messages" ON customer_messages;

CREATE POLICY "admin_all_access_customer_messages" ON customer_messages
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_customer_messages" ON customer_messages
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 12. EMPLOYEE_PROFILE
DROP POLICY IF EXISTS "org_isolation_employee_profile" ON employee_profile;
CREATE POLICY "org_isolation_employee_profile" ON employee_profile
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 13. ENTITY_TAGS
DROP POLICY IF EXISTS "org_isolation_entity_tags" ON entity_tags;
CREATE POLICY "org_isolation_entity_tags" ON entity_tags
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 14. ESTIMATE_RECORD
DROP POLICY IF EXISTS "org_isolation_estimate_record" ON estimate_record;
CREATE POLICY "org_isolation_estimate_record" ON estimate_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 15. FINANCIAL_METRICS
DROP POLICY IF EXISTS "org_isolation_financial_metrics" ON financial_metrics;
CREATE POLICY "org_isolation_financial_metrics" ON financial_metrics
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 16. INVOICE_LINE_ITEM
DROP POLICY IF EXISTS "admin_all_access_invoice_line_item" ON invoice_line_item;
DROP POLICY IF EXISTS "org_modify_invoice_line_item" ON invoice_line_item;
DROP POLICY IF EXISTS "org_select_invoice_line_item" ON invoice_line_item;

CREATE POLICY "admin_all_access_invoice_line_item" ON invoice_line_item
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_invoice_line_item" ON invoice_line_item
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- Continue with remaining tables in next part of migration...