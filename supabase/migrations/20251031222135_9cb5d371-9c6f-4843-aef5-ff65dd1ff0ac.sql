-- Update check_duplicate_orders_batch to use invoice_record instead of sales_order
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
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c_id AS customer_id,
    EXISTS (
      SELECT 1 
      FROM invoice_record ir
      WHERE ir.customer_id = c_id
        AND ir.delivery_date = p_delivery_date
        AND ir.organization_id = p_organization_id
        AND ir.status = 'pending'
    ) as has_duplicate
  FROM UNNEST(p_customer_ids) AS c_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_orders_batch TO authenticated;