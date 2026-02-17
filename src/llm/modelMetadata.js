/**
 * Purpose:
 *   Authoritative registry of model capabilities (context window, max output tokens,
 *   vision/JSON-mode/embeddings support) and per-million-token pricing. Serves as the
 *   fallback when a provider's API does not expose this metadata directly.
 *
 * Responsibilities:
 *   - MODEL_MAPPINGS: static lookup table covering OpenAI, Gemini, Claude, Grok,
 *     DeepSeek, Kimi, MiniMax, and common Ollama models (updated Jan 2026)
 *   - getModelMetadata: resolves metadata for a (provider, modelId) pair by checking
 *     the in-memory cache, then the static mappings, with optional user overrides
 *   - Fuzzy matching via findInMappings: handles version suffixes (:latest), casing
 *     differences, and prefix/suffix relationships between model IDs
 *   - enrichModelList: augments a provider's raw model list with capability and pricing info
 *   - updateFromApiResponse: merges live API data (context_length, max_output_tokens)
 *     into the cache, superseding static mappings for that model
 *   - calculateCost / formatPrice / getPriceDisplay: cost utilities consumed by the
 *     queue manager and admin UI
 *
 * Key dependencies:
 *   - None (self-contained; only uses built-in Map for caching)
 *
 * Side effects:
 *   - Mutates an in-memory metadataCache (Map) with a 24-hour TTL per entry
 *
 * Notes:
 *   - Pricing in MODEL_MAPPINGS may drift from actual provider pricing over time.
 *     The costTracker module maintains its own MODEL_PRICING table which may differ;
 *     Assumption: both tables should be kept in sync manually on pricing updates.
 *   - Ollama models are listed here for context-window awareness but are priced at $0.
 *   - getKnownModelsForProvider uses hard-coded prefix lists to associate models with
 *     providers; this will need updating when new provider model families are added.
 */

