/**
 * GraphRAG API
 * Extracted from server.js
 *
 * Handles:
 * - POST /api/graphrag/stream - Stream query via SSE
 * - POST /api/graphrag/hyde - HyDE embeddings
 * - POST /api/graphrag/multihop - Multi-hop reasoning
 * - GET /api/graphrag/communities - Detected communities
 * - GET /api/graphrag/centrality - Node centrality
 * - GET /api/graphrag/bridges - Bridge nodes
 * - POST /api/graphrag/enhance-query - Enhance query for embedding
 * - POST /api/graphrag/prepare-embedding - Prepare entity for embedding
 * - POST /api/graphrag/rerank - Rerank search results
 * - POST /api/graphrag/query - GraphRAG query with deduplication
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

    return false;
}

module.exports = { handleGraphrag, isGraphragRoute };
