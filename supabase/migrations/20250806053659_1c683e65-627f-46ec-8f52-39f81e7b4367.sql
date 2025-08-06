-- Completely replace the problematic generate_sales_order_number function
-- The issue might be with string concatenation and LPAD
CREATE OR REPLACE FUNCTION public.generate_sales_order_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
  order_number TEXT;
  padded_number TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
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
  
  RETURN order_number;
END;
$$;