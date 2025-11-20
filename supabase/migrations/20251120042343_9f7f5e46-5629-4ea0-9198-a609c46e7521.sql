
-- Clear the stuck session so user can start fresh
UPDATE qbo_sync_sessions
SET status = 'failed',
    error_message = 'Deadlock cleared - safe concurrent sync protection added',
    updated_at = NOW()
WHERE entity_type = 'invoice'
  AND status = 'in_progress'
  AND organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';
