-- PHASE 1: Create backups of old sales_order data (just in case)
CREATE TABLE IF NOT EXISTS sales_order_backup AS SELECT * FROM sales_order;
CREATE TABLE IF NOT EXISTS sales_order_line_item_backup AS SELECT * FROM sales_order_line_item;

-- PHASE 2: Drop unused sales_order-related tables (in dependency order)
DROP TABLE IF EXISTS sales_order_fulfillment_line CASCADE;
DROP TABLE IF EXISTS sales_order_fulfillment CASCADE;
DROP TABLE IF EXISTS sales_order_invoice_link_archived CASCADE;
DROP TABLE IF EXISTS sales_order_invoice_link CASCADE;
DROP TABLE IF EXISTS sales_order_line_item_archived CASCADE;
DROP TABLE IF EXISTS sales_order_line_item CASCADE;
DROP TABLE IF EXISTS sales_order_archived CASCADE;
DROP TABLE IF EXISTS sales_order CASCADE;
DROP TABLE IF EXISTS sales_order_number_sequences CASCADE;

-- PHASE 3: Drop unused sales_order-related functions (with all overloads)
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    -- Drop all functions matching these names regardless of signature
    FOR func_record IN 
        SELECT DISTINCT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = 'public'
        AND proname IN (
            'approve_sales_order',
            'bulk_create_sales_orders_from_templates',
            'calculate_sales_order_totals',
            'can_delete_sales_order',
            'create_invoice_from_sales_order_archived',
            'create_invoice_from_sales_order_sql_archived',
            'create_sales_order_atomic',
            'generate_sales_order_number',
            'generate_sales_orders_from_templates',
            'rollback_to_sales_order_model',
            'trigger_sales_order_generation',
            'trigger_template_items_sales_order_generation',
            'update_sales_order_totals',
            'validate_sales_order_totals'
        )
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I(%s) CASCADE', func_record.proname, func_record.argtypes);
    END LOOP;
END $$;