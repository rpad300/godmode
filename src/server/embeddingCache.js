/**
 * SOTA: Query Embedding Cache
 * Shared by server and chat feature to avoid re-computing embeddings for repeated/similar queries.
 */
const queryEmbeddingCache = new Map();
const QUERY_CACHE_MAX_SIZE = 200;
const QUERY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedQueryEmbedding(query, model) {
    const key = `${model}:${query.toLowerCase().trim()}`;
    const cached = queryEmbeddingCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < QUERY_CACHE_TTL) {
        return cached.embedding;
    }
    return null;
}

function setCachedQueryEmbedding(query, model, embedding) {
    const key = `${model}:${query.toLowerCase().trim()}`;
    if (queryEmbeddingCache.size >= QUERY_CACHE_MAX_SIZE) {
        const oldest = queryEmbeddingCache.keys().next().value;
        queryEmbeddingCache.delete(oldest);
    }
    queryEmbeddingCache.set(key, { embedding, timestamp: Date.now() });
}

module.exports = { getCachedQueryEmbedding, setCachedQueryEmbedding };
