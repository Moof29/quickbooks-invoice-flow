-- Migration: Enhance invoice_record table with comprehensive QuickBooks Online sync fields
-- Purpose: Add all necessary fields for bidirectional invoice synchronization with QBO
-- Date: 2025-11-09

-- ============================================================================
-- PART 1: Add QBO sync metadata fields
-- ============================================================================

ALTER TABLE invoice_record
  -- QBO sync token for optimistic locking (prevents concurrent update conflicts)
  ADD COLUMN IF NOT EXISTS qbo_sync_token TEXT,

  -- QBO timestamps (track when record was created/modified in QBO)
  ADD COLUMN IF NOT EXISTS qbo_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS qbo_updated_at TIMESTAMP WITH TIME ZONE,

  -- QBO document number (may differ from our invoice_number)
  ADD COLUMN IF NOT EXISTS qbo_doc_number TEXT,

  -- QBO transaction date (maps to invoice_date but kept separate for clarity)
  ADD COLUMN IF NOT EXISTS qbo_txn_date DATE;

COMMENT ON COLUMN invoice_record.qbo_sync_token IS
  'QuickBooks SyncToken for optimistic locking. Must be included in update requests to prevent conflicts.';
COMMENT ON COLUMN invoice_record.qbo_created_at IS
  'Timestamp when the invoice was created in QuickBooks Online.';
COMMENT ON COLUMN invoice_record.qbo_updated_at IS
  'Timestamp when the invoice was last updated in QuickBooks Online.';
COMMENT ON COLUMN invoice_record.qbo_doc_number IS
  'QuickBooks document number. May differ from invoice_number if custom numbering is used.';
COMMENT ON COLUMN invoice_record.qbo_txn_date IS
  'QuickBooks transaction date. Used for QB reporting and syncs with invoice_date.';

-- ============================================================================
-- PART 2: Add address fields (billing and shipping)
-- ============================================================================

ALTER TABLE invoice_record
  -- Billing address from QBO (JSONB for flexibility)
  ADD COLUMN IF NOT EXISTS billing_address JSONB,

  -- Shipping address from QBO
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,

  -- Ship-from address for drop shipping scenarios
  ADD COLUMN IF NOT EXISTS ship_from_address JSONB;

COMMENT ON COLUMN invoice_record.billing_address IS
  'Customer billing address in JSONB format. Schema: {line1, line2, city, state, postal_code, country, lat, long}';
COMMENT ON COLUMN invoice_record.shipping_address IS
  'Ship-to address in JSONB format. Schema: {line1, line2, city, state, postal_code, country, lat, long}';
COMMENT ON COLUMN invoice_record.ship_from_address IS
  'Ship-from address for drop shipping. Schema: {line1, line2, city, state, postal_code, country}';

-- ============================================================================
-- PART 3: Add invoice delivery and communication fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Email for invoice delivery
  ADD COLUMN IF NOT EXISTS bill_email TEXT,

  -- CC email addresses (comma-separated or JSON array)
  ADD COLUMN IF NOT EXISTS bill_email_cc TEXT,

  -- BCC email addresses
  ADD COLUMN IF NOT EXISTS bill_email_bcc TEXT,

  -- Print status tracking
  ADD COLUMN IF NOT EXISTS print_status TEXT DEFAULT 'NotSet'
    CHECK (print_status IN ('NotSet', 'NeedToPrint', 'PrintComplete')),

  -- Email status tracking
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'NotSet'
    CHECK (email_status IN ('NotSet', 'NeedToSend', 'EmailSent')),

  -- Private note (for internal use, not shown to customer)
  ADD COLUMN IF NOT EXISTS private_note TEXT;

COMMENT ON COLUMN invoice_record.bill_email IS
  'Primary email address for invoice delivery. Synced with customer email if not specified.';
COMMENT ON COLUMN invoice_record.bill_email_cc IS
  'CC email addresses for invoice delivery (comma-separated).';
COMMENT ON COLUMN invoice_record.bill_email_bcc IS
  'BCC email addresses for invoice delivery (comma-separated).';
