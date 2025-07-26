-- Remove the foreign key references that are blocking the deletion
UPDATE invoice_record SET customer_id = NULL WHERE customer_id IN (
  SELECT id FROM customer_profile WHERE organization_id = '11111111-1111-1111-1111-111111111111'
);

-- Now delete the test customer data
DELETE FROM customer_profile WHERE organization_id = '11111111-1111-1111-1111-111111111111';

-- Update the get_user_organization_id function to better handle edge function context
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  -- For edge functions, organization_id should be passed directly in the query
  -- This function is mainly for RLS policies with authenticated users
  RETURN (SELECT organization_id FROM public.profiles WHERE id = user_id LIMIT 1);
END;
$$;