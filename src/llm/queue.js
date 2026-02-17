/**
 * LLM Queue Manager - Global queue for LLM requests
 * Ensures only one LLM request is processed at a time to avoid rate limits
 * Hybrid: In-memory for real-time + Database for persistence & retry
 */

const EventEmitter = require('events');
const { calculateCost } = require('./modelMetadata');
const { logger: rootLogger } = require('../logger');

const log = rootLogger.child({ module: 'llm-queue' });

// Priority levels
const PRIORITY = {
    HIGH: 0,      // Interactive/chat requests
    NORMAL: 1,    // Standard processing
    LOW: 2,       // Background/batch processing
    BATCH: 3      // Lowest priority bulk operations
};

// Map priority number to string for database
const PRIORITY_TO_STRING = {
    0: 'high',
    1: 'normal',
    2: 'low',
    3: 'low'
};

/**
 * Queue item structure
 */
class QueueItem {
    constructor(id, request, priority, resolve, reject, dbId = null) {
        this.id = id;
        this.dbId = dbId; // Database record ID (UUID)
        this.request = request;
        this.priority = priority;
        this.resolve = resolve;
        this.reject = reject;
        this.enqueuedAt = Date.now();
        this.startedAt = null;
        this.status = 'pending'; // pending, processing, completed, failed, cancelled
        this.retries = 0;
        this.maxRetries = request.maxRetries || 3;
    }
}

/**
 * LLM Queue Manager
 * Singleton that manages all LLM requests globally
 * Persists to database for audit, retry, and monitoring
 * 
 * CONCURRENCY MODEL:
 * - Requests are grouped by concurrency key: provider + apiKeyHash
 * - Only ONE request per concurrency key can run at a time
 * - Different concurrency keys can run in PARALLEL
 * - This allows simultaneous requests to different providers or same provider with different API keys
 */
