-- Add UNIQUE constraint on (organization_id, qbo_id) for invoice_record
-- to support upsert(..., { onConflict: 'organization_id,qbo_id' }) used in qbo-sync-invoices.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_record_org_qbo_id_unique'
  ) THEN
    ALTER TABLE public.invoice_record
    ADD CONSTRAINT invoice_record_org_qbo_id_unique
    UNIQUE (organization_id, qbo_id);
  END IF;
END;
$$;