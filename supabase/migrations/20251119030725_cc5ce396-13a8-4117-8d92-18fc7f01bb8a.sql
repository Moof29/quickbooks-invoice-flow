-- Add missing QuickBooks Customer fields to customer_profile table
-- These fields are part of the QB Customer API and needed for proper sync

-- Financial fields
ALTER TABLE customer_profile 
ADD COLUMN IF NOT EXISTS balance_with_jobs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_balance_date date,
ADD COLUMN IF NOT EXISTS resale_number character varying;

-- Hierarchy and relationship fields  
ALTER TABLE customer_profile
ADD COLUMN IF NOT EXISTS bill_with_parent boolean DEFAULT false;

-- QuickBooks sync metadata
ALTER TABLE customer_profile
ADD COLUMN IF NOT EXISTS qbo_sync_token integer,
ADD COLUMN IF NOT EXISTS qbo_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS qbo_updated_at timestamp with time zone;

-- Create indexes for commonly queried QB fields
CREATE INDEX IF NOT EXISTS idx_customer_profile_qbo_sync_token ON customer_profile(qbo_sync_token);
CREATE INDEX IF NOT EXISTS idx_customer_profile_balance_with_jobs ON customer_profile(balance_with_jobs);

-- Add comment explaining QB-specific fields
COMMENT ON COLUMN customer_profile.balance_with_jobs IS 'Total balance including sub-customer/job balances from QuickBooks';
COMMENT ON COLUMN customer_profile.open_balance_date IS 'Date of the opening balance from QuickBooks';
COMMENT ON COLUMN customer_profile.resale_number IS 'Resale/tax exemption number from QuickBooks';
COMMENT ON COLUMN customer_profile.bill_with_parent IS 'Whether to bill this customer with their parent customer in QuickBooks';
COMMENT ON COLUMN customer_profile.qbo_sync_token IS 'QuickBooks SyncToken for optimistic locking during updates';