-- COMPLETE RESET OF PROFILES TABLE POLICIES

-- First, disable RLS completely
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies completely (using CASCADE to ensure removal)
DO $$ 
DECLARE 
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles CASCADE', policy_name);
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create completely new, simple policies that do NOT reference the profiles table
CREATE POLICY "profiles_own_access" 
ON public.profiles 
FOR ALL 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Create a function to get user's organization safely without recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT organization_id FROM public.profiles WHERE id = user_id LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update all other tables that use the problematic JWT claims approach
-- to use a simpler organization isolation approach
ALTER TABLE public.qbo_connection DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_qbo_connection" ON public.qbo_connection;
DROP POLICY IF EXISTS "Admins can manage QBO connection" ON public.qbo_connection;
ALTER TABLE public.qbo_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qbo_connection_org_access" 
ON public.qbo_connection 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Fix qbo_sync_history
ALTER TABLE public.qbo_sync_history DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_qbo_sync_history" ON public.qbo_sync_history;
DROP POLICY IF EXISTS "Admins can view sync history" ON public.qbo_sync_history;
ALTER TABLE public.qbo_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qbo_sync_history_org_access" 
ON public.qbo_sync_history 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Fix customer_profile table
ALTER TABLE public.customer_profile DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_customer_profile" ON public.customer_profile;
ALTER TABLE public.customer_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profile_org_access" 
ON public.customer_profile 
FOR ALL 
USING (organization_id = public.get_user_organization_id(auth.uid()));