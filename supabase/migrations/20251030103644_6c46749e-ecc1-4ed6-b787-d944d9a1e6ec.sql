-- Drop and recreate with correct syntax
DROP FUNCTION IF EXISTS get_next_invoice_number(uuid);

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year text;
  v_max_number integer;
  v_next_number integer;
  v_invoice_number text;
  v_invoice_max integer;
  v_order_max integer;
BEGIN
  -- Get current year
  v_year := to_char(CURRENT_DATE, 'YYYY');
  
  -- Get max from invoice_record table
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^INV-' || v_year || '-[0-9]{6}$')
      THEN substring(invoice_number, 10, 6)::integer
      ELSE 0
    END
  ), 0)
  INTO v_invoice_max
  FROM invoice_record
  WHERE organization_id = p_organization_id
    AND invoice_number LIKE 'INV-' || v_year || '-%';
  
  -- Get max from sales_order table
  SELECT COALESCE(MAX(
    CASE 
      WHEN order_number ~ ('^INV-' || v_year || '-[0-9]{6}$')
      THEN substring(order_number, 10, 6)::integer
      ELSE 0
    END
  ), 0)
  INTO v_order_max
  FROM sales_order
  WHERE organization_id = p_organization_id
    AND order_number LIKE 'INV-' || v_year || '-%';
  
  -- Get the greater of the two
  v_max_number := GREATEST(v_invoice_max, v_order_max);
  
  -- Increment for next number
  v_next_number := v_max_number + 1;
  
  -- Format as INV-YYYY-NNNNNN
  v_invoice_number := 'INV-' || v_year || '-' || lpad(v_next_number::text, 6, '0');
  
  RETURN v_invoice_number;
END;
$$;