/**
 * Purpose:
 *   Protect API endpoints from abuse using a sliding-window rate limiter
 *   with per-type limits, automatic blocking, and Express middleware
 *   integration.
 *
 * Responsibilities:
 *   - Track request timestamps per key (IP or identifier) in a sliding
 *     window and allow/deny based on configurable limits per type
 *     (default, chat, embeddings, graph, export)
 *   - Automatically block keys after 10 rate-limit violations
 *   - Provide Express middleware that sets standard rate-limit headers
 *     (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 *     and returns HTTP 429 when exceeded
 *   - Periodically clean up stale timestamp entries (every 60s)
 *
 * Key dependencies:
 *   - None (self-contained, in-memory implementation)
 *
 * Side effects:
 *   - Starts a cleanup setInterval on construction
 *   - The middleware method sends HTTP responses directly (429)
 *
 * Notes:
 *   - All state is in-memory; a server restart clears all counters and
 *     blocks. For distributed deployments, an external store (Redis) would
 *     be needed.
 *   - The sliding window filters old timestamps on every check call, so
 *     per-request overhead scales with the window size.
 *   - Call destroy() before shutdown to clear the cleanup interval.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'rate-limiter' });

/**
 * Sliding-window rate limiter with per-type limits, auto-blocking, and
 * Express middleware support.
 *
 * Lifecycle: construct (starts cleanup timer) -> check/middleware -> destroy.
 *
 * @param {object} options
 * @param {object} [options.limits] - Map of type -> {requests, window} overrides
 */
class RateLimiter {
    constructor(options = {}) {
        // Default limits
        this.limits = options.limits || {
            'default': { requests: 100, window: 60000 },      // 100 req/min
            'chat': { requests: 20, window: 60000 },          // 20 req/min
            'embeddings': { requests: 50, window: 60000 },    // 50 req/min
            'graph': { requests: 200, window: 60000 },        // 200 req/min
            'export': { requests: 5, window: 300000 }         // 5 req/5min
        };

        // Request tracking: { key: { timestamps: [], blocked: false } }
        this.requests = new Map();
        
        // Blocked IPs/keys
        this.blocked = new Set();
        
        // Stats
        this.stats = {
            totalRequests: 0,
            blocked: 0,
            rateLimited: 0
        };

        // Cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check whether a request from `key` is allowed under the given type's
     * limit. Records the timestamp if allowed. Auto-blocks after 10 violations.
     * @param {string} key - Identifier (IP, user ID, API key, etc.)
     * @param {string} [type='default'] - Rate limit tier
     * @returns {{allowed: boolean, remaining?: number, limit?: number, reset?: string, retryAfter?: number, reason?: string}}
     */
    check(key, type = 'default') {
        this.stats.totalRequests++;

        // Check if permanently blocked
        if (this.blocked.has(key)) {
            this.stats.blocked++;
            return {
                allowed: false,
                reason: 'blocked',
                retryAfter: null
            };
        }

        const limit = this.limits[type] || this.limits['default'];
        const now = Date.now();
        const windowStart = now - limit.window;

        // Get or create request tracking
        if (!this.requests.has(key)) {
            this.requests.set(key, { timestamps: [], violations: 0 });
        }

        const tracker = this.requests.get(key);
        
        // Remove old timestamps
        tracker.timestamps = tracker.timestamps.filter(t => t > windowStart);

        // Check limit
        if (tracker.timestamps.length >= limit.requests) {
            tracker.violations++;
            this.stats.rateLimited++;

            // Calculate retry after
            const oldestInWindow = tracker.timestamps[0];
            const retryAfter = Math.ceil((oldestInWindow + limit.window - now) / 1000);

            // Auto-block after too many violations
            if (tracker.violations >= 10) {
                this.block(key, 'Too many violations');
            }

            return {
                allowed: false,
                reason: 'rate_limited',
                retryAfter,
                remaining: 0,
                limit: limit.requests,
                reset: new Date(oldestInWindow + limit.window).toISOString()
            };
        }

        // Allow request
        tracker.timestamps.push(now);

        return {
            allowed: true,
            remaining: limit.requests - tracker.timestamps.length,
            limit: limit.requests,
            reset: new Date(now + limit.window).toISOString()
        };
    }

    /**
     * Record a request (alternative to check that just records)
     */
    record(key, type = 'default') {
        const result = this.check(key, type);
        return result;
    }

    /**
     * Block a key
     */
    block(key, reason = null) {
        this.blocked.add(key);
        log.info({ event: 'rate_limiter_blocked', key, reason: reason || 'No reason' }, 'Blocked');
        return true;
    }

    /**
     * Unblock a key
     */
    unblock(key) {
        this.blocked.delete(key);
        // Reset violations
        if (this.requests.has(key)) {
            this.requests.get(key).violations = 0;
        }
        return true;
    }

    /**
     * Get rate limit status for a key
     */
    getStatus(key, type = 'default') {
        const limit = this.limits[type] || this.limits['default'];
        const now = Date.now();
        const windowStart = now - limit.window;

        if (!this.requests.has(key)) {
            return {
                used: 0,
                remaining: limit.requests,
                limit: limit.requests,
                blocked: false
            };
        }

        const tracker = this.requests.get(key);
        const validTimestamps = tracker.timestamps.filter(t => t > windowStart);

        return {
            used: validTimestamps.length,
            remaining: Math.max(0, limit.requests - validTimestamps.length),
            limit: limit.requests,
            blocked: this.blocked.has(key),
            violations: tracker.violations
        };
    }

    /**
     * Set custom limit for a type
     */
    setLimit(type, requests, window) {
        this.limits[type] = { requests, window };
    }

    /**
     * Cleanup old entries
     */
    cleanup() {
        const now = Date.now();
        const maxWindow = Math.max(...Object.values(this.limits).map(l => l.window));

        for (const [key, tracker] of this.requests) {
            tracker.timestamps = tracker.timestamps.filter(t => t > now - maxWindow);
            
            // Remove empty trackers
            if (tracker.timestamps.length === 0 && tracker.violations === 0) {
                this.requests.delete(key);
            }
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            trackedKeys: this.requests.size,
            blockedKeys: this.blocked.size,
            limits: this.limits
        };
    }

    /**
     * Reset all tracking
     */
    reset() {
        this.requests.clear();
        this.blocked.clear();
        this.stats = { totalRequests: 0, blocked: 0, rateLimited: 0 };
    }

    /**
     * Create Express middleware that enforces rate limits and sets standard
     * rate-limit response headers. Returns HTTP 429 when the limit is exceeded.
     * @param {string} [type='default'] - Rate limit tier to apply
     * @returns {function(req, res, next): void}
     */
    middleware(type = 'default') {
        return (req, res, next) => {
            const key = req.ip || req.connection.remoteAddress || 'unknown';
            const result = this.check(key, type);

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', result.limit || 0);
            res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
            if (result.reset) res.setHeader('X-RateLimit-Reset', result.reset);

            if (!result.allowed) {
                res.setHeader('Retry-After', result.retryAfter || 60);
                res.status(429).json({
                    error: 'Too Many Requests',
                    message: result.reason === 'blocked' 
                        ? 'Your IP has been blocked' 
                        : 'Rate limit exceeded',
                    retryAfter: result.retryAfter
                });
                return;
            }

            next();
        };
    }

    /**
     * Stop cleanup interval
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Singleton
let rateLimiterInstance = null;
function getRateLimiter(options = {}) {
    if (!rateLimiterInstance) {
        rateLimiterInstance = new RateLimiter(options);
    }
    return rateLimiterInstance;
}

module.exports = { RateLimiter, getRateLimiter };
