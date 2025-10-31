-- Fix the cancel_invoice_order function to use correct audit table
-- The function was referencing 'audit_log' with 'created_by' column
-- But the actual table is 'audit_log_entries' with 'changed_by' column

CREATE OR REPLACE FUNCTION cancel_invoice_order(
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
    updated_at = now()
  WHERE id = p_invoice_id
    AND status = 'pending';

  -- Log the cancellation in audit_log_entries (using correct column name)
  INSERT INTO audit_log_entries (
    organization_id,
    table_name,
    operation,
    record_id,
    changed_by,
    change_timestamp,
    after_data
  ) VALUES (
    v_organization_id,
    'invoice_record',
    'CANCEL',
    p_invoice_id,
    p_cancelled_by,
    now(),
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'status', 'cancelled',
      'action', 'order_cancelled_no_order_today'
    )
  );

  -- Note: The "NO ORDER TODAY" line item creation is handled by triggers
  -- or can be added here if needed

END;
$$;