-- Drop the existing item_type constraint
ALTER TABLE item_record DROP CONSTRAINT IF EXISTS item_record_item_type_check;

-- Add updated constraint with ALL QuickBooks Online item types
-- Per QB API documentation: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/item
ALTER TABLE item_record ADD CONSTRAINT item_record_item_type_check 
CHECK (item_type IN (
  -- QuickBooks Online official types
  'Inventory',
  'Group',
  'Service', 
  'NonInventory',
  'Category',
  -- Legacy QB Desktop types (for backwards compatibility)
  'Assembly',
  'Fixed Asset',
  'Other Charge',
  'Subtotal',
  'Discount',
  'Payment',
  'Sales Tax Item',
  'Sales Tax Group',
  -- Lowercase variants (for backwards compatibility)
  'service',
  'bundle',
  'inventory'
));