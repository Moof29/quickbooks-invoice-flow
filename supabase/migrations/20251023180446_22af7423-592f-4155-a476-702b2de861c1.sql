-- Drop existing function and recreate with correct return type
DROP FUNCTION IF EXISTS public.bulk_update_invoice_status(UUID[], TEXT, UUID);

-- Create bulk update invoice status RPC function for performance optimization
CREATE OR REPLACE FUNCTION public.bulk_update_invoice_status(
  p_invoice_ids UUID[],
  p_new_status TEXT,
  p_updated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  -- Update all invoices in a single transaction
  UPDATE invoice_record
  SET 
    status = p_new_status,
    updated_by = p_updated_by,
    updated_at = NOW(),
    -- Set approved_at when confirming orders
    approved_at = CASE 
      WHEN p_new_status = 'confirmed' AND approved_at IS NULL 
      THEN NOW() 
      ELSE approved_at 
    END
  WHERE id = ANY(p_invoice_ids)
  AND status != p_new_status;  -- Only update if status is different
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Return summary
  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'failed_count', v_failed_count,
    'errors', v_errors
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error information
  RETURN jsonb_build_object(
    'updated_count', 0,
    'failed_count', array_length(p_invoice_ids, 1),
    'errors', jsonb_build_array(
      jsonb_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE
      )
    )
  );
END;
$function$;