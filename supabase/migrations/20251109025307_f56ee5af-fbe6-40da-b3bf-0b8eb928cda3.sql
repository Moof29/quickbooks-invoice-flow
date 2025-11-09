-- Phase 3: Add import history features to csv_import_progress table

-- Add error_file_path column for storing failed rows CSV
ALTER TABLE public.csv_import_progress
ADD COLUMN IF NOT EXISTS error_file_path TEXT,
ADD COLUMN IF NOT EXISTS import_settings JSONB DEFAULT '{}'::jsonb;

-- Update the check constraint to include 'invoice_line_items'
ALTER TABLE public.csv_import_progress
DROP CONSTRAINT IF EXISTS csv_import_progress_data_type_check;

ALTER TABLE public.csv_import_progress
ADD CONSTRAINT csv_import_progress_data_type_check
CHECK (data_type IN ('items', 'customers', 'invoices', 'invoice_line_items'));

-- Create index for history queries (organization + date sorting)
CREATE INDEX IF NOT EXISTS idx_csv_import_progress_org_created
ON public.csv_import_progress(organization_id, created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.csv_import_progress.error_file_path IS 'Path to CSV file containing failed rows for download';
COMMENT ON COLUMN public.csv_import_progress.import_settings IS 'JSON settings including column mappings and import options';