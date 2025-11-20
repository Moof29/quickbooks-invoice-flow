
-- Clear the current session so it can restart with optimizations
UPDATE qbo_sync_sessions
SET status = 'failed',
    error_message = 'Stopped for performance optimization - restart will be faster',
    updated_at = NOW()
WHERE id = 'b2319961-440a-4d26-b7bf-325c792195f1'
  AND entity_type = 'invoice'
  AND organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';
