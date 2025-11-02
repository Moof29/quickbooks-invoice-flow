-- Add composite indexes for invoice search and filtering optimizations
-- These indexes will dramatically improve query performance for large datasets

-- Composite index for organization + customer lookup (common join pattern)
CREATE INDEX IF NOT EXISTS idx_invoice_org_customer 
ON invoice_record(organization_id, customer_id);

-- Composite index for organization + invoice_date for date range queries
CREATE INDEX IF NOT EXISTS idx_invoice_org_date 
ON invoice_record(organization_id, invoice_date DESC);

-- Add trigram indexes for fast text search on invoice numbers
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_invoice_number_trgm 
ON invoice_record USING gin (invoice_number gin_trgm_ops);

-- Add index on customer names for search
CREATE INDEX IF NOT EXISTS idx_customer_name_search 
ON customer_profile USING gin (
  (COALESCE(company_name, '') || ' ' || COALESCE(display_name, '')) gin_trgm_ops
);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_invoice_org_status_date 
ON invoice_record(organization_id, status, invoice_date DESC)
WHERE status IN ('invoiced', 'sent', 'paid', 'cancelled', 'confirmed', 'delivered', 'overdue');

-- Add BRIN index for invoice_date to handle range queries efficiently on large tables
CREATE INDEX IF NOT EXISTS idx_invoice_date_brin 
ON invoice_record USING brin (invoice_date)
WITH (pages_per_range = 128);

-- Update table statistics for better query planning
ANALYZE invoice_record;
ANALYZE invoice_line_item;
ANALYZE customer_profile;