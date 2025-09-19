-- Fix remaining database functions with mutable search paths

CREATE OR REPLACE FUNCTION public.approve_sales_order(p_sales_order_id uuid, p_approved_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update the sales order to approved status
  UPDATE sales_order 
  SET 
    status = 'approved',
    approved_at = now(),
    approved_by = p_approved_by,
    updated_at = now()
  WHERE id = p_sales_order_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found or could not be updated';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log_entries(table_name, operation, record_id, organization_id, after_data)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, NEW.organization_id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log_entries(table_name, operation, record_id, organization_id, before_data, after_data)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, NEW.organization_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log_entries(table_name, operation, record_id, organization_id, before_data)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, OLD.organization_id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qbo_enqueue_sync_operation(p_entity_id uuid, p_entity_type text, p_operation_type text, p_organization_id uuid, p_payload jsonb DEFAULT NULL::jsonb, p_priority integer DEFAULT 5)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_queue_id UUID;
BEGIN
    INSERT INTO qbo_sync_queue (
        entity_id, entity_type, operation_type, organization_id, payload, priority
    ) VALUES (
        p_entity_id, p_entity_type, p_operation_type, p_organization_id, p_payload, p_priority
    ) RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_bill_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM bill_line_item
  WHERE bill_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Bill total does not match line items total. Bill total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all bill_line_item rows match the bill_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.setup_table_rls(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    has_org_id BOOLEAN;
BEGIN
    -- Check if table has organization_id column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = setup_table_rls.table_name 
        AND column_name = 'organization_id'
    ) INTO has_org_id;
    
    -- Enable RLS on the table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_name);
    
    -- Drop existing policies if they exist
    EXECUTE format('DROP POLICY IF EXISTS admin_all_access_%I ON %I;', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS org_select_%I ON %I;', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS org_modify_%I ON %I;', table_name, table_name);
    
    -- Create standard policies if table has organization_id
    IF has_org_id THEN
        -- Admin access policy
        EXECUTE format(
            'CREATE POLICY admin_all_access_%I ON %I
             FOR ALL
             TO authenticated
             USING ((current_setting(''request.jwt.claims.is_admin'')::boolean) = true);',
            table_name, table_name
        );
        
        -- Organization select policy
        EXECUTE format(
            'CREATE POLICY org_select_%I ON %I
             FOR SELECT
             TO authenticated
             USING (organization_id = (current_setting(''request.jwt.claims.organization_id'')::uuid));',
            table_name, table_name
        );
        
        -- Organization modify policy
        EXECUTE format(
            'CREATE POLICY org_modify_%I ON %I
             FOR ALL
             TO authenticated
             USING (organization_id = (current_setting(''request.jwt.claims.organization_id'')::uuid));',
            table_name, table_name
        );
    ELSE
        -- For tables without organization_id, create admin-only policy
        EXECUTE format(
            'CREATE POLICY admin_all_access_%I ON %I
             FOR ALL
             TO authenticated
             USING ((current_setting(''request.jwt.claims.is_admin'')::boolean) = true);',
            table_name, table_name
        );
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_organization_id_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'invoice_line_item' THEN
    NEW.organization_id := (SELECT organization_id FROM invoice_record WHERE id = NEW.invoice_id);
  ELSIF TG_TABLE_NAME = 'bill_line_item' THEN
    NEW.organization_id := (SELECT organization_id FROM bill_record WHERE id = NEW.bill_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qbo_sync_trigger_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Skip syncing if QBO is not connected for this org
  IF NOT EXISTS (
    SELECT 1
    FROM qbo_connection
    WHERE organization_id = NEW.organization_id
      AND is_active = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Otherwise, enqueue the sync operation with correct parameter order
  PERFORM public.qbo_enqueue_sync_operation(
    NEW.id,
    TG_TABLE_NAME::text,
    'UPDATE',
    NEW.organization_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_permission(permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role text;
  has_permission boolean;
BEGIN
  -- Get the user's role
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  
  -- Check if they have the permission
  SELECT EXISTS (
    SELECT 1 FROM public.role_permission_mapping
    WHERE role::text = user_role
    AND permission::text = $1
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qbo_webhook_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only process if QBO is connected for this org
  IF NOT EXISTS (
    SELECT 1
    FROM qbo_connection
    WHERE organization_id = NEW.organization_id
      AND is_connected = true
  ) THEN
    RETURN NULL;  -- ignore this webhook row
  END IF;

  -- Otherwise, let your existing logic run
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_sales_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM sales_order_line_item
  WHERE sales_order_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Sales order total does not match line items total. Order total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all sales_order_line_item rows match the sales_order_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_total NUMERIC;
  line_item_count INTEGER;
BEGIN
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO calculated_total, line_item_count
  FROM invoice_line_item
  WHERE invoice_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF line_item_count > 0 AND ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Invoice total does not match line items total. Invoice total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_credit_memo_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM credit_memo_line_item
  WHERE credit_memo_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Credit memo total does not match line items total. Memo total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all credit_memo_line_item rows match the credit_memo_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_purchase_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM purchase_order_line_item
  WHERE purchase_order_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Purchase order total does not match line items total. Order total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all purchase_order_line_item rows match the purchase_order_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qbo_sync_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_org_id UUID;
    v_entity_type TEXT;
    v_operation_type TEXT;
    v_sync_enabled BOOLEAN;
BEGIN
    -- Determine the operation type
    IF TG_OP = 'INSERT' THEN
        v_operation_type := 'CREATE';
    ELSIF TG_OP = 'UPDATE' THEN
        v_operation_type := 'UPDATE';
    ELSIF TG_OP = 'DELETE' THEN
        v_operation_type := 'DELETE';
    END IF;
    
    -- Get entity type from trigger name
    v_entity_type := TG_TABLE_NAME;
    
    -- Get organization ID
    IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.organization_id;
    ELSE
        v_org_id := NEW.organization_id;
    END IF;
    
    -- Check if sync is enabled for this entity type and organization
    SELECT EXISTS (
        SELECT 1 FROM qbo_entity_config
        WHERE entity_type = v_entity_type
        AND organization_id = v_org_id
        AND is_enabled = TRUE
    ) INTO v_sync_enabled;
    
    -- Enqueue sync operation if enabled
    IF v_sync_enabled THEN
        IF TG_OP = 'DELETE' THEN
            PERFORM qbo_enqueue_sync_operation(OLD.id, v_entity_type, v_operation_type, v_org_id);
        ELSE
            PERFORM qbo_enqueue_sync_operation(NEW.id, v_entity_type, v_operation_type, v_org_id);
        END IF;
    END IF;
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_resource permission_resource, p_action permission_action)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role USER_ROLE;
  v_has_override BOOLEAN;
  v_override_allowed BOOLEAN;
  v_default_allowed BOOLEAN;
BEGIN
  -- Get the user's role
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  
  -- Check if user has a specific override for this permission
  SELECT EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = p_user_id 
    AND resource = p_resource 
    AND action = p_action
  ) INTO v_has_override;
  
  -- If there's an override, use that value
  IF v_has_override THEN
    SELECT allowed INTO v_override_allowed 
    FROM user_permissions 
    WHERE user_id = p_user_id 
    AND resource = p_resource 
    AND action = p_action;
    RETURN v_override_allowed;
  END IF;
  
  -- Otherwise, fall back to the role's default permissions
  SELECT allowed INTO v_default_allowed 
  FROM role_permissions 
  WHERE role = v_role 
  AND resource = p_resource 
  AND action = p_action;
  
  -- Return the result, defaulting to false if no permission record found
  RETURN COALESCE(v_default_allowed, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_user_to_organization(p_email text, p_role user_role, p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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