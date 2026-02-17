/**
 * Purpose:
 *   Short-lived, in-memory LRU-ish cache for query embedding vectors. Avoids
 *   redundant calls to the embedding API when the same (or case-insensitively
 *   identical) query is repeated within a short window.
 *
 * Responsibilities:
 *   - getCachedQueryEmbedding: Return a cached vector if present and not expired
 *   - setCachedQueryEmbedding: Store a vector, evicting the oldest entry when at capacity
 *
 * Key dependencies:
 *   - None (pure in-memory Map)
 *
 * Side effects:
 *   - Module-level Map grows up to QUERY_CACHE_MAX_SIZE (200) entries.
 *   - No periodic cleanup timer; stale entries are lazily ignored on read and
 *     only physically evicted when the cache is full.
 *
 * Notes:
 *   - Cache key is model + lowercased/trimmed query, so "Hello" and "hello "
 *     share the same slot. This is intentional because embedding models are
 *     typically case-insensitive, but may cause a cache hit for queries whose
 *     casing is semantically significant in a different model -- acceptable
 *     trade-off given the 10-minute TTL.
 *   - Eviction is FIFO (Map insertion order), not true LRU. This is simpler
 *     and sufficient given the small cache size and short TTL.
 */
const queryEmbeddingCache = new Map();
const QUERY_CACHE_MAX_SIZE = 200;
const QUERY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Retrieve a previously cached embedding vector for the given query + model pair.
 * Returns null on cache miss or if the entry has expired (older than QUERY_CACHE_TTL).
 *
 * @param {string} query - The raw user query text
 * @param {string} model - Embedding model identifier (e.g. "text-embedding-3-small")
 * @returns {number[]|Float32Array|null} The cached embedding vector, or null
 */
function getCachedQueryEmbedding(query, model) {
    const key = `${model}:${query.toLowerCase().trim()}`;
    const cached = queryEmbeddingCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < QUERY_CACHE_TTL) {
        return cached.embedding;
    }
    return null;
}

/**
 * Store an embedding vector in the cache. If the cache is at capacity,
 * the oldest entry (by insertion order) is evicted first.
 *
 * @param {string} query - The raw user query text
 * @param {string} model - Embedding model identifier
 * @param {number[]|Float32Array} embedding - The computed embedding vector
 */
function setCachedQueryEmbedding(query, model, embedding) {
    const key = `${model}:${query.toLowerCase().trim()}`;
    if (queryEmbeddingCache.size >= QUERY_CACHE_MAX_SIZE) {
        const oldest = queryEmbeddingCache.keys().next().value;
        queryEmbeddingCache.delete(oldest);
    }
    queryEmbeddingCache.set(key, { embedding, timestamp: Date.now() });
}

module.exports = { getCachedQueryEmbedding, setCachedQueryEmbedding };
