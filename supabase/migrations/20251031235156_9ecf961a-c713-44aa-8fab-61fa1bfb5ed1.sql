-- Completely rewrite as a single set-based operation (no loops)
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
  v_orders_result JSONB;
  v_orders_created INTEGER;
BEGIN
  -- Single set-based operation for ALL dates at once
  WITH unnested_dates AS (
    -- Convert date array to rows
    SELECT unnest(p_target_dates) as target_date
  ),
  active_templates AS (
    -- Get all active templates with customer info (cross join with all dates)
    SELECT 
      ct.id as template_id,
      ct.customer_id,
      ct.name as template_name,
      cp.company_name as customer_name,
      d.target_date,
      EXTRACT(DOW FROM d.target_date)::INTEGER as day_of_week
    FROM customer_templates ct
    JOIN customer_profile cp ON ct.customer_id = cp.id
    CROSS JOIN unnested_dates d
    WHERE ct.organization_id = p_organization_id
      AND ct.is_active = true
      AND (p_customer_ids IS NULL OR ct.customer_id = ANY(p_customer_ids))
  ),
  duplicate_check AS (
    -- Check for existing orders across all dates
    SELECT DISTINCT customer_id, delivery_date
    FROM invoice_record
    WHERE organization_id = p_organization_id
      AND delivery_date = ANY(p_target_dates)
      AND status = 'pending'
  ),
  valid_templates AS (
    -- Filter out duplicates
    SELECT at.*
    FROM active_templates at
    WHERE NOT EXISTS (
      SELECT 1 FROM duplicate_check dc 
      WHERE dc.customer_id = at.customer_id 
        AND dc.delivery_date = at.target_date
    )
  ),
  template_items_with_qty AS (
    -- Get line items with correct day quantity for ALL templates and dates
    SELECT 
      vt.template_id,
      vt.customer_id,
      vt.customer_name,
      vt.template_name,
      vt.target_date,
      cti.item_id,
      cti.unit_price,
      CASE vt.day_of_week
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
  ),
  templates_with_items AS (
    -- Check which templates have items
    SELECT DISTINCT template_id, customer_id, customer_name, template_name, target_date
    FROM template_items_with_qty
    WHERE quantity > 0
  ),
  all_templates_for_invoice AS (
    -- Include templates even without items (for no-order flag)
    SELECT DISTINCT 
      vt.template_id, 
      vt.customer_id, 
      vt.customer_name, 
      vt.template_name, 
      vt.target_date,
      EXISTS(SELECT 1 FROM templates_with_items twi 
             WHERE twi.template_id = vt.template_id 
               AND twi.target_date = vt.target_date) as has_items
    FROM valid_templates vt
  ),
  invoice_numbers AS (
    -- Generate invoice numbers for ALL invoices at once
    SELECT 
      template_id,
      customer_id,
      customer_name,
      template_name,
      target_date,
      has_items,
      'INV-' || TO_CHAR(target_date, 'YYYY') || '-' || 
      LPAD((ROW_NUMBER() OVER (ORDER BY target_date, template_id) + 
        COALESCE(
          (SELECT MAX(SUBSTRING(invoice_number FROM '\d+$')::INTEGER)
           FROM invoice_record
           WHERE organization_id = p_organization_id
             AND invoice_number LIKE 'INV-%'
          ), 0
        ))::TEXT, 6, '0') as invoice_number
    FROM all_templates_for_invoice
  ),
  created_invoices AS (
    -- Create ALL invoices in a single INSERT
    INSERT INTO invoice_record (
      organization_id,
      customer_id,
      invoice_number,
      status,
      order_date,
      delivery_date,
      memo,
      is_no_order,
      subtotal,
      total
    )
    SELECT 
      p_organization_id,
      inv.customer_id,
      inv.invoice_number,
      'pending',
      CURRENT_DATE,
      inv.target_date,
      'Auto-generated from template: ' || inv.template_name,
      NOT inv.has_items,
      0,
      0
    FROM invoice_numbers inv
    RETURNING id, invoice_number, customer_id, delivery_date
  ),
  inserted_line_items AS (
    -- Create ALL line items in a single bulk INSERT
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
    JOIN invoice_numbers inv ON inv.customer_id = ci.customer_id AND inv.target_date = ci.delivery_date
    JOIN template_items_with_qty ti ON ti.template_id = inv.template_id AND ti.target_date = inv.target_date
    WHERE ti.quantity > 0
    RETURNING invoice_id
  )
  -- Collect ALL results
  SELECT 
    jsonb_agg(jsonb_build_object(
      'invoice_id', ci.id,
      'invoice_number', ci.invoice_number,
      'customer_id', ci.customer_id,
      'customer_name', inv.customer_name,
      'delivery_date', ci.delivery_date
    )),
    COUNT(*)::INTEGER
  INTO v_orders_result, v_orders_created
  FROM created_invoices ci
  JOIN invoice_numbers inv ON inv.customer_id = ci.customer_id AND inv.target_date = ci.delivery_date;
  
  -- Return results
  RETURN QUERY SELECT 
    true,
    COALESCE(v_orders_created, 0),
    array_length(p_target_dates, 1),
    COALESCE(v_orders_result, '[]'::JSONB),
    '[]'::JSONB; -- No errors in this simplified version
    
EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN QUERY SELECT 
    false,
    0,
    array_length(p_target_dates, 1),
    '[]'::JSONB,
    jsonb_build_array(jsonb_build_object('error', SQLERRM));
END;
$$;