-- Add performance indexes for customer_profile queries
-- Index for created_at ordering (used in default sort)
CREATE INDEX IF NOT EXISTS idx_customer_created_at ON public.customer_profile(created_at DESC) WHERE is_active = true;

-- Index for active customers filter (most common query)
CREATE INDEX IF NOT EXISTS idx_customer_active ON public.customer_profile(is_active) WHERE is_active = true;

-- Composite index for organization + active status
CREATE INDEX IF NOT EXISTS idx_customer_org_active ON public.customer_profile(organization_id, is_active) WHERE is_active = true;

-- Index for search fields using GIN (for faster ILIKE searches)
CREATE INDEX IF NOT EXISTS idx_customer_search_gin ON public.customer_profile USING gin (
  (display_name || ' ' || company_name || ' ' || COALESCE(email, '')) gin_trgm_ops
);

-- Analyze table to update statistics
ANALYZE public.customer_profile;