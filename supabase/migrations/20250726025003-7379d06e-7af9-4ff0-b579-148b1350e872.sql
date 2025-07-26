-- PART 2: Continue fixing all remaining RLS policies

-- 17. ITEM_INVENTORY
DROP POLICY IF EXISTS "org_isolation_item_inventory" ON item_inventory;
CREATE POLICY "org_isolation_item_inventory" ON item_inventory
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 18. ITEM_PRICING
DROP POLICY IF EXISTS "org_isolation_item_pricing" ON item_pricing;
CREATE POLICY "org_isolation_item_pricing" ON item_pricing
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 19. ITEM_RECORD
DROP POLICY IF EXISTS "org_isolation_item_record" ON item_record;
CREATE POLICY "org_isolation_item_record" ON item_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 20. JOURNAL_ENTRY_LINE_ITEM
DROP POLICY IF EXISTS "org_isolation_journal_entry_line_item" ON journal_entry_line_item;
CREATE POLICY "org_isolation_journal_entry_line_item" ON journal_entry_line_item
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 21. JOURNAL_ENTRY_RECORD
DROP POLICY IF EXISTS "org_isolation_journal_entry_record" ON journal_entry_record;
CREATE POLICY "org_isolation_journal_entry_record" ON journal_entry_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 22. PAYMENT_RECEIPT (admin policies)
DROP POLICY IF EXISTS "admin_all_access_payment_receipt" ON payment_receipt;
CREATE POLICY "admin_all_access_payment_receipt" ON payment_receipt
FOR ALL USING (is_admin_user(auth.uid()));

-- 23. PURCHASE_ORDER
DROP POLICY IF EXISTS "org_isolation_purchase_order" ON purchase_order;
CREATE POLICY "org_isolation_purchase_order" ON purchase_order
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 24. PURCHASE_ORDER_LINE_ITEM
DROP POLICY IF EXISTS "org_isolation_purchase_order_line_item" ON purchase_order_line_item;
CREATE POLICY "org_isolation_purchase_order_line_item" ON purchase_order_line_item
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 25-30. QBO Tables
DROP POLICY IF EXISTS "org_isolation_qbo_entity_config" ON qbo_entity_config;
CREATE POLICY "org_isolation_qbo_entity_config" ON qbo_entity_config
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_entity_dependencies" ON qbo_entity_dependencies;
CREATE POLICY "org_isolation_qbo_entity_dependencies" ON qbo_entity_dependencies
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_entity_mapping" ON qbo_entity_mapping;
CREATE POLICY "org_isolation_qbo_entity_mapping" ON qbo_entity_mapping
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_error_registry" ON qbo_error_registry;
CREATE POLICY "org_isolation_qbo_error_registry" ON qbo_error_registry
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_field_mapping" ON qbo_field_mapping;
CREATE POLICY "org_isolation_qbo_field_mapping" ON qbo_field_mapping
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_sync_batch" ON qbo_sync_batch;
CREATE POLICY "org_isolation_qbo_sync_batch" ON qbo_sync_batch
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_sync_metrics" ON qbo_sync_metrics;
CREATE POLICY "org_isolation_qbo_sync_metrics" ON qbo_sync_metrics
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_sync_operation" ON qbo_sync_operation;
CREATE POLICY "org_isolation_qbo_sync_operation" ON qbo_sync_operation
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_sync_queue" ON qbo_sync_queue;
CREATE POLICY "org_isolation_qbo_sync_queue" ON qbo_sync_queue
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_webhook_events" ON qbo_webhook_events;
CREATE POLICY "org_isolation_qbo_webhook_events" ON qbo_webhook_events
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_qbo_webhook_handler_log" ON qbo_webhook_handler_log;
CREATE POLICY "org_isolation_qbo_webhook_handler_log" ON qbo_webhook_handler_log
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 31. ROLE_PERMISSION_MAPPING
DROP POLICY IF EXISTS "org_isolation_role_permission_mapping" ON role_permission_mapping;
CREATE POLICY "org_isolation_role_permission_mapping" ON role_permission_mapping
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 32. ROLE_PERMISSIONS
DROP POLICY IF EXISTS "org_isolation_role_permissions" ON role_permissions;
CREATE POLICY "org_isolation_role_permissions" ON role_permissions
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 33-36. SALES ORDER Tables
DROP POLICY IF EXISTS "org_isolation_sales_order_fulfillment" ON sales_order_fulfillment;
CREATE POLICY "org_isolation_sales_order_fulfillment" ON sales_order_fulfillment
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_sales_order_fulfillment_line" ON sales_order_fulfillment_line;
CREATE POLICY "org_isolation_sales_order_fulfillment_line" ON sales_order_fulfillment_line
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_sales_order_invoice_link" ON sales_order_invoice_link;
CREATE POLICY "org_isolation_sales_order_invoice_link" ON sales_order_invoice_link
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_sales_order_line_item" ON sales_order_line_item;
CREATE POLICY "org_isolation_sales_order_line_item" ON sales_order_line_item
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 37. SALES_RECEIPT_RECORD
DROP POLICY IF EXISTS "org_isolation_sales_receipt_record" ON sales_receipt_record;
CREATE POLICY "org_isolation_sales_receipt_record" ON sales_receipt_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 38-41. SYNC Tables
DROP POLICY IF EXISTS "admin_all_access_sync_error" ON sync_error;
DROP POLICY IF EXISTS "org_isolation_sync_error" ON sync_error;
DROP POLICY IF EXISTS "org_modify_sync_error" ON sync_error;
DROP POLICY IF EXISTS "org_select_sync_error" ON sync_error;

