/**
 * System Config Module
 * Manages global system-level configuration
 * Only superadmin can write, all authenticated can read
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'system-config' });

// Default configurations (used when database is empty)
const DEFAULTS = {
    llm_pertask: {
        text: { provider: 'ollama', model: null },
        vision: { provider: 'ollama', model: null },
        embeddings: { provider: 'ollama', model: null }
    },
    prompts: {
        document: '',
        vision: '',
        transcript: '',
        email: ''
    },
    processing: {
        chunkSize: 4000,
        chunkOverlap: 200,
        similarityThreshold: 0.90,
        pdfToImages: true
    },
    graph: {
        enabled: false,
        provider: 'supabase',
        graphName: 'godmode'
    },
    routing: {
        mode: 'single',
        perTask: {
            chat: { priorities: ['ollama'], maxAttempts: 3, timeoutMs: 45000 },
            processing: { priorities: ['ollama'], maxAttempts: 3, timeoutMs: 120000 }
        }
    },
    tokenPolicy: {
        enforce: true,
        defaultMaxOutputTokens: 4096,
        defaultReservedForSystem: 500,
        defaultReservedForRag: 2000,
        perTask: {
            chat: { reservedForRag: 3000, maxOutputTokens: 2048 },
            processing: { maxOutputTokens: 4096, reservedForRag: 1000 }
        },
        perModel: {}
    },
    presets: {
        economy: {
            text: { provider: 'ollama', model: 'llama3' },
            vision: { provider: 'ollama', model: 'llava' },
            embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        balanced: {
            text: { provider: 'openai', model: 'gpt-4o-mini' },
            vision: { provider: 'google', model: 'gemini-1.5-flash' },
            embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        quality: {
            text: { provider: 'openai', model: 'gpt-4o' },
            vision: { provider: 'google', model: 'gemini-1.5-pro' },
            embeddings: { provider: 'openai', model: 'text-embedding-3-large' }
        }
    }
};

// Cache for system config
let configCache = null;
let cacheExpiry = null;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Get a system config value by key
 */
async function getSystemConfig(key) {
    const supabase = getAdminClient();
    if (!supabase) {
        // Return default if no Supabase
        return { success: true, value: DEFAULTS[key] || null, source: 'default' };
    }

    try {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', key)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found, return default
                return { success: true, value: DEFAULTS[key] || null, source: 'default' };
            }
            throw error;
        }

        return { success: true, value: data.value, source: 'database' };
    } catch (error) {
        log.warn({ event: 'system_config_get_error', reason: error?.message }, 'Get config error');
        // Return default on error
        return { success: true, value: DEFAULTS[key] || null, source: 'default' };
    }
}

/**
 * Get all system configs
 * Uses cache to minimize database calls
 */
async function getAllSystemConfigs() {
    // Check cache
    if (configCache && cacheExpiry && Date.now() < cacheExpiry) {
        return { success: true, configs: configCache, source: 'cache' };
    }

    const supabase = getAdminClient();
    if (!supabase) {
        return { success: true, configs: DEFAULTS, source: 'default' };
    }

    try {
        const { data, error } = await supabase
            .from('system_config')
            .select('key, value, description, updated_at');

        if (error) throw error;

        // Build config object, merging with defaults
        const configs = { ...DEFAULTS };
        for (const row of data || []) {
            configs[row.key] = row.value;
        }

        // Update cache
        configCache = configs;
        cacheExpiry = Date.now() + CACHE_TTL_MS;

        return { success: true, configs, source: 'database' };
    } catch (error) {
        log.warn({ event: 'system_config_get_all_error', reason: error?.message }, 'Get all configs error');
        return { success: true, configs: DEFAULTS, source: 'default' };
    }
}

/**
 * Set a system config value
 * Only superadmin should call this (enforced by RLS)
 */
async function setSystemConfig(key, value, userId = null, description = null) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data, error } = await supabase
            .from('system_config')
            .upsert({
                key,
                value,
                description: description || DEFAULTS[key] ? `System default for ${key}` : null,
                updated_by: userId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })
            .select()
            .single();

        if (error) throw error;

        // Invalidate cache
        configCache = null;
        cacheExpiry = null;

        return { success: true, config: data };
    } catch (error) {
        log.warn({ event: 'system_config_set_error', reason: error?.message }, 'Set config error');
        return { success: false, error: error.message };
    }
}

/**
 * Delete a system config (revert to default)
 */
async function deleteSystemConfig(key) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabase
            .from('system_config')
            .delete()
            .eq('key', key);

        if (error) throw error;

        // Invalidate cache
        configCache = null;
        cacheExpiry = null;

        return { success: true };
    } catch (error) {
        log.warn({ event: 'system_config_delete_error', reason: error?.message }, 'Delete config error');
        return { success: false, error: error.message };
    }
}

/**
 * Get LLM configuration (per-task)
 * Convenience method for common use case
 */
