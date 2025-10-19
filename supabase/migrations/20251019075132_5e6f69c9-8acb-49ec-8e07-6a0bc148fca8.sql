
-- Enable realtime for batch_job_queue table to get instant progress updates
ALTER TABLE batch_job_queue REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE batch_job_queue;
