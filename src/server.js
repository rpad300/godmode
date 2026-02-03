#!/usr/bin/env node
/**
 * GodMode - Unified Server
 * System-agnostic document processing app with Ollama AI integration
 */

// Global unhandled rejection handler - log the actual error for debugging
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION] Reason:', reason);
    console.error('[UNHANDLED REJECTION] Stack:', reason?.stack);
    // Don't crash - continue running
});

const http = require('http');
const fs = require('fs');
const path = require('path');

// WHATWG URL parser (replaces deprecated url.parse)
function parseUrl(reqUrl) {
    try {
        const parsed = new URL(reqUrl, 'http://localhost');
        return {
            pathname: parsed.pathname,
            query: Object.fromEntries(parsed.searchParams),
            search: parsed.search,
            href: parsed.href
        };
    } catch (e) {
        // Fallback for malformed URLs
        const qIdx = reqUrl.indexOf('?');
        return {
            pathname: qIdx >= 0 ? reqUrl.substring(0, qIdx) : reqUrl,
            query: {},
            search: qIdx >= 0 ? reqUrl.substring(qIdx) : '',
            href: reqUrl
        };
    }
}

// ============================================
// SECURITY HELPERS
// ============================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
function isValidUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'file';
    // Remove path traversal attempts and invalid characters
    return name
        .replace(/\.\./g, '')
        .replace(/[\/\\]/g, '_')
        .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
        .substring(0, 255);
}

/**
 * Validate file path is within allowed directory (prevent path traversal)
 */
function isPathWithinDirectory(filePath, allowedDir) {
    if (!filePath || !allowedDir) return false;
    try {
        const realPath = fs.realpathSync(filePath);
        const realAllowedDir = fs.realpathSync(allowedDir);
        return realPath.startsWith(realAllowedDir);
    } catch {
        return false;
    }
}

// ============================================
// RATE LIMITING
// ============================================
const rateLimitStore = new Map();

/**
 * Simple in-memory rate limiter
 * @param {string} key - Unique identifier (e.g., IP + endpoint)
 * @param {number} maxRequests - Maximum requests allowed in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if request should be allowed
 */
function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    if (!record) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    
    if (now > record.resetAt) {
        // Window expired, reset
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    
    if (record.count >= maxRequests) {
        return false; // Rate limited
    }
    
    record.count++;
    return true;
}

/**
 * Get rate limit key from request
 */
function getRateLimitKey(req, endpoint) {
    // Use IP + endpoint as key
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return `${ip}:${endpoint}`;
}

/**
 * Rate limit response helper
 */
function rateLimitResponse(res) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetAt + 60000) {
            rateLimitStore.delete(key);
        }
    }
}, 300000);

// Modules
const OllamaClient = require('./ollama');
// Use StorageCompat for gradual migration to Supabase
// Falls back to local JSON if Supabase is not configured
const { createSyncCompatStorage } = require('./storageCompat');
const LegacyStorage = require('./storage'); // Keep for fallback
const DocumentProcessor = require('./processor');
const llm = require('./llm');
const modelMetadata = require('./llm/modelMetadata');
const tokenBudget = require('./llm/tokenBudget');
const llmRouter = require('./llm/router');

// ==================== SOTA: Query Embedding Cache ====================
// Cache for query embeddings to avoid re-computing for repeated/similar queries
const queryEmbeddingCache = new Map();
const QUERY_CACHE_MAX_SIZE = 200;
const QUERY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedQueryEmbedding(query, model) {
    const key = `${model}:${query.toLowerCase().trim()}`;
    const cached = queryEmbeddingCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < QUERY_CACHE_TTL) {
        return cached.embedding;
    }
    return null;
}

function setCachedQueryEmbedding(query, model, embedding) {
    const key = `${model}:${query.toLowerCase().trim()}`;
    // Evict oldest if at capacity
    if (queryEmbeddingCache.size >= QUERY_CACHE_MAX_SIZE) {
        const oldest = queryEmbeddingCache.keys().next().value;
        queryEmbeddingCache.delete(oldest);
    }
    queryEmbeddingCache.set(key, { embedding, timestamp: Date.now() });
}
// ==================== END Query Embedding Cache ====================
const healthRegistry = require('./llm/healthRegistry');
const llmConfig = require('./llm/config');

// Supabase Auth (optional - gracefully degrade if not configured)
let supabase = null;
try {
    supabase = require('./supabase');
} catch (e) {
    console.log('[Supabase] Module not available, auth features disabled');
}

// Email Service (Resend)
let emailService = null;
try {
    emailService = require('./supabase/email');
} catch (e) {
    console.log('[Email] Email service not available');
}

// RBAC Module
const rbac = require('./rbac');

// Check if running as packaged executable
const IS_PACKAGED = !!process.pkg;

// Load .env file if exists (ONLY in development mode, not in packaged exe)
function loadEnvFile() {
    // Don't load .env in packaged executable - force users to configure in Settings
    if (IS_PACKAGED) {
        console.log('Running as packaged executable - API keys must be configured in Settings');
        return false;
    }
    
    const envPaths = [
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '.env')
    ];
    
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
                if (match && !process.env[match[1]]) {
                    // Remove surrounding quotes if present
                    let value = match[2];
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    process.env[match[1]] = value;
                }
            });
            console.log(`[DEV] Loaded environment from ${path.relative(process.cwd(), envPath)}`);
            return true;
        }
    }
    return false;
}

// Load .env before anything else (only in dev mode)
loadEnvFile();

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
const PUBLIC_DIR = path.join(__dirname, 'public');

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
            console.log(`[LLMConfig] Auto-configured perTask.text: ${provider}/${model}`);
        }
    }
    
    // Set perTask.vision defaults
    if (!config.llm.perTask.vision?.provider && !config.llm.perTask.vision?.model) {
        const provider = config.llm.provider || 'ollama';
        const model = config.llm.models?.vision || config.ollama?.visionModel;
        
        if (provider && model) {
            config.llm.perTask.vision = { provider, model };
            console.log(`[LLMConfig] Auto-configured perTask.vision: ${provider}/${model}`);
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
                        console.log(`[DEV] Using ${providerId} API key from ${envVar}`);
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
                    console.log(`Data directory set to: ${merged.dataDir} (project: ${currentProjectId})`);
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
        console.error('Error loading config:', e.message);
    }
    return migrateLLMConfig({ ...DEFAULT_CONFIG, dataDir: path.join(DATA_DIR, 'projects', 'default') });
}

function saveConfig(config) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Initialize
let config = loadConfig();
const ollama = new OllamaClient(config.ollama.host, config.ollama.port);

// Use StorageCompat for Supabase integration if available
// Falls back to local JSON storage if Supabase is not configured
let storage;
const USE_SUPABASE_STORAGE = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;

// Create processor early (will be updated after storage init)
let processor = null;

if (USE_SUPABASE_STORAGE) {
    console.log('[Storage] Using Supabase-backed storage');
    storage = createSyncCompatStorage(DATA_DIR);
    // Init is async - update processor dataDir when done
    storage.init().then(() => {
        const projectDataDir = storage.getProjectDataDir();
        if (processor && projectDataDir) {
            processor.updateDataDir(projectDataDir);
            console.log(`[Processor] Updated data directory: ${projectDataDir}`);
        }
    }).catch(e => console.warn('[Storage] Init warning:', e.message));
} else {
    console.log('[Storage] Using local JSON storage');
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
    console.log(`Startup cleanup: removed ${cleanupResult.decisions} bad decisions, ${cleanupResult.people} invalid people`);
}
// Record daily stats snapshot for trend tracking
storage.recordDailyStats();
processor = new DocumentProcessor(storage, ollama, config);

// ==================== LOAD GRAPH CONFIG FROM SUPABASE ====================
// Try to load graph configuration from Supabase system_config table
async function loadGraphConfigFromSupabase() {
    if (!supabase || !supabase.isConfigured()) {
        console.log('[Graph] Supabase not configured, using local config');
        return null;
    }
    
    try {
        const client = supabase.getAdminClient();
        if (!client) {
            console.log('[Graph] Supabase admin client not available');
            return null;
        }
        
        const { data: graphConfigRow, error } = await client
            .from('system_config')
            .select('value')
            .eq('key', 'graph')
            .single();
        
        if (error || !graphConfigRow?.value) {
            console.log('[Graph] No graph config in Supabase system_config');
            return null;
        }
        
        const graphConfig = graphConfigRow.value;
        console.log('[Graph] Loaded config from Supabase:', JSON.stringify(graphConfig, null, 2));
        
        // Force Supabase provider
        graphConfig.provider = 'supabase';
        
        return graphConfig;
    } catch (err) {
        console.log('[Graph] Error loading config from Supabase:', err.message);
        return null;
    }
}

// Load LLM configuration from Supabase
async function loadLLMConfigFromSupabase() {
    if (!supabase || !supabase.isConfigured()) {
        console.log('[LLMConfig] Supabase not configured, using local config');
        return;
    }
    
    try {
        const systemConfig = require('./supabase/system');
        const llmPerTask = await systemConfig.getLLMConfig();
        
        if (llmPerTask && Object.keys(llmPerTask).length > 0) {
            // Sync Supabase llm_pertask to local config
            if (!config.llm) config.llm = {};
            config.llm.perTask = llmPerTask;
            console.log('[LLMConfig] Loaded from Supabase:', JSON.stringify(llmPerTask, null, 2));
        } else {
            console.log('[LLMConfig] No llm_pertask config in Supabase');
        }
    } catch (error) {
        console.warn('[LLMConfig] Failed to load from Supabase:', error.message);
    }
}

// Initialize graph database on startup
async function initGraphOnStartup() {
    // First try Supabase config
    const supabaseGraphConfig = await loadGraphConfigFromSupabase();
    
    // Use Supabase config if available and enabled, otherwise local config
    const effectiveConfig = (supabaseGraphConfig?.enabled) ? supabaseGraphConfig : config.graph;
    
    if (effectiveConfig?.enabled && effectiveConfig?.autoConnect !== false) {
        console.log('[Graph] Auto-connecting to graph database...');
        
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
            console.log(`[Graph] ✓ Connected to graph: ${graphConfig.graphName}`);
            // Update local config for compatibility
            config.graph = graphConfig;
            
            // ==================== SOTA v2.0: ONTOLOGY SYSTEM INITIALIZATION ====================
            await initOntologySystem(storage.getGraphProvider());
            
            // Auto-sync data to graph if autoSync is enabled (default: true)
            if (effectiveConfig.autoSync !== false) {
                console.log('[Graph] Auto-syncing data to graph...');
                try {
                    const syncResult = await storage.syncToGraph({ useOntology: true });
                    if (syncResult.ok) {
                        const synced = syncResult.synced || {};
                        console.log(`[Graph] ✓ Auto-sync complete: ${synced.nodes || 0} nodes, ${synced.relationships || 0} relationships`);
                    } else {
                        console.log(`[Graph] ⚠ Auto-sync warning: ${syncResult.error || 'Unknown error'}`);
                    }
                } catch (syncErr) {
                    console.log(`[Graph] ⚠ Auto-sync error: ${syncErr.message}`);
                }
            }
        } else {
            console.log(`[Graph] ✗ Failed to connect: ${result.error}`);
        }
    } else {
        console.log('[Graph] Graph database not enabled or auto-connect disabled');
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
        
        console.log('[Ontology] Initializing SOTA v2.0 ontology system...');
        
        // 1. Initialize OntologyManager with Supabase persistence
        const ontology = getOntologyManager();
        ontology.setStorage(storage);
        
        // 2. Try to load from Supabase, fallback to file
        const loaded = await ontology.load();
        if (!loaded) {
            console.log('[Ontology] ⚠ Could not load ontology schema');
            return;
        }
        
        console.log(`[Ontology] ✓ Loaded from ${ontology.getLoadedFrom()}: v${ontology.getSchema()?.version || '?'}`);
        
        // 3. Check if migration to Supabase is needed
        if (ontology.getLoadedFrom() === 'file' && storage.saveOntologySchema) {
            const syncStatus = await ontology.checkSyncStatus();
            if (!syncStatus.synced && syncStatus.fileVersion && !syncStatus.dbVersion) {
                console.log('[Ontology] Migrating schema to Supabase...');
                const migrationResult = await ontology.migrateToSupabase();
                if (migrationResult.success) {
                    console.log(`[Ontology] ✓ Migration complete: ${migrationResult.counts?.total || 0} items`);
                } else {
                    console.log(`[Ontology] ⚠ Migration warning: ${migrationResult.error}`);
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
                console.log(`[Ontology] ✓ Graph sync: ${r.indexes?.created || 0} indexes, ${r.entityTypes?.synced || 0} entities, ${r.relationTypes?.synced || 0} relations`);
            } else {
                console.log(`[Ontology] ⚠ Graph sync warning: ${exportResult.error}`);
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
                    console.log('[Ontology] ✓ Realtime sync started');
                }
            }
            
            // 7. Initialize Background Worker and register scheduled jobs
            const backgroundWorker = getOntologyBackgroundWorker({
                graphProvider,
                storage,
                llmConfig: config.llm,
                dataDir: storage.getProjectDataDir()
            });
            
            // Register job handlers with the scheduler
            initOntologyBackgroundJobs(backgroundWorker, inferenceEngine);
        }
        
        console.log('[Ontology] ✓ SOTA v2.0 initialization complete');
    } catch (err) {
        // Ontology system is optional - log but don't crash
        console.log(`[Ontology] ⚠ Initialization warning: ${err.message}`);
    }
}

// ==================== ONTOLOGY BACKGROUND JOBS ====================
// Register handlers and create default jobs for continuous ontology optimization
function initOntologyBackgroundJobs(backgroundWorker, inferenceEngine) {
    try {
        const { getScheduledJobs } = require('./advanced');
        const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
        
        console.log('[Ontology] Registering background job handlers...');
        
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
        
        console.log('[Ontology] ✓ Background jobs registered and scheduler started');
        
    } catch (err) {
        console.log(`[Ontology] ⚠ Background jobs warning: ${err.message}`);
    }
}

// Run async init (don't block server startup)
(async () => {
    // Load LLM config from Supabase first
    await loadLLMConfigFromSupabase();
    
    // Then init graph
    await initGraphOnStartup();
})().catch(err => {
    console.log('[Startup] Init error:', err.message);
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
    console.log('Briefing cache invalidated');
}

// Ensure data directories exist (SOTA structure)
function ensureDirectories() {
    const dirs = [
        DATA_DIR,
        // Legacy folders (for backward compatibility)
        path.join(DATA_DIR, 'newinfo'),
        path.join(DATA_DIR, 'newtranscripts'),
        path.join(DATA_DIR, 'archived', 'documents'),
        path.join(DATA_DIR, 'archived', 'meetings'),
        path.join(DATA_DIR, 'content'),
        // SOTA structure
        path.join(DATA_DIR, 'documents', 'inbox', 'documents'),
        path.join(DATA_DIR, 'documents', 'inbox', 'transcripts'),
        path.join(DATA_DIR, 'documents', 'library'),
        path.join(DATA_DIR, 'documents', 'cache', 'thumbnails'),
        path.join(DATA_DIR, 'documents', 'trash'),
        path.join(DATA_DIR, 'exports'),
        path.join(DATA_DIR, 'temp', 'processing')
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}
ensureDirectories();

/**
 * Generate SVG icon for file type (used as thumbnail placeholder)
 */
function generateFileIconSVG(fileType) {
    const colors = {
        pdf: '#e74c3c',
        doc: '#3498db',
        docx: '#3498db',
        xls: '#27ae60',
        xlsx: '#27ae60',
        ppt: '#e67e22',
        pptx: '#e67e22',
        txt: '#95a5a6',
        md: '#9b59b6',
        jpg: '#1abc9c',
        jpeg: '#1abc9c',
        png: '#1abc9c',
        gif: '#1abc9c',
        default: '#7f8c8d'
    };
    
    const color = colors[fileType] || colors.default;
    const ext = (fileType || '?').toUpperCase().slice(0, 4);
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f5f5f5" rx="8"/>
        <rect x="50" y="30" width="100" height="130" fill="white" stroke="#ddd" stroke-width="2" rx="4"/>
        <polygon points="120,30 150,60 120,60" fill="#ddd"/>
        <rect x="60" y="80" width="80" height="8" fill="#eee" rx="2"/>
        <rect x="60" y="95" width="60" height="8" fill="#eee" rx="2"/>
        <rect x="60" y="110" width="70" height="8" fill="#eee" rx="2"/>
        <rect x="50" y="135" width="100" height="25" fill="${color}" rx="4"/>
        <text x="100" y="153" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${ext}</text>
    </svg>`;
}

/**
 * Get SOTA document path based on date
 * Returns: documents/library/{year}/{month}/{doc_id}/
 */
function getDocumentSOTAPath(docId, createdAt = new Date()) {
    const date = new Date(createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return path.join(DATA_DIR, 'documents', 'library', String(year), month, docId);
}

/**
 * Ensure document SOTA directory exists with subdirs
 */
function ensureDocumentSOTADir(docId, createdAt = new Date()) {
    const docPath = getDocumentSOTAPath(docId, createdAt);
    const subdirs = ['original', 'versions', 'content', 'media'];
    
    subdirs.forEach(subdir => {
        const fullPath = path.join(docPath, subdir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
    
    return docPath;
}

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Serve static file
function serveStatic(res, filePath) {
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

// Parse JSON body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

// Parse multipart form data
function parseMultipart(buffer, boundary) {
    const result = { files: [], folder: 'newinfo', documentDate: null, documentTime: null, emailId: null };
    const boundaryBuffer = Buffer.from('--' + boundary);
    const parts = [];

    let start = 0;
    let pos = buffer.indexOf(boundaryBuffer, start);

    while (pos !== -1) {
        if (start > 0) {
            // Remove trailing CRLF from previous part
            let end = pos - 2;
            if (end > start) {
                parts.push(buffer.slice(start, end));
            }
        }
        start = pos + boundaryBuffer.length + 2; // Skip boundary and CRLF
        pos = buffer.indexOf(boundaryBuffer, start);
    }

    // Parse each part
    for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headerStr = part.slice(0, headerEnd).toString('utf8');
        const data = part.slice(headerEnd + 4);

        // Check if it's a file
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        const nameMatch = headerStr.match(/name="([^"]+)"/);

        if (filenameMatch && data.length > 0) {
            result.files.push({
                filename: filenameMatch[1],
                data: data
            });
        } else if (nameMatch) {
            const fieldName = nameMatch[1];
            const fieldValue = data.toString('utf8').trim();
            if (fieldName === 'folder') {
                result.folder = fieldValue;
            } else if (fieldName === 'documentDate') {
                result.documentDate = fieldValue;
            } else if (fieldName === 'documentTime') {
                result.documentTime = fieldValue;
            } else if (fieldName === 'emailId') {
                result.emailId = fieldValue;
            }
        }
    }

    return result;
}

// JSON response helper
function jsonResponse(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

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
        console.warn('[Auth] Failed to get current user:', err.message);
        return null;
    }
}

// Get MIME type from filename
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.zip': 'application/zip',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.html': 'text/html',
        '.md': 'text/markdown'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// API Routes
async function handleAPI(req, res, pathname) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    try {
        // ==================== Authentication API ====================
        
        // GET /api/auth/status - Check if auth is configured
        if (pathname === '/api/auth/status' && req.method === 'GET') {
            if (supabase && supabase.isConfigured()) {
                const configInfo = supabase.getConfigInfo();
                jsonResponse(res, { 
                    configured: true, 
                    url: configInfo.url
                });
            } else {
                jsonResponse(res, { configured: false });
            }
            return;
        }
        
        // POST /api/auth/register - Register new user
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const { email, password, username, display_name } = body;
            
            const result = await supabase.auth.register(email, password, { username, display_name });
            
            if (result.success) {
                // Set cookie if session exists
                if (result.session) {
                    res.setHeader('Set-Cookie', [
                        `sb-access-token=${result.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
                        `sb-refresh-token=${result.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
                    ]);
                }
                jsonResponse(res, result);
            } else {
                jsonResponse(res, result, 400);
            }
            return;
        }
        
        // POST /api/auth/login - Login
        if (pathname === '/api/auth/login' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const { email, password } = body;
            
            const result = await supabase.auth.login(email, password);
            
            if (result.success) {
                // Set httpOnly cookies for session
                res.setHeader('Set-Cookie', [
                    `sb-access-token=${result.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
                    `sb-refresh-token=${result.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
                ]);
                jsonResponse(res, {
                    success: true,
                    user: result.user
                });
            } else {
                jsonResponse(res, result, 401);
            }
            return;
        }
        
        // POST /api/auth/logout - Logout
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            await supabase.auth.logout(token);
            
            // Clear cookies
            res.setHeader('Set-Cookie', [
                'sb-access-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
                'sb-refresh-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
            ]);
            
            jsonResponse(res, { success: true });
            return;
        }
        
        // GET /api/auth/me - Get current user
        if (pathname === '/api/auth/me' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                // Return unauthenticated state instead of error
                jsonResponse(res, { authenticated: false, user: null });
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            if (!token) {
                // Return unauthenticated state with 200 OK
                jsonResponse(res, { authenticated: false, user: null });
                return;
            }
            
            const result = await supabase.auth.getUser(token);
            
            if (result.success) {
                jsonResponse(res, { 
                    authenticated: true, 
                    user: result.user 
                });
            } else {
                jsonResponse(res, { authenticated: false }, 401);
            }
            return;
        }
        
        // POST /api/auth/refresh - Refresh access token
        if (pathname === '/api/auth/refresh' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            // Get refresh token from cookie
            const cookies = req.headers['cookie'] || '';
            const refreshMatch = cookies.match(/sb-refresh-token=([^;]+)/);
            
            if (!refreshMatch) {
                jsonResponse(res, { error: 'No refresh token' }, 401);
                return;
            }
            
            const result = await supabase.auth.refreshToken(refreshMatch[1]);
            
            if (result.success) {
                res.setHeader('Set-Cookie', [
                    `sb-access-token=${result.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
                    `sb-refresh-token=${result.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
                ]);
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, result, 401);
            }
            return;
        }
        
        // POST /api/auth/forgot-password - Request password reset
        if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.auth.requestPasswordReset(body.email);
            jsonResponse(res, result);
            return;
        }
        
        // POST /api/auth/reset-password - Reset password with token
        if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.auth.updatePassword(body.password, body.access_token);
            
            if (result.success) {
                jsonResponse(res, result);
            } else {
                jsonResponse(res, result, 400);
            }
            return;
        }

        // ==================== OTP Authentication API ====================
        
        // POST /api/auth/otp/request - Request OTP code for login
        if (pathname === '/api/auth/otp/request' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const { email } = body;
            
            if (!email || !email.includes('@')) {
                jsonResponse(res, { error: 'Valid email is required' }, 400);
                return;
            }
            
            // Get client IP for rate limiting
            const requestIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                              req.headers['x-real-ip'] || 
                              req.socket?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            
            try {
                // Check if user exists (for login, user must exist)
                const { getAdminClient } = require('./supabase/client');
                const admin = getAdminClient();
                
                if (admin) {
                    const { data: existingUser } = await admin
                        .from('user_profiles')
                        .select('id')
                        .eq('email', email.toLowerCase())
                        .maybeSingle();
                    
                    // For security, don't reveal if email exists
                    // But we can still create OTP (will fail silently on verify if no user)
                }
                
                // Create OTP
                const otp = require('./supabase/otp');
                const result = await otp.createOTP(email, 'login', requestIp, userAgent);
                
                if (!result.success) {
                    // Return rate limit info if applicable
                    if (result.retryAfter) {
                        jsonResponse(res, { 
                            error: result.error,
                            retryAfter: result.retryAfter
                        }, 429);
                    } else {
                        jsonResponse(res, { error: result.error }, 400);
                    }
                    return;
                }
                
                // Send email with OTP code
                const emailService = require('./supabase/email');
                const emailResult = await emailService.sendLoginCodeEmail({
                    to: email,
                    code: result.code,
                    expiresInMinutes: result.expiresInMinutes
                });
                
                if (!emailResult.success) {
                    console.error('[Auth] Failed to send OTP email:', emailResult.error);
                    // Don't reveal email sending failure to user (security)
                }
                
                // Always return success (don't reveal if email exists or was sent)
                jsonResponse(res, { 
                    success: true,
                    message: 'If an account exists with this email, you will receive a login code.',
                    expiresInMinutes: result.expiresInMinutes,
                    config: otp.getConfig()
                });
                
            } catch (err) {
                console.error('[Auth] OTP request error:', err.message);
                jsonResponse(res, { error: 'Failed to process request' }, 500);
            }
            return;
        }
        
        // POST /api/auth/otp/verify - Verify OTP code and login
        if (pathname === '/api/auth/otp/verify' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const { email, code } = body;
            
            if (!email || !code) {
                jsonResponse(res, { error: 'Email and code are required' }, 400);
                return;
            }
            
            // Validate code format
            if (!/^\d{6}$/.test(code)) {
                jsonResponse(res, { error: 'Invalid code format. Please enter 6 digits.' }, 400);
                return;
            }
            
            try {
                const otp = require('./supabase/otp');
                const verifyResult = await otp.verifyOTP(email, code, 'login');
                
                if (!verifyResult.success) {
                    jsonResponse(res, { 
                        error: verifyResult.error,
                        attemptsRemaining: verifyResult.attemptsRemaining
                    }, 401);
                    return;
                }
                
                // OTP verified - create session for the user
                const { getAdminClient } = require('./supabase/client');
                const admin = getAdminClient();
                
                if (!admin) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }
                
                // Find user by email
                const { data: userData, error: userError } = await admin.auth.admin.listUsers();
                
                if (userError) {
                    console.error('[Auth] Failed to list users:', userError.message);
                    jsonResponse(res, { error: 'Authentication failed' }, 500);
                    return;
                }
                
                const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                
                if (!user) {
                    jsonResponse(res, { error: 'No account found with this email' }, 404);
                    return;
                }
                
                // Check if email is confirmed
                if (!user.email_confirmed_at) {
                    jsonResponse(res, { 
                        error: 'Please confirm your email address first',
                        needsEmailVerification: true
                    }, 403);
                    return;
                }
                
                // Generate session tokens using Supabase Admin API
                // Create a magic link session for the user
                const { data: sessionData, error: sessionError } = await admin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: user.email
                });
                
                if (sessionError || !sessionData) {
                    console.error('[Auth] Failed to generate session:', sessionError?.message);
                    
                    // Fallback: Try to use signInWithPassword with a temporary approach
                    // This is a workaround - in production, you'd want proper session generation
                    jsonResponse(res, { 
                        error: 'Failed to create session. Please try password login.',
                        fallbackToPassword: true
                    }, 500);
                    return;
                }
                
                // Get user profile
                const profile = await supabase.auth.getUserProfile(user.id);
                
                // For OTP login, we need to create the session differently
                // Since we can't easily create tokens, redirect to verify the generated link
                // Or use a custom session approach
                
                // Alternative: Use the Supabase client to exchange the token
                const { getClient } = require('./supabase/client');
                const client = getClient();
                
                if (sessionData.properties?.hashed_token) {
                    // We have a magic link token - verify it
                    const verifyUrl = sessionData.properties.verification_url || sessionData.properties.action_link;
                    
                    // Extract token from URL and verify
                    if (verifyUrl) {
                        const urlParams = new URL(verifyUrl);
                        const token = urlParams.searchParams.get('token') || urlParams.hash?.split('access_token=')[1]?.split('&')[0];
                        
                        if (token) {
                            // Verify the token and get session
                            const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
                                token_hash: sessionData.properties.hashed_token,
                                type: 'magiclink'
                            });
                            
                            if (!verifyError && verifyData.session) {
                                // Set session cookies (30 days)
                                res.setHeader('Set-Cookie', [
                                    `sb-access-token=${verifyData.session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
                                    `sb-refresh-token=${verifyData.session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
                                ]);
                                
                                // Invalidate all other OTPs for this email
                                await otp.invalidateOTPs(email, 'login');
                                
                                // Send new device notification (optional)
                                const emailService = require('./supabase/email');
                                const requestIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                                                  req.headers['x-real-ip'] || 
                                                  req.socket?.remoteAddress || null;
                                const userAgent = req.headers['user-agent'] || null;
                                
                                // Fire and forget - don't wait
                                emailService.sendNewDeviceLoginEmail({
                                    to: email,
                                    deviceInfo: userAgent,
                                    loginTime: new Date().toISOString(),
                                    ipAddress: requestIp
                                }).catch(e => console.log('[Auth] Device notification skipped:', e.message));
                                
                                jsonResponse(res, {
                                    success: true,
                                    user: {
                                        id: user.id,
                                        email: user.email,
                                        email_confirmed_at: user.email_confirmed_at,
                                        created_at: user.created_at,
                                        user_metadata: user.user_metadata,
                                        profile: profile
                                    }
                                });
                                return;
                            }
                        }
                    }
                }
                
                // If we couldn't create a proper session, return the magic link
                // The frontend can redirect to it
                if (sessionData.properties?.action_link) {
                    jsonResponse(res, {
                        success: true,
                        redirectTo: sessionData.properties.action_link,
                        message: 'Please click the link to complete login'
                    });
                    return;
                }
                
                // Last resort - inform user to use password login
                jsonResponse(res, { 
                    error: 'OTP verification succeeded but session creation failed. Please use password login.',
                    otpVerified: true
                }, 500);
                
            } catch (err) {
                console.error('[Auth] OTP verify error:', err.message);
                jsonResponse(res, { error: 'Verification failed' }, 500);
            }
            return;
        }
        
        // POST /api/auth/otp/resend - Resend OTP code (alias for request)
        if (pathname === '/api/auth/otp/resend' && req.method === 'POST') {
            // Redirect to request handler (same logic with rate limiting)
            // This is just a semantic alias for the frontend
            const body = await parseBody(req);
            req.body = body;
            // Fall through to request handler by rewriting pathname
        }
        
        // GET /api/auth/otp/config - Get OTP configuration for frontend
        if (pathname === '/api/auth/otp/config' && req.method === 'GET') {
            try {
                const otp = require('./supabase/otp');
                jsonResponse(res, otp.getConfig());
            } catch (err) {
                jsonResponse(res, { 
                    codeLength: 6, 
                    expirationMinutes: 10, 
                    resendCooldownSeconds: 60 
                });
            }
            return;
        }
        
        // GET /api/auth/confirm-email - Confirm email via link
        if (pathname === '/api/auth/confirm-email' && req.method === 'GET') {
            const code = url.searchParams.get('code');
            const email = url.searchParams.get('email');
            
            if (!code || !email) {
                // Redirect to frontend error page
                res.writeHead(302, { 
                    'Location': '/?auth=confirm-error&message=missing-params' 
                });
                res.end();
                return;
            }
            
            try {
                const otp = require('./supabase/otp');
                const verifyResult = await otp.verifyOTP(email, code, 'email_confirm');
                
                if (!verifyResult.success) {
                    res.writeHead(302, { 
                        'Location': `/?auth=confirm-error&message=${encodeURIComponent(verifyResult.error)}` 
                    });
                    res.end();
                    return;
                }
                
                // Mark email as confirmed in Supabase
                const { getAdminClient } = require('./supabase/client');
                const admin = getAdminClient();
                
                if (admin) {
                    // Find and update user
                    const { data: userData } = await admin.auth.admin.listUsers();
                    const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
                    
                    if (user && !user.email_confirmed_at) {
                        await admin.auth.admin.updateUserById(user.id, {
                            email_confirm: true
                        });
                    }
                }
                
                // Invalidate all confirmation OTPs for this email
                await otp.invalidateOTPs(email, 'email_confirm');
                
                // Redirect to success page
                res.writeHead(302, { 
                    'Location': '/?auth=confirmed&email=' + encodeURIComponent(email) 
                });
                res.end();
                
            } catch (err) {
                console.error('[Auth] Email confirmation error:', err.message);
                res.writeHead(302, { 
                    'Location': '/?auth=confirm-error&message=server-error' 
                });
                res.end();
            }
            return;
        }
        
        // POST /api/auth/confirm-email - Confirm email via code (API)
        if (pathname === '/api/auth/confirm-email' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const body = await parseBody(req);
            const { email, code } = body;
            
            if (!email || !code) {
                jsonResponse(res, { error: 'Email and code are required' }, 400);
                return;
            }
            
            try {
                const otp = require('./supabase/otp');
                const verifyResult = await otp.verifyOTP(email, code, 'email_confirm');
                
                if (!verifyResult.success) {
                    jsonResponse(res, { 
                        error: verifyResult.error,
                        attemptsRemaining: verifyResult.attemptsRemaining
                    }, 401);
                    return;
                }
                
                // Mark email as confirmed
                const { getAdminClient } = require('./supabase/client');
                const admin = getAdminClient();
                
                if (admin) {
                    const { data: userData } = await admin.auth.admin.listUsers();
                    const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
                    
                    if (user && !user.email_confirmed_at) {
                        await admin.auth.admin.updateUserById(user.id, {
                            email_confirm: true
                        });
                    }
                }
                
                // Invalidate all confirmation OTPs
                await otp.invalidateOTPs(email, 'email_confirm');
                
                jsonResponse(res, { 
                    success: true, 
                    message: 'Email confirmed successfully. You can now log in.' 
                });
                
            } catch (err) {
                console.error('[Auth] Email confirmation error:', err.message);
                jsonResponse(res, { error: 'Confirmation failed' }, 500);
            }
            return;
        }

        // ==================== Timezones API ====================
        
        // GET /api/timezones - Get all timezones from database
        if (pathname === '/api/timezones' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                // Return default timezones if Supabase not configured
                jsonResponse(res, { 
                    timezones: [
                        { code: 'UTC', name: 'Coordinated Universal Time', utc_offset: '+00:00' },
                        { code: 'Europe/Lisbon', name: 'Lisbon, Portugal', utc_offset: '+00:00' },
                        { code: 'Europe/London', name: 'London, United Kingdom', utc_offset: '+00:00' },
                    ]
                });
                return;
            }
            
            try {
                const client = supabase.getAdminClient();
                const { data, error } = await client
                    .from('timezones')
                    .select('code, name, region, utc_offset, abbreviation')
                    .order('utc_offset', { ascending: true })
                    .order('name', { ascending: true });
                
                if (error) {
                    console.error('[API] Timezones error:', error.message);
                    jsonResponse(res, { error: 'Failed to load timezones' }, 500);
                    return;
                }
                
                jsonResponse(res, { timezones: data || [] });
            } catch (error) {
                console.error('[API] Timezones exception:', error.message);
                jsonResponse(res, { error: 'Failed to load timezones' }, 500);
            }
            return;
        }
        
        // ==================== Profile API ====================
        
        // GET /api/profile - Get current user profile
        if (pathname === '/api/profile' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            const profile = await supabase.auth.getUserProfile(authResult.user.id);
            
            // Always include email from auth user (not stored in user_profiles)
            const fullProfile = {
                ...(profile || {}),
                id: authResult.user.id,
                email: authResult.user.email,
                display_name: profile?.display_name || authResult.user.email?.split('@')[0] || 'User',
                created_at: profile?.created_at || authResult.user.created_at || new Date().toISOString()
            };
            
            jsonResponse(res, { profile: fullProfile });
            return;
        }
        
        // PUT /api/profile - Update current user profile
        if (pathname === '/api/profile' && req.method === 'PUT') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.auth.upsertUserProfile(authResult.user.id, body);
            
            if (result.success) {
                jsonResponse(res, { profile: result.profile });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/profile/sessions - Get user sessions
        if (pathname === '/api/profile/sessions' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            // Return current session info (Supabase doesn't expose all sessions via API)
            jsonResponse(res, { 
                sessions: [{
                    id: 'current',
                    device: req.headers['user-agent'] || 'Unknown',
                    ip_address: req.socket?.remoteAddress || 'Unknown',
                    location: null,
                    last_active: new Date().toISOString(),
                    is_current: true
                }]
            });
            return;
        }
        
        // DELETE /api/profile/sessions/:id - Revoke a session
        if (pathname.match(/^\/api\/profile\/sessions\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            // Supabase manages sessions internally
            jsonResponse(res, { success: true });
            return;
        }
        
        // POST /api/profile/sessions/revoke-all - Revoke all sessions
        if (pathname === '/api/profile/sessions/revoke-all' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            // Sign out user (revokes current session)
            await supabase.auth.logout();
            jsonResponse(res, { success: true });
            return;
        }
        
        // POST /api/profile/avatar - Upload avatar
        if (pathname === '/api/profile/avatar' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            try {
                // Parse multipart form data
                const boundary = req.headers['content-type']?.split('boundary=')[1];
                if (!boundary) {
                    jsonResponse(res, { error: 'Invalid content type' }, 400);
                    return;
                }
                
                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                
                // Parse the multipart data (simplified - extract file data)
                const data = buffer.toString('binary');
                const parts = data.split('--' + boundary);
                
                let fileBuffer = null;
                let fileName = 'avatar.jpg';
                let contentType = 'image/jpeg';
                
                for (const part of parts) {
                    if (part.includes('filename=')) {
                        const match = part.match(/filename="([^"]+)"/);
                        if (match) fileName = match[1];
                        
                        const typeMatch = part.match(/Content-Type:\s*([^\r\n]+)/i);
                        if (typeMatch) contentType = typeMatch[1].trim();
                        
                        // Extract file content (after double CRLF)
                        const contentStart = part.indexOf('\r\n\r\n') + 4;
                        const contentEnd = part.lastIndexOf('\r\n');
                        if (contentStart > 3 && contentEnd > contentStart) {
                            fileBuffer = Buffer.from(part.substring(contentStart, contentEnd), 'binary');
                        }
                    }
                }
                
                if (!fileBuffer) {
                    jsonResponse(res, { error: 'No file uploaded' }, 400);
                    return;
                }
                
                // Upload to Supabase Storage
                const userId = authResult.user.id;
                const ext = fileName.split('.').pop() || 'jpg';
                const storagePath = `avatars/${userId}.${ext}`;
                
                const client = supabase.getAdminClient();
                
                // Upload to storage bucket (create bucket if needed)
                const { data: uploadData, error: uploadError } = await client.storage
                    .from('avatars')
                    .upload(storagePath, fileBuffer, {
                        contentType,
                        upsert: true
                    });
                
                if (uploadError) {
                    // Try creating bucket first
                    if (uploadError.message.includes('not found')) {
                        await client.storage.createBucket('avatars', { public: true });
                        const { error: retryError } = await client.storage
                            .from('avatars')
                            .upload(storagePath, fileBuffer, { contentType, upsert: true });
                        if (retryError) throw retryError;
                    } else {
                        throw uploadError;
                    }
                }
                
                // Get public URL
                const { data: urlData } = client.storage
                    .from('avatars')
                    .getPublicUrl(storagePath);
                
                const avatarUrl = urlData.publicUrl;
                
                // Update user profile with avatar URL
                await supabase.auth.upsertUserProfile(userId, { avatar_url: avatarUrl });
                
                jsonResponse(res, { avatar_url: avatarUrl });
            } catch (error) {
                console.error('[API] Avatar upload error:', error.message);
                jsonResponse(res, { error: 'Avatar upload failed: ' + error.message }, 500);
            }
            return;
        }
        
        // DELETE /api/profile/avatar - Remove avatar
        if (pathname === '/api/profile/avatar' && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            try {
                const userId = authResult.user.id;
                const client = supabase.getAdminClient();
                
                // Delete from storage (try common extensions)
                for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
                    try {
                        await client.storage.from('avatars').remove([`avatars/${userId}.${ext}`]);
                    } catch (e) {
                        // Ignore errors - file might not exist
                    }
                }
                
                // Clear avatar URL in profile
                await supabase.auth.upsertUserProfile(userId, { avatar_url: null });
                
                jsonResponse(res, { success: true });
            } catch (error) {
                console.error('[API] Avatar delete error:', error.message);
                jsonResponse(res, { error: 'Failed to remove avatar' }, 500);
            }
            return;
        }
        
        // GET /api/profile/activity - Get user activity
        if (pathname === '/api/profile/activity' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            // Get activity from Supabase
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const activity = await supabase.activity.getUserActivity(authResult.user.id, { limit });
            
            jsonResponse(res, { activity: activity || [] });
            return;
        }
        
        // POST /api/profile/change-password - Change password
        if (pathname === '/api/profile/change-password' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const token = supabase.auth.extractToken(req);
            const result = await supabase.auth.updatePassword(body.new_password, token);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/profile/delete - Delete account
        if (pathname === '/api/profile/delete' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const authResult = await supabase.auth.verifyRequest(req);
            if (!authResult.authenticated) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            // Account deletion requires admin privileges - for now just return error
            jsonResponse(res, { error: 'Account deletion requires contacting support' }, 400);
            return;
        }

        // ==================== Project Members API ====================
        
        // GET /api/projects/:id/members - Get project members
        if (pathname.match(/^\/api\/projects\/([^/]+)\/members$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/members$/)[1];
            const result = await supabase.members.getProjectMembers(projectId);
            
            if (result.success) {
                jsonResponse(res, { members: result.members });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // PUT /api/projects/:id/members/:userId - Update member role and/or user_role
        if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/) && req.method === 'PUT') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const match = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
            const projectId = match[1];
            const userId = match[2];
            const body = await parseBody(req);
            
            try {
                const client = supabase.getAdminClient();
                
                // Build update object
                const updates = {};
                if (body.role !== undefined) {
                    updates.role = body.role;
                }
                if (body.user_role !== undefined) {
                    updates.user_role = body.user_role || null;
                }
                if (body.user_role_prompt !== undefined) {
                    updates.user_role_prompt = body.user_role_prompt || null;
                }
                if (body.linked_contact_id !== undefined) {
                    updates.linked_contact_id = body.linked_contact_id || null;
                }
                if (body.permissions !== undefined) {
                    updates.permissions = body.permissions || [];
                }
                
                if (Object.keys(updates).length === 0) {
                    jsonResponse(res, { success: true, message: 'No changes' });
                    return;
                }
                
                const { error } = await client
                    .from('project_members')
                    .update(updates)
                    .eq('project_id', projectId)
                    .eq('user_id', userId);
                
                if (error) {
                    console.error('[API] Error updating member:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                jsonResponse(res, { success: true });
            } catch (e) {
                console.error('[API] Error updating member:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }
        
        // PUT /api/projects/:id/members/:userId/permissions - Update member permissions
        if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)\/permissions$/) && req.method === 'PUT') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const match = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)\/permissions$/);
            const projectId = match[1];
            const userId = match[2];
            const body = await parseBody(req);
            
            try {
                const client = supabase.getAdminClient();
                
                const updates = {};
                
                if (body.role !== undefined) {
                    updates.role = body.role;
                }
                if (body.permissions !== undefined) {
                    updates.permissions = body.permissions || [];
                }
                
                if (Object.keys(updates).length === 0) {
                    jsonResponse(res, { success: true, message: 'No changes' });
                    return;
                }
                
                const { error } = await client
                    .from('project_members')
                    .update(updates)
                    .eq('project_id', projectId)
                    .eq('user_id', userId);
                
                if (error) {
                    console.error('[API] Error updating member permissions:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                jsonResponse(res, { success: true });
            } catch (e) {
                console.error('[API] Error updating member permissions:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // DELETE /api/projects/:id/members/:userId - Remove member
        if (pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const match = pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
            const projectId = match[1];
            const userId = match[2];
            
            const result = await supabase.members.removeMember(projectId, userId);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // ==================== Invites API ====================
        
        // POST /api/projects/:id/invites - Create invite
        if (pathname.match(/^\/api\/projects\/([^/]+)\/invites$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            // Get current user
            const token = supabase.auth.extractToken(req);
            if (!token) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const userResult = await supabase.auth.getUser(token);
            if (!userResult.success) {
                jsonResponse(res, { error: 'Invalid token' }, 401);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/invites$/)[1];
            const body = await parseBody(req);
            
            const result = await supabase.invites.createInvite({
                projectId: projectId,
                createdBy: userResult.user.id,
                role: body.role || 'read',
                email: body.email,
                expiresInHours: body.expiresInHours || 48
            });
            
            if (result.success) {
                // Build invite URL
                const baseUrl = `http://${req.headers.host}`;
                const inviteUrl = `${baseUrl}/join?token=${result.token}`;
                
                // Send invitation email if email service is configured
                let emailSent = false;
                if (emailService && emailService.isConfigured() && body.email) {
                    try {
                        // Get inviter profile and project name
                        const adminClient = supabase.getAdminClient();
                        const [inviterRes, projectRes] = await Promise.all([
                            adminClient.from('user_profiles').select('display_name, username').eq('id', userResult.user.id).single(),
                            adminClient.from('projects').select('name').eq('id', projectId).single(),
                        ]);
                        
                        const inviterName = inviterRes.data?.display_name || inviterRes.data?.username || userResult.user.email;
                        const projectName = projectRes.data?.name || 'a project';
                        
                        const emailResult = await emailService.sendInvitationEmail({
                            to: body.email,
                            inviterName,
                            projectName,
                            role: body.role || 'member',
                            message: body.message,
                            inviteLink: inviteUrl,
                        });
                        
                        emailSent = emailResult.success;
                        if (!emailResult.success) {
                            console.warn('[Invites] Email send failed:', emailResult.error);
                        }
                    } catch (emailError) {
                        console.error('[Invites] Email error:', emailError.message);
                    }
                }
                
                jsonResponse(res, { 
                    success: true,
                    invite: result.invite,
                    invite_url: inviteUrl,
                    token: result.token, // Only returned once!
                    email_sent: emailSent,
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/invites/link - Generate shareable invite link
        if (pathname.match(/^\/api\/projects\/([^/]+)\/invites\/link$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            // Get current user
            const token = supabase.auth.extractToken(req);
            if (!token) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const userResult = await supabase.auth.getUser(token);
            if (!userResult.success) {
                jsonResponse(res, { error: 'Invalid token' }, 401);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/invites\/link$/)[1];
            
            // Create a general invite (no specific email)
            const result = await supabase.invites.createInvite({
                projectId: projectId,
                createdBy: userResult.user.id,
                role: 'member',
                email: null, // No specific email - shareable link
                expiresInHours: 168 // 7 days for shareable links
            });
            
            if (result.success) {
                const baseUrl = `http://${req.headers.host}`;
                const inviteUrl = `${baseUrl}/join?token=${result.token}`;
                
                jsonResponse(res, { 
                    success: true,
                    link: inviteUrl,
                    invite_url: inviteUrl,
                    token: result.token,
                    expires_at: result.invite?.expires_at,
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/invites - List invites
        if (pathname.match(/^\/api\/projects\/([^/]+)\/invites$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/invites$/)[1];
            const result = await supabase.invites.listInvites(projectId);
            
            if (result.success) {
                jsonResponse(res, { invites: result.invites });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // DELETE /api/invites/:id - Revoke invite
        if (pathname.match(/^\/api\/invites\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const inviteId = pathname.match(/^\/api\/invites\/([^/]+)$/)[1];
            const result = await supabase.invites.revokeInvite(inviteId);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/invites/preview?token=xxx - Preview invite
        if (pathname === '/api/invites/preview' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            const token = parsedUrl.query.token;
            
            if (!token) {
                jsonResponse(res, { error: 'Token required' }, 400);
                return;
            }
            
            const result = await supabase.invites.getInviteByToken(token);
            
            if (result.success) {
                jsonResponse(res, { invite: result.invite });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/invites/accept - Accept invite
        if (pathname === '/api/invites/accept' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            // Get current user
            const authToken = supabase.auth.extractToken(req);
            if (!authToken) {
                jsonResponse(res, { error: 'You must be logged in to accept an invite' }, 401);
                return;
            }
            
            const userResult = await supabase.auth.getUser(authToken);
            if (!userResult.success) {
                jsonResponse(res, { error: 'Invalid token' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            if (!body.token) {
                jsonResponse(res, { error: 'Invite token required' }, 400);
                return;
            }
            
            const result = await supabase.invites.acceptInvite(
                body.token, 
                userResult.user.id, 
                userResult.user.email
            );
            
            if (result.success) {
                jsonResponse(res, { 
                    success: true,
                    membership: result.membership
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // ==================== Activity Log API ====================
        
        // GET /api/projects/:id/activity - Get project activity
        if (pathname.match(/^\/api\/projects\/([^/]+)\/activity$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/activity$/)[1];
            const parsedUrl = parseUrl(req.url);
            
            const result = await supabase.activity.getProjectActivity(projectId, {
                limit: parseInt(parsedUrl.query.limit) || 50,
                offset: parseInt(parsedUrl.query.offset) || 0,
                action: parsedUrl.query.action,
                since: parsedUrl.query.since
            });
            
            if (result.success) {
                jsonResponse(res, { 
                    activities: result.activities,
                    total: result.total
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Comments API ====================
        
        // GET /api/comments?project_id=X&target_type=Y&target_id=Z
        if (pathname === '/api/comments' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            const { project_id, target_type, target_id } = parsedUrl.query;
            
            if (!project_id || !target_type || !target_id) {
                jsonResponse(res, { error: 'project_id, target_type, and target_id are required' }, 400);
                return;
            }
            
            const result = await supabase.comments.getComments(project_id, target_type, target_id, {
                includeReplies: parsedUrl.query.include_replies !== 'false',
                limit: parseInt(parsedUrl.query.limit) || 50
            });
            
            if (result.success) {
                jsonResponse(res, { comments: result.comments, total: result.total });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/comments - Create comment
        if (pathname === '/api/comments' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            const result = await supabase.comments.createComment({
                projectId: body.project_id,
                authorId: userResult.user.id,
                targetType: body.target_type,
                targetId: body.target_id,
                content: body.content,
                parentId: body.parent_id
            });
            
            if (result.success) {
                jsonResponse(res, { success: true, comment: result.comment });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // PUT /api/comments/:id - Update comment
        if (pathname.match(/^\/api\/comments\/([^/]+)$/) && req.method === 'PUT') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const commentId = pathname.match(/^\/api\/comments\/([^/]+)$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.comments.updateComment(commentId, userResult.user.id, body.content);
            
            if (result.success) {
                jsonResponse(res, { success: true, comment: result.comment });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // DELETE /api/comments/:id - Delete comment
        if (pathname.match(/^\/api\/comments\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const commentId = pathname.match(/^\/api\/comments\/([^/]+)$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const result = await supabase.comments.deleteComment(commentId, userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/comments/:id/resolve - Resolve comment thread
        if (pathname.match(/^\/api\/comments\/([^/]+)\/resolve$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const commentId = pathname.match(/^\/api\/comments\/([^/]+)\/resolve$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.comments.resolveComment(commentId, userResult.user.id, body.resolved !== false);
            
            if (result.success) {
                jsonResponse(res, { success: true, comment: result.comment });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Notifications API ====================
        
        // GET /api/notifications - Get user notifications
        if (pathname === '/api/notifications' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            
            const result = await supabase.notifications.getForUser(userResult.user.id, {
                limit: parseInt(parsedUrl.query.limit) || 20,
                offset: parseInt(parsedUrl.query.offset) || 0,
                unreadOnly: parsedUrl.query.unread_only === 'true',
                projectId: parsedUrl.query.project_id
            });
            
            if (result.success) {
                jsonResponse(res, { 
                    notifications: result.notifications,
                    total: result.total
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/notifications/count - Get unread count
        if (pathname === '/api/notifications/count' && req.method === 'GET') {
            // Return 0 if not configured or not authenticated (graceful fallback)
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { count: 0 });
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                // No auth - just return 0 count instead of 401
                jsonResponse(res, { count: 0 });
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            const result = await supabase.notifications.getUnreadCount(userResult.user.id, parsedUrl.query.project_id);
            
            if (result.success) {
                jsonResponse(res, { count: result.count });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/notifications/:id/read - Mark as read
        if (pathname.match(/^\/api\/notifications\/([^/]+)\/read$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const notificationId = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const result = await supabase.notifications.markAsRead(notificationId, userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/notifications/read-all - Mark all as read
        if (pathname === '/api/notifications/read-all' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.notifications.markAllAsRead(userResult.user.id, body.project_id);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // DELETE /api/notifications/:id - Delete notification
        if (pathname.match(/^\/api\/notifications\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const notificationId = pathname.match(/^\/api\/notifications\/([^/]+)$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const result = await supabase.notifications.delete(notificationId, userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Search API ====================
        
        // GET /api/search/users?q=term&project_id=X
        if (pathname === '/api/search/users' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            const query = parsedUrl.query.q || '';
            
            const result = await supabase.search.users(query, {
                projectId: parsedUrl.query.project_id,
                limit: parseInt(parsedUrl.query.limit) || 10
            });
            
            if (result.success) {
                jsonResponse(res, { users: result.users });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/search/mentions?prefix=X&project_id=Y
        if (pathname === '/api/search/mentions' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            const prefix = parsedUrl.query.prefix || '';
            const projectId = parsedUrl.query.project_id;
            
            if (!projectId) {
                jsonResponse(res, { error: 'project_id is required' }, 400);
                return;
            }
            
            const result = await supabase.search.mentionSuggestions(prefix, projectId);
            
            if (result.success) {
                jsonResponse(res, { suggestions: result.suggestions });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/search?q=term&project_id=X
        if (pathname === '/api/search' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Authentication not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const parsedUrl = parseUrl(req.url);
            const query = parsedUrl.query.q || '';
            
            const result = await supabase.search.global(query, userResult.user.id, parsedUrl.query.project_id, {
                includeUsers: parsedUrl.query.users !== 'false',
                includeComments: parsedUrl.query.comments !== 'false',
                includeProjects: parsedUrl.query.projects !== 'false',
                limit: parseInt(parsedUrl.query.limit) || 5
            });
            
            if (result.success) {
                jsonResponse(res, { results: result.results });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== API Keys API ====================
        
        // GET /api/projects/:id/api-keys - List API keys
        if (pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/)[1];
            const result = await supabase.apikeys.list(projectId);
            
            if (result.success) {
                jsonResponse(res, { keys: result.keys });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/projects/:id/api-keys - Create API key
        if (pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/api-keys$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            const result = await supabase.apikeys.create({
                projectId,
                createdBy: userResult.user.id,
                name: body.name,
                description: body.description,
                permissions: body.permissions || ['read'],
                rateLimitPerMinute: body.rate_limit_per_minute,
                rateLimitPerDay: body.rate_limit_per_day,
                expiresAt: body.expires_at
            });
            
            if (result.success) {
                jsonResponse(res, { 
                    success: true, 
                    api_key: result.apiKey,
                    message: 'Save this key - it will only be shown once!'
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // DELETE /api/api-keys/:id - Revoke API key
        if (pathname.match(/^\/api\/api-keys\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const keyId = pathname.match(/^\/api\/api-keys\/([^/]+)$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const result = await supabase.apikeys.revoke(keyId, userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/api-keys/:id/stats - Get API key usage stats
        if (pathname.match(/^\/api\/api-keys\/([^/]+)\/stats$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const keyId = pathname.match(/^\/api\/api-keys\/([^/]+)\/stats$/)[1];
            const parsedUrl = parseUrl(req.url);
            const days = parseInt(parsedUrl.query.days) || 7;
            
            const result = await supabase.apikeys.getUsageStats(keyId, days);
            
            if (result.success) {
                jsonResponse(res, { stats: result.stats });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Webhooks API ====================
        
        // GET /api/projects/:id/webhooks - List webhooks
        if (pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/)[1];
            const result = await supabase.webhooks.list(projectId);
            
            if (result.success) {
                jsonResponse(res, { webhooks: result.webhooks });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/projects/:id/webhooks - Create webhook
        if (pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/webhooks$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            const result = await supabase.webhooks.create({
                projectId,
                createdBy: userResult.user.id,
                name: body.name,
                description: body.description,
                url: body.url,
                events: body.events || [],
                customHeaders: body.custom_headers,
                maxRetries: body.max_retries,
                retryDelaySeconds: body.retry_delay_seconds
            });
            
            if (result.success) {
                jsonResponse(res, { 
                    success: true, 
                    webhook: result.webhook,
                    message: 'Save the secret - it will only be shown once!'
                });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // PUT /api/webhooks/:id - Update webhook
        if (pathname.match(/^\/api\/webhooks\/([^/]+)$/) && req.method === 'PUT') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)$/)[1];
            const body = await parseBody(req);
            
            const result = await supabase.webhooks.update(webhookId, body);
            
            if (result.success) {
                jsonResponse(res, { success: true, webhook: result.webhook });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // DELETE /api/webhooks/:id - Delete webhook
        if (pathname.match(/^\/api\/webhooks\/([^/]+)$/) && req.method === 'DELETE') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)$/)[1];
            const result = await supabase.webhooks.delete(webhookId);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/webhooks/:id/test - Test webhook
        if (pathname.match(/^\/api\/webhooks\/([^/]+)\/test$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)\/test$/)[1];
            const result = await supabase.webhooks.test(webhookId);
            
            if (result.success) {
                jsonResponse(res, { success: true, message: result.message });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/webhooks/:id/deliveries - Get delivery history
        if (pathname.match(/^\/api\/webhooks\/([^/]+)\/deliveries$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)\/deliveries$/)[1];
            const parsedUrl = parseUrl(req.url);
            const limit = parseInt(parsedUrl.query.limit) || 20;
            
            const result = await supabase.webhooks.getDeliveryHistory(webhookId, limit);
            
            if (result.success) {
                jsonResponse(res, { deliveries: result.deliveries });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
        if (pathname.match(/^\/api\/webhooks\/([^/]+)\/regenerate-secret$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const webhookId = pathname.match(/^\/api\/webhooks\/([^/]+)\/regenerate-secret$/)[1];
            const result = await supabase.webhooks.regenerateSecret(webhookId);
            
            if (result.success) {
                jsonResponse(res, { success: true, secret: result.secret });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Audit Export API ====================
        
        // GET /api/projects/:id/audit/summary - Get audit summary
        if (pathname.match(/^\/api\/projects\/([^/]+)\/audit\/summary$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/summary$/)[1];
            const parsedUrl = parseUrl(req.url);
            const days = parseInt(parsedUrl.query.days) || 30;
            
            const result = await supabase.audit.getSummary(projectId, days);
            
            if (result.success) {
                jsonResponse(res, { summary: result.summary });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/audit/exports - List export jobs
        if (pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/)[1];
            const result = await supabase.audit.listExports(projectId);
            
            if (result.success) {
                jsonResponse(res, { exports: result.jobs });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/projects/:id/audit/exports - Create export job
        if (pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/audit\/exports$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            const result = await supabase.audit.createExport({
                projectId,
                requestedBy: userResult.user.id,
                dateFrom: body.date_from,
                dateTo: body.date_to,
                filters: body.filters,
                format: body.format || 'json'
            });
            
            if (result.success) {
                jsonResponse(res, { success: true, job: result.job });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/audit/exports/:id - Get export job status
        if (pathname.match(/^\/api\/audit\/exports\/([^/]+)$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const jobId = pathname.match(/^\/api\/audit\/exports\/([^/]+)$/)[1];
            const result = await supabase.audit.getExport(jobId);
            
            if (result.success) {
                jsonResponse(res, { job: result.job });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/audit/exports/:id/download - Download export
        if (pathname.match(/^\/api\/audit\/exports\/([^/]+)\/download$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const jobId = pathname.match(/^\/api\/audit\/exports\/([^/]+)\/download$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const result = await supabase.audit.download(jobId, userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, result);
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Projects Management API ====================
        
        // GET /api/user/projects - List user's projects
        if (pathname === '/api/user/projects' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const result = await supabase.projects.listForUser(userResult.user.id);
            
            if (result.success) {
                jsonResponse(res, { projects: result.projects });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/supabase-projects - Create project in Supabase
        if (pathname === '/api/supabase-projects' && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            const result = await supabase.projects.create({
                name: body.name,
                description: body.description,
                ownerId: userResult.user.id,
                settings: body.settings
            });
            
            if (result.success) {
                jsonResponse(res, { success: true, project: result.project });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/stats - Get project stats
        if (pathname.match(/^\/api\/projects\/([^/]+)\/stats$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/stats$/)[1];
            const result = await supabase.projects.getStats(projectId);
            
            if (result.success) {
                jsonResponse(res, { stats: result.stats });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== User Profile API ====================
        
        // GET /api/user/profile - Get current user profile
        if (pathname === '/api/user/profile' && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const profileResult = await supabase.auth.getUserProfile(userResult.user.id);
            
            jsonResponse(res, { 
                user: userResult.user,
                profile: profileResult.success ? profileResult.profile : null
            });
            return;
        }
        
        // PUT /api/user/profile - Update current user profile
        if (pathname === '/api/user/profile' && req.method === 'PUT') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            
            const result = await supabase.auth.upsertUserProfile(userResult.user.id, {
                username: body.username,
                display_name: body.display_name,
                avatar_url: body.avatar_url
            });
            
            if (result.success) {
                jsonResponse(res, { success: true, profile: result.profile });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Graph Sync API ====================
        
        // GET /api/projects/:id/sync/status - Get sync status
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/)[1];
            const result = await supabase.outbox.getSyncStatus(projectId);
            
            if (result.success) {
                jsonResponse(res, { status: result.status });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/sync/stats - Get sync statistics
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/)[1];
            const result = await supabase.outbox.getStats(projectId);
            
            if (result.success) {
                jsonResponse(res, { stats: result.stats });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/sync/dead-letters - Get dead letter events
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/)[1];
            const result = await supabase.outbox.getDeadLetters(projectId);
            
            if (result.success) {
                jsonResponse(res, { dead_letters: result.deadLetters });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/sync/dead-letters/:id/retry - Retry a dead letter
        if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/)[1];
            const result = await supabase.outbox.retryDeadLetter(deadLetterId);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/sync/dead-letters/:id/resolve - Resolve a dead letter
        if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.outbox.resolveDeadLetter(deadLetterId, userResult.user.id, body.notes);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // ==================== Graph Sync API ====================
        
        // GET /api/projects/:id/sync/status - Get sync status
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/status$/)[1];
            const result = await supabase.outbox.getSyncStatus(projectId);
            
            if (result.success) {
                jsonResponse(res, { status: result.status });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/sync/stats - Get sync statistics
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/stats$/)[1];
            const result = await supabase.outbox.getStats(projectId);
            
            if (result.success) {
                jsonResponse(res, { stats: result.stats });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/sync/pending - Get pending count
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/pending$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/pending$/)[1];
            const result = await supabase.outbox.getPendingCount(projectId);
            
            if (result.success) {
                jsonResponse(res, { count: result.count });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // GET /api/projects/:id/sync/dead-letters - Get dead letter events
        if (pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/) && req.method === 'GET') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/sync\/dead-letters$/)[1];
            const parsedUrl = parseUrl(req.url);
            
            const result = await supabase.outbox.getDeadLetters(projectId, {
                unresolvedOnly: parsedUrl.query.unresolved !== 'false',
                limit: parseInt(parsedUrl.query.limit) || 50
            });
            
            if (result.success) {
                jsonResponse(res, { deadLetters: result.deadLetters });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/sync/dead-letters/:id/resolve - Resolve dead letter
        if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/resolve$/)[1];
            const token = supabase.auth.extractToken(req);
            const userResult = await supabase.auth.getUser(token);
            
            if (!userResult.success) {
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return;
            }
            
            const body = await parseBody(req);
            const result = await supabase.outbox.resolveDeadLetter(deadLetterId, userResult.user.id, body.notes);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }
        
        // POST /api/sync/dead-letters/:id/retry - Retry dead letter
        if (pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/) && req.method === 'POST') {
            if (!supabase || !supabase.isConfigured()) {
                jsonResponse(res, { error: 'Not configured' }, 503);
                return;
            }
            
            const deadLetterId = pathname.match(/^\/api\/sync\/dead-letters\/([^/]+)\/retry$/)[1];
            const result = await supabase.outbox.retryDeadLetter(deadLetterId);
            
            if (result.success) {
                jsonResponse(res, { success: true });
            } else {
                jsonResponse(res, { error: result.error }, 400);
            }
            return;
        }

        // GET /api/config - Get current configuration
        if (pathname === '/api/config' && req.method === 'GET') {
            jsonResponse(res, {
                projectName: config.projectName,
                ollama: config.ollama,
                llm: getLLMConfigForFrontend(config.llm),
                prompts: config.prompts || {},
                pdfToImages: config.pdfToImages !== false
            });
            return;
        }

        // POST /api/config - Update configuration
        if (pathname === '/api/config' && req.method === 'POST') {
            const body = await parseBody(req);
            if (body.projectName !== undefined) config.projectName = body.projectName;
            if (body.prompts !== undefined) config.prompts = body.prompts;
            if (body.pdfToImages !== undefined) config.pdfToImages = body.pdfToImages;
            if (body.ollama) {
                config.ollama = { ...config.ollama, ...body.ollama };
                ollama.configure(config.ollama.host, config.ollama.port);
                // Sync to llm.providers.ollama
                config.llm.providers.ollama = {
                    host: config.ollama.host,
                    port: config.ollama.port
                };
            }
            
            // Handle LLM config updates
            if (body.llm) {
                // Update provider selection
                if (body.llm.provider !== undefined) {
                    config.llm.provider = body.llm.provider;
                }
                // Update model selections
                if (body.llm.models) {
                    config.llm.models = { ...config.llm.models, ...body.llm.models };
                }
                // Update embeddings provider
                if (body.llm.embeddingsProvider !== undefined) {
                    config.llm.embeddingsProvider = body.llm.embeddingsProvider;
                }
                // Update per-task provider/model config
                if (body.llm.perTask) {
                    config.llm.perTask = { ...config.llm.perTask, ...body.llm.perTask };
                    console.log('[Config] Saved perTask:', config.llm.perTask);
                }
                // Update provider-specific configs (API keys, base URLs, etc.)
                if (body.llm.providers) {
                    for (const [pid, providerConfig] of Object.entries(body.llm.providers)) {
                        if (config.llm.providers[pid]) {
                            // Only update apiKey if a new one is provided (non-empty)
                            if (providerConfig.apiKey !== undefined && providerConfig.apiKey !== '') {
                                config.llm.providers[pid].apiKey = providerConfig.apiKey;
                            }
                            // Update other fields
                            if (providerConfig.baseUrl !== undefined) {
                                config.llm.providers[pid].baseUrl = providerConfig.baseUrl;
                            }
                            if (providerConfig.organization !== undefined) {
                                config.llm.providers[pid].organization = providerConfig.organization;
                            }
                            if (providerConfig.manualModels !== undefined) {
                                config.llm.providers[pid].manualModels = providerConfig.manualModels;
                            }
                            // For ollama, update host/port
                            if (pid === 'ollama') {
                                if (providerConfig.host !== undefined) {
                                    config.llm.providers.ollama.host = providerConfig.host;
                                    config.ollama.host = providerConfig.host;
                                }
                                if (providerConfig.port !== undefined) {
                                    config.llm.providers.ollama.port = providerConfig.port;
                                    config.ollama.port = providerConfig.port;
                                }
                                ollama.configure(config.ollama.host, config.ollama.port);
                            }
                        }
                    }
                }
                // Clear LLM provider cache when config changes
                llm.clearCache();
            }
            
            // Update processor config
            processor.updateConfig(config);
            saveConfig(config);
            jsonResponse(res, { success: true, config: {
                ...config,
                llm: getLLMConfigForFrontend(config.llm)
            }});
            return;
        }

        // ==================== Secrets API (Admin) ====================

        // POST /api/secrets - Store a secret (API key, password, etc.)
        if (pathname === '/api/secrets' && req.method === 'POST') {
            const body = await parseBody(req);
            const { name, value, scope = 'system', projectId = null } = body;
            
            if (!name || !value) {
                jsonResponse(res, { error: 'Name and value are required' }, 400);
                return;
            }
            
            try {
                // Verify superadmin for system scope
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    if (!authResult.authenticated) {
                        jsonResponse(res, { error: 'Authentication required' }, 401);
                        return;
                    }
                    
                    if (scope === 'system') {
                        const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                        if (!isSuperAdmin) {
                            jsonResponse(res, { error: 'Superadmin access required for system secrets' }, 403);
                            return;
                        }
                    }
                    
                    const secrets = require('./supabase/secrets');
                    const result = await secrets.setSecret({
                        scope,
                        projectId,
                        name,
                        value,
                        provider: secrets.detectProvider(value),
                        userId: authResult.user.id
                    });
                    
                    if (!result.success) {
                        jsonResponse(res, { error: result.error }, 500);
                        return;
                    }
                    
                    console.log(`[Admin] Saved secret: ${name} (scope: ${scope})`);
                    jsonResponse(res, { success: true, name, scope });
                    return;
                }
                
                jsonResponse(res, { error: 'Supabase not configured' }, 500);
            } catch (e) {
                console.error('[API] Error saving secret:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/secrets - List secrets (masked)
        if (pathname === '/api/secrets' && req.method === 'GET') {
            try {
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    if (!authResult.authenticated) {
                        jsonResponse(res, { error: 'Authentication required' }, 401);
                        return;
                    }
                    
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                    if (!isSuperAdmin) {
                        jsonResponse(res, { error: 'Superadmin access required' }, 403);
                        return;
                    }
                    
                    const secrets = require('./supabase/secrets');
                    const result = await secrets.listSecrets('system');
                    
                    jsonResponse(res, { 
                        success: true, 
                        secrets: result.secrets || []
                    });
                    return;
                }
                
                jsonResponse(res, { error: 'Supabase not configured' }, 500);
            } catch (e) {
                console.error('[API] Error listing secrets:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // ==================== System Config API (Admin) ====================

        // POST /api/system/config - Create/update a system configuration
        if (pathname === '/api/system/config' && req.method === 'POST') {
            const body = await parseBody(req);
            const { key, value, category } = body;
            
            if (!key) {
                jsonResponse(res, { error: 'Key is required' }, 400);
                return;
            }
            
            try {
                // Verify superadmin
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    if (!authResult.authenticated) {
                        jsonResponse(res, { error: 'Authentication required' }, 401);
                        return;
                    }
                    
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                    if (!isSuperAdmin) {
                        jsonResponse(res, { error: 'Superadmin access required' }, 403);
                        return;
                    }
                    
                    // Handle LLM per-task configs (e.g., text_provider, vision_provider)
                    if (key.endsWith('_provider')) {
                        const taskType = key.replace('_provider', ''); // text, vision, embeddings
                        const systemConfig = require('./supabase/system');
                        
                        // Get current llm_pertask config
                        const current = await systemConfig.getLLMConfig();
                        const updated = {
                            ...current,
                            [taskType]: {
                                provider: value.provider || null,
                                model: value.model || null
                            }
                        };
                        
                        // Save to Supabase
                        const result = await systemConfig.setLLMConfig(updated, authResult.user.id);
                        
                        if (!result.success) {
                            jsonResponse(res, { error: result.error }, 500);
                            return;
                        }
                        
                        // Update local config for immediate effect
                        if (!config.llm.perTask) config.llm.perTask = {};
                        config.llm.perTask[taskType] = updated[taskType];
                        saveConfig(config);
                        
                        console.log(`[Admin] Saved LLM config for ${taskType}:`, updated[taskType]);
                        jsonResponse(res, { success: true, key, value: updated[taskType] });
                        return;
                    }
                    
                    // Generic config save
                    const systemConfig = require('./supabase/system');
                    const result = await systemConfig.setSystemConfig(key, value, authResult.user.id, category);
                    
                    if (!result.success) {
                        jsonResponse(res, { error: result.error }, 500);
                        return;
                    }
                    
                    jsonResponse(res, { success: true, key, value });
                    return;
                }
                
                jsonResponse(res, { error: 'Supabase not configured' }, 500);
            } catch (e) {
                console.error('[API] Error saving system config:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/system/config - Get all system configuration
        if (pathname === '/api/system/config' && req.method === 'GET') {
            try {
                // Try to load from Supabase
                if (supabase && supabase.isConfigured()) {
                    const systemConfig = require('./supabase/system');
                    const { configs } = await systemConfig.getAllSystemConfigs();
                    jsonResponse(res, configs);
                    return;
                }
                
                // Fallback to local config
                jsonResponse(res, {
                    llm_pertask: config.llm?.perTask || {},
                    prompts: config.prompts || {},
                    processing: {
                        chunkSize: config.chunkSize || 4000,
                        chunkOverlap: config.chunkOverlap || 200,
                        similarityThreshold: config.similarityThreshold || 0.90,
                        pdfToImages: config.pdfToImages !== false
                    },
                    graph: config.graph || { enabled: false, provider: 'json' },
                    routing: config.llm?.routing || {},
                    tokenPolicy: config.llm?.tokenPolicy || {}
                });
            } catch (e) {
                console.error('[API] Error getting system config:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/system/config/:key - Update a system configuration
        if (pathname.match(/^\/api\/system\/config\/([^/]+)$/) && req.method === 'PUT') {
            const key = pathname.match(/^\/api\/system\/config\/([^/]+)$/)[1];
            const body = await parseBody(req);
            
            try {
                // Verify superadmin
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    if (!authResult.authenticated) {
                        jsonResponse(res, { error: 'Authentication required' }, 401);
                        return;
                    }
                    
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                    if (!isSuperAdmin) {
                        jsonResponse(res, { error: 'Superadmin access required' }, 403);
                        return;
                    }
                    
                    const systemConfig = require('./supabase/system');
                    const result = await systemConfig.setSystemConfig(key, body.value, authResult.user.id);
                    
                    if (!result.success) {
                        jsonResponse(res, { error: result.error }, 500);
                        return;
                    }
                    
                    // Also update local config for immediate effect
                    if (key === 'llm_pertask') config.llm.perTask = body.value;
                    if (key === 'prompts') config.prompts = body.value;
                    if (key === 'processing') {
                        config.chunkSize = body.value.chunkSize;
                        config.chunkOverlap = body.value.chunkOverlap;
                        config.similarityThreshold = body.value.similarityThreshold;
                        config.pdfToImages = body.value.pdfToImages;
                    }
                    if (key === 'graph') config.graph = body.value;
                    if (key === 'routing') config.llm.routing = body.value;
                    if (key === 'tokenPolicy') config.llm.tokenPolicy = body.value;
                    
                    saveConfig(config);
                    jsonResponse(res, { success: true, config: result.config });
                    return;
                }
                
                jsonResponse(res, { error: 'Supabase not configured' }, 500);
            } catch (e) {
                console.error('[API] Error updating system config:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/system/preset - Apply a preset configuration
        if (pathname === '/api/system/preset' && req.method === 'POST') {
            const body = await parseBody(req);
            const presetId = body.preset;
            
            try {
                // Verify superadmin
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    if (!authResult.authenticated) {
                        jsonResponse(res, { error: 'Authentication required' }, 401);
                        return;
                    }
                    
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                    if (!isSuperAdmin) {
                        jsonResponse(res, { error: 'Superadmin access required' }, 403);
                        return;
                    }
                    
                    const presets = require('./llm/presets');
                    const preset = presets.getPresetConfig(presetId);
                    
                    if (!preset) {
                        jsonResponse(res, { error: `Preset '${presetId}' not found` }, 404);
                        return;
                    }
                    
                    // Apply preset to system config
                    const systemConfig = require('./supabase/system');
                    const result = await systemConfig.setLLMConfig(preset, authResult.user.id);
                    
                    if (!result.success) {
                        jsonResponse(res, { error: result.error }, 500);
                        return;
                    }
                    
                    // Update local config
                    config.llm.perTask = preset;
                    saveConfig(config);
                    
                    jsonResponse(res, { success: true, preset: presetId, config: preset });
                    return;
                }
                
                // Fallback: just update local config
                const presets = require('./llm/presets');
                const preset = presets.getPresetConfig(presetId);
                if (preset) {
                    config.llm.perTask = preset;
                    saveConfig(config);
                    jsonResponse(res, { success: true, preset: presetId, config: preset });
                } else {
                    jsonResponse(res, { error: `Preset '${presetId}' not found` }, 404);
                }
            } catch (e) {
                console.error('[API] Error applying preset:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/system/audit - Get configuration audit log
        if (pathname === '/api/system/audit' && req.method === 'GET') {
            try {
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    if (!authResult.authenticated) {
                        jsonResponse(res, { error: 'Authentication required' }, 401);
                        return;
                    }
                    
                    const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                    if (!isSuperAdmin) {
                        jsonResponse(res, { error: 'Superadmin access required' }, 403);
                        return;
                    }
                    
                    const queryParams = new URLSearchParams(parseUrl(req.url).search);
                    const limit = parseInt(queryParams.get('limit') || '20');
                    
                    const client = supabase.getAdminClient();
                    const { data: logs, error } = await client
                        .from('config_audit_log')
                        .select('*')
                        .order('changed_at', { ascending: false })
                        .limit(limit);
                    
                    if (error) {
                        console.error('[API] Error fetching audit log:', error.message);
                        jsonResponse(res, { logs: [] });
                        return;
                    }
                    
                    jsonResponse(res, { logs: logs || [] });
                    return;
                }
                
                jsonResponse(res, { logs: [] });
            } catch (e) {
                console.error('[API] Error fetching audit log:', e.message);
                jsonResponse(res, { logs: [] });
            }
            return;
        }

        // ==================== System Prompts API ====================

        // GET /api/system/prompts - Get all system prompts
        if (pathname === '/api/system/prompts' && req.method === 'GET') {
            try {
                if (supabase && supabase.isConfigured()) {
                    const admin = supabase.getAdminClient();
                    const { data: prompts, error } = await admin
                        .from('system_prompts')
                        .select('id, key, name, description, category, prompt_template, uses_ontology, is_active')
                        .eq('is_active', true)
                        .order('key');
                    
                    if (error) {
                        console.error('[API] Error fetching prompts:', error.message);
                        jsonResponse(res, { prompts: [] });
                        return;
                    }
                    
                    jsonResponse(res, { prompts: prompts || [] });
                    return;
                }
                
                jsonResponse(res, { prompts: [] });
            } catch (e) {
                console.error('[API] Error fetching prompts:', e.message);
                jsonResponse(res, { prompts: [] });
            }
            return;
        }

        // PUT /api/system/prompts/:key - Update a system prompt
        if (pathname.match(/^\/api\/system\/prompts\/([^/]+)$/) && req.method === 'PUT') {
            const key = pathname.match(/^\/api\/system\/prompts\/([^/]+)$/)[1];
            const body = await parseBody(req);
            
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }

                // Verify superadmin
                const authResult = await supabase.auth.verifyRequest(req);
                if (!authResult.authenticated) {
                    jsonResponse(res, { error: 'Authentication required' }, 401);
                    return;
                }
                
                const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                if (!isSuperAdmin) {
                    jsonResponse(res, { error: 'Superadmin access required' }, 403);
                    return;
                }

                const admin = supabase.getAdminClient();
                const { data, error } = await admin
                    .from('system_prompts')
                    .update({
                        prompt_template: body.prompt_template,
                        updated_at: new Date().toISOString(),
                        updated_by: authResult.user.id
                    })
                    .eq('key', key)
                    .select()
                    .single();
                
                if (error) {
                    console.error('[API] Error updating prompt:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                // Clear prompts cache
                try {
                    const promptsService = require('./supabase/prompts');
                    promptsService.clearCache();
                } catch (e) {
                    // Ignore if not available
                }
                
                jsonResponse(res, { success: true, prompt: data });
            } catch (e) {
                console.error('[API] Error updating prompt:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/system/prompts/:key/versions - Get version history for a prompt
        if (pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions$/) && req.method === 'GET') {
            const key = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions$/)[1];
            
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { versions: [] });
                    return;
                }

                // Verify superadmin
                const authResult = await supabase.auth.verifyRequest(req);
                if (!authResult.authenticated) {
                    jsonResponse(res, { error: 'Authentication required' }, 401);
                    return;
                }
                
                const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                if (!isSuperAdmin) {
                    jsonResponse(res, { error: 'Superadmin access required' }, 403);
                    return;
                }

                const admin = supabase.getAdminClient();
                
                // Get current version info
                const { data: currentPrompt } = await admin
                    .from('system_prompts')
                    .select('id, version, updated_at')
                    .eq('key', key)
                    .single();
                
                if (!currentPrompt) {
                    jsonResponse(res, { versions: [] });
                    return;
                }

                // Get version history
                const { data: versions, error } = await admin
                    .from('prompt_versions')
                    .select('id, version, created_at, created_by, change_reason')
                    .eq('prompt_key', key)
                    .order('version', { ascending: false })
                    .limit(20);
                
                if (error) {
                    console.error('[API] Error fetching versions:', error.message);
                    jsonResponse(res, { versions: [] });
                    return;
                }
                
                jsonResponse(res, { 
                    current_version: currentPrompt.version,
                    versions: versions || [] 
                });
            } catch (e) {
                console.error('[API] Error fetching versions:', e.message);
                jsonResponse(res, { versions: [] });
            }
            return;
        }

        // POST /api/system/prompts/:key/restore - Restore a prompt to a previous version
        if (pathname.match(/^\/api\/system\/prompts\/([^/]+)\/restore$/) && req.method === 'POST') {
            const key = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/restore$/)[1];
            const body = await parseBody(req);
            
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }

                // Verify superadmin
                const authResult = await supabase.auth.verifyRequest(req);
                if (!authResult.authenticated) {
                    jsonResponse(res, { error: 'Authentication required' }, 401);
                    return;
                }
                
                const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                if (!isSuperAdmin) {
                    jsonResponse(res, { error: 'Superadmin access required' }, 403);
                    return;
                }

                const version = parseInt(body.version, 10);
                if (isNaN(version)) {
                    jsonResponse(res, { error: 'Invalid version number' }, 400);
                    return;
                }

                const admin = supabase.getAdminClient();
                
                // Call the restore function
                const { data, error } = await admin.rpc('restore_prompt_version', {
                    p_prompt_key: key,
                    p_version: version
                });
                
                if (error) {
                    console.error('[API] Error restoring version:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                // Clear prompts cache
                try {
                    const promptsService = require('./supabase/prompts');
                    promptsService.clearCache();
                } catch (e) {
                    // Ignore
                }
                
                jsonResponse(res, data || { success: true });
            } catch (e) {
                console.error('[API] Error restoring version:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/system/prompts/:key/versions/:version - Get a specific version content
        if (pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions\/(\d+)$/) && req.method === 'GET') {
            const match = pathname.match(/^\/api\/system\/prompts\/([^/]+)\/versions\/(\d+)$/);
            const key = match[1];
            const version = parseInt(match[2], 10);
            
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }

                // Verify superadmin
                const authResult = await supabase.auth.verifyRequest(req);
                if (!authResult.authenticated) {
                    jsonResponse(res, { error: 'Authentication required' }, 401);
                    return;
                }
                
                const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
                if (!isSuperAdmin) {
                    jsonResponse(res, { error: 'Superadmin access required' }, 403);
                    return;
                }

                const admin = supabase.getAdminClient();
                const { data, error } = await admin
                    .from('prompt_versions')
                    .select('*')
                    .eq('prompt_key', key)
                    .eq('version', version)
                    .single();
                
                if (error || !data) {
                    jsonResponse(res, { error: 'Version not found' }, 404);
                    return;
                }
                
                jsonResponse(res, { version: data });
            } catch (e) {
                console.error('[API] Error fetching version:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/llm/providers - Get configured LLM providers with status
        if (pathname === '/api/llm/providers' && req.method === 'GET') {
            try {
                const providers = {
                    ollama: { id: 'ollama', name: 'Ollama (Local)', isConfigured: true },
                    openai: { id: 'openai', name: 'OpenAI', isConfigured: !!config.llm?.providers?.openai?.apiKey },
                    google: { id: 'google', name: 'Google AI', isConfigured: !!config.llm?.providers?.gemini?.apiKey },
                    anthropic: { id: 'anthropic', name: 'Anthropic', isConfigured: !!config.llm?.providers?.claude?.apiKey },
                    grok: { id: 'grok', name: 'Grok/xAI', isConfigured: !!config.llm?.providers?.grok?.apiKey },
                    deepseek: { id: 'deepseek', name: 'DeepSeek', isConfigured: !!config.llm?.providers?.deepseek?.apiKey }
                };
                
                // Add masked keys where configured
                for (const [id, provider] of Object.entries(providers)) {
                    if (provider.isConfigured && id !== 'ollama') {
                        const key = config.llm?.providers?.[id === 'google' ? 'gemini' : id === 'anthropic' ? 'claude' : id]?.apiKey;
                        if (key && key.length > 8) {
                            provider.maskedKey = key.substring(0, 4) + '••••' + key.substring(key.length - 4);
                        }
                    }
                }
                
                jsonResponse(res, { providers });
            } catch (e) {
                console.error('[API] Error getting providers:', e.message);
                jsonResponse(res, { providers: {} });
            }
            return;
        }

        // ==================== Project Management API ====================

        // GET /api/projects - List projects (filtered by user membership)
        if (pathname === '/api/projects' && req.method === 'GET') {
            try {
                // Check if user is authenticated
                if (supabase && supabase.isConfigured()) {
                    const authResult = await supabase.auth.verifyRequest(req);
                    
                    if (authResult.authenticated) {
                        const userId = authResult.user.id;
                        const client = supabase.getAdminClient();
                        
                        // Check if user is superadmin (can see all projects)
                        const isSuperAdmin = await supabase.auth.isSuperAdmin(userId);
                        
                        if (isSuperAdmin) {
                            // Superadmins can see all projects
                            const { data: allProjects, error } = await client
                                .from('projects')
                                .select('*')
                                .order('name', { ascending: true });
                            
                            if (error) {
                                console.error('[API] Error listing all projects:', error.message);
                                jsonResponse(res, { projects: [] });
                                return;
                            }
                            
                            jsonResponse(res, { projects: allProjects || [] });
                            return;
                        }
                        
                        // Regular users: only see projects they are members of
                        const { data: memberProjects, error } = await client
                            .from('project_members')
                            .select(`
                                project_id,
                                role,
                                user_role,
                                projects:project_id (
                                    id,
                                    name,
                                    description,
                                    status,
                                    created_at,
                                    updated_at
                                )
                            `)
                            .eq('user_id', userId);
                        
                        if (error) {
                            console.error('[API] Error listing user projects:', error.message);
                            jsonResponse(res, { projects: [] });
                            return;
                        }
                        
                        // Extract and format projects with user's role
                        const projects = (memberProjects || [])
                            .filter(m => m.projects) // Filter out any null references
                            .map(m => ({
                                ...m.projects,
                                member_role: m.role,        // owner/admin/write/read
                                user_role: m.user_role      // Custom role like "Tech Lead"
                            }))
                            .sort((a, b) => a.name.localeCompare(b.name));
                        
                        jsonResponse(res, { projects });
                        return;
                    }
                }
                
                // Fallback: not authenticated or Supabase not configured
                const projects = await storage.listProjects();
                jsonResponse(res, { projects: projects || [] });
            } catch (e) {
                console.error('[API] Error listing projects:', e.message);
                jsonResponse(res, { projects: [] });
            }
            return;
        }

        // POST /api/projects - Create a new project
        if (pathname === '/api/projects' && req.method === 'POST') {
            const body = await parseBody(req);
            const name = body.name;
            const userRole = body.userRole || '';

            if (!name || name.trim().length === 0) {
                jsonResponse(res, { error: 'Project name is required' }, 400);
                return;
            }

            try {
                const project = await storage.createProject(name.trim(), userRole.trim());
                jsonResponse(res, { success: true, project });
            } catch (e) {
                console.error('[API] Error creating project:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/projects/:id - Get project by ID
        if (pathname.match(/^\/api\/projects\/([^/]+)$/) && req.method === 'GET') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)$/)[1];
            
            // Skip special routes
            if (projectId === 'current') {
                // Fall through to next handler
            } else {
                try {
                    if (supabase && supabase.isConfigured()) {
                        const client = supabase.getAdminClient();
                        const { data: project, error } = await client
                            .from('projects')
                            .select('*')
                            .eq('id', projectId)
                            .single();
                        
                        if (error) {
                            jsonResponse(res, { error: 'Project not found' }, 404);
                            return;
                        }
                        
                        jsonResponse(res, { project });
                        return;
                    }
                    
                    // Fallback to storage
                    const projects = await storage.listProjects();
                    const project = projects.find(p => p.id === projectId);
                    if (project) {
                        jsonResponse(res, { project });
                    } else {
                        jsonResponse(res, { error: 'Project not found' }, 404);
                    }
                } catch (e) {
                    console.error('[API] Error getting project:', e.message);
                    jsonResponse(res, { error: e.message }, 500);
                }
                return;
            }
        }

        // GET /api/projects/:id/config - Get project configuration
        if (pathname.match(/^\/api\/projects\/([^/]+)\/config$/) && req.method === 'GET') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/config$/)[1];
            
            try {
                if (supabase && supabase.isConfigured()) {
                    const client = supabase.getAdminClient();
                    const { data: config, error } = await client
                        .from('project_config')
                        .select('*')
                        .eq('project_id', projectId)
                        .single();
                    
                    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                        console.error('[API] Error getting project config:', error.message);
                    }
                    
                    jsonResponse(res, { config: config || { project_id: projectId } });
                    return;
                }
                
                jsonResponse(res, { config: { project_id: projectId } });
            } catch (e) {
                console.error('[API] Error getting project config:', e.message);
                jsonResponse(res, { config: { project_id: projectId } });
            }
            return;
        }

        // PUT /api/projects/:id/config - Update project configuration
        if (pathname.match(/^\/api\/projects\/([^/]+)\/config$/) && req.method === 'PUT') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/config$/)[1];
            const body = await parseBody(req);
            
            try {
                if (supabase && supabase.isConfigured()) {
                    const client = supabase.getAdminClient();
                    
                    // Upsert config
                    const { error } = await client
                        .from('project_config')
                        .upsert({
                            project_id: projectId,
                            llm_config: body.llm_config || {},
                            ollama_config: body.ollama_config || {},
                            prompts: body.prompts || {},
                            processing_settings: body.processing_settings || {},
                            ui_preferences: body.ui_preferences || {},
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'project_id' });
                    
                    if (error) {
                        console.error('[API] Error saving project config:', error.message);
                        jsonResponse(res, { error: error.message }, 500);
                        return;
                    }
                    
                    jsonResponse(res, { success: true });
                    return;
                }
                
                jsonResponse(res, { success: true });
            } catch (e) {
                console.error('[API] Error saving project config:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/role-templates - List role templates
        if (pathname === '/api/role-templates' && req.method === 'GET') {
            try {
                if (supabase && supabase.isConfigured()) {
                    const client = supabase.getAdminClient();
                    const { data: roles, error } = await client
                        .from('role_templates')
                        .select('*')
                        .order('category', { ascending: true })
                        .order('display_name', { ascending: true });
                    
                    if (error) {
                        console.error('[API] Error listing role templates:', error.message);
                        jsonResponse(res, { roles: [] });
                        return;
                    }
                    
                    jsonResponse(res, { roles: roles || [] });
                    return;
                }
                
                jsonResponse(res, { roles: [] });
            } catch (e) {
                console.error('[API] Error listing role templates:', e.message);
                jsonResponse(res, { roles: [] });
            }
            return;
        }

        // POST /api/role-templates - Create role template
        if (pathname === '/api/role-templates' && req.method === 'POST') {
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }
                
                const body = await parseBody(req);
                const client = supabase.getAdminClient();
                
                const roleData = {
                    name: body.name,
                    display_name: body.display_name || body.name,
                    description: body.description || null,
                    role_context: body.role_context || null,
                    category: body.category || 'custom',
                    color: body.color || '#e11d48',
                    permissions: body.permissions || [],
                    is_template: body.is_template || false,
                    is_system: false,
                };
                
                const { data, error } = await client
                    .from('role_templates')
                    .insert(roleData)
                    .select()
                    .single();
                
                if (error) {
                    console.error('[API] Error creating role template:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                jsonResponse(res, { success: true, role: data });
            } catch (e) {
                console.error('[API] Error creating role template:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/role-templates/:id - Update role template
        if (pathname.match(/^\/api\/role-templates\/([^/]+)$/) && req.method === 'PUT') {
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }
                
                const roleId = pathname.match(/^\/api\/role-templates\/([^/]+)$/)[1];
                const body = await parseBody(req);
                const client = supabase.getAdminClient();
                
                const updateData = {};
                if (body.name !== undefined) updateData.name = body.name;
                if (body.display_name !== undefined) updateData.display_name = body.display_name;
                if (body.description !== undefined) updateData.description = body.description;
                if (body.role_context !== undefined) updateData.role_context = body.role_context;
                if (body.category !== undefined) updateData.category = body.category;
                if (body.color !== undefined) updateData.color = body.color;
                if (body.permissions !== undefined) updateData.permissions = body.permissions;
                if (body.is_template !== undefined) updateData.is_template = body.is_template;
                updateData.updated_at = new Date().toISOString();
                
                const { data, error } = await client
                    .from('role_templates')
                    .update(updateData)
                    .eq('id', roleId)
                    .select()
                    .single();
                
                if (error) {
                    console.error('[API] Error updating role template:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                jsonResponse(res, { success: true, role: data });
            } catch (e) {
                console.error('[API] Error updating role template:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // DELETE /api/role-templates/:id - Delete role template
        if (pathname.match(/^\/api\/role-templates\/([^/]+)$/) && req.method === 'DELETE') {
            try {
                if (!supabase || !supabase.isConfigured()) {
                    jsonResponse(res, { error: 'Database not configured' }, 503);
                    return;
                }
                
                const roleId = pathname.match(/^\/api\/role-templates\/([^/]+)$/)[1];
                const client = supabase.getAdminClient();
                
                // Don't allow deleting system roles
                const { data: existing } = await client
                    .from('role_templates')
                    .select('is_system')
                    .eq('id', roleId)
                    .single();
                
                if (existing?.is_system) {
                    jsonResponse(res, { error: 'Cannot delete system role' }, 400);
                    return;
                }
                
                const { error } = await client
                    .from('role_templates')
                    .delete()
                    .eq('id', roleId);
                
                if (error) {
                    console.error('[API] Error deleting role template:', error.message);
                    jsonResponse(res, { error: error.message }, 400);
                    return;
                }
                
                jsonResponse(res, { success: true });
            } catch (e) {
                console.error('[API] Error deleting role template:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/projects/current - Get currently active project
        if (pathname === '/api/projects/current' && req.method === 'GET') {
            try {
                // Get project with member role
                const project = await storage.getCurrentProjectWithRole();
                jsonResponse(res, { project });
            } catch (e) {
                const project = storage.getCurrentProject();
                jsonResponse(res, { project });
            }
            return;
        }

        // POST /api/projects/deactivate - Deactivate current project (select none)
        if (pathname === '/api/projects/deactivate' && req.method === 'POST') {
            try {
                // Use switchProject with null to clear current project
                await storage.switchProject(null, null);
                jsonResponse(res, { success: true });
            } catch (e) {
                console.error('[API] Error deactivating project:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }
        
        // PUT /api/projects/current/role - Update current user's role in project
        if (pathname === '/api/projects/current/role' && req.method === 'PUT') {
            try {
                const body = await parseBody(req);
                const project = storage.getCurrentProject();
                
                if (!project) {
                    jsonResponse(res, { error: 'No current project' }, 400);
                    return;
                }

                const result = await storage.updateMemberRole(project.id, {
                    userRole: body.userRole,
                    userRolePrompt: body.userRolePrompt,
                    roleTemplateId: body.roleTemplateId
                });

                // Invalidate briefing cache when role changes
                invalidateBriefingCache();

                jsonResponse(res, { 
                    success: true, 
                    userRole: result.userRole,
                    userRolePrompt: result.userRolePrompt,
                    roleTemplateId: result.roleTemplateId
                });
            } catch (e) {
                console.error('[API] Error updating member role:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/projects/:id/activate - Switch to a project
        if (pathname.match(/^\/api\/projects\/([^/]+)\/activate$/) && req.method === 'PUT') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/activate$/)[1];

            const success = storage.switchProject(projectId);
            if (success) {
                const project = storage.getCurrentProject();
                const newDataDir = storage.getProjectDataDir();

                // Reinitialize processor with new project data directory
                processor.updateDataDir(newDataDir);

                // Update config.dataDir to keep in sync
                config.dataDir = newDataDir;
                saveConfig(config);

                // Record stats for new project
                storage.recordDailyStats();

                // Switch FalkorDB graph to project-specific graph
                // First try to load graph config from Supabase, then fall back to local config
                let projectGraphConfig = null;
                
                if (supabase) {
                    try {
                        const { data: projectConfig } = await supabase
                            .from('project_config')
                            .select('graph_config')
                            .eq('project_id', projectId)
                            .single();
                        
                        if (projectConfig?.graph_config?.enabled) {
                            projectGraphConfig = projectConfig.graph_config;
                            // Get password from env var or secrets - never store in Supabase
                            const falkorPassword = process.env.FALKORDB_PASSWORD || process.env.FAKORDB_PASSWORD;
                            if (projectGraphConfig.falkordb && falkorPassword) {
                                projectGraphConfig.falkordb.password = falkorPassword;
                            }
                            console.log(`[Graph] Loaded config from Supabase for project: ${projectId}`);
                        }
                    } catch (supaErr) {
                        // Supabase config not found, will use local config
                    }
                }
                
                // Use Supabase config if available, otherwise local config
                const effectiveGraphConfig = projectGraphConfig || config.graph;
                
                if (effectiveGraphConfig && effectiveGraphConfig.enabled && effectiveGraphConfig.autoConnect !== false) {
                    try {
                        const baseGraphName = effectiveGraphConfig.baseGraphName || effectiveGraphConfig.graphName?.split('_')[0] || 'godmode';
                        const projectGraphName = `${baseGraphName}_${projectId}`;
                        
                        const graphConfig = {
                            ...effectiveGraphConfig,
                            graphName: projectGraphName
                        };
                        
                        console.log(`[Graph] Switching to graph: ${projectGraphName}`);
                        const graphResult = await storage.initGraph(graphConfig);
                        
                        if (graphResult.ok) {
                            console.log(`[Graph] ✓ Switched to graph: ${projectGraphName}`);
                        } else {
                            console.log(`[Graph] ✗ Failed to switch graph: ${graphResult.error}`);
                        }
                    } catch (e) {
                        console.log(`[Graph] Error switching graph: ${e.message}`);
                    }
                }

                console.log(`Project switched to: ${project.name} (${projectId}), dataDir: ${newDataDir}`);
                jsonResponse(res, { success: true, project });
            } else {
                jsonResponse(res, { error: 'Project not found' }, 404);
            }
            return;
        }

        // PUT /api/projects/:id - Update project (name, description, settings)
        if (pathname.match(/^\/api\/projects\/([^/]+)$/) && req.method === 'PUT') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)$/)[1];
            const body = await parseBody(req);

            // Build updates object
            const updates = {};
            if (body.name !== undefined) {
                if (!body.name || body.name.trim().length === 0) {
                    jsonResponse(res, { error: 'Project name cannot be empty' }, 400);
                    return;
                }
                updates.name = body.name.trim();
            }
            if (body.description !== undefined) {
                updates.description = body.description?.trim() || null;
            }
            if (body.settings !== undefined) {
                updates.settings = body.settings;
            }
            if (body.userRole !== undefined) {
                updates.userRole = body.userRole.trim();
            }
            if (body.userRolePrompt !== undefined) {
                updates.userRolePrompt = body.userRolePrompt.trim();
            }
            
            // Handle isDefault flag
            if (body.isDefault === true) {
                storage.setDefaultProject(projectId);
            }

            try {
                // Use Supabase if configured
                if (supabase && supabase.isConfigured()) {
                    const client = supabase.getAdminClient();
                    
                    // Build Supabase update object
                    const supabaseUpdates = {
                        updated_at: new Date().toISOString()
                    };
                    if (updates.name) supabaseUpdates.name = updates.name;
                    if (updates.description !== undefined) supabaseUpdates.description = updates.description;
                    if (updates.settings) {
                        // Merge with existing settings
                        const { data: existing } = await client
                            .from('projects')
                            .select('settings')
                            .eq('id', projectId)
                            .single();
                        
                        supabaseUpdates.settings = {
                            ...(existing?.settings || {}),
                            ...updates.settings
                        };
                    }
                    
                    const { data: project, error } = await client
                        .from('projects')
                        .update(supabaseUpdates)
                        .eq('id', projectId)
                        .select()
                        .single();
                    
                    if (error) {
                        console.error('[API] Error updating project:', error.message);
                        jsonResponse(res, { error: error.message }, 500);
                        return;
                    }
                    
                    jsonResponse(res, { success: true, project });
                    return;
                }
                
                // Fallback to storage
                const project = await storage.updateProject(projectId, updates);
                if (project) {
                    const isDefault = storage.getDefaultProjectId() === projectId;
                    jsonResponse(res, { success: true, project: { ...project, isDefault } });
                } else {
                    jsonResponse(res, { error: 'Project not found' }, 404);
                }
            } catch (e) {
                console.error('[API] Error updating project:', e.message);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/projects/:id/set-default - Set a project as the default
        if (pathname.match(/^\/api\/projects\/([^/]+)\/set-default$/) && req.method === 'POST') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/set-default$/)[1];
            
            const project = await storage.getProject(projectId);
            if (!project) {
                jsonResponse(res, { error: 'Project not found' }, 404);
                return;
            }
            
            storage.setDefaultProject(projectId);
            console.log(`[Projects] Set default project: ${project.name} (${projectId})`);
            jsonResponse(res, { success: true, defaultProjectId: projectId, project });
            return;
        }

        // DELETE /api/projects/:id - Delete a project
        if (pathname.match(/^\/api\/projects\/([^/]+)$/) && req.method === 'DELETE') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)$/)[1];

            // Check if this is the only project
            const projects = await storage.listProjects();
            if (projects.length <= 1) {
                jsonResponse(res, { error: 'Cannot delete the last remaining project' }, 400);
                return;
            }

            // Get project info before deleting
            const project = await storage.getProject(projectId);

            const success = await storage.deleteProject(projectId);
            if (success) {
                // Sync with graph - remove Project from FalkorDB
                try {
                    const { getGraphSync } = require('./sync');
                    const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                    await graphSync.onProjectDeleted(projectId, project?.name);
                } catch (syncErr) {
                    console.log(`[Projects] Graph sync warning: ${syncErr.message}`);
                }
                
                // If we deleted the current project, processor needs new data dir
                processor.updateDataDir(storage.getProjectDataDir());
                jsonResponse(res, { success: true, graphSynced: true });
            } else {
                jsonResponse(res, { error: 'Project not found' }, 404);
            }
            return;
        }

        // GET /api/projects/:id/export - Export a project as JSON
        if (pathname.match(/^\/api\/projects\/([^/]+)\/export$/) && req.method === 'GET') {
            const projectId = pathname.match(/^\/api\/projects\/([^/]+)\/export$/)[1];
            const project = storage.listProjects().find(p => p.id === projectId);

            if (!project) {
                jsonResponse(res, { error: 'Project not found' }, 404);
                return;
            }

            try {
                const projectDir = storage.getProjectDir(projectId);
                const exportData = {
                    version: '1.0',
                    exportedAt: new Date().toISOString(),
                    project: {
                        name: project.name,
                        userRole: project.userRole || ''
                    },
                    data: {}
                };

                // Read all JSON files from the project
                const jsonFiles = ['knowledge.json', 'questions.json', 'documents.json', 'history.json'];
                for (const file of jsonFiles) {
                    const filePath = path.join(projectDir, file);
                    if (fs.existsSync(filePath)) {
                        exportData.data[file.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    }
                }

                // Set headers for file download
                const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json`;
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(exportData, null, 2));
            } catch (e) {
                console.error('Export error:', e);
                jsonResponse(res, { error: 'Export failed: ' + e.message }, 500);
            }
            return;
        }

        // POST /api/projects/import - Import a project from JSON
        if (pathname === '/api/projects/import' && req.method === 'POST') {
            const contentType = req.headers['content-type'] || '';

            if (!contentType.includes('multipart/form-data')) {
                jsonResponse(res, { error: 'Content-Type must be multipart/form-data' }, 400);
                return;
            }

            try {
                const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
                if (!boundaryMatch) {
                    jsonResponse(res, { error: 'No boundary found' }, 400);
                    return;
                }
                const boundary = boundaryMatch[1] || boundaryMatch[2];

                const chunks = [];
                for await (const chunk of req) {
                    chunks.push(chunk);
                }
                const body = Buffer.concat(chunks);
                const parts = parseMultipart(body, boundary);

                if (parts.files.length === 0) {
                    jsonResponse(res, { error: 'No file provided' }, 400);
                    return;
                }

                const fileContent = parts.files[0].data.toString('utf8');
                const importData = JSON.parse(fileContent);

                // Validate import data
                if (!importData.project || !importData.project.name) {
                    jsonResponse(res, { error: 'Invalid import file: missing project name' }, 400);
                    return;
                }

                // Create new project
                const projectName = importData.project.name + ' (Imported)';
                const newProject = storage.createProject(projectName, importData.project.userRole || '');
                const projectDir = storage.getProjectDir(newProject.id);

                // Write data files
                if (importData.data) {
                    for (const [key, value] of Object.entries(importData.data)) {
                        const filePath = path.join(projectDir, `${key}.json`);
                        fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
                    }
                }

                // Reload the project
                storage.switchProject(newProject.id);

                jsonResponse(res, { success: true, project: newProject });
            } catch (e) {
                console.error('Import error:', e);
                jsonResponse(res, { error: 'Import failed: ' + e.message }, 500);
            }
            return;
        }

        // ==================== End Project Management API ====================

        // ==================== LLM Provider API ====================

        // GET /api/llm/providers - Get list of supported providers with capabilities
        if (pathname === '/api/llm/providers' && req.method === 'GET') {
            const providers = llm.getProviders();
            jsonResponse(res, { providers });
            return;
        }

        // ==================== LLM Queue API ====================
        
        // GET /api/llm/queue/status - Get queue status and stats
        if (pathname === '/api/llm/queue/status' && req.method === 'GET') {
            const { getStatus } = require('./llm/queue');
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
            return;
        }
        
        // GET /api/llm/queue/history - Get recent queue history
        if (pathname === '/api/llm/queue/history' && req.method === 'GET') {
            const { getHistory } = require('./llm/queue');
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
            return;
        }
        
        // GET /api/llm/queue/pending - Get pending items
        if (pathname === '/api/llm/queue/pending' && req.method === 'GET') {
            const { getPendingItems } = require('./llm/queue');
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
            return;
        }
        
        // GET /api/llm/queue/retryable - Get failed items that can be retried
        if (pathname === '/api/llm/queue/retryable' && req.method === 'GET') {
            const { getRetryableItems } = require('./llm/queue');
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
            return;
        }
        
        // GET /api/llm/queue/stats - Get statistics by context
        if (pathname === '/api/llm/queue/stats' && req.method === 'GET') {
            const { getStatsByContext } = require('./llm/queue');
            const queryParams = new URLSearchParams(parseUrl(req.url).search);
            const projectId = queryParams.get('projectId') || null;
            
            try {
                const stats = await getStatsByContext(projectId);
                jsonResponse(res, { stats });
            } catch (error) {
                console.error('[API] Queue stats error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/llm/queue/pause - Pause queue processing
        if (pathname === '/api/llm/queue/pause' && req.method === 'POST') {
            const { pauseQueue, getStatus } = require('./llm/queue');
            pauseQueue();
            const status = await getStatus();
            jsonResponse(res, { success: true, status });
            return;
        }
        
        // POST /api/llm/queue/resume - Resume queue processing
        if (pathname === '/api/llm/queue/resume' && req.method === 'POST') {
            const { resumeQueue, getStatus } = require('./llm/queue');
            resumeQueue();
            const status = await getStatus();
            jsonResponse(res, { success: true, status });
            return;
        }
        
        // POST /api/llm/queue/clear - Clear all pending requests
        if (pathname === '/api/llm/queue/clear' && req.method === 'POST') {
            const { clearQueue, getStatus } = require('./llm/queue');
            const body = await parseBody(req);
            const projectId = body.projectId || null;
            
            try {
                const cleared = await clearQueue(projectId);
                const status = await getStatus(projectId);
                jsonResponse(res, { success: true, cleared, status });
            } catch (error) {
                console.error('[API] Queue clear error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/llm/metadata/sync - Sync model metadata from all providers
        if (pathname === '/api/llm/metadata/sync' && req.method === 'POST') {
            const body = await parseBody(req);
            const providersToSync = body.providers || ['openai', 'anthropic', 'google', 'grok', 'deepseek', 'kimi', 'minimax'];
            
            try {
                const llmMetadata = require('./supabase/llm-metadata');
                const llmIndex = require('./llm/index');
                const secrets = require('./supabase/secrets');
                
                // Known models for providers that don't have listModels API
                const knownModels = {
                    deepseek: {
                        textModels: [
                            { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, maxOutputTokens: 8192, priceInput: 0.14, priceOutput: 0.28 },
                            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 64000, maxOutputTokens: 8192, priceInput: 0.55, priceOutput: 2.19 }
                        ],
                        visionModels: [],
                        embeddingModels: []
                    },
                    minimax: {
                        textModels: [
                            { id: 'MiniMax-Text-01', name: 'MiniMax Text 01', contextWindow: 1000000, maxOutputTokens: 16384, priceInput: 0.20, priceOutput: 1.10 },
                            { id: 'abab6.5s-chat', name: 'ABAB 6.5s Chat', contextWindow: 245760, maxOutputTokens: 8192, priceInput: 0.10, priceOutput: 0.10 }
                        ],
                        visionModels: [
                            { id: 'MiniMax-VL-01', name: 'MiniMax Vision 01', contextWindow: 1000000, maxOutputTokens: 16384, priceInput: 0.20, priceOutput: 1.10 }
                        ],
                        embeddingModels: [
                            { id: 'embo-01', name: 'MiniMax Embedding', contextWindow: 16384 }
                        ]
                    },
                    genspark: {
                        textModels: [
                            { id: 'genspark', name: 'Genspark', contextWindow: 32000, maxOutputTokens: 4096 }
                        ],
                        visionModels: [],
                        embeddingModels: []
                    }
                };
                
                const results = { providers: {}, totalModels: 0, errors: [] };
                
                for (const providerId of providersToSync) {
                    try {
                        // Get API key for provider
                        let apiKey = config.llm?.providers?.[providerId]?.apiKey;
                        
                        if (!apiKey && supabase && supabase.isConfigured()) {
                            const secretNames = {
                                openai: 'OPENAI_API_KEY', anthropic: 'CLAUDE_API_KEY', claude: 'CLAUDE_API_KEY',
                                google: 'GOOGLE_API_KEY', gemini: 'GOOGLE_API_KEY', grok: 'XAI_API_KEY', xai: 'XAI_API_KEY',
                                deepseek: 'DEEPSEEK_API_KEY', kimi: 'KIMI_API_KEY', minimax: 'MINIMAX_API_KEY'
                            };
                            const secretName = secretNames[providerId];
                            if (secretName) {
                                const apiKeyResult = await secrets.getSecret('system', secretName);
                                if (apiKeyResult.success) apiKey = apiKeyResult.value;
                            }
                        }
                        
                        if (!apiKey) {
                            results.providers[providerId] = { status: 'skipped', reason: 'No API key' };
                            continue;
                        }
                        
                        // Check if provider is supported
                        const capabilities = llmIndex.getProviderCapabilities(providerId);
                        let modelsList;
                        
                        if (capabilities.listModels) {
                            // Get models from provider using listModels function
                            modelsList = await llmIndex.listModels(providerId, { apiKey });
                        } else if (knownModels[providerId]) {
                            // Use known models for providers without listModels API
                            modelsList = knownModels[providerId];
                        } else {
                            results.providers[providerId] = { status: 'skipped', reason: 'Provider does not support listing models' };
                            continue;
                        }
                        
                        // Prepare models for upsert
                        const allModels = [
                            ...(modelsList.textModels || []).map(m => ({ ...m, modelType: 'text' })),
                            ...(modelsList.visionModels || []).map(m => ({ ...m, modelType: 'vision', supportsVision: true })),
                            ...(modelsList.embeddingModels || []).map(m => ({ ...m, modelType: 'embedding', supportsEmbeddings: true }))
                        ];
                        
                        // Upsert to database
                        let synced = 0;
                        for (const model of allModels) {
                            const upsertResult = await llmMetadata.upsertModelMetadata({
                                provider: providerId,
                                modelId: model.id || model.name,
                                displayName: model.name,
                                contextTokens: model.contextWindow || model.maxInputTokens,
                                maxOutputTokens: model.maxOutputTokens,
                                supportsVision: model.supportsVision || false,
                                supportsJsonMode: model.supportsJsonMode || false,
                                supportsEmbeddings: model.supportsEmbeddings || false,
                                priceInput: model.priceInput || 0,
                                priceOutput: model.priceOutput || 0,
                                modelType: model.modelType || 'text'
                            });
                            if (upsertResult.success) synced++;
                        }
                        
                        results.providers[providerId] = { status: 'success', models: allModels.length, synced };
                        results.totalModels += synced;
                        
                    } catch (providerError) {
                        results.providers[providerId] = { status: 'error', error: providerError.message };
                        results.errors.push({ provider: providerId, error: providerError.message });
                    }
                }
                
                jsonResponse(res, { success: true, ...results });
            } catch (error) {
                console.error('[API] Metadata sync error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/llm/metadata/status - Get sync status for all providers
        if (pathname === '/api/llm/metadata/status' && req.method === 'GET') {
            try {
                const llmMetadata = require('./supabase/llm-metadata');
                const status = await llmMetadata.getSyncStatus();
                jsonResponse(res, { success: true, providers: status });
            } catch (error) {
                console.error('[API] Metadata status error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/llm/metadata/:provider - Get all models for a provider from database
        const metadataProviderMatch = pathname.match(/^\/api\/llm\/metadata\/([a-z]+)$/);
        if (metadataProviderMatch && req.method === 'GET') {
            const providerId = metadataProviderMatch[1];
            try {
                const llmMetadata = require('./supabase/llm-metadata');
                const models = await llmMetadata.getModelsGroupedByType(providerId);
                jsonResponse(res, { success: true, provider: providerId, ...models });
            } catch (error) {
                console.error('[API] Metadata get error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/llm/queue/:id/retry - Retry a failed request
        const retryQueueMatch = pathname.match(/^\/api\/llm\/queue\/([a-z0-9-]+)\/retry$/);
        if (retryQueueMatch && req.method === 'POST') {
            const { retryRequest } = require('./llm/queue');
            const requestId = retryQueueMatch[1];
            const body = await parseBody(req);
            const resetAttempts = body.resetAttempts || false;
            
            try {
                const result = await retryRequest(requestId, resetAttempts);
                jsonResponse(res, { success: result.success, requestId, ...result });
            } catch (error) {
                console.error('[API] Queue retry error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/llm/queue/:id - Get full details of a request
        const getQueueItemMatch = pathname.match(/^\/api\/llm\/queue\/([a-f0-9-]+)$/);
        if (getQueueItemMatch && req.method === 'GET') {
            const requestId = getQueueItemMatch[1];
            
            try {
                const llmQueue = require('./supabase/llm-queue');
                const result = await llmQueue.getRequest(requestId);
                
                if (result.success && result.request) {
                    jsonResponse(res, { success: true, request: result.request });
                } else {
                    jsonResponse(res, { success: false, error: 'Request not found' }, 404);
                }
            } catch (error) {
                console.error('[API] Queue get item error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // DELETE /api/llm/queue/:id - Cancel a specific pending request
        const cancelQueueMatch = pathname.match(/^\/api\/llm\/queue\/([a-z0-9-]+)$/);
        if (cancelQueueMatch && req.method === 'DELETE') {
            const { cancelRequest } = require('./llm/queue');
            const requestId = cancelQueueMatch[1];
            
            try {
                const cancelled = await cancelRequest(requestId);
                jsonResponse(res, { success: cancelled, requestId });
            } catch (error) {
                console.error('[API] Queue cancel error:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/llm/queue/configure - Update queue configuration
        if (pathname === '/api/llm/queue/configure' && req.method === 'POST') {
            const { getQueueManager } = require('./llm/queue');
            const queue = getQueueManager();
            const body = await parseBody(req);
            queue.configure(body);
            const status = await queue.getStatus();
            jsonResponse(res, { success: true, config: status.config });
            return;
        }

        // ==================== End LLM Queue API ====================

        // POST /api/llm/test/:provider - Test connection to a specific provider (provider in path)
        const testProviderMatch = pathname.match(/^\/api\/llm\/test\/([a-z]+)$/);
        if (testProviderMatch && req.method === 'POST') {
            const providerId = testProviderMatch[1];
            const body = await parseBody(req);
            
            // Build config for testing - use saved config merged with any overrides
            const savedProviderConfig = config.llm?.providers?.[providerId] || {};
            const testConfig = { ...savedProviderConfig };
            
            // Allow overriding with test values
            if (body.apiKey) testConfig.apiKey = body.apiKey;
            if (body.baseUrl) testConfig.baseUrl = body.baseUrl;
            if (body.host) testConfig.host = body.host;
            if (body.port) testConfig.port = body.port;
            
            // Load API key from Supabase secrets if not available
            if (!testConfig.apiKey && supabase && supabase.isConfigured()) {
                try {
                    const secrets = require('./supabase/secrets');
                    const secretNames = {
                        openai: 'OPENAI_API_KEY', anthropic: 'CLAUDE_API_KEY', claude: 'CLAUDE_API_KEY',
                        google: 'GOOGLE_API_KEY', gemini: 'GOOGLE_API_KEY', grok: 'XAI_API_KEY', xai: 'XAI_API_KEY',
                        deepseek: 'DEEPSEEK_API_KEY', kimi: 'KIMI_API_KEY', minimax: 'MINIMAX_API_KEY'
                    };
                    const secretName = secretNames[providerId];
                    if (secretName) {
                        const apiKeyResult = await secrets.getSecret('system', secretName);
                        if (apiKeyResult.success && apiKeyResult.value) {
                            testConfig.apiKey = apiKeyResult.value;
                            console.log(`[LLM Test] Loaded API key for ${providerId} from Supabase`);
                        }
                    }
                } catch (e) {
                    console.warn(`[LLM Test] Failed to load API key from Supabase for ${providerId}:`, e.message);
                }
            }
            
            // Fallback to environment variables
            if (!testConfig.apiKey) {
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
                if (envKeys[providerId]) {
                    testConfig.apiKey = envKeys[providerId];
                    console.log(`[LLM Test] Using API key for ${providerId} from environment`);
                }
            }

            const result = await llm.testConnection(providerId, testConfig);
            jsonResponse(res, result);
            return;
        }

        // POST /api/llm/test - Test connection to a specific provider (provider in body)
        if (pathname === '/api/llm/test' && req.method === 'POST') {
            const body = await parseBody(req);
            const providerId = body.provider;
            
            if (!providerId) {
                jsonResponse(res, { ok: false, error: { message: 'Provider is required' } }, 400);
                return;
            }

            // Build config for testing - use saved config merged with any overrides
            const savedProviderConfig = config.llm?.providers?.[providerId] || {};
            const testConfig = { ...savedProviderConfig };
            
            // Allow overriding with test values (e.g., testing a new key before saving)
            if (body.apiKey) testConfig.apiKey = body.apiKey;
            if (body.baseUrl) testConfig.baseUrl = body.baseUrl;
            if (body.host) testConfig.host = body.host;
            if (body.port) testConfig.port = body.port;
            
            // Load API key from Supabase secrets if not available
            if (!testConfig.apiKey && supabase && supabase.isConfigured()) {
                try {
                    const secrets = require('./supabase/secrets');
                    const secretNames = {
                        openai: 'OPENAI_API_KEY', anthropic: 'CLAUDE_API_KEY', claude: 'CLAUDE_API_KEY',
                        google: 'GOOGLE_API_KEY', gemini: 'GOOGLE_API_KEY', grok: 'XAI_API_KEY', xai: 'XAI_API_KEY',
                        deepseek: 'DEEPSEEK_API_KEY', kimi: 'KIMI_API_KEY', minimax: 'MINIMAX_API_KEY'
                    };
                    const secretName = secretNames[providerId];
                    if (secretName) {
                        const apiKeyResult = await secrets.getSecret('system', secretName);
                        if (apiKeyResult.success && apiKeyResult.value) {
                            testConfig.apiKey = apiKeyResult.value;
                            console.log(`[LLM Test] Loaded API key for ${providerId} from Supabase`);
                        }
                    }
                } catch (e) {
                    console.warn(`[LLM Test] Failed to load API key from Supabase for ${providerId}:`, e.message);
                }
            }
            
            // Fallback to environment variables
            if (!testConfig.apiKey) {
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
                if (envKeys[providerId]) {
                    testConfig.apiKey = envKeys[providerId];
                    console.log(`[LLM Test] Using API key for ${providerId} from environment`);
                }
            }

            const result = await llm.testConnection(providerId, testConfig);
            jsonResponse(res, result);
            return;
        }

        // GET /api/llm/models - Get available models from a provider with enriched metadata
        if (pathname === '/api/llm/models' && req.method === 'GET') {
            const queryParams = new URLSearchParams(parseUrl(req.url).search);
            const modelsTextCfg = llmConfig.getTextConfig(config);
            const providerId = queryParams.get('provider') || modelsTextCfg.provider;
            
            // Get provider config from local config
            let providerConfig = { ...(config.llm?.providers?.[providerId] || {}) };
            
            // Try to load API key from Supabase secrets if not in local config
            if (!providerConfig.apiKey && supabase && supabase.isConfigured()) {
                try {
                    const secrets = require('./supabase/secrets');
                    // Map provider ID to secret name (as saved by AdminPanel)
                    const secretNames = {
                        openai: 'OPENAI_API_KEY',
                        anthropic: 'CLAUDE_API_KEY',
                        claude: 'CLAUDE_API_KEY',
                        google: 'GOOGLE_API_KEY',
                        gemini: 'GOOGLE_API_KEY',
                        grok: 'XAI_API_KEY',
                        xai: 'XAI_API_KEY',
                        deepseek: 'DEEPSEEK_API_KEY',
                        kimi: 'KIMI_API_KEY',
                        minimax: 'MINIMAX_API_KEY'
                    };
                    const secretName = secretNames[providerId];
                    if (secretName) {
                        const apiKeyResult = await secrets.getSecret('system', secretName);
                        if (apiKeyResult.success && apiKeyResult.value) {
                            providerConfig.apiKey = apiKeyResult.value;
                            console.log(`[LLM Models] Loaded API key for ${providerId} from Supabase`);
                        }
                    }
                } catch (e) {
                    console.warn(`[LLM Models] Failed to load API key from Supabase for ${providerId}:`, e.message);
                }
            }
            
            // Also check environment variables as fallback
            if (!providerConfig.apiKey) {
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
                if (envKeys[providerId]) {
                    providerConfig.apiKey = envKeys[providerId];
                    console.log(`[LLM Models] Using API key for ${providerId} from environment`);
                }
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
            return;
        }

        // GET /api/llm/capabilities - Get capabilities for a specific provider
        if (pathname === '/api/llm/capabilities' && req.method === 'GET') {
            const queryParams = new URLSearchParams(parseUrl(req.url).search);
            const providerId = queryParams.get('provider');
            
            if (!providerId) {
                jsonResponse(res, { error: 'Provider parameter is required' }, 400);
                return;
            }

            const capabilities = llm.getProviderCapabilities(providerId);
            jsonResponse(res, { provider: providerId, capabilities });
            return;
        }

        // GET /api/llm/model-info - Get enriched metadata for a specific model
        if (pathname === '/api/llm/model-info' && req.method === 'GET') {
            const queryParams = new URLSearchParams(parseUrl(req.url).search);
            const providerId = queryParams.get('provider');
            const modelId = queryParams.get('modelId');
            
            if (!providerId || !modelId) {
                jsonResponse(res, { error: 'Both provider and modelId parameters are required' }, 400);
                return;
            }

            // Get user overrides from config
            const modelKey = `${providerId}:${modelId}`;
            const userOverrides = config.llm?.tokenPolicy?.perModel?.[modelKey] || {};
            
            // Get metadata from cache/mappings
            const metadata = modelMetadata.getModelMetadata(providerId, modelId, userOverrides);
            
            jsonResponse(res, {
                provider: providerId,
                modelId,
                ...metadata
            });
            return;
        }

        // POST /api/llm/token-estimate - Estimate tokens for a request
        if (pathname === '/api/llm/token-estimate' && req.method === 'POST') {
            const body = await parseBody(req);
            const { provider, modelId, messages, ragContext, systemPrompt, task } = body;
            
            if (!provider || !modelId) {
                jsonResponse(res, { error: 'Provider and modelId are required' }, 400);
                return;
            }

            // Get model info
            const modelKey = `${provider}:${modelId}`;
            const userOverrides = config.llm?.tokenPolicy?.perModel?.[modelKey] || {};
            const modelInfo = modelMetadata.getModelMetadata(provider, modelId, userOverrides);
            
            // Get token estimate
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
            return;
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
            return;
        }

        // GET /api/llm/routing/status - Get routing status and provider health
        if (pathname === '/api/llm/routing/status' && req.method === 'GET') {
            const status = llmRouter.getRoutingStatus(config);
            jsonResponse(res, status);
            return;
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
            return;
        }

        // POST /api/llm/routing/config - Update routing configuration
        if (pathname === '/api/llm/routing/config' && req.method === 'POST') {
            const body = await parseBody(req);
            
            if (!config.llm.routing) {
                config.llm.routing = { ...llmRouter.DEFAULT_ROUTING_POLICY };
            }
            
            // Update routing mode
            if (body.mode !== undefined) {
                config.llm.routing.mode = body.mode;
            }
            
            // Update per-task config
            if (body.perTask) {
                config.llm.routing.perTask = {
                    ...config.llm.routing.perTask,
                    ...body.perTask
                };
            }
            
            // Update model map
            if (body.modelMap) {
                config.llm.routing.modelMap = {
                    ...config.llm.routing.modelMap,
                    ...body.modelMap
                };
            }
            
            saveConfig(config);
            jsonResponse(res, { success: true, routing: config.llm.routing });
            return;
        }

        // POST /api/llm/preflight - Run preflight tests
        if (pathname === '/api/llm/preflight' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const mode = body.mode || 'mock';
                
                // Import preflight runner
                const { runPreflight } = require('./tests/llmPreflightRunner');
                
                // Create a config copy with masked keys for the runner
                const testConfig = {
                    llm: getLLMConfigForFrontend(config.llm)
                };
                
                // Run preflight
                const report = await runPreflight({ mode, config: testConfig });
                
                jsonResponse(res, report);
            } catch (error) {
                console.error('Preflight error:', error);
                jsonResponse(res, { 
                    error: 'Preflight runner failed', 
                    message: error.message 
                }, 500);
            }
            return;
        }

        // ==================== End LLM Provider API ====================

        // GET /api/ollama/test - Test Ollama connection
        if (pathname === '/api/ollama/test' && req.method === 'GET') {
            const result = await ollama.testConnection();
            jsonResponse(res, result);
            return;
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
            return;
        }

        // GET /api/ollama/recommended - Get recommended models for download
        if (pathname === '/api/ollama/recommended' && req.method === 'GET') {
            try {
                const recommended = ollama.getRecommendedModels();
                const installed = await ollama.getCategorizedModels();
                const installedNames = installed.all.map(m => m.name.split(':')[0]);

                // Mark which are already installed
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
            return;
        }

        // POST /api/ollama/pull - Download a model
        if (pathname === '/api/ollama/pull' && req.method === 'POST') {
            const body = await parseBody(req);
            const modelName = body.model;

            if (!modelName) {
                jsonResponse(res, { error: 'Model name required' }, 400);
                return;
            }

            console.log(`Starting download of model: ${modelName}`);

            // Track download progress
            let lastProgress = null;
            const result = await ollama.pullModel(modelName, (progress) => {
                lastProgress = progress;
                // Log progress updates
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
            return;
        }

        // GET /api/files - Get pending files
        if (pathname === '/api/files' && req.method === 'GET') {
            const files = processor.scanPendingFiles();
            jsonResponse(res, files);
            return;
        }

        // DELETE /api/files/:folder/:filename - Remove file from pending queue
        const deleteFileMatch = pathname.match(/^\/api\/files\/(newinfo|newtranscripts)\/(.+)$/);
        if (deleteFileMatch && req.method === 'DELETE') {
            const folder = deleteFileMatch[1];
            const filename = decodeURIComponent(deleteFileMatch[2]);
            const filePath = path.join(processor.config.dataDir, folder, filename);

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted pending file: ${folder}/${filename}`);
                    jsonResponse(res, { success: true, message: `File ${filename} removed` });
                } else {
                    jsonResponse(res, { success: false, error: 'File not found' }, 404);
                }
            } catch (err) {
                console.error(`Error deleting file: ${err.message}`);
                jsonResponse(res, { success: false, error: err.message }, 500);
            }
            return;
        }

        // POST /api/upload - Upload files via drag-and-drop
        if (pathname === '/api/upload' && req.method === 'POST') {
            console.log('Upload request received');
            const contentType = req.headers['content-type'] || '';
            console.log('Content-Type:', contentType);

            if (!contentType.includes('multipart/form-data')) {
                console.log('Error: Not multipart/form-data');
                jsonResponse(res, { error: 'Content-Type must be multipart/form-data' }, 400);
                return;
            }

            // Parse multipart boundary - handle both with and without quotes
            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
            if (!boundaryMatch) {
                console.log('Error: No boundary found');
                jsonResponse(res, { error: 'No boundary found' }, 400);
                return;
            }
            const boundary = boundaryMatch[1] || boundaryMatch[2];
            console.log('Boundary:', boundary);

            // Collect body
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const body = Buffer.concat(chunks);
            console.log('Body size:', body.length, 'bytes');

            // Parse multipart data
            const parts = parseMultipart(body, boundary);
            console.log('Parsed parts - files:', parts.files.length, 'folder:', parts.folder, 'emailId:', parts.emailId);
            
            // File validation constants
            const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
            const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total
            const ALLOWED_EXTENSIONS = [
                // Documents
                'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp',
                // Images
                'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff',
                // Audio/Video (transcripts)
                'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'mov',
                // Archives
                'zip', 'tar', 'gz',
                // Data
                'json', 'csv', 'xml', 'yaml', 'yml',
                // Email
                'eml', 'msg'
            ];
            const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'js', 'vbs', 'ps1', 'sh'];
            
            // Validate files
            const validationErrors = [];
            let totalSize = 0;
            
            for (const file of parts.files) {
                const ext = (file.filename.split('.').pop() || '').toLowerCase();
                
                // Check dangerous extensions
                if (DANGEROUS_EXTENSIONS.includes(ext)) {
                    validationErrors.push(`File "${file.filename}" has a potentially dangerous extension`);
                    continue;
                }
                
                // Check allowed extensions
                if (!ALLOWED_EXTENSIONS.includes(ext)) {
                    validationErrors.push(`File "${file.filename}" has unsupported extension .${ext}`);
                    continue;
                }
                
                // Check individual file size
                if (file.data.length > MAX_FILE_SIZE) {
                    validationErrors.push(`File "${file.filename}" exceeds maximum size of 100MB`);
                    continue;
                }
                
                totalSize += file.data.length;
            }
            
            // Check total size
            if (totalSize > MAX_TOTAL_SIZE) {
                validationErrors.push(`Total upload size exceeds maximum of 500MB`);
            }
            
            if (validationErrors.length > 0) {
                jsonResponse(res, { 
                    error: 'File validation failed', 
                    details: validationErrors 
                }, 400);
                return;
            }

            const folderType = parts.folder || 'newinfo';
            const emailId = parts.emailId;
            
            // Use project-specific data directory
            const projectDataDir = storage.getProjectDataDir();
            const targetDir = folderType === 'newtranscripts'
                ? path.join(projectDataDir, 'newtranscripts')
                : path.join(projectDataDir, 'newinfo');

            // Ensure directory exists
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Save uploaded files with metadata
            const savedFiles = [];
            const documentDate = parts.documentDate;
            const documentTime = parts.documentTime;
            
            for (const file of parts.files) {
                const safeName = file.filename.replace(/[<>:"/\\|?*]/g, '_');
                const filePath = path.join(targetDir, safeName);
                fs.writeFileSync(filePath, file.data);
                
                // Save metadata file with document date and email association
                const metaPath = filePath + '.meta.json';
                const metadata = {
                    documentDate: documentDate || null,
                    documentTime: documentTime || null,
                    uploadedAt: new Date().toISOString(),
                    originalFilename: file.filename,
                    emailId: emailId || null
                };
                fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
                console.log('Saved metadata:', metaPath, 'emailId:', emailId);
                
                // If this is an email attachment, save to email_attachments table
                if (emailId && storage._supabase) {
                    try {
                        // Create a document record first
                        const docResult = await storage._supabase.addDocument({
                            filename: safeName,
                            path: filePath,
                            type: path.extname(safeName).toLowerCase().replace('.', ''),
                            size: file.data.length,
                            status: 'pending',
                            doc_type: 'email_attachment'
                        });
                        
                        if (docResult && docResult.id) {
                            // Link to email
                            await storage._supabase.addEmailAttachment(emailId, docResult.id, {
                                filename: safeName,
                                size: file.data.length,
                                content_type: getMimeType(safeName)
                            });
                            console.log('[Upload] Email attachment linked:', safeName, '-> email:', emailId);
                        }
                    } catch (e) {
                        console.error('[Upload] Failed to save email attachment:', e.message);
                    }
                }
                
                savedFiles.push({ name: safeName, size: file.data.length, documentDate, emailId });
                console.log('Saved file:', safeName, '(', file.data.length, 'bytes)', 'date:', documentDate);
            }

            console.log('Upload complete:', savedFiles.length, 'files');
            jsonResponse(res, {
                success: true,
                files: savedFiles,
                folder: folderType,
                documentDate: documentDate,
                emailId: emailId,
                message: `${savedFiles.length} file(s) uploaded to ${folderType}${emailId ? ' (attached to email)' : ''}`,
                processing: folderType === 'newtranscripts' ? 'started' : 'pending'
            });
            
            // Auto-start processing for transcripts
            if (folderType === 'newtranscripts' && savedFiles.length > 0) {
                console.log('[Upload] Auto-starting transcript processing...');
                
                // Get models from config
                const textCfg = llmConfig.getTextConfig(config);
                const visionCfg = llmConfig.getVisionConfig(config);
                const textModel = textCfg.model;
                const visionModel = visionCfg.model;
                
                // Start processing in background
                processor.processAllContentFirst(textModel, visionModel, '').then(async (result) => {
                    const stats = result.stats || {};
                    console.log('[Upload] Transcript processing complete:', {
                        success: result.success,
                        facts: stats.factsAdded || 0,
                        decisions: stats.decisionsAdded || 0,
                        people: stats.peopleAdded || 0,
                        questions: stats.questionsAdded || 0,
                        risks: stats.risksAdded || 0,
                        summaries: stats.summariesGenerated || 0
                    });
                    
                    // Invalidate briefing cache
                    invalidateBriefingCache();
                }).catch(err => {
                    console.error('[Upload] Auto-processing error:', err.message);
                });
            }
            
            return;
        }

        // POST /api/process - Start processing (Content-First Architecture)
        if (pathname === '/api/process' && req.method === 'POST') {
            const body = await parseBody(req);
            
            // Determine provider - explicit request overrides config
            const requestProvider = body.provider;
            const processTextCfg = llmConfig.getTextConfig(config, { provider: requestProvider });
            const effectiveProvider = processTextCfg.provider;
            
            // Use configured models from LLM config (perTask preferred), fallback to ollama
            const textModel = body.model || config.llm?.perTask?.text?.model || config.llm?.models?.text || config.ollama?.model || 'auto';
            const visionModel = config.llm?.perTask?.vision?.model || config.llm?.models?.vision || config.ollama?.visionModel || null;
            
            console.log(`[Process] Using provider: ${effectiveProvider}, text model: ${textModel}, vision model: ${visionModel}`);
            
            // Temporarily override processor config to use requested provider
            if (requestProvider) {
                processor.config.llm = processor.config.llm || {};
                processor.config.llm.perTask = processor.config.llm.perTask || {};
                processor.config.llm.perTask.text = processor.config.llm.perTask.text || {};
                processor.config.llm.perTask.text.provider = requestProvider;
                processor.config.llm.provider = requestProvider;
                console.log(`[Process] Overriding provider to: ${requestProvider}`);
            }

            // Get user role for contextual extraction
            const currentProject = storage.getCurrentProject();
            const userRole = currentProject?.userRole || '';

            // Start async processing with Content-First Architecture
            // Phase 1: Extract raw content → save to content/
            // Phase 2: Holistic synthesis with full context
            processor.processAllContentFirst(textModel, visionModel, userRole).then(async (result) => {
                console.log('Processing complete:', result);

                // Invalidate briefing cache so next dashboard load regenerates it
                invalidateBriefingCache();

                // Auto-rebuild RAG index if items were processed
                const processed = result.phase1?.processed || 0;
                if (processed > 0) {
                    storage.invalidateRAGCache();

                    // Step 1: Regenerate markdown files from database
                    console.log('Regenerating SOURCE_OF_TRUTH.md and PENDING_QUESTIONS.md...');
                    storage.regenerateMarkdown();

                    // Step 2: Get embedding model (prefer mxbai-embed-large)
                    const DEFAULT_EMBED_MODEL = 'mxbai-embed-large';
                    const embeddingModels = await ollama.getEmbeddingModels();
                    let embedModel = embeddingModels.length > 0 ? embeddingModels[0].name : DEFAULT_EMBED_MODEL;

                    // If no embedding models available, auto-pull mxbai-embed-large
                    if (embeddingModels.length === 0) {
                        console.log(`No embedding models found. Auto-pulling ${DEFAULT_EMBED_MODEL}...`);
                        const pullResult = await ollama.pullModel(DEFAULT_EMBED_MODEL, (progress) => {
                            if (progress.percent && progress.percent % 20 === 0) {
                                console.log(`Pulling ${DEFAULT_EMBED_MODEL}: ${progress.percent}%`);
                            }
                        });
                        if (pullResult.success) {
                            console.log(`${DEFAULT_EMBED_MODEL} pulled successfully`);
                            embedModel = DEFAULT_EMBED_MODEL;
                        } else {
                            console.error(`Failed to pull ${DEFAULT_EMBED_MODEL}: ${pullResult.error}`);
                            return; // Skip embedding if model can't be pulled
                        }
                    }

                    // Step 3: Rebuild embeddings in background
                    console.log(`Auto-rebuilding RAG index with ${embedModel}...`);

                    storage.saveKnowledgeJSON();
                    storage.saveQuestionsJSON();

                    const items = storage.getAllItemsForEmbedding();
                    if (items.length > 0) {
                        const texts = items.map(item => item.text);
                        
                        // Use LLM module for embeddings (supports multiple providers)
                        const embedCfg = llmConfig.getEmbeddingsConfig(config);
                        const embedProvider = embedCfg.provider;
                        const embedProviderConfig = embedCfg.providerConfig;
                        
                        // Batch embed in chunks to avoid rate limits
                        const batchSize = 20;
                        const allEmbeddings = [];
                        
                        for (let i = 0; i < texts.length; i += batchSize) {
                            const batch = texts.slice(i, i + batchSize);
                            const embedResult = await llm.embed({
                                provider: embedProvider,
                                providerConfig: embedProviderConfig,
                                model: embedModel,
                                texts: batch
                            });
                            
                            if (embedResult.success && embedResult.embeddings) {
                                allEmbeddings.push(...embedResult.embeddings);
                            } else {
                                // Fill with nulls for failed batch
                                allEmbeddings.push(...batch.map(() => null));
                            }
                            
                            const percent = Math.round(((i + batch.length) / texts.length) * 100);
                            if (percent % 20 === 0) {
                                console.log(`RAG index: ${percent}% (${i + batch.length}/${texts.length})`);
                            }
                        }

                        if (allEmbeddings.some(e => e !== null)) {
                            const embeddings = items.map((item, idx) => ({
                                id: item.id,
                                type: item.type,
                                text: item.text,
                                embedding: allEmbeddings[idx]
                            }));
                            embeddings.model = embedModel;
                            storage.saveEmbeddings(embeddings);
                            console.log(`RAG index rebuilt: ${embeddings.length} items indexed`);
                        }
                    }
                }
            });
            jsonResponse(res, { status: 'started', message: `Processing started (text: ${textModel}, vision: ${visionModel || 'auto'})` });
            return;
        }

        // GET /api/process/status - Get processing status
        if (pathname === '/api/process/status' && req.method === 'GET') {
            jsonResponse(res, processor.getState());
            return;
        }

        // GET /api/process/stream - SSE stream for real-time processing updates
        if (pathname === '/api/process/stream' && req.method === 'GET') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // Send initial state
            const sendState = () => {
                const state = processor.getState();
                res.write(`data: ${JSON.stringify(state)}\n\n`);
            };

            // Send immediately
            sendState();

            // Set up interval to send updates
            const intervalId = setInterval(() => {
                try {
                    sendState();
                } catch (err) {
                    clearInterval(intervalId);
                }
            }, 1000); // Update every second

            // Clean up on connection close
            req.on('close', () => {
                clearInterval(intervalId);
            });

            return;
        }

        // GET /api/documents/:id/processing/stream - SSE stream for single document reprocess
        const docProcessStreamMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/processing\/stream$/i);
        if (docProcessStreamMatch && req.method === 'GET') {
            const docId = docProcessStreamMatch[1];
            
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // Send document status updates
            const sendDocStatus = async () => {
                try {
                    const { data: doc } = await storage._supabase.supabase
                        .from('documents')
                        .select('id, status, summary, facts_count, decisions_count, risks_count, actions_count, questions_count, processed_at, error_message')
                        .eq('id', docId)
                        .single();
                    
                    if (doc) {
                        res.write(`data: ${JSON.stringify(doc)}\n\n`);
                        
                        // Stop streaming if processed or failed
                        if (doc.status === 'processed' || doc.status === 'completed' || doc.status === 'failed') {
                            res.write(`event: complete\ndata: ${JSON.stringify(doc)}\n\n`);
                            res.end();
                            return true; // Signal to stop
                        }
                    }
                    return false;
                } catch (err) {
                    console.error('[SSE] Error fetching doc status:', err);
                    return false;
                }
            };

            // Send immediately
            sendDocStatus();

            // Set up interval
            const intervalId = setInterval(async () => {
                try {
                    const shouldStop = await sendDocStatus();
                    if (shouldStop) {
                        clearInterval(intervalId);
                    }
                } catch (err) {
                    clearInterval(intervalId);
                }
            }, 2000); // Update every 2 seconds

            // Clean up on connection close
            req.on('close', () => {
                clearInterval(intervalId);
            });

            return;
        }

        // GET /api/stats - Get statistics
        if (pathname === '/api/stats' && req.method === 'GET') {
            const stats = storage.getStats();
            jsonResponse(res, stats);
            return;
        }

        // ==================== Conversations API ====================
        
        // POST /api/conversations/parse - Preview parse conversation without saving
        if (pathname === '/api/conversations/parse' && req.method === 'POST') {
            const body = await parseBody(req);
            const { text, formatHint, meta } = body;
            
            if (!text || typeof text !== 'string') {
                jsonResponse(res, { ok: false, error: 'text is required' }, 400);
                return;
            }
            
            try {
                const conversations = require('./conversations');
                const result = conversations.parse(text, formatHint || 'auto');
                
                // Limit preview to first 20 messages
                const messagesPreview = result.messages.slice(0, 20);
                
                jsonResponse(res, {
                    ok: true,
                    format: result.format,
                    confidence: result.confidence,
                    messagesPreview,
                    stats: result.stats,
                    warnings: result.warnings,
                    hasMore: result.messages.length > 20
                });
            } catch (error) {
                console.error('[Conversations] Parse error:', error.message);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/conversations - Import conversation
        if (pathname === '/api/conversations' && req.method === 'POST') {
            const body = await parseBody(req);
            const { text, formatHint, meta, skipAI } = body;
            
            if (!text || typeof text !== 'string') {
                jsonResponse(res, { ok: false, error: 'text is required' }, 400);
                return;
            }
            
            try {
                const conversations = require('./conversations');
                const parseResult = conversations.parse(text, formatHint || 'auto');
                
                if (parseResult.messages.length === 0) {
                    jsonResponse(res, { ok: false, error: 'No messages could be parsed', warnings: parseResult.warnings }, 400);
                    return;
                }
                
                // Create normalized conversation
                const conversation = conversations.createConversation(parseResult, {
                    projectId: storage.currentProjectId,
                    title: meta?.title,
                    channelName: meta?.channelName,
                    workspaceName: meta?.workspaceName
                });
                
                // Store raw text for potential re-parsing (but not logged)
                conversation.rawText = text;
                
                // Apply user-provided document date for timeline
                if (meta?.documentDate) {
                    conversation.documentDate = meta.documentDate;
                    // Override dateRange with user-provided date
                    conversation.dateRange = {
                        first: meta.documentDate,
                        last: meta.documentDate
                    };
                    console.log(`[Conversations] Using user-provided date: ${meta.documentDate}`);
                }
                
                // AI Processing: Generate title and summary if not skipped
                if (!skipAI && parseResult.messages.length > 0) {
                    try {
                        const textCfg = llmConfig.getTextConfig(config);
                        const llmProvider = textCfg.provider;
                        const providerConfig = textCfg.providerConfig;
                        const model = textCfg.model;
                        
                        // Build conversation excerpt for AI (limit to avoid token overflow)
                        const maxMessages = Math.min(30, parseResult.messages.length);
                        const excerpt = parseResult.messages.slice(0, maxMessages).map(m => {
                            const speaker = m.speaker || 'Unknown';
                            const text = m.text.substring(0, 200);
                            return `${speaker}: ${text}`;
                        }).join('\n');
                        
                        // Get contacts context for better understanding
                        const contactsContext = storage.getContactsContextForAI(parseResult.stats.participants);
                        
                        const aiPrompt = `Analyze this conversation and provide:
1. A short descriptive title (max 60 chars, no quotes)
2. A brief summary (2-3 sentences describing the main topics discussed)

Participants: ${parseResult.stats.participants.join(', ')}
Messages: ${parseResult.messages.length}
Source: ${parseResult.format}
${contactsContext ? `\n${contactsContext}\n` : ''}
Conversation excerpt:
${excerpt}
${parseResult.messages.length > maxMessages ? `\n... (${parseResult.messages.length - maxMessages} more messages)` : ''}

Respond in this exact format:
TITLE: <title here>
SUMMARY: <summary here>`;

                        console.log(`[Conversations] Generating AI title and summary...`);
                        
                        const aiResult = await llm.generateText({
                            provider: llmProvider,
                            providerConfig,
                            model,
                            prompt: aiPrompt,
                            temperature: 0.3,
                            context: 'conversation',
                            maxTokens: 300
                        });
                        
                        if (aiResult.success && aiResult.text) {
                            // Parse AI response
                            const titleMatch = aiResult.text.match(/TITLE:\s*(.+?)(?:\n|SUMMARY:|$)/i);
                            const summaryMatch = aiResult.text.match(/SUMMARY:\s*(.+?)$/is);
                            
                            if (titleMatch && !meta?.title) {
                                conversation.title = titleMatch[1].trim().replace(/^["']|["']$/g, '').substring(0, 100);
                            }
                            if (summaryMatch) {
                                conversation.summary = summaryMatch[1].trim().substring(0, 500);
                            }
                            
                            console.log(`[Conversations] AI generated - Title: "${conversation.title}", Summary: ${conversation.summary?.substring(0, 50)}...`);
                        }
                    } catch (aiError) {
                        console.warn(`[Conversations] AI processing failed: ${aiError.message}`);
                        // Continue without AI-generated content
                    }
                }
                
                // Save to storage
                const id = storage.addConversation(conversation);
                
                // ==================== AI CONTENT PROCESSOR ====================
                // Extract entities, relationships and populate graph
                const graphProvider = storage.getGraphProvider();
                if (!skipAI && graphProvider && graphProvider.connected) {
                    try {
                        const { getAIContentProcessor } = require('./ai');
                        const aiTextCfg = llmConfig.getTextConfig(config);
                        const aiProcessor = getAIContentProcessor({
                            llmProvider: aiTextCfg.provider,
                            llmModel: aiTextCfg.model,
                            llmConfig: config.llm
                        });
                        
                        console.log(`[Conversations] Running AI entity extraction...`);
                        const aiResult = await aiProcessor.processConversation({
                            ...conversation,
                            id
                        });
                        
                        // Analyze extraction for ontology suggestions
                        try {
                            const { getOntologyAgent } = require('./ontology');
                            const ontologyAgent = getOntologyAgent({
                                graphProvider: storage.getGraphProvider(),
                                storage: storage,
                                dataDir: storage.getProjectDataDir ? storage.getProjectDataDir() : './data'
                            });
                            await ontologyAgent.analyzeExtraction(aiResult, conversation.title || 'conversation');
                        } catch (ontologyErr) {
                            // Ontology agent is optional
                        }
                        
                        // Execute Cypher queries to populate graph
                        if (aiResult.cypherQueries && aiResult.cypherQueries.length > 0) {
                            console.log(`[Conversations] Populating graph with ${aiResult.cypherQueries.length} queries`);
                            for (const cq of aiResult.cypherQueries) {
                                try {
                                    await graphProvider.query(cq.query, cq.params);
                                } catch (cypherErr) {
                                    console.log(`[Conversations] Cypher error: ${cypherErr.message}`);
                                }
                            }
                        }
                        
                        // Store full extraction result in conversation metadata
                        storage.updateConversation(id, {
                            extractedEntities: aiResult.entities || [],
                            extractedRelationships: aiResult.relationships || [],
                            extraction_result: aiResult,
                            aiProcessedAt: new Date().toISOString()
                        });
                        
                        // ===== POPULATE KNOWLEDGE BASE =====
                        // Add extracted facts to main storage
                        let factsAdded = 0, decisionsAdded = 0, risksAdded = 0, questionsAdded = 0, actionsAdded = 0, peopleAdded = 0;
                        
                        // Add facts
                        for (const fact of aiResult.facts || []) {
                            if (fact.content && fact.content.length > 10) {
                                storage.addFact({
                                    content: fact.content,
                                    category: fact.category || 'general',
                                    confidence: fact.confidence || 0.8,
                                    source: `conversation:${id}`
                                });
                                factsAdded++;
                            }
                        }
                        
                        // Add decisions
                        for (const decision of aiResult.decisions || []) {
                            if (decision.content && decision.content.length > 10) {
                                storage.addDecision({
                                    content: decision.content,
                                    owner: decision.owner || null,
                                    date: decision.date || new Date().toISOString().split('T')[0],
                                    status: 'active',
                                    source: `conversation:${id}`
                                });
                                decisionsAdded++;
                            }
                        }
                        
                        // Add risks
                        for (const risk of aiResult.risks || []) {
                            if (risk.content && risk.content.length > 10) {
                                storage.addRisk({
                                    content: risk.content,
                                    impact: risk.impact || 'medium',
                                    likelihood: 'medium',
                                    mitigation: risk.mitigation || 'To be defined',
                                    status: 'open',
                                    source: `conversation:${id}`
                                });
                                risksAdded++;
                            }
                        }
                        
                        // Add questions
                        for (const question of aiResult.questions || []) {
                            if (question.content && question.content.length > 10) {
                                storage.addQuestion({
                                    content: question.content,
                                    context: question.context || '',
                                    priority: question.priority || 'medium',
                                    assigned_to: question.assigned_to || null,
                                    status: 'pending',
                                    source_file: conversation.title || `conversation:${id}`
                                });
                                questionsAdded++;
                            }
                        }
                        
                        // Add action items
                        for (const action of aiResult.actionItems || []) {
                            if (action.task && action.task.length > 5) {
                                storage.addActionItem({
                                    task: action.task,
                                    owner: action.owner || action.assignee || null,
                                    deadline: action.deadline || null,
                                    status: action.status || 'pending',
                                    source: `conversation:${id}`
                                });
                                actionsAdded++;
                            }
                        }
                        
                        // Add people from participants
                        for (const participant of aiResult.participants || []) {
                            if (participant.name && participant.name.length > 2) {
                                storage.addPerson({
                                    name: participant.name,
                                    role: participant.role || null,
                                    organization: participant.organization || null,
                                    source: `conversation:${id}`
                                });
                                peopleAdded++;
                            }
                        }
                        
                        console.log(`[Conversations] Knowledge extracted: ${factsAdded} facts, ${decisionsAdded} decisions, ${risksAdded} risks, ${questionsAdded} questions, ${actionsAdded} actions, ${peopleAdded} people`);
                        console.log(`[Conversations] Entities: ${aiResult.entities?.length || 0}, Relationships: ${aiResult.relationships?.length || 0}`);
                        
                        // ===== SYNC QUESTIONS TO FALKORDB =====
                        if (questionsAdded > 0 && graphProvider && graphProvider.connected) {
                            try {
                                const { getGraphSync } = require('./sync');
                                const graphSync = getGraphSync({ graphProvider, storage });
                                
                                const recentQuestions = storage.getQuestions().slice(-questionsAdded);
                                for (const q of recentQuestions) {
                                    await graphSync.syncQuestion(q);
                                }
                                console.log(`[Conversations] Synced ${questionsAdded} questions to FalkorDB`);
                            } catch (syncErr) {
                                console.log('[Conversations] Question sync error:', syncErr.message);
                            }
                        }
                        
                        // ===== AUTO-DETECT ANSWERS IN CONVERSATION =====
                        // Check if this conversation answers any pending questions
                        try {
                            const pendingQuestions = storage.getQuestions({ status: 'pending' });
                            const conversationContent = conversation.messages?.map(m => m.text).join(' ') || '';
                            let answersFound = 0;
                            
                            for (const pq of pendingQuestions.slice(0, 10)) { // Check first 10
                                // Look for question keywords in conversation
                                const qWords = pq.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
                                const matchCount = qWords.filter(w => conversationContent.toLowerCase().includes(w)).length;
                                const matchRatio = matchCount / Math.max(qWords.length, 1);
                                
                                if (matchRatio >= 0.5) {
                                    // Use AI to check if actually answered
                                    const checkPrompt = `Does this conversation answer the following question?

QUESTION: "${pq.content}"
${pq.context ? `CONTEXT: ${pq.context}` : ''}

CONVERSATION EXCERPT:
"${conversationContent.substring(0, 2000)}"

If the conversation contains an answer to the question, respond:
ANSWERED: yes
ANSWER: <the answer found>
CONFIDENCE: high|medium|low

If not answered, respond:
ANSWERED: no`;
                                    
                                    const checkTextCfg = llmConfig.getTextConfig(config);
                                    const checkResult = await llm.generateText({
                                        provider: checkTextCfg.provider,
                                        providerConfig: checkTextCfg.providerConfig,
                                        model: checkTextCfg.model,
                                        prompt: checkPrompt,
                                        maxTokens: 400,
                                        temperature: 0.2,
                                        context: 'question',
                                        providerConfig: config.llm?.providers?.[config.llm?.provider] || {}
                                    });
                                    
                                    if (checkResult.success) {
                                        const checkResponse = checkResult.text || '';
                                        const isAnswered = checkResponse.match(/ANSWERED:\s*yes/i);
                                        const answerMatch = checkResponse.match(/ANSWER:\s*(.+?)(?=CONFIDENCE:|$)/is);
                                        const confidenceMatch = checkResponse.match(/CONFIDENCE:\s*(high|medium|low)/i);
                                        
                                        if (isAnswered && answerMatch && confidenceMatch?.[1]?.toLowerCase() === 'high') {
                                            const answer = answerMatch[1].trim();
                                            if (answer.length > 10) {
                                                // Resolve question with source - persists to Supabase
                                                const result = await storage.resolveQuestion(pq.id, answer, `conversation:${id}`);
                                                
                                                // Sync to graph
                                                if (result?.question && graphProvider && graphProvider.connected) {
                                                    try {
                                                        const { getGraphSync } = require('./sync');
                                                        const graphSync = getGraphSync({ graphProvider, storage });
                                                        await graphSync.syncQuestion(result.question);
                                                    } catch (syncErr) {
                                                        console.log('[Conversations] Graph sync warning:', syncErr.message);
                                                    }
                                                }
                                                
                                                answersFound++;
                                                console.log(`[Conversations] Auto-answered question: "${pq.content.substring(0, 40)}..."`);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            if (answersFound > 0) {
                                console.log(`[Conversations] Auto-resolved ${answersFound} pending questions from conversation`);
                            }
                        } catch (answerErr) {
                            console.log('[Conversations] Answer detection error:', answerErr.message);
                        }
                        // ===== END AUTO-DETECT ANSWERS =====
                        // ===== END POPULATE KNOWLEDGE BASE =====
                        
                    } catch (aiProcessError) {
                        console.warn(`[Conversations] AI Content Processor error: ${aiProcessError.message}`);
                    }
                }
                // ==================== END AI CONTENT PROCESSOR ====================
                
                // Track contact activity
                storage.trackContactsFromConversation(conversation);
                
                console.log(`[Conversations] Imported conversation: ${id} (${parseResult.format}, ${parseResult.messages.length} messages)`);
                
                jsonResponse(res, {
                    ok: true,
                    id,
                    title: conversation.title,
                    summary: conversation.summary,
                    stats: {
                        messageCount: conversation.messageCount,
                        dateRange: conversation.dateRange,
                        participants: conversation.participants,
                        sourceApp: conversation.sourceApp
                    }
                });
            } catch (error) {
                console.error('[Conversations] Import error:', error.message);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/conversations - List conversations
        if (pathname === '/api/conversations' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const filter = {};
                if (parsedUrl.query.sourceApp) filter.sourceApp = parsedUrl.query.sourceApp;
                if (parsedUrl.query.participant) filter.participant = parsedUrl.query.participant;
                
                const conversations = storage.getConversations(filter);
                
                // Return without messages for list view (lighter)
                const list = conversations.map(c => ({
                    id: c.id,
                    title: c.title,
                    summary: c.summary,
                    sourceApp: c.sourceApp,
                    channelName: c.channelName,
                    workspaceName: c.workspaceName,
                    participants: c.participants,
                    messageCount: c.messageCount,
                    dateRange: c.dateRange,
                    importedAt: c.importedAt
                }));
                
                jsonResponse(res, { ok: true, conversations: list, total: list.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/conversations/:id - Get single conversation
        const convGetMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)$/);
        if (convGetMatch && req.method === 'GET') {
            const convId = convGetMatch[1];
            try {
                const conversation = storage.getConversationById(convId);
                if (!conversation) {
                    jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                    return;
                }
                jsonResponse(res, { ok: true, conversation });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // PUT /api/conversations/:id - Update conversation metadata
        const convPutMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)$/);
        if (convPutMatch && req.method === 'PUT') {
            const convId = convPutMatch[1];
            const body = await parseBody(req);
            
            try {
                const success = storage.updateConversation(convId, body);
                if (!success) {
                    jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                    return;
                }
                jsonResponse(res, { ok: true, message: 'Conversation updated' });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // DELETE /api/conversations/:id - Delete conversation
        const convDeleteMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)$/);
        if (convDeleteMatch && req.method === 'DELETE') {
            const convId = convDeleteMatch[1];
            
            try {
                // Get conversation info before deleting
                const conversation = storage.getConversationById(convId);
                
                const success = storage.deleteConversation(convId);
                if (!success) {
                    jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                    return;
                }
                
                // Also remove related embeddings
                const embeddings = storage.loadEmbeddings();
                if (embeddings && embeddings.embeddings) {
                    const filtered = embeddings.embeddings.filter(e => !e.id.startsWith(`conv_${convId}_`));
                    if (filtered.length < embeddings.embeddings.length) {
                        embeddings.embeddings = filtered;
                        storage.saveEmbeddings(embeddings.embeddings);
                        console.log(`[Conversations] Removed embeddings for conversation ${convId}`);
                    }
                }
                
                // Sync with graph - remove from FalkorDB
                try {
                    const { getGraphSync } = require('./sync');
                    const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                    await graphSync.onConversationDeleted(convId, conversation?.title);
                } catch (syncErr) {
                    console.log(`[Conversations] Graph sync warning: ${syncErr.message}`);
                }
                
                console.log(`[Conversations] Deleted conversation: ${convId}`);
                jsonResponse(res, { ok: true, message: 'Conversation deleted', graphSynced: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/conversations/:id/reembed - Re-index conversation
        const convReembedMatch = pathname.match(/^\/api\/conversations\/([a-f0-9\-]+)\/reembed$/);
        if (convReembedMatch && req.method === 'POST') {
            const convId = convReembedMatch[1];
            
            try {
                const conversation = storage.getConversationById(convId);
                if (!conversation) {
                    jsonResponse(res, { ok: false, error: 'Conversation not found' }, 404);
                    return;
                }
                
                const conversations = require('./conversations');
                const chunks = conversations.getConversationEmbeddingItems([conversation]);
                
                if (chunks.length === 0) {
                    jsonResponse(res, { ok: false, error: 'No chunks to embed' }, 400);
                    return;
                }
                
                // Get embedding model
                const docEmbedCfg = llmConfig.getEmbeddingsConfig(config);
                const embedProvider = docEmbedCfg.provider;
                const embedProviderConfig = docEmbedCfg.providerConfig;
                const embedModel = docEmbedCfg.model;
                
                // Generate embeddings
                const texts = chunks.map(c => c.text);
                const embedResult = await llm.embed({
                    provider: embedProvider,
                    providerConfig: embedProviderConfig,
                    model: embedModel,
                    texts
                });
                
                if (!embedResult.success) {
                    jsonResponse(res, { ok: false, error: embedResult.error || 'Embedding failed' }, 500);
                    return;
                }
                
                // Update embeddings
                const existingEmbeddings = storage.loadEmbeddings();
                const allEmbeddings = existingEmbeddings?.embeddings || [];
                
                // Remove old embeddings for this conversation
                const filtered = allEmbeddings.filter(e => !e.id.startsWith(`conv_${convId}_`));
                
                // Add new embeddings
                for (let i = 0; i < chunks.length; i++) {
                    filtered.push({
                        id: chunks[i].id,
                        type: 'conversation',
                        text: chunks[i].text,
                        embedding: embedResult.embeddings[i],
                        data: chunks[i].data
                    });
                }
                
                storage.saveEmbeddings(filtered);
                console.log(`[Conversations] Re-embedded conversation ${convId}: ${chunks.length} chunks`);
                
                jsonResponse(res, { ok: true, chunksEmbedded: chunks.length });
            } catch (error) {
                console.error('[Conversations] Reembed error:', error.message);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/conversations/stats - Get conversation statistics
        if (pathname === '/api/conversations/stats' && req.method === 'GET') {
            try {
                const stats = storage.getConversationStats();
                jsonResponse(res, { ok: true, ...stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== Contacts Directory API ====================
        
        // POST /api/contacts - Create contact
        if (pathname === '/api/contacts' && req.method === 'POST') {
            const body = await parseBody(req);
            
            if (!body.name || typeof body.name !== 'string') {
                jsonResponse(res, { ok: false, error: 'name is required' }, 400);
                return;
            }
            
            try {
                const result = await storage.addContact(body);
                const contactId = result?.id || result;
                console.log(`[Contacts] Added contact: ${body.name} (${contactId})`);
                
                // Sync with FalkorDB
                let graphSynced = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        const { getGraphSync } = require('./sync');
                        const graphSync = getGraphSync({ graphProvider, storage });
                        await graphSync.syncContact({ id: contactId, ...body });
                        graphSynced = true;
                    }
                } catch (syncErr) {
                    console.log(`[Contacts] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, id: contactId, graphSynced });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/contacts - List contacts
        if (pathname === '/api/contacts' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const filter = {};
                if (parsedUrl.query.organization) filter.organization = parsedUrl.query.organization;
                if (parsedUrl.query.tag) filter.tag = parsedUrl.query.tag;
                if (parsedUrl.query.search) filter.search = parsedUrl.query.search;
                
                const contacts = await storage.getContacts(Object.keys(filter).length > 0 ? filter : null);
                
                // Enrich contacts with ALL team memberships (N:N)
                const allTeams = await storage.getTeams() || [];
                const enrichedContacts = contacts.map(c => {
                    // Find ALL teams this contact belongs to
                    const memberTeams = allTeams.filter(t => 
                        t.members?.some(m => 
                            m.contact?.id === c.id || 
                            m.contactId === c.id || 
                            m.contact_id === c.id
                        )
                    ).map(t => ({
                        id: t.id,
                        name: t.name,
                        color: t.color || 'var(--accent)'
                    }));
                    
                    // Primary team (first one) for backwards compatibility
                    const primaryTeam = memberTeams[0] || null;
                    
                    return {
                        ...c,
                        teams: memberTeams, // Array of all teams
                        teamId: primaryTeam?.id || c.teamId || null,
                        teamName: primaryTeam?.name || null,
                        teamColor: primaryTeam?.color || null
                    };
                });
                
                jsonResponse(res, { ok: true, contacts: enrichedContacts, total: enrichedContacts.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/contacts/stats - Get contact statistics
        if (pathname === '/api/contacts/stats' && req.method === 'GET') {
            try {
                const stats = storage.getContactStats();
                jsonResponse(res, { ok: true, ...stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/contacts/:id - Get single contact
        const contactGetMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)$/);
        if (contactGetMatch && req.method === 'GET') {
            const contactId = contactGetMatch[1];
            try {
                const contact = storage.getContactById(contactId);
                if (!contact) {
                    jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                    return;
                }
                jsonResponse(res, { ok: true, contact });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // PUT /api/contacts/:id - Update contact
        const contactPutMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)$/);
        if (contactPutMatch && req.method === 'PUT') {
            const contactId = contactPutMatch[1];
            const body = await parseBody(req);
            
            try {
                // Get current contact to check team changes
                const currentContact = storage.getContactById(contactId);
                const oldTeamId = currentContact?.teamId;
                const newTeamId = body.teamId;
                
                const success = await storage.updateContact(contactId, body);
                if (!success) {
                    jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                    return;
                }
                
                // Handle team membership changes
                if (oldTeamId !== newTeamId) {
                    // Remove from old team
                    if (oldTeamId) {
                        try {
                            await storage.removeTeamMember(oldTeamId, contactId);
                        } catch (e) {
                            console.log(`[Contacts] Could not remove from old team: ${e.message}`);
                        }
                    }
                    // Add to new team
                    if (newTeamId) {
                        try {
                            await storage.addTeamMember(newTeamId, contactId);
                        } catch (e) {
                            console.log(`[Contacts] Could not add to new team: ${e.message}`);
                        }
                    }
                }
                
                // Sync with FalkorDB
                let graphSynced = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        await graphProvider.query(
                            `MERGE (c:Contact {id: $id})
                             SET c.name = $name, c.email = $email, c.role = $role,
                                 c.organization = $organization, c.timezone = $timezone,
                                 c.entity_type = 'Contact', c.updated_at = datetime()`,
                            { 
                                id: contactId, 
                                name: body.name || currentContact?.name,
                                email: body.email || null,
                                role: body.role || null,
                                organization: body.organization || null,
                                timezone: body.timezone || null
                            }
                        );
                        
                        // Update team relationship
                        if (newTeamId) {
                            await graphProvider.query(
                                `MATCH (c:Contact {id: $contactId})
                                 OPTIONAL MATCH (c)-[r:MEMBER_OF]->(:Team)
                                 DELETE r
                                 WITH c
                                 MATCH (t:Team {id: $teamId})
                                 MERGE (c)-[:MEMBER_OF]->(t)`,
                                { contactId, teamId: newTeamId }
                            );
                        } else if (oldTeamId) {
                            // Remove team relationship
                            await graphProvider.query(
                                `MATCH (c:Contact {id: $contactId})-[r:MEMBER_OF]->(:Team)
                                 DELETE r`,
                                { contactId }
                            );
                        }
                        graphSynced = true;
                    }
                } catch (syncErr) {
                    console.log(`[Contacts] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, message: 'Contact updated', graphSynced });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // DELETE /api/contacts/:id - Delete contact
        const contactDeleteMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)$/);
        if (contactDeleteMatch && req.method === 'DELETE') {
            const contactId = contactDeleteMatch[1];
            
            try {
                // Get contact info before deleting
                const contact = storage.getContact(contactId);
                
                const success = storage.deleteContact(contactId);
                if (!success) {
                    jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                    return;
                }
                
                // Sync with graph - remove from FalkorDB
                try {
                    const { getGraphSync } = require('./sync');
                    const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                    await graphSync.onContactDeleted(contactId, contact?.name, contact?.email);
                } catch (syncErr) {
                    console.log(`[Contacts] Graph sync warning: ${syncErr.message}`);
                }
                
                console.log(`[Contacts] Deleted contact: ${contactId}`);
                jsonResponse(res, { ok: true, message: 'Contact deleted', graphSynced: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/contacts/match - Match names to contacts
        if (pathname === '/api/contacts/match' && req.method === 'POST') {
            const body = await parseBody(req);
            const { names } = body;
            
            if (!names || !Array.isArray(names)) {
                jsonResponse(res, { ok: false, error: 'names array is required' }, 400);
                return;
            }
            
            try {
                const matches = names.map(name => {
                    const contact = storage.findContactByName(name);
                    return {
                        name,
                        matched: !!contact,
                        contact: contact ? {
                            id: contact.id,
                            name: contact.name,
                            role: contact.role,
                            organization: contact.organization
                        } : null
                    };
                });
                
                jsonResponse(res, { 
                    ok: true, 
                    matches,
                    matchedCount: matches.filter(m => m.matched).length,
                    unmatchedCount: matches.filter(m => !m.matched).length
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/unmatched - Get unmatched participants
        if (pathname === '/api/contacts/unmatched' && req.method === 'GET') {
            try {
                const unmatched = storage.getUnmatchedParticipants();
                jsonResponse(res, { ok: true, unmatched, total: unmatched.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/link-participant - Link a participant to an existing contact
        if (pathname === '/api/contacts/link-participant' && req.method === 'POST') {
            const body = await parseBody(req);
            
            if (!body.participantName || !body.contactId) {
                jsonResponse(res, { ok: false, error: 'participantName and contactId are required' }, 400);
                return;
            }
            
            try {
                const result = await storage.linkParticipantToContact(body.participantName, body.contactId);
                
                // Sync with FalkorDB - create alias relationship
                if (result.linked) {
                    try {
                        const graphProvider = storage.getGraphProvider();
                        if (graphProvider && graphProvider.connected) {
                            await graphProvider.query(
                                `MERGE (p:Person {name: $participantName})
                                 WITH p
                                 MATCH (c:Contact {id: $contactId})
                                 MERGE (p)-[:ALIAS_OF]->(c)
                                 SET p.linked_contact_id = $contactId`,
                                { participantName: body.participantName, contactId: body.contactId }
                            );
                        }
                    } catch (syncErr) {
                        console.log(`[Contacts] Graph sync warning: ${syncErr.message}`);
                    }
                }
                
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/find-by-name - Find contact by name or alias (for auto-matching)
        if (pathname === '/api/contacts/find-by-name' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const name = parsedUrl.query.name;
            
            if (!name) {
                jsonResponse(res, { ok: false, error: 'name query parameter is required' }, 400);
                return;
            }
            
            try {
                const contact = storage.findContactByNameOrAlias(name);
                jsonResponse(res, { ok: true, found: !!contact, contact });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/duplicates - Find duplicate contacts
        if (pathname === '/api/contacts/duplicates' && req.method === 'GET') {
            try {
                const duplicates = await storage.findDuplicateContacts();
                jsonResponse(res, { ok: true, duplicates, groups: duplicates.length });
            } catch (error) {
                console.error('[Contacts] Find duplicates error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/sync-from-people - Sync extracted people to contacts
        if (pathname === '/api/contacts/sync-from-people' && req.method === 'POST') {
            try {
                const result = storage.syncPeopleToContacts();
                console.log(`[Contacts] Synced ${result.added} people to contacts`);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/merge - Merge duplicate contacts
        if (pathname === '/api/contacts/merge' && req.method === 'POST') {
            const body = await parseBody(req);
            const { contactIds } = body;
            
            if (!contactIds || !Array.isArray(contactIds) || contactIds.length < 2) {
                jsonResponse(res, { ok: false, error: 'At least 2 contact IDs required' }, 400);
                return;
            }
            
            try {
                const mergedId = await storage.mergeContacts(contactIds);
                if (!mergedId) {
                    jsonResponse(res, { ok: false, error: 'Failed to merge contacts' }, 400);
                    return;
                }
                jsonResponse(res, { ok: true, mergedId });
            } catch (error) {
                console.error('[Contacts] Merge error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/export/json - Export contacts as JSON
        if (pathname === '/api/contacts/export/json' && req.method === 'GET') {
            try {
                const data = storage.exportContactsJSON();
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Disposition': 'attachment; filename="contacts.json"'
                });
                res.end(JSON.stringify(data, null, 2));
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/export/csv - Export contacts as CSV
        if (pathname === '/api/contacts/export/csv' && req.method === 'GET') {
            try {
                const csv = storage.exportContactsCSV();
                res.writeHead(200, {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="contacts.csv"'
                });
                res.end(csv);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/import/json - Import contacts from JSON
        if (pathname === '/api/contacts/import/json' && req.method === 'POST') {
            const body = await parseBody(req);
            
            try {
                const result = storage.importContactsJSON(body);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/import/csv - Import contacts from CSV
        if (pathname === '/api/contacts/import/csv' && req.method === 'POST') {
            const body = await parseBody(req);
            
            if (!body.csv || typeof body.csv !== 'string') {
                jsonResponse(res, { ok: false, error: 'csv content is required' }, 400);
                return;
            }
            
            try {
                const result = storage.importContactsCSV(body.csv);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/:id/relationships - Get contact relationships
        const contactRelMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/relationships$/);
        if (contactRelMatch && req.method === 'GET') {
            const contactId = contactRelMatch[1];
            try {
                const relationships = await storage.getContactRelationships(contactId);
                jsonResponse(res, { ok: true, relationships });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/:id/relationships - Add relationship
        const contactAddRelMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/relationships$/);
        if (contactAddRelMatch && req.method === 'POST') {
            const contactId = contactAddRelMatch[1];
            const body = await parseBody(req);
            
            if (!body.toContactId || !body.type) {
                jsonResponse(res, { ok: false, error: 'toContactId and type are required' }, 400);
                return;
            }
            
            try {
                const relationship = await storage.addContactRelationship(contactId, body.toContactId, body.type, {
                    strength: body.strength,
                    notes: body.notes
                });
                jsonResponse(res, { ok: true, relationship });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/contacts/:id/relationships - Remove relationship
        const contactDelRelMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/relationships$/);
        if (contactDelRelMatch && req.method === 'DELETE') {
            const contactId = contactDelRelMatch[1];
            const body = await parseBody(req);
            
            if (!body.toContactId || !body.type) {
                jsonResponse(res, { ok: false, error: 'toContactId and type are required' }, 400);
                return;
            }
            
            try {
                storage.removeContactRelationship(contactId, body.toContactId, body.type);
                
                // Sync with graph - remove relationship edge from FalkorDB
                try {
                    const contact1 = storage.getContact(contactId);
                    const contact2 = storage.getContact(body.toContactId);
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected && contact1 && contact2) {
                        await graphProvider.query(
                            `MATCH (a:Person {name: $name1})-[r:${body.type.toUpperCase().replace(/\s+/g, '_')}]->(b:Person {name: $name2}) DELETE r`,
                            { name1: contact1.name, name2: contact2.name }
                        );
                    }
                } catch (syncErr) {
                    console.log(`[Contacts] Graph sync relationship warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, graphSynced: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/:id/associations - Get contact with all teams and projects
        const contactAssocMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/associations$/);
        if (contactAssocMatch && req.method === 'GET') {
            const contactId = contactAssocMatch[1];
            try {
                const contactWithAssoc = await storage.getContactWithAssociations(contactId);
                if (!contactWithAssoc) {
                    jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                    return;
                }
                jsonResponse(res, { ok: true, contact: contactWithAssoc });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/:id/teams - Add contact to a team
        const contactAddTeamMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/teams$/);
        if (contactAddTeamMatch && req.method === 'POST') {
            const contactId = contactAddTeamMatch[1];
            const body = await parseBody(req);
            
            if (!body.teamId) {
                jsonResponse(res, { ok: false, error: 'teamId is required' }, 400);
                return;
            }
            
            try {
                await storage.addTeamMember(body.teamId, contactId, body.role, body.isLead);
                
                // Sync with FalkorDB
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        await graphProvider.query(
                            `MATCH (c:Contact {id: $contactId}), (t:Team {id: $teamId})
                             MERGE (c)-[:MEMBER_OF]->(t)`,
                            { contactId, teamId: body.teamId }
                        );
                    } catch (e) {
                        console.log(`[Contacts] Graph sync warning: ${e.message}`);
                    }
                }
                
                jsonResponse(res, { ok: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/contacts/:id/teams/:teamId - Remove contact from a team
        const contactDelTeamMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/teams\/([a-f0-9\-]+)$/);
        if (contactDelTeamMatch && req.method === 'DELETE') {
            const contactId = contactDelTeamMatch[1];
            const teamId = contactDelTeamMatch[2];
            
            try {
                await storage.removeTeamMember(teamId, contactId);
                
                // Sync with FalkorDB
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        await graphProvider.query(
                            `MATCH (c:Contact {id: $contactId})-[r:MEMBER_OF]->(t:Team {id: $teamId})
                             DELETE r`,
                            { contactId, teamId }
                        );
                    } catch (e) {
                        console.log(`[Contacts] Graph sync warning: ${e.message}`);
                    }
                }
                
                jsonResponse(res, { ok: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/contacts/:id/projects - Get contact's projects
        const contactGetProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects$/);
        if (contactGetProjMatch && req.method === 'GET') {
            const contactId = contactGetProjMatch[1];
            try {
                const { data: contactProjects, error } = await storage.supabase
                    .from('contact_projects')
                    .select(`
                        project_id,
                        role,
                        is_primary,
                        projects:project_id(id, name)
                    `)
                    .eq('contact_id', contactId);

                if (error) {
                    console.warn('[Contacts] Error fetching projects:', error.message);
                    jsonResponse(res, { ok: true, projects: [] });
                    return;
                }

                const projects = (contactProjects || []).map(cp => ({
                    id: cp.projects?.id || cp.project_id,
                    name: cp.projects?.name || 'Unknown',
                    role: cp.role,
                    is_primary: cp.is_primary
                }));

                jsonResponse(res, { ok: true, projects });
            } catch (error) {
                console.error('[Contacts] Get projects error:', error);
                jsonResponse(res, { ok: true, projects: [] });
            }
            return;
        }

        // GET /api/contacts/:id/activity - Get contact's activity
        const contactGetActivityMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/activity$/);
        if (contactGetActivityMatch && req.method === 'GET') {
            const contactId = contactGetActivityMatch[1];
            try {
                const { data: activities, error } = await storage.supabase
                    .from('contact_activity')
                    .select('*')
                    .eq('contact_id', contactId)
                    .order('occurred_at', { ascending: false })
                    .limit(50);

                if (error) {
                    console.warn('[Contacts] Error fetching activity:', error.message);
                    jsonResponse(res, { ok: true, activities: [] });
                    return;
                }

                jsonResponse(res, { ok: true, activities: activities || [] });
            } catch (error) {
                console.error('[Contacts] Get activity error:', error);
                jsonResponse(res, { ok: true, activities: [] });
            }
            return;
        }

        // POST /api/contacts/:id/projects/sync - Sync contact project associations
        const contactSyncProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects\/sync$/);
        if (contactSyncProjMatch && req.method === 'POST') {
            const contactId = contactSyncProjMatch[1];
            const body = await parseBody(req);
            const projectIds = body.projectIds || [];
            
            try {
                // Get current project associations
                const { data: currentProjects, error: fetchError } = await storage.supabase
                    .from('contact_projects')
                    .select('project_id')
                    .eq('contact_id', contactId);
                
                if (fetchError) {
                    console.warn('[Contacts] Error fetching current projects:', fetchError.message);
                }
                
                const currentIds = new Set((currentProjects || []).map(p => p.project_id));
                const newIds = new Set(projectIds);
                
                // Find projects to remove
                const toRemove = [...currentIds].filter(id => !newIds.has(id));
                
                // Find projects to add
                const toAdd = [...newIds].filter(id => !currentIds.has(id));
                
                // Remove old associations
                if (toRemove.length > 0) {
                    const { error: deleteError } = await storage.supabase
                        .from('contact_projects')
                        .delete()
                        .eq('contact_id', contactId)
                        .in('project_id', toRemove);
                    
                    if (deleteError) {
                        console.warn('[Contacts] Error removing projects:', deleteError.message);
                    }
                }
                
                // Add new associations
                if (toAdd.length > 0) {
                    const inserts = toAdd.map(projectId => ({
                        contact_id: contactId,
                        project_id: projectId,
                        is_primary: toAdd.indexOf(projectId) === 0 && currentIds.size === 0
                    }));
                    
                    const { error: insertError } = await storage.supabase
                        .from('contact_projects')
                        .insert(inserts);
                    
                    if (insertError) {
                        console.warn('[Contacts] Error adding projects:', insertError.message);
                    }
                }
                
                console.log(`[Contacts] Synced projects for contact ${contactId}: removed ${toRemove.length}, added ${toAdd.length}`);
                jsonResponse(res, { ok: true, removed: toRemove.length, added: toAdd.length });
            } catch (error) {
                console.error('[Contacts] Sync projects error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/:id/projects - Add contact to a project
        const contactAddProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects$/);
        if (contactAddProjMatch && req.method === 'POST') {
            const contactId = contactAddProjMatch[1];
            const body = await parseBody(req);
            
            if (!body.projectId) {
                jsonResponse(res, { ok: false, error: 'projectId is required' }, 400);
                return;
            }
            
            try {
                await storage.addContactToProject(contactId, body.projectId, {
                    role: body.role,
                    isPrimary: body.isPrimary
                });
                jsonResponse(res, { ok: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/contacts/:id/projects/:projectId - Remove contact from a project
        const contactDelProjMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/projects\/([a-f0-9\-]+)$/);
        if (contactDelProjMatch && req.method === 'DELETE') {
            const contactId = contactDelProjMatch[1];
            const projectId = contactDelProjMatch[2];
            
            try {
                await storage.removeContactFromProject(contactId, projectId);
                jsonResponse(res, { ok: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== Email Processing API ====================
        
        const emailParser = require('./emailParser');

        // GET /api/emails - List emails for current project
        if (pathname === '/api/emails' && req.method === 'GET') {
            try {
                const emailUrl = new URL(req.url, `http://${req.headers.host}`);
                const requiresResponse = emailUrl.searchParams.get('requires_response');
                const direction = emailUrl.searchParams.get('direction');
                const limit = parseInt(emailUrl.searchParams.get('limit') || '50');
                
                const emails = await storage.getEmails({
                    requiresResponse: requiresResponse === 'true' ? true : (requiresResponse === 'false' ? false : undefined),
                    direction: direction || undefined,
                    limit
                });
                
                jsonResponse(res, { ok: true, emails, count: emails.length });
            } catch (error) {
                console.error('[API] Error fetching emails:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/emails/:id - Get single email
        const emailGetMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)$/);
        if (emailGetMatch && req.method === 'GET') {
            const emailId = emailGetMatch[1];
            try {
                const email = await storage.getEmail(emailId);
                if (!email) {
                    jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                    return;
                }
                const recipients = await storage.getEmailRecipients(emailId);
                jsonResponse(res, { ok: true, email, recipients });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/emails - Process a new email (paste or .eml upload)
        if (pathname === '/api/emails' && req.method === 'POST') {
            console.log('[Email API] POST /api/emails received');
            try {
                const body = await parseBody(req);
                console.log('[Email API] Body parsed, keys:', Object.keys(body));
                
                let parsedEmail;
                
                // Check if it's an .eml file upload (base64 encoded)
                if (body.emlBase64) {
                    const buffer = Buffer.from(body.emlBase64, 'base64');
                    parsedEmail = await emailParser.parseEmlFile(buffer);
                    parsedEmail.source_type = 'eml_upload';
                    parsedEmail.original_filename = body.filename || 'email.eml';
                }
                // Or a .msg file upload (Outlook format, base64 encoded)
                else if (body.msgBase64) {
                    const buffer = Buffer.from(body.msgBase64, 'base64');
                    parsedEmail = await emailParser.parseMsgFile(buffer);
                    parsedEmail.source_type = 'msg_upload';
                    parsedEmail.original_filename = body.filename || 'email.msg';
                }
                // Or a manual paste
                else if (body.emailText) {
                    parsedEmail = emailParser.parseManualEmail(body.emailText);
                    parsedEmail.source_type = 'paste';
                }
                // Or structured fields
                else if (body.from || body.from_email) {
                    parsedEmail = {
                        from: body.from || { email: body.from_email, name: body.from_name },
                        to: body.to || [],
                        cc: body.cc || [],
                        subject: body.subject || '',
                        date: body.date || body.date_sent || null,
                        text: body.body || body.body_text || '',
                        source_type: 'api'
                    };
                } else {
                    jsonResponse(res, { ok: false, error: 'Either emlBase64, msgBase64, emailText, or structured fields required' }, 400);
                    return;
                }

                // Generate content hash for duplicate detection
                const crypto = require('crypto');
                const hashContent = [
                    parsedEmail.from?.email || '',
                    parsedEmail.subject || '',
                    (parsedEmail.text || '').substring(0, 1000), // First 1000 chars of body
                    parsedEmail.date || ''
                ].join('|');
                const contentHash = crypto.createHash('md5').update(hashContent).digest('hex');
                parsedEmail.content_hash = contentHash;
                
                // Check for duplicate
                const existingEmail = await storage.findEmailByHash(contentHash);
                if (existingEmail) {
                    console.log('[Email API] Duplicate email detected, hash:', contentHash);
                    jsonResponse(res, { 
                        ok: false, 
                        error: 'This email has already been processed',
                        duplicate: true,
                        existingId: existingEmail.id
                    }, 409);
                    return;
                }
                
                // Save email to database
                console.log('[Email API] Saving email to database...');
                const savedEmail = await storage.saveEmail(parsedEmail);
                console.log('[Email API] Email saved with ID:', savedEmail?.id);
                
                // Match/create contacts for sender and recipients
                const contactMatches = {
                    sender: null,
                    recipients: [],
                    newContacts: []
                };

                // Match sender
                if (parsedEmail.from?.email) {
                    let senderContact = await storage.findContactByEmail(parsedEmail.from.email);
                    if (!senderContact && parsedEmail.from?.name) {
                        senderContact = await storage.findContactByName(parsedEmail.from.name);
                    }
                    
                    if (senderContact) {
                        contactMatches.sender = { contact: senderContact, isNew: false };
                        // Link sender to email
                        await storage.updateEmail(savedEmail.id, { sender_contact_id: senderContact.id });
                    } else {
                        // Create new contact from signature data or basic info
                        const sigContact = parsedEmail.extractedContacts?.[0] || {};
                        const newContact = await storage.createContactFromEmail({
                            name: parsedEmail.from.name || parsedEmail.from.email,
                            email: parsedEmail.from.email,
                            phone: sigContact.phone || null,
                            role: sigContact.role || null,
                            organization: sigContact.organization || null,
                            location: sigContact.location || null,
                            source: `Email: ${parsedEmail.subject}`
                        });
                        contactMatches.sender = { contact: newContact, isNew: true };
                        contactMatches.newContacts.push(newContact);
                        await storage.updateEmail(savedEmail.id, { sender_contact_id: newContact.id });
                    }
                }

                // Match recipients
                const allRecipients = [
                    ...(parsedEmail.to || []).map(r => ({ ...r, type: 'to' })),
                    ...(parsedEmail.cc || []).map(r => ({ ...r, type: 'cc' }))
                ];

                for (const recipient of allRecipients) {
                    let recipientContact = null;
                    
                    if (recipient.email) {
                        recipientContact = await storage.findContactByEmail(recipient.email);
                    }
                    if (!recipientContact && recipient.name) {
                        recipientContact = await storage.findContactByName(recipient.name);
                    }

                    if (recipientContact) {
                        contactMatches.recipients.push({ contact: recipientContact, type: recipient.type, isNew: false });
                        await storage.addEmailRecipient(savedEmail.id, {
                            contact_id: recipientContact.id,
                            email: recipient.email,
                            name: recipient.name,
                            type: recipient.type
                        });
                    } else if (recipient.email || recipient.name) {
                        // Create new contact
                        const newContact = await storage.createContactFromEmail({
                            name: recipient.name || recipient.email || 'Unknown',
                            email: recipient.email || null,
                            source: `Email recipient: ${parsedEmail.subject}`
                        });
                        contactMatches.recipients.push({ contact: newContact, type: recipient.type, isNew: true });
                        contactMatches.newContacts.push(newContact);
                        await storage.addEmailRecipient(savedEmail.id, {
                            contact_id: newContact.id,
                            email: recipient.email,
                            name: recipient.name,
                            type: recipient.type
                        });
                    }
                }

                // Analyze email with AI
                let aiAnalysis = null;
                let extractedEntities = { facts: 0, decisions: 0, risks: 0, actions: 0, questions: 0, people: 0 };
                const emailTextCfg = llmConfig.getTextConfig(config);
                const llmProvider = emailTextCfg.provider;
                const model = emailTextCfg.model;
                
                console.log('[Email API] LLM config:', { provider: llmProvider, model: model });
                
                if (llmProvider && model) {
                    try {
                        // Get Supabase prompt and v1.6 context variables
                        const promptsService = require('./supabase/prompts');
                        const supabasePrompt = promptsService.getPrompt('email')?.prompt_template || null;
                        const contextVariables = savedEmail.project_id 
                            ? await promptsService.buildContextVariables(savedEmail.project_id, 4000)
                            : {};
                        
                        // Get custom prompt from config if set (fallback)
                        const customEmailPrompt = config.prompts?.email || null;
                        const analysisPrompt = emailParser.buildEmailAnalysisPrompt(parsedEmail, {
                            customPrompt: customEmailPrompt,
                            ontologyMode: !customEmailPrompt,
                            supabasePrompt: supabasePrompt,
                            contextVariables: contextVariables
                        });
                        const providerConfig = config.llm?.providers?.[llmProvider] || {};
                        
                        const result = await llm.generateText({
                            provider: llmProvider,
                            model: model,
                            prompt: analysisPrompt,
                            temperature: 0.3,
                            maxTokens: 2500,
                            context: 'email',
                            providerConfig: providerConfig
                        });

                        if (result.success) {
                            try {
                                // Parse JSON response
                                let jsonText = result.text || result.response || '';
                                // Extract JSON from response
                                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    aiAnalysis = JSON.parse(jsonMatch[0]);
                                    
                                    // Update email with analysis
                                    await storage.updateEmail(savedEmail.id, {
                                        extracted_entities: aiAnalysis,
                                        ai_summary: aiAnalysis.summary,
                                        detected_intent: aiAnalysis.intent,
                                        sentiment: aiAnalysis.sentiment,
                                        requires_response: aiAnalysis.requires_response || false,
                                        processed_at: new Date().toISOString()
                                    });

                                    // Persist extracted entities to database
                                    const sourceRef = `Email: ${parsedEmail.subject || savedEmail.id}`;
                                    
                                    // Save Facts
                                    if (aiAnalysis.facts && Array.isArray(aiAnalysis.facts)) {
                                        for (const fact of aiAnalysis.facts) {
                                            try {
                                                await storage.addFact({
                                                    content: fact.content,
                                                    category: fact.category || 'general',
                                                    source: sourceRef,
                                                    source_document_id: null,
                                                    source_email_id: savedEmail.id,
                                                    confidence: typeof fact.confidence === 'number' ? fact.confidence : 0.8
                                                });
                                                extractedEntities.facts++;
                                            } catch (e) {
                                                console.error('[Email] Failed to save fact:', e.message);
                                            }
                                        }
                                    }

                                    // Save Decisions
                                    if (aiAnalysis.decisions && Array.isArray(aiAnalysis.decisions)) {
                                        for (const decision of aiAnalysis.decisions) {
                                            try {
                                                await storage.addDecision({
                                                    content: decision.content,
                                                    owner: decision.owner || null,
                                                    date: decision.date || new Date().toISOString().split('T')[0],
                                                    status: decision.status || 'made',
                                                    source: sourceRef,
                                                    source_email_id: savedEmail.id
                                                });
                                                extractedEntities.decisions++;
                                            } catch (e) {
                                                console.error('[Email] Failed to save decision:', e.message);
                                            }
                                        }
                                    }

                                    // Save Risks
                                    if (aiAnalysis.risks && Array.isArray(aiAnalysis.risks)) {
                                        for (const risk of aiAnalysis.risks) {
                                            try {
                                                await storage.addRisk({
                                                    content: risk.content,
                                                    impact: risk.impact || 'Medium',
                                                    likelihood: risk.likelihood || 'Medium',
                                                    mitigation: risk.mitigation || null,
                                                    status: 'open',
                                                    source: sourceRef,
                                                    source_email_id: savedEmail.id
                                                });
                                                extractedEntities.risks++;
                                            } catch (e) {
                                                console.error('[Email] Failed to save risk:', e.message);
                                            }
                                        }
                                    }

                                    // Save Action Items
                                    if (aiAnalysis.action_items && Array.isArray(aiAnalysis.action_items)) {
                                        for (const action of aiAnalysis.action_items) {
                                            try {
                                                await storage.addActionItem({
                                                    content: action.task,
                                                    task: action.task,
                                                    owner: action.owner || null,
                                                    deadline: action.deadline || null,
                                                    priority: action.priority || 'medium',
                                                    status: action.status || 'pending',
                                                    source: sourceRef,
                                                    source_email_id: savedEmail.id
                                                });
                                                extractedEntities.actions++;
                                            } catch (e) {
                                                console.error('[Email] Failed to save action item:', e.message);
                                            }
                                        }
                                    }

                                    // Save Questions
                                    if (aiAnalysis.questions && Array.isArray(aiAnalysis.questions)) {
                                        for (const question of aiAnalysis.questions) {
                                            try {
                                                await storage.addKnowledgeQuestion({
                                                    content: question.content,
                                                    context: question.context || sourceRef,
                                                    priority: question.priority || 'medium',
                                                    status: 'open',
                                                    assignee: question.assignee || null,
                                                    source: sourceRef,
                                                    source_email_id: savedEmail.id
                                                });
                                                extractedEntities.questions++;
                                            } catch (e) {
                                                console.error('[Email] Failed to save question:', e.message);
                                            }
                                        }
                                    }

                                    // Save People
                                    if (aiAnalysis.people && Array.isArray(aiAnalysis.people)) {
                                        for (const person of aiAnalysis.people) {
                                            try {
                                                // Check if contact already exists
                                                let existingContact = null;
                                                if (person.email) {
                                                    existingContact = await storage.findContactByEmail(person.email);
                                                }
                                                if (!existingContact && person.name) {
                                                    existingContact = await storage.findContactByName(person.name);
                                                }
                                                
                                                if (!existingContact && person.name) {
                                                    await storage.createContactFromEmail({
                                                        name: person.name,
                                                        email: person.email || null,
                                                        role: person.role || null,
                                                        organization: person.organization || null,
                                                        phone: person.phone || null,
                                                        source: sourceRef
                                                    });
                                                    extractedEntities.people++;
                                                }
                                            } catch (e) {
                                                console.error('[Email] Failed to save person:', e.message);
                                            }
                                        }
                                    }

                                    console.log(`[Email] Extracted entities: ${JSON.stringify(extractedEntities)}`);
                                }
                            } catch (parseError) {
                                console.error('[Email] Failed to parse AI analysis:', parseError.message);
                            }
                        }
                    } catch (aiError) {
                        console.error('[Email] AI analysis failed:', aiError.message);
                    }
                } else {
                    console.log('[Email API] Skipping AI analysis - no LLM configured');
                }

                // Sync to graph
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        const { getGraphSync } = require('./sync');
                        const graphSync = getGraphSync({ graphProvider, storage });
                        
                        // Get current project from storage
                        const projectInfo = storage.getCurrentProject ? storage.getCurrentProject() : null;
                        const projectId = projectInfo?.id || storage.getProjectId?.() || null;
                        const projectName = projectInfo?.name || config.projectName || 'Default';
                        
                        const updatedEmail = await storage.getEmail(savedEmail.id);
                        await graphSync.syncEmail(updatedEmail, projectId, projectName);
                        
                        // Link extracted entities to graph
                        if (aiAnalysis) {
                            await graphSync.linkEmailToEntities(savedEmail.id, aiAnalysis);
                        }
                        
                        console.log('[Email] Synced to graph successfully');
                    }
                } catch (graphError) {
                    console.error('[Email] Graph sync failed:', graphError.message);
                }

                const finalEmail = await storage.getEmail(savedEmail.id);
                
                jsonResponse(res, {
                    ok: true,
                    email: finalEmail,
                    contacts: contactMatches,
                    analysis: aiAnalysis,
                    extractedEntities: extractedEntities,
                    parsed: {
                        from: parsedEmail.from,
                        to: parsedEmail.to,
                        cc: parsedEmail.cc,
                        subject: parsedEmail.subject,
                        hasSignature: !!parsedEmail.signature
                    }
                });
            } catch (error) {
                console.error('[API] Email processing error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/emails/:id - Delete an email
        const emailDeleteMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)$/);
        if (emailDeleteMatch && req.method === 'DELETE') {
            const emailId = emailDeleteMatch[1];
            try {
                const success = await storage.deleteEmail(emailId);
                jsonResponse(res, { ok: success });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/emails/:id/response - Generate draft response
        const emailResponseMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/response$/);
        if (emailResponseMatch && req.method === 'POST') {
            const emailId = emailResponseMatch[1];
            
            try {
                const email = await storage.getEmail(emailId);
                if (!email) {
                    jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                    return;
                }

                const emailTextCfg = llmConfig.getTextConfig(config);
                const llmProvider = emailTextCfg.provider;
                const model = emailTextCfg.model;
                
                if (!llmProvider || !model) {
                    jsonResponse(res, { ok: false, error: 'No LLM configured. Please configure an LLM in Settings.' }, 400);
                    return;
                }

                console.log('[Email Response] Generating draft with:', { provider: llmProvider, model });

                // Gather project context
                const facts = storage.getFacts().slice(0, 10);
                const questions = storage.getQuestions().filter(q => q.status !== 'resolved').slice(0, 5);
                const decisions = storage.getDecisions().slice(0, 5);
                
                const responsePrompt = emailParser.buildResponsePrompt(email, { facts, questions, decisions });
                const providerConfig = config.llm?.providers?.[llmProvider] || {};
                
                const result = await llm.generateText({
                    provider: llmProvider,
                    model: model,
                    prompt: responsePrompt,
                    temperature: 0.7,
                    maxTokens: 1000,
                    context: 'email_draft',
                    providerConfig: providerConfig
                });

                if (result.success) {
                    const draftResponse = result.text || result.response || '';
                    
                    // Save draft to database
                    await storage.updateEmail(emailId, {
                        draft_response: draftResponse,
                        draft_generated_at: new Date().toISOString(),
                        response_drafted: true
                    });
                    
                    jsonResponse(res, {
                        ok: true,
                        draft: draftResponse,
                        email: await storage.getEmail(emailId)
                    });
                } else {
                    jsonResponse(res, { ok: false, error: 'Failed to generate response' }, 500);
                }
            } catch (error) {
                console.error('[API] Response generation error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/emails/:id/mark-responded - Mark email as responded
        const emailMarkRespondedMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)\/mark-responded$/);
        if (emailMarkRespondedMatch && req.method === 'POST') {
            const emailId = emailMarkRespondedMatch[1];
            
            try {
                await storage.updateEmail(emailId, {
                    response_sent: true,
                    requires_response: false
                });
                
                jsonResponse(res, { ok: true, message: 'Email marked as responded' });
            } catch (error) {
                console.error('[API] Mark responded error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/emails/sync-graph - Re-sync all emails to graph database
        if (pathname === '/api/emails/sync-graph' && req.method === 'POST') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider || !graphProvider.connected) {
                    jsonResponse(res, { ok: false, error: 'Graph database not connected' }, 400);
                    return;
                }
                
                const { getGraphSync } = require('./sync');
                const graphSync = getGraphSync({ graphProvider, storage });
                
                const projectInfo = storage.getCurrentProject ? storage.getCurrentProject() : null;
                const projectId = projectInfo?.id || storage.getProjectId?.() || null;
                const projectName = projectInfo?.name || config.projectName || 'Default';
                
                const emails = await storage.getEmails({ limit: 100 });
                let synced = 0;
                let errors = 0;
                
                for (const email of emails) {
                    try {
                        await graphSync.syncEmail(email, projectId, projectName);
                        synced++;
                    } catch (e) {
                        console.error(`[Email Sync] Failed to sync email ${email.id}:`, e.message);
                        errors++;
                    }
                }
                
                console.log(`[Email Sync] Completed: ${synced} synced, ${errors} errors`);
                jsonResponse(res, { ok: true, synced, errors, total: emails.length });
            } catch (error) {
                console.error('[API] Email sync error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/emails/needing-response - Get emails that need responses
        if (pathname === '/api/emails/needing-response' && req.method === 'GET') {
            try {
                const emails = await storage.getEmailsNeedingResponse();
                jsonResponse(res, { ok: true, emails, count: emails.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== Teams API ====================

        // POST /api/teams - Create team
        if (pathname === '/api/teams' && req.method === 'POST') {
            const body = await parseBody(req);
            
            if (!body.name) {
                jsonResponse(res, { ok: false, error: 'name is required' }, 400);
                return;
            }
            
            try {
                const id = await storage.addTeam(body);
                
                // Sync with FalkorDB - create Team node
                let graphSynced = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        await graphProvider.query(
                            `MERGE (t:Team {id: $id})
                             SET t.name = $name,
                                 t.description = $description,
                                 t.color = $color,
                                 t.team_type = $team_type,
                                 t.created_at = datetime(),
                                 t.entity_type = 'Team'`,
                            { 
                                id: id,
                                name: body.name,
                                description: body.description || '',
                                color: body.color || '#3b82f6',
                                team_type: body.team_type || 'team'
                            }
                        );
                        graphSynced = true;
                        console.log(`[Teams] Synced team "${body.name}" to FalkorDB`);
                    }
                } catch (syncErr) {
                    console.log(`[Teams] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, id, graphSynced });
            } catch (error) {
                // Return 400 for duplicate name errors
                const status = error.message?.includes('already exists') ? 400 : 500;
                jsonResponse(res, { ok: false, error: error.message }, status);
            }
            return;
        }

        // GET /api/timezones - Get all timezones from database
        if (pathname === '/api/timezones' && req.method === 'GET') {
            try {
                const timezones = await storage.getTimezones();
                jsonResponse(res, { ok: true, timezones, total: timezones.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/timezones/grouped - Get timezones grouped by region
        if (pathname === '/api/timezones/grouped' && req.method === 'GET') {
            try {
                const grouped = await storage.getTimezonesGrouped();
                jsonResponse(res, { ok: true, timezones: grouped });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/teams - List teams
        if (pathname === '/api/teams' && req.method === 'GET') {
            try {
                const teams = await storage.getTeams();
                // Add member count to each team (from members array or team_members)
                const teamsWithCounts = teams.map(t => ({
                    ...t,
                    memberCount: t.members?.length || 0,
                    // Include member details for UI
                    memberDetails: (t.members || []).map(m => ({
                        contactId: m.contact_id || m.contactId,
                        name: m.contact?.name || m.name,
                        role: m.role,
                        isLead: m.is_lead
                    }))
                }));
                jsonResponse(res, { ok: true, teams: teamsWithCounts });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/teams/:id - Get team with members
        const teamGetMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)$/);
        if (teamGetMatch && req.method === 'GET') {
            const teamId = teamGetMatch[1];
            try {
                const team = await storage.getTeamById(teamId);
                if (!team) {
                    jsonResponse(res, { ok: false, error: 'Team not found' }, 404);
                    return;
                }
                const members = storage.getContactsByTeam(teamId);
                jsonResponse(res, { ok: true, team, members });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // PUT /api/teams/:id - Update team
        const teamPutMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)$/);
        if (teamPutMatch && req.method === 'PUT') {
            const teamId = teamPutMatch[1];
            const body = await parseBody(req);
            
            try {
                const success = await storage.updateTeam(teamId, body);
                if (!success) {
                    jsonResponse(res, { ok: false, error: 'Team not found' }, 404);
                    return;
                }
                
                // Sync with FalkorDB - update Team node
                let graphSynced = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        const updates = [];
                        const params = { id: teamId };
                        if (body.name) { updates.push('t.name = $name'); params.name = body.name; }
                        if (body.description !== undefined) { updates.push('t.description = $description'); params.description = body.description; }
                        if (body.color) { updates.push('t.color = $color'); params.color = body.color; }
                        if (body.team_type) { updates.push('t.team_type = $team_type'); params.team_type = body.team_type; }
                        
                        if (updates.length > 0) {
                            await graphProvider.query(
                                `MATCH (t:Team {id: $id}) SET ${updates.join(', ')}, t.updated_at = datetime()`,
                                params
                            );
                            graphSynced = true;
                        }
                    }
                } catch (syncErr) {
                    console.log(`[Teams] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, graphSynced });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/teams/:id - Delete team
        const teamDeleteMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)$/);
        if (teamDeleteMatch && req.method === 'DELETE') {
            const teamId = teamDeleteMatch[1];
            
            try {
                // Get team info before deleting
                const team = await storage.getTeam(teamId);
                
                const success = await storage.deleteTeam(teamId);
                if (!success) {
                    jsonResponse(res, { ok: false, error: 'Team not found' }, 404);
                    return;
                }
                
                // Sync with graph - remove Team from FalkorDB
                try {
                    const { getGraphSync } = require('./sync');
                    const graphSync = getGraphSync({ graphProvider: storage.getGraphProvider() });
                    // Delete team node
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        await graphProvider.query(
                            'MATCH (t:Team) WHERE t.id = $id OR t.name = $name DETACH DELETE t',
                            { id: teamId, name: team?.name }
                        );
                    }
                } catch (syncErr) {
                    console.log(`[Teams] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, graphSynced: true });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/teams/:id/members - Add member to team
        const teamAddMemberMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)\/members$/);
        if (teamAddMemberMatch && req.method === 'POST') {
            const teamId = teamAddMemberMatch[1];
            const body = await parseBody(req);
            
            if (!body.contactId) {
                jsonResponse(res, { ok: false, error: 'contactId is required' }, 400);
                return;
            }
            
            try {
                const result = await storage.addTeamMember(teamId, body.contactId, body.role, body.isLead);
                
                // Sync with FalkorDB - create MEMBER_OF relationship
                let graphSynced = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        // Get team and contact info for graph
                        const team = await storage.getTeamById(teamId);
                        const contact = storage.getContactById(body.contactId);
                        
                        // Create or update Contact node and MEMBER_OF relationship
                        await graphProvider.query(
                            `MERGE (c:Contact {id: $contactId})
                             SET c.name = $contactName, c.entity_type = 'Contact'
                             WITH c
                             MATCH (t:Team {id: $teamId})
                             MERGE (c)-[r:MEMBER_OF]->(t)
                             SET r.role = $role, r.is_lead = $isLead, r.created_at = datetime()`,
                            {
                                contactId: body.contactId,
                                contactName: contact?.name || 'Unknown',
                                teamId: teamId,
                                role: body.role || null,
                                isLead: body.isLead || false
                            }
                        );
                        graphSynced = true;
                        console.log(`[Teams] Member "${contact?.name}" added to team "${team?.name}" in FalkorDB`);
                    }
                } catch (syncErr) {
                    console.log(`[Teams] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, member: result, graphSynced });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/teams/:teamId/members/:contactId - Remove member from team
        const teamRemoveMemberMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)\/members\/([a-f0-9\-]+)$/);
        if (teamRemoveMemberMatch && req.method === 'DELETE') {
            const teamId = teamRemoveMemberMatch[1];
            const contactId = teamRemoveMemberMatch[2];
            
            try {
                await storage.removeTeamMember(teamId, contactId);
                
                // Sync with FalkorDB - remove MEMBER_OF relationship
                let graphSynced = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        await graphProvider.query(
                            `MATCH (c:Contact {id: $contactId})-[r:MEMBER_OF]->(t:Team {id: $teamId})
                             DELETE r`,
                            { contactId, teamId }
                        );
                        graphSynced = true;
                        console.log(`[Teams] Member removed from team in FalkorDB`);
                    }
                } catch (syncErr) {
                    console.log(`[Teams] Graph sync warning: ${syncErr.message}`);
                }
                
                jsonResponse(res, { ok: true, graphSynced });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/teams/:id/members - Get team members
        const teamGetMembersMatch = pathname.match(/^\/api\/teams\/([a-f0-9\-]+)\/members$/);
        if (teamGetMembersMatch && req.method === 'GET') {
            const teamId = teamGetMembersMatch[1];
            
            try {
                const members = await storage.getTeamMembers(teamId);
                jsonResponse(res, { ok: true, members, total: members.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/contacts/:id/enrich - AI enrichment for contact
        const contactEnrichMatch = pathname.match(/^\/api\/contacts\/([a-f0-9\-]+)\/enrich$/);
        if (contactEnrichMatch && req.method === 'POST') {
            const contactId = contactEnrichMatch[1];
            
            try {
                const contact = storage.getContactById(contactId);
                if (!contact) {
                    jsonResponse(res, { ok: false, error: 'Contact not found' }, 404);
                    return;
                }
                
                // Get context from activity
                const activityContext = (contact.activity || [])
                    .slice(0, 10)
                    .map(a => `${a.type}: ${a.title}`)
                    .join('\n');
                
                const prompt = `Based on the following information about a contact and their activities, suggest any additional details I should add to complete their profile.

Contact:
- Name: ${contact.name}
- Email: ${contact.email || 'Unknown'}
- Role: ${contact.role || 'Unknown'}
- Organization: ${contact.organization || 'Unknown'}
- Department: ${contact.department || 'Unknown'}
- Notes: ${contact.notes || 'None'}

Recent activity:
${activityContext || 'No activity recorded'}

Provide suggestions in this format:
ROLE_SUGGESTION: <suggested role if unknown>
DEPARTMENT_SUGGESTION: <suggested department if unknown>
TAGS_SUGGESTION: <comma-separated suggested tags>
NOTES_SUGGESTION: <additional notes to add>`;

                const aiResponse = await llm.generateText(prompt);
                
                // Parse suggestions
                const suggestions = {};
                const roleMatch = aiResponse.match(/ROLE_SUGGESTION:\s*(.+)/);
                const deptMatch = aiResponse.match(/DEPARTMENT_SUGGESTION:\s*(.+)/);
                const tagsMatch = aiResponse.match(/TAGS_SUGGESTION:\s*(.+)/);
                const notesMatch = aiResponse.match(/NOTES_SUGGESTION:\s*(.+)/);
                
                if (roleMatch && !contact.role) suggestions.role = roleMatch[1].trim();
                if (deptMatch && !contact.department) suggestions.department = deptMatch[1].trim();
                if (tagsMatch) suggestions.tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
                if (notesMatch) suggestions.additionalNotes = notesMatch[1].trim();
                
                jsonResponse(res, { ok: true, suggestions, rawResponse: aiResponse });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== Cost Tracking API ====================

        // GET /api/costs/summary?period=day|week|month|all - Get period-filtered cost summary (CostSummary shape)
        if (pathname === '/api/costs/summary' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url || '');
                const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
                if (projectId && storage._supabase) storage._supabase.setProject(projectId);
                const period = (parsedUrl.query?.period || 'month').toLowerCase();
                const validPeriod = ['day', 'week', 'month', 'all'].includes(period) ? period : 'month';
                const summary = await llm.costTracker.getSummaryForPeriod(validPeriod);
                jsonResponse(res, summary);
            } catch (e) {
                console.error('[Costs] Error getting summary for period:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }
        
        // GET /api/costs - Get cost summary
        if (pathname === '/api/costs' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url || '');
                const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
                if (projectId && storage._supabase) storage._supabase.setProject(projectId);
                const summary = await llm.costTracker.getSummary();
                
                // Also get recent requests from storage
                if (storage._supabase) {
                    try {
                        const recentRequests = await storage._supabase.getRecentLLMRequests(20);
                        summary.recentRequests = recentRequests || [];
                    } catch (e) {
                        console.warn('[Costs] Could not get recent requests:', e.message);
                        summary.recentRequests = [];
                    }
                }
                
                jsonResponse(res, summary);
            } catch (e) {
                console.error('[Costs] Error getting summary:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }
        
        // GET /api/costs/recent - Get recent LLM requests for dashboard
        if (pathname === '/api/costs/recent' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url || '');
                const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
                if (projectId && storage._supabase) storage._supabase.setProject(projectId);
                const limit = Math.min(parseInt(parsedUrl.query?.limit || '20', 10) || 20, 100);
                const requests = storage._supabase
                    ? await storage._supabase.getRecentLLMRequests(limit)
                    : [];
                jsonResponse(res, { requests });
            } catch (e) {
                console.error('[Costs] Error getting recent requests:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/costs/models - Get detailed model stats
        if (pathname === '/api/costs/models' && req.method === 'GET') {
            try {
                const modelStats = await llm.costTracker.getModelStats();
                jsonResponse(res, { models: modelStats });
            } catch (e) {
                console.error('[Costs] Error getting model stats:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }
        
        // GET /api/costs/pricing - Get pricing table
        if (pathname === '/api/costs/pricing' && req.method === 'GET') {
            const { MODEL_PRICING } = require('./llm/costTracker');
            const pricing = Object.entries(MODEL_PRICING).map(([model, prices]) => ({
                model,
                inputPer1M: prices.input,
                outputPer1M: prices.output
            }));
            jsonResponse(res, { pricing });
            return;
        }
        
        // GET /api/costs/export?period=month&format=csv|json - Export cost data
        if (pathname === '/api/costs/export' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url || '');
                const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
                if (projectId && storage._supabase) storage._supabase.setProject(projectId);
                const period = (parsedUrl.query?.period || 'month').toLowerCase();
                const format = (parsedUrl.query?.format || 'json').toLowerCase();
                const validPeriod = ['day', 'week', 'month', 'all'].includes(period) ? period : 'month';
                const validFormat = ['csv', 'json'].includes(format) ? format : 'json';
                const summary = await llm.costTracker.getSummaryForPeriod(validPeriod);
                const filename = `llm-costs-${validPeriod}-${new Date().toISOString().split('T')[0]}`;
                if (validFormat === 'csv') {
                    const rows = [
                        ['Period', summary.period.start, summary.period.end],
                        ['Total Cost (USD)', String(summary.total)],
                        ['Total Input Tokens', String(summary.totalInputTokens || 0)],
                        ['Total Output Tokens', String(summary.totalOutputTokens || 0)],
                        [],
                        ['Daily Breakdown', 'Date', 'Cost', 'Calls'],
                        ...(summary.dailyBreakdown || []).map(d => ['', d.date, String(d.cost), String(d.calls)]),
                        [],
                        ['By Provider', 'Provider', 'Cost'],
                        ...Object.entries(summary.byProvider || {}).map(([k, v]) => ['', k, String(v)]),
                        [],
                        ['By Model', 'Model', 'Cost'],
                        ...Object.entries(summary.byModel || {}).map(([k, v]) => ['', k, String(v)]),
                        [],
                        ['By Context', 'Context', 'Cost'],
                        ...Object.entries(summary.byContext || {}).map(([k, v]) => ['', k, String(v)])
                    ];
                    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                    res.writeHead(200, {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="${filename}.csv"`
                    });
                    res.end('\uFEFF' + csv);
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="${filename}.json"`
                    });
                    res.end(JSON.stringify(summary, null, 2));
                }
            } catch (e) {
                console.error('[Costs] Export error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/costs/budget - Get budget config for period
        if (pathname === '/api/costs/budget' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url || '');
                const projectId = parsedUrl.query?.project_id || req.headers['x-project-id'];
                if (projectId && storage._supabase) storage._supabase.setProject(projectId);
                const period = (parsedUrl.query?.period || 'month').toLowerCase();
                const validPeriod = ['week', 'month'].includes(period) ? period : 'month';
                const budget = storage._supabase
                    ? await storage._supabase.getLLMBudget(validPeriod)
                    : null;
                jsonResponse(res, { budget });
            } catch (e) {
                console.error('[Costs] Error getting budget:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/costs/budget - Set budget for period
        if (pathname === '/api/costs/budget' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
                if (projectId && storage._supabase) storage._supabase.setProject(projectId);
                const period = (body?.period || 'month').toLowerCase();
                const validPeriod = ['week', 'month'].includes(period) ? period : 'month';
                const limitUsd = parseFloat(body?.limit_usd ?? body?.limitUsd);
                const alertThreshold = (body?.alert_threshold_percent ?? body?.alertThresholdPercent) != null
                    ? Math.min(100, Math.max(0, parseInt(String(body.alert_threshold_percent ?? body.alertThresholdPercent), 10)))
                    : 80;
                if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
                    jsonResponse(res, { error: 'Invalid limit_usd' }, 400);
                    return;
                }
                const budget = storage._supabase
                    ? await storage._supabase.setLLMBudget(validPeriod, limitUsd, alertThreshold)
                    : null;
                jsonResponse(res, { success: true, budget });
            } catch (e) {
                console.error('[Costs] Error setting budget:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/costs/reset - Reset cost tracking
        if (pathname === '/api/costs/reset' && req.method === 'POST') {
            llm.costTracker.reset();
            jsonResponse(res, { success: true, message: 'Cost tracking reset' });
            return;
        }

        // ==================== Billing API (Project Cost Control) ====================
        
        // Helper function to check superadmin status
        async function checkSuperAdmin(req, res) {
            console.log('[Billing] checkSuperAdmin called');
            if (!supabase || !supabase.isConfigured()) {
                console.log('[Billing] Supabase not configured');
                jsonResponse(res, { error: 'Database not configured' }, 503);
                return false;
            }
            const authResult = await supabase.auth.verifyRequest(req);
            console.log('[Billing] Auth result:', authResult.authenticated, authResult.user?.id);
            if (!authResult.authenticated) {
                console.log('[Billing] Not authenticated');
                jsonResponse(res, { error: 'Authentication required' }, 401);
                return false;
            }
            const isSuperAdmin = await supabase.auth.isSuperAdmin(authResult.user.id);
            console.log('[Billing] isSuperAdmin:', isSuperAdmin);
            if (!isSuperAdmin) {
                jsonResponse(res, { error: 'Superadmin access required' }, 403);
                return false;
            }
            return authResult.user;
        }
        
        // GET /api/admin/billing/projects - Get all projects billing overview (superadmin)
        if (pathname === '/api/admin/billing/projects' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const billing = require('./supabase/billing');
                const projects = await billing.getAllProjectsBilling();
                jsonResponse(res, { success: true, projects });
            } catch (error) {
                console.error('[API] Error getting all projects billing:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/admin/billing/pricing - Get global pricing config (superadmin)
        if (pathname === '/api/admin/billing/pricing' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const billing = require('./supabase/billing');
                const config = await billing.getGlobalPricingConfig();
                jsonResponse(res, { success: true, config });
            } catch (error) {
                console.error('[API] Error getting global pricing config:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/admin/billing/pricing - Set global pricing config (superadmin)
        if (pathname === '/api/admin/billing/pricing' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const body = await parseBody(req);
                const billing = require('./supabase/billing');
                const result = await billing.setGlobalPricingConfig({
                    fixedMarkupPercent: body.fixed_markup_percent,
                    periodType: body.period_type,
                    usdToEurRate: body.usd_to_eur_rate,
                    updatedBy: user.id
                });
                jsonResponse(res, result);
            } catch (error) {
                console.error('[API] Error setting global pricing config:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/admin/billing/pricing/tiers - Get global pricing tiers (superadmin)
        if (pathname === '/api/admin/billing/pricing/tiers' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const billing = require('./supabase/billing');
                const config = await billing.getGlobalPricingConfig();
                if (!config) {
                    return jsonResponse(res, { success: true, tiers: [] });
                }
                const tiers = await billing.getPricingTiers(config.id);
                jsonResponse(res, { success: true, tiers, config_id: config.id });
            } catch (error) {
                console.error('[API] Error getting global pricing tiers:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/admin/billing/pricing/tiers - Set global pricing tiers (superadmin)
        if (pathname === '/api/admin/billing/pricing/tiers' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const body = await parseBody(req);
                const billing = require('./supabase/billing');
                const config = await billing.getGlobalPricingConfig();
                if (!config) {
                    return jsonResponse(res, { error: 'Global pricing config not found' }, 404);
                }
                const result = await billing.setPricingTiers(config.id, body.tiers || []);
                jsonResponse(res, result);
            } catch (error) {
                console.error('[API] Error setting global pricing tiers:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/admin/billing/exchange-rate - Get exchange rate config (superadmin)
        if (pathname === '/api/admin/billing/exchange-rate' && req.method === 'GET') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const billing = require('./supabase/billing');
                const config = await billing.getExchangeRateConfig();
                jsonResponse(res, { success: true, ...config });
            } catch (error) {
                console.error('[API] Error getting exchange rate config:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/admin/billing/exchange-rate - Set exchange rate mode (superadmin)
        if (pathname === '/api/admin/billing/exchange-rate' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const body = await parseBody(req);
                const billing = require('./supabase/billing');
                const result = await billing.setExchangeRateMode(body.auto, body.manualRate);
                jsonResponse(res, result);
            } catch (error) {
                console.error('[API] Error setting exchange rate mode:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/admin/billing/exchange-rate/refresh - Force refresh exchange rate (superadmin)
        if (pathname === '/api/admin/billing/exchange-rate/refresh' && req.method === 'POST') {
            try {
                const user = await checkSuperAdmin(req, res);
                if (!user) return;
                const billing = require('./supabase/billing');
                const result = await billing.refreshExchangeRate();
                jsonResponse(res, { success: true, ...result });
            } catch (error) {
                console.error('[API] Error refreshing exchange rate:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }
        
        // Project-specific billing endpoints (match /api/admin/billing/projects/:id/*)
        const billingProjectMatch = pathname.match(/^\/api\/admin\/billing\/projects\/([^/]+)(\/.*)?$/);
        if (billingProjectMatch) {
            const projectId = billingProjectMatch[1];
            const subPath = billingProjectMatch[2] || '';
            
            // GET /api/admin/billing/projects/:id - Get project billing summary
            if (subPath === '' && req.method === 'GET') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const billing = require('./supabase/billing');
                    const summary = await billing.getProjectBillingSummary(projectId);
                    jsonResponse(res, { success: true, summary });
                } catch (error) {
                    console.error('[API] Error getting project billing summary:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
            
            // GET /api/admin/billing/projects/:id/balance - Get project balance
            if (subPath === '/balance' && req.method === 'GET') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const billing = require('./supabase/billing');
                    const balance = await billing.checkProjectBalance(projectId);
                    jsonResponse(res, { success: true, ...balance });
                } catch (error) {
                    console.error('[API] Error getting project balance:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
            
            // POST /api/admin/billing/projects/:id/balance - Set project balance
            if (subPath === '/balance' && req.method === 'POST') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const body = await parseBody(req);
                    const billing = require('./supabase/billing');
                    const notifications = require('./supabase/notifications');
                    
                    let result;
                    if (body.amount !== undefined) {
                        // Credit balance
                        result = await billing.creditProjectBalance(
                            projectId, 
                            parseFloat(body.amount), 
                            user.id,
                            body.description || 'Balance added by admin'
                        );
                        
                        // Send notification
                        if (result.success) {
                            const { data: project } = await storage._supabase?.supabase
                                .from('projects')
                                .select('name')
                                .eq('id', projectId)
                                .single();
                            await notifications.createBalanceAddedNotification(
                                projectId, 
                                parseFloat(body.amount), 
                                result.new_balance,
                                project?.name,
                                user.id
                            );
                        }
                    } else if (body.unlimited !== undefined) {
                        // Set unlimited mode
                        const success = await billing.setProjectUnlimited(projectId, body.unlimited, user.id);
                        result = { success, unlimited: body.unlimited };
                    } else {
                        return jsonResponse(res, { error: 'Provide amount or unlimited flag' }, 400);
                    }
                    
                    jsonResponse(res, result);
                } catch (error) {
                    console.error('[API] Error setting project balance:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
            
            // GET /api/admin/billing/projects/:id/transactions - Get balance transactions
            if (subPath === '/transactions' && req.method === 'GET') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const parsedUrl = parseUrl(req.url || '');
                    const limit = parseInt(parsedUrl.query?.limit || '50', 10);
                    const billing = require('./supabase/billing');
                    const transactions = await billing.getBalanceTransactions(projectId, limit);
                    jsonResponse(res, { success: true, transactions });
                } catch (error) {
                    console.error('[API] Error getting balance transactions:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
            
            // GET /api/admin/billing/projects/:id/pricing - Get project pricing override
            if (subPath === '/pricing' && req.method === 'GET') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const billing = require('./supabase/billing');
                    const override = await billing.getProjectPricingOverride(projectId);
                    const globalConfig = await billing.getGlobalPricingConfig();
                    jsonResponse(res, { 
                        success: true, 
                        override, 
                        using_global: !override,
                        global_config: globalConfig 
                    });
                } catch (error) {
                    console.error('[API] Error getting project pricing override:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
            
            // POST /api/admin/billing/projects/:id/pricing - Set project pricing override
            if (subPath === '/pricing' && req.method === 'POST') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const body = await parseBody(req);
                    const billing = require('./supabase/billing');
                    const result = await billing.setProjectPricingOverride(projectId, {
                        fixedMarkupPercent: body.fixed_markup_percent,
                        periodType: body.period_type,
                        usdToEurRate: body.usd_to_eur_rate,
                        createdBy: user.id
                    });
                    
                    // Set tiers if provided
                    if (result.success && result.config_id && body.tiers) {
                        await billing.setPricingTiers(result.config_id, body.tiers);
                    }
                    
                    jsonResponse(res, result);
                } catch (error) {
                    console.error('[API] Error setting project pricing override:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
            
            // DELETE /api/admin/billing/projects/:id/pricing - Remove project pricing override
            if (subPath === '/pricing' && req.method === 'DELETE') {
                try {
                    const user = await checkSuperAdmin(req, res);
                    if (!user) return;
                    const billing = require('./supabase/billing');
                    const success = await billing.deleteProjectPricingOverride(projectId);
                    jsonResponse(res, { success });
                } catch (error) {
                    console.error('[API] Error deleting project pricing override:', error);
                    jsonResponse(res, { error: error.message }, 500);
                }
                return;
            }
        }
        
        // GET /api/projects/:id/billing - Get billing summary for project (project members)
        const projectBillingMatch = pathname.match(/^\/api\/projects\/([^/]+)\/billing$/);
        if (projectBillingMatch && req.method === 'GET') {
            try {
                const projectId = projectBillingMatch[1];
                const billing = require('./supabase/billing');
                const summary = await billing.getProjectBillingSummary(projectId);
                jsonResponse(res, { success: true, summary });
            } catch (error) {
                console.error('[API] Error getting project billing:', error);
                jsonResponse(res, { error: error.message }, 500);
            }
            return;
        }

        // GET /api/dashboard - Get enhanced dashboard stats
        if (pathname === '/api/dashboard' && req.method === 'GET') {
            const stats = storage.getStats();

            // Get questions by priority
            const allQuestions = storage.getQuestions({});
            const questionsByPriority = {
                critical: allQuestions.filter(q => q.priority === 'critical' && q.status === 'pending').length,
                high: allQuestions.filter(q => q.priority === 'high' && q.status === 'pending').length,
                medium: allQuestions.filter(q => q.priority === 'medium' && q.status === 'pending').length,
                resolved: allQuestions.filter(q => q.status === 'resolved').length
            };

            // Get risks by impact
            const allRisks = storage.getRisks ? await storage.getRisks() : [];
            const risksByImpact = {
                high: allRisks.filter(r => (r.impact || '').toLowerCase() === 'high' && r.status === 'open').length,
                medium: allRisks.filter(r => (r.impact || '').toLowerCase() === 'medium' && r.status === 'open').length,
                low: allRisks.filter(r => (r.impact || '').toLowerCase() === 'low' && r.status === 'open').length
            };

            // Get all actions and people
            const allActions = storage.getActionItems();
            const allPeople = storage.getPeople ? storage.getPeople() : [];

            // Get overdue actions
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdueActions = allActions.filter(a => {
                if (a.status === 'completed') return false;
                if (!a.deadline) return false;
                const deadline = new Date(a.deadline);
                return deadline < today;
            });

            // Calculate pending counts (exclude completed/resolved/dismissed items)
            const activeQuestions = allQuestions.filter(q => 
                q.status !== 'resolved' && 
                q.status !== 'dismissed' && 
                q.status !== 'closed' && 
                q.status !== 'answered'
            );
            const pendingQuestions = activeQuestions.length;
            const pendingActions = allActions.filter(a => a.status !== 'completed').length;
            const openRisks = allRisks.filter(r => r.status === 'open' || !r.status).length;

            // Calculate question ages (only active questions)
            const now = new Date();
            const questionsWithAge = activeQuestions.map(q => {
                const created = q.created_at ? new Date(q.created_at) : new Date(q.date || now);
                const ageMs = now - created;
                const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
                return { ...q, ageDays };
            });

            // Aging categories
            const questionAging = {
                fresh: questionsWithAge.filter(q => q.ageDays <= 3).length,      // 0-3 days
                aging: questionsWithAge.filter(q => q.ageDays > 3 && q.ageDays <= 7).length,  // 4-7 days
                stale: questionsWithAge.filter(q => q.ageDays > 7 && q.ageDays <= 14).length, // 8-14 days
                critical: questionsWithAge.filter(q => q.ageDays > 14).length    // 14+ days
            };

            // Oldest unanswered questions
            const oldestQuestions = questionsWithAge
                .sort((a, b) => b.ageDays - a.ageDays)
                .slice(0, 5);

            // Facts by category and verified count
            const allFacts = storage.getFacts ? await storage.getFacts() : [];
            const factsByCategory = {
                technical: allFacts.filter(f => (f.category || '').toLowerCase() === 'technical').length,
                process: allFacts.filter(f => (f.category || '').toLowerCase() === 'process').length,
                policy: allFacts.filter(f => (f.category || '').toLowerCase() === 'policy').length,
                people: allFacts.filter(f => (f.category || '').toLowerCase() === 'people').length,
                timeline: allFacts.filter(f => (f.category || '').toLowerCase() === 'timeline').length,
                general: allFacts.filter(f => (f.category || '').toLowerCase() === 'general' || !f.category).length
            };
            const factsVerifiedCount = allFacts.filter(f => f.verified === true).length;

            // Get trends (compare to 7 days ago)
            const trends = storage.getTrends(7);
            const trendInsights = storage.getTrendInsights();

            jsonResponse(res, {
                documents: stats.documents || { total: 0, processed: 0, pending: 0 },
                totalFacts: stats.facts || 0,
                factsByCategory,
                factsVerifiedCount,
                totalQuestions: pendingQuestions,
                totalDecisions: stats.decisions || 0,
                totalRisks: openRisks,
                totalActions: pendingActions,
                totalPeople: allPeople.length,
                questionsByPriority,
                risksByImpact,
                overdueActions: overdueActions.length,
                overdueItems: overdueActions.slice(0, 5),
                questionAging,
                oldestQuestions,
                trends,
                trendInsights
            });
            return;
        }

        // GET /api/trends - Get trend data for metrics
        if (pathname === '/api/trends' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const days = parseInt(parsedUrl.query.days) || 7;
            const trends = storage.getTrends(days);
            const history = storage.getStatsHistory(30);
            jsonResponse(res, { trends, history });
            return;
        }

        // POST /api/bulk/delete - Bulk delete items
        if (pathname === '/api/bulk/delete' && req.method === 'POST') {
            const body = await parseBody(req);
            const { type, ids } = body;

            if (!type || !ids || !Array.isArray(ids)) {
                jsonResponse(res, { error: 'Missing type or ids' }, 400);
                return;
            }

            let deleted = 0;
            if (type === 'facts') {
                const facts = storage.knowledge.facts;
                const idsSet = new Set(ids.map(String));
                const remaining = facts.filter((f, idx) => !idsSet.has(String(f.id || idx)));
                deleted = facts.length - remaining.length;
                storage.knowledge.facts = remaining;
                storage.saveKnowledge();
            } else if (type === 'risks') {
                const risks = storage.knowledge.risks;
                const idsSet = new Set(ids.map(String));
                const remaining = risks.filter((r, idx) => !idsSet.has(String(r.id || idx)));
                deleted = risks.length - remaining.length;
                storage.knowledge.risks = remaining;
                storage.saveKnowledge();
            } else if (type === 'actions') {
                const actions = storage.knowledge.action_items;
                const idsSet = new Set(ids.map(String));
                const remaining = actions.filter((a, idx) => !idsSet.has(String(a.id || idx)));
                deleted = actions.length - remaining.length;
                storage.knowledge.action_items = remaining;
                storage.saveKnowledge();
            }

            // Update stats history
            storage.recordDailyStats();

            jsonResponse(res, { deleted, type });
            return;
        }

        // POST /api/bulk/status - Bulk update status
        if (pathname === '/api/bulk/status' && req.method === 'POST') {
            const body = await parseBody(req);
            const { type, ids, status } = body;

            if (!type || !ids || !Array.isArray(ids) || !status) {
                jsonResponse(res, { error: 'Missing type, ids, or status' }, 400);
                return;
            }

            let updated = 0;
            const idsSet = new Set(ids.map(String));

            if (type === 'risks') {
                storage.knowledge.risks.forEach((r, idx) => {
                    if (idsSet.has(String(r.id || idx))) {
                        r.status = status;
                        updated++;
                    }
                });
                storage.saveKnowledge();
            } else if (type === 'actions') {
                storage.knowledge.action_items.forEach((a, idx) => {
                    if (idsSet.has(String(a.id || idx))) {
                        a.status = status;
                        updated++;
                    }
                });
                storage.saveKnowledge();
            }

            // Update stats history
            storage.recordDailyStats();

            jsonResponse(res, { updated, type, status });
            return;
        }

        // POST /api/undo/restore - Restore a single deleted item
        if (pathname === '/api/undo/restore' && req.method === 'POST') {
            const body = await parseBody(req);
            const { type, data } = body;

            if (!type || !data) {
                jsonResponse(res, { error: 'Missing type or data' }, 400);
                return;
            }

            try {
                if (type === 'risk') {
                    storage.knowledge.risks.push({
                        ...data,
                        id: data.id || Date.now(),
                        restored_at: new Date().toISOString()
                    });
                    storage.saveKnowledge();
                } else if (type === 'action') {
                    storage.knowledge.action_items.push({
                        ...data,
                        id: data.id || Date.now(),
                        restored_at: new Date().toISOString()
                    });
                    storage.saveKnowledge();
                } else {
                    jsonResponse(res, { error: 'Unknown type' }, 400);
                    return;
                }

                storage.recordDailyStats();
                jsonResponse(res, { success: true, type });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/undo/restore-bulk - Restore multiple deleted items
        if (pathname === '/api/undo/restore-bulk' && req.method === 'POST') {
            const body = await parseBody(req);
            const { type, items } = body;

            if (!type || !items || !Array.isArray(items)) {
                jsonResponse(res, { error: 'Missing type or items' }, 400);
                return;
            }

            try {
                let restored = 0;
                const now = new Date().toISOString();

                if (type === 'facts') {
                    for (const item of items) {
                        storage.knowledge.facts.push({
                            ...item,
                            id: item.id || Date.now() + restored,
                            restored_at: now
                        });
                        restored++;
                    }
                    storage.saveKnowledge();
                } else if (type === 'risks') {
                    for (const item of items) {
                        storage.knowledge.risks.push({
                            ...item,
                            id: item.id || Date.now() + restored,
                            restored_at: now
                        });
                        restored++;
                    }
                    storage.saveKnowledge();
                } else if (type === 'actions') {
                    for (const item of items) {
                        storage.knowledge.action_items.push({
                            ...item,
                            id: item.id || Date.now() + restored,
                            restored_at: now
                        });
                        restored++;
                    }
                    storage.saveKnowledge();
                } else {
                    jsonResponse(res, { error: 'Unknown type' }, 400);
                    return;
                }

                storage.recordDailyStats();
                jsonResponse(res, { success: true, restored, type });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/briefing - AI-generated daily briefing (cached with change detection)
        if (pathname === '/api/briefing' && req.method === 'GET') {
            const briefingUrl = parseUrl(req.url);
            const forceRefresh = briefingUrl.query?.refresh === 'true';

            // Check Supabase cache first (detects data changes via hash)
            if (!forceRefresh) {
                try {
                    const cacheResult = await storage.getCachedBriefing();
                    if (cacheResult.cached) {
                        console.log('[Briefing] Using Supabase cached briefing (no data changes detected)');
                        // cacheResult.briefing is the full content object { briefing, analysis, ... }
                        const cachedContent = cacheResult.briefing || {};
                        jsonResponse(res, {
                            briefing: cachedContent.briefing || cacheResult.summary,
                            analysis: cachedContent.analysis || null,
                            generated_at: cachedContent.generated_at || cacheResult.createdAt,
                            stats: cachedContent.stats || cacheResult.stats,
                            cached: true,
                            cacheSource: 'supabase'
                        });
                        return;
                    }
                } catch (cacheErr) {
                    console.log('[Briefing] Cache check error:', cacheErr.message);
                }
            }

            // Fallback to memory cache
            if (!forceRefresh && isBriefingCacheValid()) {
                console.log('[Briefing] Returning memory cached briefing');
                jsonResponse(res, {
                    ...briefingCache.data,
                    cached: true,
                    cacheSource: 'memory'
                });
                return;
            }

            // Get model from LLM config (new system) or Ollama config (legacy)
            const briefingTextCfg = llmConfig.getTextConfig(config);
            const llmProvider = briefingTextCfg.provider;
            const model = briefingTextCfg.model;
            
            if (!model) {
                jsonResponse(res, { error: 'No model configured. Please configure a text model in Settings.', briefing: null });
                return;
            }
            
            console.log(`[Briefing] Using provider: ${llmProvider}, model: ${model}`);

            // Gather key data for briefing
            const stats = storage.getStats();
            const allQuestions = storage.getQuestions({});
            const allRisks = storage.getRisks ? await storage.getRisks() : [];
            const allActions = storage.getActionItems();
            const currentProject = storage.getCurrentProject();

            // Calculate urgencies
            const criticalQuestions = allQuestions.filter(q => q.priority === 'critical' && q.status !== 'resolved');
            const highRisks = allRisks.filter(r => (r.impact || '').toLowerCase() === 'high' && r.status !== 'mitigated');

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const overdueActions = allActions.filter(a => {
                if (a.status === 'completed') return false;
                if (!a.deadline) return false;
                return new Date(a.deadline) < today;
            });

            // Calculate question ages
            const oldQuestions = allQuestions.filter(q => {
                if (q.status === 'resolved') return false;
                const created = q.created_at ? new Date(q.created_at) : null;
                if (!created) return false;
                const ageDays = Math.floor((today - created) / (1000 * 60 * 60 * 24));
                return ageDays > 7;
            });

            const userRole = currentProject?.userRole || '';
            const userRolePrompt = currentProject?.userRolePrompt || '';
            let roleContext = userRole ? `\nYour briefing is for: ${userRole}` : '';
            if (userRolePrompt) {
                roleContext += `\nRole Context: ${userRolePrompt}`;
            }

            // Build context from actual data for better analysis
            const recentFacts = storage.getFacts().slice(0, 5).map(f => f.content?.substring(0, 100)).join('; ');
            const openRisksList = allRisks.filter(r => r.status !== 'mitigated').slice(0, 3).map(r => r.content?.substring(0, 80)).join('; ');
            const pendingQuestionsList = allQuestions.filter(q => q.status !== 'resolved').slice(0, 3).map(q => q.content?.substring(0, 80)).join('; ');

            const briefingPrompt = `/no_think
TASK: Generate a comprehensive daily project briefing with analysis.
OUTPUT: A structured briefing followed by a written executive summary.${roleContext}

PROJECT: ${currentProject?.name || 'GodMode'}

QUANTITATIVE DATA:
- Total Facts Captured: ${stats.facts || 0}
- Decisions Made: ${stats.decisions || 0}
- Pending Questions: ${allQuestions.filter(q => q.status !== 'resolved').length}
- Open Risks: ${allRisks.filter(r => r.status !== 'mitigated').length}
- Pending Actions: ${allActions.filter(a => a.status !== 'completed').length}
${criticalQuestions.length > 0 ? `- Critical Questions: ${criticalQuestions.length}` : ''}
${highRisks.length > 0 ? `- High-Impact Risks: ${highRisks.length}` : ''}
${overdueActions.length > 0 ? `- Overdue Actions: ${overdueActions.length}` : ''}
${oldQuestions.length > 0 ? `- Aging Questions (>7 days): ${oldQuestions.length}` : ''}

QUALITATIVE CONTEXT:
${recentFacts ? `Recent insights: ${recentFacts}` : 'No recent facts captured.'}
${openRisksList ? `Active risks: ${openRisksList}` : ''}
${pendingQuestionsList ? `Open questions: ${pendingQuestionsList}` : ''}

RESPOND WITH THIS EXACT FORMAT:

• **Project Health**: [Good/Needs Attention/Urgent] - [one sentence reason]
• **Critical Today**: [most important item to address today]
• **Trend**: [observation about project trajectory]
• **Next Step**: [one specific recommended action]

---ANALYSIS---
[Write 2-3 paragraphs providing an executive summary analysis. Include: 
1) Current project state and what the data reveals
2) Key concerns or opportunities identified
3) Strategic recommendations for the coming period]

START YOUR RESPONSE WITH THE FIRST BULLET POINT.`;

            try {
                // Use LLM router for provider-agnostic generation
                // Get provider config with API key
                const providerConfig = config.llm?.providers?.[llmProvider] || {};
                const result = await llm.generateText({
                    provider: llmProvider,
                    model: model,
                    prompt: briefingPrompt,
                    temperature: 0.6,
                    maxTokens: 1000,
                    providerConfig: providerConfig,
                    context: 'briefing'
                });
                if (result.success) {
                    // Clean up response - remove any reasoning/thinking text
                    let fullResponse = result.text || result.response || '';

                    // Remove common reasoning patterns
                    fullResponse = fullResponse
                        // Remove "Okay, let me..." style reasoning
                        .replace(/^.*?(Okay|Let me|I need to|First|The user|Looking at|Based on).*?\n/gim, '')
                        // Remove lines that are clearly internal reasoning
                        .replace(/^.*?(I should|I'll|I think|I notice|I see|I can see|So |Hmm|Wait).*?\n/gim, '')
                        // Remove emoji + reasoning patterns at start
                        .replace(/^[📊🚨⚠️✅📈💡🎯]+(Okay|Let me|I need|First|The user|Looking|Based).*?\n/gim, '')
                        // Find the actual briefing (starts with bullet or bold)
                        .replace(/^[\s\S]*?(?=•|\*\*|\-\s\*\*)/m, '')
                        .trim();

                    // If cleaning removed everything, use original
                    if (!fullResponse || fullResponse.length < 20) {
                        fullResponse = result.text || result.response || '';
                    }

                    // Split into bullets and analysis
                    let cleanBriefing = fullResponse;
                    let analysis = '';
                    
                    // Check for various analysis separators
                    const separators = ['---ANALYSIS---', '---Analysis---', '**Analysis**', '## Analysis', '### Analysis', 'Executive Analysis:', 'Analysis:'];
                    let separatorFound = false;
                    
                    for (const sep of separators) {
                        const sepIndex = fullResponse.indexOf(sep);
                        if (sepIndex !== -1) {
                            cleanBriefing = fullResponse.substring(0, sepIndex).trim();
                            analysis = fullResponse.substring(sepIndex + sep.length).trim();
                            separatorFound = true;
                            break;
                        }
                    }
                    
                    if (!separatorFound) {
                        // Alternative: look for paragraph after bullet points (when there's substantive text after)
                        const lines = fullResponse.split('\n');
                        let lastBulletIndex = -1;
                        
                        for (let i = lines.length - 1; i >= 0; i--) {
                            const line = lines[i].trim();
                            if (line.startsWith('•') || (line.startsWith('**') && line.includes(':'))) {
                                lastBulletIndex = i;
                                break;
                            }
                        }
                        
                        if (lastBulletIndex !== -1 && lastBulletIndex < lines.length - 1) {
                            const afterBullets = lines.slice(lastBulletIndex + 1).join('\n').trim();
                            // Only consider it analysis if it's substantial (more than 100 chars)
                            if (afterBullets.length > 100) {
                                cleanBriefing = lines.slice(0, lastBulletIndex + 1).join('\n').trim();
                                analysis = afterBullets
                                    .replace(/^[-─—=]+\s*/gm, '')  // Remove separators
                                    .replace(/^(Analysis|Summary|Executive Summary):?\s*/im, '')  // Remove headers
                                    .trim();
                            }
                        }
                    }
                    
                    // Clean up analysis
                    if (analysis) {
                        analysis = analysis
                            .replace(/^[-─—=]+\s*/gm, '')
                            .replace(/^\*\*.*?\*\*\s*/m, '')  // Remove bold headers at start
                            .trim();
                    }

                    const responseData = {
                        briefing: cleanBriefing,
                        analysis: analysis || null,
                        generated_at: new Date().toISOString(),
                        stats: {
                            criticalQuestions: criticalQuestions.length,
                            highRisks: highRisks.length,
                            overdueActions: overdueActions.length,
                            agingQuestions: oldQuestions.length
                        }
                    };

                    // Cache the briefing in memory
                    briefingCache = {
                        data: responseData,
                        generatedAt: responseData.generated_at,
                        projectId: currentProject?.id
                    };
                    
                    // Also persist to Supabase for history and cross-session caching
                    try {
                        const savedBriefing = await storage.saveBriefing(responseData, {
                            summary: cleanBriefing.substring(0, 500),
                            provider: llmProvider,
                            model: model,
                            tokensUsed: result.usage?.total || null,
                            generationTime: result.latency || null
                        });
                        
                        // Sync briefing to FalkorDB graph
                        if (savedBriefing) {
                            try {
                                const graphProvider = storage.getGraphProvider();
                                if (graphProvider && graphProvider.connected) {
                                    const { getGraphSync } = require('./sync');
                                    const briefingGraphSync = getGraphSync({ graphProvider, storage });
                                    await briefingGraphSync.syncBriefing(
                                        savedBriefing, 
                                        currentProject?.id, 
                                        currentProject?.name
                                    );
                                }
                            } catch (graphErr) {
                                console.log('[Briefing] Graph sync failed:', graphErr.message);
                            }
                        }
                    } catch (saveErr) {
                        console.log('[Briefing] Failed to save to Supabase:', saveErr.message);
                    }
                    
                    console.log('[Briefing] Generated and cached (memory + Supabase + Graph)');

                    jsonResponse(res, responseData);
                } else {
                    jsonResponse(res, { error: result.error, briefing: null });
                }
            } catch (e) {
                jsonResponse(res, { error: e.message, briefing: null });
            }
            return;
        }

        // GET /api/briefing/history - Get briefing history
        if (pathname === '/api/briefing/history' && req.method === 'GET') {
            try {
                const briefingUrl = parseUrl(req.url);
                const limit = parseInt(briefingUrl.query?.limit) || 30;
                const history = await storage.getBriefingHistory(limit);
                jsonResponse(res, { 
                    ok: true, 
                    history,
                    total: history.length 
                });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message, history: [] });
            }
            return;
        }

        // GET /api/reports/weekly - Generate weekly status report
        if (pathname === '/api/reports/weekly' && req.method === 'GET') {
            const model = config.ollama?.reasoningModel || config.ollama?.model;
            const currentProject = storage.getCurrentProject();

            // Gather comprehensive data
            const stats = storage.getStats();
            const allFacts = storage.getFacts();
            const allQuestions = storage.getQuestions({});
            const allDecisions = storage.getDecisions();
            const allRisks = storage.getRisks ? await storage.getRisks() : [];
            const allActions = storage.getActionItems();
            const allPeople = storage.getPeople();

            // Calculate metrics
            const pendingQuestions = allQuestions.filter(q => q.status !== 'resolved');
            const resolvedQuestions = allQuestions.filter(q => q.status === 'resolved');
            const openRisks = allRisks.filter(r => r.status !== 'mitigated');
            const completedActions = allActions.filter(a => a.status === 'completed');
            const pendingActions = allActions.filter(a => a.status !== 'completed');

            const today = new Date();
            const overdueActions = pendingActions.filter(a => a.deadline && new Date(a.deadline) < today);

            // Build report
            const userRole = currentProject?.userRole || '';
            const userRolePrompt = currentProject?.userRolePrompt || '';
            let report = `# Weekly Status Report: ${currentProject?.name || 'Project'}\n\n`;
            report += `**Generated:** ${today.toISOString().split('T')[0]}\n`;
            if (userRole) {
                report += `**Prepared for:** ${userRole}\n`;
            }
            if (userRolePrompt) {
                report += `**Role Focus:** ${userRolePrompt}\n`;
            }
            report += `\n---\n\n`;

            report += `## Executive Summary\n\n`;
            report += `| Metric | Count |\n|--------|-------|\n`;
            report += `| Total Facts | ${allFacts.length} |\n`;
            report += `| Pending Questions | ${pendingQuestions.length} |\n`;
            report += `| Resolved Questions | ${resolvedQuestions.length} |\n`;
            report += `| Open Risks | ${openRisks.length} |\n`;
            report += `| Pending Actions | ${pendingActions.length} |\n`;
            report += `| Overdue Actions | ${overdueActions.length} |\n`;
            report += `| Key People | ${allPeople.length} |\n\n`;

            // Critical Items
            const criticalQuestions = pendingQuestions.filter(q => q.priority === 'critical');
            const highRisks = openRisks.filter(r => (r.impact || '').toLowerCase() === 'high');

            if (criticalQuestions.length > 0 || highRisks.length > 0 || overdueActions.length > 0) {
                report += `## Requires Attention\n\n`;

                if (criticalQuestions.length > 0) {
                    report += `### Critical Questions (${criticalQuestions.length})\n`;
                    criticalQuestions.forEach(q => {
                        report += `- ${q.content}`;
                        if (q.assignee) report += ` *(Ask: ${q.assignee})*`;
                        report += `\n`;
                    });
                    report += `\n`;
                }

                if (highRisks.length > 0) {
                    report += `### High-Impact Risks (${highRisks.length})\n`;
                    highRisks.forEach(r => {
                        report += `- ${r.content}`;
                        if (r.mitigation) report += ` | Mitigation: ${r.mitigation}`;
                        report += `\n`;
                    });
                    report += `\n`;
                }

                if (overdueActions.length > 0) {
                    report += `### Overdue Actions (${overdueActions.length})\n`;
                    overdueActions.forEach(a => {
                        report += `- ${a.task}`;
                        if (a.assignee) report += ` *(Owner: ${a.assignee})*`;
                        report += ` - Due: ${a.deadline}\n`;
                    });
                    report += `\n`;
                }
            }

            // Recent Decisions
            if (allDecisions.length > 0) {
                report += `## Recent Decisions\n\n`;
                allDecisions.slice(0, 5).forEach(d => {
                    report += `- ${d.content}`;
                    if (d.date) report += ` *(${d.date})*`;
                    if (d.owner) report += ` - ${d.owner}`;
                    report += `\n`;
                });
                report += `\n`;
            }

            // Questions by Priority
            report += `## Questions by Priority\n\n`;
            report += `| Priority | Count |\n|----------|-------|\n`;
            report += `| Critical | ${pendingQuestions.filter(q => q.priority === 'critical').length} |\n`;
            report += `| High | ${pendingQuestions.filter(q => q.priority === 'high').length} |\n`;
            report += `| Medium | ${pendingQuestions.filter(q => q.priority === 'medium').length} |\n\n`;

            report += `---\n\n*Report generated automatically by GodMode*\n`;

            jsonResponse(res, {
                report,
                generated_at: new Date().toISOString(),
                project: currentProject?.name
            });
            return;
        }

        // GET /api/conflicts - Detect conflicting facts using AI (delegates to FactCheckFlow, no events recorded)
        if (pathname === '/api/conflicts' && req.method === 'GET') {
            try {
                const { runFactCheck } = require('./fact-check');
                const result = await runFactCheck(storage, config, { recordEvents: false });
                const payload = {
                    conflicts: result.conflicts || [],
                    analyzed_facts: result.analyzed_facts ?? 0
                };
                if (result.error) payload.error = result.error;
                if (result.analyzed_facts < 2) payload.message = 'Not enough facts to compare';
                jsonResponse(res, payload);
            } catch (e) {
                jsonResponse(res, { error: e.message, conflicts: [] });
            }
            return;
        }

        // POST /api/fact-check/run - Manually trigger fact-check flow (records conflict_detected events)
        if (pathname === '/api/fact-check/run' && req.method === 'POST') {
            try {
                const { runFactCheck } = require('./fact-check');
                const result = await runFactCheck(storage, config, { recordEvents: true });
                jsonResponse(res, {
                    ok: true,
                    conflicts: result.conflicts || [],
                    analyzed_facts: result.analyzed_facts ?? 0,
                    events_recorded: result.events_recorded ?? 0,
                    error: result.error || null
                });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message, conflicts: [] }, 500);
            }
            return;
        }

        // GET /api/conflicts/decisions - Detect conflicting decisions using AI (no events recorded)
        if (pathname === '/api/conflicts/decisions' && req.method === 'GET') {
            try {
                const { runDecisionCheck } = require('./decision-check/DecisionCheckFlow');
                const result = await runDecisionCheck(storage, config, { recordEvents: false });
                jsonResponse(res, {
                    conflicts: result.conflicts || [],
                    analyzed_decisions: result.analyzed_decisions ?? 0,
                    error: result.error || null
                });
            } catch (e) {
                jsonResponse(res, { error: e.message, conflicts: [] });
            }
            return;
        }

        // POST /api/decision-check/run - Manually trigger decision-check flow (records conflict_detected events)
        if (pathname === '/api/decision-check/run' && req.method === 'POST') {
            try {
                const { runDecisionCheck } = require('./decision-check/DecisionCheckFlow');
                const result = await runDecisionCheck(storage, config, { recordEvents: true });
                jsonResponse(res, {
                    ok: true,
                    conflicts: result.conflicts || [],
                    analyzed_decisions: result.analyzed_decisions ?? 0,
                    events_recorded: result.events_recorded ?? 0,
                    error: result.error || null
                });
            } catch (e) {
                jsonResponse(res, { ok: false, error: e.message, conflicts: [] }, 500);
            }
            return;
        }

        // GET /api/questions - Get questions
        if (pathname === '/api/questions' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const filters = {
                status: parsedUrl.query.status,
                priority: parsedUrl.query.priority
            };
            const questions = storage.getQuestions(filters);
            jsonResponse(res, { questions });
            return;
        }

        // POST /api/questions - Add a new question with duplicate detection
        if (pathname === '/api/questions' && req.method === 'POST') {
            const body = await parseBody(req);
            const { content, priority, assigned_to, skipDedup } = body;

            if (!content || content.trim().length < 5) {
                jsonResponse(res, { error: 'Content is required (min 5 chars)', success: false }, 400);
                return;
            }

            const result = storage.addQuestion({
                content: content.trim(),
                priority: priority || 'medium',
                assigned_to: assigned_to || null,
                source_file: 'quick_capture'
            }, skipDedup === true);

            if (result.action === 'duplicate') {
                // Return duplicate warning with existing item info
                jsonResponse(res, {
                    success: false,
                    duplicate: true,
                    existingId: result.id,
                    similarity: Math.round(result.similarity * 100),
                    message: `Similar question exists (${Math.round(result.similarity * 100)}% match)`
                });
                return;
            }

            storage.recordDailyStats();
            jsonResponse(res, { success: true, id: result.id, action: result.action });
            return;
        }

        // PUT /api/questions/:id - Update a question (assign to person, change status, etc.)
        const questionUpdateMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)$/);
        if (questionUpdateMatch && req.method === 'PUT') {
            const questionId = questionUpdateMatch[1];
            const body = await parseBody(req);
            
            console.log(`[Questions] Updating question ${questionId}:`, JSON.stringify(body).substring(0, 200));
            
            const result = await storage.updateQuestion(questionId, body);
            console.log(`[Questions] Update result:`, JSON.stringify(result).substring(0, 200));
            
            if (result.success || result.ok) {
                // Sync to FalkorDB if connected
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        const { getGraphSync } = require('./sync');
                        const graphSync = getGraphSync({ graphProvider, storage });
                        await graphSync.syncQuestion(result.question);
                        console.log(`[Graph] Question ${questionId} updated in FalkorDB`);
                    } catch (syncErr) {
                        console.log('[Graph] Question sync error:', syncErr.message);
                    }
                }
                jsonResponse(res, { ok: true, success: true, question: result.question });
            } else {
                console.log(`[Questions] Update failed for ${questionId}: ${result.error}`);
                jsonResponse(res, { ok: false, success: false, error: result.error || 'Question not found' }, 404);
            }
            return;
        }

        // DELETE /api/questions/:id - Delete/dismiss a question
        const questionDeleteMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)$/);
        if (questionDeleteMatch && req.method === 'DELETE') {
            const questionId = questionDeleteMatch[1];
            const body = await parseBody(req);
            const reason = body.reason || 'deleted';
            
            try {
                // Get question before deleting for undo support
                const questions = storage.getQuestions();
                const question = questions.find(q => 
                    q.id === questionId || String(q.id) === String(questionId)
                );
                
                if (!question) {
                    jsonResponse(res, { ok: false, error: 'Question not found' }, 404);
                    return;
                }
                
                // Mark as dismissed/deleted (soft delete)
                const result = await storage.updateQuestion(questionId, {
                    status: 'dismissed',
                    dismissed_reason: reason,
                    dismissed_at: new Date().toISOString()
                });
                
                // Remove from FalkorDB graph
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        await graphProvider.query(
                            `MATCH (q:Question {id: $id}) DETACH DELETE q`,
                            { id: questionId }
                        );
                        console.log(`[Graph] Question ${questionId} deleted from FalkorDB`);
                    } catch (syncErr) {
                        console.log('[Graph] Question delete sync error:', syncErr.message);
                    }
                }
                
                // Store for undo
                if (typeof addToUndoStack === 'function') {
                    addToUndoStack('delete_question', question);
                }
                
                jsonResponse(res, { ok: true, deleted: true, reason });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/answer - Answer and resolve a question
        const questionAnswerMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/answer$/);
        if (questionAnswerMatch && req.method === 'POST') {
            const questionId = questionAnswerMatch[1];
            const body = await parseBody(req);
            const { answer, source, followupQuestions, answeredByContactId, answeredByName, answerProvenance } = body;
            
            if (!answer || answer.trim().length < 3) {
                jsonResponse(res, { success: false, error: 'Answer is required (min 3 chars)' }, 400);
                return;
            }
            
            const q = storage.getQuestions().find(q => q.id === questionId);
            if (!q) {
                jsonResponse(res, { success: false, error: 'Question not found' }, 404);
                return;
            }
            
            // If editing an existing answer, save the previous one
            if (q.answer && source === 'manual-edit') {
                q.previous_answer = q.answer;
                q.edit_history = q.edit_history || [];
                q.edit_history.push({
                    answer: q.answer,
                    edited_at: new Date().toISOString()
                });
            }
            
            storage.resolveQuestion(questionId, answer.trim());
            
            // Update with source info and answered_by contact
            const updatedQ = storage.getQuestions().find(q => q.id === questionId);
            if (updatedQ) {
                updatedQ.answer_source = source || 'manual';
                updatedQ.answered_at = new Date().toISOString();
                
                // Track who answered (contact or name)
                if (answeredByContactId) {
                    updatedQ.answered_by_contact_id = answeredByContactId;
                }
                if (answeredByName) {
                    updatedQ.answered_by_name = answeredByName;
                }
                
                // Store answer provenance if provided
                if (answerProvenance) {
                    updatedQ.answer_provenance = answerProvenance;
                }
                
                if (q.previous_answer) updatedQ.previous_answer = q.previous_answer;
                if (q.edit_history) updatedQ.edit_history = q.edit_history;
                storage.saveQuestions();
                
                // Also update in Supabase if available
                if (storage.supabase) {
                    try {
                        await storage.supabase
                            .from('knowledge_questions')
                            .update({
                                answer_source: updatedQ.answer_source,
                                answered_at: updatedQ.answered_at,
                                answered_by_contact_id: updatedQ.answered_by_contact_id || null,
                                answered_by_name: updatedQ.answered_by_name || null,
                                answer_provenance: updatedQ.answer_provenance || null
                            })
                            .eq('id', questionId);
                    } catch (e) {
                        console.log('[Questions] Supabase update error:', e.message);
                    }
                }
            }
            
            // Process follow-up questions
            let followupsCreated = 0;
            const followupIds = [];
            if (followupQuestions && followupQuestions.trim()) {
                const followups = followupQuestions.split('\n').filter(line => line.trim().length > 5);
                for (const followup of followups) {
                    const result = storage.addQuestion({
                        content: followup.trim(),
                        priority: q.priority || 'medium',
                        context: `Follow-up from: "${q.content.substring(0, 50)}..."`,
                        assigned_to: q.assigned_to,
                        source_file: 'followup'
                    });
                    if (result.action === 'added') {
                        followupsCreated++;
                        followupIds.push(result.id);
                    }
                }
            }
            
            // Sync to FalkorDB if connected
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    const { getGraphSync } = require('./sync');
                    const graphSync = getGraphSync({ graphProvider, storage });
                    
                    // Sync the answered question
                    await graphSync.syncQuestion(updatedQ);
                    
                    // Sync follow-up relationships
                    for (const followupId of followupIds) {
                        await graphSync.syncFollowUp(questionId, followupId);
                        const followupQ = storage.getQuestions().find(fq => fq.id === followupId);
                        if (followupQ) await graphSync.syncQuestion(followupQ);
                    }
                    
                    console.log(`[Graph] Question ${questionId} synced to FalkorDB`);
                } catch (syncErr) {
                    console.log('[Graph] Question sync error:', syncErr.message);
                }
            }
            
            jsonResponse(res, { 
                success: true, 
                question: updatedQ,
                followupsCreated,
                message: followupsCreated > 0 
                    ? `Question resolved. ${followupsCreated} follow-up question(s) created.`
                    : 'Question resolved successfully'
            });
            return;
        }

        // GET /api/facts/deleted - List soft-deleted facts (for restore / undo)
        if (pathname === '/api/facts/deleted' && req.method === 'GET') {
            try {
                const deleted = storage.getDeletedFacts ? await storage.getDeletedFacts() : [];
                jsonResponse(res, { facts: deleted || [], total: (deleted || []).length });
            } catch (e) {
                jsonResponse(res, { facts: [], total: 0, error: e.message }, 500);
            }
            return;
        }

        // GET /api/facts - Get facts (optional: category, document_id)
        if (pathname === '/api/facts' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const category = parsedUrl.query.category;
            const documentId = parsedUrl.query.document_id || parsedUrl.query.documentId;
            try {
                const facts = documentId
                    ? (storage.getFactsByDocument && (await storage.getFactsByDocument(documentId))) || []
                    : await storage.getFacts(category);
                const total = Array.isArray(facts) ? facts.length : 0;
                jsonResponse(res, { facts: facts || [], total });
            } catch (e) {
                jsonResponse(res, { facts: [], total: 0, error: e.message }, 500);
            }
            return;
        }

        // GET /api/facts/:id/events - Get fact timeline (events)
        const factEventsMatch = pathname.match(/^\/api\/facts\/([^/]+)\/events$/);
        if (factEventsMatch && req.method === 'GET') {
            const factId = factEventsMatch[1];
            try {
                const events = storage.getFactEvents && (await storage.getFactEvents(factId)) || [];
                jsonResponse(res, { events });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/facts/:id/similar - Get similar facts (from fact_similarities cache or computed)
        const factSimilarMatch = pathname.match(/^\/api\/facts\/([^/]+)\/similar$/);
        if (factSimilarMatch && req.method === 'GET') {
            const factId = factSimilarMatch[1];
            const parsedUrl = parseUrl(req.url);
            const limit = Math.min(parseInt(parsedUrl.query.limit, 10) || 10, 50);
            try {
                const similar = storage.getSimilarFacts ? await storage.getSimilarFacts(factId, limit) : [];
                jsonResponse(res, {
                    similar: similar.map(s => ({ fact: s.fact, similarityScore: s.similarityScore }))
                });
            } catch (e) {
                jsonResponse(res, { error: e.message, similar: [] }, 500);
            }
            return;
        }

        // GET /api/facts/:id - Get single fact
        const factIdMatch = pathname.match(/^\/api\/facts\/([^/]+)$/);
        if (factIdMatch && req.method === 'GET') {
            const factId = factIdMatch[1];
            try {
                const fact = storage.getFact ? await storage.getFact(factId) : null;
                if (!fact) {
                    jsonResponse(res, { error: 'Fact not found' }, 404);
                    return;
                }
                jsonResponse(res, { fact });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/facts/:id - Update fact
        const factPutMatch = pathname.match(/^\/api\/facts\/([^/]+)$/);
        if (factPutMatch && req.method === 'PUT') {
            const factId = factPutMatch[1];
            const body = await parseBody(req).catch(() => ({}));
            try {
                const fact = await storage.updateFact(factId, {
                    content: body.content,
                    category: body.category,
                    confidence: body.confidence,
                    verified: body.verified
                });
                jsonResponse(res, { fact });
            } catch (e) {
                jsonResponse(res, { error: e.message }, e.message === 'Fact not found' ? 404 : 500);
            }
            return;
        }

        // POST /api/facts/:id/restore - Restore soft-deleted fact (undo); syncs to FalkorDB
        const factRestoreMatch = pathname.match(/^\/api\/facts\/([^/]+)\/restore$/);
        if (factRestoreMatch && req.method === 'POST') {
            const factId = factRestoreMatch[1];
            try {
                const fact = await storage.restoreFact(factId);
                jsonResponse(res, { success: true, fact });
            } catch (e) {
                jsonResponse(res, { error: e.message }, e.message === 'Fact not found' || e.message === 'Fact is not deleted' ? 404 : 500);
            }
            return;
        }

        // DELETE /api/facts/:id - Delete fact
        const factDelMatch = pathname.match(/^\/api\/facts\/([^/]+)$/);
        if (factDelMatch && req.method === 'DELETE') {
            const factId = factDelMatch[1];
            try {
                await storage.deleteFact(factId, true);
                jsonResponse(res, { success: true });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/facts - Add a new fact with duplicate detection
        if (pathname === '/api/facts' && req.method === 'POST') {
            const body = await parseBody(req);
            const { content, category, skipDedup } = body;

            if (!content || content.trim().length < 5) {
                jsonResponse(res, { error: 'Content is required (min 5 chars)', success: false }, 400);
                return;
            }

            const result = storage.addFact({
                content: content.trim(),
                category: category || 'General',
                source_file: 'quick_capture'
            }, skipDedup === true);

            if (result.action === 'duplicate') {
                // Return duplicate warning with existing item info
                jsonResponse(res, {
                    success: false,
                    duplicate: true,
                    existingId: result.id,
                    similarity: Math.round(result.similarity * 100),
                    message: `Similar fact exists (${Math.round(result.similarity * 100)}% match)`
                });
                return;
            }

            if (result.action === 'skipped') {
                jsonResponse(res, {
                    success: false,
                    error: `Fact skipped: ${result.reason}`,
                    reason: result.reason
                }, 400);
                return;
            }

            storage.recordDailyStats();
            jsonResponse(res, { success: true, id: result.id, action: result.action });
            return;
        }

        // GET /api/decisions/deleted - List soft-deleted decisions
        if (pathname === '/api/decisions/deleted' && req.method === 'GET') {
            try {
                const decisions = storage.getDeletedDecisions ? await storage.getDeletedDecisions() : [];
                jsonResponse(res, { decisions });
            } catch (e) {
                jsonResponse(res, { error: e.message, decisions: [] }, 500);
            }
            return;
        }

        // GET /api/decisions - Get decisions (optional status query)
        if (pathname === '/api/decisions' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const status = parsedUrl.query.status || null;
                const decisions = storage.getDecisions ? await storage.getDecisions(status) : [];
                jsonResponse(res, { decisions });
            } catch (e) {
                jsonResponse(res, { error: e.message, decisions: [] }, 500);
            }
            return;
        }

        // GET /api/decisions/:id/events - Decision timeline
        const decisionEventsMatch = pathname.match(/^\/api\/decisions\/([^/]+)\/events$/);
        if (decisionEventsMatch && req.method === 'GET') {
            const decisionId = decisionEventsMatch[1];
            try {
                const events = storage.getDecisionEvents ? await storage.getDecisionEvents(decisionId) : [];
                jsonResponse(res, { events });
            } catch (e) {
                jsonResponse(res, { error: e.message, events: [] }, 500);
            }
            return;
        }

        // GET /api/decisions/:id/similar - Similar decisions
        const decisionSimilarMatch = pathname.match(/^\/api\/decisions\/([^/]+)\/similar$/);
        if (decisionSimilarMatch && req.method === 'GET') {
            const decisionId = decisionSimilarMatch[1];
            const parsedUrl = parseUrl(req.url);
            const limit = Math.min(parseInt(parsedUrl.query.limit, 10) || 10, 50);
            try {
                const similar = storage.getSimilarDecisions ? await storage.getSimilarDecisions(decisionId, limit) : [];
                jsonResponse(res, { similar: similar.map(s => ({ decision: s.decision, similarityScore: s.similarityScore })) });
            } catch (e) {
                jsonResponse(res, { error: e.message, similar: [] }, 500);
            }
            return;
        }

        // POST /api/decisions/:id/restore - Restore soft-deleted decision
        const decisionRestoreMatch = pathname.match(/^\/api\/decisions\/([^/]+)\/restore$/);
        if (decisionRestoreMatch && req.method === 'POST') {
            const decisionId = decisionRestoreMatch[1];
            try {
                const decision = storage.restoreDecision ? await storage.restoreDecision(decisionId) : null;
                if (!decision) {
                    jsonResponse(res, { error: 'Decision not found or not deleted' }, 404);
                    return;
                }
                jsonResponse(res, { decision });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/decisions/:id - Get single decision
        const decisionIdMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/);
        if (decisionIdMatch && req.method === 'GET') {
            const decisionId = decisionIdMatch[1];
            try {
                const decision = storage.getDecision ? await storage.getDecision(decisionId) : null;
                if (!decision) {
                    jsonResponse(res, { error: 'Decision not found' }, 404);
                    return;
                }
                jsonResponse(res, { decision });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/decisions/:id - Update decision
        const decisionPutMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/);
        if (decisionPutMatch && req.method === 'PUT') {
            const decisionId = decisionPutMatch[1];
            try {
                const body = await parseBody(req);
                const updates = {
                    content: body.content || body.decision,
                    owner: body.owner,
                    date: body.decision_date || body.date,
                    context: body.context,
                    status: body.status,
                    rationale: body.rationale,
                    made_by: body.made_by,
                    approved_by: body.approved_by,
                    decided_at: body.decided_at,
                    impact: body.impact,
                    reversible: body.reversible,
                    summary: body.summary
                };
                Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
                const decision = storage.updateDecision ? await storage.updateDecision(decisionId, updates) : null;
                if (!decision) {
                    jsonResponse(res, { error: 'Decision not found' }, 404);
                    return;
                }
                jsonResponse(res, { decision });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // DELETE /api/decisions/:id - Soft delete decision
        const decisionDelMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/);
        if (decisionDelMatch && req.method === 'DELETE') {
            const decisionId = decisionDelMatch[1];
            try {
                if (storage.deleteDecision) await storage.deleteDecision(decisionId, true);
                jsonResponse(res, { ok: true });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/decisions/suggest - AI suggest rationale, impact, summary (before POST /api/decisions)
        if (pathname === '/api/decisions/suggest' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const content = (body.content || body.decision || '').trim();
                const rationale = (body.rationale || '').trim();
                const { runDecisionSuggest } = require('./decision-suggest/DecisionSuggestFlow');
                const result = await runDecisionSuggest(config, { content, rationale });
                if (result.error) {
                    jsonResponse(res, { error: result.error }, 400);
                    return;
                }
                jsonResponse(res, {
                    rationale: result.rationale || '',
                    impact: result.impact || 'medium',
                    impact_summary: result.impact_summary || '',
                    summary: result.summary || ''
                });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/decisions/suggest-owner - AI suggest owner (made_by) from decision content, project contacts only
        if (pathname === '/api/decisions/suggest-owner' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const content = (body.content || body.decision || '').trim();
                const rationale = (body.rationale || '').trim();
                const contacts = storage.getContacts ? await (Promise.resolve(storage.getContacts()).then(c => Array.isArray(c) ? c : [])) : [];
                const { runDecisionSuggestOwner } = require('./decision-suggest/DecisionSuggestOwnerFlow');
                const result = await runDecisionSuggestOwner(config, { content, rationale, contacts });
                if (result.error) {
                    jsonResponse(res, { error: result.error }, 400);
                    return;
                }
                jsonResponse(res, {
                    suggested_owners: Array.isArray(result.suggested_owners) ? result.suggested_owners : []
                });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/decisions - Create decision
        if (pathname === '/api/decisions' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const content = (body.content || body.decision || '').trim();
                if (!content) {
                    jsonResponse(res, { error: 'Content is required' }, 400);
                    return;
                }
                const decision = {
                    content,
                    owner: body.owner,
                    date: body.decision_date || body.date,
                    context: body.context || body.rationale,
                    status: body.status || 'active',
                    source_document_id: body.source_document_id,
                    source_file: body.source_file,
                    generation_source: body.generation_source || 'manual',
                    rationale: body.rationale,
                    made_by: body.made_by || body.owner,
                    approved_by: body.approved_by,
                    decided_at: body.decided_at,
                    impact: body.impact,
                    reversible: body.reversible,
                    summary: body.summary
                };
                const created = storage.addDecision ? await storage.addDecision(decision) : null;
                if (!created) {
                    jsonResponse(res, { error: 'Failed to create decision' }, 500);
                    return;
                }
                jsonResponse(res, { decision: created, id: created.id });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/risks/deleted - List soft-deleted risks
        if (pathname === '/api/risks/deleted' && req.method === 'GET') {
            try {
                const risks = storage.getDeletedRisks ? await storage.getDeletedRisks() : [];
                jsonResponse(res, { risks });
            } catch (e) {
                jsonResponse(res, { error: e.message, risks: [] }, 500);
            }
            return;
        }

        // GET /api/risks/:id/events - Risk timeline
        const riskEventsMatch = pathname.match(/^\/api\/risks\/([^/]+)\/events$/);
        if (riskEventsMatch && req.method === 'GET') {
            const riskId = riskEventsMatch[1];
            try {
                const events = storage.getRiskEvents ? await storage.getRiskEvents(riskId) : [];
                jsonResponse(res, { events });
            } catch (e) {
                jsonResponse(res, { error: e.message, events: [] }, 500);
            }
            return;
        }

        // POST /api/risks/:id/restore - Restore soft-deleted risk
        const riskRestoreMatch = pathname.match(/^\/api\/risks\/([^/]+)\/restore$/);
        if (riskRestoreMatch && req.method === 'POST') {
            const riskId = riskRestoreMatch[1];
            try {
                const risk = storage.restoreRisk ? await storage.restoreRisk(riskId) : null;
                if (!risk) {
                    jsonResponse(res, { error: 'Risk not found or not deleted' }, 404);
                    return;
                }
                jsonResponse(res, { risk });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/risks/:id - Get single risk
        const riskIdMatch = pathname.match(/^\/api\/risks\/([^/]+)$/);
        if (riskIdMatch && req.method === 'GET') {
            const riskId = riskIdMatch[1];
            try {
                const risk = storage.getRisk ? await storage.getRisk(riskId) : null;
                if (!risk) {
                    jsonResponse(res, { error: 'Risk not found' }, 404);
                    return;
                }
                jsonResponse(res, { risk });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/risks/:id - Update risk
        if (riskIdMatch && req.method === 'PUT') {
            const riskId = riskIdMatch[1];
            try {
                const body = await parseBody(req);
                const updates = {
                    content: body.content ?? body.description,
                    impact: body.impact,
                    likelihood: body.likelihood ?? body.probability,
                    mitigation: body.mitigation,
                    status: body.status,
                    owner: body.owner,
                    source_file: body.source_file
                };
                Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
                const risk = storage.updateRisk ? await storage.updateRisk(riskId, updates) : null;
                if (!risk) {
                    jsonResponse(res, { error: 'Risk not found' }, 404);
                    return;
                }
                jsonResponse(res, { risk });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // DELETE /api/risks/:id - Soft delete risk
        if (riskIdMatch && req.method === 'DELETE') {
            const riskId = riskIdMatch[1];
            try {
                if (storage.deleteRisk) await storage.deleteRisk(riskId, true);
                jsonResponse(res, { ok: true, id: riskId });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/risks - Get risks
        if (pathname === '/api/risks' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const status = parsedUrl.query.status || null;
                const risks = storage.getRisks ? await storage.getRisks(status) : [];
                jsonResponse(res, { risks });
            } catch (e) {
                jsonResponse(res, { error: e.message, risks: [] }, 500);
            }
            return;
        }

        // POST /api/risks/suggest - AI suggest owner and mitigation (uses project contacts like questions)
        if (pathname === '/api/risks/suggest' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const content = (body.content ?? body.description ?? '').trim();
                const impact = body.impact || 'medium';
                const likelihood = (body.likelihood ?? body.probability) || 'medium';
                const contacts = storage.getContacts ? await (Promise.resolve(storage.getContacts()).then(c => Array.isArray(c) ? c : [])) : [];
                const { runRiskSuggest } = require('./risk-suggest/RiskSuggestFlow');
                const result = await runRiskSuggest(config, { content, impact, likelihood, contacts });
                if (result.error) {
                    jsonResponse(res, { error: result.error }, 400);
                    return;
                }
                jsonResponse(res, {
                    suggested_owner: result.suggested_owner || '',
                    suggested_mitigation: result.suggested_mitigation || '',
                    suggested_owners: Array.isArray(result.suggested_owners) ? result.suggested_owners : []
                });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/risks - Create risk
        if (pathname === '/api/risks' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const content = (body.content ?? body.description ?? '').trim();
                if (!content) {
                    jsonResponse(res, { error: 'Content is required' }, 400);
                    return;
                }
                const risk = {
                    content,
                    impact: body.impact || 'medium',
                    likelihood: (body.likelihood ?? body.probability) || 'medium',
                    mitigation: body.mitigation,
                    status: body.status || 'open',
                    owner: body.owner,
                    source_document_id: body.source_document_id,
                    source_file: body.source_file,
                    generation_source: body.generation_source || 'manual'
                };
                const created = storage.addRisk ? await storage.addRisk(risk) : null;
                if (!created) {
                    jsonResponse(res, { error: 'Failed to create risk' }, 500);
                    return;
                }
                jsonResponse(res, { risk: created, id: created.id });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/actions - Get action items
        if (pathname === '/api/actions' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status;
            const actions = storage.getActions ? await storage.getActions(status) : (storage.getActionItems ? storage.getActionItems(status) : []);
            jsonResponse(res, { actions: Array.isArray(actions) ? actions : [] });
            return;
        }

        // POST /api/actions - Create action
        if (pathname === '/api/actions' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const task = (body.task || body.content || '').trim();
                if (!task) {
                    jsonResponse(res, { error: 'Task/content is required' }, 400);
                    return;
                }
                const action = await storage.addActionItem({
                    task,
                    owner: body.owner || body.assignee || null,
                    deadline: body.deadline || body.due_date || null,
                    priority: body.priority || 'medium',
                    status: body.status || 'pending',
                    source_file: body.source_file || null,
                });
                jsonResponse(res, { action, id: action.id });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/actions/:id - Update action
        const putActionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
        if (putActionMatch && req.method === 'PUT') {
            try {
                const actionId = putActionMatch[1];
                const body = await parseBody(req);
                const updates = {
                    task: body.task || body.content,
                    owner: body.owner ?? body.assignee,
                    deadline: body.deadline ?? body.due_date,
                    priority: body.priority,
                    status: body.status,
                };
                Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
                const action = await storage.updateAction(actionId, updates);
                jsonResponse(res, { action });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PATCH /api/actions/:id - Partial update (e.g. status)
        const patchActionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
        if (patchActionMatch && req.method === 'PATCH') {
            try {
                const actionId = patchActionMatch[1];
                const body = await parseBody(req);
                const updates = {};
                if (body.status !== undefined) updates.status = body.status;
                if (body.priority !== undefined) updates.priority = body.priority;
                if (body.task !== undefined) updates.task = body.task;
                if (body.content !== undefined) updates.task = body.content;
                if (body.owner !== undefined) updates.owner = body.owner;
                if (body.assignee !== undefined) updates.owner = body.assignee;
                if (body.deadline !== undefined) updates.deadline = body.deadline;
                if (body.due_date !== undefined) updates.deadline = body.due_date;
                const action = await storage.updateAction(actionId, updates);
                jsonResponse(res, { action });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // DELETE /api/actions/:id - Delete action
        const deleteActionMatch = pathname.match(/^\/api\/actions\/([^/]+)$/);
        if (deleteActionMatch && req.method === 'DELETE') {
            try {
                const actionId = deleteActionMatch[1];
                await storage.deleteAction(actionId, true);
                jsonResponse(res, { ok: true });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/actions/:id/events - Action timeline
        const actionEventsMatch = pathname.match(/^\/api\/actions\/([^/]+)\/events$/);
        if (actionEventsMatch && req.method === 'GET') {
            try {
                const actionId = actionEventsMatch[1];
                const events = storage.getActionEvents ? await storage.getActionEvents(actionId) : [];
                jsonResponse(res, { events: events || [] });
            } catch (e) {
                jsonResponse(res, { error: e.message, events: [] }, 500);
            }
            return;
        }

        // POST /api/actions/suggest - AI suggest assignee (uses project contacts)
        if (pathname === '/api/actions/suggest' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const content = (body.content ?? body.task ?? '').trim();
                const contacts = storage.getContacts ? await (Promise.resolve(storage.getContacts()).then(c => Array.isArray(c) ? c : [])) : [];
                const { runActionSuggest } = require('./action-suggest/ActionSuggestFlow');
                const result = await runActionSuggest(config, { content, contacts });
                if (result.error) {
                    jsonResponse(res, { error: result.error }, 400);
                    return;
                }
                jsonResponse(res, {
                    suggested_assignees: Array.isArray(result.suggested_assignees) ? result.suggested_assignees : []
                });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/people - Get people
        if (pathname === '/api/people' && req.method === 'GET') {
            const people = storage.getPeople();
            jsonResponse(res, { people });
            return;
        }

        // GET /api/questions/by-person - Get questions grouped by person
        if (pathname === '/api/questions/by-person' && req.method === 'GET') {
            const grouped = storage.getQuestionsByPerson();
            jsonResponse(res, { questionsByPerson: grouped });
            return;
        }

        // GET /api/questions/by-team - Get questions grouped by team/category
        if (pathname === '/api/questions/by-team' && req.method === 'GET') {
            const grouped = storage.getQuestionsByTeam();
            jsonResponse(res, { questionsByTeam: grouped });
            return;
        }

        // GET /api/questions/suggest-assignee - Get suggested assignees for a question (ENHANCED with AI + Graph)
        if (pathname === '/api/questions/suggest-assignee' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const content = parsedUrl.query.content || '';
            const questionId = parsedUrl.query.id;
            const useAI = parsedUrl.query.ai !== 'false'; // Default to using AI
            const forceRefresh = parsedUrl.query.refresh === 'true'; // Force regenerate suggestions

            // If question ID is provided, get the content from the question
            let questionContent = content;
            let questionData = null;
            if (questionId && !content) {
                // Support both numeric IDs and UUIDs
                const questions = storage.getQuestions();
                questionData = questions.find(q => 
                    q.id === questionId || 
                    q.id === parseInt(questionId) ||
                    String(q.id) === String(questionId)
                );
                if (questionData) {
                    questionContent = questionData.content;
                }
            }

            if (!questionContent) {
                jsonResponse(res, { suggestions: [], error: 'No question content provided' });
                return;
            }

            // CHECK CACHE: If question has cached suggestions and not forcing refresh, return them
            if (questionId && questionData && !forceRefresh) {
                const cachedSuggestions = questionData.cached_suggestions || questionData.cachedSuggestions;
                if (cachedSuggestions && Array.isArray(cachedSuggestions) && cachedSuggestions.length > 0) {
                    console.log(`[Suggest] Using cached suggestions for question ${questionId}`);
                    jsonResponse(res, { 
                        suggestions: cachedSuggestions, 
                        category: questionData.category || storage.categorizeQuestion(questionContent),
                        method: 'cached',
                        cached: true,
                        cachedAt: questionData.suggestions_generated_at || questionData.suggestionsGeneratedAt
                    });
                    return;
                }
            }

            // Get basic suggestions from expertise history
            const basicSuggestions = storage.getExpertiseSuggestions(questionContent);
            const category = storage.categorizeQuestion(questionContent);
            
            // Debug log
            const contacts = await storage.getContacts();
            console.log(`[Suggest] Question: "${questionContent.substring(0, 50)}...", Category: ${category}, Contacts: ${contacts.length}, BasicSuggestions: ${basicSuggestions.length}`);
            
            // If AI is disabled or LLM not configured, return basic suggestions
            if (!useAI || !config.llm?.provider) {
                jsonResponse(res, { suggestions: basicSuggestions, category, method: 'keyword' });
                return;
            }

            try {
                // ENHANCED: Use AI + FalkorDB + Contacts for better suggestions
                const contacts = await storage.getContacts();
                const people = storage.knowledge?.people || [];
                const facts = storage.getFacts() || [];
                const decisions = storage.knowledge?.decisions || [];
                const graphProvider = storage.getGraphProvider();
                
                // Build context about known people and their expertise
                let peopleContext = '';
                for (const contact of contacts.slice(0, 20)) {
                    const activities = (contact.activity || []).slice(0, 5).map(a => a.title).join(', ');
                    peopleContext += `- ${contact.name}: Role: ${contact.role || 'Unknown'}, Org: ${contact.organization || 'Unknown'}`;
                    if (activities) peopleContext += `, Activities: ${activities}`;
                    peopleContext += '\n';
                }
                
                // Add FACTS context - what information was extracted
                let factsContext = '';
                if (facts.length > 0) {
                    factsContext = '\n\nEXTRACTED FACTS FROM DOCUMENTS:\n';
                    for (const fact of facts.slice(0, 15)) {
                        factsContext += `- [${fact.category || 'general'}] ${fact.content}\n`;
                    }
                }
                
                // Add DECISIONS context - who decided what
                let decisionsContext = '';
                if (decisions.length > 0) {
                    decisionsContext = '\n\nDECISIONS MADE:\n';
                    for (const dec of decisions.slice(0, 10)) {
                        const owner = dec.owner || 'Unknown';
                        decisionsContext += `- ${dec.content} (by: ${owner})\n`;
                    }
                }
                
                // Add PEOPLE context from knowledge - what role/expertise they have
                let knowledgePeopleContext = '';
                if (people.length > 0) {
                    knowledgePeopleContext = '\n\nPEOPLE MENTIONED IN DOCUMENTS:\n';
                    for (const p of people.slice(0, 15)) {
                        knowledgePeopleContext += `- ${p.name}`;
                        if (p.role) knowledgePeopleContext += ` (${p.role})`;
                        if (p.organization) knowledgePeopleContext += ` at ${p.organization}`;
                        knowledgePeopleContext += '\n';
                    }
                }
                
                // Query FalkorDB for related people and their expertise (skip when using Supabase Graph – Cypher not supported)
                let graphContext = '';
                const isFalkor = graphProvider?.constructor?.info?.id !== 'supabase';
                if (graphProvider && graphProvider.connected && isFalkor) {
                    try {
                        // Find people with their relationships (who made decisions, attended meetings, etc.)
                        const graphResult = await graphProvider.query(`
                            MATCH (p:Person)-[r]->(n)
                            RETURN p.name as name, type(r) as relation, labels(n)[0] as targetType, count(*) as count
                            ORDER BY count DESC
                            LIMIT 30
                        `);
                        
                        if (graphResult.data && graphResult.data.length > 0) {
                            // Group by person
                            const personStats = {};
                            for (const row of graphResult.data) {
                                const name = row.name || row['p.name'];
                                const relation = row.relation || row['type(r)'];
                                const target = row.targetType || row['labels(n)[0]'];
                                const count = row.count || row['count(*)'] || 1;
                                
                                if (!name) continue;
                                if (!personStats[name]) personStats[name] = { relations: [], total: 0 };
                                personStats[name].relations.push(`${relation} ${target}`);
                                personStats[name].total += count;
                            }
                            
                            graphContext = '\n\nFrom Knowledge Graph (expertise indicators):\n';
                            for (const [name, stats] of Object.entries(personStats)) {
                                const uniqueRels = [...new Set(stats.relations)].join(', ');
                                graphContext += `- ${name}: ${uniqueRels} (${stats.total} connections)\n`;
                            }
                        }
                    } catch (graphErr) {
                        console.log('[Questions] Graph query error:', graphErr.message);
                    }
                }
                
                // Use AI to analyze and suggest
                const prompt = `Analyze this question and suggest who should answer it based on the available people and context.

QUESTION: "${questionContent}"
${questionData?.context ? `\nCONTEXT: ${questionData.context}` : ''}
${questionData?.why ? `\nWHY THIS MATTERS: ${questionData.why}` : ''}

CATEGORY DETECTED: ${category}

AVAILABLE PEOPLE (contacts directory):
${peopleContext || 'No people profiles available yet.'}
${knowledgePeopleContext}
${factsContext}
${decisionsContext}
${graphContext}

HISTORICAL SUGGESTIONS (based on past assignments):
${basicSuggestions.length > 0 ? basicSuggestions.map(s => `- ${s.person}: ${s.reason} (score: ${s.score})`).join('\n') : 'No historical data available.'}

Based on this information, suggest up to 3 people who would be best suited to answer this question.
For each suggestion, explain WHY they are suitable.

Respond in this exact format:
SUGGESTION_1: <name>|<confidence 0-100>|<reason why they can answer this>
SUGGESTION_2: <name>|<confidence 0-100>|<reason why they can answer this>
SUGGESTION_3: <name>|<confidence 0-100>|<reason why they can answer this>

If you cannot suggest anyone, respond with:
NO_SUGGESTIONS: <explanation>`;

                const suggestTextCfg = llmConfig.getTextConfig(config);
                const llmResult = await llm.generateText({
                    provider: suggestTextCfg.provider,
                    providerConfig: suggestTextCfg.providerConfig,
                    model: suggestTextCfg.model,
                    prompt: prompt,
                    maxTokens: 800,
                    temperature: 0.3,
                    providerConfig: config.llm?.providers?.[config.llm?.provider] || {},
                    context: 'question'
                });
                
                const aiResponse = llmResult.success ? llmResult.text : null;
                
                console.log('[Questions] AI Raw Response:', aiResponse?.substring(0, 300) || 'null');
                
                // Check if we got a valid response
                if (!aiResponse || typeof aiResponse !== 'string') {
                    throw new Error('No valid AI response received');
                }
                
                // Parse AI suggestions
                const aiSuggestions = [];
                const suggestionMatches = [...aiResponse.matchAll(/SUGGESTION_\d+:\s*([^|]+)\|(\d+)\|(.+)/g)];
                
                for (const match of suggestionMatches) {
                    const name = match[1].trim();
                    const confidence = parseInt(match[2]);
                    const reason = match[3].trim();
                    
                    // Find matching contact
                    const contact = storage.findContactByName(name);
                    
                    aiSuggestions.push({
                        person: name,
                        score: confidence,
                        reason: reason,
                        contactId: contact?.id || null,
                        role: contact?.role || null,
                        organization: contact?.organization || null,
                        method: 'ai'
                    });
                }
                
                // Check for no suggestions
                const noSuggestionsMatch = aiResponse.match(/NO_SUGGESTIONS:\s*(.+)/);
                if (noSuggestionsMatch && aiSuggestions.length === 0) {
                    jsonResponse(res, { 
                        suggestions: basicSuggestions, 
                        category, 
                        method: 'fallback',
                        aiNote: noSuggestionsMatch[1].trim()
                    });
                    return;
                }
                
                // Combine AI suggestions with basic suggestions, removing duplicates
                const combinedSuggestions = [...aiSuggestions];
                for (const basic of basicSuggestions) {
                    if (!combinedSuggestions.some(s => s.person.toLowerCase() === basic.person.toLowerCase())) {
                        combinedSuggestions.push({ ...basic, method: 'history' });
                    }
                }
                
                // Sort by score
                combinedSuggestions.sort((a, b) => b.score - a.score);
                
                const finalSuggestions = combinedSuggestions.slice(0, 5);
                
                // CACHE: Save suggestions to database to avoid regenerating
                if (questionId) {
                    try {
                        await storage.updateQuestion(questionId, {
                            cached_suggestions: finalSuggestions,
                            suggestions_generated_at: new Date().toISOString(),
                            category: category
                        });
                        console.log(`[Suggest] Cached ${finalSuggestions.length} suggestions for question ${questionId}`);
                    } catch (cacheErr) {
                        console.log('[Suggest] Cache save warning:', cacheErr.message);
                    }
                }
                
                jsonResponse(res, { 
                    suggestions: finalSuggestions, 
                    category, 
                    method: 'ai+graph+history',
                    aiAnalysis: true,
                    cached: false
                });
                
            } catch (aiError) {
                console.log('[Questions] AI suggestion error:', aiError.message);
                // Fallback to basic suggestions - also cache these
                if (questionId && basicSuggestions.length > 0) {
                    try {
                        await storage.updateQuestion(questionId, {
                            cached_suggestions: basicSuggestions,
                            suggestions_generated_at: new Date().toISOString(),
                            category: category
                        });
                    } catch (e) { /* ignore */ }
                }
                jsonResponse(res, { suggestions: basicSuggestions, category, method: 'fallback', error: aiError.message });
            }
            return;
        }

        // =====================================================
        // QUESTIONS SOTA ENDPOINTS
        // =====================================================

        // GET /api/questions/:id/chain - Get question chain (parent + children follow-ups)
        const questionChainMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/chain$/);
        if (questionChainMatch && req.method === 'GET') {
            const questionId = questionChainMatch[1];
            
            try {
                const questions = storage.getQuestions();
                const question = questions.find(q => String(q.id) === questionId);
                
                if (!question) {
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                // Get parent (if this is a follow-up)
                let parent = null;
                if (question.follow_up_to) {
                    parent = questions.find(q => String(q.id) === String(question.follow_up_to));
                }
                
                // Get children (follow-ups of this question)
                const children = questions.filter(q => 
                    String(q.follow_up_to) === questionId && 
                    !q.deleted_at
                );
                
                // Try to get from Graph if available
                let graphChain = null;
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        const { getGraphSync } = require('./sync');
                        const graphSync = getGraphSync({ graphProvider, storage });
                        
                        if (graphSync && graphSync.isGraphAvailable()) {
                            const graphResult = await graphSync.graphProvider.query(`
                                MATCH (q:Question {id: $questionId})
                                OPTIONAL MATCH (parent:Question)-[:HAS_FOLLOWUP]->(q)
                                OPTIONAL MATCH (q)-[:HAS_FOLLOWUP]->(child:Question)
                                RETURN parent, collect(DISTINCT child) as children
                            `, { questionId });
                            
                            if (graphResult && graphResult.length > 0) {
                                graphChain = graphResult[0];
                            }
                        }
                    } catch (e) {
                        console.log('[Questions] Graph chain query error:', e.message);
                    }
                }
                
                jsonResponse(res, {
                    question,
                    parent,
                    children,
                    graphData: graphChain
                });
            } catch (e) {
                console.error('[Questions] Chain error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/:id/timeline - Get question event timeline
        const questionTimelineMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/timeline$/);
        if (questionTimelineMatch && req.method === 'GET') {
            const questionId = questionTimelineMatch[1];
            
            try {
                // Get events from Supabase if available
                let events = [];
                if (storage.supabase) {
                    const { data, error } = await storage.supabase
                        .from('question_events')
                        .select('*')
                        .eq('question_id', questionId)
                        .order('created_at', { ascending: false });
                    
                    if (!error && data) {
                        events = data;
                    }
                }
                
                // If no events from DB, reconstruct from question history
                if (events.length === 0) {
                    const questions = storage.getQuestions();
                    const question = questions.find(q => String(q.id) === questionId);
                    
                    if (question) {
                        // Create synthetic events from question data
                        events.push({
                            id: `${questionId}_created`,
                            event_type: 'created',
                            event_data: { priority: question.priority, status: question.status },
                            created_at: question.created_at
                        });
                        
                        if (question.assigned_to) {
                            events.push({
                                id: `${questionId}_assigned`,
                                event_type: 'assigned',
                                event_data: { to: question.assigned_to },
                                actor_name: question.assigned_to,
                                created_at: question.assigned_at || question.created_at
                            });
                        }
                        
                        if (question.answer) {
                            events.push({
                                id: `${questionId}_answered`,
                                event_type: 'answered',
                                event_data: { 
                                    source: question.answer_source,
                                    answer_preview: question.answer.substring(0, 100)
                                },
                                actor_name: question.answered_by_name || question.assigned_to,
                                created_at: question.answered_at || question.resolved_at
                            });
                        }
                        
                        if (question.reopen_reason) {
                            events.push({
                                id: `${questionId}_reopened`,
                                event_type: 'reopened',
                                event_data: { reason: question.reopen_reason },
                                created_at: question.reopened_at
                            });
                        }
                        
                        // Sort by date desc
                        events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    }
                }
                
                jsonResponse(res, { events, questionId });
            } catch (e) {
                console.error('[Questions] Timeline error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/check-answer - Check if knowledge base has potential answers
        const questionCheckAnswerMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/check-answer$/);
        if (questionCheckAnswerMatch && req.method === 'POST') {
            const questionId = questionCheckAnswerMatch[1];
            
            try {
                const questions = storage.getQuestions();
                const question = questions.find(q => String(q.id) === questionId);
                
                if (!question) {
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                const potentialAnswers = [];
                const questionContent = question.content.toLowerCase();
                const questionWords = questionContent.split(/\s+/).filter(w => w.length > 3);
                
                // Check facts for potential answers
                const facts = storage.getFacts();
                for (const fact of facts.slice(-100)) { // Check last 100 facts
                    const factContent = (fact.content || '').toLowerCase();
                    const matchingWords = questionWords.filter(w => factContent.includes(w));
                    const matchRatio = matchingWords.length / questionWords.length;
                    
                    if (matchRatio >= 0.3 && matchingWords.length >= 2) {
                        potentialAnswers.push({
                            type: 'fact',
                            id: fact.id,
                            content: fact.content,
                            category: fact.category,
                            confidence: Math.round(matchRatio * 100) / 100,
                            source: fact.source_file
                        });
                    }
                }
                
                // Check decisions for potential answers
                const decisions = storage.getDecisions();
                for (const dec of decisions.slice(-50)) {
                    const decContent = (dec.content || dec).toString().toLowerCase();
                    const matchingWords = questionWords.filter(w => decContent.includes(w));
                    const matchRatio = matchingWords.length / questionWords.length;
                    
                    if (matchRatio >= 0.3 && matchingWords.length >= 2) {
                        potentialAnswers.push({
                            type: 'decision',
                            id: dec.id,
                            content: dec.content || dec,
                            owner: dec.owner,
                            confidence: Math.round(matchRatio * 100) / 100,
                            source: dec.source_file
                        });
                    }
                }
                
                // Sort by confidence
                potentialAnswers.sort((a, b) => b.confidence - a.confidence);
                
                jsonResponse(res, {
                    questionId,
                    question: question.content,
                    potentialAnswers: potentialAnswers.slice(0, 10),
                    totalFound: potentialAnswers.length
                });
            } catch (e) {
                console.error('[Questions] Check answer error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/:id/similar - Get semantically similar questions
        const questionSimilarMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/similar$/);
        if (questionSimilarMatch && req.method === 'GET') {
            const questionId = questionSimilarMatch[1];
            const parsedUrl = parseUrl(req.url);
            const limit = parseInt(parsedUrl.query.limit) || 5;
            
            try {
                const questions = storage.getQuestions();
                const question = questions.find(q => String(q.id) === questionId);
                
                if (!question) {
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                // Check cache in Supabase first
                let similar = [];
                if (storage.supabase) {
                    const { data } = await storage.supabase
                        .from('question_similarities')
                        .select('similar_question_id, similarity_score')
                        .eq('question_id', questionId)
                        .order('similarity_score', { ascending: false })
                        .limit(limit);
                    
                    if (data && data.length > 0) {
                        for (const row of data) {
                            const simQ = questions.find(q => String(q.id) === row.similar_question_id);
                            if (simQ && !simQ.deleted_at) {
                                similar.push({
                                    id: simQ.id,
                                    content: simQ.content,
                                    status: simQ.status,
                                    priority: simQ.priority,
                                    similarityScore: row.similarity_score
                                });
                            }
                        }
                    }
                }
                
                // If no cached similarities, compute using basic text similarity
                if (similar.length === 0) {
                    const questionWords = new Set(question.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
                    
                    for (const q of questions) {
                        if (String(q.id) === questionId || q.deleted_at) continue;
                        
                        const otherWords = new Set(q.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
                        const intersection = [...questionWords].filter(w => otherWords.has(w));
                        const union = new Set([...questionWords, ...otherWords]);
                        const jaccard = intersection.length / union.size;
                        
                        if (jaccard > 0.2) {
                            similar.push({
                                id: q.id,
                                content: q.content,
                                status: q.status,
                                priority: q.priority,
                                similarityScore: Math.round(jaccard * 100) / 100
                            });
                        }
                    }
                    
                    similar.sort((a, b) => b.similarityScore - a.similarityScore);
                    similar = similar.slice(0, limit);
                }
                
                jsonResponse(res, { questionId, similar });
            } catch (e) {
                console.error('[Questions] Similar error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/:id/related - Get related questions via shared entities (Graph)
        const questionRelatedMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/related$/);
        if (questionRelatedMatch && req.method === 'GET') {
            const questionId = questionRelatedMatch[1];
            const parsedUrl = parseUrl(req.url);
            const limit = parseInt(parsedUrl.query.limit) || 5;
            
            try {
                let related = [];
                
                // Try Graph first
                if (graphSync && graphSync.isGraphAvailable()) {
                    const graphResult = await graphSync.getRelatedQuestions(questionId, limit);
                    if (graphResult.success && graphResult.related) {
                        related = graphResult.related;
                    }
                }
                
                jsonResponse(res, { questionId, related });
            } catch (e) {
                console.error('[Questions] Related error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/knowledge-gaps - Get knowledge gap analysis
        if (pathname === '/api/questions/knowledge-gaps' && req.method === 'GET') {
            try {
                const questions = storage.getQuestions();
                const pending = questions.filter(q => 
                    (q.status === 'pending' || q.status === 'open' || q.status === 'assigned') && 
                    !q.deleted_at
                );
                
                // Group by category
                const gaps = {};
                for (const q of pending) {
                    const cat = q.category || 'Uncategorized';
                    if (!gaps[cat]) {
                        gaps[cat] = { category: cat, pending: 0, total: 0, critical: 0, high: 0, questions: [] };
                    }
                    gaps[cat].pending++;
                    gaps[cat].total++;
                    if (q.priority === 'critical') gaps[cat].critical++;
                    if (q.priority === 'high') gaps[cat].high++;
                    gaps[cat].questions.push({ id: q.id, content: q.content, priority: q.priority });
                }
                
                // Count resolved per category
                for (const q of questions.filter(q => q.status === 'resolved')) {
                    const cat = q.category || 'Uncategorized';
                    if (gaps[cat]) gaps[cat].total++;
                }
                
                // Convert to array and sort by pending count
                const gapsArray = Object.values(gaps).sort((a, b) => b.pending - a.pending);
                
                // Try to get from materialized view if Supabase available
                let materializedGaps = null;
                if (storage.supabase) {
                    const { data } = await storage.supabase
                        .from('knowledge_gaps')
                        .select('*')
                        .order('pending_count', { ascending: false });
                    
                    if (data) {
                        materializedGaps = data;
                    }
                }
                
                jsonResponse(res, { 
                    gaps: gapsArray,
                    materializedGaps,
                    summary: {
                        totalPending: pending.length,
                        categoriesWithGaps: gapsArray.length,
                        criticalGaps: gapsArray.filter(g => g.critical > 0).length
                    }
                });
            } catch (e) {
                console.error('[Questions] Knowledge gaps error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/templates - Get role question templates
        if (pathname === '/api/questions/templates' && req.method === 'GET') {
            try {
                let templates = [];
                
                if (storage.supabase) {
                    const { data, error } = await storage.supabase
                        .from('role_question_templates')
                        .select('*')
                        .eq('is_active', true)
                        .order('category', { ascending: true });
                    
                    if (!error && data) {
                        templates = data;
                    }
                }
                
                // Group by role pattern for easier consumption
                const byRole = {};
                for (const t of templates) {
                    const pattern = t.role_pattern;
                    if (!byRole[pattern]) {
                        byRole[pattern] = { pattern, category: t.category, templates: [] };
                    }
                    byRole[pattern].templates.push({
                        id: t.id,
                        question: t.question_template,
                        priority: t.priority,
                        context: t.context_template
                    });
                }
                
                jsonResponse(res, { templates, byRole: Object.values(byRole) });
            } catch (e) {
                console.error('[Questions] Templates error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/generate-for-team - Generate questions for team based on roles
        if (pathname === '/api/questions/generate-for-team' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { memberIds, documentContext, useAI, skipDuplicates = true } = body;
                
                // Get contacts for this project
                let contacts = storage.getContacts ? storage.getContacts() : [];
                
                // Filter by memberIds if provided
                if (memberIds && memberIds.length > 0) {
                    contacts = contacts.filter(c => memberIds.includes(c.id));
                }
                
                // Get templates from database
                let templates = [];
                if (storage.supabase) {
                    const { data } = await storage.supabase
                        .from('role_question_templates')
                        .select('*')
                        .eq('is_active', true);
                    
                    if (data) templates = data;
                }
                
                const generated = [];
                const skipped = [];
                const existingQuestions = storage.getQuestions();
                
                for (const contact of contacts) {
                    if (!contact.role) continue;
                    
                    const role = contact.role.toLowerCase();
                    
                    // Find matching templates
                    const matchingTemplates = templates.filter(t => {
                        const pattern = new RegExp(t.role_pattern, 'i');
                        return pattern.test(role);
                    });
                    
                    for (const template of matchingTemplates) {
                        // Check for duplicates
                        if (skipDuplicates) {
                            const isDuplicate = existingQuestions.some(q => {
                                const similarity = calculateTextSimilarity(q.content, template.question_template);
                                return similarity > 0.8;
                            });
                            
                            if (isDuplicate) {
                                skipped.push({ template: template.question_template, reason: 'duplicate' });
                                continue;
                            }
                        }
                        
                        // Create the question
                        const questionData = {
                            content: template.question_template,
                            context: template.context_template || (documentContext ? `Context: ${documentContext.substring(0, 200)}` : ''),
                            priority: template.priority || 'medium',
                            category: template.category,
                            assigned_to: contact.name,
                            generation_source: 'template',
                            template_id: template.id,
                            source_file: 'auto_generated'
                        };
                        
                        const result = storage.addQuestion(questionData, true); // Skip dedup
                        
                        if (result.action === 'added' || result.id) {
                            generated.push({
                                id: result.id,
                                content: template.question_template,
                                assigned_to: contact.name,
                                priority: template.priority,
                                source: 'template'
                            });
                            
                            // Sync to graph
                            if (graphSync && graphSync.isGraphAvailable()) {
                                const newQ = storage.getQuestions().find(q => q.id === result.id);
                                if (newQ) await graphSync.syncQuestion(newQ);
                            }
                        }
                    }
                }
                
                jsonResponse(res, {
                    success: true,
                    generated: generated.length,
                    skipped: skipped.length,
                    questions: generated,
                    skippedDetails: skipped
                });
            } catch (e) {
                console.error('[Questions] Generate for team error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // Helper function for text similarity
        function calculateTextSimilarity(text1, text2) {
            const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            const intersection = [...words1].filter(w => words2.has(w));
            const union = new Set([...words1, ...words2]);
            return intersection.length / union.size;
        }

        // GET /api/questions/team-roles - Get unique roles from project team (project_members table)
        if (pathname === '/api/questions/team-roles' && req.method === 'GET') {
            try {
                const projectInfo = storage.getCurrentProject ? storage.getCurrentProject() : null;
                const projectId = projectInfo?.id || storage.getProjectId?.() || storage.currentProjectId || storage._currentProjectId;
                
                if (!projectId) {
                    jsonResponse(res, { roles: [], totalMembers: 0, totalRoles: 0, error: 'No project selected' });
                    return;
                }
                
                // Get project members from Supabase with linked contacts
                let teamMembers = [];
                
                if (storage.supabase) {
                    const { data: projectMembers, error } = await storage.supabase
                        .from('project_members')
                        .select(`
                            user_id,
                            role,
                            user_role,
                            user_role_prompt,
                            linked_contact_id,
                            joined_at,
                            contacts:linked_contact_id (
                                id,
                                name,
                                email,
                                role,
                                organization,
                                photo_url,
                                avatar_url
                            )
                        `)
                        .eq('project_id', projectId);
                    
                    if (error) {
                        console.error('[Questions] Error fetching project members:', error);
                    } else if (projectMembers) {
                        // Map to team members with role from project_members.user_role
                        teamMembers = projectMembers
                            .filter(pm => pm.user_role) // Only those with user_role defined
                            .map(pm => ({
                                id: pm.linked_contact_id || pm.user_id,
                                name: pm.contacts?.name || 'Unknown',
                                email: pm.contacts?.email,
                                role: pm.user_role, // Use the project member's user_role
                                rolePrompt: pm.user_role_prompt,
                                organization: pm.contacts?.organization,
                                photoUrl: pm.contacts?.photo_url || pm.contacts?.avatar_url,
                                joinedAt: pm.joined_at,
                                memberRole: pm.role // owner, admin, member, etc.
                            }));
                    }
                }
                
                // Fallback to contacts if no project members found
                if (teamMembers.length === 0) {
                    let contactsRaw = storage.getContacts ? await storage.getContacts() : [];
                    const contacts = Array.isArray(contactsRaw) ? contactsRaw : (contactsRaw?.contacts || []);
                    teamMembers = contacts.filter(c => c && c.role);
                }
                
                // Group by role
                const roleMap = {};
                for (const member of teamMembers) {
                    if (!member.role) continue;
                    const role = member.role;
                    if (!roleMap[role]) {
                        roleMap[role] = {
                            role,
                            members: [],
                            count: 0
                        };
                    }
                    roleMap[role].members.push({
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        photoUrl: member.photoUrl || member.avatarUrl || member.photo_url,
                        organization: member.organization,
                        rolePrompt: member.rolePrompt // AI context for this role
                    });
                    
                    // Store rolePrompt at role level too
                    if (member.rolePrompt && !roleMap[role].rolePrompt) {
                        roleMap[role].rolePrompt = member.rolePrompt;
                    }
                    roleMap[role].count++;
                }
                
                const roles = Object.values(roleMap).sort((a, b) => b.count - a.count);
                
                jsonResponse(res, {
                    roles,
                    totalMembers: teamMembers.length,
                    totalRoles: roles.length
                });
            } catch (e) {
                console.error('[Questions] Get team roles error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/generate-ai - Generate questions using AI with project context
        if (pathname === '/api/questions/generate-ai' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { role, memberIds, count: requestedCount = 'auto', includeContext = true, skipDuplicates = true } = body;
                
                if (!role) {
                    jsonResponse(res, { error: 'Role is required' }, 400);
                    return;
                }
                
                // Get project context and calculate metrics for smart count
                let projectContext = '';
                let contextRichness = 0; // 0-10 score for how much context we have
                let existingRoleQuestions = 0;
                
                // Get all existing questions to check for role-specific ones
                const allExistingQuestions = storage.getQuestions();
                existingRoleQuestions = allExistingQuestions.filter(q => 
                    q.assigned_to_name?.toLowerCase().includes(role.toLowerCase()) ||
                    q.category?.toLowerCase().includes(role.toLowerCase())
                ).length;
                
                if (includeContext) {
                    // Get facts
                    const facts = storage.getFacts ? storage.getFacts() : [];
                    if (facts.length > 0) {
                        projectContext += 'Key Facts:\n' + facts.slice(0, 10).map(f => `- ${f.fact || f.content}`).join('\n') + '\n\n';
                        contextRichness += Math.min(facts.length, 3); // Up to 3 points for facts
                    }
                    
                    // Get existing questions for context
                    const existingQuestions = allExistingQuestions.slice(0, 5);
                    if (existingQuestions.length > 0) {
                        projectContext += 'Existing Questions:\n' + existingQuestions.map(q => `- ${q.content}`).join('\n') + '\n\n';
                        contextRichness += 1;
                    }
                    
                    // Get briefing if available
                    const briefing = storage.briefing || storage.getBriefing?.();
                    if (briefing && briefing.summary) {
                        projectContext += 'Project Summary:\n' + briefing.summary.substring(0, 500) + '\n\n';
                        contextRichness += 2; // 2 points for briefing
                    }
                    
                    // Get document summaries
                    const documents = storage.getDocuments ? storage.getDocuments() : [];
                    if (documents.length > 0) {
                        const docSummary = documents.slice(0, 5).map(d => d.name || d.filename).join(', ');
                        projectContext += 'Key Documents: ' + docSummary + '\n\n';
                        contextRichness += Math.min(documents.length, 2); // Up to 2 points for docs
                    }
                    
                    // Get risks for additional context
                    const risks = storage.getRisks ? await storage.getRisks() : [];
                    if (risks.length > 0) {
                        projectContext += 'Known Risks:\n' + risks.slice(0, 3).map(r => `- ${r.description || r.content}`).join('\n') + '\n\n';
                        contextRichness += 1;
                    }
                }
                
                // Smart count determination if count is 'auto'
                let count;
                if (requestedCount === 'auto' || requestedCount === null) {
                    // Base: 3-8 questions depending on context richness
                    // More context = more targeted questions possible
                    const baseCount = Math.max(3, Math.min(8, 3 + Math.floor(contextRichness / 2)));
                    
                    // Reduce if role already has many questions
                    const reductionForExisting = Math.min(3, Math.floor(existingRoleQuestions / 3));
                    
                    count = Math.max(2, baseCount - reductionForExisting);
                    
                    console.log(`[Questions] Auto count: ${count} (richness: ${contextRichness}, existing: ${existingRoleQuestions})`);
                } else {
                    count = parseInt(requestedCount, 10) || 5;
                }
                
                // Get contacts for the role
                const contactsResult = storage.getContacts ? await storage.getContacts() : [];
                const contacts = Array.isArray(contactsResult) ? contactsResult : [];
                let targetContacts = contacts.filter(c => 
                    c.role && c.role.toLowerCase().includes(role.toLowerCase())
                );
                
                // Filter by memberIds if provided
                if (memberIds && memberIds.length > 0) {
                    targetContacts = targetContacts.filter(c => memberIds.includes(c.id));
                }
                
                if (targetContacts.length === 0) {
                    jsonResponse(res, { error: `No team members found with role: ${role}` }, 404);
                    return;
                }
                
                // Get role template for more context
                let rolePromptTemplate = '';
                let roleFocusAreas = [];
                try {
                    const { getClient } = require('./supabase/client');
                    const client = getClient();
                    
                    // Try to find matching role template
                    const { data: templates } = await client
                        .from('role_templates')
                        .select('prompt_template, focus_areas, description')
                        .or(`display_name.ilike.%${role}%,name.ilike.%${role.replace(/\s+/g, '_')}%`)
                        .limit(1);
                    
                    if (templates && templates.length > 0) {
                        rolePromptTemplate = templates[0].prompt_template || '';
                        roleFocusAreas = templates[0].focus_areas || [];
                        console.log('[Questions] Found role template:', templates[0].prompt_template?.substring(0, 50));
                    }
                } catch (e) {
                    console.log('[Questions] Could not fetch role template:', e.message);
                }
                
                // Build AI prompt - questions FROM THE PERSPECTIVE of the selected role
                const isAutoMode = requestedCount === 'auto' || requestedCount === null;
                
                // Build role description with template if available
                const roleDescription = rolePromptTemplate 
                    ? `${role}\n\nRole Profile: ${rolePromptTemplate}${roleFocusAreas.length > 0 ? `\nFocus Areas: ${roleFocusAreas.join(', ')}` : ''}`
                    : role;
                
                const systemPrompt = `You are an expert project analyst. Your task is to generate questions that a ${role} would naturally have about this project.

${rolePromptTemplate ? `ROLE CONTEXT: ${rolePromptTemplate}` : ''}
${roleFocusAreas.length > 0 ? `KEY FOCUS AREAS: ${roleFocusAreas.join(', ')}` : ''}

Think from the perspective of this ${role}:
- What information would they need to do their job effectively?
- What aspects of the project would concern them based on their focus areas?
- What decisions or clarifications would they need?
- What risks or dependencies would they want to understand?

The questions should be:
- Written FROM the ${role}'s perspective (questions they would ASK, not answer)
- Specific to this project context - reference actual facts, documents, or known information
- Aligned with the role's focus areas and responsibilities
- Actionable and concrete (not vague or generic)
- Prioritized by importance to project success

${isAutoMode ? `Generate ${count} to ${count + 3} questions based on what a ${role} would realistically need to know.` : `Generate exactly ${count} questions.`}

Output ONLY a JSON array with this EXACT format:
[
  {"question": "What is...?", "priority": "high", "category": "Technical", "context": "Why this matters"},
  {"question": "How will...?", "priority": "medium", "category": "Business", "context": "Why this matters"}
]`;

                const userPrompt = `Project Context:
${projectContext || 'A new project requiring analysis and planning.'}

Role perspective: ${role}
Team members with this role: ${targetContacts.map(c => c.name).join(', ')}

Generate ${isAutoMode ? `${count} to ${count + 3}` : count} questions that a ${role} would have about this project.
These are questions the ${role} needs answered to do their job - the AI will later suggest who on the team is best positioned to answer each question.`;

                // Call LLM using the standard llm module
                const textCfg = llmConfig.getTextConfig(config);
                if (!textCfg.provider) {
                    jsonResponse(res, { error: 'No LLM provider configured. Please configure one in Admin settings.' }, 400);
                    return;
                }
                
                const llmResult = await llm.generateText({
                    provider: textCfg.provider,
                    model: textCfg.model || 'gpt-4o-mini',
                    providerConfig: textCfg.providerConfig,
                    prompt: userPrompt,
                    system: systemPrompt,
                    temperature: 0.7,
                    maxTokens: 2000,
                    jsonMode: true,
                    context: 'question-generation'
                });
                
                if (!llmResult.success) {
                    throw new Error(llmResult.error || 'LLM call failed');
                }
                
                const llmResponse = llmResult.text;
                
                // Parse response - handle multiple formats
                console.log('[Questions] LLM Response length:', llmResponse?.length || 0);
                
                let generatedQuestions = [];
                try {
                    // First try: extract JSON array [...] 
                    const arrayMatch = llmResponse.match(/\[[\s\S]*\]/);
                    if (arrayMatch) {
                        generatedQuestions = JSON.parse(arrayMatch[0]);
                        console.log('[Questions] Parsed array with', generatedQuestions.length, 'questions');
                    } else {
                        // Second try: extract single object {...} or multiple objects
                        const objectMatches = llmResponse.match(/\{[^{}]*"question"[^{}]*\}/g);
                        if (objectMatches && objectMatches.length > 0) {
                            for (const objStr of objectMatches) {
                                try {
                                    const obj = JSON.parse(objStr);
                                    if (obj.question) {
                                        generatedQuestions.push(obj);
                                    }
                                } catch (e) {
                                    // Skip malformed objects
                                }
                            }
                            console.log('[Questions] Parsed', generatedQuestions.length, 'individual objects');
                        }
                    }
                    
                    // If still nothing, try parsing the whole response as JSON
                    if (generatedQuestions.length === 0) {
                        try {
                            const parsed = JSON.parse(llmResponse.trim());
                            if (Array.isArray(parsed)) {
                                generatedQuestions = parsed;
                            } else if (parsed.question) {
                                generatedQuestions = [parsed];
                            } else if (parsed.questions && Array.isArray(parsed.questions)) {
                                generatedQuestions = parsed.questions;
                            }
                        } catch (e) {
                            // Not valid JSON
                        }
                    }
                } catch (parseError) {
                    console.error('[Questions] Failed to parse AI response:', parseError.message);
                }
                
                // Fallback: try line-by-line extraction
                if (generatedQuestions.length === 0) {
                    console.log('[Questions] Using fallback line parsing');
                    const lines = llmResponse.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
                    generatedQuestions = lines.slice(0, count).map(line => ({
                        question: line.replace(/^[-\d.]+\s*/, '').trim(),
                        priority: 'medium',
                        category: 'Business',
                        context: 'AI generated question'
                    }));
                }
                
                if (generatedQuestions.length === 0) {
                    console.error('[Questions] No questions generated after all parsing attempts');
                    jsonResponse(res, { error: 'AI failed to generate questions', raw: llmResponse?.substring(0, 500) }, 500);
                    return;
                }
                
                console.log('[Questions] Processing', generatedQuestions.length, 'questions');
                
                // Check for duplicates and save questions
                const existingQuestions = storage.getQuestions();
                const saved = [];
                const skipped = [];
                
                // Distribute questions among team members
                let memberIndex = 0;
                
                for (const genQ of generatedQuestions) {
                    // Check duplicate
                    if (skipDuplicates) {
                        const isDuplicate = existingQuestions.some(q => {
                            const similarity = calculateTextSimilarity(q.content, genQ.question);
                            return similarity > 0.7;
                        });
                        
                        if (isDuplicate) {
                            skipped.push({ question: genQ.question, reason: 'duplicate' });
                            continue;
                        }
                    }
                    
                    // DON'T auto-assign - let AI Suggest recommend who should answer
                    // Store who the question is FROM (the role perspective)
                    // Use the first target contact as the representative requester
                    const requesterContact = targetContacts[0] || null;
                    
                    const questionData = {
                        content: genQ.question,
                        context: genQ.context || '',
                        priority: genQ.priority || 'medium',
                        category: genQ.category || 'Business',
                        // Don't assign - AI Suggest will recommend who should answer
                        assigned_to: null,
                        assigned_to_name: null,
                        // Track who the question is FROM (the perspective) - with person info
                        requester_role: role,
                        requester_role_prompt: rolePromptTemplate || null,
                        requester_contact_id: requesterContact?.id || null,
                        requester_name: requesterContact?.name || null,
                        generation_source: 'ai',
                        source_file: 'ai_generated',
                        ai_generated: true,
                        generated_for_role: role
                    };
                    
                    const result = await storage.addQuestion(questionData, true);
                    console.log('[Questions] addQuestion result:', JSON.stringify(result));
                    
                    if (result && (result.action === 'added' || result.id)) {
                        saved.push({
                            id: result.id,
                            content: questionData.content,
                            priority: questionData.priority,
                            requester_role: role
                        });
                        console.log('[Questions] Saved question:', result.id);
                        
                        // Sync to graph
                        const graphProvider = storage.getGraphProvider();
                        if (graphProvider && graphProvider.connected) {
                            const { getGraphSync } = require('./sync');
                            const graphSync = getGraphSync({ graphProvider, storage });
                            if (graphSync && graphSync.isGraphAvailable()) {
                                const newQ = storage.getQuestions().find(q => q.id === result.id);
                                if (newQ) await graphSync.syncQuestion(newQ);
                            }
                        }
                    }
                }
                
                jsonResponse(res, {
                    success: true,
                    generated: saved.length,
                    skipped: skipped.length,
                    questions: saved,
                    skippedDetails: skipped,
                    role,
                    targetMembers: targetContacts.map(c => c.name)
                });
                
            } catch (e) {
                console.error('[Questions] AI Generate error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/preview-ai - Preview AI-generated questions without saving
        if (pathname === '/api/questions/preview-ai' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { role, count = 3, includeContext = true } = body;
                
                if (!role) {
                    jsonResponse(res, { error: 'Role is required' }, 400);
                    return;
                }
                
                // Get project context
                let projectContext = '';
                
                if (includeContext) {
                    const facts = storage.getFacts ? storage.getFacts() : [];
                    if (facts.length > 0) {
                        projectContext += 'Key Facts:\n' + facts.slice(0, 5).map(f => `- ${f.fact || f.content}`).join('\n') + '\n\n';
                    }
                    
                    const briefing = storage.briefing || storage.getBriefing?.();
                    if (briefing && briefing.summary) {
                        projectContext += 'Project Summary:\n' + briefing.summary.substring(0, 300) + '\n\n';
                    }
                }
                
                // Build AI prompt for preview
                const systemPrompt = `You are an expert project analyst. Generate ${count} specific questions for a ${role}.
Output ONLY a JSON array: [{"question": "...", "priority": "high|medium|low", "category": "..."}]`;

                const userPrompt = `${projectContext}\nGenerate ${count} questions for ${role}. Be specific and relevant.`;

                const previewTextCfg = llmConfig.getTextConfig(config);
                if (!previewTextCfg.provider) {
                    jsonResponse(res, { error: 'No LLM provider configured' }, 400);
                    return;
                }
                
                const llmResult = await llm.generateText({
                    provider: previewTextCfg.provider,
                    model: previewTextCfg.model || 'gpt-4o-mini',
                    providerConfig: previewTextCfg.providerConfig,
                    prompt: userPrompt,
                    system: systemPrompt,
                    temperature: 0.7,
                    maxTokens: 1000,
                    jsonMode: true,
                    context: 'question-preview'
                });
                
                if (!llmResult.success) {
                    throw new Error(llmResult.error || 'LLM call failed');
                }
                
                const llmResponse = llmResult.text;
                
                let preview = [];
                try {
                    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        preview = JSON.parse(jsonMatch[0]);
                    }
                } catch {
                    preview = [{ question: 'Failed to parse preview', priority: 'medium' }];
                }
                
                jsonResponse(res, {
                    role,
                    preview,
                    count: preview.length
                });
                
            } catch (e) {
                console.error('[Questions] Preview AI error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/dismiss - Dismiss a question
        const questionDismissMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/dismiss$/);
        if (questionDismissMatch && req.method === 'POST') {
            const questionId = questionDismissMatch[1];
            
            try {
                const body = await parseBody(req);
                const { reason, details } = body;
                
                // Try cache first, then fetch from Supabase
                let question = storage.getQuestions().find(q => String(q.id) === questionId);
                
                // If not in cache, try Supabase directly
                if (!question && storage.supabase) {
                    console.log('[Questions] Not in cache, fetching from Supabase:', questionId);
                    const { data, error } = await storage.supabase
                        .from('knowledge_questions')
                        .select('*')
                        .eq('id', questionId)
                        .single();
                    
                    if (data && !error) {
                        question = data;
                    }
                }
                
                if (!question) {
                    console.log('[Questions] Question not found:', questionId);
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                // Prepare updated data
                const now = new Date().toISOString();
                const updatedData = {
                    status: 'dismissed',
                    dismissed_at: now,
                    dismissed_reason: reason || 'other',
                    resolution_type: 'dismissed',
                    updated_at: now
                };
                
                // Update in Supabase first (primary source)
                if (storage.supabase) {
                    const { data: updatedQ, error: updateError } = await storage.supabase
                        .from('knowledge_questions')
                        .update(updatedData)
                        .eq('id', questionId)
                        .select()
                        .single();
                    
                    if (updateError) {
                        console.error('[Questions] Supabase dismiss error:', updateError);
                        jsonResponse(res, { error: 'Failed to dismiss question: ' + updateError.message }, 500);
                        return;
                    }
                    
                    question = updatedQ;
                } else {
                    // Fallback to local storage
                    Object.assign(question, updatedData);
                    if (details) question.dismissed_details = details;
                    storage.saveQuestions();
                }
                
                // Sync to graph
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        const { getGraphSync } = require('./sync');
                        const graphSync = getGraphSync({ graphProvider, storage });
                        await graphSync.syncQuestion(question);
                    } catch (e) {
                        console.log('[Questions] Graph sync error:', e.message);
                    }
                }
                
                console.log('[Questions] Dismissed:', questionId, reason);
                jsonResponse(res, { success: true, question });
            } catch (e) {
                console.error('[Questions] Dismiss error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/defer - Defer a question
        const questionDeferMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/defer$/);
        if (questionDeferMatch && req.method === 'POST') {
            const questionId = questionDeferMatch[1];
            
            try {
                const body = await parseBody(req);
                const { until, reason } = body;
                
                if (!until) {
                    jsonResponse(res, { error: 'Defer date is required' }, 400);
                    return;
                }
                
                const questions = storage.getQuestions();
                const question = questions.find(q => String(q.id) === questionId);
                
                if (!question) {
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                // Update question
                question.status = 'deferred';
                question.deferred_at = new Date().toISOString();
                question.deferred_until = until;
                question.deferred_reason = reason || null;
                question.updated_at = new Date().toISOString();
                
                storage.saveQuestions();
                
                // Update in Supabase if available
                if (storage.supabase) {
                    try {
                        await storage.supabase
                            .from('knowledge_questions')
                            .update({
                                status: 'deferred',
                                deferred_at: question.deferred_at,
                                deferred_until: question.deferred_until,
                                deferred_reason: question.deferred_reason,
                                updated_at: question.updated_at
                            })
                            .eq('id', questionId);
                    } catch (e) {
                        console.log('[Questions] Supabase defer error:', e.message);
                    }
                }
                
                jsonResponse(res, { success: true, question });
            } catch (e) {
                console.error('[Questions] Defer error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/reopen - Reopen a question
        const questionReopenMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/reopen$/);
        if (questionReopenMatch && req.method === 'POST') {
            const questionId = questionReopenMatch[1];
            
            try {
                const body = await parseBody(req);
                const { reason } = body;
                
                const questions = storage.getQuestions();
                const question = questions.find(q => String(q.id) === questionId);
                
                if (!question) {
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                // Track reopen count
                const reopenCount = (question.reopen_count || 0) + 1;
                
                // Update question
                question.status = 'pending';
                question.reopened_at = new Date().toISOString();
                question.reopened_reason = reason || null;
                question.reopen_count = reopenCount;
                question.updated_at = new Date().toISOString();
                
                // Clear resolution fields
                question.resolved_at = null;
                question.dismissed_at = null;
                question.dismissed_reason = null;
                question.resolution_type = null;
                question.deferred_at = null;
                question.deferred_until = null;
                question.deferred_reason = null;
                
                storage.saveQuestions();
                
                // Update in Supabase if available
                if (storage.supabase) {
                    try {
                        await storage.supabase
                            .from('knowledge_questions')
                            .update({
                                status: 'pending',
                                reopened_at: question.reopened_at,
                                reopened_reason: question.reopened_reason,
                                reopen_count: reopenCount,
                                resolved_at: null,
                                dismissed_at: null,
                                dismissed_reason: null,
                                resolution_type: null,
                                deferred_at: null,
                                deferred_until: null,
                                deferred_reason: null,
                                updated_at: question.updated_at
                            })
                            .eq('id', questionId);
                    } catch (e) {
                        console.log('[Questions] Supabase reopen error:', e.message);
                    }
                }
                
                // Sync to graph
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        const { getGraphSync } = require('./sync');
                        const graphSync = getGraphSync({ graphProvider, storage });
                        await graphSync.syncQuestion(question);
                    } catch (e) {
                        console.log('[Questions] Graph sync error:', e.message);
                    }
                }
                
                jsonResponse(res, { success: true, question });
            } catch (e) {
                console.error('[Questions] Reopen error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/merge - Merge a question into another
        const questionMergeMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/merge$/);
        if (questionMergeMatch && req.method === 'POST') {
            const sourceId = questionMergeMatch[1];
            
            try {
                const body = await parseBody(req);
                const { targetId } = body;
                
                if (!targetId) {
                    jsonResponse(res, { error: 'Target question ID is required' }, 400);
                    return;
                }
                
                const questions = storage.getQuestions();
                const source = questions.find(q => String(q.id) === sourceId);
                const target = questions.find(q => String(q.id) === targetId);
                
                if (!source) {
                    jsonResponse(res, { error: 'Source question not found' }, 404);
                    return;
                }
                if (!target) {
                    jsonResponse(res, { error: 'Target question not found' }, 404);
                    return;
                }
                
                // Update source question
                source.status = 'dismissed';
                source.merged_into_id = targetId;
                source.resolution_type = 'merged';
                source.dismissed_at = new Date().toISOString();
                source.dismissed_reason = 'Merged into another question';
                source.updated_at = new Date().toISOString();
                
                // Move follow-ups to target
                for (const q of questions) {
                    if (q.follow_up_to === sourceId) {
                        q.follow_up_to = targetId;
                    }
                }
                
                storage.saveQuestions();
                
                // Update in Supabase if available
                if (storage.supabase) {
                    try {
                        await storage.supabase
                            .from('knowledge_questions')
                            .update({
                                status: 'dismissed',
                                merged_into_id: targetId,
                                resolution_type: 'merged',
                                dismissed_at: source.dismissed_at,
                                dismissed_reason: 'Merged into another question',
                                updated_at: source.updated_at
                            })
                            .eq('id', sourceId);
                        
                        // Update follow-ups
                        await storage.supabase
                            .from('knowledge_questions')
                            .update({ follow_up_to: targetId })
                            .eq('follow_up_to', sourceId);
                    } catch (e) {
                        console.log('[Questions] Supabase merge error:', e.message);
                    }
                }
                
                jsonResponse(res, { success: true, source, target });
            } catch (e) {
                console.error('[Questions] Merge error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/questions/:id/feedback - Submit feedback on an answer
        const questionFeedbackMatch = pathname.match(/^\/api\/questions\/([a-f0-9\-]+)\/feedback$/);
        if (questionFeedbackMatch && req.method === 'POST') {
            const questionId = questionFeedbackMatch[1];
            
            try {
                const body = await parseBody(req);
                const { wasUseful, feedback } = body;
                
                const questions = storage.getQuestions();
                const question = questions.find(q => String(q.id) === questionId);
                
                if (!question) {
                    jsonResponse(res, { error: 'Question not found' }, 404);
                    return;
                }
                
                // Update question
                question.was_useful = wasUseful;
                question.usefulness_feedback = feedback || null;
                question.updated_at = new Date().toISOString();
                
                storage.saveQuestions();
                
                // Update in Supabase if available
                if (storage.supabase) {
                    try {
                        await storage.supabase
                            .from('knowledge_questions')
                            .update({
                                was_useful: wasUseful,
                                usefulness_feedback: feedback || null,
                                updated_at: question.updated_at
                            })
                            .eq('id', questionId);
                    } catch (e) {
                        console.log('[Questions] Supabase feedback error:', e.message);
                    }
                }
                
                jsonResponse(res, { success: true, question });
            } catch (e) {
                console.error('[Questions] Feedback error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/deferred/due - Get deferred questions that are due
        if (pathname === '/api/questions/deferred/due' && req.method === 'GET') {
            try {
                const now = new Date();
                const questions = storage.getQuestions().filter(q => 
                    q.deferred_until && 
                    new Date(q.deferred_until) <= now &&
                    q.status === 'deferred' &&
                    !q.deleted_at
                );
                
                jsonResponse(res, { questions });
            } catch (e) {
                console.error('[Questions] Deferred due error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/questions/stats/lifecycle - Get question lifecycle stats
        if (pathname === '/api/questions/stats/lifecycle' && req.method === 'GET') {
            try {
                const questions = storage.getQuestions().filter(q => !q.deleted_at);
                
                const stats = {
                    total: questions.length,
                    answered: questions.filter(q => q.status === 'resolved' || q.answer).length,
                    pending: questions.filter(q => q.status === 'pending' || q.status === 'open').length,
                    assigned: questions.filter(q => q.status === 'assigned').length,
                    dismissed: questions.filter(q => q.status === 'dismissed').length,
                    deferred: questions.filter(q => q.status === 'deferred').length,
                    sla_breached: questions.filter(q => q.sla_breached).length,
                    reopened: questions.filter(q => q.reopen_count > 0).length,
                    merged: questions.filter(q => q.merged_into_id).length,
                    // Resolution type breakdown
                    manual_answers: questions.filter(q => q.resolution_type === 'answered_manual').length,
                    auto_answers: questions.filter(q => q.resolution_type === 'answered_auto').length,
                    ai_answers: questions.filter(q => q.resolution_type === 'answered_ai').length,
                    // Usefulness
                    useful: questions.filter(q => q.was_useful === true).length,
                    not_useful: questions.filter(q => q.was_useful === false).length,
                };
                
                // Calculate average resolution time
                const resolvedWithTime = questions.filter(q => q.resolved_at && q.created_at);
                if (resolvedWithTime.length > 0) {
                    const avgHours = resolvedWithTime.reduce((sum, q) => {
                        const diff = new Date(q.resolved_at) - new Date(q.created_at);
                        return sum + (diff / (1000 * 60 * 60));
                    }, 0) / resolvedWithTime.length;
                    stats.avg_resolution_hours = Math.round(avgHours * 10) / 10;
                }
                
                jsonResponse(res, { stats });
            } catch (e) {
                console.error('[Questions] Lifecycle stats error:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // =====================================================
        // END QUESTIONS SOTA ENDPOINTS
        // =====================================================

        // GET /api/risks/by-category - Get risks grouped by impact category
        if (pathname === '/api/risks/by-category' && req.method === 'GET') {
            const grouped = storage.getRisksByCategory();
            jsonResponse(res, { risksByCategory: grouped });
            return;
        }

        // GET /api/source-of-truth - Get formatted source of truth
        if (pathname === '/api/source-of-truth' && req.method === 'GET') {
            try {
                const md = await processor.generateSourceOfTruth();
                jsonResponse(res, { content: md });
            } catch (e) {
                console.error('[SOT] Error generating Source of Truth:', e);
                jsonResponse(res, { content: '# Source of Truth\n\nError generating content: ' + e.message });
            }
            return;
        }

        // GET /api/sot/enhanced - Get enhanced SOT with all SOTA features
        if (pathname === '/api/sot/enhanced' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage, processor);
                
                const parsedUrl = parseUrl(req.url);
                const includeGraph = parsedUrl.query.graph === 'true';
                const includeAI = parsedUrl.query.ai === 'true';
                
                const enhanced = await sotEngine.generateEnhancedSOT({
                    includeGraph,
                    includeAISummary: includeAI,
                    llmProvider: includeAI ? ollama : null
                });
                
                jsonResponse(res, enhanced);
            } catch (e) {
                console.error('[API] Error generating enhanced SOT:', e);
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/sot/health - Get project health score
        if (pathname === '/api/sot/health' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const health = await sotEngine.calculateHealthScore();
                jsonResponse(res, health || { score: 0, status: 'Unknown', color: '#888', factors: [] });
            } catch (e) {
                console.error('[API] /api/sot/health error:', e);
                jsonResponse(res, { score: 0, status: 'Error', color: '#888', factors: [], error: e.message }, 200);
            }
            return;
        }

        // GET /api/sot/insights - Get AI-generated insights
        if (pathname === '/api/sot/insights' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const insights = await sotEngine.generateInsights();
                jsonResponse(res, { insights: insights || [] });
            } catch (e) {
                console.error('[API] /api/sot/insights error:', e);
                jsonResponse(res, { insights: [], error: e.message }, 200);
            }
            return;
        }

        // GET /api/sot/alerts - Get critical alerts
        if (pathname === '/api/sot/alerts' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const alerts = await sotEngine.generateAlerts();
                jsonResponse(res, { alerts: alerts || [] });
            } catch (e) {
                console.error('[API] /api/sot/alerts error:', e);
                jsonResponse(res, { alerts: [], error: e.message }, 200); // Return empty alerts instead of 500
            }
            return;
        }

        // GET /api/sot/delta - Get changes since last view
        if (pathname === '/api/sot/delta' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const delta = sotEngine.getChangeDelta();
                jsonResponse(res, delta);
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/sot/timeline - Get timeline events
        if (pathname === '/api/sot/timeline' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const timeline = await sotEngine.generateTimeline();
                const parsedUrl = parseUrl(req.url);
                const limit = parseInt(parsedUrl.query.limit) || 50;
                jsonResponse(res, { timeline: timeline.slice(0, limit) });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/timeline - Get timeline events (unified format for TimelinePanel)
        if (pathname === '/api/timeline' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const timeline = await sotEngine.generateTimeline();
                const parsedUrl = parseUrl(req.url);
                const limit = parseInt(parsedUrl.query.limit) || 200;
                const types = parsedUrl.query.types ? String(parsedUrl.query.types).split(',') : null;
                const startDate = parsedUrl.query.startDate || null;
                const endDate = parsedUrl.query.endDate || null;

                let filtered = timeline;
                if (types && types.length > 0) {
                    filtered = filtered.filter(e => types.includes(e.type));
                }
                if (startDate) {
                    filtered = filtered.filter(e => e.date && e.date >= startDate);
                }
                if (endDate) {
                    filtered = filtered.filter(e => e.date && e.date <= endDate);
                }

                const sliced = filtered.slice(0, limit);
                const start = sliced.length ? sliced[sliced.length - 1].date : '';
                const end = sliced.length ? sliced[0].date : '';

                jsonResponse(res, {
                    events: sliced,
                    totalEvents: filtered.length,
                    startDate: start,
                    endDate: end
                });
            } catch (e) {
                jsonResponse(res, { error: e.message, events: [], totalEvents: 0, startDate: '', endDate: '' }, 500);
            }
            return;
        }

        // GET /api/sot/versions - Get SOT version history
        if (pathname === '/api/sot/versions' && req.method === 'GET') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const versions = sotEngine.getVersionHistory();
                jsonResponse(res, { versions });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/sot/versions/:id - Get specific version
        if (pathname.match(/^\/api\/sot\/versions\/\d+$/) && req.method === 'GET') {
            try {
                const versionId = pathname.split('/').pop();
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const version = sotEngine.getVersion(versionId);
                if (version) {
                    jsonResponse(res, version);
                } else {
                    jsonResponse(res, { error: 'Version not found' }, 404);
                }
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/sot/compare - Compare two versions
        if (pathname === '/api/sot/compare' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const v1 = parsedUrl.query.v1;
                const v2 = parsedUrl.query.v2;
                if (!v1 || !v2) {
                    jsonResponse(res, { error: 'Missing v1 or v2 parameters' }, 400);
                    return;
                }
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const diff = sotEngine.compareVersions(v1, v2);
                jsonResponse(res, diff || { error: 'Could not compare versions' });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/sot/trace/:type/:id - Get source traceability
        if (pathname.match(/^\/api\/sot\/trace\/\w+\/\d+$/) && req.method === 'GET') {
            try {
                const parts = pathname.split('/');
                const itemType = parts[4];
                const itemId = parts[5];
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const trace = sotEngine.getSourceTraceability(itemType, itemId);
                jsonResponse(res, trace || { found: false });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/sot/executive-summary - Generate AI executive summary
        if (pathname === '/api/sot/executive-summary' && req.method === 'POST') {
            try {
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage, processor);
                const summary = await sotEngine.generateExecutiveSummary(ollama);
                jsonResponse(res, summary);
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // POST /api/sot/chat - SOT-specific chat
        if (pathname === '/api/sot/chat' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { message, model } = body;
                
                // Build SOT context
                const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                const sotEngine = new SourceOfTruthEngine(storage);
                const health = sotEngine.calculateHealthScore();
                const insights = sotEngine.generateInsights();
                
                const facts = storage.getFacts();
                const decisions = storage.getDecisions();
                const risks = storage.getRisks ? await storage.getRisks() : [];
                const actions = storage.getActionItems();
                
                const sotContext = `
You are an AI assistant with access to this project's Source of Truth knowledge base.

PROJECT HEALTH: ${health.score}/100 (${health.status})

FACTS (${facts.length} total):
${facts.slice(0, 20).map(f => `- [${f.category}] ${f.content}`).join('\n')}

DECISIONS (${decisions.length} total):
${decisions.slice(0, 10).map(d => `- ${d.content} (${d.owner || 'N/A'})`).join('\n')}

RISKS (${risks.length} total):
${risks.slice(0, 10).map(r => `- [${r.impact}/${r.status}] ${r.content}`).join('\n')}

PENDING ACTIONS (${actions.filter(a => a.status === 'pending').length}):
${actions.filter(a => a.status === 'pending').slice(0, 10).map(a => `- ${a.task} (${a.owner || 'N/A'})`).join('\n')}

KEY INSIGHTS:
${insights.slice(0, 5).map(i => `- ${i.title}: ${i.message}`).join('\n')}

Answer questions about this project based on the knowledge above. Be specific and reference facts when possible.`;

                // Use LLM module for provider-agnostic generation via global queue
                const sotTextCfg = llmConfig.getTextConfig(config, { model });
                const sotProvider = sotTextCfg.provider;
                const sotProviderConfig = sotTextCfg.providerConfig;
                const textModel = sotTextCfg.model;
                
                const result = await llm.generateText({
                    provider: sotProvider,
                    providerConfig: sotProviderConfig,
                    model: textModel,
                    system: sotContext,
                    prompt: message,
                    temperature: 0.7,
                    maxTokens: 2048,
                    context: 'sot_chat',
                    priority: 'high' // Interactive chat
                });
                
                if (!result.success) {
                    jsonResponse(res, { error: result.error || 'Failed to generate response' }, 500);
                    return;
                }
                
                jsonResponse(res, { 
                    response: result.text,
                    model: textModel,
                    healthScore: health.score
                });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/sot/facts/:id - Inline edit fact
        if (pathname.match(/^\/api\/sot\/facts\/\d+$/) && req.method === 'PUT') {
            try {
                const factId = parseInt(pathname.split('/').pop());
                const body = await parseBody(req);
                
                const facts = storage.knowledge.facts || [];
                const factIndex = facts.findIndex(f => f.id === factId);
                
                if (factIndex === -1) {
                    jsonResponse(res, { error: 'Fact not found' }, 404);
                    return;
                }
                
                // Update fact
                if (body.content) facts[factIndex].content = body.content;
                if (body.category) facts[factIndex].category = body.category;
                facts[factIndex].edited_at = new Date().toISOString();
                facts[factIndex].edited_by = 'user';
                
                storage.saveKnowledge();
                jsonResponse(res, { success: true, fact: facts[factIndex] });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // PUT /api/sot/decisions/:id - Inline edit decision
        if (pathname.match(/^\/api\/sot\/decisions\/\d+$/) && req.method === 'PUT') {
            try {
                const decisionId = parseInt(pathname.split('/').pop());
                const body = await parseBody(req);
                
                const decisions = storage.knowledge.decisions || [];
                const decIndex = decisions.findIndex(d => d.id === decisionId);
                
                if (decIndex === -1) {
                    jsonResponse(res, { error: 'Decision not found' }, 404);
                    return;
                }
                
                if (body.content) decisions[decIndex].content = body.content;
                if (body.owner) decisions[decIndex].owner = body.owner;
                if (body.category) decisions[decIndex].category = body.category;
                decisions[decIndex].edited_at = new Date().toISOString();
                
                storage.saveKnowledge();
                jsonResponse(res, { success: true, decision: decisions[decIndex] });
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // GET /api/sot/export/:format - Export SOT in different formats
        if (pathname.match(/^\/api\/sot\/export\/\w+$/) && req.method === 'GET') {
            try {
                const format = pathname.split('/').pop();
                const md = processor.generateSourceOfTruth();
                
                switch (format) {
                    case 'markdown':
                    case 'md':
                        res.writeHead(200, { 
                            'Content-Type': 'text/markdown',
                            'Content-Disposition': 'attachment; filename="source_of_truth.md"'
                        });
                        res.end(md);
                        break;
                        
                    case 'html':
                        const { SourceOfTruthEngine } = require('./advanced/SourceOfTruthEngine');
                        const sotEngine = new SourceOfTruthEngine(storage);
                        const health = sotEngine.calculateHealthScore();
                        const insights = sotEngine.generateInsights();
                        
                        const htmlContent = generateStandaloneHTML(md, health, insights);
                        res.writeHead(200, { 
                            'Content-Type': 'text/html',
                            'Content-Disposition': 'attachment; filename="source_of_truth.html"'
                        });
                        res.end(htmlContent);
                        break;
                        
                    case 'json':
                        const sotEngineJson = new (require('./advanced/SourceOfTruthEngine'))(storage);
                        const enhanced = await sotEngineJson.generateEnhancedSOT({ markAsViewed: false });
                        res.writeHead(200, { 
                            'Content-Type': 'application/json',
                            'Content-Disposition': 'attachment; filename="source_of_truth.json"'
                        });
                        res.end(JSON.stringify(enhanced, null, 2));
                        break;
                        
                    default:
                        jsonResponse(res, { error: 'Unsupported format. Use: markdown, html, json' }, 400);
                }
            } catch (e) {
                jsonResponse(res, { error: e.message }, 500);
            }
            return;
        }

        // Helper function for standalone HTML export
        function generateStandaloneHTML(markdown, health, insights) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Source of Truth - ${new Date().toISOString().split('T')[0]}</title>
    <style>
        :root { --accent: #e94560; --bg: #0f0f23; --card: #1a1a2e; --text: #eaeaea; --muted: #888; --success: #2ecc71; --warning: #f39c12; --danger: #e74c3c; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 40px; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid var(--accent); }
        .header h1 { color: var(--accent); font-size: 2.5em; margin-bottom: 10px; }
        .health-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 1.1em; background: ${health.color}22; color: ${health.color}; border: 2px solid ${health.color}; }
        .insights { display: grid; gap: 15px; margin: 30px 0; }
        .insight { background: var(--card); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); }
        .insight-title { font-weight: bold; margin-bottom: 5px; }
        .content { background: var(--card); padding: 30px; border-radius: 12px; }
        h2 { color: var(--accent); margin: 25px 0 15px; padding-bottom: 8px; border-bottom: 1px solid #333; }
        h3 { color: var(--accent); margin: 20px 0 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border: 1px solid #333; }
        th { background: #16213e; color: var(--text); }
        ul { padding-left: 25px; margin: 10px 0; }
        li { margin: 5px 0; }
        hr { border: none; border-top: 1px solid #333; margin: 25px 0; }
        .footer { text-align: center; margin-top: 40px; color: var(--muted); font-size: 0.9em; }
        @media print { body { background: white; color: black; } .health-badge, th { background: #f5f5f5 !important; color: black !important; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Source of Truth</h1>
            <p style="color: var(--muted);">Generated: ${new Date().toLocaleString()}</p>
            <div class="health-badge">Health Score: ${health.score}/100 - ${health.status}</div>
        </div>
        
        ${insights.length > 0 ? `
        <div class="insights">
            <h3>🔍 Key Insights</h3>
            ${insights.slice(0, 5).map(i => `
                <div class="insight">
                    <div class="insight-title">${i.icon} ${i.title}</div>
                    <div>${i.message}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="content">
            ${convertMarkdownToHTML(markdown)}
        </div>
        
        <div class="footer">
            <p>Generated by GodMode Source of Truth Engine</p>
        </div>
    </div>
</body>
</html>`;
        }

        function convertMarkdownToHTML(md) {
            return md
                .replace(/^#### (.*$)/gim, '<h5>$1</h5>')
                .replace(/^### (.*$)/gim, '<h4>$1</h4>')
                .replace(/^## (.*$)/gim, '<h3>$1</h3>')
                .replace(/^# (.*$)/gim, '<h2>$1</h2>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/^\| (.+) \|$/gim, (match, content) => {
                    const cells = content.split('|').map(c => c.trim());
                    if (cells.every(c => c.match(/^-+$/))) return '';
                    const tag = cells[0].match(/^-+$/) ? 'td' : 'td';
                    return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
                })
                .replace(/^- (.*$)/gim, '<li>$1</li>')
                .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
                .replace(/^---$/gim, '<hr>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
        }

        // GET /api/relationships - Get all relationships
        if (pathname === '/api/relationships' && req.method === 'GET') {
            const relationships = storage.getRelationships();
            jsonResponse(res, { relationships });
            return;
        }

        // GET /api/org-chart - Get org chart data for visualization
        if (pathname === '/api/org-chart' && req.method === 'GET') {
            const chartData = storage.getOrgChartData();
            jsonResponse(res, chartData);
            return;
        }

        // GET /api/history - Get processing history
        if (pathname === '/api/history' && req.method === 'GET') {
            const history = await storage.getHistory();
            jsonResponse(res, { history });
            return;
        }

        // GET /api/search - Full-text search across all data
        if (pathname === '/api/search' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const query = parsedUrl.query.q || '';
            const types = parsedUrl.query.types ? parsedUrl.query.types.split(',') : null;
            const limit = parseInt(parsedUrl.query.limit) || 50;
            const results = storage.search(query, { types, limit });
            jsonResponse(res, results);
            return;
        }

        // POST /api/ask - AI-powered Q&A over knowledge base
        if (pathname === '/api/ask' && req.method === 'POST') {
            const body = await parseBody(req);
            const question = body.question;
            
            // Use LLM config (perTask preferred), fallback to ollama
            const askProvider = config.llm?.perTask?.text?.provider || config.llm?.provider || 'ollama';
            const askProviderConfig = config.llm?.providers?.[askProvider] || {};
            const model = body.model || config.llm?.perTask?.text?.model || config.llm?.models?.text || config.ollama?.model;

            if (!question) {
                jsonResponse(res, { error: 'Question is required' }, 400);
                return;
            }

            if (!model) {
                jsonResponse(res, { error: 'No model configured. Set a Text Model in Settings.' }, 400);
                return;
            }
            
            console.log(`[Ask] Using provider: ${askProvider}, model: ${model}`);

            // Get relevant knowledge
            const knowledge = storage.getAllKnowledge();
            const currentProject = storage.getCurrentProject();
            const userRole = currentProject?.userRole || '';
            const userRolePrompt = currentProject?.userRolePrompt || '';

            // Build context from knowledge base
            let context = `You are a helpful assistant answering questions based on a project knowledge base.
PROJECT: ${currentProject?.name || 'GodMode'}${userRole ? `\nUSER ROLE: ${userRole}` : ''}${userRolePrompt ? `\nROLE CONTEXT: ${userRolePrompt}` : ''}

IMPORTANT RULES:
- Respond in the SAME LANGUAGE as the question (if Portuguese, respond in Portuguese)
- If asked about "state", "status", or "estado", summarize what is currently known
- Be specific and cite the facts you're using
- If information is limited, say what IS available rather than just saying you can't help
${userRole ? `- Tailor responses to be relevant for a ${userRole}` : ''}
${userRolePrompt ? `- Consider the user's specific responsibilities: ${userRolePrompt}` : ''}

`;
            context += "KNOWLEDGE BASE:\n\n";

            // Add facts
            if (knowledge.facts && knowledge.facts.length > 0) {
                context += "FACTS:\n";
                knowledge.facts.forEach(f => {
                    context += `- [${f.category || 'general'}] ${f.content}\n`;
                });
                context += "\n";
            }

            // Add decisions
            if (knowledge.decisions && knowledge.decisions.length > 0) {
                context += "DECISIONS:\n";
                knowledge.decisions.forEach(d => {
                    context += `- ${d.content}`;
                    if (d.date) context += ` (${d.date})`;
                    if (d.owner) context += ` - ${d.owner}`;
                    context += "\n";
                });
                context += "\n";
            }

            // Add answered questions
            const answeredList = (knowledge.questions || []).filter(q => q.status === 'resolved' && q.answer);
            if (answeredList.length > 0) {
                context += "PREVIOUSLY ANSWERED QUESTIONS:\n";
                answeredList.forEach(q => {
                    context += `Q: ${q.content}\nA: ${q.answer}\n\n`;
                });
            }

            // Add people
            if (knowledge.people && knowledge.people.length > 0) {
                context += "PEOPLE:\n";
                knowledge.people.forEach(p => {
                    context += `- ${p.name}`;
                    if (p.role) context += ` (${p.role})`;
                    if (p.organization) context += ` - ${p.organization}`;
                    context += "\n";
                });
                context += "\n";
            }

            // Add risks
            if (knowledge.risks && knowledge.risks.length > 0) {
                context += "RISKS:\n";
                knowledge.risks.forEach(r => {
                    context += `- ${r.content}`;
                    if (r.impact) context += ` (Impact: ${r.impact})`;
                    if (r.status) context += ` [${r.status}]`;
                    context += "\n";
                });
                context += "\n";
            }

            // Also do a search for the question to find specific relevant items
            const searchResults = storage.search(question, { limit: 10 });
            if (searchResults.total > 0) {
                context += "RELEVANT ITEMS FROM SEARCH:\n";
                searchResults.facts.forEach(f => context += `- Fact: ${f.content}\n`);
                searchResults.questions.forEach(q => context += `- Question: ${q.content}${q.answer ? ' | Answer: ' + q.answer : ''}\n`);
                searchResults.decisions.forEach(d => context += `- Decision: ${d.content}\n`);
                searchResults.risks.forEach(r => context += `- Risk: ${r.content}\n`);
                context += "\n";
            }

            // ==================== GRAPHRAG INTEGRATION FOR ASK ====================
            // Add graph-based context if FalkorDB is connected
            const graphProvider = storage.getGraphProvider();
            if (graphProvider && graphProvider.connected) {
                try {
                    const { GraphRAGEngine } = require('./graphrag');
                    
                    if (!global.graphRAGEngine) {
                        global.graphRAGEngine = new GraphRAGEngine({
                            graphProvider: graphProvider,
                            storage: storage,
                            llmProvider: askProvider,
                            llmModel: model,
                            llmConfig: config.llm,
                            enableCache: true,
                            useOntology: true
                        });
                    }
                    
                    console.log(`[Ask] Using GraphRAG for enhanced context`);
                    const queryAnalysis = global.graphRAGEngine.classifyQuery(question);
                    
                    if (queryAnalysis.entityHints?.length > 0) {
                        const graphResults = await global.graphRAGEngine.hybridSearch(question, { queryAnalysis });
                        
                        if (graphResults.length > 0) {
                            context += "\nKNOWLEDGE GRAPH RESULTS:\n";
                            for (const result of graphResults.slice(0, 5)) {
                                context += `- [${result.type || 'Entity'}] ${result.content || result.name || JSON.stringify(result.data?.properties || {})}\n`;
                            }
                            context += "\n";
                            console.log(`[Ask] Added ${graphResults.length} graph results`);
                        }
                    }
                } catch (graphError) {
                    console.log(`[Ask] GraphRAG error: ${graphError.message}`);
                }
            }
            // ==================== END GRAPHRAG INTEGRATION ====================

            context += `Based on this knowledge base, please answer the following question. If you cannot find relevant information, say so.\n\nQuestion: ${question}`;

            // Count total knowledge items
            const totalKnowledgeItems = (knowledge.facts?.length || 0) +
                (knowledge.decisions?.length || 0) +
                (knowledge.people?.length || 0) +
                (knowledge.risks?.length || 0) +
                (knowledge.questions?.length || 0);

            try {
                // Use LLM module for provider-agnostic generation
                const result = await llm.generateText({
                    provider: askProvider,
                    providerConfig: askProviderConfig,
                    model: model,
                    prompt: context,
                    temperature: 0.7,
                    maxTokens: 2048,
                    context: 'question'
                });
                
                if (result.success) {
                    jsonResponse(res, {
                        question,
                        answer: result.text || result.response,
                        sources: {
                            facts: searchResults.facts.length,
                            questions: searchResults.questions.length,
                            decisions: searchResults.decisions.length,
                            knowledgeItems: totalKnowledgeItems
                        }
                    });
                } else {
                    jsonResponse(res, { error: result.error || 'Failed to generate answer' }, 500);
                }
            } catch (error) {
                jsonResponse(res, { error: 'Failed to generate answer: ' + error.message }, 500);
            }
            return;
        }

        // ==================== Chat Sessions API ====================
        // POST /api/chat/sessions - Create new chat session
        if (pathname === '/api/chat/sessions' && req.method === 'POST') {
            const body = await parseBody(req);
            const title = body.title || 'Nova conversa';
            const contextContactId = body.contextContactId || null;
            try {
                const session = await storage.createChatSession({ title, contextContactId });
                jsonResponse(res, { ok: true, session });
            } catch (e) {
                console.error('[Chat] Create session error:', e.message);
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return;
        }

        // PUT /api/chat/sessions/:id - Update chat session (title, contextContactId)
        const chatSessionPutMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)$/);
        if (chatSessionPutMatch && req.method === 'PUT') {
            const sessionId = chatSessionPutMatch[1];
            const body = await parseBody(req);
            const updates = {};
            if (body.title !== undefined) updates.title = body.title;
            if (body.contextContactId !== undefined) updates.contextContactId = body.contextContactId || null;
            try {
                const session = await storage.updateChatSession(sessionId, updates);
                jsonResponse(res, { ok: true, session });
            } catch (e) {
                console.error('[Chat] Update session error:', e.message);
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return;
        }

        // GET /api/chat/sessions - List chat sessions for project
        if (pathname === '/api/chat/sessions' && req.method === 'GET') {
            try {
                const sessions = await storage.getChatSessions();
                jsonResponse(res, { ok: true, sessions });
            } catch (e) {
                console.error('[Chat] List sessions error:', e.message);
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return;
        }

        // GET /api/chat/sessions/:id/messages - Get messages for session
        const chatSessionMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/);
        if (chatSessionMatch && req.method === 'GET') {
            const sessionId = chatSessionMatch[1];
            try {
                const messages = await storage.getChatMessages(sessionId);
                jsonResponse(res, { ok: true, messages });
            } catch (e) {
                console.error('[Chat] Get messages error:', e.message);
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return;
        }

        // POST /api/chat - Chat with reasoning model using project context
        if (pathname === '/api/chat' && req.method === 'POST') {
            const body = await parseBody(req);
            const message = body.message;
            const context = body.context;
            let history = body.history || [];
            const useSemantic = body.semantic !== false; // Default to true
            const deepReasoning = body.deepReasoning || false; // Enable CoT reasoning
            let sessionId = body.sessionId || null; // Persistence: chat session ID
            const contextContactId = body.contextContactId || null; // Optional: contact for role context when creating session

            if (!message) {
                jsonResponse(res, { error: 'Message is required' }, 400);
                return;
            }

            // Persistence: if sessionId provided but no session exists, or if Supabase and no sessionId, load/create session
            let chatSession = null;
            if (storage.getChatSessions && typeof storage.getChatSessions === 'function') {
                if (sessionId) {
                    try {
                        chatSession = storage.getChatSession ? await storage.getChatSession(sessionId) : null;
                        const dbMessages = await storage.getChatMessages(sessionId);
                        if (dbMessages.length > 0 && history.length === 0) {
                            history = dbMessages.map(m => ({ role: m.role, content: m.content }));
                        }
                    } catch (e) {
                        console.warn('[Chat] Could not load session messages:', e.message);
                    }
                } else if (supabase && supabase.isConfigured && supabase.isConfigured()) {
                    try {
                        const newSession = await storage.createChatSession({
                            title: message.substring(0, 80) || 'Nova conversa',
                            contextContactId: contextContactId
                        });
                        sessionId = newSession?.id || null;
                        chatSession = newSession;
                    } catch (e) {
                        console.warn('[Chat] Could not create session:', e.message);
                    }
                }
            }
            if (!chatSession && sessionId && storage.getChatSession) {
                try { chatSession = await storage.getChatSession(sessionId); } catch (e) { /* ignore */ }
            }

            // Use text model from LLM config (perTask preferred), fallback to ollama config
            const provider = config.llm?.perTask?.text?.provider || config.llm?.provider || 'ollama';
            const providerConfig = config.llm?.providers?.[provider] || {};
            const model = config.llm?.perTask?.text?.model || config.llm?.models?.text || config.ollama?.reasoningModel || config.ollama?.model;
            if (!model) {
                jsonResponse(res, { error: 'No model configured. Set a Text Model in Settings.' }, 400);
                return;
            }
            
            console.log(`[Chat] Using provider: ${provider}, model: ${model}`);

            // Get user role for context (Contact > Project role)
            const currentProject = storage.getCurrentProject();
            let userRole = currentProject?.userRole || '';
            let userRolePrompt = currentProject?.userRolePrompt || '';
            let roleContext = '';
            const contextContactIdFromSession = chatSession?.context_contact_id || null;
            if (contextContactIdFromSession && storage.getContactById) {
                const contact = await Promise.resolve(storage.getContactById(contextContactIdFromSession));
                if (contact) {
                    const name = contact.name || 'Contact';
                    const role = contact.role || '';
                    const org = contact.organization || '';
                    const notes = contact.notes || '';
                    roleContext = `\nUSER CONTEXT: Chatting as ${name}`;
                    if (role) roleContext += ` (${role})`;
                    if (org) roleContext += ` at ${org}`;
                    roleContext += '. Tailor responses to their perspective and responsibilities.';
                    if (notes) roleContext += `\nAdditional context: ${notes}`;
                }
            }
            if (!roleContext && userRole) {
                roleContext = `\nUSER ROLE: The user is a "${userRole}" - tailor responses to their perspective and responsibilities.`;
                if (userRolePrompt) roleContext += `\nROLE CONTEXT: ${userRolePrompt}`;
            }

            // Build the chat prompt - with optional Chain of Thought reasoning
            let systemPrompt;

            if (deepReasoning) {
                // Chain of Thought reasoning prompt for complex queries
                systemPrompt = `You are an expert Q&A assistant for a document processing project. Use structured reasoning to provide accurate, well-analyzed answers.${roleContext}

REASONING FRAMEWORK (follow these steps):

**Step 1 - CONTEXT ANALYSIS:**
- What type of question is this? (factual/analytical/comparison/status)
- What information from the context is most relevant?
- What expertise lens should I apply?

**Step 2 - INITIAL RESPONSE:**
Draft a response using the available context. Cite specific items.

**Step 3 - STRESS TEST:**
- Are there gaps in the context that limit my answer?
- Am I making assumptions not supported by the data?
- Is there conflicting information I need to address?
- What confidence level is appropriate?

**Step 4 - FINAL ANSWER:**
Provide the definitive answer with:
- Key points in **bold**
- Clear structure with headers if needed
- Confidence indicator: [HIGH/MEDIUM/LOW]
- What additional information would improve this answer (if applicable)

IMPORTANT: Always ground your answer in the provided context. If information is insufficient, say so clearly.`;
            } else {
                // Standard prompt for simple queries
                systemPrompt = `You are a helpful Q&A assistant for a document processing project. Answer questions based on the provided context and conversation history.${roleContext}

IMPORTANT RULES:
1. Be concise but thorough
2. If you don't have enough information in the context to answer confidently, say "I don't have enough information to answer this question definitively"
3. When citing information, mention the source type (e.g., "According to a fact from..." or "Based on a decision...")
4. If the question is about something not in the context, acknowledge what IS available`;
            }

            let sources = [];
            let contextQuality = 'none'; // none, low, medium, high

            // Detect if query needs translation (non-English)
            let translatedQuery = null;
            const nonEnglishPattern = /[àáâãäåæçèéêëìíîïñòóôõöùúûüýÿ]|^(o que|como|quando|onde|quem|qual|porque|por que|porquê|será|está|são|foi|eram|quais|esto|esta|estos|estas|qué|cómo|cuándo|dónde|quién|cuál|porqué|será|está|son|fue|eran|cuáles|was ist|wie|wann|wo|wer|welche|warum|qu'est|comment|quand|où|qui|quel|pourquoi)/i;
            
            if (nonEnglishPattern.test(message)) {
                console.log(`[Chat] Detected non-English query, translating...`);
                try {
                    const translateResult = await llm.generateText({
                        provider,
                        providerConfig,
                        model,
                        prompt: `Translate this question to English. Only output the translation, nothing else:\n\n"${message}"`,
                        temperature: 0.1,
                        maxTokens: 200,
                        context: 'chat'
                    });
                    
                    if (translateResult.success && translateResult.text) {
                        translatedQuery = translateResult.text.replace(/^["']|["']$/g, '').trim();
                        console.log(`[Chat] Translated query: "${translatedQuery}"`);
                    }
                } catch (e) {
                    console.log(`[Chat] Translation failed: ${e.message}`);
                }
            }

            // Use translated query for search if available
            const searchQuery = translatedQuery || message;

            // Preprocess query for better search
            const processedQuery = storage.preprocessQuery(searchQuery);
            const queryType = storage.classifyQuery(searchQuery);
            console.log(`Query type: ${queryType}, terms: [${processedQuery.terms.join(', ')}]`);

            // ==================== GRAPHRAG INTEGRATION ====================
            // Use GraphRAG engine if graph database is connected for enhanced retrieval
            let graphRAGResults = null;
            let graphContext = '';
            const graphProvider = storage.getGraphProvider();
            
            if (graphProvider && graphProvider.connected) {
                try {
                    const { GraphRAGEngine } = require('./graphrag');
                    
                    // Use singleton GraphRAG engine
                    if (!global.graphRAGEngine) {
                        global.graphRAGEngine = new GraphRAGEngine({
                            graphProvider: graphProvider,
                            storage: storage,
                            embeddingProvider: config.llm?.embeddingsProvider || 'openai',
                            embeddingModel: config.llm?.models?.embeddings || 'text-embedding-3-small',
                            llmProvider: provider,
                            llmModel: model,
                            llmConfig: config.llm,
                            enableCache: true,
                            useOntology: true
                        });
                    } else if (global.graphRAGEngine.graphProvider !== graphProvider) {
                        global.graphRAGEngine.graphProvider = graphProvider;
                    }
                    
                    console.log(`[Chat] Using GraphRAG for enhanced retrieval`);
                    
                    // ============ AI-POWERED CYPHER GENERATION ============
                    // Use AI to generate optimal Cypher query for the question
                    const { getCypherGenerator } = require('./graphrag');
                    const cypherGen = getCypherGenerator({
                        llmProvider: provider,
                        llmModel: model,
                        llmConfig: config.llm
                    });
                    
                    const aiCypher = await cypherGen.generate(searchQuery, {
                        provider: provider,
                        model: model
                    });
                    
                    let aiCypherResults = [];
                    if (aiCypher.cypher && aiCypher.confidence >= 0.3) {
                        console.log(`[Chat] AI Cypher (conf: ${aiCypher.confidence}): ${aiCypher.cypher.substring(0, 80)}...`);
                        
                        try {
                            const cypherResult = await graphProvider.query(aiCypher.cypher);
                            if (cypherResult.ok && cypherResult.results?.length > 0) {
                                aiCypherResults = cypherResult.results;
                                console.log(`[Chat] AI Cypher returned ${aiCypherResults.length} results`);
                            }
                        } catch (cypherError) {
                            console.log(`[Chat] AI Cypher query failed: ${cypherError.message}`);
                        }
                    }
                    
                    // Classify query for additional context
                    const graphQuery = global.graphRAGEngine.classifyQuery(searchQuery);
                    console.log(`[Chat] GraphRAG query type: ${graphQuery.type}, entities: ${graphQuery.entityHints?.length || 0}, relations: ${graphQuery.relationHints?.length || 0}`);
                    
                    // Combine AI Cypher results with hybrid search
                    let graphSearchResults = [];
                    
                    // Process AI Cypher results
                    if (aiCypherResults.length > 0) {
                        for (const row of aiCypherResults) {
                            // Extract nodes from the result row
                            for (const [key, val] of Object.entries(row)) {
                                if (val && typeof val === 'object') {
                                    const props = val.properties || val._properties || val;
                                    const labels = val.labels || val._labels || [];
                                    const nodeType = labels[0] || 'Entity';
                                    
                                    graphSearchResults.push({
                                        type: nodeType,
                                        name: props.name || props.title || key,
                                        content: props.content || props.description || props.summary || '',
                                        data: { properties: props },
                                        score: aiCypher.confidence,
                                        source: 'ai_cypher'
                                    });
                                } else if (typeof val === 'string' && val.length > 0) {
                                    // Handle scalar returns
                                    graphSearchResults.push({
                                        type: key,
                                        name: val,
                                        content: val,
                                        score: aiCypher.confidence,
                                        source: 'ai_cypher'
                                    });
                                }
                            }
                        }
                    }
                    
                    // Also get hybrid search results if AI didn't return much
                    if (graphSearchResults.length < 5 && (graphQuery.entityHints?.length > 0 || graphQuery.relationHints?.length > 0)) {
                        const hybridResults = await global.graphRAGEngine.hybridSearch(searchQuery, { queryAnalysis: graphQuery });
                        for (const hr of hybridResults) {
                            // Avoid duplicates
                            if (!graphSearchResults.find(r => r.name === hr.name)) {
                                graphSearchResults.push(hr);
                            }
                        }
                    }
                    
                    if (graphSearchResults.length > 0) {
                        graphRAGResults = graphSearchResults;
                        console.log(`[Chat] Found ${graphSearchResults.length} total graph-based results`);
                        
                        // Build graph context
                        graphContext = '\n\n=== KNOWLEDGE GRAPH CONTEXT ===\n';
                        graphContext += `(via AI-generated query - ${graphSearchResults.length} relevant entities)\n`;
                        if (aiCypher.explanation) {
                            graphContext += `Query intent: ${aiCypher.explanation}\n`;
                        }
                        
                        for (const result of graphSearchResults.slice(0, 10)) {
                            const typeLabel = result.type || result.label || 'Entity';
                            graphContext += `\n[${typeLabel.toUpperCase()}]`;
                            if (result.name) graphContext += ` ${result.name}`;
                            if (result.score) graphContext += ` (relevance: ${Math.round(result.score * 100)}%)`;
                            graphContext += '\n';
                            
                            // Add content/properties
                            if (result.content) {
                                graphContext += `${result.content}\n`;
                            } else if (result.data) {
                                const props = result.data.properties || result.data;
                                const relevantProps = ['content', 'description', 'summary', 'role', 'organization', 'email', 'department', 'status'];
                                for (const prop of relevantProps) {
                                    if (props[prop]) {
                                        graphContext += `  ${prop}: ${props[prop]}\n`;
                                    }
                                }
                            }
                            
                            sources.push({
                                id: result.id || `graph_${sources.length}`,
                                type: typeLabel,
                                score: result.score || 0.5,
                                source: result.source || 'graph_database'
                            });
                        }
                        
                        graphContext += '\n=== END KNOWLEDGE GRAPH ===\n';
                    }
                    
                    // Also try to get related entities for context enrichment
                    if (graphQuery.entityHints?.length > 0 && graphSearchResults.length > 0) {
                        try {
                            const h0 = graphQuery.entityHints[0];
                            const entityName = typeof h0 === 'string' ? h0 : (h0?.keyword || h0?.type || h0?.value || '');
                            if (!entityName) throw new Error('No entity name');
                            const relatedQuery = `MATCH (n)-[r]-(m) WHERE toLower(n.name) CONTAINS toLower('${String(entityName).replace(/'/g, "\\'")}') RETURN n, type(r) as rel, m LIMIT 5`;
                            const relatedResult = await graphProvider.query(relatedQuery);
                            
                            if (relatedResult.ok && relatedResult.results?.length > 0) {
                                graphContext += '\n--- Related Entities ---\n';
                                for (const row of relatedResult.results) {
                                    if (row.n?.properties?.name && row.m?.properties?.name) {
                                        graphContext += `${row.n.properties.name} --[${row.rel}]--> ${row.m.properties.name}\n`;
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore related entity errors
                        }
                    }
                    
                } catch (graphError) {
                    console.log(`[Chat] GraphRAG error (falling back to standard search): ${graphError.message}`);
                }
            }
            // ==================== END GRAPHRAG INTEGRATION ====================

            // ==================== SOTA RAG PIPELINE ====================
            // Implements: Vector Search, HyDE, RRF Fusion, Reranking
            const { getReranker } = require('./graphrag');
            const { getHyDE } = require('./graphrag');
            
            const embedProvider = config.llm?.embeddingsProvider || 'ollama';
            const embedProviderConfig = config.llm?.providers?.[embedProvider] || {};
            const embedModel = config.llm?.models?.embeddings || 'mxbai-embed-large';
            
            // Initialize SOTA modules with LLM config
            const reranker = getReranker({
                llmProvider: provider,
                llmModel: model,
                llmConfig: config.llm
            });
            
            // Try hybrid search (semantic + keyword) if embeddings are available
            const embeddingsData = storage.loadEmbeddings();
            let hybridResults = [];
            let vectorResults = [];
            let keywordResults = [];
            let useHyDE = false;
            
            // Check if using Supabase vector search or local embeddings
            const isSupabaseMode = embeddingsData?.isSupabaseMode === true;
            
            // Extract entity type hints from ontology classification for filtered search
            let entityTypeFilter = null;
            if (graphProvider && global.graphRAGEngine) {
                const queryAnalysis = global.graphRAGEngine.classifyQuery(searchQuery);
                if (queryAnalysis.entityHints?.length > 0) {
                    // Map ontology hints to storage entity types (h can be string or {type,keyword})
                    const typeMap = { 'Person': 'person', 'Project': 'fact', 'Meeting': 'decision', 'Technology': 'fact', 'Risk': 'risk', 'Task': 'question' };
                    entityTypeFilter = queryAnalysis.entityHints.map(h => {
                        const t = typeof h === 'string' ? h : (h?.type || h?.name || '');
                        return typeMap[t] || (typeof t === 'string' && t ? t.toLowerCase() : null);
                    }).filter(Boolean);
                    console.log(`[Chat] Ontology entity hints: ${entityTypeFilter.join(', ')}`);
                }
            }
            
            if (useSemantic && isSupabaseMode && storage.searchWithEmbedding) {
                // ==================== SUPABASE VECTOR SEARCH (SOTA) ====================
                console.log(`[Chat] Using Supabase vector search for RAG`);
                
                try {
                    // Check embedding cache first (SOTA optimization)
                    const queryText = processedQuery.expanded || message;
                    let queryEmbedding = getCachedQueryEmbedding(queryText, embedModel);
                    
                    if (queryEmbedding) {
                        console.log(`[Chat] Using cached query embedding`);
                    } else {
                        const queryResult = await llm.embed({
                            provider: embedProvider,
                            providerConfig: embedProviderConfig,
                            model: embedModel,
                            texts: [queryText]
                        });
                        
                        if (queryResult.success && queryResult.embeddings?.[0]) {
                            queryEmbedding = queryResult.embeddings[0];
                            setCachedQueryEmbedding(queryText, embedModel, queryEmbedding);
                        }
                    }
                    
                    if (queryEmbedding) {
                        // Use Supabase hybrid search (vector + keyword) with entity type filter
                        hybridResults = await storage.searchWithEmbedding(
                            processedQuery.expanded || message,
                            queryEmbedding,
                            { 
                                limit: 20, // Get more for RRF fusion
                                threshold: 0.35, // Lower threshold for broader recall
                                useHybrid: true,
                                entityTypes: entityTypeFilter // Use ontology hints
                            }
                        );
                        vectorResults = hybridResults.filter(r => r.source === 'semantic' || r.semanticScore > 0.3);
                        keywordResults = hybridResults.filter(r => r.keywordScore > 0.3);
                        console.log(`[Chat] Supabase search: ${hybridResults.length} total (${vectorResults.length} semantic, ${keywordResults.length} keyword)`);
                        
                        // Try HyDE if initial results are sparse
                        if (hybridResults.length < 5 && processedQuery.terms.length >= 2) {
                            useHyDE = true;
                            console.log(`[Chat] Sparse results (${hybridResults.length}), trying HyDE...`);
                            
                            const hyde = getHyDE({
                                llmProvider: provider,
                                llmModel: model,
                                llmConfig: config.llm,
                                embeddingProvider: embedProvider,
                                embeddingModel: embedModel
                            });
                            
                            const hydeResult = await hyde.generateHyDEEmbedding(searchQuery, {
                                entityType: entityTypeFilter?.[0]
                            });
                            
                            if (hydeResult.embedding) {
                                const hydeResults = await storage.searchWithEmbedding(
                                    searchQuery,
                                    hydeResult.embedding,
                                    { limit: 10, threshold: 0.3, useHybrid: false }
                                );
                                console.log(`[Chat] HyDE search returned ${hydeResults.length} additional results`);
                                
                                // Merge HyDE results using RRF
                                if (hydeResults.length > 0) {
                                    const fusedResults = reranker.reciprocalRankFusion([hybridResults, hydeResults]);
                                    hybridResults = fusedResults.slice(0, 15);
                                }
                            }
                        }
                    }
                } catch (supaVectorErr) {
                    console.warn(`[Chat] Supabase vector search failed: ${supaVectorErr.message}, falling back to keyword`);
                    hybridResults = storage.hybridSearch(processedQuery.expanded || message, [], {
                        semanticWeight: 0,
                        keywordWeight: 1,
                        minScore: 0.15,
                        limit: 12
                    });
                }
            } else if (useSemantic && embeddingsData && embeddingsData.embeddings?.length > 0) {
                // ==================== LOCAL EMBEDDINGS (JSON) ====================
                const embedModel = embeddingsData.model || 'mxbai-embed-large';
                const embedProvider = config.llm?.embeddingsProvider || 'ollama';
                const embedProviderConfig = config.llm?.providers?.[embedProvider] || {};
                
                const queryResult = await llm.embed({
                    provider: embedProvider,
                    providerConfig: embedProviderConfig,
                    model: embedModel,
                    texts: [processedQuery.expanded || message]
                });

                if (queryResult.success && queryResult.embeddings?.[0]) {
                    // Get semantic results from local embeddings
                    const semanticResults = ollama.findSimilar(queryResult.embeddings[0], embeddingsData.embeddings, 20);
                    
                    // Use hybrid search to combine semantic + keyword results
                    hybridResults = storage.hybridSearch(processedQuery.expanded || message, semanticResults, {
                        semanticWeight: 0.6,
                        keywordWeight: 0.4,
                        minScore: 0.15,
                        limit: 12
                    });
                }
            } else {
                // ==================== KEYWORD ONLY FALLBACK ====================
                hybridResults = storage.hybridSearch(processedQuery.expanded || message, [], {
                    semanticWeight: 0,
                    keywordWeight: 1,
                    minScore: 0.15,
                    limit: 12
                });
            }

            // ==================== SOTA: RRF FUSION + RERANKING ====================
            // Fuse Graph RAG results with Hybrid Search results using Reciprocal Rank Fusion
            let finalResults = hybridResults;
            
            if (graphRAGResults && graphRAGResults.length > 0 && hybridResults.length > 0) {
                console.log(`[Chat] Fusing ${graphRAGResults.length} graph + ${hybridResults.length} hybrid results with RRF`);
                
                // Normalize graph results to have similar structure
                const normalizedGraphResults = graphRAGResults.map(r => ({
                    id: r.id || `graph_${Math.random().toString(36).substr(2, 9)}`,
                    type: r.type || 'entity',
                    text: r.content || r.name || '',
                    score: r.score || 0.5,
                    data: r.data || r,
                    source: 'graph'
                }));
                
                // Apply RRF fusion
                finalResults = reranker.reciprocalRankFusion([hybridResults, normalizedGraphResults]);
                console.log(`[Chat] RRF fusion produced ${finalResults.length} unique results`);
                
                // Apply query-dependent reranking for better precision
                const queryAnalysis = { type: queryType };
                finalResults = reranker.queryDependentRerank(searchQuery, finalResults, queryAnalysis);
                
                // Take top results
                finalResults = finalResults.slice(0, 12);
            } else if (graphRAGResults && graphRAGResults.length > 0) {
                // Only graph results available
                finalResults = graphRAGResults.map(r => ({
                    id: r.id || `graph_${Math.random().toString(36).substr(2, 9)}`,
                    type: r.type || 'entity',
                    text: r.content || r.name || '',
                    score: r.score || 0.5,
                    rrfScore: r.score || 0.5,
                    data: r.data || r,
                    source: 'graph'
                }));
            }
            // ==================== END SOTA FUSION ====================

            if (finalResults.length > 0) {
                // Determine context quality based on scores
                const avgScore = finalResults.reduce((sum, r) => sum + (r.rrfScore || r.score || 0), 0) / finalResults.length;
                const topScore = finalResults[0].rrfScore || finalResults[0].score || 0;

                if (topScore > 0.03 && avgScore > 0.02) contextQuality = 'high'; // RRF scores are smaller
                else if (topScore > 0.02 && avgScore > 0.01) contextQuality = 'medium';
                else contextQuality = 'low';

                const searchMethod = useHyDE ? 'HyDE + RRF Fusion' : (graphRAGResults?.length > 0 ? 'Graph + Vector RRF Fusion' : 'Hybrid Search');
                systemPrompt += `\n\n=== RELEVANT CONTEXT (${searchMethod} - Quality: ${contextQuality}) ===\n`;

                // Get items with metadata for richer context
                const itemIds = finalResults.map(r => r.id).filter(Boolean);
                const itemsWithMeta = storage.getItemsWithMetadata ? storage.getItemsWithMetadata(itemIds) : [];

                finalResults.forEach((result, idx) => {
                    const meta = itemsWithMeta.find(i => i.id === result.id) || result;
                    const score = result.rrfScore || result.relevanceScore || result.score || 0;

                    // Enrich person sources with contact data (contactName, contactRole, avatarUrl) for pills
                    let contactName, contactRole, avatarUrl;
                    if ((result.type === 'person' || result.type === 'Person') && result.id) {
                        const entityIdMatch = String(result.id).match(/^person_(.+)$/);
                        const entityId = entityIdMatch ? entityIdMatch[1] : result.id;
                        try {
                            const contact = storage.getContactById ? storage.getContactById(entityId) : null;
                            if (contact) {
                                contactName = contact.name;
                                contactRole = contact.role || contact.organization || '';
                                avatarUrl = contact.avatar_url || contact.photo_url || null;
                            } else {
                                const people = storage.getPeople ? storage.getPeople() : [];
                                const person = Array.isArray(people) ? people.find(p => p.id === entityId || `person_${p.id}` === result.id) : null;
                                if (person) {
                                    contactName = person.name;
                                    contactRole = person.role || person.organization || '';
                                    avatarUrl = person.avatar_url || person.photo_url || null;
                                }
                            }
                        } catch (e) { /* ignore */ }
                    }
                    // Also check result.data for graph results
                    if (!contactName && (result.data?.name || result.data?.properties?.name)) {
                        contactName = result.data.name || result.data.properties?.name;
                        contactRole = result.data.role || result.data.properties?.role || result.data.organization || '';
                        avatarUrl = result.data.avatar_url || result.data.properties?.avatar_url || null;
                    }

                    // Format with metadata
                    let itemHeader = `\n[${(result.type || 'unknown').toUpperCase()}]`;
                    if (meta.category) itemHeader += ` (${meta.category})`;
                    if (meta.priority) itemHeader += ` [${meta.priority}]`;
                    if (meta.impact) itemHeader += ` [impact: ${meta.impact}]`;
                    itemHeader += ` - relevance: ${Math.round(score * 100)}%`;
                    if (result.sourceCount > 1) itemHeader += ` | multi-source (${result.sourceCount})`;
                    if (meta.source || result.source) itemHeader += ` | from: ${meta.source || result.source}`;

                    systemPrompt += itemHeader + '\n';
                    systemPrompt += `${result.text || result.content || ''}\n`;

                    sources.push({
                        id: result.id,
                        type: result.type,
                        score: score,
                        rrfScore: result.rrfScore,
                        semanticScore: result.semanticScore,
                        keywordScore: result.keywordScore,
                        sourceCount: result.sourceCount,
                        source: meta.source || result.source || null,
                        contactName: contactName || undefined,
                        contactRole: contactRole || undefined,
                        avatarUrl: avatarUrl || undefined
                    });
                });

                systemPrompt += `\n=== END RELEVANT CONTEXT ===\n`;
                const searchInfo = useHyDE ? 'HyDE+RRF' : (graphRAGResults?.length > 0 ? 'Graph+Vector RRF' : 'Hybrid');
                console.log(`[Chat] Found ${finalResults.length} items via ${searchInfo} (quality: ${contextQuality}, top score: ${topScore.toFixed(4)})`);
            } else {
                // Fallback to keyword-only search if no results from SOTA pipeline
                const fallbackResults = storage.hybridSearch(message, [], {
                    semanticWeight: 0,
                    keywordWeight: 1,
                    minScore: 0.2,
                    limit: 10
                });

                if (fallbackResults.length > 0) {
                    systemPrompt += `\n\n=== RELEVANT CONTEXT (Keyword Search Fallback) ===\n`;
                    fallbackResults.forEach(result => {
                        systemPrompt += `\n[${result.type.toUpperCase()}] - match: ${Math.round(result.keywordScore * 100)}%\n`;
                        systemPrompt += `${result.text}\n`;
                        sources.push({
                            id: result.id,
                            type: result.type,
                            score: result.keywordScore
                        });
                    });
                    systemPrompt += `\n=== END RELEVANT CONTEXT ===\n`;
                    contextQuality = 'low';
                    console.log(`[Chat] Found ${fallbackResults.length} items via keyword fallback`);
                }
            }

            // Add GraphRAG context if available (already integrated via RRF, but add raw for complex queries)
            if (graphContext && sources.length < 8) {
                systemPrompt += graphContext;
                if (contextQuality === 'none' || contextQuality === 'low') {
                    contextQuality = 'medium'; // Upgrade quality since we have graph data
                }
                console.log(`[Chat] Added supplementary graph context`);
            }

            // Fall back to or supplement with traditional context if provided
            if (context && sources.length < 5) {
                systemPrompt += `\n\n=== ADDITIONAL CONTEXT ===\n`;

                if (context.sourceOfTruth && sources.length === 0) {
                    // Only include SOURCE_OF_TRUTH if no semantic results
                    systemPrompt += `\n--- SOURCE OF TRUTH ---\n${context.sourceOfTruth.substring(0, 4000)}\n`;
                }

                if (context.facts && context.facts.length > 0 && sources.length < 3) {
                    const factsToShow = context.facts.slice(0, 20);
                    systemPrompt += `\n--- FACTS (${context.facts.length} total, showing ${factsToShow.length}) ---\n`;
                    factsToShow.forEach(f => {
                        systemPrompt += `- [${f.category || 'general'}] ${f.content}\n`;
                    });
                }

                if (context.questions && context.questions.length > 0) {
                    const questionsToShow = context.questions.slice(0, 15);
                    systemPrompt += `\n--- PENDING QUESTIONS (${context.questions.length} total) ---\n`;
                    questionsToShow.forEach(q => {
                        systemPrompt += `- [${q.priority || 'medium'}] ${q.content}`;
                        if (q.assignee) systemPrompt += ` (Ask: ${q.assignee})`;
                        systemPrompt += `\n`;
                    });
                }

                if (context.decisions && context.decisions.length > 0) {
                    const decisionsToShow = context.decisions.slice(0, 15);
                    systemPrompt += `\n--- DECISIONS (${context.decisions.length} total) ---\n`;
                    decisionsToShow.forEach(d => {
                        systemPrompt += `- ${d.content}`;
                        if (d.date) systemPrompt += ` (${d.date})`;
                        if (d.owner) systemPrompt += ` - ${d.owner}`;
                        systemPrompt += `\n`;
                    });
                }

                systemPrompt += `\n=== END ADDITIONAL CONTEXT ===\n`;
            }

            // Build conversation history for context
            let conversationPrompt = systemPrompt + '\n\n';

            if (history.length > 0) {
                conversationPrompt += '=== CONVERSATION HISTORY ===\n';
                history.forEach(h => {
                    if (h.role === 'user') {
                        conversationPrompt += `User: ${h.content}\n`;
                    } else if (h.role === 'assistant') {
                        conversationPrompt += `Assistant: ${h.content}\n`;
                    }
                });
                conversationPrompt += '=== END HISTORY ===\n\n';
            }

            // Add language instruction if query was translated
            if (translatedQuery) {
                conversationPrompt += `\nIMPORTANT: The user asked in a non-English language. Respond in the SAME LANGUAGE as the user's original question.\n`;
                conversationPrompt += `Original question: "${message}"\n`;
            }

            conversationPrompt += `User: ${message}\n\nAssistant:`;

            try {
                console.log(`Chat request using provider: ${provider}, model: ${model} (${sources.length} sources, quality: ${contextQuality})`);
                
                // Use router for failover mode, direct call for single mode
                const routingMode = config.llm?.routing?.mode || 'single';
                let result;
                let routingInfo = null;
                
                if (routingMode === 'failover') {
                    const routeResult = await llmRouter.routeAndExecute('chat', 'generateText', {
                        prompt: conversationPrompt,
                        temperature: 0.7,
                        maxTokens: 2048
                    }, config);
                    
                    result = routeResult.result || routeResult;
                    routingInfo = routeResult.routing;
                    
                    if (!routeResult.success) {
                        throw new Error(routeResult.error?.message || 'All providers failed');
                    }
                } else {
                    result = await llm.generateText({
                        provider,
                        providerConfig,
                        model,
                        prompt: conversationPrompt,
                        temperature: 0.7,
                        maxTokens: 2048,
                        context: 'chat'
                    });
                }
                
                // Normalize result format
                const success = result.success;
                const response = result.text;

                if (success) {
                    // Clean response (remove thinking blocks if any)
                    let cleanedResponse = response || '';
                    cleanedResponse = cleanedResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                    // Calculate confidence based on context quality and response
                    let confidence = 'low';
                    if (contextQuality === 'high' && sources.length >= 3) {
                        confidence = 'high';
                    } else if (contextQuality === 'medium' || sources.length >= 2) {
                        confidence = 'medium';
                    }

                    // Detect "I don't know" patterns in response
                    const uncertainPhrases = [
                        'i don\'t have enough information',
                        'i cannot find',
                        'not mentioned in the context',
                        'no information available',
                        'unable to determine'
                    ];
                    const responseLower = cleanedResponse.toLowerCase();
                    const isUncertain = uncertainPhrases.some(phrase => responseLower.includes(phrase));
                    if (isUncertain) confidence = 'low';

                    // Persist messages to database if session exists
                    if (sessionId && storage.appendChatMessage) {
                        try {
                            await storage.appendChatMessage(sessionId, 'user', message, {});
                            await storage.appendChatMessage(sessionId, 'assistant', cleanedResponse, {
                                sources: sources.length > 0 ? sources : [],
                                metadata: { queryType, confidence, contextQuality, rag: { method: useHyDE ? 'hyde+rrf' : (graphRAGResults?.length > 0 ? 'graph+vector+rrf' : 'hybrid') } }
                            });
                        } catch (persistErr) {
                            console.warn('[Chat] Could not persist messages:', persistErr.message);
                        }
                    }

                    jsonResponse(res, {
                        success: true,
                        response: cleanedResponse,
                        sessionId: sessionId || undefined,
                        model: routingInfo?.model || model,
                        provider: routingInfo?.usedProvider || provider,
                        confidence: confidence,
                        contextQuality: contextQuality,
                        queryType: queryType, // SOTA: query classification
                        sources: sources.length > 0 ? sources : undefined,
                        rag: {
                            method: useHyDE ? 'hyde+rrf' : (graphRAGResults?.length > 0 ? 'graph+vector+rrf' : 'hybrid'),
                            vectorResults: vectorResults?.length || 0,
                            graphResults: graphRAGResults?.length || 0,
                            fusedResults: finalResults?.length || 0,
                            usedHyDE: useHyDE,
                            entityFilter: entityTypeFilter
                        },
                        routing: routingInfo ? {
                            mode: routingInfo.mode,
                            usedProvider: routingInfo.usedProvider,
                            attempts: routingInfo.attempts?.length || 1
                        } : undefined
                    });
                } else {
                    jsonResponse(res, { success: false, error: result.error || 'Failed to generate response' }, 500);
                }
            } catch (error) {
                console.error('Chat error:', error);
                jsonResponse(res, { success: false, error: 'Chat error: ' + error.message }, 500);
            }
            return;
        }

        // GET /api/file-logs - Get detailed file processing logs
        if (pathname === '/api/file-logs' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const limit = parseInt(parsedUrl.query.limit) || 50;
            const logs = storage.getFileLogs(limit);
            jsonResponse(res, { logs });
            return;
        }

        // GET /api/documents - List documents with pagination and filtering
        if (pathname === '/api/documents' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const status = parsedUrl.query.status || null;
            const limit = Math.min(parseInt(parsedUrl.query.limit) || 50, 200); // Max 200
            const offset = parseInt(parsedUrl.query.offset) || 0;
            const sortBy = ['created_at', 'updated_at', 'filename'].includes(parsedUrl.query.sort) 
                ? parsedUrl.query.sort : 'created_at';
            const order = parsedUrl.query.order === 'asc' ? true : false;
            const docType = parsedUrl.query.type || null; // documents, transcripts, emails, images
            const search = parsedUrl.query.search || null;
            
            try {
                const projectId = storage._supabase.getProjectId();
                
                // Build query with server-side filtering
                let query = storage._supabase.supabase
                    .from('documents')
                    .select('id, filename, filepath, file_type, doc_type, status, created_at, updated_at, processed_at, summary, facts_count, decisions_count, risks_count, actions_count, questions_count, file_size, deleted_at', { count: 'exact' })
                    .eq('project_id', projectId);
                
                // Apply status filter
                // Handle 'deleted' filter (soft delete with deleted_at) and 'processed' vs 'completed' naming
                if (status === 'deleted') {
                    // Show only soft-deleted documents
                    query = query.not('deleted_at', 'is', null);
                } else {
                    // Normal documents - exclude deleted
                    query = query.is('deleted_at', null);
                    
                    if (status && status !== 'all') {
                        if (status === 'processed') {
                            // Include 'completed' as alias for 'processed'
                            query = query.in('status', ['processed', 'completed']);
                        } else if (status === 'pending') {
                            // Include 'processing' in pending filter (frontend shows them together)
                            query = query.in('status', ['pending', 'processing']);
                        } else {
                            query = query.eq('status', status);
                        }
                    }
                }
                
                // Apply doc_type filter
                if (docType && docType !== 'all') {
                    if (docType === 'transcripts') {
                        query = query.eq('doc_type', 'transcript');
                    } else if (docType === 'emails') {
                        query = query.eq('doc_type', 'email');
                    } else if (docType === 'images') {
                        query = query.in('file_type', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
                    } else if (docType === 'documents') {
                        query = query.not('doc_type', 'in', '(transcript,email)')
                            .not('file_type', 'in', '(png,jpg,jpeg,gif,webp,svg)');
                    }
                }
                
                // Apply search filter
                if (search && search.length >= 2) {
                    query = query.ilike('filename', `%${search}%`);
                }
                
                // Apply sorting and pagination
                query = query
                    .order(sortBy, { ascending: order })
                    .range(offset, offset + limit - 1);
                
                const { data: documents, error, count } = await query;
                
                console.log('[Documents] Query result:', { 
                    count, 
                    docsLength: documents?.length || 0,
                    status,
                    projectId,
                    error: error?.message,
                    docStatuses: documents?.map(d => ({ id: d.id?.slice(0,8), status: d.status, deleted: !!d.deleted_at }))
                });
                
                if (error) throw error;
                
                // Get status counts for the filter bar (separate lightweight query)
                const { data: statusCounts } = await storage._supabase.supabase
                    .from('documents')
                    .select('status, deleted_at')
                    .eq('project_id', projectId);
                
                const activeItems = (statusCounts || []).filter(d => !d.deleted_at);
                const deletedItems = (statusCounts || []).filter(d => d.deleted_at);
                
                const statuses = {
                    processed: activeItems.filter(d => d.status === 'processed' || d.status === 'completed').length,
                    pending: activeItems.filter(d => d.status === 'pending').length,
                    processing: activeItems.filter(d => d.status === 'processing').length,
                    failed: activeItems.filter(d => d.status === 'failed').length,
                    deleted: deletedItems.length
                };
                
                console.log('[Documents] Status counts:', statuses, 'Total active:', activeItems.length, 'Total deleted:', deletedItems.length);
                
                jsonResponse(res, { 
                    documents: documents || [],
                    total: count || 0,
                    limit,
                    offset,
                    hasMore: offset + limit < (count || 0),
                    statuses
                });
            } catch (err) {
                console.error('[Documents] List error:', err.message);
                // Fallback to cache
                const documents = storage.getDocuments(status);
                jsonResponse(res, { 
                    documents,
                    total: documents.length,
                    limit,
                    offset: 0,
                    hasMore: false,
                    statuses: {
                        processed: documents.filter(d => d.status === 'processed').length,
                        pending: documents.filter(d => d.status === 'pending').length,
                        failed: documents.filter(d => d.status === 'failed').length
                    }
                });
            }
            return;
        }

        // GET /api/documents/:id - Get a specific document with full content (supports UUID and numeric IDs)
        const docGetMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+|\d+)$/i);
        if (docGetMatch && req.method === 'GET') {
            const docId = docGetMatch[1];
            try {
                // Fetch directly from Supabase to ensure we get the latest data including content
                const { data: doc, error } = await storage._supabase.supabase
                    .from('documents')
                    .select('*')
                    .eq('id', docId)
                    .single();
                
                if (error || !doc) {
                    // Fallback to cache
                    const cachedDoc = storage.getDocumentById(docId);
                    if (cachedDoc) {
                        jsonResponse(res, { document: cachedDoc });
                    } else {
                        jsonResponse(res, { error: 'Document not found' }, 404);
                    }
                } else {
                    jsonResponse(res, { document: doc });
                }
            } catch (err) {
                // Fallback to cache on error
                const cachedDoc = storage.getDocumentById(docId);
                if (cachedDoc) {
                    jsonResponse(res, { document: cachedDoc });
                } else {
                    jsonResponse(res, { error: 'Document not found' }, 404);
                }
            }
            return;
        }

        // DELETE /api/documents/:id - Delete a document with cascade (supports UUID and numeric IDs)
        const docDeleteMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+|\d+)$/i);
        if (docDeleteMatch && req.method === 'DELETE') {
            const docId = docDeleteMatch[1];
            const body = await parseBody(req);
            const options = {
                softDelete: body.softDelete !== false, // Default to soft delete
                deletePhysicalFile: body.deletePhysicalFile || false,
                backupData: body.backupData !== false // Default to backup
            };
            
            try {
                const result = await storage.deleteDocument(docId, options);
                
                // Invalidate caches
                invalidateBriefingCache();
                
                // Delete from graph if connected
                const graphProvider = storage.getGraphProvider();
                if (graphProvider && graphProvider.connected) {
                    try {
                        await graphProvider.query(
                            `MATCH (d:Document {id: $id}) DETACH DELETE d`,
                            { id: docId }
                        );
                        console.log(`[Graph] Document ${docId} deleted from FalkorDB`);
                    } catch (graphErr) {
                        console.log('[Graph] Document delete error:', graphErr.message);
                    }
                }
                
                jsonResponse(res, {
                    success: true,
                    ok: true,
                    message: `Document and related data deleted`,
                    deleted: result.deleted
                });
            } catch (error) {
                console.error('[API] deleteDocument error:', error);
                jsonResponse(res, { success: false, ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/documents/:id/restore - Restore a soft-deleted document
        if (pathname.match(/^\/api\/documents\/\d+\/restore$/) && req.method === 'POST') {
            const docId = parseInt(pathname.split('/')[3]);
            const doc = storage.getDocumentById(docId);
            
            if (!doc) {
                jsonResponse(res, { error: 'Document not found' }, 404);
                return;
            }
            
            if (doc.status !== 'deleted') {
                jsonResponse(res, { error: 'Document is not deleted' }, 400);
                return;
            }
            
            doc.status = 'processed';
            delete doc.deleted_at;
            storage.saveDocuments();
            
            jsonResponse(res, {
                success: true,
                message: `Document "${doc.name}" restored`,
                document: doc
            });
            return;
        }

        // ============================================
        // DOCUMENT ANALYSIS, VERSIONS, ACTIVITY, FAVORITES, SHARING
        // ============================================

        // GET /api/documents/:id/analysis - Get AI analysis history
        const analysisMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/analysis$/i);
        if (analysisMatch && req.method === 'GET') {
            const docId = analysisMatch[1];
            try {
                const { data, error } = await storage._supabase.supabase
                    .from('ai_analysis_log')
                    .select('*')
                    .eq('document_id', docId)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error('[Analysis] Query error:', error.message);
                    throw error;
                }
                jsonResponse(res, { analyses: data || [] });
            } catch (err) {
                console.error('[Analysis] Failed to load analysis history:', err.message);
                jsonResponse(res, { analyses: [] });
            }
            return;
        }

        // GET /api/documents/:id/extraction - Get extraction data with notes (v1.6)
        const extractionMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/extraction$/i);
        if (extractionMatch && req.method === 'GET') {
            const docId = extractionMatch[1];
            try {
                const { data, error } = await storage._supabase.supabase
                    .from('documents')
                    .select('extraction_result, ai_title, ai_summary')
                    .eq('id', docId)
                    .single();
                
                if (error) throw error;
                jsonResponse(res, { extraction: data?.extraction_result || null });
            } catch (err) {
                jsonResponse(res, { extraction: null });
            }
            return;
        }

        // GET /api/documents/:id/versions - Get version history
        const versionsGetMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/versions$/i);
        if (versionsGetMatch && req.method === 'GET') {
            const docId = versionsGetMatch[1];
            try {
                const { data, error } = await storage._supabase.supabase
                    .from('document_versions')
                    .select('*')
                    .eq('document_id', docId)
                    .order('version_number', { ascending: false });
                
                if (error) throw error;
                jsonResponse(res, { versions: data || [] });
            } catch (err) {
                jsonResponse(res, { versions: [] });
            }
            return;
        }

        // GET /api/documents/:id/compare/:versionId - Compare document versions
        const compareMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/compare\/([a-f0-9\-]+)$/i);
        if (compareMatch && req.method === 'GET') {
            const docId = compareMatch[1];
            const compareVersionId = compareMatch[2];
            
            try {
                // Get current document content
                const { data: doc } = await storage._supabase.supabase
                    .from('documents')
                    .select('content, summary, filename')
                    .eq('id', docId)
                    .single();

                // Get version content
                const { data: version } = await storage._supabase.supabase
                    .from('document_versions')
                    .select('content, summary, version_number, filename')
                    .eq('id', compareVersionId)
                    .single();

                if (!doc || !version) {
                    jsonResponse(res, { error: 'Document or version not found' }, 404);
                    return;
                }

                // Generate diff
                const currentContent = doc.content || '';
                const versionContent = version.content || '';
                
                // Line-by-line diff
                const currentLines = currentContent.split('\n');
                const versionLines = versionContent.split('\n');
                
                const diff = {
                    additions: 0,
                    deletions: 0,
                    changes: []
                };
                
                // Simple diff algorithm
                const maxLines = Math.max(currentLines.length, versionLines.length);
                for (let i = 0; i < maxLines; i++) {
                    const currentLine = currentLines[i] || '';
                    const versionLine = versionLines[i] || '';
                    
                    if (currentLine !== versionLine) {
                        if (currentLine && !versionLine) {
                            diff.additions++;
                            diff.changes.push({ type: 'add', line: i + 1, content: currentLine });
                        } else if (!currentLine && versionLine) {
                            diff.deletions++;
                            diff.changes.push({ type: 'delete', line: i + 1, content: versionLine });
                        } else {
                            diff.deletions++;
                            diff.additions++;
                            diff.changes.push({ type: 'change', line: i + 1, old: versionLine, new: currentLine });
                        }
                    }
                }

                // Get entity differences
                const entityTypes = ['facts', 'decisions', 'risks', 'action_items', 'knowledge_questions'];
                const entityDiff = {};
                
                for (const table of entityTypes) {
                    const { count: currentCount } = await storage._supabase.supabase
                        .from(table)
                        .select('id', { count: 'exact', head: true })
                        .eq('source_document_id', docId);
                    
                    entityDiff[table.replace('action_items', 'actions').replace('knowledge_questions', 'questions')] = {
                        current: currentCount || 0
                    };
                }

                jsonResponse(res, {
                    current: {
                        filename: doc.filename,
                        summary: doc.summary,
                        content_preview: currentContent.substring(0, 500)
                    },
                    version: {
                        version_number: version.version_number,
                        filename: version.filename,
                        summary: version.summary,
                        content_preview: versionContent.substring(0, 500)
                    },
                    diff: {
                        stats: {
                            additions: diff.additions,
                            deletions: diff.deletions,
                            total_changes: diff.changes.length
                        },
                        changes: diff.changes.slice(0, 100), // Limit to first 100 changes
                        entities: entityDiff
                    }
                });
            } catch (err) {
                console.error('[Compare] Error:', err);
                jsonResponse(res, { error: 'Failed to compare versions' }, 500);
            }
            return;
        }

        // POST /api/documents/:id/versions - Upload new version
        const versionsPostMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/versions$/i);
        if (versionsPostMatch && req.method === 'POST') {
            const docId = versionsPostMatch[1];
            // Handle multipart form data - for now return placeholder
            jsonResponse(res, { 
                success: true, 
                message: 'Version upload endpoint - implement with file handling',
                document_id: docId 
            });
            return;
        }

        // GET /api/documents/:id/activity - Get activity log
        const activityMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/activity$/i);
        if (activityMatch && req.method === 'GET') {
            const docId = activityMatch[1];
            try {
                // Query activity without join (user_id references auth.users, not user_profiles)
                const { data: activities, error } = await storage._supabase.supabase
                    .from('document_activity')
                    .select('*')
                    .eq('document_id', docId)
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) {
                    console.error('[Activity] Query error:', error.message);
                    throw error;
                }
                
                // Fetch user profiles separately if needed
                const userIds = [...new Set((activities || []).map(a => a.user_id).filter(Boolean))];
                let userMap = {};
                
                if (userIds.length > 0) {
                    const { data: profiles } = await storage._supabase.supabase
                        .from('user_profiles')
                        .select('id, display_name, avatar_url')
                        .in('id', userIds);
                    
                    if (profiles) {
                        userMap = Object.fromEntries(profiles.map(p => [p.id, p]));
                    }
                }
                
                // Transform to include user name
                const result = (activities || []).map(a => ({
                    ...a,
                    user_name: userMap[a.user_id]?.display_name || a.user_name || 'System',
                    user_avatar: userMap[a.user_id]?.avatar_url || a.user_avatar
                }));
                
                jsonResponse(res, { activities: result });
            } catch (err) {
                console.error('[Activity] Failed to load activity:', err.message);
                jsonResponse(res, { activities: [] });
            }
            return;
        }

        // GET /api/documents/:id/favorite - Check if document is favorite
        const favoriteGetMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/favorite$/i);
        if (favoriteGetMatch && req.method === 'GET') {
            const docId = favoriteGetMatch[1];
            const userId = await getCurrentUserId(req, storage);
            
            if (!userId) {
                jsonResponse(res, { is_favorite: false });
                return;
            }
            
            try {
                const { data, error } = await storage._supabase.supabase
                    .from('document_favorites')
                    .select('id')
                    .eq('document_id', docId)
                    .eq('user_id', userId)
                    .single();
                
                jsonResponse(res, { is_favorite: !!data && !error });
            } catch (err) {
                jsonResponse(res, { is_favorite: false });
            }
            return;
        }

        // POST /api/documents/:id/favorite - Toggle favorite
        const favoritePostMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/favorite$/i);
        if (favoritePostMatch && req.method === 'POST') {
            const docId = favoritePostMatch[1];
            const userId = await getCurrentUserId(req, storage);
            
            if (!userId) {
                jsonResponse(res, { error: 'Not authenticated' }, 401);
                return;
            }
            
            try {
                // Check if already favorite
                const { data: existing } = await storage._supabase.supabase
                    .from('document_favorites')
                    .select('id')
                    .eq('document_id', docId)
                    .eq('user_id', userId)
                    .single();
                
                if (existing) {
                    // Remove favorite
                    await storage._supabase.supabase
                        .from('document_favorites')
                        .delete()
                        .eq('document_id', docId)
                        .eq('user_id', userId);
                    
                    jsonResponse(res, { is_favorite: false, message: 'Removed from favorites' });
                } else {
                    // Add favorite
                    await storage._supabase.supabase
                        .from('document_favorites')
                        .insert({ document_id: docId, user_id: userId });
                    
                    jsonResponse(res, { is_favorite: true, message: 'Added to favorites' });
                }
            } catch (err) {
                jsonResponse(res, { error: 'Failed to update favorite' }, 500);
            }
            return;
        }

        // GET /api/documents/:id/reprocess/check - Check if reprocess will have same content (hash check)
        const reprocessCheckMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/reprocess\/check$/i);
        if (reprocessCheckMatch && req.method === 'GET') {
            const docId = reprocessCheckMatch[1];
            
            try {
                const { data: doc, error: docError } = await storage._supabase.supabase
                    .from('documents')
                    .select('*')
                    .eq('id', docId)
                    .single();
                
                if (docError || !doc) {
                    jsonResponse(res, { error: 'Document not found' }, 404);
                    return;
                }
                
                // Find content file
                let filePath = doc.filepath || doc.path;
                const projectDataDir = storage.getProjectDataDir();
                const contentDir = path.join(projectDataDir, 'content');
                const baseName = path.basename(doc.filename || '', path.extname(doc.filename || ''));
                const contentFilePath = path.join(contentDir, `${baseName}.md`);
                
                if ((!filePath || !fs.existsSync(filePath)) && fs.existsSync(contentFilePath)) {
                    filePath = contentFilePath;
                }
                
                let currentHash = null;
                let hasContent = false;
                
                if (filePath && fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    currentHash = require('crypto').createHash('md5').update(content).digest('hex');
                    hasContent = true;
                } else if (doc.content) {
                    currentHash = require('crypto').createHash('md5').update(doc.content).digest('hex');
                    hasContent = true;
                }
                
                const previousHash = doc.content_hash || doc.file_hash;
                const hashMatch = previousHash && currentHash && previousHash === currentHash;
                
                // Count existing entities from this document
                const entityCounts = {};
                for (const type of ['facts', 'decisions', 'risks', 'actions', 'questions']) {
                    try {
                        const { count } = await storage._supabase.supabase
                            .from(type)
                            .select('id', { count: 'exact', head: true })
                            .eq('source_document_id', docId);
                        entityCounts[type] = count || 0;
                    } catch {
                        entityCounts[type] = 0;
                    }
                }
                
                jsonResponse(res, {
                    document_id: docId,
                    has_content: hasContent,
                    current_hash: currentHash,
                    previous_hash: previousHash,
                    hash_match: hashMatch,
                    existing_entities: entityCounts,
                    total_entities: Object.values(entityCounts).reduce((a, b) => a + b, 0),
                    status: doc.status
                });
            } catch (err) {
                console.error('[Reprocess Check] Error:', err);
                jsonResponse(res, { error: 'Failed to check document' }, 500);
            }
            return;
        }

        // POST /api/documents/:id/reset-status - Reset a stuck document's status
        const resetStatusMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/reset-status$/i);
        if (resetStatusMatch && req.method === 'POST') {
            const docId = resetStatusMatch[1];
            
            try {
                // Get current document
                const { data: doc, error: fetchError } = await storage._supabase.supabase
                    .from('documents')
                    .select('id, status, filename')
                    .eq('id', docId)
                    .single();
                
                if (fetchError || !doc) {
                    jsonResponse(res, { error: 'Document not found' }, 404);
                    return;
                }
                
                // Only allow resetting documents stuck in 'processing'
                if (doc.status !== 'processing') {
                    jsonResponse(res, { error: `Document is not stuck (status: ${doc.status})` }, 400);
                    return;
                }
                
                // Reset to 'completed' (or 'pending' if never processed)
                const { error: updateError } = await storage._supabase.supabase
                    .from('documents')
                    .update({ 
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', docId);
                
                if (updateError) throw updateError;
                
                console.log(`[Documents] Reset status for ${doc.filename} (${docId}) from 'processing' to 'completed'`);
                
                jsonResponse(res, { 
                    success: true, 
                    message: `Document status reset to 'completed'`,
                    document: { id: docId, filename: doc.filename, status: 'completed' }
                });
            } catch (err) {
                console.error('[Documents] Reset status error:', err.message);
                jsonResponse(res, { error: 'Failed to reset document status' }, 500);
            }
            return;
        }

        // POST /api/documents/:id/reprocess - Reprocess a document (unified with upload flow)
        const reprocessMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/reprocess$/i);
        if (reprocessMatch && req.method === 'POST') {
            const docId = reprocessMatch[1];
            
            // Rate limit: 5 reprocess requests per minute per IP
            const rateLimitKey = getRateLimitKey(req, 'reprocess');
            if (!checkRateLimit(rateLimitKey, 5, 60000)) {
                rateLimitResponse(res);
                return;
            }
            
            // Validate UUID
            if (!isValidUUID(docId)) {
                jsonResponse(res, { error: 'Invalid document ID' }, 400);
                return;
            }
            
            try {
                // Get document info to check status
                const { data: doc, error: docError } = await storage._supabase.supabase
                    .from('documents')
                    .select('id, filename, status, project_id')
                    .eq('id', docId)
                    .single();
                
                if (docError || !doc) {
                    jsonResponse(res, { error: 'Document not found' }, 404);
                    return;
                }
                
                // Check if already processing (prevent concurrent reprocess)
                if (doc.status === 'processing') {
                    jsonResponse(res, { 
                        error: 'Document is already being reprocessed',
                        status: 'processing'
                    }, 409);
                    return;
                }
                
                // Log activity
                const userId = await getCurrentUserId(req, storage);
                if (userId) {
                    try {
                        await storage._supabase.supabase
                            .from('document_activity')
                            .insert({
                                document_id: docId,
                                project_id: doc.project_id,
                                user_id: userId,
                                action: 'reprocess_started',
                                metadata: { triggered_by: 'user' }
                            });
                    } catch (activityErr) {
                        console.warn('[Reprocess] Failed to log activity:', activityErr.message);
                    }
                }
                
                // Respond immediately
                jsonResponse(res, { 
                    success: true, 
                    message: 'Document reprocessing started',
                    document_id: docId
                });
                
                // Process in background using the unified processor method
                processor.reprocessDocument(docId).then(result => {
                    if (result.success) {
                        console.log(`[Reprocess] Complete: ${doc.filename} - ${result.entities} entities extracted`);
                    } else {
                        console.error(`[Reprocess] Failed: ${doc.filename} - ${result.error}`);
                    }
                }).catch(err => {
                    console.error(`[Reprocess] Unexpected error: ${err.message}`);
                });
                
            } catch (err) {
                console.error('[Reprocess] Error:', err);
                jsonResponse(res, { error: 'Failed to reprocess document' }, 500);
            }
            return;
        }

        // ==================== BULK OPERATIONS ====================

        // POST /api/documents/bulk/delete - Bulk delete documents with cascade
        if (pathname === '/api/documents/bulk/delete' && req.method === 'POST') {
            // Rate limit: 10 bulk delete requests per minute
            const rateLimitKey = getRateLimitKey(req, 'bulk-delete');
            if (!checkRateLimit(rateLimitKey, 10, 60000)) {
                rateLimitResponse(res);
                return;
            }
            
            const body = await parseBody(req);
            const ids = body.ids;
            
            if (!Array.isArray(ids) || ids.length === 0) {
                jsonResponse(res, { error: 'ids array is required' }, 400);
                return;
            }
            
            // Validate all UUIDs first
            const invalidIds = ids.filter(id => !isValidUUID(id));
            if (invalidIds.length > 0) {
                jsonResponse(res, { 
                    error: 'Invalid document IDs', 
                    invalid: invalidIds 
                }, 400);
                return;
            }

            try {
                const results = { 
                    success: [], 
                    failed: [], 
                    deleted: 0, 
                    entitiesDeactivated: 0 
                };
                const timestamp = new Date().toISOString();
                const entityTables = ['facts', 'decisions', 'risks', 'action_items', 'knowledge_questions'];
                
                for (const id of ids) {
                    try {
                        // Soft delete the document
                        const { error: deleteError } = await storage._supabase.supabase
                            .from('documents')
                            .update({ deleted_at: timestamp })
                            .eq('id', id);
                        
                        if (deleteError) throw deleteError;
                        
                        // Cascade: deactivate related entities
                        let entitiesCount = 0;
                        for (const table of entityTables) {
                            try {
                                const { count } = await storage._supabase.supabase
                                    .from(table)
                                    .update({ is_active: false })
                                    .eq('source_document_id', id)
                                    .select('id', { count: 'exact', head: true });
                                entitiesCount += count || 0;
                            } catch (entityErr) {
                                // Some tables may not have is_active column, that's ok
                            }
                        }
                        
                        results.success.push({ id, entitiesDeactivated: entitiesCount });
                        results.deleted++;
                        results.entitiesDeactivated += entitiesCount;
                    } catch (err) {
                        results.failed.push({ id, error: err.message });
                    }
                }
                
                // Invalidate briefing cache
                invalidateBriefingCache();

                jsonResponse(res, { 
                    success: results.failed.length === 0, 
                    deleted: results.deleted,
                    entitiesDeactivated: results.entitiesDeactivated,
                    results: results.success,
                    errors: results.failed
                });
            } catch (err) {
                console.error('[BulkDelete] Error:', err);
                jsonResponse(res, { error: 'Failed to delete documents' }, 500);
            }
            return;
        }

        // POST /api/documents/bulk/reprocess - Bulk reprocess documents (unified with upload flow)
        if (pathname === '/api/documents/bulk/reprocess' && req.method === 'POST') {
            // Rate limit: 3 bulk reprocess requests per minute (expensive operation)
            const rateLimitKey = getRateLimitKey(req, 'bulk-reprocess');
            if (!checkRateLimit(rateLimitKey, 3, 60000)) {
                rateLimitResponse(res);
                return;
            }
            
            const body = await parseBody(req);
            const ids = body.ids;
            
            if (!Array.isArray(ids) || ids.length === 0) {
                jsonResponse(res, { error: 'ids array is required' }, 400);
                return;
            }
            
            // Validate all UUIDs first
            const invalidIds = ids.filter(id => !isValidUUID(id));
            if (invalidIds.length > 0) {
                jsonResponse(res, { 
                    error: 'Invalid document IDs', 
                    invalid: invalidIds 
                }, 400);
                return;
            }

            // Respond immediately
            jsonResponse(res, { 
                success: true, 
                message: `${ids.length} documents queued for reprocessing`,
                queued: ids,
                failed: []
            });

            // Process all documents in background using the unified processor method
            (async () => {
                console.log(`[BulkReprocess] Starting reprocess for ${ids.length} documents`);
                let completed = 0;
                let failed = 0;
                
                for (const docId of ids) {
                    try {
                        const result = await processor.reprocessDocument(docId);
                        if (result.success) {
                            completed++;
                            console.log(`[BulkReprocess] ${completed}/${ids.length} - ${docId}: ${result.entities} entities`);
                        } else {
                            failed++;
                            console.error(`[BulkReprocess] ${completed}/${ids.length} - ${docId}: FAILED - ${result.error}`);
                        }
                    } catch (err) {
                        failed++;
                        console.error(`[BulkReprocess] Error processing ${docId}:`, err.message);
                    }
                }
                
                console.log(`[BulkReprocess] Completed: ${completed} successful, ${failed} failed out of ${ids.length} total`);
            })();

            return;
        }

        // POST /api/documents/bulk/export - Bulk export as ZIP
        if (pathname === '/api/documents/bulk/export' && req.method === 'POST') {
            const body = await parseBody(req);
            const ids = body.ids;
            const format = body.format || 'original'; // 'original' or 'markdown'
            
            if (!Array.isArray(ids) || ids.length === 0) {
                jsonResponse(res, { error: 'ids array is required' }, 400);
                return;
            }

            try {
                const archiver = require('archiver');
                const archive = archiver('zip', { zlib: { level: 9 } });

                res.setHeader('Content-Type', 'application/zip');
                res.setHeader('Content-Disposition', `attachment; filename="documents_export_${Date.now()}.zip"`);

                archive.pipe(res);

                for (const id of ids) {
                    try {
                        const { data: doc } = await storage._supabase.supabase
                            .from('documents')
                            .select('*')
                            .eq('id', id)
                            .single();

                        if (!doc) continue;

                        if (format === 'markdown' && doc.content) {
                            // Export as markdown
                            const mdContent = `# ${doc.title || doc.filename}\n\n${doc.summary ? `## Summary\n${doc.summary}\n\n` : ''}## Content\n\n${doc.content}`;
                            archive.append(mdContent, { name: `${doc.filename.replace(/\.[^.]+$/, '')}.md` });
                        } else {
                            // Export original file
                            let filePath = doc.filepath;
                            if (!filePath || !fs.existsSync(filePath)) {
                                const contentDir = path.join(storage.getProjectDataDir(), 'content');
                                const baseName = doc.filename.replace(/\.[^.]+$/, '.md');
                                filePath = path.join(contentDir, baseName);
                            }

                            if (filePath && fs.existsSync(filePath)) {
                                archive.file(filePath, { name: doc.filename });
                            } else if (doc.content) {
                                archive.append(doc.content, { name: doc.filename });
                            }
                        }
                    } catch (err) {
                        console.error(`[BulkExport] Error adding ${id}:`, err);
                    }
                }

                await archive.finalize();
            } catch (err) {
                console.error('[BulkExport] Error:', err);
                jsonResponse(res, { error: 'Failed to export documents' }, 500);
            }
            return;
        }

        // POST /api/documents/:id/share - Create share link
        const sharePostMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/share$/i);
        if (sharePostMatch && req.method === 'POST') {
            const docId = sharePostMatch[1];
            const body = await parseBody(req);
            const userId = await getCurrentUserId(req, storage);
            
            try {
                // Generate token
                const crypto = require('crypto');
                const token = crypto.randomBytes(24).toString('base64url');
                
                // Calculate expiry
                let expiresAt = null;
                if (body.expires && body.expires !== 'never') {
                    const days = parseInt(body.expires) || 7;
                    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                }
                
                // Get project_id from document
                const { data: doc } = await storage._supabase.supabase
                    .from('documents')
                    .select('project_id')
                    .eq('id', docId)
                    .single();
                
                const { data, error } = await storage._supabase.supabase
                    .from('document_shares')
                    .insert({
                        document_id: docId,
                        project_id: doc?.project_id || storage.currentProjectId,
                        token,
                        expires_at: expiresAt,
                        max_views: body.max_views || null,
                        permissions: body.permissions || ['view'],
                        created_by: userId
                    })
                    .select()
                    .single();
                
                if (error) throw error;
                
                const baseUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
                jsonResponse(res, {
                    success: true,
                    url: `${baseUrl}/share/${token}`,
                    token,
                    share: data
                });
            } catch (err) {
                console.error('[Share] Error:', err);
                jsonResponse(res, { error: 'Failed to create share link' }, 500);
            }
            return;
        }

        // GET /api/documents/favorites/count - Count user's favorites
        if (pathname === '/api/documents/favorites/count' && req.method === 'GET') {
            const userId = await getCurrentUserId(req, storage);
            
            if (!userId) {
                jsonResponse(res, { count: 0 });
                return;
            }
            
            try {
                const { count, error } = await storage._supabase.supabase
                    .from('document_favorites')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);
                
                jsonResponse(res, { count: count || 0 });
            } catch (err) {
                jsonResponse(res, { count: 0 });
            }
            return;
        }

        // GET /api/documents/recent/count - Count user's recent views
        if (pathname === '/api/documents/recent/count' && req.method === 'GET') {
            const userId = await getCurrentUserId(req, storage);
            
            if (!userId) {
                jsonResponse(res, { count: 0 });
                return;
            }
            
            try {
                // Count views from last 7 days
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const { count, error } = await storage._supabase.supabase
                    .from('document_views')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('last_viewed_at', sevenDaysAgo);
                
                jsonResponse(res, { count: count || 0 });
            } catch (err) {
                jsonResponse(res, { count: 0 });
            }
            return;
        }

        // GET /api/documents/:id/download - Download document
        const downloadMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/download$/i);
        if (downloadMatch && req.method === 'GET') {
            const docId = downloadMatch[1];
            
            // Rate limit: 30 downloads per minute
            const rateLimitKey = getRateLimitKey(req, 'download');
            if (!checkRateLimit(rateLimitKey, 30, 60000)) {
                rateLimitResponse(res);
                return;
            }
            
            // Validate UUID format
            if (!isValidUUID(docId)) {
                jsonResponse(res, { error: 'Invalid document ID' }, 400);
                return;
            }
            
            try {
                const { data: doc } = await storage._supabase.supabase
                    .from('documents')
                    .select('filepath, filename, project_id')
                    .eq('id', docId)
                    .single();
                
                if (!doc || !doc.filepath) {
                    jsonResponse(res, { error: 'File not found' }, 404);
                    return;
                }
                
                // Security: Validate path is within project directory (prevent path traversal)
                const projectDataDir = storage.getProjectDataDir();
                if (!isPathWithinDirectory(doc.filepath, projectDataDir)) {
                    console.error('[Download] Path traversal attempt blocked:', doc.filepath);
                    jsonResponse(res, { error: 'Access denied' }, 403);
                    return;
                }
                
                if (!fs.existsSync(doc.filepath)) {
                    jsonResponse(res, { error: 'File not found on disk' }, 404);
                    return;
                }
                
                // Set security headers
                const safeFilename = sanitizeFilename(doc.filename || 'document');
                res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Content-Security-Policy', "default-src 'none'");
                
                const stream = fs.createReadStream(doc.filepath);
                stream.pipe(res);
            } catch (err) {
                console.error('[Download] Error:', err.message);
                jsonResponse(res, { error: 'Download failed' }, 500);
            }
            return;
        }

        // GET /api/documents/:id/thumbnail - Get document thumbnail
        const thumbnailMatch = pathname.match(/^\/api\/documents\/([a-f0-9\-]+)\/thumbnail$/i);
        if (thumbnailMatch && req.method === 'GET') {
            const docId = thumbnailMatch[1];
            
            try {
                const { data: doc } = await storage._supabase.supabase
                    .from('documents')
                    .select('filepath, filename, file_type, created_at')
                    .eq('id', docId)
                    .single();

                if (!doc) {
                    jsonResponse(res, { error: 'Document not found' }, 404);
                    return;
                }

                // Check cache first
                const cacheDir = path.join(storage.getProjectDataDir(), 'documents', 'cache', 'thumbnails');
                const cachePath = path.join(cacheDir, `${docId}.png`);
                
                if (fs.existsSync(cachePath)) {
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    fs.createReadStream(cachePath).pipe(res);
                    return;
                }

                // Generate thumbnail based on file type
                const fileType = doc.file_type?.toLowerCase() || path.extname(doc.filename || '').slice(1).toLowerCase();
                let thumbnailGenerated = false;

                // For images, use sharp if available
                if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType) && doc.filepath && fs.existsSync(doc.filepath)) {
                    try {
                        const sharp = require('sharp');
                        await sharp(doc.filepath)
                            .resize(200, 200, { fit: 'cover' })
                            .png()
                            .toFile(cachePath);
                        thumbnailGenerated = true;
                    } catch (sharpErr) {
                        console.warn('[Thumbnail] Sharp not available or failed:', sharpErr.message);
                    }
                }

                // For PDFs, try pdf2pic or return placeholder
                if (fileType === 'pdf' && doc.filepath && fs.existsSync(doc.filepath)) {
                    try {
                        const { fromPath } = require('pdf2pic');
                        const convert = fromPath(doc.filepath, {
                            density: 100,
                            saveFilename: docId,
                            savePath: cacheDir,
                            format: 'png',
                            width: 200,
                            height: 280
                        });
                        await convert(1); // First page
                        const generatedPath = path.join(cacheDir, `${docId}.1.png`);
                        if (fs.existsSync(generatedPath)) {
                            fs.renameSync(generatedPath, cachePath);
                            thumbnailGenerated = true;
                        }
                    } catch (pdfErr) {
                        console.warn('[Thumbnail] pdf2pic not available or failed:', pdfErr.message);
                    }
                }

                if (thumbnailGenerated && fs.existsSync(cachePath)) {
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Cache-Control', 'public, max-age=86400');
                    fs.createReadStream(cachePath).pipe(res);
                } else {
                    // Return a placeholder/icon based on file type
                    const iconSvg = generateFileIconSVG(fileType);
                    res.setHeader('Content-Type', 'image/svg+xml');
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    res.end(iconSvg);
                }
            } catch (err) {
                console.error('[Thumbnail] Error:', err);
                jsonResponse(res, { error: 'Failed to generate thumbnail' }, 500);
            }
            return;
        }

        // GET /api/folders - Get folder paths (project-specific)
        if (pathname === '/api/folders' && req.method === 'GET') {
            const projectDataDir = storage.getProjectDataDir();
            jsonResponse(res, {
                newinfo: path.join(projectDataDir, 'newinfo'),
                newtranscripts: path.join(projectDataDir, 'newtranscripts'),
                archived: path.join(projectDataDir, 'archived')
            });
            return;
        }

        // POST /api/folders/open - Open folder in file explorer (project-specific)
        if (pathname === '/api/folders/open' && req.method === 'POST') {
            const body = await parseBody(req);
            const folderType = body.folder || 'newinfo';
            const projectDataDir = storage.getProjectDataDir();
            let folderPath;

            switch(folderType) {
                case 'newinfo':
                    folderPath = path.join(projectDataDir, 'newinfo');
                    break;
                case 'newtranscripts':
                    folderPath = path.join(projectDataDir, 'newtranscripts');
                    break;
                case 'archived':
                    folderPath = path.join(projectDataDir, 'archived');
                    break;
                default:
                    folderPath = projectDataDir;
            }

            // Ensure folder exists
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            // Open folder in file explorer using execFile (no shell interpretation)
            const { execFile, exec } = require('child_process');

            if (process.platform === 'win32') {
                // Windows: use execFile with explorer.exe directly
                // This bypasses shell interpretation issues with special characters
                execFile('explorer.exe', [folderPath], (error) => {
                    if (error) {
                        console.error('Explorer execFile error:', error);
                    }
                });
            } else if (process.platform === 'darwin') {
                exec(`open "${folderPath}"`);
            } else {
                exec(`xdg-open "${folderPath}"`);
            }

            console.log('Opening folder:', folderPath);
            jsonResponse(res, { success: true, path: folderPath });
            return;
        }

        // GET /api/export/knowledge - Export knowledge base as markdown
        if (pathname === '/api/export/knowledge' && req.method === 'GET') {
            const md = processor.generateKnowledgeBase();
            res.writeHead(200, {
                'Content-Type': 'text/markdown',
                'Content-Disposition': 'attachment; filename="knowledge-base.md"'
            });
            res.end(md);
            return;
        }

        // GET /api/export/questions - Export questions as markdown
        if (pathname === '/api/export/questions' && req.method === 'GET') {
            const md = processor.generateQuestionsMarkdown();
            res.writeHead(200, {
                'Content-Type': 'text/markdown',
                'Content-Disposition': 'attachment; filename="pending-questions.md"'
            });
            res.end(md);
            return;
        }

        // ==================== RAG API Endpoints ====================

        // GET /api/knowledge/json - Get full structured knowledge base
        if (pathname === '/api/knowledge/json' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const refresh = parsedUrl.query.refresh === 'true';

            let knowledge;
            if (refresh) {
                knowledge = storage.saveKnowledgeJSON();
            } else {
                knowledge = storage.loadKnowledgeJSON() || storage.saveKnowledgeJSON();
            }

            jsonResponse(res, knowledge);
            return;
        }

        // GET /api/knowledge/questions - Get structured questions JSON
        if (pathname === '/api/knowledge/questions' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const refresh = parsedUrl.query.refresh === 'true';

            let questions;
            if (refresh) {
                questions = storage.saveQuestionsJSON();
            } else {
                questions = storage.loadQuestionsJSON() || storage.saveQuestionsJSON();
            }

            jsonResponse(res, questions);
            return;
        }

        // GET /api/knowledge/status - Get embedding index status
        if (pathname === '/api/knowledge/status' && req.method === 'GET') {
            const status = storage.getEmbeddingStatus();
            const embeddingModels = await ollama.getEmbeddingModels();
            jsonResponse(res, {
                ...status,
                available_embedding_models: embeddingModels.map(m => m.name)
            });
            return;
        }

        // POST /api/knowledge/regenerate - Regenerate markdown files from database
        if (pathname === '/api/knowledge/regenerate' && req.method === 'POST') {
            console.log('Manually regenerating SOURCE_OF_TRUTH.md and PENDING_QUESTIONS.md...');
            storage.regenerateMarkdown();
            storage.saveKnowledgeJSON();
            storage.saveQuestionsJSON();
            storage.invalidateRAGCache();
            jsonResponse(res, {
                success: true,
                message: 'Markdown files regenerated from database',
                files: ['SOURCE_OF_TRUTH.md', 'PENDING_QUESTIONS.md', 'knowledge.json', 'questions_rag.json']
            });
            return;
        }

        // POST /api/knowledge/synthesize - Consolidate and clean up facts using reasoning model
        if (pathname === '/api/knowledge/synthesize' && req.method === 'POST') {
            const body = await parseBody(req);
            const reasoningModel = body.model || config.ollama?.reasoningModel || config.ollama?.model || 'qwen3:30b';

            console.log(`Starting knowledge synthesis with model: ${reasoningModel}`);

            try {
                const result = await processor.synthesizeKnowledge(reasoningModel, (progress, message) => {
                    console.log(`Synthesis: ${progress}% - ${message}`);
                });

                jsonResponse(res, {
                    success: result.success,
                    message: result.message || 'Knowledge synthesis complete',
                    stats: result.stats
                });
            } catch (error) {
                console.error('Synthesis error:', error);
                jsonResponse(res, {
                    success: false,
                    error: error.message || 'Synthesis failed'
                });
            }
            return;
        }

        // GET /api/knowledge/synthesis-status - Check which content files have been synthesized
        if (pathname === '/api/knowledge/synthesis-status' && req.method === 'GET') {
            const tracking = processor.loadSynthesizedFiles();
            const allFiles = processor.getContentFiles();
            const newFiles = processor.getNewContentFiles();

            jsonResponse(res, {
                success: true,
                totalContentFiles: allFiles.length,
                synthesizedFiles: Object.keys(tracking.files).length,
                pendingFiles: newFiles.length,
                lastSynthesis: tracking.last_synthesis,
                files: {
                    synthesized: Object.entries(tracking.files).map(([name, data]) => ({
                        name,
                        synthesized_at: data.synthesized_at,
                        size: data.size
                    })),
                    pending: newFiles.map(f => f.name)
                }
            });
            return;
        }

        // GET /api/content - List all content sources
        if (pathname === '/api/content' && req.method === 'GET') {
            const contentFiles = processor.getContentFiles();
            jsonResponse(res, {
                success: true,
                sources: contentFiles.map(f => ({
                    name: f.name.replace(/\.md$/, ''),
                    file: f.name,
                    size: f.size,
                    modified: f.mtime
                }))
            });
            return;
        }

        // GET /api/content/:sourceName - Get content by source name
        if (pathname.startsWith('/api/content/') && req.method === 'GET') {
            const sourceName = decodeURIComponent(pathname.replace('/api/content/', ''));
            const contentDir = path.join(config.dataDir, 'content');
            const archivedDir = path.join(config.dataDir, 'archived', 'documents');

            // Try different file extensions for processed content
            const possibleFiles = [
                path.join(contentDir, `${sourceName}.md`),
                path.join(contentDir, `${sourceName}`),
                path.join(contentDir, sourceName.replace(/\.(jpg|png|pdf|pptx?)$/i, '.md'))
            ];

            let content = null;
            let foundFile = null;

            for (const filePath of possibleFiles) {
                if (fs.existsSync(filePath)) {
                    content = fs.readFileSync(filePath, 'utf-8');
                    foundFile = path.basename(filePath);
                    break;
                }
            }

            // Find original/raw file in archived folder
            let rawFile = null;
            let rawFileUrl = null;
            if (fs.existsSync(archivedDir)) {
                const archivedFiles = fs.readdirSync(archivedDir);
                const sourceBaseName = sourceName.replace(/\.(md|txt)$/i, '');
                const matchingFile = archivedFiles.find(f => {
                    // Match patterns like "2026-01-26_Slide29.jpg" for source "Slide29"
                    const withoutDate = f.replace(/^\d{4}-\d{2}-\d{2}_/, '');
                    const withoutExt = withoutDate.replace(/\.[^.]+$/, '');
                    return withoutExt.toLowerCase() === sourceBaseName.toLowerCase();
                });
                if (matchingFile) {
                    rawFile = matchingFile;
                    rawFileUrl = `/api/archived/${encodeURIComponent(matchingFile)}`;
                }
            }

            if (content || rawFile) {
                // Parse front matter if present
                let metadata = {};
                let body = content || '';

                if (content && content.startsWith('---')) {
                    const parts = content.split('---');
                    if (parts.length >= 3) {
                        const frontMatter = parts[1].trim();
                        body = parts.slice(2).join('---').trim();

                        // Parse YAML-like front matter
                        frontMatter.split('\n').forEach(line => {
                            const colonIdx = line.indexOf(':');
                            if (colonIdx > 0) {
                                const key = line.substring(0, colonIdx).trim();
                                const value = line.substring(colonIdx + 1).trim();
                                metadata[key] = value;
                            }
                        });
                    }
                }

                jsonResponse(res, {
                    success: true,
                    source: sourceName,
                    file: foundFile,
                    metadata: metadata,
                    content: body,
                    rawFile: rawFile,
                    rawFileUrl: rawFileUrl
                });
            } else {
                jsonResponse(res, {
                    success: false,
                    error: `Source "${sourceName}" not found`
                }, 404);
            }
            return;
        }

        // GET /api/archived/:filename - Serve archived raw files (images, PDFs)
        if (pathname.startsWith('/api/archived/') && req.method === 'GET') {
            const filename = decodeURIComponent(pathname.replace('/api/archived/', ''));
            const archivedDir = path.join(config.dataDir, 'archived', 'documents');
            const filePath = path.join(archivedDir, filename);

            // Security: ensure file is within archived directory
            const normalizedPath = path.normalize(filePath);
            if (!normalizedPath.startsWith(path.normalize(archivedDir))) {
                jsonResponse(res, { success: false, error: 'Invalid path' }, 403);
                return;
            }

            if (fs.existsSync(filePath)) {
                const ext = path.extname(filename).toLowerCase();
                const mimeTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.pdf': 'application/pdf',
                    '.webp': 'image/webp'
                };
                const contentType = mimeTypes[ext] || 'application/octet-stream';

                res.writeHead(200, { 'Content-Type': contentType });
                fs.createReadStream(filePath).pipe(res);
            } else {
                jsonResponse(res, { success: false, error: 'File not found' }, 404);
            }
            return;
        }

        // POST /api/knowledge/resynthesis - Force full resynthesis of all content files
        if (pathname === '/api/knowledge/resynthesis' && req.method === 'POST') {
            const body = await parseBody(req);
            const reasoningModel = body.model || config.ollama?.reasoningModel || config.ollama?.model || 'qwen3:30b';
            const force = body.force === true; // Force full resynthesis
            const requestProvider = body.provider;

            console.log(`Starting ${force ? 'FULL' : 'incremental'} resynthesis with model: ${reasoningModel}, provider: ${requestProvider || 'default'}`);

            // Override provider if specified
            if (requestProvider) {
                processor.config.llm = processor.config.llm || {};
                processor.config.llm.perTask = processor.config.llm.perTask || {};
                processor.config.llm.perTask.text = processor.config.llm.perTask.text || {};
                processor.config.llm.perTask.text.provider = requestProvider;
                processor.config.llm.provider = requestProvider;
            }

            try {
                const result = await processor.holisticSynthesis(reasoningModel, force);

                // Invalidate briefing cache
                invalidateBriefingCache();

                jsonResponse(res, {
                    success: result.success,
                    message: result.skipped
                        ? 'No new content to synthesize - all files already processed'
                        : `Resynthesis complete: ${result.stats?.factsAdded || 0} facts, ${result.stats?.peopleAdded || 0} people`,
                    skipped: result.skipped || false,
                    stats: result.stats
                });
            } catch (error) {
                console.error('Resynthesis error:', error);
                jsonResponse(res, {
                    success: false,
                    error: error.message || 'Resynthesis failed'
                });
            }
            return;
        }

        // DELETE /api/knowledge/synthesis-tracking - Clear synthesis tracking (force reprocessing next time)
        if (pathname === '/api/knowledge/synthesis-tracking' && req.method === 'DELETE') {
            processor.clearSynthesisTracking();
            jsonResponse(res, {
                success: true,
                message: 'Synthesis tracking cleared - next synthesis will process all content files'
            });
            return;
        }

        // POST /api/questions/enrich - Enrich questions with person assignments based on extracted people
        if (pathname === '/api/questions/enrich' && req.method === 'POST') {
            try {
                await processor.enrichQuestionsWithPeople();
                const questions = storage.getQuestions();
                const assigned = questions.filter(q => q.assigned_to && q.assigned_to.length > 2);
                jsonResponse(res, {
                    success: true,
                    message: `Enriched questions with person assignments`,
                    stats: {
                        totalQuestions: questions.length,
                        assignedQuestions: assigned.length,
                        unassignedQuestions: questions.length - assigned.length
                    }
                });
            } catch (error) {
                console.error('Enrichment error:', error);
                jsonResponse(res, {
                    success: false,
                    error: error.message || 'Enrichment failed'
                });
            }
            return;
        }

        // POST /api/models/unload - Unload models from GPU/RAM to free memory
        if (pathname === '/api/models/unload' && req.method === 'POST') {
            const body = await parseBody(req);
            let modelsToUnload = body.models || [];

            // If no specific models provided, unload all configured Ollama models
            // Only Ollama models can be unloaded (other providers don't keep models loaded)
            if (modelsToUnload.length === 0) {
                // Check LLM config for Ollama models
                if (config.llm?.perTask?.text?.provider === 'ollama' && config.llm?.perTask?.text?.model) {
                    modelsToUnload.push(config.llm.perTask.text.model);
                }
                if (config.llm?.perTask?.vision?.provider === 'ollama' && config.llm?.perTask?.vision?.model) {
                    modelsToUnload.push(config.llm.perTask.vision.model);
                }
                if (config.llm?.perTask?.embeddings?.provider === 'ollama' && config.llm?.perTask?.embeddings?.model) {
                    modelsToUnload.push(config.llm.perTask.embeddings.model);
                }
                // Fallback to legacy ollama config
                if (config.ollama?.model) modelsToUnload.push(config.ollama.model);
                if (config.ollama?.visionModel) modelsToUnload.push(config.ollama.visionModel);
                if (config.ollama?.reasoningModel && config.ollama.reasoningModel !== config.ollama.model) {
                    modelsToUnload.push(config.ollama.reasoningModel);
                }
            }

            if (modelsToUnload.length === 0) {
                jsonResponse(res, {
                    success: false,
                    error: 'No models specified or configured to unload'
                });
                return;
            }

            // Remove duplicates
            modelsToUnload = [...new Set(modelsToUnload)];

            console.log(`Unloading models: ${modelsToUnload.join(', ')}`);

            try {
                const result = await ollama.unloadModels(modelsToUnload);
                jsonResponse(res, {
                    success: result.success,
                    unloaded: result.unloaded,
                    errors: result.errors,
                    message: result.unloaded.length > 0
                        ? `Unloaded: ${result.unloaded.join(', ')}`
                        : 'No models were unloaded'
                });
            } catch (error) {
                console.error('Model unload error:', error);
                jsonResponse(res, {
                    success: false,
                    error: error.message || 'Failed to unload models'
                });
            }
            return;
        }

        // POST /api/knowledge/embed - Generate embeddings for all knowledge items
        if (pathname === '/api/knowledge/embed' && req.method === 'POST') {
            const body = await parseBody(req);
            const model = body.model || config.llm?.models?.embeddings || 'mxbai-embed-large';
            
            // Use embeddings provider (defaults to ollama)
            const embedProvider = config.llm?.embeddingsProvider || 'ollama';
            const embedProviderConfig = config.llm?.providers?.[embedProvider] || {};

            console.log(`Starting embedding generation with provider: ${embedProvider}, model: ${model}`);

            // For Ollama provider, check if model is available and auto-pull if not
            if (embedProvider === 'ollama') {
                const availableModels = await ollama.getModels();
                const modelExists = availableModels.all?.some(m => m.name === model || m.name.startsWith(model + ':'));

                if (!modelExists) {
                    console.log(`Embedding model ${model} not found. Auto-pulling...`);
                    const pullResult = await ollama.pullModel(model, (progress) => {
                        if (progress.percent) {
                            console.log(`Pulling ${model}: ${progress.percent}%`);
                        }
                    });

                    if (!pullResult.success) {
                        jsonResponse(res, {
                            success: false,
                            error: `Failed to download embedding model ${model}: ${pullResult.error}`
                        });
                        return;
                    }
                    console.log(`Embedding model ${model} pulled successfully`);
                }
            }

            // First, refresh the JSON files
            storage.saveKnowledgeJSON();
            storage.saveQuestionsJSON();

            // Get all items to embed
            const items = storage.getAllItemsForEmbedding();

            if (items.length === 0) {
                jsonResponse(res, {
                    success: false,
                    error: 'No items to embed. Process some documents first.'
                });
                return;
            }

            console.log(`Generating embeddings for ${items.length} items using ${embedProvider}...`);

            // Generate embeddings in batches for better progress tracking
            const texts = items.map(item => item.text);
            const batchSize = 10;
            const allEmbeddings = [];
            const errors = [];
            
            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                const progress = Math.round(((i + batch.length) / texts.length) * 100);
                console.log(`Embedding progress: ${progress}% (${i + batch.length}/${texts.length})`);
                
                const result = await llm.embed({
                    provider: embedProvider,
                    providerConfig: embedProviderConfig,
                    model,
                    texts: batch
                });
                
                if (result.success && result.embeddings) {
                    allEmbeddings.push(...result.embeddings);
                } else {
                    // Fill with nulls for failed items
                    for (let j = 0; j < batch.length; j++) {
                        allEmbeddings.push(null);
                        errors.push({ index: i + j, error: result.error });
                    }
                }
            }

            if (allEmbeddings.every(e => e === null)) {
                jsonResponse(res, {
                    success: false,
                    error: 'Failed to generate embeddings. Check if embedding model is available.',
                    details: errors[0]?.error
                });
                return;
            }

            // Combine items with embeddings
            const embeddings = items.map((item, idx) => ({
                id: item.id,
                type: item.type,
                text: item.text,
                embedding: allEmbeddings[idx]
            }));

            // Save embeddings with model info
            embeddings.model = model;
            embeddings.provider = embedProvider;
            storage.saveEmbeddings(embeddings);

            console.log(`Embeddings generated and saved: ${embeddings.filter(e => e.embedding).length} items`);

            jsonResponse(res, {
                success: true,
                count: embeddings.filter(e => e.embedding).length,
                model: model,
                provider: embedProvider,
                errors: errors.length > 0 ? errors : undefined
            });
            return;
        }

        // GET /api/knowledge/search - Semantic search across knowledge base
        if (pathname === '/api/knowledge/search' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const query = parsedUrl.query.q || '';
            const semantic = parsedUrl.query.semantic === 'true';
            const topK = parseInt(parsedUrl.query.limit) || 10;
            const types = parsedUrl.query.types ? parsedUrl.query.types.split(',') : null;

            if (!query || query.length < 2) {
                jsonResponse(res, {
                    error: 'Query must be at least 2 characters',
                    results: []
                });
                return;
            }

            if (semantic) {
                // Semantic search using embeddings
                const embeddingsData = storage.loadEmbeddings();

                if (!embeddingsData || !embeddingsData.embeddings?.length) {
                    jsonResponse(res, {
                        error: 'No embeddings found. Run /api/knowledge/embed first.',
                        results: [],
                        fallback_text: true
                    });
                    return;
                }

                // Get query embedding using LLM module (provider-agnostic)
                const embedModel = embeddingsData.model || 'mxbai-embed-large';
                const embedProvider = config.llm?.perTask?.embeddings?.provider || config.llm?.embeddingsProvider || 'ollama';
                const embedProviderConfig = config.llm?.providers?.[embedProvider] || {};
                
                const queryResult = await llm.embed({
                    provider: embedProvider,
                    providerConfig: embedProviderConfig,
                    model: embedModel,
                    texts: [query]
                });

                if (!queryResult.success || !queryResult.embeddings?.[0]) {
                    jsonResponse(res, {
                        error: 'Failed to generate query embedding: ' + (queryResult.error || 'No embedding returned'),
                        results: []
                    });
                    return;
                }
                
                // Use first embedding from the result
                queryResult.embedding = queryResult.embeddings[0];

                // Find similar items
                const itemsWithEmbeddings = embeddingsData.embeddings
                    .filter(e => e.embedding && (!types || types.includes(e.type)));

                const similar = ollama.findSimilar(queryResult.embedding, itemsWithEmbeddings, topK);

                // Get full item data
                const resultIds = similar.map(s => s.id);
                const items = storage.getItemsByIds(resultIds);

                // Combine with similarity scores
                const results = similar.map(s => {
                    const item = items.find(i => i.id === s.id);
                    return {
                        ...item,
                        similarity: s.similarity
                    };
                });

                jsonResponse(res, {
                    query,
                    semantic: true,
                    model,
                    total: results.length,
                    results
                });
            } else {
                // Text-based search (existing functionality)
                const textResults = storage.search(query, { types, limit: topK });
                jsonResponse(res, {
                    query,
                    semantic: false,
                    ...textResults
                });
            }
            return;
        }

        // POST /api/data/recover - Recover data from change_log
        if (pathname === '/api/data/recover' && req.method === 'POST') {
            try {
                const result = storage.recoverFromChangeLog();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/reset - Reset project knowledge data (keeps team, contacts, cost)
        if (pathname === '/api/reset' && req.method === 'POST') {
            const body = await parseBody(req).catch(() => ({}));
            const projectId = body?.project_id || body?.projectId || req.headers['x-project-id'];
            if (!projectId) {
                jsonResponse(res, { success: false, error: 'Project ID required. Send X-Project-Id header or project_id in body.' }, 400);
                return;
            }
            try {
                if (typeof storage.switchProject === 'function') {
                    await Promise.resolve(storage.switchProject(projectId));
                } else {
                    storage.currentProjectId = projectId;
                    if (storage._supabase) storage._supabase.setProject(projectId);
                }
            } catch (e) {
                console.warn('[Reset] Could not set project:', e.message);
            }
            try {
                await storage.reset();
            } catch (err) {
                console.error('[Reset]', err);
                jsonResponse(res, { success: false, error: err.message }, 500);
                return;
            }

            const newinfoDir = path.join(DATA_DIR, 'newinfo');
            const transcriptsDir = path.join(DATA_DIR, 'newtranscripts');

            const clearDir = (dir) => {
                if (fs.existsSync(dir)) {
                    fs.readdirSync(dir).forEach(f => {
                        const filePath = path.join(dir, f);
                        if (fs.statSync(filePath).isFile()) {
                            fs.unlinkSync(filePath);
                        }
                    });
                }
            };

            clearDir(newinfoDir);
            clearDir(transcriptsDir);

            if (body && body.clearArchived) {
                clearDir(path.join(DATA_DIR, 'archived', 'documents'));
                clearDir(path.join(DATA_DIR, 'archived', 'meetings'));
            }

            let graphCleared = false;
            try {
                const graphProvider = storage.getGraphProvider?.();
                if (graphProvider && graphProvider.connected) {
                    await graphProvider.query('MATCH (n) DETACH DELETE n');
                    graphCleared = true;
                    console.log('[Reset] Graph database cleared');
                }
            } catch (graphErr) {
                console.log(`[Reset] Graph clear warning: ${graphErr.message}`);
            }

            jsonResponse(res, { success: true, message: 'Project data reset; team, contacts and cost preserved.', graphCleared });
            return;
        }

        // POST /api/cleanup-orphans - Clean orphan data (data without valid sources)
        if (pathname === '/api/cleanup-orphans' && req.method === 'POST') {
            try {
                const stats = storage.cleanOrphanData();
                
                // Also clean from graph if connected
                let graphCleaned = false;
                try {
                    const graphProvider = storage.getGraphProvider();
                    if (graphProvider && graphProvider.connected) {
                        // Remove orphan nodes (nodes not connected to any Document or Conversation)
                        await graphProvider.query(`
                            MATCH (n)
                            WHERE NOT (n)-[:EXTRACTED_FROM]->(:Document) 
                            AND NOT (n)-[:EXTRACTED_FROM]->(:Conversation)
                            AND NOT (n)-[:MENTIONED_IN]->()
                            AND NOT n:Document AND NOT n:Conversation AND NOT n:Contact
                            DETACH DELETE n
                        `);
                        graphCleaned = true;
                    }
                } catch (graphErr) {
                    console.log(`[Cleanup] Graph cleanup warning: ${graphErr.message}`);
                }
                
                const total = Object.values(stats).reduce((a, b) => a + b, 0);
                jsonResponse(res, { 
                    ok: true, 
                    message: `Cleaned ${total} orphan items`,
                    stats,
                    graphCleaned
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== Graph Database API Endpoints ====================

        // GET /api/graph/providers - List available graph providers
        if (pathname === '/api/graph/providers' && req.method === 'GET') {
            const GraphFactory = require('./graph/GraphFactory');
            const providers = GraphFactory.getProviders();
            jsonResponse(res, { providers });
            return;
        }

        // ==================== Ontology API Endpoints ====================
        
        // GET /api/ontology - Get ontology summary
        if (pathname === '/api/ontology' && req.method === 'GET') {
            const { getOntologyManager } = require('./ontology');
            const ontology = getOntologyManager();
            jsonResponse(res, {
                ok: true,
                ...ontology.export()
            });
            return;
        }
        
        // GET /api/ontology/entities - Get all entity types
        if (pathname === '/api/ontology/entities' && req.method === 'GET') {
            const { getOntologyManager } = require('./ontology');
            const ontology = getOntologyManager();
            const entityTypes = ontology.getEntityTypes().map(name => ({
                name,
                ...ontology.getEntityVisualInfo(name),
                properties: Object.keys(ontology.getEntityProperties(name)),
                searchable: ontology.getSearchableProperties(name),
                required: ontology.getRequiredProperties(name),
                sharedEntity: ontology.isSharedEntity(name)
            }));
            
            // Also return summary of shared vs project entities
            const sharedTypes = ontology.getSharedEntityTypes();
            const projectTypes = ontology.getProjectEntityTypes();
            
            jsonResponse(res, { 
                ok: true, 
                entityTypes,
                summary: {
                    total: entityTypes.length,
                    sharedCount: sharedTypes.length,
                    projectCount: projectTypes.length,
                    sharedTypes,
                    projectTypes
                }
            });
            return;
        }
        
        // GET /api/ontology/relations - Get all relation types
        if (pathname === '/api/ontology/relations' && req.method === 'GET') {
            const { getOntologyManager } = require('./ontology');
            const ontology = getOntologyManager();
            const relationTypes = ontology.getRelationTypes().map(name => ({
                name,
                ...ontology.getRelationType(name)
            }));
            jsonResponse(res, { ok: true, relationTypes });
            return;
        }
        
        // POST /api/ontology/validate - Validate an entity against schema
        if (pathname === '/api/ontology/validate' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getOntologyManager } = require('./ontology');
            const ontology = getOntologyManager();
            
            if (!body.type || !body.entity) {
                jsonResponse(res, { ok: false, error: 'type and entity are required' }, 400);
                return;
            }
            
            const validation = ontology.validateEntity(body.type, body.entity);
            jsonResponse(res, { ok: validation.valid, ...validation });
            return;
        }
        
        // POST /api/ontology/extract - Extract entities from text
        if (pathname === '/api/ontology/extract' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getRelationInference } = require('./ontology');
            const inference = getRelationInference();
            
            if (!body.text) {
                jsonResponse(res, { ok: false, error: 'text is required' }, 400);
                return;
            }
            
            const results = await inference.extractFromText(body.text, {
                existingEntities: body.existingEntities || []
            });
            jsonResponse(res, { ok: true, ...results });
            return;
        }
        
        // POST /api/ontology/enrich - Generate enriched text for embedding
        if (pathname === '/api/ontology/enrich' && req.method === 'POST') {
            const body = await parseBody(req);
            const { getEmbeddingEnricher } = require('./ontology');
            const enricher = getEmbeddingEnricher();
            
            if (!body.type || !body.entity) {
                jsonResponse(res, { ok: false, error: 'type and entity are required' }, 400);
                return;
            }
            
            const enrichedText = enricher.enrichEntity(body.type, body.entity, body.context || {});
            jsonResponse(res, { ok: true, enrichedText });
            return;
        }

        // ==================== Graph Database API Endpoints ====================
        
        // GET /api/graph/config - Get current graph configuration (for UI)
        if (pathname === '/api/graph/config' && req.method === 'GET') {
            const currentProject = storage.getCurrentProject();
            const projectId = currentProject?.id;
            
            // Try to load from Supabase first
            let graphConfig = null;
            if (supabase && projectId) {
                try {
                    const { data: projectConfig } = await supabase
                        .from('project_config')
                        .select('graph_config')
                        .eq('project_id', projectId)
                        .single();
                    
                    if (projectConfig?.graph_config) {
                        graphConfig = projectConfig.graph_config;
                    }
                } catch (e) {
                    // Fall back to local config
                }
            }
            
            // Fall back to local config
            if (!graphConfig) {
                graphConfig = config.graph || { enabled: false };
            }
            
            // Never expose password
            const safeConfig = { ...graphConfig };
            if (safeConfig.falkordb) {
                safeConfig.falkordb = { ...safeConfig.falkordb };
                delete safeConfig.falkordb.password;
                // Indicate if password is set via env var
                safeConfig.falkordb.passwordSet = !!(process.env.FALKORDB_PASSWORD || process.env.FAKORDB_PASSWORD);
            }
            
            jsonResponse(res, {
                ok: true,
                config: safeConfig,
                source: graphConfig === config.graph ? 'local' : 'supabase'
            });
            return;
        }
        
        // GET /api/graph/status - Get graph database status
        if (pathname === '/api/graph/status' && req.method === 'GET') {
            try {
                const graphStats = await storage.getGraphStats();
                jsonResponse(res, graphStats);
            } catch (error) {
                // Return a safe default response when graph is not connected
                jsonResponse(res, {
                    ok: true,
                    enabled: false,
                    connected: false,
                    nodes: 0,
                    relationships: 0,
                    nodeCount: 0,
                    edgeCount: 0,
                    stats: {
                        nodeCount: 0,
                        edgeCount: 0,
                        communities: 0
                    },
                    message: 'Graph database not connected'
                });
            }
            return;
        }
        
        // GET /api/graph/bookmarks - Get user's graph bookmarks
        if (pathname === '/api/graph/bookmarks' && req.method === 'GET') {
            // For now, return empty bookmarks (can be stored in Supabase later)
            jsonResponse(res, {
                ok: true,
                bookmarks: []
            });
            return;
        }
        
        // POST /api/graph/bookmarks - Save a graph bookmark
        if (pathname === '/api/graph/bookmarks' && req.method === 'POST') {
            const body = await parseBody(req);
            // For now, just acknowledge - can be persisted to Supabase later
            jsonResponse(res, {
                ok: true,
                bookmark: {
                    id: `bookmark_${Date.now()}`,
                    ...body,
                    created_at: new Date().toISOString()
                }
            });
            return;
        }

        // GET /api/graph/queries - Get saved/recent queries
        if (pathname === '/api/graph/queries' && req.method === 'GET') {
            const parsedUrl = parseUrl(req.url);
            const limit = parseInt(parsedUrl.query.limit) || 20;
            // Return empty array for now - queries are stored client-side
            // In the future, this could fetch from Supabase graph_queries table
            jsonResponse(res, {
                ok: true,
                queries: [],
                total: 0
            });
            return;
        }

        // POST /api/graph/queries - Save a query
        if (pathname === '/api/graph/queries' && req.method === 'POST') {
            const body = await parseBody(req);
            // For now, just acknowledge - queries stored client-side
            jsonResponse(res, {
                ok: true,
                query: {
                    id: `query_${Date.now()}`,
                    ...body,
                    created_at: new Date().toISOString()
                }
            });
            return;
        }

        // GET /api/graph/insights - Get graph analytics insights
        if (pathname === '/api/graph/insights' && req.method === 'GET') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                jsonResponse(res, { 
                    ok: true, 
                    insights: [{
                        type: 'status',
                        title: 'Graph Not Connected',
                        description: 'Connect to graph database to see insights.',
                        importance: 'medium'
                    }]
                });
                return;
            }
            
            try {
                // Get basic graph stats
                const nodesResult = await graphProvider.findNodes(null, {}, { limit: 1000 });
                const relsResult = await graphProvider.findRelationships({ limit: 1000 });
                
                const nodes = nodesResult?.nodes || nodesResult || [];
                const relationships = relsResult?.relationships || relsResult || [];
                
                // Count by type
                const nodesByType = {};
                const relationshipsByType = {};
                
                for (const node of nodes) {
                    const type = node.type || node.labels?.[0] || 'Unknown';
                    nodesByType[type] = (nodesByType[type] || 0) + 1;
                }
                
                for (const rel of relationships) {
                    const type = rel.type || 'Unknown';
                    relationshipsByType[type] = (relationshipsByType[type] || 0) + 1;
                }
                
                // Calculate metrics
                const nodeCount = nodes.length;
                const edgeCount = relationships.length;
                const maxEdges = nodeCount * (nodeCount - 1);
                const density = maxEdges > 0 ? (edgeCount / maxEdges) : 0;
                const avgDegree = nodeCount > 0 ? (edgeCount * 2 / nodeCount) : 0;
                
                // Generate insights array (format expected by frontend)
                const insights = [];
                
                // Summary insight
                insights.push({
                    type: 'summary',
                    title: 'Graph Overview',
                    description: `Your knowledge graph contains ${nodeCount} nodes and ${edgeCount} relationships across ${Object.keys(nodesByType).length} entity types.`,
                    importance: 'high'
                });
                
                // Top entity types
                const topTypes = Object.entries(nodesByType)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                if (topTypes.length > 0) {
                    insights.push({
                        type: 'entities',
                        title: 'Most Common Entities',
                        description: topTypes.map(([t, c]) => `${t}: ${c}`).join(', '),
                        importance: 'medium'
                    });
                }
                
                // Relationship distribution
                const topRels = Object.entries(relationshipsByType)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                if (topRels.length > 0) {
                    insights.push({
                        type: 'relationships',
                        title: 'Top Relationship Types',
                        description: topRels.map(([t, c]) => `${t}: ${c}`).join(', '),
                        importance: 'medium'
                    });
                }
                
                // Connectivity analysis
                if (density < 0.01) {
                    insights.push({
                        type: 'recommendation',
                        title: 'Low Connectivity',
                        description: `Graph density is ${(density * 100).toFixed(2)}%. Consider adding more relationships between entities to improve knowledge discovery.`,
                        importance: 'medium'
                    });
                } else if (density > 0.1) {
                    insights.push({
                        type: 'metric',
                        title: 'Well Connected',
                        description: `Graph density is ${(density * 100).toFixed(2)}%. Your knowledge graph has good connectivity for discovery.`,
                        importance: 'low'
                    });
                }
                
                // Average degree insight
                insights.push({
                    type: 'metric',
                    title: 'Average Connections',
                    description: `Each node has an average of ${avgDegree.toFixed(1)} connections. ${avgDegree < 2 ? 'Consider linking more entities.' : 'Good connectivity!'}`,
                    importance: avgDegree < 2 ? 'medium' : 'low'
                });
                
                // Person-specific insights
                if (nodesByType['Person'] > 0) {
                    const personCount = nodesByType['Person'];
                    const worksWithCount = relationshipsByType['WORKS_WITH'] || 0;
                    if (personCount > 5 && worksWithCount < personCount / 2) {
                        insights.push({
                            type: 'recommendation',
                            title: 'Team Relationships',
                            description: `Found ${personCount} people but only ${worksWithCount} WORKS_WITH relationships. Run sync to auto-detect team connections.`,
                            importance: 'low'
                        });
                    }
                }
                
                jsonResponse(res, { ok: true, insights });
            } catch (error) {
                console.error('[Graph] Error getting insights:', error);
                jsonResponse(res, { 
                    ok: true, 
                    insights: [{
                        type: 'error',
                        title: 'Analysis Error',
                        description: error.message || 'Failed to analyze graph',
                        importance: 'high'
                    }]
                });
            }
            return;
        }

        // GET /api/graph/list - List all graphs in FalkorDB
        if (pathname === '/api/graph/list' && req.method === 'GET') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                jsonResponse(res, { ok: false, error: 'Not connected to graph database', graphs: [] });
                return;
            }
            
            try {
                // Get all graphs from FalkorDB
                const result = await graphProvider.listGraphs();
                
                // Get all projects to match graphs
                const projects = storage.getProjects();
                const baseGraphName = config.graph?.baseGraphName || config.graph?.graphName?.split('_')[0] || 'godmode';
                
                // Map graphs to projects
                const graphsWithProjects = (result.graphs || []).map(graphName => {
                    // Check if it's a project graph (format: baseName_projectId)
                    const parts = graphName.split('_');
                    const projectId = parts.length > 1 ? parts[parts.length - 1] : null;
                    const project = projectId ? projects.find(p => p.id === projectId) : null;
                    
                    return {
                        graphName,
                        projectId,
                        projectName: project?.name || null,
                        isOrphan: graphName.startsWith(baseGraphName) && projectId && !project,
                        isCurrentProject: projectId === storage.getCurrentProject()?.id
                    };
                });
                
                jsonResponse(res, { 
                    ok: true, 
                    graphs: graphsWithProjects,
                    totalGraphs: graphsWithProjects.length,
                    orphanGraphs: graphsWithProjects.filter(g => g.isOrphan).length,
                    baseGraphName
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message, graphs: [] });
            }
            return;
        }

        // DELETE /api/graph/:graphName - Delete a specific graph from FalkorDB
        if (pathname.match(/^\/api\/graph\/([^/]+)$/) && req.method === 'DELETE') {
            const graphName = decodeURIComponent(pathname.match(/^\/api\/graph\/([^/]+)$/)[1]);
            const graphProvider = storage.getGraphProvider();
            
            if (!graphProvider || !graphProvider.connected) {
                jsonResponse(res, { ok: false, error: 'Not connected to graph database' });
                return;
            }
            
            // Safety check: don't delete current project's graph
            const currentProject = storage.getCurrentProject();
            const currentGraphName = `${config.graph?.baseGraphName || 'godmode'}_${currentProject?.id}`;
            if (graphName === currentGraphName || graphName === config.graph?.graphName) {
                jsonResponse(res, { ok: false, error: 'Cannot delete the current project\'s graph' }, 400);
                return;
            }
            
            try {
                const result = await graphProvider.deleteGraph(graphName);
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message });
            }
            return;
        }

        // POST /api/graph/cleanup-orphans - Delete all orphan graphs (graphs without matching projects)
        if (pathname === '/api/graph/cleanup-orphans' && req.method === 'POST') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                jsonResponse(res, { ok: false, error: 'Not connected to graph database' });
                return;
            }
            
            try {
                const result = await graphProvider.listGraphs();
                const projects = storage.getProjects();
                const baseGraphName = config.graph?.baseGraphName || config.graph?.graphName?.split('_')[0] || 'godmode';
                const currentGraphName = config.graph?.graphName;
                
                const deletedGraphs = [];
                const errors = [];
                
                for (const graphName of (result.graphs || [])) {
                    // Skip non-project graphs
                    if (!graphName.startsWith(baseGraphName + '_')) continue;
                    
                    // Extract project ID
                    const projectId = graphName.replace(baseGraphName + '_', '');
                    const project = projects.find(p => p.id === projectId);
                    
                    // If no matching project and not current graph, delete it
                    if (!project && graphName !== currentGraphName) {
                        try {
                            await graphProvider.deleteGraph(graphName);
                            deletedGraphs.push(graphName);
                            console.log(`[Graph] Deleted orphan graph: ${graphName}`);
                        } catch (e) {
                            errors.push({ graphName, error: e.message });
                        }
                    }
                }
                
                jsonResponse(res, { 
                    ok: true, 
                    deletedGraphs, 
                    deletedCount: deletedGraphs.length,
                    errors: errors.length > 0 ? errors : undefined
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message });
            }
            return;
        }

        // POST /api/graph/connect - Connect to graph database
        if (pathname === '/api/graph/connect' && req.method === 'POST') {
            const body = await parseBody(req);
            
            // Generate project-specific graph name if not provided
            const currentProject = storage.getCurrentProject();
            const projectId = currentProject?.id || 'default';
            const baseGraphName = body.graphName || 'godmode';
            // Use project-specific graph name: "graphName_projectId"
            const projectGraphName = body.graphName || `${baseGraphName}_${projectId}`;
            
            const graphConfig = {
                enabled: true,
                provider: 'supabase', // Always use Supabase graph
                graphName: projectGraphName,
                baseGraphName: baseGraphName, // Store base name for switching projects
                autoConnect: true // Enable auto-connect on startup
            };

            const result = await storage.initGraph(graphConfig);
            
            if (result.ok) {
                // Save to local config for backward compatibility
                config.graph = graphConfig;
                saveConfig(config);
                
                // Also save to Supabase project_config for project-specific persistence
                if (supabase && projectId !== 'default') {
                    try {
                        // Don't store password in Supabase - use secrets table or env vars
                        const graphConfigForSupabase = {
                            enabled: true,
                            provider: 'supabase',
                            graphName: graphConfig.graphName,
                            baseGraphName: graphConfig.baseGraphName,
                            autoConnect: true
                        };
                        
                        await supabase.from('project_config')
                            .update({ graph_config: graphConfigForSupabase })
                            .eq('project_id', projectId);
                        console.log(`[Graph] Config saved to Supabase for project: ${projectId}`);
                    } catch (supaErr) {
                        console.log(`[Graph] Warning: Could not save to Supabase: ${supaErr.message}`);
                    }
                }
                
                console.log(`[Graph] Connected to graph: ${projectGraphName} for project: ${currentProject?.name || 'default'}`);
            }
            
            jsonResponse(res, result);
            return;
        }

        // POST /api/graph/test - Test graph connection without saving
        if (pathname === '/api/graph/test' && req.method === 'POST') {
            const body = await parseBody(req);
            const GraphFactory = require('./graph/GraphFactory');
            
            // Get password and username: from request body, or from Supabase config, or from env var
            let password = body.password;
            let username = body.username;
            
            if (supabase && supabase.isConfigured()) {
                const client = supabase.getAdminClient();
                
                // Try to get username from Supabase graph config if not provided
                if (!username) {
                    try {
                        const { data: graphConfigRow } = await client
                            .from('system_config')
                            .select('value')
                            .eq('key', 'graph')
                            .single();
                        
                        if (graphConfigRow?.value?.falkordb?.username) {
                            username = graphConfigRow.value.falkordb.username;
                            console.log('[Graph Test] Using username from Supabase config:', username);
                        }
                    } catch (e) {
                        console.log('[Graph Test] Could not load username from config:', e.message);
                    }
                }
                
                // Try to get password from secrets table if not provided
                if (!password) {
                    try {
                        const { data: secretRow, error } = await client
                            .from('secrets')
                            .select('encrypted_value, masked_value')
                            .eq('scope', 'system')
                            .eq('name', 'GRAPH_PASSWORD')
                            .single();
                        
                        if (!error && secretRow) {
                            password = secretRow.masked_value || secretRow.encrypted_value;
                            if (password) console.log('[Graph Test] Using password from Supabase secrets');
                        }
                    } catch (e) {
                        console.log('[Graph Test] Could not load password from secrets:', e.message);
                    }
                }
            }
            
            if (!password) {
                password = process.env.FALKORDB_PASSWORD || process.env.FAKORDB_PASSWORD;
                if (password) console.log('[Graph Test] Using password from environment variable');
            }
            
            const providerConfig = {
                host: body.host,
                port: body.port,
                username: username,
                password: password,
                tls: body.tls !== false,
                graphName: body.graphName || 'godmode'
            };
            
            console.log('[Graph Test] Testing Supabase graph connection');
            
            const result = await GraphFactory.testConnection('supabase', providerConfig);
            jsonResponse(res, result);
            return;
        }

        // POST /api/graph/sync - Sync storage data to graph database
        if (pathname === '/api/graph/sync' && req.method === 'POST') {
            if (!storage.getGraphProvider()) {
                jsonResponse(res, { 
                    ok: false, 
                    error: 'Graph database not connected. Connect first via /api/graph/connect' 
                });
                return;
            }

            const result = await storage.syncToGraph();
            jsonResponse(res, result);
            return;
        }
        
        // POST /api/graph/indexes - Create ontology indexes for better performance
        if (pathname === '/api/graph/indexes' && req.method === 'POST') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider) {
                jsonResponse(res, { 
                    ok: false, 
                    error: 'Graph database not connected' 
                });
                return;
            }

            if (typeof graphProvider.createOntologyIndexes === 'function') {
                const result = await graphProvider.createOntologyIndexes();
                jsonResponse(res, result);
            } else {
                jsonResponse(res, { ok: false, error: 'Index creation not supported by this provider' });
            }
            return;
        }
        
        // POST /api/graph/embeddings - Generate enriched embeddings with ontology
        if (pathname === '/api/graph/embeddings' && req.method === 'POST') {
            try {
                const result = await storage.generateEnrichedEmbeddings();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message });
            }
            return;
        }
        
        // GET /api/cache/stats - Get cache statistics
        if (pathname === '/api/cache/stats' && req.method === 'GET') {
            const { getQueryCache } = require('./utils/Cache');
            const cache = getQueryCache();
            jsonResponse(res, { ok: true, stats: cache.getStats() });
            return;
        }
        
        // POST /api/cache/clear - Clear query cache
        if (pathname === '/api/cache/clear' && req.method === 'POST') {
            const { getQueryCache } = require('./utils/Cache');
            const cache = getQueryCache();
            cache.clear();
            jsonResponse(res, { ok: true, message: 'Cache cleared' });
            return;
        }
        
        // GET /api/data/stats - Get data statistics
        if (pathname === '/api/data/stats' && req.method === 'GET') {
            const stats = storage.getDataStats();
            jsonResponse(res, { ok: true, ...stats });
            return;
        }
        
        // POST /api/data/cleanup - Clean up old data
        if (pathname === '/api/data/cleanup' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = storage.cleanupOldData({
                factsMaxAgeDays: body.factsMaxAgeDays || 365,
                questionsMaxAgeDays: body.questionsMaxAgeDays || 180,
                archiveInsteadOfDelete: body.archive !== false
            });
            jsonResponse(res, { ok: true, ...result });
            return;
        }
        
        // POST /api/data/deduplicate - Remove duplicate entries
        if (pathname === '/api/data/deduplicate' && req.method === 'POST') {
            const result = storage.removeDuplicates();
            jsonResponse(res, { ok: true, ...result });
            return;
        }
        
        // GET /api/dedup/stats - Get request deduplication stats
        if (pathname === '/api/dedup/stats' && req.method === 'GET') {
            const { getRequestDedup } = require('./utils');
            const dedup = getRequestDedup();
            jsonResponse(res, { ok: true, stats: dedup.getStats() });
            return;
        }
        
        // ==================== Cross-Project APIs ====================
        
        // GET /api/graph/projects - List all project graphs
        if (pathname === '/api/graph/projects' && req.method === 'GET') {
            try {
                const multiGraphManager = storage.getMultiGraphManager();
                if (!multiGraphManager) {
                    jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                    return;
                }
                const projects = await multiGraphManager.listProjectGraphs();
                jsonResponse(res, { ok: true, projects, count: projects.length });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/cross-project/people - Get people who work across multiple projects
        if (pathname === '/api/cross-project/people' && req.method === 'GET') {
            try {
                const multiGraphManager = storage.getMultiGraphManager();
                if (!multiGraphManager) {
                    jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                    return;
                }
                const result = await multiGraphManager.findCrossProjectPeople();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/cross-project/connections - Get connections between projects
        if (pathname === '/api/cross-project/connections' && req.method === 'GET') {
            try {
                const multiGraphManager = storage.getMultiGraphManager();
                if (!multiGraphManager) {
                    jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                    return;
                }
                const result = await multiGraphManager.findProjectConnections();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/person/:name/projects - Get projects for a specific person
        if (pathname.startsWith('/api/person/') && pathname.endsWith('/projects') && req.method === 'GET') {
            try {
                const personName = decodeURIComponent(pathname.split('/')[3]);
                const multiGraphManager = storage.getMultiGraphManager();
                if (!multiGraphManager) {
                    jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                    return;
                }
                const result = await multiGraphManager.findPersonProjects(personName);
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/graph/switch - Switch to a different graph
        if (pathname === '/api/graph/switch' && req.method === 'POST') {
            const body = await parseBody(req);
            const graphName = body.graphName;
            
            if (!graphName) {
                jsonResponse(res, { ok: false, error: 'graphName is required' }, 400);
                return;
            }
            
            try {
                if (!storage.graphProvider || !storage.graphProvider.switchGraph) {
                    jsonResponse(res, { ok: false, error: 'Graph provider does not support switching' });
                    return;
                }
                const result = await storage.graphProvider.switchGraph(graphName);
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/graph/sync-multi - Sync data to multi-graph architecture
        if (pathname === '/api/graph/sync-multi' && req.method === 'POST') {
            const body = await parseBody(req);
            const projectId = body.projectId || storage.projectId;
            
            try {
                const result = await storage.syncToGraph({
                    multiGraph: true,
                    projectId: projectId,
                    useOntology: body.useOntology !== false
                });
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/graph/multi-stats - Get stats from all graphs
        if (pathname === '/api/graph/multi-stats' && req.method === 'GET') {
            try {
                const multiGraphManager = storage.getMultiGraphManager();
                if (!multiGraphManager) {
                    jsonResponse(res, { ok: false, error: 'Multi-graph not enabled' });
                    return;
                }
                const stats = await multiGraphManager.getStats();
                jsonResponse(res, { ok: true, ...stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== SOTA GraphRAG APIs ====================
        
        // POST /api/graphrag/stream - Stream GraphRAG query response via SSE
        if (pathname === '/api/graphrag/stream' && req.method === 'POST') {
            const body = await parseBody(req);
            const query = body.query || body.message;
            
            if (!query) {
                jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
                return;
            }
            
            try {
                const { streamGraphRAGQuery } = require('./llm/streaming');
                const { GraphRAGEngine } = require('./graphrag');
                
                if (!global.graphRAGEngine) {
                    global.graphRAGEngine = new GraphRAGEngine({
                        graphProvider: storage.getGraphProvider(),
                        storage: storage,
                        llmProvider: config.llm?.provider || 'openai',
                        llmModel: config.llm?.models?.text || 'gpt-4o-mini',
                        llmConfig: config.llm,
                        enableCache: true
                    });
                }
                
                await streamGraphRAGQuery(res, global.graphRAGEngine, query, body);
            } catch (error) {
                console.error('[GraphRAG] Stream error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }
        
        // POST /api/graphrag/hyde - Query using HyDE (Hypothetical Document Embeddings)
        if (pathname === '/api/graphrag/hyde' && req.method === 'POST') {
            const body = await parseBody(req);
            const query = body.query;
            
            if (!query) {
                jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
                return;
            }
            
            try {
                const { getHyDE } = require('./graphrag');
                const hyde = getHyDE({
                    llmProvider: config.llm?.provider || 'openai',
                    llmModel: config.llm?.models?.text || 'gpt-4o-mini',
                    embeddingProvider: config.llm?.embeddingsProvider || 'openai',
                    embeddingModel: config.llm?.models?.embeddings || 'text-embedding-3-small',
                    llmConfig: config.llm
                });
                
                const result = await hyde.generateHyDEEmbedding(query, body);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/graphrag/multihop - Multi-hop reasoning query
        if (pathname === '/api/graphrag/multihop' && req.method === 'POST') {
            const body = await parseBody(req);
            const query = body.query;
            
            if (!query) {
                jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
                return;
            }
            
            try {
                const { getMultiHopReasoning, GraphRAGEngine } = require('./graphrag');
                
                if (!global.graphRAGEngine) {
                    global.graphRAGEngine = new GraphRAGEngine({
                        graphProvider: storage.getGraphProvider(),
                        storage: storage,
                        llmProvider: config.llm?.provider || 'openai',
                        llmModel: config.llm?.models?.text || 'gpt-4o-mini',
                        llmConfig: config.llm
                    });
                }
                
                const multiHop = getMultiHopReasoning({
                    llmProvider: config.llm?.provider || 'openai',
                    llmModel: config.llm?.models?.text || 'gpt-4o-mini',
                    llmConfig: config.llm,
                    graphProvider: storage.getGraphProvider()
                });
                
                // Use GraphRAG engine's search as the retrieve function
                const retrieveFn = async (q) => {
                    const analysis = await global.graphRAGEngine.classifyQuery(q);
                    return await global.graphRAGEngine.hybridSearch(q, { queryAnalysis: analysis });
                };
                
                const result = await multiHop.execute(query, retrieveFn, body);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/graphrag/communities - Get detected communities
        if (pathname === '/api/graphrag/communities' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider || !graphProvider.connected) {
                    jsonResponse(res, { ok: true, communities: [], count: 0 });
                    return;
                }
                const { getCommunityDetection } = require('./graphrag');
                const community = getCommunityDetection({ graphProvider });
                const result = await community.detectCommunities();
                jsonResponse(res, result);
            } catch (error) {
                // Return empty communities on error instead of 500
                jsonResponse(res, { ok: true, communities: [], count: 0, error: error.message });
            }
            return;
        }
        
        // GET /api/graphrag/centrality - Get node centrality metrics
        if (pathname === '/api/graphrag/centrality' && req.method === 'GET') {
            try {
                const { getCommunityDetection } = require('./graphrag');
                const community = getCommunityDetection({ graphProvider: storage.getGraphProvider() });
                const result = await community.calculateCentrality();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // GET /api/graphrag/bridges - Get bridge nodes between communities
        if (pathname === '/api/graphrag/bridges' && req.method === 'GET') {
            try {
                const { getCommunityDetection } = require('./graphrag');
                const community = getCommunityDetection({ graphProvider: storage.getGraphProvider() });
                const result = await community.findBridgeNodes();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/graphrag/enhance-query - Enhance query for better embedding
        if (pathname === '/api/graphrag/enhance-query' && req.method === 'POST') {
            const body = await parseBody(req);
            const query = body.query;
            
            if (!query) {
                jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
                return;
            }
            
            try {
                const { getEmbeddingPrompts } = require('./graphrag');
                const prompts = getEmbeddingPrompts();
                const enhanced = prompts.enhanceQuery(query, body);
                jsonResponse(res, { ok: true, ...enhanced });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/graphrag/prepare-embedding - Prepare entity for embedding
        if (pathname === '/api/graphrag/prepare-embedding' && req.method === 'POST') {
            const body = await parseBody(req);
            const { entityType, entity } = body;
            
            if (!entityType || !entity) {
                jsonResponse(res, { ok: false, error: 'entityType and entity are required' }, 400);
                return;
            }
            
            try {
                const { getEmbeddingPrompts } = require('./graphrag');
                const prompts = getEmbeddingPrompts();
                const prepared = prompts.prepareForEmbedding(entityType, entity, {
                    views: body.views || ['primary', 'semantic', 'questionBased'],
                    language: body.language || 'auto'
                });
                jsonResponse(res, { ok: true, ...prepared });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }
        
        // POST /api/graphrag/rerank - Rerank search results
        if (pathname === '/api/graphrag/rerank' && req.method === 'POST') {
            const body = await parseBody(req);
            const { query, candidates } = body;
            
            if (!query || !candidates) {
                jsonResponse(res, { ok: false, error: 'Query and candidates are required' }, 400);
                return;
            }
            
            try {
                const { getReranker } = require('./graphrag');
                const reranker = getReranker({
                    llmProvider: config.llm?.provider || 'openai',
                    llmModel: config.llm?.models?.text || 'gpt-4o-mini',
                    llmConfig: config.llm
                });
                
                const result = await reranker.crossEncoderRerank(query, candidates, body);
                jsonResponse(res, { ok: true, results: result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/graphrag/query - Query using GraphRAG (with request deduplication)
        if (pathname === '/api/graphrag/query' && req.method === 'POST') {
            const body = await parseBody(req);
            const query = body.query || body.message;
            
            if (!query) {
                jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
                return;
            }

            try {
                const { GraphRAGEngine } = require('./graphrag');
                const { getRequestDedup } = require('./utils');
                const dedup = getRequestDedup();
                
                // Use singleton engine for caching to work properly
                if (!global.graphRAGEngine) {
                    global.graphRAGEngine = new GraphRAGEngine({
                        graphProvider: storage.getGraphProvider(),
                        storage: storage,
                        embeddingProvider: config.llm?.embeddingsProvider || 'openai',
                        embeddingModel: config.llm?.models?.embeddings || 'text-embedding-3-small',
                        llmProvider: config.llm?.provider || 'openai',
                        llmModel: config.llm?.models?.text || 'gpt-4o-mini',
                        llmConfig: config.llm,
                        enableCache: true
                    });
                }
                
                // Update graph provider reference if it changed
                if (storage.getGraphProvider() && global.graphRAGEngine.graphProvider !== storage.getGraphProvider()) {
                    global.graphRAGEngine.graphProvider = storage.getGraphProvider();
                }
                
                // Deduplicate identical concurrent requests
                const dedupKey = dedup.getKey('POST', '/api/graphrag/query', query);
                const queryOptions = body.noCache === true ? { noCache: true } : {};
                
                const result = await dedup.execute(dedupKey, async () => {
                    return await global.graphRAGEngine.query(query, queryOptions);
                });
                
                jsonResponse(res, {
                    ok: true,
                    ...result
                });
            } catch (error) {
                console.error('[GraphRAG] Query error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== OPTIMIZATION ENDPOINTS ====================

        // GET /api/optimizations/analytics - Get graph analytics
        if (pathname === '/api/optimizations/analytics' && req.method === 'GET') {
            try {
                const { getGraphAnalytics } = require('./optimizations');
                const analytics = getGraphAnalytics({ graphProvider: storage.getGraphProvider() });
                const result = await analytics.getAnalytics();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/insights - Get graph insights
        if (pathname === '/api/optimizations/insights' && req.method === 'GET') {
            try {
                const { getGraphAnalytics } = require('./optimizations');
                const analytics = getGraphAnalytics({ graphProvider: storage.getGraphProvider() });
                const insights = await analytics.getInsights();
                jsonResponse(res, { ok: true, insights });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/resolve-duplicates - Resolve entity duplicates
        if (pathname === '/api/optimizations/resolve-duplicates' && req.method === 'POST') {
            try {
                const { getEntityResolver } = require('./optimizations');
                const resolver = getEntityResolver({ llmConfig: config.llm });
                const result = await resolver.resolveDuplicates(storage.getGraphProvider());
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/summary - Get auto-generated project summary
        if (pathname === '/api/optimizations/summary' && req.method === 'GET') {
            try {
                const { getAutoSummary } = require('./optimizations');
                const summary = getAutoSummary({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    llmProvider: config.llm?.provider,
                    llmModel: config.llm?.models?.text
                });
                const result = await summary.generateProjectSummary();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/digest - Get daily/weekly digest
        if (pathname === '/api/optimizations/digest' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const period = parsedUrl.query.period || 'daily';
                
                const { getAutoSummary } = require('./optimizations');
                const summary = getAutoSummary({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm
                });
                const result = await summary.generateDigest(period);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/dedup - Run smart deduplication
        if (pathname === '/api/optimizations/dedup' && req.method === 'POST') {
            try {
                const { getSmartDedup } = require('./optimizations');
                const dedup = getSmartDedup({ storage: storage, llmConfig: config.llm });
                const result = await dedup.runFullDedup();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/export - Export graph
        if (pathname === '/api/optimizations/export' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const format = body.format || 'json';
                
                const { getExportGraph } = require('./optimizations');
                const exporter = getExportGraph({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const result = await exporter.saveExport(format, body.filename);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/export/:format - Get export data
        const exportMatch = pathname.match(/^\/api\/optimizations\/export\/(\w+)$/);
        if (exportMatch && req.method === 'GET') {
            try {
                const format = exportMatch[1];
                const { getExportGraph } = require('./optimizations');
                const exporter = getExportGraph({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                
                let result;
                switch (format) {
                    case 'json': result = await exporter.exportToJSON(); break;
                    case 'cypher': result = await exporter.exportToCypher(); break;
                    case 'graphml': result = await exporter.exportToGraphML(); break;
                    case 'csv': result = await exporter.exportToCSV(); break;
                    case 'knowledge': result = exporter.exportKnowledgeBase(); break;
                    default: result = { error: 'Unknown format' };
                }
                jsonResponse(res, { ok: !result.error, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/tag - Auto-tag a document
        if (pathname === '/api/optimizations/tag' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getAutoTagging } = require('./optimizations');
                const tagger = getAutoTagging({ llmConfig: config.llm });
                const result = await tagger.tagDocument(body);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/feedback - Record user feedback/correction
        if (pathname === '/api/optimizations/feedback' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getFeedbackLoop } = require('./optimizations');
                const feedback = getFeedbackLoop({ dataDir: storage.getProjectDataDir() });
                const id = feedback.recordCorrection(body);
                jsonResponse(res, { ok: true, id });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/feedback/stats - Get feedback statistics
        if (pathname === '/api/optimizations/feedback/stats' && req.method === 'GET') {
            try {
                const { getFeedbackLoop } = require('./optimizations');
                const feedback = getFeedbackLoop({ dataDir: storage.getProjectDataDir() });
                const stats = feedback.getStats();
                jsonResponse(res, { ok: true, ...stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // Webhooks endpoints
        // GET /api/webhooks - List webhook endpoints
        if (pathname === '/api/webhooks' && req.method === 'GET') {
            try {
                const { getWebhooks } = require('./optimizations');
                const webhooks = getWebhooks({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, endpoints: webhooks.getEndpoints() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/webhooks - Register webhook endpoint
        if (pathname === '/api/webhooks' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getWebhooks } = require('./optimizations');
                const webhooks = getWebhooks({ dataDir: storage.getProjectDataDir() });
                const endpoint = webhooks.registerEndpoint(body);
                jsonResponse(res, { ok: true, endpoint });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/webhooks/:id - Remove webhook endpoint
        const webhookDeleteMatch = pathname.match(/^\/api\/webhooks\/(\w+)$/);
        if (webhookDeleteMatch && req.method === 'DELETE') {
            try {
                const { getWebhooks } = require('./optimizations');
                const webhooks = getWebhooks({ dataDir: storage.getProjectDataDir() });
                const success = webhooks.removeEndpoint(webhookDeleteMatch[1]);
                jsonResponse(res, { ok: success });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/webhooks/:id/test - Test webhook endpoint
        const webhookTestMatch = pathname.match(/^\/api\/webhooks\/(\w+)\/test$/);
        if (webhookTestMatch && req.method === 'POST') {
            try {
                const { getWebhooks } = require('./optimizations');
                const webhooks = getWebhooks({ dataDir: storage.getProjectDataDir() });
                const result = await webhooks.testEndpoint(webhookTestMatch[1]);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/sync-stats - Get incremental sync stats
        if (pathname === '/api/optimizations/sync-stats' && req.method === 'GET') {
            try {
                const { getIncrementalSync } = require('./optimizations');
                const sync = getIncrementalSync({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, ...sync.getStats() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== BATCH 2: ADVANCED OPTIMIZATIONS ====================

        // GET /api/optimizations/health - System health check
        if (pathname === '/api/optimizations/health' && req.method === 'GET') {
            try {
                const { getHealthMonitor } = require('./optimizations');
                const monitor = getHealthMonitor({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const health = await monitor.getHealth();
                jsonResponse(res, { ok: true, ...health });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/health/summary - Health summary
        if (pathname === '/api/optimizations/health/summary' && req.method === 'GET') {
            try {
                const { getHealthMonitor } = require('./optimizations');
                const monitor = getHealthMonitor({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                jsonResponse(res, { ok: true, ...monitor.getSummary() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/memory - Memory stats
        if (pathname === '/api/optimizations/memory' && req.method === 'GET') {
            try {
                const { getMemoryPool } = require('./optimizations');
                const memory = getMemoryPool();
                jsonResponse(res, { ok: true, ...memory.getStats() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/cache/stats - Semantic cache stats
        if (pathname === '/api/optimizations/cache/stats' && req.method === 'GET') {
            try {
                const { getSemanticCache } = require('./optimizations');
                const cache = getSemanticCache({ llmConfig: config.llm });
                jsonResponse(res, { ok: true, ...cache.getStats() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/cache/clear - Clear semantic cache
        if (pathname === '/api/optimizations/cache/clear' && req.method === 'POST') {
            try {
                const { getSemanticCache } = require('./optimizations');
                const cache = getSemanticCache({ llmConfig: config.llm });
                cache.clear();
                jsonResponse(res, { ok: true, message: 'Cache cleared' });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/query/analyze - Analyze a Cypher query
        if (pathname === '/api/optimizations/query/analyze' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getQueryPlanner } = require('./optimizations');
                const planner = getQueryPlanner({ graphProvider: storage.getGraphProvider() });
                const analysis = planner.analyze(body.query);
                const optimized = planner.optimize(body.query);
                jsonResponse(res, { ok: true, analysis, optimized });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/query/slow - Get slow queries
        if (pathname === '/api/optimizations/query/slow' && req.method === 'GET') {
            try {
                const { getQueryPlanner } = require('./optimizations');
                const planner = getQueryPlanner();
                jsonResponse(res, { ok: true, slowQueries: planner.getSlowQueries() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/indexes/create - Create default indexes
        if (pathname === '/api/optimizations/indexes/create' && req.method === 'POST') {
            try {
                const { getGraphIndexing } = require('./optimizations');
                const indexing = getGraphIndexing({ graphProvider: storage.getGraphProvider() });
                const result = await indexing.createDefaultIndexes();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/indexes - List indexes
        if (pathname === '/api/optimizations/indexes' && req.method === 'GET') {
            try {
                const { getGraphIndexing } = require('./optimizations');
                const indexing = getGraphIndexing({ graphProvider: storage.getGraphProvider() });
                const result = await indexing.listIndexes();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/suggestions - Get query suggestions
        if (pathname === '/api/optimizations/suggestions' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const partial = parsedUrl.query.q || '';
                const { getQuerySuggestions } = require('./optimizations');
                const suggestions = getQuerySuggestions({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, suggestions: suggestions.getSuggestions(partial) });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/suggestions/popular - Get popular queries
        if (pathname === '/api/optimizations/suggestions/popular' && req.method === 'GET') {
            try {
                const { getQuerySuggestions } = require('./optimizations');
                const suggestions = getQuerySuggestions({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, ...suggestions.getInsights() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // Backups endpoints
        // GET /api/backups - List backups
        if (pathname === '/api/backups' && req.method === 'GET') {
            try {
                const { getAutoBackup } = require('./optimizations');
                const backup = getAutoBackup({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                jsonResponse(res, { ok: true, backups: backup.listBackups() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/backups - Create backup
        if (pathname === '/api/backups' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getAutoBackup } = require('./optimizations');
                const backup = getAutoBackup({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const result = await backup.createBackup(body.name);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/backups/:name/restore - Restore backup
        const backupRestoreMatch = pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
        if (backupRestoreMatch && req.method === 'POST') {
            try {
                const { getAutoBackup } = require('./optimizations');
                const backup = getAutoBackup({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const result = await backup.restore(backupRestoreMatch[1]);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/usage - Usage analytics
        if (pathname === '/api/optimizations/usage' && req.method === 'GET') {
            try {
                const { getUsageAnalytics } = require('./optimizations');
                const analytics = getUsageAnalytics({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, ...analytics.getSummary() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/usage/export - Export usage data
        if (pathname === '/api/optimizations/usage/export' && req.method === 'GET') {
            try {
                const { getUsageAnalytics } = require('./optimizations');
                const analytics = getUsageAnalytics({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, ...analytics.exportData() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/optimizations/ratelimit/stats - Rate limiter stats
        if (pathname === '/api/optimizations/ratelimit/stats' && req.method === 'GET') {
            try {
                const { getRateLimiter } = require('./optimizations');
                const limiter = getRateLimiter();
                jsonResponse(res, { ok: true, ...limiter.getStats() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/optimizations/ner - Extract named entities
        if (pathname === '/api/optimizations/ner' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getMultiLanguageNER } = require('./optimizations');
                const ner = getMultiLanguageNER({ llmConfig: config.llm });
                const result = await ner.extract(body.text, { language: body.language });
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/prompts/preview - Preview ontology-aware prompts
        if (pathname === '/api/prompts/preview' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const type = parsedUrl.query.type || 'document';
                const { getOntologyAwarePrompts } = require('./prompts');
                const prompts = getOntologyAwarePrompts({
                    userRole: config.userRole,
                    projectContext: config.projectContext
                });
                
                const sampleContent = 'Sample content for preview...';
                let preview;
                
                switch (type) {
                    case 'transcript':
                        preview = prompts.buildTranscriptPrompt(sampleContent, 'sample-meeting.txt');
                        break;
                    case 'conversation':
                        preview = prompts.buildConversationPrompt(sampleContent, 'Sample Conversation');
                        break;
                    case 'vision':
                        preview = prompts.buildVisionPrompt('sample-image.png');
                        break;
                    default:
                        preview = prompts.buildDocumentPrompt(sampleContent, 'sample-document.pdf');
                }
                
                jsonResponse(res, { 
                    ok: true, 
                    type,
                    prompt: preview,
                    ontologyContext: prompts.getOntologyContext()
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/prompts/ontology - Get ontology context for prompts
        if (pathname === '/api/prompts/ontology' && req.method === 'GET') {
            try {
                const { getOntologyAwarePrompts } = require('./prompts');
                const prompts = getOntologyAwarePrompts();
                jsonResponse(res, { ok: true, ...prompts.getOntologyContext() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== ONTOLOGY AGENT ENDPOINTS ====================

        // GET /api/ontology/suggestions - Get pending suggestions
        if (pathname === '/api/ontology/suggestions' && req.method === 'GET') {
            try {
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                // Load from Supabase if available
                await agent.loadSuggestionsFromSupabase();
                const suggestions = agent.getPendingSuggestions();
                jsonResponse(res, { ok: true, suggestions, stats: agent.getStats() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/analyze-graph - Analyze graph for new types
        if (pathname === '/api/ontology/analyze-graph' && req.method === 'POST') {
            try {
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                const result = await agent.analyzeGraphForSuggestions();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/suggestions/:id/approve - Approve suggestion
        const approveMatch = pathname.match(/^\/api\/ontology\/suggestions\/([^/]+)\/approve$/);
        if (approveMatch && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                await agent.loadSuggestionsFromSupabase();
                const result = await agent.approveSuggestion(approveMatch[1], body);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/suggestions/:id/reject - Reject suggestion
        const rejectMatch = pathname.match(/^\/api\/ontology\/suggestions\/([^/]+)\/reject$/);
        if (rejectMatch && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                await agent.loadSuggestionsFromSupabase();
                const result = await agent.rejectSuggestion(rejectMatch[1], body.reason);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/suggestions/:id/enrich - AI enrich suggestion
        const enrichMatch = pathname.match(/^\/api\/ontology\/suggestions\/([^/]+)\/enrich$/);
        if (enrichMatch && req.method === 'POST') {
            try {
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                await agent.loadSuggestionsFromSupabase();
                const result = await agent.enrichSuggestionWithAI(enrichMatch[1]);
                jsonResponse(res, { ok: result.success || !result.error, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/ontology/schema - Get current ontology schema
        if (pathname === '/api/ontology/schema' && req.method === 'GET') {
            try {
                const { getOntologyManager } = require('./ontology');
                const manager = getOntologyManager();
                const schema = manager.getSchema();
                jsonResponse(res, { ok: true, schema });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/entity-type - Add new entity type
        if (pathname === '/api/ontology/entity-type' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyManager } = require('./ontology');
                const manager = getOntologyManager();
                const result = await manager.addEntityType(body.name, {
                    description: body.description,
                    properties: body.properties || { name: { type: 'string', required: true } }
                });
                jsonResponse(res, { ok: result, message: result ? 'Entity type added' : 'Failed' });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/relation-type - Add new relation type
        if (pathname === '/api/ontology/relation-type' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyManager } = require('./ontology');
                const manager = getOntologyManager();
                const result = await manager.addRelationType(body.name, {
                    from: body.from || '*',
                    to: body.to || '*',
                    description: body.description
                });
                jsonResponse(res, { ok: result, message: result ? 'Relation type added' : 'Failed' });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== SOTA v2.0 ONTOLOGY ENDPOINTS ====================

        // GET /api/ontology/stats - Get type usage statistics
        if (pathname === '/api/ontology/stats' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider?.connected) {
                    jsonResponse(res, { ok: true, stats: null, message: 'Graph not connected' });
                    return;
                }
                
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider,
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                const stats = await agent.getTypeUsageStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                console.log(`[API] /api/ontology/stats warning: ${error.message}`);
                jsonResponse(res, { ok: true, stats: null, error: error.message });
            }
            return;
        }

        // GET /api/ontology/sync/status - Get ontology sync status
        if (pathname === '/api/ontology/sync/status' && req.method === 'GET') {
            try {
                const { getOntologySync } = require('./ontology');
                const graphProvider = storage.getGraphProvider();
                const sync = getOntologySync({
                    supabase: supabase?.getAdminClient?.(),
                    graphProvider,
                    storage: storage
                });
                const status = sync.getStatus ? sync.getStatus() : {
                    isListening: false,
                    syncInProgress: false,
                    lastSyncAt: null,
                    pendingChanges: 0,
                    ontologySource: null,
                    graphConnected: !!graphProvider?.connected
                };
                jsonResponse(res, { ok: true, status });
            } catch (error) {
                console.log(`[API] /api/ontology/sync/status warning: ${error.message}`);
                jsonResponse(res, { ok: true, status: {
                    isListening: false,
                    syncInProgress: false,
                    lastSyncAt: null,
                    pendingChanges: 0,
                    ontologySource: null,
                    graphConnected: false
                }});
            }
            return;
        }

        // POST /api/ontology/sync/force - Force sync ontology to FalkorDB
        if (pathname === '/api/ontology/sync/force' && req.method === 'POST') {
            try {
                const { getOntologySync } = require('./ontology');
                const sync = getOntologySync({
                    supabase: supabase?.getAdminClient?.(),
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const result = await sync.forceSync();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/analyze - Run LLM analysis
        if (pathname === '/api/ontology/analyze' && req.method === 'POST') {
            try {
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                const result = await agent.analyzeWithLLM();
                jsonResponse(res, { ok: !result.error, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/suggestions/auto-approve - Auto-approve high confidence suggestions
        if (pathname === '/api/ontology/suggestions/auto-approve' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyAgent } = require('./ontology');
                const agent = getOntologyAgent({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                const result = await agent.autoApproveHighConfidence(body.threshold || 0.85);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/ontology/changes - Get ontology change history
        if (pathname === '/api/ontology/changes' && req.method === 'GET') {
            try {
                // Check if method exists (table might not be created yet)
                if (!storage.getOntologyChanges) {
                    jsonResponse(res, { ok: true, changes: [], message: 'Feature not available' });
                    return;
                }
                
                const parsedUrlOntology = parseUrl(req.url);
                const limitParam = parseInt(parsedUrlOntology.query.limit);
                const changes = await storage.getOntologyChanges({
                    targetType: parsedUrlOntology.query.targetType,
                    targetName: parsedUrlOntology.query.targetName,
                    limit: isNaN(limitParam) ? 50 : limitParam
                });
                jsonResponse(res, { ok: true, changes: changes || [] });
            } catch (error) {
                // Return empty array on error (table might not exist yet)
                console.log(`[API] /api/ontology/changes warning: ${error.message}`);
                jsonResponse(res, { ok: true, changes: [], error: error.message });
            }
            return;
        }

        // POST /api/ontology/migrate - Migrate schema to Supabase
        if (pathname === '/api/ontology/migrate' && req.method === 'POST') {
            try {
                const { getOntologyManager } = require('./ontology');
                const manager = getOntologyManager();
                manager.setStorage(storage);
                const result = await manager.migrateToSupabase();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { success: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== ONTOLOGY BACKGROUND WORKER ENDPOINTS ====================

        // GET /api/ontology/worker/status - Get background worker status
        if (pathname === '/api/ontology/worker/status' && req.method === 'GET') {
            try {
                const { getOntologyBackgroundWorker } = require('./ontology');
                const worker = getOntologyBackgroundWorker({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                const status = worker.getStatus();
                const stats = worker.getStats();
                jsonResponse(res, { ok: true, status, stats });
            } catch (error) {
                console.log(`[API] /api/ontology/worker/status warning: ${error.message}`);
                // Return default status on error
                jsonResponse(res, { 
                    ok: true, 
                    status: {
                        isRunning: false,
                        hasPendingAnalysis: false,
                        lastRun: {},
                        graphConnected: false,
                        llmConfigured: false,
                        thresholds: {}
                    },
                    stats: {
                        totalExecutions: 0,
                        byType: {},
                        byStatus: { completed: 0, failed: 0 },
                        avgDuration: 0
                    }
                });
            }
            return;
        }

        // POST /api/ontology/worker/trigger - Trigger background analysis manually
        if (pathname === '/api/ontology/worker/trigger' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyBackgroundWorker } = require('./ontology');
                const worker = getOntologyBackgroundWorker({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                
                const type = body.type || 'full';
                let result;
                
                switch (type) {
                    case 'full':
                        result = await worker.runFullAnalysis(body.config || {});
                        break;
                    case 'inference':
                        result = await worker.runInferenceRules(body.config || {});
                        break;
                    case 'dedup':
                        result = await worker.checkDuplicates(body.config || {});
                        break;
                    case 'auto_approve':
                        result = await worker.autoApprove(body.config || {});
                        break;
                    case 'gaps':
                        result = await worker.checkForGaps();
                        break;
                    default:
                        result = { error: `Unknown analysis type: ${type}` };
                }
                
                jsonResponse(res, { ok: !result.error, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/ontology/worker/log - Get background worker execution log
        if (pathname === '/api/ontology/worker/log' && req.method === 'GET') {
            try {
                const { getOntologyBackgroundWorker } = require('./ontology');
                const worker = getOntologyBackgroundWorker({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    llmConfig: config.llm,
                    dataDir: storage.getProjectDataDir()
                });
                
                const parsedUrlWorker = parseUrl(req.url);
                const limitParam = parseInt(parsedUrlWorker.query.limit);
                const log = worker.getExecutionLog({
                    type: parsedUrlWorker.query.type,
                    status: parsedUrlWorker.query.status,
                    limit: isNaN(limitParam) ? 20 : limitParam
                });
                
                jsonResponse(res, { ok: true, log: log || [] });
            } catch (error) {
                console.log(`[API] /api/ontology/worker/log warning: ${error.message}`);
                jsonResponse(res, { ok: true, log: [] });
            }
            return;
        }

        // GET /api/ontology/jobs - Get ontology-related scheduled jobs
        if (pathname === '/api/ontology/jobs' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                const allJobs = scheduler.getJobs() || [];
                const ontologyJobs = allJobs.filter(j => j.type?.startsWith('ontology_'));
                jsonResponse(res, { ok: true, jobs: ontologyJobs });
            } catch (error) {
                console.log(`[API] /api/ontology/jobs warning: ${error.message}`);
                jsonResponse(res, { ok: true, jobs: [] });
            }
            return;
        }

        // POST /api/ontology/jobs/:id/toggle - Enable/disable an ontology job
        const jobToggleMatch = pathname.match(/^\/api\/ontology\/jobs\/([^/]+)\/toggle$/);
        if (jobToggleMatch && req.method === 'POST') {
            try {
                const jobId = jobToggleMatch[1];
                const body = await parseBody(req);
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                
                const job = scheduler.getJob(jobId);
                if (!job) {
                    jsonResponse(res, { ok: false, error: 'Job not found' }, 404);
                    return;
                }
                
                const enabled = body.enabled !== undefined ? body.enabled : !job.enabled;
                const updated = scheduler.updateJob(jobId, { enabled });
                
                jsonResponse(res, { ok: true, job: updated });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== ONTOLOGY EXTRACTOR ENDPOINTS (SOTA v2.1) ====================

        // GET /api/ontology/extract-from-graph - Extract ontology from FalkorDB graph
        if (pathname === '/api/ontology/extract-from-graph' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider?.connected) {
                    jsonResponse(res, { ok: false, error: 'Graph not connected' });
                    return;
                }
                
                const { getOntologyExtractor } = require('./ontology');
                const extractor = getOntologyExtractor({ graphProvider });
                const result = await extractor.extractFromGraph();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/ontology/validate-compliance - Validate graph against ontology
        if (pathname === '/api/ontology/validate-compliance' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider?.connected) {
                    jsonResponse(res, { ok: false, valid: false, score: 0, issues: [{ type: 'error', message: 'Graph not connected' }], stats: {} });
                    return;
                }
                
                const { getOntologyExtractor } = require('./ontology');
                const extractor = getOntologyExtractor({ graphProvider });
                const result = await extractor.validateCompliance();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/merge - Merge extracted ontology with current
        if (pathname === '/api/ontology/merge' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const graphProvider = storage.getGraphProvider();
                
                const { getOntologyExtractor, getOntologyManager } = require('./ontology');
                const extractor = getOntologyExtractor({ graphProvider });
                const manager = getOntologyManager();
                
                // If no ontology provided, extract from graph first
                let ontologyToMerge = body.ontology;
                if (!ontologyToMerge) {
                    const extracted = await extractor.extractFromGraph();
                    if (!extracted.ok) {
                        jsonResponse(res, { ok: false, error: 'Failed to extract ontology' }, 400);
                        return;
                    }
                    ontologyToMerge = extracted.ontology;
                }
                
                const { merged, changes } = extractor.mergeOntologies(ontologyToMerge, {
                    mergeProperties: body.mergeProperties !== false,
                    mergeEndpoints: body.mergeEndpoints !== false
                });
                
                // Optionally save the merged ontology
                if (body.save) {
                    await manager.updateSchema(merged, null, 'Merged with extracted ontology');
                }
                
                jsonResponse(res, { ok: true, merged, changes, saved: !!body.save });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/ontology/unused-types - Find types not used in graph
        if (pathname === '/api/ontology/unused-types' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider?.connected) {
                    jsonResponse(res, { ok: true, entities: [], relations: [], message: 'Graph not connected' });
                    return;
                }
                
                const { getOntologyExtractor } = require('./ontology');
                const extractor = getOntologyExtractor({ graphProvider });
                const unused = await extractor.findUnusedTypes();
                jsonResponse(res, { ok: true, unused });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/cleanup - Discard orphan types
        if (pathname === '/api/ontology/cleanup' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getOntologyExtractor, getOntologyManager } = require('./ontology');
                const extractor = getOntologyExtractor();
                const manager = getOntologyManager();
                
                const schema = manager.getSchema();
                let result = { discardedEntities: [], discardedRelations: [] };
                
                if (body.discardEntitiesWithoutRelations) {
                    const { cleaned, discarded } = extractor.discardEntitiesWithoutRelations(schema);
                    result.discardedEntities = discarded;
                    if (body.save) {
                        await manager.updateSchema(cleaned, null, 'Discarded entities without relations');
                    }
                }
                
                if (body.discardRelationsWithoutEntities) {
                    const currentSchema = manager.getSchema();
                    const { cleaned, discarded } = extractor.discardRelationsWithoutEntities(currentSchema);
                    result.discardedRelations = discarded;
                    if (body.save) {
                        await manager.updateSchema(cleaned, null, 'Discarded relations without entities');
                    }
                }
                
                jsonResponse(res, { ok: true, ...result, saved: !!body.save });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/ontology/diff - Compare current ontology with graph
        if (pathname === '/api/ontology/diff' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider?.connected) {
                    jsonResponse(res, { ok: false, error: 'Graph not connected' });
                    return;
                }
                
                const { getOntologyExtractor, getOntologyManager } = require('./ontology');
                const extractor = getOntologyExtractor({ graphProvider });
                const manager = getOntologyManager();
                
                // Extract from graph
                const extracted = await extractor.extractFromGraph();
                if (!extracted.ok) {
                    jsonResponse(res, { ok: false, error: 'Failed to extract ontology' });
                    return;
                }
                
                // Compare with current
                const currentSchema = manager.getSchema();
                const diff = extractor.diffOntologies(currentSchema, extracted.ontology);
                
                jsonResponse(res, { ok: true, diff, extractedOntology: extracted.ontology });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/ontology/infer-relationships - AI-powered relationship discovery
        if (pathname === '/api/ontology/infer-relationships' && req.method === 'POST') {
            try {
                const { getRelationshipInferrer } = require('./ontology');
                const inferrer = getRelationshipInferrer({ storage });
                
                console.log('[API] Starting AI relationship inference...');
                const result = await inferrer.inferAllRelationships();
                
                // Trigger graph sync after inference
                if (result.ok && result.results.inferred.total > 0) {
                    console.log('[API] Syncing new relationships to graph...');
                    await storage.syncToGraph();
                }
                
                jsonResponse(res, result);
            } catch (error) {
                console.error('[API] Relationship inference error:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/graph/falkordb-browser - Get FalkorDB Browser URL info
        if (pathname === '/api/graph/falkordb-browser' && req.method === 'GET') {
            try {
                const graphConfig = config.graph || {};
                const falkorConfig = graphConfig.falkordb || {};
                
                // FalkorDB Browser typically runs on port 3000 on the same host
                const host = falkorConfig.host || 'localhost';
                const browserPort = falkorConfig.browserPort || 3000;
                
                // Check if using cloud FalkorDB (has special host)
                const isCloud = host.includes('.cloud') || host.includes('falkordb.com');
                
                jsonResponse(res, {
                    ok: true,
                    browserUrl: isCloud ? `https://browser.falkordb.cloud` : `http://${host === 'localhost' ? 'localhost' : host}:${browserPort}`,
                    isCloud,
                    host,
                    note: isCloud ? 'Cloud FalkorDB - use FalkorDB Cloud Console' : 'Local FalkorDB Browser'
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== GRAPH SYNC ENDPOINTS ====================

        // GET /api/graph/sync/status - Get sync status
        if (pathname === '/api/graph/sync/status' && req.method === 'GET') {
            try {
                const { getGraphSync } = require('./sync');
                const graphSync = getGraphSync({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const status = await graphSync.getSyncStatus();
                jsonResponse(res, { ok: true, ...status });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/graph/sync/full - Run full sync (cleanup orphans)
        if (pathname === '/api/graph/sync/full' && req.method === 'POST') {
            try {
                const { getGraphSync } = require('./sync');
                const graphSync = getGraphSync({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const result = await graphSync.fullSync();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/graph/sync/cleanup - Cleanup orphaned nodes
        if (pathname === '/api/graph/sync/cleanup' && req.method === 'POST') {
            try {
                const { getGraphSync } = require('./sync');
                const graphSync = getGraphSync({
                    graphProvider: storage.getGraphProvider()
                });
                const result = await graphSync.cleanupOrphanedNodes();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/graph/cleanup-duplicates - Cleanup duplicate Meeting nodes
        if (pathname === '/api/graph/cleanup-duplicates' && req.method === 'POST') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider) {
                    jsonResponse(res, { ok: false, error: 'Graph provider not connected' });
                    return;
                }
                
                // Clean duplicate Meeting nodes
                const dupResult = await graphProvider.cleanupDuplicateMeetings?.() || { ok: false, error: 'Method not supported' };
                
                // Also clean orphaned relationships
                const orphanResult = await graphProvider.cleanupOrphanedRelationships?.() || { ok: true, deleted: 0 };
                
                jsonResponse(res, { 
                    ok: dupResult.ok && orphanResult.ok,
                    duplicatesDeleted: dupResult.deleted || 0,
                    orphanedRelationsDeleted: orphanResult.deleted || 0,
                    remapped: dupResult.remapped || 0
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/graph/list-all - List all graphs in FalkorDB
        if (pathname === '/api/graph/list-all' && req.method === 'GET') {
            try {
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider || typeof graphProvider.listGraphs !== 'function') {
                    jsonResponse(res, { ok: false, error: 'FalkorDB provider not available' });
                    return;
                }
                const result = await graphProvider.listGraphs();
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/graph/sync-projects - Sync FalkorDB graphs with Supabase projects (cleanup orphans)
        if (pathname === '/api/graph/sync-projects' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const dryRun = body.dryRun === true;
                const result = await storage.syncFalkorDBGraphs({ dryRun });
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/graph/:graphName - Delete a specific graph from FalkorDB
        if (pathname.startsWith('/api/graph/delete/') && req.method === 'DELETE') {
            try {
                const graphName = decodeURIComponent(pathname.split('/').pop());
                const graphProvider = storage.getGraphProvider();
                if (!graphProvider || typeof graphProvider.deleteGraph !== 'function') {
                    jsonResponse(res, { ok: false, error: 'FalkorDB provider not available' });
                    return;
                }
                const result = await graphProvider.deleteGraph(graphName);
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== SOFT DELETE & RESTORE ====================

        // GET /api/sync/deleted - Get all soft-deleted items
        if (pathname === '/api/sync/deleted' && req.method === 'GET') {
            try {
                const { getSoftDelete } = require('./sync');
                const softDelete = getSoftDelete({ dataDir: storage.getProjectDataDir() });
                const parsedUrlSync = parseUrl(req.url);
                const type = parsedUrlSync.query.type;
                let items = [];
                let stats = {};
                try {
                    items = softDelete.getDeleted(type) || [];
                } catch (e) {
                    items = [];
                }
                try {
                    stats = softDelete.getStats() || {};
                } catch (e) {
                    stats = {};
                }
                jsonResponse(res, { ok: true, items, count: items.length, stats });
            } catch (error) {
                console.log(`[Sync] Deleted items error: ${error.message}`);
                jsonResponse(res, { ok: true, items: [], count: 0, stats: {} });
            }
            return;
        }

        // POST /api/sync/restore/:type/:id - Restore a soft-deleted item
        const restoreMatch = pathname.match(/^\/api\/sync\/restore\/(\w+)\/([a-f0-9\-]+)$/);
        if (restoreMatch && req.method === 'POST') {
            try {
                const type = restoreMatch[1];
                const itemId = restoreMatch[2];
                const { getSoftDelete, getAuditLog, getDeleteEvents } = require('./sync');
                
                const softDelete = getSoftDelete({ dataDir: storage.getProjectDataDir() });
                const restored = softDelete.restore(type, itemId);
                
                if (!restored) {
                    jsonResponse(res, { ok: false, error: 'Item not found in deleted items' }, 404);
                    return;
                }
                
                // Log restore
                const auditLog = getAuditLog({ dataDir: storage.getProjectDataDir() });
                auditLog.logRestore({
                    entityType: type,
                    entityId: itemId,
                    entityName: restored.name || restored.title
                });
                
                // Emit event
                const events = getDeleteEvents();
                events.emitRestore(type, restored);
                
                jsonResponse(res, { ok: true, restored });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== AUDIT LOG ====================

        // GET /api/sync/audit - Get audit log
        if (pathname === '/api/sync/audit' && req.method === 'GET') {
            try {
                const { getAuditLog } = require('./sync');
                const auditLog = getAuditLog({ dataDir: storage.getProjectDataDir() });
                const parsedUrlAudit = parseUrl(req.url);
                const action = parsedUrlAudit.query.action;
                const entityType = parsedUrlAudit.query.type;
                const limit = parseInt(parsedUrlAudit.query.limit) || 100;
                const entries = auditLog.getEntries({ action, entityType, limit });
                jsonResponse(res, { ok: true, ...entries });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/sync/audit/stats - Get audit statistics
        if (pathname === '/api/sync/audit/stats' && req.method === 'GET') {
            try {
                const { getAuditLog } = require('./sync');
                const auditLog = getAuditLog({ dataDir: storage.getProjectDataDir() });
                const stats = auditLog.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/sync/audit/export - Export audit log
        if (pathname === '/api/sync/audit/export' && req.method === 'GET') {
            try {
                const { getAuditLog } = require('./sync');
                const auditLog = getAuditLog({ dataDir: storage.getProjectDataDir() });
                const parsedUrlExport = parseUrl(req.url);
                const format = parsedUrlExport.query.format || 'json';
                const data = auditLog.export(format);
                
                if (format === 'csv') {
                    res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=audit-log.csv' });
                    res.end(data);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=audit-log.json' });
                    res.end(data);
                }
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== BATCH DELETE ====================

        // POST /api/sync/batch-delete - Batch delete items
        if (pathname === '/api/sync/batch-delete' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getBatchDelete, getSoftDelete, getAuditLog, getCascadeDelete } = require('./sync');
                
                const batchDelete = getBatchDelete({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage,
                    softDelete: getSoftDelete({ dataDir: storage.getProjectDataDir() }),
                    auditLog: getAuditLog({ dataDir: storage.getProjectDataDir() }),
                    cascadeDelete: getCascadeDelete({ graphProvider: storage.getGraphProvider(), storage })
                });
                
                const result = await batchDelete.batchDelete(body.type, body.items, {
                    softDelete: body.softDelete !== false,
                    cascade: body.cascade !== false,
                    deletedBy: body.deletedBy || 'user'
                });
                
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== INTEGRITY CHECK ====================

        // GET /api/sync/integrity - Run integrity check
        if (pathname === '/api/sync/integrity' && req.method === 'GET') {
            try {
                const { getIntegrityCheck } = require('./sync');
                const integrityCheck = getIntegrityCheck({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const report = await integrityCheck.runCheck();
                jsonResponse(res, { ok: true, ...report });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/sync/integrity/fix - Auto-fix integrity issues
        if (pathname === '/api/sync/integrity/fix' && req.method === 'POST') {
            try {
                const { getIntegrityCheck } = require('./sync');
                const integrityCheck = getIntegrityCheck({
                    graphProvider: storage.getGraphProvider(),
                    storage: storage
                });
                const report = await integrityCheck.runCheck();
                const fixes = await integrityCheck.autoFix(report);
                jsonResponse(res, { ok: true, report, fixes });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== BACKUPS ====================

        // GET /api/sync/backups/stats - Get backup statistics (must be before :id route)
        if (pathname === '/api/sync/backups/stats' && req.method === 'GET') {
            try {
                const { getBackupBeforeDelete } = require('./sync');
                const backup = getBackupBeforeDelete({ dataDir: storage.getProjectDataDir() });
                const stats = backup.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/sync/backups - List delete backups
        if (pathname === '/api/sync/backups' && req.method === 'GET') {
            try {
                const { getBackupBeforeDelete } = require('./sync');
                const backup = getBackupBeforeDelete({ dataDir: storage.getProjectDataDir() });
                const parsedUrlBackups = parseUrl(req.url);
                const type = parsedUrlBackups.query.type;
                const limit = parseInt(parsedUrlBackups.query.limit) || 50;
                let result = { total: 0, backups: [] };
                try {
                    result = backup.listBackups({ type, limit }) || { total: 0, backups: [] };
                } catch (e) {
                    result = { total: 0, backups: [] };
                }
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: true, total: 0, backups: [] });
            }
            return;
        }

        // GET /api/sync/backups/:id - Get specific backup
        const backupGetMatch = pathname.match(/^\/api\/sync\/backups\/([a-z0-9_]+)$/);
        if (backupGetMatch && req.method === 'GET') {
            try {
                const { getBackupBeforeDelete } = require('./sync');
                const backup = getBackupBeforeDelete({ dataDir: storage.getProjectDataDir() });
                const data = backup.getBackup(backupGetMatch[1]);
                if (!data) {
                    jsonResponse(res, { ok: false, error: 'Backup not found' }, 404);
                    return;
                }
                jsonResponse(res, { ok: true, backup: data });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== DELETE EVENTS (SSE) ====================

        // GET /api/sync/events/recent - Get recent delete events (must be before SSE route)
        if (pathname === '/api/sync/events/recent' && req.method === 'GET') {
            try {
                const { getDeleteEvents } = require('./sync');
                const events = getDeleteEvents();
                const parsedUrlEvents = parseUrl(req.url);
                const limit = parseInt(parsedUrlEvents.query.limit) || 20;
                let recentEvents = [];
                try {
                    recentEvents = events.getRecentEvents({ limit }) || [];
                } catch (e) {
                    recentEvents = [];
                }
                jsonResponse(res, { ok: true, events: recentEvents });
            } catch (error) {
                jsonResponse(res, { ok: true, events: [] });
            }
            return;
        }

        // GET /api/sync/events - SSE stream for delete events
        if (pathname === '/api/sync/events' && req.method === 'GET') {
            const { getDeleteEvents } = require('./sync');
            const events = getDeleteEvents();
            const handler = events.createSSEHandler();
            handler(req, res);
            return;
        }

        // ==================== DELETE STATISTICS ====================

        // GET /api/sync/stats - Get delete statistics
        if (pathname === '/api/sync/stats' && req.method === 'GET') {
            try {
                const { getDeleteStats } = require('./sync');
                const stats = getDeleteStats({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, stats: stats.getStats() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/sync/stats/dashboard - Get delete dashboard data
        if (pathname === '/api/sync/stats/dashboard' && req.method === 'GET') {
            try {
                const { getDeleteStats } = require('./sync');
                const stats = getDeleteStats({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, dashboard: stats.getDashboard() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== RETENTION POLICY ====================

        // GET /api/sync/retention - Get retention policies
        if (pathname === '/api/sync/retention' && req.method === 'GET') {
            try {
                const { getRetentionPolicy } = require('./sync');
                const retention = getRetentionPolicy({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, policies: retention.getPolicies() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/sync/retention/enable - Enable/disable retention policies
        if (pathname === '/api/sync/retention/enable' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getRetentionPolicy } = require('./sync');
                const retention = getRetentionPolicy({ dataDir: storage.getProjectDataDir() });
                retention.setEnabled(body.enabled);
                jsonResponse(res, { ok: true, enabled: body.enabled });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/sync/retention/execute - Execute retention policies
        if (pathname === '/api/sync/retention/execute' && req.method === 'POST') {
            try {
                const { getRetentionPolicy, getSoftDelete, getAuditLog, getBackupBeforeDelete } = require('./sync');
                const retention = getRetentionPolicy({ dataDir: storage.getProjectDataDir() });
                const result = await retention.execute({
                    softDelete: getSoftDelete({ dataDir: storage.getProjectDataDir() }),
                    auditLog: getAuditLog({ dataDir: storage.getProjectDataDir() }),
                    backupBeforeDelete: getBackupBeforeDelete({ dataDir: storage.getProjectDataDir() }),
                    graphProvider: storage.getGraphProvider()
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/sync/retention/preview - Preview retention policy execution
        if (pathname === '/api/sync/retention/preview' && req.method === 'GET') {
            try {
                const { getRetentionPolicy, getSoftDelete, getBackupBeforeDelete } = require('./sync');
                const retention = getRetentionPolicy({ dataDir: storage.getProjectDataDir() });
                const preview = await retention.dryRun({
                    softDelete: getSoftDelete({ dataDir: storage.getProjectDataDir() }),
                    backupBeforeDelete: getBackupBeforeDelete({ dataDir: storage.getProjectDataDir() })
                });
                jsonResponse(res, { ok: true, preview });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== ADVANCED FEATURES ====================

        // --- Data Versioning ---
        
        // POST /api/versions - Create version
        if (pathname === '/api/versions' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataVersioning } = require('./advanced');
                const versioning = getDataVersioning({ dataDir: storage.getProjectDataDir() });
                const result = versioning.createVersion(body.itemId, body.itemType, body.content, {
                    message: body.message,
                    createdBy: body.createdBy
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/versions/:itemId - Get versions of an item
        const versionsMatch = pathname.match(/^\/api\/versions\/([^/]+)$/);
        if (versionsMatch && req.method === 'GET') {
            try {
                const { getDataVersioning } = require('./advanced');
                const versioning = getDataVersioning({ dataDir: storage.getProjectDataDir() });
                const versions = versioning.getVersions(versionsMatch[1]);
                jsonResponse(res, { ok: true, versions });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/versions/stats - Get versioning stats
        if (pathname === '/api/versions/stats' && req.method === 'GET') {
            try {
                const { getDataVersioning } = require('./advanced');
                const versioning = getDataVersioning({ dataDir: storage.getProjectDataDir() });
                const stats = versioning.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/versions/restore - Restore a version
        if (pathname === '/api/versions/restore' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataVersioning } = require('./advanced');
                const versioning = getDataVersioning({ dataDir: storage.getProjectDataDir() });
                const result = versioning.restoreVersion(body.versionId);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Scheduled Jobs ---

        // GET /api/jobs - Get all jobs
        if (pathname === '/api/jobs' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                const jobs = scheduler.getJobs();
                jsonResponse(res, { ok: true, jobs });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/jobs - Create job
        if (pathname === '/api/jobs' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                const job = scheduler.createJob(body);
                jsonResponse(res, { ok: true, job });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/jobs/:id/execute - Execute job now
        const jobExecMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/execute$/);
        if (jobExecMatch && req.method === 'POST') {
            try {
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                const result = await scheduler.executeJob(jobExecMatch[1]);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/jobs/stats - Get job stats
        if (pathname === '/api/jobs/stats' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                const stats = scheduler.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/jobs/log - Get execution log
        if (pathname === '/api/jobs/log' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: storage.getProjectDataDir() });
                const log = scheduler.getExecutionLog();
                jsonResponse(res, { ok: true, log });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Full-text Search ---

        // POST /api/search - Search
        if (pathname === '/api/search' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getSearchIndex } = require('./advanced');
                const searchIndex = getSearchIndex({ dataDir: storage.getProjectDataDir() });
                const results = searchIndex.search(body.query, {
                    type: body.type,
                    limit: body.limit
                });
                jsonResponse(res, { ok: true, ...results });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/search/index - Index a document
        if (pathname === '/api/search/index' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getSearchIndex } = require('./advanced');
                const searchIndex = getSearchIndex({ dataDir: storage.getProjectDataDir() });
                const result = searchIndex.indexDocument(body.docId, body.docType, body.fields, body.metadata);
                searchIndex.save();
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/search/suggest - Autocomplete
        if (pathname === '/api/search/suggest' && req.method === 'GET') {
            try {
                const parsedUrlSuggest = parseUrl(req.url);
                const prefix = parsedUrlSuggest.query.q || '';
                const { getSearchIndex } = require('./advanced');
                const searchIndex = getSearchIndex({ dataDir: storage.getProjectDataDir() });
                const suggestions = searchIndex.suggest(prefix);
                jsonResponse(res, { ok: true, suggestions });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/search/stats - Search index stats
        if (pathname === '/api/search/stats' && req.method === 'GET') {
            try {
                const { getSearchIndex } = require('./advanced');
                const searchIndex = getSearchIndex({ dataDir: storage.getProjectDataDir() });
                const stats = searchIndex.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Export/Import ---

        // POST /api/export - Export project
        if (pathname === '/api/export' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataExportImport } = require('./advanced');
                const exportImport = getDataExportImport({ 
                    dataDir: storage.getProjectDataDir(),
                    storage: storage
                });
                const result = await exportImport.exportProject({
                    includeEmbeddings: body.includeEmbeddings
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/import - Import project
        if (pathname === '/api/import' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataExportImport } = require('./advanced');
                const exportImport = getDataExportImport({ 
                    dataDir: storage.getProjectDataDir(),
                    storage: storage
                });
                const result = await exportImport.importProject(body.data || body.file, {
                    merge: body.merge,
                    importOntology: body.importOntology
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/export/list - List exports
        if (pathname === '/api/export/list' && req.method === 'GET') {
            try {
                const { getDataExportImport } = require('./advanced');
                const exportImport = getDataExportImport({ dataDir: storage.getProjectDataDir() });
                const exports = exportImport.listExports();
                jsonResponse(res, { ok: true, exports });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Notifications ---

        // GET /api/notifications - Get notifications
        if (pathname === '/api/notifications' && req.method === 'GET') {
            try {
                const { getNotificationSystem } = require('./advanced');
                const notifications = getNotificationSystem({ dataDir: storage.getProjectDataDir() });
                const parsedUrlNotif = parseUrl(req.url);
                const unreadOnly = parsedUrlNotif.query.unread === 'true';
                let history = [];
                let unreadCount = 0;
                try {
                    history = notifications.getHistory({ unreadOnly }) || [];
                    unreadCount = notifications.getUnreadCount() || 0;
                } catch (e) {
                    history = [];
                    unreadCount = 0;
                }
                jsonResponse(res, { ok: true, notifications: history, unreadCount });
            } catch (error) {
                jsonResponse(res, { ok: true, notifications: [], unreadCount: 0 });
            }
            return;
        }

        // POST /api/notifications/read - Mark as read
        if (pathname === '/api/notifications/read' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getNotificationSystem } = require('./advanced');
                const notifications = getNotificationSystem({ dataDir: storage.getProjectDataDir() });
                if (body.all) {
                    const result = notifications.markAllRead();
                    jsonResponse(res, { ok: true, ...result });
                } else {
                    const result = notifications.markRead(body.id);
                    jsonResponse(res, { ok: result });
                }
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/notifications/stream - SSE stream
        if (pathname === '/api/notifications/stream' && req.method === 'GET') {
            const { getNotificationSystem } = require('./advanced');
            const notifications = getNotificationSystem({ dataDir: storage.getProjectDataDir() });
            const handler = notifications.createSSEHandler();
            handler(req, res);
            return;
        }

        // GET /api/notifications/config - Get notification config
        if (pathname === '/api/notifications/config' && req.method === 'GET') {
            try {
                const { getNotificationSystem } = require('./advanced');
                const notifications = getNotificationSystem({ dataDir: storage.getProjectDataDir() });
                jsonResponse(res, { ok: true, config: notifications.getConfig() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Cache ---

        // GET /api/cache/stats - Cache stats
        if (pathname === '/api/cache/stats' && req.method === 'GET') {
            try {
                const { getAdvancedCache } = require('./advanced');
                const cache = getAdvancedCache({ dataDir: storage.getProjectDataDir() });
                const stats = cache.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/cache/clear - Clear cache
        if (pathname === '/api/cache/clear' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getAdvancedCache } = require('./advanced');
                const cache = getAdvancedCache({ dataDir: storage.getProjectDataDir() });
                let cleared;
                if (body.pattern) {
                    cleared = cache.invalidateByPattern(body.pattern);
                } else if (body.tag) {
                    cleared = cache.invalidateByTag(body.tag);
                } else {
                    cleared = cache.clear();
                }
                jsonResponse(res, { ok: true, cleared });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Compression ---

        // POST /api/compress - Compress data
        if (pathname === '/api/compress' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getDataCompression } = require('./advanced');
                const compression = getDataCompression();
                const result = compression.compress(body.data);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/compression/stats - Compression stats
        if (pathname === '/api/compression/stats' && req.method === 'GET') {
            try {
                const { getDataCompression } = require('./advanced');
                const compression = getDataCompression();
                const stats = compression.getStats();
                jsonResponse(res, { ok: true, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- API Documentation ---

        // GET /api/docs - Serve API docs HTML
        if ((pathname === '/api/docs' || pathname === '/api-docs') && req.method === 'GET') {
            try {
                const { getAPIDocumentation } = require('./advanced');
                const apiDocs = getAPIDocumentation({ baseUrl: `http://${req.headers.host}` });
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(apiDocs.generateHTML());
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/docs/openapi.json - OpenAPI spec
        if (pathname === '/api/docs/openapi.json' && req.method === 'GET') {
            try {
                const { getAPIDocumentation } = require('./advanced');
                const apiDocs = getAPIDocumentation({ baseUrl: `http://${req.headers.host}` });
                jsonResponse(res, apiDocs.generateOpenAPI());
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== END ADVANCED FEATURES ====================

        // ==================== ROLE MANAGEMENT ENDPOINTS ====================
        
        // GET /api/roles/templates - Get all role templates
        if (pathname === '/api/roles/templates' && req.method === 'GET') {
            try {
                const { getRoleTemplates } = require('./roles');
                const templates = getRoleTemplates();
                await templates.loadFromSupabase();
                jsonResponse(res, { ok: true, templates: templates.getAll(), categories: templates.getCategories() });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/templates/:id - Get a specific template
        if (pathname.match(/^\/api\/roles\/templates\/([^/]+)$/) && req.method === 'GET') {
            try {
                const templateId = pathname.match(/^\/api\/roles\/templates\/([^/]+)$/)[1];
                const { getRoleTemplates } = require('./roles');
                const templates = getRoleTemplates();
                await templates.loadFromSupabase();
                const template = templates.get(templateId);
                if (template) {
                    jsonResponse(res, { ok: true, template });
                } else {
                    jsonResponse(res, { ok: false, error: 'Template not found' }, 404);
                }
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/suggest - AI suggests role prompt
        if (pathname === '/api/roles/suggest' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getAIRoleSuggestions } = require('./roles');
                const suggestions = getAIRoleSuggestions({ storage, llmConfig: config.llm });
                suggestions.setStorage(storage);
                const result = await suggestions.suggestRolePrompt(body.currentRole);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/generate - Generate role prompt from title
        if (pathname === '/api/roles/generate' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getAIRoleSuggestions } = require('./roles');
                const suggestions = getAIRoleSuggestions({ llmConfig: config.llm });
                const result = await suggestions.generateFromTitle(body.title);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/dashboard - Get role-based dashboard
        if (pathname === '/api/roles/dashboard' && req.method === 'GET') {
            try {
                const { getRoleDashboard } = require('./roles');
                const dashboard = getRoleDashboard({ storage });
                dashboard.setStorage(storage);
                const project = storage.getCurrentProject();
                const result = dashboard.generateDashboard(project?.userRole, project?.userRolePrompt);
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/analytics/track - Track interaction
        if (pathname === '/api/roles/analytics/track' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getRoleAnalytics } = require('./roles');
                const analytics = getRoleAnalytics({ dataDir: config.dataDir });
                const project = storage.getCurrentProject();
                const entry = analytics.trackInteraction({
                    ...body,
                    userRole: project?.userRole || 'unknown'
                });
                jsonResponse(res, { ok: true, entry });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/analytics - Get role analytics
        if (pathname === '/api/roles/analytics' && req.method === 'GET') {
            try {
                const { getRoleAnalytics } = require('./roles');
                const analytics = getRoleAnalytics({ dataDir: config.dataDir });
                const project = storage.getCurrentProject();
                const result = analytics.getDashboard(project?.userRole || 'unknown');
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/notifications - Get smart notifications for role
        if (pathname === '/api/roles/notifications' && req.method === 'GET') {
            try {
                const { getSmartNotifications } = require('./roles');
                const notifications = getSmartNotifications({ dataDir: config.dataDir });
                const project = storage.getCurrentProject();
                const parsedUrl = parseUrl(req.url);
                const unreadOnly = parsedUrl.query.unread === 'true';
                const result = notifications.getNotificationsForRole(project?.userRole, { unreadOnly });
                const stats = notifications.getStats(project?.userRole);
                jsonResponse(res, { ok: true, notifications: result, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/notifications - Create notification
        if (pathname === '/api/roles/notifications' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getSmartNotifications } = require('./roles');
                const notifications = getSmartNotifications({ dataDir: config.dataDir });
                const result = notifications.createNotification(body);
                jsonResponse(res, { ok: true, notification: result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/notifications/read - Mark notifications as read
        if (pathname === '/api/roles/notifications/read' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getSmartNotifications } = require('./roles');
                const notifications = getSmartNotifications({ dataDir: config.dataDir });
                const count = notifications.markAsRead(body.ids || []);
                jsonResponse(res, { ok: true, markedRead: count });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/history - Get role change history
        if (pathname === '/api/roles/history' && req.method === 'GET') {
            try {
                const { getRoleHistory } = require('./roles');
                const history = getRoleHistory({ dataDir: config.dataDir });
                const changes = history.getChanges();
                const timeline = history.getTimeline();
                const insights = history.getInsights();
                jsonResponse(res, { ok: true, changes, timeline, insights });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/perspective - Switch perspective temporarily
        if (pathname === '/api/roles/perspective' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getQuickRoleSwitch, getRoleHistory } = require('./roles');
                const history = getRoleHistory({ dataDir: config.dataDir });
                const quickSwitch = getQuickRoleSwitch({ storage, history });
                quickSwitch.setStorage(storage);
                const session = quickSwitch.switchPerspective('default_user', body.role, { reason: body.reason });
                jsonResponse(res, { ok: true, session });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/perspective - Get current perspective
        if (pathname === '/api/roles/perspective' && req.method === 'GET') {
            try {
                const { getQuickRoleSwitch, getRoleHistory } = require('./roles');
                const history = getRoleHistory({ dataDir: config.dataDir });
                const quickSwitch = getQuickRoleSwitch({ storage, history });
                quickSwitch.setStorage(storage);
                const effective = quickSwitch.getEffectiveRole('default_user');
                const available = quickSwitch.getAvailablePerspectives(effective.role);
                jsonResponse(res, { ok: true, effective, availablePerspectives: available });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // DELETE /api/roles/perspective - End perspective session
        if (pathname === '/api/roles/perspective' && req.method === 'DELETE') {
            try {
                const { getQuickRoleSwitch, getRoleHistory } = require('./roles');
                const history = getRoleHistory({ dataDir: config.dataDir });
                const quickSwitch = getQuickRoleSwitch({ storage, history });
                const result = quickSwitch.endPerspective('default_user');
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/filtered-knowledge - Get role-filtered knowledge
        if (pathname === '/api/roles/filtered-knowledge' && req.method === 'GET') {
            try {
                const { getRoleFilters } = require('./roles');
                const filters = getRoleFilters({ storage });
                filters.setStorage(storage);
                const project = storage.getCurrentProject();
                const result = filters.getFilteredKnowledge(project?.userRole, project?.userRolePrompt);
                const summary = filters.getRelevanceSummary(project?.userRole, project?.userRolePrompt);
                jsonResponse(res, { ok: true, knowledge: result, summary });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/users - Get collaborative users
        if (pathname === '/api/roles/users' && req.method === 'GET') {
            try {
                const { getCollaborativeRoles } = require('./roles');
                const collaborative = getCollaborativeRoles({ dataDir: config.dataDir });
                const users = collaborative.getUsers();
                const stats = collaborative.getStats();
                jsonResponse(res, { ok: true, users, stats });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/users - Add user
        if (pathname === '/api/roles/users' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getCollaborativeRoles } = require('./roles');
                const collaborative = getCollaborativeRoles({ dataDir: config.dataDir });
                const result = collaborative.addUser(body);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/calendar - Get calendar events
        if (pathname === '/api/roles/calendar' && req.method === 'GET') {
            try {
                const { getCalendarIntegration } = require('./roles');
                const calendar = getCalendarIntegration({ dataDir: config.dataDir });
                const parsedUrl = parseUrl(req.url);
                const days = parseInt(parsedUrl.query.days) || 7;
                const events = calendar.getUpcomingEvents(days);
                const today = calendar.getTodayEvents();
                const stats = calendar.getStats();
                const project = storage.getCurrentProject();
                const context = calendar.getContextForBriefing(project?.userRole, project?.userRolePrompt);
                jsonResponse(res, { ok: true, events, today, stats, briefingContext: context });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/calendar - Add calendar event
        if (pathname === '/api/roles/calendar' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getCalendarIntegration } = require('./roles');
                const calendar = getCalendarIntegration({ dataDir: config.dataDir });
                const result = calendar.addEvent(body);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/calendar/import - Import iCal
        if (pathname === '/api/roles/calendar/import' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getCalendarIntegration } = require('./roles');
                const calendar = getCalendarIntegration({ dataDir: config.dataDir });
                const result = calendar.importFromICal(body.icalData);
                jsonResponse(res, { ok: result.success, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/onboarding - Get onboarding data
        if (pathname === '/api/roles/onboarding' && req.method === 'GET') {
            try {
                const { getRoleOnboarding } = require('./roles');
                const onboarding = getRoleOnboarding();
                const project = storage.getCurrentProject();
                const steps = onboarding.getSteps();
                const quickSetup = onboarding.getQuickSetupOptions();
                const tips = onboarding.getRoleTips();
                const isNeeded = onboarding.isOnboardingNeeded(project);
                jsonResponse(res, { ok: true, steps, quickSetup, tips, isNeeded });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/roles/onboarding/complete - Complete onboarding
        if (pathname === '/api/roles/onboarding/complete' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getRoleOnboarding, getRoleHistory } = require('./roles');
                const onboarding = getRoleOnboarding();
                const history = getRoleHistory({ dataDir: config.dataDir });
                
                const result = onboarding.processOnboarding(body);
                
                // Update project with new role
                const project = storage.getCurrentProject();
                if (project) {
                    const oldRole = project.userRole;
                    await storage.updateProject(project.id, {
                        userRole: result.userRole,
                        userRolePrompt: result.userRolePrompt
                    });
                    
                    // Record in history
                    history.recordChange({
                        previousRole: oldRole,
                        newRole: result.userRole,
                        newRolePrompt: result.userRolePrompt,
                        reason: 'Onboarding completed',
                        projectId: project.id
                    });
                }
                
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/export - Generate role-specific report
        if (pathname === '/api/roles/export' && req.method === 'GET') {
            try {
                const { getRoleExport, getRoleFilters, getRoleDashboard } = require('./roles');
                const filters = getRoleFilters({ storage });
                const dashboard = getRoleDashboard({ storage });
                const roleExport = getRoleExport({ storage, filters, dashboard });
                
                filters.setStorage(storage);
                dashboard.setStorage(storage);
                roleExport.setStorage(storage);
                
                const project = storage.getCurrentProject();
                const parsedUrl = parseUrl(req.url);
                const format = parsedUrl.query.format || 'markdown';
                
                const result = roleExport.generateReport(
                    project?.userRole,
                    project?.userRolePrompt,
                    { format, includeAll: parsedUrl.query.includeAll === 'true' }
                );
                
                if (format === 'json') {
                    jsonResponse(res, { ok: true, ...result });
                } else {
                    res.writeHead(200, { 
                        'Content-Type': format === 'html' ? 'text/html' : 'text/plain',
                        'Content-Disposition': `attachment; filename="role-report.${format === 'markdown' ? 'md' : format}"`
                    });
                    res.end(result.content);
                }
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/roles/export/executive - Generate executive summary
        if (pathname === '/api/roles/export/executive' && req.method === 'GET') {
            try {
                const { getRoleExport, getRoleFilters, getRoleDashboard } = require('./roles');
                const filters = getRoleFilters({ storage });
                const dashboard = getRoleDashboard({ storage });
                const roleExport = getRoleExport({ storage, filters, dashboard });
                
                filters.setStorage(storage);
                dashboard.setStorage(storage);
                roleExport.setStorage(storage);
                
                const project = storage.getCurrentProject();
                const result = roleExport.generateExecutiveSummary(project?.userRole, project?.userRolePrompt);
                
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== END ROLE MANAGEMENT ====================

        // POST /api/optimizations/context/optimize - Optimize context for LLM
        if (pathname === '/api/optimizations/context/optimize' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const { getContextOptimizer } = require('./optimizations');
                const optimizer = getContextOptimizer({ llmConfig: config.llm });
                const result = await optimizer.optimize(body.contexts, { 
                    query: body.query,
                    maxTokens: body.maxTokens 
                });
                jsonResponse(res, { ok: true, ...result });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // ==================== END OPTIMIZATION ENDPOINTS ====================

        // POST /api/graph/query - Execute raw Cypher query
        if (pathname === '/api/graph/query' && req.method === 'POST') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider) {
                jsonResponse(res, { ok: false, error: 'Graph not connected' });
                return;
            }

            const body = await parseBody(req);
            const cypher = body.query || body.cypher;
            
            if (!cypher) {
                jsonResponse(res, { ok: false, error: 'Query is required' }, 400);
                return;
            }
            
            try {
                const result = await graphProvider.query(cypher);
                
                if (!result.ok) {
                    jsonResponse(res, { ok: false, error: result.error });
                    return;
                }
                
                // Parse nodes and edges from result
                // FalkorDB returns { ok, results: [...], metadata }
                const nodes = [];
                const edges = [];
                const nodeIds = new Set();
                
                const rawData = result.results || [];
                
                for (const row of rawData) {
                    for (const key of Object.keys(row)) {
                        const val = row[key];
                        if (val && typeof val === 'object') {
                            // Check if it's a FalkorDB Node
                            if (val.labels || val._labels || val.label) {
                                // It's a node
                                const labels = val.labels || val._labels || [val.label];
                                const props = val.properties || val._properties || val;
                                const nodeId = props.id || val.id || val.entityId || `node_${nodes.length}`;
                                
                                if (!nodeIds.has(nodeId)) {
                                    nodeIds.add(nodeId);
                                    nodes.push({
                                        id: nodeId,
                                        label: (Array.isArray(labels) ? labels[0] : labels) || 'Node',
                                        name: props.name || '',
                                        properties: props
                                    });
                                }
                            } else if (val.type || val.relationshipType || val._type) {
                                // It's a relationship
                                edges.push({
                                    from: val.srcNode || val._srcNode,
                                    to: val.destNode || val._destNode,
                                    type: val.type || val.relationshipType || val._type,
                                    properties: val.properties || val._properties || {}
                                });
                            }
                        }
                    }
                }
                
                jsonResponse(res, { 
                    ok: true, 
                    nodes, 
                    edges,
                    rawData,
                    metadata: result.metadata
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/graph/nodes - Get nodes from graph
        if (pathname === '/api/graph/nodes' && req.method === 'GET') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                // Return empty nodes instead of error when graph not connected
                jsonResponse(res, { ok: true, nodes: [], results: [] });
                return;
            }

            try {
                const parsedUrl = parseUrl(req.url);
                const label = parsedUrl.query.label;
                const limit = parseInt(parsedUrl.query.limit) || 100;
                
                const result = await graphProvider.findNodes(label, {}, { limit });
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: true, nodes: [], results: [], error: error.message });
            }
            return;
        }

        // GET /api/graph/relationships - Get relationships from graph
        if (pathname === '/api/graph/relationships' && req.method === 'GET') {
            const graphProvider = storage.getGraphProvider();
            if (!graphProvider || !graphProvider.connected) {
                // Return empty relationships instead of error when graph not connected
                jsonResponse(res, { ok: true, relationships: [], results: [] });
                return;
            }

            try {
                const parsedUrl = parseUrl(req.url);
                const type = parsedUrl.query.type;
                const limit = parseInt(parsedUrl.query.limit) || 100;
                
                const result = await graphProvider.findRelationships({ type }, { limit });
                jsonResponse(res, result);
            } catch (error) {
                jsonResponse(res, { ok: true, relationships: [], results: [], error: error.message });
            }
            return;
        }

        // ============================================
        // TEAM ANALYSIS ENDPOINTS
        // ============================================

        // GET /api/team-analysis/profiles - List all behavioral profiles for a project
        if (pathname === '/api/team-analysis/profiles' && req.method === 'GET') {
            try {
                const { getTeamAnalyzer } = require('./team-analysis');
                const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
                const projectId = storage.getCurrentProject()?.id;
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const profiles = await teamAnalyzer.getProfiles(projectId);
                jsonResponse(res, { ok: true, profiles });
            } catch (error) {
                console.error('[TeamAnalysis] Error fetching profiles:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/team-analysis/profiles/:personId - Get a specific person's profile
        const profileMatch = pathname.match(/^\/api\/team-analysis\/profiles\/([^\/]+)$/);
        if (profileMatch && req.method === 'GET') {
            try {
                const { getTeamAnalyzer } = require('./team-analysis');
                const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
                const projectId = storage.getCurrentProject()?.id;
                const personId = profileMatch[1];
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const profile = await teamAnalyzer.getProfile(projectId, personId);
                if (!profile) {
                    jsonResponse(res, { error: 'Profile not found' }, 404);
                    return;
                }
                jsonResponse(res, { ok: true, profile });
            } catch (error) {
                console.error('[TeamAnalysis] Error fetching profile:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/team-analysis/profiles/:personId/analyze - Trigger analysis for a person
        const analyzeMatch = pathname.match(/^\/api\/team-analysis\/profiles\/([^\/]+)\/analyze$/);
        if (analyzeMatch && req.method === 'POST') {
            try {
                const { getTeamAnalyzer } = require('./team-analysis');
                const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
                const projectId = storage.getCurrentProject()?.id;
                const personId = analyzeMatch[1];
                const body = await parseBody(req);
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const profile = await teamAnalyzer.analyzePersonProfile(projectId, personId, {
                    relationshipContext: body.relationshipContext || 'colleague',
                    objective: body.objective || 'development of partnership',
                    forceReanalysis: body.forceReanalysis || false
                });
                
                jsonResponse(res, { ok: true, profile });
            } catch (error) {
                console.error('[TeamAnalysis] Error analyzing profile:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/team-analysis/team - Get team dynamics analysis
        if (pathname === '/api/team-analysis/team' && req.method === 'GET') {
            try {
                const { getTeamAnalyzer } = require('./team-analysis');
                const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
                const projectId = storage.getCurrentProject()?.id;
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const analysis = await teamAnalyzer.getTeamAnalysis(projectId);
                jsonResponse(res, { ok: true, analysis });
            } catch (error) {
                console.error('[TeamAnalysis] Error fetching team analysis:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/team-analysis/team/analyze - Trigger team dynamics analysis
        if (pathname === '/api/team-analysis/team/analyze' && req.method === 'POST') {
            try {
                const { getTeamAnalyzer } = require('./team-analysis');
                const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
                const projectId = storage.getCurrentProject()?.id;
                const body = await parseBody(req);
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const analysis = await teamAnalyzer.analyzeTeamDynamics(projectId, {
                    forceReanalysis: body.forceReanalysis || false
                });
                
                jsonResponse(res, { ok: true, analysis });
            } catch (error) {
                console.error('[TeamAnalysis] Error analyzing team:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/team-analysis/relationships - Get behavioral relationships
        if (pathname === '/api/team-analysis/relationships' && req.method === 'GET') {
            try {
                const { getTeamAnalyzer } = require('./team-analysis');
                const teamAnalyzer = getTeamAnalyzer({ supabase: storage.supabase, config });
                const projectId = storage.getCurrentProject()?.id;
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const relationships = await teamAnalyzer.getBehavioralRelationships(projectId);
                jsonResponse(res, { ok: true, relationships });
            } catch (error) {
                console.error('[TeamAnalysis] Error fetching relationships:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/team-analysis/graph - Get visualization data for team analysis
        if (pathname === '/api/team-analysis/graph' && req.method === 'GET') {
            try {
                const { getGraphSync } = require('./team-analysis');
                const graphSync = getGraphSync({ supabase: storage.supabase });
                const projectId = storage.getCurrentProject()?.id;
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const graphData = await graphSync.getVisualizationData(projectId);
                jsonResponse(res, { ok: true, ...graphData });
            } catch (error) {
                console.error('[TeamAnalysis] Error fetching graph data:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // POST /api/team-analysis/sync-graph - Sync team analysis to graph database
        if (pathname === '/api/team-analysis/sync-graph' && req.method === 'POST') {
            try {
                const { getGraphSync } = require('./team-analysis');
                const graphSync = getGraphSync({ supabase: storage.supabase });
                const projectId = storage.getCurrentProject()?.id;
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                await graphSync.fullSync(projectId);
                jsonResponse(res, { ok: true, message: 'Team analysis synced to graph' });
            } catch (error) {
                console.error('[TeamAnalysis] Error syncing to graph:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/team-analysis/query - Execute a team analysis query
        if (pathname === '/api/team-analysis/query' && req.method === 'GET') {
            try {
                const { getGraphSync } = require('./team-analysis');
                const graphSync = getGraphSync({ supabase: storage.supabase });
                const projectId = storage.getCurrentProject()?.id;
                const parsedUrl = parseUrl(req.url);
                const queryType = parsedUrl.query.type;
                const personId = parsedUrl.query.personId;
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                if (!queryType) {
                    jsonResponse(res, { error: 'Query type required (influence_map, power_centers, alliances, tensions, person_network, team_cohesion)' }, 400);
                    return;
                }

                const results = await graphSync.executeQuery(queryType, { projectId, personId });
                jsonResponse(res, { ok: true, queryType, results });
            } catch (error) {
                console.error('[TeamAnalysis] Error executing query:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/team-analysis/config - Get team analysis access configuration
        if (pathname === '/api/team-analysis/config' && req.method === 'GET') {
            try {
                const projectId = storage.getCurrentProject()?.id;
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const { data: project } = await storage.supabase
                    .from('projects')
                    .select('team_analysis_access, team_analysis_enabled')
                    .eq('id', projectId)
                    .single();

                jsonResponse(res, { 
                    ok: true, 
                    config: {
                        enabled: project?.team_analysis_enabled ?? true,
                        access: project?.team_analysis_access ?? 'admin_only'
                    }
                });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // PUT /api/team-analysis/config - Update team analysis access configuration
        if (pathname === '/api/team-analysis/config' && req.method === 'PUT') {
            try {
                const projectId = storage.getCurrentProject()?.id;
                const body = await parseBody(req);
                
                if (!projectId) {
                    jsonResponse(res, { error: 'No project selected' }, 400);
                    return;
                }

                const updates = {};
                if (body.enabled !== undefined) updates.team_analysis_enabled = body.enabled;
                if (body.access !== undefined) updates.team_analysis_access = body.access;

                const { error } = await storage.supabase
                    .from('projects')
                    .update(updates)
                    .eq('id', projectId);

                if (error) throw error;
                jsonResponse(res, { ok: true, message: 'Configuration updated' });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // 404 for unknown API routes
        jsonResponse(res, { error: 'Not found' }, 404);

    } catch (error) {
        console.error('API Error:', error);
        jsonResponse(res, { error: error.message }, 500);
    }
}

// Request handler
const server = http.createServer(async (req, res) => {
    const parsedUrl = parseUrl(req.url);
    let pathname = parsedUrl.pathname;

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

    // Static files
    if (pathname === '/') {
        pathname = '/index.html';
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

// Start server
server.listen(PORT, async () => {
    const currentProject = storage.getCurrentProject();
    const projectName = (currentProject?.name) || 'No project';
    console.log(`
╔════════════════════════════════════════════════════════════╗
║       GodMode by Paulo Dias - Ready                        ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║  Active project:    ${projectName.substring(0, 40).padEnd(40)}║
║                                                            ║
║  Drop files in:                                            ║
║    - data/newinfo/        (documents)                      ║
║    - data/newtranscripts/ (meeting transcripts)            ║
║                                                            ║
║  Configure Ollama in Settings to start processing.         ║
╚════════════════════════════════════════════════════════════╝
`);

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
            
            console.log(`[Graph] Auto-connecting to FalkorDB (graph: ${projectGraphName})...`);
            const result = await storage.initGraph(graphConfig);
            
            if (result.ok) {
                console.log(`[Graph] ✓ Connected to FalkorDB (${projectGraphName})`);
            } else {
                console.log(`[Graph] ✗ Auto-connect failed: ${result.error}`);
            }
        } catch (e) {
            console.log(`[Graph] Auto-connect error: ${e.message}`);
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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    storage.close();
    server.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    storage.close();
    server.close();
    process.exit(0);
});
