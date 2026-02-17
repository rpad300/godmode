/**
 * Purpose:
 *   AI-powered agent that analyses incoming data and the live graph to
 *   propose, enrich, and (optionally auto-approve) ontology schema changes
 *   such as new entity types, relation types, and properties.
 *
 * Responsibilities:
 *   - Analyse entity/relationship extractions and flag types not yet in the schema
 *   - Compare graph labels/relation types against the ontology to find gaps
 *   - Use an LLM to perform deep schema-gap analysis and suggest improvements
 *   - Enrich individual suggestions with AI-generated descriptions and properties
 *   - Manage a queue of pending suggestions (approve / reject / auto-approve)
 *   - Persist suggestions to Supabase and a local JSON file as fallback
 *   - Collect type-usage statistics from the graph for reporting
 *
 * Key dependencies:
 *   - ../llm: unified LLM text-generation interface (provider-agnostic)
 *   - ../llm/config: per-task LLM configuration resolver
 *   - ./OntologyManager (singleton): canonical schema for comparison and mutation
 *   - fs / path: local file persistence for suggestions
 *   - SupabaseStorage (injected): optional remote persistence for suggestions
 *
 * Side effects:
 *   - LLM network calls during analyzeWithLLM() and enrichSuggestionWithAI()
 *   - File-system reads/writes to data/ontology-suggestions.json
 *   - Supabase writes when persisting or updating suggestions
 *   - Graph queries (native or Cypher) for label/relation counts
 *   - Mutates OntologyManager schema on approval via updateSchema()
 *
 * Notes:
 *   - AUTO_APPROVE_THRESHOLD (0.85) gates unattended schema changes; tune
 *     carefully in production to avoid polluting the ontology.
 *   - The singleton getter re-reads suggestions from disk whenever dataDir
 *     changes, so switching projects mid-process is supported.
 *   - analyzeWithLLM() caps label/relation lists to 20 entries in the prompt
 *     to stay within token budgets.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const llm = require('../llm');
const llmConfig = require('../llm/config');
const { getOntologyManager } = require('./OntologyManager');

const log = logger.child({ module: 'ontology-agent' });

/**
 * AI-driven ontology evolution agent.
 *
 * Maintains a queue of pending schema suggestions (new entities, relations,
 * properties) sourced from data extraction analysis, graph-vs-schema gap
 * detection, and LLM-powered deep analysis. Suggestions can be approved
 * (applied to the ontology), rejected, or auto-approved when above the
 * confidence threshold.
 *
 * Lifecycle: construct -> setGraphProvider/setStorage (optional) ->
 * analyzeExtraction / analyzeGraphForSuggestions / analyzeWithLLM ->
 * approveSuggestion / rejectSuggestion.
 */
