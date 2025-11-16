-- Grant permissions on pgsodium functions
GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_encrypt(bytea, bytea, uuid, bytea) TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_decrypt(bytea, bytea, uuid, bytea) TO postgres, authenticated, service_role;