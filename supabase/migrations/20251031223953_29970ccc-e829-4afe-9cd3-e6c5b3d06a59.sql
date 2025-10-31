-- Fix audit_invoice_status_change function to use correct audit table
-- The function was referencing 'audit_log' with 'created_by' column
-- But the actual table is 'audit_log_entries' with 'changed_by' column

CREATE OR REPLACE FUNCTION public.audit_invoice_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log_entries (
      organization_id,
      table_name,
      record_id,
      operation,
      changed_by,
      change_timestamp,
      before_data,
      after_data
    ) VALUES (
      NEW.organization_id,
      'invoice_record',
      NEW.id,
      'status_change',
      NEW.updated_by,
      now(),
      jsonb_build_object('status', OLD.status),
      jsonb_build_object(
        'status', NEW.status,
        'invoice_number', NEW.invoice_number,
        'customer_id', NEW.customer_id,
        'total', NEW.total
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;