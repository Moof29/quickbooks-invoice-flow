-- Prompt 2: Create encryption key and add encrypted token columns
SELECT pgsodium.create_key(name := 'qbo_token_encryption_key');

ALTER TABLE qbo_connection 
ADD COLUMN IF NOT EXISTS encrypted_access_token BYTEA,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token BYTEA,
ADD COLUMN IF NOT EXISTS encryption_key_id UUID;