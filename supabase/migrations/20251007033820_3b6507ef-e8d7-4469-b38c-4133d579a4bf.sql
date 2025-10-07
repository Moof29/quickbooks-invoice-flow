-- PROMPT 2: Database Functions - Duplicate Detection & Validation

-- Function 1: Check for duplicate orders (same customer, same delivery date)
CREATE OR REPLACE FUNCTION check_duplicate_orders(
  p_customer_id UUID,
  p_delivery_date DATE,
  p_organization_id UUID,
  p_exclude_order_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_existing_order RECORD;
  v_result JSON;
BEGIN
  -- Look for existing order with same customer and delivery date
  SELECT 
    id,
    order_number,
    status,
    total,
    is_no_order_today
  INTO v_existing_order
  FROM sales_order
  WHERE customer_id = p_customer_id
    AND delivery_date = p_delivery_date
    AND organization_id = p_organization_id
    AND (p_exclude_order_id IS NULL OR id != p_exclude_order_id)
  LIMIT 1;
  
  IF FOUND THEN
    v_result := json_build_object(
      'has_duplicate', true,
      'existing_order', json_build_object(
        'id', v_existing_order.id,
        'order_number', v_existing_order.order_number,
        'status', v_existing_order.status,
        'total', v_existing_order.total,
        'is_no_order_today', v_existing_order.is_no_order_today
      )
    );
  ELSE
    v_result := json_build_object(
      'has_duplicate', false,
      'existing_order', NULL
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function 2: Validate order before converting to invoice
CREATE OR REPLACE FUNCTION validate_order_before_invoice(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_line_item_count INTEGER;
  v_has_quantities BOOLEAN;
  v_result JSON;
  v_error_message TEXT := NULL;
BEGIN
  -- Get order details
  SELECT 
    id,
    status,
    invoiced,
    is_no_order_today,
    total,
    organization_id
  INTO v_order
  FROM sales_order
  WHERE id = p_order_id;
  
  -- Check if order exists
  IF NOT FOUND THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order not found'
    );
    RETURN v_result;
  END IF;
  
  -- Check if already invoiced
  IF v_order.invoiced = true THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order is already invoiced'
    );
    RETURN v_result;
  END IF;
  
  -- Check if status is 'reviewed'
  IF v_order.status != 'reviewed' THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order must be in "reviewed" status before invoicing. Current status: ' || v_order.status
    );
    RETURN v_result;
  END IF;
  
  -- Check if it's a "no order today"
  IF v_order.is_no_order_today = true THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Cannot invoice a "No Order Today" order with zero quantities'
    );
    RETURN v_result;
  END IF;
  
  -- Check if order has line items with quantities > 0
  SELECT COUNT(*) INTO v_line_item_count
  FROM sales_order_line_item
  WHERE sales_order_id = p_order_id
    AND organization_id = v_order.organization_id;
  
  IF v_line_item_count = 0 THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order has no line items'
    );
    RETURN v_result;
  END IF;
  
  -- Check if any line items have quantity > 0
  SELECT EXISTS(
    SELECT 1 FROM sales_order_line_item
    WHERE sales_order_id = p_order_id
      AND organization_id = v_order.organization_id
      AND quantity > 0
  ) INTO v_has_quantities;
  
  IF NOT v_has_quantities THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order has no line items with quantities greater than zero'
    );
    RETURN v_result;
  END IF;
  
  -- Check if total is valid (> 0)
  IF v_order.total <= 0 THEN
    v_result := json_build_object(
      'can_invoice', false,
      'error_message', 'Order total must be greater than zero'
    );
    RETURN v_result;
  END IF;
  
  -- All validations passed
  v_result := json_build_object(
    'can_invoice', true,
    'error_message', NULL
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function 3: Update validate_sales_order_totals to auto-set is_no_order_today flag
CREATE OR REPLACE FUNCTION validate_sales_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  calculated_total NUMERIC;
  v_all_zero_quantities BOOLEAN;
BEGIN
  -- Calculate total from line items
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM sales_order_line_item
  WHERE sales_order_id = NEW.id
    AND organization_id = NEW.organization_id;

  -- Check if total matches (allow 1 cent tolerance for rounding)
  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Sales order total does not match line items total. Order total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all sales_order_line_item rows match the sales_order_id and organization_id.',
            ERRCODE = '22000';
  END IF;
  
  -- Check if all line items have zero quantities
  SELECT NOT EXISTS(
    SELECT 1 FROM sales_order_line_item
    WHERE sales_order_id = NEW.id
      AND organization_id = NEW.organization_id
      AND quantity > 0
  ) INTO v_all_zero_quantities;
  
  -- Auto-set is_no_order_today flag
  IF v_all_zero_quantities THEN
    NEW.is_no_order_today := true;
  ELSE
    NEW.is_no_order_today := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;