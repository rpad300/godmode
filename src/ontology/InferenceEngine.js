/**
 * Purpose:
 *   Executes ontology inference rules against the knowledge graph to
 *   materialise implicit relationships (e.g. WORKS_WITH, KNOWS, PRODUCED).
 *   Supports both Cypher-defined rules and hard-coded native rules for
 *   the Supabase graph provider.
 *
 * Responsibilities:
 *   - Run all ontology-defined Cypher inference rules in sequence
 *   - For Supabase providers, run built-in native inference rules:
 *       * WORKS_WITH between people in the same organisation
 *       * KNOWS between co-attendees of the same meeting
 *       * PRODUCED linking meetings to their extracted actions
 *   - Run a single named rule on demand
 *   - Analyse the graph for new inference rule opportunities
 *   - Create and optionally persist custom inference rules
 *   - Support periodic (interval-based) automatic execution
 *
 * Key dependencies:
 *   - ../logger: structured logging
 *   - ./OntologyManager (singleton): provides inference rule definitions
 *   - Graph provider (injected): executes queries and creates relationships
 *
 * Side effects:
 *   - Creates new relationship edges in the graph database
 *   - Graph reads (findNodes, findRelationships, Cypher queries) during analysis
 *   - setInterval timer for periodic runs (must be stopped on shutdown)
 *
 * Notes:
 *   - Native inference uses createRelationship which silently ignores duplicates,
 *     so rules are safe to re-run idempotently.
 *   - The WORKS_WITH rule generates O(n^2) pairs per organisation; for large
 *     orgs the 500-person limit per findNodes call bounds the explosion.
 *   - createRule() validates Cypher syntax with EXPLAIN for non-Supabase
 *     providers; for Supabase it skips validation because Cypher is unused.
 *   - onSyncComplete() is designed to be wired as a post-sync hook in GraphSync.
 */

const { logger } = require('../logger');
const { getOntologyManager } = require('./OntologyManager');

const log = logger.child({ module: 'inference-engine' });

class InferenceEngine {
    constructor(options = {}) {
        this.ontology = options.ontology || getOntologyManager();
        this.graphProvider = options.graphProvider || null;
        
        // Statistics
        this.lastRun = null;
        this.stats = {
            runsCompleted: 0,
            totalRelationshipsInferred: 0,
            totalErrors: 0
        };
        
        // Configuration
        this.autoRunAfterSync = options.autoRunAfterSync !== false;
        this.periodicInterval = options.periodicInterval || null; // in ms
        this._periodicTimer = null;
    }

    /**
     * Check if provider supports native methods (Supabase) vs Cypher
     * @returns {boolean}
     */
    _isSupabaseProvider() {
        return this.graphProvider?.constructor?.name === 'SupabaseGraphProvider' ||
               typeof this.graphProvider?.supabase !== 'undefined';
    }

    /**
     * Set the graph provider
     * @param {object} graphProvider 
     */
    setGraphProvider(graphProvider) {
        this.graphProvider = graphProvider;
    }

    /**
     * Run all inference rules defined in the ontology
     * SOTA v3.0 - Supports both Cypher and native (Supabase) providers
     * @returns {Promise<{ok: boolean, results?: object, error?: string}>}
     */
    async runAllRules() {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph provider not connected' };
        }

        // For Supabase provider, use native inference methods
        if (this._isSupabaseProvider()) {
            return this._runNativeInference();
        }

        // For Cypher-based providers
        const rules = this.ontology.getInferenceCyphers();
        if (!rules || rules.length === 0) {
            log.debug({ event: 'inference_engine_no_rules' }, 'No inference rules defined');
            return { ok: true, results: { applied: 0, message: 'No rules defined' } };
        }

        const results = {
            applied: 0,
            skipped: 0,
            errors: [],
            details: []
        };

        log.info({ event: 'inference_engine_running', count: rules.length }, 'Running inference rules');

