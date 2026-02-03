/**
 * LLM Configuration Manager
 * Centralized access to LLM settings from admin panel / system config
 * NEVER hardcode provider or model names - always use this module
 */

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
        console.warn('[LLMConfig] No config provided, using empty defaults');
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
            reasoning: ollama.reasoningModel || llm.perTask?.text?.model || llm.models?.text || null
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
    
    if (!provider) {
        console.warn('[LLMConfig] No text provider configured in admin settings');
    }
    if (!model) {
        console.warn('[LLMConfig] No text model configured in admin settings');
    }
    
    return { provider, providerConfig, model };
}

/**
 * Get vision generation config
 * @param {object} appConfig - Application config
 * @param {object} overrides - Optional overrides
 * @returns {object} { provider, providerConfig, model }
 */
function getVisionConfig(appConfig, overrides = {}) {
    const cfg = getLLMConfig(appConfig);
    
    const provider = overrides.provider || cfg.providers.vision;
    const model = overrides.model || cfg.models.vision;
    const providerConfig = cfg.getProviderConfig(provider);
    
    if (!provider) {
        console.warn('[LLMConfig] No vision provider configured in admin settings');
    }
    if (!model) {
        console.warn('[LLMConfig] No vision model configured in admin settings');
    }
    
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
    
    const provider = overrides.provider || cfg.providers.embeddings;
    const model = overrides.model || cfg.models.embeddings;
    const providerConfig = cfg.getProviderConfig(provider);
    
    if (!provider) {
        console.warn('[LLMConfig] No embeddings provider configured in admin settings');
    }
    if (!model) {
        console.warn('[LLMConfig] No embeddings model configured in admin settings');
    }
    
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
    getVisionConfig,
    getEmbeddingsConfig,
    validateConfig,
    getConfigSummary
};
