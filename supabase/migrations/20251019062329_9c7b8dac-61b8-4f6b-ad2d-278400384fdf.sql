-- Fix create_invoice_from_sales_order_sql to not insert amount (it's a GENERATED column)

CREATE OR REPLACE FUNCTION create_invoice_from_sales_order_sql(
  p_sales_order_id UUID,
  p_organization_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_order RECORD;
BEGIN
  -- Get sales order details
  SELECT * INTO v_order
  FROM sales_order
  WHERE id = p_sales_order_id
    AND organization_id = p_organization_id
    AND invoiced = false
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or already invoiced: %', p_sales_order_id;
  END IF;
  
  -- Generate atomic invoice number
  SELECT get_next_invoice_number(p_organization_id) INTO v_invoice_number;
  
  -- Create invoice
  INSERT INTO invoice_record (
    id,
    organization_id,
    invoice_number,
    invoice_date,
    customer_id,
    subtotal,
    tax_total,
    total,
    status,
    memo,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    v_invoice_number,
    v_order.delivery_date,
    v_order.customer_id,
    v_order.subtotal,
    v_order.tax_total,
    v_order.total,
    'draft',
    'Generated from Sales Order ' || v_order.order_number,
    NOW(),
    NOW()
  ) RETURNING id INTO v_invoice_id;
  
  -- Copy line items (DO NOT insert amount - it's a GENERATED column)
  INSERT INTO invoice_line_item (
    id,
    organization_id,
    invoice_id,
    item_id,
    description,
    quantity,
    unit_price,
    created_at,
    updated_at
  )
  SELECT 
    gen_random_uuid(),
    p_organization_id,
    v_invoice_id,
    soli.item_id,
    COALESCE(ir.name, 'Item'),
    soli.quantity,
    soli.unit_price,
    NOW(),
    NOW()
  FROM sales_order_line_item soli
  LEFT JOIN item_record ir ON ir.id = soli.item_id
  WHERE soli.sales_order_id = p_sales_order_id
    AND soli.organization_id = p_organization_id;
  
  -- Create link
  INSERT INTO sales_order_invoice_link (
    id,
    organization_id,
    sales_order_id,
    invoice_id,
    created_by,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    p_sales_order_id,
    v_invoice_id,
    NULL, -- System generated
    NOW()
  );
  
  -- Update sales order
  UPDATE sales_order
  SET 
    invoiced = true,
    invoice_id = v_invoice_id,
    status = 'invoiced',
    updated_at = NOW()
  WHERE id = p_sales_order_id;
  
  RETURN v_invoice_id;
END;
$$;

-- Reset the failed job back to pending so it can be retried
UPDATE batch_job_queue
SET 
  status = 'pending',
  started_at = NULL,
  completed_at = NULL,
  processed_items = 0,
  successful_items = 0,
  failed_items = 0,
  errors = NULL,
  last_error = NULL
WHERE id = '7e5e1cfb-bf33-4269-b067-ffa533122a15';

COMMENT ON FUNCTION create_invoice_from_sales_order_sql IS 'Creates invoice from sales order - FIXED to not insert GENERATED amount column';