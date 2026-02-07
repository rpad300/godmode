/**
 * Rate Limiting Middleware
 * Token bucket algorithm for API rate limiting
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
     * Get client identifier from request
     */
    getClientId(req) {
        // Try API key first
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
     * Check if request is allowed
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

// Route-specific limits
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
 * Get limit for route
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
 * Rate limit middleware
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
 * API key specific rate limiting
 * Higher limits for authenticated API keys
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
