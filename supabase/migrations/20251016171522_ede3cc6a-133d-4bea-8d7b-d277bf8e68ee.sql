-- ============================================
-- MIGRATION: Fix Portal Impersonation Security
-- ============================================

-- Step 1: Create new SECURITY DEFINER function that bypasses RLS
CREATE OR REPLACE FUNCTION public.check_user_is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = check_user_id 
      AND role = 'admin'::app_role
    LIMIT 1
  );
$$;

-- Step 2: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_is_admin(uuid) TO service_role;

-- Step 3: Add comment for documentation
COMMENT ON FUNCTION public.check_user_is_admin(uuid) IS 
'Security definer function to check if a user is an admin. Bypasses RLS to prevent recursion.';