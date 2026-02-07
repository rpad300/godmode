/**
 * Graph Sync Module
 * Keeps graph database in sync with application data
 * Supports Supabase graph tables (graph_nodes, graph_relationships)
 * 
 * SOTA v2.0 - Now includes ontology validation before sync
 * SOTA v2.1 - Background worker integration for continuous optimization
 * SOTA v3.0 - Native Supabase graph support (no Cypher dependency)
 */

const { getOntologyManager } = require('../ontology/OntologyManager');
const { getInferenceEngine } = require('../ontology/InferenceEngine');

class GraphSync {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;
        
        // Track what was synced to enable cleanup
        this.syncLog = new Map(); // sourceId -> { nodes: [], edges: [] }
        
        // Ontology integration (SOTA v2.0)
        this.ontology = options.ontology || getOntologyManager();
        this.inferenceEngine = options.inferenceEngine || null;
        
        // Background worker integration (SOTA v2.1)
        this.backgroundWorker = options.backgroundWorker || null;
        this.triggerBackgroundAnalysis = options.triggerBackgroundAnalysis !== false;
        this._syncCounter = 0;
        this._syncThreshold = options.syncThresholdForAnalysis || 10; // Trigger after N syncs
        
        // Validation settings
        this.strictMode = options.strictMode || false;
        this.validateBeforeSync = options.validateBeforeSync !== false;
        this.generateEmbeddingText = options.generateEmbeddingText !== false;
        this.runInferenceAfterSync = options.runInferenceAfterSync || false;
        
        // Statistics
        this.validationStats = {
            valid: 0,
            invalid: 0,
            suggestions: 0
        };
    }

    /**
     * Check if provider supports native methods (Supabase) or needs Cypher
     * @returns {boolean}
     */
    _supportsNativeMethods() {
        return typeof this.graphProvider?.createNode === 'function' &&
               typeof this.graphProvider?.createRelationship === 'function';
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
        // Also update inference engine if available
        if (this.inferenceEngine) {
            this.inferenceEngine.setGraphProvider(provider);
        }
    }

    setStorage(storage) {
        this.storage = storage;
    }

    /**
     * Set the ontology manager
     * @param {OntologyManager} ontology 
     */
    setOntology(ontology) {
        this.ontology = ontology;
    }

    /**
     * Set the inference engine for post-sync inference
     * @param {InferenceEngine} engine 
     */
    setInferenceEngine(engine) {
        this.inferenceEngine = engine;
    }

    /**
     * Set the background worker for continuous optimization (SOTA v2.1)
     * @param {OntologyBackgroundWorker} worker 
     */
    setBackgroundWorker(worker) {
        this.backgroundWorker = worker;
    }

    /**
     * Trigger background analysis after sync (debounced)
     * Called automatically after successful syncs when backgroundWorker is set
     */
    _triggerBackgroundAnalysis() {
        if (!this.backgroundWorker || !this.triggerBackgroundAnalysis) return;
        
        this._syncCounter++;
        
        // Only trigger after reaching threshold to avoid too frequent analysis
        if (this._syncCounter >= this._syncThreshold) {
            this._syncCounter = 0;
            this.backgroundWorker.scheduleAnalysis('incremental');
        }
    }

    /**
     * Enable/disable strict validation mode
     * @param {boolean} enabled 
     */
    setStrictMode(enabled) {
        this.strictMode = enabled;
    }

    /**
     * Validate an entity against the ontology
     * @param {string} entityType - Type of entity (Fact, Decision, etc.)
     * @param {object} data - Entity data
     * @returns {{valid: boolean, errors: string[], warnings: string[]}}
     */
    validateEntity(entityType, data) {
        if (!this.validateBeforeSync || !this.ontology?.loaded) {
            return { valid: true, errors: [], warnings: [] };
        }

        const errors = [];
        const warnings = [];

        // Check if entity type exists in ontology
        if (!this.ontology.hasEntityType(entityType)) {
            if (this.strictMode) {
                errors.push(`Unknown entity type: ${entityType}`);
            } else {
                warnings.push(`Entity type "${entityType}" not in ontology - consider adding it`);
            }
        } else {
            // Validate properties against schema
            const typeSchema = this.ontology.getEntityType(entityType);
            const requiredProps = Object.entries(typeSchema?.properties || {})
                .filter(([_, p]) => p.required)
                .map(([name]) => name);
            
            for (const prop of requiredProps) {
                if (data[prop] === undefined || data[prop] === null || data[prop] === '') {
                    if (this.strictMode) {
                        errors.push(`Missing required property: ${prop}`);
                    } else {
                        warnings.push(`Missing recommended property: ${prop}`);
                    }
                }
            }
        }

        const valid = errors.length === 0;
        if (valid) {
            this.validationStats.valid++;
        } else {
            this.validationStats.invalid++;
        }

        return { valid, errors, warnings };
    }

    /**
     * Validate a relationship against the ontology
     * @param {string} relationType - Relationship type
     * @param {string} fromType - Source entity type
     * @param {string} toType - Target entity type
     * @returns {{valid: boolean, errors: string[], warnings: string[]}}
     */
    validateRelationship(relationType, fromType, toType) {
        if (!this.validateBeforeSync || !this.ontology?.loaded) {
            return { valid: true, errors: [], warnings: [] };
        }

        const errors = [];
        const warnings = [];

        // Check if relation type exists
        if (!this.ontology.hasRelationType(relationType)) {
            if (this.strictMode) {
                errors.push(`Unknown relation type: ${relationType}`);
            } else {
                warnings.push(`Relation type "${relationType}" not in ontology`);
            }
        } else {
            // Validate from/to types
            if (!this.ontology.isValidRelation(relationType, fromType, toType)) {
                if (this.strictMode) {
                    errors.push(`Invalid relation: ${relationType} from ${fromType} to ${toType}`);
                } else {
                    warnings.push(`Relation ${relationType} may not be valid from ${fromType} to ${toType}`);
                }
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Generate embedding text using ontology template
     * @param {string} entityType 
     * @param {object} data 
     * @returns {string|null}
     */
    getEmbeddingText(entityType, data) {
        if (!this.generateEmbeddingText || !this.ontology?.loaded) {
            return null;
        }
        return this.ontology.generateEmbeddingText(entityType, data);
    }

    /**
     * Get validation statistics
     * @returns {object}
     */
    getValidationStats() {
        return { ...this.validationStats };
    }

    /**
     * Reset validation statistics
     */
    resetValidationStats() {
        this.validationStats = { valid: 0, invalid: 0, suggestions: 0 };
    }

    /**
     * Run inference rules after sync operations
     * @returns {Promise<object>}
     */
    async runInference() {
        if (!this.inferenceEngine || !this.graphProvider?.connected) {
            return { skipped: true, reason: 'Inference engine not configured' };
        }
        return this.inferenceEngine.runAllRules();
    }

    /**
     * Check if graph is available
     */
    isGraphAvailable() {
        return this.graphProvider && this.graphProvider.connected;
    }

    // ==================== DOCUMENT SYNC ====================

    /**
     * When a document is deleted, remove related graph data
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onDocumentDeleted(documentId, documentTitle) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        const results = { deleted: { nodes: 0, edges: 0 } };

        try {
            // Delete the document node (relationships are cascade-deleted)
            await this.graphProvider.deleteNode(documentId);
            results.deleted.nodes++;

            console.log(`[GraphSync] Document "${documentTitle}" deleted from graph`);
            return results;
        } catch (e) {
            console.log(`[GraphSync] Error deleting document: ${e.message}`);
            return { error: e.message };
        }
    }

    // ==================== CONTACT/PERSON SYNC ====================

    /**
     * When a contact is deleted, remove from graph
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onContactDeleted(contactId, contactName, contactEmail) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        const results = { deleted: { nodes: 0, edges: 0 } };

        try {
            // Delete contact node by ID
            if (contactId) {
                await this.graphProvider.deleteNode(contactId);
                results.deleted.nodes++;
            }
            
            // Also try to delete Person node with matching name
            if (contactName) {
                const personId = `person_${contactName.toLowerCase().replace(/\s+/g, '_')}`;
                try {
                    await this.graphProvider.deleteNode(personId);
                    results.deleted.nodes++;
                } catch (e) {
                    // Node might not exist
                }
            }

            console.log(`[GraphSync] Contact "${contactName}" deleted from graph`);
            return results;
        } catch (e) {
            console.log(`[GraphSync] Error deleting contact: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a contact to the graph (create/update)
     * Uses native provider methods for Supabase compatibility
     */
    async syncContact(contact) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        try {
            // Use native createNode for Supabase compatibility
            const nodeData = {
                id: contact.id,
                name: contact.name || '',
                email: contact.email || null,
                phone: contact.phone || null,
                organization: contact.organization || null,
                role: contact.role || null,
                department: contact.department || null,
                timezone: contact.timezone || null,
                linkedin: contact.linkedin || null,
                tags: contact.tags || [],
                aliases: contact.aliases || [],
                entity_type: 'Contact',
                updated_at: new Date().toISOString()
            };
            
            await this.graphProvider.createNode('Contact', nodeData);

            // If contact has a linked person, create relationship
            if (contact.linked_person_id || contact.linkedPersonId) {
                const personId = contact.linked_person_id || contact.linkedPersonId;
                await this.graphProvider.createRelationship(
                    contact.id, personId, 'REPRESENTS', {}
                );
            }

            // Handle N:N team relationships
            const teamIds = [];
            if (Array.isArray(contact.teams) && contact.teams.length > 0) {
                contact.teams.forEach(t => {
                    if (t.id) teamIds.push(t.id);
                    else if (typeof t === 'string') teamIds.push(t);
                });
            } else if (contact.teamId) {
                teamIds.push(contact.teamId);
            }

            // Create MEMBER_OF relationships for each team
            for (const teamId of teamIds) {
                try {
                    await this.graphProvider.createRelationship(
                        contact.id, teamId, 'MEMBER_OF', {}
                    );
                } catch (e) {
                    // Team might not exist yet
                }
            }

            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing contact: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a team to the graph (create/update)
     * Uses native provider methods for Supabase compatibility
     */
    async syncTeam(team) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        try {
            const nodeData = {
                id: team.id,
                name: team.name || '',
                description: team.description || '',
                color: team.color || '#3b82f6',
                team_type: team.team_type || 'team',
                entity_type: 'Team',
                updated_at: new Date().toISOString()
            };
            
            await this.graphProvider.createNode('Team', nodeData);

            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing team: ${e.message}`);
            return { error: e.message };
        }
    }

    // ==================== CONVERSATION SYNC ====================

    /**
     * When a conversation is deleted, remove related graph data
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onConversationDeleted(conversationId, conversationTitle) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        const results = { deleted: { nodes: 0, edges: 0 } };

        try {
            // Delete the conversation node (relationships cascade)
            await this.graphProvider.deleteNode(conversationId);
            results.deleted.nodes++;

            console.log(`[GraphSync] Conversation "${conversationTitle}" deleted from graph`);
            return results;
        } catch (e) {
            console.log(`[GraphSync] Error deleting conversation: ${e.message}`);
            return { error: e.message };
        }
    }

    // ==================== MEETING/TRANSCRIPT SYNC ====================

    /**
     * When a transcript/meeting is deleted, remove related graph data
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onMeetingDeleted(meetingId, meetingTitle) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        const results = { deleted: { nodes: 0, edges: 0 } };

        try {
            // Delete meeting node (relationships cascade)
            await this.graphProvider.deleteNode(meetingId);
            results.deleted.nodes++;
            
            // Also try with meeting_ prefix
            try {
                await this.graphProvider.deleteNode(`meeting_${meetingId}`);
                results.deleted.nodes++;
            } catch (e) {
                // Node might not exist
            }

            console.log(`[GraphSync] Meeting "${meetingTitle}" deleted from graph`);
            return results;
        } catch (e) {
            console.log(`[GraphSync] Error deleting meeting: ${e.message}`);
            return { error: e.message };
        }
    }

    // ==================== PROJECT SYNC ====================

    /**
     * When a project is deleted
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onProjectDeleted(projectId, projectName) {
        if (!this.isGraphAvailable()) return { skipped: true, reason: 'Graph not connected' };

        try {
            await this.graphProvider.deleteNode(projectId);
            console.log(`[GraphSync] Project "${projectName}" deleted from graph`);
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    // ==================== FACT/DECISION/RISK SYNC ====================

    /**
     * When a fact is deleted
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onFactDeleted(factId, factContent) {
        if (!this.isGraphAvailable()) return { skipped: true };

        try {
            await this.graphProvider.deleteNode(factId);
            // Also try with fact_ prefix
            try {
                await this.graphProvider.deleteNode(`fact_${factId}`);
            } catch (e) {}
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * When a decision is deleted
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onDecisionDeleted(decisionId, decisionContent) {
        if (!this.isGraphAvailable()) return { skipped: true };

        try {
            await this.graphProvider.deleteNode(decisionId);
            // Also try with decision_ prefix
            try {
                await this.graphProvider.deleteNode(`decision_${decisionId}`);
            } catch (e) {}
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * When a risk is deleted
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onRiskDeleted(riskId, riskContent) {
        if (!this.isGraphAvailable()) return { skipped: true };

        try {
            await this.graphProvider.deleteNode(riskId);
            // Also try with risk_ prefix
            try {
                await this.graphProvider.deleteNode(`risk_${riskId}`);
            } catch (e) {}
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * When an action item is deleted
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async onActionItemDeleted(actionId, actionTask) {
        if (!this.isGraphAvailable()) return { skipped: true };

        try {
            await this.graphProvider.deleteNode(actionId);
            // Also try with action_ prefix
            try {
                await this.graphProvider.deleteNode(`action_${actionId}`);
            } catch (e) {}
            return { success: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    // ==================== BULK OPERATIONS ====================

    /**
     * Clean up orphaned nodes (nodes with no relationships)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async cleanupOrphanedNodes() {
        if (!this.isGraphAvailable()) return { skipped: true };

        try {
            // Use provider's cleanup method if available
            if (typeof this.graphProvider.cleanupOrphanedRelationships === 'function') {
                const result = await this.graphProvider.cleanupOrphanedRelationships();
                console.log(`[GraphSync] Cleaned up ${result?.deleted || 0} orphaned relationships`);
                return { success: true, deleted: result?.deleted || 0 };
            }
            
            // Fallback: no cleanup available for Supabase provider
            console.log(`[GraphSync] Orphaned node cleanup not available for this provider`);
            return { success: true, deleted: 0 };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Full sync: Remove graph data that no longer exists in storage
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async fullSync() {
        if (!this.isGraphAvailable() || !this.storage) {
            return { skipped: true, reason: 'Graph or storage not available' };
        }

        const results = {
            checked: { people: 0, documents: 0, conversations: 0 },
            deleted: { people: 0, documents: 0, conversations: 0 }
        };

        try {
            // Get all People from graph using native methods
            const graphResult = await this.graphProvider.findNodes('Person', {}, { limit: 1000 });
            const graphPeople = graphResult.nodes || [];
            const storagePeople = this.storage.getPeople?.() || [];
            const storagePeopleNames = new Set(storagePeople.map(p => p.name?.toLowerCase()));
            const storagePeopleEmails = new Set(storagePeople.map(p => p.email?.toLowerCase()).filter(Boolean));

            for (const gp of graphPeople) {
                results.checked.people++;
                const nameMatch = storagePeopleNames.has(gp.name?.toLowerCase());
                const emailMatch = gp.email && storagePeopleEmails.has(gp.email?.toLowerCase());
                
                if (!nameMatch && !emailMatch) {
                    await this.onContactDeleted(gp.id, gp.name, gp.email);
                    results.deleted.people++;
                }
            }

            // Cleanup orphans
            await this.cleanupOrphanedNodes();

            console.log(`[GraphSync] Full sync complete: deleted ${results.deleted.people} people`);
            return results;
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Get sync status
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async getSyncStatus() {
        if (!this.isGraphAvailable()) {
            return { connected: false };
        }

        try {
            // Use provider's getStats method if available
            const stats = await this.graphProvider.getStats();
            
            return {
                connected: true,
                graphNodes: stats?.nodeCount || stats?.nodes || 0,
                graphEdges: stats?.edgeCount || stats?.relationships || 0
            };
        } catch (e) {
            return { connected: false, error: e.message };
        }
    }

    // ==================== REAL-TIME SYNC (ADD/UPDATE) ====================

    /**
     * Sync a new fact to the graph (with ontology validation)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncFact(fact) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        // Validate against ontology (SOTA v2.0)
        const validation = this.validateEntity('Fact', fact);
        if (!validation.valid && this.strictMode) {
            console.warn(`[GraphSync] Fact validation failed:`, validation.errors);
            return { error: 'Validation failed', errors: validation.errors };
        }
        if (validation.warnings.length > 0) {
            console.log(`[GraphSync] Fact warnings:`, validation.warnings);
        }
        
        // Generate embedding text from ontology template
        const embeddingText = this.getEmbeddingText('Fact', fact);
        
        try {
            const nodeData = {
                id: fact.id || `fact_${Date.now()}`,
                content: fact.content,
                category: fact.category || 'general',
                source_file: fact.source_file || fact.meeting || 'unknown',
                confidence: fact.confidence || 0.8,
                created_at: new Date().toISOString(),
                _embedding_text: embeddingText || fact.content,
                _ontology_valid: validation.valid
            };
            
            await this.graphProvider.createNode('Fact', nodeData);
            this._triggerBackgroundAnalysis();
            return { success: true, validation };
        } catch (e) {
            console.log(`[GraphSync] Error syncing fact: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a new decision to the graph (with ontology validation)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncDecision(decision) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        // Validate against ontology (SOTA v2.0)
        const validation = this.validateEntity('Decision', decision);
        if (!validation.valid && this.strictMode) {
            console.warn(`[GraphSync] Decision validation failed:`, validation.errors);
            return { error: 'Validation failed', errors: validation.errors };
        }
        
        // Generate embedding text
        const embeddingText = this.getEmbeddingText('Decision', decision);
        
        try {
            const decisionId = decision.id || `decision_${Date.now()}`;
            const nodeData = {
                id: decisionId,
                content: decision.content,
                owner: decision.owner || 'Unknown',
                category: decision.category || 'general',
                decision_date: decision.decision_date || new Date().toISOString(),
                source_file: decision.source_file || decision.meeting || 'unknown',
                _embedding_text: embeddingText || decision.content,
                _ontology_valid: validation.valid
            };
            
            await this.graphProvider.createNode('Decision', nodeData);

            // Link to owner if exists - with relationship validation
            if (decision.owner && decision.owner !== 'Unknown') {
                const relValidation = this.validateRelationship('MADE_DECISION', 'Person', 'Decision');
                if (relValidation.valid || !this.strictMode) {
                    // Create Person node for owner
                    const ownerId = `person_${decision.owner.toLowerCase().replace(/\s+/g, '_')}`;
                    await this.graphProvider.createNode('Person', {
                        id: ownerId,
                        name: decision.owner
                    });
                    // Create relationship
                    await this.graphProvider.createRelationship(ownerId, decisionId, 'MADE_DECISION', {});
                }
            }

            this._triggerBackgroundAnalysis();
            return { success: true, validation };
        } catch (e) {
            console.log(`[GraphSync] Error syncing decision: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a new person to the graph (with ontology validation)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncPerson(person) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        // Validate against ontology (SOTA v2.0)
        const validation = this.validateEntity('Person', person);
        if (!validation.valid && this.strictMode) {
            console.warn(`[GraphSync] Person validation failed:`, validation.errors);
            return { error: 'Validation failed', errors: validation.errors };
        }
        
        // Generate embedding text
        const embeddingText = this.getEmbeddingText('Person', person);
        
        try {
            const personId = person.id || `person_${person.name?.toLowerCase().replace(/\s+/g, '_') || Date.now()}`;
            const nodeData = {
                id: personId,
                name: person.name,
                role: person.role || '',
                organization: person.organization || '',
                email: person.email || '',
                source_file: person.source_file || 'unknown',
                _embedding_text: embeddingText || person.name,
                _ontology_valid: validation.valid
            };
            
            await this.graphProvider.createNode('Person', nodeData);
            this._triggerBackgroundAnalysis();
            return { success: true, validation };
        } catch (e) {
            console.log(`[GraphSync] Error syncing person: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a new risk to the graph (with ontology validation)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncRisk(risk) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        // Validate against ontology (SOTA v2.0)
        const validation = this.validateEntity('Risk', risk);
        if (!validation.valid && this.strictMode) {
            console.warn(`[GraphSync] Risk validation failed:`, validation.errors);
            return { error: 'Validation failed', errors: validation.errors };
        }
        
        // Generate embedding text
        const embeddingText = this.getEmbeddingText('Risk', risk);
        
        try {
            const nodeData = {
                id: risk.id || `risk_${Date.now()}`,
                content: risk.content,
                impact: risk.impact || 'medium',
                likelihood: risk.likelihood || 'medium',
                status: risk.status || 'open',
                mitigation: risk.mitigation || '',
                source_file: risk.source_file || risk.meeting || 'unknown',
                _embedding_text: embeddingText || risk.content,
                _ontology_valid: validation.valid
            };
            
            await this.graphProvider.createNode('Risk', nodeData);
            this._triggerBackgroundAnalysis();
            return { success: true, validation };
        } catch (e) {
            console.log(`[GraphSync] Error syncing risk: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a new action item to the graph (with ontology validation)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncAction(action) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        // Validate against ontology (SOTA v2.0) - using 'Task' or 'Action' type
        const validation = this.validateEntity('Task', action);
        if (!validation.valid && this.strictMode) {
            console.warn(`[GraphSync] Action validation failed:`, validation.errors);
            return { error: 'Validation failed', errors: validation.errors };
        }
        
        // Generate embedding text
        const embeddingText = this.getEmbeddingText('Task', action);
        
        try {
            const actionId = action.id || `action_${Date.now()}`;
            const nodeData = {
                id: actionId,
                task: action.task || action.title || action.content,
                owner: action.owner || 'Unassigned',
                deadline: action.deadline || action.due_date || '',
                status: action.status || 'pending',
                source_file: action.source_file || action.meeting || 'unknown',
                _embedding_text: embeddingText || action.task,
                _ontology_valid: validation.valid
            };
            
            await this.graphProvider.createNode('Action', nodeData);

            // Link to owner if exists - with relationship validation
            if (action.owner && action.owner !== 'Unassigned') {
                const relValidation = this.validateRelationship('ASSIGNED_TO', 'Person', 'Task');
                if (relValidation.valid || !this.strictMode) {
                    const ownerId = `person_${action.owner.toLowerCase().replace(/\s+/g, '_')}`;
                    await this.graphProvider.createNode('Person', {
                        id: ownerId,
                        name: action.owner
                    });
                    await this.graphProvider.createRelationship(ownerId, actionId, 'ASSIGNED_TO', {});
                }
            }

            return { success: true, validation };
        } catch (e) {
            console.log(`[GraphSync] Error syncing action: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a question to the graph (with ontology validation)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncQuestion(question) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        // Validate against ontology (SOTA v2.0)
        const validation = this.validateEntity('Question', question);
        if (!validation.valid && this.strictMode) {
            console.warn(`[GraphSync] Question validation failed:`, validation.errors);
            return { error: 'Validation failed', errors: validation.errors };
        }
        
        // Generate embedding text
        const embeddingText = this.getEmbeddingText('Question', question);
        
        try {
            const questionId = question.id || `question_${Date.now()}`;
            const nodeData = {
                id: questionId,
                content: question.content,
                context: question.context || '',
                priority: question.priority || 'medium',
                status: question.status || 'pending',
                answer: question.answer || '',
                answer_source: question.answer_source || '',
                source_file: question.source_file || 'unknown',
                created_at: question.created_at || new Date().toISOString(),
                resolved_at: question.resolved_at || '',
                sla_breached: question.sla_breached || false,
                category: question.category || ''
            };
            
            await this.graphProvider.createNode('Question', nodeData);

            // Link to assigned person if exists
            if (question.assigned_to) {
                const assigneeId = `person_${question.assigned_to.toLowerCase().replace(/\s+/g, '_')}`;
                await this.graphProvider.createNode('Person', {
                    id: assigneeId,
                    name: question.assigned_to
                });
                await this.graphProvider.createRelationship(questionId, assigneeId, 'QUESTION_ASSIGNED_TO', {
                    assignedDate: question.assigned_at || question.updated_at || new Date().toISOString()
                });
            }

            // Link to answerer - prefer contact if available
            if (question.status === 'resolved' || question.answer) {
                const answererName = question.answered_by_name || question.assigned_to;
                const answererContactId = question.answered_by_contact_id;
                
                if (answererName) {
                    const answererId = `person_${answererName.toLowerCase().replace(/\s+/g, '_')}`;
                    await this.graphProvider.createNode('Person', {
                        id: answererId,
                        name: answererName,
                        contactId: answererContactId || null
                    });
                    await this.graphProvider.createRelationship(questionId, answererId, 'ANSWERED_BY', {
                        answeredDate: question.answered_at || question.resolved_at || new Date().toISOString(),
                        source: question.answer_source || 'manual',
                        contactId: answererContactId || null
                    });
                }
            }

            // Link to source document if exists
            if (question.source_file && question.source_file !== 'unknown' && question.source_file !== 'quick_capture' && question.source_file !== 'followup') {
                const docId = `document_${question.source_file.toLowerCase().replace(/\s+/g, '_')}`;
                await this.graphProvider.createNode('Document', {
                    id: docId,
                    title: question.source_file
                });
                await this.graphProvider.createRelationship(questionId, docId, 'QUESTION_FROM_DOCUMENT', {});
            }

            // Sync extracted entities if available
            if (question.extracted_entities && question.extracted_entities.length > 0) {
                await this.syncQuestionEntities(question.id, question.extracted_entities);
            }

            // Sync answer provenance if available
            if (question.answer_provenance && question.answer_provenance.sources) {
                await this.syncAnswerProvenance(question.id, question.answer_provenance.sources);
            }

            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing question: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a follow-up relationship between questions
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncFollowUp(parentQuestionId, followUpQuestionId) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            await this.graphProvider.createRelationship(parentQuestionId, followUpQuestionId, 'HAS_FOLLOWUP', {
                createdAt: new Date().toISOString()
            });
            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing follow-up: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync similar question relationship
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncQuestionSimilarity(questionId, similarQuestionId, score) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            await this.graphProvider.createRelationship(questionId, similarQuestionId, 'SIMILAR_TO', {
                score: score,
                computedAt: new Date().toISOString()
            });
            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing question similarity: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync question entity mentions (QUESTION_MENTIONS, QUESTION_ABOUT)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncQuestionEntities(questionId, entities) {
        if (!this.isGraphAvailable()) return { skipped: true };
        if (!entities || entities.length === 0) return { skipped: true, reason: 'no entities' };
        
        try {
            let synced = 0;
            
            for (const entity of entities) {
                const entityType = entity.type || 'Entity';
                const capitalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1);
                
                // Determine relationship based on entity type
                let relationship = 'QUESTION_MENTIONS';
                if (['technology', 'topic', 'project', 'category'].includes(entityType.toLowerCase())) {
                    relationship = 'QUESTION_ABOUT';
                }
                
                // Create entity node
                const entityId = `${entityType.toLowerCase()}_${entity.name?.toLowerCase().replace(/\s+/g, '_') || Date.now()}`;
                await this.graphProvider.createNode(capitalizedType, {
                    id: entityId,
                    name: entity.name
                });
                
                // Create relationship
                await this.graphProvider.createRelationship(questionId, entityId, relationship, {
                    confidence: entity.confidence || 0.8,
                    context: entity.context || '',
                    extractedAt: new Date().toISOString()
                });
                
                synced++;
            }
            
            return { success: true, synced };
        } catch (e) {
            console.log(`[GraphSync] Error syncing question entities: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync answer provenance (ANSWER_FROM relationship)
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncAnswerProvenance(questionId, sources) {
        if (!this.isGraphAvailable()) return { skipped: true };
        if (!sources || sources.length === 0) return { skipped: true, reason: 'no sources' };
        
        try {
            let synced = 0;
            
            for (const source of sources) {
                const sourceType = source.type || 'Fact';
                const capitalizedType = sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
                
                // Create source node if needed
                const sourceId = source.id || `${sourceType.toLowerCase()}_${Date.now()}_${synced}`;
                await this.graphProvider.createNode(capitalizedType, {
                    id: sourceId,
                    content: source.content || ''
                });
                
                // Create ANSWER_FROM relationship
                await this.graphProvider.createRelationship(questionId, sourceId, 'ANSWER_FROM', {
                    confidence: source.confidence || 0.8,
                    excerpt: (source.content || '').substring(0, 200),
                    linkedAt: new Date().toISOString()
                });
                
                synced++;
            }
            
            return { success: true, synced };
        } catch (e) {
            console.log(`[GraphSync] Error syncing answer provenance: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync answered by contact (links question to contact who answered)
     * @param {string} questionId - The question ID
     * @param {Object} contact - Contact object {id, name, role, organization}
     * @param {string} source - Answer source (manual, document, ai)
     */
    async syncAnsweredByContact(questionId, contact, source = 'manual') {
        if (!this.isGraphAvailable()) return { skipped: true };
        if (!contact || !contact.name) return { skipped: true, reason: 'no contact' };
        
        try {
            // Create or match contact as Person node
            const query = `
                MATCH (q:Question {id: $questionId})
                MERGE (c:Person {name: $contactName})
                ON CREATE SET c.role = $role, c.organization = $organization, c.contactId = $contactId
                ON MATCH SET c.role = COALESCE($role, c.role), 
                             c.organization = COALESCE($organization, c.organization),
                             c.contactId = COALESCE($contactId, c.contactId)
                MERGE (q)-[r:ANSWERED_BY]->(c)
                SET r.answeredDate = $date,
                    r.source = $source,
                    r.contactId = $contactId
            `;
            
            await this.graphProvider.query(query, {
                questionId: questionId,
                contactName: contact.name,
                contactId: contact.id || null,
                role: contact.role || null,
                organization: contact.organization || null,
                source: source,
                date: new Date().toISOString()
            });
            
            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing answered by contact: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Get experts for a question via graph traversal
     * @param {string} questionId - The question ID
     * @param {number} limit - Max number of experts to return
     */
    async findExpertsForQuestion(questionId, limit = 5) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            // Multi-path expert finding:
            // 1. Who answered similar questions
            // 2. Who has skills in related technologies
            // 3. Who is mentioned in related documents
            const query = `
                MATCH (q:Question {id: $questionId})
                
                // Path 1: Who answered similar questions
                OPTIONAL MATCH (q)-[:SIMILAR_TO]->(sq:Question)-[:ANSWERED_BY]->(p1:Person)
                
                // Path 2: Who has skills in technologies this question is about
                OPTIONAL MATCH (q)-[:QUESTION_ABOUT]->(t:Technology)<-[:HAS_SKILL]-(p2:Person)
                
                // Path 3: Who is mentioned in source documents
                OPTIONAL MATCH (q)-[:QUESTION_FROM_DOCUMENT]->(d:Document)-[:MENTIONS]->(p3:Person)
                
                WITH q, 
                     collect(DISTINCT {person: p1, source: 'similar_answers', score: 0.9}) as path1,
                     collect(DISTINCT {person: p2, source: 'tech_skills', score: 0.8}) as path2,
                     collect(DISTINCT {person: p3, source: 'document_mentions', score: 0.6}) as path3
                
                UNWIND (path1 + path2 + path3) as expert
                WHERE expert.person IS NOT NULL
                
                RETURN expert.person.name as name, 
                       expert.person.role as role,
                       expert.person.organization as organization,
                       expert.person.contactId as contactId,
                       expert.source as source,
                       expert.score as score
                ORDER BY expert.score DESC
                LIMIT $limit
            `;
            
            const result = await this.graphProvider.query(query, {
                questionId: questionId,
                limit: limit
            });
            
            // Parse results
            const experts = [];
            if (result && result.length > 0) {
                for (const row of result) {
                    experts.push({
                        name: row.name,
                        role: row.role,
                        organization: row.organization,
                        contactId: row.contactId,
                        source: row.source,
                        score: row.score
                    });
                }
            }
            
            return { success: true, experts };
        } catch (e) {
            console.log(`[GraphSync] Error finding experts: ${e.message}`);
            return { error: e.message, experts: [] };
        }
    }

    /**
     * Get related questions through shared entities
     * @param {string} questionId - The question ID
     * @param {number} limit - Max number of related questions
     */
    async getRelatedQuestions(questionId, limit = 5) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            const query = `
                MATCH (q1:Question {id: $questionId})-[:QUESTION_ABOUT|QUESTION_MENTIONS]->(e)
                      <-[:QUESTION_ABOUT|QUESTION_MENTIONS]-(q2:Question)
                WHERE q1 <> q2
                WITH q2, collect(DISTINCT e.name) as sharedEntities
                RETURN q2.id as id, 
                       q2.content as content, 
                       q2.status as status,
                       q2.priority as priority,
                       sharedEntities,
                       size(sharedEntities) as sharedCount
                ORDER BY sharedCount DESC
                LIMIT $limit
            `;
            
            const result = await this.graphProvider.query(query, {
                questionId: questionId,
                limit: limit
            });
            
            const related = [];
            if (result && result.length > 0) {
                for (const row of result) {
                    related.push({
                        id: row.id,
                        content: row.content,
                        status: row.status,
                        priority: row.priority,
                        sharedEntities: row.sharedEntities,
                        sharedCount: row.sharedCount
                    });
                }
            }
            
            return { success: true, related };
        } catch (e) {
            console.log(`[GraphSync] Error getting related questions: ${e.message}`);
            return { error: e.message, related: [] };
        }
    }

    /**
     * Sync a document to the graph
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncDocument(document) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            const nodeData = {
                id: document.id || `document_${Date.now()}`,
                title: document.ai_title || document.name || document.filename,
                name: document.filename || document.name,
                summary: document.ai_summary || '',
                processed_at: document.processed_at || new Date().toISOString()
            };
            
            await this.graphProvider.createNode('Document', nodeData);
            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing document: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync a briefing to the graph
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncBriefing(briefing, projectId, projectName) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            const briefingId = briefing.id || `briefing_${Date.now()}`;
            
            // Create Briefing node
            await this.graphProvider.createNode('Briefing', {
                id: briefingId,
                summary: briefing.summary || '',
                data_hash: briefing.data_hash || '',
                provider: briefing.provider || '',
                model: briefing.model || '',
                tokens_used: briefing.tokens_used || 0,
                generation_time_ms: briefing.generation_time_ms || 0,
                created_at: briefing.created_at || new Date().toISOString(),
                entity_type: 'Briefing'
            });

            // Link briefing to project
            if (projectId || projectName) {
                const projId = projectId || `project_${projectName?.toLowerCase().replace(/\s+/g, '_')}`;
                await this.graphProvider.createNode('Project', {
                    id: projId,
                    name: projectName || projectId
                });
                await this.graphProvider.createRelationship(briefingId, projId, 'BRIEFING_FOR', {
                    generatedAt: briefing.created_at || new Date().toISOString()
                });
            }

            console.log(`[GraphSync] Briefing ${briefingId} synced to graph`);
            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing briefing: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Sync an email to the graph
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async syncEmail(email, projectId, projectName) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            const emailId = email.id;
            
            // Create Email node
            await this.graphProvider.createNode('Email', {
                id: emailId,
                subject: email.subject || '',
                from_email: email.from_email || '',
                from_name: email.from_name || '',
                date_sent: email.date_sent || null,
                direction: email.direction || 'inbound',
                intent: email.detected_intent || email.intent || '',
                sentiment: email.sentiment || 'neutral',
                requires_response: email.requires_response || false,
                summary: email.ai_summary || '',
                body_preview: (email.body_text || '').substring(0, 200),
                attachment_count: email.attachment_count || 0,
                created_at: email.created_at || new Date().toISOString(),
                entity_type: 'Email'
            });

            // Link email to project
            if (projectId || projectName) {
                const projId = projectId || `project_${projectName?.toLowerCase().replace(/\s+/g, '_')}`;
                await this.graphProvider.createNode('Project', {
                    id: projId,
                    name: projectName || projectId
                });
                await this.graphProvider.createRelationship(emailId, projId, 'BELONGS_TO', {});
            }

            // Create SENT_BY relationship (email -> sender)
            if (email.from_email || email.from_name) {
                const senderId = `person_${(email.from_email || email.from_name)?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                await this.graphProvider.createNode('Person', {
                    id: senderId,
                    email: email.from_email || `unknown_${email.id}`,
                    name: email.from_name || email.from_email || 'Unknown',
                    entity_type: 'Person'
                });
                await this.graphProvider.createRelationship(emailId, senderId, 'SENT_BY', {
                    date: email.date_sent || new Date().toISOString()
                });
            }

            // Create SENT_TO relationships for recipients
            const toEmails = email.to_emails || [];
            const toNames = email.to_names || [];
            for (let i = 0; i < toEmails.length; i++) {
                const recipientEmail = toEmails[i];
                const recipientName = toNames[i] || recipientEmail;
                
                if (recipientEmail) {
                    const recipientId = `person_${recipientEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                    await this.graphProvider.createNode('Person', {
                        id: recipientId,
                        email: recipientEmail,
                        name: recipientName,
                        entity_type: 'Person'
                    });
                    await this.graphProvider.createRelationship(emailId, recipientId, 'SENT_TO', {
                        recipientType: 'to'
                    });
                }
            }

            // Create SENT_TO relationships for CC recipients
            const ccEmails = email.cc_emails || [];
            const ccNames = email.cc_names || [];
            for (let i = 0; i < ccEmails.length; i++) {
                const ccEmail = ccEmails[i];
                const ccName = ccNames[i] || ccEmail;
                
                if (ccEmail) {
                    const ccId = `person_${ccEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                    await this.graphProvider.createNode('Person', {
                        id: ccId,
                        email: ccEmail,
                        name: ccName,
                        entity_type: 'Person'
                    });
                    await this.graphProvider.createRelationship(emailId, ccId, 'SENT_TO', {
                        recipientType: 'cc'
                    });
                }
            }

            // Link to sender contact if available
            if (email.sender_contact_id) {
                await this.graphProvider.createRelationship(emailId, email.sender_contact_id, 'SENT_BY_CONTACT', {});
            }

            console.log(`[GraphSync] Email ${emailId} synced to graph (subject: ${email.subject || '(no subject)'})`);
            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error syncing email: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Link email to entities extracted from its content
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async linkEmailToEntities(emailId, entities) {
        if (!this.isGraphAvailable()) return { skipped: true };
        
        try {
            // Link to mentioned people
            if (entities.mentioned_people) {
                for (const person of entities.mentioned_people) {
                    const personId = `person_${person.name?.toLowerCase().replace(/\s+/g, '_') || Date.now()}`;
                    await this.graphProvider.createNode('Person', {
                        id: personId,
                        name: person.name,
                        email: person.email || null,
                        role: person.role || null,
                        entity_type: 'Person'
                    });
                    await this.graphProvider.createRelationship(emailId, personId, 'EMAIL_MENTIONS', {
                        context: person.context || 'mentioned in email'
                    });
                }
            }

            // Link to technologies
            if (entities.technologies) {
                for (const tech of entities.technologies) {
                    const techId = `technology_${tech.toLowerCase().replace(/\s+/g, '_')}`;
                    await this.graphProvider.createNode('Technology', {
                        id: techId,
                        name: tech,
                        entity_type: 'Technology'
                    });
                    await this.graphProvider.createRelationship(emailId, techId, 'EMAIL_REFERENCES', {});
                }
            }

            // Link email to questions it might answer
            if (entities.answers_questions) {
                for (const questionId of entities.answers_questions) {
                    await this.graphProvider.createRelationship(emailId, questionId, 'EMAIL_ANSWERS', {
                        confidence: 'medium'
                    });
                }
            }

            return { success: true };
        } catch (e) {
            console.log(`[GraphSync] Error linking email entities: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Full incremental sync - sync all new/updated data
     */
    async incrementalSync(storage) {
        if (!this.isGraphAvailable()) {
            console.log('[GraphSync] Skipping incremental sync - graph not connected');
            return { skipped: true, reason: 'Graph not connected' };
        }

        const results = { facts: 0, decisions: 0, people: 0, risks: 0, actions: 0, documents: 0, questions: 0, errors: [] };

        try {
            // Sync facts
            const facts = storage.getFacts?.() || [];
            for (const fact of facts) {
                const r = await this.syncFact(fact);
                if (r.success) results.facts++;
                if (r.error) results.errors.push(`Fact: ${r.error}`);
            }

            // Sync decisions
            const decisions = storage.getDecisions?.() || [];
            for (const decision of decisions) {
                const r = await this.syncDecision(decision);
                if (r.success) results.decisions++;
                if (r.error) results.errors.push(`Decision: ${r.error}`);
            }

            // Sync people
            const people = storage.getPeople?.() || [];
            for (const person of people) {
                const r = await this.syncPerson(person);
                if (r.success) results.people++;
                if (r.error) results.errors.push(`Person: ${r.error}`);
            }

            // Sync risks
            const risks = storage.getRisks?.() || [];
            for (const risk of risks) {
                const r = await this.syncRisk(risk);
                if (r.success) results.risks++;
                if (r.error) results.errors.push(`Risk: ${r.error}`);
            }

            // Sync actions
            const actions = storage.getActionItems?.() || [];
            for (const action of actions) {
                const r = await this.syncAction(action);
                if (r.success) results.actions++;
                if (r.error) results.errors.push(`Action: ${r.error}`);
            }

            // Sync documents
            const documents = storage.documents?.items || [];
            for (const doc of documents) {
                const r = await this.syncDocument(doc);
                if (r.success) results.documents++;
                if (r.error) results.errors.push(`Document: ${r.error}`);
            }

            // Sync questions
            const questions = storage.getQuestions?.() || [];
            for (const question of questions) {
                const r = await this.syncQuestion(question);
                if (r.success) results.questions++;
                if (r.error) results.errors.push(`Question: ${r.error}`);
            }

            // Sync contacts
            results.contacts = 0;
            let contacts = storage.getContacts?.() || [];
            // Handle async getContacts
            if (contacts && typeof contacts.then === 'function') {
                contacts = await contacts;
            }
            // Ensure it's an array
            if (!Array.isArray(contacts)) {
                contacts = contacts?.contacts || contacts?.data || [];
            }
            for (const contact of contacts) {
                const r = await this.syncContact(contact);
                if (r.success) results.contacts++;
                if (r.error) results.errors.push(`Contact: ${r.error}`);
            }

            // Sync teams
            results.teams = 0;
            const teams = await storage.getTeams?.() || [];
            for (const team of teams) {
                const r = await this.syncTeam(team);
                if (r.success) results.teams++;
                if (r.error) results.errors.push(`Team: ${r.error}`);
            }

            console.log(`[GraphSync] Incremental sync completed:`, results);
            return results;
        } catch (e) {
            console.log(`[GraphSync] Incremental sync error: ${e.message}`);
            return { error: e.message, ...results };
        }
    }

    /**
     * Auto-sync after document processing
     * Call this at the end of document processing
     */
    async onDocumentProcessed(document, extractedData) {
        if (!this.isGraphAvailable()) return { skipped: true };

        const results = { synced: { nodes: 0, relationships: 0 } };

        try {
            // Sync the document
            await this.syncDocument(document);
            results.synced.nodes++;

            // Sync extracted facts
            if (extractedData.facts) {
                for (const fact of extractedData.facts) {
                    await this.syncFact(fact);
                    results.synced.nodes++;
                }
            }

            // Sync extracted decisions
            if (extractedData.decisions) {
                for (const decision of extractedData.decisions) {
                    await this.syncDecision(decision);
                    results.synced.nodes++;
                }
            }

            // Sync extracted people
            if (extractedData.people) {
                for (const person of extractedData.people) {
                    await this.syncPerson(person);
                    results.synced.nodes++;
                }
            }

            // Sync extracted risks
            if (extractedData.risks) {
                for (const risk of extractedData.risks) {
                    await this.syncRisk(risk);
                    results.synced.nodes++;
                }
            }

            // Sync extracted actions
            if (extractedData.actions) {
                for (const action of extractedData.actions) {
                    await this.syncAction(action);
                    results.synced.nodes++;
                }
            }

            // Create relationships
            await this._createRelationships(document, extractedData);

            console.log(`[GraphSync] Auto-sync after document processed:`, results);
            return results;
        } catch (e) {
            console.log(`[GraphSync] Error in auto-sync: ${e.message}`);
            return { error: e.message };
        }
    }

    /**
     * Create relationships between entities
     * SOTA v3.0 - Uses native provider methods for Supabase compatibility
     */
    async _createRelationships(document, extractedData) {
        if (!this.isGraphAvailable()) return;

        try {
            const docId = document.id || `document_${Date.now()}`;
            
            // Link facts to document
            if (extractedData.facts) {
                for (const fact of extractedData.facts) {
                    const factId = fact.id || `fact_${Date.now()}`;
                    await this.graphProvider.createRelationship(factId, docId, 'EXTRACTED_FROM', {});
                }
            }

            // Link people who are mentioned
            if (extractedData.people) {
                for (const person of extractedData.people) {
                    const personId = `person_${person.name?.toLowerCase().replace(/\s+/g, '_') || Date.now()}`;
                    await this.graphProvider.createRelationship(personId, docId, 'MENTIONED_IN', {});
                }
            }

            // Link decisions to document
            if (extractedData.decisions) {
                for (const decision of extractedData.decisions) {
                    const decId = decision.id || `decision_${Date.now()}`;
                    await this.graphProvider.createRelationship(decId, docId, 'DOCUMENTED_IN', {});
                }
            }
        } catch (e) {
            console.log(`[GraphSync] Error creating relationships: ${e.message}`);
        }
    }
}

// Singleton
let graphSyncInstance = null;
function getGraphSync(options = {}) {
    if (!graphSyncInstance) {
        graphSyncInstance = new GraphSync(options);
    }
    if (options.graphProvider) graphSyncInstance.setGraphProvider(options.graphProvider);
    if (options.storage) graphSyncInstance.setStorage(options.storage);
    return graphSyncInstance;
}

module.exports = { GraphSync, getGraphSync };