COMMENT ON COLUMN invoice_record.print_status IS
  'QuickBooks print status: NotSet, NeedToPrint, or PrintComplete.';
COMMENT ON COLUMN invoice_record.email_status IS
  'QuickBooks email status: NotSet, NeedToSend, or EmailSent.';
COMMENT ON COLUMN invoice_record.private_note IS
  'Internal note visible only to company users, not shown on customer-facing invoice.';

-- ============================================================================
-- PART 4: Add payment terms and deposit fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Payment terms reference (links to QBO Terms entity)
  ADD COLUMN IF NOT EXISTS sales_term_ref JSONB,

  -- Deposit/prepayment amount
  ADD COLUMN IF NOT EXISTS deposit NUMERIC(15, 2) DEFAULT 0,

  -- Remaining balance after deposit
  ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(15, 2),

  -- Due date from QBO (may differ from our due_date if terms change)
  ADD COLUMN IF NOT EXISTS qbo_due_date DATE;

COMMENT ON COLUMN invoice_record.sales_term_ref IS
  'QuickBooks payment terms reference. Schema: {value (ID), name}. E.g., {"value": "3", "name": "Net 30"}';
COMMENT ON COLUMN invoice_record.deposit IS
  'Deposit or prepayment amount applied to this invoice.';
COMMENT ON COLUMN invoice_record.remaining_balance IS
  'Balance remaining after deposit. Calculated as total - deposit - amount_paid.';
COMMENT ON COLUMN invoice_record.qbo_due_date IS
  'Due date calculated by QuickBooks based on payment terms. May differ from due_date if manually overridden.';

-- ============================================================================
-- PART 5: Add tax calculation fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Tax calculation method
  ADD COLUMN IF NOT EXISTS apply_tax_after_discount BOOLEAN DEFAULT true,

  -- Global tax calculation method (for international)
  ADD COLUMN IF NOT EXISTS global_tax_calculation TEXT
    CHECK (global_tax_calculation IN ('TaxExcluded', 'TaxInclusive', 'NotApplicable')),

  -- Tax code reference (links to QBO TaxCode entity)
  ADD COLUMN IF NOT EXISTS txn_tax_code_ref JSONB,

  -- Tax rate as percentage
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4);

COMMENT ON COLUMN invoice_record.apply_tax_after_discount IS
  'If true, tax is calculated after applying discounts. If false, tax is calculated on pre-discount amount.';
COMMENT ON COLUMN invoice_record.global_tax_calculation IS
  'Tax calculation method: TaxExcluded (tax added to subtotal), TaxInclusive (tax included in line prices), NotApplicable.';
COMMENT ON COLUMN invoice_record.txn_tax_code_ref IS
  'Transaction-level tax code reference. Schema: {value (ID), name}. E.g., {"value": "TAX", "name": "Sales Tax"}';
COMMENT ON COLUMN invoice_record.tax_rate IS
  'Effective tax rate as decimal (e.g., 0.0825 for 8.25%).';

-- ============================================================================
-- PART 6: Add online payment fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Allow online payments
  ADD COLUMN IF NOT EXISTS allow_online_payment BOOLEAN DEFAULT false,

  -- Allow online credit card payments
  ADD COLUMN IF NOT EXISTS allow_online_credit_card_payment BOOLEAN DEFAULT false,

  -- Allow online ACH payments
  ADD COLUMN IF NOT EXISTS allow_online_ach_payment BOOLEAN DEFAULT false,

  -- Allow IPN (Instant Payment Notification) payments
  ADD COLUMN IF NOT EXISTS allow_ipn_payment BOOLEAN DEFAULT false;

COMMENT ON COLUMN invoice_record.allow_online_payment IS
  'If true, customer can pay this invoice online through QuickBooks Payments.';
COMMENT ON COLUMN invoice_record.allow_online_credit_card_payment IS
  'If true, customer can pay using credit/debit card online.';
COMMENT ON COLUMN invoice_record.allow_online_ach_payment IS
  'If true, customer can pay using ACH bank transfer online.';
COMMENT ON COLUMN invoice_record.allow_ipn_payment IS
  'If true, invoice is enabled for Instant Payment Notification.';

