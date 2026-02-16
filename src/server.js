#!/usr/bin/env node
/**
 * GodMode - Unified Server
 * System-agnostic document processing app with Ollama AI integration
 * // Touch to force reload
 */

// Load .env first so SUPABASE_* and other vars are available before any module reads them
const path = require('path');
const fs = require('fs');
(function loadEnvFirst() {
    if (typeof process.pkg !== 'undefined') return;
    const envPaths = [
        path.join(__dirname, '.env'),
        path.join(__dirname, '..', '.env')
    ];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf-8');
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1); // strip BOM
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const eq = trimmed.indexOf('=');
                if (eq <= 0) return;
                const key = trimmed.slice(0, eq).trim();
                let value = trimmed.slice(eq + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                    value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value;
            });
        }
    }
})();

// Require Node 14+ (nullish coalescing ?? used in supabase/storage and dependencies)
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
const log = require('./logger').logger.child({ module: 'server' });
if (nodeMajor < 14) {
    log.fatal({ event: 'startup_failed', reason: 'node_version', required: '14', current: process.version }, 'GodMode requires Node.js 14 or newer');
    process.exit(1);
}

// Global unhandled rejection handler - log the actual error for debugging
process.on('unhandledRejection', (reason, promise) => {
    if (reason instanceof Error) {
        logError(reason, { module: 'server', event: 'unhandled_rejection' });
    } else {
        log.error({ event: 'unhandled_rejection', message: String(reason) }, String(reason));
    }
});

const http = require('http');
const fsp = require('fs').promises;

// ==================== EXTRACTED MODULES ====================
// These utilities have been modularized for maintainability
const { parseUrl, parseBody, parseMultipart } = require('./server/request');
const { jsonResponse, getMimeType } = require('./server/response');
const { UUID_REGEX, isValidUUID, sanitizeFilename, isPathWithinDirectory } = require('./server/security');
const { MIME_TYPES, serveStatic, generateFileIconSVG } = require('./server/static');
const staticUtilsModule = require('./server/static'); // For getDocumentSOTAPath and ensureDocumentSOTADir which need DATA_DIR binding
const { rateLimitStore, checkRateLimit, getRateLimitKey, rateLimitResponse, startRateLimitCleanup, getCookieSecurityFlags, getClientIp } = require('./server/middleware');
const { cache: apiResponseCache, invalidateProjectCache, invalidateDashboardCache } = require('./middleware/cache');
const requestContext = require('./server/requestContext');
const { logger, logError } = require('./logger');

// Security helpers moved to ./server/security.js

// Rate limiting moved to ./server/middleware.js
// Start rate limit cleanup interval
startRateLimitCleanup();

// Modules
// Use StorageCompat for gradual migration to Supabase
// Falls back to local JSON if Supabase is not configured
const { createSyncCompatStorage } = require('./storageCompat');
const LegacyStorage = require('./storage'); // Keep for fallback
const DocumentProcessor = require('./processor');
const llm = require('./llm');
const modelMetadata = require('./llm/modelMetadata');
const tokenBudget = require('./llm/tokenBudget');
const llmRouter = require('./llm/router');

const healthRegistry = require('./llm/healthRegistry');
const llmConfig = require('./llm/config');

// Supabase Auth (optional - gracefully degrade if not configured)
let supabase = null;
try {
    supabase = require('./supabase');
} catch (e) {
    log.warn({ event: 'module_unavailable', module: 'supabase', error: e.message, stack: e.stack }, 'Supabase bundle failed to load');
    try {
        const client = require('./supabase/client');
        const auth = require('./supabase/auth');
        supabase = {
            getClient: client.getClient,
            getAdminClient: client.getAdminClient,
            isConfigured: client.isConfigured,
            testConnection: client.testConnection,
            getConfigInfo: client.getConfigInfo,
            auth: { register: auth.register, login: auth.login, logout: auth.logout, getUser: auth.getUser, refreshToken: auth.refreshToken, getUserProfile: auth.getUserProfile, upsertUserProfile: auth.upsertUserProfile, extractToken: auth.extractToken, verifyRequest: auth.verifyRequest, requireAuth: auth.requireAuth, requestPasswordReset: auth.requestPasswordReset, updatePassword: auth.updatePassword, isSuperAdmin: auth.isSuperAdmin, makeSuperAdmin: auth.makeSuperAdmin, requireSuperAdmin: auth.requireSuperAdmin }
        };
        log.info({ event: 'supabase_auth_fallback' }, 'Using Supabase auth from client+auth (bundle load failed)');
    } catch (e2) {
        log.warn({ event: 'auth_fallback_failed', error: e2.message }, 'Auth fallback failed');
    }
}

// Email Service (Resend)
let emailService = null;
try {
    emailService = require('./supabase/email');
} catch (e) {
    log.info({ event: 'module_unavailable', module: 'email' }, 'Email service not available');
}

// RBAC Module
const rbac = require('./rbac');

// Check if running as packaged executable
const IS_PACKAGED = !!process.pkg;

// Map environment variables to provider API keys
const ENV_TO_PROVIDER = {
    'OPENAI_API_KEY': 'openai',
    'GEMINI_API_KEY': 'gemini',
    'GOOGLE_API_KEY': 'gemini',
    'GROK_API_KEY': 'grok',
    'XAI_API_KEY': 'grok',
    'XAI_API': 'grok',
    'DEEPSEEK_API_KEY': 'deepseek',
    'CLAUDE_API_KEY': 'claude',
    'ANTHROPIC_API_KEY': 'claude',
    'KIMI_API_KEY': 'kimi',
    'MOONSHOT_API_KEY': 'kimi',
    'MINIMAX_API_KEY': 'minimax',
    'GENSPARK_API_KEY': 'genspark'
};

// Configuration
const PORT = process.env.PORT || 3005;
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
// Prioritize local frontend build (dist) over packaged public (stale/mock)
const FRONTEND_DIST_DIR = path.join(__dirname, 'frontend', 'dist');
const PUBLIC_DIR = fs.existsSync(FRONTEND_DIST_DIR) ? FRONTEND_DIST_DIR : path.join(__dirname, 'public');
if (fs.existsSync(FRONTEND_DIST_DIR)) {
    // We can't easily log here as logger might not be fully init, but console is safe
    console.log('Using fresh frontend build from: ' + FRONTEND_DIST_DIR);
} else {
    console.log('Using packaged public assets from: ' + PUBLIC_DIR);
}

