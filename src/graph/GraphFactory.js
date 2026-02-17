/**
 * Graph Provider Factory
 * Creates and manages graph database provider instances
 */

const { logger } = require('../logger');
const GraphProvider = require('./GraphProvider');

const log = logger.child({ module: 'graph-factory' });

// Provider registry - Supabase is the default and recommended provider
const PROVIDERS = {
    supabase: () => require('./providers/supabase')
};

// Cache for provider instances
const providerCache = new Map();

/**
 * Get list of available graph providers
 * @returns {Array<{id: string, label: string, capabilities: object}>}
 */
function getProviders() {
    return [
        {
            id: 'supabase',
            label: 'Supabase Graph',
            description: 'Graph database using Supabase PostgreSQL - zero additional setup',
            capabilities: {
                cypher: 'basic',
                traversal: true,
                vectorSearch: false,
                fullTextSearch: true,
                transactions: true,
                realtime: true,
                multiGraph: true
            }
        }
    ];
}

/**
 * Create a graph provider instance
 * @param {string} providerId - Provider identifier (e.g. 'supabase')
 * @param {object} config - Provider-specific configuration
 * @returns {GraphProvider}
 */
function createProvider(providerId, config = {}) {
    const providerLoader = PROVIDERS[providerId];
    if (!providerLoader) {
        throw new Error(`Unknown graph provider: ${providerId}. Available: ${Object.keys(PROVIDERS).join(', ')}`);
    }

    const Provider = providerLoader();
    return new Provider(config);
}

/**
 * Get or create a cached provider instance
 * @param {string} providerId - Provider identifier
 * @param {object} config - Provider configuration
 * @returns {GraphProvider}
 */
function getProvider(providerId, config = {}) {
    const cacheKey = `${providerId}:${JSON.stringify(config)}`;
    
    if (!providerCache.has(cacheKey)) {
        const provider = createProvider(providerId, config);
        providerCache.set(cacheKey, provider);
    }
    
    return providerCache.get(cacheKey);
}

/**
 * Clear the provider cache
 */
function clearCache() {
    // Disconnect all providers before clearing
    for (const provider of providerCache.values()) {
        if (provider.connected) {
            provider.disconnect().catch(err => {
                log.warn({ event: 'graph_factory_disconnect_error', reason: err?.message }, 'Error disconnecting provider');
            });
        }
    }
    providerCache.clear();
}

/**
 * Test connection to a graph provider
 * @param {string} providerId - Provider identifier
 * @param {object} config - Provider configuration
 * @returns {Promise<{ok: boolean, error?: string, latencyMs?: number}>}
 */
async function testConnection(providerId, config = {}) {
    try {
        const provider = createProvider(providerId, config);
        const connectResult = await provider.connect();
        
        if (!connectResult.ok) {
            return connectResult;
        }
        
        const testResult = await provider.testConnection();
        await provider.disconnect();
        
        return testResult;
    } catch (error) {
        return {
            ok: false,
            error: error.message
        };
    }
}

/**
 * Get provider capabilities
 * @param {string} providerId - Provider identifier
 * @returns {object}
 */
function getCapabilities(providerId) {
    const providers = getProviders();
    const provider = providers.find(p => p.id === providerId);
    return provider?.capabilities || {};
}

/**
 * Create a provider from application config
 * @param {object} appConfig - Application configuration
 * @returns {Promise<GraphProvider|null>}
 */
async function createFromConfig(appConfig, supabaseClient = null) {
    const graphConfig = appConfig?.graph;
    
    if (!graphConfig?.enabled) {
        log.debug({ event: 'graph_factory_disabled' }, 'Graph database disabled');
        return null;
    }
    
    // Always use Supabase
    const providerId = 'supabase';
    const providerConfig = graphConfig[providerId] || graphConfig || {};
    
    log.debug({ event: 'graph_factory_creating' }, 'Creating Supabase graph provider');
    
    const provider = createProvider(providerId, {
        ...providerConfig,
        supabase: supabaseClient,
        graphName: graphConfig.graphName || 'godmode'
    });
    
    const connectResult = await provider.connect();
    
    if (!connectResult.ok) {
        log.warn({ event: 'graph_factory_connect_failed', reason: connectResult.error }, 'Failed to connect');
        return null;
    }
    
    log.debug({ event: 'graph_factory_connected' }, 'Connected to Supabase graph successfully');
    return provider;
}

module.exports = {
    getProviders,
    createProvider,
    getProvider,
    clearCache,
    testConnection,
    getCapabilities,
    createFromConfig,
    PROVIDERS
};
