
-- Fix create_invoice_from_sales_order_sql to not insert into generated column 'amount'
DROP FUNCTION IF EXISTS create_invoice_from_sales_order_sql(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION create_invoice_from_sales_order_sql(
  p_sales_order_id UUID,
  p_organization_id UUID,
  p_created_by UUID
)
RETURNS UUID
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
    AND organization_id = p_organization_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found: %', p_sales_order_id;
  END IF;
  
  -- Check if already invoiced
  IF v_order.invoiced = TRUE THEN
    RAISE EXCEPTION 'Sales order % is already invoiced', v_order.order_number;
  END IF;
  
  -- Generate invoice number
  SELECT 
    'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
    LPAD((COALESCE(MAX(SUBSTRING(invoice_number FROM '\d+$')::INTEGER), 0) + 1)::TEXT, 6, '0')
  INTO v_invoice_number
  FROM invoice_record
  WHERE organization_id = p_organization_id
    AND invoice_number LIKE 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%';
  
  -- Create invoice
  INSERT INTO invoice_record (
    id,
    organization_id,
    invoice_number,
    invoice_date,
    customer_id,
    subtotal,
    total,
    status,
    memo,
    created_by
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    v_invoice_number,
    v_order.delivery_date,
    v_order.customer_id,
    v_order.subtotal,
    v_order.total,
    'draft',
    'Generated from Sales Order ' || v_order.order_number,
    p_created_by
  ) RETURNING id INTO v_invoice_id;
  
  -- Copy line items (REMOVED amount from INSERT - it's a GENERATED column!)
  INSERT INTO invoice_line_item (
    id,
    organization_id,
    invoice_id,
    item_id,
    description,
    quantity,
    unit_price
  )
  SELECT 
    gen_random_uuid(),
    p_organization_id,
    v_invoice_id,
    soli.item_id,
    COALESCE(ir.name, 'Item'),
    soli.quantity,
    soli.unit_price
  FROM sales_order_line_item soli
  LEFT JOIN item_record ir ON ir.id = soli.item_id
  WHERE soli.sales_order_id = p_sales_order_id
    AND soli.organization_id = p_organization_id;
  
  -- Create sales order invoice link
  INSERT INTO sales_order_invoice_link (
    id,
    organization_id,
    sales_order_id,
    invoice_id,
    created_by
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    p_sales_order_id,
    v_invoice_id,
    p_created_by
  );
  
  -- Update sales order
  UPDATE sales_order
  SET 
    invoiced = TRUE,
    invoice_id = v_invoice_id,
    status = 'invoiced',
    updated_at = NOW()
  WHERE id = p_sales_order_id
    AND organization_id = p_organization_id;
  
  RETURN v_invoice_id;
END;
$$;

COMMENT ON FUNCTION create_invoice_from_sales_order_sql IS 'Creates an invoice from a sales order - amount column is auto-calculated';
