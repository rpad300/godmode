/**
 * Purpose:
 *   LLM provider management, queue operations, token budgeting, routing, and
 *   Ollama-specific model management (test, list, pull).
 *
 * Responsibilities:
 *   - List available LLM providers and their capabilities
 *   - Test connectivity to any configured provider (apiKey resolved from Supabase/env)
 *   - List and enrich model metadata (context window, pricing, capabilities)
 *   - Token estimation and per-model token policy configuration
 *   - LLM request queue management: status, history, pending, retryable, pause/resume, clear
 *   - Intelligent routing: status, reset health, per-task routing config
 *   - Preflight tests for LLM configuration
 *   - Ollama: test connection, list categorized models, recommended models, pull/download
 *
 * Key dependencies:
 *   - ../../llm/config: resolve provider/model for text and embeddings
 *   - ../../llm/modelMetadata: enriched model metadata and caching
 *   - ../../llm/tokenBudget: token estimation and budget policies
 *   - ../../llm/router: intelligent routing and per-task model mapping
 *   - ../../llm/healthRegistry: provider health tracking and reset
 *   - ../../llm/queue: persistent LLM request queue with retry logic
 *   - ../../supabase/secrets: load API keys from encrypted Supabase secrets
 *   - ctx.llm: LLM client facade (testConnection, listModels, getClient, pullModel)
 *
 * Side effects:
 *   - Writes token policy and routing config to local config file via saveConfig
 *   - Queue operations mutate persistent queue state (Supabase-backed)
 *   - Provider health reset clears in-memory circuit breaker state
 *   - Ollama pull downloads models to the Ollama server
 *
 * Notes:
 *   - API key resolution order: request body > local config > Supabase secrets > env vars
 *   - Provider passwords/keys are never returned to the client
 *   - Model metadata cache is cleared after fetching fresh model lists
 *   - Helper functions loadApiKeyFromSupabase and getApiKeyFromEnv are module-private
 *
 * Routes (summary):
 *   GET  /api/llm/providers             - Supported providers with enabled status
 *   GET  /api/llm/queue/status          - Queue stats and current processing item
 *   GET  /api/llm/queue/history         - Recent queue execution history
 *   GET  /api/llm/queue/pending         - Pending queue items
 *   GET  /api/llm/queue/retryable       - Failed items eligible for retry
 *   POST /api/llm/queue/retry/:id       - Retry a specific failed item
 *   POST /api/llm/queue/retry-all       - Retry all retryable items
 *   POST /api/llm/queue/cancel/:id      - Cancel a pending item
 *   POST /api/llm/queue/clear           - Clear queue by status
 *   POST /api/llm/queue/pause           - Pause queue processing
 *   POST /api/llm/queue/resume          - Resume queue processing
 *   POST /api/llm/queue/config          - Update queue configuration
 *   POST /api/llm/test/:provider        - Test provider connection (provider in URL)
 *   POST /api/llm/test                  - Test provider connection (provider in body)
 *   GET  /api/llm/models                - List models with enriched metadata
 *   GET  /api/llm/capabilities          - Provider capability matrix
 *   GET  /api/llm/model-info            - Single model metadata lookup
 *   POST /api/llm/token-estimate        - Estimate tokens for a request
 *   POST /api/llm/token-policy          - Update token budget policy
 *   GET  /api/llm/routing/status        - Routing status and provider health
 *   POST /api/llm/routing/reset         - Reset provider health counters
 *   POST /api/llm/routing/config        - Update routing mode and task mapping
 *   POST /api/llm/preflight             - Run LLM preflight diagnostics
 *   GET  /api/ollama/test               - Test Ollama connectivity
 *   GET  /api/ollama/models             - Categorized Ollama models (text, vision)
 *   GET  /api/ollama/recommended        - Recommended models with install status
 *   POST /api/ollama/pull               - Download/pull an Ollama model
 */

const { parseBody, parseUrl } = require('../../server/request');
const { getLogger } = require('../../server/requestContext');
const { logger: rootLogger, logError } = require('../../logger');
const { jsonResponse } = require('../../server/response');
const moduleLog = rootLogger.child({ module: 'llm' });

