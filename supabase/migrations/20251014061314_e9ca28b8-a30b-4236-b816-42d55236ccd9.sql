-- Enable pg_trgm extension for fuzzy search first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add performance indexes for sales_order table
CREATE INDEX IF NOT EXISTS idx_sales_order_delivery_date_org_status 
ON sales_order(delivery_date, organization_id, status);

CREATE INDEX IF NOT EXISTS idx_sales_order_org_created 
ON sales_order(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_order_org_invoiced 
ON sales_order(organization_id, invoiced);

-- Add performance indexes for invoice_record table
CREATE INDEX IF NOT EXISTS idx_invoice_record_org_date_status 
ON invoice_record(organization_id, invoice_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_invoice_record_org_created 
ON invoice_record(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_record_org_status 
ON invoice_record(organization_id, status);

-- Add indexes for line items (foreign key lookups)
CREATE INDEX IF NOT EXISTS idx_sales_order_line_item_order_org 
ON sales_order_line_item(sales_order_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_item_invoice_org 
ON invoice_line_item(invoice_id, organization_id);

-- Add indexes for customer and item searches
CREATE INDEX IF NOT EXISTS idx_customer_profile_org_name 
ON customer_profile(organization_id, company_name);

CREATE INDEX IF NOT EXISTS idx_item_record_org_name 
ON item_record(organization_id, name);

-- Add index for batch job queue processing
CREATE INDEX IF NOT EXISTS idx_batch_job_queue_status_created 
ON batch_job_queue(status, created_at) 
WHERE status IN ('pending', 'processing');

-- Add index for customer templates
CREATE INDEX IF NOT EXISTS idx_customer_templates_customer_active 
ON customer_templates(customer_id, organization_id, is_active);

-- Add GIN indexes for full-text search on customer and item names
CREATE INDEX IF NOT EXISTS idx_customer_profile_company_name_trgm 
ON customer_profile USING gin(company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_item_record_name_trgm 
ON item_record USING gin(name gin_trgm_ops);