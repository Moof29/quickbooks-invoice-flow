-- Create function to generate sales order number
CREATE OR REPLACE FUNCTION generate_sales_order_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
  order_number TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the next number for this year and organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'SO-' || year_suffix || '-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_order 
  WHERE organization_id = org_id 
    AND order_number LIKE 'SO-' || year_suffix || '-%';
  
  order_number := 'SO-' || year_suffix || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to get day of week quantity from template item
CREATE OR REPLACE FUNCTION get_template_item_quantity_for_date(
  monday_qty NUMERIC,
  tuesday_qty NUMERIC,
  wednesday_qty NUMERIC,
  thursday_qty NUMERIC,
  friday_qty NUMERIC,
  saturday_qty NUMERIC,
  sunday_qty NUMERIC,
  target_date DATE
)
RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to generate sales orders from customer templates
CREATE OR REPLACE FUNCTION generate_sales_orders_from_templates(
  p_date DATE DEFAULT CURRENT_DATE,
  p_organization_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_template_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
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
      SELECT cti.*, ir.name as item_name, ir.unit_price as item_price
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
        line_amount := qty_for_day * template_item_rec.unit_price;
        
        INSERT INTO sales_order_line_item (
          id,
          organization_id,
          sales_order_id,
          item_id,
          quantity,
          unit_price,
          amount,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          template_rec.organization_id,
          sales_order_id,
          template_item_rec.item_id,
          qty_for_day,
          template_item_rec.unit_price,
          line_amount,
          now(),
          now()
        );
        
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
$$ LANGUAGE plpgsql;

-- Create trigger function for customer template changes
CREATE OR REPLACE FUNCTION trigger_sales_order_generation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger function for customer template items changes
CREATE OR REPLACE FUNCTION trigger_template_items_sales_order_generation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER customer_template_sales_order_trigger
  AFTER INSERT OR UPDATE ON customer_templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sales_order_generation();

CREATE TRIGGER customer_template_items_sales_order_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customer_template_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_template_items_sales_order_generation();