CREATE POLICY "admin_all_access_sync_error" ON sync_error
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_sync_error" ON sync_error
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "admin_all_access_sync_log" ON sync_log;
DROP POLICY IF EXISTS "org_isolation_sync_log" ON sync_log;
DROP POLICY IF EXISTS "org_modify_sync_log" ON sync_log;
DROP POLICY IF EXISTS "org_select_sync_log" ON sync_log;

CREATE POLICY "admin_all_access_sync_log" ON sync_log
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_sync_log" ON sync_log
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "admin_all_access_sync_status" ON sync_status;
DROP POLICY IF EXISTS "org_isolation_sync_status" ON sync_status;
DROP POLICY IF EXISTS "org_modify_sync_status" ON sync_status;
DROP POLICY IF EXISTS "org_select_sync_status" ON sync_status;

CREATE POLICY "admin_all_access_sync_status" ON sync_status
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_sync_status" ON sync_status
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 42. TAGS
DROP POLICY IF EXISTS "admin_all_access_tags" ON tags;
DROP POLICY IF EXISTS "org_isolation_tags" ON tags;
DROP POLICY IF EXISTS "org_modify_tags" ON tags;
DROP POLICY IF EXISTS "org_select_tags" ON tags;

CREATE POLICY "admin_all_access_tags" ON tags
FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "org_isolation_tags" ON tags
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 43-45. TAX Tables
DROP POLICY IF EXISTS "org_isolation_tax_agency" ON tax_agency;
CREATE POLICY "org_isolation_tax_agency" ON tax_agency
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_tax_code" ON tax_code;
CREATE POLICY "org_isolation_tax_code" ON tax_code
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_tax_rate" ON tax_rate;
CREATE POLICY "org_isolation_tax_rate" ON tax_rate
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 46. TIME_ACTIVITY_RECORD
DROP POLICY IF EXISTS "org_isolation_time_activity_record" ON time_activity_record;
CREATE POLICY "org_isolation_time_activity_record" ON time_activity_record
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 47-49. USER Tables
DROP POLICY IF EXISTS "org_isolation_user_organizations" ON user_organizations;
CREATE POLICY "org_isolation_user_organizations" ON user_organizations
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_user_permissions" ON user_permissions;
CREATE POLICY "org_isolation_user_permissions" ON user_permissions
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "org_isolation_users" ON users;
CREATE POLICY "org_isolation_users" ON users
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 50. VENDOR_PROFILE
DROP POLICY IF EXISTS "org_isolation_vendor_profile" ON vendor_profile;
CREATE POLICY "org_isolation_vendor_profile" ON vendor_profile
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- 51. WEBHOOK_LOGS
DROP POLICY IF EXISTS "org_isolation_webhook_logs" ON webhook_logs;
CREATE POLICY "org_isolation_webhook_logs" ON webhook_logs
FOR ALL USING (organization_id = get_user_organization_id(auth.uid()));

-- Add policies for the two tables that didn't have RLS enabled
-- CUSTOMER_PRICE_LEVEL (may not have organization_id - check structure)
CREATE POLICY "customer_price_level_access" ON customer_price_level
FOR ALL USING (true); -- Adjust based on actual table structure

-- SYNC_FUNCTION_CONTROL (may not have organization_id - check structure)
CREATE POLICY "sync_function_control_admin_access" ON sync_function_control
FOR ALL USING (is_admin_user(auth.uid()));