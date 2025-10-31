-- Update check_duplicate_orders function to use invoice_record table and invoice_number
CREATE OR REPLACE FUNCTION public.check_duplicate_orders(
  p_customer_id uuid, 
  p_delivery_date date, 
  p_organization_id uuid, 
  p_exclude_order_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_order RECORD;
  v_result JSON;
BEGIN
  -- Look for existing order with same customer and delivery date in invoice_record
  SELECT 
    id,
    invoice_number,
    status,
    total
  INTO v_existing_order
  FROM invoice_record
  WHERE customer_id = p_customer_id
    AND delivery_date = p_delivery_date
    AND organization_id = p_organization_id
    AND (p_exclude_order_id IS NULL OR id != p_exclude_order_id)
  LIMIT 1;
  
  IF FOUND THEN
    v_result := json_build_object(
      'has_duplicate', true,
      'existing_order', json_build_object(
        'id', v_existing_order.id,
        'invoice_number', v_existing_order.invoice_number,
        'status', v_existing_order.status,
        'total', v_existing_order.total
      )
    );
  ELSE
    v_result := json_build_object(
      'has_duplicate', false,
      'existing_order', NULL
    );
  END IF;
  
  RETURN v_result;
END;
$$;