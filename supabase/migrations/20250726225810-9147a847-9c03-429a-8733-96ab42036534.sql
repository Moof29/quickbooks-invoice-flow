-- Fix the ambiguous column reference in the sales order number generation function
CREATE OR REPLACE FUNCTION generate_sales_order_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
  order_number TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the next number for this year and organization (fixed ambiguous column reference)
  SELECT COALESCE(MAX(CAST(SUBSTRING(so.order_number FROM 'SO-' || year_suffix || '-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_order so
  WHERE so.organization_id = org_id 
    AND so.order_number LIKE 'SO-' || year_suffix || '-%';
  
  order_number := 'SO-' || year_suffix || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql;