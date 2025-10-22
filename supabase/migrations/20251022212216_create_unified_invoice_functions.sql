-- Migration: Create utility functions for unified invoice system
-- Date: 2025-10-22
-- Purpose: Functions for invoice number generation and bulk status updates

-- Function 1: Generate next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number INTEGER;
  v_invoice_number TEXT;
  v_year TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get highest invoice number for this year and organization
  SELECT COALESCE(
    MAX(
      CASE
        WHEN invoice_number ~ ('^INV-' || v_year || '-\d+$')
        THEN SUBSTRING(invoice_number FROM '\d+$')::INTEGER
        ELSE 0
      END
    ),
    0
  ) + 1
  INTO v_next_number
  FROM invoice_record
  WHERE organization_id = p_organization_id
    AND invoice_number LIKE 'INV-' || v_year || '-%';

  -- Format: INV-2025-000001
  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');

  RETURN v_invoice_number;
END;
$$;

COMMENT ON FUNCTION get_next_invoice_number IS 'Generates next sequential invoice number for organization (format: INV-YYYY-NNNNNN)';

-- Function 2: Bulk status update with validation
CREATE OR REPLACE FUNCTION bulk_update_invoice_status(
  p_invoice_ids UUID[],
  p_new_status TEXT,
  p_updated_by UUID
)
RETURNS TABLE(
  invoice_id UUID,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_organization_id UUID;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_organization_id
  FROM profiles
  WHERE id = p_updated_by;

  IF v_organization_id IS NULL THEN
    RETURN QUERY
    SELECT unnest(p_invoice_ids), FALSE, 'User organization not found';
    RETURN;
  END IF;

  -- Validate status
  IF p_new_status NOT IN ('draft', 'confirmed', 'delivered', 'paid', 'cancelled', 'partial', 'sent', 'overdue') THEN
    RETURN QUERY
    SELECT unnest(p_invoice_ids), FALSE, 'Invalid status: ' || p_new_status;
    RETURN;
  END IF;

  -- Process each invoice
  FOREACH v_invoice_id IN ARRAY p_invoice_ids
  LOOP
    BEGIN
      -- Update invoice
      UPDATE invoice_record
      SET
        status = p_new_status,
        invoice_date = CASE
          WHEN p_new_status IN ('confirmed', 'delivered', 'sent') AND invoice_date IS NULL
          THEN CURRENT_DATE
          ELSE invoice_date
        END,
        due_date = CASE
          WHEN p_new_status = 'confirmed' AND due_date IS NULL
          THEN CURRENT_DATE + INTERVAL '30 days'
          ELSE due_date
        END,
        approved_at = CASE
          WHEN p_new_status = 'confirmed' AND approved_at IS NULL
          THEN NOW()
          ELSE approved_at
        END,
        approved_by = CASE
          WHEN p_new_status = 'confirmed' AND approved_by IS NULL
          THEN p_updated_by
          ELSE approved_by
        END,
        updated_by = p_updated_by,
        updated_at = NOW()
      WHERE id = v_invoice_id
        AND organization_id = v_organization_id;

      -- Check if update happened
      IF NOT FOUND THEN
        RETURN QUERY SELECT v_invoice_id, FALSE, 'Invoice not found or access denied';
      ELSE
        RETURN QUERY SELECT v_invoice_id, TRUE, NULL::TEXT;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_invoice_id, FALSE, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION bulk_update_invoice_status IS 'Updates status for multiple invoices with validation and automatic field updates';

-- Function 3: Create audit log for status changes
CREATE OR REPLACE FUNCTION audit_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (
      organization_id,
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      created_by,
      metadata
    ) VALUES (
      NEW.organization_id,
      'invoice_record',
      NEW.id,
      'status_change',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NEW.updated_by,
      jsonb_build_object(
        'invoice_number', NEW.invoice_number,
        'customer_id', NEW.customer_id,
        'total', NEW.total
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for status change auditing
DROP TRIGGER IF EXISTS trg_audit_invoice_status_change ON invoice_record;
CREATE TRIGGER trg_audit_invoice_status_change
  AFTER UPDATE ON invoice_record
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION audit_invoice_status_change();

COMMENT ON FUNCTION audit_invoice_status_change IS 'Trigger function to log invoice status changes to audit_log';
