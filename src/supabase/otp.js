/**
 * OTP (One-Time Password) Service
 * Handles generation, verification, and management of email-based OTP codes
 * for passwordless login and email confirmation
 */

const crypto = require('crypto');
const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'otp' });

// OTP Configuration
const OTP_CONFIG = {
    codeLength: 6,                    // 6-digit codes
    expirationMinutes: 10,            // Code expires after 10 minutes
    maxAttempts: 5,                   // Max verification attempts
    rateLimitPerMinute: 1,            // Max 1 code per minute per email
    rateLimitPerHour: 5,              // Max 5 codes per hour per email
    resendCooldownSeconds: 60,        // Minimum seconds between resends
};

/**
 * Generate a cryptographically secure 6-digit OTP code
 * @returns {string} 6-digit code
 */
function generateCode() {
    // Generate random number between 100000 and 999999
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash an OTP code using SHA256
 * @param {string} code - The plain text code
 * @returns {string} SHA256 hash of the code
 */
function hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Check rate limits before creating a new OTP
 * @param {string} email - Target email address
 * @param {string} requestIp - Requester's IP address
 * @returns {Promise<{allowed: boolean, error?: string, retryAfter?: number}>}
 */
async function checkRateLimit(email, requestIp) {
    const admin = getAdminClient();
    if (!admin) {
        return { allowed: false, error: 'Database not configured' };
    }

    try {
        const { data, error } = await admin.rpc('check_otp_rate_limit', {
            p_email: email.toLowerCase(),
            p_request_ip: requestIp || null
        });

        if (error) {
            log.warn({ event: 'otp_rate_limit_error', reason: error.message }, 'Rate limit check error');
            // On error, allow the request (fail open for better UX)
            return { allowed: true };
        }

        if (data && data.length > 0) {
            const result = data[0];
            if (!result.allowed) {
                return {
                    allowed: false,
                    error: result.error_code === 'RATE_LIMIT_MINUTE' 
                        ? 'Please wait before requesting another code'
                        : 'Too many code requests. Please try again later.',
                    retryAfter: result.retry_after_seconds
                };
            }
        }

        return { allowed: true };
    } catch (err) {
        log.warn({ event: 'otp_rate_limit_exception', reason: err.message }, 'Rate limit check exception');
        return { allowed: true }; // Fail open
    }
}

/**
 * Create and store a new OTP code
 * @param {string} email - Target email address
 * @param {string} purpose - 'login' or 'email_confirm'
 * @param {string} requestIp - Requester's IP address
 * @param {string} userAgent - Requester's user agent
 * @returns {Promise<{success: boolean, code?: string, error?: string, retryAfter?: number}>}
 */
async function createOTP(email, purpose, requestIp = null, userAgent = null) {
    const admin = getAdminClient();
    if (!admin) {
        return { success: false, error: 'Database not configured' };
    }

    // Validate purpose
    if (!['login', 'email_confirm'].includes(purpose)) {
        return { success: false, error: 'Invalid OTP purpose' };
    }

    // Validate email
    if (!email || !email.includes('@')) {
        return { success: false, error: 'Valid email is required' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check rate limits
        const rateLimitCheck = await checkRateLimit(normalizedEmail, requestIp);
        if (!rateLimitCheck.allowed) {
            return { 
                success: false, 
                error: rateLimitCheck.error,
                retryAfter: rateLimitCheck.retryAfter
            };
        }

        // Generate code and hash
        const code = generateCode();
        const codeHash = hashCode(code);
        const expiresAt = new Date(Date.now() + OTP_CONFIG.expirationMinutes * 60 * 1000);

        // Store in database
        const { error } = await admin
            .from('otp_codes')
            .insert({
                email: normalizedEmail,
                code_hash: codeHash,
                purpose,
                expires_at: expiresAt.toISOString(),
                max_attempts: OTP_CONFIG.maxAttempts,
                request_ip: requestIp,
                user_agent: userAgent
            });

        if (error) {
            log.warn({ event: 'otp_create_error', reason: error.message }, 'Create error');
            return { success: false, error: 'Failed to create verification code' };
        }

        log.debug({ event: 'otp_created', purpose, normalizedEmail, expiresAt: expiresAt.toISOString() }, 'Created OTP code');

        return { 
            success: true, 
            code,  // Return plain code for sending via email
            expiresAt,
            expiresInMinutes: OTP_CONFIG.expirationMinutes
        };

    } catch (err) {
        log.warn({ event: 'otp_create_exception', reason: err.message }, 'Create exception');
        return { success: false, error: 'Failed to create verification code' };
    }
}

/**
 * Verify an OTP code
 * @param {string} email - Target email address
 * @param {string} code - The 6-digit code to verify
 * @param {string} purpose - 'login' or 'email_confirm'
 * @returns {Promise<{success: boolean, error?: string, attemptsRemaining?: number}>}
 */
async function verifyOTP(email, code, purpose) {
    const admin = getAdminClient();
    if (!admin) {
        return { success: false, error: 'Database not configured' };
    }

    // Validate inputs
    if (!email || !code || !purpose) {
        return { success: false, error: 'Email, code, and purpose are required' };
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
        return { success: false, error: 'Invalid code format' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const codeHash = hashCode(code);

    try {
        const { data, error } = await admin.rpc('verify_otp_code', {
            p_email: normalizedEmail,
            p_code_hash: codeHash,
            p_purpose: purpose
        });

        if (error) {
            log.warn({ event: 'otp_verify_error', reason: error.message }, 'Verify error');
            return { success: false, error: 'Verification failed' };
        }

        if (data && data.length > 0) {
            const result = data[0];
            
            if (result.success) {
                log.debug({ event: 'otp_verified', purpose, normalizedEmail }, 'Verified OTP code');
                return { success: true };
            }

            // Handle specific error codes
            switch (result.error_code) {
                case 'OTP_NOT_FOUND':
                    return { 
                        success: false, 
                        error: 'Invalid or expired code. Please request a new one.' 
                    };
                case 'INVALID_CODE':
                    return { 
                        success: false, 
                        error: 'Incorrect code. Please try again.',
                        attemptsRemaining: OTP_CONFIG.maxAttempts - 1 // Approximate
                    };
                case 'MAX_ATTEMPTS_EXCEEDED':
                    return { 
                        success: false, 
                        error: 'Too many incorrect attempts. Please request a new code.' 
                    };
                default:
                    return { success: false, error: 'Verification failed' };
            }
        }

        return { success: false, error: 'Verification failed' };

    } catch (err) {
        log.warn({ event: 'otp_verify_exception', reason: err.message }, 'Verify exception');
        return { success: false, error: 'Verification failed' };
    }
}

/**
 * Invalidate all pending OTP codes for an email (e.g., after successful login)
 * @param {string} email - Target email address
 * @param {string} purpose - Optional: only invalidate specific purpose
 * @returns {Promise<{success: boolean}>}
 */
async function invalidateOTPs(email, purpose = null) {
    const admin = getAdminClient();
    if (!admin) {
        return { success: false };
    }

    try {
        let query = admin
            .from('otp_codes')
            .update({ consumed_at: new Date().toISOString() })
            .eq('email', email.toLowerCase())
            .is('consumed_at', null);

        if (purpose) {
            query = query.eq('purpose', purpose);
        }

        await query;
        return { success: true };
    } catch (err) {
        log.warn({ event: 'otp_invalidate_error', reason: err.message }, 'Invalidate error');
        return { success: false };
    }
}

/**
 * Cleanup expired OTP codes
 * Should be called periodically (e.g., every hour)
 * @returns {Promise<{success: boolean, deletedCount?: number}>}
 */
async function cleanupExpiredOTPs() {
    const admin = getAdminClient();
    if (!admin) {
        return { success: false };
    }

    try {
        const { data, error } = await admin.rpc('cleanup_expired_otp_codes');

        if (error) {
            log.warn({ event: 'otp_cleanup_error', reason: error.message }, 'Cleanup error');
            return { success: false };
        }

        const deletedCount = data || 0;
        if (deletedCount > 0) {
            log.debug({ event: 'otp_cleanup_done', deletedCount }, 'Cleaned up expired codes');
        }

        return { success: true, deletedCount };
    } catch (err) {
        log.warn({ event: 'otp_cleanup_exception', reason: err.message }, 'Cleanup exception');
        return { success: false };
    }
}

/**
 * Get OTP configuration (for frontend display)
 */
function getConfig() {
    return {
        codeLength: OTP_CONFIG.codeLength,
        expirationMinutes: OTP_CONFIG.expirationMinutes,
        resendCooldownSeconds: OTP_CONFIG.resendCooldownSeconds
    };
}

module.exports = {
    createOTP,
    verifyOTP,
    invalidateOTPs,
    cleanupExpiredOTPs,
    checkRateLimit,
    getConfig,
    // Export for testing
    hashCode,
    generateCode
};
