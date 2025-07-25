-- Fix remaining tables with JWT claims issues

-- Fix organizations table
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_organizations" ON public.organizations;
DROP POLICY IF EXISTS "org_modify_organizations" ON public.organizations;
DROP POLICY IF EXISTS "admin_all_access_organizations" ON public.organizations;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_user_access" 
ON public.organizations 
FOR ALL 
USING (id = public.get_user_organization_id(auth.uid()));

-- Fix invoice_record table  
ALTER TABLE public.invoice_record DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_invoice_record" ON public.invoice_record;
DROP POLICY IF EXISTS "org_modify_invoice_record" ON public.invoice_record;
DROP POLICY IF EXISTS "admin_all_access_invoice_record" ON public.invoice_record;
ALTER TABLE public.invoice_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_record_org_access" 
ON public.invoice_record 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Fix any other tables that might have similar issues
-- bill_record
ALTER TABLE public.bill_record DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_bill_record" ON public.bill_record;
DROP POLICY IF EXISTS "org_modify_bill_record" ON public.bill_record;
DROP POLICY IF EXISTS "admin_all_access_bill_record" ON public.bill_record;
ALTER TABLE public.bill_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_record_org_access" 
ON public.bill_record 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- purchase_order
ALTER TABLE public.purchase_order DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_purchase_order" ON public.purchase_order;
DROP POLICY IF EXISTS "org_modify_purchase_order" ON public.purchase_order;
DROP POLICY IF EXISTS "admin_all_access_purchase_order" ON public.purchase_order;
ALTER TABLE public.purchase_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_order_org_access" 
ON public.purchase_order 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- sales_order
ALTER TABLE public.sales_order DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_sales_order" ON public.sales_order;
DROP POLICY IF EXISTS "org_modify_sales_order" ON public.sales_order;
DROP POLICY IF EXISTS "admin_all_access_sales_order" ON public.sales_order;
ALTER TABLE public.sales_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_order_org_access" 
ON public.sales_order 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- credit_memo
ALTER TABLE public.credit_memo DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_credit_memo" ON public.credit_memo;
DROP POLICY IF EXISTS "org_modify_credit_memo" ON public.credit_memo;
DROP POLICY IF EXISTS "admin_all_access_credit_memo" ON public.credit_memo;
ALTER TABLE public.credit_memo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_memo_org_access" 
ON public.credit_memo 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Also ensure all line item tables are fixed
-- invoice_line_item
ALTER TABLE public.invoice_line_item DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_invoice_line_item" ON public.invoice_line_item;
DROP POLICY IF EXISTS "org_modify_invoice_line_item" ON public.invoice_line_item;
DROP POLICY IF EXISTS "admin_all_access_invoice_line_item" ON public.invoice_line_item;
ALTER TABLE public.invoice_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_line_item_org_access" 
ON public.invoice_line_item 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- bill_line_item
ALTER TABLE public.bill_line_item DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_bill_line_item" ON public.bill_line_item;
DROP POLICY IF EXISTS "org_modify_bill_line_item" ON public.bill_line_item;
DROP POLICY IF EXISTS "admin_all_access_bill_line_item" ON public.bill_line_item;
ALTER TABLE public.bill_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_line_item_org_access" 
ON public.bill_line_item 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- purchase_order_line_item
ALTER TABLE public.purchase_order_line_item DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_purchase_order_line_item" ON public.purchase_order_line_item;
DROP POLICY IF EXISTS "org_modify_purchase_order_line_item" ON public.purchase_order_line_item;
DROP POLICY IF EXISTS "admin_all_access_purchase_order_line_item" ON public.purchase_order_line_item;
ALTER TABLE public.purchase_order_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_order_line_item_org_access" 
ON public.purchase_order_line_item 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- sales_order_line_item
ALTER TABLE public.sales_order_line_item DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_sales_order_line_item" ON public.sales_order_line_item;
DROP POLICY IF EXISTS "org_modify_sales_order_line_item" ON public.sales_order_line_item;
DROP POLICY IF EXISTS "admin_all_access_sales_order_line_item" ON public.sales_order_line_item;
ALTER TABLE public.sales_order_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_order_line_item_org_access" 
ON public.sales_order_line_item 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- credit_memo_line_item
ALTER TABLE public.credit_memo_line_item DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_select_credit_memo_line_item" ON public.credit_memo_line_item;
DROP POLICY IF EXISTS "org_modify_credit_memo_line_item" ON public.credit_memo_line_item;
DROP POLICY IF EXISTS "admin_all_access_credit_memo_line_item" ON public.credit_memo_line_item;
ALTER TABLE public.credit_memo_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_memo_line_item_org_access" 
ON public.credit_memo_line_item 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));