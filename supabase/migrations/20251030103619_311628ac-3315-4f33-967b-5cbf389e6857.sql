-- Drop the old function
DROP FUNCTION IF EXISTS get_next_invoice_number(uuid);

-- Recreate the function to check BOTH invoice_record AND sales_order tables
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
BEGIN
  -- Get current year
  v_year := to_char(CURRENT_DATE, 'YYYY');
  
  -- Get the maximum invoice number from BOTH tables for this year and organization
  SELECT COALESCE(
    GREATEST(
      -- Check invoice_record table
      (SELECT MAX(
        CASE 
          WHEN invoice_number ~ '^INV-' || v_year || '-\d{6}$'
          THEN substring(invoice_number from 'INV-' || v_year || '-(\d{6})$')::integer
          ELSE 0
        END
      )
      FROM invoice_record
      WHERE organization_id = p_organization_id
        AND invoice_number LIKE 'INV-' || v_year || '-%'),
      -- Check sales_order table
      (SELECT MAX(
        CASE 
          WHEN order_number ~ '^INV-' || v_year || '-\d{6}$'
          THEN substring(order_number from 'INV-' || v_year || '-(\d{6})$')::integer
          ELSE 0
        END
      )
      FROM sales_order
      WHERE organization_id = p_organization_id
        AND order_number LIKE 'INV-' || v_year || '-%')
    ),
    0
  ) INTO v_max_number;
  
  -- Increment for next number
  v_next_number := v_max_number + 1;
  
  -- Format as INV-YYYY-NNNNNN
  v_invoice_number := 'INV-' || v_year || '-' || lpad(v_next_number::text, 6, '0');
  
  RETURN v_invoice_number;
END;
$$;