-- Fix the approve_sales_order function to use 'reviewed' status instead of 'approved'
CREATE OR REPLACE FUNCTION public.approve_sales_order(p_sales_order_id uuid, p_approved_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the sales order to reviewed status (not approved which violates constraint)
  UPDATE sales_order 
  SET 
    status = 'reviewed',
    approved_at = now(),
    approved_by = p_approved_by,
    updated_at = now()
  WHERE id = p_sales_order_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or could not be updated';
  END IF;
END;
$function$;