-- Update the generate_sales_order_number function to use advisory locks for thread safety
CREATE OR REPLACE FUNCTION public.generate_sales_order_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
  order_number TEXT;
  padded_number TEXT;
  lock_key BIGINT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Create a lock key based on organization ID and year to prevent race conditions
  lock_key := ('x' || substr(md5(org_id::text || year_suffix), 1, 16))::bit(64)::bigint;
  
  -- Acquire advisory lock (will wait if another transaction holds it)
  PERFORM pg_advisory_xact_lock(lock_key);
  
  -- Get the next number for this year and organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(so.order_number FROM 'SO-' || year_suffix || '-([0-9]+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_order so
  WHERE so.organization_id = org_id 
    AND so.order_number LIKE 'SO-' || year_suffix || '-%';
  
  -- Manually pad the number to avoid LPAD issues
  IF next_number < 10 THEN
    padded_number := '00' || next_number::TEXT;
  ELSIF next_number < 100 THEN
    padded_number := '0' || next_number::TEXT;
  ELSE
    padded_number := next_number::TEXT;
  END IF;
  
  order_number := 'SO-' || year_suffix || '-' || padded_number;
  
  -- Lock is automatically released at transaction end
  RETURN order_number;
END;
$function$;