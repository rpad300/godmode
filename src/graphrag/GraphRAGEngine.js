/**
 * GraphRAG Engine
 * Combines graph traversal with semantic search for enhanced RAG
 * Integrates with Ontology system for better query understanding
 * Includes caching for improved performance
 */

const llm = require('../llm');
const { getOntologyManager, getRelationInference, getEmbeddingEnricher } = require('../ontology');
const { getQueryCache, getSyncTracker } = require('../utils');
const { getCypherGenerator } = require('./CypherGenerator');

class GraphRAGEngine {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        
        // Multi-graph support
        this.multiGraphManager = options.multiGraphManager || null;
        
        // AI-powered Cypher generation
        this.useCypherGenerator = options.useCypherGenerator !== false;
        this.currentProjectId = options.projectId || null;
        
        // LLM configuration - should come from admin config, no hardcoded defaults
        this.embeddingProvider = options.embeddingProvider || null;
        this.embeddingModel = options.embeddingModel || null;
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;
        
        if (!this.llmProvider) {
            console.warn('[GraphRAGEngine] No LLM provider specified - should be passed from admin config');
        }
        
        // Configuration from app config
        this.llmConfig = options.llmConfig || {};
        
        // Ontology integration
        this.ontology = options.ontology || getOntologyManager();
        this.relationInference = options.relationInference || getRelationInference();
        this.embeddingEnricher = options.embeddingEnricher || getEmbeddingEnricher();
        
        // Enable ontology features
        this.useOntology = options.useOntology !== false;
        
        // Cache for query results
        this.queryCache = options.queryCache || getQueryCache();
        this.enableCache = options.enableCache !== false;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Set the multi-graph manager for cross-project queries
     * @param {MultiGraphManager} manager 
     */
    setMultiGraphManager(manager) {
        this.multiGraphManager = manager;
    }

    /**
     * Set the current project context
     * @param {string} projectId 
     */
    setProjectContext(projectId) {
        this.currentProjectId = projectId;
        if (this.multiGraphManager) {
            this.multiGraphManager.currentProjectId = projectId;
        }
    }

    /**
     * Query the knowledge base using GraphRAG
     * @param {string} userQuery - User's natural language query
     * @param {object} options - Query options
     * @returns {Promise<{answer: string, sources: Array, queryType: string}>}
     */
    async query(userQuery, options = {}) {
        const startTime = Date.now();
        
        // Check cache first (unless disabled)
        if (this.enableCache && !options.noCache) {
            const cached = this.queryCache.getQuery(userQuery);
            if (cached) {
                return {
                    ...cached,
                    cached: true,
                    latencyMs: Date.now() - startTime
                };
            }
        }
        
        // 1. Classify query type with ontology analysis
        const queryAnalysis = this.classifyQuery(userQuery);
        const queryType = queryAnalysis.type;
        console.log(`[GraphRAG] Query type: ${queryType}, entity hints: ${queryAnalysis.entityHints.length}, relation hints: ${queryAnalysis.relationHints.length}`);
        
        // 2. Execute appropriate search strategy
        let results = [];
        let aiGeneratedCypher = null;
        
        // Check if graph provider is available and connected
        const graphAvailable = this.graphProvider && this.graphProvider.connected;
        
        if (graphAvailable) {
            // ============ AI-POWERED CYPHER GENERATION ============
            // Try AI-generated Cypher query first (most intelligent approach)
            if (this.useCypherGenerator) {
                try {
                    const cypherGen = getCypherGenerator({
                        llmProvider: this.llmProvider,
                        llmModel: this.llmModel,
                        llmConfig: this.llmConfig,
                        ontology: this.ontology
                    });
                    
                    const generated = await cypherGen.generate(userQuery, {
                        provider: this.llmProvider,
                        model: this.llmModel
                    });
                    
                    if (generated.cypher && generated.confidence >= 0.3) {
                        aiGeneratedCypher = generated;
                        console.log(`[GraphRAG] AI generated Cypher (confidence: ${generated.confidence}): ${generated.cypher.substring(0, 100)}...`);
                        
                        const cypherResult = await this.graphProvider.query(generated.cypher);
                        if (cypherResult.ok && cypherResult.results?.length > 0) {
                            results = cypherResult.results.map(r => ({
                                type: this.inferNodeType(r),
                                content: this.formatGraphResult(r),
                                data: r,
                                source: 'ai_cypher',
                                confidence: generated.confidence
                            }));
                            console.log(`[GraphRAG] AI Cypher returned ${results.length} results`);
                        }
                    }
                } catch (error) {
                    console.log('[GraphRAG] AI Cypher generation failed:', error.message);
                }
            }
            
            // ============ ONTOLOGY PATTERN MATCHING ============
            // If AI generation didn't work, try ontology pattern matching
            if (results.length === 0 && queryAnalysis.matchedPattern?.cypher) {
                try {
                    const cypherResult = await this.graphProvider.query(queryAnalysis.matchedPattern.cypher);
                    if (cypherResult.ok && cypherResult.results?.length > 0) {
                        results = cypherResult.results.map(r => ({
                            type: queryAnalysis.matchedPattern.pattern.entityTypes[0] || 'Entity',
                            content: this.formatGraphResult(r),
                            data: r,
                            source: 'ontology_pattern'
                        }));
                    }
                } catch (error) {
                    console.log('[GraphRAG] Ontology pattern query failed:', error.message);
                }
            }
        } else {
            console.log('[GraphRAG] Graph provider not available, using fallback search');
        }
        
        // ============ FALLBACK SEARCH ============
        // If graph queries didn't work or graph not available, use hybrid search
        if (results.length === 0) {
            switch (queryType) {
                case 'structural':
                    results = await this.structuralSearch(userQuery, queryAnalysis);
                    break;
                case 'semantic':
                    results = await this.semanticSearch(userQuery, queryAnalysis);
                    break;
                case 'hybrid':
                default:
                    results = await this.hybridSearch(userQuery, queryAnalysis);
                    break;
            }
        }
        
        console.log(`[GraphRAG] Found ${results.length} relevant items`);
        
        // 3. Generate response using LLM
        const response = await this.generateResponse(userQuery, results, options);
        
        const latencyMs = Date.now() - startTime;
        console.log(`[GraphRAG] Total latency: ${latencyMs}ms`);
        
        const result = {
            answer: response.answer,
            sources: response.sources,
            queryType,
            queryAnalysis: {
                entityHints: queryAnalysis.entityHints,
                relationHints: queryAnalysis.relationHints,
                matchedPattern: queryAnalysis.matchedPattern?.patternName || null
            },
            // Include AI-generated Cypher info if used
            aiCypher: aiGeneratedCypher ? {
                query: aiGeneratedCypher.cypher,
                explanation: aiGeneratedCypher.explanation,
                confidence: aiGeneratedCypher.confidence,
                cached: aiGeneratedCypher.cached || false
            } : null,
            graphAvailable,
            latencyMs
        };
        
        // Cache the result
        if (this.enableCache && result.sources.length > 0) {
            this.queryCache.setQuery(userQuery, result, { ttl: this.cacheTTL });
        }
        
        return result;
    }
    
