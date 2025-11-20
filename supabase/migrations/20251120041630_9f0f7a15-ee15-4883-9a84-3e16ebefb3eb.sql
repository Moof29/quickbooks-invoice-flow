
-- Drop the invoice_number unique constraint that's blocking sync
-- qbo_id is the real unique identifier from QuickBooks
ALTER TABLE invoice_record 
DROP CONSTRAINT IF EXISTS unique_invoice_number;

-- Clear stuck sync sessions so they can be restarted
UPDATE qbo_sync_sessions
SET status = 'failed',
    error_message = 'Cleared stuck session - duplicate invoice_number constraint removed',
    updated_at = NOW()
WHERE entity_type = 'invoice'
  AND status = 'in_progress'
  AND organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';

-- Add index for performance on invoice_number lookups (non-unique)
CREATE INDEX IF NOT EXISTS idx_invoice_record_invoice_number 
ON invoice_record(organization_id, invoice_number);
