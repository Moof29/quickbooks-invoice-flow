-- Update batch processing cron to run every 10 seconds instead of every minute
-- This reduces user wait time from up to 60 seconds to up to 10 seconds

SELECT cron.unschedule('process-batch-invoices');

SELECT cron.schedule(
  'process-batch-invoices',
  '*/10 * * * * *', -- Every 10 seconds (note: 6 fields for seconds support)
  $$SELECT trigger_batch_invoice_processing();$$
);