// Known model context windows, capabilities, and pricing (fallback when API doesn't provide)
// Prices are in USD per 1M tokens (input/output)
const MODEL_MAPPINGS = {
    // OpenAI models (prices as of Jan 2026)
    // GPT-5 series (latest)
    'gpt-5.2': { contextTokens: 1000000, maxOutputTokens: 65536, supportsVision: true, supportsJsonMode: true, priceInput: 2.50, priceOutput: 10.00 },
    'gpt-5.1': { contextTokens: 1000000, maxOutputTokens: 65536, supportsVision: true, supportsJsonMode: true, priceInput: 2.50, priceOutput: 10.00 },
    'gpt-5': { contextTokens: 1000000, maxOutputTokens: 65536, supportsVision: true, supportsJsonMode: true, priceInput: 3.00, priceOutput: 12.00 },
    'gpt-5-instant': { contextTokens: 1000000, maxOutputTokens: 32768, supportsVision: true, supportsJsonMode: true, priceInput: 1.50, priceOutput: 6.00 },
    'gpt-5-thinking': { contextTokens: 1000000, maxOutputTokens: 65536, supportsVision: true, supportsJsonMode: true, priceInput: 5.00, priceOutput: 20.00 },
    // GPT-4.1 series
    'gpt-4.1': { contextTokens: 1047576, maxOutputTokens: 32768, supportsVision: true, supportsJsonMode: true, priceInput: 2.00, priceOutput: 8.00 },
    'gpt-4.1-mini': { contextTokens: 1047576, maxOutputTokens: 32768, supportsVision: true, supportsJsonMode: true, priceInput: 0.40, priceOutput: 1.60 },
    'gpt-4.1-nano': { contextTokens: 1047576, maxOutputTokens: 32768, supportsVision: true, supportsJsonMode: true, priceInput: 0.10, priceOutput: 0.40 },
    'gpt-4.5-preview': { contextTokens: 128000, maxOutputTokens: 16384, supportsVision: true, supportsJsonMode: true, priceInput: 75.00, priceOutput: 150.00 },
    'gpt-4o': { contextTokens: 128000, maxOutputTokens: 16384, supportsVision: true, supportsJsonMode: true, priceInput: 2.50, priceOutput: 10.00 },
    'gpt-4o-mini': { contextTokens: 128000, maxOutputTokens: 16384, supportsVision: true, supportsJsonMode: true, priceInput: 0.15, priceOutput: 0.60 },
    'gpt-4-turbo': { contextTokens: 128000, maxOutputTokens: 4096, supportsVision: true, supportsJsonMode: true, priceInput: 10.00, priceOutput: 30.00 },
    'gpt-4-turbo-preview': { contextTokens: 128000, maxOutputTokens: 4096, supportsVision: false, supportsJsonMode: true, priceInput: 10.00, priceOutput: 30.00 },
    'gpt-4': { contextTokens: 8192, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: false, priceInput: 30.00, priceOutput: 60.00 },
    'gpt-4-32k': { contextTokens: 32768, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: false, priceInput: 60.00, priceOutput: 120.00 },
    'gpt-3.5-turbo': { contextTokens: 16385, maxOutputTokens: 4096, supportsVision: false, supportsJsonMode: true, priceInput: 0.50, priceOutput: 1.50 },
    'gpt-3.5-turbo-16k': { contextTokens: 16385, maxOutputTokens: 4096, supportsVision: false, supportsJsonMode: true, priceInput: 3.00, priceOutput: 4.00 },
    'o1': { contextTokens: 200000, maxOutputTokens: 100000, supportsVision: true, supportsJsonMode: false, priceInput: 15.00, priceOutput: 60.00 },
    'o1-mini': { contextTokens: 128000, maxOutputTokens: 65536, supportsVision: false, supportsJsonMode: false, priceInput: 3.00, priceOutput: 12.00 },
    'o1-preview': { contextTokens: 128000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: false, priceInput: 15.00, priceOutput: 60.00 },
    'o1-pro': { contextTokens: 200000, maxOutputTokens: 100000, supportsVision: true, supportsJsonMode: true, priceInput: 150.00, priceOutput: 600.00 },
    'o3': { contextTokens: 200000, maxOutputTokens: 100000, supportsVision: true, supportsJsonMode: true, priceInput: 10.00, priceOutput: 40.00 },
    'o3-mini': { contextTokens: 200000, maxOutputTokens: 100000, supportsVision: false, supportsJsonMode: true, priceInput: 1.10, priceOutput: 4.40 },
    'o4-mini': { contextTokens: 200000, maxOutputTokens: 100000, supportsVision: true, supportsJsonMode: true, priceInput: 1.10, priceOutput: 4.40 },
    'text-embedding-3-small': { contextTokens: 8191, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0.02, priceOutput: 0 },
    'text-embedding-3-large': { contextTokens: 8191, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0.13, priceOutput: 0 },
    'text-embedding-ada-002': { contextTokens: 8191, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0.10, priceOutput: 0 },

    // Google Gemini models (prices as of Jan 2026)
    'gemini-1.5-pro': { contextTokens: 2097152, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 1.25, priceOutput: 5.00 },
    'gemini-1.5-flash': { contextTokens: 1048576, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0.075, priceOutput: 0.30 },
    'gemini-1.5-flash-8b': { contextTokens: 1048576, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0.0375, priceOutput: 0.15 },
    'gemini-2.0-flash': { contextTokens: 1048576, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0.10, priceOutput: 0.40 },
    'gemini-2.0-flash-exp': { contextTokens: 1048576, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'gemini-pro': { contextTokens: 32760, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0.50, priceOutput: 1.50 },
    'gemini-pro-vision': { contextTokens: 16384, maxOutputTokens: 2048, supportsVision: true, supportsJsonMode: false, priceInput: 0.50, priceOutput: 1.50 },
    'text-embedding-004': { contextTokens: 2048, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0.025, priceOutput: 0 },

    // Claude models (prices as of Jan 2026)
    'claude-sonnet-4-20250514': { contextTokens: 200000, maxOutputTokens: 16000, supportsVision: true, supportsJsonMode: false, priceInput: 3.00, priceOutput: 15.00 },
    'claude-3-5-sonnet-20241022': { contextTokens: 200000, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: false, priceInput: 3.00, priceOutput: 15.00 },
    'claude-3-5-haiku-20241022': { contextTokens: 200000, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: false, priceInput: 0.80, priceOutput: 4.00 },
    'claude-3-opus-20240229': { contextTokens: 200000, maxOutputTokens: 4096, supportsVision: true, supportsJsonMode: false, priceInput: 15.00, priceOutput: 75.00 },
    'claude-3-sonnet-20240229': { contextTokens: 200000, maxOutputTokens: 4096, supportsVision: true, supportsJsonMode: false, priceInput: 3.00, priceOutput: 15.00 },
    'claude-3-haiku-20240307': { contextTokens: 200000, maxOutputTokens: 4096, supportsVision: true, supportsJsonMode: false, priceInput: 0.25, priceOutput: 1.25 },

    // Grok models (xAI) - Updated Jan 2026
    'grok-4-1-fast-reasoning': { contextTokens: 2000000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 3.00, priceOutput: 15.00 },
    'grok-4-1-fast-non-reasoning': { contextTokens: 2000000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 3.00, priceOutput: 15.00 },
    'grok-4-fast-reasoning': { contextTokens: 2000000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 3.00, priceOutput: 15.00 },
    'grok-4-fast-non-reasoning': { contextTokens: 2000000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 3.00, priceOutput: 15.00 },
    'grok-4-0709': { contextTokens: 256000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 5.00, priceOutput: 25.00 },
    'grok-code-fast-1': { contextTokens: 256000, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 2.00, priceOutput: 10.00 },
    'grok-3': { contextTokens: 131072, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 3.00, priceOutput: 15.00 },
    'grok-3-mini': { contextTokens: 131072, maxOutputTokens: 32768, supportsVision: false, supportsJsonMode: true, priceInput: 0.30, priceOutput: 0.50 },
    'grok-2-vision-1212': { contextTokens: 32768, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 2.00, priceOutput: 10.00 },
    'grok-2-image-1212': { contextTokens: 32768, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: false, priceInput: 2.00, priceOutput: 10.00 },
    'grok-embedding-v1': { contextTokens: 8192, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0.02, priceOutput: 0 },

    // DeepSeek models
    'deepseek-chat': { contextTokens: 64000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0.14, priceOutput: 0.28 },
    'deepseek-reasoner': { contextTokens: 64000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0.55, priceOutput: 2.19 },

    // Kimi K2 models
    'kimi-k2': { contextTokens: 128000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0.60, priceOutput: 2.40 },
    'kimi-k2-0905': { contextTokens: 256000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0.60, priceOutput: 2.40 },
    'kimi-k2-thinking': { contextTokens: 256000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0.60, priceOutput: 2.40 },

    // MiniMax models
    'MiniMax-M2': { contextTokens: 204800, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0.50, priceOutput: 2.00 },
    'MiniMax-M2-Stable': { contextTokens: 204800, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0.50, priceOutput: 2.00 },

    // Common Ollama models (free - local)
    'qwen3:30b': { contextTokens: 40960, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'qwen3:14b': { contextTokens: 40960, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'qwen3:8b': { contextTokens: 40960, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'qwen3:4b': { contextTokens: 40960, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'qwen3-vl:8b': { contextTokens: 32768, maxOutputTokens: 8192, supportsVision: true, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'llama3.2:3b': { contextTokens: 128000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'llama3.2:1b': { contextTokens: 128000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'llama3.1:8b': { contextTokens: 128000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'llama3.1:70b': { contextTokens: 128000, maxOutputTokens: 8192, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'llama3': { contextTokens: 8192, maxOutputTokens: 4096, supportsVision: false, supportsJsonMode: true, priceInput: 0, priceOutput: 0 },
    'llava:7b': { contextTokens: 4096, maxOutputTokens: 2048, supportsVision: true, supportsJsonMode: false, priceInput: 0, priceOutput: 0 },
    'llava': { contextTokens: 4096, maxOutputTokens: 2048, supportsVision: true, supportsJsonMode: false, priceInput: 0, priceOutput: 0 },
    'granite3.2-vision': { contextTokens: 8192, maxOutputTokens: 4096, supportsVision: true, supportsJsonMode: false, priceInput: 0, priceOutput: 0 },
    'mxbai-embed-large': { contextTokens: 512, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0, priceOutput: 0 },
    'nomic-embed-text': { contextTokens: 8192, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0, priceOutput: 0 },
    'snowflake-arctic-embed:l': { contextTokens: 512, maxOutputTokens: null, supportsEmbeddings: true, priceInput: 0, priceOutput: 0 }
};

/**
 * Format price for display
 * @param {number} pricePerMillion - Price per 1M tokens
 * @returns {string} Formatted price string
 */
function formatPrice(pricePerMillion) {
    if (pricePerMillion === 0) return 'Free';
    if (pricePerMillion === null || pricePerMillion === undefined) return 'N/A';
    if (pricePerMillion < 0.01) return `~$${(pricePerMillion * 1000).toFixed(2)}/1K`;
    if (pricePerMillion < 1) return `~$${pricePerMillion.toFixed(2)}/1M`;
    return `~$${pricePerMillion.toFixed(0)}/1M`;
}

/**
 * Get price display string for a model
 * @param {string} modelId - Model ID
 * @returns {string} Price display string
 */
function getPriceDisplay(modelId) {
    const model = MODEL_MAPPINGS[modelId];
    if (!model) return 'N/A';
    if (model.priceInput === 0 && model.priceOutput === 0) return 'Free';
    return formatPrice(model.priceInput);
}

/**
 * Calculate estimated cost for a request
 * @param {string} modelId - Model ID
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Estimated cost in USD
 */
function calculateCost(modelId, inputTokens, outputTokens) {
    const model = MODEL_MAPPINGS[modelId];
    if (!model) return 0;
    
    const inputCost = (inputTokens / 1000000) * (model.priceInput || 0);
    const outputCost = (outputTokens / 1000000) * (model.priceOutput || 0);
    
    return inputCost + outputCost;
}

// Cache for model metadata (in-memory with TTL)
const metadataCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cache key for model
 */
function getCacheKey(provider, modelId) {
    return `${provider}:${modelId}`;
}

/**
 * Get cached metadata
 */
function getCached(provider, modelId) {
    const key = getCacheKey(provider, modelId);
    const cached = metadataCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    
    return null;
}

/**
 * Set cached metadata
 */
function setCache(provider, modelId, data) {
    const key = getCacheKey(provider, modelId);
    metadataCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Clear cache for a provider or all
 */
function clearCache(provider = null) {
    if (provider) {
        for (const key of metadataCache.keys()) {
            if (key.startsWith(`${provider}:`)) {
                metadataCache.delete(key);
            }
        }
    } else {
        metadataCache.clear();
    }
}

/**
 * Normalize model ID for lookup.
 * Strips Ollama-style version tags (e.g. ":latest", ":v1") and lowercases so that
 * "Llama3:latest" matches "llama3" in MODEL_MAPPINGS.
 */
function normalizeModelId(modelId) {
    if (!modelId) return '';
    let normalized = modelId.split(':')[0];
    return normalized.toLowerCase();
}

/**
 * Find model in mappings with progressively looser matching.
 * Order: exact -> lowercase -> normalized (no version tag) -> prefix match.
 * This is intentionally permissive to handle the wide variety of model ID formats
 * returned by different provider APIs (e.g. "gpt-4o-2024-05-13" should match "gpt-4o").
 */
function findInMappings(modelId) {
    if (!modelId) return null;
    
    // Direct match
    if (MODEL_MAPPINGS[modelId]) {
        return MODEL_MAPPINGS[modelId];
    }
    
    // Lowercase match
    const lower = modelId.toLowerCase();
    if (MODEL_MAPPINGS[lower]) {
        return MODEL_MAPPINGS[lower];
    }
    
    // Partial match (for versioned models)
    const normalized = normalizeModelId(modelId);
    for (const [key, value] of Object.entries(MODEL_MAPPINGS)) {
        if (normalizeModelId(key) === normalized) {
            return value;
        }
        // Check if modelId starts with key or vice versa
        if (modelId.startsWith(key) || key.startsWith(modelId)) {
            return value;
        }
    }
    
    return null;
}

/**
 * Get model metadata (from cache, mappings, or defaults)
 * @param {string} provider - Provider ID
 * @param {string} modelId - Model ID
 * @param {object} userOverrides - User-defined overrides from config
 * @returns {object} Model metadata
 */
function getModelMetadata(provider, modelId, userOverrides = {}) {
    // Check cache first
    const cached = getCached(provider, modelId);
    if (cached) {
        return { ...cached, ...userOverrides };
    }
    
    // Look up in mappings
    const mapped = findInMappings(modelId);
    
    // Build metadata
    const metadata = {
        id: modelId,
        provider,
        contextTokens: mapped?.contextTokens || null,
        maxOutputTokens: mapped?.maxOutputTokens || null,
        supportsVision: mapped?.supportsVision || false,
        supportsJsonMode: mapped?.supportsJsonMode || false,
        supportsEmbeddings: mapped?.supportsEmbeddings || false,
        source: mapped ? 'mapping' : 'unknown',
        ...userOverrides
    };
    
    // Cache it
    setCache(provider, modelId, metadata);
    
    return metadata;
}

/**
 * Enrich model list with metadata
 * @param {string} provider - Provider ID
 * @param {Array} models - Array of model objects with 'name' property
 * @param {object} userOverrides - User overrides keyed by modelId
 * @returns {Array} Enriched model list
 */
function enrichModelList(provider, models, userOverrides = {}) {
    return models.map(model => {
        const modelId = model.name || model.id;
        const override = userOverrides[`${provider}:${modelId}`] || {};
        const metadata = getModelMetadata(provider, modelId, override);
        
        // Get pricing from mappings
        const mapped = findInMappings(modelId);
        
        return {
            ...model,
            id: modelId,
            label: model.displayName || model.description || modelId,
            contextTokens: metadata.contextTokens,
            maxOutputTokens: metadata.maxOutputTokens,
            supportsVision: metadata.supportsVision,
            supportsJsonMode: metadata.supportsJsonMode,
            supportsEmbeddings: metadata.supportsEmbeddings,
            priceInput: mapped?.priceInput ?? null,
            priceOutput: mapped?.priceOutput ?? null,
            priceDisplay: mapped ? getPriceDisplay(modelId) : 'N/A'
        };
    });
}

/**
 * Update cache from API response
 */
function updateFromApiResponse(provider, modelId, apiData) {
    const existing = getCached(provider, modelId) || findInMappings(modelId) || {};
    
    const metadata = {
        ...existing,
        id: modelId,
        provider,
        source: 'api'
    };
    
    // Extract context window from various API formats
    if (apiData.context_length) {
        metadata.contextTokens = apiData.context_length;
    } else if (apiData.context_window) {
        metadata.contextTokens = apiData.context_window;
    } else if (apiData.inputTokenLimit) {
        metadata.contextTokens = apiData.inputTokenLimit;
    }
    
    if (apiData.max_output_tokens) {
        metadata.maxOutputTokens = apiData.max_output_tokens;
    } else if (apiData.outputTokenLimit) {
        metadata.maxOutputTokens = apiData.outputTokenLimit;
    }
    
    setCache(provider, modelId, metadata);
    return metadata;
}

/**
 * Get all known models for a provider from mappings
 */
function getKnownModelsForProvider(provider) {
    const providerPrefixes = {
        openai: ['gpt-', 'o1', 'o3', 'text-embedding'],
        gemini: ['gemini-', 'text-embedding-004'],
        claude: ['claude-'],
        grok: ['grok-'],
        deepseek: ['deepseek-'],
        kimi: ['kimi-'],
        minimax: ['MiniMax-', 'minimax-'],
        ollama: [] // Ollama models are dynamic
    };
    
    const prefixes = providerPrefixes[provider] || [];
    const models = [];
    
    for (const [modelId, metadata] of Object.entries(MODEL_MAPPINGS)) {
        const matchesProvider = prefixes.some(prefix => 
            modelId.toLowerCase().startsWith(prefix.toLowerCase())
        );
        
        if (matchesProvider || provider === 'ollama') {
            models.push({
                id: modelId,
                ...metadata
            });
        }
    }
    
    return models;
}

module.exports = {
    MODEL_MAPPINGS,
    getModelMetadata,
    enrichModelList,
    getCached,
    setCache,
    clearCache,
    updateFromApiResponse,
    getKnownModelsForProvider,
    normalizeModelId,
    formatPrice,
    getPriceDisplay,
    calculateCost
};