class LLMQueueManager extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        
        // Map of currently processing items by concurrency key
        // Key: "provider:apiKeyHash", Value: QueueItem
        this.processingByKey = new Map();
        
        // Last request time by concurrency key (for rate limiting)
        this.lastRequestTimeByKey = new Map();
        
        this.isRunning = true;
        this.isPaused = false;
        this.dbEnabled = false;
        this.dbQueue = null; // Will be loaded lazily
        
        // Statistics (in-memory, synced from DB periodically)
        this.stats = {
            totalEnqueued: 0,
            totalProcessed: 0,
            totalFailed: 0,
            totalCancelled: 0,
            totalRetries: 0,
            avgProcessingTime: 0,
            avgWaitTime: 0,
            maxConcurrentReached: 0 // Track max parallel requests
        };
        
        // Configuration
        this.config = {
            maxConcurrencyPerKey: 1,  // 1 request per provider+apiKey at a time
            maxTotalConcurrency: 10,  // Max parallel requests across all keys
            maxQueueSize: 100,        // Maximum pending requests
            requestTimeout: 300000,   // 5 minutes timeout per request (aligned with LLM provider timeout)
            minDelayBetween: 500,     // Minimum 500ms between requests per key
            rateLimitDelay: 15000,    // Wait 15s after rate limit error
            retryCheckInterval: 30000,// Check for retry-pending items every 30s
            persistToDatabase: true   // Enable database persistence
        };
        
        // Completed requests history (in-memory for quick access)
        this.history = [];
        this.maxHistorySize = 50;

        // Config provider - used to resolve default LLM provider when missing/unknown
        this.configProvider = null;
        
        // ID counter
        this.idCounter = 0;

        // Retry processor interval
        this.retryInterval = null;

        // BYOK: Cache for project API keys (avoids DB lookup on every request)
        // Key: "projectId:provider", Value: { apiKey, source, resolvedAt }
        this.byokCache = new Map();
        this.byokCacheTTL = 60000; // 60 seconds
        
        // Initialize database connection
        this.initDatabase();
        log.info({ event: 'llm_queue_initialized' }, 'Queue manager initialized (parallel processing enabled)');
    }
    
    /**
     * Set provider for app config - used to resolve default LLM provider when missing/unknown
     * @param {function} fn - Returns app config { llm: { ... } }
     */
    setConfigProvider(fn) {
        this.configProvider = typeof fn === 'function' ? fn : null;
    }

    /**
     * Resolve provider from LLM config when missing or 'unknown'
     * @param {string} operation - 'text', 'vision', 'embeddings'
     * @param {string} currentProvider - Provider from request
     * @returns {string} - Resolved provider
     */
    resolveProviderFromConfig(operation, currentProvider) {
        if (currentProvider && currentProvider !== 'unknown') return currentProvider;
        try {
            const appConfig = this.configProvider?.();
            if (!appConfig?.llm) return currentProvider || 'unknown';
            const llmConfig = require('./config');
            const taskType = operation === 'embeddings' ? 'embeddings' : (operation === 'vision' ? 'vision' : 'text');
            const getCfg = taskType === 'embeddings' ? llmConfig.getEmbeddingsConfig : (taskType === 'vision' ? llmConfig.getVisionConfig : llmConfig.getTextConfig);
            const cfg = getCfg(appConfig);
            return cfg?.provider || currentProvider || 'unknown';
        } catch {
            return currentProvider || 'unknown';
        }
    }

    /**
     * BYOK: Normalize provider aliases to canonical names
     * e.g., 'claude' → 'anthropic', 'gemini' → 'google', 'xai' → 'grok'
     */
    normalizeProvider(provider) {
        const aliases = {
            claude: 'anthropic',
            gemini: 'google',
            xai: 'grok'
        };
        return aliases[provider] || provider;
    }

    /**
     * BYOK: Resolve API key from Supabase vault for a provider
     * Priority: project secret > system secret
     * Uses in-memory cache to avoid DB calls on every request
     * @param {string} provider - Provider name (e.g., 'openai', 'anthropic')
     * @param {string} projectId - Project UUID (optional, if null only checks system)
     * @returns {Promise<{apiKey: string, source: string}|null>} - Resolved key or null
     */
    async resolveProjectApiKey(provider, projectId = null) {
        if (!provider) return null;

        const normalizedProvider = this.normalizeProvider(provider);
        const cacheKey = `${projectId || 'system'}:${normalizedProvider}`;

        // Check cache first
        const cached = this.byokCache.get(cacheKey);
        if (cached && (Date.now() - cached.resolvedAt) < this.byokCacheTTL) {
            return cached.apiKey ? { apiKey: cached.apiKey, source: cached.source } : null;
        }

        try {
            const secrets = require('../supabase/secrets');
            const result = await secrets.getProviderApiKey(normalizedProvider, projectId);

            if (result.success && result.value) {
                // Cache the resolved key
                this.byokCache.set(cacheKey, {
                    apiKey: result.value,
                    source: result.source, // 'project' or 'system'
                    resolvedAt: Date.now()
                });
                return { apiKey: result.value, source: result.source };
            }

            // Cache the miss too (avoid repeated DB lookups)
            this.byokCache.set(cacheKey, { apiKey: null, source: null, resolvedAt: Date.now() });
            return null;
        } catch (err) {
            log.warn({ event: 'llm_queue_byok_resolve_error', provider: normalizedProvider, projectId, reason: err.message }, 'BYOK key resolution error (continuing with default)');
            return null;
        }
    }

    /**
     * BYOK: Invalidate cache for a project (called when keys are updated)
     */
    invalidateByokCache(projectId = null) {
        if (!projectId) {
            this.byokCache.clear();
            return;
        }
        for (const key of this.byokCache.keys()) {
            if (key.startsWith(`${projectId}:`)) {
                this.byokCache.delete(key);
            }
        }
    }

    /**
     * Generate concurrency key from request
     * Key is: provider + hash of API key (first 8 chars)
     */
    getConcurrencyKey(request) {
        const provider = request.provider || 'unknown';
        const apiKey = request.providerConfig?.apiKey || request.apiKey || '';
        
        // Use first 8 chars of API key hash for uniqueness without exposing full key
        const keyHash = apiKey ? this.hashString(apiKey).substring(0, 8) : 'default';
        
        return `${provider}:${keyHash}`;
    }
    
    /**
     * Simple string hash for API key differentiation
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
    
    /**
     * Check if a concurrency key is currently processing
     */
    isKeyProcessing(key) {
        return this.processingByKey.has(key);
    }
    
    /**
     * Get total number of currently processing requests
     */
    getTotalProcessing() {
        return this.processingByKey.size;
    }
    
    /**
     * Legacy getter for backward compatibility
     */
    get processing() {
        // Return first processing item or null
        const values = Array.from(this.processingByKey.values());
        return values.length > 0 ? values[0] : null;
    }
    
    /**
     * Initialize database connection
     */
    async initDatabase() {
        try {
            this.dbQueue = require('../supabase/llm-queue');
            const { getAdminClient } = require('../supabase/client');
            const client = getAdminClient();
            
            if (client) {
                this.dbEnabled = true;
                log.info({ event: 'llm_queue_db_enabled' }, 'Database persistence enabled');
                
                // Start retry processor
                this.startRetryProcessor();
            } else {
                log.debug({ event: 'llm_queue_db_disabled' }, 'Database not configured, using in-memory only');
            }
        } catch (error) {
            log.warn({ event: 'llm_queue_db_init_failed', reason: error.message }, 'Failed to initialize database');
            this.dbEnabled = false;
        }
    }
    
    /**
     * Start background processor for retry-pending items
     */
    startRetryProcessor() {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
        }
        
        this.retryInterval = setInterval(async () => {
            // Only process retries if we have capacity
            if (!this.dbEnabled || this.isPaused || this.getTotalProcessing() >= this.config.maxTotalConcurrency) return;
            
            try {
                // Check for items ready to retry
                const result = await this.dbQueue.claimNextRequest();
                if (result.success && result.request) {
                    log.debug({ event: 'llm_queue_retry_found', requestId: result.request.id }, 'Found retry-pending item');
                    // Process will be handled by the claim - just trigger processNext
                    this.processRetryItem(result.request);
                }
            } catch (error) {
                log.warn({ event: 'llm_queue_retry_processor_error', reason: error.message }, 'Retry processor error');
            }
        }, this.config.retryCheckInterval);
        
        log.info({ event: 'llm_queue_retry_started' }, 'Retry processor started');
    }
    
    /**
     * Process a retry item from database
     */
    async processRetryItem(dbRequest) {
        // Get current provider config from app config (API keys are not stored in DB)
        let providerConfig = {};
        try {
            if (this.configProvider) {
                const appConfig = this.configProvider();
                const llmConfig = require('./config');
                const cfg = llmConfig.getLLMConfig(appConfig);
                providerConfig = cfg.getProviderConfig(dbRequest.provider) || {};
            }
        } catch (err) {
            log.warn({ event: 'llm_queue_retry_config_failed', reason: err.message }, 'Could not get provider config for retry');
        }
        
        const request = {
            ...dbRequest.inputData,
            provider: dbRequest.provider,
            model: dbRequest.model,
            context: dbRequest.context,
            projectId: dbRequest.projectId || dbRequest.inputData?.projectId || null,
            _operation: dbRequest.requestType,
            providerConfig  // Add current provider config with API key
        };

        // BYOK: Resolve API key from Supabase vault for retry
        // All keys come from Supabase - project keys first, then system keys
        if (request.provider) {
            try {
                const byokResult = await this.resolveProjectApiKey(request.provider, request.projectId);
                if (byokResult) {
                    request.providerConfig = {
                        ...request.providerConfig,
                        apiKey: byokResult.apiKey
                    };
                    log.debug({ event: 'llm_queue_byok_retry_resolved', provider: request.provider, source: byokResult.source, projectId: request.projectId }, `BYOK retry: Using ${byokResult.source} API key`);
                }
            } catch (byokError) {
                log.warn({ event: 'llm_queue_byok_retry_error', reason: byokError.message }, 'BYOK retry resolution error (continuing with existing key)');
            }
        }

        const key = this.getConcurrencyKey(request);
        
        // Check if this key is already processing
        if (this.isKeyProcessing(key)) {
            // Already processing for this key, skip
            return;
        }
        
        const item = new QueueItem(
            `retry-${dbRequest.id}`,
            request,
            PRIORITY.HIGH,
            () => {}, // No resolve/reject for retry items
            () => {},
            dbRequest.id
        );
        item.retries = dbRequest.attemptCount - 1;
        
        // Process directly
        await this.processItem(item, key);
    }
    
    /**
     * Generate unique request ID
     */
    generateId() {
        return `llm-${Date.now()}-${++this.idCounter}`;
    }
    
    /**
     * Enqueue an LLM request
     * @param {object} request - The LLM request (provider, model, prompt, etc.)
     * @param {string} priority - Priority level: 'high', 'normal', 'low', 'batch'
     * @returns {Promise<object>} - Resolves with the LLM response
     */
    enqueue(request, priority = 'normal') {
        return new Promise(async (resolve, reject) => {
            // Check queue size
            if (this.queue.length >= this.config.maxQueueSize) {
                reject(new Error(`Queue full (${this.config.maxQueueSize} pending requests)`));
                return;
            }
            
            // Capture projectId from storage context if not provided
            // This ensures billing works even when callers don't pass projectId
            if (!request.projectId) {
                try {
                    const { getStorage } = require('../supabase/storageHelper');
                    const storage = getStorage();
                    if (storage && storage.currentProjectId) {
                        request.projectId = storage.currentProjectId;
                    }
                } catch (e) {
                    // Storage not available, proceed without projectId
                }
            }
            
            // Map priority string to number
            const priorityNum = typeof priority === 'string' 
                ? (PRIORITY[priority.toUpperCase()] ?? PRIORITY.NORMAL)
                : priority;
            
            // Create queue item
            const id = this.generateId();
            let dbId = null;
            
            // Persist to database if enabled
            if (this.dbEnabled && this.config.persistToDatabase) {
                try {
                    let operation = request._operation || 'text';
                    if (operation === 'embed') operation = 'embeddings';
                    const provider = this.resolveProviderFromConfig(operation, request.provider);
                    const result = await this.dbQueue.enqueueRequest({
                        projectId: request.projectId || null,
                        userId: request.userId || null,
                        requestType: operation,
                        context: request.context || 'unknown',
                        provider,
                        model: request.model || 'unknown',
                        inputData: {
                            messages: request.messages,
                            prompt: request.prompt,
                            systemPrompt: request.systemPrompt,
                            options: request.options,
                            images: request.images ? '[images]' : undefined // Don't store full images
                        },
                        priority: PRIORITY_TO_STRING[priorityNum] || 'normal',
                        maxAttempts: request.maxRetries || 3,
                        documentId: request.documentId || null,
                        relatedEntityType: request.relatedEntityType || null,
                        relatedEntityId: request.relatedEntityId || null,
                        metadata: request.metadata || {}
                    });
                    
                    if (result.success) {
                        dbId = result.id;
                    }
                } catch (error) {
                    log.warn({ event: 'llm_queue_persist_failed', reason: error.message }, 'Failed to persist to database');
                    // Continue without database persistence
                }
            }
            
            const item = new QueueItem(id, request, priorityNum, resolve, reject, dbId);
            
            // Insert in priority order
            let inserted = false;
            for (let i = 0; i < this.queue.length; i++) {
                if (this.queue[i].priority > priorityNum) {
                    this.queue.splice(i, 0, item);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                this.queue.push(item);
            }
            
            this.stats.totalEnqueued++;
            
            // Log
            const context = request.context || 'unknown';
            log.debug({ event: 'llm_queue_enqueued', id, context, priority, queueSize: this.queue.length, db: !!dbId }, 'Enqueued');
            
            this.emit('enqueue', { id, dbId, priority, queueSize: this.queue.length });
            
            // Start processing if not already
            this.processNext();
        });
    }
    
    /**
     * Process next item(s) in queue
     * Now supports parallel processing for different concurrency keys
     */
    async processNext() {
        // Check if we can process anything
        if (this.isPaused || this.queue.length === 0) {
            return;
        }
        
        // Check total concurrency limit
        if (this.getTotalProcessing() >= this.config.maxTotalConcurrency) {
            return;
        }
        
        // Find items that can be processed (not blocked by same concurrency key)
        const itemsToProcess = [];
        const keysToProcess = new Set();
        
        for (let i = 0; i < this.queue.length && itemsToProcess.length < this.config.maxTotalConcurrency - this.getTotalProcessing(); i++) {
            const item = this.queue[i];
            const key = this.getConcurrencyKey(item.request);
            
            // Skip if this key is already processing or already in this batch
            if (this.isKeyProcessing(key) || keysToProcess.has(key)) {
                continue;
            }
            
            // Check minimum delay for this key
            const lastTime = this.lastRequestTimeByKey.get(key) || 0;
            const timeSinceLastRequest = Date.now() - lastTime;
            if (timeSinceLastRequest < this.config.minDelayBetween) {
                // Schedule a delayed check for this key
                const waitTime = this.config.minDelayBetween - timeSinceLastRequest;
                setTimeout(() => this.processNext(), waitTime);
                continue;
            }
            
            itemsToProcess.push({ item, index: i, key });
            keysToProcess.add(key);
        }
        
        if (itemsToProcess.length === 0) {
            return;
        }
        
        // Track max concurrency reached
        const newConcurrency = this.getTotalProcessing() + itemsToProcess.length;
        if (newConcurrency > this.stats.maxConcurrentReached) {
            this.stats.maxConcurrentReached = newConcurrency;
        }
        
        // Remove items from queue (in reverse order to maintain indices)
        itemsToProcess.sort((a, b) => b.index - a.index);
        for (const { index } of itemsToProcess) {
            this.queue.splice(index, 1);
        }
        
        // Process all items in parallel
        const processingPromises = itemsToProcess.map(({ item, key }) => 
            this.processItem(item, key)
        );
        
        // Log parallel processing
        if (itemsToProcess.length > 1) {
            const keys = itemsToProcess.map(({ key }) => key).join(', ');
            log.debug({ event: 'llm_queue_parallel_start', count: itemsToProcess.length, keys }, 'Processing in parallel');
        }
        
        // Don't await - let them run in parallel
        Promise.all(processingPromises).catch(err => {
            log.warn({ event: 'llm_queue_parallel_error', reason: err?.message }, 'Parallel processing error');
        });
    }
    
    /**
     * Process a single queue item
     * @param {QueueItem} item - The queue item to process
     * @param {string} concurrencyKey - The concurrency key for this item
     */
    async processItem(item, concurrencyKey = null) {
        const key = concurrencyKey || this.getConcurrencyKey(item.request);
        
        // Mark this key as processing
        this.processingByKey.set(key, item);
        
        item.status = 'processing';
        item.startedAt = Date.now();
        
        const waitTime = item.startedAt - item.enqueuedAt;
        const context = item.request.context || 'unknown';
        const activeCount = this.getTotalProcessing();
        
        log.debug({ event: 'llm_queue_processing', id: item.id, context, key, activeCount, waitTimeMs: waitTime, remaining: this.queue.length }, 'Processing');
        
        this.emit('processing', { id: item.id, dbId: item.dbId, waitTime, queueSize: this.queue.length, concurrencyKey: key, activeCount });

        const projectId = item.request.projectId;

        // BYOK: Resolve API key from Supabase vault BEFORE billing check
        // All keys (project + system) come from Supabase vault
        // When source='project' (BYOK), billing restrictions are bypassed
        let byokSource = null;
        if (item.request.provider) {
            try {
                const byokResult = await this.resolveProjectApiKey(item.request.provider, projectId);
                if (byokResult) {
                    byokSource = byokResult.source; // 'project' or 'system'
                    item.request.providerConfig = {
                        ...(item.request.providerConfig || {}),
                        apiKey: byokResult.apiKey
                    };
                    log.debug({ event: 'llm_queue_byok_resolved', id: item.id, provider: item.request.provider, source: byokSource, projectId }, `BYOK: Using ${byokSource} API key`);
                }
            } catch (byokError) {
                log.warn({ event: 'llm_queue_byok_error', reason: byokError.message }, 'BYOK resolution error (continuing with existing key)');
            }
        }

        // Billing pre-check: only when using system keys (not BYOK project keys)
        // When a project uses its own API key, they pay the provider directly
        const isByokProject = byokSource === 'project';
        if (projectId && !isByokProject) {
            try {
                const billing = require('../supabase/billing');
                const balanceCheck = await billing.checkProjectBalance(projectId);

                if (!balanceCheck.allowed) {
                    // Reject request due to insufficient balance
                    item.status = 'rejected';

                    log.debug({ event: 'llm_queue_blocked_balance', id: item.id, projectId, reason: balanceCheck.reason }, 'Blocked by balance');

                    // Notify project admins
                    await billing.notifyBalanceInsufficient(projectId, balanceCheck.reason);

                    // Update DB with rejection status
                    if (this.dbEnabled && item.dbId) {
                        try {
                            await this.dbQueue.failRequest({
                                requestId: item.dbId,
                                error: balanceCheck.reason,
                                errorCode: 'INSUFFICIENT_BALANCE',
                                retry: false
                            });
                        } catch (dbError) {
                            log.warn({ event: 'llm_queue_db_balance_reject_failed', reason: dbError.message }, 'Failed to update DB on balance rejection');
                        }
                    }

                    // Clean up and reject
                    this.processingByKey.delete(key);
                    this.lastRequestTimeByKey.set(key, Date.now());
                    setImmediate(() => this.processNext());

                    item.reject(new Error(`Insufficient balance: ${balanceCheck.reason}`));
                    return;
                }
            } catch (balanceError) {
                // On balance check error, log but continue (don't block)
                log.warn({ event: 'llm_queue_balance_check_error', reason: balanceError.message }, 'Balance check error (continuing)');
            }
        } else if (isByokProject) {
            log.debug({ event: 'llm_queue_billing_skipped', id: item.id, projectId, reason: 'byok_project_key' }, 'Billing skipped: project uses own API key');
        }

        try {
            // Execute the LLM request
            const result = await this.executeRequest(item);
            
            // Success
            const processingTime = Date.now() - item.startedAt;
            item.status = 'completed';
            
            this.stats.totalProcessed++;
            this.updateAvgTimes(waitTime, processingTime);
            
            // Calculate cost based on model and tokens
            const inputTokens = result.usage?.inputTokens || result.usage?.prompt || result.usage?.input || 0;
            const outputTokens = result.usage?.outputTokens || result.usage?.completion || result.usage?.output || 0;
            const modelId = item.request?.model || 'unknown';
            const estimatedCost = calculateCost(modelId, inputTokens, outputTokens) || result.cost || 0;
            
            log.debug({ event: 'llm_queue_completed', id: item.id, processingTimeMs: processingTime, inputTokens, outputTokens, cost: estimatedCost }, 'Completed');
            
            // Track billable cost and debit balance (billing integration)
            // Skip billing entirely when project uses its own API key (BYOK)
            let billingResult = null;
            if (projectId && !isByokProject && (inputTokens > 0 || outputTokens > 0)) {
                try {
                    const billing = require('../supabase/billing');
                    billingResult = await billing.calculateAndRecordCost({
                        projectId,
                        providerCostUsd: estimatedCost,
                        tokens: inputTokens + outputTokens,
                        inputTokens,
                        outputTokens,
                        model: modelId,
                        provider: item.request?.provider || 'unknown',
                        context: item.request?.context || 'unknown',
                        requestId: item.dbId
                    });

                    // Check for low balance notification
                    await billing.checkAndNotifyLowBalance(projectId);

                    log.debug({ event: 'llm_queue_billing', id: item.id, providerCost: billingResult.provider_cost_eur, billableCost: billingResult.billable_cost_eur, markup: billingResult.markup_percent }, 'Billing');
                } catch (billingError) {
                    log.warn({ event: 'llm_queue_billing_error', reason: billingError.message }, 'Billing tracking error (non-blocking)');
                }
            } else if (isByokProject) {
                log.debug({ event: 'llm_queue_billing_skipped_post', id: item.id, projectId, inputTokens, outputTokens }, 'Post-billing skipped: BYOK project key');
            }
            
            // Update database
            if (this.dbEnabled && item.dbId) {
                try {
                    await this.dbQueue.completeRequest({
                        requestId: item.dbId,
                        outputData: { 
                            text: result.text?.substring(0, 5000), // Truncate for storage
                            usage: result.usage 
                        },
                        outputText: result.text?.substring(0, 1000),
                        inputTokens: inputTokens,
                        outputTokens: outputTokens,
                        estimatedCost: estimatedCost
                    });
                } catch (dbError) {
                    log.warn({ event: 'llm_queue_db_complete_failed', reason: dbError.message }, 'Failed to update DB on complete');
                }
            }
            
            this.addToHistory(item, result);
            this.emit('completed', { id: item.id, dbId: item.dbId, processingTime, result });
            
            item.resolve(result);
            
        } catch (error) {
            const processingTime = Date.now() - item.startedAt;
            
            // Check if it's a rate limit error
            const isRateLimit = error.message?.includes('Rate limit') || 
                               error.status === 429 ||
                               error.statusCode === 429;
            
            if (isRateLimit && item.retries < item.maxRetries) {
                // Re-enqueue with high priority after delay
                item.retries++;
                item.status = 'pending';
                this.stats.totalRetries++;
                
                log.warn({ event: 'llm_queue_rate_limited', id: item.id, retries: item.retries, maxRetries: item.maxRetries, delayMs: this.config.rateLimitDelay }, 'Rate limited');
                
                // Update database for retry
                if (this.dbEnabled && item.dbId) {
                    try {
                        await this.dbQueue.failRequest({
                            requestId: item.dbId,
                            error: 'Rate limited',
                            errorCode: '429',
                            retry: true
                        });
                    } catch (dbError) {
                        log.warn({ event: 'llm_queue_db_ratelimit_failed', reason: dbError.message }, 'Failed to update DB on rate limit');
                    }
                }
                
                setTimeout(() => {
                    // Add to front of queue (high priority)
                    this.queue.unshift(item);
                    this.processNext();
                }, this.config.rateLimitDelay);
                
            } else if (error.message?.includes('timeout') && item.retries < item.maxRetries) {
                // Retry on timeout
                item.retries++;
                item.status = 'pending';
                this.stats.totalRetries++;
                log.warn({ event: 'llm_queue_timeout', id: item.id, retries: item.retries, maxRetries: item.maxRetries }, 'Timeout');
                this.queue.unshift(item);
                
            } else {
                // Failed permanently
                item.status = 'failed';
                this.stats.totalFailed++;
                
                log.warn({ event: 'llm_queue_failed', id: item.id, reason: error.message }, 'Request failed');
                
                // Update database
                if (this.dbEnabled && item.dbId) {
                    try {
                        await this.dbQueue.failRequest({
                            requestId: item.dbId,
                            error: error.message,
                            errorCode: error.code || error.status?.toString(),
                            errorDetails: { stack: error.stack?.substring(0, 500) },
                            retry: false
                        });
                    } catch (dbError) {
                        log.warn({ event: 'llm_queue_db_failure_failed', reason: dbError.message }, 'Failed to update DB on failure');
                    }
                }
                
                this.addToHistory(item, { error: error.message });
                this.emit('failed', { id: item.id, dbId: item.dbId, error: error.message, processingTime });
                
                item.reject(error);
            }
        } finally {
            // Remove from processing map
            this.processingByKey.delete(key);
            
            // Update last request time for this key
            this.lastRequestTimeByKey.set(key, Date.now());
            
            // Process next in queue (may start more parallel requests)
            setImmediate(() => this.processNext());
        }
    }
    
    /**
     * Execute the actual LLM request
     */
    async executeRequest(item) {
        const { request } = item;
        
        // Dynamic import to avoid circular dependency
        const llm = require('./index');
        
        // Ensure we bypass the queue (we ARE the queue)
        const requestWithBypass = { ...request, _bypassQueue: true };
        
        // Determine operation type
        const operation = request._operation || 'text';
        
        // Set timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Request timeout after ${this.config.requestTimeout}ms`));
            }, this.config.requestTimeout);
        });
        
        // Execute with timeout - call the appropriate function based on operation type
        let resultPromise;
        switch (operation) {
            case 'vision':
                resultPromise = llm.generateVision(requestWithBypass);
                break;
            case 'embed':
                resultPromise = llm.embed(requestWithBypass);
                break;
            case 'text':
            default:
                resultPromise = llm.generateText(requestWithBypass);
                break;
        }
        
        return Promise.race([resultPromise, timeoutPromise]);
    }
    
    /**
     * Update average times
     */
    updateAvgTimes(waitTime, processingTime) {
        const n = this.stats.totalProcessed;
        this.stats.avgWaitTime = ((this.stats.avgWaitTime * (n - 1)) + waitTime) / n;
        this.stats.avgProcessingTime = ((this.stats.avgProcessingTime * (n - 1)) + processingTime) / n;
    }
    
    /**
     * Add to history
     */
    addToHistory(item, result) {
        this.history.unshift({
            id: item.id,
            context: item.request.context,
            provider: item.request.provider,
            model: item.request.model,
            priority: item.priority,
            status: item.status,
            enqueuedAt: item.enqueuedAt,
            startedAt: item.startedAt,
            completedAt: Date.now(),
            waitTime: item.startedAt - item.enqueuedAt,
            processingTime: Date.now() - item.startedAt,
            retries: item.retries,
            tokens: result.usage?.total,
            error: result.error
        });
        
        // Trim history
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }
    
    /**
     * Get queue status (combined in-memory and database)
     */
    async getStatus(projectId = null) {
        // Get all currently processing items
        const processingItems = Array.from(this.processingByKey.entries()).map(([key, item]) => ({
            id: item.id,
            dbId: item.dbId,
            concurrencyKey: key,
            context: item.request.context,
            provider: item.request.provider,
            model: item.request.model,
            startedAt: item.startedAt,
            elapsed: Date.now() - item.startedAt
        }));
        
        const memoryStatus = {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            dbEnabled: this.dbEnabled,
            queueSize: this.queue.length,
            activeCount: this.getTotalProcessing(),
            processing: processingItems.length > 0 ? processingItems[0] : null, // Legacy single item
            processingAll: processingItems, // All processing items
            pending: this.queue.slice(0, 10).map(item => ({
                id: item.id,
                dbId: item.dbId,
                context: item.request.context,
                concurrencyKey: this.getConcurrencyKey(item.request),
                priority: item.priority,
                priorityLabel: Object.keys(PRIORITY).find(k => PRIORITY[k] === item.priority) || 'normal',
                waitTime: Date.now() - item.enqueuedAt
            })),
            stats: {
                ...this.stats,
                avgWaitTime: Math.round(this.stats.avgWaitTime),
                avgProcessingTime: Math.round(this.stats.avgProcessingTime),
                currentConcurrency: this.getTotalProcessing()
            },
            config: this.config
        };
        
        // Merge with database stats if available
        if (this.dbEnabled) {
            try {
                const dbStatus = await this.dbQueue.getQueueStatus(projectId);
                if (dbStatus.success) {
                    memoryStatus.database = dbStatus.status;
                    // Merge stats
                    memoryStatus.stats.dbPending = dbStatus.status.pendingCount;
                    memoryStatus.stats.dbProcessing = dbStatus.status.processingCount;
                    memoryStatus.stats.dbRetryPending = dbStatus.status.retryPendingCount;
                    memoryStatus.stats.dbCompletedToday = dbStatus.status.completedToday;
                    memoryStatus.stats.dbFailedToday = dbStatus.status.failedToday;
                    memoryStatus.stats.dbAvgProcessingTime = Math.round(dbStatus.status.avgProcessingTimeMs || 0);
                    memoryStatus.stats.dbTotalCostToday = dbStatus.status.totalCostTodayUsd;
                }
            } catch (error) {
                log.warn({ event: 'llm_queue_db_status_failed', reason: error.message }, 'Failed to get database status');
            }
        }
        
        return memoryStatus;
    }
    
    /**
     * Get recent history (from database if available, else in-memory)
     */
    async getHistory(limit = 50, projectId = null) {
        if (this.dbEnabled) {
            try {
                const result = await this.dbQueue.getHistory(projectId, limit);
                if (result.success) {
                    return result.history;
                }
            } catch (error) {
                log.warn({ event: 'llm_queue_db_history_failed', reason: error.message }, 'Failed to get database history');
            }
        }
        
        // Fallback to in-memory history
        return this.history.slice(0, limit);
    }
    
    /**
     * Get pending items (from database if available)
     */
    async getPendingItems(projectId = null, limit = 50) {
        const memoryPending = this.queue.map(item => ({
            id: item.id,
            dbId: item.dbId,
            context: item.request.context,
            priority: Object.keys(PRIORITY).find(k => PRIORITY[k] === item.priority) || 'normal',
            queuedAt: new Date(item.enqueuedAt).toISOString(),
            source: 'memory'
        }));
        
        if (this.dbEnabled) {
            try {
                const result = await this.dbQueue.getPendingRequests(projectId, limit);
                if (result.success) {
                    // Merge with in-memory, avoiding duplicates
                    const dbPending = result.items.map(item => ({
                        ...item,
                        source: 'database'
                    })).filter(dbItem => !memoryPending.find(m => m.dbId === dbItem.id));
                    
                    return [...memoryPending, ...dbPending];
                }
            } catch (error) {
                log.warn({ event: 'llm_queue_db_pending_failed', reason: error.message }, 'Failed to get database pending items');
            }
        }
        return memoryPending;
    }
    
    /**
     * Get failed items that can be retried
     */
    async getRetryableItems(projectId = null, limit = 50) {
        if (!this.dbEnabled) {
            return [];
        }
        
        try {
            const result = await this.dbQueue.getRetryableRequests(projectId, limit);
            return result.success ? result.items : [];
        } catch (error) {
            log.warn({ event: 'llm_queue_retryable_failed', reason: error.message }, 'Failed to get retryable items');
            return [];
        }
    }
    
    /**
     * Retry a failed request by database ID
     */
    async retryById(requestId, resetAttempts = false) {
        if (!this.dbEnabled) {
            return { success: false, error: 'Database not enabled' };
        }
        
        try {
            const result = await this.dbQueue.retryRequest(requestId, resetAttempts);
            if (result.success) {
                log.debug({ event: 'llm_queue_retry_queued', requestId }, 'Queued retry for request');
            }
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get statistics by context
     */
    async getStatsByContext(projectId = null) {
        if (!this.dbEnabled) {
            return [];
        }
        
        try {
            const result = await this.dbQueue.getStatsByContext(projectId);
            return result.success ? result.stats : [];
        } catch (error) {
            log.warn({ event: 'llm_queue_stats_context_failed', reason: error.message }, 'Failed to get stats by context');
            return [];
        }
    }
    
    /**
     * Pause processing
     */
    pause() {
        this.isPaused = true;
        log.info({ event: 'llm_queue_paused' }, 'Queue paused');
        this.emit('paused');
    }
    
    /**
     * Resume processing
     */
    resume() {
        this.isPaused = false;
        log.info({ event: 'llm_queue_resumed' }, 'Queue resumed');
        this.emit('resumed');
        this.processNext();
    }
    
    /**
     * Cancel a pending request
     */
    async cancel(requestId) {
        // Check if it's a memory ID or database ID
        const isDbId = requestId.includes('-') && requestId.length > 30; // UUID format
        
        // Try to find in memory queue
        const index = this.queue.findIndex(item => 
            item.id === requestId || item.dbId === requestId
        );
        
        if (index !== -1) {
            const item = this.queue.splice(index, 1)[0];
            item.status = 'cancelled';
            this.stats.totalCancelled++;
            item.reject(new Error('Request cancelled'));
            // Cancel in database too
            if (this.dbEnabled && item.dbId) {
                try {
                    await this.dbQueue.cancelRequest(item.dbId);
                } catch (error) {
                    log.warn({ event: 'llm_queue_cancel_db_failed', reason: error.message }, 'Failed to cancel in database');
                }
            }
            log.debug({ event: 'llm_queue_cancelled', requestId }, 'Cancelled');
            this.emit('cancelled', { id: requestId, dbId: item.dbId });
            return true;
        }
        
        // Try to cancel in database directly (for pending retry items)
        if (this.dbEnabled && isDbId) {
            try {
                const result = await this.dbQueue.cancelRequest(requestId);
                if (result.success) {
                    log.debug({ event: 'llm_queue_cancelled_db', requestId }, 'Cancelled in database');
                    this.emit('cancelled', { id: requestId, dbId: requestId });
                    return true;
                }
            } catch (error) {
                log.warn({ event: 'llm_queue_cancel_db_failed', reason: error.message }, 'Failed to cancel in database');
            }
        }
        
        return false;
    }
    
    /**
     * Clear all pending requests
     */
    async clear(projectId = null) {
        // Clear in-memory queue
        const memoryItems = projectId 
            ? this.queue.filter(item => item.request.projectId === projectId)
            : [...this.queue];
        
        for (const item of memoryItems) {
            item.status = 'cancelled';
            item.reject(new Error('Queue cleared'));
            const index = this.queue.indexOf(item);
            if (index !== -1) {
                this.queue.splice(index, 1);
            }
        }
        
        const memoryCount = memoryItems.length;
        this.stats.totalCancelled += memoryCount;
        
        // Clear in database
        let dbCount = 0;
        if (this.dbEnabled && projectId) {
            try {
                const result = await this.dbQueue.clearQueue(projectId);
                if (result.success) {
                    dbCount = result.cleared || 0;
                }
            } catch (error) {
                log.warn({ event: 'llm_queue_clear_db_failed', reason: error.message }, 'Failed to clear database queue');
            }
        }
        
        const totalCleared = memoryCount + dbCount;
        log.info({ event: 'llm_queue_cleared', totalCleared, memoryCount, dbCount }, 'Cleared pending requests');
        this.emit('cleared', { count: totalCleared, memoryCount, dbCount });
        return totalCleared;
    }
    
    /**
     * Update configuration
     */
    configure(options) {
        Object.assign(this.config, options);
        log.debug({ event: 'llm_queue_config_updated', config: this.config }, 'Configuration updated');
    }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton queue manager instance
 */
function getQueueManager() {
    if (!instance) {
        instance = new LLMQueueManager();
    }
    return instance;
}

/**
 * Convenience function to enqueue a request
 */
function enqueue(request, priority = 'normal') {
    return getQueueManager().enqueue(request, priority);
}

/**
 * Get queue status
 */
function getStatus(projectId = null) {
    return getQueueManager().getStatus(projectId);
}

/**
 * Get queue history
 */
function getHistory(limit = 50, projectId = null) {
    return getQueueManager().getHistory(limit, projectId);
}

/**
 * Get pending items
 */
function getPendingItems(projectId = null, limit = 50) {
    return getQueueManager().getPendingItems(projectId, limit);
}

/**
 * Get retryable items
 */
function getRetryableItems(projectId = null, limit = 50) {
    return getQueueManager().getRetryableItems(projectId, limit);
}

/**
 * Retry a failed request
 */
function retryRequest(requestId, resetAttempts = false) {
    return getQueueManager().retryById(requestId, resetAttempts);
}

/**
 * Get statistics by context
 */
function getStatsByContext(projectId = null) {
    return getQueueManager().getStatsByContext(projectId);
}

/**
 * Cancel a request
 */
function cancelRequest(requestId) {
    return getQueueManager().cancel(requestId);
}

/**
 * Clear queue
 */
function clearQueue(projectId = null) {
    return getQueueManager().clear(projectId);
}

/**
 * Pause queue
 */
function pauseQueue() {
    return getQueueManager().pause();
}

/**
 * Resume queue
 */
function resumeQueue() {
    return getQueueManager().resume();
}

module.exports = {
    LLMQueueManager,
    getQueueManager,
    enqueue,
    getStatus,
    getHistory,
    getPendingItems,
    getRetryableItems,
    retryRequest,
    getStatsByContext,
    cancelRequest,
    clearQueue,
    pauseQueue,
    resumeQueue,
    PRIORITY
};
