-- Fix foreign key constraint on batch_job_queue.created_by
-- It should reference profiles, not auth.users

-- Drop the existing foreign key constraint
ALTER TABLE batch_job_queue 
DROP CONSTRAINT IF EXISTS batch_job_queue_created_by_fkey;

-- Add new foreign key to profiles table instead
ALTER TABLE batch_job_queue
ADD CONSTRAINT batch_job_queue_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

COMMENT ON CONSTRAINT batch_job_queue_created_by_fkey ON batch_job_queue 
IS 'Foreign key to profiles table (not auth.users)';