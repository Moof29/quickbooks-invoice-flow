-- Delete invoice #343591 from Batchly database only (not QuickBooks)
-- This will allow it to be re-synced from QuickBooks on the next sync

-- First delete the line items
DELETE FROM invoice_line_item WHERE invoice_id = '443d612f-c654-4be9-9fa3-f8a76ff5fcfb';

-- Then delete the invoice record
DELETE FROM invoice_record WHERE id = '443d612f-c654-4be9-9fa3-f8a76ff5fcfb';