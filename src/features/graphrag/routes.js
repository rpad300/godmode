/**
 * Purpose:
 *   Graph-augmented Retrieval-Augmented Generation (GraphRAG) API.
 *   Combines knowledge graph traversal with LLM inference for intelligent querying,
 *   community detection, and multi-hop reasoning.
 *
 * Responsibilities:
 *   - Streaming and non-streaming GraphRAG queries with request deduplication
 *   - HyDE (Hypothetical Document Embeddings) generation
 *   - Multi-hop reasoning chains across graph relationships
 *   - Community detection, centrality analysis, and bridge node identification
 *   - Query enhancement, entity embedding preparation, and cross-encoder reranking
 *   - Background graph sync (incremental and full resync)
 *
 * Key dependencies:
 *   - ../../graphrag (GraphRAGEngine, getHyDE, getMultiHopReasoning, getCommunityDetection,
 *     getEmbeddingPrompts, getReranker): core GraphRAG modules
 *   - ../../llm/config: resolve provider/model for text and embeddings
 *   - ../../llm/streaming: SSE streaming for GraphRAG queries
 *   - ../../utils (getRequestDedup): prevent duplicate concurrent queries
 *
 * Side effects:
 *   - Lazily initializes and caches global.graphRAGEngine (singleton)
 *   - Maintains global.graphRagSyncStatus per project for background sync tracking
 *   - Background sync fires-and-forgets after returning HTTP 202
 *   - Full resync deletes and recreates the graph before re-syncing
 *
 * Notes:
 *   - The /api/graphrag/sync and /api/graphrag/resync endpoints appear twice in the file:
 *     once as background-async (lines 269-391) and once as synchronous (lines 442-614).
 *     The first match wins at runtime, so the background versions handle requests.
 *     Assumption: the synchronous duplicates are dead code from an earlier refactor.
 *   - GraphRAGEngine is hot-swapped if the graph provider changes between requests
 *   - All query endpoints require LLM text config; embed endpoints also need embedding config
 *
 * Routes:
 *   POST /api/graphrag/stream            - SSE-streamed GraphRAG query
 *   POST /api/graphrag/hyde              - Generate HyDE embeddings for a query
 *   POST /api/graphrag/multihop          - Multi-hop reasoning query
 *   GET  /api/graphrag/communities       - Detect graph communities
 *   GET  /api/graphrag/centrality        - Calculate node centrality scores
 *   GET  /api/graphrag/bridges           - Find bridge nodes between communities
 *   POST /api/graphrag/enhance-query     - Enhance query text for embedding
 *   POST /api/graphrag/prepare-embedding - Prepare entity for multi-view embedding
 *   POST /api/graphrag/rerank            - Cross-encoder rerank of search candidates
 *   GET  /api/graphrag/status            - Per-project sync status
 *   POST /api/graphrag/sync              - Start incremental background sync (HTTP 202)
 *   POST /api/graphrag/resync            - Start full background resync (HTTP 202)
 *   POST /api/graphrag/query             - Deduplicated GraphRAG query (JSON response)
 *   GET  /api/graphrag/sync-status       - Provider-level sync status
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');
const llmConfig = require('../../llm/config');

function isGraphragRoute(pathname) {
    return pathname.startsWith('/api/graphrag/');
}

async function handleGraphrag(ctx) {
    const { req, res, pathname, storage, config } = ctx;

    if (!isGraphragRoute(pathname)) return false;

    const textCfg = llmConfig.getTextConfig(config);
    const embedCfg = llmConfig.getEmbeddingsConfig(config);

    // POST /api/graphrag/stream
    if (pathname === '/api/graphrag/stream' && req.method === 'POST') {
        const body = await parseBody(req);
        const query = body.query || body.message;
        if (!query) {
            jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
            return true;
        }
        if (!textCfg?.provider || !textCfg?.model) {
            jsonResponse(res, { ok: false, error: 'No LLM text provider/model configured. Set in Settings > LLM.' }, 400);
            return true;
        }
        try {
            const { streamGraphRAGQuery } = require('../../llm/streaming');
            const { GraphRAGEngine } = require('../../graphrag');
            if (!global.graphRAGEngine) {
                global.graphRAGEngine = new GraphRAGEngine({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    llmProvider: textCfg.provider,
                    llmModel: textCfg.model,
                    llmConfig: config.llm,
                    enableCache: true
                });
            }
            await streamGraphRAGQuery(res, global.graphRAGEngine, query, body);
        } catch (error) {
            log.warn({ event: 'graphrag_stream_error', reason: error?.message }, 'Stream error');
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
        return true;
    }

    // POST /api/graphrag/hyde
    if (pathname === '/api/graphrag/hyde' && req.method === 'POST') {
        const body = await parseBody(req);
        const query = body.query;
        if (!query) {
            jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
            return true;
        }
        if (!textCfg?.provider || !textCfg?.model || !embedCfg?.provider || !embedCfg?.model) {
            jsonResponse(res, { ok: false, error: 'LLM text and embeddings must be configured. Set in Settings > LLM.' }, 400);
            return true;
        }
        try {
            const { getHyDE } = require('../../graphrag');
            const hyde = getHyDE({
                llmProvider: textCfg.provider,
                llmModel: textCfg.model,
                embeddingProvider: embedCfg.provider,
                embeddingModel: embedCfg.model,
                llmConfig: config.llm
            });
            const result = await hyde.generateHyDEEmbedding(query, body);
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graphrag/multihop
    if (pathname === '/api/graphrag/multihop' && req.method === 'POST') {
        const body = await parseBody(req);
        const query = body.query;
        if (!query) {
            jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
            return true;
        }
        if (!textCfg?.provider || !textCfg?.model) {
            jsonResponse(res, { ok: false, error: 'No LLM text provider/model configured. Set in Settings > LLM.' }, 400);
            return true;
        }
        try {
            const { getMultiHopReasoning, GraphRAGEngine } = require('../../graphrag');
            if (!global.graphRAGEngine) {
                global.graphRAGEngine = new GraphRAGEngine({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    llmProvider: textCfg.provider,
                    llmModel: textCfg.model,
                    llmConfig: config.llm
                });
            }
            const multiHop = getMultiHopReasoning({
                llmProvider: textCfg.provider,
                llmModel: textCfg.model,
                llmConfig: config.llm,
                graphProvider: storage.getGraphProvider()
            });
            const retrieveFn = async (q) => {
                const analysis = await global.graphRAGEngine.classifyQuery(q);
                return await global.graphRAGEngine.hybridSearch(q, { queryAnalysis: analysis });
            };
            const result = await multiHop.execute(query, retrieveFn, body);
            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graphrag/communities
    if (pathname === '/api/graphrag/communities' && req.method === 'GET') {
        try {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                jsonResponse(res, { ok: true, communities: [], count: 0 });
                return true;
            }
            const { getCommunityDetection } = require('../../graphrag');
            const community = getCommunityDetection({ graphProvider });
            const result = await community.detectCommunities();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: true, communities: [], count: 0, error: error.message });
        }
        return true;
    }

    // GET /api/graphrag/centrality
    if (pathname === '/api/graphrag/centrality' && req.method === 'GET') {
        try {
            const { getCommunityDetection } = require('../../graphrag');
            const community = getCommunityDetection({ graphProvider: storage.getGraphProvider() });
            const result = await community.calculateCentrality();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graphrag/bridges
    if (pathname === '/api/graphrag/bridges' && req.method === 'GET') {
        try {
            const { getCommunityDetection } = require('../../graphrag');
            const community = getCommunityDetection({ graphProvider: storage.getGraphProvider() });
            const result = await community.findBridgeNodes();
            jsonResponse(res, result);
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graphrag/enhance-query
    if (pathname === '/api/graphrag/enhance-query' && req.method === 'POST') {
        const body = await parseBody(req);
        const query = body.query;
        if (!query) {
            jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
            return true;
        }
        try {
            const { getEmbeddingPrompts } = require('../../graphrag');
            const prompts = getEmbeddingPrompts();
            const enhanced = prompts.enhanceQuery(query, body);
            jsonResponse(res, { ok: true, ...enhanced });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graphrag/prepare-embedding
    if (pathname === '/api/graphrag/prepare-embedding' && req.method === 'POST') {
        const body = await parseBody(req);
        const { entityType, entity } = body;
        if (!entityType || !entity) {
            jsonResponse(res, { ok: false, error: 'entityType and entity are required' }, 400);
            return true;
        }
        try {
            const { getEmbeddingPrompts } = require('../../graphrag');
            const prompts = getEmbeddingPrompts();
            const prepared = prompts.prepareForEmbedding(entityType, entity, {
                views: body.views || ['primary', 'semantic', 'questionBased'],
                language: body.language || 'auto'
            });
            jsonResponse(res, { ok: true, ...prepared });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graphrag/rerank
    if (pathname === '/api/graphrag/rerank' && req.method === 'POST') {
        const body = await parseBody(req);
        const { query, candidates } = body;
        if (!query || !candidates) {
            jsonResponse(res, { ok: false, error: 'Query and candidates are required' }, 400);
            return true;
        }
        if (!textCfg?.provider || !textCfg?.model) {
            jsonResponse(res, { ok: false, error: 'No LLM text provider/model configured. Set in Settings > LLM.' }, 400);
            return true;
        }
        try {
            const { getReranker } = require('../../graphrag');
            const reranker = getReranker({
                llmProvider: textCfg.provider,
                llmModel: textCfg.model,
                llmConfig: config.llm
            });
            const result = await reranker.crossEncoderRerank(query, candidates, body);
            jsonResponse(res, { ok: true, results: result });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graphrag/status
    if (pathname === '/api/graphrag/status' && req.method === 'GET') {
        const projectId = storage.getCurrentProject()?.id;
        if (!projectId) {
            jsonResponse(res, { ok: false, error: 'No active project' }, 400);
            return true;
        }

        const status = global.graphRagSyncStatus?.[projectId] || {
            status: 'idle',
            lastSync: null,
            progress: 0
        };
        jsonResponse(res, { ok: true, ...status });
        return true;
    }

    // POST /api/graphrag/sync or /api/graphrag/resync
    if ((pathname === '/api/graphrag/sync' || pathname === '/api/graphrag/resync') && req.method === 'POST') {
        const projectId = storage.getCurrentProject()?.id;
        if (!projectId) {
            jsonResponse(res, { ok: false, error: 'No active project' }, 400);
            return true;
        }

        const isResync = pathname.endsWith('/resync');

        // Check if already syncing
        if (!global.graphRagSyncStatus) global.graphRagSyncStatus = {};
        if (global.graphRagSyncStatus[projectId]?.status === 'syncing') {
            jsonResponse(res, { ok: false, error: 'Sync already in progress' }, 409);
            return true;
        }

        // Initialize engine if needed
        try {
            const { GraphRAGEngine } = require('../../graphrag');
            if (!global.graphRAGEngine) {
                global.graphRAGEngine = new GraphRAGEngine({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    embeddingProvider: embedCfg?.provider,
                    embeddingModel: embedCfg?.model,
                    llmProvider: textCfg?.provider,
                    llmModel: textCfg?.model,
                    llmConfig: config.llm,
                    enableCache: true
                });
            }

            // Update provider if changed
            if (storage.getGraphProvider() && global.graphRAGEngine.graphProvider !== storage.getGraphProvider()) {
                global.graphRAGEngine.graphProvider = storage.getGraphProvider();
            }
        } catch (e) {
            jsonResponse(res, { ok: false, error: 'Failed to initialize Graph Engine: ' + e.message }, 500);
            return true;
        }

        // Set status
        global.graphRagSyncStatus[projectId] = {
            status: 'syncing',
            startTime: Date.now(),
            progress: 0,
            type: isResync ? 'full' : 'incremental'
        };

        // Start background sync
        (async () => {
            const log = getLogger().child({ module: 'graphrag-sync', projectId });
            try {
                log.info({ event: 'sync_started', type: isResync ? 'full' : 'incremental' }, 'Starting GraphRAG sync');

                // Fetch data
                const [
                    docs, people, teams, sprints, actions, facts, decisions, questions
                ] = await Promise.all([
                    storage.getDocuments(),
                    storage.getPeople(),
                    storage.getTeams ? storage.getTeams() : [],
                    storage.getSprints ? storage.getSprints(projectId) : [],
                    storage.getActions(),
                    storage.getFacts(),
                    storage.getDecisions(),
                    storage.getQuestions()
                ]);

                // Sync
                global.graphRAGEngine.setProjectContext(projectId);
                // Fetch new entities
                const [
                    userStories, risks, emails
                ] = await Promise.all([
                    storage.getUserStories ? storage.getUserStories() : [],
                    storage.getRisks ? storage.getRisks() : [],
                    storage.getEmails ? storage.getEmails() : []
                ]);

                // Get project info for the project node
                const project = await storage.getProject(projectId);

                // Sync
                global.graphRAGEngine.setProjectContext(projectId);
                const result = await global.graphRAGEngine.syncToGraph({
                    project,
                    documents: docs,
                    people,
                    teams,
                    sprints,
                    actions,
                    facts,
                    decisions,
                    questions,
                    userStories,
                    risks,
                    emails
                }, { clear: isResync });

                // Update status
                global.graphRagSyncStatus[projectId] = {
                    status: 'idle',
                    lastSync: Date.now(),
                    lastResult: result,
                    progress: 100
                };
                log.info({ event: 'sync_completed', result }, 'GraphRAG sync completed');

            } catch (err) {
                log.error({ event: 'sync_failed', error: err.message, stack: err.stack }, 'GraphRAG sync failed');
                global.graphRagSyncStatus[projectId] = {
                    status: 'error',
                    error: err.message,
                    lastSync: Date.now(), // to allow retry
                    progress: 0
                };
            }
        })();

        jsonResponse(res, { ok: true, status: 'started' }, 202);
        return true;
    }

    // POST /api/graphrag/query
    if (pathname === '/api/graphrag/query' && req.method === 'POST') {
        const body = await parseBody(req);
        const query = body.query || body.message;
        if (!query) {
            jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
            return true;
        }
        try {
            const { GraphRAGEngine } = require('../../graphrag');
            const { getRequestDedup } = require('../../utils');
            const dedup = getRequestDedup();

            if (!textCfg?.provider || !textCfg?.model) {
                jsonResponse(res, { ok: false, error: 'No LLM text provider/model configured. Set in Settings > LLM.' }, 400);
                return true;
            }
            if (!global.graphRAGEngine) {
                global.graphRAGEngine = new GraphRAGEngine({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    embeddingProvider: embedCfg?.provider,
                    embeddingModel: embedCfg?.model,
                    llmProvider: textCfg.provider,
                    llmModel: textCfg.model,
                    llmConfig: config.llm,
                    enableCache: true
                });
            }

            if (storage.getGraphProvider() && global.graphRAGEngine.graphProvider !== storage.getGraphProvider()) {
                global.graphRAGEngine.graphProvider = storage.getGraphProvider();
            }

            const dedupKey = dedup.getKey('POST', '/api/graphrag/query', query);
            const queryOptions = body.noCache === true ? { noCache: true } : {};

            const result = await dedup.execute(dedupKey, async () => {
                return await global.graphRAGEngine.query(query, queryOptions);
            });

            jsonResponse(res, { ok: true, ...result });
        } catch (error) {
            log.warn({ event: 'graphrag_query_error', reason: error?.message }, 'Query error');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graphrag/sync
    if (pathname === '/api/graphrag/sync' && req.method === 'POST') {
        const body = await parseBody(req).catch(() => ({}));
        const incremental = body.incremental !== false; // Default true

        // 1. Get GraphRAG Engine
        try {
            const { GraphRAGEngine } = require('../../graphrag');
            if (!global.graphRAGEngine) {
                global.graphRAGEngine = new GraphRAGEngine({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    llmConfig: config.llm,
                    enableCache: true
                });
            }
            if (storage.getGraphProvider() && global.graphRAGEngine.graphProvider !== storage.getGraphProvider()) {
                global.graphRAGEngine.graphProvider = storage.getGraphProvider();
            }

            // 2. Fetch all data from storage
            const projectId = storage.getProjectId?.() || storage.currentProjectId;
            if (!projectId) {
                jsonResponse(res, { error: 'Project context required' }, 400);
                return true;
            }

            // Parallel fetch
            const [
                projectData,
                people,
                facts,
                decisions,
                risks,
                actions,
                questions,
                documents,
                sprints,
                emails,
                eventsResponse,
                storiesResponse,
                teamsResponse,
                entityLinksResponse
            ] = await Promise.all([
                storage.getProject ? storage.getProject(projectId) : null,
                storage.getPeople ? storage.getPeople() : [],
                storage.getFacts ? storage.getFacts() : [],
                storage.getDecisions ? storage.getDecisions() : [],
                storage.getRisks ? storage.getRisks() : [],
                storage.getActions ? storage.getActions() : [],
                storage.getQuestions ? storage.getQuestions() : [],
                storage.getDocuments ? storage.getDocuments() : [],
                storage.getSprints ? storage.getSprints(projectId) : [],
                storage.getEmails ? storage.getEmails({ limit: 1000 }) : [], // Recent emails
                storage.supabase.from('calendar_events').select('*, calendar_event_contacts(*)').eq('project_id', projectId),
                storage.supabase.from('stories').select('*').eq('project_id', projectId),
                storage.supabase.from('teams').select('*').eq('project_id', projectId),
                storage.supabase.from('entity_links').select('*').eq('project_id', projectId)
            ]);

            const userStories = storiesResponse.data || [];
            const teams = teamsResponse.data || [];
            const events = eventsResponse.data || [];
            const entityLinks = entityLinksResponse.data || [];

            // 3. Construct data object
            const data = {
                project: projectData,
                people,
                facts,
                decisions,
                risks,
                actions,
                questions,
                documents,
                sprints,
                emails,
                events,
                userStories,
                teams,
                entityLinks
            };

            // 4. Sync
            const result = await global.graphRAGEngine.syncToGraph(data, { incremental });
            jsonResponse(res, result);

        } catch (error) {
            log.warn({ event: 'graphrag_sync_error', reason: error.message }, 'Sync failed');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/graphrag/resync (Full Reset)
    if (pathname === '/api/graphrag/resync' && req.method === 'POST') {
        try {
            const { GraphRAGEngine } = require('../../graphrag');
            if (!global.graphRAGEngine) {
                global.graphRAGEngine = new GraphRAGEngine({
                    graphProvider: storage.getGraphProvider(),
                    storage,
                    llmConfig: config.llm,
                    enableCache: true
                });
            }

            // Reset graph
            await global.graphRAGEngine.graphProvider.deleteGraph(global.graphRAGEngine.graphProvider.currentGraphName);
            await global.graphRAGEngine.graphProvider.createGraph(global.graphRAGEngine.graphProvider.currentGraphName);
            await global.graphRAGEngine.graphProvider.createOntologyIndexes(); // Ensure schema exists

            // Trigger sync (non-incremental)
            // Reuse logic? Or redirect? 
            // Better to copy fetch logic or extract helper. 
            // For now, I'll copy fetch logic to be safe and fast.

            const projectId = storage.getProjectId?.() || storage.currentProjectId;
            const [
                projectData,
                people,
                facts,
                decisions,
                risks,
                actions,
                questions,
                documents,
                sprints,
                emails,
                eventsResponse,
                storiesResponse,
                teamsResponse
            ] = await Promise.all([
                storage.getProject ? storage.getProject(projectId) : null,
                storage.getPeople ? storage.getPeople() : [],
                storage.getFacts ? storage.getFacts() : [],
                storage.getDecisions ? storage.getDecisions() : [],
                storage.getRisks ? storage.getRisks() : [],
                storage.getActions ? storage.getActions() : [],
                storage.getQuestions ? storage.getQuestions() : [],
                storage.getDocuments ? storage.getDocuments() : [],
                storage.getSprints ? storage.getSprints(projectId) : [],
                storage.getEmails ? storage.getEmails({ limit: 1000 }) : [],
                storage.supabase.from('calendar_events').select('*').eq('project_id', projectId),
                storage.supabase.from('stories').select('*').eq('project_id', projectId),
                storage.supabase.from('teams').select('*').eq('project_id', projectId)
            ]);

            const data = {
                project: projectData,
                people,
                facts,
                decisions,
                risks,
                actions,
                questions,
                documents,
                sprints,
                emails,
                events: eventsResponse.data || [],
                userStories: storiesResponse.data || [],
                teams: teamsResponse.data || []
            };

            const result = await global.graphRAGEngine.syncToGraph(data, { incremental: false });
            jsonResponse(res, result);

        } catch (error) {
            log.warn({ event: 'graphrag_resync_error', reason: error.message }, 'Resync failed');
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/graphrag/sync-status
    if (pathname === '/api/graphrag/sync-status' && req.method === 'GET') {
        const graphProvider = storage.getGraphProvider();
        if (graphProvider && typeof graphProvider.getSyncStatus === 'function') {
            const status = await graphProvider.getSyncStatus();
            jsonResponse(res, status);
        } else {
            jsonResponse(res, { status: 'unknown', details: 'Provider not connected or does not support status' });
        }
        return true;
    }

    return false;
}

module.exports = { handleGraphrag, isGraphragRoute };