async function getLLMConfig() {
    const result = await getSystemConfig('llm_pertask');
    return result.value || DEFAULTS.llm_pertask;
}

/**
 * Set LLM configuration (per-task)
 */
async function setLLMConfig(config, userId = null) {
    return setSystemConfig('llm_pertask', config, userId, 'LLM configuration per task type');
}

/**
 * Get processing settings
 */
async function getProcessingSettings() {
    const result = await getSystemConfig('processing');
    return result.value || DEFAULTS.processing;
}

/**
 * Set processing settings
 */
async function setProcessingSettings(settings, userId = null) {
    return setSystemConfig('processing', settings, userId, 'Document processing settings');
}

/**
 * Get prompts
 */
async function getPrompts() {
    const result = await getSystemConfig('prompts');
    return result.value || DEFAULTS.prompts;
}

/**
 * Set prompts
 */
async function setPrompts(prompts, userId = null) {
    return setSystemConfig('prompts', prompts, userId, 'Extraction prompts');
}

/**
 * Get graph database config
 */
async function getGraphConfig() {
    const result = await getSystemConfig('graph');
    return result.value || DEFAULTS.graph;
}

/**
 * Set graph database config
 */
async function setGraphConfig(config, userId = null) {
    return setSystemConfig('graph', config, userId, 'Graph database configuration');
}

/**
 * Get routing config
 */
async function getRoutingConfig() {
    const result = await getSystemConfig('routing');
    return result.value || DEFAULTS.routing;
}

/**
 * Set routing config
 */
async function setRoutingConfig(config, userId = null) {
    return setSystemConfig('routing', config, userId, 'LLM routing and failover configuration');
}

/**
 * Get token policy
 */
async function getTokenPolicy() {
    const result = await getSystemConfig('tokenPolicy');
    return result.value || DEFAULTS.tokenPolicy;
}

/**
 * Set token policy
 */
async function setTokenPolicy(policy, userId = null) {
    return setSystemConfig('tokenPolicy', policy, userId, 'Token limits and reservation policy');
}

/**
 * Get presets
 */
async function getPresets() {
    const result = await getSystemConfig('presets');
    return result.value || DEFAULTS.presets;
}

/**
 * Apply a preset to LLM configuration
 */
async function applyPreset(presetName, userId = null) {
    const presets = await getPresets();
    const preset = presets[presetName];
    
    if (!preset) {
        return { success: false, error: `Preset '${presetName}' not found` };
    }
    
    return setLLMConfig(preset, userId);
}

/**
 * Invalidate cache (call when config changes externally)
 */
function invalidateCache() {
    configCache = null;
    cacheExpiry = null;
}

/**
 * Get effective config for a project
 * Merges system defaults with project overrides
 */
async function getEffectiveConfig(projectId, projectConfig = null) {
    // Get system defaults
    const { configs: systemConfigs } = await getAllSystemConfigs();
    
    if (!projectConfig) {
        return systemConfigs;
    }
    
    // Merge with project overrides
    const effective = { ...systemConfigs };
    
    // LLM per-task: check useSystemDefaults flags
    if (projectConfig.llm_pertask) {
        const defaults = projectConfig.llm_pertask.useSystemDefaults || {};
        effective.llm_pertask = {
            text: defaults.text ? systemConfigs.llm_pertask?.text : (projectConfig.llm_pertask.text || systemConfigs.llm_pertask?.text),
            vision: defaults.vision ? systemConfigs.llm_pertask?.vision : (projectConfig.llm_pertask.vision || systemConfigs.llm_pertask?.vision),
            embeddings: defaults.embeddings ? systemConfigs.llm_pertask?.embeddings : (projectConfig.llm_pertask.embeddings || systemConfigs.llm_pertask?.embeddings)
        };
    }
    
    // Processing settings: merge
    if (projectConfig.processing_settings) {
        effective.processing = { ...systemConfigs.processing, ...projectConfig.processing_settings };
    }
    
    // Prompts: project overrides non-empty prompts
    if (projectConfig.prompts) {
        effective.prompts = { ...systemConfigs.prompts };
        for (const [key, value] of Object.entries(projectConfig.prompts)) {
            if (value && value.trim()) {
                effective.prompts[key] = value;
            }
        }
    }
    
    // Graph config: project overrides if enabled
    if (projectConfig.graph_config && projectConfig.graph_config.enabled) {
        effective.graph = projectConfig.graph_config;
    }
    
    return effective;
}

module.exports = {
    DEFAULTS,
    getSystemConfig,
    getAllSystemConfigs,
    setSystemConfig,
    deleteSystemConfig,
    getLLMConfig,
    setLLMConfig,
    getProcessingSettings,
    setProcessingSettings,
    getPrompts,
    setPrompts,
    getGraphConfig,
    setGraphConfig,
    getRoutingConfig,
    setRoutingConfig,
    getTokenPolicy,
    setTokenPolicy,
    getPresets,
    applyPreset,
    invalidateCache,
    getEffectiveConfig
};
