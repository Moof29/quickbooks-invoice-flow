-- Check if amount is already a generated column, if not make it one
-- This ensures consistency with sales_order_line_item pattern

-- First, drop the trigger we just created (not needed if using generated columns)
DROP TRIGGER IF EXISTS trigger_calculate_invoice_line_item_amount ON invoice_line_item;
DROP FUNCTION IF EXISTS public.calculate_invoice_line_item_amount();

-- Make amount a generated column (if it isn't already)
-- We need to drop and recreate it because you can't ALTER a column to be generated
DO $$
BEGIN
  -- Check if amount is already generated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoice_line_item' 
    AND column_name = 'amount' 
    AND is_generated = 'ALWAYS'
  ) THEN
    -- Drop the existing amount column
    ALTER TABLE invoice_line_item DROP COLUMN IF EXISTS amount;
    
    -- Add it back as a generated column
    ALTER TABLE invoice_line_item 
    ADD COLUMN amount NUMERIC GENERATED ALWAYS AS (ROUND((quantity * unit_price)::numeric, 2)) STORED;
  END IF;
END $$;