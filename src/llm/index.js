/**
 * Purpose:
 *   Central facade for the LLM subsystem. Every LLM operation in the application
 *   (text generation, vision, embeddings) is funnelled through this module so that
 *   callers never interact with provider implementations directly.
 *
 * Responsibilities:
 *   - Maintains a registry of provider classes and a cache of provider instances
 *   - Exposes high-level operations (generateText, generateVision, embed) with
 *     automatic queue integration, cost tracking, and structured logging
 *   - Provides helper queries: model listing, vision detection, connection testing
 *   - Ollama-specific helpers (pullModel, unloadModels) that are no-ops for cloud providers
 *
 * Key dependencies:
 *   - ./providers/*: concrete provider implementations (OpenAI, Gemini, Claude, etc.)
 *   - ./costTracker: every successful call records token usage and estimated cost
 *   - ./queue (lazy-loaded): when queueing is enabled, requests are serialized through
 *     the queue manager to respect per-provider concurrency limits
 *   - ./modelMetadata: used by isVisionModel / getModelInfo for capability lookups
 *   - ./constants: OLLAMA_VISION_PATTERNS used for Ollama vision model detection
 *
 * Side effects:
 *   - Network calls to LLM provider APIs
 *   - Writes cost-tracking records (buffered, flushed to Supabase)
 *   - Emits structured log events under the 'llm' module namespace
 *
 * Notes:
 *   - Provider cache keys include serialized config, so the same provider with
 *     different API keys yields separate instances.
 *   - The queue module is required lazily inside generateTextQueued / generateVision /
 *     embed to break the circular dependency (queue -> index -> queue).
 *   - listModels falls back to `config.manualModels` (comma-separated) when the
 *     provider API is unreachable or returns no models.
 */

const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'llm' });

const OllamaProvider = require('./providers/ollama');
const OpenAIProvider = require('./providers/openai');
const GeminiProvider = require('./providers/gemini');
const GrokProvider = require('./providers/grok');
const DeepSeekProvider = require('./providers/deepseek');
const GenSparkProvider = require('./providers/genspark');
const ClaudeProvider = require('./providers/claude');
const KimiProvider = require('./providers/kimi');
const MiniMaxProvider = require('./providers/minimax');
const costTracker = require('./costTracker');

// Provider registry
const PROVIDERS = {
    ollama: OllamaProvider,
    openai: OpenAIProvider,
    gemini: GeminiProvider,
    google: GeminiProvider,  // Alias for gemini
    grok: GrokProvider,
    xai: GrokProvider,       // Alias for grok (xAI)
    deepseek: DeepSeekProvider,
    anthropic: ClaudeProvider,  // Alias for claude
    genspark: GenSparkProvider,
    claude: ClaudeProvider,
    kimi: KimiProvider,
    minimax: MiniMaxProvider
};

// Cache for provider instances
const providerCache = new Map();

/**
 * Get list of all supported providers with their capabilities
 * @returns {Array<{id: string, label: string, capabilities: object}>}
 */
function getProviders() {
    return Object.entries(PROVIDERS).map(([id, Provider]) => ({
        id,
        ...Provider.info
    }));
}

/**
 * Get a provider instance (cached)
 * @param {string} providerId - Provider identifier
 * @param {object} config - Provider-specific configuration
 * @returns {BaseLLMProvider}
 */
function getClient(providerId, config = {}) {
    const Provider = PROVIDERS[providerId];
    if (!Provider) {
        throw new Error(`Unknown LLM provider: ${providerId}`);
    }

    // Create cache key from provider and config
    const cacheKey = `${providerId}:${JSON.stringify(config)}`;
    
    if (!providerCache.has(cacheKey)) {
        providerCache.set(cacheKey, new Provider(config));
    }
    
    return providerCache.get(cacheKey);
}

/**
 * Clear provider cache (call when config changes)
 */
function clearCache() {
    providerCache.clear();
}

/**
 * Test connection to a provider
 * @param {string} providerId - Provider identifier
 * @param {object} config - Provider configuration (may include temporary apiKey for testing)
 * @returns {Promise<{ok: boolean, error?: object}>}
 */
async function testConnection(providerId, config = {}) {
    try {
        const client = getClient(providerId, config);
        return await client.testConnection();
    } catch (error) {
        return {
            ok: false,
            error: {
                provider: providerId,
                step: 'test',
                message: error.message,
                retryable: false
            }
        };
    }
}

/**
 * List available models from a provider
 * @param {string} providerId - Provider identifier
 * @param {object} config - Provider configuration
 * @returns {Promise<{textModels: Array, visionModels: Array, embeddingModels: Array}>}
 */
