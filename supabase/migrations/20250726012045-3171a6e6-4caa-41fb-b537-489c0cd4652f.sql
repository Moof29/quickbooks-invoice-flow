-- Enable RLS on customer_item_price table
ALTER TABLE customer_item_price ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for customer_item_price
CREATE POLICY "org_isolation_customer_item_price" ON customer_item_price
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

-- Enable RLS on qbo_webhook_events table  
ALTER TABLE qbo_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for qbo_webhook_events
CREATE POLICY "org_isolation_qbo_webhook_events" ON qbo_webhook_events
FOR ALL 
USING (organization_id = get_user_organization_id(auth.uid()));

-- Enable RLS on qbo_sync_queue table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qbo_sync_queue' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE qbo_sync_queue ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "org_isolation_qbo_sync_queue" ON qbo_sync_queue FOR ALL USING (organization_id = get_user_organization_id(auth.uid()))';
    END IF;
END
$$;