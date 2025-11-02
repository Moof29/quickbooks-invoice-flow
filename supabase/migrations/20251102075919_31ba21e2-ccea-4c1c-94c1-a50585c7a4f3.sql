-- Update csv_import_progress table to support invoice_line_items data type
ALTER TABLE public.csv_import_progress 
DROP CONSTRAINT IF EXISTS csv_import_progress_data_type_check;

ALTER TABLE public.csv_import_progress 
ADD CONSTRAINT csv_import_progress_data_type_check 
CHECK (data_type IN ('items', 'customers', 'invoices', 'invoice_line_items'));