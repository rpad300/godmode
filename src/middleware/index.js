/**
 * Purpose:
 *   Barrel export that aggregates and re-exports all middleware modules
 *   under a single, unified interface for route-level consumption.
 *
 * Responsibilities:
 *   - Re-export cache middleware functions and the singleton cache instance
 *   - Re-export rate limiting middleware functions and the singleton limiter instance
 *
 * Key dependencies:
 *   - ./cache: In-memory LRU response caching
 *   - ./ratelimit: Fixed-window rate limiting per client
 *
 * Notes:
 *   - Auth middleware (./auth) is intentionally NOT re-exported here;
 *     it is imported directly by route files that need fine-grained
 *     control over requireAuth, requireProjectAccess, etc.
 *   - Some exports are renamed for clarity (e.g. cache.getStats -> getCacheStats,
 *     ratelimit.getStats -> getRateLimitStats) to avoid collisions.
 */

const cache = require('./cache');
const ratelimit = require('./ratelimit');

module.exports = {
    // Cache middleware
    cache: cache.cache,
    cacheMiddleware: cache.cacheMiddleware,
    invalidateProjectCache: cache.invalidateProjectCache,
    invalidateUserCache: cache.invalidateUserCache,
    getCacheStats: cache.getStats,

    // Rate limiting middleware
    limiter: ratelimit.limiter,
    rateLimitMiddleware: ratelimit.rateLimitMiddleware,
    createLimiter: ratelimit.createLimiter,
    getApiKeyLimit: ratelimit.getApiKeyLimit,
    getRateLimitStats: ratelimit.getStats,
    resetRateLimit: ratelimit.reset
};
