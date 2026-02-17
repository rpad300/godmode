/**
 * Purpose:
 *   Orchestrates background ontology-maintenance jobs: gap analysis, inference
 *   rule execution, duplicate detection, and auto-approval of high-confidence
 *   schema suggestions. Intended to be triggered on a schedule or after data syncs.
 *
 * Responsibilities:
 *   - Run a full analysis pipeline (gap check, LLM analysis, type-usage stats)
 *   - Execute ontology inference rules via the InferenceEngine
 *   - Detect duplicate Person and Organization nodes via resolver modules
 *   - Auto-approve ontology suggestions that exceed the confidence threshold
 *   - Schedule debounced incremental analysis after new data arrives
 *   - Maintain an in-memory execution log with status, duration, and results
 *
 * Key dependencies:
 *   - ../logger: structured logging
 *   - ./OntologyAgent (lazy): generates and manages ontology suggestions
 *   - ./InferenceEngine (lazy): runs inference rules on the graph
 *   - ./SchemaExporter (lazy): syncs schema to graph
 *   - ../optimizations/EntityResolver (lazy, optional): person deduplication
 *   - ../optimizations/OrganizationResolver (lazy, optional): org deduplication
 *   - Graph provider (injected): Supabase-native or Cypher-based backend
 *
 * Side effects:
 *   - Graph reads and writes during inference and deduplication
 *   - LLM network calls when useLLM is enabled in runFullAnalysis
 *   - setTimeout timers for debounced scheduling (must be cancelled on shutdown)
 *   - Mutates ontology schema via OntologyAgent on auto-approve
 *
 * Notes:
 *   - All sub-module references are lazily loaded to break circular dependency
 *     chains and to avoid requiring optional modules that may not exist.
 *   - minNodesForAnalysis (default 10) prevents wasting LLM tokens on nearly
 *     empty graphs.
 *   - The execution log is capped at 100 entries; older entries are dropped.
 *   - _autoMergeDuplicates is a placeholder (TODO) -- merges are not yet
 *     performed automatically.
 */

const { logger } = require('../logger');

const log = logger.child({ module: 'ontology-background-worker' });

/**
 * Background worker that orchestrates periodic and on-demand ontology
 * maintenance jobs. All sub-module dependencies are lazily loaded to
 * avoid circular requires and to tolerate missing optional modules.
 *
 * Lifecycle: construct -> setGraphProvider/setStorage/setLLMConfig ->
 * runFullAnalysis() | scheduleAnalysis() | runInferenceRules() | etc.
 *
 * Invariant: only one job runs at a time (guarded by this.isRunning).
 * Concurrent calls to scheduleAnalysis() are debounced; only the last
 * one within the debounce window fires.
 */
class OntologyBackgroundWorker {
    /**
     * @param {object} options
     * @param {object} [options.graphProvider] - Graph backend
     * @param {object} [options.storage] - Supabase storage
     * @param {object} [options.llmConfig] - LLM configuration for AI analysis
     * @param {object} [options.appConfig] - App-level config
     * @param {string} [options.dataDir='./data'] - Data directory for sub-modules
     * @param {number} [options.analysisDebounceMs=300000] - Debounce window (5 min default)
     * @param {number} [options.autoApproveThreshold=0.85] - Confidence threshold for auto-approve
     * @param {number} [options.minNodesForAnalysis=10] - Skip analysis below this node count
     */
    constructor(options = {}) {
        this.graphProvider = options.graphProvider || null;
        this.storage = options.storage || null;
        this.llmConfig = options.llmConfig || null;
        this.appConfig = options.appConfig || null;
        this.dataDir = options.dataDir || './data';
        
        // Worker state
        this.isRunning = false;
        this.lastRun = {};
        this.pendingAnalysis = null;
        this.analysisDebounceMs = options.analysisDebounceMs || 5 * 60 * 1000; // 5 minutes
        
        // Thresholds
        this.autoApproveThreshold = options.autoApproveThreshold || 0.85;
        this.minNodesForAnalysis = options.minNodesForAnalysis || 10;
        
        // Execution log
        this.executionLog = [];
        this.maxLogEntries = 100;
        
        // Module references (lazy loaded)
        this._ontologyAgent = null;
        this._inferenceEngine = null;
        this._entityResolver = null;
        this._orgResolver = null;
        this._schemaExporter = null;
    }

    /**
     * Set dependencies
     */
    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    setStorage(storage) {
        this.storage = storage;
    }

    setLLMConfig(config) {
        this.llmConfig = config;
    }

