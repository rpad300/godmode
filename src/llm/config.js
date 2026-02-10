/**
 * LLM Configuration Manager
 * Centralized access to LLM settings from admin panel / system config
 * NEVER hardcode provider or model names - always use this module
 */

const { logger: rootLogger } = require('../logger');
const log = rootLogger.child({ module: 'llm_config' });

// Cache for config to avoid repeated lookups
let configCache = null;
let configCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get LLM configuration from the application config
 * This should be called with the current config object
 * @param {object} appConfig - The application config object
 * @returns {object} LLM configuration with safe defaults
 */
function getLLMConfig(appConfig) {
    if (!appConfig) {
        log.warn({ event: 'llm_config_empty' }, 'No config provided, using empty defaults');
        return getEmptyConfig();
    }
    
    const llm = appConfig.llm || {};
    const ollama = appConfig.ollama || {};
    
    return {
        // Primary provider (from admin settings)
        provider: llm.perTask?.text?.provider || llm.provider || llm.defaultProvider || null,
        
        // Models by task type
        models: {
            text: llm.perTask?.text?.model || llm.models?.text || ollama.model || null,
            vision: llm.perTask?.vision?.model || llm.models?.vision || ollama.visionModel || null,
            embeddings: llm.perTask?.embeddings?.model || llm.models?.embeddings || null,
            reasoning: llm.models?.reasoning || ollama.reasoningModel || llm.perTask?.text?.model || llm.models?.text || null
        },
        
        // Providers by task type
        providers: {
            text: llm.perTask?.text?.provider || llm.provider || null,
            vision: llm.perTask?.vision?.provider || llm.provider || null,
            embeddings: llm.perTask?.embeddings?.provider || llm.embeddingsProvider || null
        },
        
        // Full providers config (with API keys)
        providerConfigs: llm.providers || {},
        
        // Routing mode
        routingMode: llm.routing?.mode || 'single',
        
        // Check if any provider is configured
        hasConfiguredProvider: () => {
            const providers = llm.providers || {};
            return Object.values(providers).some(p => p.apiKey || p.isConfigured);
        },
        
        // Get provider config by ID
        getProviderConfig: (providerId) => {
            return llm.providers?.[providerId] || {};
        }
    };
}

/**
 * Get empty config (when no config is available)
 */
function getEmptyConfig() {
    return {
        provider: null,
        models: { text: null, vision: null, embeddings: null, reasoning: null },
        providers: { text: null, vision: null, embeddings: null },
        providerConfigs: {},
        routingMode: 'single',
        hasConfiguredProvider: () => false,
        getProviderConfig: () => ({})
    };
}

/**
 * Get text generation config
 * @param {object} appConfig - Application config
 * @param {object} overrides - Optional overrides (from request body, etc.)
 * @returns {object} { provider, providerConfig, model }
 */
function getTextConfig(appConfig, overrides = {}) {
    const cfg = getLLMConfig(appConfig);
    
    const provider = overrides.provider || cfg.providers.text;
    const model = overrides.model || cfg.models.text;
    const providerConfig = cfg.getProviderConfig(provider);
    
    if (!provider) log.warn({ event: 'llm_config_missing_text_provider' }, 'No text provider configured');
    if (!model) log.warn({ event: 'llm_config_missing_text_model' }, 'No text model configured');
    return { provider, providerConfig, model };
}

/**
 * Get text config for reasoning/suggest tasks (prefers reasoning model when set).
 * Works with any configured provider: Ollama (legacy or via LLM panel), OpenAI, DeepSeek, etc.
 * Single source of truth for action-suggest, decision-suggest, risk-suggest, fact-check, decision-check flows.
 * @param {object} appConfig - Application config
 * @returns {object|null} { provider, providerConfig, model } or null if none configured
 */
function getTextConfigForReasoning(appConfig) {
    if (!appConfig) return null;
    const cfg = getLLMConfig(appConfig);
    const model = cfg.models?.reasoning || cfg.models?.text || null;
    const provider = cfg.providers?.text || (appConfig.ollama?.model || appConfig.ollama?.reasoningModel ? 'ollama' : null);
    if (!provider || !model) return null;
    let providerConfig = cfg.getProviderConfig(provider) || {};
    if (provider === 'ollama' && (!providerConfig.host || !providerConfig.port)) {
        providerConfig = {
            host: appConfig.ollama?.host || '127.0.0.1',
            port: appConfig.ollama?.port || 11434,
            ...providerConfig
        };
    }
    return { provider, model, providerConfig };
}