    /**
     * Format a graph result for display
     * @param {object} result - Raw graph result
     * @returns {string}
     */
    formatGraphResult(result) {
        if (!result) return '';
        
        // Handle node results
        if (result.properties) {
            const props = result.properties;
            const name = props.name || props.title || props.content || props.id;
            const extra = [];
            if (props.role) extra.push(props.role);
            if (props.organization) extra.push(props.organization);
            if (props.status) extra.push(props.status);
            return extra.length > 0 ? `${name} (${extra.join(', ')})` : name;
        }
        
        // Handle array of nodes
        if (Array.isArray(result)) {
            return result.map(r => this.formatGraphResult(r)).join(', ');
        }
        
        return JSON.stringify(result);
    }

    /**
     * Infer the node type from a graph result
     * @param {object} result - Graph query result row
     * @returns {string}
     */
    inferNodeType(result) {
        if (!result) return 'Entity';
        
        // Check for direct labels property
        if (result.labels && result.labels.length > 0) {
            return result.labels[0];
        }
        if (result._labels && result._labels.length > 0) {
            return result._labels[0];
        }
        
        // Check nested node objects
        for (const key of Object.keys(result)) {
            const val = result[key];
            if (val && typeof val === 'object') {
                if (val.labels?.length > 0) return val.labels[0];
                if (val._labels?.length > 0) return val._labels[0];
            }
        }
        
        // Try to infer from properties
        if (result.properties || result._properties) {
            const props = result.properties || result._properties;
            if (props.role || props.organization) return 'Person';
            if (props.title && props.date) return 'Meeting';
            if (props.content && props.type) return 'Document';
            if (props.status && props.priority) return 'Task';
        }
        
        return 'Entity';
    }

