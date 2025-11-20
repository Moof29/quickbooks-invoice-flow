-- Fix invoice validation to account for invoice-level discounts
CREATE OR REPLACE FUNCTION validate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total NUMERIC;
  v_line_items_total NUMERIC;
  v_discount_total NUMERIC;
  v_calculated_total NUMERIC;
BEGIN
  -- Get the invoice total
  SELECT total, COALESCE(discount_total, 0)
  INTO v_invoice_total, v_discount_total
  FROM invoice_record
  WHERE id = NEW.invoice_id;

  -- Calculate sum of line items
  SELECT COALESCE(SUM(amount), 0)
  INTO v_line_items_total
  FROM invoice_line_item
  WHERE invoice_id = NEW.invoice_id;

  -- Calculate expected total (line items - invoice-level discount)
  v_calculated_total := v_line_items_total - v_discount_total;

  -- Allow for 2 cent rounding difference
  IF ABS(v_invoice_total - v_calculated_total) > 0.02 THEN
    RAISE EXCEPTION 'Invoice total does not match line items total. Invoice total: %, Line items total: %, Discount: %, Calculated: %',
      v_invoice_total, v_line_items_total, v_discount_total, v_calculated_total
    USING HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id, and invoice-level discounts are properly recorded.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;