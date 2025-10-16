-- Create function to process pending batch jobs
CREATE OR REPLACE FUNCTION public.process_pending_batch_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job RECORD;
  v_order_id UUID;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_successful INTEGER := 0;
  v_failed INTEGER := 0;
  v_processed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  -- Get the next pending job
  SELECT * INTO v_job
  FROM batch_job_queue
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- No jobs to process
  IF NOT FOUND THEN
    RETURN jsonb_build_object('message', 'No jobs pending');
  END IF;
  
  -- Update job status to processing
  UPDATE batch_job_queue
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = v_job.id;
  
  -- Process based on job type
  IF v_job.job_type = 'batch_invoice_orders' THEN
    -- Loop through sales orders in the job data
    FOR v_order_id IN 
      SELECT jsonb_array_elements_text(v_job.job_data->'order_ids')::UUID
    LOOP
      BEGIN
        v_processed := v_processed + 1;
        
        -- Generate invoice number
        SELECT 
          'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
          LPAD((COALESCE(MAX(SUBSTRING(invoice_number FROM '\d+$')::INTEGER), 0) + 1)::TEXT, 6, '0')
        INTO v_invoice_number
        FROM invoice_record
        WHERE organization_id = v_job.organization_id
          AND invoice_number LIKE 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%';
        
        -- Create invoice from sales order
        INSERT INTO invoice_record (
          organization_id,
          invoice_number,
          invoice_date,
          customer_id,
          subtotal,
          total,
          status,
          memo
        )
        SELECT 
          so.organization_id,
          v_invoice_number,
          so.delivery_date,
          so.customer_id,
          so.subtotal,
          so.total,
          'draft',
          'Generated from Sales Order ' || so.order_number
        FROM sales_order so
        WHERE so.id = v_order_id
        RETURNING id INTO v_invoice_id;
        
        -- Copy line items
        INSERT INTO invoice_line_item (
          organization_id,
          invoice_id,
          item_id,
          description,
          quantity,
          unit_price
        )
        SELECT 
          organization_id,
          v_invoice_id,
          item_id,
          COALESCE(ir.name, 'Item'),
          quantity,
          unit_price
        FROM sales_order_line_item soli
        LEFT JOIN item_record ir ON ir.id = soli.item_id
        WHERE soli.sales_order_id = v_order_id;
        
        -- Link invoice to sales order
        INSERT INTO sales_order_invoice_link (
          organization_id,
          sales_order_id,
          invoice_id,
          created_by
        ) VALUES (
          v_job.organization_id,
          v_order_id,
          v_invoice_id,
          v_job.created_by
        );
        
        -- Update sales order
        UPDATE sales_order
        SET 
          invoiced = TRUE,
          invoice_id = v_invoice_id,
          status = 'invoiced',
          updated_at = NOW()
        WHERE id = v_order_id;
        
        v_successful := v_successful + 1;
        
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_object(
          'order_id', v_order_id,
          'error', SQLERRM
        );
      END;
    END LOOP;
  END IF;
  
  -- Update job as completed
  UPDATE batch_job_queue
  SET 
    status = CASE WHEN v_failed > 0 THEN 'completed_with_errors' ELSE 'completed' END,
    completed_at = NOW(),
    updated_at = NOW(),
    processed_items = v_processed,
    successful_items = v_successful,
    failed_items = v_failed,
    errors = v_errors
  WHERE id = v_job.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job.id,
    'job_type', v_job.job_type,
    'processed', v_processed,
    'successful', v_successful,
    'failed', v_failed,
    'errors', v_errors
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Mark job as failed
  UPDATE batch_job_queue
  SET 
    status = 'failed',
    completed_at = NOW(),
    updated_at = NOW(),
    last_error = SQLERRM
  WHERE id = v_job.id;
  
  RETURN jsonb_build_object(
    'success', false,
    'job_id', v_job.id,
    'error', SQLERRM
  );
END;
$$;