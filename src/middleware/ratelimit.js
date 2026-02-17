/**
 * Purpose:
 *   Express middleware for per-client API rate limiting using a fixed-window
 *   counter algorithm, with route-aware limit overrides.
 *
 * Responsibilities:
 *   - Track request counts per client (API key > user ID > IP) in a
 *     fixed-window bucket
 *   - Enforce route-specific limits (stricter for auth/search, relaxed for reads)
 *   - Expose standard RateLimit response headers (X-RateLimit-Limit, -Remaining, -Reset)
 *   - Return 429 with Retry-After when a client exceeds its quota
 *   - Provide a factory (createLimiter) for custom one-off limiters
 *   - Provide tier-based limits for API key consumers (free/pro/enterprise)
 *
 * Key dependencies:
 *   - None (self-contained, no external libraries)
 *
 * Side effects:
 *   - Starts a 60-second setInterval for expired-bucket cleanup (runs for
 *     the lifetime of the process; call limiter.destroy() to stop)
 *   - Sets X-RateLimit-* and Retry-After response headers
 *
 * Notes:
 *   - Despite the original docstring mentioning "token bucket", the actual
 *     implementation is a fixed-window counter (simpler, slightly burstier
 *     at window boundaries).
 *   - Route matching uses first-match semantics: exact path, then
 *     METHOD:path prefix, then plain path prefix, then the global default.
 *   - The singleton `limiter` is shared across all routes; client identity
 *     is resolved once per request in getClientId.
 */

/**
 * Fixed-window rate limiter.
 *
 * Each client gets a "bucket" that tracks how many requests it has made
 * within the current window. Once the window expires, the bucket resets.
 *
 * @param {object} options
 * @param {number} options.defaultLimit - Max requests per window (default 60)
 * @param {number} options.windowMs     - Window duration in ms (default 60 000)
 */
class RateLimiter {
    constructor(options = {}) {
        this.buckets = new Map();
        this.defaultLimit = options.defaultLimit || 60; // requests per minute
        this.windowMs = options.windowMs || 60000; // 1 minute window

        // Cleanup old buckets periodically
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Derive a stable identifier for the requesting client.
     *
     * Resolution order: API key (first 16 chars for privacy) > authenticated
     * user ID > client IP. This means an API-key consumer is rate-limited
     * independently from browser sessions of the same user.
     */
    getClientId(req) {
        // Try API key first (truncated to avoid storing full secrets in memory)
        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            return `api:${apiKey.substring(0, 16)}`;
        }

        // Try user ID
        if (req.user?.id) {
            return `user:${req.user.id}`;
        }

        // Fall back to IP
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   req.connection?.remoteAddress ||
                   'unknown';
        return `ip:${ip}`;
    }

    /**
     * Check whether the given client may proceed and atomically increment
     * the request counter. Resets the bucket if the current window has expired.
     *
     * @param {string} clientId - Stable client identifier from getClientId
     * @param {number|null} limit - Override for maxRequests (null = use defaultLimit)
     * @returns {{allowed: boolean, remaining: number, resetAt: number, retryAfter?: number}}
     */
    isAllowed(clientId, limit = null) {
        const maxRequests = limit || this.defaultLimit;
        const now = Date.now();

        let bucket = this.buckets.get(clientId);

        if (!bucket || now > bucket.resetAt) {
            // New or expired bucket
            bucket = {
                count: 1,
                resetAt: now + this.windowMs,
                limit: maxRequests
            };
            this.buckets.set(clientId, bucket);
            return {
                allowed: true,
                remaining: maxRequests - 1,
                resetAt: bucket.resetAt
            };
        }

        if (bucket.count >= maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: bucket.resetAt,
                retryAfter: Math.ceil((bucket.resetAt - now) / 1000)
            };
        }

