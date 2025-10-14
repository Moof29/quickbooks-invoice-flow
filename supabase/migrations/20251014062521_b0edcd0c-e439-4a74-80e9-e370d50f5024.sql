-- Payment tracking for invoices
CREATE TABLE IF NOT EXISTS invoice_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoice_record(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'other',
  reference_number VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_invoice_payment_invoice_id ON invoice_payment(invoice_id);
CREATE INDEX idx_invoice_payment_org_id ON invoice_payment(organization_id);
CREATE INDEX idx_invoice_payment_date ON invoice_payment(payment_date);

-- Enable RLS
ALTER TABLE invoice_payment ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization isolation
CREATE POLICY invoice_payment_org_access ON invoice_payment
  FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Add payment summary columns to invoice_record
ALTER TABLE invoice_record 
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC(15,2) GENERATED ALWAYS AS (total - COALESCE(amount_paid, 0)) STORED;

-- Function to update invoice payment totals
CREATE OR REPLACE FUNCTION update_invoice_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid NUMERIC;
  target_invoice_id UUID;
BEGIN
  target_invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate total payments
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM invoice_payment
  WHERE invoice_id = target_invoice_id;
  
  -- Update invoice
  UPDATE invoice_record
  SET 
    amount_paid = total_paid,
    status = CASE 
      WHEN total_paid >= total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = target_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update invoice totals on payment changes
CREATE TRIGGER trg_update_invoice_payment_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_payment
FOR EACH ROW
EXECUTE FUNCTION update_invoice_payment_totals();

-- Add audit trigger
CREATE TRIGGER trg_audit_invoice_payment
AFTER INSERT OR UPDATE OR DELETE ON invoice_payment
FOR EACH ROW
EXECUTE FUNCTION audit_trigger_fn();

-- Add updated_at trigger
CREATE TRIGGER trg_invoice_payment_updated_at
BEFORE UPDATE ON invoice_payment
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();