-- Drop the manual sequence table approach and use native PostgreSQL sequences instead
-- This is atomic and safe for any level of concurrency

-- First, create a sequence for the organization we're working with
-- We'll dynamically create sequences as needed using a function
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_organization_id UUID, p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence_name TEXT;
  v_next_number INTEGER;
  v_order_number TEXT;
  v_padded_number TEXT;
BEGIN
  -- Create sequence name based on org ID and year
  v_sequence_name := 'so_seq_' || REPLACE(p_organization_id::TEXT, '-', '_') || '_' || p_year::TEXT;
  
  -- Create sequence if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences 
    WHERE schemaname = 'public' 
    AND sequencename = v_sequence_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START 1', v_sequence_name);
  END IF;
  
  -- Get next value from sequence (this is atomic and concurrent-safe)
  EXECUTE format('SELECT nextval(%L)', 'public.' || v_sequence_name) INTO v_next_number;
  
  -- Pad the number
  IF v_next_number < 10 THEN
    v_padded_number := '00' || v_next_number::TEXT;
  ELSIF v_next_number < 100 THEN
    v_padded_number := '0' || v_next_number::TEXT;
  ELSE
    v_padded_number := v_next_number::TEXT;
  END IF;
  
  -- Build order number
  v_order_number := 'SO-' || p_year::TEXT || '-' || v_padded_number;
  
  RETURN v_order_number;
END;
$$;

-- Update the create_sales_order_atomic function to use the new sequence-based approach
CREATE OR REPLACE FUNCTION public.create_sales_order_atomic(
  p_organization_id UUID,
  p_customer_id UUID,
  p_order_date DATE,
  p_delivery_date DATE,
  p_status TEXT,
  p_is_no_order_today BOOLEAN,
  p_memo TEXT
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
  
  RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;