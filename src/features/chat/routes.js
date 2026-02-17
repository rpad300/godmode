/**
 * Purpose:
 *   Chat API routes providing session management and a sophisticated RAG-powered
 *   conversational Q&A endpoint over project knowledge. Combines GraphRAG, vector
 *   search, HyDE (Hypothetical Document Embeddings), and Reciprocal Rank Fusion
 *   for state-of-the-art retrieval.
 *
 * Responsibilities:
 *   - Chat session CRUD: create, update (title, contact context), list, get messages
 *   - Main chat endpoint (POST /api/chat) with multi-stage retrieval pipeline:
 *     1. Non-English query detection and translation
 *     2. Query preprocessing and classification
 *     3. GraphRAG: AI-generated Cypher queries + hybrid graph search
 *     4. Supabase vector search (or local embeddings fallback)
 *     5. HyDE expansion when initial results are sparse (<5 hits)
 *     6. RRF fusion of graph + vector results, then query-dependent reranking
 *     7. Context assembly with contact enrichment for person entities
 *     8. LLM generation with optional deep reasoning mode
 *   - Session persistence: auto-creates sessions, loads history from DB, persists messages
 *   - User role and contact-context-aware system prompts
 *   - Failover routing support (routes through llmRouter when configured)
 *
 * Key dependencies:
 *   - ../../graphrag: GraphRAGEngine, CypherGenerator, Reranker, HyDE
 *   - ../../utils/vectorSimilarity: Local vector cosine similarity search
 *   - ../../llm/config: LLM and embeddings provider resolution
 *   - ../../server/embeddingCache: Query embedding cache to avoid redundant API calls
 *   - storage: Knowledge base access (hybridSearch, searchWithEmbedding, embeddings, etc.)
 *
 * Side effects:
 *   - Database: creates chat sessions and messages in Supabase
 *   - Global state: creates/reuses global.graphRAGEngine singleton
 *   - LLM API calls: translation, HyDE generation, Cypher generation, main chat completion
 *   - Embedding API calls: query embedding for vector search
 *
 * Notes:
 *   - The GraphRAG engine is stored as a global singleton to persist across requests;
 *     this means its config is only updated on graphProvider changes
 *   - Non-English queries are translated to English for retrieval, then the LLM
 *     is instructed to respond in the original language
 *   - Confidence is derived from context quality and source count, with override
 *     for uncertain-sounding LLM responses
 *   - <think> tags from reasoning models are stripped from the final response
 *   - The "context" field in the request body provides fallback context (source of truth,
 *     facts, questions, decisions) when retrieval yields few results
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');
const { jsonResponse } = require('../../server/response');
const { getCachedQueryEmbedding, setCachedQueryEmbedding } = require('../../server/embeddingCache');

const vectorSimilarity = require('../../utils/vectorSimilarity');
const llmConfig = require('../../llm/config');

async function handleChat(ctx) {
    const { req, res, pathname, storage, config, llm, supabase, llmRouter } = ctx;
    const log = getLogger().child({ module: 'chat' });

    // POST /api/chat/sessions - Create new chat session
    if (pathname === '/api/chat/sessions' && req.method === 'POST') {
        const body = await parseBody(req);
        const title = body.title || 'Nova conversa';
        const contextContactId = body.contextContactId || null;
        try {
            const session = await storage.createChatSession({ title, contextContactId });
            jsonResponse(res, { ok: true, session });
        } catch (e) {
            log.warn({ event: 'chat_session_create_error', reason: e.message }, 'Create session error');
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // PUT /api/chat/sessions/:id - Update chat session (title, contextContactId)
    const chatSessionPutMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)$/);
    if (chatSessionPutMatch && req.method === 'PUT') {
        const sessionId = chatSessionPutMatch[1];
        const body = await parseBody(req);
        const updates = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.contextContactId !== undefined) updates.contextContactId = body.contextContactId || null;
        try {
            const session = await storage.updateChatSession(sessionId, updates);
            jsonResponse(res, { ok: true, session });
        } catch (e) {
            log.warn({ event: 'chat_session_update_error', reason: e.message }, 'Update session error');
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/chat/sessions - List chat sessions for project
    if (pathname === '/api/chat/sessions' && req.method === 'GET') {
        try {
            const sessions = await storage.getChatSessions();
            jsonResponse(res, { ok: true, sessions });
        } catch (e) {
            log.warn({ event: 'chat_sessions_list_error', reason: e.message }, 'List sessions error');
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/chat/sessions/:id/messages - Get messages for session
    const chatSessionMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/);
    if (chatSessionMatch && req.method === 'GET') {
        const sessionId = chatSessionMatch[1];
        try {
            const messages = await storage.getChatMessages(sessionId);
            jsonResponse(res, { ok: true, messages });
        } catch (e) {
            log.warn({ event: 'chat_messages_get_error', reason: e.message }, 'Get messages error');
            jsonResponse(res, { ok: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/chat - Chat with reasoning model using project context
    if (pathname === '/api/chat' && req.method === 'POST') {
        const body = await parseBody(req);
        const message = body.message;
        const context = body.context;
        let history = body.history || [];
        const useSemantic = body.semantic !== false;
        const deepReasoning = body.deepReasoning || false;
        let sessionId = body.sessionId || null;
        const contextContactId = body.contextContactId || null;

        if (!message) {
            jsonResponse(res, { error: 'Message is required' }, 400);
            return true;
        }

        let chatSession = null;
        if (storage.getChatSessions && typeof storage.getChatSessions === 'function') {
            if (sessionId) {
                try {
                    chatSession = storage.getChatSession ? await storage.getChatSession(sessionId) : null;
                    const dbMessages = await storage.getChatMessages(sessionId);
                    if (dbMessages.length > 0 && history.length === 0) {
                        history = dbMessages.map(m => ({ role: m.role, content: m.content }));
                    }
                } catch (e) {
                    log.warn({ event: 'chat_session_messages_load_failed', reason: e.message }, 'Could not load session messages');
                }
            } else if (supabase && supabase.isConfigured && supabase.isConfigured()) {
                try {
                    const newSession = await storage.createChatSession({
                        title: message.substring(0, 80) || 'Nova conversa',
                        contextContactId: contextContactId
                    });
                    sessionId = newSession?.id || null;
                    chatSession = newSession;
                } catch (e) {
                    log.warn({ event: 'chat_session_create_failed', reason: e.message }, 'Could not create session');
                }
            }
        }
        if (!chatSession && sessionId && storage.getChatSession) {
            try { chatSession = await storage.getChatSession(sessionId); } catch (e) { /* ignore */ }
        }

        const textCfg = llmConfig.getTextConfig(config);
        const provider = textCfg?.provider;
        const providerConfig = textCfg?.providerConfig || {};
        const model = textCfg?.model;
        if (!provider || !model) {
            jsonResponse(res, { error: 'No LLM configured. Set Text provider and model in Settings > LLM.' }, 400);
            return true;
        }

        const embedCfg = llmConfig.getEmbeddingsConfig(config);
        const embedProvider = embedCfg?.provider;
        const embedProviderConfig = embedCfg?.providerConfig || {};
        const embedModel = embedCfg?.model || '';

        log.debug({ event: 'chat_provider', provider, model, embedProvider, embedModel }, 'Using LLM and embeddings config');

        const currentProject = storage.getCurrentProject();
        let userRole = currentProject?.userRole || '';
        let userRolePrompt = currentProject?.userRolePrompt || '';
        let roleContext = '';
        const contextContactIdFromSession = chatSession?.context_contact_id || null;
        if (contextContactIdFromSession && storage.getContactById) {
            const contact = await Promise.resolve(storage.getContactById(contextContactIdFromSession));
            if (contact) {
                const name = contact.name || 'Contact';
                const role = contact.role || '';
                const org = contact.organization || '';
                const notes = contact.notes || '';
                roleContext = `\nUSER CONTEXT: Chatting as ${name}`;
                if (role) roleContext += ` (${role})`;
                if (org) roleContext += ` at ${org}`;
                roleContext += '. Tailor responses to their perspective and responsibilities.';
                if (notes) roleContext += `\nAdditional context: ${notes}`;
            }
        }
        if (!roleContext && userRole) {
            roleContext = `\nUSER ROLE: The user is a "${userRole}" - tailor responses to their perspective and responsibilities.`;
            if (userRolePrompt) roleContext += `\nROLE CONTEXT: ${userRolePrompt}`;
        }

        let systemPrompt;
        if (deepReasoning) {
            systemPrompt = `You are an expert Q&A assistant for a document processing project. Use structured reasoning to provide accurate, well-analyzed answers.${roleContext}

REASONING FRAMEWORK (follow these steps):

**Step 1 - CONTEXT ANALYSIS:**
- What type of question is this? (factual/analytical/comparison/status)
- What information from the context is most relevant?
- What expertise lens should I apply?

**Step 2 - INITIAL RESPONSE:**
Draft a response using the available context. Cite specific items.

**Step 3 - STRESS TEST:**
- Are there gaps in the context that limit my answer?
- Am I making assumptions not supported by the data?
- Is there conflicting information I need to address?
- What confidence level is appropriate?

**Step 4 - FINAL ANSWER:**
Provide the definitive answer with:
- Key points in **bold**
- Clear structure with headers if needed
- Confidence indicator: [HIGH/MEDIUM/LOW]
- What additional information would improve this answer (if applicable)

IMPORTANT: Always ground your answer in the provided context. If information is insufficient, say so clearly.`;
        } else {
            systemPrompt = `You are a helpful Q&A assistant for a document processing project. Answer questions based on the provided context and conversation history.${roleContext}

IMPORTANT RULES:
1. Be concise but thorough
2. If you don't have enough information in the context to answer confidently, say "I don't have enough information to answer this question definitively"
3. When citing information, mention the source type (e.g., "According to a fact from..." or "Based on a decision...")
4. If the question is about something not in the context, acknowledge what IS available`;
        }

        let sources = [];
        let contextQuality = 'none';

        let translatedQuery = null;
        const nonEnglishPattern = /[àáâãäåæçèéêëìíîïñòóôõöùúûüýÿ]|^(o que|como|quando|onde|quem|qual|porque|por que|porquê|será|está|são|foi|eram|quais|esto|esta|estos|estas|qué|cómo|cuándo|dónde|quién|cuál|porqué|será|está|son|fue|eran|cuáles|was ist|wie|wann|wo|wer|welche|warum|qu'est|comment|quand|où|qui|quel|pourquoi)/i;

        if (nonEnglishPattern.test(message)) {
            log.debug({ event: 'chat_translate_start' }, 'Detected non-English query, translating');
            try {
                const translateResult = await llm.generateText({
                    provider,
                    providerConfig,
                    model,
                    prompt: `Translate this question to English. Only output the translation, nothing else:\n\n"${message}"`,
                    temperature: 0.1,
                    maxTokens: 200,
                    context: 'chat'
                });

                if (translateResult.success && translateResult.text) {
                    translatedQuery = translateResult.text.replace(/^["']|["']$/g, '').trim();
                    log.debug({ event: 'chat_translate_ok', translatedQuery }, 'Translated query');
                }
            } catch (e) {
                log.debug({ event: 'chat_translate_failed', reason: e.message }, 'Translation failed');
            }
        }

        const searchQuery = translatedQuery || message;
        const processedQuery = storage.preprocessQuery(searchQuery);
        const queryType = storage.classifyQuery(searchQuery);
        log.debug({ event: 'chat_query_classified', queryType, terms: processedQuery.terms }, 'Query type');

        // ==================== GRAPHRAG INTEGRATION ====================
        let graphRAGResults = null;
        let graphContext = '';
        const graphProvider = storage.getGraphProvider();

        if (graphProvider && graphProvider.connected) {
            try {
                const { GraphRAGEngine } = require('../../graphrag');
                const { getCypherGenerator } = require('../../graphrag');

                if (!global.graphRAGEngine) {
                    global.graphRAGEngine = new GraphRAGEngine({
                        graphProvider: graphProvider,
                        storage: storage,
                        embeddingProvider: embedProvider,
                        embeddingModel: embedModel,
                        embeddingProviderConfig: embedProviderConfig,
                        llmProvider: provider,
                        llmModel: model,
                        llmConfig: config.llm,
                        enableCache: true,
                        useOntology: true
                    });
                } else if (global.graphRAGEngine.graphProvider !== graphProvider) {
                    global.graphRAGEngine.graphProvider = graphProvider;
                }

                log.debug({ event: 'chat_graphrag_use' }, 'Using GraphRAG for enhanced retrieval');

                const cypherGen = getCypherGenerator({
                    llmProvider: provider,
                    llmModel: model,
                    llmConfig: config.llm
                });

                const aiCypher = await cypherGen.generate(searchQuery, {
                    provider: provider,
                    model: model
                });

                let aiCypherResults = [];
                if (aiCypher.cypher && aiCypher.confidence >= 0.3) {
                    log.debug({ event: 'chat_ai_cypher', confidence: aiCypher.confidence, cypherPreview: aiCypher.cypher.substring(0, 80) }, 'AI Cypher');

                    try {
                        const cypherResult = await graphProvider.query(aiCypher.cypher);
                        if (cypherResult.ok && cypherResult.results?.length > 0) {
                            aiCypherResults = cypherResult.results;
                            log.debug({ event: 'chat_ai_cypher_results', count: aiCypherResults.length }, 'AI Cypher results');
                        }
                    } catch (cypherError) {
                        log.warn({ event: 'chat_ai_cypher_failed', reason: cypherError.message }, 'AI Cypher query failed');
                    }
                }

                const graphQuery = global.graphRAGEngine.classifyQuery(searchQuery);
                log.debug({ event: 'chat_graphrag_query', type: graphQuery.type, entityHints: graphQuery.entityHints?.length || 0, relationHints: graphQuery.relationHints?.length || 0 }, 'GraphRAG query type');

                let graphSearchResults = [];

                if (aiCypherResults.length > 0) {
                    for (const row of aiCypherResults) {
                        for (const [key, val] of Object.entries(row)) {
                            if (val && typeof val === 'object') {
                                const props = val.properties || val._properties || val;
                                const labels = val.labels || val._labels || [];
                                const nodeType = labels[0] || 'Entity';

                                graphSearchResults.push({
                                    type: nodeType,
                                    name: props.name || props.title || key,
                                    content: props.content || props.description || props.summary || '',
                                    data: { properties: props },
                                    score: aiCypher.confidence,
                                    source: 'ai_cypher'
                                });
                            } else if (typeof val === 'string' && val.length > 0) {
                                graphSearchResults.push({
                                    type: key,
                                    name: val,
                                    content: val,
                                    score: aiCypher.confidence,
                                    source: 'ai_cypher'
                                });
                            }
                        }
                    }
                }

                if (graphSearchResults.length < 5 && (graphQuery.entityHints?.length > 0 || graphQuery.relationHints?.length > 0)) {
                    const hybridResults = await global.graphRAGEngine.hybridSearch(searchQuery, { queryAnalysis: graphQuery });
                    for (const hr of hybridResults) {
                        if (!graphSearchResults.find(r => r.name === hr.name)) {
                            graphSearchResults.push(hr);
                        }
                    }
                }

                if (graphSearchResults.length > 0) {
                    graphRAGResults = graphSearchResults;
                    log.debug({ event: 'chat_graph_results', count: graphSearchResults.length }, 'Graph-based results');

                    graphContext = '\n\n=== KNOWLEDGE GRAPH CONTEXT ===\n';
                    graphContext += `(via AI-generated query - ${graphSearchResults.length} relevant entities)\n`;
                    if (aiCypher.explanation) {
                        graphContext += `Query intent: ${aiCypher.explanation}\n`;
                    }

                    for (const result of graphSearchResults.slice(0, 10)) {
                        const typeLabel = result.type || result.label || 'Entity';
                        graphContext += `\n[${typeLabel.toUpperCase()}]`;
                        if (result.name) graphContext += ` ${result.name}`;
                        if (result.score) graphContext += ` (relevance: ${Math.round(result.score * 100)}%)`;
                        graphContext += '\n';

                        if (result.content) {
                            graphContext += `${result.content}\n`;
                        } else if (result.data) {
                            const props = result.data.properties || result.data;
                            const relevantProps = ['content', 'description', 'summary', 'role', 'organization', 'email', 'department', 'status'];
                            for (const prop of relevantProps) {
                                if (props[prop]) {
                                    graphContext += `  ${prop}: ${props[prop]}\n`;
                                }
                            }
                        }

                        sources.push({
                            id: result.id || `graph_${sources.length}`,
                            type: typeLabel,
                            score: result.score || 0.5,
                            source: result.source || 'graph_database'
                        });
                    }

                    graphContext += '\n=== END KNOWLEDGE GRAPH ===\n';
                }

                if (graphQuery.entityHints?.length > 0 && graphSearchResults.length > 0) {
                    try {
                        const h0 = graphQuery.entityHints[0];
                        const entityName = typeof h0 === 'string' ? h0 : (h0?.keyword || h0?.type || h0?.value || '');
                        if (!entityName) throw new Error('No entity name');
                        const relatedQuery = `MATCH (n)-[r]-(m) WHERE toLower(n.name) CONTAINS toLower('${String(entityName).replace(/'/g, "\\'")}') RETURN n, type(r) as rel, m LIMIT 5`;
                        const relatedResult = await graphProvider.query(relatedQuery);

                        if (relatedResult.ok && relatedResult.results?.length > 0) {
                            graphContext += '\n--- Related Entities ---\n';
                            for (const row of relatedResult.results) {
                                if (row.n?.properties?.name && row.m?.properties?.name) {
                                    graphContext += `${row.n.properties.name} --[${row.rel}]--> ${row.m.properties.name}\n`;
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore related entity errors
                    }
                }

            } catch (graphError) {
                log.warn({ event: 'chat_graphrag_error', reason: graphError.message }, 'GraphRAG error, falling back to standard search');
            }
        }

        // ==================== SOTA RAG PIPELINE ====================
        const { getReranker } = require('../../graphrag');
        const { getHyDE } = require('../../graphrag');

        const reranker = getReranker({
            llmProvider: provider,
            llmModel: model,
            llmConfig: config.llm
        });

        const embeddingsData = storage.loadEmbeddings();
        let hybridResults = [];
        let vectorResults = [];
        let useHyDE = false;

        const isSupabaseMode = embeddingsData?.isSupabaseMode === true;

        let entityTypeFilter = null;
        if (graphProvider && global.graphRAGEngine) {
            const queryAnalysis = global.graphRAGEngine.classifyQuery(searchQuery);
            if (queryAnalysis.entityHints?.length > 0) {
                const typeMap = { 'Person': 'person', 'Project': 'fact', 'Meeting': 'decision', 'Technology': 'fact', 'Risk': 'risk', 'Task': 'question' };
                entityTypeFilter = queryAnalysis.entityHints.map(h => {
                    const t = typeof h === 'string' ? h : (h?.type || h?.name || '');
                    return typeMap[t] || (typeof t === 'string' && t ? t.toLowerCase() : null);
                }).filter(Boolean);
                log.debug({ event: 'chat_ontology_hints', entityTypeFilter }, 'Ontology entity hints');
            }
        }

        if (useSemantic && isSupabaseMode && storage.searchWithEmbedding) {
            log.debug({ event: 'chat_supabase_vector' }, 'Using Supabase vector search for RAG');

            try {
                const queryText = processedQuery.expanded || message;
                let queryEmbedding = getCachedQueryEmbedding(queryText, embedModel);

                if (queryEmbedding) {
                    log.debug({ event: 'chat_cached_embedding' }, 'Using cached query embedding');
                } else {
                    const queryResult = await llm.embed({
                        provider: embedProvider,
                        providerConfig: embedProviderConfig,
                        model: embedModel,
                        texts: [queryText]
                    });

                    if (queryResult.success && queryResult.embeddings?.[0]) {
                        queryEmbedding = queryResult.embeddings[0];
                        setCachedQueryEmbedding(queryText, embedModel, queryEmbedding);
                    }
                }

                if (queryEmbedding) {
                    hybridResults = await storage.searchWithEmbedding(
                        processedQuery.expanded || message,
                        queryEmbedding,
                        {
                            limit: 20,
                            threshold: 0.35,
                            useHybrid: true,
                            entityTypes: entityTypeFilter
                        }
                    );
                    vectorResults = hybridResults.filter(r => r.source === 'semantic' || r.semanticScore > 0.3);
                    log.debug({ event: 'chat_supabase_search', count: hybridResults.length }, 'Supabase search total');

                    if (hybridResults.length < 5 && processedQuery.terms.length >= 2) {
                        useHyDE = true;
                        log.debug({ event: 'chat_hyde_try', count: hybridResults.length }, 'Sparse results, trying HyDE');

                        const hyde = getHyDE({
                            llmProvider: provider,
                            llmModel: model,
                            llmConfig: config.llm,
                            embeddingProvider: embedProvider,
                            embeddingModel: embedModel,
                            embeddingProviderConfig: embedProviderConfig
                        });

                        const hydeResult = await hyde.generateHyDEEmbedding(searchQuery, {
                            entityType: entityTypeFilter?.[0]
                        });

                        if (hydeResult.embedding) {
                            const hydeResults = await storage.searchWithEmbedding(
                                searchQuery,
                                hydeResult.embedding,
                                { limit: 10, threshold: 0.3, useHybrid: false }
                            );
                            log.debug({ event: 'chat_hyde_results', count: hydeResults.length }, 'HyDE additional results');

                            if (hydeResults.length > 0) {
                                const fusedResults = reranker.reciprocalRankFusion([hybridResults, hydeResults]);
                                hybridResults = fusedResults.slice(0, 15);
                            }
                        }
                    }
                }
            } catch (supaVectorErr) {
                log.warn({ event: 'chat_supabase_vector_failed', reason: supaVectorErr.message }, 'Supabase vector search failed, falling back to keyword');
                hybridResults = storage.hybridSearch(processedQuery.expanded || message, [], {
                    semanticWeight: 0,
                    keywordWeight: 1,
                    minScore: 0.15,
                    limit: 12
                });
            }
        } else if (useSemantic && embeddingsData && embeddingsData.embeddings?.length > 0 && embedProvider && embedModel) {
            const localEmbedModel = embeddingsData.model || embedModel;
            const queryResult = await llm.embed({
                provider: embedProvider,
                providerConfig: embedProviderConfig,
                model: localEmbedModel,
                texts: [processedQuery.expanded || message]
            });

            if (queryResult.success && queryResult.embeddings?.[0]) {
                const semanticResults = vectorSimilarity.findSimilar(queryResult.embeddings[0], embeddingsData.embeddings, 20);

                hybridResults = storage.hybridSearch(processedQuery.expanded || message, semanticResults, {
                    semanticWeight: 0.6,
                    keywordWeight: 0.4,
                    minScore: 0.15,
                    limit: 12
                });
            }
        } else {
            hybridResults = storage.hybridSearch(processedQuery.expanded || message, [], {
                semanticWeight: 0,
                keywordWeight: 1,
                minScore: 0.15,
                limit: 12
            });
        }

        // ==================== SOTA: RRF FUSION + RERANKING ====================
        let finalResults = hybridResults;

        if (graphRAGResults && graphRAGResults.length > 0 && hybridResults.length > 0) {
            log.debug({ event: 'chat_rrf_fuse', graphCount: graphRAGResults.length, hybridCount: hybridResults.length }, 'Fusing results with RRF');

            const normalizedGraphResults = graphRAGResults.map(r => ({
                id: r.id || `graph_${Math.random().toString(36).substr(2, 9)}`,
                type: r.type || 'entity',
                text: r.content || r.name || '',
                score: r.score || 0.5,
                data: r.data || r,
                source: 'graph'
            }));

            finalResults = reranker.reciprocalRankFusion([hybridResults, normalizedGraphResults]);
            log.debug({ event: 'chat_rrf_done', count: finalResults.length }, 'RRF fusion produced unique results');

            const queryAnalysis = { type: queryType };
            finalResults = reranker.queryDependentRerank(searchQuery, finalResults, queryAnalysis);

            finalResults = finalResults.slice(0, 12);
        } else if (graphRAGResults && graphRAGResults.length > 0) {
            finalResults = graphRAGResults.map(r => ({
                id: r.id || `graph_${Math.random().toString(36).substr(2, 9)}`,
                type: r.type || 'entity',
                text: r.content || r.name || '',
                score: r.score || 0.5,
                rrfScore: r.score || 0.5,
                data: r.data || r,
                source: 'graph'
            }));
        }

        if (finalResults.length > 0) {
            const avgScore = finalResults.reduce((sum, r) => sum + (r.rrfScore || r.score || 0), 0) / finalResults.length;
            const topScore = finalResults[0].rrfScore || finalResults[0].score || 0;

            if (topScore > 0.03 && avgScore > 0.02) contextQuality = 'high';
            else if (topScore > 0.02 && avgScore > 0.01) contextQuality = 'medium';
            else contextQuality = 'low';

            const searchMethod = useHyDE ? 'HyDE + RRF Fusion' : (graphRAGResults?.length > 0 ? 'Graph + Vector RRF Fusion' : 'Hybrid Search');
            systemPrompt += `\n\n=== RELEVANT CONTEXT (${searchMethod} - Quality: ${contextQuality}) ===\n`;

            const itemIds = finalResults.map(r => r.id).filter(Boolean);
            const itemsWithMeta = storage.getItemsWithMetadata ? storage.getItemsWithMetadata(itemIds) : [];

            finalResults.forEach((result) => {
                const meta = itemsWithMeta.find(i => i.id === result.id) || result;
                const score = result.rrfScore || result.relevanceScore || result.score || 0;

                let contactName, contactRole, avatarUrl;
                if ((result.type === 'person' || result.type === 'Person') && result.id) {
                    const entityIdMatch = String(result.id).match(/^person_(.+)$/);
                    const entityId = entityIdMatch ? entityIdMatch[1] : result.id;
                    try {
                        const contact = storage.getContactById ? storage.getContactById(entityId) : null;
                        if (contact) {
                            contactName = contact.name;
                            contactRole = contact.role || contact.organization || '';
                            avatarUrl = contact.avatar_url || contact.photo_url || null;
                        } else {
                            const people = storage.getPeople ? storage.getPeople() : [];
                            const person = Array.isArray(people) ? people.find(p => p.id === entityId || `person_${p.id}` === result.id) : null;
                            if (person) {
                                contactName = person.name;
                                contactRole = person.role || person.organization || '';
                                avatarUrl = person.avatar_url || person.photo_url || null;
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
                if (!contactName && (result.data?.name || result.data?.properties?.name)) {
                    contactName = result.data.name || result.data.properties?.name;
                    contactRole = result.data.role || result.data.properties?.role || result.data.organization || '';
                    avatarUrl = result.data.avatar_url || result.data.properties?.avatar_url || null;
                }

                let itemHeader = `\n[${(result.type || 'unknown').toUpperCase()}]`;
                if (meta.category) itemHeader += ` (${meta.category})`;
                if (meta.priority) itemHeader += ` [${meta.priority}]`;
                if (meta.impact) itemHeader += ` [impact: ${meta.impact}]`;
                itemHeader += ` - relevance: ${Math.round(score * 100)}%`;
                if (result.sourceCount > 1) itemHeader += ` | multi-source (${result.sourceCount})`;
                if (meta.source || result.source) itemHeader += ` | from: ${meta.source || result.source}`;

                systemPrompt += itemHeader + '\n';
                systemPrompt += `${result.text || result.content || ''}\n`;

                sources.push({
                    id: result.id,
                    type: result.type,
                    score: score,
                    rrfScore: result.rrfScore,
                    semanticScore: result.semanticScore,
                    keywordScore: result.keywordScore,
                    sourceCount: result.sourceCount,
                    source: meta.source || result.source || null,
                    contactName: contactName || undefined,
                    contactRole: contactRole || undefined,
                    avatarUrl: avatarUrl || undefined
                });
            });

            systemPrompt += `\n=== END RELEVANT CONTEXT ===\n`;
            log.debug({ event: 'chat_context_found', count: finalResults.length, contextQuality, topScore }, 'Found items');
        } else {
            const fallbackResults = storage.hybridSearch(message, [], {
                semanticWeight: 0,
                keywordWeight: 1,
                minScore: 0.2,
                limit: 10
            });

            if (fallbackResults.length > 0) {
                systemPrompt += `\n\n=== RELEVANT CONTEXT (Keyword Search Fallback) ===\n`;
                fallbackResults.forEach(result => {
                    systemPrompt += `\n[${result.type.toUpperCase()}] - match: ${Math.round(result.keywordScore * 100)}%\n`;
                    systemPrompt += `${result.text}\n`;
                    sources.push({
                        id: result.id,
                        type: result.type,
                        score: result.keywordScore
                    });
                });
                systemPrompt += `\n=== END RELEVANT CONTEXT ===\n`;
                contextQuality = 'low';
                log.debug({ event: 'chat_keyword_fallback', count: fallbackResults.length }, 'Keyword fallback results');
            }
        }

        if (graphContext && sources.length < 8) {
            systemPrompt += graphContext;
            if (contextQuality === 'none' || contextQuality === 'low') {
                contextQuality = 'medium';
            }
            log.debug({ event: 'chat_graph_context_added' }, 'Added supplementary graph context');
        }

        if (context && sources.length < 5) {
            systemPrompt += `\n\n=== ADDITIONAL CONTEXT ===\n`;

            if (context.sourceOfTruth && sources.length === 0) {
                systemPrompt += `\n--- SOURCE OF TRUTH ---\n${context.sourceOfTruth.substring(0, 4000)}\n`;
            }

            if (context.facts && context.facts.length > 0 && sources.length < 3) {
                const factsToShow = context.facts.slice(0, 20);
                systemPrompt += `\n--- FACTS (${context.facts.length} total, showing ${factsToShow.length}) ---\n`;
                factsToShow.forEach(f => {
                    systemPrompt += `- [${f.category || 'general'}] ${f.content}\n`;
                });
            }

            if (context.questions && context.questions.length > 0) {
                const questionsToShow = context.questions.slice(0, 15);
                systemPrompt += `\n--- PENDING QUESTIONS (${context.questions.length} total) ---\n`;
                questionsToShow.forEach(q => {
                    systemPrompt += `- [${q.priority || 'medium'}] ${q.content}`;
                    if (q.assignee) systemPrompt += ` (Ask: ${q.assignee})`;
                    systemPrompt += `\n`;
                });
            }

            if (context.decisions && context.decisions.length > 0) {
                const decisionsToShow = context.decisions.slice(0, 15);
                systemPrompt += `\n--- DECISIONS (${context.decisions.length} total) ---\n`;
                decisionsToShow.forEach(d => {
                    systemPrompt += `- ${d.content}`;
                    if (d.date) systemPrompt += ` (${d.date})`;
                    if (d.owner) systemPrompt += ` - ${d.owner}`;
                    systemPrompt += `\n`;
                });
            }

            systemPrompt += `\n=== END ADDITIONAL CONTEXT ===\n`;
        }

        let conversationPrompt = systemPrompt + '\n\n';

        if (history.length > 0) {
            conversationPrompt += '=== CONVERSATION HISTORY ===\n';
            history.forEach(h => {
                if (h.role === 'user') {
                    conversationPrompt += `User: ${h.content}\n`;
                } else if (h.role === 'assistant') {
                    conversationPrompt += `Assistant: ${h.content}\n`;
                }
            });
            conversationPrompt += '=== END HISTORY ===\n\n';
        }

        if (translatedQuery) {
            conversationPrompt += `\nIMPORTANT: The user asked in a non-English language. Respond in the SAME LANGUAGE as the user's original question.\n`;
            conversationPrompt += `Original question: "${message}"\n`;
        }

        conversationPrompt += `User: ${message}\n\nAssistant:`;

        try {
            log.debug({ event: 'chat_request', provider, model, sourcesCount: sources.length, contextQuality }, 'Chat request');

            const routingMode = config.llm?.routing?.mode || 'single';
            let result;
            let routingInfo = null;

            if (routingMode === 'failover') {
                const routeResult = await llmRouter.routeAndExecute('chat', 'generateText', {
                    prompt: conversationPrompt,
                    temperature: 0.7,
                    maxTokens: 2048
                }, config);

                result = routeResult.result || routeResult;
                routingInfo = routeResult.routing;

                if (!routeResult.success) {
                    throw new Error(routeResult.error?.message || 'All providers failed');
                }
            } else {
                result = await llm.generateText({
                    provider,
                    providerConfig,
                    model,
                    prompt: conversationPrompt,
                    temperature: 0.7,
                    maxTokens: 2048,
                    context: 'chat'
                });
            }

            const success = result.success;
            const response = result.text;

            if (success) {
                let cleanedResponse = response || '';
                cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                let confidence = 'low';
                if (contextQuality === 'high' && sources.length >= 3) {
                    confidence = 'high';
                } else if (contextQuality === 'medium' || sources.length >= 2) {
                    confidence = 'medium';
                }

                const uncertainPhrases = [
                    'i don\'t have enough information',
                    'i cannot find',
                    'not mentioned in the context',
                    'no information available',
                    'unable to determine'
                ];
                const responseLower = cleanedResponse.toLowerCase();
                const isUncertain = uncertainPhrases.some(phrase => responseLower.includes(phrase));
                if (isUncertain) confidence = 'low';

                if (sessionId && storage.appendChatMessage) {
                    try {
                        await storage.appendChatMessage(sessionId, 'user', message, {});
                        await storage.appendChatMessage(sessionId, 'assistant', cleanedResponse, {
                            sources: sources.length > 0 ? sources : [],
                            metadata: { queryType, confidence, contextQuality, rag: { method: useHyDE ? 'hyde+rrf' : (graphRAGResults?.length > 0 ? 'graph+vector+rrf' : 'hybrid') } }
                        });
                    } catch (persistErr) {
                        log.warn({ event: 'chat_persist_messages_failed', reason: persistErr.message }, 'Could not persist messages');
                    }
                }

                jsonResponse(res, {
                    success: true,
                    response: cleanedResponse,
                    sessionId: sessionId || undefined,
                    model: routingInfo?.model || model,
                    provider: routingInfo?.usedProvider || provider,
                    confidence: confidence,
                    contextQuality: contextQuality,
                    queryType: queryType,
                    sources: sources.length > 0 ? sources : undefined,
                    rag: {
                        method: useHyDE ? 'hyde+rrf' : (graphRAGResults?.length > 0 ? 'graph+vector+rrf' : 'hybrid'),
                        vectorResults: vectorResults?.length || 0,
                        graphResults: graphRAGResults?.length || 0,
                        fusedResults: finalResults?.length || 0,
                        usedHyDE: useHyDE,
                        entityFilter: entityTypeFilter
                    },
                    routing: routingInfo ? {
                        mode: routingInfo.mode,
                        usedProvider: routingInfo.usedProvider,
                        attempts: routingInfo.attempts?.length || 1
                    } : undefined
                });
            } else {
                jsonResponse(res, { success: false, error: result.error || 'Failed to generate response' }, 500);
            }
        } catch (error) {
            logError(error, { event: 'chat_error' });
            jsonResponse(res, { success: false, error: 'Chat error: ' + error.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleChat };
