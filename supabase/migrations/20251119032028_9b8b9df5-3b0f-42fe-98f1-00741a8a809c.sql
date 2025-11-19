-- Widen short customer_profile columns to safely accept QuickBooks values
ALTER TABLE public.customer_profile
  ALTER COLUMN billing_postal_code TYPE varchar(50),
  ALTER COLUMN shipping_postal_code TYPE varchar(50),
  ALTER COLUMN fax_number TYPE varchar(50),
  ALTER COLUMN mobile_phone TYPE varchar(50);