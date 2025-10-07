-- Update function to only regenerate PENDING orders (not reviewed)
CREATE OR REPLACE FUNCTION public.regenerate_future_orders_from_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  future_date DATE;
  existing_orders RECORD;
BEGIN
  -- Only process if template is active
  IF TG_OP = 'UPDATE' AND NEW.is_active = true THEN
    -- Find all future PENDING sales orders for this customer (exclude reviewed)
    FOR existing_orders IN 
      SELECT DISTINCT delivery_date 
      FROM sales_order
      WHERE customer_id = NEW.customer_id
        AND organization_id = NEW.organization_id
        AND delivery_date >= CURRENT_DATE
        AND status = 'pending'  -- ONLY pending orders
        AND invoiced = false
      ORDER BY delivery_date
    LOOP
      -- Delete existing line items
      DELETE FROM sales_order_line_item
      WHERE sales_order_id IN (
        SELECT id FROM sales_order
        WHERE customer_id = NEW.customer_id
          AND organization_id = NEW.organization_id
          AND delivery_date = existing_orders.delivery_date
          AND status = 'pending'
      );

      -- Get template items for this date
      DECLARE
        day_of_week INTEGER;
        template_item RECORD;
        order_id UUID;
        has_items BOOLEAN := false;
      BEGIN
        day_of_week := EXTRACT(DOW FROM existing_orders.delivery_date);
        
        -- Get the order ID
        SELECT id INTO order_id
        FROM sales_order
        WHERE customer_id = NEW.customer_id
          AND organization_id = NEW.organization_id
          AND delivery_date = existing_orders.delivery_date
          AND status = 'pending'
        LIMIT 1;

        IF order_id IS NOT NULL THEN
          -- Insert new line items based on updated template
          FOR template_item IN
            SELECT 
              item_id,
              unit_price,
              CASE day_of_week
                WHEN 0 THEN sunday_qty
                WHEN 1 THEN monday_qty
                WHEN 2 THEN tuesday_qty
                WHEN 3 THEN wednesday_qty
                WHEN 4 THEN thursday_qty
                WHEN 5 THEN friday_qty
                WHEN 6 THEN saturday_qty
              END as quantity
            FROM customer_template_items
            WHERE template_id = NEW.id
              AND organization_id = NEW.organization_id
          LOOP
            IF template_item.quantity > 0 THEN
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
                NEW.organization_id,
                order_id,
                template_item.item_id,
                template_item.quantity,
                template_item.unit_price,
                now(),
                now()
              );
              has_items := true;
            END IF;
          END LOOP;

          -- Update is_no_order_today flag
          UPDATE sales_order
          SET 
            is_no_order_today = NOT has_items,
            updated_at = now()
          WHERE id = order_id;
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Update function to only regenerate PENDING orders when template items change
CREATE OR REPLACE FUNCTION public.regenerate_orders_on_template_items_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  template_rec RECORD;
  future_date DATE;
  existing_orders RECORD;
BEGIN
  -- Get the template info
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO template_rec FROM customer_templates WHERE id = OLD.template_id;
  ELSE
    SELECT * INTO template_rec FROM customer_templates WHERE id = NEW.template_id;
  END IF;

  -- Only process if template exists and is active
  IF template_rec.is_active = true THEN
    -- Find all future PENDING sales orders for this customer (exclude reviewed)
    FOR existing_orders IN 
      SELECT DISTINCT delivery_date 
      FROM sales_order
      WHERE customer_id = template_rec.customer_id
        AND organization_id = template_rec.organization_id
        AND delivery_date >= CURRENT_DATE
        AND status = 'pending'  -- ONLY pending orders
        AND invoiced = false
      ORDER BY delivery_date
    LOOP
      -- Delete existing line items
      DELETE FROM sales_order_line_item
      WHERE sales_order_id IN (
        SELECT id FROM sales_order
        WHERE customer_id = template_rec.customer_id
          AND organization_id = template_rec.organization_id
          AND delivery_date = existing_orders.delivery_date
          AND status = 'pending'
      );

      -- Regenerate line items
      DECLARE
        day_of_week INTEGER;
        template_item RECORD;
        order_id UUID;
        has_items BOOLEAN := false;
      BEGIN
        day_of_week := EXTRACT(DOW FROM existing_orders.delivery_date);
        
        SELECT id INTO order_id
        FROM sales_order
        WHERE customer_id = template_rec.customer_id
          AND organization_id = template_rec.organization_id
          AND delivery_date = existing_orders.delivery_date
          AND status = 'pending'
        LIMIT 1;

        IF order_id IS NOT NULL THEN
          FOR template_item IN
            SELECT 
              item_id,
              unit_price,
              CASE day_of_week
                WHEN 0 THEN sunday_qty
                WHEN 1 THEN monday_qty
                WHEN 2 THEN tuesday_qty
                WHEN 3 THEN wednesday_qty
                WHEN 4 THEN thursday_qty
                WHEN 5 THEN friday_qty
                WHEN 6 THEN saturday_qty
              END as quantity
            FROM customer_template_items
            WHERE template_id = template_rec.id
              AND organization_id = template_rec.organization_id
          LOOP
            IF template_item.quantity > 0 THEN
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
                order_id,
                template_item.item_id,
                template_item.quantity,
                template_item.unit_price,
                now(),
                now()
              );
              has_items := true;
            END IF;
          END LOOP;

          -- Update is_no_order_today flag
          UPDATE sales_order
          SET 
            is_no_order_today = NOT has_items,
            updated_at = now()
          WHERE id = order_id;
        END IF;
      END;
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;