async function listModels(providerId, config = {}) {
    try {
        const client = getClient(providerId, config);
        const models = await client.listModels();
        
        // If no models returned and manualModels is configured, use those
        if (config.manualModels && 
            models.textModels.length === 0 && 
            models.visionModels.length === 0) {
            const manualList = config.manualModels.split(',').map(m => m.trim()).filter(m => m);
            models.textModels = manualList.map(name => ({ name, manual: true }));
        }
        
        return models;
    } catch (error) {
        // Fallback to manual models on error
        if (config.manualModels) {
            const manualList = config.manualModels.split(',').map(m => m.trim()).filter(m => m);
            return {
                textModels: manualList.map(name => ({ name, manual: true })),
                visionModels: [],
                embeddingModels: [],
                error: error.message
            };
        }
        throw error;
    }
}

/**
 * Generate text completion (direct, bypasses queue)
 * Use generateTextQueued() for queued processing
 * @param {object} options
 * @param {string} options.provider - Provider identifier
 * @param {string} options.model - Model name
 * @param {string} options.prompt - User prompt
 * @param {string} [options.system] - System prompt
 * @param {number} [options.temperature=0.7] - Temperature
 * @param {number} [options.maxTokens=4096] - Max tokens
 * @param {boolean} [options.jsonMode=false] - Request JSON output
 * @param {object} [options.providerConfig] - Provider-specific config
 * @param {string} [options.context] - Context for tracking (e.g., 'document', 'email', 'chat')
 * @param {boolean} [options._bypassQueue=false] - Internal flag to bypass queue (used by queue itself)
 * @returns {Promise<{success: boolean, text?: string, usage?: object, error?: string}>}
 */
async function generateText(options) {
    const { provider, providerConfig = {}, context = null, _bypassQueue = false, priority = 'normal', ...rest } = options;
    
    // Use queue unless bypassed (queue calls with _bypassQueue=true)
    if (!_bypassQueue && isQueueEnabled()) {
        return generateTextQueued({ ...options, _bypassQueue: true }, priority);
    }
    
    const startTime = Date.now();
    
    try {
        const client = getClient(provider, providerConfig);
        const result = await client.generateText(rest);
        
        const latency = Date.now() - startTime;
        log.debug({ event: 'llm_generate_text', provider, model: rest.model, context: context || 'none', latencyMs: latency, success: result.success }, 'generateText');
        if (result.usage) {
            log.debug({ event: 'llm_usage', inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }, 'Token usage');
        }
        
        // Track costs with context
        costTracker.track({
            provider,
            model: rest.model,
            operation: 'generateText',
            inputTokens: result.usage?.inputTokens || 0,
            outputTokens: result.usage?.outputTokens || 0,
            latencyMs: latency,
            success: result.success,
            context  // Pass context for tracking
        });
        
        return result;
    } catch (error) {
        log.warn({ event: 'llm_generate_text_error', provider, reason: error.message }, 'generateText error');
        return {
            success: false,
            error: error.message
        };
    }
}

// Global toggle for the request queue. When disabled, generateText / generateVision / embed
// bypass the queue and call the provider directly. Useful for debugging or when running in
// environments where the queue's concurrency control is unnecessary.
let queueEnabled = true;

function isQueueEnabled() {
    return queueEnabled;
}

