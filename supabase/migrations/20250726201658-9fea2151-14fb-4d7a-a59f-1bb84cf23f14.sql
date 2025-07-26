-- Add unique constraint for organization_id and qbo_id to support upserts
ALTER TABLE item_record 
ADD CONSTRAINT item_record_org_qbo_unique 
UNIQUE (organization_id, qbo_id);