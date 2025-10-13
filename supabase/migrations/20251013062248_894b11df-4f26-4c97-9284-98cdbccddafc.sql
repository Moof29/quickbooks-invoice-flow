-- Phase 1: Add missing columns to batch_job_queue for better tracking
ALTER TABLE batch_job_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS progress_log JSONB,
ADD COLUMN IF NOT EXISTS can_cancel BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_batch_job_queue_status ON batch_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_batch_job_queue_org_status ON batch_job_queue(organization_id, status);

-- Update the update_batch_job_progress function to handle new fields
CREATE OR REPLACE FUNCTION update_batch_job_progress(
  p_job_id UUID,
  p_processed INTEGER,
  p_successful INTEGER,
  p_failed INTEGER,
  p_errors JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE batch_job_queue
  SET 
    processed_items = p_processed,
    successful_items = p_successful,
    failed_items = p_failed,
    errors = COALESCE(p_errors, errors),
    progress_log = COALESCE(progress_log, '[]'::jsonb) || jsonb_build_object(
      'timestamp', now(),
      'processed', p_processed,
      'successful', p_successful,
      'failed', p_failed
    ),
    updated_at = now(),
    status = CASE 
      WHEN p_processed >= total_items THEN 'completed'
      ELSE 'processing'
    END,
    completed_at = CASE 
      WHEN p_processed >= total_items THEN now()
      ELSE completed_at
    END,
    actual_duration_seconds = CASE
      WHEN p_processed >= total_items AND started_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
      ELSE actual_duration_seconds
    END
  WHERE id = p_job_id;
END;
$$;

-- Add function to cancel a job
CREATE OR REPLACE FUNCTION cancel_batch_job(
  p_job_id UUID,
  p_cancelled_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE batch_job_queue
  SET 
    status = 'cancelled',
    cancelled_by = p_cancelled_by,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_job_id 
    AND status IN ('pending', 'processing')
    AND can_cancel = true;
END;
$$;