/**
 * Handle LLM and Ollama routes
 * @param {object} ctx - Context object
 * @returns {Promise<boolean>} - true if handled
 */
async function handleLlm(ctx) {
    const { req, res, pathname, config, saveConfig, llm, supabase } = ctx;

    function getOllamaConfig() {
        return config.llm?.providers?.ollama || {
            host: config.ollama?.host || '127.0.0.1',
            port: config.ollama?.port || 11434
        };
    }
    
    // Only handle /api/llm/* and /api/ollama/* routes
    if (!pathname.startsWith('/api/llm/') && !pathname.startsWith('/api/ollama/')) {
        return false;
    }

    // Lazy load modules to avoid circular dependencies
    const llmConfig = require('../../llm/config');
    const modelMetadata = require('../../llm/modelMetadata');
    const tokenBudget = require('../../llm/tokenBudget');
    const llmRouter = require('../../llm/router');
    const healthRegistry = require('../../llm/healthRegistry');

    // ==================== LLM Provider API ====================

    // GET /api/llm/providers - Get list of supported providers with capabilities (frontend-compatible shape)
    if (pathname === '/api/llm/providers' && req.method === 'GET') {
        const raw = llm.getProviders();
        const providerConfigs = config?.llm?.providers || {};

        // Check Supabase secrets for which providers have keys configured
        let secretStatus = {};
        try {
            const secrets = require('../../supabase/secrets');
            for (const p of raw) {
                if (p.id !== 'ollama') {
                    const result = await secrets.getProviderApiKey(p.id, null);
                    secretStatus[p.id] = result.success;
                }
            }
        } catch (_) { /* Supabase not available */ }

        const providers = raw.map(p => ({
            id: p.id,
            name: p.label || p.name || p.id,
            enabled: p.id === 'ollama' ? !!(providerConfigs.ollama?.host || config?.ollama?.host) : !!(secretStatus[p.id]),
            models: Array.isArray(p.models) ? p.models : [],
            capabilities: p.capabilities || {}
        }));
        jsonResponse(res, { providers });
        return true;
    }

    // ==================== LLM Queue API ====================
    
    // GET /api/llm/queue/status - Get queue status and stats
    if (pathname === '/api/llm/queue/status' && req.method === 'GET') {
        const { getStatus } = require('../../llm/queue');
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const projectId = queryParams.get('projectId') || null;
        
        try {
            const status = await getStatus(projectId);
            
            // Format for frontend compatibility
            jsonResponse(res, {
                isProcessing: status.processing !== null,
                isPaused: status.isPaused,
                queueLength: status.queueSize + (status.database?.pendingCount || 0),
                currentRequest: status.processing ? {
                    id: status.processing.id,
                    context: status.processing.context,
                    priority: status.processing.priority || 'normal',
                    startedAt: new Date(status.processing.startedAt).toISOString()
                } : null,
                stats: {
                    total: status.stats.totalProcessed + (status.stats.dbCompletedToday || 0),
                    successful: status.stats.totalProcessed,
                    failed: status.stats.totalFailed + (status.stats.dbFailedToday || 0),
                    avgProcessingTime: status.stats.dbAvgProcessingTime || status.stats.avgProcessingTime
                },
                pendingItems: status.pending.map(p => ({
                    id: p.dbId || p.id,
                    context: p.context,
                    priority: p.priorityLabel || 'normal',
                    queuedAt: new Date(Date.now() - p.waitTime).toISOString()
                })),
                database: status.database || null
            });
        } catch (error) {
            log.warn({ event: 'llm_queue_status_error', reason: error?.message }, 'Queue status error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/llm/queue/history - Get recent queue history
    if (pathname === '/api/llm/queue/history' && req.method === 'GET') {
        const { getHistory } = require('../../llm/queue');
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const limit = parseInt(queryParams.get('limit') || '50', 10);
        const projectId = queryParams.get('projectId') || null;
        
        try {
            const history = await getHistory(limit, projectId);
            jsonResponse(res, { history });
        } catch (error) {
            log.warn({ event: 'llm_queue_history_error', reason: error?.message }, 'Queue history error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/llm/queue/pending - Get pending items
    if (pathname === '/api/llm/queue/pending' && req.method === 'GET') {
        const { getPendingItems } = require('../../llm/queue');
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const limit = parseInt(queryParams.get('limit') || '50', 10);
        const projectId = queryParams.get('projectId') || null;
        
        try {
            const items = await getPendingItems(projectId, limit);
            jsonResponse(res, { items });
        } catch (error) {
            log.warn({ event: 'llm_queue_pending_error', reason: error?.message }, 'Queue pending error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // GET /api/llm/queue/retryable - Get failed items that can be retried
    if (pathname === '/api/llm/queue/retryable' && req.method === 'GET') {
        const { getRetryableItems } = require('../../llm/queue');
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const limit = parseInt(queryParams.get('limit') || '50', 10);
        const projectId = queryParams.get('projectId') || null;
        
        try {
            const items = await getRetryableItems(projectId, limit);
            jsonResponse(res, { items });
        } catch (error) {
            log.warn({ event: 'llm_queue_retryable_error', reason: error?.message }, 'Queue retryable error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/llm/queue/retry/:id - Retry a specific failed item
    const retryMatch = pathname.match(/^\/api\/llm\/queue\/retry\/(.+)$/);
    if (retryMatch && req.method === 'POST') {
        const { retryItem } = require('../../llm/queue');
        const itemId = retryMatch[1];
        
        try {
            const result = await retryItem(itemId);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'llm_queue_retry_error', reason: error?.message }, 'Queue retry error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/llm/queue/retry-all - Retry all retryable items
    if (pathname === '/api/llm/queue/retry-all' && req.method === 'POST') {
        const { retryAllItems } = require('../../llm/queue');
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const projectId = queryParams.get('projectId') || null;
        
        try {
            const result = await retryAllItems(projectId);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'llm_queue_retry_all_error', reason: error?.message }, 'Queue retry-all error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/llm/queue/cancel/:id - Cancel a specific pending item
    const cancelMatch = pathname.match(/^\/api\/llm\/queue\/cancel\/(.+)$/);
    if (cancelMatch && req.method === 'POST') {
        const { cancelItem } = require('../../llm/queue');
        const itemId = cancelMatch[1];
        
        try {
            const result = await cancelItem(itemId);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'llm_queue_cancel_error', reason: error?.message }, 'Queue cancel error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/llm/queue/clear - Clear queue (optionally filter by status)
    if (pathname === '/api/llm/queue/clear' && req.method === 'POST') {
        const { clearQueue } = require('../../llm/queue');
        const body = await parseBody(req);
        const status = body.status || 'all';
        const projectId = body.projectId || null;
        
        try {
            const result = await clearQueue(status, projectId);
            jsonResponse(res, result);
        } catch (error) {
            log.warn({ event: 'llm_queue_clear_error', reason: error?.message }, 'Queue clear error');
            jsonResponse(res, { error: error.message }, 500);
        }
        return true;
    }
    
    // POST /api/llm/queue/pause - Pause queue processing
    if (pathname === '/api/llm/queue/pause' && req.method === 'POST') {
        const { getQueueManager } = require('../../llm/queue');
        const queue = getQueueManager();
        queue.pause();
        jsonResponse(res, { success: true, paused: true });
        return true;
    }
    
    // POST /api/llm/queue/resume - Resume queue processing
    if (pathname === '/api/llm/queue/resume' && req.method === 'POST') {
        const { getQueueManager } = require('../../llm/queue');
        const queue = getQueueManager();
        queue.resume();
        jsonResponse(res, { success: true, paused: false });
        return true;
    }
    
    // POST /api/llm/queue/config - Update queue configuration
    if (pathname === '/api/llm/queue/config' && req.method === 'POST') {
        const { getQueueManager } = require('../../llm/queue');
        const queue = getQueueManager();
        const body = await parseBody(req);
        queue.configure(body);
        const status = await queue.getStatus();
        jsonResponse(res, { success: true, config: status.config });
        return true;
    }

    // ==================== LLM Test & Models API ====================

    // POST /api/llm/test/:provider - Test connection to a specific provider (provider in path)
    const testProviderMatch = pathname.match(/^\/api\/llm\/test\/([a-z]+)$/);
    if (testProviderMatch && req.method === 'POST') {
        const providerId = testProviderMatch[1];
        const body = await parseBody(req);
        
        // Build config for testing
        const savedProviderConfig = config.llm?.providers?.[providerId] || {};
        const testConfig = { ...savedProviderConfig };
        
        // Allow overriding with test values (e.g. user testing a new key before saving)
        if (body.apiKey) testConfig.apiKey = body.apiKey;
        if (body.baseUrl) testConfig.baseUrl = body.baseUrl;
        if (body.host) testConfig.host = body.host;
        if (body.port) testConfig.port = body.port;
        
        // Resolve API key from Supabase secrets (the ONLY source for production keys)
        if (!testConfig.apiKey && supabase && supabase.isConfigured()) {
            testConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
        }

        if (!testConfig.apiKey && providerId !== 'ollama') {
            jsonResponse(res, { ok: false, error: { message: `No API key configured for ${providerId}. Add it in Admin > LLM Providers.` } }, 400);
            return true;
        }

        const result = await llm.testConnection(providerId, testConfig);
        jsonResponse(res, result);
        return true;
    }

    // POST /api/llm/test - Test connection to a specific provider (provider in body)
    if (pathname === '/api/llm/test' && req.method === 'POST') {
        const body = await parseBody(req);
        const providerId = body.provider;
        
        if (!providerId) {
            jsonResponse(res, { ok: false, error: { message: 'Provider is required' } }, 400);
            return true;
        }

        // Build config for testing
        const savedProviderConfig = config.llm?.providers?.[providerId] || {};
        const testConfig = { ...savedProviderConfig };
        
        if (body.apiKey) testConfig.apiKey = body.apiKey;
        if (body.baseUrl) testConfig.baseUrl = body.baseUrl;
        if (body.host) testConfig.host = body.host;
        if (body.port) testConfig.port = body.port;
        
        // Resolve API key from Supabase secrets (the ONLY source for production keys)
        if (!testConfig.apiKey && supabase && supabase.isConfigured()) {
            testConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
        }

        if (!testConfig.apiKey && providerId !== 'ollama') {
            jsonResponse(res, { ok: false, error: { message: `No API key configured for ${providerId}. Add it in Admin > LLM Providers.` } }, 400);
            return true;
        }

        const result = await llm.testConnection(providerId, testConfig);
        jsonResponse(res, result);
        return true;
    }

    // ==================== LLM Model Metadata Sync API ====================

    // GET /api/llm/metadata/models - Get all models from Supabase DB (all providers)
    if (pathname === '/api/llm/metadata/models' && req.method === 'GET') {
        try {
            const llmMetadataDb = require('../../supabase/llm-metadata');
            const admin = require('../../supabase/client').getAdminClient();
            if (!admin) {
                jsonResponse(res, { ok: false, error: 'Supabase not configured' }, 500);
                return true;
            }

            const queryParams = new URLSearchParams(parseUrl(req.url).search);
            const providerFilter = queryParams.get('provider');

            let query = admin.from('llm_model_metadata').select('*').eq('is_active', true).order('provider').order('model_id');
            if (providerFilter) query = query.eq('provider', providerFilter);
            const { data: models, error: dbErr } = await query;

            if (dbErr) throw dbErr;

            jsonResponse(res, { ok: true, models: models || [], total: (models || []).length });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/llm/metadata/status - Get per-provider sync status from Supabase view
    if (pathname === '/api/llm/metadata/status' && req.method === 'GET') {
        try {
            const llmMetadataDb = require('../../supabase/llm-metadata');
            const syncStatus = await llmMetadataDb.getSyncStatus();
            jsonResponse(res, { ok: true, providers: syncStatus });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // POST /api/llm/metadata/sync - Sync models from all enabled providers to Supabase
    if (pathname === '/api/llm/metadata/sync' && req.method === 'POST') {
        try {
            const llmMetadataDb = require('../../supabase/llm-metadata');
            const raw = llm.getProviders();
            const providerConfigs = config?.llm?.providers || {};
            const userOverrides = config.llm?.tokenPolicy?.perModel || {};
            const results = {};
            let totalSynced = 0;
            let totalFailed = 0;

            for (const p of raw) {
                const providerId = p.id;
                let provConfig = { ...(providerConfigs[providerId] || {}) };

                if (!provConfig.apiKey && providerId !== 'ollama' && supabase && supabase.isConfigured()) {
                    provConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
                }
                if (providerId === 'ollama') {
                    provConfig.host = provConfig.host || config?.ollama?.host || 'http://localhost';
                    provConfig.port = provConfig.port || config?.ollama?.port || 11434;
                }

                if (!provConfig.apiKey && providerId !== 'ollama') {
                    results[providerId] = { status: 'skipped', reason: 'No API key' };
                    continue;
                }

                try {
                    const models = await llm.listModels(providerId, provConfig);
                    const enrichedText = modelMetadata.enrichModelList(providerId, models.textModels || [], userOverrides);
                    const enrichedVision = modelMetadata.enrichModelList(providerId, models.visionModels || [], userOverrides);
                    const enrichedEmbed = modelMetadata.enrichModelList(providerId, models.embeddingModels || [], userOverrides);

                    await llmMetadataDb.markProviderModelsInactive(providerId);

                    const allEnriched = [
                        ...enrichedText.map(m => ({ ...m, modelType: 'text', source: 'api' })),
                        ...enrichedVision.map(m => ({ ...m, modelType: 'text', supportsVision: true, source: 'api' })),
                        ...enrichedEmbed.map(m => ({ ...m, modelType: 'embedding', supportsEmbeddings: true, source: 'api' })),
                    ].map(m => ({
                        provider: providerId,
                        modelId: m.id || m.modelId || m.name,
                        displayName: m.displayName || m.label || m.name || m.id,
                        contextTokens: m.contextTokens || m.maxTokens || m.contextWindow || null,
                        maxOutputTokens: m.maxOutputTokens || null,
                        supportsVision: m.supportsVision || false,
                        supportsJsonMode: m.supportsJsonMode || false,
                        supportsFunctionCalling: m.supportsFunctionCalling || false,
                        supportsEmbeddings: m.supportsEmbeddings || false,
                        priceInput: m.priceInput || 0,
                        priceOutput: m.priceOutput || 0,
                        modelType: m.modelType || 'text',
                        tier: m.tier || 'standard',
                        description: m.description || null,
                        rawMetadata: m,
                    }));

                    const bulkResult = await llmMetadataDb.bulkUpsertModels(allEnriched);
                    modelMetadata.clearCache(providerId);

                    results[providerId] = { status: 'success', synced: bulkResult.success, failed: bulkResult.failed, total: allEnriched.length };
                    totalSynced += bulkResult.success;
                    totalFailed += bulkResult.failed;
                } catch (err) {
                    results[providerId] = { status: 'error', error: err.message };
                }
            }

            jsonResponse(res, { ok: true, results, totalSynced, totalFailed });
        } catch (error) {
            jsonResponse(res, { ok: false, error: error.message }, 500);
        }
        return true;
    }

    // GET /api/llm/models - Get available models from a provider with enriched metadata
    if (pathname === '/api/llm/models' && req.method === 'GET') {
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const modelsTextCfg = llmConfig.getTextConfig(config);
        const providerId = queryParams.get('provider') || modelsTextCfg.provider;
        
        // Get provider config from local config (non-secret fields: baseUrl, org, etc.)
        let providerConfig = { ...(config.llm?.providers?.[providerId] || {}) };
        
        // Resolve API key from Supabase secrets (the ONLY source for production keys)
        if (!providerConfig.apiKey && supabase && supabase.isConfigured()) {
            providerConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
        }
        
        // Get user overrides for model metadata
        const userOverrides = config.llm?.tokenPolicy?.perModel || {};
        
        try {
            const models = await llm.listModels(providerId, providerConfig);
            
            // Enrich models with metadata
            const enrichedTextModels = modelMetadata.enrichModelList(providerId, models.textModels || [], userOverrides);
            const enrichedVisionModels = modelMetadata.enrichModelList(providerId, models.visionModels || [], userOverrides);
            const enrichedEmbeddingModels = modelMetadata.enrichModelList(providerId, models.embeddingModels || [], userOverrides);
            
            // Clear cache for this provider since we just loaded fresh data
            modelMetadata.clearCache(providerId);
            
            jsonResponse(res, {
                provider: providerId,
                textModels: enrichedTextModels,
                visionModels: enrichedVisionModels,
                embeddingModels: enrichedEmbeddingModels,
                error: models.error
            });
        } catch (error) {
            jsonResponse(res, {
                provider: providerId,
                error: error.message,
                textModels: [],
                visionModels: [],
                embeddingModels: []
            });
        }
        return true;
    }

    // GET /api/llm/capabilities - Get capabilities for a specific provider or all
    if (pathname === '/api/llm/capabilities' && req.method === 'GET') {
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const providerId = queryParams.get('provider');

        if (providerId) {
            const capabilities = llm.getProviderCapabilities(providerId);
            jsonResponse(res, { provider: providerId, capabilities });
            return true;
        }

        const allCapabilities = {};
        const providerIds = Object.keys(llm.PROVIDERS);
        for (const pid of providerIds) {
            allCapabilities[pid] = llm.getProviderCapabilities(pid);
        }
        jsonResponse(res, allCapabilities);
        return true;
    }

    // GET /api/llm/model-info - Get enriched metadata for a specific model
    if (pathname === '/api/llm/model-info' && req.method === 'GET') {
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const providerId = queryParams.get('provider');
        const modelId = queryParams.get('modelId');
        
        if (!providerId || !modelId) {
            jsonResponse(res, { error: 'Both provider and modelId parameters are required' }, 400);
            return true;
        }

        const modelKey = `${providerId}:${modelId}`;
        const userOverrides = config.llm?.tokenPolicy?.perModel?.[modelKey] || {};
        const metadata = modelMetadata.getModelMetadata(providerId, modelId, userOverrides);
        
        jsonResponse(res, {
            provider: providerId,
            modelId,
            ...metadata
        });
        return true;
    }

    // POST /api/llm/token-estimate - Estimate tokens for a request
    if (pathname === '/api/llm/token-estimate' && req.method === 'POST') {
        const body = await parseBody(req);
        const { provider, modelId, messages, ragContext, systemPrompt, task } = body;
        
        if (!provider || !modelId) {
            jsonResponse(res, { error: 'Provider and modelId are required' }, 400);
            return true;
        }

        const modelKey = `${provider}:${modelId}`;
        const userOverrides = config.llm?.tokenPolicy?.perModel?.[modelKey] || {};
        const modelInfo = modelMetadata.getModelMetadata(provider, modelId, userOverrides);
        
        const estimate = tokenBudget.getTokenEstimate({
            provider,
            modelId,
            messages: messages || [],
            ragContext: ragContext || '',
            systemPrompt: systemPrompt || '',
            tokenPolicy: config.llm?.tokenPolicy || {},
            modelInfo,
            task: task || 'chat'
        });
        
        jsonResponse(res, {
            provider,
            modelId,
            ...estimate
        });
        return true;
    }

    // POST /api/llm/token-policy - Update token policy for a model
    if (pathname === '/api/llm/token-policy' && req.method === 'POST') {
        const body = await parseBody(req);
        const { modelKey, policy } = body;
        
        if (!config.llm.tokenPolicy) {
            config.llm.tokenPolicy = { ...tokenBudget.DEFAULT_POLICY };
        }
        
        if (!config.llm.tokenPolicy.perModel) {
            config.llm.tokenPolicy.perModel = {};
        }
        
        if (modelKey && policy) {
            config.llm.tokenPolicy.perModel[modelKey] = {
                ...config.llm.tokenPolicy.perModel[modelKey],
                ...policy
            };
        }
        
        // Update global policy settings if provided
        if (body.enforce !== undefined) {
            config.llm.tokenPolicy.enforce = body.enforce;
        }
        if (body.defaultMaxOutputTokens !== undefined) {
            config.llm.tokenPolicy.defaultMaxOutputTokens = body.defaultMaxOutputTokens;
        }
        if (body.defaultReservedForSystem !== undefined) {
            config.llm.tokenPolicy.defaultReservedForSystem = body.defaultReservedForSystem;
        }
        if (body.defaultReservedForRag !== undefined) {
            config.llm.tokenPolicy.defaultReservedForRag = body.defaultReservedForRag;
        }
        
        saveConfig(config);
        jsonResponse(res, { success: true, tokenPolicy: config.llm.tokenPolicy });
        return true;
    }

    // GET /api/llm/routing/status - Get routing status and provider health
    if (pathname === '/api/llm/routing/status' && req.method === 'GET') {
        const status = llmRouter.getRoutingStatus(config);
        jsonResponse(res, status);
        return true;
    }

    // POST /api/llm/routing/reset - Reset provider health state
    if (pathname === '/api/llm/routing/reset' && req.method === 'POST') {
        const body = await parseBody(req);
        if (body.providerId) {
            healthRegistry.resetHealth(body.providerId);
        } else {
            healthRegistry.resetAllHealth();
        }
        jsonResponse(res, { success: true });
        return true;
    }

    // POST /api/llm/routing/config - Update routing configuration
    if (pathname === '/api/llm/routing/config' && req.method === 'POST') {
        const body = await parseBody(req);
        
        if (!config.llm.routing) {
            config.llm.routing = { ...llmRouter.DEFAULT_ROUTING_POLICY };
        }
        
        if (body.mode !== undefined) {
            config.llm.routing.mode = body.mode;
        }
        
        if (body.perTask) {
            config.llm.routing.perTask = {
                ...config.llm.routing.perTask,
                ...body.perTask
            };
        }
        
        if (body.modelMap) {
            config.llm.routing.modelMap = {
                ...config.llm.routing.modelMap,
                ...body.modelMap
            };
        }
        
        saveConfig(config);
        jsonResponse(res, { success: true, routing: config.llm.routing });
        return true;
    }

    // POST /api/llm/preflight - Run preflight tests
    if (pathname === '/api/llm/preflight' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const mode = body.mode || 'mock';
            
            const { runPreflight } = require('../../tests/llmPreflightRunner');
            const { getLLMConfigForFrontend } = require('../../llm/config');
            
            const testConfig = {
                llm: getLLMConfigForFrontend(config.llm)
            };
            
            const report = await runPreflight({ mode, config: testConfig });
            
            jsonResponse(res, report);
        } catch (error) {
            log.warn({ event: 'llm_preflight_error', reason: error?.message }, 'Preflight error');
            jsonResponse(res, { 
                error: 'Preflight runner failed', 
                message: error.message 
            }, 500);
        }
        return true;
    }

    // ==================== Ollama API ====================

    // GET /api/ollama/test - Test Ollama connection
    if (pathname === '/api/ollama/test' && req.method === 'GET') {
        const result = await llm.testConnection('ollama', getOllamaConfig());
        const resPayload = result.ok ? { connected: true, models: result.models } : { connected: false, error: result.error?.message };
        jsonResponse(res, resPayload);
        return true;
    }

    // GET /api/ollama/models - Get available models (categorized)
    if (pathname === '/api/ollama/models' && req.method === 'GET') {
        try {
            const client = llm.getClient('ollama', getOllamaConfig());
            const categorized = await client.getCategorizedModels();
            jsonResponse(res, {
                models: categorized.all,
                vision: categorized.vision,
                text: categorized.text,
                hasVision: categorized.vision.length > 0,
                hasText: categorized.text.length > 0,
                recommended: categorized.vision.length > 0 ? 'auto' : (categorized.text[0]?.name || null)
            });
        } catch (e) {
            jsonResponse(res, { models: [], vision: [], text: [], hasVision: false, hasText: false, recommended: null, error: e.message }, 500);
        }
        return true;
    }

    // GET /api/ollama/recommended - Get recommended models for download
    if (pathname === '/api/ollama/recommended' && req.method === 'GET') {
        try {
            const client = llm.getClient('ollama', getOllamaConfig());
            const recommended = client.getRecommendedModels();
            const installed = await client.getCategorizedModels();
            const installedNames = installed.all.map(m => m.name.split(':')[0]);

            for (const category of ['vision', 'text']) {
                for (const model of recommended[category]) {
                    model.installed = installedNames.some(n => model.name.startsWith(n));
                }
            }

            jsonResponse(res, {
                recommended,
                needsVision: installed.vision.length === 0,
                needsText: installed.text.length === 0
            });
        } catch (e) {
            log.warn({ event: 'llm_recommended_models_error', reason: e.message }, 'Error fetching recommended models');
            jsonResponse(res, { error: 'Ollama server unavailable', details: e.message });
        }
        return true;
    }

    // POST /api/ollama/pull - Download a model
    if (pathname === '/api/ollama/pull' && req.method === 'POST') {
        const body = await parseBody(req);
        const modelName = body.model;

        if (!modelName) {
            jsonResponse(res, { error: 'Model name required' }, 400);
            return true;
        }

        log.debug({ event: 'llm_pull_start', modelName }, 'Starting download of model');

        let lastProgress = null;
        const result = await llm.pullModel('ollama', modelName, getOllamaConfig(), (progress) => {
            lastProgress = progress;
            if (progress && progress.total > 0) {
                log.debug({ event: 'llm_pull_progress', modelName, percent: progress.percent, status: progress.status }, 'Downloading model');
            }
        });

        if (result.success) {
            log.debug({ event: 'llm_pull_done', modelName }, 'Model downloaded successfully');
            jsonResponse(res, { success: true, model: modelName });
        } else {
            log.warn({ event: 'llm_pull_failed', modelName, reason: result.error }, 'Failed to download model');
            jsonResponse(res, { success: false, error: result.error }, 500);
        }
        return true;
    }

    // Not a route we handle
    return false;
}

// Helper: Load API key from Supabase secrets
// Uses getProviderApiKey which follows the naming convention: {provider}_api_key (lowercase)
// This matches the queue's key resolution in secrets.js
async function loadApiKeyFromSupabase(supabase, providerId) {
    try {
        const secrets = require('../../supabase/secrets');
        // Use the canonical getProviderApiKey function (system scope only for admin routes)
        const result = await secrets.getProviderApiKey(providerId, null);
        if (result.success && result.value) {
            moduleLog.debug({ event: 'llm_apikey_loaded', providerId, source: result.source }, 'Loaded API key from Supabase');
            return result.value;
        }
        // Legacy fallback: try UPPERCASE env-var-style names for backwards compatibility
        const legacyNames = {
            openai: 'OPENAI_API_KEY', anthropic: 'CLAUDE_API_KEY', claude: 'CLAUDE_API_KEY',
            google: 'GOOGLE_API_KEY', gemini: 'GOOGLE_API_KEY', grok: 'XAI_API_KEY', xai: 'XAI_API_KEY',
            deepseek: 'DEEPSEEK_API_KEY', kimi: 'KIMI_API_KEY', minimax: 'MINIMAX_API_KEY'
        };
        const legacyName = legacyNames[providerId];
        if (legacyName) {
            const legacyResult = await secrets.getSecret('system', legacyName);
            if (legacyResult.success && legacyResult.value) {
                moduleLog.debug({ event: 'llm_apikey_loaded_legacy', providerId }, 'Loaded API key from Supabase (legacy name)');
                return legacyResult.value;
            }
        }
    } catch (e) {
        moduleLog.warn({ event: 'llm_apikey_load_failed', providerId, reason: e.message }, 'Failed to load API key from Supabase');
    }
    return null;
}

// getApiKeyFromEnv was removed — all LLM provider API keys come exclusively from Supabase secrets.

module.exports = {
    handleLlm
};
