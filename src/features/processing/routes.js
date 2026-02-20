/**
 * Purpose:
 *   Document processing pipeline API. Triggers the Content-First Architecture
 *   processing flow, provides status polling and real-time SSE progress updates.
 *
 * Responsibilities:
 *   - Start async document processing (text + vision models)
 *   - Post-processing: invalidate caches, rebuild RAG index, regenerate markdown,
 *     generate embeddings in batches, and persist to storage
 *   - Expose current processing state for polling
 *   - Stream processing state changes via Server-Sent Events
 *
 * Key dependencies:
 *   - ctx.processor: content processing engine (processAllContentFirst, getState)
 *   - ctx.llm: embedding generation and model listing/pulling
 *   - ../../llm/config: resolve text and embedding provider/model
 *   - ctx.storage: knowledge persistence, RAG cache, and embedding storage
 *   - ctx.invalidateBriefingCache: cache invalidation callback
 *
 * Side effects:
 *   - Processing runs asynchronously after returning HTTP 200 (fire-and-forget)
 *   - Writes embeddings to storage on completion
 *   - May auto-pull Ollama embedding models if not already available
 *   - Invalidates briefing and RAG caches
 *   - Regenerates SOURCE_OF_TRUTH.md and knowledge JSON files
 *
 * Notes:
 *   - POST /api/process returns immediately with "started"; use /status or /stream to track
 *   - The SSE stream sends processor state every 1 second until the client disconnects
 *   - Embedding generation uses a batch size of 20 items per LLM call
 *   - If the embedding model does not exist on Ollama, it is auto-pulled before embedding
 *
 * Routes:
 *   POST /api/process        - Start async document processing
 *     Body: { provider?, model? } | Resp: { status: "started", message }
 *
 *   GET  /api/process/status  - Current processing state (JSON snapshot)
 *
 *   GET  /api/process/stream  - SSE stream of processing state (text/event-stream)
 */

const { parseBody } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { jsonResponse } = require('../../server/response');

async function handleProcessing(ctx) {
    const { req, res, pathname, processor, storage, config, llm, invalidateBriefingCache } = ctx;
    const log = getLogger().child({ module: 'processing' });

    // POST /api/process - Start processing
    if (pathname === '/api/process' && req.method === 'POST') {
        const llmConfig = require('../../llm/config');
        const body = await parseBody(req);
        const requestProvider = body.provider;
        const processTextCfg = llmConfig.getTextConfig(config, { provider: requestProvider });
        const effectiveProvider = processTextCfg.provider;
        const textModel = body.model || config.llm?.perTask?.text?.model || config.llm?.models?.text || config.ollama?.model || 'auto';
        const visionModel = config.llm?.perTask?.vision?.model || config.llm?.models?.vision || config.ollama?.visionModel || null;

        log.debug({ event: 'processing_start', effectiveProvider, textModel, visionModel }, 'Using provider and models');

        if (requestProvider) {
            processor.config.llm = processor.config.llm || {};
            processor.config.llm.perTask = processor.config.llm.perTask || {};
            processor.config.llm.perTask.text = processor.config.llm.perTask.text || {};
            processor.config.llm.perTask.text.provider = requestProvider;
            processor.config.llm.provider = requestProvider;
        }

        const currentProject = storage.getCurrentProject();
        const userRole = currentProject?.userRole || '';

        processor.processAllContentFirst(textModel, visionModel, userRole).then(async (result) => {
            log.debug({ event: 'processing_complete', success: result?.success }, 'Processing complete');
            invalidateBriefingCache();
            const processed = result.phase1?.processed || 0;
            if (processed > 0) {
                storage.invalidateRAGCache();
                storage.regenerateMarkdown();
                const DEFAULT_EMBED_MODEL = 'mxbai-embed-large';
                const embedCfgForList = llmConfig.getEmbeddingsConfig(config);
                const list = await llm.listModels(embedCfgForList.provider, embedCfgForList.providerConfig || {}).catch(() => ({ embeddingModels: [] }));
                const embeddingModels = list.embeddingModels || [];
                const embedModelNames = embeddingModels.map(m => (m && m.name) || m);
                let embedModel = embedModelNames.length > 0 ? embedModelNames[0] : DEFAULT_EMBED_MODEL;
                if (embedModelNames.length === 0 && embedCfgForList.provider === 'ollama') {
                    const pullResult = await llm.pullModel('ollama', DEFAULT_EMBED_MODEL, embedCfgForList.providerConfig || {}, () => {});
                    if (pullResult.success) embedModel = DEFAULT_EMBED_MODEL;
                    else return;
                }
                storage.saveKnowledgeJSON();
                storage.saveQuestionsJSON();
                const items = storage.getAllItemsForEmbedding();
                if (items.length > 0) {
                    const texts = items.map(item => item.text);
                    const embedCfg = llmConfig.getEmbeddingsConfig(config);
                    const batchSize = 20;
                    const allEmbeddings = [];
                    for (let i = 0; i < texts.length; i += batchSize) {
                        const batch = texts.slice(i, i + batchSize);
                        const embedResult = await llm.embed({
                            provider: embedCfg.provider,
                            providerConfig: embedCfg.providerConfig,
                            model: embedModel,
                            texts: batch
                        });
                        if (embedResult.success && embedResult.embeddings) allEmbeddings.push(...embedResult.embeddings);
                        else allEmbeddings.push(...batch.map(() => null));
                    }
                    if (allEmbeddings.some(e => e !== null)) {
                        const embeddings = items.map((item, idx) => ({ id: item.id, type: item.type, text: item.text, embedding: allEmbeddings[idx] }));
                        embeddings.model = embedModel;
                        storage.saveEmbeddings(embeddings);
                        log.debug({ event: 'processing_rag_rebuilt', count: embeddings.length }, 'RAG index rebuilt');
                    }
                }
            }
        }).catch(err => {
            log.warn({ event: 'processing_pipeline_error', error: err?.message }, 'Background processing failed');
        });

        jsonResponse(res, { status: 'started', message: `Processing started (text: ${textModel}, vision: ${visionModel || 'auto'})` });
        return true;
    }

    // GET /api/process/status
    if (pathname === '/api/process/status' && req.method === 'GET') {
        if (processor && typeof processor.getState === 'function') {
            jsonResponse(res, processor.getState());
        } else {
            jsonResponse(res, { status: 'idle', progress: 0, totalFiles: 0, processedFiles: 0 });
        }
        return true;
    }

    // GET /api/process/stream - SSE stream
    if (pathname === '/api/process/stream' && req.method === 'GET') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        let intervalId;
        const sendState = () => {
            try {
                res.write(`data: ${JSON.stringify(processor.getState())}\n\n`);
            } catch (err) {
                if (intervalId) clearInterval(intervalId);
            }
        };
        sendState();
        intervalId = setInterval(sendState, 1000);
        req.on('close', () => clearInterval(intervalId));
        return true;
    }

    return false;
}

module.exports = { handleProcessing };
