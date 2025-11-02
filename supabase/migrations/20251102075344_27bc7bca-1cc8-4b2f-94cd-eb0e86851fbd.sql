-- Create storage bucket for CSV imports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'csv-imports',
  'csv-imports',
  false,
  524288000, -- 500MB limit
  ARRAY['text/csv', 'application/vnd.ms-excel', 'text/plain']
);

-- Create import progress tracking table
CREATE TABLE IF NOT EXISTS public.csv_import_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('items', 'customers', 'invoices')),
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on csv_import_progress
ALTER TABLE public.csv_import_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for csv_import_progress
CREATE POLICY "Users can view their org's import progress"
  ON public.csv_import_progress
  FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create import progress in their org"
  ON public.csv_import_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their org's import progress"
  ON public.csv_import_progress
  FOR UPDATE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Storage RLS Policies for csv-imports bucket
CREATE POLICY "Users can upload CSV files to their org folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'csv-imports' AND
    (storage.foldername(name))[1] = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their org's CSV files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'csv-imports' AND
    (storage.foldername(name))[1] = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their org's CSV files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'csv-imports' AND
    (storage.foldername(name))[1] = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX idx_csv_import_progress_org_status ON public.csv_import_progress(organization_id, status);
CREATE INDEX idx_csv_import_progress_created_at ON public.csv_import_progress(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_csv_import_progress_updated_at
  BEFORE UPDATE ON public.csv_import_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();