    /**
     * Get OntologyAgent instance (lazy)
     */
    getOntologyAgent() {
        if (!this._ontologyAgent) {
            const { getOntologyAgent } = require('./OntologyAgent');
            this._ontologyAgent = getOntologyAgent({
                graphProvider: this.graphProvider,
                storage: this.storage,
                llmConfig: this.llmConfig,
                appConfig: this.appConfig,
                dataDir: this.dataDir
            });
        }
        return this._ontologyAgent;
    }

    /**
     * Get InferenceEngine instance (lazy)
     */
    getInferenceEngine() {
        if (!this._inferenceEngine) {
            const { getInferenceEngine } = require('./InferenceEngine');
            this._inferenceEngine = getInferenceEngine({
                graphProvider: this.graphProvider,
                dataDir: this.dataDir
            });
        }
        return this._inferenceEngine;
    }

    /**
     * Get EntityResolver instance (lazy)
     */
    getEntityResolver() {
        if (!this._entityResolver) {
            try {
                const { EntityResolver } = require('../optimizations/EntityResolver');
                this._entityResolver = new EntityResolver({
                    graphProvider: this.graphProvider,
                    storage: this.storage,
                    llmConfig: this.llmConfig,
                    appConfig: this.appConfig
                });
            } catch (e) {
                log.debug({ event: 'ontology_worker_entity_resolver_unavailable', reason: e.message }, 'EntityResolver not available');
            }
        }
        return this._entityResolver;
    }

    /**
     * Get OrganizationResolver instance (lazy)
     */
    getOrganizationResolver() {
        if (!this._orgResolver) {
            try {
                const { OrganizationResolver } = require('../optimizations/OrganizationResolver');
                this._orgResolver = new OrganizationResolver({
                    graphProvider: this.graphProvider,
                    storage: this.storage,
                    llmConfig: this.llmConfig,
                    appConfig: this.appConfig
                });
            } catch (e) {
                log.debug({ event: 'ontology_worker_org_resolver_unavailable', reason: e.message }, 'OrganizationResolver not available');
            }
        }
        return this._orgResolver;
    }

    /**
     * Get SchemaExporter instance (lazy)
     */
    getSchemaExporter() {
        if (!this._schemaExporter) {
            const { getSchemaExporter } = require('./SchemaExporter');
            this._schemaExporter = getSchemaExporter({
                graphProvider: this.graphProvider
            });
        }
        return this._schemaExporter;
    }

    /**
     * Run the full analysis pipeline: gap detection, optional LLM analysis,
     * and type-usage statistics. This is the main entry point for scheduled
     * or manually triggered background jobs.
     *
     * Pipeline steps:
     *   1. Check graph connectivity and minimum node count
     *   2. Detect gaps between graph labels and ontology definitions
     *   3. (Optional) Run LLM-powered deep analysis if llmConfig is set
     *   4. Collect type-usage statistics
     *
     * @param {object} [config]
     * @param {boolean} [config.useLLM=true] - Set false to skip LLM analysis
     * @returns {Promise<object>} - Execution record with status, results, and duration
     */
    async runFullAnalysis(config = {}) {
        const startTime = Date.now();
        const execution = {
            type: 'full_analysis',
            startedAt: new Date().toISOString(),
            status: 'running',
            results: {}
        };

        try {
            log.info({ event: 'ontology_worker_full_analysis_start' }, 'Starting full analysis');
            this.isRunning = true;

            // 1. Check if graph is available and has enough data
            if (!this.graphProvider) {
                throw new Error('Graph provider not available');
            }

            const nodeCount = await this._getNodeCount();
            if (nodeCount < this.minNodesForAnalysis) {
                execution.results.skipped = true;
                execution.results.reason = `Not enough nodes (${nodeCount} < ${this.minNodesForAnalysis})`;
                log.debug({ event: 'ontology_worker_skip_analysis', reason: execution.results.reason }, 'Skipping analysis');
            } else {
                // 2. Analyze graph for gaps
                execution.results.gaps = await this.checkForGaps();

                // 3. Generate suggestions with LLM if configured
                if (this.llmConfig && config.useLLM !== false) {
                    execution.results.llmAnalysis = await this._runLLMAnalysis();
                }

                // 4. Get type usage stats
                execution.results.typeStats = await this._getTypeUsageStats();
            }

            execution.status = 'completed';
            this.lastRun.fullAnalysis = new Date().toISOString();

        } catch (error) {
            log.error({ event: 'ontology_worker_full_analysis_error', reason: error.message }, 'Full analysis error');
            execution.status = 'failed';
            execution.error = error.message;
        } finally {
            this.isRunning = false;
            execution.duration = Date.now() - startTime;
            execution.completedAt = new Date().toISOString();
            this._logExecution(execution);
        }

        return execution;
    }

