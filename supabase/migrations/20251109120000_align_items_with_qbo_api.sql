-- Migration: Align Item table with QuickBooks Online Item API
-- Purpose: Fix incorrect mappings and add critical fields for order-taking and payment tracking
-- Date: 2025-11-09

-- ==============================================================================
-- STEP 1: Fix UnitPrice mapping (CRITICAL BUG FIX)
-- ==============================================================================
-- Currently: purchase_cost is incorrectly storing UnitPrice (selling price)
-- Should be: unit_price stores selling price, purchase_cost stores cost price

-- First, rename the incorrectly named column
ALTER TABLE item_record
  RENAME COLUMN purchase_cost TO unit_price;

-- Add the actual purchase_cost column (what we pay to acquire the item)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(10,2);

-- ==============================================================================
-- STEP 2: Add critical inventory tracking fields
-- ==============================================================================

-- Add quantity_on_hand (currently missing but critical for inventory)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS quantity_on_hand NUMERIC(10,2) DEFAULT 0;

-- Add flag to indicate if quantity tracking is enabled
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS track_qty_on_hand BOOLEAN DEFAULT false;

-- Add reorder point for inventory management
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS reorder_point NUMERIC(10,2);

-- Add inventory start date for audit trail
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS inv_start_date DATE;

-- ==============================================================================
-- STEP 3: Add account references for proper accounting
-- ==============================================================================
-- Store as JSONB to match QBO structure: {value: "123", name: "Income Account"}

-- Income account for sales
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS income_account_ref JSONB;

-- Expense account for purchases
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS expense_account_ref JSONB;

-- Asset account for inventory items
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS asset_account_ref JSONB;

-- ==============================================================================
-- STEP 4: Add tax configuration
-- ==============================================================================

-- Whether the item is taxable
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN DEFAULT true;

-- Sales tax code reference
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS sales_tax_code_ref JSONB;

-- Purchase tax code reference
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS purchase_tax_code_ref JSONB;

-- Whether tax is included in the unit price
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS sales_tax_included BOOLEAN DEFAULT false;

-- ==============================================================================
-- STEP 5: Add item hierarchy support
-- ==============================================================================

-- Parent item reference for sub-items
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS parent_ref JSONB;

-- Flag indicating this is a sub-item
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS sub_item BOOLEAN DEFAULT false;

-- Hierarchy level (0 = top level)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;

-- Fully qualified name including parent hierarchy
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS fully_qualified_name TEXT;

-- ==============================================================================
-- STEP 6: Add vendor and purchasing fields
-- ==============================================================================

-- Preferred vendor reference
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS pref_vendor_ref JSONB;

-- Purchase description (may differ from sales description)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS purchase_desc TEXT;

-- Manufacturer part number (additional to SKU)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS man_part_num TEXT;

-- ==============================================================================
-- STEP 7: Add QBO sync metadata
-- ==============================================================================

-- Sync token for optimistic locking (prevents conflicts)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS qbo_sync_token INTEGER;

-- QBO creation and update timestamps (separate from our timestamps)
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS qbo_created_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS qbo_updated_at TIMESTAMP WITH TIME ZONE;

-- ==============================================================================
-- STEP 8: Add unit of measure support
-- ==============================================================================

-- Unit of measure set reference
ALTER TABLE item_record
  ADD COLUMN IF NOT EXISTS uom_set_ref JSONB;

-- ==============================================================================
-- STEP 9: Create indexes for performance
-- ==============================================================================

-- Index on account references for reporting
CREATE INDEX IF NOT EXISTS idx_item_income_account
  ON item_record USING gin(income_account_ref)
  WHERE income_account_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_item_expense_account
  ON item_record USING gin(expense_account_ref)
  WHERE expense_account_ref IS NOT NULL;

-- Index on taxable items for tax calculations
CREATE INDEX IF NOT EXISTS idx_item_taxable
  ON item_record(taxable, organization_id)
  WHERE is_active = true;

-- Index on inventory tracking
CREATE INDEX IF NOT EXISTS idx_item_tracked_inventory
  ON item_record(track_qty_on_hand, organization_id)
  WHERE track_qty_on_hand = true AND is_active = true;

-- Index on parent reference for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_item_parent_ref
  ON item_record USING gin(parent_ref)
  WHERE parent_ref IS NOT NULL;

-- Index on vendor reference for purchasing
CREATE INDEX IF NOT EXISTS idx_item_vendor_ref
  ON item_record USING gin(pref_vendor_ref)
  WHERE pref_vendor_ref IS NOT NULL;

-- ==============================================================================
-- STEP 10: Add helpful comments
-- ==============================================================================

COMMENT ON COLUMN item_record.unit_price IS
  'Selling price (what customers pay) - maps to QBO UnitPrice field';

COMMENT ON COLUMN item_record.purchase_cost IS
  'Cost price (what we pay) - maps to QBO PurchaseCost field';

COMMENT ON COLUMN item_record.quantity_on_hand IS
  'Current inventory quantity - maps to QBO QtyOnHand field';

COMMENT ON COLUMN item_record.qbo_sync_token IS
  'QBO version number for optimistic locking - prevents sync conflicts';

COMMENT ON COLUMN item_record.income_account_ref IS
  'Income account reference for sales - format: {"value": "123", "name": "Income"}';

COMMENT ON COLUMN item_record.expense_account_ref IS
  'Expense account reference for purchases - format: {"value": "123", "name": "COGS"}';

COMMENT ON COLUMN item_record.asset_account_ref IS
  'Asset account reference for inventory - format: {"value": "123", "name": "Inventory Asset"}';
