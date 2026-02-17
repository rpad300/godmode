/**
 * Purpose:
 *   Provides an in-memory key-value cache with TTL expiration, LRU eviction,
 *   and a specialised QueryCache subclass for GraphRAG query results.
 *
 * Responsibilities:
 *   - Store/retrieve values with automatic TTL expiration
 *   - Evict least-recently-used entries when capacity is reached
 *   - Track hit/miss/eviction statistics for observability
 *   - Namespace keys to isolate cache domains
 *   - QueryCache normalises query text for consistent cache keys
 *
 * Key dependencies:
 *   - ../logger: Structured logging (pino)
 *
 * Side effects:
 *   - Starts a 60-second setInterval for expired-entry cleanup; call destroy() to clear
 *
 * Notes:
 *   - LRU eviction is O(n) over the Map; acceptable for the default 1000-entry cap
 *   - getOrCompute() is not concurrency-safe -- parallel callers may compute simultaneously
 *   - Singleton factories (getCache / getQueryCache) ignore options after first call
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'cache' });

/**
 * Generic in-memory cache backed by a JS Map.
 * Entries carry a TTL and are evicted LRU-style when the map is full.
 * A 60-second cleanup interval removes expired entries proactively.
 */
class Cache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };
        
        // Periodic cleanup
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Generate cache key with optional namespace
     * @param {string} namespace 
     * @param {string} key 
     * @returns {string}
     */
    makeKey(namespace, key) {
        return namespace ? `${namespace}:${key}` : key;
    }

    /**
     * Get value from cache
     * @param {string} key 
     * @param {string} namespace 
     * @returns {*|undefined}
     */
    get(key, namespace = null) {
        const cacheKey = this.makeKey(namespace, key);
        const entry = this.cache.get(cacheKey);
        
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        
        // Check if expired
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(cacheKey);
            this.stats.misses++;
            return undefined;
        }
        
        // Update access time for LRU
        entry.lastAccess = Date.now();
        this.stats.hits++;
        
        return entry.value;
    }

    /**
     * Set value in cache
     * @param {string} key 
     * @param {*} value 
     * @param {object} options 
     */
    set(key, value, options = {}) {
        const namespace = options.namespace || null;
        const ttl = options.ttl || this.defaultTTL;
        const cacheKey = this.makeKey(namespace, key);
        
        // Evict if at max size
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        
        this.cache.set(cacheKey, {
            value,
            createdAt: Date.now(),
            lastAccess: Date.now(),
            expiresAt: ttl > 0 ? Date.now() + ttl : null
        });
        
        this.stats.sets++;
    }

    /**
     * Check if key exists (and is not expired)
     * @param {string} key 
     * @param {string} namespace 
     * @returns {boolean}
     */
    has(key, namespace = null) {
        const cacheKey = this.makeKey(namespace, key);
        const entry = this.cache.get(cacheKey);
        
        if (!entry) return false;
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(cacheKey);
            return false;
        }
        
        return true;
    }

    /**
     * Delete key from cache
     * @param {string} key 
     * @param {string} namespace 
     * @returns {boolean}
     */
    delete(key, namespace = null) {
        const cacheKey = this.makeKey(namespace, key);
        return this.cache.delete(cacheKey);
    }

    /**
     * Clear all entries (optionally by namespace)
     * @param {string} namespace 
     */
    clear(namespace = null) {
        if (!namespace) {
            this.cache.clear();
            return;
        }
        
        const prefix = `${namespace}:`;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldest = null;
        let oldestKey = null;
        
        for (const [key, entry] of this.cache.entries()) {
            if (!oldest || entry.lastAccess < oldest.lastAccess) {
                oldest = entry;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
            : 0;
            
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * Get or compute value (with caching)
     * @param {string} key 
     * @param {function} computeFn - Async function to compute value if not cached
     * @param {object} options 
     * @returns {Promise<*>}
     */
    async getOrCompute(key, computeFn, options = {}) {
        const cached = this.get(key, options.namespace);
        if (cached !== undefined) {
            return cached;
        }
        
        const value = await computeFn();
        this.set(key, value, options);
        return value;
    }

    /**
     * Destroy cache (clear interval)
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }
}

/**
 * Specialised cache for GraphRAG query results.
 * Uses normalised (lowercase, whitespace-collapsed) query text as the cache key
 * so that trivially different phrasings hit the same entry.
 * Default TTL is 10 minutes (vs 5 for the base Cache).
 */
class QueryCache extends Cache {
    constructor(options = {}) {
        super({
            maxSize: options.maxSize || 500,
            defaultTTL: options.defaultTTL || 10 * 60 * 1000, // 10 minutes for queries
            ...options
        });
    }

    /**
     * Generate cache key from query
     * Only uses query text for key (not options)
     * @param {string} query 
     * @returns {string}
     */
    queryKey(query) {
        const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
        return `q:${normalized}`;
    }

    /**
     * Get cached query result
     * @param {string} query 
     * @returns {*|undefined}
     */
    getQuery(query) {
        const key = this.queryKey(query);
        const result = this.get(key);
        if (result) {
            log.debug({ event: 'cache_query_hit', queryPreview: query.substring(0, 30) }, 'Hit for query');
        }
        return result;
    }

    /**
     * Cache query result
     * @param {string} query 
     * @param {*} result 
     * @param {object} options - { ttl }
     */
    setQuery(query, result, options = {}) {
        const key = this.queryKey(query);
        log.debug({ event: 'cache_query_store', queryPreview: query.substring(0, 30) }, 'Storing query');
        this.set(key, result, {
            ttl: options.ttl || this.defaultTTL
        });
    }
}

// Singleton instances
let cacheInstance = null;
let queryCacheInstance = null;

function getCache(options = {}) {
    if (!cacheInstance) {
        cacheInstance = new Cache(options);
    }
    return cacheInstance;
}

function getQueryCache(options = {}) {
    if (!queryCacheInstance) {
        queryCacheInstance = new QueryCache(options);
    }
    return queryCacheInstance;
}

module.exports = {
    Cache,
    QueryCache,
    getCache,
    getQueryCache
};
