-- Force drop all existing RLS policies on profiles table with CASCADE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles CASCADE;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles CASCADE;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles CASCADE;
DROP POLICY IF EXISTS "Enable access to own profile" ON public.profiles CASCADE;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles CASCADE;
DROP POLICY IF EXISTS "Allow users to access their own profile" ON public.profiles CASCADE;

-- Disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create new simple, non-recursive policies
CREATE POLICY "profiles_select_policy" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "profiles_insert_policy" 
ON public.profiles 
FOR INSERT 
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_policy" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid());

CREATE POLICY "profiles_delete_policy" 
ON public.profiles 
FOR DELETE 
USING (id = auth.uid());