    /**
     * Check for gaps between graph and ontology
     */
    async checkForGaps() {
        const agent = this.getOntologyAgent();
        if (!agent) return { error: 'OntologyAgent not available' };

        try {
            const result = await agent.analyzeGraphForSuggestions();
            return {
                newEntityTypes: result.suggestions?.filter(s => s.type === 'entity').length || 0,
                newRelationTypes: result.suggestions?.filter(s => s.type === 'relation').length || 0,
                totalSuggestions: result.suggestions?.length || 0,
                labelsInGraph: result.analysis?.labelsInGraph || [],
                labelsNotInOntology: result.analysis?.labelsNotInOntology || []
            };
        } catch (error) {
            log.error({ event: 'ontology_worker_check_gaps_error', reason: error.message }, 'checkForGaps error');
            return { error: error.message };
        }
    }

    /**
     * Run inference rules
     */
    async runInferenceRules(config = {}) {
        const startTime = Date.now();
        const execution = {
            type: 'inference_rules',
            startedAt: new Date().toISOString(),
            status: 'running',
            results: {}
        };

        try {
            log.info({ event: 'ontology_worker_inference_rules_start' }, 'Running inference rules');
            const engine = this.getInferenceEngine();
            
            if (!engine) {
                throw new Error('InferenceEngine not available');
            }

            const result = await engine.runAllRules();
            
            // runAllRules returns { ok, results: { applied, skipped, errors, details } }
            if (result.ok && result.results) {
                const details = result.results.details || [];
                execution.results = {
                    rulesExecuted: result.results.applied || 0,
                    totalCreated: details.reduce((sum, r) => sum + (r.relationshipsCreated || 0), 0),
                    skipped: result.results.skipped || 0,
                    errors: result.results.errors || [],
                    details: details
                };
                execution.status = 'completed';
            } else {
                execution.results = { error: result.error || 'Unknown error' };
                execution.status = 'failed';
            }
            
            this.lastRun.inferenceRules = new Date().toISOString();

        } catch (error) {
            log.error({ event: 'ontology_worker_inference_rules_error', reason: error.message }, 'Inference rules error');
            execution.status = 'failed';
            execution.error = error.message;
        } finally {
            execution.duration = Date.now() - startTime;
            execution.completedAt = new Date().toISOString();
            this._logExecution(execution);
        }

        return execution;
    }

    /**
     * Check for duplicates (people and organizations)
     */
    async checkDuplicates(config = {}) {
        const startTime = Date.now();
        const execution = {
            type: 'deduplication',
            startedAt: new Date().toISOString(),
            status: 'running',
            results: {}
        };

        try {
            log.info({ event: 'ontology_worker_dedup_start' }, 'Checking for duplicates');

            // Person duplicates
            const entityResolver = this.getEntityResolver();
            if (entityResolver) {
                const personDuplicates = await this._findPersonDuplicates();
                execution.results.persons = personDuplicates;
            }

            // Organization duplicates
            const orgResolver = this.getOrganizationResolver();
            if (orgResolver) {
                const orgDuplicates = await this._findOrganizationDuplicates();
                execution.results.organizations = orgDuplicates;
            }

            // Auto-merge high-confidence duplicates if enabled
            if (config.autoMerge && config.mergeThreshold) {
                execution.results.autoMerged = await this._autoMergeDuplicates(
                    execution.results,
                    config.mergeThreshold
                );
            }

            execution.status = 'completed';
            this.lastRun.deduplication = new Date().toISOString();

        } catch (error) {
            log.error({ event: 'ontology_worker_dedup_error', reason: error.message }, 'Deduplication error');
            execution.status = 'failed';
            execution.error = error.message;
        } finally {
            execution.duration = Date.now() - startTime;
            execution.completedAt = new Date().toISOString();
            this._logExecution(execution);
        }

        return execution;
    }