function setQueueEnabled(enabled) {
    queueEnabled = enabled;
    log.info({ event: 'llm_queue_toggle', enabled }, `Queue ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Generate text with queueing (ensures only one LLM request at a time)
 * @param {object} options - Same as generateText options
 * @param {string} [priority='normal'] - Priority: 'high', 'normal', 'low', 'batch'
 * @returns {Promise<{success: boolean, text?: string, usage?: object, error?: string}>}
 */
async function generateTextQueued(options, priority = 'normal') {
    // Lazy load to avoid circular dependency
    const { getQueueManager } = require('./queue');
    const queue = getQueueManager();
    
    // Enqueue the request - the queue will call generateText with _bypassQueue=true
    return queue.enqueue(options, priority);
}

/**
 * Generate text with vision (image input)
 * @param {object} options
 * @param {string} options.provider - Provider identifier
 * @param {string} options.model - Model name
 * @param {string} options.prompt - User prompt
 * @param {Array<string>} options.images - Array of base64 images or file paths
 * @param {number} [options.temperature=0.7] - Temperature
 * @param {number} [options.maxTokens=4096] - Max tokens
 * @param {object} [options.providerConfig] - Provider-specific config
 * @param {string} [options.context] - Context for tracking
 * @param {boolean} [options._bypassQueue=false] - Internal flag to bypass queue
 * @returns {Promise<{success: boolean, text?: string, usage?: object, error?: string}>}
 */
async function generateVision(options) {
    const { provider, providerConfig = {}, context = null, _bypassQueue = false, priority = 'normal', ...rest } = options;
    
    // Use queue unless bypassed
    if (!_bypassQueue && isQueueEnabled()) {
        const { getQueueManager } = require('./queue');
        const queue = getQueueManager();
        return queue.enqueue({ ...options, _bypassQueue: true, _operation: 'vision' }, priority);
    }
    
    const startTime = Date.now();
    
    try {
        const client = getClient(provider, providerConfig);
        
        // Check if provider supports vision
        if (!client.constructor.capabilities.vision) {
            return {
                success: false,
                error: `Provider ${provider} does not support vision`
            };
        }
        
        const result = await client.generateVision(rest);
        
        const latency = Date.now() - startTime;
        log.debug({ event: 'llm_generate_vision', provider, model: rest.model, context: context || 'none', images: rest.images?.length || 0, latencyMs: latency, success: result.success }, 'generateVision');
        
        // Track costs with context
        costTracker.track({
            provider,
            model: rest.model,
            operation: 'generateVision',
            inputTokens: result.usage?.inputTokens || 0,
            outputTokens: result.usage?.outputTokens || 0,
            latencyMs: latency,
            success: result.success,
            context
        });
        
        return result;
    } catch (error) {
        log.warn({ event: 'llm_generate_vision_error', provider, reason: error.message }, 'generateVision error');
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Generate embeddings
 * @param {object} options
 * @param {string} options.provider - Provider identifier
 * @param {string} options.model - Embedding model name
 * @param {Array<string>} options.texts - Texts to embed
 * @param {object} [options.providerConfig] - Provider-specific config
 * @param {string} [options.context] - Context for tracking
 * @param {boolean} [options._bypassQueue=false] - Internal flag to bypass queue
 * @returns {Promise<{success: boolean, embeddings?: Array, error?: string}>}
 */
async function embed(options) {
    const { provider, providerConfig = {}, context = null, _bypassQueue = false, priority = 'low', ...rest } = options;
    
    // Use queue unless bypassed (embeddings default to low priority)
    if (!_bypassQueue && isQueueEnabled()) {
        const { getQueueManager } = require('./queue');
        const queue = getQueueManager();
        return queue.enqueue({ ...options, _bypassQueue: true, _operation: 'embed' }, priority);
    }
    
    const startTime = Date.now();
    
    try {
        const client = getClient(provider, providerConfig);
        
        // Check if provider supports embeddings
        if (!client.constructor.capabilities.embeddings) {
            return {
                success: false,
                error: `Provider ${provider} does not support embeddings`
            };
        }
        
        const result = await client.embed(rest);
        
        const latency = Date.now() - startTime;
        log.debug({ event: 'llm_embed', provider, model: rest.model, context: context || 'none', texts: rest.texts?.length || 0, latencyMs: latency, success: result.success }, 'embed');
        
        // Track costs (embeddings are input-only)
        // Embeddings are input-only; providers rarely return token counts, so we
        // estimate using the same ~4 chars/token heuristic used elsewhere.
        const estimatedTokens = rest.texts?.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0) || 0;
        costTracker.track({
            provider,
            model: rest.model,
            operation: 'embed',
            inputTokens: result.usage?.totalTokens || estimatedTokens,
            outputTokens: 0,
            latencyMs: latency,
            success: result.success,
            context
        });
        
        return result;
    } catch (error) {
        log.warn({ event: 'llm_embed_error', provider, reason: error.message }, 'embed error');
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check if a provider is configured
 * @param {string} providerId - Provider identifier
 * @param {object} config - Provider configuration
 * @returns {boolean}
 */
function isProviderConfigured(providerId, config = {}) {
    try {
        const client = getClient(providerId, config);
        return client.isConfigured();
    } catch {
        return false;
    }
}

/**
 * Get provider capabilities
 * @param {string} providerId - Provider identifier
 * @returns {object}
 */
function getProviderCapabilities(providerId) {
    const Provider = PROVIDERS[providerId];
    if (!Provider) {
        return { listModels: false, text: false, vision: false, embeddings: false };
    }
    return Provider.capabilities;
}

/**
 * Get model info (metadata) for a specific model
 * @param {string} providerId - Provider identifier
 * @param {string} modelId - Model identifier
 * @param {object} providerConfig - Provider configuration
 * @returns {Promise<object>} Model metadata
 */
async function getModelInfo(providerId, modelId, providerConfig = {}) {
    const modelMetadata = require('./modelMetadata');
    
    // First check cache
    const cached = modelMetadata.getCached(providerId, modelId);
    if (cached) {
        return cached;
    }
    
    // Get from mappings
    const metadata = modelMetadata.getModelMetadata(providerId, modelId);
    
    return metadata;
}

const { OLLAMA_VISION_PATTERNS } = require('./constants');

/**
 * Check if a model supports vision (images)
 * @param {string} providerId - Provider identifier
 * @param {string} modelName - Model name
 * @returns {boolean}
 */
function isVisionModel(providerId, modelName) {
    if (!modelName) return false;
    if (providerId === 'ollama') {
        return OLLAMA_VISION_PATTERNS.some(vm => modelName.toLowerCase().includes(vm));
    }
    const modelMetadata = require('./modelMetadata');
    const meta = modelMetadata.getModelMetadata(providerId, modelName);
    return !!meta?.supportsVision;
}

/**
 * Find the best available model for a task type (text or vision)
 * @param {string} providerId - Provider identifier
 * @param {string} taskType - 'text' or 'vision'
 * @param {object} providerConfig - Provider configuration
 * @returns {Promise<{model: string, type: string}|null>}
 */
async function findBestModel(providerId, taskType = 'text', providerConfig = {}) {
    try {
        const { textModels = [], visionModels = [] } = await listModels(providerId, providerConfig);
        const vision = Array.isArray(visionModels) ? visionModels : [];
        const text = Array.isArray(textModels) ? textModels : [];
        const allVision = vision.map(m => (typeof m === 'string' ? { name: m } : m));
        const allText = text.map(m => (typeof m === 'string' ? { name: m } : m));
        const hasSize = (allVision[0] || allText[0])?.size != null;

        // When model objects include a `size` property (Ollama reports model file size),
        // prefer the largest model as a proxy for "most capable". Otherwise keep the
        // provider's default ordering (typically newest/recommended first).
        const pickBest = (arr) => {
            if (arr.length === 0) return null;
            const sorted = hasSize ? [...arr].sort((a, b) => (b.size || 0) - (a.size || 0)) : arr;
            const m = sorted[0];
            return m?.name || m;
        };

        if (taskType === 'vision') {
            const model = pickBest(allVision) || pickBest(allText);
            return model ? { model, type: allVision.length ? 'vision' : 'text' } : null;
        }
        const model = pickBest(allText) || pickBest(allVision);
        return model ? { model, type: allText.length ? 'text' : 'vision' } : null;
    } catch (err) {
        log.warn({ event: 'llm_find_best_model_error', providerId, taskType, reason: err.message }, 'findBestModel error');
        return null;
    }
}

/**
 * Unload models from memory (Ollama-only; no-op for other providers)
 * @param {string} providerId - Provider identifier
 * @param {string[]} modelNames - Model names to unload
 * @param {object} providerConfig - Provider configuration
 * @returns {Promise<{success: boolean, unloaded: string[], errors: object}>}
 */
async function unloadModels(providerId, modelNames, providerConfig = {}) {
    if (providerId !== 'ollama' || !modelNames?.length) {
        return { success: true, unloaded: [], errors: {} };
    }
    try {
        const client = getClient(providerId, providerConfig);
        if (typeof client.unloadModels === 'function') {
            return await client.unloadModels(modelNames);
        }
    } catch (err) {
        log.warn({ event: 'llm_unload_models_error', providerId, reason: err.message }, 'unloadModels error');
        return { success: false, unloaded: [], errors: { [modelNames[0]]: err.message } };
    }
    return { success: true, unloaded: [], errors: {} };
}

/**
 * Pull/download a model (Ollama-only; no-op for other providers)
 * @param {string} providerId - Provider identifier
 * @param {string} modelName - Model name to pull
 * @param {object} providerConfig - Provider configuration
 * @param {function} onProgress - Optional progress callback
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function pullModel(providerId, modelName, providerConfig = {}, onProgress = null) {
    if (providerId !== 'ollama' || !modelName) {
        return { success: false, error: 'pullModel is only supported for Ollama' };
    }
    try {
        const client = getClient(providerId, providerConfig);
        if (typeof client.pullModel === 'function') {
            return await client.pullModel(modelName, onProgress);
        }
    } catch (err) {
        log.warn({ event: 'llm_pull_model_error', providerId, modelName, reason: err.message }, 'pullModel error');
        return { success: false, error: err.message };
    }
    return { success: false, error: 'Provider does not support pullModel' };
}

module.exports = {
    getProviders,
    getClient,
    clearCache,
    testConnection,
    listModels,
    generateText,
    generateTextQueued,
    generateVision,
    embed,
    isProviderConfigured,
    getProviderCapabilities,
    getModelInfo,
    isVisionModel,
    findBestModel,
    unloadModels,
    pullModel,
    isQueueEnabled,
    setQueueEnabled,
    costTracker,
    PROVIDERS
};
