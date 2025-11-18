-- Track OAuth state tokens issued during QuickBooks authorization
CREATE TABLE IF NOT EXISTS public.qbo_oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  state_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_by UUID,
  ip_address TEXT,
  CONSTRAINT qbo_oauth_state_unique UNIQUE (organization_id, state_token)
);

CREATE INDEX IF NOT EXISTS idx_qbo_oauth_state_token ON public.qbo_oauth_state(state_token);
CREATE INDEX IF NOT EXISTS idx_qbo_oauth_state_expires_at ON public.qbo_oauth_state(expires_at);

COMMENT ON TABLE public.qbo_oauth_state IS 'OAuth state tokens for QuickBooks connections to prevent CSRF and replay.';
COMMENT ON COLUMN public.qbo_oauth_state.organization_id IS 'Organization requesting QuickBooks authorization.';
COMMENT ON COLUMN public.qbo_oauth_state.state_token IS 'Opaque state nonce issued during OAuth initiate.';
COMMENT ON COLUMN public.qbo_oauth_state.expires_at IS 'Expiry timestamp; callbacks after this are rejected.';
COMMENT ON COLUMN public.qbo_oauth_state.consumed_at IS 'Set when the state is successfully redeemed to prevent reuse.';

ALTER TABLE public.qbo_oauth_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only qbo_oauth_state" ON public.qbo_oauth_state;
CREATE POLICY "service role only qbo_oauth_state"
  ON public.qbo_oauth_state
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');