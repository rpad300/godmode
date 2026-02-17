/**
 * Purpose:
 *   Handles complex, multi-part questions that cannot be answered by a single
 *   retrieval pass. Decomposes queries into dependency-ordered sub-queries,
 *   retrieves evidence iteratively, and synthesises a final answer with a
 *   visible reasoning chain.
 *
 * Responsibilities:
 *   - Decompose a complex question into simpler, dependency-linked sub-queries
 *     via LLM prompting (returns a DAG of sub-queries)
 *   - Execute sub-queries in topological order, feeding earlier results as context
 *   - Provide iterative retrieval with automatic query refinement and a
 *     confidence-based stopping criterion
 *   - Support graph-aware multi-hop traversal by translating natural language
 *     into parameterised Cypher path queries
 *   - Merge result sets across iterations with deduplication
 *   - Synthesise a final answer from all gathered sub-query summaries
 *
 * Key dependencies:
 *   - ../llm: LLM text generation for decomposition, summarisation, and synthesis
 *   - ../logger: structured logging
 *   - A GraphProvider instance (optional) for graph-based traversals
 *
 * Side effects:
 *   - Multiple LLM API calls per complex query (decompose, summarise per sub-query,
 *     synthesise final answer, and optionally refine iterative queries)
 *   - Executes Cypher queries against the graph provider for traversal operations
 *
 * Notes:
 *   - Simple queries (isComplex: false) short-circuit to a single retrieval pass.
 *   - The topological sort silently breaks cycles, so circular dependencies in
 *     sub-query DAGs are tolerated but may produce incomplete context.
 *   - iterativeRetrieval stops when confidence >= 0.8 or maxIterations (default 3)
 *     is reached. Confidence is heuristic-based (result count + relevance scores).
 *   - graphTraversal uses LLM to parse traversal intent, so it requires LLM config.
 *   - Singleton instance available via getMultiHopReasoning().
 */

const { logger } = require('../logger');
const llm = require('../llm');

const log = logger.child({ module: 'multi-hop' });

class MultiHopReasoning {
    constructor(options = {}) {
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        
        if (!this.llmProvider) {
            log.warn({ event: 'multi_hop_no_llm' }, 'No LLM provider specified');
        }
        
        this.graphProvider = options.graphProvider;
        
        // Max iterations for iterative retrieval
        this.maxIterations = options.maxIterations || 3;
        
        // Min confidence to stop iteration
        this.confidenceThreshold = options.confidenceThreshold || 0.8;
    }

