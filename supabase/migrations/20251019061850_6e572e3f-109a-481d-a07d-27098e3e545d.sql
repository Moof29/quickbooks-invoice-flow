-- Fix batch_job_queue status constraint and reset failed job

-- Drop old constraint if exists
ALTER TABLE batch_job_queue DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with all valid statuses
ALTER TABLE batch_job_queue ADD CONSTRAINT valid_status 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'completed_with_errors'));

-- Reset the failed job to pending so it can be reprocessed
UPDATE batch_job_queue
SET 
  status = 'pending',
  last_error = NULL,
  started_at = NULL,
  completed_at = NULL
WHERE id = '7e5e1cfb-bf33-4269-b067-ffa533122a15';

COMMENT ON CONSTRAINT valid_status ON batch_job_queue IS 'Ensures status is one of the valid batch job states';