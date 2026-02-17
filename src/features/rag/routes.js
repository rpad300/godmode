/**
 * Purpose:
 *   RAG (Retrieval-Augmented Generation) pipeline API. Manages the knowledge base
 *   lifecycle: export, synthesis, embedding generation, semantic search, content
 *   browsing, and Ollama model lifecycle.
 *
 * Responsibilities:
 *   - Export knowledge base and pending questions as Markdown downloads
 *   - Serve knowledge and questions JSON (cached or freshly regenerated)
 *   - Report embedding status and available embedding models
 *   - Regenerate SOURCE_OF_TRUTH.md, PENDING_QUESTIONS.md, and JSON caches
 *   - Synthesize knowledge from documents using LLM reasoning
 *   - Holistic resynthesis with incremental tracking (skip already-processed files)
 *   - Track and clear synthesis state
 *   - Browse processed content files and archived originals (images, PDFs)
 *   - Enrich questions with person assignments
 *   - Unload Ollama models from memory
 *   - Generate vector embeddings (with auto-pull for missing Ollama models)
 *   - Text and semantic (vector similarity) search across knowledge items
 *
 * Key dependencies:
 *   - ctx.processor: knowledge generation, synthesis, content file management
 *   - ctx.storage: knowledge persistence, embedding storage, item retrieval, search
 *   - ctx.llm: embedding generation, model listing/pulling, model unloading
 *   - ../../llm/config: resolve embedding provider/model configuration
 *   - ../../utils/vectorSimilarity: cosine similarity for semantic search
 *
 * Side effects:
 *   - Embedding generation writes to storage (potentially large vectors)
 *   - Synthesis and resynthesis invoke LLM and mutate storage facts/people
 *   - Regeneration overwrites Markdown and JSON files on disk
 *   - Model unload releases GPU/memory on the Ollama server
 *   - Archived file serving streams binary files directly to the response
 *
 * Notes:
 *   - Archived file access is path-traversal protected via path.normalize check
 *   - Content file metadata is parsed from YAML frontmatter (--- delimited)
 *   - Embedding batch size is 10 items per LLM call (vs 20 in processing routes)
 *   - Semantic search requires embeddings to be pre-generated; falls back to text search
 *   - The /api/models/unload endpoint lives here because it relates to the RAG pipeline
 *
 * Routes:
 *   GET    /api/export/knowledge            - Download knowledge-base.md
 *   GET    /api/export/questions             - Download pending-questions.md
 *   GET    /api/knowledge/json              - Knowledge JSON (query: ?refresh=true)
 *   GET    /api/knowledge/questions          - Questions JSON (query: ?refresh=true)
 *   GET    /api/knowledge/status             - Embedding status + available models
 *   POST   /api/knowledge/regenerate         - Regenerate all Markdown and JSON files
 *   POST   /api/knowledge/synthesize         - Run LLM knowledge synthesis
 *   GET    /api/knowledge/synthesis-status   - File-level synthesis tracking
 *   GET    /api/content                      - List processed content files
 *   GET    /api/content/:sourceName          - Single content file with metadata
 *   GET    /api/archived/:filename           - Serve original archived file (binary)
 *   POST   /api/knowledge/resynthesis        - Holistic resynthesis (incremental)
 *   DELETE /api/knowledge/synthesis-tracking  - Clear synthesis tracking
 *   POST   /api/questions/enrich             - Assign people to questions
 *   POST   /api/models/unload               - Unload Ollama models from memory
 *   POST   /api/knowledge/embed             - Generate and save embeddings
 *   GET    /api/knowledge/search            - Text or semantic search (query: ?q=&semantic=true)
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logError } = require('../../logger');

async function pathExists(p) {
    try { await fsp.access(p); return true; } catch { return false; }
}
const { jsonResponse } = require('../../server/response');

function isRagRoute(pathname) {
    return pathname === '/api/export/knowledge' || pathname === '/api/export/questions' ||
           pathname.startsWith('/api/knowledge/') || pathname === '/api/content' ||
           pathname.startsWith('/api/content/') || pathname.startsWith('/api/archived/') ||
           pathname === '/api/questions/enrich' || pathname === '/api/models/unload';
}

async function handleRag(ctx) {
    const { req, res, pathname, storage, config, processor, llm, invalidateBriefingCache } = ctx;
    const llmConfig = require('../../llm/config');
    const vectorSimilarity = require('../../utils/vectorSimilarity');
    const log = getLogger().child({ module: 'rag' });
    if (!isRagRoute(pathname)) return false;

    // GET /api/export/knowledge
    if (pathname === '/api/export/knowledge' && req.method === 'GET') {
        const md = processor.generateKnowledgeBase();
        res.writeHead(200, {
            'Content-Type': 'text/markdown',
            'Content-Disposition': 'attachment; filename="knowledge-base.md"'
        });
        res.end(md);
        return true;
    }

    // GET /api/export/questions
    if (pathname === '/api/export/questions' && req.method === 'GET') {
        const md = processor.generateQuestionsMarkdown();
        res.writeHead(200, {
            'Content-Type': 'text/markdown',
            'Content-Disposition': 'attachment; filename="pending-questions.md"'
        });
        res.end(md);
        return true;
    }

    // GET /api/knowledge/json
    if (pathname === '/api/knowledge/json' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const refresh = parsedUrl.query.refresh === 'true';
        let knowledge;
        if (refresh) {
            knowledge = storage.saveKnowledgeJSON();
        } else {
            knowledge = storage.loadKnowledgeJSON() || storage.saveKnowledgeJSON();
        }
        jsonResponse(res, knowledge);
        return true;
    }

    // GET /api/knowledge/questions
    if (pathname === '/api/knowledge/questions' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const refresh = parsedUrl.query.refresh === 'true';
        let questions;
        if (refresh) {
            questions = storage.saveQuestionsJSON();
        } else {
            questions = storage.loadQuestionsJSON() || storage.saveQuestionsJSON();
        }
        jsonResponse(res, questions);
        return true;
    }

    // GET /api/knowledge/status
    if (pathname === '/api/knowledge/status' && req.method === 'GET') {
        const status = storage.getEmbeddingStatus();
        const embedCfg = llmConfig.getEmbeddingsConfig(config);
        const embedProvider = embedCfg?.provider;
        const providerConfig = embedCfg?.providerConfig || {};
        let embeddingModels = [];
        try {
            if (embedProvider) {
                const list = await llm.listModels(embedProvider, providerConfig);
                embeddingModels = (list.embeddingModels || []).map(m => (typeof m === 'string' ? m : m.name));
            }
        } catch (_) { /* ignore */ }
        jsonResponse(res, {
            ...status,
            available_embedding_models: embeddingModels
        });
        return true;
    }

    // POST /api/knowledge/regenerate
    if (pathname === '/api/knowledge/regenerate' && req.method === 'POST') {
        log.info({ event: 'rag_regenerate' }, 'Manually regenerating SOURCE_OF_TRUTH.md and PENDING_QUESTIONS.md');
        storage.regenerateMarkdown();
        storage.saveKnowledgeJSON();
        storage.saveQuestionsJSON();
        storage.invalidateRAGCache();
        jsonResponse(res, {
            success: true,
            message: 'Markdown files regenerated from database',
            files: ['SOURCE_OF_TRUTH.md', 'PENDING_QUESTIONS.md', 'knowledge.json', 'questions_rag.json']
        });
        return true;
    }

    // POST /api/knowledge/synthesize
    if (pathname === '/api/knowledge/synthesize' && req.method === 'POST') {
        const body = await parseBody(req);
        const reasoningModel = body.model || config.ollama?.reasoningModel || config.ollama?.model || 'qwen3:30b';
        log.debug({ event: 'rag_synthesis_start', reasoningModel }, 'Starting knowledge synthesis');
        try {
            const result = await processor.synthesizeKnowledge(reasoningModel, (progress, message) => {
                log.debug({ event: 'rag_synthesis_progress', progress, message }, 'Synthesis progress');
            });
            jsonResponse(res, {
                success: result.success,
                message: result.message || 'Knowledge synthesis complete',
                stats: result.stats
            });
        } catch (error) {
            log.warn({ event: 'rag_synthesis_error', reason: error?.message }, 'Synthesis error');
            jsonResponse(res, { success: false, error: error.message || 'Synthesis failed' }, 500);
        }
        return true;
    }

    // GET /api/knowledge/synthesis-status
    if (pathname === '/api/knowledge/synthesis-status' && req.method === 'GET') {
        const tracking = processor.loadSynthesizedFiles();
        const allFiles = processor.getContentFiles();
        const newFiles = processor.getNewContentFiles();
        jsonResponse(res, {
            success: true,
            totalContentFiles: allFiles.length,
            synthesizedFiles: Object.keys(tracking.files).length,
            pendingFiles: newFiles.length,
            lastSynthesis: tracking.last_synthesis,
            files: {
                synthesized: Object.entries(tracking.files).map(([name, data]) => ({
                    name,
                    synthesized_at: data.synthesized_at,
                    size: data.size
                })),
                pending: newFiles.map(f => f.name)
            }
        });
        return true;
    }

    // GET /api/content
    if (pathname === '/api/content' && req.method === 'GET') {
        const contentFiles = processor.getContentFiles();
        jsonResponse(res, {
            success: true,
            sources: contentFiles.map(f => ({
                name: f.name.replace(/\.md$/, ''),
                file: f.name,
                size: f.size,
                modified: f.mtime
            }))
        });
        return true;
    }

    // GET /api/content/:sourceName
    if (pathname.startsWith('/api/content/') && req.method === 'GET') {
        const sourceName = decodeURIComponent(pathname.replace('/api/content/', ''));
        const contentDir = path.join(config.dataDir, 'content');
        const archivedDir = path.join(config.dataDir, 'archived', 'documents');

        const possibleFiles = [
            path.join(contentDir, `${sourceName}.md`),
            path.join(contentDir, `${sourceName}`),
            path.join(contentDir, sourceName.replace(/\.(jpg|png|pdf|pptx?)$/i, '.md'))
        ];

        let content = null;
        let foundFile = null;

        for (const filePath of possibleFiles) {
            if (await pathExists(filePath)) {
                content = await fsp.readFile(filePath, 'utf-8');
                foundFile = path.basename(filePath);
                break;
            }
        }

        let rawFile = null;
        let rawFileUrl = null;
        if (await pathExists(archivedDir)) {
            const archivedFiles = await fsp.readdir(archivedDir);
            const sourceBaseName = sourceName.replace(/\.(md|txt)$/i, '');
            const matchingFile = archivedFiles.find(f => {
                const withoutDate = f.replace(/^\d{4}-\d{2}-\d{2}_/, '');
                const withoutExt = withoutDate.replace(/\.[^.]+$/, '');
                return withoutExt.toLowerCase() === sourceBaseName.toLowerCase();
            });
            if (matchingFile) {
                rawFile = matchingFile;
                rawFileUrl = `/api/archived/${encodeURIComponent(matchingFile)}`;
            }
        }

        if (content || rawFile) {
            let metadata = {};
            let bodyContent = content || '';

            if (content && content.startsWith('---')) {
                const parts = content.split('---');
                if (parts.length >= 3) {
                    const frontMatter = parts[1].trim();
                    bodyContent = parts.slice(2).join('---').trim();
                    frontMatter.split('\n').forEach(line => {
                        const colonIdx = line.indexOf(':');
                        if (colonIdx > 0) {
                            const key = line.substring(0, colonIdx).trim();
                            const value = line.substring(colonIdx + 1).trim();
                            metadata[key] = value;
                        }
                    });
                }
            }

            jsonResponse(res, {
                success: true,
                source: sourceName,
                file: foundFile,
                metadata,
                content: bodyContent,
                rawFile,
                rawFileUrl
            });
        } else {
            jsonResponse(res, { success: false, error: `Source "${sourceName}" not found` }, 404);
        }
        return true;
    }

    // GET /api/archived/:filename
    if (pathname.startsWith('/api/archived/') && req.method === 'GET') {
        const filename = decodeURIComponent(pathname.replace('/api/archived/', ''));
        const archivedDir = path.join(config.dataDir, 'archived', 'documents');
        const filePath = path.join(archivedDir, filename);

        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(path.normalize(archivedDir))) {
            jsonResponse(res, { success: false, error: 'Invalid path' }, 403);
            return true;
        }

        if (await pathExists(filePath)) {
            const ext = path.extname(filename).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.pdf': 'application/pdf', '.webp': 'image/webp'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        } else {
            jsonResponse(res, { success: false, error: 'File not found' }, 404);
        }
        return true;
    }

    // POST /api/knowledge/resynthesis
    if (pathname === '/api/knowledge/resynthesis' && req.method === 'POST') {
        const body = await parseBody(req);
        const reasoningModel = body.model || config.ollama?.reasoningModel || config.ollama?.model || 'qwen3:30b';
        const force = body.force === true;
        const requestProvider = body.provider;

        log.debug({ event: 'rag_resynthesis_start', force: !!force, reasoningModel, provider: requestProvider || 'default' }, 'Starting resynthesis');

        if (requestProvider) {
            processor.config.llm = processor.config.llm || {};
            processor.config.llm.perTask = processor.config.llm.perTask || {};
            processor.config.llm.perTask.text = processor.config.llm.perTask.text || {};
            processor.config.llm.perTask.text.provider = requestProvider;
            processor.config.llm.provider = requestProvider;
        }

        try {
            const result = await processor.holisticSynthesis(reasoningModel, force);
            invalidateBriefingCache();
            jsonResponse(res, {
                success: result.success,
                message: result.skipped
                    ? 'No new content to synthesize - all files already processed'
                    : `Resynthesis complete: ${result.stats?.factsAdded || 0} facts, ${result.stats?.peopleAdded || 0} people`,
                skipped: result.skipped || false,
                stats: result.stats
            });
        } catch (error) {
            log.warn({ event: 'rag_resynthesis_error', reason: error?.message }, 'Resynthesis error');
            jsonResponse(res, { success: false, error: error.message || 'Resynthesis failed' }, 500);
        }
        return true;
    }

    // DELETE /api/knowledge/synthesis-tracking
    if (pathname === '/api/knowledge/synthesis-tracking' && req.method === 'DELETE') {
        processor.clearSynthesisTracking();
        jsonResponse(res, {
            success: true,
            message: 'Synthesis tracking cleared - next synthesis will process all content files'
        });
        return true;
    }

    // POST /api/questions/enrich
    if (pathname === '/api/questions/enrich' && req.method === 'POST') {
        try {
            await processor.enrichQuestionsWithPeople();
            const questions = storage.getQuestions();
            const assigned = questions.filter(q => q.assigned_to && q.assigned_to.length > 2);
            jsonResponse(res, {
                success: true,
                message: 'Enriched questions with person assignments',
                stats: {
                    totalQuestions: questions.length,
                    assignedQuestions: assigned.length,
                    unassignedQuestions: questions.length - assigned.length
                }
            });
        } catch (error) {
            log.warn({ event: 'rag_enrichment_error', reason: error?.message }, 'Enrichment error');
            jsonResponse(res, { success: false, error: error.message || 'Enrichment failed' }, 500);
        }
        return true;
    }

    // POST /api/models/unload
    if (pathname === '/api/models/unload' && req.method === 'POST') {
        const body = await parseBody(req);
        let modelsToUnload = body.models || [];

        if (modelsToUnload.length === 0) {
            if (config.llm?.perTask?.text?.provider === 'ollama' && config.llm?.perTask?.text?.model) {
                modelsToUnload.push(config.llm.perTask.text.model);
            }
            if (config.llm?.perTask?.vision?.provider === 'ollama' && config.llm?.perTask?.vision?.model) {
                modelsToUnload.push(config.llm.perTask.vision.model);
            }
            if (config.llm?.perTask?.embeddings?.provider === 'ollama' && config.llm?.perTask?.embeddings?.model) {
                modelsToUnload.push(config.llm.perTask.embeddings.model);
            }
            if (config.ollama?.model) modelsToUnload.push(config.ollama.model);
            if (config.ollama?.visionModel) modelsToUnload.push(config.ollama.visionModel);
            if (config.ollama?.reasoningModel && config.ollama.reasoningModel !== config.ollama.model) {
                modelsToUnload.push(config.ollama.reasoningModel);
            }
        }

        if (modelsToUnload.length === 0) {
            jsonResponse(res, { success: false, error: 'No models specified or configured to unload' });
            return true;
        }

        modelsToUnload = [...new Set(modelsToUnload)];
        log.debug({ event: 'rag_models_unload', models: modelsToUnload }, 'Unloading models');
        try {
            const ollamaConfig = llmConfig.getLLMConfig(config).getProviderConfig('ollama') || config.llm?.providers?.ollama || {};
            const result = await llm.unloadModels('ollama', modelsToUnload, ollamaConfig);
            jsonResponse(res, {
                success: result.success,
                unloaded: result.unloaded || [],
                errors: result.errors || {},
                message: (result.unloaded?.length > 0) ? `Unloaded: ${result.unloaded.join(', ')}` : 'No models were unloaded'
            });
        } catch (error) {
            log.warn({ event: 'rag_model_unload_error', reason: error?.message }, 'Model unload error');
            jsonResponse(res, { success: false, error: error.message || 'Failed to unload models' }, 500);
        }
        return true;
    }

    // POST /api/knowledge/embed
    if (pathname === '/api/knowledge/embed' && req.method === 'POST') {
        const body = await parseBody(req);
        const embedCfg = llmConfig.getEmbeddingsConfig(config, body.model ? { model: body.model } : {});
        const model = body.model || embedCfg?.model || 'mxbai-embed-large';
        const embedProvider = embedCfg?.provider;
        const embedProviderConfig = embedCfg?.providerConfig || {};
        if (!embedProvider || !model) {
            jsonResponse(res, { success: false, error: 'No embeddings provider/model configured. Set in Settings > LLM.' }, 400);
            return true;
        }
        log.debug({ event: 'rag_embed_start', embedProvider, model }, 'Starting embedding generation');
        if (embedProvider === 'ollama') {
            const list = await llm.listModels('ollama', embedProviderConfig);
            const allNames = [...(list.textModels || []), ...(list.visionModels || []), ...(list.embeddingModels || [])]
                .map(m => (m && m.name) || m);
            const modelExists = allNames.some(name => name === model || String(name).startsWith(model + ':'));

            if (!modelExists) {
                log.debug({ event: 'rag_embed_model_pull', model }, 'Embedding model not found, auto-pulling');
                const pullResult = await llm.pullModel('ollama', model, embedProviderConfig, (progress) => {
                    if (progress && progress.percent) log.debug({ event: 'rag_embed_pull_progress', model, percent: progress.percent }, 'Pulling model');
                });
                if (!pullResult.success) {
                    jsonResponse(res, {
                        success: false,
                        error: `Failed to download embedding model ${model}: ${pullResult.error}`
                    });
                    return true;
                }
                log.debug({ event: 'rag_embed_pull_done', model }, 'Embedding model pulled successfully');
            }
        }

        storage.saveKnowledgeJSON();
        storage.saveQuestionsJSON();
        const items = storage.getAllItemsForEmbedding();

        if (items.length === 0) {
            jsonResponse(res, { success: false, error: 'No items to embed. Process some documents first.' });
            return true;
        }

        log.debug({ event: 'rag_embed_generate', itemCount: items.length, embedProvider }, 'Generating embeddings');
        const texts = items.map(item => item.text);
        const batchSize = 10;
        const allEmbeddings = [];
        const errors = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const progress = Math.round(((i + batch.length) / texts.length) * 100);
            log.debug({ event: 'rag_embed_progress', progress, current: i + batch.length, total: texts.length }, 'Embedding progress');

            const result = await llm.embed({
                provider: embedProvider,
                providerConfig: embedProviderConfig,
                model,
                texts: batch
            });

            if (result.success && result.embeddings) {
                allEmbeddings.push(...result.embeddings);
            } else {
                for (let j = 0; j < batch.length; j++) {
                    allEmbeddings.push(null);
                    errors.push({ index: i + j, error: result.error });
                }
            }
        }

        if (allEmbeddings.every(e => e === null)) {
            jsonResponse(res, {
                success: false,
                error: 'Failed to generate embeddings. Check if embedding model is available.',
                details: errors[0]?.error
            });
            return true;
        }

        const embeddings = items.map((item, idx) => ({
            id: item.id,
            type: item.type,
            text: item.text,
            embedding: allEmbeddings[idx]
        }));
        embeddings.model = model;
        embeddings.provider = embedProvider;
        storage.saveEmbeddings(embeddings);

        log.debug({ event: 'rag_embed_done', count: embeddings.filter(e => e.embedding).length }, 'Embeddings generated and saved');
        jsonResponse(res, {
            success: true,
            count: embeddings.filter(e => e.embedding).length,
            model,
            provider: embedProvider,
            errors: errors.length > 0 ? errors : undefined
        });
        return true;
    }

    // GET /api/knowledge/search
    if (pathname === '/api/knowledge/search' && req.method === 'GET') {
        const parsedUrl = parseUrl(req.url);
        const query = parsedUrl.query.q || '';
        const semantic = parsedUrl.query.semantic === 'true';
        const topK = parseInt(parsedUrl.query.limit) || 10;
        const types = parsedUrl.query.types ? parsedUrl.query.types.split(',') : null;

        if (!query || query.length < 2) {
            jsonResponse(res, { error: 'Query must be at least 2 characters', results: [] });
            return true;
        }

        if (semantic) {
            const embeddingsData = storage.loadEmbeddings();
            if (!embeddingsData || !embeddingsData.embeddings?.length) {
                jsonResponse(res, {
                    error: 'No embeddings found. Run /api/knowledge/embed first.',
                    results: [],
                    fallback_text: true
                });
                return true;
            }

            const embedCfgSearch = llmConfig.getEmbeddingsConfig(config);
            const embedModel = embeddingsData.model || embedCfgSearch?.model || 'mxbai-embed-large';
            const embedProvider = embedCfgSearch?.provider;
            const embedProviderConfig = embedCfgSearch?.providerConfig || {};
            if (!embedProvider || !embedModel) {
                jsonResponse(res, { error: 'No embeddings configured. Set in Settings > LLM.', results: [], fallback_text: true });
                return true;
            }
            const queryResult = await llm.embed({
                provider: embedProvider,
                providerConfig: embedProviderConfig,
                model: embedModel,
                texts: [query]
            });

            if (!queryResult.success || !queryResult.embeddings?.[0]) {
                jsonResponse(res, {
                    error: 'Failed to generate query embedding: ' + (queryResult.error || 'No embedding returned'),
                    results: []
                });
                return true;
            }

            queryResult.embedding = queryResult.embeddings[0];
            const itemsWithEmbeddings = embeddingsData.embeddings
                .filter(e => e.embedding && (!types || types.includes(e.type)));
            const similar = vectorSimilarity.findSimilar(queryResult.embedding, itemsWithEmbeddings, topK);

            const resultIds = similar.map(s => s.id);
            const items = storage.getItemsByIds(resultIds);
            const results = similar.map(s => {
                const item = items.find(i => i.id === s.id);
                return { ...item, similarity: s.similarity };
            });

            jsonResponse(res, {
                query,
                semantic: true,
                model: embedModel,
                total: results.length,
                results
            });
        } else {
            const textResults = storage.search(query, { types, limit: topK });
            jsonResponse(res, { query, semantic: false, ...textResults });
        }
        return true;
    }

    return false;
}

module.exports = { handleRag, isRagRoute };