    /**
     * Decompose a complex query into simpler sub-queries
     * @param {string} query - Complex user query
     * @returns {Promise<{subQueries: Array<{query: string, type: string, depends: Array<number>}>}>}
     */
    async decomposeQuery(query) {
        log.debug({ event: 'multi_hop_decompose', queryPreview: query.substring(0, 50) }, 'Decomposing query');
        
        const prompt = `Analyze this question and break it down into simpler sub-questions that can be answered independently, then combined.

Question: "${query}"

Return a JSON object with this structure:
{
  "isComplex": true/false,
  "subQueries": [
    {"id": 1, "query": "sub-question 1", "type": "entity"|"relation"|"aggregate", "depends": []},
    {"id": 2, "query": "sub-question 2", "type": "entity"|"relation"|"aggregate", "depends": [1]}
  ],
  "reasoning": "brief explanation of decomposition"
}

If the question is simple, return isComplex: false with a single subQuery.
Return ONLY valid JSON.`;

        const result = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt,
            temperature: 0.2,
            maxTokens: 500,
            providerConfig: this.llmConfig
        });
        
        if (!result.success) {
            return { isComplex: false, subQueries: [{ id: 1, query, type: 'general', depends: [] }] };
        }
        
        try {
            const parsed = JSON.parse(result.text);
            log.debug({ event: 'multi_hop_decomposed', count: parsed.subQueries?.length || 1 }, 'Decomposed into sub-queries');
            return parsed;
        } catch {
            return { isComplex: false, subQueries: [{ id: 1, query, type: 'general', depends: [] }] };
        }
    }

    /**
     * Execute multi-hop reasoning on a complex query
     * @param {string} query - User query
     * @param {Function} retrieveFn - Function to retrieve results for a sub-query
     * @param {object} options - Execution options
     * @returns {Promise<object>} Final answer with reasoning chain
     */
    async execute(query, retrieveFn, options = {}) {
        const startTime = Date.now();
        const reasoningChain = [];
        
        // Step 1: Decompose query
        const decomposition = await this.decomposeQuery(query);
        reasoningChain.push({
            step: 'decompose',
            input: query,
            output: decomposition.subQueries,
            reasoning: decomposition.reasoning
        });
        
        if (!decomposition.isComplex) {
            // Simple query - single retrieval
            const results = await retrieveFn(query);
            return {
                answer: null, // Let caller generate answer
                results,
                reasoningChain,
                isMultiHop: false,
                latencyMs: Date.now() - startTime
            };
        }
        
        // Step 2: Execute sub-queries in dependency order
        const subResults = new Map();
        const sortedQueries = this.topologicalSort(decomposition.subQueries);
        
        for (const subQuery of sortedQueries) {
            // Build context from dependent results
            const context = subQuery.depends
                .map(depId => subResults.get(depId))
                .filter(Boolean)
                .map(r => r.summary || r.results?.[0]?.content)
                .join('\n');
            
            // Augment query with context if dependencies exist
            const augmentedQuery = context 
                ? `${subQuery.query}\n\nContext from previous findings:\n${context}`
                : subQuery.query;
            
            // Retrieve for sub-query
            const results = await retrieveFn(augmentedQuery);
            
            // Summarize results for next iteration
            const summary = await this.summarizeResults(subQuery.query, results);
            
            subResults.set(subQuery.id, { query: subQuery.query, results, summary });
            
            reasoningChain.push({
                step: 'sub_query',
                subQueryId: subQuery.id,
                query: subQuery.query,
                resultsCount: results.length,
                summary: summary.substring(0, 200)
            });
        }
        
        // Step 3: Synthesize final answer
        const allResults = Array.from(subResults.values())
            .flatMap(sr => sr.results || []);
        
        const synthesis = await this.synthesize(query, subResults, reasoningChain);
        
        return {
            answer: synthesis.answer,
            results: allResults,
            reasoningChain,
            isMultiHop: true,
            subQueryCount: sortedQueries.length,
            synthesis,
            latencyMs: Date.now() - startTime
        };
    }

    /**
     * Iterative retrieval with query refinement
     * Keeps refining the query based on retrieved results
     * 
     * @param {string} query - Initial query
     * @param {Function} retrieveFn - Retrieval function
     * @param {object} options - Options
     * @returns {Promise<object>} Final results with iteration history
     */
    async iterativeRetrieval(query, retrieveFn, options = {}) {
        const { maxIterations = this.maxIterations } = options;
        const iterations = [];
        let currentQuery = query;
        let allResults = [];
        let confidence = 0;
        
        for (let i = 0; i < maxIterations && confidence < this.confidenceThreshold; i++) {
            log.debug({ event: 'multi_hop_iteration', iteration: i + 1, queryPreview: currentQuery.substring(0, 50) }, 'Iteration');
            
            // Retrieve
            const results = await retrieveFn(currentQuery);
            allResults = this.mergeResults(allResults, results);
            
            // Assess confidence
            confidence = await this.assessConfidence(query, allResults);
            
            iterations.push({
                iteration: i + 1,
                query: currentQuery,
                resultsCount: results.length,
                confidence
            });
            
            if (confidence >= this.confidenceThreshold) {
                log.debug({ event: 'multi_hop_confidence_stop', confidence }, 'Confidence >= threshold, stopping');
                break;
            }
            
            // Generate refined query for next iteration
            currentQuery = await this.refineQuery(query, currentQuery, allResults);
        }
        
        return {
            finalResults: allResults,
            iterations,
            finalConfidence: confidence,
            totalIterations: iterations.length
        };
    }

    /**
     * Graph-aware multi-hop traversal
     * Follows relationships in the graph to answer queries like
     * "Who works with people who know X?"
     * 
     * @param {string} query - Query describing traversal
     * @param {object} options - Traversal options
     * @returns {Promise<object>} Traversal results
     */
    async graphTraversal(query, options = {}) {
        if (!this.graphProvider) {
            return { ok: false, error: 'Graph provider not configured' };
        }
        
        const { maxDepth = 3 } = options;
        
        // Parse traversal intent from query
        const intent = await this.parseTraversalIntent(query);
        
        if (!intent.ok) {
            return intent;
        }
        
        log.debug({ event: 'multi_hop_traversal', startType: intent.startType, targetType: intent.targetType, relations: intent.relations }, 'Graph traversal');
        
        // Build Cypher query for traversal
        const cypher = this.buildTraversalCypher(intent, maxDepth);
        
        const result = await this.graphProvider.query(cypher);
        
        if (!result.ok) {
            return { ok: false, error: result.error };
        }
        
        return {
            ok: true,
            results: result.results,
            traversalPath: intent,
            cypher
        };
    }

    /**
     * Parse traversal intent from natural language query
     * @param {string} query 
     * @returns {Promise<object>}
     */
    async parseTraversalIntent(query) {
        const prompt = `Parse this query to identify a graph traversal pattern.

Query: "${query}"

Return JSON:
{
  "ok": true,
  "startType": "Person|Project|Technology|etc",
  "startFilter": {"property": "value"} or null,
  "relations": ["WORKS_ON", "KNOWS", etc],
  "targetType": "Person|Project|Technology|etc",
  "direction": "outgoing|incoming|both"
}

If the query doesn't describe a graph traversal, return {"ok": false, "reason": "..."}`;

        const result = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt,
            temperature: 0.1,
            maxTokens: 200,
            providerConfig: this.llmConfig
        });
        
        if (!result.success) {
            return { ok: false, error: result.error };
        }
        
        try {
            return JSON.parse(result.text);
        } catch {
            return { ok: false, error: 'Failed to parse traversal intent' };
        }
    }

    /**
     * Build Cypher query for graph traversal
     * @param {object} intent - Parsed traversal intent
     * @param {number} maxDepth - Maximum traversal depth
     * @returns {string} Cypher query
     */
    buildTraversalCypher(intent, maxDepth) {
        const { startType, startFilter, relations, targetType, direction } = intent;
        
        const relPattern = relations.length > 0 
            ? `:${relations.join('|')}`
            : '';
        
        const dirPattern = direction === 'outgoing' 
            ? `-[r${relPattern}*1..${maxDepth}]->`
            : direction === 'incoming'
                ? `<-[r${relPattern}*1..${maxDepth}]-`
                : `-[r${relPattern}*1..${maxDepth}]-`;
        
        let whereClause = '';
        if (startFilter) {
            const conditions = Object.entries(startFilter)
                .map(([k, v]) => `start.${k} = '${v}'`)
                .join(' AND ');
            whereClause = `WHERE ${conditions}`;
        }
        
        return `
            MATCH (start:${startType})${dirPattern}(target:${targetType})
            ${whereClause}
            RETURN DISTINCT target, length(r) as hops
            ORDER BY hops
            LIMIT 50
        `;
    }

    // ==================== Helper Methods ====================

    /**
     * Summarize retrieval results
     * @param {string} query 
     * @param {Array} results 
     * @returns {Promise<string>}
     */
    async summarizeResults(query, results) {
        if (!results || results.length === 0) {
            return 'No relevant information found.';
        }
        
        const context = results.slice(0, 5)
            .map(r => r.content || JSON.stringify(r.data))
            .join('\n---\n');
        
        const result = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt: `Summarize these findings in 1-2 sentences relevant to the question: "${query}"\n\nFindings:\n${context}`,
            temperature: 0.3,
            maxTokens: 150,
            providerConfig: this.llmConfig
        });
        
        return result.success ? result.text : 'Summary unavailable.';
    }

    /**
     * Synthesize final answer from sub-query results
     * @param {string} originalQuery 
     * @param {Map} subResults 
     * @param {Array} reasoningChain 
     * @returns {Promise<object>}
     */
    async synthesize(originalQuery, subResults, reasoningChain) {
        const findings = Array.from(subResults.values())
            .map(sr => `Q: ${sr.query}\nA: ${sr.summary}`)
            .join('\n\n');
        
        const result = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt: `Answer the original question by synthesizing these findings.

Original Question: "${originalQuery}"

Findings from sub-questions:
${findings}

Provide a comprehensive answer that integrates all the findings.`,
            temperature: 0.3,
            maxTokens: 500,
            providerConfig: this.llmConfig
        });
        
        return {
            answer: result.success ? result.text : 'Unable to synthesize answer.',
            confidence: result.success ? 0.8 : 0.3
        };
    }

    /**
     * Assess confidence in current results
     * @param {string} query 
     * @param {Array} results 
     * @returns {Promise<number>}
     */
    async assessConfidence(query, results) {
        if (!results || results.length === 0) return 0;
        if (results.length >= 10) return 0.9;
        
        // Simple heuristic based on result count and relevance
        const baseConfidence = Math.min(results.length / 10, 0.7);
        const hasRelevant = results.some(r => 
            (r.relevanceScore || r.rrfScore || 0) > 0.5
        );
        
        return hasRelevant ? baseConfidence + 0.2 : baseConfidence;
    }

    /**
     * Refine query based on results
     * @param {string} originalQuery 
     * @param {string} currentQuery 
     * @param {Array} results 
     * @returns {Promise<string>}
     */
    async refineQuery(originalQuery, currentQuery, results) {
        const result = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt: `The query "${currentQuery}" returned ${results.length} results but may not fully answer: "${originalQuery}"

Generate a refined query that might find more relevant information. Return ONLY the new query, nothing else.`,
            temperature: 0.5,
            maxTokens: 100,
            providerConfig: this.llmConfig
        });
        
        return result.success ? result.text.trim() : currentQuery;
    }

    /**
     * Topological sort for query dependencies
     * @param {Array} queries - Array of {id, depends: []}
     * @returns {Array} Sorted queries
     */
    topologicalSort(queries) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (q) => {
            if (visited.has(q.id)) return;
            if (visiting.has(q.id)) return; // Cycle - skip
            
            visiting.add(q.id);
            
            for (const depId of q.depends || []) {
                const dep = queries.find(x => x.id === depId);
                if (dep) visit(dep);
            }
            
            visiting.delete(q.id);
            visited.add(q.id);
            sorted.push(q);
        };
        
        for (const q of queries) {
            visit(q);
        }
        
        return sorted;
    }

    /**
     * Merge result sets with deduplication
     * @param {Array} existing 
     * @param {Array} newResults 
     * @returns {Array}
     */
    mergeResults(existing, newResults) {
        const seen = new Set(existing.map(r => r.id || r.content?.substring(0, 50)));
        const merged = [...existing];
        
        for (const r of newResults) {
            const key = r.id || r.content?.substring(0, 50);
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(r);
            }
        }
        
        return merged;
    }
}

// Singleton instance
let instance = null;

function getMultiHopReasoning(options = {}) {
    if (!instance) {
        instance = new MultiHopReasoning(options);
    }
    return instance;
}

module.exports = {
    MultiHopReasoning,
    getMultiHopReasoning
};
