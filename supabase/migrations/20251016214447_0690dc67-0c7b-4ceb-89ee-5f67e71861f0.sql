-- Create a function to manually process all pending batch jobs
-- This is useful for clearing the backlog
CREATE OR REPLACE FUNCTION public.process_all_pending_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job RECORD;
  v_result JSONB;
  v_total_processed INTEGER := 0;
  v_total_successful INTEGER := 0;
  v_total_failed INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
BEGIN
  -- Process up to 100 pending jobs
  FOR v_job IN 
    SELECT id, job_type, organization_id, payload
    FROM batch_processing_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Update status to processing
      UPDATE batch_processing_queue
      SET status = 'processing', started_at = NOW(), updated_at = NOW()
      WHERE id = v_job.id;
      
      -- Process based on job type
      IF v_job.job_type = 'invoice_generation' THEN
        SELECT process_invoice_batch(v_job.payload) INTO v_result;
        
        -- Update job as completed
        UPDATE batch_processing_queue
        SET 
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW(),
          result = v_result
        WHERE id = v_job.id;
        
        v_total_processed := v_total_processed + 1;
        v_total_successful := v_total_successful + (v_result->>'batch_successful')::INTEGER;
        v_total_failed := v_total_failed + (v_result->>'batch_failed')::INTEGER;
        
        v_results := v_results || jsonb_build_object(
          'job_id', v_job.id,
          'result', v_result
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Mark job as failed
      UPDATE batch_processing_queue
      SET 
        status = 'failed',
        error_message = SQLERRM,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = v_job.id;
      
      v_total_processed := v_total_processed + 1;
      v_total_failed := v_total_failed + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_processed', v_total_processed,
    'total_successful', v_total_successful,
    'total_failed', v_total_failed,
    'results', v_results
  );
END;
$$;