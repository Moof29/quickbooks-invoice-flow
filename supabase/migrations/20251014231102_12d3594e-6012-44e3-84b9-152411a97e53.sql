-- Add RLS policies for customer portal users to view and edit their own customer templates
CREATE POLICY "portal_users_view_own_templates"
ON customer_templates
FOR SELECT
TO authenticated
USING (customer_id = get_portal_user_customer_id(auth.uid()));

-- Add RLS policies for customer portal users to view and edit their own customer template items
CREATE POLICY "portal_users_view_own_template_items"
ON customer_template_items
FOR SELECT
TO authenticated
USING (template_id IN (
  SELECT id FROM customer_templates 
  WHERE customer_id = get_portal_user_customer_id(auth.uid())
));

CREATE POLICY "portal_users_update_own_template_items"
ON customer_template_items
FOR UPDATE
TO authenticated
USING (template_id IN (
  SELECT id FROM customer_templates 
  WHERE customer_id = get_portal_user_customer_id(auth.uid())
));

CREATE POLICY "portal_users_insert_own_template_items"
ON customer_template_items
FOR INSERT
TO authenticated
WITH CHECK (template_id IN (
  SELECT id FROM customer_templates 
  WHERE customer_id = get_portal_user_customer_id(auth.uid())
));

CREATE POLICY "portal_users_delete_own_template_items"
ON customer_template_items
FOR DELETE
TO authenticated
USING (template_id IN (
  SELECT id FROM customer_templates 
  WHERE customer_id = get_portal_user_customer_id(auth.uid())
));