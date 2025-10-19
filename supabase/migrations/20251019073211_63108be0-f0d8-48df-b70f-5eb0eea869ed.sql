-- Modify process_bulk_invoice_job_sql to process in chunks of 50
DROP FUNCTION IF EXISTS process_bulk_invoice_job_sql(UUID);

CREATE OR REPLACE FUNCTION process_bulk_invoice_job_sql(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_order_ids UUID[];
  v_order_id UUID;
  v_invoice_id UUID;
  v_successful INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_chunk_size INTEGER := 50;
  v_processed_so_far INTEGER := 0;
  v_chunk_start INTEGER := 1;
  v_chunk_end INTEGER;
  v_total_orders INTEGER;
BEGIN
  -- Get the job
  SELECT * INTO v_job
  FROM batch_job_queue
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  -- Extract order IDs from job_data
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_job.job_data->'order_ids'))::UUID[]
  INTO v_order_ids;
  
  v_total_orders := array_length(v_order_ids, 1);
  
  -- Update job to processing if not already
  IF v_job.status = 'pending' THEN
    UPDATE batch_job_queue
    SET 
      status = 'processing',
      started_at = NOW(),
      updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
  
  -- Get already processed count (for resume capability)
  v_processed_so_far := COALESCE(v_job.processed_items, 0);
  
  -- Process in chunks of 50
  WHILE v_processed_so_far < v_total_orders LOOP
    v_chunk_start := v_processed_so_far + 1;
    v_chunk_end := LEAST(v_processed_so_far + v_chunk_size, v_total_orders);
    
    -- Process this chunk
    FOR i IN v_chunk_start..v_chunk_end LOOP
      v_order_id := v_order_ids[i];
      
      BEGIN
        -- Create invoice for this order
        SELECT create_invoice_from_sales_order_sql(v_order_id, v_job.organization_id, v_job.created_by)
        INTO v_invoice_id;
        
        v_successful := v_successful + 1;
        
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_object(
          'order_id', v_order_id,
          'error', SQLERRM,
          'sqlstate', SQLSTATE
        );
      END;
    END LOOP;
    
    -- Update progress after each chunk
    v_processed_so_far := v_chunk_end;
    
    UPDATE batch_job_queue
    SET 
      processed_items = v_processed_so_far,
      successful_items = v_successful,
      failed_items = v_failed,
      errors = v_errors,
      updated_at = NOW()
    WHERE id = p_job_id;
    
    -- Short pause between chunks (helps with connection pooling)
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  -- Mark job as completed
  UPDATE batch_job_queue
  SET 
    status = CASE WHEN v_failed > 0 THEN 'completed_with_errors' ELSE 'completed' END,
    completed_at = NOW(),
    updated_at = NOW(),
    processed_items = v_total_orders,
    successful_items = v_successful,
    failed_items = v_failed,
    errors = v_errors,
    actual_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'total_orders', v_total_orders,
    'successful', v_successful,
    'failed', v_failed,
    'errors', v_errors
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Mark job as failed
  UPDATE batch_job_queue
  SET 
    status = 'failed',
    last_error = SQLERRM,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'success', false,
    'job_id', p_job_id,
    'error', SQLERRM,
    'processed', v_processed_so_far,
    'successful', v_successful,
    'failed', v_failed
  );
END;
$$;

COMMENT ON FUNCTION process_bulk_invoice_job_sql IS 'Processes bulk invoice jobs in chunks of 50 orders to avoid timeouts';