-- Fix the organization_id for the synced customer records
UPDATE customer_profile 
SET organization_id = '9af4c081-7379-4e41-8dfb-924e2518e3c6'
WHERE organization_id = '11111111-1111-1111-1111-111111111111';