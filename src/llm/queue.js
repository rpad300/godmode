/**
 * LLM Queue Manager - Global queue for LLM requests
 * Ensures only one LLM request is processed at a time to avoid rate limits
 * Hybrid: In-memory for real-time + Database for persistence & retry
 */

const EventEmitter = require('events');
const { calculateCost } = require('./modelMetadata');

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
        
        // Initialize database connection
        this.initDatabase();
        
        console.log('[LLMQueue] Queue manager initialized (parallel processing enabled)');
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
            const { getClient } = require('../supabase/client');
            const client = getClient();
            
            if (client) {
                this.dbEnabled = true;
                console.log('[LLMQueue] Database persistence enabled');
                
                // Start retry processor
                this.startRetryProcessor();
            } else {
                console.log('[LLMQueue] Database not configured, using in-memory only');
            }
        } catch (error) {
            console.warn('[LLMQueue] Failed to initialize database:', error.message);
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
                    console.log(`[LLMQueue] Found retry-pending item: ${result.request.id}`);
                    // Process will be handled by the claim - just trigger processNext
                    this.processRetryItem(result.request);
                }
            } catch (error) {
                console.warn('[LLMQueue] Retry processor error:', error.message);
            }
        }, this.config.retryCheckInterval);
        
        console.log('[LLMQueue] Retry processor started');
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
            console.warn('[LLMQueue] Could not get provider config for retry:', err.message);
        }
        
        const request = {
            ...dbRequest.inputData,
            provider: dbRequest.provider,
            model: dbRequest.model,
            context: dbRequest.context,
            _operation: dbRequest.requestType,
            providerConfig  // Add current provider config with API key
        };
        
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
                    console.warn('[LLMQueue] Failed to persist to database:', error.message);
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
            console.log(`[LLMQueue] Enqueued: ${id} (${context}) | Priority: ${priority} | Queue size: ${this.queue.length} | DB: ${dbId ? 'yes' : 'no'}`);
            
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
            console.log(`[LLMQueue] Processing ${itemsToProcess.length} requests in parallel | Keys: ${keys}`);
        }
        
        // Don't await - let them run in parallel
        Promise.all(processingPromises).catch(err => {
            console.error('[LLMQueue] Parallel processing error:', err);
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
        
        console.log(`[LLMQueue] Processing: ${item.id} (${context}) | Key: ${key} | Active: ${activeCount} | Waited: ${waitTime}ms | Remaining: ${this.queue.length}`);
        
        this.emit('processing', { id: item.id, dbId: item.dbId, waitTime, queueSize: this.queue.length, concurrencyKey: key, activeCount });
        
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
            
            console.log(`[LLMQueue] Completed: ${item.id} | Time: ${processingTime}ms | Tokens: ${inputTokens}/${outputTokens} | Cost: $${estimatedCost.toFixed(6)}`);
            
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
                    console.warn('[LLMQueue] Failed to update DB on complete:', dbError.message);
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
                
                console.log(`[LLMQueue] Rate limited: ${item.id} | Retry ${item.retries}/${item.maxRetries} in ${this.config.rateLimitDelay}ms`);
                
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
                        console.warn('[LLMQueue] Failed to update DB on rate limit:', dbError.message);
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
                
                console.log(`[LLMQueue] Timeout: ${item.id} | Retry ${item.retries}/${item.maxRetries}`);
                
                this.queue.unshift(item);
                
            } else {
                // Failed permanently
                item.status = 'failed';
                this.stats.totalFailed++;
                
                console.error(`[LLMQueue] Failed: ${item.id} | Error: ${error.message}`);
                
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
                        console.warn('[LLMQueue] Failed to update DB on failure:', dbError.message);
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
                console.warn('[LLMQueue] Failed to get database status:', error.message);
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
                console.warn('[LLMQueue] Failed to get database history:', error.message);
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
                console.warn('[LLMQueue] Failed to get database pending items:', error.message);
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
            console.warn('[LLMQueue] Failed to get retryable items:', error.message);
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
                console.log(`[LLMQueue] Queued retry for request: ${requestId}`);
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
            console.warn('[LLMQueue] Failed to get stats by context:', error.message);
            return [];
        }
    }
    
    /**
     * Pause processing
     */
    pause() {
        this.isPaused = true;
        console.log('[LLMQueue] Queue paused');
        this.emit('paused');
    }
    
    /**
     * Resume processing
     */
    resume() {
        this.isPaused = false;
        console.log('[LLMQueue] Queue resumed');
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
                    console.warn('[LLMQueue] Failed to cancel in database:', error.message);
                }
            }
            
            console.log(`[LLMQueue] Cancelled: ${requestId}`);
            this.emit('cancelled', { id: requestId, dbId: item.dbId });
            return true;
        }
        
        // Try to cancel in database directly (for pending retry items)
        if (this.dbEnabled && isDbId) {
            try {
                const result = await this.dbQueue.cancelRequest(requestId);
                if (result.success) {
                    console.log(`[LLMQueue] Cancelled in database: ${requestId}`);
                    this.emit('cancelled', { id: requestId, dbId: requestId });
                    return true;
                }
            } catch (error) {
                console.warn('[LLMQueue] Failed to cancel in database:', error.message);
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
                console.warn('[LLMQueue] Failed to clear database queue:', error.message);
            }
        }
        
        const totalCleared = memoryCount + dbCount;
        console.log(`[LLMQueue] Cleared ${totalCleared} pending requests (memory: ${memoryCount}, db: ${dbCount})`);
        this.emit('cleared', { count: totalCleared, memoryCount, dbCount });
        return totalCleared;
    }
    
    /**
     * Update configuration
     */
    configure(options) {
        Object.assign(this.config, options);
        console.log('[LLMQueue] Configuration updated:', this.config);
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