/**
 * Get vision generation config
 * @param {object} appConfig - Application config
 * @param {object} overrides - Optional overrides
 * @returns {object} { provider, providerConfig, model }
 */
function getVisionConfig(appConfig, overrides = {}) {
    const cfg = getLLMConfig(appConfig);
    
    let provider = overrides.provider || cfg.providers.vision || (appConfig.ollama?.visionModel ? 'ollama' : null);
    const model = overrides.model || cfg.models.vision || (provider === 'ollama' ? appConfig.ollama?.visionModel : null);
    let providerConfig = cfg.getProviderConfig(provider) || {};
    if (provider === 'ollama' && (!providerConfig.host || !providerConfig.port)) {
        providerConfig = {
            host: appConfig.ollama?.host || '127.0.0.1',
            port: appConfig.ollama?.port || 11434,
            ...providerConfig
        };
    }
    if (!provider) log.warn({ event: 'llm_config_missing_vision_provider' }, 'No vision provider configured');
    if (!model) log.warn({ event: 'llm_config_missing_vision_model' }, 'No vision model configured');
    return { provider, providerConfig, model };
}

/**
 * Get embeddings config
 * @param {object} appConfig - Application config
 * @param {object} overrides - Optional overrides
 * @returns {object} { provider, providerConfig, model }
 */
function getEmbeddingsConfig(appConfig, overrides = {}) {
    const cfg = getLLMConfig(appConfig);
    
    const provider = overrides.provider || cfg.providers.embeddings || (appConfig.ollama?.model ? 'ollama' : null);
    const model = overrides.model || cfg.models.embeddings || (provider === 'ollama' ? (appConfig.ollama?.model || 'mxbai-embed-large') : null);
    let providerConfig = cfg.getProviderConfig(provider) || {};
    if (provider === 'ollama' && (!providerConfig.host || !providerConfig.port)) {
        providerConfig = {
            host: appConfig.ollama?.host || '127.0.0.1',
            port: appConfig.ollama?.port || 11434,
            ...providerConfig
        };
    }
    if (!provider) log.warn({ event: 'llm_config_missing_embeddings_provider' }, 'No embeddings provider configured');
    if (!model) log.warn({ event: 'llm_config_missing_embeddings_model' }, 'No embeddings model configured');
    return { provider, providerConfig, model };
}

/**
 * Validate that required LLM config is present
 * @param {object} appConfig - Application config
 * @param {string} taskType - 'text', 'vision', or 'embeddings'
 * @returns {{ valid: boolean, error?: string }}
 */
function validateConfig(appConfig, taskType = 'text') {
    const cfg = getLLMConfig(appConfig);
    
    const provider = cfg.providers[taskType];
    const model = cfg.models[taskType];
    
    if (!provider) {
        return { 
            valid: false, 
            error: `No ${taskType} provider configured. Please configure LLM settings in the Admin Panel.`
        };
    }
    
    if (!model) {
        return { 
            valid: false, 
            error: `No ${taskType} model configured. Please configure LLM settings in the Admin Panel.`
        };
    }
    
    // Check if provider has API key (except for ollama which doesn't need one)
    if (provider !== 'ollama') {
        const providerConfig = cfg.getProviderConfig(provider);
        if (!providerConfig.apiKey) {
            return {
                valid: false,
                error: `No API key configured for ${provider}. Please add the API key in the Admin Panel.`
            };
        }
    }
    
    return { valid: true };
}

/**
 * Get a human-readable summary of current LLM config
 * @param {object} appConfig - Application config
 * @returns {string}
 */
function getConfigSummary(appConfig) {
    const cfg = getLLMConfig(appConfig);
    
    const lines = [
        `Text: ${cfg.providers.text || 'NOT SET'} / ${cfg.models.text || 'NOT SET'}`,
        `Vision: ${cfg.providers.vision || 'NOT SET'} / ${cfg.models.vision || 'NOT SET'}`,
        `Embeddings: ${cfg.providers.embeddings || 'NOT SET'} / ${cfg.models.embeddings || 'NOT SET'}`
    ];
    
    return lines.join(', ');
}

module.exports = {
    getLLMConfig,
    getTextConfig,
    getTextConfigForReasoning,
    getVisionConfig,
    getEmbeddingsConfig,
    validateConfig,
    getConfigSummary
};
