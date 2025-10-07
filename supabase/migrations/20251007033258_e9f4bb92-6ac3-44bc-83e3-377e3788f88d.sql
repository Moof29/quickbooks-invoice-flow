-- Create appropriate test sales order data
-- This creates realistic test data showcasing the new schema

-- Get the first organization and customers to use for test data
DO $$
DECLARE
  v_org_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_item1_id UUID;
  v_item2_id UUID;
  v_order1_id UUID;
  v_order2_id UUID;
  v_order3_id UUID;
  v_order4_id UUID;
  v_order5_id UUID;
BEGIN
  -- Get first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  -- Get first 3 customers
  SELECT id INTO v_customer1_id FROM customer_profile WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;
  SELECT id INTO v_customer2_id FROM customer_profile WHERE organization_id = v_org_id ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_customer3_id FROM customer_profile WHERE organization_id = v_org_id ORDER BY created_at OFFSET 2 LIMIT 1;
  
  -- Get first 2 items
  SELECT id INTO v_item1_id FROM item_record WHERE organization_id = v_org_id ORDER BY created_at LIMIT 1;
  SELECT id INTO v_item2_id FROM item_record WHERE organization_id = v_org_id ORDER BY created_at OFFSET 1 LIMIT 1;
  
  -- Only create test data if we have the necessary records
  IF v_org_id IS NOT NULL AND v_customer1_id IS NOT NULL AND v_item1_id IS NOT NULL THEN
    
    -- Order 1: Today's order - Pending status
    INSERT INTO sales_order (
      id, organization_id, customer_id, order_date, delivery_date,
      order_number, status, subtotal, total, is_no_order_today, invoiced
    ) VALUES (
      gen_random_uuid(), v_org_id, v_customer1_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day',
      'SO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-001', 'pending', 250.00, 250.00, false, false
    ) RETURNING id INTO v_order1_id;
    
    -- Add line items for order 1
    INSERT INTO sales_order_line_item (
      organization_id, sales_order_id, item_id, quantity, unit_price
    ) VALUES 
      (v_org_id, v_order1_id, v_item1_id, 10, 25.00);
    
    -- Order 2: Tomorrow's order - Reviewed status
    IF v_customer2_id IS NOT NULL THEN
      INSERT INTO sales_order (
        id, organization_id, customer_id, order_date, delivery_date,
        order_number, status, subtotal, total, is_no_order_today, invoiced,
        approved_at
      ) VALUES (
        gen_random_uuid(), v_org_id, v_customer2_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days',
        'SO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-002', 'reviewed', 500.00, 500.00, false, false,
        NOW()
      ) RETURNING id INTO v_order2_id;
      
      -- Add line items for order 2
      IF v_item2_id IS NOT NULL THEN
        INSERT INTO sales_order_line_item (
          organization_id, sales_order_id, item_id, quantity, unit_price
        ) VALUES 
          (v_org_id, v_order2_id, v_item1_id, 15, 25.00),
          (v_org_id, v_order2_id, v_item2_id, 10, 12.50);
      END IF;
    END IF;
    
    -- Order 3: "No Order Today" - zero quantities
    IF v_customer3_id IS NOT NULL THEN
      INSERT INTO sales_order (
        id, organization_id, customer_id, order_date, delivery_date,
        order_number, status, subtotal, total, is_no_order_today, invoiced,
        memo
      ) VALUES (
        gen_random_uuid(), v_org_id, v_customer3_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day',
        'SO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-003', 'pending', 0.00, 0.00, true, false,
        'Customer called: No delivery needed today'
      ) RETURNING id INTO v_order3_id;
    END IF;
    
    -- Order 4: Yesterday's order - Invoiced (cannot be deleted)
    INSERT INTO sales_order (
      id, organization_id, customer_id, order_date, delivery_date,
      order_number, status, subtotal, total, is_no_order_today, invoiced
    ) VALUES (
      gen_random_uuid(), v_org_id, v_customer1_id, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE,
      'SO-' || TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY') || '-100', 'invoiced', 375.00, 375.00, false, true
    ) RETURNING id INTO v_order4_id;
    
    -- Add line items for order 4
    INSERT INTO sales_order_line_item (
      organization_id, sales_order_id, item_id, quantity, unit_price
    ) VALUES 
      (v_org_id, v_order4_id, v_item1_id, 15, 25.00);
    
    -- Order 5: Next week - Pending
    IF v_customer2_id IS NOT NULL THEN
      INSERT INTO sales_order (
        id, organization_id, customer_id, order_date, delivery_date,
        order_number, status, subtotal, total, is_no_order_today, invoiced
      ) VALUES (
        gen_random_uuid(), v_org_id, v_customer2_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days',
        'SO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-004', 'pending', 125.00, 125.00, false, false
      ) RETURNING id INTO v_order5_id;
      
      -- Add line items for order 5
      INSERT INTO sales_order_line_item (
        organization_id, sales_order_id, item_id, quantity, unit_price
      ) VALUES 
        (v_org_id, v_order5_id, v_item1_id, 5, 25.00);
    END IF;
    
  END IF;
END $$;