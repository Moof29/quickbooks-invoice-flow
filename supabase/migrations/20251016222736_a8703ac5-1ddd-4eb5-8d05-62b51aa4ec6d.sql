-- Drop the existing broken function first
DROP FUNCTION IF EXISTS public.process_invoice_batch(jsonb);

-- Create the correct process_invoice_batch function
CREATE OR REPLACE FUNCTION public.process_invoice_batch(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sales_order_ids UUID[];
  v_invoice_date DATE;
  v_due_days INTEGER;
  v_bulk_job_id UUID;
  v_batch_number INTEGER;
  v_batch_total INTEGER;
  v_user_context JSONB;
  
  v_order_id UUID;
  v_invoice_id UUID;
  v_successful INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_invoices_created UUID[] := '{}';
  
  v_error_message TEXT;
BEGIN
  -- Extract parameters from payload
  v_sales_order_ids := ARRAY(SELECT jsonb_array_elements_text(p_payload->'sales_order_ids')::UUID);
  v_invoice_date := (p_payload->>'invoice_date')::DATE;
  v_due_days := (p_payload->>'due_days')::INTEGER;
  v_bulk_job_id := (p_payload->>'bulk_job_id')::UUID;
  v_batch_number := (p_payload->>'batch_number')::INTEGER;
  v_batch_total := (p_payload->>'batch_total')::INTEGER;
  v_user_context := p_payload->'user_context';
  
  -- Process each sales order
  FOREACH v_order_id IN ARRAY v_sales_order_ids
  LOOP
    BEGIN
      -- Call the existing invoice creation function
      SELECT create_invoice_from_sales_order(
        v_order_id,
        v_invoice_date,
        v_due_days
      ) INTO v_invoice_id;
      
      v_successful := v_successful + 1;
      v_invoices_created := array_append(v_invoices_created, v_invoice_id);
      
      -- Update parent job progress
      UPDATE batch_job_queue
      SET 
        processed_items = processed_items + 1,
        successful_items = successful_items + 1,
        updated_at = NOW()
      WHERE id = v_bulk_job_id;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_error_message := SQLERRM;
      
      -- Log the error
      v_errors := v_errors || jsonb_build_object(
        'order_id', v_order_id,
        'error', v_error_message,
        'timestamp', NOW()
      );
      
      -- Update parent job with failure
      UPDATE batch_job_queue
      SET 
        processed_items = processed_items + 1,
        failed_items = failed_items + 1,
        errors = COALESCE(errors, '[]'::JSONB) || jsonb_build_object(
          'order_id', v_order_id,
          'error', v_error_message
        ),
        updated_at = NOW()
      WHERE id = v_bulk_job_id;
    END;
  END LOOP;
  
  -- Return batch result
  RETURN jsonb_build_object(
    'batch_number', v_batch_number,
    'batch_total', v_batch_total,
    'batch_successful', v_successful,
    'batch_failed', v_failed,
    'errors', v_errors,
    'invoices_created', v_invoices_created
  );
END;
$function$;