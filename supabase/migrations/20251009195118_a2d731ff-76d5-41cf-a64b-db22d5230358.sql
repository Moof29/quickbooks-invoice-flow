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
AS $$
DECLARE
  v_order_number TEXT;
  v_order_id UUID;
  v_year_suffix TEXT;
  v_next_number INTEGER;
  v_current_year INTEGER;
  v_lock_key BIGINT;
BEGIN
  v_year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- CRITICAL: Add advisory lock to serialize access
  v_lock_key := ('x' || substr(md5(p_organization_id::text || v_year_suffix), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- Now safely get next number from sequence table
  INSERT INTO sales_order_number_sequences (organization_id, year, last_number)
  VALUES (p_organization_id, v_current_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET 
    last_number = sales_order_number_sequences.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;
  
  v_order_number := 'SO-' || v_year_suffix || '-' || LPAD(v_next_number::TEXT, 3, '0');
  
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
  
  -- Lock released automatically at transaction end
  RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;