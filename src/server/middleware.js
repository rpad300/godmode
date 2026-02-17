/**
 * Purpose:
 *   Provides lightweight, in-memory middleware helpers for rate limiting,
 *   cookie-flag generation, and client-IP extraction. Designed for a
 *   single-process Node.js HTTP server (not clustered).
 *
 * Responsibilities:
 *   - Sliding-window rate limiting keyed by IP + endpoint
 *   - Automatic eviction of stale rate-limit records to bound memory
 *   - Cookie security flags that adapt to HTTP vs HTTPS / dev vs prod
 *   - Reliable client-IP resolution across proxies (X-Forwarded-For, X-Real-IP)
 *
 * Key dependencies:
 *   - None (pure Node.js built-ins only)
 *
 * Side effects:
 *   - rateLimitStore (module-level Map) grows with unique IP:endpoint pairs
 *   - startRateLimitCleanup() creates a recurring setInterval timer
 *   - Reads process.env.NODE_ENV to decide Secure cookie flag
 *
 * Notes:
 *   - The store is capped at RATE_LIMIT_STORE_MAX_SIZE (50 000 entries).
 *     Eviction first purges expired records, then falls back to FIFO deletion.
 *   - In a multi-process/cluster deployment this rate limiter will NOT share
 *     state across workers -- consider Redis-backed limiting if needed.
 *   - getCookieSecurityFlags omits the Secure flag on plain HTTP to allow
 *     localhost development without HTTPS.
 */

// ============================================
// RATE LIMITING
// ============================================
const rateLimitStore = new Map();
const RATE_LIMIT_STORE_MAX_SIZE = 50000; // Cap memory; evict oldest when exceeded

/**
 * Two-phase eviction to keep the rate-limit store within its memory cap:
 *   1. Remove entries whose window expired more than 60 s ago (sorted oldest-first).
 *   2. If still over cap, force-delete the earliest-inserted keys (FIFO).
 * Called before every checkRateLimit invocation, so the hot path exits early
 * when the store is under the limit.
 */
function evictRateLimitStoreIfNeeded() {
    if (rateLimitStore.size <= RATE_LIMIT_STORE_MAX_SIZE) return;
    const now = Date.now();
    const entries = Array.from(rateLimitStore.entries())
        .filter(([, r]) => now > r.resetAt + 60000)
        .sort((a, b) => a[1].resetAt - b[1].resetAt);
    let deleted = 0;
    for (const [key] of entries) {
        if (rateLimitStore.size <= RATE_LIMIT_STORE_MAX_SIZE) break;
        rateLimitStore.delete(key);
        deleted++;
    }
    if (deleted > 0 && rateLimitStore.size > RATE_LIMIT_STORE_MAX_SIZE) {
        const keys = Array.from(rateLimitStore.keys()).slice(0, rateLimitStore.size - RATE_LIMIT_STORE_MAX_SIZE);
        keys.forEach(k => rateLimitStore.delete(k));
    }
}

/**
 * Simple in-memory rate limiter
 * @param {string} key - Unique identifier (e.g., IP + endpoint)
 * @param {number} maxRequests - Maximum requests allowed in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if request should be allowed
 */
function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
    evictRateLimitStoreIfNeeded();
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (now > record.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

/**
 * Get rate limit key from request
 * @param {http.IncomingMessage} req - The HTTP request
 * @param {string} endpoint - The endpoint being accessed
 * @returns {string} - Rate limit key
 */
function getRateLimitKey(req, endpoint) {
    // Use IP + endpoint as key
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return `${ip}:${endpoint}`;
}

/**
 * Rate limit response helper
 * @param {http.ServerResponse} res - The HTTP response
 */
function rateLimitResponse(res) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
}

/**
 * Start the rate limit cleanup interval
 * Cleans up old rate limit entries every 5 minutes
 * @returns {NodeJS.Timeout} - The interval ID (for cleanup if needed)
 */
function startRateLimitCleanup() {
    return setInterval(() => {
        const now = Date.now();
        for (const [key, record] of rateLimitStore.entries()) {
            if (now > record.resetAt + 60000) {
                rateLimitStore.delete(key);
            }
        }
    }, 300000); // 5 minutes
}

// ============================================
// COOKIE SECURITY
// ============================================

/**
 * Get cookie security flags based on environment/protocol
 * - Production or HTTPS: include Secure flag
 * - Development HTTP: omit Secure flag (allows cookies on localhost)
 * @param {http.IncomingMessage} req - The HTTP request
 * @returns {string} - Cookie flags string
 */
function getCookieSecurityFlags(req) {
    const isSecure = 
        process.env.NODE_ENV === 'production' ||
        req.headers['x-forwarded-proto'] === 'https' ||
        (req.connection && req.connection.encrypted);
    
    return isSecure 
        ? 'HttpOnly; Secure; SameSite=Lax' 
        : 'HttpOnly; SameSite=Lax';
}

/**
 * Get client IP address from request
 * @param {http.IncomingMessage} req - The HTTP request
 * @returns {string|null} - Client IP address
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.socket?.remoteAddress || null;
}

module.exports = {
    rateLimitStore,
    checkRateLimit,
    getRateLimitKey,
    rateLimitResponse,
    startRateLimitCleanup,
    getCookieSecurityFlags,
    getClientIp
};
