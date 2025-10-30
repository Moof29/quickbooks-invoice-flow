-- Update create_sales_order_atomic to support template fields
CREATE OR REPLACE FUNCTION public.create_sales_order_atomic(
  p_organization_id UUID,
  p_customer_id UUID,
  p_order_date DATE,
  p_delivery_date DATE,
  p_status TEXT,
  p_is_no_order_today BOOLEAN,
  p_memo TEXT,
  p_created_from_template BOOLEAN DEFAULT FALSE,
  p_template_id UUID DEFAULT NULL
)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_number TEXT;
  v_order_id UUID;
  v_current_year INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get next order number using the sequence-based function (completely atomic)
  v_order_number := get_next_order_number(p_organization_id, v_current_year);
  
  -- Insert order
  INSERT INTO sales_order (
    organization_id,
    customer_id,
    order_date,
    delivery_date,
    status,
    order_number,
    subtotal,
    total,
    is_no_order_today,
    invoiced,
    memo,
    created_from_template,
    template_id
  ) VALUES (
    p_organization_id,
    p_customer_id,
    p_order_date,
    p_delivery_date,
    p_status,
    v_order_number,
    0,
    0,
    p_is_no_order_today,
    false,
    p_memo,
    p_created_from_template,
    p_template_id
  )
  RETURNING id INTO v_order_id;
  
  RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;