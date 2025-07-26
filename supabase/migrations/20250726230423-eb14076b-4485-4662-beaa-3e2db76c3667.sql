-- Fix the sales order generation function to not insert into generated amount column
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
$$ LANGUAGE plpgsql;