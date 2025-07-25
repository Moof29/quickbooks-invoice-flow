-- First fix the handle_new_user function to have proper permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  org_id UUID;
  invitation_record RECORD;
BEGIN
  -- Check if user was invited via invitation token
  SELECT * INTO invitation_record
  FROM public.organization_invitations 
  WHERE email = NEW.email 
    AND status = 'pending' 
    AND expires_at > now()
  LIMIT 1;

  IF invitation_record IS NOT NULL THEN
    -- User was invited - add them to existing organization
    org_id := invitation_record.organization_id;
    
    -- Mark invitation as accepted
    UPDATE public.organization_invitations 
    SET status = 'accepted', accepted_at = now()
    WHERE id = invitation_record.id;
    
    -- Create user profile with invited role
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
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      invitation_record.role,
      org_id,
      now(),
      now()
    );
  ELSE
    -- No invitation - create new organization (existing flow)
    INSERT INTO public.organizations (
      id,
      name,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      COALESCE(NEW.raw_user_meta_data->>'organization_name', NEW.email),
      now(),
      now()
    )
    RETURNING id INTO org_id;

    -- Create user profile as admin
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
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      'admin'::public.user_role,
      org_id,
      now(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create organization invitations table
CREATE TABLE public.organization_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  UNIQUE(email, organization_id)
);

-- Enable RLS on invitations table
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for invitations
CREATE POLICY "Admins can manage invitations in their org"
ON public.organization_invitations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
    AND p.organization_id = organization_invitations.organization_id
  )
);

-- Create policy for viewing own invitations by email
CREATE POLICY "Users can view invitations sent to their email"
ON public.organization_invitations
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Create function to send invitations
CREATE OR REPLACE FUNCTION public.invite_user_to_organization(
  p_email TEXT,
  p_role public.user_role,
  p_organization_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invitation_id UUID;
  v_user_role public.user_role;
BEGIN
  -- Check if current user is admin in the organization
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid() AND organization_id = p_organization_id;
  
  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can invite users to the organization';
  END IF;
  
  -- Check if user is already in the organization
  IF EXISTS (
    SELECT 1 FROM profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE u.email = p_email AND p.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;
  
  -- Create or update invitation
  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    role,
    invited_by,
    invitation_token
  )
  VALUES (
    p_organization_id,
    p_email,
    p_role,
    auth.uid(),
    gen_random_uuid()
  )
  ON CONFLICT (email, organization_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    status = 'pending',
    expires_at = now() + interval '7 days',
    invitation_token = gen_random_uuid(),
    updated_at = now()
  RETURNING id INTO v_invitation_id;
  
  RETURN v_invitation_id;
END;
$function$;

-- Add trigger for updated_at
CREATE TRIGGER update_organization_invitations_updated_at
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();