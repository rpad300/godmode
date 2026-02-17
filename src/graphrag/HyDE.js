/**
 * Purpose:
 *   Implements Hypothetical Document Embeddings (HyDE), a zero-shot retrieval
 *   technique that improves recall by embedding LLM-generated hypothetical answer
 *   documents rather than the raw user query. This bridges the lexical gap between
 *   questions and stored documents.
 *
 * Responsibilities:
 *   - Generate one or more hypothetical "answer documents" via an LLM prompt
 *   - Produce a single averaged (and L2-normalised) embedding from the query
 *     and its hypothetical documents
 *   - Support multi-vector retrieval: retrieve with each hypothetical embedding
 *     independently, then merge results via Reciprocal Rank Fusion (RRF)
 *   - Expand queries into diverse rephrasings for broader recall
 *   - Cache hypothetical documents with a 10-minute TTL
 *
 * Key dependencies:
 *   - ../llm: LLM text generation and embedding APIs
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Calls external LLM API for hypothetical document generation
 *   - Calls external embedding API for vector generation
 *   - Maintains an in-memory LRU-ish cache (Map, max 200 entries)
 *
 * Notes:
 *   - Reference: "Precise Zero-Shot Dense Retrieval without Relevance Labels"
 *     (Gao et al., 2022).
 *   - Temperature is intentionally varied across multiple hypothetical documents
 *     (0.7, 0.8, ...) to increase diversity.
 *   - When LLM generation fails entirely, the raw query is used as a fallback
 *     so retrieval is never completely blocked.
 *   - The averaged embedding is L2-normalised to maintain unit-vector semantics
 *     expected by cosine-similarity search.
 *   - Bilingual prompt builders (PT/EN) are selected via regex language detection.
 *   - Singleton instance available via getHyDE().
 */

const { logger } = require('../logger');
const llm = require('../llm');

const log = logger.child({ module: 'hyde' });

class HyDE {
    constructor(options = {}) {
        // No hardcoded defaults - must come from admin config
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        this.llmConfig = options.llmConfig || {};
        
        this.embeddingProvider = options.embeddingProvider || null;
        this.embeddingModel = options.embeddingModel || null;
        
        if (!this.llmProvider) {
            log.warn({ event: 'hyde_no_llm' }, 'No LLM provider specified');
        }
        
        // Cache hypothetical documents
        this.cache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 200;
        this.cacheTTL = options.cacheTTL || 10 * 60 * 1000; // 10 minutes
        
        // Number of hypothetical documents to generate
        this.numHypothetical = options.numHypothetical || 1;
    }