-- ============================================================================
-- PART 7: Add accounting and classification fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Department reference (for departmental accounting)
  ADD COLUMN IF NOT EXISTS department_ref JSONB,

  -- Class reference (for class tracking)
  ADD COLUMN IF NOT EXISTS class_ref JSONB,

  -- AR account reference (where receivable is recorded)
  ADD COLUMN IF NOT EXISTS ar_account_ref JSONB,

  -- Home balance (for multi-currency, amount in home currency)
  ADD COLUMN IF NOT EXISTS home_balance NUMERIC(15, 2),

  -- Home currency code
  ADD COLUMN IF NOT EXISTS home_currency TEXT DEFAULT 'USD';

COMMENT ON COLUMN invoice_record.department_ref IS
  'Department reference for accounting. Schema: {value (ID), name}.';
COMMENT ON COLUMN invoice_record.class_ref IS
  'Class reference for tracking. Schema: {value (ID), name}.';
COMMENT ON COLUMN invoice_record.ar_account_ref IS
  'Accounts Receivable account reference. Schema: {value (ID), name}. Typically "Accounts Receivable".';
COMMENT ON COLUMN invoice_record.home_balance IS
  'Balance in home currency. For multi-currency companies, this is the amount converted to home currency.';
COMMENT ON COLUMN invoice_record.home_currency IS
  'Company home currency code (e.g., USD, EUR, GBP).';

-- ============================================================================
-- PART 8: Add linked transaction fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Link to sales order (if invoice was created from order)
  ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_order_record(id) ON DELETE SET NULL,

  -- Link to estimate (if invoice was created from estimate)
  ADD COLUMN IF NOT EXISTS estimate_id UUID,

  -- QBO linked transactions (JSON array of {TxnId, TxnType})
  ADD COLUMN IF NOT EXISTS linked_txn JSONB;

COMMENT ON COLUMN invoice_record.sales_order_id IS
  'Internal reference to sales_order_record if this invoice was created from a sales order.';
COMMENT ON COLUMN invoice_record.estimate_id IS
  'Internal reference to estimate if this invoice was created from an estimate.';
COMMENT ON COLUMN invoice_record.linked_txn IS
  'Array of linked QuickBooks transactions. Schema: [{TxnId, TxnType, TxnLineId}]. E.g., [{"TxnId": "123", "TxnType": "Estimate"}]';

-- ============================================================================
-- PART 9: Add tracking and metadata fields
-- ============================================================================

ALTER TABLE invoice_record
  -- Track whether invoice is voided
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT false,

  -- Voided date and reason
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT,

  -- Track whether invoice is pending
  ADD COLUMN IF NOT EXISTS is_pending_approval BOOLEAN DEFAULT false,

  -- Custom transaction number (for businesses with custom numbering)
  ADD COLUMN IF NOT EXISTS custom_txn_number TEXT,

  -- Tracking number (for shipment tracking)
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;

COMMENT ON COLUMN invoice_record.is_voided IS
  'If true, this invoice has been voided and should not be included in financial reports.';
COMMENT ON COLUMN invoice_record.voided_at IS
  'Timestamp when the invoice was voided.';
COMMENT ON COLUMN invoice_record.voided_by IS
  'User who voided the invoice.';
COMMENT ON COLUMN invoice_record.void_reason IS
  'Reason for voiding the invoice.';
COMMENT ON COLUMN invoice_record.is_pending_approval IS
  'If true, invoice is pending approval before being sent to customer.';
COMMENT ON COLUMN invoice_record.custom_txn_number IS
  'Custom transaction number for businesses using alternative numbering systems.';
COMMENT ON COLUMN invoice_record.tracking_number IS
  'Shipment tracking number. Synced with shipping_tracking for backward compatibility.';

-- ============================================================================
-- PART 10: Create indexes for performance
-- ============================================================================

-- Index for QBO sync operations (find by qbo_id)
CREATE INDEX IF NOT EXISTS idx_invoice_record_qbo_id
  ON invoice_record(organization_id, qbo_id)
  WHERE qbo_id IS NOT NULL;

