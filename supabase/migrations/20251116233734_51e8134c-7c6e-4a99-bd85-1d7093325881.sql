-- Prompt 7: Create pg_cron jobs for automated syncs
-- Note: Requires app.settings.supabase_url and app.settings.service_role_key to be set manually

SELECT cron.schedule(
  'qbo-token-refresh-check',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('organizationId', organization_id::text)
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

SELECT cron.schedule(
  'qbo-continue-sync-sessions',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-continue-sync-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'qbo-sync-customers-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-sync-customers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('organizationId', organization_id::text, 'direction', 'pull')
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

SELECT cron.schedule(
  'qbo-sync-items-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-sync-items',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('organizationId', organization_id::text, 'direction', 'pull')
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

SELECT cron.schedule(
  'qbo-sync-payments-business-hours',
  '*/30 8-18 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-sync-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('organizationId', organization_id::text, 'direction', 'pull')
  )
  FROM qbo_connection
  WHERE is_active = true;
  $$
);

SELECT cron.schedule(
  'qbo-sync-payments-off-hours',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/qbo-sync-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('organizationId', organization_id::text, 'direction', 'pull')
  )
  FROM qbo_connection
  WHERE is_active = true
    AND EXTRACT(HOUR FROM NOW()) NOT BETWEEN 8 AND 18;
  $$
);