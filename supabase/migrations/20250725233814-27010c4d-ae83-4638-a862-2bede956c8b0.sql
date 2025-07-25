-- Fix remaining tables with JWT claims issues - targeting only existing tables

-- Fix organizations table
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_organizations" ON public.organizations;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_user_access" 
ON public.organizations 
FOR ALL 
USING (id = public.get_user_organization_id(auth.uid()));

-- Fix invoice_record table (checking if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_record') THEN
        ALTER TABLE public.invoice_record DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "org_select_invoice_record" ON public.invoice_record;
        DROP POLICY IF EXISTS "org_modify_invoice_record" ON public.invoice_record;
        DROP POLICY IF EXISTS "admin_all_access_invoice_record" ON public.invoice_record;
        ALTER TABLE public.invoice_record ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY "invoice_record_org_access" ON public.invoice_record FOR ALL USING (organization_id = public.get_user_organization_id(auth.uid()));';
    END IF;
END $$;

-- Fix sales_order table (remove JWT claims policies)
ALTER TABLE public.sales_order DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_sales_order" ON public.sales_order;
DROP POLICY IF EXISTS "org_select_sales_order" ON public.sales_order;
DROP POLICY IF EXISTS "org_modify_sales_order" ON public.sales_order;
DROP POLICY IF EXISTS "admin_all_access_sales_order" ON public.sales_order;
ALTER TABLE public.sales_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_order_org_access" 
ON public.sales_order 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Fix audit_events table
ALTER TABLE public.audit_events DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_audit_events" ON public.audit_events;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_org_access" 
ON public.audit_events 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Fix all other tables still using JWT claims
-- employee_time_tracking
ALTER TABLE public.employee_time_tracking DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_employee_time_tracking" ON public.employee_time_tracking;
ALTER TABLE public.employee_time_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_time_tracking_org_access" 
ON public.employee_time_tracking 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- All other tables using JWT claims - fix them one by one
-- audit_log_entries
ALTER TABLE public.audit_log_entries DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_audit_log_entries" ON public.audit_log_entries;
ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_entries_org_access" 
ON public.audit_log_entries 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));