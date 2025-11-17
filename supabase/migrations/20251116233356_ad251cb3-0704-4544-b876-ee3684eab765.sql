-- Fix Prompt 3: Correct encryption functions (no bytea cast on UUID)

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
  -- Pass UUID directly, not as bytea
  RETURN pgsodium.crypto_aead_det_encrypt(p_token::bytea, NULL, v_key_id);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_qbo_token(p_encrypted_token BYTEA, p_key_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pass UUID directly, not as bytea
  RETURN convert_from(pgsodium.crypto_aead_det_decrypt(p_encrypted_token, NULL, p_key_id),'UTF8');
END;
$$;