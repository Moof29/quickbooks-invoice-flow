-- Migration: Enhance Payment tracking for QBO sync and reconciliation
-- Purpose: Add critical fields for tracking what is paid and synchronizing with QuickBooks
-- Date: 2025-11-09

-- ==============================================================================
-- STEP 1: Add QBO sync fields (CRITICAL - currently missing)
-- ==============================================================================

-- QuickBooks Payment ID
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS qbo_id TEXT;

-- QBO sync status (synced, pending, failed, not_synced)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS qbo_sync_status TEXT DEFAULT 'not_synced';

-- QBO sync token for optimistic locking
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER;

-- Last sync timestamp
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- QBO creation and update timestamps
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS qbo_created_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS qbo_updated_at TIMESTAMP WITH TIME ZONE;

-- ==============================================================================
-- STEP 2: Add deposit account reference
-- ==============================================================================

-- Deposit account reference (where payment was deposited)
-- Format: {"value": "123", "name": "Checking Account"}
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS deposit_account_ref JSONB;

-- ==============================================================================
-- STEP 3: Add payment gateway/processor fields
-- ==============================================================================

-- Payment processor (stripe, square, paypal, etc.)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS payment_processor TEXT;

-- Payment processor transaction ID
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS processor_transaction_id TEXT;

-- Payment processor fee
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS processor_fee NUMERIC(10,2);

-- Net amount received (amount - processor_fee)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2);

-- ==============================================================================
-- STEP 4: Add unapplied payment support
-- ==============================================================================

-- Flag for unapplied payments (payments not yet linked to invoice)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS unapplied BOOLEAN DEFAULT false;

-- Original unapplied amount (for tracking partial applications)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS unapplied_amount NUMERIC(10,2);

-- ==============================================================================
-- STEP 5: Add payment status tracking
-- ==============================================================================

-- Payment status (completed, pending, failed, reversed, refunded)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed';

-- Check constraint for payment_status
ALTER TABLE invoice_payment
  ADD CONSTRAINT payment_status_check
  CHECK (payment_status IN ('completed', 'pending', 'failed', 'reversed', 'refunded', 'disputed'));

-- Check constraint for qbo_sync_status
ALTER TABLE invoice_payment
  ADD CONSTRAINT qbo_sync_status_check
  CHECK (qbo_sync_status IN ('synced', 'pending', 'failed', 'not_synced'));

-- ==============================================================================
-- STEP 6: Add reversal/refund tracking
-- ==============================================================================

-- If this payment reverses another payment
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS reverses_payment_id UUID REFERENCES invoice_payment(id);

-- Reason for reversal or refund
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Refund amount (if partial refund)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2);

-- Refund date
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS refund_date DATE;

-- ==============================================================================
-- STEP 7: Add reconciliation fields
-- ==============================================================================

-- Bank reconciliation status
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreconciled';

-- Bank reconciliation date
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- Bank reconciliation reference
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS reconciliation_ref TEXT;

-- Check constraint for reconciliation_status
ALTER TABLE invoice_payment
  ADD CONSTRAINT reconciliation_status_check
  CHECK (reconciliation_status IN ('unreconciled', 'reconciled', 'voided'));

-- ==============================================================================
-- STEP 8: Add receipt/attachment support
-- ==============================================================================

-- Receipt file path or URL
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Receipt file name
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS receipt_filename TEXT;

-- ==============================================================================
-- STEP 9: Expand payment method options
-- ==============================================================================

-- Update default payment_method to be more descriptive
COMMENT ON COLUMN invoice_payment.payment_method IS
  'Payment method: cash, check, credit_card, debit_card, ach, wire_transfer, paypal, stripe, other';

-- ==============================================================================
-- STEP 10: Add customer reference for direct tracking
-- ==============================================================================

-- Customer reference (useful for unapplied payments)
ALTER TABLE invoice_payment
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customer_profile(id);

-- ==============================================================================
-- STEP 11: Create unique constraint for QBO sync
-- ==============================================================================

-- Ensure we don't duplicate QBO payments
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_org_qbo_unique
  ON invoice_payment(organization_id, qbo_id)
  WHERE qbo_id IS NOT NULL;

-- ==============================================================================
-- STEP 12: Create indexes for performance
-- ==============================================================================

-- Index for QBO sync operations
CREATE INDEX IF NOT EXISTS idx_payment_qbo_sync_status
  ON invoice_payment(organization_id, qbo_sync_status)
  WHERE qbo_sync_status != 'synced';

-- Index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation
  ON invoice_payment(organization_id, reconciliation_status, payment_date)
  WHERE reconciliation_status = 'unreconciled';

-- Index for payment processor lookups
CREATE INDEX IF NOT EXISTS idx_payment_processor
  ON invoice_payment(payment_processor, processor_transaction_id)
  WHERE payment_processor IS NOT NULL;

-- Index for unapplied payments
CREATE INDEX IF NOT EXISTS idx_payment_unapplied
  ON invoice_payment(organization_id, customer_id)
  WHERE unapplied = true;

-- Index for payment status tracking
CREATE INDEX IF NOT EXISTS idx_payment_status
  ON invoice_payment(organization_id, payment_status, payment_date);

-- Index for customer payments
CREATE INDEX IF NOT EXISTS idx_payment_customer
  ON invoice_payment(customer_id, payment_date DESC)
  WHERE customer_id IS NOT NULL;

-- ==============================================================================
-- STEP 13: Add helpful comments
-- ==============================================================================

COMMENT ON COLUMN invoice_payment.qbo_id IS
  'QuickBooks Payment transaction ID';

COMMENT ON COLUMN invoice_payment.deposit_account_ref IS
  'Account where payment was deposited - format: {"value": "123", "name": "Checking"}';

COMMENT ON COLUMN invoice_payment.unapplied IS
  'True if payment not yet applied to an invoice (advance payment)';

COMMENT ON COLUMN invoice_payment.payment_status IS
  'Status: completed, pending, failed, reversed, refunded, disputed';

COMMENT ON COLUMN invoice_payment.reconciliation_status IS
  'Bank reconciliation status: unreconciled, reconciled, voided';

COMMENT ON COLUMN invoice_payment.processor_fee IS
  'Payment gateway processing fee';

COMMENT ON COLUMN invoice_payment.net_amount IS
  'Net amount received after processor fees';
