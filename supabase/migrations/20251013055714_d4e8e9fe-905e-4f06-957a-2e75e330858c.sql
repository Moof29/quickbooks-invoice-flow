-- Force refresh the function to use the updated schema
DROP FUNCTION IF EXISTS public.create_invoice_from_sales_order(uuid, date, integer, jsonb);

CREATE OR REPLACE FUNCTION public.create_invoice_from_sales_order(
  p_sales_order_id uuid,
  p_invoice_date date DEFAULT CURRENT_DATE,
  p_due_days integer DEFAULT 30,
  p_user_context jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invoice_id UUID;
  v_organization_id UUID;
  v_customer_id UUID;
  v_invoice_number TEXT;
  v_created_by_metadata JSONB;
BEGIN
  -- Get sales order details
  SELECT organization_id, customer_id
  INTO v_organization_id, v_customer_id
  FROM sales_order
  WHERE id = p_sales_order_id;
  
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Sales order not found: %', p_sales_order_id;
  END IF;
  
  -- Check if already invoiced
  IF EXISTS (SELECT 1 FROM sales_order WHERE id = p_sales_order_id AND invoiced = true) THEN
    RAISE EXCEPTION 'Sales order already invoiced: %', p_sales_order_id;
  END IF;
  
  -- Build metadata (no user_id needed for batch jobs)
  v_created_by_metadata := jsonb_build_object(
    'source', 'system',
    'function', 'create_invoice_from_sales_order',
    'timestamp', NOW(),
    'user_context', p_user_context
  );
  
  -- Generate invoice number
  v_invoice_number := get_next_invoice_number(v_organization_id);
  
  -- Create invoice record (no created_by for batch jobs)
  INSERT INTO invoice_record (
    organization_id,
    customer_id,
    invoice_number,
    invoice_date,
    due_date,
    status
  ) VALUES (
    v_organization_id,
    v_customer_id,
    v_invoice_number,
    p_invoice_date,
    p_invoice_date + p_due_days,
    'draft'
  ) RETURNING id INTO v_invoice_id;
  
  -- Copy line items from sales order
  -- CRITICAL: Do NOT include 'amount' or 'created_by' - amount is GENERATED, created_by can be null
  INSERT INTO invoice_line_item (
    organization_id,
    invoice_id,
    item_id,
    description,
    quantity,
    unit_price,
    tax_rate
  )
  SELECT 
    organization_id,
    v_invoice_id,
    item_id,
    description,
    quantity,
    unit_price,
    tax_rate
  FROM sales_order_line_item
  WHERE sales_order_id = p_sales_order_id;
  
  -- Link sales order to invoice
  INSERT INTO sales_order_invoice_link (
    sales_order_id,
    invoice_id,
    organization_id,
    created_by_metadata
  ) VALUES (
    p_sales_order_id,
    v_invoice_id,
    v_organization_id,
    v_created_by_metadata
  );
  
  -- Mark sales order as invoiced
  UPDATE sales_order
  SET 
    invoiced = true,
    invoice_id = v_invoice_id,
    updated_at = NOW()
  WHERE id = p_sales_order_id;
  
  RETURN v_invoice_id;
END;
$function$;