        bucket.count++;
        return {
            allowed: true,
            remaining: maxRequests - bucket.count,
            resetAt: bucket.resetAt
        };
    }

    /**
     * Get current usage for client
     */
    getUsage(clientId) {
        const bucket = this.buckets.get(clientId);
        if (!bucket) {
            return { count: 0, limit: this.defaultLimit };
        }
        return {
            count: bucket.count,
            limit: bucket.limit,
            remaining: Math.max(0, bucket.limit - bucket.count),
            resetAt: bucket.resetAt
        };
    }

    /**
     * Reset limits for a client
     */
    reset(clientId) {
        this.buckets.delete(clientId);
    }

    /**
     * Cleanup expired buckets
     */
    cleanup() {
        const now = Date.now();
        for (const [clientId, bucket] of this.buckets) {
            if (now > bucket.resetAt) {
                this.buckets.delete(clientId);
            }
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            activeBuckets: this.buckets.size,
            defaultLimit: this.defaultLimit,
            windowMs: this.windowMs
        };
    }

    /**
     * Destroy rate limiter
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.buckets.clear();
    }
}

// Singleton instance
const limiter = new RateLimiter({
    defaultLimit: 60,
    windowMs: 60000
});

// Route-specific limits (requests per window). Entries are matched by
// getRouteLimit in priority order: exact path > METHOD:prefix > path prefix.
const routeLimits = {
    // Auth endpoints - stricter limits
    '/api/auth/login': 10,
    '/api/auth/register': 5,
    '/api/auth/forgot-password': 3,
    
    // Write endpoints - moderate limits
    'POST:/api': 30,
    'PUT:/api': 30,
    'DELETE:/api': 20,
    
    // Read endpoints - higher limits
    'GET:/api': 100,
    
    // Heavy endpoints
    '/api/search': 20,
    '/api/audit-exports': 5
};

/**
 * Resolve the per-window request limit for a given method + path.
 *
 * Matching priority (first wins):
 *   1. Exact path match in routeLimits (e.g. '/api/auth/login')
 *   2. "METHOD:/path" prefix match (e.g. 'POST:/api')
 *   3. Plain path prefix match (e.g. '/api/search')
 *   4. Global defaultLimit fallback
 */
function getRouteLimit(method, path) {
    // Check exact path match first
    if (routeLimits[path]) {
        return routeLimits[path];
    }

    // Check method:path pattern
    const methodPath = `${method}:${path}`;
    for (const pattern in routeLimits) {
        if (pattern.includes(':') && methodPath.startsWith(pattern)) {
            return routeLimits[pattern];
        }
    }

    // Check path prefix
    for (const pattern in routeLimits) {
        if (!pattern.includes(':') && path.startsWith(pattern)) {
            return routeLimits[pattern];
        }
    }

    return limiter.defaultLimit;
}

/**
 * Express middleware that enforces per-client rate limits.
 * Automatically resolves client identity and route-specific limits,
 * sets standard X-RateLimit-* headers, and returns 429 when exceeded.
 */
function rateLimitMiddleware(req, res, next) {
    const clientId = limiter.getClientId(req);
    const limit = getRouteLimit(req.method, req.url);
    const result = limiter.isAllowed(clientId, limit);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: result.retryAfter
        }));
        return;
    }

    next();
}

/**
 * Create custom limiter for specific use case
 */
function createLimiter(options) {
    return new RateLimiter(options);
}

/**
 * Return the per-window request ceiling for a given API key billing tier.
 * Unknown tiers fall back to the 'free' limit.
 *
 * @param {'free'|'pro'|'enterprise'} apiKeyTier
 * @returns {number} Maximum requests per window
 */
function getApiKeyLimit(apiKeyTier) {
    const tierLimits = {
        'free': 60,
        'pro': 300,
        'enterprise': 1000
    };
    return tierLimits[apiKeyTier] || tierLimits.free;
}

module.exports = {
    limiter,
    rateLimitMiddleware,
    createLimiter,
    getApiKeyLimit,
    getStats: () => limiter.getStats(),
    reset: (clientId) => limiter.reset(clientId)
};
