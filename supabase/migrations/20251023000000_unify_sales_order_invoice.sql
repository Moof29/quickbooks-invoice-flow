-- Unified Invoice/Order Migration
-- Merges sales_order functionality into invoice_record table

-- Step 1: Backup existing sales_order table
ALTER TABLE IF EXISTS sales_order RENAME TO sales_order_archived;
ALTER TABLE IF EXISTS sales_order_line_item RENAME TO sales_order_line_item_archived;

-- Step 2: Add new columns to invoice_record
ALTER TABLE invoice_record
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS order_date DATE,
  ADD COLUMN IF NOT EXISTS is_no_order BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS promised_ship_date DATE,
  ADD COLUMN IF NOT EXISTS requested_ship_date DATE,
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT;

-- Step 3: Add new columns to invoice_line_item
-- (already has what we need, just verify)

-- Step 4: Migrate data from sales_order_archived to invoice_record
INSERT INTO invoice_record (
  organization_id,
  customer_id,
  invoice_number,
  order_date,
  delivery_date,
  status,
  is_no_order,
  approved_at,
  approved_by,
  promised_ship_date,
  requested_ship_date,
  customer_po_number,
  memo,
  message,
  terms,
  subtotal,
  total,
  source_system,
  created_at,
  created_by,
  updated_at,
  updated_by
)
SELECT
  organization_id,
  customer_id,
  order_number, -- Maps to invoice_number
  order_date,
  delivery_date,
  CASE
    WHEN status = 'pending' THEN 'draft'
    WHEN status = 'reviewed' THEN 'confirmed'
    WHEN invoiced = true THEN 'delivered'
    ELSE status
  END,
  COALESCE(is_no_order_today, false),
  approved_at,
  approved_by,
  promised_ship_date,
  requested_ship_date,
  customer_po_number,
  memo,
  message,
  terms,
  subtotal,
  total,
  'sales_order_migration',
  created_at,
  created_by,
  updated_at,
  updated_by
FROM sales_order_archived
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_record ir
  WHERE ir.invoice_number = sales_order_archived.order_number
  AND ir.organization_id = sales_order_archived.organization_id
);

-- Step 5: Migrate line items
INSERT INTO invoice_line_item (
  organization_id,
  invoice_id,
  item_id,
  quantity,
  unit_price,
  description,
  amount,
  created_at,
  updated_at
)
SELECT
  soli.organization_id,
  ir.id, -- Map to new invoice_record id
  soli.item_id,
  soli.quantity,
  soli.unit_price,
  soli.description,
  soli.amount,
  soli.created_at,
  soli.updated_at
FROM sales_order_line_item_archived soli
INNER JOIN sales_order_archived so ON soli.sales_order_id = so.id
INNER JOIN invoice_record ir ON ir.invoice_number = so.order_number
  AND ir.organization_id = so.organization_id
WHERE ir.source_system = 'sales_order_migration'
AND NOT EXISTS (
  SELECT 1 FROM invoice_line_item ili
  WHERE ili.invoice_id = ir.id
  AND ili.item_id = soli.item_id
  AND ili.organization_id = soli.organization_id
);

-- Step 6: Create invoice numbering function
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence_name TEXT;
  v_next_number INTEGER;
  v_invoice_number TEXT;
  v_padded_number TEXT;
  v_current_year INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Create sequence name based on org ID and year
  v_sequence_name := 'inv_seq_' || REPLACE(p_organization_id::TEXT, '-', '_') || '_' || v_current_year::TEXT;

  -- Create sequence if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public'
    AND sequencename = v_sequence_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START 1', v_sequence_name);
  END IF;

  -- Get next value from sequence
  EXECUTE format('SELECT nextval(%L)', 'public.' || v_sequence_name) INTO v_next_number;

  -- Pad the number
  IF v_next_number < 10 THEN
    v_padded_number := '00' || v_next_number::TEXT;
  ELSIF v_next_number < 100 THEN
    v_padded_number := '0' || v_next_number::TEXT;
  ELSE
    v_padded_number := v_next_number::TEXT;
  END IF;

  -- Build invoice number
  v_invoice_number := 'INV-' || v_current_year::TEXT || '-' || v_padded_number;

  RETURN v_invoice_number;
END;
$$;

-- Step 7: Create bulk status update function
CREATE OR REPLACE FUNCTION bulk_update_invoice_status(
  p_invoice_ids UUID[],
  p_new_status TEXT,
  p_updated_by UUID
)
RETURNS JSON[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSON[] := ARRAY[]::JSON[];
  v_invoice_id UUID;
  v_result JSON;
BEGIN
  FOREACH v_invoice_id IN ARRAY p_invoice_ids
  LOOP
    BEGIN
      UPDATE invoice_record
      SET
        status = p_new_status,
        updated_at = NOW(),
        updated_by = p_updated_by::TEXT,
        approved_at = CASE WHEN p_new_status = 'confirmed' THEN NOW() ELSE approved_at END,
        approved_by = CASE WHEN p_new_status = 'confirmed' THEN p_updated_by ELSE approved_by END
      WHERE id = v_invoice_id;

      v_result := json_build_object(
        'invoice_id', v_invoice_id,
        'success', true,
        'error', NULL
      );
      v_results := array_append(v_results, v_result);
    EXCEPTION WHEN OTHERS THEN
      v_result := json_build_object(
        'invoice_id', v_invoice_id,
        'success', false,
        'error', SQLERRM
      );
      v_results := array_append(v_results, v_result);
    END;
  END LOOP;

  RETURN v_results;
END;
$$;

-- Step 8: Create audit trigger for status changes
CREATE OR REPLACE FUNCTION audit_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Log status change (you can extend this to write to an audit table)
    RAISE NOTICE 'Invoice % status changed from % to % by %',
      NEW.id, OLD.status, NEW.status, NEW.updated_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_invoice_status ON invoice_record;
CREATE TRIGGER trigger_audit_invoice_status
  AFTER UPDATE ON invoice_record
  FOR EACH ROW
  EXECUTE FUNCTION audit_invoice_status_change();

-- Step 9: Update check_duplicate_orders function to use invoice_record
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
  SELECT
    id,
    invoice_number,
    status,
    total,
    is_no_order
  INTO v_existing_order
  FROM invoice_record
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
        'order_number', v_existing_order.invoice_number,
        'status', v_existing_order.status,
        'total', v_existing_order.total,
        'is_no_order_today', v_existing_order.is_no_order
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

-- Step 10: Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_invoice_record_delivery_date ON invoice_record(delivery_date);
CREATE INDEX IF NOT EXISTS idx_invoice_record_order_date ON invoice_record(order_date);
CREATE INDEX IF NOT EXISTS idx_invoice_record_status ON invoice_record(status);
CREATE INDEX IF NOT EXISTS idx_invoice_record_is_no_order ON invoice_record(is_no_order) WHERE is_no_order = true;
