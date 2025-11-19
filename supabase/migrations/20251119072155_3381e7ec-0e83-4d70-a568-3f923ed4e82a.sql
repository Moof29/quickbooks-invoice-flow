-- Add qbo_sync_token column to invoice_record table
-- This column stores QuickBooks' SyncToken for update conflict detection
ALTER TABLE public.invoice_record 
ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN public.invoice_record.qbo_sync_token IS 'QuickBooks SyncToken for optimistic locking during updates';

-- Create index for faster lookups when syncing
CREATE INDEX IF NOT EXISTS idx_invoice_record_qbo_sync_token 
ON public.invoice_record(qbo_sync_token) 
WHERE qbo_id IS NOT NULL;