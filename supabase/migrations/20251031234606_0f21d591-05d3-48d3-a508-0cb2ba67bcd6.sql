-- Create a high-performance batch order generation function
-- This replaces the slow edge function with a pure database solution

CREATE OR REPLACE FUNCTION public.generate_daily_orders_batch(
  p_organization_id UUID,
  p_target_dates DATE[],
  p_customer_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  orders_created INTEGER,
  dates_processed INTEGER,
  orders JSONB,
  errors JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_date DATE;
  v_order_date DATE := CURRENT_DATE;
  v_orders_created INTEGER := 0;
  v_dates_processed INTEGER := 0;
  v_orders_result JSONB := '[]'::JSONB;
  v_errors_result JSONB := '[]'::JSONB;
BEGIN
  -- Process each target date
  FOREACH v_target_date IN ARRAY p_target_dates
  LOOP
    DECLARE
      v_date_orders JSONB;
      v_date_errors JSONB;
      v_date_count INTEGER;
    BEGIN
      v_dates_processed := v_dates_processed + 1;
      
      -- Generate orders for this specific date
      WITH active_templates AS (
        -- Get active templates with customer info
        SELECT 
          ct.id as template_id,
          ct.customer_id,
          ct.name as template_name,
          cp.company_name as customer_name
        FROM customer_templates ct
        JOIN customer_profile cp ON ct.customer_id = cp.id
        WHERE ct.organization_id = p_organization_id
          AND ct.is_active = true
          AND (p_customer_ids IS NULL OR ct.customer_id = ANY(p_customer_ids))
      ),
      duplicate_check AS (
        -- Check for existing orders
        SELECT DISTINCT customer_id
        FROM invoice_record
        WHERE organization_id = p_organization_id
          AND delivery_date = v_target_date
          AND status = 'pending'
      ),
      valid_templates AS (
        -- Filter out customers with existing orders
        SELECT at.*
        FROM active_templates at
        WHERE NOT EXISTS (
          SELECT 1 FROM duplicate_check dc 
          WHERE dc.customer_id = at.customer_id
        )
      ),
      template_items_with_qty AS (
        -- Get line items for each template with correct day quantity
        SELECT 
          vt.template_id,
          vt.customer_id,
          vt.customer_name,
          vt.template_name,
          cti.item_id,
          cti.unit_price,
          CASE EXTRACT(DOW FROM v_target_date)
            WHEN 0 THEN cti.sunday_qty
            WHEN 1 THEN cti.monday_qty
            WHEN 2 THEN cti.tuesday_qty
            WHEN 3 THEN cti.wednesday_qty
            WHEN 4 THEN cti.thursday_qty
            WHEN 5 THEN cti.friday_qty
            WHEN 6 THEN cti.saturday_qty
          END as quantity
        FROM valid_templates vt
        JOIN customer_template_items cti ON cti.template_id = vt.template_id
        WHERE cti.organization_id = p_organization_id
          AND CASE EXTRACT(DOW FROM v_target_date)
            WHEN 0 THEN cti.sunday_qty
            WHEN 1 THEN cti.monday_qty
            WHEN 2 THEN cti.tuesday_qty
            WHEN 3 THEN cti.wednesday_qty
            WHEN 4 THEN cti.thursday_qty
            WHEN 5 THEN cti.friday_qty
            WHEN 6 THEN cti.saturday_qty
          END > 0
      ),
      invoice_numbers AS (
        -- Generate invoice numbers for all templates
        SELECT 
          template_id,
          customer_id,
          customer_name,
          template_name,
          'INV-' || TO_CHAR(v_target_date, 'YYYY') || '-' || 
          LPAD((ROW_NUMBER() OVER (ORDER BY template_id) + 
            COALESCE(
              (SELECT MAX(SUBSTRING(invoice_number FROM '\d+$')::INTEGER)
               FROM invoice_record
               WHERE organization_id = p_organization_id
                 AND invoice_number LIKE 'INV-' || TO_CHAR(v_target_date, 'YYYY') || '-%'
              ), 0
            ))::TEXT, 6, '0') as invoice_number
        FROM (SELECT DISTINCT template_id, customer_id, customer_name, template_name FROM template_items_with_qty) t
      ),
      created_invoices AS (
        -- Create all invoices in one go
        INSERT INTO invoice_record (
          organization_id,
          customer_id,
          invoice_number,
          status,
          order_date,
          delivery_date,
          memo,
          is_no_order,
          created_from_template,
          subtotal,
          total
        )
        SELECT 
          p_organization_id,
          inv.customer_id,
          inv.invoice_number,
          'pending',
          v_order_date,
          v_target_date,
          'Auto-generated from template: ' || inv.template_name,
          NOT EXISTS(SELECT 1 FROM template_items_with_qty ti WHERE ti.template_id = inv.template_id),
          true,
          0, -- Will be updated by trigger
          0  -- Will be updated by trigger
        FROM invoice_numbers inv
        RETURNING id, invoice_number, customer_id
      ),
      inserted_line_items AS (
        -- Create all line items in bulk
        INSERT INTO invoice_line_item (
          organization_id,
          invoice_id,
          item_id,
          quantity,
          unit_price
        )
        SELECT 
          p_organization_id,
          ci.id,
          ti.item_id,
          ti.quantity,
          ti.unit_price
        FROM created_invoices ci
        JOIN invoice_numbers inv ON inv.customer_id = ci.customer_id
        JOIN template_items_with_qty ti ON ti.template_id = inv.template_id
        RETURNING invoice_id
      )
      -- Collect results
      SELECT 
        COALESCE(jsonb_agg(jsonb_build_object(
          'invoice_id', ci.id,
          'invoice_number', ci.invoice_number,
          'customer_id', ci.customer_id,
          'customer_name', inv.customer_name,
          'delivery_date', v_target_date
        )), '[]'::JSONB),
        COUNT(*)
      INTO v_date_orders, v_date_count
      FROM created_invoices ci
      JOIN invoice_numbers inv ON inv.customer_id = ci.customer_id;
      
      -- Accumulate results
      v_orders_result := v_orders_result || v_date_orders;
      v_orders_created := v_orders_created + COALESCE(v_date_count, 0);
      
    EXCEPTION WHEN OTHERS THEN
      -- Capture any errors for this date
      v_errors_result := v_errors_result || jsonb_build_object(
        'date', v_target_date,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT 
    true,
    v_orders_created,
    v_dates_processed,
    v_orders_result,
    v_errors_result;
END;
$$;