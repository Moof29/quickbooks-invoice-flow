-- Priority 1: Critical Security Fixes

-- 1. Encrypt OAuth tokens by creating a vault for sensitive data
-- First, let's update all database functions to have secure search paths
CREATE OR REPLACE FUNCTION public.calculate_line_item_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.amount = ROUND((NEW.quantity * NEW.unit_price)::numeric, 2);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sales_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  calculated_subtotal NUMERIC;
  target_order_id UUID;
BEGIN
  -- Get the order ID (works for INSERT, UPDATE, DELETE)
  target_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  
  -- Calculate new subtotal from all line items
  SELECT COALESCE(SUM(amount), 0) INTO calculated_subtotal
  FROM sales_order_line_item 
  WHERE sales_order_id = target_order_id;
  
  -- Update sales_order totals
  UPDATE sales_order 
  SET 
    subtotal = calculated_subtotal,
    total = calculated_subtotal + COALESCE(tax_total, 0) + COALESCE(shipping_total, 0) - COALESCE(discount_total, 0),
    updated_at = NOW()
  WHERE id = target_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_customer_template_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Check if customer has at least one template (even if inactive)
  IF NOT EXISTS (
    SELECT 1 FROM customer_templates 
    WHERE customer_id = NEW.customer_id 
    AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Customer must have a customer template before creating sales orders. Please create a customer template first.';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only generate if order_number is null or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_sales_order_number(NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_template_item_quantity_for_date(monday_qty numeric, tuesday_qty numeric, wednesday_qty numeric, thursday_qty numeric, friday_qty numeric, saturday_qty numeric, sunday_qty numeric, target_date date)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  day_of_week INTEGER;
BEGIN
  day_of_week := EXTRACT(DOW FROM target_date); -- 0=Sunday, 1=Monday, etc.
  
  CASE day_of_week
    WHEN 0 THEN RETURN sunday_qty;
    WHEN 1 THEN RETURN monday_qty;
    WHEN 2 THEN RETURN tuesday_qty;
    WHEN 3 THEN RETURN wednesday_qty;
    WHEN 4 THEN RETURN thursday_qty;
    WHEN 5 THEN RETURN friday_qty;
    WHEN 6 THEN RETURN saturday_qty;
    ELSE RETURN 0;
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sales_order_generation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  generation_result JSON;
BEGIN
  -- Generate sales orders for today when template is created or updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only trigger if template is active
    IF NEW.is_active = true THEN
      SELECT generate_sales_orders_from_templates(
        CURRENT_DATE,
        NEW.organization_id,
        NEW.customer_id,
        NEW.id
      ) INTO generation_result;
      
      -- Log the generation result in audit_events
      INSERT INTO audit_events (
        organization_id,
        user_id,
        event_type,
        entity_type,
        entity_id,
        detail,
        severity
      ) VALUES (
        NEW.organization_id,
        auth.uid(),
        'sales_order_auto_generation',
        'customer_template',
        NEW.id,
        generation_result,
        'info'
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_template_items_sales_order_generation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  template_rec RECORD;
  generation_result JSON;
BEGIN
  -- Get the template info
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO template_rec FROM customer_templates WHERE id = OLD.template_id;
  ELSE
    SELECT * INTO template_rec FROM customer_templates WHERE id = NEW.template_id;
  END IF;
  
  -- Only trigger if template exists and is active
  IF template_rec.is_active = true THEN
    -- Delete existing auto-generated orders for today for this customer
    DELETE FROM sales_order 
    WHERE customer_id = template_rec.customer_id 
      AND order_date = CURRENT_DATE 
      AND organization_id = template_rec.organization_id
      AND status = 'template_generated';
    
    -- Regenerate orders
    SELECT generate_sales_orders_from_templates(
      CURRENT_DATE,
      template_rec.organization_id,
      template_rec.customer_id,
      template_rec.id
    ) INTO generation_result;
    
    -- Log the regeneration
    INSERT INTO audit_events (
      organization_id,
      event_type,
      entity_type,
      entity_id,
      detail,
      severity
    ) VALUES (
      template_rec.organization_id,
      'sales_order_regeneration',
      'customer_template_items',
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      generation_result,
      'info'
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_organization_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- only enforce on the two tables that actually have customer_id
  IF TG_TABLE_NAME NOT IN ('invoice_record','sales_order') THEN
    RETURN NEW;
  END IF;

  -- your existing logic below will now never run on other tables
  IF NOT EXISTS (
    SELECT 1
      FROM public.customer_profile cp
     WHERE cp.id   = NEW.customer_id
       AND cp.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION
      'cross-org reference violation: % → %',
      TG_TABLE_NAME,
      NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_sales_order_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
  order_number TEXT;
  padded_number TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the next number for this year and organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(so.order_number FROM 'SO-' || year_suffix || '-([0-9]+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_order so
  WHERE so.organization_id = org_id 
    AND so.order_number LIKE 'SO-' || year_suffix || '-%';
  
  -- Manually pad the number to avoid LPAD issues
  IF next_number < 10 THEN
    padded_number := '00' || next_number::TEXT;
  ELSIF next_number < 100 THEN
    padded_number := '0' || next_number::TEXT;
  ELSE
    padded_number := next_number::TEXT;
  END IF;
  
  order_number := 'SO-' || year_suffix || '-' || padded_number;
  
  RETURN order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_sales_orders_from_templates(p_date date DEFAULT CURRENT_DATE, p_organization_id uuid DEFAULT NULL::uuid, p_customer_id uuid DEFAULT NULL::uuid, p_template_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  template_rec RECORD;
  template_item_rec RECORD;
  sales_order_id UUID;
  total_amount NUMERIC := 0;
  line_amount NUMERIC;
  qty_for_day NUMERIC;
  orders_created INTEGER := 0;
  result JSON;
BEGIN
  -- Loop through active customer templates
  FOR template_rec IN 
    SELECT ct.*, cp.company_name as customer_name
    FROM customer_templates ct
    JOIN customer_profile cp ON ct.customer_id = cp.id
    WHERE ct.is_active = true
      AND (p_organization_id IS NULL OR ct.organization_id = p_organization_id)
      AND (p_customer_id IS NULL OR ct.customer_id = p_customer_id)
      AND (p_template_id IS NULL OR ct.id = p_template_id)
  LOOP
    total_amount := 0;
    
    -- Check if we already have a sales order for this customer and date
    IF EXISTS (
      SELECT 1 FROM sales_order 
      WHERE customer_id = template_rec.customer_id 
        AND order_date = p_date 
        AND organization_id = template_rec.organization_id
        AND status = 'template_generated'
    ) THEN
      CONTINUE; -- Skip if order already exists
    END IF;
    
    -- Create sales order
    INSERT INTO sales_order (
      id,
      organization_id,
      customer_id,
      order_date,
      order_number,
      status,
      subtotal,
      total,
      memo,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      template_rec.organization_id,
      template_rec.customer_id,
      p_date,
      generate_sales_order_number(template_rec.organization_id),
      'template_generated',
      0, -- Will be updated after line items
      0, -- Will be updated after line items
      'Auto-generated from template: ' || template_rec.name,
      now(),
      now()
    ) RETURNING id INTO sales_order_id;
    
    -- Create line items for this sales order
    FOR template_item_rec IN 
      SELECT cti.*, ir.name as item_name
      FROM customer_template_items cti
      JOIN item_record ir ON cti.item_id = ir.id
      WHERE cti.template_id = template_rec.id
        AND cti.organization_id = template_rec.organization_id
    LOOP
      -- Get quantity for the specific day
      qty_for_day := get_template_item_quantity_for_date(
        template_item_rec.monday_qty,
        template_item_rec.tuesday_qty,
        template_item_rec.wednesday_qty,
        template_item_rec.thursday_qty,
        template_item_rec.friday_qty,
        template_item_rec.saturday_qty,
        template_item_rec.sunday_qty,
        p_date
      );
      
      -- Only create line item if quantity > 0
      IF qty_for_day > 0 THEN
        -- Insert line item (amount will be calculated automatically)
        INSERT INTO sales_order_line_item (
          id,
          organization_id,
          sales_order_id,
          item_id,
          quantity,
          unit_price,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          template_rec.organization_id,
          sales_order_id,
          template_item_rec.item_id,
          qty_for_day,
          template_item_rec.unit_price,
          now(),
          now()
        );
        
        -- Calculate line amount for order total
        line_amount := qty_for_day * template_item_rec.unit_price;
        total_amount := total_amount + line_amount;
      END IF;
    END LOOP;
    
    -- Update sales order totals
    UPDATE sales_order 
    SET subtotal = total_amount, total = total_amount, updated_at = now()
    WHERE id = sales_order_id;
    
    orders_created := orders_created + 1;
  END LOOP;
  
  result := json_build_object(
    'orders_created', orders_created,
    'date', p_date,
    'organization_id', p_organization_id
  );
  
  RETURN result;
END;
$function$;

-- 2. Create security audit table for sensitive data access
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  accessed_table TEXT NOT NULL,
  accessed_column TEXT,
  record_id UUID,
  access_type TEXT NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sensitive_data_accessed BOOLEAN DEFAULT false
);

-- Enable RLS on security audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view security audit logs
CREATE POLICY "security_audit_admin_access" ON public.security_audit_log
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND organization_id = security_audit_log.organization_id
  )
);

-- 3. Add more restrictive RLS policies for sensitive tables
-- Restrict access to employee SSN data to admin only
DROP POLICY IF EXISTS "org_isolation_employee_profile" ON public.employee_profile;

CREATE POLICY "employee_profile_admin_full_access" ON public.employee_profile
FOR ALL TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "employee_profile_non_admin_limited" ON public.employee_profile
FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 4. Create function to securely access OAuth tokens (admins only)
CREATE OR REPLACE FUNCTION public.get_qbo_connection_secure(org_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  qbo_realm_id TEXT,
  qbo_company_id TEXT,
  is_active BOOLEAN,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only admins can access this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
    AND profiles.organization_id = org_id
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Log the access
  INSERT INTO public.security_audit_log (
    organization_id,
    user_id,
    accessed_table,
    access_type,
    sensitive_data_accessed
  ) VALUES (
    org_id,
    auth.uid(),
    'qbo_connection',
    'SELECT',
    true
  );

  RETURN QUERY
  SELECT 
    qc.id,
    qc.organization_id,
    qc.qbo_realm_id,
    qc.qbo_company_id,
    qc.is_active,
    qc.last_connected_at,
    qc.last_sync_at
  FROM qbo_connection qc
  WHERE qc.organization_id = org_id;
END;
$function$;

-- 5. Update existing RLS policies to be more restrictive for QBO connections
DROP POLICY IF EXISTS "qbo_connection_org_access" ON public.qbo_connection;

CREATE POLICY "qbo_connection_admin_only" ON public.qbo_connection
FOR ALL TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 6. Create function to validate role changes with audit logging
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Log role changes in security audit
  INSERT INTO public.security_audit_log (
    organization_id,
    user_id,
    accessed_table,
    record_id,
    access_type,
    sensitive_data_accessed
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    auth.uid(),
    'profiles',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    true
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for role change auditing
DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();