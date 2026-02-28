/**
 * Purpose:
 *   Provides result reranking strategies for RAG pipelines: Reciprocal Rank Fusion
 *   (RRF) for merging multiple retrieval sources, LLM-based cross-encoder scoring,
 *   and query-type-aware boosting.
 *
 * Responsibilities:
 *   - Fuse ranked result lists from heterogeneous sources using RRF
 *   - Score query-document pairs via an LLM "cross-encoder" prompt
 *     (batch scoring with JSON array output)
 *   - Combine RRF fusion + cross-encoder in a two-stage hybrid pipeline
 *   - Apply query-dependent boosts (e.g. person-type results boosted for "who" queries)
 *   - Cache cross-encoder results to avoid redundant LLM calls (5-minute TTL)
 *
 * Key dependencies:
 *   - ../llm: LLM text generation for relevance scoring
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Calls external LLM API during cross-encoder scoring
 *   - Maintains an in-memory LRU-ish cache (Map, max 100 entries)
 *
 * Notes:
 *   - RRF uses score(d) = sum(1/(k + rank + 1)) with k=60 by default,
 *     which dampens rank differences and works well for heterogeneous sources.
 *   - Cross-encoder scoring uses very low temperature (0.1) for consistency.
 *     If the LLM fails or returns unparseable output, all items receive a
 *     default score of 0.5 to avoid discarding results.
 *   - queryDependentRerank is a lightweight, LLM-free heuristic suitable for
 *     latency-sensitive paths.
 *   - Singleton instance available via getReranker().
 */

const { logger } = require('../logger');
const llmRouter = require('../llm/router');

const log = logger.child({ module: 'reranker' });

class Reranker {
    constructor(options = {}) {
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        this._resolvedConfig = options.config || { llm: this.llmConfig };
        
        if (!this.llmProvider) {
            log.debug({ event: 'reranker_no_llm' }, 'No LLM provider specified - will be resolved on demand');
        }
        
        // RRF parameter (typical values: 60-100)
        this.rrfK = options.rrfK || 60;
        
        // Cache for reranking results
        this.cache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 100;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
        
        // Reranking settings
        this.batchSize = options.batchSize || 5; // Score items in batches
        this.topK = options.topK || 10; // Return top K after reranking
    }

    /**
     * Reciprocal Rank Fusion (RRF)
     * Combines results from multiple sources using RRF formula:
     * score(d) = sum(1 / (k + rank(d, source)))
     * 
     * @param {Array<Array<object>>} resultLists - Multiple ranked result lists
     * @param {number} k - RRF constant (default: 60)
     * @returns {Array<object>} Fused and ranked results
     */
    reciprocalRankFusion(resultLists, k = this.rrfK) {
        const scoreMap = new Map();
        
        for (const results of resultLists) {
            results.forEach((item, rank) => {
                // Use content hash as key for deduplication
                const key = this.getItemKey(item);
                const rrfScore = 1 / (k + rank + 1);
                
                if (scoreMap.has(key)) {
                    const existing = scoreMap.get(key);
                    existing.rrfScore += rrfScore;
                    existing.sourceCount++;
                } else {
                    scoreMap.set(key, {
                        ...item,
                        rrfScore,
                        sourceCount: 1
                    });
                }
            });
        }
        
        // Sort by RRF score descending
        return Array.from(scoreMap.values())
            .sort((a, b) => b.rrfScore - a.rrfScore);
    }

    /**
     * Generate a unique key for an item (for deduplication)
     * @param {object} item 
     * @returns {string}
     */
    getItemKey(item) {
        if (item.id) return item.id;
        if (item.content) return item.content.substring(0, 100);
        if (item.data?.id) return item.data.id;
        return JSON.stringify(item).substring(0, 100);
    }