    /**
     * Classify query type for routing
     * Uses ontology for better query understanding
     * @param {string} query - User query
     * @returns {{type: string, entityHints: Array, relationHints: Array, matchedPattern: object|null}}
     */
    classifyQuery(query) {
        const q = query.toLowerCase();
        const result = {
            type: 'hybrid',
            entityHints: [],
            relationHints: [],
            matchedPattern: null
        };
        
        // Try ontology pattern matching first
        if (this.useOntology) {
            const patternMatch = this.ontology.matchQueryPattern(query);
            if (patternMatch) {
                result.matchedPattern = patternMatch;
                result.type = 'structural'; // Ontology patterns are typically structural
                console.log(`[GraphRAG] Matched ontology pattern: ${patternMatch.patternName}`);
            }
            
            // Get entity and relation hints from ontology
            const hints = this.ontology.extractEntityHints(query);
            result.entityHints = hints.entityHints || [];
            result.relationHints = hints.relationHints || [];
        }
        
        // If no ontology pattern matched, use rule-based classification
        if (!result.matchedPattern) {
            // Structural patterns - relationship/graph queries
            const structuralPatterns = [
                /quem (reporta|trabalha|lidera|gere|gerencia|são|sao)/i,
                /who (reports|works|leads|manages|are|is)/i,
                /hierarquia|organograma|estrutura/i,
                /hierarchy|org.?chart|structure/i,
                /relação entre|ligação entre|conexão entre/i,
                /relationship between|connection between/i,
                /quantos|quantas|total de|count of|how many/i,
                /subordinados|diretos|equipa de/i,
                /subordinates|direct reports|team of/i,
                /lista|listar|list|show all/i,
                /pessoas|people|members|team/i
            ];
            
            // Semantic patterns - meaning/content queries
            const semanticPatterns = [
                /o que (sabemos|é|significa|quer dizer)/i,
                /what (do we know|is|does it mean)/i,
                /como funciona|explica|descreve/i,
                /how does|explain|describe/i,
                /resume|sumariza|summarize/i,
                /porque|por que|why/i,
                /informação sobre|about|regarding/i
            ];
            
            // Check structural patterns
            for (const pattern of structuralPatterns) {
                if (pattern.test(q)) {
                    result.type = 'structural';
                    break;
                }
            }
            
            // Check semantic patterns (only if not already structural)
            if (result.type !== 'structural') {
                for (const pattern of semanticPatterns) {
                    if (pattern.test(q)) {
                        result.type = 'semantic';
                        break;
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * Structural search using graph traversal
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Promise<Array>}
     */
    async structuralSearch(query, queryAnalysis = {}) {
        const results = [];
        const q = query.toLowerCase();
        
        // Extract entities from query (enhanced with ontology hints)
        const entities = this.extractEntities(query, queryAnalysis);
        
        // Detect "list all" type queries
        const isListQuery = /quem (são|sao|é|e)|who (are|is)|list|listar|mostrar|show|todas as|all the|pessoas|people|members|team/i.test(q);
        
        // Determine which entity types to search based on query
        let targetTypes = [];
        if (/pessoas|people|quem|who|team|members|equipa/i.test(q)) targetTypes.push('Person');
        if (/projetos?|projects?/i.test(q)) targetTypes.push('Project');
        if (/reuniões?|meetings?/i.test(q)) targetTypes.push('Meeting');
        if (/decisões?|decisions?/i.test(q)) targetTypes.push('Decision');
        if (/riscos?|risks?/i.test(q)) targetTypes.push('Risk');
        if (/tarefas?|tasks?|todos?/i.test(q)) targetTypes.push('Task');
        if (/tecnologias?|tech|technologies?/i.test(q)) targetTypes.push('Technology');
        if (/clientes?|clients?/i.test(q)) targetTypes.push('Client');
        
        // If no specific type detected but it's a list query, default to Person
        if (targetTypes.length === 0 && isListQuery) {
            targetTypes.push('Person');
        }
        
        // Add entity hints from ontology
        if (queryAnalysis.entityHints?.length > 0) {
            for (const hint of queryAnalysis.entityHints) {
                if (!targetTypes.includes(hint.type)) {
                    targetTypes.push(hint.type);
                }
            }
        }
        
        // Check if this is a cross-project query
        const isCrossProjectQuery = /across projects|multiple projects|all projects|cross.?project|em todos os projetos|varios projetos/i.test(q);
        
        // Search for target types in graph - PARALLEL for better performance
        if (this.graphProvider && this.graphProvider.connected && targetTypes.length > 0) {
            // Run all type searches in parallel
            const searchPromises = targetTypes.map(async (targetType) => {
                try {
                    // Use multiGraphManager for shared entities or cross-project queries
                    if (this.multiGraphManager && (this.ontology.isSharedEntity(targetType) || isCrossProjectQuery)) {
                        const typeResult = await this.multiGraphManager.findNodes(targetType, {}, { limit: 50 });
                        if (typeResult.ok && typeResult.nodes?.length > 0) {
                            return { type: targetType, nodes: typeResult.nodes, crossProject: true };
                        }
                    } else {
                        const typeResult = await this.graphProvider.findNodes(targetType, {}, { limit: 50 });
                        if (typeResult.ok && typeResult.nodes?.length > 0) {
                            return { type: targetType, nodes: typeResult.nodes };
                        }
                    }
                } catch (error) {
                    console.log(`[GraphRAG] Error searching for ${targetType}:`, error.message);
                }
                return null;
            });

            const searchResults = await Promise.all(searchPromises);
            
            // Process results and deduplicate
            const seen = new Set();
            for (const result of searchResults) {
                if (!result) continue;
                for (const node of result.nodes) {
                    const key = node.properties.name || node.properties.title || node.id;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    
                    // For cross-project results, include project info
                    const nodeData = {
                        type: result.type.toLowerCase(),
                        content: this.formatGraphResult(node),
                        data: node.properties,
                        source: result.crossProject ? 'graph_cross_project' : 'graph_type_search'
                    };
                    
                    // Add project context for shared entities
                    if (node.properties?.projects?.length > 0) {
                        nodeData.projects = node.properties.projects;
                    }
                    
                    results.push(nodeData);
                }
            }
        }
        
        if (this.graphProvider && this.graphProvider.connected) {
            // Use graph database for structural queries
            for (const entity of entities) {
                // Find person nodes
                const personResult = await this.graphProvider.findNodes('Person', {}, { limit: 100 });
                
                if (personResult.ok) {
                    const matchingPerson = personResult.nodes.find(n => 
                        n.properties.name?.toLowerCase().includes(entity.toLowerCase())
                    );
                    
                    if (matchingPerson) {
                        results.push({
                            type: 'person',
                            content: `${matchingPerson.properties.name} - ${matchingPerson.properties.role || 'Unknown role'}`,
                            data: matchingPerson.properties,
                            source: 'graph'
                        });
                        
                        // Traverse relationships
                        const pathResult = await this.graphProvider.traversePath(
                            matchingPerson.id,
                            ['REPORTS_TO', 'MANAGES', 'LEADS', 'MEMBER_OF'],
                            2
                        );
                        
                        if (pathResult.ok && pathResult.paths.length > 0) {
                            results.push({
                                type: 'relationship',
                                content: `Relationships found for ${matchingPerson.properties.name}`,
                                data: pathResult.paths,
                                source: 'graph'
                            });
                        }
                    }
                }
            }
        }
        
        // Fall back to storage if graph not available or no results
        if (results.length === 0 && this.storage) {
            const people = this.storage.getPeople();
            const relationships = this.storage.getRelationships();
            
            for (const entity of entities) {
                const matchingPeople = people.filter(p => 
                    p.name?.toLowerCase().includes(entity.toLowerCase())
                );
                
                for (const person of matchingPeople) {
                    results.push({
                        type: 'person',
                        content: `${person.name} - ${person.role || 'Unknown role'}`,
                        data: person,
                        source: 'storage'
                    });
                    
                    const relatedRels = relationships.filter(r => 
                        r.from?.toLowerCase() === person.name?.toLowerCase() ||
                        r.to?.toLowerCase() === person.name?.toLowerCase()
                    );
                    
                    for (const rel of relatedRels) {
                        results.push({
                            type: 'relationship',
                            content: `${rel.from} ${rel.type} ${rel.to}`,
                            data: rel,
                            source: 'storage'
                        });
                    }
                }
            }
        }
        
        return results;
    }

    /**
     * Semantic search using embeddings
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Promise<Array>}
     */
    async semanticSearch(query, queryAnalysis = {}) {
        const results = [];
        
        // Enrich query with ontology context for better matching
        let enrichedQuery = query;
        if (this.useOntology && this.embeddingEnricher) {
            enrichedQuery = this.embeddingEnricher.enrichQuery(query, queryAnalysis);
            console.log(`[GraphRAG] Enriched query for semantic search`);
        }
        
        if (!this.storage) {
            return results;
        }
        
        // Check if storage supports Supabase vector search
        const embeddingsData = this.storage.loadEmbeddings();
        const isSupabaseMode = embeddingsData?.isSupabaseMode === true;
        
        if (isSupabaseMode && this.storage.searchWithEmbedding) {
            // ==================== SUPABASE VECTOR SEARCH ====================
            // Use Supabase match_embeddings RPC for vector search
            console.log(`[GraphRAG] Using Supabase vector search`);
            
            try {
                // Generate query embedding
                const embResult = await llm.embed({
                    provider: this.embeddingProvider,
                    model: this.embeddingModel,
                    texts: [enrichedQuery],
                    providerConfig: this.getProviderConfig(this.embeddingProvider)
                });
                
                if (embResult.success && embResult.embeddings?.[0]) {
                    const queryEmbedding = embResult.embeddings[0];
                    
                    // Use Supabase hybrid search
                    const supabaseResults = await this.storage.searchWithEmbedding(
                        query, 
                        queryEmbedding, 
                        { limit: 15, threshold: 0.5, useHybrid: true }
                    );
                    
                    for (const item of supabaseResults) {
                        results.push({
                            type: item.type,
                            content: item.text,
                            data: item.data,
                            similarity: item.score || item.similarity,
                            source: 'supabase_vector'
                        });
                    }
                    
                    console.log(`[GraphRAG] Supabase vector search returned ${results.length} results`);
                }
            } catch (e) {
                console.warn(`[GraphRAG] Supabase vector search error: ${e.message}, falling back to keyword`);
            }
        } else if (embeddingsData && embeddingsData.embeddings?.length > 0) {
            // ==================== LOCAL EMBEDDINGS (JSON) ====================
            // Generate query embedding with enriched query
            const embResult = await llm.embed({
                provider: this.embeddingProvider,
                model: this.embeddingModel,
                texts: [enrichedQuery],
                providerConfig: this.getProviderConfig(this.embeddingProvider)
            });
            
            if (embResult.success && embResult.embeddings?.[0]) {
                const queryEmbedding = embResult.embeddings[0];
                
                // Find similar items in local embeddings
                const ollamaClient = require('../ollama');
                const client = new ollamaClient();
                
                const scored = embeddingsData.embeddings
                    .filter(item => item.embedding && item.embedding.length > 0)
                    .map(item => ({
                        ...item,
                        similarity: client.cosineSimilarity(queryEmbedding, item.embedding)
                    }))
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 10);
                
                for (const item of scored) {
                    results.push({
                        type: item.type,
                        content: item.text,
                        data: item.data,
                        similarity: item.similarity,
                        source: 'embeddings'
                    });
                }
            }
        }
        
        // Fall back to keyword search if embeddings not available or insufficient
        if (results.length < 5) {
            const searchResults = this.storage.search(query, { limit: 10 });
            
            for (const fact of searchResults.facts || []) {
                results.push({
                    type: 'fact',
                    content: fact.content,
                    data: fact,
                    source: 'keyword'
                });
            }
            
            for (const decision of searchResults.decisions || []) {
                results.push({
                    type: 'decision',
                    content: decision.content,
                    data: decision,
                    source: 'keyword'
                });
            }
            
            for (const question of searchResults.questions || []) {
                results.push({
                    type: 'question',
                    content: question.content,
                    data: question,
                    source: 'keyword'
                });
            }
        }
        
        return results;
    }

    /**
     * Hybrid search combining structural and semantic
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Promise<Array>}
     */
    async hybridSearch(query, queryAnalysis = {}) {
        // Run both searches in parallel
        const [structuralResults, semanticResults] = await Promise.all([
            this.structuralSearch(query, queryAnalysis),
            this.semanticSearch(query, queryAnalysis)
        ]);
        
        // Merge and deduplicate results
        const merged = [];
        const seen = new Set();
        
        // Prioritize structural results
        for (const result of structuralResults) {
            const key = `${result.type}:${result.content?.substring(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...result, searchType: 'structural' });
            }
        }
        
        // Add semantic results
        for (const result of semanticResults) {
            const key = `${result.type}:${result.content?.substring(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...result, searchType: 'semantic' });
            }
        }
        
        // Sort by relevance (similarity if available, otherwise structural first)
        merged.sort((a, b) => {
            if (a.similarity && b.similarity) {
                return b.similarity - a.similarity;
            }
            if (a.searchType === 'structural' && b.searchType !== 'structural') {
                return -1;
            }
            return 0;
        });
        
        return merged.slice(0, 15);
    }

    /**
     * Generate response using LLM
     * @param {string} query - Original query
     * @param {Array} results - Search results
     * @param {object} options - Options
     * @returns {Promise<{answer: string, sources: Array}>}
     */
    async generateResponse(query, results, options = {}) {
        if (results.length === 0) {
            return {
                answer: 'Não encontrei informação relevante na base de conhecimento para responder a esta pergunta.',
                sources: []
            };
        }
        
        // Group results by type for better context organization
        const groupedResults = {};
        for (const r of results) {
            const type = r.type || 'other';
            if (!groupedResults[type]) groupedResults[type] = [];
            groupedResults[type].push(r);
        }
        
        // Build structured context
        const contextParts = [];
        let sourceIndex = 1;
        const sourceMap = new Map();
        
        for (const [type, items] of Object.entries(groupedResults)) {
            const typeLabel = this.getTypeLabel(type);
            contextParts.push(`\n### ${typeLabel}:`);
            
            for (const item of items) {
                const tag = `[${sourceIndex}]`;
                sourceMap.set(sourceIndex, item);
                
                // Format content based on type
                let content = item.content;
                if (item.data) {
                    if (type === 'person' && item.data.organization) {
                        content = `${item.data.name} - ${item.data.role || 'sem cargo'} (${item.data.organization})`;
                    }
                }
                
                contextParts.push(`${tag} ${content}`);
                sourceIndex++;
            }
        }
        
        const context = contextParts.join('\n');
        
        // Detect query language
        const isPortuguese = /[áàâãéèêíïóôõöúçñ]|quem|qual|como|onde|quando|porque/i.test(query);
        
        // Generate response using LLM with improved prompt
        const systemPrompt = isPortuguese 
            ? `Você é um assistente inteligente que responde a perguntas baseado em informação de uma base de conhecimento.

REGRAS:
1. Use APENAS a informação fornecida no contexto
2. Cite SEMPRE as fontes usando números entre colchetes [1], [2], etc.
3. Se a informação for parcial, indique o que sabe e o que falta
4. Responda de forma clara, estruturada e completa
5. Para listas de pessoas/itens, formate de forma legível
6. Se não houver dados suficientes, diga claramente

FORMATO:
- Para perguntas sobre pessoas: liste nomes, cargos e organizações
- Para perguntas sobre projetos: descreva status, participantes e tecnologias
- Para perguntas sobre decisões: explique a decisão e o contexto`
            : `You are an intelligent assistant that answers questions based on information from a knowledge base.

RULES:
1. Use ONLY the information provided in the context
2. ALWAYS cite sources using numbers in brackets [1], [2], etc.
3. If information is partial, indicate what you know and what's missing
4. Answer clearly, structured and completely
5. For lists of people/items, format readably
6. If there's not enough data, say so clearly`;

        const userPrompt = `${isPortuguese ? 'Contexto' : 'Context'}:
${context}

${isPortuguese ? 'Pergunta' : 'Question'}: ${query}

${isPortuguese ? 'Responda de forma completa e estruturada:' : 'Answer completely and structured:'}`;

        const llmResult = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt: userPrompt,
            system: systemPrompt,
            temperature: 0.2, // Lower temperature for more consistent responses
            maxTokens: 1500, // More tokens for complete answers
            providerConfig: this.getProviderConfig(this.llmProvider)
        });
        
        if (!llmResult.success) {
            console.error('[GraphRAG] LLM error:', llmResult.error);
            return {
                answer: `Erro ao gerar resposta: ${llmResult.error}`,
                sources: []
            };
        }
        
        // Build sources list
        const sources = results.map((r, i) => ({
            index: i + 1,
            type: r.type,
            content: r.content?.substring(0, 150),
            source: r.source,
            data: r.data
        }));
        
        return {
            answer: llmResult.text,
            sources
        };
    }
    
