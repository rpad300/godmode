/**
 * LLM and Ollama feature routes
 * Extracted from server.js
 * 
 * Handles:
 * - GET /api/llm/providers
 * - GET/POST /api/llm/queue/*
 * - POST /api/llm/test/:provider
 * - POST /api/llm/test
 * - GET /api/llm/models
 * - GET /api/llm/capabilities
 * - GET /api/llm/model-info
 * - POST /api/llm/token-estimate
 * - POST /api/llm/token-policy
 * - GET/POST /api/llm/routing/*
 * - POST /api/llm/preflight
 * - GET /api/ollama/test
 * - GET /api/ollama/models
 * - GET /api/ollama/recommended
 * - POST /api/ollama/pull
 */

const { parseBody } = require('../../server/request');
const { jsonResponse } = require('../../server/response');
const { parseUrl } = require('../../server/request');

/**
 * Handle LLM and Ollama routes
 * @param {object} ctx - Context object
 * @returns {Promise<boolean>} - true if handled
 */
// In-memory metadata sync timestamps (best-effort; resets on server restart)
const metadataLastSyncedAt = new Map();

async function handleLlm(ctx) {
    const { req, res, pathname, config, saveConfig, llm, ollama, supabase } = ctx;
    
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

    // GET /api/llm/providers - Get list of supported providers with capabilities
    if (pathname === '/api/llm/providers' && req.method === 'GET') {
        const providers = llm.getProviders();
        jsonResponse(res, { providers });
        return true;
    }

    // GET /api/llm/metadata/:provider - Browse known models for a provider
    // NOTE: /api/llm/metadata/status is a separate endpoint; don't swallow it here.
    const browseProviderMatch = pathname.match(/^\/api\/llm\/metadata\/([^/]+)$/);
    if (browseProviderMatch && req.method === 'GET') {
        const provider = browseProviderMatch[1];
        if (provider !== 'status' && provider !== 'sync') {
            try {
                const models = modelMetadata.getKnownModelsForProvider(provider) || [];

                const embeddingModels = [];
                const visionModels = [];
                const textModels = [];

                for (const m of models) {
                    const model_id = m.id;
                    const display_name = m.id;

                    const record = {
                        model_id,
                        display_name,
                        context_tokens: m.contextTokens ?? null,
                        price_input: m.priceInput ?? null,
                        price_output: m.priceOutput ?? null
                    };

                    if (m.supportsEmbeddings) embeddingModels.push(record);
                    else if (m.supportsVision) visionModels.push(record);
                    else textModels.push(record);
                }

                jsonResponse(res, {
                    success: true,
                    textModels,
                    visionModels: visionModels.map(m => ({ model_id: m.model_id, display_name: m.display_name })),
                    embeddingModels: embeddingModels.map(m => ({ model_id: m.model_id, display_name: m.display_name })),
                    total: models.length
                });
            } catch (e) {
                jsonResponse(res, { success: false, error: e.message }, 500);
            }
            return true;
        }
    }

    // GET /api/llm/metadata/status - Model metadata sync status (AdminPanel)
    if (pathname === '/api/llm/metadata/status' && req.method === 'GET') {
        try {
            const providers = (llm.getProviders?.() || []).map(p => (typeof p === 'string' ? p : p.provider || p.id)).filter(Boolean);

            const rows = [];
            for (const provider of providers) {
                const last = metadataLastSyncedAt.get(provider) || null;
                if (!last) continue; // keep legacy behavior: empty until synced

                const models = modelMetadata.getKnownModelsForProvider(provider) || [];
                const text_models = models.filter(m => !m.supportsEmbeddings && !m.supportsVision).length;
                const vision_models = models.filter(m => !m.supportsEmbeddings && !!m.supportsVision).length;
                const embedding_models = models.filter(m => !!m.supportsEmbeddings).length;

                rows.push({
                    provider,
                    active_models: models.length,
                    text_models,
                    vision_models,
                    embedding_models,
                    last_synced: last
                });
            }

            jsonResponse(res, {
                success: true,
                providers: rows
            });
        } catch (e) {
            jsonResponse(res, { success: false, error: e.message }, 500);
        }
        return true;
    }

    // POST /api/llm/metadata/sync - Build counts from known mappings (AdminPanel expects this)
    if (pathname === '/api/llm/metadata/sync' && req.method === 'POST') {
        try {
            const providers = (llm.getProviders?.() || []).map(p => (typeof p === 'string' ? p : p.provider || p.id)).filter(Boolean);
            const results = {};
            let totalModels = 0;

            for (const provider of providers) {
                const models = modelMetadata.getKnownModelsForProvider(provider) || [];
                const synced = models.length;
                totalModels += synced;
                metadataLastSyncedAt.set(provider, new Date().toISOString());

                results[provider] = {
                    status: 'success',
                    models: synced,
                    synced
                };
            }

            jsonResponse(res, {
                success: true,
                providers: results,
                totalModels,
                errors: []
            });
        } catch (e) {
            jsonResponse(res, { success: false, error: e.message, providers: {}, totalModels: 0, errors: [{ provider: 'all', error: e.message }] }, 500);
        }
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
            console.error('[API] Queue status error:', error);
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
            console.error('[API] Queue history error:', error);
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
            console.error('[API] Queue pending error:', error);
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
            console.error('[API] Queue retryable error:', error);
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
            console.error('[API] Queue retry error:', error);
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
            console.error('[API] Queue retry-all error:', error);
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
            console.error('[API] Queue cancel error:', error);
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
            console.error('[API] Queue clear error:', error);
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
        
        // Allow overriding with test values
        if (body.apiKey) testConfig.apiKey = body.apiKey;
        if (body.baseUrl) testConfig.baseUrl = body.baseUrl;
        if (body.host) testConfig.host = body.host;
        if (body.port) testConfig.port = body.port;
        
        // Load API key from Supabase secrets if not available
        if (!testConfig.apiKey && supabase && supabase.isConfigured()) {
            testConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
        }
        
        // Fallback to environment variables
        if (!testConfig.apiKey) {
            testConfig.apiKey = getApiKeyFromEnv(providerId);
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
        
        if (!testConfig.apiKey && supabase && supabase.isConfigured()) {
            testConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
        }
        
        if (!testConfig.apiKey) {
            testConfig.apiKey = getApiKeyFromEnv(providerId);
        }

        const result = await llm.testConnection(providerId, testConfig);
        jsonResponse(res, result);
        return true;
    }

    // GET /api/llm/models - Get available models from a provider with enriched metadata
    if (pathname === '/api/llm/models' && req.method === 'GET') {
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const modelsTextCfg = llmConfig.getTextConfig(config);
        const providerId = queryParams.get('provider') || modelsTextCfg.provider;
        
        // Get provider config from local config
        let providerConfig = { ...(config.llm?.providers?.[providerId] || {}) };
        
        // Try to load API key from Supabase secrets
        if (!providerConfig.apiKey && supabase && supabase.isConfigured()) {
            providerConfig.apiKey = await loadApiKeyFromSupabase(supabase, providerId);
        }
        
        // Fallback to environment variables
        if (!providerConfig.apiKey) {
            providerConfig.apiKey = getApiKeyFromEnv(providerId);
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

    // GET /api/llm/capabilities - Get capabilities for a specific provider
    if (pathname === '/api/llm/capabilities' && req.method === 'GET') {
        const queryParams = new URLSearchParams(parseUrl(req.url).search);
        const providerId = queryParams.get('provider');
        
        if (!providerId) {
            jsonResponse(res, { error: 'Provider parameter is required' }, 400);
            return true;
        }

        const capabilities = llm.getProviderCapabilities(providerId);
        jsonResponse(res, { provider: providerId, capabilities });
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
            console.error('Preflight error:', error);
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
        const result = await ollama.testConnection();
        jsonResponse(res, result);
        return true;
    }

    // GET /api/ollama/models - Get available models (categorized)
    if (pathname === '/api/ollama/models' && req.method === 'GET') {
        const categorized = await ollama.getCategorizedModels();
        jsonResponse(res, {
            models: categorized.all,
            vision: categorized.vision,
            text: categorized.text,
            hasVision: categorized.vision.length > 0,
            hasText: categorized.text.length > 0,
            recommended: categorized.vision.length > 0 ? 'auto' : (categorized.text[0]?.name || null)
        });
        return true;
    }

    // GET /api/ollama/recommended - Get recommended models for download
    if (pathname === '/api/ollama/recommended' && req.method === 'GET') {
        try {
            const recommended = ollama.getRecommendedModels();
            const installed = await ollama.getCategorizedModels();
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
            console.error('Error fetching recommended models:', e.message);
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

        console.log(`Starting download of model: ${modelName}`);

        let lastProgress = null;
        const result = await ollama.pullModel(modelName, (progress) => {
            lastProgress = progress;
            if (progress.total > 0) {
                console.log(`Downloading ${modelName}: ${progress.percent}% (${progress.status})`);
            }
        });

        if (result.success) {
            console.log(`Model ${modelName} downloaded successfully`);
            jsonResponse(res, { success: true, model: modelName });
        } else {
            console.log(`Failed to download ${modelName}: ${result.error}`);
            jsonResponse(res, { success: false, error: result.error }, 500);
        }
        return true;
    }

    // Not a route we handle
    return false;
}

// Helper: Load API key from Supabase secrets
async function loadApiKeyFromSupabase(supabase, providerId) {
    try {
        const secrets = require('../../supabase/secrets');
        const secretNames = {
            openai: 'OPENAI_API_KEY', anthropic: 'CLAUDE_API_KEY', claude: 'CLAUDE_API_KEY',
            google: 'GOOGLE_API_KEY', gemini: 'GOOGLE_API_KEY', grok: 'XAI_API_KEY', xai: 'XAI_API_KEY',
            deepseek: 'DEEPSEEK_API_KEY', kimi: 'KIMI_API_KEY', minimax: 'MINIMAX_API_KEY'
        };
        const secretName = secretNames[providerId];
        if (secretName) {
            const apiKeyResult = await secrets.getSecret('system', secretName);
            if (apiKeyResult.success && apiKeyResult.value) {
                console.log(`[LLM] Loaded API key for ${providerId} from Supabase`);
                return apiKeyResult.value;
            }
        }
    } catch (e) {
        console.warn(`[LLM] Failed to load API key from Supabase for ${providerId}:`, e.message);
    }
    return null;
}

// Helper: Get API key from environment variables
function getApiKeyFromEnv(providerId) {
    const envKeys = {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.CLAUDE_API_KEY,
        claude: process.env.CLAUDE_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        gemini: process.env.GOOGLE_API_KEY,
        grok: process.env.XAI_API_KEY,
        xai: process.env.XAI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        kimi: process.env.KIMI_API_KEY,
        minimax: process.env.MINIMAX_API_KEY
    };
    const key = envKeys[providerId];
    if (key) {
        console.log(`[LLM] Using API key for ${providerId} from environment`);
    }
    return key || null;
}

module.exports = {
    handleLlm
};