    /**
     * Cross-Encoder reranking using LLM
     * Scores query-document pairs for relevance
     * 
     * @param {string} query - User query
     * @param {Array<object>} candidates - Candidate documents
     * @param {object} options - Reranking options
     * @returns {Promise<Array<object>>} Reranked results with relevance scores
     */
    async crossEncoderRerank(query, candidates, options = {}) {
        const { topK = this.topK, batchSize = this.batchSize } = options;
        
        if (!candidates || candidates.length === 0) {
            return [];
        }
        
        // Check cache
        const cacheKey = this.getCacheKey(query, candidates);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            log.debug({ event: 'reranker_cache_hit' }, 'Cache hit for cross-encoder reranking');
            return cached;
        }
        
        log.debug({ event: 'reranker_cross_encoder', count: candidates.length }, 'Cross-encoder reranking candidates');
        
        // Score candidates in batches
        const scoredCandidates = [];
        
        for (let i = 0; i < candidates.length; i += batchSize) {
            const batch = candidates.slice(i, i + batchSize);
            const scores = await this.scoreBatch(query, batch);
            
            batch.forEach((candidate, idx) => {
                scoredCandidates.push({
                    ...candidate,
                    relevanceScore: scores[idx] || 0,
                    reranked: true
                });
            });
        }
        
        // Sort by relevance score
        scoredCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // Take top K
        const results = scoredCandidates.slice(0, topK);
        
        // Cache results
        this.setCache(cacheKey, results);
        
        log.debug({ event: 'reranker_done', count: results.length, topScore: results[0]?.relevanceScore }, 'Reranked results');
        
