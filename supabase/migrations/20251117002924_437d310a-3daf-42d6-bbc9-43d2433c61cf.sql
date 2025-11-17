
-- Create qbo_sync_sessions table for chunked sync tracking
CREATE TABLE IF NOT EXISTS public.qbo_sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('pull', 'push')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  sync_mode TEXT NOT NULL DEFAULT 'full' CHECK (sync_mode IN ('full', 'delta', 'historical')),
  
  -- Progress tracking
  total_expected INTEGER,
  total_processed INTEGER NOT NULL DEFAULT 0,
  current_offset INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 100,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_chunk_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.qbo_sync_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sync sessions for their organization"
  ON public.qbo_sync_sessions
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Service role can manage all sync sessions"
  ON public.qbo_sync_sessions
  FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Indexes for performance
CREATE INDEX idx_qbo_sync_sessions_org_entity ON public.qbo_sync_sessions(organization_id, entity_type);
CREATE INDEX idx_qbo_sync_sessions_status ON public.qbo_sync_sessions(status) WHERE status = 'in_progress';
CREATE INDEX idx_qbo_sync_sessions_last_chunk ON public.qbo_sync_sessions(last_chunk_at) WHERE status = 'in_progress';

-- Trigger to update updated_at
CREATE TRIGGER update_qbo_sync_sessions_updated_at
  BEFORE UPDATE ON public.qbo_sync_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.qbo_sync_sessions IS 'Tracks chunked sync sessions for resumable QuickBooks syncs';
