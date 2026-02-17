/**
 * Purpose:
 *   In-memory LRU cache for Express JSON responses. Intercepts responses
 *   on cache miss, stores them, and replays them on subsequent identical
 *   requests within the TTL window.
 *
 * Responsibilities:
 *   - Provide a MemoryCache class implementing LRU eviction and TTL expiry
 *   - Supply cacheMiddleware that transparently caches GET-200-JSON responses
 *   - Expose targeted invalidation helpers for project, user, config, and
 *     dashboard mutations
 *
 * Key dependencies:
 *   - None (self-contained, no external libraries)
 *
 * Side effects:
 *   - Starts a 30-second setInterval for expired-entry cleanup (runs for
 *     the lifetime of the process; call cache.destroy() to stop)
 *   - Monkey-patches res.end inside cacheMiddleware to intercept response body
 *
 * Notes:
 *   - Cache keys include the authenticated user ID, so user A never sees
 *     user B's cached data.
 *   - Only 200 responses with valid JSON bodies are cached; error responses
 *     and non-JSON payloads pass through unaffected.
 *   - Mutation methods (POST/PUT/DELETE/PATCH) skip caching entirely via
 *     cacheConfig, but callers must still call the invalidation helpers
 *     after writes to avoid serving stale reads.
 */

/**
 * Simple in-memory LRU cache backed by a Map.
 *
 * LRU eviction is achieved by exploiting Map's insertion-order iteration:
 * on every `get` hit the entry is deleted and re-inserted, pushing it to
 * the "end" (most recently used). When the cache reaches maxSize, the
 * first (least recently used) entry is evicted.
 *
 * @param {object}  options
 * @param {number}  options.maxSize    - Maximum number of entries (default 1000)
 * @param {number}  options.defaultTTL - Default time-to-live in ms (default 60 000)
 */
class MemoryCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 60000; // 1 minute default
        this.hits = 0;
        this.misses = 0;

        // Cleanup expired entries periodically
        this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    }

    /**
     * Build a cache key that is unique per method + URL + authenticated user.
     * Anonymous requests share the key suffix 'anonymous', which means
     * unauthenticated users see a shared cached response for the same URL.
     */
    generateKey(req) {
        const url = req.url || '';
        const userId = req.user?.id || 'anonymous';
        return `${req.method}:${url}:${userId}`;
    }

    /**
     * Get cached value
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        this.hits++;
        
        // Move to end for LRU
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        return entry.value;
    }

    /**
     * Set cached value
     */
    set(key, value, ttl = null) {
        // Evict oldest if at max size
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttl || this.defaultTTL),
            createdAt: Date.now()
        });
    }

    /**
     * Invalidate cache entry
     */
    invalidate(key) {
        this.cache.delete(key);
    }

    /**
     * Invalidate all entries whose key *contains* the pattern substring.
     * This is a linear scan -- O(n) over all cached keys -- which is fine
     * for the expected maxSize of ~500 entries.
     */
    invalidatePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Destroy cache instance
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}

// Singleton instance
const cache = new MemoryCache({
    maxSize: 500,
    defaultTTL: 60000 // 1 minute
});

// Per-route TTL configuration. Routes are matched by prefix (first match wins).
// Mutation methods are globally skipped to prevent caching write operations.
const cacheConfig = {
    // Static config - cache longer
    '/api/config': { ttl: 300000 }, // 5 minutes
    '/api/auth/status': { ttl: 300000 },
    
    // Project data - moderate cache
    '/api/projects': { ttl: 30000 }, // 30 seconds
    
    // User-specific - short cache
    '/api/user/profile': { ttl: 10000 }, // 10 seconds
    '/api/notifications': { ttl: 5000 }, // 5 seconds
    
    // Never cache (mutations)
    'POST': { skip: true },
    'PUT': { skip: true },
    'DELETE': { skip: true },
    'PATCH': { skip: true }
};

/**
 * Get config for route
 */
function getRouteConfig(method, path) {
    // Skip mutations
    if (cacheConfig[method]?.skip) {
        return { skip: true };
    }

    // Find matching route config
    for (const pattern in cacheConfig) {
        if (path.startsWith(pattern)) {
            return cacheConfig[pattern];
        }
    }

    return { ttl: cache.defaultTTL };
}

/**
 * Express middleware that serves cached responses when available,
 * and transparently caches new 200/JSON responses.
 *
 * On a cache hit the response is written directly (bypassing downstream
 * handlers) with an `X-Cache: HIT` header. On a miss, res.end is
 * monkey-patched to capture the response body after downstream handlers
 * finish; if the status is 200 and the body parses as JSON, it is stored.
 *
 * Mutation methods (POST/PUT/DELETE/PATCH) are skipped via cacheConfig.
 */
function cacheMiddleware(req, res, next) {
    const config = getRouteConfig(req.method, req.url);
    
    // Skip if configured to skip
    if (config.skip) {
        return next();
    }

    const key = cache.generateKey(req);
    const cached = cache.get(key);

    if (cached) {
        // Return cached response
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
        });
        res.end(JSON.stringify(cached));
        return;
    }

    // Store original end to intercept response
    const originalEnd = res.end.bind(res);
    let responseBody = '';

    res.end = function(chunk) {
        if (chunk) {
            responseBody += chunk;
        }

        // Only cache successful JSON responses
        if (res.statusCode === 200) {
            try {
                const data = JSON.parse(responseBody);
                cache.set(key, data, config.ttl);
                res.setHeader('X-Cache', 'MISS');
            } catch (e) {
                // Not JSON, don't cache
            }
        }

        return originalEnd(chunk);
    };

    next();
}

/**
 * Invalidate all cached responses related to a specific project.
 * Also purges the project listing so it reflects updated membership/metadata.
 * Call this after any project mutation (create, update, delete, member change).
 */
function invalidateProjectCache(projectId) {
    cache.invalidatePattern(`/api/projects/${projectId}`);
    cache.invalidatePattern('/api/projects');
}

/**
 * Invalidate all cached responses scoped to a given user.
 * Uses the `:userId` suffix convention from generateKey (e.g. "GET:/api/profile:abc123").
 */
function invalidateUserCache(userId) {
    cache.invalidatePattern(`:${userId}`);
}

/**
 * Invalidate GET /api/config cache (call after POST /api/config)
 */
function invalidateConfigCache() {
    cache.invalidate('GET:/api/config:config');
}

/**
 * Invalidate GET /api/dashboard cache (e.g. after mutations so dashboard reflects fresh data)
 */
function invalidateDashboardCache() {
    cache.invalidatePattern('GET:/api/dashboard');
}

module.exports = {
    cache,
    cacheMiddleware,
    invalidateProjectCache,
    invalidateUserCache,
    invalidateConfigCache,
    invalidateDashboardCache,
    getStats: () => cache.getStats()
};
