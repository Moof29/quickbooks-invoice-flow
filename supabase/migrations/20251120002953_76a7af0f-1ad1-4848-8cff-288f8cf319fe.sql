-- Add missing QuickBooks invoice fields to invoice_record table
-- This ensures we can capture all QB invoice data without loss

-- Address fields (JSONB to store QB address structures)
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS bill_addr jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS ship_addr jsonb;

-- Communication and delivery status
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS email_status text;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS print_status text;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS delivery_status text;

-- Notes and messages
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS private_note text;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS customer_memo text;

-- Payment options (QB online payment settings)
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS allow_ipn_payment boolean DEFAULT false;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS allow_online_ach_payment boolean DEFAULT false;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS allow_online_credit_card_payment boolean DEFAULT false;

-- Accounting and tax details
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS global_tax_calculation text;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS apply_tax_after_discount boolean DEFAULT false;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS tax_code_ref jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS txn_tax_detail jsonb;

-- Multi-currency fields
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS home_balance numeric DEFAULT 0;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS home_total_amt numeric DEFAULT 0;

-- Reference fields (stored as JSONB with {value, name} structure)
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS sales_term_ref jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS ship_method_ref jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS class_ref jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS department_ref jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS deposit_to_account_ref jsonb;

-- QB metadata
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS qbo_meta_data jsonb;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS qbo_doc_number text;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS qbo_txn_date date;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS qbo_create_time timestamptz;
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS qbo_last_updated_time timestamptz;

-- Linked transactions (for tracking related QB transactions)
ALTER TABLE invoice_record ADD COLUMN IF NOT EXISTS linked_txn jsonb;

-- Comment on columns for clarity
COMMENT ON COLUMN invoice_record.bill_addr IS 'QuickBooks billing address as JSONB {Line1, Line2, City, CountrySubDivisionCode, PostalCode, Country}';
COMMENT ON COLUMN invoice_record.ship_addr IS 'QuickBooks shipping address as JSONB';
COMMENT ON COLUMN invoice_record.email_status IS 'QB email status: EmailSent, NeedToSend, NotSet';
COMMENT ON COLUMN invoice_record.print_status IS 'QB print status: Printed, NeedToPrint, NotSet';
COMMENT ON COLUMN invoice_record.private_note IS 'Internal note not visible to customer';
COMMENT ON COLUMN invoice_record.customer_memo IS 'Message displayed to customer on invoice';
COMMENT ON COLUMN invoice_record.global_tax_calculation IS 'QB tax calculation: TaxExcluded, TaxInclusive, NotApplicable';
COMMENT ON COLUMN invoice_record.txn_tax_detail IS 'Detailed QB tax information including tax line items';
COMMENT ON COLUMN invoice_record.qbo_meta_data IS 'QB metadata including CreateTime, LastUpdatedTime';
COMMENT ON COLUMN invoice_record.linked_txn IS 'Array of linked QB transactions';

-- Add indexes for commonly queried QB fields
CREATE INDEX IF NOT EXISTS idx_invoice_record_email_status ON invoice_record(email_status);
CREATE INDEX IF NOT EXISTS idx_invoice_record_print_status ON invoice_record(print_status);
CREATE INDEX IF NOT EXISTS idx_invoice_record_qbo_doc_number ON invoice_record(qbo_doc_number);
CREATE INDEX IF NOT EXISTS idx_invoice_record_qbo_txn_date ON invoice_record(qbo_txn_date);