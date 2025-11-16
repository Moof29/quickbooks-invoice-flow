-- Migration: Add Missing QuickBooks Customer Fields
-- Purpose: Add fields required for complete QB Customer API sync (Task 1.1)
-- Date: 2025-11-13

-- ==============================================================================
-- Add missing customer name fields
-- ==============================================================================

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- ==============================================================================
-- Add shipping address fields (separate from billing address)
-- ==============================================================================

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_city TEXT;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_state TEXT;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_country TEXT;

-- ==============================================================================
-- Add balance and financial tracking fields
-- ==============================================================================

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS open_balance_date DATE;

COMMENT ON COLUMN customer_profile.open_balance_date IS
  'Starting balance date for customer account';

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS balance_with_jobs NUMERIC(12,2);

COMMENT ON COLUMN customer_profile.balance_with_jobs IS
  'Balance including sub-customers/jobs (QB hierarchy feature)';

-- ==============================================================================
-- Add resale and billing configuration
-- ==============================================================================

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS resale_number TEXT;

COMMENT ON COLUMN customer_profile.resale_number IS
  'Resale certificate number for tax-exempt customers';

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS bill_with_parent BOOLEAN DEFAULT false;

COMMENT ON COLUMN customer_profile.bill_with_parent IS
  'If true, bill this sub-customer with parent customer (consolidated billing)';

-- ==============================================================================
-- Add QB sync status fields (if not exists)
-- ==============================================================================

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS qbo_sync_status TEXT DEFAULT 'not_synced';

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS qbo_created_at TIMESTAMPTZ;

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS qbo_updated_at TIMESTAMPTZ;

-- ==============================================================================
-- Add unique constraint for QB sync (if not exists)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_profile_org_qbo_unique'
  ) THEN
    ALTER TABLE customer_profile
      ADD CONSTRAINT customer_profile_org_qbo_unique
      UNIQUE (organization_id, qbo_id);
  END IF;
END $$;

-- ==============================================================================
-- Create indexes for performance
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_qbo_sync_status
  ON customer_profile(organization_id, qbo_sync_status)
  WHERE qbo_sync_status != 'synced';

CREATE INDEX IF NOT EXISTS idx_customer_qbo_updated_at
  ON customer_profile(organization_id, qbo_updated_at DESC)
  WHERE qbo_id IS NOT NULL;

-- ==============================================================================
-- ROLLBACK SCRIPT (for reference)
-- ==============================================================================

/*
-- To rollback this migration, run:

ALTER TABLE customer_profile DROP COLUMN IF EXISTS first_name;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS last_name;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS shipping_address_line1;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS shipping_address_line2;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS shipping_city;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS shipping_state;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS shipping_postal_code;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS shipping_country;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS open_balance_date;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS balance_with_jobs;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS resale_number;
ALTER TABLE customer_profile DROP COLUMN IF EXISTS bill_with_parent;

DROP INDEX IF EXISTS idx_customer_qbo_sync_status;
DROP INDEX IF EXISTS idx_customer_qbo_updated_at;

-- Note: Do NOT drop qbo_sync_status, last_sync_at, etc. if they were added by previous migrations
*/