-- Index for sync status queries
CREATE INDEX IF NOT EXISTS idx_invoice_record_qbo_sync_status
  ON invoice_record(organization_id, qbo_sync_status)
  WHERE qbo_sync_status IS NOT NULL;

-- Index for last_sync_at (find invoices needing sync)
CREATE INDEX IF NOT EXISTS idx_invoice_record_last_sync
  ON invoice_record(organization_id, last_sync_at)
  WHERE last_sync_at IS NOT NULL;

-- Index for updated_at (find recently modified invoices)
CREATE INDEX IF NOT EXISTS idx_invoice_record_updated_at
  ON invoice_record(organization_id, updated_at DESC);

-- Index for email status (find invoices needing to be sent)
CREATE INDEX IF NOT EXISTS idx_invoice_record_email_status
  ON invoice_record(organization_id, email_status)
  WHERE email_status IN ('NotSet', 'NeedToSend');

-- Index for print status (find invoices needing to be printed)
CREATE INDEX IF NOT EXISTS idx_invoice_record_print_status
  ON invoice_record(organization_id, print_status)
  WHERE print_status IN ('NotSet', 'NeedToPrint');

-- Index for voided invoices
CREATE INDEX IF NOT EXISTS idx_invoice_record_voided
  ON invoice_record(organization_id, is_voided)
  WHERE is_voided = true;

-- GIN index for JSONB fields (linked_txn, custom_fields)
CREATE INDEX IF NOT EXISTS idx_invoice_record_linked_txn
  ON invoice_record USING gin(linked_txn);

CREATE INDEX IF NOT EXISTS idx_invoice_record_custom_fields
  ON invoice_record USING gin(custom_fields);

-- Unique constraint to prevent duplicate QBO invoices
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_record_org_qbo_id_unique
  ON invoice_record(organization_id, qbo_id)
  WHERE qbo_id IS NOT NULL;

-- ============================================================================
-- PART 11: Add invoice line item QBO fields
-- ============================================================================

-- Enhance invoice_line_item table with QBO fields
ALTER TABLE invoice_line_item
  -- QBO line ID (for updating specific lines)
  ADD COLUMN IF NOT EXISTS qbo_line_id TEXT,

  -- QBO line number (order of lines in QBO)
  ADD COLUMN IF NOT EXISTS qbo_line_num INTEGER,

  -- QBO detail type (SalesItemLineDetail, SubTotalLineDetail, DiscountLineDetail)
  ADD COLUMN IF NOT EXISTS qbo_detail_type TEXT
    CHECK (qbo_detail_type IN ('SalesItemLineDetail', 'SubTotalLineDetail', 'DiscountLineDetail', 'DescriptionOnly')),

  -- Item reference (links to QBO Item)
  ADD COLUMN IF NOT EXISTS item_ref JSONB,

  -- Class reference (for class tracking at line level)
  ADD COLUMN IF NOT EXISTS class_ref JSONB,

  -- Tax code reference (for line-level tax override)
  ADD COLUMN IF NOT EXISTS tax_code_ref JSONB,

  -- Service date (for service items)
  ADD COLUMN IF NOT EXISTS service_date DATE,

  -- Tax amount for this line
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2);

COMMENT ON COLUMN invoice_line_item.qbo_line_id IS
  'QuickBooks line ID. Used for updating specific lines in an invoice.';
COMMENT ON COLUMN invoice_line_item.qbo_line_num IS
  'QuickBooks line number. Determines the order of lines in the invoice.';
COMMENT ON COLUMN invoice_line_item.qbo_detail_type IS
  'QuickBooks line detail type: SalesItemLineDetail (product/service), SubTotalLineDetail, DiscountLineDetail, or DescriptionOnly.';
COMMENT ON COLUMN invoice_line_item.item_ref IS
  'QuickBooks item reference. Schema: {value (ID), name}. Links to item_record via qbo_id.';
COMMENT ON COLUMN invoice_line_item.class_ref IS
  'Line-level class reference for detailed tracking. Schema: {value (ID), name}.';
