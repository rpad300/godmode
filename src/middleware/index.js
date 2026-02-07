/**
 * Middleware Index
 * Central export for all middleware modules
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
