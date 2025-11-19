-- Align invoice schema with QuickBooks invoice payloads and enforce deduplicated keys
BEGIN;

-- Remove duplicate invoice records that would prevent unique constraints
WITH ranked_invoices AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, qbo_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM public.invoice_record
  WHERE qbo_id IS NOT NULL
)
DELETE FROM public.invoice_record
WHERE id IN (
  SELECT id FROM ranked_invoices WHERE rn > 1
);

-- Rebuild the unique constraint to ensure ON CONFLICT works reliably
ALTER TABLE public.invoice_record
  DROP CONSTRAINT IF EXISTS invoice_record_org_qbo_unique;

ALTER TABLE public.invoice_record
  ADD CONSTRAINT invoice_record_org_qbo_unique
  UNIQUE (organization_id, qbo_id);

-- Add richer QuickBooks specific metadata to invoice_record
ALTER TABLE public.invoice_record
  ADD COLUMN IF NOT EXISTS qbo_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS qbo_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency_code varchar(3) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(10,6),
  ADD COLUMN IF NOT EXISTS terms_ref jsonb,
  ADD COLUMN IF NOT EXISTS billing_address jsonb,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb,
  ADD COLUMN IF NOT EXISTS txn_tax_detail jsonb;

COMMENT ON COLUMN public.invoice_record.qbo_created_at IS 'QuickBooks MetaData.CreateTime';
COMMENT ON COLUMN public.invoice_record.qbo_updated_at IS 'QuickBooks MetaData.LastUpdatedTime';
COMMENT ON COLUMN public.invoice_record.currency_code IS 'QuickBooks CurrencyRef value';
COMMENT ON COLUMN public.invoice_record.exchange_rate IS 'QuickBooks exchange rate when invoice was created';
COMMENT ON COLUMN public.invoice_record.terms_ref IS 'QuickBooks SalesTermRef payload (JSON)';
COMMENT ON COLUMN public.invoice_record.billing_address IS 'QuickBooks BillAddr payload (JSON)';
COMMENT ON COLUMN public.invoice_record.shipping_address IS 'QuickBooks ShipAddr payload (JSON)';
COMMENT ON COLUMN public.invoice_record.txn_tax_detail IS 'QuickBooks TxnTaxDetail payload (JSON)';

-- Ensure invoice line items have deterministic upsert keys
WITH ranked_line_items AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY invoice_id, position
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM public.invoice_line_item
  WHERE invoice_id IS NOT NULL
    AND position IS NOT NULL
)
DELETE FROM public.invoice_line_item
WHERE id IN (
  SELECT id FROM ranked_line_items WHERE rn > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_line_item_invoice_position_unique'
  ) THEN
    ALTER TABLE public.invoice_line_item
      ADD CONSTRAINT invoice_line_item_invoice_position_unique
      UNIQUE (invoice_id, position);
  END IF;
END $$;

COMMIT;
