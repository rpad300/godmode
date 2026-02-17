/**
 * Purpose:
 *   Efficiently compute embeddings for large numbers of texts by batching
 *   requests and caching results in memory.
 *
 * Responsibilities:
 *   - Split input texts into configurable batch sizes and process them
 *     with retry logic against the LLM embedding endpoint
 *   - Maintain an in-memory embedding cache (LRU-style eviction at 10%
 *     when the cache reaches capacity)
 *   - Provide both sequential (embedTexts) and parallel (embedTextsParallel)
 *     processing modes with concurrency control
 *   - Track hit/miss statistics for cache efficiency monitoring
 *
 * Key dependencies:
 *   - ../llm: embedding API calls
 *   - ../llm/config: per-task embeddings provider/model resolution
 *
 * Side effects:
 *   - Makes network calls to the configured embeddings provider
 *
 * Notes:
 *   - The cache key is a simple hash of the first/last characters and
 *     length of the text; collisions are unlikely but theoretically
 *     possible for texts that share prefix, suffix, and length.
 *   - Retry delay increases linearly (retryDelay * attemptNumber).
 */

const { logger } = require('../logger');
const llm = require('../llm');

const log = logger.child({ module: 'batch-embeddings' });

class BatchEmbeddings {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 20;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        
        // Embedding cache
        this.cache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 10000;
        
        // Stats
        this.stats = {
            totalProcessed: 0,
            cacheHits: 0,
            batchCount: 0,
            errors: 0
        };
    }

    /**
     * Get embeddings for multiple texts efficiently
     */
    async embedTexts(texts, options = {}) {
        if (!texts || texts.length === 0) {
            return { success: true, embeddings: [] };
        }

        const results = new Array(texts.length);
        const toProcess = [];

        // Check cache first
        for (let i = 0; i < texts.length; i++) {
            const cacheKey = this.getCacheKey(texts[i]);
            if (this.cache.has(cacheKey)) {
                results[i] = this.cache.get(cacheKey);
                this.stats.cacheHits++;
            } else {
                toProcess.push({ index: i, text: texts[i] });
            }
        }

        if (toProcess.length === 0) {
            return { 
                success: true, 
                embeddings: results,
                fromCache: true,
                stats: this.stats
            };
        }

        // Process in batches
        const batches = this.chunk(toProcess, this.batchSize);
        
        for (const batch of batches) {
            try {
                const batchTexts = batch.map(b => b.text);
                const batchEmbeddings = await this.processBatch(batchTexts, options);
                
                if (batchEmbeddings.success) {
                    for (let i = 0; i < batch.length; i++) {
                        const originalIndex = batch[i].index;
                        const embedding = batchEmbeddings.embeddings[i];
                        results[originalIndex] = embedding;
                        
                        // Cache the result
                        const cacheKey = this.getCacheKey(batch[i].text);
                        this.cacheEmbedding(cacheKey, embedding);
                    }
                    this.stats.batchCount++;
                }
            } catch (e) {
                log.warn({ event: 'batch_embeddings_batch_error', message: e.message }, 'Batch error');
                this.stats.errors++;
            }
        }

        this.stats.totalProcessed += texts.length;

        return {
            success: true,
            embeddings: results,
            processed: toProcess.length,
            fromCache: texts.length - toProcess.length,
            stats: this.stats
        };
    }

    /**
     * Process a single batch
     */
    async processBatch(texts, options = {}) {
        const embedCfg = this.appConfig ? require('../llm/config').getEmbeddingsConfig(this.appConfig) : null;
        const provider = options.provider || embedCfg?.provider || this.llmConfig?.embeddingsProvider;
        const model = options.model || embedCfg?.model || this.llmConfig?.models?.embeddings;
        const providerConfig = embedCfg?.providerConfig || this.llmConfig?.providers?.[provider] || {};
        if (!provider || !model) return { success: false, embeddings: [] };
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const result = await llm.embed({
                    provider,
                    providerConfig,
                    model,
                    texts
                });

                if (result.success) {
                    return result;
                }

                if (attempt < this.retryAttempts) {
                    await this.sleep(this.retryDelay * attempt);
                }
            } catch (e) {
                if (attempt < this.retryAttempts) {
                    await this.sleep(this.retryDelay * attempt);
                } else {
                    throw e;
                }
            }
        }

        return { success: false, embeddings: [] };
    }

    /**
     * Get cache key for text
     */
    getCacheKey(text) {
        // Simple hash based on first/last chars and length
        const trimmed = text.trim().substring(0, 200);
        return `${trimmed.length}:${trimmed.substring(0, 50)}:${trimmed.substring(trimmed.length - 20)}`;
    }

    /**
     * Cache an embedding
     */
    cacheEmbedding(key, embedding) {
        // Evict if at capacity
        if (this.cache.size >= this.cacheMaxSize) {
            // Remove oldest entries (first 10%)
            const keysToRemove = Array.from(this.cache.keys())
                .slice(0, Math.floor(this.cacheMaxSize * 0.1));
            for (const k of keysToRemove) {
                this.cache.delete(k);
            }
        }
        this.cache.set(key, embedding);
    }

    /**
     * Process documents with embeddings
     */
    async embedDocuments(documents, textField = 'content') {
        const texts = documents.map(d => d[textField] || '');
        const result = await this.embedTexts(texts);

        if (result.success) {
            return {
                success: true,
                documents: documents.map((doc, i) => ({
                    ...doc,
                    embedding: result.embeddings[i]
                }))
            };
        }

        return result;
    }

    /**
     * Parallel batch processing
     */
    async embedTextsParallel(texts, options = {}) {
        const batches = this.chunk(texts, this.batchSize);
        const batchGroups = this.chunk(batches, this.maxConcurrent);
        
        const allEmbeddings = [];

        for (const group of batchGroups) {
            const promises = group.map(batch => this.processBatch(batch, options));
            const results = await Promise.all(promises);
            
            for (const result of results) {
                if (result.success) {
                    allEmbeddings.push(...result.embeddings);
                }
            }
        }

        return {
            success: true,
            embeddings: allEmbeddings,
            stats: this.stats
        };
    }

    /**
     * Split array into chunks
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear embedding cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            hitRate: this.stats.totalProcessed > 0 
                ? ((this.stats.cacheHits / this.stats.totalProcessed) * 100).toFixed(1) + '%'
                : '0%'
        };
    }
}

// Singleton
let batchEmbeddingsInstance = null;
function getBatchEmbeddings(options = {}) {
    if (!batchEmbeddingsInstance) {
        batchEmbeddingsInstance = new BatchEmbeddings(options);
    }
    if (options.llmConfig) batchEmbeddingsInstance.llmConfig = options.llmConfig;
    return batchEmbeddingsInstance;
}

module.exports = { BatchEmbeddings, getBatchEmbeddings };
