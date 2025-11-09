-- Migration: Enhance Customer table for order-taking and credit management
-- Purpose: Add critical fields for managing billing, credit terms, and payment tracking
-- Date: 2025-11-09

-- ==============================================================================
-- STEP 1: Add payment terms and credit management
-- ==============================================================================

-- Payment terms (Net 30, Net 15, Due on receipt, etc.)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- Payment terms reference (QBO format)
-- Format: {"value": "123", "name": "Net 30"}
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS payment_terms_ref JSONB;

-- Credit limit for the customer
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2);

-- Credit hold flag (stop new orders if true)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS credit_hold BOOLEAN DEFAULT false;

-- Reason for credit hold
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS credit_hold_reason TEXT;

-- ==============================================================================
-- STEP 2: Add shipping information
-- ==============================================================================

-- Shipping address (separate from billing)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_address_line1 VARCHAR(255);

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_address_line2 VARCHAR(255);

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100);

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(50);

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20);

ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(50) DEFAULT 'USA';

-- Preferred shipping method
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS preferred_shipping_method TEXT;

-- ==============================================================================
-- STEP 3: Add tax configuration
-- ==============================================================================

-- Tax ID / EIN
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);

-- Tax exempt flag
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT false;

-- Tax exemption reason code
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS tax_exempt_reason TEXT;

-- Tax exemption certificate number
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS tax_exempt_cert_number VARCHAR(100);

-- Sales tax code reference
-- Format: {"value": "123", "name": "CA-TAX"}
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS sales_tax_code_ref JSONB;

-- ==============================================================================
-- STEP 4: Add customer contact information
-- ==============================================================================

-- Primary contact person name
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);

-- Contact title/position
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS contact_title VARCHAR(100);

-- Mobile phone
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(20);

-- Fax number
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS fax_number VARCHAR(20);

-- Website
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ==============================================================================
-- STEP 5: Add pricing and billing preferences
-- ==============================================================================

-- Price level reference (for customer-specific pricing)
-- Format: {"value": "123", "name": "Wholesale"}
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS price_level_ref JSONB;

-- Preferred delivery method for invoices
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS invoice_delivery_method TEXT DEFAULT 'email';

-- Check constraint for invoice delivery method
ALTER TABLE customer_profile
  ADD CONSTRAINT invoice_delivery_check
  CHECK (invoice_delivery_method IN ('email', 'mail', 'portal', 'none'));

-- Currency preference (for multi-currency support)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'USD';

-- ==============================================================================
-- STEP 6: Add customer classification
-- ==============================================================================

-- Customer type/category
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS customer_type TEXT;

-- Customer class reference
-- Format: {"value": "123", "name": "Wholesale"}
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS customer_class_ref JSONB;

-- Account number (customer's reference number)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);

-- ==============================================================================
-- STEP 7: Add payment tracking fields
-- ==============================================================================

-- Last payment date
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS last_payment_date DATE;

-- Last payment amount
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS last_payment_amount NUMERIC(10,2);

-- Total amount overdue
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS overdue_balance NUMERIC(12,2) DEFAULT 0;

-- Days past due (computed or updated by trigger)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS days_past_due INTEGER DEFAULT 0;

-- ==============================================================================
-- STEP 8: Add notes and internal use fields
-- ==============================================================================

-- Internal notes (not visible to customer)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Customer notes (may be visible on documents)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Special billing instructions
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS billing_instructions TEXT;

-- ==============================================================================
-- STEP 9: Add recurring billing support
-- ==============================================================================

-- Billing frequency (daily, weekly, monthly, etc.)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS billing_frequency TEXT;

-- Check constraint for billing frequency
ALTER TABLE customer_profile
  ADD CONSTRAINT billing_frequency_check
  CHECK (billing_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'custom', NULL));

-- Preferred billing day (day of week or day of month)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS preferred_billing_day INTEGER;

-- Auto-generate invoices flag
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS auto_invoice BOOLEAN DEFAULT false;

-- ==============================================================================
-- STEP 10: Add QBO relationship fields
-- ==============================================================================

-- Parent customer reference (for hierarchical customers)
-- Format: {"value": "123", "name": "Parent Company"}
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS parent_ref JSONB;

-- Job flag (customer is a job/sub-customer)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS is_job BOOLEAN DEFAULT false;

-- Job type (if this is a job)
ALTER TABLE customer_profile
  ADD COLUMN IF NOT EXISTS job_type TEXT;

-- ==============================================================================
-- STEP 11: Create indexes for performance
-- ==============================================================================

-- Index for credit hold customers
CREATE INDEX IF NOT EXISTS idx_customer_credit_hold
  ON customer_profile(organization_id, credit_hold)
  WHERE credit_hold = true AND is_active = true;

-- Index for overdue customers
CREATE INDEX IF NOT EXISTS idx_customer_overdue
  ON customer_profile(organization_id, overdue_balance, days_past_due)
  WHERE overdue_balance > 0 AND is_active = true;

-- Index for tax exempt customers
CREATE INDEX IF NOT EXISTS idx_customer_tax_exempt
  ON customer_profile(organization_id, tax_exempt)
  WHERE tax_exempt = true AND is_active = true;

-- Index for customer type/classification
CREATE INDEX IF NOT EXISTS idx_customer_type
  ON customer_profile(organization_id, customer_type)
  WHERE customer_type IS NOT NULL AND is_active = true;

-- Index for billing frequency
CREATE INDEX IF NOT EXISTS idx_customer_billing_frequency
  ON customer_profile(organization_id, billing_frequency)
  WHERE billing_frequency IS NOT NULL AND auto_invoice = true;

-- Index for account number lookups
CREATE INDEX IF NOT EXISTS idx_customer_account_number
  ON customer_profile(organization_id, account_number)
  WHERE account_number IS NOT NULL;

-- Composite index for shipping address lookups
CREATE INDEX IF NOT EXISTS idx_customer_shipping_location
  ON customer_profile(shipping_city, shipping_state)
  WHERE shipping_city IS NOT NULL AND is_active = true;

-- ==============================================================================
-- STEP 12: Add helpful comments
-- ==============================================================================

COMMENT ON COLUMN customer_profile.payment_terms IS
  'Payment terms: Net 30, Net 15, Due on receipt, 2/10 Net 30, etc.';

COMMENT ON COLUMN customer_profile.credit_limit IS
  'Maximum credit limit for this customer';

COMMENT ON COLUMN customer_profile.credit_hold IS
  'If true, prevent new orders until resolved';

COMMENT ON COLUMN customer_profile.tax_exempt IS
  'If true, customer is exempt from sales tax';

COMMENT ON COLUMN customer_profile.price_level_ref IS
  'Customer-specific pricing level - format: {"value": "123", "name": "Wholesale"}';

COMMENT ON COLUMN customer_profile.invoice_delivery_method IS
  'How to deliver invoices: email, mail, portal, none';

COMMENT ON COLUMN customer_profile.billing_frequency IS
  'How often to bill: daily, weekly, monthly, etc.';

COMMENT ON COLUMN customer_profile.auto_invoice IS
  'Automatically generate invoices based on billing frequency';

COMMENT ON COLUMN customer_profile.overdue_balance IS
  'Total amount currently overdue';

COMMENT ON COLUMN customer_profile.days_past_due IS
  'Number of days the oldest invoice is past due';

COMMENT ON COLUMN customer_profile.internal_notes IS
  'Internal notes - not visible to customer';

COMMENT ON COLUMN customer_profile.billing_instructions IS
  'Special instructions for billing this customer';
