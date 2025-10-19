
-- =====================================================
-- BATCH INVOICE PROCESSING - PURE POSTGRESQL SOLUTION
-- =====================================================

-- Function 1: Create invoice from sales order (Pure SQL)
CREATE OR REPLACE FUNCTION create_invoice_from_sales_order_sql(
  p_sales_order_id UUID,
  p_organization_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_order RECORD;
BEGIN
  -- Get sales order details
  SELECT * INTO v_order
  FROM sales_order
  WHERE id = p_sales_order_id
    AND organization_id = p_organization_id
    AND invoiced = false
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or already invoiced: %', p_sales_order_id;
  END IF;
  
  -- Generate atomic invoice number
  SELECT get_next_invoice_number(p_organization_id) INTO v_invoice_number;
  
  -- Create invoice
  INSERT INTO invoice_record (
    id,
    organization_id,
    invoice_number,
    invoice_date,
    customer_id,
    subtotal,
    tax_total,
    total,
    status,
    memo,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    v_invoice_number,
    v_order.delivery_date,
    v_order.customer_id,
    v_order.subtotal,
    v_order.tax_total,
    v_order.total,
    'draft',
    'Generated from Sales Order ' || v_order.order_number,
    NOW(),
    NOW()
  ) RETURNING id INTO v_invoice_id;
  
  -- Copy line items
  INSERT INTO invoice_line_item (
    id,
    organization_id,
    invoice_id,
    item_id,
    description,
    quantity,
    unit_price,
    amount,
    created_at,
    updated_at
  )
  SELECT 
    gen_random_uuid(),
    p_organization_id,
    v_invoice_id,
    soli.item_id,
    COALESCE(ir.name, 'Item'),
    soli.quantity,
    soli.unit_price,
    soli.amount,
    NOW(),
    NOW()
  FROM sales_order_line_item soli
  LEFT JOIN item_record ir ON ir.id = soli.item_id
  WHERE soli.sales_order_id = p_sales_order_id
    AND soli.organization_id = p_organization_id;
  
  -- Create link
  INSERT INTO sales_order_invoice_link (
    id,
    organization_id,
    sales_order_id,
    invoice_id,
    created_by,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    p_sales_order_id,
    v_invoice_id,
    NULL, -- System generated
    NOW()
  );
  
  -- Update sales order
  UPDATE sales_order
  SET 
    invoiced = true,
    invoice_id = v_invoice_id,
    status = 'invoiced',
    updated_at = NOW()
  WHERE id = p_sales_order_id;
  
  RETURN v_invoice_id;
END;
$$;

-- Function 2: Process bulk invoice job (Main batch processor)
CREATE OR REPLACE FUNCTION process_bulk_invoice_job_sql(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_order_id UUID;
  v_invoice_id UUID;
  v_processed INTEGER := 0;
  v_successful INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_start_time TIMESTAMP;
BEGIN
  v_start_time := NOW();
  
  -- Get and lock the job
  SELECT * INTO v_job
  FROM batch_job_queue
  WHERE id = p_job_id
    AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found or already processing');
  END IF;
  
  -- Update status to processing
  UPDATE batch_job_queue
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Process each order
  FOR v_order_id IN 
    SELECT jsonb_array_elements_text(v_job.job_data->'order_ids')::UUID
  LOOP
    BEGIN
      v_processed := v_processed + 1;
      
      -- Create invoice
      v_invoice_id := create_invoice_from_sales_order_sql(v_order_id, v_job.organization_id);
      
      v_successful := v_successful + 1;
      
      -- Update progress every 10 items
      IF v_processed % 10 = 0 THEN
        UPDATE batch_job_queue
        SET 
          processed_items = v_processed,
          successful_items = v_successful,
          failed_items = v_failed,
          updated_at = NOW()
        WHERE id = p_job_id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'order_id', v_order_id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Final update
  UPDATE batch_job_queue
  SET 
    status = CASE WHEN v_failed > 0 THEN 'completed_with_errors' ELSE 'completed' END,
    completed_at = NOW(),
    updated_at = NOW(),
    processed_items = v_processed,
    successful_items = v_successful,
    failed_items = v_failed,
    errors = v_errors,
    actual_duration_seconds = EXTRACT(EPOCH FROM (NOW() - v_start_time))::INTEGER
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'processed', v_processed,
    'successful', v_successful,
    'failed', v_failed,
    'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))::INTEGER,
    'errors', v_errors
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Mark job as failed
  UPDATE batch_job_queue
  SET 
    status = 'failed',
    completed_at = NOW(),
    updated_at = NOW(),
    last_error = SQLERRM,
    actual_duration_seconds = EXTRACT(EPOCH FROM (NOW() - v_start_time))::INTEGER
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'success', false,
    'job_id', p_job_id,
    'error', SQLERRM
  );
END;
$$;

-- Function 3: Trigger batch processing (Called by pg_cron)
CREATE OR REPLACE FUNCTION trigger_batch_invoice_processing()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_result JSONB;
  v_jobs_processed INTEGER := 0;
BEGIN
  -- Process up to 5 pending jobs per cron run
  FOR v_job_id IN 
    SELECT id 
    FROM batch_job_queue
    WHERE status = 'pending'
      AND job_type = 'batch_invoice_orders'
    ORDER BY created_at ASC
    LIMIT 5
  LOOP
    -- Process the job
    SELECT process_bulk_invoice_job_sql(v_job_id) INTO v_result;
    v_jobs_processed := v_jobs_processed + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'jobs_processed', v_jobs_processed,
    'timestamp', NOW()
  );
END;
$$;

-- Update pg_cron job to call the new PostgreSQL function
SELECT cron.unschedule(1); -- Remove old job

SELECT cron.schedule(
  'process-batch-invoices',
  '* * * * *', -- Every minute
  $$SELECT trigger_batch_invoice_processing();$$
);

-- Keep the cleanup job (update if needed)
DO $$
BEGIN
  -- Check if job 5 exists and is the cleanup job
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 5) THEN
    -- Update it to use the PostgreSQL function if it exists
    PERFORM cron.unschedule(5);
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-stuck-batch-jobs',
  '*/10 * * * *', -- Every 10 minutes
  $$SELECT cleanup_stuck_batch_jobs();$$
);

COMMENT ON FUNCTION create_invoice_from_sales_order_sql IS 'Creates an invoice from a sales order with atomic sequential numbering';
COMMENT ON FUNCTION process_bulk_invoice_job_sql IS 'Processes a bulk invoice job from the batch_job_queue';
COMMENT ON FUNCTION trigger_batch_invoice_processing IS 'Cron handler that processes pending batch invoice jobs';