// Default configuration
const DEFAULT_CONFIG = {
    projectName: 'GodMode',
    ollama: {
        host: '127.0.0.1',
        port: 11434,
        model: 'qwen3:30b',
        visionModel: 'granite3.2-vision',
        reasoningModel: 'qwen3:30b'
    },
    // Multi-provider LLM configuration
    llm: {
        provider: 'ollama', // Active provider: ollama, openai, gemini, grok, deepseek, genspark, claude, kimi, minimax
        models: {
            text: null,       // Will be derived from ollama.model if null
            vision: null,     // Will be derived from ollama.visionModel if null
            embeddings: null  // Embedding model for RAG
        },
        embeddingsProvider: 'ollama', // Provider for embeddings (fallback to ollama when provider lacks support)
        providers: {
            ollama: { host: '127.0.0.1', port: 11434 },
            openai: { apiKey: null, baseUrl: null, organization: null, manualModels: null },
            gemini: { apiKey: null, baseUrl: null, manualModels: null },
            grok: { apiKey: null, baseUrl: null, manualModels: null },
            deepseek: { apiKey: null, baseUrl: null, manualModels: null },
            genspark: { apiKey: null, baseUrl: null, manualModels: null },
            claude: { apiKey: null, baseUrl: null, manualModels: null },
            kimi: { apiKey: null, baseUrl: null, manualModels: null },
            minimax: { apiKey: null, baseUrl: null, groupId: null, manualModels: null }
        },
        // Token limits policy
        tokenPolicy: {
            enforce: true,                  // If false, do not truncate or block requests
            defaultMaxOutputTokens: 4096,   // Used when model-specific is not set
            defaultReservedForSystem: 500,  // Tokens reserved for system prompt
            defaultReservedForRag: 2000,    // Tokens reserved for RAG context
            perModel: {},                   // Per-model overrides: { "provider:modelId": { maxInputTokens, maxOutputTokens, ... } }
            perTask: {
                chat: { reservedForRag: 3000, maxOutputTokens: 2048 },
                processing: { maxOutputTokens: 4096, reservedForRag: 1000 }
            }
        },
        // Routing and failover policy
        routing: {
            mode: 'single',  // 'single' uses llm.provider only, 'failover' uses priority lists
            perTask: {
                chat: {
                    priorities: ['ollama'],
                    maxAttempts: 3,
                    timeoutMs: 45000,
                    retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
                    nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded'],
                    cooldownMs: 60000
                },
                processing: {
                    priorities: ['ollama'],
                    maxAttempts: 2,
                    timeoutMs: 90000,
                    retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
                    nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded'],
                    cooldownMs: 120000
                },
                embeddings: {
                    priorities: ['ollama'],
                    maxAttempts: 2,
                    timeoutMs: 60000,
                    retryableErrors: ['timeout', 'rate_limit', 'overloaded', 'server_error'],
                    nonRetryableErrors: ['auth', 'invalid_request', 'quota_exceeded'],
                    cooldownMs: 120000
                }
            },
            modelMap: {
                chat: {},       // { openai: { text: "gpt-4o" }, grok: { text: "grok-2" }, ... }
                processing: {}, // { openai: { text: "gpt-4o", vision: "gpt-4o" }, ... }
                embeddings: {}  // { openai: { embeddings: "text-embedding-3-small" }, ... }
            }
        }
    },
    customPrompt: '',
    pdfToImages: true,
    dataDir: DATA_DIR,
    // Graph database configuration
    graph: {
        enabled: true,         // Enabled by default - uses Supabase
        provider: 'supabase',  // Uses Supabase PostgreSQL
        graphName: 'godmode'
    }
};

// Helper: Mask API key for safe display (show last 4 chars only)
function maskApiKey(key) {
    if (!key || key.length < 8) return key ? '****' : null;
    return '****' + key.slice(-4);
}

// Helper: Get LLM config with masked API keys for frontend
function getLLMConfigForFrontend(llmConfig) {
    if (!llmConfig) return null;

    const masked = JSON.parse(JSON.stringify(llmConfig)); // Deep clone

    // Mask API keys and add isConfigured flags
    const providerIds = ['openai', 'gemini', 'grok', 'deepseek', 'genspark', 'claude', 'kimi', 'minimax'];
    for (const pid of providerIds) {
        if (masked.providers?.[pid]) {
            const provider = masked.providers[pid];
            const hasKey = !!(provider.apiKey && provider.apiKey.length > 0);
            provider.apiKeyMasked = maskApiKey(provider.apiKey);
            provider.isConfigured = hasKey;
            delete provider.apiKey; // Never send raw key to frontend
        }
    }

    // Ollama doesn't need API key masking
    if (masked.providers?.ollama) {
        masked.providers.ollama.isConfigured = !!(masked.providers.ollama.host && masked.providers.ollama.port);
    }

    return masked;
}

// Helper: Migrate legacy ollama config to llm config
function migrateLLMConfig(config) {
    if (!config.llm) {
        config.llm = JSON.parse(JSON.stringify(DEFAULT_CONFIG.llm));
    }

    // Sync ollama settings to llm.providers.ollama
    if (config.ollama) {
        config.llm.providers.ollama = {
            host: config.ollama.host || '127.0.0.1',
            port: config.ollama.port || 11434
        };
    }

    // Derive model settings from ollama if not set
    if (!config.llm.models.text && config.ollama?.model) {
        config.llm.models.text = config.ollama.model;
    }
    if (!config.llm.models.vision && config.ollama?.visionModel) {
        config.llm.models.vision = config.ollama.visionModel;
    }

    // IMPORTANT: Ensure perTask is set if not configured via Admin Panel
    // This allows the system to work with ollama defaults before Admin Panel config
    if (!config.llm.perTask) {
        config.llm.perTask = {};
    }

    // Set perTask.text defaults from llm.provider and llm.models.text
    if (!config.llm.perTask.text?.provider && !config.llm.perTask.text?.model) {
        const provider = config.llm.provider || 'ollama';
        const model = config.llm.models?.text || config.ollama?.model;

        if (provider && model) {
            config.llm.perTask.text = { provider, model };
            log.debug({ event: 'llmconfig_auto', type: 'text', provider, model }, 'Auto-configured perTask.text');
        }
    }

    // Set perTask.vision defaults
    if (!config.llm.perTask.vision?.provider && !config.llm.perTask.vision?.model) {
        const provider = config.llm.provider || 'ollama';
        const model = config.llm.models?.vision || config.ollama?.visionModel;

        if (provider && model) {
            config.llm.perTask.vision = { provider, model };
            log.debug({ event: 'llmconfig_auto', type: 'vision', provider, model }, 'Auto-configured perTask.vision');
        }
    }

    return config;
}