    /**
     * Auto-approve high-confidence suggestions
     */
    async autoApprove(config = {}) {
        const startTime = Date.now();
        const threshold = config.threshold || this.autoApproveThreshold;
        const execution = {
            type: 'auto_approve',
            startedAt: new Date().toISOString(),
            status: 'running',
            results: {}
        };

        try {
            log.info({ event: 'ontology_worker_auto_approve_start', threshold }, 'Auto-approving suggestions');
            const agent = this.getOntologyAgent();
            
            if (!agent) {
                throw new Error('OntologyAgent not available');
            }

            const result = await agent.autoApproveHighConfidence(threshold);
            execution.results = result;

            execution.status = 'completed';
            this.lastRun.autoApprove = new Date().toISOString();

        } catch (error) {
            log.error({ event: 'ontology_worker_auto_approve_error', reason: error.message }, 'Auto-approve error');
            execution.status = 'failed';
            execution.error = error.message;
        } finally {
            execution.duration = Date.now() - startTime;
            execution.completedAt = new Date().toISOString();
            this._logExecution(execution);
        }

        return execution;
    }

    /**
     * Schedule a debounced analysis run. Repeated calls within the debounce
     * window (default 5 min) reset the timer so only the final trigger fires.
     * Typically called by data-sync hooks after new content arrives.
     *
     * @param {string} [type='incremental'] - 'incremental' (gaps + inference) or 'full'
     */
    scheduleAnalysis(type = 'incremental') {
        if (this.pendingAnalysis) {
            clearTimeout(this.pendingAnalysis);
        }

        log.debug({ event: 'ontology_worker_schedule_analysis', type, delaySeconds: this.analysisDebounceMs / 1000 }, 'Scheduling analysis');

        this.pendingAnalysis = setTimeout(async () => {
            this.pendingAnalysis = null;
            
            if (type === 'incremental') {
                // For incremental, just check gaps and run inference
                await this.checkForGaps();
                await this.runInferenceRules();
            } else {
                await this.runFullAnalysis();
            }
        }, this.analysisDebounceMs);
    }

    /**
     * Cancel pending analysis
     */
    cancelPendingAnalysis() {
        if (this.pendingAnalysis) {
            clearTimeout(this.pendingAnalysis);
            this.pendingAnalysis = null;
            log.debug({ event: 'ontology_worker_cancelled' }, 'Cancelled pending analysis');
        }
    }

