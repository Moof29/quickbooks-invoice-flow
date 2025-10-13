-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to process batch jobs every minute
SELECT cron.schedule(
  'process-batch-jobs-every-minute',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url:='https://pnqcbnmrfzqihymmzhkb.supabase.co/functions/v1/process-batch-jobs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MzU4NjUsImV4cCI6MjA2MDQxMTg2NX0.YFTBTCDsFtrYU1WqqpFg1STecxlGF_28G7cP4vRHVCQ"}'::jsonb
  ) AS request_id;
  $$
);

-- Verify cron job was created
SELECT * FROM cron.job WHERE jobname = 'process-batch-jobs-every-minute';