// Load or create config
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            const merged = { ...DEFAULT_CONFIG, ...saved, ollama: { ...DEFAULT_CONFIG.ollama, ...saved.ollama } };

            // Merge LLM config with defaults (preserve saved provider configs)
            if (saved.llm) {
                merged.llm = {
                    ...DEFAULT_CONFIG.llm,
                    ...saved.llm,
                    models: { ...DEFAULT_CONFIG.llm.models, ...saved.llm.models },
                    providers: { ...DEFAULT_CONFIG.llm.providers }
                };
                // Deep merge each provider's config
                for (const pid of Object.keys(DEFAULT_CONFIG.llm.providers)) {
                    if (saved.llm.providers?.[pid]) {
                        merged.llm.providers[pid] = { ...DEFAULT_CONFIG.llm.providers[pid], ...saved.llm.providers[pid] };
                    }
                }
            }

            // Merge API keys from environment variables (ONLY in dev mode)
            // ENV VARS TAKE PRIORITY - this ensures .env file is always respected
            if (!IS_PACKAGED) {
                for (const [envVar, providerId] of Object.entries(ENV_TO_PROVIDER)) {
                    if (process.env[envVar]) {
                        if (!merged.llm.providers[providerId]) {
                            merged.llm.providers[providerId] = {};
                        }
                        // ENV vars ALWAYS override config - this is the expected behavior
                        merged.llm.providers[providerId].apiKey = process.env[envVar];
                        log.debug({ event: 'config_env_key', provider: providerId, envVar }, 'Using API key from env');
                    }
                }
            }

            // Mark providers as configured based on having an API key
            for (const [pid, pconfig] of Object.entries(merged.llm.providers)) {
                if (pid !== 'ollama' && pconfig.apiKey) {
                    merged.llm.providers[pid].isConfigured = true;
                    // Mask API key for frontend
                    if (pconfig.apiKey.length > 8) {
                        merged.llm.providers[pid].apiKeyMasked = pconfig.apiKey.substring(0, 4) + '••••' + pconfig.apiKey.substring(pconfig.apiKey.length - 4);
                    }
                }
            }

            // IMPORTANT: Always recalculate dataDir based on current exe location
            // This ensures portability - the app works even if moved to a different location
            // We preserve the project ID from projects.json, but recalculate the path
            const projectsPath = path.join(DATA_DIR, 'projects.json');
            if (fs.existsSync(projectsPath)) {
                try {
                    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
                    const currentProjectId = projects.current || 'default';
                    merged.dataDir = path.join(DATA_DIR, 'projects', currentProjectId);
                    log.debug({ event: 'config_data_dir', dataDir: merged.dataDir, project: currentProjectId }, 'Data directory set');
                } catch (e) {
                    merged.dataDir = path.join(DATA_DIR, 'projects', 'default');
                }
            } else {
                merged.dataDir = path.join(DATA_DIR, 'projects', 'default');
            }

            // Migrate legacy config to llm format
            return migrateLLMConfig(merged);
        }
    } catch (e) {
        log.error({ event: 'config_load_error', err: e.message }, 'Error loading config');
    }
    return migrateLLMConfig({ ...DEFAULT_CONFIG, dataDir: path.join(DATA_DIR, 'projects', 'default') });
}

/**
 * Load config asynchronously (avoids blocking event loop at startup).
 */
async function loadConfigAsync() {
    try {
        await fsp.access(CONFIG_PATH);
    } catch {
        return migrateLLMConfig({ ...DEFAULT_CONFIG, dataDir: path.join(DATA_DIR, 'projects', 'default') });
    }
    try {
        const raw = await fsp.readFile(CONFIG_PATH, 'utf8');
        const saved = JSON.parse(raw);
        const merged = { ...DEFAULT_CONFIG, ...saved, ollama: { ...DEFAULT_CONFIG.ollama, ...saved.ollama } };
        if (saved.llm) {
            merged.llm = {
                ...DEFAULT_CONFIG.llm,
                ...saved.llm,
                models: { ...DEFAULT_CONFIG.llm.models, ...saved.llm.models },
                providers: { ...DEFAULT_CONFIG.llm.providers }
            };
            for (const pid of Object.keys(DEFAULT_CONFIG.llm.providers)) {
                if (saved.llm.providers?.[pid]) {
                    merged.llm.providers[pid] = { ...DEFAULT_CONFIG.llm.providers[pid], ...saved.llm.providers[pid] };
                }
            }
        }
        if (!IS_PACKAGED) {
            for (const [envVar, providerId] of Object.entries(ENV_TO_PROVIDER)) {
                if (process.env[envVar]) {
                    if (!merged.llm.providers[providerId]) merged.llm.providers[providerId] = {};
                    merged.llm.providers[providerId].apiKey = process.env[envVar];
                    log.debug({ event: 'config_env_key', provider: providerId, envVar }, 'Using API key from env');
                }
            }
        }
        for (const [pid, pconfig] of Object.entries(merged.llm.providers)) {
            if (pid !== 'ollama' && pconfig.apiKey) {
                merged.llm.providers[pid].isConfigured = true;
                if (pconfig.apiKey.length > 8) {
                    merged.llm.providers[pid].apiKeyMasked = pconfig.apiKey.substring(0, 4) + '••••' + pconfig.apiKey.substring(pconfig.apiKey.length - 4);
                }
            }
        }
        const projectsPath = path.join(DATA_DIR, 'projects.json');
        try {
            await fsp.access(projectsPath);
            const projectsRaw = await fsp.readFile(projectsPath, 'utf8');
            const projects = JSON.parse(projectsRaw);
            const currentProjectId = projects.current || 'default';
            merged.dataDir = path.join(DATA_DIR, 'projects', currentProjectId);
            log.debug({ event: 'config_data_dir', dataDir: merged.dataDir, project: currentProjectId }, 'Data directory set');
        } catch {
            merged.dataDir = path.join(DATA_DIR, 'projects', 'default');
        }
        return migrateLLMConfig(merged);
    } catch (e) {
        log.error({ event: 'config_load_error', err: e.message }, 'Error loading config');
    }
    return migrateLLMConfig({ ...DEFAULT_CONFIG, dataDir: path.join(DATA_DIR, 'projects', 'default') });
}

function saveConfig(config) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Initialize (async bootstrap so config load does not block event loop)
let config;

// Use StorageCompat for Supabase integration if available
// Falls back to local JSON storage if Supabase is not configured
let storage;
let processor = null;
const USE_SUPABASE_STORAGE = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

