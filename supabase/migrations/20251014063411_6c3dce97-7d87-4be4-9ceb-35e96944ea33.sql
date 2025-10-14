-- Customer Portal: Add RLS policies for portal users to view their own data

-- Helper function to get customer_id for a portal user
CREATE OR REPLACE FUNCTION public.get_portal_user_customer_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id 
  FROM customer_portal_user_links 
  WHERE portal_user_id = p_user_id
  LIMIT 1;
$$;

-- Sales Order: Portal users can view their own orders
CREATE POLICY "portal_users_view_own_orders"
ON sales_order
FOR SELECT
TO authenticated
USING (
  customer_id = get_portal_user_customer_id(auth.uid())
);

-- Invoice Record: Portal users can view their own invoices
CREATE POLICY "portal_users_view_own_invoices"
ON invoice_record
FOR SELECT
TO authenticated
USING (
  customer_id = get_portal_user_customer_id(auth.uid())
);

-- Invoice Payments: Portal users can view payments for their invoices
CREATE POLICY "portal_users_view_own_invoice_payments"
ON invoice_payment
FOR SELECT
TO authenticated
USING (
  invoice_id IN (
    SELECT id FROM invoice_record 
    WHERE customer_id = get_portal_user_customer_id(auth.uid())
  )
);

-- Sales Order Line Items: Portal users can view line items for their orders
CREATE POLICY "portal_users_view_own_order_line_items"
ON sales_order_line_item
FOR SELECT
TO authenticated
USING (
  sales_order_id IN (
    SELECT id FROM sales_order 
    WHERE customer_id = get_portal_user_customer_id(auth.uid())
  )
);

-- Invoice Line Items: Portal users can view line items for their invoices
CREATE POLICY "portal_users_view_own_invoice_line_items"
ON invoice_line_item
FOR SELECT
TO authenticated
USING (
  invoice_id IN (
    SELECT id FROM invoice_record 
    WHERE customer_id = get_portal_user_customer_id(auth.uid())
  )
);

-- Customer Profile: Portal users can view their own customer profile
CREATE POLICY "portal_users_view_own_customer_profile"
ON customer_profile
FOR SELECT
TO authenticated
USING (
  id = get_portal_user_customer_id(auth.uid())
);

-- Item Record: Portal users can view items (needed for displaying order/invoice line items)
CREATE POLICY "portal_users_view_items"
ON item_record
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_user_links 
    WHERE portal_user_id = auth.uid()
      AND organization_id = item_record.organization_id
  )
);