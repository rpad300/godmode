/**
 * Vector similarity utilities (cosine similarity, findSimilar).
 * Provider-agnostic; used by GraphRAG, RAG routes, and Chat routes
 * so they do not depend on the Ollama client.
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity in [0, 1] (or 0 if invalid)
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Find most similar items from a list of embeddings
 * @param {number[]} queryEmbedding - Query vector
 * @param {Array<{id?: any, embedding: number[]}>} items - Items with embedding array
 * @param {number} topK - Max results to return
 * @returns {Array<{id: any, similarity: number}>}
 */
function findSimilar(queryEmbedding, items, topK = 5) {
    const scored = items
        .filter(item => item.embedding && item.embedding.length > 0)
        .map(item => ({
            id: item.id,
            similarity: cosineSimilarity(queryEmbedding, item.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, topK);
}

module.exports = {
    cosineSimilarity,
    findSimilar
};
