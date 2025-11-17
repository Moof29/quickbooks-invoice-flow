-- Clean up old QuickBooks functions that reference non-existent tables

-- Drop old functions that use deprecated table names
DROP FUNCTION IF EXISTS needs_qb_sync(character varying, uuid, uuid);
DROP FUNCTION IF EXISTS queue_qb_sync(character varying, uuid, uuid, character varying, integer);
DROP FUNCTION IF EXISTS update_qb_mapping(character varying, uuid, uuid, character varying, character varying);
DROP FUNCTION IF EXISTS get_qb_sync_status(character varying, uuid);

-- Drop old trigger function that might conflict
DROP FUNCTION IF EXISTS qbo_sync_trigger_function() CASCADE;

-- Verify qbo_enqueue_sync_operation signature and recreate if needed
-- This should match the qbo_sync_queue table structure
CREATE OR REPLACE FUNCTION public.qbo_enqueue_sync_operation(
    p_entity_id uuid,
    p_entity_type text,
    p_operation_type text,
    p_organization_id uuid,
    p_payload jsonb DEFAULT NULL::jsonb,
    p_priority integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_queue_id UUID;
    v_has_connection BOOLEAN;
BEGIN
    -- Check if organization has active QBO connection
    SELECT EXISTS (
        SELECT 1 FROM qbo_connection
        WHERE organization_id = p_organization_id
          AND is_active = true
    ) INTO v_has_connection;
    
    -- Only enqueue if connection exists
    IF NOT v_has_connection THEN
        RETURN NULL;
    END IF;
    
    -- Insert into qbo_sync_queue (not quickbooks_sync_queue)
    INSERT INTO qbo_sync_queue (
        entity_id, 
        entity_type, 
        operation_type, 
        organization_id, 
        payload, 
        priority
    ) VALUES (
        p_entity_id, 
        p_entity_type, 
        p_operation_type, 
        p_organization_id, 
        p_payload, 
        p_priority
    ) RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$;