class OntologyAgent {
    /**
     * @param {object} options
     * @param {object} [options.ontologyManager] - Defaults to singleton
     * @param {object} [options.graphProvider] - Graph backend for stats queries
     * @param {object} [options.storage] - Supabase storage for suggestion persistence
     * @param {object} [options.llmConfig] - LLM provider/model configuration
     * @param {object} [options.appConfig] - Application-level config for LLM resolution
     * @param {string} [options.dataDir='./data'] - Directory for local suggestion JSON fallback
     */
    constructor(options = {}) {
        this.ontologyManager = options.ontologyManager || getOntologyManager();
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        this.llmConfig = options.llmConfig || {};
        this.appConfig = options.appConfig || null;
        this.dataDir = options.dataDir || './data';
        
        // Pending suggestions file (fallback for local storage)
        this.suggestionsFile = path.join(this.dataDir, 'ontology-suggestions.json');
        this.suggestions = this.loadSuggestions();
        
        // Stats
        this.stats = {
            suggestionsGenerated: 0,
            approved: 0,
            rejected: 0
        };
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    setStorage(storage) {
        this.storage = storage;
    }

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
     * Load pending suggestions (from Supabase or local file)
     */
    loadSuggestions() {
        // Try local file first (synchronous for constructor)
        try {
            if (fs.existsSync(this.suggestionsFile)) {
                return JSON.parse(fs.readFileSync(this.suggestionsFile, 'utf-8'));
            }
        } catch (e) {
            log.debug({ event: 'ontology_agent_load_file_failed' }, 'Could not load suggestions from file');
        }
        return {
            pending: [],
            history: []
        };
    }

    /**
     * Load suggestions from Supabase (async)
     */
    async loadSuggestionsFromSupabase() {
        if (this.storage && this.storage.getOntologySuggestions) {
            try {
                const pending = await this.storage.getOntologySuggestions('pending');
                const history = await this.storage.getOntologySuggestions('all');
                
                // Transform Supabase format to internal format
                this.suggestions.pending = pending.map(s => ({
                    id: s.id,
                    type: s.suggestion_type,
                    name: s.name,
                    description: s.description,
                    fromTypes: s.from_types,
                    toTypes: s.to_types,
                    properties: s.properties,
                    source: s.source_file,
                    example: s.example,
                    createdAt: s.created_at
                }));
                
                this.suggestions.history = history.filter(s => s.status !== 'pending').map(s => ({
                    id: s.id,
                    type: s.suggestion_type,
                    name: s.name,
                    status: s.status,
                    approvedAt: s.approved_at,
                    rejectedAt: s.rejected_at
                }));
                
                log.debug({ event: 'ontology_agent_loaded_supabase', count: this.suggestions.pending.length }, 'Loaded pending suggestions from Supabase');
            } catch (e) {
                log.warn({ event: 'ontology_agent_load_supabase_failed', reason: e.message }, 'Could not load from Supabase');
            }
        }
    }

    /**
     * Save suggestions (to Supabase and local file)
     */
    saveSuggestions() {
        // Save to local file (backup/fallback)
        try {
            const dir = path.dirname(this.suggestionsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.suggestionsFile, JSON.stringify(this.suggestions, null, 2));
        } catch (e) {
            log.warn({ event: 'ontology_agent_save_file_failed', reason: e.message }, 'Could not save suggestions to file');
        }
    }

    /**
     * Add suggestion to Supabase
     */
    async persistSuggestionToSupabase(suggestion) {
        if (this.storage && this.storage.addOntologySuggestion) {
            try {
                const result = await this.storage.addOntologySuggestion(suggestion);
                if (result) {
                    suggestion.id = result.id; // Update with Supabase ID
                    log.debug({ event: 'ontology_agent_persisted_supabase', name: suggestion.name }, 'Persisted suggestion to Supabase');
                }
                return result;
            } catch (e) {
                log.warn({ event: 'ontology_agent_persist_supabase_failed', reason: e.message }, 'Could not persist to Supabase');
            }
        }
        return null;
    }

    /**
     * Update suggestion status in Supabase
     */
    async updateSuggestionInSupabase(id, updates) {
        if (this.storage && this.storage.updateOntologySuggestion) {
            try {
                const result = await this.storage.updateOntologySuggestion(id, updates);
                return result;
            } catch (e) {
                log.warn({ event: 'ontology_agent_update_supabase_failed', reason: e.message }, 'Could not update in Supabase');
            }
        }
        return null;
    }

    /**
     * Analyse the output of an entity/relationship extraction pass and
     * generate suggestions for any types or properties not yet defined
     * in the ontology. Suggestions are de-duplicated against the pending
     * queue before being added.
     *
     * @param {object} extraction - { entities: [{type, name, properties}], relationships: [{relation, from, to}] }
     * @param {string} [source='unknown'] - Identifier for the data source (e.g. file name)
     * @returns {Promise<Array>} - Newly created suggestions (subset of what was added to pending)
     */
    async analyzeExtraction(extraction, source = 'unknown') {
        const suggestions = [];
        const currentSchema = this.ontologyManager.getSchema() || { entities: {}, relations: {} };
        const knownEntities = Object.keys(currentSchema.entities || {}).map(e => e.toLowerCase());
        const knownRelations = Object.keys(currentSchema.relations || {}).map(r => r.toLowerCase());

        // Check for new entity types
        for (const entity of extraction.entities || []) {
            const entityType = (entity.type || 'Unknown').toLowerCase();
            if (!knownEntities.includes(entityType) && entityType !== 'unknown') {
                const existing = suggestions.find(s => s.type === 'new_entity' && s.name.toLowerCase() === entityType);
                if (!existing) {
                    suggestions.push({
                        id: this.generateId(),
                        type: 'new_entity',
                        name: entity.type,
                        description: `New entity type detected: ${entity.type}`,
                        example: entity.name,
                        properties: Object.keys(entity.properties || {}),
                        source,
                        confidence: 0.7,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        // Check for new relationship types
        for (const rel of extraction.relationships || []) {
            const relType = (rel.relation || rel.type || 'RELATED_TO').toLowerCase();
            if (!knownRelations.includes(relType) && relType !== 'related_to') {
                const existing = suggestions.find(s => s.type === 'new_relation' && s.name.toLowerCase() === relType);
                if (!existing) {
                    suggestions.push({
                        id: this.generateId(),
                        type: 'new_relation',
                        name: rel.relation || rel.type,
                        from: rel.fromType || 'Entity',
                        to: rel.toType || 'Entity',
                        description: `New relationship type: ${rel.from} → ${rel.to}`,
                        example: `${rel.from} ${rel.relation} ${rel.to}`,
                        source,
                        confidence: 0.7,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        // Check for new properties on existing entities
        for (const entity of extraction.entities || []) {
            const entityType = entity.type;
            const schemaEntity = currentSchema.entities?.[entityType];
            if (schemaEntity) {
                const knownProps = Object.keys(schemaEntity.properties || {});
                for (const prop of Object.keys(entity.properties || {})) {
                    if (!knownProps.includes(prop) && prop !== 'name') {
                        suggestions.push({
                            id: this.generateId(),
                            type: 'new_property',
                            entityType,
                            name: prop,
                            description: `New property "${prop}" for ${entityType}`,
                            example: entity.properties[prop],
                            source,
                            confidence: 0.6,
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }
        }

        // Add to pending suggestions (avoid duplicates)
        for (const suggestion of suggestions) {
            const isDuplicate = this.suggestions.pending.some(s => 
                s.type === suggestion.type && 
                s.name.toLowerCase() === suggestion.name.toLowerCase()
            );
            if (!isDuplicate) {
                // Persist to Supabase if available
                await this.persistSuggestionToSupabase(suggestion);
                
                this.suggestions.pending.push(suggestion);
                this.stats.suggestionsGenerated++;
            }
        }

        this.saveSuggestions();
        return suggestions;
    }

    /**
     * Use AI to analyze graph and suggest improvements
     * SOTA v3.0 - Uses native methods for Supabase
     */
    async analyzeGraphForSuggestions() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        let graphLabels = [];
        let graphRels = [];

        // Use native getStats() for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const stats = await this.graphProvider.getStats();
            const labelStats = stats?.stats?.labels || {};
            const relStats = stats?.stats?.relationshipTypes || {};
            
            // Convert to expected format
            graphLabels = Object.entries(labelStats).map(([label, count]) => ({ label, count }));
            graphRels = Object.entries(relStats).map(([type, count]) => ({ type, count }));
        } else {
            // Cypher fallback for other providers
            const labelsResult = await this.graphProvider.query('MATCH (n) RETURN DISTINCT labels(n)[0] as label, count(n) as count');
            const relsResult = await this.graphProvider.query('MATCH ()-[r]->() RETURN DISTINCT type(r) as type, count(r) as count');
            
            graphLabels = labelsResult.results || [];
            graphRels = relsResult.results || [];
        }

        // Compare with ontology
        const schema = this.ontologyManager.getSchema() || { entities: {}, relations: {} };
        const ontologyEntities = Object.keys(schema.entities || {});
        const ontologyRelations = Object.keys(schema.relations || {});

        const suggestions = [];

        // Labels in graph but not in ontology
        for (const { label, count } of graphLabels) {
            if (label && !ontologyEntities.includes(label)) {
                suggestions.push({
                    id: this.generateId(),
                    type: 'new_entity',
                    name: label,
                    description: `Entity type "${label}" exists in graph (${count} nodes) but not in ontology`,
                    count,
                    source: 'graph_analysis',
                    confidence: 0.9,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // Relations in graph but not in ontology
        for (const { type, count } of graphRels) {
            if (type && !ontologyRelations.includes(type)) {
                suggestions.push({
                    id: this.generateId(),
                    type: 'new_relation',
                    name: type,
                    description: `Relation type "${type}" exists in graph (${count} edges) but not in ontology`,
                    count,
                    source: 'graph_analysis',
                    confidence: 0.9,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // Add to pending
        for (const suggestion of suggestions) {
            const isDuplicate = this.suggestions.pending.some(s => 
                s.type === suggestion.type && 
                s.name === suggestion.name
            );
            if (!isDuplicate) {
                this.suggestions.pending.push(suggestion);
            }
        }

        this.saveSuggestions();
        return { suggestions, graphLabels, graphRels };
    }

    /**
     * Use AI to suggest better descriptions and properties
     */
    async enrichSuggestionWithAI(suggestionId) {
        const suggestion = this.suggestions.pending.find(s => s.id === suggestionId);
        if (!suggestion) return { error: 'Suggestion not found' };

        const prompt = `Analyze this ontology suggestion and provide enrichment:

Type: ${suggestion.type}
Name: ${suggestion.name}
Current Description: ${suggestion.description || 'None'}
Example: ${suggestion.example || 'None'}

Provide:
1. A better description for this ${suggestion.type === 'new_entity' ? 'entity type' : 'relationship type'}
2. Suggested properties it should have
3. Common use cases
4. Related types it might connect to

Respond in JSON:
{
    "description": "improved description",
    "properties": ["prop1", "prop2"],
    "useCases": ["use case 1"],
    "relatedTypes": ["Type1", "Type2"]
}`;

        try {
            const textCfg = this.appConfig ? llmConfig.getTextConfig(this.appConfig) : null;
            const provider = textCfg?.provider ?? this.llmConfig?.perTask?.text?.provider ?? this.llmConfig?.provider;
            const model = textCfg?.model ?? this.llmConfig?.perTask?.text?.model ?? this.llmConfig?.models?.text;
            const providerConfig = textCfg?.providerConfig ?? this.llmConfig?.providers?.[provider] ?? {};
            if (!provider || !model) {
                log.warn({ event: 'ontology_agent_no_llm' }, 'No LLM provider/model configured');
                return [];
            }
            const result = await llm.generateText({
                provider,
                providerConfig,
                model,
                prompt,
                temperature: 0.3,
                maxTokens: 500
            });

            if (result.success) {
                const match = result.text.match(/\{[\s\S]*\}/);
                if (match) {
                    const enrichment = JSON.parse(match[0]);
                    suggestion.enrichment = enrichment;
                    suggestion.description = enrichment.description || suggestion.description;
                    this.saveSuggestions();
                    return { success: true, enrichment };
                }
            }
        } catch (e) {
            log.warn({ event: 'ontology_agent_enrichment_failed', reason: e.message }, 'AI enrichment failed');
        }

        return { error: 'Could not enrich suggestion' };
    }

    /**
     * Get pending suggestions
     */
    getPendingSuggestions() {
        return this.suggestions.pending;
    }

    /**
     * Approve a pending suggestion: apply it to the ontology schema, move it
     * to history, and update Supabase. Optional modifications (name, description,
     * properties) are merged into the suggestion before application.
     *
     * @param {string} suggestionId - ID of the pending suggestion
     * @param {object} [modifications] - Override fields before applying
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    async approveSuggestion(suggestionId, modifications = {}) {
        log.debug({ event: 'ontology_agent_approving', suggestionId, pendingCount: this.suggestions.pending.length }, 'Approving suggestion');
        
        const index = this.suggestions.pending.findIndex(s => s.id === suggestionId);
        if (index === -1) {
            log.warn({ event: 'ontology_agent_suggestion_not_found', suggestionId, availableIds: this.suggestions.pending.map(s => s.id) }, 'Suggestion not found');
            return { success: false, error: `Suggestion not found (ID: ${suggestionId}). Available: ${this.suggestions.pending.length} suggestions.` };
        }

        const suggestion = this.suggestions.pending[index];
        
        // Apply modifications
        if (modifications.name) suggestion.name = modifications.name;
        if (modifications.description) suggestion.description = modifications.description;
        if (modifications.properties) suggestion.properties = modifications.properties;

        try {
            // Update ontology based on suggestion type
            if (suggestion.type === 'new_entity') {
                await this.addEntityToOntology(suggestion);
            } else if (suggestion.type === 'new_relation') {
                await this.addRelationToOntology(suggestion);
            } else if (suggestion.type === 'new_property') {
                await this.addPropertyToOntology(suggestion);
            }

            // Move to history
            suggestion.status = 'approved';
            suggestion.approvedAt = new Date().toISOString();
            this.suggestions.history.push(suggestion);
            this.suggestions.pending.splice(index, 1);
            this.stats.approved++;
            
            // Update in Supabase
            await this.updateSuggestionInSupabase(suggestionId, {
                status: 'approved',
                description: suggestion.description,
                properties: suggestion.properties
            });
            
            this.saveSuggestions();
            
            return { success: true, message: `Added ${suggestion.name} to ontology` };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Reject a suggestion
     */
    async rejectSuggestion(suggestionId, reason = null) {
        log.debug({ event: 'ontology_agent_rejecting', suggestionId }, 'Rejecting suggestion');
        
        const index = this.suggestions.pending.findIndex(s => s.id === suggestionId);
        if (index === -1) {
            log.warn({ event: 'ontology_agent_reject_not_found', suggestionId }, 'Suggestion not found for rejection');
            return { success: false, error: 'Suggestion not found' };
        }

        const suggestion = this.suggestions.pending[index];
        suggestion.status = 'rejected';
        suggestion.rejectedAt = new Date().toISOString();
        suggestion.rejectionReason = reason;
        
        this.suggestions.history.push(suggestion);
        this.suggestions.pending.splice(index, 1);
        this.stats.rejected++;
        
        // Update in Supabase
        await this.updateSuggestionInSupabase(suggestionId, {
            status: 'rejected',
            rejection_reason: reason
        });
        
        this.saveSuggestions();
        
        return { success: true };
    }

    /**
     * Add entity type to ontology
     */
    async addEntityToOntology(suggestion) {
        const schema = this.ontologyManager.getSchema() || { entities: {}, relations: {} };
        
        const newEntity = {
            description: suggestion.description,
            properties: {
                name: { type: 'string', required: true }
            }
        };

        // Add suggested properties
        for (const prop of suggestion.properties || []) {
            newEntity.properties[prop] = { type: 'string' };
        }

        // Add enriched properties if available
        if (suggestion.enrichment?.properties) {
            for (const prop of suggestion.enrichment.properties) {
                if (!newEntity.properties[prop]) {
                    newEntity.properties[prop] = { type: 'string' };
                }
            }
        }

        schema.entities[suggestion.name] = newEntity;
        
        // Save updated schema
        await this.ontologyManager.updateSchema(schema);
        
        log.info({ event: 'ontology_agent_entity_added', name: suggestion.name }, 'Added entity type');
    }

    /**
     * Add relation type to ontology
     */
    async addRelationToOntology(suggestion) {
        const schema = this.ontologyManager.getSchema() || { entities: {}, relations: {} };
        
        schema.relations[suggestion.name] = {
            from: suggestion.from || '*',
            to: suggestion.to || '*',
            description: suggestion.description,
            properties: {}
        };

        await this.ontologyManager.updateSchema(schema);
        
        log.info({ event: 'ontology_agent_relation_added', name: suggestion.name }, 'Added relation type');
    }

    /**
     * Add property to entity in ontology
     */
    async addPropertyToOntology(suggestion) {
        const schema = this.ontologyManager.getSchema() || { entities: {}, relations: {} };
        
        if (schema.entities[suggestion.entityType]) {
            if (!schema.entities[suggestion.entityType].properties) {
                schema.entities[suggestion.entityType].properties = {};
            }
            schema.entities[suggestion.entityType].properties[suggestion.name] = {
                type: 'string',
                description: suggestion.description
            };

            await this.ontologyManager.updateSchema(schema);
            
            log.info({ event: 'ontology_agent_property_added', name: suggestion.name, entityType: suggestion.entityType }, 'Added property');
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            ...this.stats,
            pendingCount: this.suggestions.pending.length,
            historyCount: this.suggestions.history.length
        };
    }

    /**
     * Clear all pending suggestions
     */
    clearPending() {
        this.suggestions.pending = [];
        this.saveSuggestions();
    }

    // ==================== SOTA v2.0: LLM-Powered Analysis ====================

    /**
     * Auto-approval threshold for high-confidence suggestions
     */
    static AUTO_APPROVE_THRESHOLD = 0.85;

    /**
     * Enable/disable auto-approval of high-confidence suggestions
     */
    setAutoApprove(enabled) {
        this.autoApproveEnabled = enabled;
    }

    /**
     * Deep LLM analysis of graph vs ontology to find gaps
     * SOTA v3.0 - Uses native methods for Supabase
     * @returns {Promise<{analysis: object, suggestions: Array}>}
     */
    async analyzeWithLLM() {
        if (!this.graphProvider?.connected) {
            return { error: 'Graph not connected' };
        }

        const textCfg = this.appConfig ? llmConfig.getTextConfig(this.appConfig) : null;
        const provider = textCfg?.provider ?? this.llmConfig?.perTask?.text?.provider ?? this.llmConfig?.provider;
        const model = textCfg?.model ?? this.llmConfig?.perTask?.text?.model ?? this.llmConfig?.models?.text;
        const providerConfig = textCfg?.providerConfig ?? this.llmConfig?.providers?.[provider] ?? {};
        if (!provider || !model) {
            return { error: 'No LLM configured' };
        }

        let labelsResult, relsResult;

        // Use native getStats() for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const stats = await this.graphProvider.getStats();
            const labelStats = stats?.stats?.labels || {};
            const relStats = stats?.stats?.relationshipTypes || {};
            
            // Convert to expected format, sorted by count descending
            labelsResult = {
                results: Object.entries(labelStats)
                    .map(([label, count]) => ({ label, count }))
                    .filter(item => !item.label?.startsWith('__'))
                    .sort((a, b) => b.count - a.count)
            };
            relsResult = {
                results: Object.entries(relStats)
                    .map(([type, count]) => ({ type, count }))
                    .sort((a, b) => b.count - a.count)
            };
        } else {
            // Cypher fallback for other providers
            labelsResult = await this.graphProvider.query(`
                MATCH (n)
                WHERE NOT labels(n)[0] STARTS WITH '__'
                RETURN labels(n)[0] as label, count(n) as count 
                ORDER BY count DESC
            `);
            relsResult = await this.graphProvider.query(`
                MATCH ()-[r]->() 
                RETURN type(r) as type, count(r) as count 
                ORDER BY count DESC
            `);
        }

        const currentSchema = this.ontologyManager.getSchema();
        
        const prompt = `Analyze this knowledge graph schema for improvements.

CURRENT ONTOLOGY (defined schema):
Entity Types: ${Object.keys(currentSchema.entityTypes || {}).join(', ')}
Relation Types: ${Object.keys(currentSchema.relationTypes || {}).join(', ')}

ACTUAL GRAPH DATA (what's stored):
Node Labels and counts: ${JSON.stringify(labelsResult.results?.slice(0, 20))}
Relationship Types and counts: ${JSON.stringify(relsResult.results?.slice(0, 20))}

Identify:
1. Labels/types in graph NOT in ontology (should be added)
2. Ontology types NOT in graph (possibly unused - flag for review)
3. Missing relationships between entity types
4. Property improvements needed
5. Patterns that suggest new inference rules

Respond in JSON format:
{
    "missingInOntology": [{"name": "...", "type": "entity|relation", "count": N, "description": "suggested description", "confidence": 0.0-1.0}],
    "unusedInOntology": [{"name": "...", "type": "entity|relation"}],
    "suggestedRelations": [{"from": "...", "to": "...", "name": "...", "description": "..."}],
    "suggestedInferenceRules": [{"name": "...", "description": "...", "pattern": "if X then Y"}],
    "summary": "brief overview of findings"
}`;

        try {
            const result = await llm.generateText({
                provider,
                providerConfig,
                model,
                prompt,
                temperature: 0.2,
                maxTokens: 2000,
                context: 'ontology_analysis'
            });

            if (!result.success) {
                return { error: result.error };
            }

            const match = result.text.match(/\{[\s\S]*\}/);
            if (!match) {
                return { error: 'Could not parse LLM response' };
            }

            const analysis = JSON.parse(match[0]);
            const newSuggestions = [];

            // Create suggestions for missing items
            for (const item of analysis.missingInOntology || []) {
                const suggestion = {
                    id: this.generateId(),
                    type: item.type === 'entity' ? 'new_entity' : 'new_relation',
                    name: item.name,
                    description: item.description || `Detected in graph with ${item.count} instances`,
                    count: item.count,
                    source: 'llm_analysis',
                    confidence: item.confidence || 0.8,
                    createdAt: new Date().toISOString()
                };

                // Check for duplicates
                const isDuplicate = this.suggestions.pending.some(s => 
                    s.type === suggestion.type && 
                    s.name.toLowerCase() === suggestion.name.toLowerCase()
                );

                if (!isDuplicate) {
                    // Auto-approve high confidence suggestions if enabled
                    if (this.autoApproveEnabled && suggestion.confidence >= OntologyAgent.AUTO_APPROVE_THRESHOLD) {
                        log.debug({ event: 'ontology_agent_auto_approving', name: suggestion.name }, 'Auto-approving high-confidence suggestion');
                        await this.approveSuggestion(suggestion.id);
                    } else {
                        await this.persistSuggestionToSupabase(suggestion);
                        this.suggestions.pending.push(suggestion);
                        newSuggestions.push(suggestion);
                    }
                    this.stats.suggestionsGenerated++;
                }
            }

            // Create suggestions for new relations
            for (const rel of analysis.suggestedRelations || []) {
                const suggestion = {
                    id: this.generateId(),
                    type: 'new_relation',
                    name: rel.name,
                    from: rel.from,
                    to: rel.to,
                    description: rel.description,
                    source: 'llm_analysis',
                    confidence: 0.75,
                    createdAt: new Date().toISOString()
                };

                const isDuplicate = this.suggestions.pending.some(s => 
                    s.type === 'new_relation' && 
                    s.name.toLowerCase() === suggestion.name.toLowerCase()
                );

                if (!isDuplicate) {
                    await this.persistSuggestionToSupabase(suggestion);
                    this.suggestions.pending.push(suggestion);
                    newSuggestions.push(suggestion);
                    this.stats.suggestionsGenerated++;
                }
            }

            this.saveSuggestions();

            return { 
                analysis,
                suggestions: newSuggestions,
                summary: analysis.summary
            };
        } catch (e) {
            log.error({ event: 'ontology_agent_llm_analysis_failed', reason: e.message }, 'LLM analysis failed');
            return { error: e.message };
        }
    }

    /**
     * Process all pending suggestions and auto-approve high confidence ones
     * @param {number} threshold - Confidence threshold (default: 0.85)
     * @returns {Promise<{approved: number, skipped: number}>}
     */
    async autoApproveHighConfidence(threshold = OntologyAgent.AUTO_APPROVE_THRESHOLD) {
        const results = { approved: 0, skipped: 0 };
        
        const toApprove = this.suggestions.pending.filter(s => 
            s.confidence >= threshold && 
            (s.source === 'graph_analysis' || s.source === 'llm_analysis')
        );

        for (const suggestion of toApprove) {
            try {
                await this.approveSuggestion(suggestion.id);
                results.approved++;
                log.debug({ event: 'ontology_agent_auto_approved', name: suggestion.name, confidence: suggestion.confidence }, 'Auto-approved');
            } catch (e) {
                results.skipped++;
                log.warn({ event: 'ontology_agent_auto_approve_failed', name: suggestion.name, reason: e.message }, 'Auto-approve failed');
            }
        }

        return results;
    }

    /**
     * Get type usage statistics from the graph
     * SOTA v3.0 - Uses native methods for Supabase
     * @returns {Promise<object>}
     */
    async getTypeUsageStats() {
        if (!this.graphProvider?.connected) {
            return { error: 'Graph not connected' };
        }

        const schema = this.ontologyManager.getSchema();
        const stats = {
            entities: {},
            relations: {},
            unused: { entities: [], relations: [] },
            notInOntology: { entities: [], relations: [] }
        };

        // Use native getStats() for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const graphStats = await this.graphProvider.getStats();
            const labelStats = graphStats?.stats?.labels || {};
            const relStats = graphStats?.stats?.relationshipTypes || {};

            // Process node counts
            for (const [label, count] of Object.entries(labelStats)) {
                if (!label?.startsWith('__')) {
                    stats.entities[label] = {
                        count,
                        inOntology: schema.entityTypes?.[label] !== undefined
                    };
                    
                    if (!stats.entities[label].inOntology) {
                        stats.notInOntology.entities.push(label);
                    }
                }
            }

            // Process relationship counts
            for (const [type, count] of Object.entries(relStats)) {
                stats.relations[type] = {
                    count,
                    inOntology: schema.relationTypes?.[type] !== undefined
                };
                
                if (!stats.relations[type].inOntology) {
                    stats.notInOntology.relations.push(type);
                }
            }

            // Compliance stats from graph stats
            const total = graphStats?.nodeCount || 0;
            stats.compliance = {
                total,
                valid: total, // Assume all valid for Supabase (validation happens at insert)
                invalid: 0,
                unchecked: 0,
                percentage: 100
            };
        } else {
            // Cypher fallback for other providers
            const nodeCounts = await this.graphProvider.query(`
                MATCH (n)
                WHERE NOT labels(n)[0] STARTS WITH '__'
                RETURN labels(n)[0] as label, count(n) as count
                ORDER BY count DESC
            `);

            for (const row of nodeCounts.results || []) {
                stats.entities[row.label] = {
                    count: row.count,
                    inOntology: schema.entityTypes?.[row.label] !== undefined
                };
                
                if (!stats.entities[row.label].inOntology) {
                    stats.notInOntology.entities.push(row.label);
                }
            }

            // Get relationship counts by type
            const relCounts = await this.graphProvider.query(`
                MATCH ()-[r]->()
                RETURN type(r) as type, count(r) as count
                ORDER BY count DESC
            `);

            for (const row of relCounts.results || []) {
                stats.relations[row.type] = {
                    count: row.count,
                    inOntology: schema.relationTypes?.[row.type] !== undefined
                };
                
                if (!stats.relations[row.type].inOntology) {
                    stats.notInOntology.relations.push(row.type);
                }
            }

            // Get ontology compliance stats (nodes with _ontology_valid property)
            try {
                const complianceResult = await this.graphProvider.query(`
                    MATCH (n)
                    WHERE NOT labels(n)[0] STARTS WITH '__'
                    RETURN 
                        count(n) as total,
                        sum(CASE WHEN n._ontology_valid = true THEN 1 ELSE 0 END) as valid,
                        sum(CASE WHEN n._ontology_valid = false THEN 1 ELSE 0 END) as invalid,
                        sum(CASE WHEN n._ontology_valid IS NULL THEN 1 ELSE 0 END) as unchecked
                `);
                
                if (complianceResult.results?.[0]) {
                    const row = complianceResult.results[0];
                    stats.compliance = {
                        total: row.total || 0,
                        valid: row.valid || 0,
                        invalid: row.invalid || 0,
                        unchecked: row.unchecked || 0,
                        percentage: row.total > 0 ? Math.round((row.valid / row.total) * 100) : 0
                    };
                }
            } catch (e) {
                log.warn({ event: 'ontology_agent_compliance_stats_failed', reason: e.message }, 'Could not get compliance stats');
            }
        }

        // Find unused ontology types
        for (const entityType of Object.keys(schema.entityTypes || {})) {
            if (!stats.entities[entityType] || stats.entities[entityType].count === 0) {
                stats.unused.entities.push(entityType);
            }
        }

        for (const relType of Object.keys(schema.relationTypes || {})) {
            if (!stats.relations[relType] || stats.relations[relType].count === 0) {
                stats.unused.relations.push(relType);
            }
        }

        return stats;
    }
}

// Singleton
let ontologyAgentInstance = null;
function getOntologyAgent(options = {}) {
    if (!ontologyAgentInstance) {
        ontologyAgentInstance = new OntologyAgent(options);
    }
    if (options.graphProvider) ontologyAgentInstance.setGraphProvider(options.graphProvider);
    if (options.llmConfig) ontologyAgentInstance.llmConfig = options.llmConfig;
    
    // Update dataDir and reload suggestions if changed
    if (options.dataDir && options.dataDir !== ontologyAgentInstance.dataDir) {
        ontologyAgentInstance.dataDir = options.dataDir;
        ontologyAgentInstance.suggestionsFile = require('path').join(options.dataDir, 'ontology-suggestions.json');
        ontologyAgentInstance.suggestions = ontologyAgentInstance.loadSuggestions();
        log.debug({ event: 'ontology_agent_reloaded', dataDir: options.dataDir, pending: ontologyAgentInstance.suggestions.pending.length }, 'Reloaded suggestions');
    }
    
    return ontologyAgentInstance;
}

module.exports = { OntologyAgent, getOntologyAgent };
