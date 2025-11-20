-- Clear the stuck session so we can retry with the new batch size
UPDATE qbo_sync_sessions
SET status = 'failed',
    error_message = 'Cleared - batch size was too large (1000), retrying with smaller batches (100)',
    completed_at = NOW()
WHERE id = 'f0c63ea2-fc4f-47c5-a4c3-b585805cd3c3';