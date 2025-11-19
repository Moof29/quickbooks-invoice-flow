BEGIN;

-- Ensure the shared user_role enum exists with the roles used throughout the app
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM (
      'admin',
      'sales_manager',
      'warehouse_staff',
      'delivery_driver',
      'customer_service',
      'customer'
    );
  END IF;
END $$;

-- Create the profiles table if it went missing
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  role public.user_role NOT NULL DEFAULT 'customer_service',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure all expected columns exist (for older deployments)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS role public.user_role,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Enforce defaults / not-null expectations used throughout the UI
ALTER TABLE public.profiles
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'customer_service',
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

COMMENT ON TABLE public.profiles IS 'Per-user profile metadata scoped to an organization';
COMMENT ON COLUMN public.profiles.role IS 'Application role for the user (admin, sales manager, etc.)';

-- Add/repair foreign keys if referenced tables exist
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT IF NOT EXISTS profiles_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT IF NOT EXISTS profiles_user_id_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful indexes for lookups by organization or role
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Keep RLS enabled so policies can protect rows
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Replace any partial policies with the full, non-recursive set
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage_org" ON public.profiles;

CREATE POLICY "profiles_self_select"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles_self_insert"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_self_update"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to read all profiles within their organization
CREATE POLICY "profiles_admin_select_org"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = public.profiles.organization_id
  )
);

-- Allow admins to manage (insert/update/delete) profiles within their organization
CREATE POLICY "profiles_admin_manage_org"
ON public.profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = public.profiles.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = public.profiles.organization_id
  )
);

COMMIT;
