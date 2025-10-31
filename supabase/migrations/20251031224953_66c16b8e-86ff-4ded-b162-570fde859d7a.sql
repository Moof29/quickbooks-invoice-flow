-- Fix audit_log_entries operations to match check constraint
-- The constraint only allows: 'INSERT', 'UPDATE', 'DELETE'
-- But functions were using 'CANCEL' and 'status_change'

-- Fix cancel_invoice_order to use 'UPDATE' instead of 'CANCEL'
CREATE OR REPLACE FUNCTION public.cancel_invoice_order(
  p_invoice_id UUID,
  p_cancelled_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_invoice_number TEXT;
BEGIN
  -- Get the invoice details
  SELECT organization_id, invoice_number
  INTO v_organization_id, v_invoice_number
  FROM invoice_record
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Update the invoice status to cancelled
  UPDATE invoice_record
  SET 
    status = 'cancelled',
    updated_by = p_cancelled_by,
    updated_at = now()
  WHERE id = p_invoice_id
    AND status = 'pending';

  -- Log the cancellation in audit_log_entries (using 'UPDATE' operation)
  INSERT INTO audit_log_entries (
    organization_id,
    table_name,
    operation,
    record_id,
    changed_by,
    change_timestamp,
    before_data,
    after_data
  ) VALUES (
    v_organization_id,
    'invoice_record',
    'UPDATE',  -- Changed from 'CANCEL' to 'UPDATE'
    p_invoice_id,
    p_cancelled_by,
    now(),
    jsonb_build_object('status', 'pending'),
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'status', 'cancelled',
      'action', 'order_cancelled'
    )
  );
END;
$$;

-- Fix audit_invoice_status_change to use 'UPDATE' instead of 'status_change'
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
      'UPDATE',  -- Changed from 'status_change' to 'UPDATE'
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