        return results;
    }

    /**
     * Score a batch of candidates against the query
     * @param {string} query 
     * @param {Array<object>} batch 
     * @returns {Promise<Array<number>>} Relevance scores (0-1)
     */
    async scoreBatch(query, batch) {
        try {
            // Format candidates for scoring
            const candidateTexts = batch.map((c, idx) => {
                const content = c.content || c.data?.content || JSON.stringify(c.data || c);
                return `[${idx + 1}] ${content.substring(0, 500)}`;
            }).join('\n\n');
            
            const prompt = `Rate the relevance of each document to the query on a scale of 0.0 to 1.0.

Query: "${query}"

Documents:
${candidateTexts}

Return ONLY a JSON array of scores in order, like: [0.9, 0.7, 0.3, ...]
No explanation, just the array.`;

            const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
                prompt,
                temperature: 0.1,
                maxTokens: 100,
                context: 'reranker-scoring'
            }, this._resolvedConfig);
            
            if (!routerResult.success) {
                log.warn({ event: 'reranker_scoring_failed', reason: routerResult.error?.message || routerResult.error }, 'Scoring failed');
                return batch.map(() => 0.5);
            }
            
            const text = (routerResult.result?.text || routerResult.result?.response || '').trim();
            const match = text.match(/\[[\d.,\s]+\]/);
            
            if (match) {
                const scores = JSON.parse(match[0]);
                return scores.map(s => Math.min(1, Math.max(0, parseFloat(s) || 0)));
            }
            
            return batch.map(() => 0.5);
            
        } catch (error) {
            log.warn({ event: 'reranker_batch_error', reason: error?.message }, 'Error scoring batch');
            return batch.map(() => 0.5);
        }
    }

    /**
     * Hybrid reranking: RRF + Cross-Encoder
     * First fuses multiple sources with RRF, then reranks with cross-encoder
     * 
     * @param {string} query - User query
     * @param {object} sources - Named source results { semantic: [...], structural: [...], ... }
     * @param {object} options - Reranking options
     * @returns {Promise<Array<object>>} Final reranked results
     */
    async hybridRerank(query, sources, options = {}) {
        const { 
            useCrossEncoder = true, 
            topK = this.topK,
            rrfK = this.rrfK 
        } = options;
        
        log.debug({ event: 'reranker_hybrid', sourcesCount: Object.keys(sources).length }, 'Hybrid reranking');
        
        // Step 1: Apply RRF to fuse sources
        const resultLists = Object.values(sources).filter(arr => arr && arr.length > 0);
        const fusedResults = this.reciprocalRankFusion(resultLists, rrfK);
        
        log.debug({ event: 'reranker_rrf', count: fusedResults.length }, 'RRF fused unique results');
        
        if (!useCrossEncoder) {
            return fusedResults.slice(0, topK);
        }
        
        // Step 2: Apply cross-encoder reranking to top candidates
        // Only rerank top 2*topK to save API calls
        const candidatesToRerank = fusedResults.slice(0, topK * 2);
        const reranked = await this.crossEncoderRerank(query, candidatesToRerank, { topK });
        
        return reranked;
    }

    /**
     * Query-dependent reranking
     * Adjusts scoring based on query type
     * 
     * @param {string} query 
     * @param {Array<object>} candidates 
     * @param {object} queryAnalysis - Query classification result
     * @returns {Array<object>} Adjusted results
     */
    queryDependentRerank(query, candidates, queryAnalysis = {}) {
        const queryType = queryAnalysis.type || 'general';
        const q = query.toLowerCase();
        
        return candidates.map(candidate => {
            let boost = 1.0;
            const content = (candidate.content || '').toLowerCase();
            const type = candidate.type || '';
            
            // Boost based on query type
            if (queryType === 'who' || /quem|who|pessoa|people|contact/i.test(q)) {
                if (type === 'person' || type === 'contact' || content.includes('person')) boost *= 1.5;
            }
            
            if (queryType === 'what' || /o que|what|tecnologia|technology/i.test(q)) {
                if (type === 'technology' || type === 'fact') boost *= 1.3;
            }
            
            if (queryType === 'when' || /quando|when|data|date/i.test(q)) {
                if (type === 'meeting' || type === 'decision' || type === 'calendarevent') boost *= 1.4;
            }

            if (/empresa|company|compan(y|ies)|organiza/i.test(q)) {
                if (type === 'company' || type === 'organization') boost *= 1.5;
            }

            if (/sprint|iteraç/i.test(q)) {
                if (type === 'sprint') boost *= 1.4;
            }

            if (/tarefa|task|ação|action/i.test(q)) {
                if (type === 'task' || type === 'action') boost *= 1.3;
            }

            if (/email|correio/i.test(q)) {
                if (type === 'email') boost *= 1.4;
            }

            if (/risco|risk/i.test(q)) {
                if (type === 'risk') boost *= 1.4;
            }

            if (/documento|document|ficheiro|file/i.test(q)) {
                if (type === 'document') boost *= 1.3;
            }
            
            // Boost exact matches
            const queryTerms = query.toLowerCase().split(/\s+/);
            const matchCount = queryTerms.filter(term => 
                term.length > 3 && content.includes(term)
            ).length;
            boost *= 1 + (matchCount * 0.1);
            
            return {
                ...candidate,
                relevanceScore: (candidate.relevanceScore || candidate.rrfScore || 0.5) * boost,
                boost
            };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // ==================== Cache Methods ====================

    getCacheKey(query, candidates) {
        const candidateIds = candidates.slice(0, 10).map(c => this.getItemKey(c)).join('|');
        return `${query}:${candidateIds}`;
    }

    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data;
    }

    setCache(key, data) {
        // Evict oldest if at capacity
        if (this.cache.size >= this.cacheMaxSize) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.cacheMaxSize
        };
    }
}

// Singleton instance
let instance = null;

function getReranker(options = {}) {
    if (!instance) {
        instance = new Reranker(options);
    } else if (options.llmProvider && !instance.llmProvider) {
        instance.llmProvider = options.llmProvider;
        instance.llmModel = options.llmModel || instance.llmModel;
        instance.llmConfig = options.llmConfig || instance.llmConfig;
        instance._resolvedConfig = options.config || instance._resolvedConfig;
    }
    return instance;
}

module.exports = {
    Reranker,
    getReranker
};
