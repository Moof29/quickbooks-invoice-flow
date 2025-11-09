-- Fix foreign key constraint to use CASCADE instead of SET NULL
-- This prevents the cross-org reference violation error when deleting customers

ALTER TABLE invoice_record 
DROP CONSTRAINT IF EXISTS invoice_record_customer_id_fkey;

ALTER TABLE invoice_record 
ADD CONSTRAINT invoice_record_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customer_profile(id) 
ON DELETE CASCADE;

-- Drop backup tables that are no longer needed
DROP TABLE IF EXISTS sales_order_backup CASCADE;
DROP TABLE IF EXISTS sales_order_line_item_backup CASCADE;

-- Add comment explaining the CASCADE behavior
COMMENT ON CONSTRAINT invoice_record_customer_id_fkey ON invoice_record IS 
'Cascades deletes from customer_profile to invoice_record. When a customer is deleted, all their invoices are automatically deleted.';