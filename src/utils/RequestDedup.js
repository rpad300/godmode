/**
 * RequestDedup - Deduplicates identical concurrent requests
 * 
 * If multiple clients make the same request at the same time,
 * only one request is processed and the result is shared.
 */

const crypto = require('crypto');
const { logger } = require('../logger');

const log = logger.child({ module: 'request-dedup' });

class RequestDedup {
    constructor(options = {}) {
        this.pending = new Map(); // requestKey -> Promise
        this.ttl = options.ttl || 2000; // How long to dedupe (2 seconds)
        this.stats = {
            requests: 0,
            deduplicated: 0
        };
    }

    /**
     * Generate a unique key for a request
     * @param {string} method 
     * @param {string} path 
     * @param {object|string} body 
     * @returns {string}
     */
    getKey(method, path, body = null) {
        const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
        const content = `${method}:${path}:${bodyStr}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Execute request with deduplication
     * If an identical request is already in progress, wait for its result
     * @param {string} key - Request key
     * @param {function} executeFn - Async function to execute
     * @returns {Promise<*>}
     */
    async execute(key, executeFn) {
        this.stats.requests++;

        // Check if identical request is already pending
        if (this.pending.has(key)) {
            this.stats.deduplicated++;
            log.debug({ event: 'request_dedup_hit', totalDeduplicated: this.stats.deduplicated }, 'Request deduplicated');
            return this.pending.get(key);
        }

        // Create and store the promise
        const promise = executeFn()
            .finally(() => {
                // Remove from pending after TTL
                setTimeout(() => {
                    this.pending.delete(key);
                }, this.ttl);
            });

        this.pending.set(key, promise);
        return promise;
    }

    /**
     * Get deduplication statistics
     * @returns {object}
     */
    getStats() {
        const rate = this.stats.requests > 0 
            ? ((this.stats.deduplicated / this.stats.requests) * 100).toFixed(1)
            : 0;
        return {
            ...this.stats,
            pending: this.pending.size,
            deduplicationRate: `${rate}%`
        };
    }

    /**
     * Clear all pending requests
     */
    clear() {
        this.pending.clear();
    }
}

// Singleton instance
let instance = null;

function getRequestDedup(options = {}) {
    if (!instance) {
        instance = new RequestDedup(options);
    }
    return instance;
}

module.exports = {
    RequestDedup,
    getRequestDedup
};
