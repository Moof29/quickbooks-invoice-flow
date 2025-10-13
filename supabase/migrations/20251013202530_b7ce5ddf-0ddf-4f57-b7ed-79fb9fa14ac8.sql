-- Create efficient function to clear all invoices for an organization
CREATE OR REPLACE FUNCTION clear_all_invoices(p_organization_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_count INTEGER;
  v_line_item_count INTEGER;
  v_link_count INTEGER;
  v_reset_count INTEGER;
BEGIN
  -- Count records for reporting
  SELECT COUNT(*) INTO v_invoice_count 
  FROM invoice_record WHERE organization_id = p_organization_id;
  
  SELECT COUNT(*) INTO v_line_item_count 
  FROM invoice_line_item WHERE organization_id = p_organization_id;
  
  SELECT COUNT(*) INTO v_link_count 
  FROM sales_order_invoice_link WHERE organization_id = p_organization_id;
  
  -- Delete invoice line items (must be first due to foreign key)
  DELETE FROM invoice_line_item WHERE organization_id = p_organization_id;
  
  -- Delete sales order invoice links
  DELETE FROM sales_order_invoice_link WHERE organization_id = p_organization_id;
  
  -- Delete all invoices
  DELETE FROM invoice_record WHERE organization_id = p_organization_id;
  
  -- Reset sales orders back to reviewed status
  WITH updated AS (
    UPDATE sales_order 
    SET status = 'reviewed',
        invoiced = false,
        invoice_id = NULL,
        updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND invoiced = true
    RETURNING *
  )
  SELECT COUNT(*) INTO v_reset_count FROM updated;
  
  -- Return summary
  RETURN json_build_object(
    'invoices_deleted', v_invoice_count,
    'line_items_deleted', v_line_item_count,
    'links_deleted', v_link_count,
    'orders_reset', v_reset_count
  );
END;
$$;