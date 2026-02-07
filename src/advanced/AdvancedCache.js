/**
 * Advanced Caching Module
 * LRU cache with TTL, invalidation, and Supabase persistence
 * 
 * Refactored to use Supabase instead of local JSON files
 */

// Try to load Supabase - may fail due to project folder name conflict
let getStorage = null;
try {
    getStorage = require('../supabase/storageHelper').getStorage;
} catch (e) {
    // Will use in-memory cache only
}

class AdvancedCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
        this.cache = new Map();
        this.accessOrder = []; // For LRU
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0,
            invalidations: 0
        };
        this.invalidationRules = new Map(); // pattern -> callback
        
        // Auto-persist interval
        this._persistInterval = setInterval(() => this._persistToSupabase(), 60000);
        
        // Load from Supabase on startup
        this._loadFromSupabase();
    }

    /**
     * Get storage instance
     */
    _getStorage() {
        if (!getStorage) return null;
        try {
            return getStorage();
        } catch (e) {
            return null;
        }
    }

    /**
     * Load cache from Supabase
     */
    async _loadFromSupabase() {
        try {
            const storage = this._getStorage();
            if (!storage) return;
            
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return;
            
            const { data } = await supabase
                .from('cache_entries')
                .select('cache_key, cache_value, expires_at')
                .eq('project_id', projectId)
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
            
            if (data) {
                for (const entry of data) {
                    this.cache.set(entry.cache_key, {
                        value: entry.cache_value,
                        expiresAt: entry.expires_at ? new Date(entry.expires_at).getTime() : null
                    });
                    this.accessOrder.push(entry.cache_key);
                }
            }
        } catch (e) {
            console.warn('[AdvancedCache] Could not load from Supabase:', e.message);
        }
    }

    /**
     * Persist dirty cache entries to Supabase
     */
    async _persistToSupabase() {
        try {
            const storage = this._getStorage();
            if (!storage) return;
            
            const supabase = storage.supabase;
            const projectId = storage.currentProjectId;
            
            if (!projectId) return;
            
            // Persist entries with remaining TTL > 5 minutes
            const minTTL = Date.now() + 5 * 60 * 1000;
            const entries = [];
            
            for (const [key, entry] of this.cache) {
                if (!entry.expiresAt || entry.expiresAt > minTTL) {
                    entries.push({
                        project_id: projectId,
                        cache_key: key,
                        cache_value: entry.value,
                        expires_at: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null
                    });
                }
            }
            
            if (entries.length > 0) {
                // Batch upsert
                await supabase
                    .from('cache_entries')
                    .upsert(entries, { onConflict: 'project_id,cache_key' });
            }
        } catch (e) {
            console.warn('[AdvancedCache] Could not persist to Supabase:', e.message);
        }
    }

    /**
     * Get a value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check expiration
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            this._removeFromAccessOrder(key);
            this.stats.misses++;
            return undefined;
        }

        // Update access order (LRU)
        this._updateAccessOrder(key);
        this.stats.hits++;
        
        return entry.value;
    }

    /**
     * Set a value in cache
     */
    set(key, value, ttl = null) {
        const expiresAt = ttl !== null 
            ? Date.now() + ttl 
            : (this.defaultTTL ? Date.now() + this.defaultTTL : null);

        // Evict if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this._evictLRU();
        }

        this.cache.set(key, { value, expiresAt, setAt: Date.now() });
        this._updateAccessOrder(key);
        this.stats.sets++;

        // Check invalidation rules
        this._checkInvalidationRules(key);

        return true;
    }

    /**
     * Delete a key from cache
     */
    delete(key) {
        const existed = this.cache.delete(key);
        this._removeFromAccessOrder(key);
        return existed;
    }

    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Clear entire cache
     */
    async clear() {
        this.cache.clear();
        this.accessOrder = [];
        this.stats.invalidations++;
        
        // Clear from Supabase too
        try {
            const storage = this._getStorage();
            if (storage) {
                await storage.clearCache();
            }
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(pattern) {
        let count = 0;
        const regex = typeof pattern === 'string' 
            ? new RegExp(pattern.replace(/\*/g, '.*'))
            : pattern;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
                count++;
            }
        }

        this.stats.invalidations += count;
        return count;
    }

    /**
     * Add an invalidation rule
     */
    addInvalidationRule(pattern, callback) {
        this.invalidationRules.set(pattern, callback);
    }

    /**
     * Check and trigger invalidation rules
     */
    _checkInvalidationRules(key) {
        for (const [pattern, callback] of this.invalidationRules) {
            if (key.match(pattern)) {
                callback(key);
            }
        }
    }

    /**
     * Update access order for LRU
     */
    _updateAccessOrder(key) {
        this._removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * Remove from access order
     */
    _removeFromAccessOrder(key) {
        const idx = this.accessOrder.indexOf(key);
        if (idx !== -1) {
            this.accessOrder.splice(idx, 1);
        }
    }

    /**
     * Evict least recently used entry
     */
    _evictLRU() {
        // First, try to evict expired entries
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
                this.stats.evictions++;
                return;
            }
        }

        // Evict least recently used
        if (this.accessOrder.length > 0) {
            const lruKey = this.accessOrder.shift();
            this.cache.delete(lruKey);
            this.stats.evictions++;
        }
    }

    /**
     * Get or compute a value
     */
    async getOrSet(key, computeFn, ttl = null) {
        const existing = this.get(key);
        if (existing !== undefined) {
            return existing;
        }

        const value = await computeFn();
        this.set(key, value, ttl);
        return value;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = (this.stats.hits + this.stats.misses) > 0
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
     * Get all keys matching a pattern
     */
    keys(pattern = null) {
        if (!pattern) {
            return Array.from(this.cache.keys());
        }

        const regex = typeof pattern === 'string'
            ? new RegExp(pattern.replace(/\*/g, '.*'))
            : pattern;

        return Array.from(this.cache.keys()).filter(key => regex.test(key));
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
                this._removeFromAccessOrder(key);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Destroy cache and stop auto-persist
     */
    async destroy() {
        if (this._persistInterval) {
            clearInterval(this._persistInterval);
        }
        await this._persistToSupabase();
    }
}

// Singleton
let advancedCacheInstance = null;
function getAdvancedCache(options = {}) {
    if (!advancedCacheInstance) {
        advancedCacheInstance = new AdvancedCache(options);
    }
    return advancedCacheInstance;
}

module.exports = { AdvancedCache, getAdvancedCache };
