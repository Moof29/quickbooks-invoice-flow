-- Drop the existing function first
DROP FUNCTION IF EXISTS public.clear_all_invoices(uuid);

-- Create optimized function that deletes in batches to avoid timeout
CREATE OR REPLACE FUNCTION public.clear_all_invoices(p_organization_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_size INTEGER := 1000;
  v_deleted_count INTEGER;
  v_total_invoices INTEGER := 0;
  v_total_line_items INTEGER := 0;
  v_total_links INTEGER := 0;
  v_reset_orders INTEGER := 0;
BEGIN
  -- Delete invoice line items in batches
  LOOP
    DELETE FROM invoice_line_item 
    WHERE id IN (
      SELECT id FROM invoice_line_item 
      WHERE organization_id = p_organization_id 
      LIMIT v_batch_size
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_line_items := v_total_line_items + v_deleted_count;
    EXIT WHEN v_deleted_count = 0;
  END LOOP;
  
  -- Delete sales order invoice links in batches
  LOOP
    DELETE FROM sales_order_invoice_link 
    WHERE id IN (
      SELECT id FROM sales_order_invoice_link 
      WHERE organization_id = p_organization_id 
      LIMIT v_batch_size
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_links := v_total_links + v_deleted_count;
    EXIT WHEN v_deleted_count = 0;
  END LOOP;
  
  -- Delete invoices in batches
  LOOP
    DELETE FROM invoice_record 
    WHERE id IN (
      SELECT id FROM invoice_record 
      WHERE organization_id = p_organization_id 
      LIMIT v_batch_size
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_invoices := v_total_invoices + v_deleted_count;
    EXIT WHEN v_deleted_count = 0;
  END LOOP;
  
  -- Reset sales orders back to reviewed status
  UPDATE sales_order 
  SET status = 'reviewed',
      invoiced = false,
      invoice_id = NULL,
      updated_at = NOW()
  WHERE organization_id = p_organization_id
    AND invoiced = true;
  GET DIAGNOSTICS v_reset_orders = ROW_COUNT;
  
  -- Return summary
  RETURN json_build_object(
    'invoices_deleted', v_total_invoices,
    'line_items_deleted', v_total_line_items,
    'links_deleted', v_total_links,
    'orders_reset', v_reset_orders
  );
END;
$$;