loadConfigAsync().then((c) => {
    config = c;

    // Create processor early (will be updated after storage init)
    if (USE_SUPABASE_STORAGE) {
        log.info({ event: 'storage_mode', mode: 'supabase' }, 'Using Supabase-backed storage');
        storage = createSyncCompatStorage(DATA_DIR);
        // Init is async - update processor dataDir when done
        storage.init().then(() => {
            const projectDataDir = storage.getProjectDataDir();
            if (processor && projectDataDir) {
                processor.updateDataDir(projectDataDir);
                log.debug({ event: 'processor_data_dir', projectDataDir }, 'Updated data directory');
            }
        }).catch(e => log.warn({ event: 'storage_init_warning', err: e.message }, e.message));
    } else {
        log.info({ event: 'storage_mode', mode: 'local' }, 'Using local JSON storage');
        storage = new LegacyStorage(DATA_DIR);
        storage.init();
    }

    // Set cost tracker data directory to project directory
    llm.costTracker.setDataDir(DATA_DIR);

    // Wire LLM queue to use configured default provider when persisting
    const { getQueueManager } = require('./llm/queue');
    getQueueManager().setConfigProvider(() => config);
    // Clean up any malformed data from previous sessions
    const cleanupResult = storage.cleanupBadData();
    if (cleanupResult.decisions > 0 || cleanupResult.people > 0) {
        log.info({ event: 'startup_cleanup', decisions: cleanupResult.decisions, people: cleanupResult.people }, 'Startup cleanup completed');
    }
    // Record daily stats snapshot for trend tracking
    storage.recordDailyStats();
    processor = new DocumentProcessor(storage, config);
    processor.startPolling();

    // Cookie security helper moved to ./server/middleware.js

    // ==================== LOAD GRAPH CONFIG FROM SUPABASE ====================
    // Try to load graph configuration from Supabase system_config table
    async function loadGraphConfigFromSupabase() {
        if (!supabase || !supabase.isConfigured()) {
            log.info({ event: 'graph_config', source: 'local' }, 'Supabase not configured, using local config');
            return null;
        }

        try {
            const client = supabase.getAdminClient();
            if (!client) {
                log.warn({ event: 'graph_config', reason: 'no_admin_client' }, 'Supabase admin client not available');
                return null;
            }

            const { data: graphConfigRow, error } = await client
                .from('system_config')
                .select('value')
                .eq('key', 'graph')
                .single();

            if (error || !graphConfigRow?.value) {
                log.debug({ event: 'graph_config', reason: 'no_system_config' }, 'No graph config in Supabase');
                return null;
            }

            const graphConfig = graphConfigRow.value;
            log.debug({ event: 'graph_config_loaded', source: 'supabase' }, 'Loaded config from Supabase');

            // Force Supabase provider
            graphConfig.provider = 'supabase';

            return graphConfig;
        } catch (err) {
            log.warn({ event: 'graph_config_error', err: err.message }, 'Error loading config from Supabase');
            return null;
        }
    }

    // Load LLM configuration from Supabase
    async function loadLLMConfigFromSupabase() {
        if (!supabase || !supabase.isConfigured()) {
            log.info({ event: 'llmconfig', source: 'local' }, 'Supabase not configured, using local config');
            return;
        }

        try {
            const systemConfig = require('./supabase/system');
            const llmPerTask = await systemConfig.getLLMConfig();

            if (llmPerTask && Object.keys(llmPerTask).length > 0) {
                // Sync Supabase llm_pertask to local config
                if (!config.llm) config.llm = {};
                config.llm.perTask = llmPerTask;
                log.debug({ event: 'llmconfig_loaded', source: 'supabase' }, 'Loaded from Supabase');
            } else {
                log.debug({ event: 'llmconfig', reason: 'no_pertask' }, 'No llm_pertask config in Supabase');
            }
        } catch (error) {
            log.warn({ event: 'llmconfig_load_error', err: error.message }, 'Failed to load from Supabase');
        }
    }

    // Initialize graph database on startup
    async function initGraphOnStartup() {
        // First try Supabase config
        const supabaseGraphConfig = await loadGraphConfigFromSupabase();

        // Use Supabase config if available and enabled, otherwise local config
        const effectiveConfig = (supabaseGraphConfig?.enabled) ? supabaseGraphConfig : config.graph;

        if (effectiveConfig?.enabled && effectiveConfig?.autoConnect !== false) {
            log.info({ event: 'graph_auto_connect' }, 'Auto-connecting to graph database');

            // Add project suffix to graph name
            const currentProject = storage.getCurrentProject();
            const projectId = currentProject?.id || 'default';
            const baseGraphName = effectiveConfig.baseGraphName || effectiveConfig.graphName || 'godmode';

            const graphConfig = {
                ...effectiveConfig,
                graphName: `${baseGraphName}_${projectId}`
            };

            const result = await storage.initGraph(graphConfig);
            if (result.ok) {
                log.info({ event: 'graph_connected', graphName: graphConfig.graphName }, 'Connected to graph');
                // Update local config for compatibility
                config.graph = graphConfig;

                // ==================== SOTA v2.0: ONTOLOGY SYSTEM INITIALIZATION ====================
                await initOntologySystem(storage.getGraphProvider());

                // Auto-sync data to graph if autoSync is enabled (default: true)
                if (effectiveConfig.autoSync !== false) {
                    log.info({ event: 'graph_auto_sync' }, 'Auto-syncing data to graph');
                    try {
                        const syncResult = await storage.syncToGraph({ useOntology: true });
                        if (syncResult.ok) {
                            const synced = syncResult.synced || {};
                            log.info({ event: 'graph_sync_complete', nodes: synced.nodes || 0, relationships: synced.relationships || 0 }, 'Auto-sync complete');
                        } else {
                            log.warn({ event: 'graph_sync_warning', error: syncResult.error || 'Unknown error' }, 'Auto-sync warning');
                        }
                    } catch (syncErr) {
                        log.warn({ event: 'graph_sync_error', err: syncErr.message }, 'Auto-sync error');
                    }
                }
            } else {
                log.warn({ event: 'graph_connect_failed', error: result.error }, 'Failed to connect');
            }
        } else {
            log.info({ event: 'graph_disabled' }, 'Graph database not enabled or auto-connect disabled');
        }
    }

    // ==================== SOTA v2.0: ONTOLOGY SYSTEM ====================
    // Initialize ontology with Supabase persistence and graph sync
    async function initOntologySystem(graphProvider) {
        try {
            const {
                getOntologyManager,
                getSchemaExporter,
                getInferenceEngine,
                getOntologySync,
                getOntologyBackgroundWorker
            } = require('./ontology');

            log.info({ event: 'ontology_init_start' }, 'Initializing SOTA v2.0 ontology system');

            // 1. Initialize OntologyManager with Supabase persistence
            const ontology = getOntologyManager();
            ontology.setStorage(storage);

            // 2. Try to load from Supabase, fallback to file
            const loaded = await ontology.load();
            if (!loaded) {
                log.warn({ event: 'ontology_schema_load_failed' }, 'Could not load ontology schema');
                return;
            }

            log.info({ event: 'ontology_loaded', from: ontology.getLoadedFrom(), version: ontology.getSchema()?.version }, 'Ontology loaded');

            // 3. Check if migration to Supabase is needed
            if (ontology.getLoadedFrom() === 'file' && storage.saveOntologySchema) {
                const syncStatus = await ontology.checkSyncStatus();
                if (!syncStatus.synced && syncStatus.fileVersion && !syncStatus.dbVersion) {
                    log.info({ event: 'ontology_migration_start' }, 'Migrating schema to Supabase');
                    const migrationResult = await ontology.migrateToSupabase();
                    if (migrationResult.success) {
                        log.info({ event: 'ontology_migration_complete', count: migrationResult.counts?.total || 0 }, 'Migration complete');
                    } else {
                        log.warn({ event: 'ontology_migration_warning', error: migrationResult.error }, 'Migration warning');
                    }
                }
            }

            // 4. Sync ontology to FalkorDB (create indexes, meta-nodes)
            if (graphProvider?.connected) {
                const exporter = getSchemaExporter({ ontology, graphProvider });
                exporter.setGraphProvider(graphProvider);

                const exportResult = await exporter.syncToGraph();
                if (exportResult.ok) {
                    const r = exportResult.results || {};
                    log.info({ event: 'ontology_graph_sync', indexes: r.indexes?.created || 0, entities: r.entityTypes?.synced || 0, relations: r.relationTypes?.synced || 0 }, 'Graph sync complete');
                } else {
                    log.warn({ event: 'ontology_graph_sync_warning', error: exportResult.error }, 'Graph sync warning');
                }

                // 5. Initialize InferenceEngine
                const inferenceEngine = getInferenceEngine({ ontology, graphProvider });
                inferenceEngine.setGraphProvider(graphProvider);

                // 6. Start Supabase Realtime sync if available
                if (supabase?.getAdminClient) {
                    const ontologySync = getOntologySync({
                        supabase: supabase.getAdminClient(),
                        graphProvider,
                        storage,
                        ontologyManager: ontology,
                        schemaExporter: exporter,
                        inferenceEngine,
                        autoSyncToGraph: true
                    });

                    const started = await ontologySync.startListening();
                    if (started) {
                        log.info({ event: 'ontology_realtime_sync_started' }, 'Realtime sync started');
                    }
                }

                // 7. Initialize Background Worker and register scheduled jobs
                const backgroundWorker = getOntologyBackgroundWorker({
                    graphProvider,
                    storage,
                    llmConfig: config.llm,
                    appConfig: config,
                    dataDir: storage.getProjectDataDir()
                });

                // Register job handlers with the scheduler
                initOntologyBackgroundJobs(backgroundWorker, inferenceEngine);
            }

            log.info({ event: 'ontology_init_complete' }, 'SOTA v2.0 ontology initialization complete');
        } catch (err) {
            // Ontology system is optional - log but don't crash
            log.warn({ event: 'ontology_init_warning', err: err.message }, 'Initialization warning');
        }
    }

    // ==================== ONTOLOGY BACKGROUND JOBS ====================
    // Register handlers and create default jobs for continuous ontology optimization
    function initOntologyBackgroundJobs(backgroundWorker, inferenceEngine) {
        try {
            const { getScheduledJobs } = require('./advanced');
            const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });

            log.info({ event: 'ontology_jobs_register' }, 'Registering background job handlers');

            // Register handler: Full ontology analysis
            scheduler.registerHandler('ontology_analysis', async (config) => {
                return await backgroundWorker.runFullAnalysis(config);
            });

            // Register handler: Inference rules execution
            scheduler.registerHandler('ontology_inference', async (config) => {
                return await backgroundWorker.runInferenceRules(config);
            });

            // Register handler: Deduplication check
            scheduler.registerHandler('ontology_dedup', async (config) => {
                return await backgroundWorker.checkDuplicates(config);
            });

            // Register handler: Auto-approve high confidence suggestions
            scheduler.registerHandler('ontology_auto_approve', async (config) => {
                return await backgroundWorker.autoApprove(config);
            });

            // Create default ontology jobs if they don't exist
            const existingJobs = scheduler.getJobs();
            const existingJobIds = existingJobs.map(j => j.id);

            // Full analysis every 6 hours
            if (!existingJobIds.includes('ontology_full_analysis')) {
                scheduler.createJob({
                    id: 'ontology_full_analysis',
                    name: 'Ontology Full Analysis',
                    type: 'ontology_analysis',
                    schedule: '6h',
                    config: { useLLM: true }
                });
            }

            // Inference rules every 1 hour
            if (!existingJobIds.includes('ontology_inference_rules')) {
                scheduler.createJob({
                    id: 'ontology_inference_rules',
                    name: 'Ontology Inference Rules',
                    type: 'ontology_inference',
                    schedule: '1h',
                    config: {}
                });
            }

            // Deduplication check every 4 hours
            if (!existingJobIds.includes('ontology_dedup_check')) {
                scheduler.createJob({
                    id: 'ontology_dedup_check',
                    name: 'Ontology Deduplication',
                    type: 'ontology_dedup',
                    schedule: '4h',
                    config: { autoMerge: false }
                });
            }

            // Auto-approve every 30 minutes
            if (!existingJobIds.includes('ontology_auto_approve')) {
                scheduler.createJob({
                    id: 'ontology_auto_approve',
                    name: 'Ontology Auto-Approve',
                    type: 'ontology_auto_approve',
                    schedule: '30m',
                    config: { threshold: 0.85 }
                });
            }

            // Start the scheduler if not already running
            if (!scheduler.running) {
                scheduler.start();
            }

            log.info({ event: 'ontology_jobs_started' }, 'Background jobs registered and scheduler started');

        } catch (err) {
            log.warn({ event: 'ontology_jobs_warning', err: err.message }, 'Background jobs warning');
        }
    }

    // Run async init (don't block server startup)
    (async () => {
        // Load LLM config from Supabase first
        await loadLLMConfigFromSupabase();

        // Then init graph
        await initGraphOnStartup();
    })().catch(err => {
        log.error({ event: 'startup_init_error', err: err.message }, 'Startup init error');
    });

    // Briefing cache (24-hour TTL, regenerate after processing)
    let briefingCache = {
        data: null,
        generatedAt: null,
        projectId: null
    };

    const BRIEFING_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

    function isBriefingCacheValid() {
        if (!briefingCache.data || !briefingCache.generatedAt) return false;
        const currentProjectId = storage.getCurrentProject()?.id;
        if (briefingCache.projectId !== currentProjectId) return false;
        const age = Date.now() - new Date(briefingCache.generatedAt).getTime();
        return age < BRIEFING_CACHE_TTL;
    }

    function invalidateBriefingCache() {
        briefingCache = { data: null, generatedAt: null, projectId: null };
        invalidateDashboardCache();
        log.info({ event: 'briefing_cache_invalidated' }, 'Briefing cache invalidated');
    }

    // Static file utilities moved to ./server/static.js
    // Ensure directories on startup
    staticUtilsModule.ensureDirectories(DATA_DIR);

    // Wrappers that bind DATA_DIR to keep the API surface identical
    function getDocumentSOTAPath(docId, createdAt = new Date()) {
        return staticUtilsModule.getDocumentSOTAPath(docId, DATA_DIR, createdAt);
    }
    function ensureDocumentSOTADir(docId, createdAt = new Date()) {
        return staticUtilsModule.ensureDocumentSOTADir(docId, DATA_DIR, createdAt);
    }

    // Request/response helpers moved to ./server/request.js and ./server/response.js

    /**
     * Get current user ID from request (cookie-based auth)
     */
    async function getCurrentUserId(req, storage) {
        try {
            // Parse cookies
            const cookies = {};
            const cookieHeader = req.headers.cookie || '';
            cookieHeader.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && value) cookies[name] = decodeURIComponent(value);
            });

            // Try to get access token from cookies
            const accessToken = cookies['sb-access-token'] || cookies['supabase-auth-token'];

            if (accessToken && storage._supabase?.supabase) {
                const { data: { user }, error } = await storage._supabase.supabase.auth.getUser(accessToken);
                if (!error && user) {
                    return user.id;
                }
            }

            // Fallback: try to get from session
            if (storage._supabase?.supabase) {
                const { data: { session } } = await storage._supabase.supabase.auth.getSession();
                if (session?.user) {
                    return session.user.id;
                }
            }

            return null;
        } catch (err) {
            log.warn({ event: 'auth_get_user_failed', err: err.message }, 'Failed to get current user');
            return null;
        }
    }

    // getMimeType moved to ./server/response.js

    // Feature modules
    const { handleAuth } = require('./features/auth/routes');
    const { handleProfile } = require('./features/profile/routes');
    const { handleProjectMembers, handleProjects } = require('./features/projects/routes');
    const { handleCompanies } = require('./features/companies/routes');
    const { handleKrispWebhook, handleKrispApi } = require('./features/krisp/routes');
    const { handleLlm } = require('./features/llm/routes');
    const { handleKnowledge } = require('./features/knowledge/routes');
    const { handleNotifications } = require('./features/notifications/routes');
    const { handleSearch } = require('./features/search/routes');
    const { handleCosts } = require('./features/costs/routes');
    const { handleContacts } = require('./features/contacts/routes');
    const { handleTeams } = require('./features/teams/routes');
    const { handleDocuments } = require('./features/documents/routes');
    const { handleConfig } = require('./features/config/routes');
    const { handleTimezones } = require('./features/timezones/routes');
    const { handleInvites } = require('./features/invites/routes');
    const { handleComments } = require('./features/comments/routes');
    const { handleApikeys } = require('./features/apikeys/routes');
    const { handleWebhooks } = require('./features/webhooks/routes');
    const { handleAudit } = require('./features/audit/routes');
    const { handleSync } = require('./features/sync/routes');
    const { handleActivity } = require('./features/activity/routes');
    const { handleRoleTemplates } = require('./features/role-templates/routes');
    const { handleSecrets } = require('./features/secrets/routes');
    const { handleGoogleDrive } = require('./features/googleDrive/routes');
    const { handleSystemAdmin } = require('./features/system-admin/routes');
    const { handleFiles } = require('./features/files/routes');
    const { handleProcessing } = require('./features/processing/routes');
    const { handleConversations } = require('./features/conversations/routes');
    const { handleEmails } = require('./features/emails/routes');
    const { handleBilling } = require('./features/billing/routes');
    const { handleDashboard } = require('./features/dashboard/routes');
    const { handleBulk } = require('./features/bulk/routes');
    const { handleBriefing } = require('./features/briefing/routes');
    const { handleReports } = require('./features/reports/routes');
    const { handleConflicts } = require('./features/conflicts/routes');
    const { handleSot } = require('./features/sot/routes');
    const { handleCore } = require('./features/core/routes');
    const { handleChat } = require('./features/chat/routes');
    const { handleRag } = require('./features/rag/routes');
    const { handleData } = require('./features/data/routes');
    const { handleAdvanced } = require('./features/advanced/routes');
    const { handleOntology } = require('./features/ontology/routes');
    const { handleGraph } = require('./features/graph/routes');
    const { handleGraphrag } = require('./features/graphrag/routes');
    const { handleOptimizations } = require('./features/optimizations/routes');
    const { handleRolesApi } = require('./features/roles-api/routes');
    const { handleTeamAnalysis } = require('./features/team-analysis/routes');
    const { handlePrompts } = require('./features/prompts/routes');
    const { handleSprints } = require('./features/sprints/routes');
    const { handleCategories } = require('./features/categories/routes');

    // API Routes
    async function handleAPI(req, res, pathname) {
        const requestStart = Date.now();
        const requestId = requestContext.getRequestId() || req.headers['x-request-id'] || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        res.requestId = requestId;
        const apiLog = requestContext.getLogger();
        apiLog.debug({ event: 'request_start', route: pathname, method: req.method }, 'request_start');
        const responseTimeHeader = () => (Date.now() - requestStart) + 'ms';
        const originalWriteHead = res.writeHead;
        res.writeHead = function (statusCode, a, b) {
            const ms = responseTimeHeader();
            const extra = { 'X-Response-Time': ms, 'X-Request-Id': requestId };
            if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
                return originalWriteHead.call(res, statusCode, { ...a, ...extra });
            }
            if (typeof b === 'object' && b !== null && !Array.isArray(b)) {
                return originalWriteHead.call(res, statusCode, a, { ...b, ...extra });
            }
            try {
                res.setHeader('X-Response-Time', ms);
                res.setHeader('X-Request-Id', requestId);
            } catch (_) { }
            return originalWriteHead.apply(res, arguments);
        };
        const originalEnd = res.end;
        let endImpl = function (...args) {
            if (!res.headersSent) {
                try {
                    res.setHeader('X-Response-Time', responseTimeHeader());
                    res.setHeader('X-Request-Id', requestId);
                } catch (_) { }
            }
            const durationMs = Date.now() - requestStart;
            const statusCode = res.statusCode || 200;
            requestContext.getLogger().info({ event: 'request_end', route: pathname, method: req.method, statusCode, durationMs }, 'request_end');
            return originalEnd.apply(res, args);
        };
        // Gzip disabled for API JSON responses to avoid proxy issues: some proxies strip
        // Content-Encoding but leave the body compressed, causing "invalid JSON" on the client.
        res.end = endImpl;

        // CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Project-Id'
            });
            res.end();
            return;
        }

        // Parse URL once for all feature handlers
        const parsedUrl = parseUrl(req.url);

        // Request-scoped project context: set from X-Project-Id so each request sees the correct project
        let savedPreviousProjectId = undefined;
        const projectIdFromHeader = req.headers['x-project-id'];
        if (projectIdFromHeader && isValidUUID(projectIdFromHeader)) {
            const cur = storage.getCurrentProject?.();
            savedPreviousProjectId = cur?.id ?? null;
            try {
                if (typeof storage.switchProject === 'function') {
                    const result = storage.switchProject(projectIdFromHeader);
                    await (result && typeof result.then === 'function' ? result : Promise.resolve());
                } else if (storage._supabase) {
                    storage._supabase.setProject(projectIdFromHeader);
                    if (storage.currentProjectId !== undefined) storage.currentProjectId = projectIdFromHeader;
                }
            } catch (e) {
                requestContext.getLogger().warn({ event: 'project_switch_failed', projectId: projectIdFromHeader, err: e.message }, 'Could not set request project from X-Project-Id');
            }
        }

        try {
            // ==================== Response cache for GET /api/config and GET /api/dashboard ====================
            const cacheableGet = req.method === 'GET' && (pathname === '/api/config' || pathname === '/api/dashboard');
            if (cacheableGet) {
                const projectId = projectIdFromHeader || storage.getCurrentProject?.()?.id || 'default';
                const cacheKey = pathname === '/api/config' ? 'GET:/api/config:config' : `GET:/api/dashboard:${projectId}`;
                const cached = apiResponseCache.get(cacheKey);
                if (cached) {
                    res.setHeader('X-Cache', 'HIT');
                    jsonResponse(res, cached);
                    return;
                }
                const ttl = pathname === '/api/config' ? 300000 : 30000;
                const timingEnd = res.end;
                let responseBody = '';
                res.end = function (chunk, ...args) {
                    if (chunk) responseBody += (Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk));
                    if (res.statusCode === 200) {
                        try {
                            const data = JSON.parse(responseBody);
                            apiResponseCache.set(cacheKey, data, ttl);
                            if (!res.headersSent) res.setHeader('X-Cache', 'MISS');
                        } catch (_) { }
                    }
                    return timingEnd.apply(res, arguments);
                };
            }

            // ==================== Auth Routes (extracted to features/auth/routes.js) ====================
            if (await handleAuth({ req, res, pathname, parsedUrl, supabase })) return;

            // ==================== Profile Routes (extracted to features/profile/routes.js) ====================
            if (await handleProfile({ req, res, pathname, parsedUrl, supabase })) return;

            // ==================== Project Members Routes (extracted to features/projects/routes.js) ====================
            if (await handleProjectMembers({ req, res, pathname, parsedUrl, supabase })) return;

            // ==================== Projects Core Routes (extracted to features/projects/routes.js) ====================
            if (await handleProjects({ req, res, pathname, supabase, storage, config, saveConfig, processor, invalidateBriefingCache })) return;

            // ==================== Companies Routes (CRUD, analyze, templates) ====================
            if (await handleCompanies({ req, res, pathname, supabase, config, llm })) return;

            // ==================== Krisp Webhook (public - no auth) ====================
            if (await handleKrispWebhook({ req, res, pathname })) return;

            // ==================== Krisp API Routes (extracted to features/krisp/routes.js) ====================
            if (await handleKrispApi({ req, res, pathname, parsedUrl, supabase, config })) return;

            // ==================== LLM & Ollama Routes (extracted to features/llm/routes.js) ====================
            if (await handleLlm({ req, res, pathname, config, saveConfig, llm, supabase })) return;

            // ==================== Knowledge Routes (extracted to features/knowledge/routes.js) ====================
            if (await handleKnowledge({ req, res, pathname, storage, config, llm, llmConfig })) return;
            // ==================== Sprints Routes (create, generate, apply) ====================
            if (await handleSprints({ req, res, pathname, storage, config })) return;
            if (await handleRag({ req, res, pathname, storage, config, processor, llm, invalidateBriefingCache })) return;
            if (await handleAdvanced({ req, res, pathname, storage })) return;
            if (await handleData({ req, res, pathname, storage })) return;
            if (await handleOntology({ req, res, pathname, storage, config, supabase })) return;
            if (await handleGraph({ req, res, pathname, storage, config, supabase, saveConfig })) return;
            if (await handleGraphrag({ req, res, pathname, storage, config })) return;
            if (await handleOptimizations({ req, res, pathname, storage, config })) return;
            if (await handleRolesApi({ req, res, pathname, storage, config, supabase })) return;
            if (await handleTeamAnalysis({ req, res, pathname, storage, config })) return;
            if (await handlePrompts({ req, res, pathname, config })) return;

            // ==================== Notifications Routes (extracted to features/notifications/routes.js) ====================
            if (await handleNotifications({ req, res, pathname, supabase })) return;

            // ==================== Categories Routes (extracted to features/categories/routes.js) ====================
            if (await handleCategories({ req, res, pathname })) return;

            // ==================== Search Routes (extracted to features/search/routes.js) ====================
            if (await handleSearch({ req, res, pathname, supabase })) return;

            // ==================== Cost Tracking Routes (extracted to features/costs/routes.js) ====================
            if (await handleCosts({ req, res, pathname, storage, llm })) return;

            // ==================== Contacts Routes (extracted to features/contacts/routes.js) ====================
            if (await handleContacts({ req, res, pathname, storage, llm, supabase })) return;

            // ==================== Teams Routes (extracted to features/teams/routes.js) ====================
            if (await handleTeams({ req, res, pathname, storage })) return;

            // ==================== Documents Routes (extracted to features/documents/routes.js) ====================
            if (await handleDocuments({ req, res, pathname, storage, processor, invalidateBriefingCache, getCurrentUserId, PORT })) return;

            if (await handleTimezones({ req, res, pathname, supabase, storage })) return;

            if (await handleInvites({ req, res, pathname, parsedUrl, supabase, emailService })) return;

            if (await handleComments({ req, res, pathname, parsedUrl, supabase, storage })) return;

            if (await handleApikeys({ req, res, pathname, parsedUrl, supabase })) return;
            if (await handleWebhooks({ req, res, pathname, parsedUrl, supabase })) return;
            if (await handleAudit({ req, res, pathname, parsedUrl, supabase })) return;
            if (await handleSync({ req, res, pathname, parsedUrl, supabase, storage })) return;
            if (await handleActivity({ req, res, pathname, parsedUrl, supabase })) return;
            if (await handleRoleTemplates({ req, res, pathname, supabase })) return;

            // Profile routes removed - now handled by handleProfile() above

            // Notifications routes (Supabase)
            // Handled by features/notifications/routes.js - handleNotifications()

            // Search routes (Supabase)
            // Handled by features/search/routes.js - handleSearch()

            // ==================== Config Routes (extracted to features/config/routes.js) ====================
            if (await handleConfig({ req, res, pathname, config, saveConfig, processor, llm, getLLMConfigForFrontend })) return;
            if (await handleSecrets({ req, res, pathname, supabase })) return;
            if (await handleGoogleDrive({ req, res, pathname, supabase })) return;
            if (await handleSystemAdmin({ req, res, pathname, supabase, config, saveConfig })) return;
            if (await handleFiles({ req, res, pathname, processor, storage, config, invalidateBriefingCache })) return;
            if (await handleProcessing({ req, res, pathname, processor, storage, config, llm, invalidateBriefingCache })) return;

            if (await handleConversations({ req, res, pathname, storage, config, llm })) return;
            if (await handleEmails({ req, res, pathname, storage, config, llm })) return;

            // Contacts Directory routes
            // Handled by features/contacts/routes.js - handleContacts()

            // ==================== Teams API ====================
            // Teams routes moved to features/teams/routes.js - handleTeams()
            // Timezones routes moved to features/timezones/routes.js - handleTimezones()


            // Cost tracking routes
            // Handled by features/costs/routes.js - handleCosts()

            if (await handleBilling({ req, res, pathname, supabase, storage })) return;
            if (await handleDashboard({ req, res, pathname, storage })) return;
            if (await handleBulk({ req, res, pathname, storage })) return;
            if (await handleBriefing({ req, res, pathname, storage, config, llm, briefingCache, isBriefingCacheValid })) return;
            if (await handleReports({ req, res, pathname, storage })) return;
            if (await handleConflicts({ req, res, pathname, storage, config })) return;
            if (await handleSot({ req, res, pathname, storage, processor, config, llm })) return;
            if (await handleCore({ req, res, pathname, storage, config, llm, dataDir: DATA_DIR })) return;
            if (await handleChat({ req, res, pathname, storage, config, llm, supabase, llmRouter })) return;

            // Knowledge routes - handled by features/knowledge/routes.js - handleKnowledge()
            // Chat routes - handled by features/chat/routes.js - handleChat()
            // file-logs, folders - handled by features/files/routes.js - handleFiles()
            // Export, RAG, knowledge, content - handled by features/rag/routes.js - handleRag()

            // Ontology API - handled by features/ontology/routes.js - handleOntology()
            // Graph API (providers, config, status, bookmarks, queries, insights, list, cleanup-orphans) - handled by features/graph/routes.js - handleGraph()

            // Graph connect, test, sync, indexes, embeddings, projects, cross-project, switch, sync-multi, multi-stats - handled by features/graph/routes.js

            // GraphRAG API - handled by features/graphrag/routes.js - handleGraphrag()
            // Optimizations, backups, webhooks (optimizations) - handled by features/optimizations/routes.js

            // Ontology Agent, worker, jobs, extractor - handled by features/ontology/routes.js

            // Graph falkordb-browser, sync, cleanup-duplicates, list-all, sync-projects, delete - handled by features/graph/routes.js

            // Sync extended (deleted, audit, batch-delete, integrity, backups, events, stats, retention, versions, jobs) - handled by features/sync/routes.js

            // Full-text search, export, import, cache (advanced), compress, docs - handled by features/advanced/routes.js

            // Roles API - handled by features/roles-api/routes.js
            // Team Analysis - handled by features/team-analysis/routes.js

            // 404 for unknown API routes
            jsonResponse(res, { error: 'Not found' }, 404);

        } catch (error) {
            if (error.code === 'ENTITY_TOO_LARGE') {
                jsonResponse(res, { error: 'Request body too large' }, 413);
                return;
            }
            logError(error, { module: 'api', event: 'request_error', requestId: requestContext.getRequestId() || res.requestId, route: pathname });
            jsonResponse(res, { error: error.message }, 500);
        } finally {
            if (savedPreviousProjectId !== undefined) {
                try {
                    if (typeof storage.switchProject === 'function') {
                        const result = storage.switchProject(savedPreviousProjectId);
                        await (result && typeof result.then === 'function' ? result : Promise.resolve());
                    } else if (storage._supabase) {
                        storage._supabase.setProject(savedPreviousProjectId);
                        if (storage.currentProjectId !== undefined) storage.currentProjectId = savedPreviousProjectId;
                    }
                } catch (e) {
                    requestContext.getLogger().warn({ event: 'project_restore_failed', err: e.message }, 'Could not restore project context');
                }
            }
        }
    }

    // Request handler
    const server = http.createServer(async (req, res) => {
        const parsedUrl = parseUrl(req.url);
        let pathname = parsedUrl.pathname;
        const requestId = req.headers['x-request-id'] || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        const requestLogger = logger.child({ module: 'api', requestId });

        await requestContext.runWithContext({ requestId, logger: requestLogger }, async () => {
            // Health check endpoint - simple and fast for monitoring (no DB); includes event loop lag
            if (pathname === '/health' && req.method === 'GET') {
                const healthStatus = {
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    uptime: process.uptime(),
                    memory: {
                        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                    }
                };
                const eventLoopLagMs = await new Promise((resolve) => {
                    const start = Date.now();
                    setImmediate(() => resolve(Date.now() - start));
                });
                healthStatus.event_loop_lag_ms = eventLoopLagMs;
                res.writeHead(200, { 'Content-Type': 'application/json', 'X-Request-Id': requestId });
                res.end(JSON.stringify(healthStatus));
                return;
            }

            // Readiness endpoint - checks storage/DB so orchestrators can wait before sending traffic
            if (pathname === '/ready' && req.method === 'GET') {
                let ready = true;
                const checks = { storage: 'ok' };
                try {
                    if (storage.getCurrentProject && !storage.getCurrentProject()) {
                        ready = false;
                        checks.storage = 'no project';
                    }
                    if (supabase && supabase.testConnection) {
                        const conn = await supabase.testConnection();
                        checks.database = conn && conn.success ? 'ok' : (conn && conn.error) || 'error';
                        if (checks.database !== 'ok') ready = false;
                    } else {
                        checks.database = 'not configured';
                    }
                } catch (e) {
                    ready = false;
                    checks.error = e.message;
                }
                const status = ready ? 200 : 503;
                res.writeHead(status, { 'Content-Type': 'application/json', 'X-Request-Id': requestId });
                res.end(JSON.stringify({ ready, checks }));
                return;
            }

            // API routes
            if (pathname.startsWith('/api/')) {
                await handleAPI(req, res, pathname);
                return;
            }

            // Favicon - return empty icon to avoid 404
            if (pathname === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Static files and routing
            // App on root - SPA fallback
            if (pathname === '/') {
                pathname = '/index.html';
            }
            // App on /app - SPA fallback: any /app/* route serves index.html
            // This allows client-side routing to work on page refresh
            if (pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/')) {
                pathname = '/index.html';
            }
            // Deep linking & SPA routes - serve index.html to let client router handle it
            const spaRoutes = [
                '/dashboard', '/chat', '/sot', '/timeline',
                '/contacts', '/team-analysis', '/files', '/emails',
                '/graph', '/costs', '/history', '/projects',
                '/companies', '/settings', '/user-settings', '/admin', '/profile',
                '/documents', '/transcripts'
            ];
            if (spaRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
                pathname = '/index.html';
            }
            // Legal pages
            if (pathname === '/terms' || pathname === '/terms/') {
                pathname = '/terms.html';
            }
            if (pathname === '/privacy' || pathname === '/privacy/') {
                pathname = '/privacy.html';
            }

            const filePath = path.join(PUBLIC_DIR, pathname);

            // Security: prevent directory traversal
            if (!filePath.startsWith(PUBLIC_DIR)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            serveStatic(res, filePath);
        });
    });

    // Request timeout: close connections that take longer than this (prevents hung requests)
    // Increase server timeout to 5 minutes (300000ms) for long-running LLM tasks
    server.timeout = Number(process.env.SERVER_TIMEOUT_MS) || 300000;
    server.keepAliveTimeout = 305000; // Must be greater than server.timeout
    server.headersTimeout = 310000; // Must be greater than keepAliveTimeout

    // Start server
    server.listen(PORT, async () => {
        const currentProject = storage.getCurrentProject();
        const projectName = (currentProject?.name) || 'No project';
        log.info({ event: 'server_ready', port: PORT, project: projectName, url: `http://localhost:${PORT}` }, 'GodMode ready');
        const authConfigured = supabase && typeof supabase.isConfigured === 'function' && supabase.isConfigured();
        log.info({ event: 'auth_status', configured: authConfigured }, authConfigured ? 'Supabase auth configured' : 'Supabase auth NOT configured (set SUPABASE_PROJECT_URL and SUPABASE_PROJECT_ANON_KEY in src/.env)');

        // Auto-connect to FalkorDB if configured (connect if enabled and has host/credentials)
        const graphHasCredentials = config.graph?.falkordb?.host || config.graph?.neo4j?.host;
        if (config.graph && config.graph.enabled && graphHasCredentials) {
            try {
                const projectId = currentProject?.id || 'default';
                const baseGraphName = config.graph.baseGraphName || config.graph.graphName || 'godmode';
                // Use project-specific graph name
                const projectGraphName = `${baseGraphName}_${projectId}`;

                const graphConfig = {
                    ...config.graph,
                    graphName: projectGraphName
                };

                log.info({ event: 'graph_falkordb_connect', graphName: projectGraphName }, 'Auto-connecting to FalkorDB');
                const result = await storage.initGraph(graphConfig);

                if (result.ok) {
                    log.info({ event: 'graph_falkordb_connected', graphName: projectGraphName }, 'Connected to FalkorDB');
                } else {
                    log.warn({ event: 'graph_falkordb_connect_failed', error: result.error }, 'Auto-connect failed');
                }
            } catch (e) {
                log.warn({ event: 'graph_falkordb_connect_error', err: e.message }, 'Auto-connect error');
            }
        }

        // Auto-open browser (except in production)
        if (!process.pkg && process.argv.includes('--dev')) {
            try {
                const open = require('open');
                open(`http://localhost:${PORT}`);
            } catch (e) {
                // open module not available
            }
        }
    });

    // Graceful shutdown: stop accepting new connections, drain in-flight with timeout
    const DRAIN_TIMEOUT_MS = Number(process.env.SERVER_DRAIN_TIMEOUT_MS) || 15000;

    function gracefulShutdown(signal) {
        if (gracefulShutdown.inProgress) return;
        gracefulShutdown.inProgress = true;
        log.info({ event: 'shutdown_start', signal: signal || 'Shutting down', drainTimeoutSec: DRAIN_TIMEOUT_MS / 1000 }, 'Shutting down');

        let exited = false;
        const doExit = (code) => {
            if (exited) return;
            exited = true;
            try { storage.close(); } catch (e) { log.warn({ event: 'shutdown_storage_close', err: e.message }, 'storage.close'); }
            process.exit(code);
        };

        const forceExitTimer = setTimeout(() => {
            log.warn({ event: 'shutdown_drain_timeout' }, 'Drain timeout, forcing exit');
            doExit(1);
        }, DRAIN_TIMEOUT_MS);

        server.close(() => {
            clearTimeout(forceExitTimer);
            doExit(0);
        });
    }

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}).catch((e) => {
    logError(e, { module: 'server', event: 'startup_failed' });
    process.exit(1);
});