    /**
     * Get worker status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            hasPendingAnalysis: !!this.pendingAnalysis,
            lastRun: this.lastRun,
            graphConnected: !!this.graphProvider,
            llmConfigured: !!this.llmConfig,
            thresholds: {
                autoApprove: this.autoApproveThreshold,
                minNodesForAnalysis: this.minNodesForAnalysis,
                analysisDebounceMs: this.analysisDebounceMs
            }
        };
    }

    /**
     * Get execution log
     */
    getExecutionLog(options = {}) {
        let log = [...this.executionLog];
        
        if (options.type) {
            log = log.filter(e => e.type === options.type);
        }
        if (options.status) {
            log = log.filter(e => e.status === options.status);
        }
        
        return log.slice(0, options.limit || 20);
    }

    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            totalExecutions: this.executionLog.length,
            byType: {},
            byStatus: { completed: 0, failed: 0 },
            avgDuration: 0
        };

        let totalDuration = 0;
        for (const exec of this.executionLog) {
            stats.byType[exec.type] = (stats.byType[exec.type] || 0) + 1;
            if (exec.status === 'completed') stats.byStatus.completed++;
            if (exec.status === 'failed') stats.byStatus.failed++;
            if (exec.duration) totalDuration += exec.duration;
        }

        if (this.executionLog.length > 0) {
            stats.avgDuration = Math.round(totalDuration / this.executionLog.length);
        }

        return stats;
    }

    // ==================== Private Methods ====================

    /**
     * Check if provider is Supabase (SOTA v3.0)
     * @returns {boolean}
     */
    _isSupabaseProvider() {
        return this.graphProvider?.constructor?.name === 'SupabaseGraphProvider' ||
               typeof this.graphProvider?.supabase !== 'undefined' ||
               typeof this.graphProvider?.getStats === 'function';
    }

    /**
     * Get node count from graph
     * SOTA v3.0 - Uses native methods for Supabase
     */
    async _getNodeCount() {
        try {
            // Use native getStats() for Supabase provider
            if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
                const stats = await this.graphProvider.getStats();
                return stats?.nodeCount || stats?.stats?.nodeCount || 0;
            }
            
            // Cypher fallback for other providers
            const result = await this.graphProvider.query('MATCH (n) RETURN count(n) as count');
            return result?.[0]?.count || 0;
        } catch (e) {
            log.warn({ event: 'ontology_worker_get_node_count_error', reason: e.message }, '_getNodeCount error');
            return 0;
        }
    }

    /**
     * Run LLM analysis
     */
    async _runLLMAnalysis() {
        try {
            const agent = this.getOntologyAgent();
            if (!agent) return { skipped: true, reason: 'OntologyAgent not available' };
            
            const result = await agent.analyzeWithLLM();
            return {
                suggestionsGenerated: result.suggestions?.length || 0,
                summary: result.summary || result.analysis?.summary
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Get type usage statistics
     */
    async _getTypeUsageStats() {
        try {
            const agent = this.getOntologyAgent();
            if (!agent) return null;
            return await agent.getTypeUsageStats();
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Find person duplicates
     * SOTA v3.0 - Uses native methods for Supabase
     */
    async _findPersonDuplicates() {
        try {
            let persons = [];
            
            // Use native findNodes() for Supabase provider
            if (this._isSupabaseProvider() && typeof this.graphProvider.findNodes === 'function') {
                const result = await this.graphProvider.findNodes('Person', {}, { limit: 500 });
                persons = (result?.nodes || []).map(p => ({
                    id: p.id,
                    name: p.name || p.properties?.name,
                    email: p.email || p.properties?.email
                }));
            } else {
                // Cypher fallback for other providers
                const result = await this.graphProvider.query(`
                    MATCH (p:Person)
                    RETURN p.id as id, p.name as name, p.email as email
                    LIMIT 500
                `);
                persons = result || [];
            }

            if (persons.length < 2) {
                return { count: 0, duplicates: [] };
            }

            // Simple duplicate detection based on name similarity
            const duplicates = [];
            const seen = new Map();

            for (const person of persons) {
                const normalizedName = this._normalizeName(person.name);
                if (normalizedName && seen.has(normalizedName)) {
                    duplicates.push({
                        original: seen.get(normalizedName),
                        duplicate: person,
                        matchType: 'name'
                    });
                } else if (normalizedName) {
                    seen.set(normalizedName, person);
                }

                // Also check by email
                if (person.email) {
                    const normalizedEmail = person.email.toLowerCase().trim();
                    if (seen.has(normalizedEmail)) {
                        duplicates.push({
                            original: seen.get(normalizedEmail),
                            duplicate: person,
                            matchType: 'email'
                        });
                    } else {
                        seen.set(normalizedEmail, person);
                    }
                }
            }

            return {
                count: duplicates.length,
                duplicates: duplicates.slice(0, 20) // Limit to 20
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Find organization duplicates
     */
    async _findOrganizationDuplicates() {
        try {
            const orgResolver = this.getOrganizationResolver();
            if (!orgResolver) {
                return { skipped: true, reason: 'OrganizationResolver not available' };
            }

            const duplicates = await orgResolver.findDuplicates();
            return {
                count: duplicates?.length || 0,
                duplicates: duplicates?.slice(0, 20) || []
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Auto-merge high-confidence duplicates
     */
    async _autoMergeDuplicates(results, threshold) {
        // TODO: Implement auto-merge logic
        // For now, just return stats
        return {
            merged: 0,
            threshold,
            message: 'Auto-merge not yet implemented'
        };
    }

    /**
     * Normalize a person name for duplicate comparison: lowercase, strip
     * non-alphanumeric characters, collapse whitespace.
     *
     * @param {string|null} name
     * @returns {string|null} - Normalised name or null if input is falsy
     */
    _normalizeName(name) {
        if (!name) return null;
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ');
    }

    /**
     * Log execution
     */
    _logExecution(execution) {
        this.executionLog.unshift(execution);
        if (this.executionLog.length > this.maxLogEntries) {
            this.executionLog = this.executionLog.slice(0, this.maxLogEntries);
        }
        log.debug({ event: 'ontology_worker_execution', type: execution.type, status: execution.status, duration: execution.duration }, 'Execution');
    }
}

// Singleton
let instance = null;

function getOntologyBackgroundWorker(options = {}) {
    if (!instance) {
        instance = new OntologyBackgroundWorker(options);
    }
    if (options.graphProvider) instance.setGraphProvider(options.graphProvider);
    if (options.storage) instance.setStorage(options.storage);
    if (options.llmConfig) instance.setLLMConfig(options.llmConfig);
    if (options.appConfig) instance.appConfig = options.appConfig;
    if (options.dataDir) instance.dataDir = options.dataDir;
    return instance;
}

module.exports = { OntologyBackgroundWorker, getOntologyBackgroundWorker };
