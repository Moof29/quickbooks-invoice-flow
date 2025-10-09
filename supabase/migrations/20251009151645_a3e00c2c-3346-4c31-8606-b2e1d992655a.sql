-- Create batch duplicate check function for performance optimization
CREATE OR REPLACE FUNCTION check_duplicate_orders_batch(
  p_customer_ids UUID[],
  p_delivery_date DATE,
  p_organization_id UUID
)
RETURNS TABLE (
  customer_id UUID,
  has_duplicate BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c_id::UUID as customer_id,
    EXISTS (
      SELECT 1 
      FROM sales_order so
      WHERE so.customer_id = c_id
        AND so.delivery_date = p_delivery_date
        AND so.organization_id = p_organization_id
    ) as has_duplicate
  FROM UNNEST(p_customer_ids) AS c_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_orders_batch TO authenticated;