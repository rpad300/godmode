/**
 * Memory Pool Module
 * Manages memory for large datasets, prevents OOM
 */

class MemoryPool {
    constructor(options = {}) {
        // Memory limits (in MB)
        this.maxHeapMB = options.maxHeapMB || 512;
        this.warningThreshold = options.warningThreshold || 0.8; // 80%
        this.criticalThreshold = options.criticalThreshold || 0.9; // 90%
        
        // Pools for different data types
        this.pools = {
            embeddings: new Map(),
            documents: new Map(),
            cache: new Map()
        };

        // Pool size limits
        this.poolLimits = {
            embeddings: options.embeddingsLimit || 5000,
            documents: options.documentsLimit || 1000,
            cache: options.cacheLimit || 10000
        };

        // Stats
        this.stats = {
            allocations: 0,
            evictions: 0,
            gcTriggers: 0
        };

        // Start monitoring
        this.startMonitoring(options.monitorInterval || 30000);
    }

    /**
     * Allocate item to a pool
     */
    allocate(poolName, key, value) {
        const pool = this.pools[poolName];
        if (!pool) return false;

        // Check pool limit
        if (pool.size >= this.poolLimits[poolName]) {
            this.evictFromPool(poolName, 0.2); // Evict 20%
        }

        pool.set(key, {
            value,
            accessedAt: Date.now(),
            accessCount: 0,
            size: this.estimateSize(value)
        });

        this.stats.allocations++;
        return true;
    }

    /**
     * Get item from pool
     */
    get(poolName, key) {
        const pool = this.pools[poolName];
        if (!pool || !pool.has(key)) return null;

        const entry = pool.get(key);
        entry.accessedAt = Date.now();
        entry.accessCount++;
        return entry.value;
    }

    /**
     * Check if pool has item
     */
    has(poolName, key) {
        const pool = this.pools[poolName];
        return pool && pool.has(key);
    }

    /**
     * Remove item from pool
     */
    remove(poolName, key) {
        const pool = this.pools[poolName];
        if (pool) {
            return pool.delete(key);
        }
        return false;
    }

    /**
     * Evict items from a pool
     */
    evictFromPool(poolName, percentage = 0.2) {
        const pool = this.pools[poolName];
        if (!pool || pool.size === 0) return 0;

        const toEvict = Math.ceil(pool.size * percentage);
        
        // Sort by access time (oldest first) and access count (least accessed first)
        const entries = Array.from(pool.entries())
            .map(([key, entry]) => ({ key, ...entry }))
            .sort((a, b) => {
                const scoreA = a.accessCount + (Date.now() - a.accessedAt) / 60000;
                const scoreB = b.accessCount + (Date.now() - b.accessedAt) / 60000;
                return scoreA - scoreB;
            });

        let evicted = 0;
        for (let i = 0; i < toEvict && i < entries.length; i++) {
            pool.delete(entries[i].key);
            evicted++;
        }

        this.stats.evictions += evicted;
        return evicted;
    }

    /**
     * Estimate memory size of value
     */
    estimateSize(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'string') return value.length * 2;
        if (typeof value === 'number') return 8;
        if (Array.isArray(value)) {
            if (value.length > 0 && typeof value[0] === 'number') {
                return value.length * 8; // Float array (embedding)
            }
            return value.reduce((sum, v) => sum + this.estimateSize(v), 0);
        }
        if (typeof value === 'object') {
            return JSON.stringify(value).length * 2;
        }
        return 64;
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        const used = process.memoryUsage();
        return {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),
            heapTotal: Math.round(used.heapTotal / 1024 / 1024),
            external: Math.round(used.external / 1024 / 1024),
            rss: Math.round(used.rss / 1024 / 1024),
            percentage: (used.heapUsed / (this.maxHeapMB * 1024 * 1024) * 100).toFixed(1)
        };
    }

    /**
     * Check memory status
     */
    checkMemory() {
        const usage = this.getMemoryUsage();
        const usedRatio = usage.heapUsed / this.maxHeapMB;

        if (usedRatio >= this.criticalThreshold) {
            return {
                status: 'critical',
                message: `Memory at ${usage.percentage}% - immediate action required`,
                usage
            };
        }

        if (usedRatio >= this.warningThreshold) {
            return {
                status: 'warning',
                message: `Memory at ${usage.percentage}% - consider cleanup`,
                usage
            };
        }

        return {
            status: 'ok',
            message: `Memory at ${usage.percentage}%`,
            usage
        };
    }

    /**
     * Force garbage collection if available
     */
    forceGC() {
        if (global.gc) {
            global.gc();
            this.stats.gcTriggers++;
            return true;
        }
        return false;
    }

    /**
     * Emergency cleanup
     */
    emergencyCleanup() {
        console.log('[MemoryPool] Emergency cleanup triggered');
        
        // Evict 50% from all pools
        for (const poolName of Object.keys(this.pools)) {
            this.evictFromPool(poolName, 0.5);
        }

        // Force GC if available
        this.forceGC();

        return this.checkMemory();
    }

    /**
     * Start memory monitoring
     */
    startMonitoring(interval) {
        this.monitorInterval = setInterval(() => {
            const check = this.checkMemory();
            
            if (check.status === 'critical') {
                console.log('[MemoryPool]', check.message);
                this.emergencyCleanup();
            } else if (check.status === 'warning') {
                console.log('[MemoryPool]', check.message);
                // Evict 20% from caches
                this.evictFromPool('cache', 0.2);
            }
        }, interval);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
    }

    /**
     * Get pool statistics
     */
    getStats() {
        const poolStats = {};
        for (const [name, pool] of Object.entries(this.pools)) {
            poolStats[name] = {
                size: pool.size,
                limit: this.poolLimits[name],
                usage: ((pool.size / this.poolLimits[name]) * 100).toFixed(1) + '%'
            };
        }

        return {
            ...this.stats,
            memory: this.getMemoryUsage(),
            pools: poolStats
        };
    }

    /**
     * Clear all pools
     */
    clearAll() {
        for (const pool of Object.values(this.pools)) {
            pool.clear();
        }
        this.forceGC();
    }
}

// Singleton
let memoryPoolInstance = null;
function getMemoryPool(options = {}) {
    if (!memoryPoolInstance) {
        memoryPoolInstance = new MemoryPool(options);
    }
    return memoryPoolInstance;
}

module.exports = { MemoryPool, getMemoryPool };
