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
//Moved to utilities
//Moved to utilities

// ==================== EXTRACTED MODULES ====================
// These utilities have been modularized for maintainability
const { parseUrl, parseBody, parseMultipart } = require('./server/request');
const { jsonResponse, getMimeType } = require('./server/response');
const { UUID_REGEX, isValidUUID, sanitizeFilename, isPathWithinDirectory } = require('./server/security');
const { MIME_TYPES, serveStatic, generateFileIconSVG } = require('./server/static');
const staticUtilsModule = require('./server/static'); // For getDocumentSOTAPath and ensureDocumentSOTADir which need DATA_DIR binding
const { rateLimitStore, checkRateLimit, getRateLimitKey, rateLimitResponse, startRateLimitCleanup, getCookieSecurityFlags, getClientIp } = require('./server/middleware');

// Security helpers moved to ./server/security.js

// Rate limiting moved to ./server/middleware.js
// Start rate limit cleanup interval
startRateLimitCleanup();

// Modules
const OllamaClient = require('./ollama');
// Use StorageCompat for gradual migration to Supabase
// Falls back to local JSON if Supabase is not configured
const { createSyncCompatStorage } = require('./storageCompat');
const { loadConfig, saveConfig } = require('./config');
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
// Moved to utilities
// Moved to utilities

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
const loadConfig = () =>  //Moved to src/config.js
  migrateLLMConfig({ ...DEFAULT_CONFIG, dataDir: path.join(DATA_DIR, 'projects', 'default') });
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

const saveConfig = (config) => //Moved to src/config.js
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

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

// Cookie security helper moved to ./server/middleware.js

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
        console.warn('[Auth] Failed to get current user:', err.message);
        return null;
    }
}

// getMimeType moved to ./server/response.js