    /**
     * Get human-readable label for entity type
     * @param {string} type 
     * @returns {string}
     */
    getTypeLabel(type) {
        const labels = {
            'person': 'Pessoas',
            'project': 'Projetos',
            'meeting': 'Reuniões',
            'decision': 'Decisões',
            'task': 'Tarefas',
            'risk': 'Riscos',
            'fact': 'Factos',
            'technology': 'Tecnologias',
            'client': 'Clientes',
            'document': 'Documentos'
        };
        return labels[type.toLowerCase()] || type;
    }

    /**
     * Extract entity names from query
     * Enhanced with ontology-based extraction
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Array<string>}
     */
    extractEntities(query, queryAnalysis = {}) {
        const entities = [];
        
        // Use ontology-based extraction if available
        if (this.useOntology && this.relationInference) {
            try {
                const extracted = this.relationInference.extractWithHeuristics(query, {
                    existingEntities: this.getKnownEntities()
                });
                
                for (const entity of extracted.entities) {
                    const name = entity.name || entity.title || entity.code;
                    if (name && name.length > 2) {
                        entities.push(name);
                    }
                }
            } catch (error) {
                console.log('[GraphRAG] Ontology extraction failed:', error.message);
            }
        }
        
        // Fallback: Simple regex patterns for names
        const patterns = [
            /(?:do|da|de|pelo|pela|the|of)\s+([A-Z][a-záàâãéèêíïóôõöúçñ]+(?:\s+[A-Z][a-záàâãéèêíïóôõöúçñ]+)*)/g,
            /([A-Z][a-záàâãéèêíïóôõöúçñ]+(?:\s+[A-Z][a-záàâãéèêíïóôõöúçñ]+)+)/g
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                if (match[1] && match[1].length > 2) {
                    entities.push(match[1]);
                }
            }
        }
        
