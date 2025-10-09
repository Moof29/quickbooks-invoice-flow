-- Create atomic sales order creation function that eliminates race conditions
CREATE OR REPLACE FUNCTION create_sales_order_atomic(
  p_organization_id UUID,
  p_customer_id UUID,
  p_order_date DATE,
  p_delivery_date DATE,
  p_status TEXT,
  p_is_no_order_today BOOLEAN,
  p_memo TEXT
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_number TEXT;
  v_order_id UUID;
  v_lock_key BIGINT;
  v_year_suffix TEXT;
  v_next_number INTEGER;
BEGIN
  v_year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Create advisory lock for this org+year
  v_lock_key := ('x' || substr(md5(p_organization_id::text || v_year_suffix), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- Generate order number within this locked transaction
  SELECT COALESCE(MAX(CAST(SUBSTRING(so.order_number FROM 'SO-' || v_year_suffix || '-([0-9]+)') AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM sales_order so
  WHERE so.organization_id = p_organization_id 
    AND so.order_number LIKE 'SO-' || v_year_suffix || '-%';
  
  v_order_number := 'SO-' || v_year_suffix || '-' || LPAD(v_next_number::TEXT, 3, '0');
  
  -- Insert order in same transaction (lock still held)
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
    memo
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
    p_memo
  )
  RETURNING id INTO v_order_id;
  
  -- Lock automatically releases when transaction commits
  RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_sales_order_atomic TO authenticated;