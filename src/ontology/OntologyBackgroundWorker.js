/**
 * OntologyBackgroundWorker - Background optimization for ontology
 * 
 * SOTA v2.0 - Continuous Ontology Optimization
 * SOTA v3.0 - Native Supabase graph support (no Cypher dependency)
 * 
 * Runs in background to:
 * - Analyze graph for gaps between data and schema
 * - Generate suggestions proactively
 * - Execute inference rules
 * - Check for duplicates (people, organizations)
 * - Auto-approve high-confidence suggestions
 */

class OntologyBackgroundWorker {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider || null;
        this.storage = options.storage || null;
        this.llmConfig = options.llmConfig || null;
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
                    storage: this.storage
                });
            } catch (e) {
                console.log('[OntologyBackgroundWorker] EntityResolver not available:', e.message);
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
                    llmConfig: this.llmConfig
                });
            } catch (e) {
                console.log('[OntologyBackgroundWorker] OrganizationResolver not available:', e.message);
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
     * Run full analysis pipeline
     * This is the main entry point for scheduled jobs
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
            console.log('[OntologyBackgroundWorker] Starting full analysis...');
            this.isRunning = true;

            // 1. Check if graph is available and has enough data
            if (!this.graphProvider) {
                throw new Error('Graph provider not available');
            }

            const nodeCount = await this._getNodeCount();
            if (nodeCount < this.minNodesForAnalysis) {
                execution.results.skipped = true;
                execution.results.reason = `Not enough nodes (${nodeCount} < ${this.minNodesForAnalysis})`;
                console.log(`[OntologyBackgroundWorker] Skipping analysis: ${execution.results.reason}`);
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
            console.error('[OntologyBackgroundWorker] Full analysis error:', error.message);
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
            console.error('[OntologyBackgroundWorker] checkForGaps error:', error.message);
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
            console.log('[OntologyBackgroundWorker] Running inference rules...');
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
            console.error('[OntologyBackgroundWorker] Inference rules error:', error.message);
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
            console.log('[OntologyBackgroundWorker] Checking for duplicates...');

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
            console.error('[OntologyBackgroundWorker] Deduplication error:', error.message);
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
            console.log(`[OntologyBackgroundWorker] Auto-approving suggestions (threshold: ${threshold})...`);
            const agent = this.getOntologyAgent();
            
            if (!agent) {
                throw new Error('OntologyAgent not available');
            }

            const result = await agent.autoApproveHighConfidence(threshold);
            execution.results = result;

            execution.status = 'completed';
            this.lastRun.autoApprove = new Date().toISOString();

        } catch (error) {
            console.error('[OntologyBackgroundWorker] Auto-approve error:', error.message);
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
     * Schedule incremental analysis (debounced)
     * Called after new data is synced
     */
    scheduleAnalysis(type = 'incremental') {
        if (this.pendingAnalysis) {
            clearTimeout(this.pendingAnalysis);
        }

        console.log(`[OntologyBackgroundWorker] Scheduling ${type} analysis in ${this.analysisDebounceMs / 1000}s...`);

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
            console.log('[OntologyBackgroundWorker] Cancelled pending analysis');
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
            console.log('[OntologyBackgroundWorker] _getNodeCount error:', e.message);
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
     * Normalize name for comparison
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
        console.log(`[OntologyBackgroundWorker] ${execution.type}: ${execution.status} (${execution.duration}ms)`);
    }
}

// Singleton
let instance = null;

function getOntologyBackgroundWorker(options = {}) {
    if (!instance) {
        instance = new OntologyBackgroundWorker(options);
    }
    // Update dependencies if provided
    if (options.graphProvider) instance.setGraphProvider(options.graphProvider);
    if (options.storage) instance.setStorage(options.storage);
    if (options.llmConfig) instance.setLLMConfig(options.llmConfig);
    if (options.dataDir) instance.dataDir = options.dataDir;
    return instance;
}

module.exports = { OntologyBackgroundWorker, getOntologyBackgroundWorker };
