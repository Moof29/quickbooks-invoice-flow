-- Fix the item_type constraint to allow both existing and QuickBooks item types
ALTER TABLE item_record DROP CONSTRAINT IF EXISTS item_record_item_type_check;

-- Add a new constraint that allows both existing types and QuickBooks item types
ALTER TABLE item_record ADD CONSTRAINT item_record_item_type_check 
CHECK (item_type IN ('service', 'bundle', 'inventory', 'Service', 'Inventory', 'NonInventory', 'Group', 'Assembly', 'Fixed Asset', 'Other Charge', 'Subtotal', 'Discount', 'Payment', 'Sales Tax Item', 'Sales Tax Group'));