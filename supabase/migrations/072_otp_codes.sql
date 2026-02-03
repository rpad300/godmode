-- ============================================================================
-- Migration: 072_otp_codes.sql
-- Description: OTP codes table for email-based authentication (magic codes)
-- Author: GodMode
-- ============================================================================

-- Drop existing objects if they exist (for idempotency)
DROP TABLE IF EXISTS otp_codes CASCADE;

-- ============================================================================
-- OTP Codes Table
-- Stores one-time passwords for login and email confirmation
-- ============================================================================

CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target email address
    email VARCHAR(255) NOT NULL,
    
    -- SHA256 hash of the 6-digit code (never store codes in plain text)
    code_hash VARCHAR(64) NOT NULL,
    
    -- Purpose of the OTP
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('login', 'email_confirm')),
    
    -- Expiration timestamp (typically 10 minutes from creation)
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Failed verification attempts counter
    attempts INT NOT NULL DEFAULT 0,
    
    -- Maximum allowed attempts before invalidation
    max_attempts INT NOT NULL DEFAULT 5,
    
    -- When the code was successfully consumed (NULL if not yet used)
    consumed_at TIMESTAMPTZ,
    
    -- IP address that requested the code (for rate limiting and audit)
    request_ip VARCHAR(45),
    
    -- User agent string (optional, for audit)
    user_agent TEXT,
    
    -- Creation timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index for looking up codes by email and purpose
CREATE INDEX idx_otp_codes_email_purpose ON otp_codes(email, purpose);

-- Index for cleanup of expired codes
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);

-- Index for rate limiting queries (recent codes by email)
CREATE INDEX idx_otp_codes_email_created ON otp_codes(email, created_at DESC);

-- Index for rate limiting by IP
CREATE INDEX idx_otp_codes_ip_created ON otp_codes(request_ip, created_at DESC);

-- ============================================================================
-- Rate Limiting Helper View
-- Shows recent OTP requests per email for rate limiting
-- ============================================================================

CREATE OR REPLACE VIEW otp_rate_stats AS
SELECT 
    email,
    request_ip,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute') AS codes_last_minute,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS codes_last_hour,
    MAX(created_at) AS last_request_at
FROM otp_codes
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY email, request_ip;

-- ============================================================================
-- Cleanup Function
-- Removes expired and consumed OTP codes older than 24 hours
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_codes
    WHERE 
        -- Expired codes older than 1 hour
        (expires_at < NOW() - INTERVAL '1 hour')
        OR
        -- Consumed codes older than 24 hours
        (consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '24 hours')
        OR
        -- Codes with max attempts reached, older than 1 hour
        (attempts >= max_attempts AND created_at < NOW() - INTERVAL '1 hour');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- Verify OTP Function
-- Atomically verifies an OTP code and marks it as consumed
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_otp_code(
    p_email VARCHAR(255),
    p_code_hash VARCHAR(64),
    p_purpose VARCHAR(20)
)
RETURNS TABLE (
    success BOOLEAN,
    error_code VARCHAR(50),
    otp_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp RECORD;
BEGIN
    -- Find the most recent valid OTP for this email and purpose
    SELECT * INTO v_otp
    FROM otp_codes
    WHERE 
        email = LOWER(p_email)
        AND purpose = p_purpose
        AND consumed_at IS NULL
        AND expires_at > NOW()
        AND attempts < max_attempts
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;  -- Lock the row
    
    -- No valid OTP found
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'OTP_NOT_FOUND'::VARCHAR(50), NULL::UUID;
        RETURN;
    END IF;
    
    -- Check if code matches
    IF v_otp.code_hash != p_code_hash THEN
        -- Increment attempts
        UPDATE otp_codes 
        SET attempts = attempts + 1
        WHERE id = v_otp.id;
        
        -- Check if max attempts reached
        IF v_otp.attempts + 1 >= v_otp.max_attempts THEN
            RETURN QUERY SELECT FALSE, 'MAX_ATTEMPTS_EXCEEDED'::VARCHAR(50), v_otp.id;
        ELSE
            RETURN QUERY SELECT FALSE, 'INVALID_CODE'::VARCHAR(50), v_otp.id;
        END IF;
        RETURN;
    END IF;
    
    -- Code matches - mark as consumed
    UPDATE otp_codes 
    SET consumed_at = NOW()
    WHERE id = v_otp.id;
    
    RETURN QUERY SELECT TRUE, NULL::VARCHAR(50), v_otp.id;
END;
$$;

-- ============================================================================
-- Check Rate Limit Function
-- Returns whether a new OTP can be created for this email/IP
-- ============================================================================

CREATE OR REPLACE FUNCTION check_otp_rate_limit(
    p_email VARCHAR(255),
    p_request_ip VARCHAR(45)
)
RETURNS TABLE (
    allowed BOOLEAN,
    error_code VARCHAR(50),
    retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_request TIMESTAMPTZ;
    v_codes_last_minute INTEGER;
    v_codes_last_hour INTEGER;
    v_seconds_since_last INTEGER;
BEGIN
    -- Get rate stats for this email
    SELECT 
        MAX(created_at),
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute'),
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')
    INTO v_last_request, v_codes_last_minute, v_codes_last_hour
    FROM otp_codes
    WHERE 
        email = LOWER(p_email)
        AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Calculate seconds since last request
    IF v_last_request IS NOT NULL THEN
        v_seconds_since_last := EXTRACT(EPOCH FROM (NOW() - v_last_request))::INTEGER;
    ELSE
        v_seconds_since_last := 999999;
    END IF;
    
    -- Check per-minute limit (max 1 per minute)
    IF v_codes_last_minute >= 1 THEN
        RETURN QUERY SELECT FALSE, 'RATE_LIMIT_MINUTE'::VARCHAR(50), (60 - v_seconds_since_last);
        RETURN;
    END IF;
    
    -- Check per-hour limit (max 5 per hour)
    IF v_codes_last_hour >= 5 THEN
        RETURN QUERY SELECT FALSE, 'RATE_LIMIT_HOUR'::VARCHAR(50), 3600;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT TRUE, NULL::VARCHAR(50), 0;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access OTP codes (no direct user access)
-- All operations go through server-side functions

CREATE POLICY "Service role full access to otp_codes"
    ON otp_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE otp_codes IS 'One-time password codes for email-based authentication';
COMMENT ON COLUMN otp_codes.code_hash IS 'SHA256 hash of the 6-digit OTP code';
COMMENT ON COLUMN otp_codes.purpose IS 'Purpose: login = passwordless login, email_confirm = email verification';
COMMENT ON COLUMN otp_codes.attempts IS 'Number of failed verification attempts';
COMMENT ON COLUMN otp_codes.consumed_at IS 'Timestamp when code was successfully used (NULL if unused)';
COMMENT ON FUNCTION verify_otp_code IS 'Atomically verify OTP code and mark as consumed';
COMMENT ON FUNCTION check_otp_rate_limit IS 'Check if new OTP request is allowed based on rate limits';
COMMENT ON FUNCTION cleanup_expired_otp_codes IS 'Remove expired and consumed OTP codes';
