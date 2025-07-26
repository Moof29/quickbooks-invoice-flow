-- Update customer_profile RLS policy to use the profiles table directly instead of JWT claims
DROP POLICY IF EXISTS "customer_profile_org_access" ON customer_profile;

CREATE POLICY "customer_profile_org_access" ON customer_profile
FOR ALL 
USING (
  organization_id = (
    SELECT organization_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);