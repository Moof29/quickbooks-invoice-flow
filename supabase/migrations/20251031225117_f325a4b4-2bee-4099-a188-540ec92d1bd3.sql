-- Fix invoice_record.updated_by foreign key constraint
-- It was pointing to a 'users' table but should point to 'profiles' table
-- to match the approved_by column

-- Drop the incorrect foreign key
ALTER TABLE invoice_record
DROP CONSTRAINT IF EXISTS invoice_record_updated_by_fkey;

-- Add the correct foreign key pointing to profiles
ALTER TABLE invoice_record
ADD CONSTRAINT invoice_record_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;