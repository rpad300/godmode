/**
 * LLM Abstraction Layer
 * Provides a unified interface for multiple LLM providers
 */

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
        
        // Log the operation
        const latency = Date.now() - startTime;
        console.log(`[LLM] generateText: provider=${provider}, model=${rest.model}, context=${context || 'none'}, latency=${latency}ms, success=${result.success}`);
        if (result.usage) {
            console.log(`[LLM] Token usage: input=${result.usage.inputTokens}, output=${result.usage.outputTokens}`);
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
        console.error(`[LLM] generateText error: provider=${provider}, error=${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// Queue enabled flag (can be disabled for debugging)
let queueEnabled = true;

/**
 * Check if queue is enabled
 */
function isQueueEnabled() {
    return queueEnabled;
}

/**
 * Enable or disable the LLM queue
 */
function setQueueEnabled(enabled) {
    queueEnabled = enabled;
    console.log(`[LLM] Queue ${enabled ? 'enabled' : 'disabled'}`);
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
        console.log(`[LLM] generateVision: provider=${provider}, model=${rest.model}, context=${context || 'none'}, images=${rest.images?.length || 0}, latency=${latency}ms, success=${result.success}`);
        
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
        console.error(`[LLM] generateVision error: provider=${provider}, error=${error.message}`);
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
        console.log(`[LLM] embed: provider=${provider}, model=${rest.model}, context=${context || 'none'}, texts=${rest.texts?.length || 0}, latency=${latency}ms, success=${result.success}`);
        
        // Track costs (embeddings are input-only)
        // Estimate tokens: ~4 chars per token average
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
        console.error(`[LLM] embed error: provider=${provider}, error=${error.message}`);
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
    isQueueEnabled,
    setQueueEnabled,
    costTracker,
    PROVIDERS
};
