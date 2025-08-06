-- Update existing sales orders to use pending status instead of draft and template_generated
UPDATE sales_order 
SET status = 'pending' 
WHERE status IN ('draft', 'template_generated');

-- Create function to convert approved sales order to invoice
CREATE OR REPLACE FUNCTION convert_sales_order_to_invoice(p_sales_order_id uuid, p_converted_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_sales_order_rec record;
  v_line_item_rec record;
BEGIN
  -- Get the sales order details
  SELECT * INTO v_sales_order_rec
  FROM sales_order 
  WHERE id = p_sales_order_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or not approved';
  END IF;
  
  -- Create the invoice
  INSERT INTO invoice_record (
    id,
    organization_id,
    customer_id,
    invoice_date,
    due_date,
    subtotal,
    tax_total,
    shipping_total,
    discount_total,
    total,
    memo,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_sales_order_rec.organization_id,
    v_sales_order_rec.customer_id,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_sales_order_rec.subtotal,
    v_sales_order_rec.tax_total,
    v_sales_order_rec.shipping_total,
    v_sales_order_rec.discount_total,
    v_sales_order_rec.total,
    'Converted from Sales Order: ' || v_sales_order_rec.order_number,
    now(),
    now()
  ) RETURNING id INTO v_invoice_id;
  
  -- Copy line items
  FOR v_line_item_rec IN 
    SELECT * FROM sales_order_line_item 
    WHERE sales_order_id = p_sales_order_id
  LOOP
    INSERT INTO invoice_line_item (
      id,
      organization_id,
      invoice_id,
      item_id,
      quantity,
      unit_price,
      amount,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_line_item_rec.organization_id,
      v_invoice_id,
      v_line_item_rec.item_id,
      v_line_item_rec.quantity,
      v_line_item_rec.unit_price,
      v_line_item_rec.amount,
      now(),
      now()
    );
  END LOOP;
  
  -- Update sales order status to invoiced
  UPDATE sales_order 
  SET 
    status = 'invoiced',
    updated_at = now()
  WHERE id = p_sales_order_id;
  
  -- Create sales order to invoice link
  INSERT INTO sales_order_invoice_link (
    id,
    organization_id,
    sales_order_id,
    invoice_id,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_sales_order_rec.organization_id,
    p_sales_order_id,
    v_invoice_id,
    p_converted_by,
    now(),
    now()
  );
  
  RETURN v_invoice_id;
END;
$$;