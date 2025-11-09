-- Fix check_organization_references trigger to allow NULL customer_id
-- The trigger was failing when customer_id was NULL, causing issues during data clearing

CREATE OR REPLACE FUNCTION public.check_organization_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- only enforce on the two tables that actually have customer_id
  IF TG_TABLE_NAME NOT IN ('invoice_record','sales_order') THEN
    RETURN NEW;
  END IF;

  -- Allow NULL customer_id (it's optional in the schema)
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate that customer_id belongs to the same organization
  IF NOT EXISTS (
    SELECT 1
      FROM public.customer_profile cp
     WHERE cp.id   = NEW.customer_id
       AND cp.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION
      'cross-org reference violation: % → %',
      TG_TABLE_NAME,
      NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$function$;
