-- Fix create_invoice_from_sales_order to not insert generated columns
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
  v_user_id UUID;
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
  
  -- Get user ID (from auth context or from provided context)
  v_user_id := auth.uid();
  
  -- If no auth context, use provided user context
  IF v_user_id IS NULL AND p_user_context IS NOT NULL THEN
    v_user_id := (p_user_context->>'user_id')::UUID;
    v_created_by_metadata := p_user_context;
  ELSIF v_user_id IS NOT NULL THEN
    -- Build metadata from auth context
    v_created_by_metadata := jsonb_build_object(
      'user_id', v_user_id,
      'source', 'create_invoice_from_sales_order',
      'timestamp', NOW()
    );
  ELSE
    -- No context at all - use system metadata
    v_created_by_metadata := jsonb_build_object(
      'source', 'system',
      'function', 'create_invoice_from_sales_order',
      'timestamp', NOW()
    );
  END IF;
  
  -- Generate invoice number
  v_invoice_number := get_next_invoice_number(v_organization_id);
  
  -- Create invoice record (created_by can be null for edge functions)
  INSERT INTO invoice_record (
    organization_id,
    customer_id,
    invoice_number,
    invoice_date,
    due_date,
    status,
    created_by
  ) VALUES (
    v_organization_id,
    v_customer_id,
    v_invoice_number,
    p_invoice_date,
    p_invoice_date + p_due_days,
    'draft',
    v_user_id  -- Can be NULL
  ) RETURNING id INTO v_invoice_id;
  
  -- Copy line items from sales order
  -- CRITICAL: Do NOT include 'amount' - it's a GENERATED column
  INSERT INTO invoice_line_item (
    organization_id,
    invoice_id,
    item_id,
    description,
    quantity,
    unit_price,
    tax_rate,
    created_by
  )
  SELECT 
    organization_id,
    v_invoice_id,
    item_id,
    description,
    quantity,
    unit_price,
    tax_rate,
    v_user_id  -- Can be NULL
  FROM sales_order_line_item
  WHERE sales_order_id = p_sales_order_id;
  
  -- Link sales order to invoice (using metadata approach)
  INSERT INTO sales_order_invoice_link (
    sales_order_id,
    invoice_id,
    organization_id,
    created_by,
    created_by_metadata
  ) VALUES (
    p_sales_order_id,
    v_invoice_id,
    v_organization_id,
    v_user_id,  -- Can be NULL for edge functions
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