        // Remove duplicates
        return [...new Set(entities)];
    }
    
    /**
     * Get known entities from storage for matching
     * @returns {Array}
     */
    getKnownEntities() {
        if (!this.storage) return [];
        
        const entities = [];
        
        // Add people
        for (const person of this.storage.knowledge?.people || []) {
            entities.push({ _type: 'Person', ...person });
        }
        
        // Add projects if available
        for (const project of this.storage.knowledge?.projects || []) {
            entities.push({ _type: 'Project', ...project });
        }
        
        // Add technologies if available
        for (const tech of this.storage.knowledge?.technologies || []) {
            entities.push({ _type: 'Technology', ...tech });
        }
        
        return entities;
    }

    /**
     * Get provider config from llmConfig
     * @param {string} providerId - Provider ID
     * @returns {object}
     */
    getProviderConfig(providerId) {
        return this.llmConfig?.providers?.[providerId] || {};
    }

    /**
     * Sync data from storage to graph database
     * Uses ontology for validation and relationship inference
     * Supports incremental sync (only changed entities)
     * @param {object} options - Sync options
     * @param {boolean} options.incremental - Only sync changed entities (default: true)
     * @param {boolean} options.createIndexes - Create indexes after sync (default: false)
     * @returns {Promise<{ok: boolean, synced: object, errors: Array}>}
     */
    async syncToGraph(options = {}) {
        if (!this.graphProvider || !this.storage) {
            return { ok: false, errors: ['Graph provider or storage not configured'] };
        }
        
        const incremental = options.incremental !== false;
        const createIndexes = options.createIndexes === true;
        const syncTracker = incremental ? getSyncTracker({ dataDir: this.storage.dataDir }) : null;
        
        const synced = { nodes: 0, relationships: 0, inferred: 0, skipped: 0 };
        const errors = [];
        
        console.log(`[GraphRAG] Starting ${incremental ? 'incremental' : 'full'} sync to graph database...`);
        
        // Check if provider supports batch operations
        const supportsBatch = typeof this.graphProvider.createNodesBatch === 'function';
        
        if (supportsBatch) {
            // ===== OPTIMIZED BATCH SYNC =====
            console.log('[GraphRAG] Using batch operations for faster sync');
            
            // Prepare all nodes by type
            const nodesByType = {
                Fact: [],
                Person: [],
                Decision: [],
                Risk: [],
                Task: [],
                Question: []
            };
            
            // Collect Facts
            for (const fact of this.storage.knowledge.facts || []) {
                if (syncTracker && !syncTracker.needsSync('fact', fact)) {
                    synced.skipped++;
                    continue;
                }
                nodesByType.Fact.push({
                    id: `fact_${fact.id}`,
                    content: fact.content,
                    category: fact.category,
                    confidence: fact.confidence || 0.8,
                    source: fact.source_file
                });
                if (syncTracker) syncTracker.markSynced('fact', fact);
            }
            
            // Collect People
            for (const person of this.storage.knowledge.people || []) {
                if (syncTracker && !syncTracker.needsSync('person', person)) {
                    synced.skipped++;
                    continue;
                }
                nodesByType.Person.push({
                    id: `person_${person.id}`,
                    name: person.name,
                    role: person.role,
                    organization: person.organization,
                    email: person.email,
                    avatar_url: person.avatar_url || person.avatarUrl || person.photo_url || person.photoUrl,
                    phone: person.phone,
                    department: person.department
                });
                if (syncTracker) syncTracker.markSynced('person', person);
            }
            
            // Collect Decisions
            for (const decision of this.storage.knowledge.decisions || []) {
                nodesByType.Decision.push({
                    id: `decision_${decision.id}`,
                    title: decision.content?.substring(0, 100) || 'Decision',
                    description: decision.content,
                    date: decision.decision_date,
                    status: 'approved'
                });
            }
            
            // Collect Risks
            for (const risk of this.storage.knowledge.risks || []) {
                nodesByType.Risk.push({
                    id: `risk_${risk.id}`,
                    title: risk.content?.substring(0, 100) || 'Risk',
                    description: risk.content,
                    severity: risk.impact || 'medium',
                    probability: risk.likelihood || 'medium',
                    status: risk.status || 'identified'
                });
            }
            
            // Collect Tasks
            for (const task of this.storage.knowledge.tasks || []) {
                nodesByType.Task.push({
                    id: `task_${task.id}`,
                    title: task.content?.substring(0, 100) || task.title || 'Task',
                    description: task.content,
                    status: task.status || 'todo',
                    priority: task.priority || 'medium',
                    dueDate: task.due_date
                });
            }
            
            // Collect Questions
            const questions = this.storage.questions?.items || this.storage.getQuestions?.() || [];
            for (const question of questions) {
                nodesByType.Question.push({
                    id: `question_${question.id}`,
                    content: question.content,
                    context: question.context || '',
                    priority: question.priority || 'medium',
                    status: question.status || 'pending',
                    answer: question.answer || '',
                    answer_source: question.answer_source || '',
                    assigned_to: question.assigned_to || '',
                    source_file: question.source_file || '',
                    created_at: question.created_at || new Date().toISOString(),
                    resolved_at: question.resolved_at || ''
                });
            }
            
            // Batch create all nodes in parallel
            const batchPromises = Object.entries(nodesByType)
                .filter(([_, nodes]) => nodes.length > 0)
                .map(async ([type, nodes]) => {
                    const result = await this.graphProvider.createNodesBatch(type, nodes);
                    return { type, ...result };
                });
            
            const batchResults = await Promise.all(batchPromises);
            
            for (const result of batchResults) {
                synced.nodes += result.created || 0;
                if (result.errors?.length > 0) {
                    errors.push(...result.errors.map(e => ({ type: result.type, ...e })));
                }
            }
            
        } else {
            // ===== FALLBACK: Individual sync (slower) =====
            // Sync Facts
            for (const fact of this.storage.knowledge.facts || []) {
                if (syncTracker && !syncTracker.needsSync('fact', fact)) {
                    synced.skipped++;
                    continue;
                }
                const nodeData = {
                    id: `fact_${fact.id}`,
                    content: fact.content,
                    category: fact.category,
                    confidence: fact.confidence || 0.8,
                    source: fact.source_file,
                    created_at: new Date().toISOString()
                };
                const result = await this.graphProvider.createNode('Fact', nodeData);
                if (result.ok) {
                    synced.nodes++;
                    if (syncTracker) syncTracker.markSynced('fact', fact);
                }
                else errors.push({ type: 'fact', id: fact.id, error: result.error });
            }
            
            // Sync People
            for (const person of this.storage.knowledge.people || []) {
                if (syncTracker && !syncTracker.needsSync('person', person)) {
                    synced.skipped++;
                    continue;
                }
                const nodeData = {
                    id: `person_${person.id}`,
                    name: person.name,
                    role: person.role,
                    organization: person.organization,
                    email: person.email,
                    skills: person.skills || [],
                    created_at: new Date().toISOString()
                };
                const result = await this.graphProvider.createNode('Person', nodeData);
                if (result.ok) {
                    synced.nodes++;
                    if (syncTracker) syncTracker.markSynced('person', person);
                }
                else errors.push({ type: 'person', id: person.id, error: result.error });
            }
            
            // Sync Decisions
            for (const decision of this.storage.knowledge.decisions || []) {
                const nodeData = {
                    id: `decision_${decision.id}`,
                    title: decision.content?.substring(0, 100) || 'Decision',
                    description: decision.content,
                    date: decision.decision_date,
                    status: 'approved',
                    created_at: new Date().toISOString()
                };
                const result = await this.graphProvider.createNode('Decision', nodeData);
                if (result.ok) synced.nodes++;
                else errors.push({ type: 'decision', id: decision.id, error: result.error });
            }
            
            // Sync Risks
            for (const risk of this.storage.knowledge.risks || []) {
                const nodeData = {
                    id: `risk_${risk.id}`,
                    title: risk.content?.substring(0, 100) || 'Risk',
                    description: risk.content,
                    severity: risk.impact || 'medium',
                    probability: risk.likelihood || 'medium',
                    status: risk.status || 'identified',
                    created_at: new Date().toISOString()
                };
                const result = await this.graphProvider.createNode('Risk', nodeData);
                if (result.ok) synced.nodes++;
                else errors.push({ type: 'risk', id: risk.id, error: result.error });
            }
        }
        
        // Sync Tasks (outside batch for now due to questions merge)
        for (const task of this.storage.knowledge.tasks || []) {
            const nodeData = {
                id: `task_${task.id}`,
                title: task.content?.substring(0, 100) || task.title || 'Task',
                description: task.content,
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                dueDate: task.due_date,
                created_at: new Date().toISOString()
            };
            
            const result = await this.graphProvider.createNode('Task', nodeData);
            if (result.ok) synced.nodes++;
            else errors.push({ type: 'task', id: task.id, error: result.error });
        }
        
        // Sync Questions as Tasks
        for (const question of this.storage.questions?.items || []) {
            const nodeData = {
                id: `question_${question.id}`,
                title: question.content?.substring(0, 100) || 'Question',
                description: question.content,
                status: question.status || 'todo',
                priority: question.priority || 'medium',
                created_at: new Date().toISOString()
            };
            
            const result = await this.graphProvider.createNode('Task', nodeData);
            if (result.ok) synced.nodes++;
            else errors.push({ type: 'question', id: question.id, error: result.error });
        }
        
        // Sync Relationships with ontology validation
        for (const rel of this.storage.knowledge.relationships || []) {
            const fromPerson = (this.storage.knowledge.people || []).find(
                p => p.name?.toLowerCase() === rel.from?.toLowerCase()
            );
            const toPerson = (this.storage.knowledge.people || []).find(
                p => p.name?.toLowerCase() === rel.to?.toLowerCase()
            );
            
            if (fromPerson && toPerson) {
                // Map relationship type to ontology type
                const relType = this.mapRelationType(rel.type);
                
                // Validate relationship if ontology enabled
                if (this.useOntology) {
                    const validation = this.ontology.validateRelation(relType, 'Person', 'Person', {});
                    if (!validation.valid) {
                        console.log(`[GraphRAG] Relationship ${relType} validation warnings:`, validation.errors);
                    }
                }
                
                const result = await this.graphProvider.createRelationship(
                    `person_${fromPerson.id}`,
                    `person_${toPerson.id}`,
                    relType,
                    { context: rel.context, strength: 0.7 }
                );
                if (result.ok) synced.relationships++;
                else errors.push({ type: 'relationship', from: rel.from, to: rel.to, error: result.error });
            }
        }
        
        // Auto-create relationships based on data patterns
        console.log('[GraphRAG] Creating relationships from data patterns...');
        
        // 1. People in same organization -> WORKS_WITH
        const people = this.storage.knowledge.people || [];
        const orgGroups = {};
        for (const person of people) {
            const org = person.organization;
            if (org) {
                if (!orgGroups[org]) orgGroups[org] = [];
                orgGroups[org].push(person);
            }
        }
        
        for (const [org, members] of Object.entries(orgGroups)) {
            if (members.length > 1) {
                // Connect first person to others (avoid n^2 connections)
                const first = members[0];
                for (let i = 1; i < Math.min(members.length, 10); i++) {
                    const other = members[i];
                    const result = await this.graphProvider.createRelationship(
                        `person_${first.id}`,
                        `person_${other.id}`,
                        'WORKS_WITH',
                        { organization: org, inferred: true }
                    );
                    if (result.ok) synced.relationships++;
                }
            }
        }
        
        // 2. Facts mentioning people -> MENTIONED_IN
        const facts = this.storage.knowledge.facts || [];
        for (const fact of facts) {
            const content = (fact.content || '').toLowerCase();
            for (const person of people) {
                const name = (person.name || '').toLowerCase();
                if (name && content.includes(name)) {
                    const result = await this.graphProvider.createRelationship(
                        `person_${person.id}`,
                        `fact_${fact.id}`,
                        'MENTIONED_IN',
                        { inferred: true }
                    );
                    if (result.ok) synced.relationships++;
                }
            }
        }
        
        // 3. Decisions with owners -> OWNS
        const decisions = this.storage.knowledge.decisions || [];
        for (const decision of decisions) {
            if (decision.owner) {
                const owner = people.find(p => 
                    p.name?.toLowerCase() === decision.owner?.toLowerCase() ||
                    p.id === decision.owner
                );
                if (owner) {
                    const result = await this.graphProvider.createRelationship(
                        `person_${owner.id}`,
                        `decision_${decision.id}`,
                        'OWNS',
                        { inferred: true }
                    );
                    if (result.ok) synced.relationships++;
                }
            }
        }
        
        // 4. Risks with contacts -> RESPONSIBLE_FOR
        const risks = this.storage.knowledge.risks || [];
        for (const risk of risks) {
            const contacts = risk.contacts || risk.stakeholders || [];
            for (const contactId of contacts) {
                const person = people.find(p => p.id === contactId || p.name === contactId);
                if (person) {
                    const result = await this.graphProvider.createRelationship(
                        `person_${person.id}`,
                        `risk_${risk.id}`,
                        'RESPONSIBLE_FOR',
                        { inferred: true }
                    );
                    if (result.ok) synced.relationships++;
                }
            }
        }
        
        // Run ontology inference rules if enabled
        if (this.useOntology && this.relationInference) {
            console.log('[GraphRAG] Running ontology inference rules...');
            const inferenceResult = await this.relationInference.runInferenceRules(this.graphProvider);
            synced.inferred = inferenceResult.relationshipsCreated;
            console.log(`[GraphRAG] Inference complete: ${inferenceResult.rulesApplied} rules applied, ${inferenceResult.relationshipsCreated} relationships inferred`);
        }
        
        // Create indexes if requested
        if (createIndexes && typeof this.graphProvider.createOntologyIndexes === 'function') {
            console.log('[GraphRAG] Creating ontology indexes...');
            const indexResult = await this.graphProvider.createOntologyIndexes();
            synced.indexes = indexResult.created;
        }
        
        // Mark sync complete for incremental tracking
        if (syncTracker) {
            syncTracker.markSyncComplete();
        }
        
        console.log(`[GraphRAG] Sync complete: ${synced.nodes} nodes, ${synced.relationships} relationships, ${synced.inferred} inferred, ${synced.skipped} skipped, ${errors.length} errors`);
        
        return { ok: errors.length === 0, synced, errors };
    }
    
    /**
     * Map storage relationship types to ontology types
     * @param {string} type - Original relationship type
     * @returns {string}
     */
    mapRelationType(type) {
        const mapping = {
            'reports_to': 'REPORTS_TO',
            'reports to': 'REPORTS_TO',
            'manages': 'REPORTS_TO', // Reverse
            'works_with': 'KNOWS',
            'works with': 'KNOWS',
            'knows': 'KNOWS',
            'collaborates': 'KNOWS',
            'works_on': 'WORKS_ON',
            'works on': 'WORKS_ON',
            'member_of': 'WORKS_ON',
            'member of': 'WORKS_ON'
        };
        
        return mapping[type?.toLowerCase()] || 'RELATED_TO';
    }
    
    /**
     * Generate enriched embeddings for all entities using ontology
     * @returns {Promise<{ok: boolean, count: number, errors: Array}>}
     */
    async generateEnrichedEmbeddings() {
        if (!this.storage || !this.useOntology) {
            return { ok: false, count: 0, errors: ['Storage or ontology not available'] };
        }
        
        const embeddings = [];
        const errors = [];
        
        console.log('[GraphRAG] Generating enriched embeddings with ontology...');
        
        // Generate embeddings for each entity type
        const entities = this.getKnownEntities();
        
        for (const entity of entities) {
            try {
                const enrichedText = this.embeddingEnricher.enrichEntity(entity._type, entity, {});
                
                const embResult = await llm.embed({
                    provider: this.embeddingProvider,
                    model: this.embeddingModel,
                    texts: [enrichedText],
                    providerConfig: this.getProviderConfig(this.embeddingProvider)
                });
                
                if (embResult.success && embResult.embeddings?.[0]) {
                    embeddings.push({
                        id: entity.id,
                        type: entity._type,
                        text: enrichedText,
                        embedding: embResult.embeddings[0],
                        data: entity
                    });
                }
            } catch (error) {
                errors.push({ id: entity.id, type: entity._type, error: error.message });
            }
        }
        
        // Save enriched embeddings
        if (embeddings.length > 0) {
            const existingEmbeddings = this.storage.loadEmbeddings() || { embeddings: [] };
            
            // Merge with existing, preferring new enriched ones
            const merged = [...embeddings];
            for (const existing of existingEmbeddings.embeddings) {
                const isReplaced = merged.some(e => e.id === existing.id);
                if (!isReplaced) {
                    merged.push(existing);
                }
            }
            
            this.storage.saveEmbeddings({
                embeddings: merged,
                model: this.embeddingModel,
                generated_at: new Date().toISOString(),
                ontology_enriched: true
            });
        }
        
        console.log(`[GraphRAG] Generated ${embeddings.length} enriched embeddings, ${errors.length} errors`);
        
        return { ok: errors.length === 0, count: embeddings.length, errors };
    }

    // ==================== Cross-Project Query Methods ====================

    /**
     * Query across all projects (requires MultiGraphManager)
     * @param {string} userQuery - User's query
     * @param {object} options - Query options
     * @returns {Promise<object>}
     */
    async queryCrossProject(userQuery, options = {}) {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        const startTime = Date.now();
        const results = {
            shared: [],
            projects: {},
            aggregated: []
        };

        try {
            // Search shared entities (People, Technologies, Clients, Organizations)
            const sharedTypes = this.ontology.getSharedEntityTypes();
            
            for (const entityType of sharedTypes) {
                const searchResult = await this.multiGraphManager.findNodes(entityType, {}, { limit: 50 });
                if (searchResult.ok && searchResult.nodes?.length > 0) {
                    results.shared.push({
                        type: entityType,
                        nodes: searchResult.nodes.map(n => ({
                            ...n.properties,
                            projects: n.properties?.projects || []
                        }))
                    });
                }
            }

            // Aggregate results
            for (const typeResult of results.shared) {
                for (const node of typeResult.nodes) {
                    results.aggregated.push({
                        type: typeResult.type.toLowerCase(),
                        content: this.formatGraphResult({ properties: node }),
                        data: node,
                        projects: node.projects || [],
                        source: 'cross_project'
                    });
                }
            }

            // Generate response using LLM
            const answer = await this.generateResponse(userQuery, results.aggregated, {
                crossProject: true,
                ...options
            });

            return {
                ok: true,
                answer,
                sources: results.aggregated,
                queryType: 'cross_project',
                latencyMs: Date.now() - startTime
            };
        } catch (error) {
            console.error('[GraphRAG] Cross-project query error:', error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Find all projects a person participates in
     * @param {string} personName - Person's name
     * @returns {Promise<object>}
     */
    async findPersonProjects(personName) {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        // Search for person in shared graph
        const searchResult = await this.multiGraphManager.findNodes('Person', {}, { limit: 100 });
        if (!searchResult.ok) {
            return { ok: false, error: searchResult.error };
        }

        // Find matching person
        const person = searchResult.nodes?.find(n => 
            n.properties?.name?.toLowerCase().includes(personName.toLowerCase())
        );

        if (!person) {
            return { ok: false, error: 'Person not found', personName };
        }

        return {
            ok: true,
            person: person.properties,
            projects: person.properties?.projects || [],
            projectCount: person.properties?.projects?.length || 0
        };
    }

    /**
     * Find people who work across multiple projects
     * @returns {Promise<object>}
     */
    async findCrossProjectPeople() {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        return this.multiGraphManager.findCrossProjectPeople();
    }

    /**
     * Find connections between projects through shared entities
     * @returns {Promise<object>}
     */
    async findProjectConnections() {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        return this.multiGraphManager.findProjectConnections();
    }
}

module.exports = GraphRAGEngine;
