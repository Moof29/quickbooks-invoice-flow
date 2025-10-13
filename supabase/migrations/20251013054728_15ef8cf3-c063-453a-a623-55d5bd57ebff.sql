
-- Create invoice_number_sequences table for invoice numbering
CREATE TABLE IF NOT EXISTS invoice_number_sequences (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL DEFAULT 'INV-',
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE invoice_number_sequences ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "org_isolation_invoice_number_sequences"
  ON invoice_number_sequences
  FOR ALL
  TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Add index
CREATE INDEX idx_invoice_number_sequences_org 
  ON invoice_number_sequences(organization_id);

-- Add trigger for updated_at
CREATE TRIGGER update_invoice_number_sequences_updated_at
  BEFORE UPDATE ON invoice_number_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE invoice_number_sequences IS 'Tracks next invoice number for each organization';
