-- Update existing QuickBooks items to have correct source_system
UPDATE item_record 
SET source_system = 'QBO',
    updated_at = now()
WHERE qbo_id IS NOT NULL 
  AND (source_system IS NULL OR source_system = 'ERP')
  AND organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6';

-- Add helpful comment
COMMENT ON COLUMN item_record.source_system IS 'Source system: ERP (created in Batchly) or QBO (synced from QuickBooks)';