// Feature modules
const { handleAuth } = require('./features/auth/routes');
const { handleProfile } = require('./features/profile/routes');
const { handleProjectMembers } = require('./features/projects/routes');
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
const { handleActivity } = require('./features/activity/routes');
const { handleComments } = require('./features/comments/routes');
const { handleApiKeys } = require('./features/apikeys/routes');
const { handleWebhooks } = require('./features/webhooks/routes');
const { handleAudit } = require('./features/audit/routes');
const { handleProjectsManagement } = require('./features/projectsManagement/routes');
const { handleProjectLegacy } = require('./features/projects/legacy-routes');
const { handleUser } = require('./features/user/routes');
const { handleSync } = require('./features/sync/routes');
const { handleSecrets } = require('./features/adminSecrets/routes');
const { handleSystemConfig } = require('./features/systemConfig/routes');
const { handleSystemPrompts } = require('./features/systemPrompts/routes');
const { handleProjectsCore } = require('./features/projectsCore/routes');
const { handleGoogleDrive } = require('./features/googleDrive/routes');

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

    // Parse URL once for all feature handlers
    const parsedUrl = parseUrl(req.url);

    try {
        // ==================== Auth Routes (extracted to features/auth/routes.js) ====================
        if (await handleAuth({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Profile Routes (extracted to features/profile/routes.js) ====================
        if (await handleProfile({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Project Members Routes (extracted to features/projects/routes.js) ====================
        if (await handleProjectMembers({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Google Drive (Project) Routes (extracted to features/googleDrive/routes.js) ====================
        if (await handleGoogleDrive({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Krisp Webhook (public - no auth) ====================
        if (await handleKrispWebhook({ req, res, pathname })) return;

        // ==================== Krisp API Routes (extracted to features/krisp/routes.js) ====================
        if (await handleKrispApi({ req, res, pathname, parsedUrl, supabase, config })) return;

        // ==================== LLM & Ollama Routes (extracted to features/llm/routes.js) ====================
        if (await handleLlm({ req, res, pathname, config, saveConfig, llm, ollama, supabase })) return;

        // ==================== Knowledge Routes (extracted to features/knowledge/routes.js) ====================
        if (await handleKnowledge({ req, res, pathname, storage, config, llm, llmConfig })) return;

        // ==================== Notifications Routes (extracted to features/notifications/routes.js) ====================
        if (await handleNotifications({ req, res, pathname, supabase })) return;

        // ==================== Search Routes (extracted to features/search/routes.js) ====================
        if (await handleSearch({ req, res, pathname, supabase })) return;

        // ==================== Cost Tracking Routes (extracted to features/costs/routes.js) ====================
        if (await handleCosts({ req, res, pathname, storage, llm })) return;

        // ==================== Contacts Routes (extracted to features/contacts/routes.js) ====================
        if (await handleContacts({ req, res, pathname, storage, llm })) return;

        // ==================== Teams Routes (extracted to features/teams/routes.js) ====================
        if (await handleTeams({ req, res, pathname, storage })) return;

        // ==================== Documents Routes (extracted to features/documents/routes.js) ====================
        if (await handleDocuments({ req, res, pathname, storage, processor, invalidateBriefingCache, getCurrentUserId, PORT })) return;

        // Krisp Webhook routes removed - now handled by handleKrispWebhook() above

        // Auth routes removed - now handled by handleAuth() above

        // ==================== Timezones API (extracted to features/timezones/routes.js) ====================
        if (await handleTimezones({ req, res, pathname, supabase })) return;
        
        // Profile routes removed - now handled by handleProfile() above

        // Project Members API removed - now handled by handleProjectMembers() above

        // ==================== Invites API (extracted to features/invites/routes.js) ====================
        if (await handleInvites({ req, res, pathname, parsedUrl, supabase, emailService })) return;

// ==================== Activity Log API (extracted to features/activity/routes.js) ====================
        if (await handleActivity({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Comments API (extracted to features/comments/routes.js) ====================
        if (await handleComments({ req, res, pathname, parsedUrl, supabase })) return;

// ==================== API Keys API (extracted to features/apikeys/routes.js) ====================
        if (await handleApiKeys({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Webhooks API (extracted to features/webhooks/routes.js) ====================
        if (await handleWebhooks({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Audit Export API (extracted to features/audit/routes.js) ====================
        if (await handleAudit({ req, res, pathname, parsedUrl, supabase })) return;

        // ==================== Projects Management API (extracted to features/projectsManagement/routes.js) ====================
        if (await handleProjectsManagement({ req, res, pathname, supabase })) return;

        // ==================== Legacy project-scoped endpoints (tests + older frontend) ====================
        if (await handleProjectLegacy({ req, res, pathname, supabase })) return;

        // ==================== User API (extracted to features/user/routes.js) ====================
        if (await handleUser({ req, res, pathname, supabase })) return;

        // ==================== Graph Sync API (extracted to features/sync/routes.js) ====================
        if (await handleSync({ req, res, pathname, supabase })) return;

        // ==================== Config Routes (extracted to features/config/routes.js) ====================
        if (await handleConfig({ req, res, pathname, config, saveConfig, processor, ollama, llm, getLLMConfigForFrontend })) return;

        // Config routes moved to features/config/routes.js - handleConfig()


        // ==================== Secrets API (Admin) (extracted to features/secrets/routes.js) ====================
        if (await handleSecrets({ req, res, pathname, supabase })) return;

        // ==================== System Config API (Admin) (extracted to features/systemConfig/routes.js) ====================
        if (await handleSystemConfig({ req, res, pathname, supabase, config, saveConfig })) return;

        // ==================== System Prompts API (extracted to features/systemPrompts/routes.js) ====================
        if (await handleSystemPrompts({ req, res, pathname, supabase })) return;

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

        // ==================== Project Management API (extracted to features/projectsCore/routes.js) ====================
        if (await handleProjectsCore({
            req,
            res,
            pathname,
            supabase,
            storage,
            processor,
            invalidateBriefingCache,
            config,
            saveConfig,
            fs,
            path,
            parseUrl,
            parseBody,
            parseMultipart,
            jsonResponse,
        })) return;

        // LLM routes removed - now handled by handleLlm() above


        // GET /api/files - Get pending files (project-scoped)
        if (pathname === '/api/files' && req.method === 'GET') {
            // Historically this endpoint was backed by a single global dataDir.
            // After multi-project refactors, we must scope it by X-Project-Id to avoid cross-project bleed.
            const headerPid = req.headers['x-project-id'];
            const projectId = typeof headerPid === 'string' ? headerPid : null;
            const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                ? storage._supabase.forProject(projectId)
                : storage;

            const projectDataDir = s.getProjectDataDir();
            const result = { newinfo: [], newtranscripts: [] };

            function listFolder(folderName) {
                const folderPath = path.join(projectDataDir, folderName);
                if (!fs.existsSync(folderPath)) return [];
                return fs.readdirSync(folderPath)
                    .filter(f => !f.endsWith('.meta.json'))
                    .map(f => {
                        const fp = path.join(folderPath, f);
                        let stat;
                        try { stat = fs.statSync(fp); } catch { return null; }
                        if (!stat || !stat.isFile()) return null;
                        return {
                            filename: f,
                            size: stat.size,
                            mtime: stat.mtime,
                            path: fp,
                            folder: folderName
                        };
                    })
                    .filter(Boolean);
            }

            result.newinfo = listFolder('newinfo');
            result.newtranscripts = listFolder('newtranscripts');

            jsonResponse(res, result);
            return;
        }

        // DELETE /api/files/:folder/:filename - Remove file from pending queue (project-scoped)
        const deleteFileMatch = pathname.match(/^\/api\/files\/(newinfo|newtranscripts)\/(.+)$/);
        if (deleteFileMatch && req.method === 'DELETE') {
            const folder = deleteFileMatch[1];
            const filename = decodeURIComponent(deleteFileMatch[2]);

            const headerPid = req.headers['x-project-id'];
            const projectId = typeof headerPid === 'string' ? headerPid : null;
            const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                ? storage._supabase.forProject(projectId)
                : storage;

            const projectDataDir = s.getProjectDataDir();
            const filePath = path.join(projectDataDir, folder, filename);

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    // Also remove associated metadata if present
                    const metaPath = filePath + '.meta.json';
                    if (fs.existsSync(metaPath)) {
                        try { fs.unlinkSync(metaPath); } catch {}
                    }
                    console.log(`Deleted pending file: ${folder}/${filename} (project=${projectId || 'default'})`);
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
            
            // Use request-scoped project directory (avoid cross-project leakage)
            const headerPid = req.headers['x-project-id'];
            const projectId = typeof headerPid === 'string' ? headerPid : null;
            const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                ? storage._supabase.forProject(projectId)
                : storage;
            const projectDataDir = s.getProjectDataDir();
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
                
                // In Supabase mode, create a documents row so the Files panel can show it immediately.
                // For text-like files we also store raw content for preview/extraction.
                // If Google Drive is enabled for the project, we also upload the file and store filepath as gdrive:<fileId>.
                if (s._supabase) {
                    try {
                        const ext = path.extname(safeName).toLowerCase().replace('.', '');
                        const isTextLike = ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'rtf'].includes(ext);

                        const docType = emailId
                            ? 'email_attachment'
                            : (folderType === 'newtranscripts' ? 'transcript' : 'document');

                        let docPathForDb = filePath;

                        // Google Drive upload (best-effort)
                        try {
                            if (projectId) {
                                const { data: projectRow } = await s._supabase.supabase
                                    .from('projects')
                                    .select('settings')
                                    .eq('id', projectId)
                                    .single();

                                const gdrive = projectRow?.settings?.googleDrive;
                                const folderMap = gdrive?.folders || {};
                                const driveFolderId = folderType === 'newtranscripts' ? folderMap.newtranscripts : folderMap.uploads;

                                if (gdrive?.projectFolderId && driveFolderId) {
                                    const driveIntegration = require('./integrations/googleDrive/drive');
                                    const driveClient = await driveIntegration.getDriveClientForSystem();
                                    if (driveClient.success) {
                                        const mimeType = getMimeType(safeName) || 'application/octet-stream';
                                        const uploaded = await driveIntegration.uploadFile({
                                            drive: driveClient.drive,
                                            name: safeName,
                                            parentId: driveFolderId,
                                            buffer: file.data,
                                            mimeType
                                        });

                                        if (uploaded.success && uploaded.file?.id) {
                                            docPathForDb = `gdrive:${uploaded.file.id}`;
                                            console.log('[Upload] Uploaded to Google Drive:', safeName, '->', uploaded.file.id);
                                        }
                                    }
                                }
                            }
                        } catch (driveErr) {
                            console.warn('[Upload] Google Drive upload failed (fallback to local):', driveErr.message);
                        }

                        const docResult = await s._supabase.addDocument({
                            filename: safeName,
                            path: docPathForDb,
                            type: ext,
                            size: file.data.length,
                            status: 'pending',
                            doc_type: docType,
                            content: isTextLike ? file.data.toString('utf8') : null
                        });

                        // If this is an email attachment, link to email
                        if (emailId && docResult?.id) {
                            await s._supabase.addEmailAttachment(emailId, docResult.id, {
                                filename: safeName,
                                size: file.data.length,
                                content_type: getMimeType(safeName)
                            });
                            console.log('[Upload] Email attachment linked:', safeName, '-> email:', emailId);
                        }
                    } catch (e) {
                        console.error('[Upload] Failed to create document record:', e.message);
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

        // Document processing stream moved to features/documents/routes.js - handleDocuments()


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

        // Contacts Directory routes
        // Handled by features/contacts/routes.js - handleContacts()

        // ==================== Email Processing API ====================
        
        const emailParser = require('./emailParser');

        // GET /api/emails - List emails for current project (request-scoped project)
        if (pathname === '/api/emails' && req.method === 'GET') {
            try {
                const emailUrl = new URL(req.url, `http://${req.headers.host}`);
                const requiresResponse = emailUrl.searchParams.get('requires_response');
                const direction = emailUrl.searchParams.get('direction');
                const limit = parseInt(emailUrl.searchParams.get('limit') || '50');

                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;

                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;

                const emails = await s.getEmails({
                    requiresResponse: requiresResponse === 'true' ? true : (requiresResponse === 'false' ? false : undefined),
                    direction: direction || undefined,
                    limit
                });

                jsonResponse(res, { ok: true, emails, count: (emails || []).length });
            } catch (error) {
                console.error('[API] Error fetching emails:', error);
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // GET /api/emails/:id - Get single email (request-scoped project)
        const emailGetMatch = pathname.match(/^\/api\/emails\/([a-f0-9\-]+)$/);
        if (emailGetMatch && req.method === 'GET') {
            const emailId = emailGetMatch[1];
            try {
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;

                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;

                const email = await s.getEmail(emailId);
                if (!email) {
                    jsonResponse(res, { ok: false, error: 'Email not found' }, 404);
                    return;
                }
                const recipients = await s.getEmailRecipients(emailId);
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
        // Teams routes moved to features/teams/routes.js - handleTeams()


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
        // Remaining Teams routes moved to features/teams/routes.js


        // Cost tracking routes
        // Handled by features/costs/routes.js - handleCosts()

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

        // GET /api/dashboard - Get enhanced dashboard stats (request-scoped project)
        if (pathname === '/api/dashboard' && req.method === 'GET') {
            const headerPid = req.headers['x-project-id'];
            const projectId = typeof headerPid === 'string' ? headerPid : null;
            const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                ? storage._supabase.forProject(projectId)
                : storage;

            const stats = s.getStats();

            // Get questions by priority
            const allQuestions = await (s.getQuestions ? s.getQuestions({}) : []);
            const questionsByPriority = {
                critical: allQuestions.filter(q => q.priority === 'critical' && q.status === 'pending').length,
                high: allQuestions.filter(q => q.priority === 'high' && q.status === 'pending').length,
                medium: allQuestions.filter(q => q.priority === 'medium' && q.status === 'pending').length,
                resolved: allQuestions.filter(q => q.status === 'resolved').length
            };

            // Get risks by impact
            const allRisks = s.getRisks ? await s.getRisks() : [];
            const risksByImpact = {
                high: allRisks.filter(r => (r.impact || '').toLowerCase() === 'high' && r.status === 'open').length,
                medium: allRisks.filter(r => (r.impact || '').toLowerCase() === 'medium' && r.status === 'open').length,
                low: allRisks.filter(r => (r.impact || '').toLowerCase() === 'low' && r.status === 'open').length
            };

            // Get all actions and people
            const allActions = (s.getActionItems ? await s.getActionItems() : (s.getActions ? await s.getActions() : [])) || [];
            const allPeople = s.getPeople ? await s.getPeople() : [];

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
            const allFacts = s.getFacts ? await s.getFacts() : [];
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
            const trends = s.getTrends ? s.getTrends(7) : {};
            const trendInsights = s.getTrendInsights ? s.getTrendInsights() : {};

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

        // Knowledge routes (questions, facts, decisions, risks, actions, people)
        // Handled by features/knowledge/routes.js - handleKnowledge()


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
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;
                const sotEngine = new SourceOfTruthEngine(s);
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
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;
                const sotEngine = new SourceOfTruthEngine(s);
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
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;
                const sotEngine = new SourceOfTruthEngine(s);
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
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;
                const sotEngine = new SourceOfTruthEngine(s);
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
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;
                const sotEngine = new SourceOfTruthEngine(s);
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
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;
                const sotEngine = new SourceOfTruthEngine(s);
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

        // GET /api/history - Get processing history (request-scoped project)
        if (pathname === '/api/history' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const limit = Math.min(parseInt(parsedUrl.query.limit) || 50, 200);

                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;

                if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
                    const sb = storage._supabase.forProject(projectId);
                    const history = await sb.getProcessingHistory(null, limit);

                    // Map to format expected by frontend (same as StorageCompat.getHistory)
                    const mapped = (history || []).map(h => {
                        const details = h.details || {};
                        const docTitle = h.documents?.title || h.documents?.filename || details.title || details.filename || null;
                        return {
                            timestamp: h.created_at,
                            action: h.action,
                            filename: docTitle,
                            files_processed: details.files_count || 1,
                            facts_extracted: details.facts_extracted || details.facts || 0,
                            questions_added: details.questions_added || details.questions || 0,
                            decisions_added: details.decisions_added || details.decisions || 0,
                            risks_added: details.risks_added || details.risks || 0,
                            actions_added: details.actions_added || details.actions || 0,
                            people_added: details.people_added || details.people || 0,
                            document_id: h.document_id,
                            status: h.status,
                            model_used: h.model_used || details.model || null,
                            tokens_used: h.tokens_used || details.tokens || null,
                            duration_ms: h.duration_ms || details.duration_ms || null
                        };
                    });

                    jsonResponse(res, { history: mapped });
                    return;
                }

                const history = await storage.getHistory(limit);
                jsonResponse(res, { history: history || [] });
            } catch (e) {
                jsonResponse(res, { history: [], error: e.message }, 500);
            }
            return;
        }

        // GET /api/search - Keyword search across project data (request-scoped project)
        if (pathname === '/api/search' && req.method === 'GET') {
            try {
                const parsedUrl = parseUrl(req.url);
                const query = String(parsedUrl.query.q || '').trim();
                const types = parsedUrl.query.types ? String(parsedUrl.query.types).split(',') : null;
                const limit = Math.min(parseInt(parsedUrl.query.limit) || 50, 200);

                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;

                // Supabase mode: do request-scoped fetch + in-memory filter (safe, simple)
                if (storage._supabase && projectId && typeof storage._supabase.forProject === 'function') {
                    const sb = storage._supabase.forProject(projectId);
                    const term = query.toLowerCase();

                    const want = (t) => !types || types.includes(t);

                    const [facts, questions, decisions, risks, people] = await Promise.all([
                        want('facts') ? sb.getFacts() : [],
                        want('questions') ? sb.getQuestions() : [],
                        want('decisions') ? sb.getDecisions() : [],
                        want('risks') ? sb.getRisks() : [],
                        want('people') ? sb.getPeople() : [],
                    ]);

                    const results = {
                        query,
                        total: 0,
                        facts: (facts || []).filter(f => String(f.content || '').toLowerCase().includes(term)).slice(0, limit),
                        questions: (questions || []).filter(q => String(q.content || '').toLowerCase().includes(term)).slice(0, limit),
                        decisions: (decisions || []).filter(d => String(d.content || '').toLowerCase().includes(term)).slice(0, limit),
                        risks: (risks || []).filter(r => String(r.content || '').toLowerCase().includes(term)).slice(0, limit),
                        people: (people || []).filter(p => String(p.name || '').toLowerCase().includes(term)).slice(0, limit)
                    };

                    results.total = results.facts.length + results.questions.length + results.decisions.length + results.risks.length + results.people.length;
                    jsonResponse(res, results);
                    return;
                }

                const results = storage.search(query, { types, limit });
                jsonResponse(res, results);
            } catch (e) {
                jsonResponse(res, { query: '', total: 0, facts: [], questions: [], decisions: [], risks: [], people: [], error: e.message }, 500);
            }
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
            const searchResults = s.search ? s.search(question, { limit: 10 }) : storage.search(question, { limit: 10 });
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
        // POST /api/chat/sessions - Create new chat session (request-scoped project)
        if (pathname === '/api/chat/sessions' && req.method === 'POST') {
            const body = await parseBody(req);
            const title = body.title || 'Nova conversa';
            const contextContactId = body.contextContactId || null;
            try {
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;

                const session = await s.createChatSession({ title, contextContactId });
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

        // GET /api/chat/sessions - List chat sessions for project (request-scoped project)
        if (pathname === '/api/chat/sessions' && req.method === 'GET') {
            try {
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;

                const sessions = await s.getChatSessions();
                jsonResponse(res, { ok: true, sessions });
            } catch (e) {
                console.error('[Chat] List sessions error:', e.message);
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return;
        }

        // GET /api/chat/sessions/:id/messages - Get messages for session (request-scoped project)
        const chatSessionMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/);
        if (chatSessionMatch && req.method === 'GET') {
            const sessionId = chatSessionMatch[1];
            try {
                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;

                const messages = await s.getChatMessages(sessionId);
                jsonResponse(res, { ok: true, messages });
            } catch (e) {
                console.error('[Chat] Get messages error:', e.message);
                jsonResponse(res, { ok: false, error: e.message }, 500);
            }
            return;
        }

        // POST /api/chat - Chat with reasoning model using project context (request-scoped project)
        if (pathname === '/api/chat' && req.method === 'POST') {
            const body = await parseBody(req);
            const message = body.message;
            const context = body.context;
            let history = body.history || [];
            const useSemantic = body.semantic !== false; // Default to true
            const deepReasoning = body.deepReasoning || false; // Enable CoT reasoning
            let sessionId = body.sessionId || null; // Persistence: chat session ID
            const contextContactId = body.contextContactId || null; // Optional: contact for role context when creating session

            const headerPid = req.headers['x-project-id'];
            const projectId = typeof headerPid === 'string' ? headerPid : null;
            const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                ? storage._supabase.forProject(projectId)
                : storage;

            if (!message) {
                jsonResponse(res, { error: 'Message is required' }, 400);
                return;
            }

            // Persistence: if sessionId provided but no session exists, or if Supabase and no sessionId, load/create session
            let chatSession = null;
            if (storage.getChatSessions && typeof storage.getChatSessions === 'function') {
                if (sessionId) {
                    try {
                        chatSession = s.getChatSession ? await s.getChatSession(sessionId) : null;
                        const dbMessages = await s.getChatMessages(sessionId);
                        if (dbMessages.length > 0 && history.length === 0) {
                            history = dbMessages.map(m => ({ role: m.role, content: m.content }));
                        }
                    } catch (e) {
                        console.warn('[Chat] Could not load session messages:', e.message);
                    }
                } else if (supabase && supabase.isConfigured && supabase.isConfigured()) {
                    try {
                        const newSession = await s.createChatSession({
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
            if (!chatSession && sessionId && s.getChatSession) {
                try { chatSession = await s.getChatSession(sessionId); } catch (e) { /* ignore */ }
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
            const currentProject = s.getCurrentProject ? s.getCurrentProject() : storage.getCurrentProject?.();
            let userRole = currentProject?.userRole || '';
            let userRolePrompt = currentProject?.userRolePrompt || '';
            let roleContext = '';
            const contextContactIdFromSession = chatSession?.context_contact_id || null;
            if (contextContactIdFromSession && s.getContactById) {
                const contact = await Promise.resolve(s.getContactById(contextContactIdFromSession));
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
            const processedQuery = s.preprocessQuery(searchQuery);
            const queryType = s.classifyQuery(searchQuery);
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

        // ==================== Documents API ====================
        // Documents routes moved to features/documents/routes.js - handleDocuments()


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
        // NOTE: scheduled jobs are project-scoped (dataDir)
        const jobsHeaderPid = req.headers['x-project-id'];
        const jobsProjectId = typeof jobsHeaderPid === 'string' ? jobsHeaderPid : null;
        const jobsStorage = (storage._supabase && jobsProjectId && typeof storage._supabase.forProject === 'function')
            ? storage._supabase.forProject(jobsProjectId)
            : storage;

        // GET /api/jobs - Get all jobs
        if (pathname === '/api/jobs' && req.method === 'GET') {
            try {
                const { getScheduledJobs } = require('./advanced');
                const scheduler = getScheduledJobs({ dataDir: jobsStorage.getProjectDataDir() });
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
                const scheduler = getScheduledJobs({ dataDir: jobsStorage.getProjectDataDir() });
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
                const scheduler = getScheduledJobs({ dataDir: jobsStorage.getProjectDataDir() });
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
                const scheduler = getScheduledJobs({ dataDir: jobsStorage.getProjectDataDir() });
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
                const scheduler = getScheduledJobs({ dataDir: jobsStorage.getProjectDataDir() });
                const log = scheduler.getExecutionLog();
                jsonResponse(res, { ok: true, log });
            } catch (error) {
                jsonResponse(res, { ok: false, error: error.message }, 500);
            }
            return;
        }

        // --- Full-text Search ---

        // POST /api/search - Search (request-scoped project)
        if (pathname === '/api/search' && req.method === 'POST') {
            try {
                const body = await parseBody(req);

                const headerPid = req.headers['x-project-id'];
                const projectId = typeof headerPid === 'string' ? headerPid : null;
                const s = (storage._supabase && projectId && typeof storage._supabase.forProject === 'function')
                    ? storage._supabase.forProject(projectId)
                    : storage;

                const { getSearchIndex } = require('./advanced');
                const searchIndex = getSearchIndex({ dataDir: s.getProjectDataDir() });
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

    // Health check endpoint - simple and fast for monitoring
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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthStatus));
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
    // Landing page on root
    if (pathname === '/') {
        pathname = '/landing.html';
    }
    // App on /app - SPA fallback: any /app/* route serves index.html
    // This allows client-side routing to work on page refresh
    if (pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/')) {
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

// Start server
server.listen(PORT, async () => {
    const currentProject = storage.getCurrentProject();
    const projectName = (currentProject?.name) || 'No project';
    console.log(`
╔════════════════════════════════════════════════════════════╗
║       GodMode by RPAD - Ready                              ║
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
