-- Migration: Consolidate sales_order into invoice_record with status-driven workflow (FIXED)

-- Step 1: Update invoice_record status constraint to include 'pending' and 'invoiced'
ALTER TABLE invoice_record 
  DROP CONSTRAINT IF EXISTS invoice_record_status_check;

ALTER TABLE invoice_record
  ADD CONSTRAINT invoice_record_status_check 
  CHECK (status IN (
    'pending',      -- Sales order staging phase
    'invoiced',     -- Converted to official invoice
    'draft',
    'confirmed',
    'delivered',
    'paid',
    'cancelled',    -- Used for no-order invoices
    'partial',
    'sent',
    'overdue'
  ));

-- Set default to 'pending' for new records (staging phase)
ALTER TABLE invoice_record 
  ALTER COLUMN status SET DEFAULT 'pending';

-- Step 2: Create atomic invoice creation function
CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_organization_id UUID,
  p_customer_id UUID,
  p_invoice_number TEXT,
  p_delivery_date DATE,
  p_status TEXT DEFAULT 'pending',
  p_order_date DATE DEFAULT CURRENT_DATE,
  p_memo TEXT DEFAULT NULL,
  p_is_no_order BOOLEAN DEFAULT FALSE,
  p_created_from_template BOOLEAN DEFAULT FALSE,
  p_template_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  INSERT INTO invoice_record (
    organization_id,
    customer_id,
    invoice_number,
    status,
    order_date,
    delivery_date,
    invoice_date,
    due_date,
    memo,
    is_no_order,
    subtotal,
    total,
    created_at,
    updated_at
  ) VALUES (
    p_organization_id,
    p_customer_id,
    p_invoice_number,
    p_status,
    p_order_date,
    p_delivery_date,
    NULL,  -- Set when status changes to 'invoiced'
    NULL,  -- Set when status changes to 'invoiced'
    p_memo,
    p_is_no_order,
    0,
    0,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;

-- Step 3: Create cancel invoice order function
CREATE OR REPLACE FUNCTION cancel_invoice_order(
  p_invoice_id UUID,
  p_cancelled_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update invoice to cancelled status with $0 totals
  UPDATE invoice_record
  SET 
    status = 'cancelled',
    approved_at = NOW(),
    approved_by = p_cancelled_by,
    total = 0,
    subtotal = 0,
    tax_total = 0,
    invoice_date = COALESCE(invoice_date, NOW()),
    due_date = COALESCE(due_date, NOW()),
    is_no_order = TRUE,
    updated_at = NOW()
  WHERE id = p_invoice_id
    AND status = 'pending';  -- Safety check

  -- Delete existing line items
  DELETE FROM invoice_line_item WHERE invoice_id = p_invoice_id;

  -- Insert "NO ORDER" line item
  INSERT INTO invoice_line_item (
    invoice_id,
    description,
    quantity,
    unit_price,
    organization_id
  )
  SELECT 
    p_invoice_id,
    'NO ORDER',
    0,
    0,
    organization_id
  FROM invoice_record
  WHERE id = p_invoice_id;
END;
$$;