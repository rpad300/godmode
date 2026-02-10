-- Migration 100: Use extensions schema for pgcrypto (Supabase installs pgcrypto in schema "extensions")
-- Fixes: function pgp_sym_encrypt(text, text) does not exist

-- Recreate encrypt_secret to call extensions.pgp_sym_encrypt
CREATE OR REPLACE FUNCTION encrypt_secret(
    p_value TEXT,
    p_key TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN encode(extensions.pgp_sym_encrypt(p_value, p_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate decrypt_secret to call extensions.pgp_sym_decrypt
CREATE OR REPLACE FUNCTION decrypt_secret(
    p_encrypted TEXT,
    p_key TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN extensions.pgp_sym_decrypt(decode(p_encrypted, 'base64'), p_key);
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION encrypt_secret IS 'Encrypt a secret value using pgcrypto (extensions schema)';
COMMENT ON FUNCTION decrypt_secret IS 'Decrypt a secret value using pgcrypto (extensions schema)';
