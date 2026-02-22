/**
 * Purpose:
 *   Cache query results using both exact-match and embedding-based
 *   semantic similarity, so that rephrased questions can return
 *   previously computed answers without a new LLM call.
 *
 * Responsibilities:
 *   - Store query/response pairs with their embedding vectors
 *   - On lookup, first attempt an exact (normalized string) match, then
 *     fall back to cosine-similarity search over stored embeddings
 *   - Evict expired entries (TTL, default 30 min) and least-used entries
 *     when the cache reaches capacity (default 1000)
 *   - Track hit/miss/semantic-hit statistics and hit-rate percentage
 *   - Support pattern-based cache invalidation
 *
 * Key dependencies:
 *   - ../llm: embedding generation for new queries
 *   - ../llm/config: per-task embeddings provider/model resolution
 *
 * Side effects:
 *   - Makes embedding API calls on cache get (for semantic matching) and
 *     cache set (to store the vector)
 *
 * Notes:
 *   - Similarity search is brute-force O(n) over all cached embeddings;
 *     this is acceptable for the default 1000-entry limit but would need
 *     an ANN index for larger caches.
 *   - The default similarity threshold (0.92) is deliberately high to
 *     minimize false-positive cache hits.
 *   - If the embedding provider is unavailable, the cache degrades to
 *     exact-match only (no semantic lookup).
 */

const { logger } = require('../logger');
const llmRouter = require('../llm/router');

const log = logger.child({ module: 'semantic-cache' });

/**
 * Two-tier cache: exact string match then cosine-similarity search over
 * embedding vectors. Supports TTL expiration and LRU-style eviction.
 *
 * @param {object} options
 * @param {number} [options.maxSize=1000] - Maximum cache entries
 * @param {number} [options.similarityThreshold=0.92] - Minimum cosine similarity for a semantic hit
 * @param {number} [options.ttl=1800000] - Time-to-live in ms (default 30 min)
 * @param {object} [options.llmConfig] - LLM configuration for embedding generation
 * @param {object} [options.appConfig] - App-level config for per-task resolution
 */
class SemanticCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.similarityThreshold = options.similarityThreshold || 0.92;
        this.ttl = options.ttl || 30 * 60 * 1000; // 30 minutes
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        this._resolvedConfig = this.appConfig || { llm: this.llmConfig };

        // Cache storage: { embedding, query, response, timestamp, hits }
        this.cache = new Map();
        this.embeddings = []; // Array of { key, embedding }
        
        // Stats
        this.stats = {
            hits: 0,
            misses: 0,
            semanticHits: 0,
            totalQueries: 0
        };
    }

    /**
     * Look up a cached response. Tries exact normalized match first, then
     * brute-force cosine similarity over stored embeddings.
     * @param {string} query - User query
     * @returns {Promise<{hit: boolean, type?: 'exact'|'semantic', similarity?: number, data?: *, originalQuery?: string}>}
     */
    async get(query) {
        this.stats.totalQueries++;
        
        // Normalize query
        const normalizedQuery = this.normalizeQuery(query);
        
        // 1. Try exact match first
        if (this.cache.has(normalizedQuery)) {
            const entry = this.cache.get(normalizedQuery);
            if (!this.isExpired(entry)) {
                entry.hits++;
                this.stats.hits++;
                return { hit: true, type: 'exact', data: entry.response };
            }
            this.cache.delete(normalizedQuery);
        }

        // 2. Try semantic match
        if (this.embeddings.length > 0) {
            const queryEmbedding = await this.getEmbedding(query);
            if (queryEmbedding) {
                const similar = this.findSimilar(queryEmbedding);
                if (similar) {
                    const entry = this.cache.get(similar.key);
                    if (entry && !this.isExpired(entry)) {
                        entry.hits++;
                        this.stats.semanticHits++;
                        this.stats.hits++;
                        return { 
                            hit: true, 
                            type: 'semantic', 
                            similarity: similar.similarity,
                            originalQuery: entry.query,
                            data: entry.response 
                        };
                    }
                }
            }
        }

        this.stats.misses++;
        return { hit: false };
    }

    /**
     * Store a query/response pair in the cache along with its embedding vector.
     * Evicts 10% of entries when at capacity.
     * @param {string} query - The query string
     * @param {*} response - The response data to cache
     * @returns {Promise<boolean>} true on success
     */
    async set(query, response) {
        const normalizedQuery = this.normalizeQuery(query);
        
        // Get embedding for semantic matching
        const embedding = await this.getEmbedding(query);
        
        // Evict old entries if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        const entry = {
            query,
            response,
            embedding,
            timestamp: Date.now(),
            hits: 0
        };

        this.cache.set(normalizedQuery, entry);
        
        if (embedding) {
            this.embeddings.push({ key: normalizedQuery, embedding });
        }

        return true;
    }

    /**
     * Normalize query for exact matching
     */
    normalizeQuery(query) {
        return query.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * Get embedding for a query
     */
    async getEmbedding(text) {
        try {
            const routerResult = await llmRouter.routeAndExecute('embeddings', 'embed', {
                texts: [text],
                context: 'semantic-cache'
            }, this._resolvedConfig);

            if (routerResult.success && routerResult.result?.embeddings?.[0]) {
                return routerResult.result.embeddings[0];
            }
        } catch (e) {
            log.warn({ event: 'semantic_cache_embedding_error', message: e.message }, 'Embedding error');
        }
        return null;
    }

    /**
     * Find semantically similar cached query
     */
    findSimilar(queryEmbedding) {
        let bestMatch = null;
        let bestSimilarity = 0;

        for (const { key, embedding } of this.embeddings) {
            const similarity = this.cosineSimilarity(queryEmbedding, embedding);
            if (similarity >= this.similarityThreshold && similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = { key, similarity };
            }
        }

        return bestMatch;
    }

    /**
     * Cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Check if entry is expired
     */
    isExpired(entry) {
        return Date.now() - entry.timestamp > this.ttl;
    }

    /**
     * Evict oldest/least used entries
     */
    evictOldest() {
        // Find entries to evict (oldest with least hits)
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({ key, ...entry }))
            .sort((a, b) => {
                // Expired first
                if (this.isExpired(a) !== this.isExpired(b)) {
                    return this.isExpired(a) ? -1 : 1;
                }
                // Then by hits (ascending)
                if (a.hits !== b.hits) return a.hits - b.hits;
                // Then by age (oldest first)
                return a.timestamp - b.timestamp;
            });

        // Remove 10% of cache
        const toRemove = Math.max(1, Math.floor(this.maxSize * 0.1));
        for (let i = 0; i < toRemove && i < entries.length; i++) {
            this.cache.delete(entries[i].key);
            this.embeddings = this.embeddings.filter(e => e.key !== entries[i].key);
        }
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.embeddings = [];
        this.stats = { hits: 0, misses: 0, semanticHits: 0, totalQueries: 0 };
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.totalQueries > 0 
            ? (this.stats.hits / this.stats.totalQueries * 100).toFixed(1)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            cacheSize: this.cache.size,
            embeddingsCount: this.embeddings.length
        };
    }

    /**
     * Invalidate entries matching a pattern
     */
    invalidate(pattern) {
        let removed = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern.toLowerCase())) {
                this.cache.delete(key);
                this.embeddings = this.embeddings.filter(e => e.key !== key);
                removed++;
            }
        }
        return removed;
    }
}

// Singleton
let semanticCacheInstance = null;
function getSemanticCache(options = {}) {
    if (!semanticCacheInstance) {
        semanticCacheInstance = new SemanticCache(options);
    }
    if (options.llmConfig) semanticCacheInstance.llmConfig = options.llmConfig;
    return semanticCacheInstance;
}

module.exports = { SemanticCache, getSemanticCache };