        for (const rule of rules) {
            try {
                const startTime = Date.now();
                const result = await this.graphProvider.query(rule.cypher);
                const duration = Date.now() - startTime;

                results.applied++;
                
                // Try to get stats from the result
                const relationshipsCreated = result.metadata?.relationshipsCreated || 
                                           result.stats?.relationships_created || 0;
                
                results.details.push({
                    name: rule.name,
                    description: rule.description,
                    success: true,
                    duration,
                    relationshipsCreated
                });

                this.stats.totalRelationshipsInferred += relationshipsCreated;
                
                if (relationshipsCreated > 0) {
                    log.debug({ event: 'inference_engine_rule_created', ruleName: rule.name, relationshipsCreated, duration }, 'Rule created relationships');
                } else {
                    log.debug({ event: 'inference_engine_rule_no_new', ruleName: rule.name, duration }, 'Rule no new relationships');
                }
            } catch (e) {
                results.errors.push({
                    name: rule.name,
                    error: e.message
                });
                this.stats.totalErrors++;
                log.error({ event: 'inference_engine_rule_error', ruleName: rule.name, reason: e.message }, 'Rule failed');
            }
        }

        this.lastRun = new Date().toISOString();
        this.stats.runsCompleted++;

        log.info({ event: 'inference_engine_complete', applied: results.applied, errors: results.errors.length }, 'Inference complete');
        return { ok: true, results };
    }

    /**
     * Run native inference for Supabase provider
     * Uses provider's findNodes and createRelationship methods
     * SOTA v3.0
     */
    async _runNativeInference() {
        const results = {
            applied: 0,
            skipped: 0,
            errors: [],
            details: [],
            relationships: 0
        };

        log.info({ event: 'inference_engine_native_start' }, 'Running native Supabase inference');
        const startTime = Date.now();

        try {
            // Rule 1: People in same organization WORKS_WITH each other
            const worksWithResult = await this._inferWorksWithRelationships();
            results.relationships += worksWithResult.created;
            results.details.push({ name: 'works_with_same_org', ...worksWithResult });

            // Rule 2: People in same meeting KNOWS each other
            const knowsResult = await this._inferKnowsFromMeetings();
            results.relationships += knowsResult.created;
            results.details.push({ name: 'knows_from_meetings', ...knowsResult });

            // Rule 3: Actions link to their source meetings
            const actionsResult = await this._inferActionMeetingLinks();
            results.relationships += actionsResult.created;
            results.details.push({ name: 'action_meeting_links', ...actionsResult });

            results.applied = results.details.filter(d => d.success).length;
            
            const duration = Date.now() - startTime;
            log.info({ event: 'inference_engine_native_complete', relationships: results.relationships, duration }, 'Native inference complete');

            this.stats.totalRelationshipsInferred += results.relationships;
            this.lastRun = new Date().toISOString();
            this.stats.runsCompleted++;

            return { ok: true, results };
        } catch (e) {
            log.error({ event: 'inference_engine_native_error', reason: e.message }, 'Native inference error');
            results.errors.push({ error: e.message });
            return { ok: false, error: e.message, results };
        }
    }

    /**
     * Infer WORKS_WITH relationships between people in same organization
     */
    async _inferWorksWithRelationships() {
        const result = { success: true, created: 0, checked: 0 };
        
        try {
            // Get all Person nodes
            const personResult = await this.graphProvider.findNodes('Person', {}, { limit: 500 });
            const persons = personResult.nodes || [];
            
            // Group by organization
            const byOrg = {};
            for (const person of persons) {
                const org = person.organization;
                if (org) {
                    if (!byOrg[org]) byOrg[org] = [];
                    byOrg[org].push(person);
                }
            }

            // Create WORKS_WITH for people in same org
            for (const [org, orgPersons] of Object.entries(byOrg)) {
                if (orgPersons.length < 2) continue;
                
                for (let i = 0; i < orgPersons.length; i++) {
                    for (let j = i + 1; j < orgPersons.length; j++) {
                        result.checked++;
                        try {
                            await this.graphProvider.createRelationship(
                                orgPersons[i].id,
                                orgPersons[j].id,
                                'WORKS_WITH',
                                { source: 'inference', organization: org }
                            );
                            result.created++;
                        } catch (e) {
                            // Relationship might already exist
                        }
                    }
                }
            }
        } catch (e) {
            result.success = false;
            result.error = e.message;
        }
        
        return result;
    }

    /**
     * Infer KNOWS relationships from meeting attendance
     */
    async _inferKnowsFromMeetings() {
        const result = { success: true, created: 0, checked: 0 };
        
        try {
            // Get all Meeting nodes
            const meetingResult = await this.graphProvider.findNodes('Meeting', {}, { limit: 200 });
            const meetings = meetingResult.nodes || [];

            for (const meeting of meetings) {
                // Get relationships to this meeting
                const relResult = await this.graphProvider.findRelationships({
                    toId: meeting.id,
                    type: 'PARTICIPATED_IN',
                    limit: 50
                });
                const participants = (relResult.relationships || []).map(r => r.from);
                
                if (participants.length < 2) continue;

                // Create KNOWS between participants
                for (let i = 0; i < participants.length; i++) {
                    for (let j = i + 1; j < participants.length; j++) {
                        result.checked++;
                        try {
                            await this.graphProvider.createRelationship(
                                participants[i],
                                participants[j],
                                'KNOWS',
                                { source: 'inference', via: 'meeting' }
                            );
                            result.created++;
                        } catch (e) {
                            // Relationship might already exist
                        }
                    }
                }
            }
        } catch (e) {
            result.success = false;
            result.error = e.message;
        }
        
        return result;
    }

    /**
     * Infer PRODUCED relationships between meetings and actions/decisions/facts
     */
    async _inferActionMeetingLinks() {
        const result = { success: true, created: 0, checked: 0 };
        
        try {
            // Get Actions with source_file
            const actionResult = await this.graphProvider.findNodes('Action', {}, { limit: 500 });
            const actions = actionResult.nodes || [];

            for (const action of actions) {
                const sourceFile = action.source_file || action.meeting;
                if (!sourceFile || sourceFile === 'unknown') continue;

                result.checked++;
                
                // Try to find meeting with matching source
                const meetingId = `meeting_${sourceFile}`;
                try {
                    const meetingResult = await this.graphProvider.getNode(meetingId);
                    if (meetingResult.ok && meetingResult.node) {
                        await this.graphProvider.createRelationship(
                            meetingId,
                            action.id,
                            'PRODUCED',
                            { source: 'inference' }
                        );
                        result.created++;
                    }
                } catch (e) {
                    // Meeting might not exist
                }
            }
        } catch (e) {
            result.success = false;
            result.error = e.message;
        }
        
        return result;
    }

    /**
     * Run a specific inference rule by name
     * SOTA v3.0 - Skips Cypher rules for Supabase (uses native inference instead)
     * @param {string} ruleName - Name of the rule to run
     * @returns {Promise<{ok: boolean, result?: object, error?: string}>}
     */
    async runRule(ruleName) {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph provider not connected' };
        }

        // For Supabase provider, use native inference methods
        if (this._isSupabaseProvider()) {
            log.debug({ event: 'inference_engine_supabase_native', ruleName }, 'Supabase provider: running native inference');
            const result = await this._runNativeInference();
            return { 
                ok: true, 
                result: {
                    name: ruleName,
                    description: 'Native Supabase inference',
                    data: result
                }
            };
        }

        // Cypher-based providers
        const rules = this.ontology.getInferenceCyphers();
        const rule = rules.find(r => r.name === ruleName);

        if (!rule) {
            return { ok: false, error: `Rule not found: ${ruleName}` };
        }

        try {
            const startTime = Date.now();
            const result = await this.graphProvider.query(rule.cypher);
            const duration = Date.now() - startTime;

            log.debug({ event: 'inference_engine_rule_ran', ruleName, duration }, 'Ran rule');
            return { 
                ok: true, 
                result: {
                    name: rule.name,
                    description: rule.description,
                    duration,
                    data: result
                }
            };
        } catch (e) {
            log.error({ event: 'inference_engine_rule_failed', ruleName, reason: e.message }, 'Rule failed');
            return { ok: false, error: e.message };
        }
    }

    /**
     * Get list of available inference rules
     * @returns {Array<{name: string, description: string}>}
     */
    getAvailableRules() {
        const rules = this.ontology.getInferenceCyphers();
        return rules.map(r => ({
            name: r.name,
            description: r.description
        }));
    }

    /**
     * Get inference statistics
     * @returns {object}
     */
    getStats() {
        return {
            ...this.stats,
            lastRun: this.lastRun,
            periodicEnabled: !!this._periodicTimer
        };
    }

    /**
     * Start periodic inference execution
     * @param {number} intervalMs - Interval in milliseconds (default: 5 minutes)
     */
    startPeriodicRun(intervalMs = 5 * 60 * 1000) {
        if (this._periodicTimer) {
            this.stopPeriodicRun();
        }

        log.info({ event: 'inference_engine_periodic_start', intervalSeconds: intervalMs / 1000 }, 'Starting periodic inference');
        
        this._periodicTimer = setInterval(async () => {
            log.debug({ event: 'inference_engine_scheduled_run' }, 'Running scheduled inference');
            await this.runAllRules();
        }, intervalMs);

        this.periodicInterval = intervalMs;
    }

    /**
     * Stop periodic inference execution
     */
    stopPeriodicRun() {
        if (this._periodicTimer) {
            clearInterval(this._periodicTimer);
            this._periodicTimer = null;
            log.debug({ event: 'inference_engine_periodic_stopped' }, 'Stopped periodic inference');
        }
    }

    /**
     * Callback to run after GraphSync completes
     * Can be registered as a hook
     */
    async onSyncComplete() {
        if (this.autoRunAfterSync) {
            log.debug({ event: 'inference_engine_after_sync' }, 'Running inference after sync');
            return this.runAllRules();
        }
    }

    /**
     * Analyze graph for potential inference opportunities
     * Returns suggestions for new rules based on data patterns
     * SOTA v3.0 - Supports both Cypher and native providers
     * @returns {Promise<{suggestions: Array}>}
     */
    async analyzeForNewRules() {
        if (!this.graphProvider?.connected) {
            return { suggestions: [] };
        }

        const suggestions = [];

        try {
            // For Supabase provider, use native analysis
            if (this._isSupabaseProvider()) {
                return this._analyzeNative();
            }

            // For Cypher-based providers
            const cooccurrence = await this.graphProvider.query(`
                MATCH (a), (b)
                WHERE a <> b 
                  AND NOT (a)-[]-(b)
                  AND labels(a)[0] <> labels(b)[0]
                  AND NOT labels(a)[0] STARTS WITH '__'
                  AND NOT labels(b)[0] STARTS WITH '__'
                WITH labels(a)[0] as typeA, labels(b)[0] as typeB, count(*) as pairs
                WHERE pairs > 10
                RETURN typeA, typeB, pairs
                ORDER BY pairs DESC
                LIMIT 10
            `);

            for (const row of cooccurrence.results || []) {
                suggestions.push({
                    type: 'missing_relation',
                    fromType: row.typeA,
                    toType: row.typeB,
                    evidence: `${row.pairs} unconnected pairs found`,
                    suggestion: `Consider adding inference rule for ${row.typeA} -> ${row.typeB}`
                });
            }

            // Find entities that share attributes but aren't linked
            const sharedAttributes = await this.graphProvider.query(`
                MATCH (a:Person), (b:Person)
                WHERE a <> b 
                  AND a.organization IS NOT NULL
                  AND a.organization = b.organization
                  AND NOT (a)-[:WORKS_WITH]-(b)
                RETURN 'Person' as type, a.organization as sharedValue, count(*) as pairs
                LIMIT 5
            `);

            for (const row of sharedAttributes.results || []) {
                if (row.pairs > 5) {
                    suggestions.push({
                        type: 'attribute_based',
                        entityType: row.type,
                        attribute: 'organization',
                        sharedValue: row.sharedValue,
                        evidence: `${row.pairs} people at ${row.sharedValue} not linked as WORKS_WITH`,
                        suggestion: 'Consider adding inference rule for same-organization colleagues'
                    });
                }
            }

        } catch (e) {
            log.error({ event: 'inference_engine_analysis_failed', reason: e.message }, 'Analysis failed');
        }

        return { suggestions };
    }

    /**
     * Native analysis for Supabase provider
     */
    async _analyzeNative() {
        const suggestions = [];

        try {
            // Get statistics
            const stats = await this.graphProvider.getStats();
            const labelCounts = stats?.stats?.labels || {};
            const typeCounts = stats?.stats?.relationshipTypes || {};

            // Check for Person nodes without relationships
            const personResult = await this.graphProvider.findNodes('Person', {}, { limit: 100 });
            const persons = personResult.nodes || [];
            
            const orphanedPersons = [];
            for (const person of persons.slice(0, 20)) { // Sample first 20
                const relResult = await this.graphProvider.findRelationships({ fromId: person.id, limit: 1 });
                const relResult2 = await this.graphProvider.findRelationships({ toId: person.id, limit: 1 });
                if ((relResult.relationships || []).length === 0 && (relResult2.relationships || []).length === 0) {
                    orphanedPersons.push(person);
                }
            }

            if (orphanedPersons.length > 3) {
                suggestions.push({
                    type: 'orphaned_nodes',
                    entityType: 'Person',
                    count: orphanedPersons.length,
                    suggestion: 'Several Person nodes have no relationships. Consider running relationship inference.'
                });
            }

            // Check for organizations without WORKS_WITH relationships
            const orgs = new Set(persons.filter(p => p.organization).map(p => p.organization));
            if (orgs.size > 0 && !typeCounts['WORKS_WITH']) {
                suggestions.push({
                    type: 'missing_inference',
                    rule: 'WORKS_WITH',
                    evidence: `${orgs.size} organizations found but no WORKS_WITH relationships`,
                    suggestion: 'Run inference to create WORKS_WITH relationships between colleagues'
                });
            }

            log.debug({ event: 'inference_engine_native_analysis', count: suggestions.length }, 'Native analysis');
        } catch (e) {
            log.error({ event: 'inference_engine_native_analysis_error', reason: e.message }, 'Native analysis error');
        }

        return { suggestions };
    }

    /**
     * Create a custom inference rule and optionally save to ontology
     * SOTA v3.0 - Skips Cypher EXPLAIN validation for Supabase
     * @param {object} ruleDef - Rule definition with name, description, cypher
     * @param {boolean} persist - Whether to persist to ontology
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async createRule(ruleDef, persist = false) {
        if (!ruleDef.name || !ruleDef.cypher) {
            return { ok: false, error: 'Rule must have name and cypher' };
        }

        // Skip Cypher validation for Supabase (uses native inference instead)
        if (!this._isSupabaseProvider()) {
            // Test the rule first for Cypher-based providers
            try {
                // Validate Cypher syntax with EXPLAIN
                await this.graphProvider.query(`EXPLAIN ${ruleDef.cypher}`);
            } catch (e) {
                return { ok: false, error: `Invalid Cypher: ${e.message}` };
            }
        } else {
            log.debug({ event: 'inference_engine_skip_cypher_validation', ruleName: ruleDef.name }, 'Supabase provider: skipping Cypher validation');
        }

        if (persist) {
            // Add to ontology
            const schema = this.ontology.getSchema();
            const rules = schema.inferenceRules || [];
            rules.push({
                name: ruleDef.name,
                description: ruleDef.description || '',
                cypher: ruleDef.cypher
            });
            
            await this.ontology.updateSchema({ inferenceRules: rules });
        }

        return { ok: true };
    }
}

// Singleton instance
let inferenceEngineInstance = null;

/**
 * Get the InferenceEngine singleton
 * @param {object} options 
 * @returns {InferenceEngine}
 */
function getInferenceEngine(options = {}) {
    if (!inferenceEngineInstance) {
        inferenceEngineInstance = new InferenceEngine(options);
    }
    return inferenceEngineInstance;
}

module.exports = {
    InferenceEngine,
    getInferenceEngine
};
