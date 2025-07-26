-- Fix the qbo_sync_trigger_guard function to use the correct column name
CREATE OR REPLACE FUNCTION public.qbo_sync_trigger_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Skip syncing if QBO is not connected for this org
  IF NOT EXISTS (
    SELECT 1
    FROM qbo_connection
    WHERE organization_id = NEW.organization_id
      AND is_active = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Otherwise, enqueue the sync operation
  PERFORM public.qbo_enqueue_sync_operation(
    TG_TABLE_NAME::text,
    NEW.id,
    NEW.organization_id
  );

  RETURN NEW;
END;
$function$;

-- Now fix the organization_id for the synced customer records
UPDATE customer_profile 
SET organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
WHERE organization_id = '11111111-1111-1111-1111-111111111111';