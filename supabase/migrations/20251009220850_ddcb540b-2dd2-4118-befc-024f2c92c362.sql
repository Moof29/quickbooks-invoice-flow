-- Create function to bulk create sales orders with line items
CREATE OR REPLACE FUNCTION public.bulk_create_sales_orders_from_templates(
  p_orders jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order jsonb;
  v_line_item jsonb;
  v_order_id uuid;
  v_order_number text;
  v_year integer;
  v_created_orders jsonb := '[]'::jsonb;
  v_line_items_batch jsonb[];
  v_has_items boolean;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Process each order
  FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_has_items := false;
    v_line_items_batch := ARRAY[]::jsonb[];
    
    -- Get next order number atomically
    v_order_number := get_next_order_number(
      (v_order->>'organization_id')::uuid,
      v_year
    );
    
    -- Generate order ID
    v_order_id := gen_random_uuid();
    
    -- Insert the sales order
    INSERT INTO sales_order (
      id,
      organization_id,
      customer_id,
      order_date,
      delivery_date,
      status,
      order_number,
      subtotal,
      total,
      is_no_order_today,
      invoiced,
      memo
    ) VALUES (
      v_order_id,
      (v_order->>'organization_id')::uuid,
      (v_order->>'customer_id')::uuid,
      (v_order->>'order_date')::date,
      (v_order->>'delivery_date')::date,
      v_order->>'status',
      v_order_number,
      0,
      0,
      (v_order->>'is_no_order_today')::boolean,
      false,
      v_order->>'memo'
    );
    
    -- Insert line items if present
    IF v_order ? 'line_items' THEN
      FOR v_line_item IN SELECT * FROM jsonb_array_elements(v_order->'line_items')
      LOOP
        IF (v_line_item->>'quantity')::numeric > 0 THEN
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
            (v_order->>'organization_id')::uuid,
            v_order_id,
            (v_line_item->>'item_id')::uuid,
            (v_line_item->>'quantity')::numeric,
            (v_line_item->>'unit_price')::numeric,
            now(),
            now()
          );
          v_has_items := true;
        END IF;
      END LOOP;
    END IF;
    
    -- Update order totals (triggers will calculate amounts)
    -- Just need to refresh the order
    UPDATE sales_order
    SET 
      is_no_order_today = NOT v_has_items,
      updated_at = now()
    WHERE id = v_order_id;
    
    -- Add to created orders list
    v_created_orders := v_created_orders || jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_id', v_order->>'customer_id'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'orders_created', jsonb_array_length(v_created_orders),
    'orders', v_created_orders
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;