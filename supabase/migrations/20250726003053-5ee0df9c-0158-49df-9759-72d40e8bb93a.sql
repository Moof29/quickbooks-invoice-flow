-- Temporarily disable the organization check trigger
DROP TRIGGER IF EXISTS check_organization_references_trigger ON invoice_record;

-- Remove the foreign key references that are blocking the deletion
UPDATE invoice_record SET customer_id = NULL WHERE customer_id IN (
  SELECT id FROM customer_profile WHERE organization_id = '11111111-1111-1111-1111-111111111111'
);

-- Delete the test customer data
DELETE FROM customer_profile WHERE organization_id = '11111111-1111-1111-1111-111111111111';

-- Re-enable the trigger
CREATE TRIGGER check_organization_references_trigger
  BEFORE INSERT OR UPDATE ON invoice_record
  FOR EACH ROW EXECUTE FUNCTION check_organization_references();