    /**
     * Generate hypothetical document(s) that would answer the query
     * @param {string} query - User query
     * @param {object} options - Generation options
     * @returns {Promise<Array<string>>} Hypothetical documents
     */
    async generateHypotheticalDocuments(query, options = {}) {
        const { numDocs = this.numHypothetical, context = '', entityType = '' } = options;
        
        // Check cache
        const cacheKey = `hyde:${query}:${numDocs}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            log.debug({ event: 'hyde_cache_hit' }, 'Cache hit for hypothetical document');
            return cached;
        }
        
        log.debug({ event: 'hyde_generate', numDocs }, 'Generating hypothetical document(s) for query');
        
        // Detect language
        const isPortuguese = /\b(quem|qual|quando|onde|como|porquê|são|está|pessoas|projeto|reunião)\b/i.test(query);
        
        // Build optimized prompt based on query type and language
        const prompt = isPortuguese 
            ? this.buildPortuguesePrompt(query, context, entityType)
            : this.buildEnglishPrompt(query, context, entityType);

        const hypotheticalDocs = [];
        
        for (let i = 0; i < numDocs; i++) {
            const result = await llm.generateText({
                provider: this.llmProvider,
                model: this.llmModel,
                prompt,
                temperature: 0.7 + (i * 0.1), // Vary temperature for diversity
                maxTokens: 500,
                providerConfig: this.llmConfig
            });
            
            if (result.success && result.text) {
                hypotheticalDocs.push(result.text.trim());
            }
        }
        
        if (hypotheticalDocs.length === 0) {
            // Fallback to query if generation fails
            hypotheticalDocs.push(query);
        }
        
        // Cache results
        this.setCache(cacheKey, hypotheticalDocs);
        
        return hypotheticalDocs;
    }

    /**
     * Generate HyDE embedding for a query
     * Creates hypothetical document(s) and embeds them
     * 
     * @param {string} query - User query
     * @param {object} options - Embedding options
     * @returns {Promise<{embedding: Array<number>, hypotheticalDocs: Array<string>}>}
     */
    async generateHyDEEmbedding(query, options = {}) {
        const startTime = Date.now();
        
        // Generate hypothetical documents
        const hypotheticalDocs = await this.generateHypotheticalDocuments(query, options);
        
        // Combine original query with hypothetical docs for embedding
        const textsToEmbed = [
            query, // Include original query
            ...hypotheticalDocs
        ];
        
        // Generate embeddings
        const embedResult = await llm.embed({
            provider: this.embeddingProvider,
            model: this.embeddingModel,
            texts: textsToEmbed,
            providerConfig: this.llmConfig
        });
        
        if (!embedResult.success || !embedResult.embeddings?.length) {
            log.warn({ event: 'hyde_embed_failed', reason: embedResult.error }, 'Embedding generation failed');
            return { embedding: null, hypotheticalDocs, error: embedResult.error };
        }
        
        // Average the embeddings (query + hypothetical docs)
        const embedding = this.averageEmbeddings(embedResult.embeddings);
        
        const latency = Date.now() - startTime;
        log.debug({ event: 'hyde_embed_done', latencyMs: latency, count: hypotheticalDocs.length }, 'Generated embedding');
        
        return {
            embedding,
            hypotheticalDocs,
            originalQueryEmbedding: embedResult.embeddings[0],
            latencyMs: latency
        };
    }

    /**
     * Average multiple embeddings
     * @param {Array<Array<number>>} embeddings 
     * @returns {Array<number>}
     */
    averageEmbeddings(embeddings) {
        if (!embeddings || embeddings.length === 0) return null;
        if (embeddings.length === 1) return embeddings[0];
        
        const dim = embeddings[0].length;
        const averaged = new Array(dim).fill(0);
        
        for (const emb of embeddings) {
            for (let i = 0; i < dim; i++) {
                averaged[i] += emb[i];
            }
        }
        
        for (let i = 0; i < dim; i++) {
            averaged[i] /= embeddings.length;
        }
        
        // Normalize
        const magnitude = Math.sqrt(averaged.reduce((sum, x) => sum + x * x, 0));
        return averaged.map(x => x / magnitude);
    }

    /**
     * Expand query with multiple variations using HyDE
     * @param {string} query - Original query
     * @param {object} options - Expansion options
     * @returns {Promise<{queries: Array<string>, embeddings: Array<Array<number>>}>}
     */
    async expandQuery(query, options = {}) {
        const { numExpansions = 3 } = options;
        
        const expansionPrompt = `Generate ${numExpansions} different ways to phrase the following question. Each variation should capture a slightly different aspect or interpretation of the question.

Original question: ${query}

Variations (one per line, no numbering):`;

        const result = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt: expansionPrompt,
            temperature: 0.8,
            maxTokens: 300,
            providerConfig: this.llmConfig
        });
        
        if (!result.success) {
            return { queries: [query], embeddings: [] };
        }
        
        const variations = result.text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 10)
            .slice(0, numExpansions);
        
        const allQueries = [query, ...variations];
        
        // Generate embeddings for all variations
        const embedResult = await llm.embed({
            provider: this.embeddingProvider,
            model: this.embeddingModel,
            texts: allQueries,
            providerConfig: this.llmConfig
        });
        
        return {
            queries: allQueries,
            embeddings: embedResult.embeddings || []
        };
    }

    /**
     * Multi-vector retrieval using HyDE
     * Generates multiple hypothetical docs and retrieves with each
     * 
     * @param {string} query - User query
     * @param {Function} retrieveFn - Function that takes embedding and returns results
     * @param {object} options - Retrieval options
     * @returns {Promise<Array<object>>} Combined results from all retrievals
     */
    async multiVectorRetrieval(query, retrieveFn, options = {}) {
        const { numVectors = 3 } = options;
        
        // Generate multiple hypothetical documents
        const hypotheticalDocs = await this.generateHypotheticalDocuments(query, { 
            numDocs: numVectors 
        });
        
        // Include original query
        const textsToEmbed = [query, ...hypotheticalDocs];
        
        // Generate embeddings
        const embedResult = await llm.embed({
            provider: this.embeddingProvider,
            model: this.embeddingModel,
            texts: textsToEmbed,
            providerConfig: this.llmConfig
        });
        
        if (!embedResult.success) {
            // Fallback to just query
            return await retrieveFn(null);
        }
        
        // Retrieve with each embedding
        const allResults = [];
        for (const embedding of embedResult.embeddings) {
            const results = await retrieveFn(embedding);
            allResults.push(results);
        }
        
        // Merge results (RRF-style)
        return this.mergeResults(allResults);
    }

    /**
     * Merge multiple result sets using simple RRF
     * @param {Array<Array<object>>} resultSets 
     * @returns {Array<object>}
     */
    mergeResults(resultSets) {
        const scoreMap = new Map();
        const k = 60; // RRF constant
        
        for (const results of resultSets) {
            if (!results) continue;
            results.forEach((item, rank) => {
                const key = item.id || item.content?.substring(0, 50) || JSON.stringify(item).substring(0, 50);
                const score = 1 / (k + rank + 1);
                
                if (scoreMap.has(key)) {
                    const existing = scoreMap.get(key);
                    existing.score += score;
                    existing.sources++;
                } else {
                    scoreMap.set(key, { item, score, sources: 1 });
                }
            });
        }
        
        return Array.from(scoreMap.values())
            .sort((a, b) => b.score - a.score)
            .map(({ item, score, sources }) => ({
                ...item,
                hydeScore: score,
                hydeSources: sources
            }));
    }

    // ==================== Cache Methods ====================

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

    // ==================== Optimized Prompt Builders ====================

    /**
     * Build optimized Portuguese prompt for HyDE
     * @param {string} query 
     * @param {string} context 
     * @param {string} entityType 
     * @returns {string}
     */
    buildPortuguesePrompt(query, context = '', entityType = '') {
        const typeHints = {
            person: 'Gera um perfil detalhado de uma pessoa que responda à pergunta.',
            project: 'Gera uma descrição detalhada de um projeto que responda à pergunta.',
            meeting: 'Gera um resumo de reunião que responda à pergunta.',
            technology: 'Gera uma descrição técnica que responda à pergunta.',
            decision: 'Gera um registo de decisão que responda à pergunta.',
            task: 'Gera uma descrição de tarefa que responda à pergunta.',
            fact: 'Gera um facto ou informação que responda à pergunta.'
        };

        const typeHint = entityType ? typeHints[entityType.toLowerCase()] || '' : '';
        
        return `Gera um documento detalhado e factual que responda perfeitamente à seguinte pergunta. Escreve como se este documento já existisse numa base de conhecimento. Inclui detalhes específicos, nomes, datas e factos concretos. Não reconheças a pergunta - escreve diretamente o documento de resposta.

${typeHint ? `Tipo de documento: ${typeHint}\n\n` : ''}${context ? `Contexto do domínio:\n${context}\n\n` : ''}Pergunta: ${query}

Documento:`;
    }

    /**
     * Build optimized English prompt for HyDE
     * @param {string} query 
     * @param {string} context 
     * @param {string} entityType 
     * @returns {string}
     */
    buildEnglishPrompt(query, context = '', entityType = '') {
        const typeHints = {
            person: 'Generate a detailed person profile that would answer the question.',
            project: 'Generate a detailed project description that would answer the question.',
            meeting: 'Generate a meeting summary that would answer the question.',
            technology: 'Generate a technical description that would answer the question.',
            decision: 'Generate a decision record that would answer the question.',
            task: 'Generate a task description that would answer the question.',
            fact: 'Generate a factual statement that would answer the question.'
        };

        const typeHint = entityType ? typeHints[entityType.toLowerCase()] || '' : '';
        
        return `Generate a detailed, factual document that would perfectly answer the following question. Write as if this document already exists in a knowledge base. Include specific details, names, dates, and concrete facts. Do not acknowledge the question - write the answer document directly.

${typeHint ? `Document type hint: ${typeHint}\n\n` : ''}${context ? `Domain context:\n${context}\n\n` : ''}Question: ${query}

Document:`;
    }
}

// Singleton instance
let instance = null;

function getHyDE(options = {}) {
    if (!instance) {
        instance = new HyDE(options);
    }
    return instance;
}

module.exports = {
    HyDE,
    getHyDE
};
