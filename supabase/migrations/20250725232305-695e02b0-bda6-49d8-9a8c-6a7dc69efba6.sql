-- Enable RLS on all QuickBooks tables that currently have it disabled

-- Enable RLS on qbo_sync_history
ALTER TABLE public.qbo_sync_history ENABLE ROW LEVEL SECURITY;

-- Enable RLS on qbo_connection  
ALTER TABLE public.qbo_connection ENABLE ROW LEVEL SECURITY;

-- Enable RLS on qbo_entity_mapping
ALTER TABLE public.qbo_entity_mapping ENABLE ROW LEVEL SECURITY;

-- Enable RLS on qbo_entity_dependencies
ALTER TABLE public.qbo_entity_dependencies ENABLE ROW LEVEL SECURITY;

-- Enable RLS on qbo_sync_batch
ALTER TABLE public.qbo_sync_batch ENABLE ROW LEVEL SECURITY;

-- Enable RLS on financial_metrics
ALTER TABLE public.financial_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_financial_metrics" ON public.financial_metrics FOR ALL USING (organization_id = (current_setting('request.jwt.claims.organization_id')::uuid));

-- Enable RLS on audit_log_entries  
ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_audit_log_entries" ON public.audit_log_entries FOR ALL USING (organization_id = (current_setting('request.jwt.claims.organization_id')::uuid));

-- Enable RLS on qbo_webhook_handler_log
ALTER TABLE public.qbo_webhook_handler_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_qbo_webhook_handler_log" ON public.qbo_webhook_handler_log FOR ALL USING (organization_id = (current_setting('request.jwt.claims.organization_id')::uuid));