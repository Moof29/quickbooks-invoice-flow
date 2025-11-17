-- Prompt 3: Encryption/decryption helper functions + migration function

CREATE OR REPLACE FUNCTION encrypt_qbo_token(p_token TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
BEGIN
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name='qbo_token_encryption_key';
  RETURN pgsodium.crypto_aead_det_encrypt(p_token::bytea, NULL, v_key_id::bytea);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_qbo_token(p_encrypted_token BYTEA, p_key_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN convert_from(pgsodium.crypto_aead_det_decrypt(p_encrypted_token, NULL, p_key_id::bytea),'UTF8');
END;
$$;

CREATE OR REPLACE FUNCTION get_qbo_tokens_decrypted(p_organization_id UUID)
RETURNS TABLE(access_token TEXT, refresh_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only service_role may decrypt
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Service role only';
  END IF;
  
  RETURN QUERY
  SELECT 
    decrypt_qbo_token(encrypted_access_token, encryption_key_id),
    decrypt_qbo_token(encrypted_refresh_token, encryption_key_id)
  FROM qbo_connection
  WHERE organization_id = p_organization_id
    AND is_active = true
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION migrate_tokens_to_encrypted()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
  v_conn RECORD;
BEGIN
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name='qbo_token_encryption_key';
  
  FOR v_conn IN 
    SELECT * FROM qbo_connection WHERE qbo_access_token IS NOT NULL
  LOOP
    UPDATE qbo_connection
    SET 
      encrypted_access_token = encrypt_qbo_token(v_conn.qbo_access_token),
      encrypted_refresh_token = encrypt_qbo_token(v_conn.qbo_refresh_token),
      encryption_key_id = v_key_id,
      qbo_access_token = NULL,
      qbo_refresh_token = NULL,
      updated_at = NOW()
    WHERE id = v_conn.id;
  END LOOP;
END;
$$;