COMMENT ON COLUMN invoice_line_item.tax_code_ref IS
  'Line-level tax code reference. Overrides invoice-level tax code. Schema: {value (ID), name}.';
COMMENT ON COLUMN invoice_line_item.service_date IS
  'Date when service was performed (for service items).';
COMMENT ON COLUMN invoice_line_item.tax_amount IS
  'Tax amount calculated for this line item.';

-- Index for invoice line items by QBO ID
CREATE INDEX IF NOT EXISTS idx_invoice_line_item_qbo_line_id
  ON invoice_line_item(invoice_id, qbo_line_id)
  WHERE qbo_line_id IS NOT NULL;

-- ============================================================================
-- PART 12: Update triggers for calculated fields
-- ============================================================================

-- Function to update remaining_balance when deposit or amount_paid changes
CREATE OR REPLACE FUNCTION update_invoice_remaining_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_balance := NEW.total - COALESCE(NEW.deposit, 0) - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update remaining_balance
DROP TRIGGER IF EXISTS trg_invoice_remaining_balance ON invoice_record;
CREATE TRIGGER trg_invoice_remaining_balance
  BEFORE INSERT OR UPDATE OF total, deposit, amount_paid
  ON invoice_record
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_remaining_balance();

-- ============================================================================
-- PART 13: Add RLS policies for new fields
-- ============================================================================

-- RLS policies are inherited from existing invoice_record policies
-- No additional policies needed as all new fields are part of the same table

-- ============================================================================
-- PART 14: Add helper function to get invoice sync status
-- ============================================================================

-- Function to determine if invoice needs sync based on last_sync_at vs updated_at
CREATE OR REPLACE FUNCTION invoice_needs_sync(
  p_invoice_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_needs_sync BOOLEAN;
BEGIN
  SELECT
    CASE
      WHEN qbo_id IS NULL THEN true  -- Never synced
      WHEN last_sync_at IS NULL THEN true  -- No sync timestamp
      WHEN updated_at > last_sync_at THEN true  -- Modified since last sync
      ELSE false
    END INTO v_needs_sync
  FROM invoice_record
  WHERE id = p_invoice_id;

  RETURN COALESCE(v_needs_sync, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION invoice_needs_sync IS
  'Returns true if invoice needs to be synced to QuickBooks (never synced, no sync timestamp, or modified since last sync).';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION invoice_needs_sync TO authenticated;

-- ============================================================================
-- PART 15: Create view for sync-ready invoices
-- ============================================================================

-- View to identify invoices that need to be pushed to QuickBooks
CREATE OR REPLACE VIEW invoices_needing_sync AS
SELECT
  ir.*,
  cp.display_name as customer_name,
  cp.qbo_id as customer_qbo_id,
  CASE
    WHEN ir.qbo_id IS NULL THEN 'create'
    WHEN ir.updated_at > ir.last_sync_at THEN 'update'
    ELSE 'synced'
  END as sync_action
FROM invoice_record ir
LEFT JOIN customer_profile cp ON ir.customer_id = cp.id
WHERE
  ir.status NOT IN ('draft', 'cancelled')  -- Don't sync drafts or cancelled invoices
  AND ir.is_voided = false  -- Don't sync voided invoices
  AND (
    ir.qbo_id IS NULL  -- Never synced
    OR ir.last_sync_at IS NULL  -- No sync timestamp
    OR ir.updated_at > ir.last_sync_at  -- Modified since last sync
  );

COMMENT ON VIEW invoices_needing_sync IS
  'Identifies invoices that need to be synced to QuickBooks. Includes customer info and sync action (create/update).';

-- Grant access to authenticated users
GRANT SELECT ON invoices_needing_sync TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- - Added 42 new columns to invoice_record for comprehensive QBO sync
-- - Added 8 new columns to invoice_line_item for line-level QBO data
-- - Created 11 performance indexes
-- - Created 1 unique constraint for data integrity
-- - Created 1 trigger for automatic field updates
-- - Created 1 helper function for sync status
-- - Created 1 view for sync-ready invoices
-- Total: 50 new columns, 11 indexes, 1 constraint, 1 trigger, 1 function, 1 view
