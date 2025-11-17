-- Create system settings table to store configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write system settings
CREATE POLICY "Only admins can manage system settings"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert the Supabase URL and service role key
INSERT INTO public.system_settings (setting_key, setting_value, encrypted)
VALUES 
  ('supabase_url', 'https://pnqcbnmrfzqihymmzhkb.supabase.co', FALSE),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWNibm1yZnpxaWh5bW16aGtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDgzNTg2NSwiZXhwIjoyMDYwNDExODY1fQ.0dG0axZl7AAFCcYSb8s6jPJSQrwurLKXWLrAmDxRltw', TRUE)
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      updated_at = NOW();

-- Helper function to get system setting
CREATE OR REPLACE FUNCTION public.get_system_setting(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT setting_value INTO v_value
  FROM system_settings
  WHERE setting_key = p_key;
  
  RETURN v_value;
END;
$$;

-- Update all cron jobs to use the table instead of current_setting()
-- Token refresh job
SELECT cron.schedule(
  'qbo-token-refresh-every-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT get_system_setting('supabase_url') || '/functions/v1/qbo-token-refresh'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_system_setting('service_role_key'))
    ),
    body := jsonb_build_object('timestamp', now())
  );
  $$
);

-- Continue incomplete sync sessions
SELECT cron.schedule(
  'qbo-continue-sync-sessions-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT get_system_setting('supabase_url') || '/functions/v1/qbo-continue-sync-sessions'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_system_setting('service_role_key'))
    ),
    body := jsonb_build_object('timestamp', now())
  );
  $$
);

-- Daily customer sync (8 AM)
SELECT cron.schedule(
  'qbo-sync-customers-daily-8am',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT get_system_setting('supabase_url') || '/functions/v1/qbo-sync-customers'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_system_setting('service_role_key'))
    ),
    body := jsonb_build_object('timestamp', now(), 'sync_type', 'delta')
  );
  $$
);

-- Daily item sync (8 AM)
SELECT cron.schedule(
  'qbo-sync-items-daily-8am',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT get_system_setting('supabase_url') || '/functions/v1/qbo-sync-items'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_system_setting('service_role_key'))
    ),
    body := jsonb_build_object('timestamp', now(), 'sync_type', 'delta')
  );
  $$
);

-- Payment sync during business hours (every 15 minutes, 8 AM - 6 PM)
SELECT cron.schedule(
  'qbo-sync-payments-business-hours',
  '*/15 8-18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT get_system_setting('supabase_url') || '/functions/v1/qbo-sync-payments'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_system_setting('service_role_key'))
    ),
    body := jsonb_build_object('timestamp', now())
  );
  $$
);

-- Payment sync off-hours (hourly, 6 PM - 8 AM)
SELECT cron.schedule(
  'qbo-sync-payments-off-hours',
  '0 18-23,0-7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT get_system_setting('supabase_url') || '/functions/v1/qbo-sync-payments'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT get_system_setting('service_role_key'))
    ),
    body := jsonb_build_object('timestamp', now())
  );
  $$
);