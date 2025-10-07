-- Update validate_order_before_invoice to allow "No Order Today" orders
CREATE OR REPLACE FUNCTION public.validate_order_before_invoice(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_line_item_count INTEGER;
  v_result JSON;
BEGIN
  -- Get order details
  SELECT 
    id,
    status,
    invoiced,
    is_no_order_today,
    total,
    organization_id
  INTO v_order
  FROM sales_order
  WHERE id = p_order_id;
  
  -- Check if order exists
  IF NOT FOUND THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order not found'
    );
    RETURN v_result;
  END IF;
  
  -- Check if already invoiced
  IF v_order.invoiced = true THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order is already invoiced'
    );
    RETURN v_result;
  END IF;
  
  -- Check if status is 'reviewed'
  IF v_order.status != 'reviewed' THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order must be in "reviewed" status before invoicing. Current status: ' || v_order.status
    );
    RETURN v_result;
  END IF;
  
  -- REMOVED: Block on "No Order Today" - we now ALLOW these to be invoiced
  
  -- All validations passed (including "No Order Today" orders)
  v_result := json_build_object(
    'can_invoice', true,
    'error_message', NULL
  );
  
  RETURN v_result;
END;
$function$;