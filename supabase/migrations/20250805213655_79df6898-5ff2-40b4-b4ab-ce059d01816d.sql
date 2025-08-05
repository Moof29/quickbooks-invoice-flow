-- First, let's get the user details from auth.users (if accessible)
-- Since we can't directly query auth.users, let's create the missing profile manually

-- Insert the missing profile for the authenticated user
INSERT INTO public.profiles (
  id,
  first_name,
  last_name,
  role,
  organization_id,
  created_at,
  updated_at
)
VALUES (
  '7b835d68-3451-483c-9575-f1fd854ac75b',
  'Mostafa',
  '',
  'admin'::public.user_role,
  '9af4c081-7379-4e41-8dfb-924e2518e3c6', -- Use existing organization
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  updated_at = now();