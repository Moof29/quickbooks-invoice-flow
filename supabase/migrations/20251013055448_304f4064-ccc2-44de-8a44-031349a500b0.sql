-- Drop foreign key constraints on created_by columns to allow NULL values
-- This allows invoices to be created by batch jobs without requiring a user reference

-- Fix invoice_record
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'invoice_record_created_by_fkey'
    ) THEN
        ALTER TABLE invoice_record DROP CONSTRAINT invoice_record_created_by_fkey;
    END IF;
END $$;

ALTER TABLE invoice_record ALTER COLUMN created_by DROP NOT NULL;

-- Fix sales_order_invoice_link
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sales_order_invoice_link_created_by_fkey'
    ) THEN
        ALTER TABLE sales_order_invoice_link DROP CONSTRAINT sales_order_invoice_link_created_by_fkey;
    END IF;
END $$;

ALTER TABLE sales_order_invoice_link ALTER COLUMN created_by DROP NOT NULL;

COMMENT ON COLUMN invoice_record.created_by IS 'User who created the invoice. NULL for system-created invoices (e.g., batch jobs).';
COMMENT ON COLUMN sales_order_invoice_link.created_by IS 'User who created the link. NULL for system-created links.';