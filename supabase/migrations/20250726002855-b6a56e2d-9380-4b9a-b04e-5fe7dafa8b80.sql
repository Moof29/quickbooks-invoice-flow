-- First, let's clean up the test data that has wrong organization_id
DELETE FROM customer_profile WHERE organization_id = '11111111-1111-1111-1111-111111111111';

-- Now let's check and fix the get_user_organization_id function to handle edge function context
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  -- Try to get from JWT claims first (for edge functions)
  BEGIN
    RETURN (current_setting('request.jwt.claims.organization_id'))::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Fall back to profiles table lookup
    RETURN (SELECT organization_id FROM public.profiles WHERE id = user_id LIMIT 1);
  END;
END;
$$;