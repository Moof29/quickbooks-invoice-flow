-- Ensure invoice upserts can target organization/qbo combinations
ALTER TABLE public.invoice_record
ADD CONSTRAINT IF NOT EXISTS invoice_record_org_qbo_unique
UNIQUE (organization_id, qbo_id);
