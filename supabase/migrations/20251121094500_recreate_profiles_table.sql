-- Ensure the shared user_role enum and profiles table exist so auth/profile flows work everywhere
BEGIN;

-- Create the user_role enum if it is missing (Supabase default projects usually ship with it)
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

-- Create the profiles table if it does not exist
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

COMMENT ON TABLE public.profiles IS 'Per-user profile metadata scoped to an organization';
COMMENT ON COLUMN public.profiles.role IS 'Application role for the user (admin, sales manager, etc.)';

-- Wire up the organization foreign key only if the organizations table exists
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

-- Reference auth.users so deleting a Supabase user cleans up their profile automatically
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

-- Helpful indexes for org-based lookups and role filters
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Keep RLS enabled so downstream policies can manage access
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Provide minimal self-access policies so users can still read/update their own profile until richer policies run
CREATE POLICY IF NOT EXISTS "profiles_self_select"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS "profiles_self_update"
ON public.profiles
FOR UPDATE
USING (id = auth.uid());

COMMIT;
