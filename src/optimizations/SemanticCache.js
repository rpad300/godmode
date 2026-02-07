/**
 * Semantic Cache Module
 * Cache based on semantic similarity - similar queries return cached results
 * Uses embeddings to find semantically similar past queries
 */

const llm = require('../llm');

class SemanticCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.similarityThreshold = options.similarityThreshold || 0.92;
        this.ttl = options.ttl || 30 * 60 * 1000; // 30 minutes
        this.llmConfig = options.llmConfig || {};
        
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
     * Get cached response for a query (exact or semantic match)
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
     * Store query and response in cache
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
            const result = await llm.embed({
                provider: this.llmConfig?.embeddingsProvider || 'ollama',
                providerConfig: this.llmConfig?.providers?.[this.llmConfig?.embeddingsProvider] || {},
                model: this.llmConfig?.models?.embeddings || 'mxbai-embed-large',
                texts: [text]
            });

            if (result.success && result.embeddings?.[0]) {
                return result.embeddings[0];
            }
        } catch (e) {
            console.log('[SemanticCache] Embedding error:', e.message);
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
