-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.create_bulk_invoice_job(UUID[], UUID, DATE, INTEGER, JSONB);

-- Create function to queue bulk invoice job with user context
CREATE OR REPLACE FUNCTION public.create_bulk_invoice_job(
  p_sales_order_ids UUID[],
  p_organization_id UUID,
  p_invoice_date DATE,
  p_due_days INTEGER,
  p_user_context JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_payload JSONB;
BEGIN
  -- Build the payload with user context
  v_payload := jsonb_build_object(
    'sales_order_ids', p_sales_order_ids,
    'invoice_date', p_invoice_date,
    'due_days', p_due_days,
    'user_context', p_user_context
  );
  
  -- Create batch job
  INSERT INTO batch_job_queue (
    id,
    organization_id,
    job_type,
    status,
    priority,
    total_items,
    processed_items,
    successful_items,
    failed_items,
    payload,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    'bulk_invoice_generation',
    'pending',
    5,
    array_length(p_sales_order_ids, 1),
    0,
    0,
    0,
    v_payload,
    now(),
    now()
  ) RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;