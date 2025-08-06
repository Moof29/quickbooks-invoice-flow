-- Fix ALL validation functions that use problematic format() calls

-- Fix validate_bill_totals function
CREATE OR REPLACE FUNCTION public.validate_bill_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM bill_line_item
  WHERE bill_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Bill total does not match line items total. Bill total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all bill_line_item rows match the bill_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

-- Fix validate_invoice_totals function
CREATE OR REPLACE FUNCTION public.validate_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
  line_item_count INTEGER;
BEGIN
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO calculated_total, line_item_count
  FROM invoice_line_item
  WHERE invoice_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF line_item_count > 0 AND ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Invoice total does not match line items total. Invoice total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all invoice_line_item rows match the invoice_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

-- Fix validate_purchase_order_totals function
CREATE OR REPLACE FUNCTION public.validate_purchase_order_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM purchase_order_line_item
  WHERE purchase_order_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Purchase order total does not match line items total. Order total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all purchase_order_line_item rows match the purchase_order_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;

-- Fix validate_credit_memo_totals function
CREATE OR REPLACE FUNCTION public.validate_credit_memo_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO calculated_total
  FROM credit_memo_line_item
  WHERE credit_memo_id = NEW.id
    AND organization_id = NEW.organization_id;

  IF ABS(NEW.total - calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Credit memo total does not match line items total. Memo total: %, Line items total: %', NEW.total, calculated_total
      USING HINT = 'Ensure all credit_memo_line_item rows match the credit_memo_id and organization_id.',
            ERRCODE = '22000';
  END IF;

  RETURN NEW;
END;
$$;