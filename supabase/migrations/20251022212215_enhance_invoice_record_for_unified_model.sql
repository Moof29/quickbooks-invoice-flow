-- Migration: Enhance invoice_record table for unified order/invoice model
-- Date: 2025-10-22
-- Purpose: Add sales order fields to invoice_record to support status-driven workflow

-- Step 1: Add new columns to invoice_record
ALTER TABLE invoice_record
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS is_no_order BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS promised_ship_date DATE,
  ADD COLUMN IF NOT EXISTS requested_ship_date DATE,
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT;

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_record_delivery_date ON invoice_record(delivery_date);
CREATE INDEX IF NOT EXISTS idx_invoice_record_order_date ON invoice_record(order_date);
CREATE INDEX IF NOT EXISTS idx_invoice_record_status ON invoice_record(status);
CREATE INDEX IF NOT EXISTS idx_invoice_record_is_no_order ON invoice_record(is_no_order) WHERE is_no_order = TRUE;

-- Step 3: Update status column constraint to support new statuses
-- First, drop the old constraint if it exists
ALTER TABLE invoice_record DROP CONSTRAINT IF EXISTS invoice_record_status_check;

-- Add new constraint with expanded status values
ALTER TABLE invoice_record
  ADD CONSTRAINT invoice_record_status_check
  CHECK (status IN ('draft', 'confirmed', 'delivered', 'paid', 'cancelled', 'partial', 'sent', 'overdue'));

-- Step 4: Add comments for documentation
COMMENT ON COLUMN invoice_record.delivery_date IS 'Target delivery date for the order/invoice';
COMMENT ON COLUMN invoice_record.order_date IS 'Date when order was created';
COMMENT ON COLUMN invoice_record.is_no_order IS 'True when this is a NO ORDER record for pick list generation';
COMMENT ON COLUMN invoice_record.status IS 'Lifecycle status: draft (order), confirmed (ready to deliver), delivered, paid, cancelled, partial, sent, overdue';

COMMENT ON TABLE invoice_record IS 'Unified invoice/order table - orders are draft invoices that become confirmed invoices';
