/**
 * Middleware utilities (rate limiting, cookie security)
 * Extracted from server.js for modularity
 */

// ============================================
// RATE LIMITING
// ============================================
const rateLimitStore = new Map();

/**
 * Simple in-memory rate limiter
 * @param {string} key - Unique identifier (e.g., IP + endpoint)
 * @param {number} maxRequests - Maximum requests allowed in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if request should be allowed
 */
function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    if (!record) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    
    if (now > record.resetAt) {
        // Window expired, reset
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    
    if (record.count >= maxRequests) {
        return false; // Rate limited
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
