/**
 * GraphRAG Engine
 * Combines graph traversal with semantic search for enhanced RAG
 * Integrates with Ontology system for better query understanding
 * Includes caching for improved performance
 */

const { logger } = require('../logger');
const llm = require('../llm');
const { getOntologyManager, getRelationInference, getEmbeddingEnricher } = require('../ontology');
const { getQueryCache, getSyncTracker } = require('../utils');
const { getCypherGenerator } = require('./CypherGenerator');
const crypto = require('crypto');

const log = logger.child({ module: 'graphrag-engine' });

class GraphRAGEngine {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        this.storage = options.storage;

        // Multi-graph support
        this.multiGraphManager = options.multiGraphManager || null;

        // AI-powered Cypher generation
        this.useCypherGenerator = options.useCypherGenerator !== false;
        this.currentProjectId = options.projectId || null;

        // LLM configuration - should come from admin config, no hardcoded defaults
        this.embeddingProvider = options.embeddingProvider || null;
        this.embeddingModel = options.embeddingModel || null;
        this.llmProvider = options.llmProvider || null;
        this.llmModel = options.llmModel || null;

        if (!this.llmProvider) {
            log.warn({ event: 'graphrag_no_llm' }, 'No LLM provider specified - should be passed from admin config');
        }

        // Configuration from app config
        this.llmConfig = options.llmConfig || {};

        // Ontology integration
        this.ontology = options.ontology || getOntologyManager();
        this.relationInference = options.relationInference || getRelationInference();
        this.embeddingEnricher = options.embeddingEnricher || getEmbeddingEnricher();

        // Enable ontology features
        this.useOntology = options.useOntology !== false;

        // Cache for query results
        this.queryCache = options.queryCache || getQueryCache();
        this.enableCache = options.enableCache !== false;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Generate a deterministic ID based on content
     * @param {string} label 
     * @param {string} uniqueVal 
     */
    generateDeterministicId(label, uniqueVal) {
        if (!uniqueVal) return null;
        // Include project ID in seed to keep nodes project-scoped (unless shared)
        const seed = `${this.currentProjectId || 'default'}:${label}:${uniqueVal.toLowerCase().trim()}`;
        return crypto.createHash('md5').update(seed).digest('hex');
    }

    /**
     * Set the multi-graph manager for cross-project queries
     * @param {MultiGraphManager} manager 
     */
    setMultiGraphManager(manager) {
        this.multiGraphManager = manager;
    }

    /**
     * Set the current project context
     * @param {string} projectId 
     */
    setProjectContext(projectId) {
        this.currentProjectId = projectId;
        if (this.multiGraphManager) {
            this.multiGraphManager.currentProjectId = projectId;
        }
        // Also update graph provider context if supported
        if (this.graphProvider && typeof this.graphProvider.setProjectContext === 'function') {
            this.graphProvider.setProjectContext(projectId);
        }
    }

    /**
     * Sync data to graph database
     * @param {object} data - { documents, people, teams, sprints, actions, etc. }
     * @param {object} options - { computeSimilarity: boolean }
     * @returns {Promise<{nodes: number, edges: number, errors: Array}>}
     */
    async syncToGraph(data, options = {}) {
        const startTime = Date.now();
        const results = { nodes: 0, edges: 0, errors: [] };

        if (!this.graphProvider) {
            return { ...results, error: 'No graph provider configured' };
        }

        log.info({
            event: 'graphrag_sync_start',
            counts: Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: data[k]?.length || 0 }), {}),
            projectId: this.currentProjectId
        }, 'Starting graph sync');

        // Update status to syncing
        if (this.graphProvider && typeof this.graphProvider.updateSyncStatus === 'function') {
            await this.graphProvider.updateSyncStatus({
                sync_status: 'syncing',
                last_connected_at: new Date().toISOString()
            });
        }

        try {
            // 0. GRAPH CLEARING (If requested)
            if (options.clear) {
                log.info({ event: 'graphrag_clearing_graph' }, 'Clearing graph execution for full resync');
                if (this.graphProvider.clear) {
                    await this.graphProvider.clear();
                } else if (this.graphProvider.deleteGraph) {
                    await this.graphProvider.deleteGraph(this.graphProvider.currentGraphName || 'default');
                }
            }

            // ID Mapping: Old ID -> New Deterministic ID
            const idMap = new Map();

            // Helper to sync nodes batch
            const syncNodes = async (label, items, mapper, deterministicKey = null) => {
                if (!items || items.length === 0) return;

                const nodes = items.map(item => {
                    const mapped = mapper(item);

                    // V3 Plan: Use explicit UUID from source if available (item.id)
                    // Only fallback to deterministic hash if no ID exists (e.g. for external data)
                    if (item.id) {
                        mapped.id = item.id;
                        idMap.set(item.id, item.id);
                    } else if (deterministicKey && item[deterministicKey]) {
                        const newId = this.generateDeterministicId(label, item[deterministicKey]);
                        if (newId) {
                            idMap.set(item.id, newId); // Map original ID to new ID
                            mapped.id = newId;
                        }
                    }
                    return mapped;
                });

                const result = await this.graphProvider.createNodesBatch(label, nodes);

                if (result.ok) {
                    results.nodes += result.created;
                } else {
                    results.errors.push(...(result.errors || []));
                    log.warn({ event: 'graphrag_sync_nodes_error', label, error: result.errors }, 'Failed to sync nodes');
                }
            };

            // Helper to create relationship object
            const createRel = (fromOriginalId, toOriginalId, type, props = {}) => {
                const fromId = idMap.get(fromOriginalId) || fromOriginalId;
                const toId = idMap.get(toOriginalId) || toOriginalId;

                if (!fromId || !toId) return null;

                return {
                    fromId,
                    toId,
                    type,
                    properties: { ...props, updated_at: new Date().toISOString() }
                };
            };

            // Helper to scan text for mentions
            const extractMentionsFromText = (text, contacts, sourceId, excludeContactIds = []) => {
                if (!text || !contacts) return [];
                const mentions = [];
                const lowerText = text.toLowerCase();
                const excludeSet = new Set(excludeContactIds.map(String));

                for (const contact of contacts) {
                    if (excludeSet.has(String(contact.id))) continue;

                    const names = [contact.name, ...(contact.aliases || [])].filter(Boolean);
                    for (const name of names) {
                        if (name.length < 3) continue; // Skip short names
                        if (lowerText.includes(name.toLowerCase())) {
                            mentions.push(createRel(sourceId, contact.id, 'MENTIONS', { match_type: 'text_scan', matched_name: name }));
                            break; // Match first valid name variant per contact
                        }
                    }
                }
                return mentions;
            };

            // ==================== PHASE 1: NODES ====================

            // 1. Project Node
            if (data.project) {
                await syncNodes('Project', [data.project], p => ({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    description: p.description,
                    ...p.metadata
                }), 'id'); // Project ID is usually stable
            }

            // 2. Sprint Nodes
            await syncNodes('Sprint', data.sprints, s => ({
                id: s.id,
                name: s.name,
                status: s.status,
                goal: s.goal,
                start_date: s.startDate,
                end_date: s.endDate,
                ...s.metadata
            }), 'name');

            // 3. UserStory Nodes
            await syncNodes('UserStory', data.userStories, s => ({
                id: s.id,
                title: s.title,
                status: s.status,
                story_points: s.storyPoints,
                description: s.description,
                ...s.metadata
            }), 'title');

            // 4. Task Nodes (mapped from Actions)
            await syncNodes('Task', data.actions, a => ({
                id: a.id,
                title: a.title,
                status: a.status,
                priority: a.priority,
                description: a.description,
                dueDate: a.dueDate,
                ...a.metadata
            }), 'title');

            // 5. Document Nodes
            await syncNodes('Document', data.documents, d => ({
                id: d.id,
                title: d.title,
                type: d.type,
                url: d.url,
                lastModified: d.lastModified,
                author_contact_id: d.author_contact_id, // Pass through for edge creation
                ...d.metadata
            }), 'url'); // URL is a better deterministic key for documents

            // V3: Document Attribution (AUTHORED_BY)
            if (data.documents) {
                for (const doc of data.documents) {
                    if (doc.author_contact_id) {
                        const rel = createRel(doc.id, doc.author_contact_id, 'AUTHORED_BY', { certainty: 'explicit' });
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // 6. Teams
            await syncNodes('Team', data.teams, t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                ...t.metadata
            }), 'name');

            // 7. People
            await syncNodes('Person', data.people, p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                email: p.email,
                avatar: p.avatar,
                ...p.metadata
            }), 'email'); // Email is best deterministic key for people

            // 8. Facts
            await syncNodes('Fact', data.facts, f => ({
                id: f.id,
                content: f.content,
                source: f.source,
                category: f.category,
                ...f.metadata
            }), 'content');

            // 9. Decisions
            await syncNodes('Decision', data.decisions, d => ({
                id: d.id,
                title: d.title,
                status: d.status,
                impact: d.impact,
                rationale: d.rationale,
                ...d.metadata
            }), 'title');

            // 10. Risks
            await syncNodes('Risk', data.risks, r => ({
                id: r.id,
                title: r.title,
                status: r.status,
                severity: r.severity,
                probability: r.probability,
                mitigation: r.mitigation,
                ...r.metadata
            }), 'title');

            // 11. Emails
            await syncNodes('Email', data.emails, e => ({
                id: e.id,
                subject: e.subject,
                from_name: e.fromName,
                from_email: e.fromEmail,
                date_sent: e.dateSent,
                ...e.metadata
            }), 'id'); // Emails usually have unique IDs

            // 12. CalendarEvents
            await syncNodes('CalendarEvent', data.events, e => ({
                id: e.id,
                title: e.title,
                start_at: e.start,
                end_at: e.end,
                location: e.location,
                type: e.type,
                ...e.metadata
            }), 'id');

            // 13. Questions
            await syncNodes('Question', data.questions, q => ({
                id: q.id,
                content: q.text, // Schema uses 'content', data uses 'text' often
                status: q.status,
                answer: q.answer,
                ...q.metadata
            }), 'text');


            // ==================== PHASE 2: RELATIONSHIPS ====================
            const relationships = [];

            // 15: BELONGS_TO_PROJECT (All -> Project)
            if (data.project) {
                const projectId = data.project.id;
                // Helper to link all items of a collection to project
                const linkToProject = (items) => {
                    if (!items) return;
                    for (const item of items) {
                        const rel = createRel(item.id, projectId, 'BELONGS_TO_PROJECT');
                        if (rel) relationships.push(rel);
                    }
                };

                linkToProject(data.sprints);
                linkToProject(data.userStories);
                linkToProject(data.actions);
                linkToProject(data.documents);
                linkToProject(data.teams);
                linkToProject(data.people); // Maybe? People might belong to Org, not Project directly. But for Project View it helps.
                linkToProject(data.risks);
                linkToProject(data.decisions);
                linkToProject(data.facts);
                linkToProject(data.questions);
            }

            // 16: MEMBER_OF_TEAM (Person -> Team)
            if (data.teams) {
                for (const team of data.teams) {
                    if (team.members && Array.isArray(team.members)) {
                        for (const memberId of team.members) {
                            const rel = createRel(memberId, team.id, 'MEMBER_OF_TEAM');
                            if (rel) relationships.push(rel);
                        }
                    }
                    if (team.leadId) {
                        const rel = createRel(team.leadId, team.id, 'LEADS_TEAM');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // 17-20: Work Layer
            // ASSIGNED_TO (Task -> Person)
            if (data.actions) {
                for (const task of data.actions) {
                    if (task.assigneeId) {
                        const rel = createRel(task.id, task.assigneeId, 'ASSIGNED_TO');
                        if (rel) relationships.push(rel);
                    }
                    // PLANNED_IN (Task -> Sprint)
                    if (task.sprintId) {
                        const rel = createRel(task.id, task.sprintId, 'PLANNED_IN');
                        if (rel) relationships.push(rel);
                    }
                    // PARENT_OF (Task -> Task) - if subtasks supported
                    if (task.parentId) {
                        const rel = createRel(task.parentId, task.id, 'PARENT_OF'); // Parent -> Child
                        if (rel) relationships.push(rel);
                    }
                    // IMPLEMENTS (Task -> UserStory)
                    if (task.storyId) {
                        const rel = createRel(task.id, task.storyId, 'IMPLEMENTS');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // UserStory -> Sprint
            if (data.userStories) {
                for (const story of data.userStories) {
                    if (story.sprintId) {
                        const rel = createRel(story.id, story.sprintId, 'PLANNED_IN');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // 21-23: Knowledge Layer
            // EXTRACTED_FROM (Fact/Decision/Risk -> Document)
            const linkExtraction = (items) => {
                if (!items) return;
                for (const item of items) {
                    if (item.sourceDocId) {
                        const rel = createRel(item.id, item.sourceDocId, 'EXTRACTED_FROM');
                        if (rel) relationships.push(rel);
                    }
                }
            };
            linkExtraction(data.facts);
            linkExtraction(data.decisions);
            linkExtraction(data.risks);
            linkExtraction(data.questions);

            // MENTIONED_IN (Person -> Document) - if we have mentions data
            // (Skipping for now unless data provided)

            // 23. Text Entity Extraction (MENTIONS) - Relations #41-45
            // Scans task/content text for Contact names
            if (data.people) {
                const contacts = data.people.filter(p => p.label === 'Contact' || p.role); // Filter to potential contacts

                const scanAndLink = (items, textFields, ownerField, statedByField = null) => {
                    if (!items) return;
                    for (const item of items) {
                        // V3: Check explicit FKs first (High Confidence)
                        if (statedByField && item[statedByField]) {
                            // Use 'MENTIONS' or explicit semantic type? 
                            // facts.stated_by -> MENTIONS/ATTRIBUTED_TO? 
                            // Let's stick to MENTIONS for now or a new type.
                            // Actually, for Facts/Risks, it's usually "REPORTED_BY" or "STATED_BY".
                            // But createRel handles generic types. 
                            // If it's a Fact, stated_by_contact_id -> HAS_SOURCE / ATTRIBUTED_TO
                            // Let's us MENTIONS with property { type: 'attribution' }
                            const rel = createRel(item.id, item[statedByField], 'MENTIONS', { type: 'explicit_attribution' });
                            if (rel) relationships.push(rel);
                        }

                        // Also scan text (Lower Confidence, but good for finding *other* people mentioned)
                        const text = textFields.map(field => item[field]).join(' ');
                        const exclude = [];
                        if (item[ownerField]) exclude.push(item[ownerField]);
                        if (statedByField && item[statedByField]) exclude.push(item[statedByField]);

                        const mentions = extractMentionsFromText(text, contacts, item.id, exclude);
                        relationships.push(...mentions);

                        // V3: Email Lineage (DERIVED_FROM)
                        if (item.source_email_id) {
                            const rel = createRel(item.id, item.source_email_id, 'DERIVED_FROM');
                            if (rel) relationships.push(rel);
                        }
                    }
                };

                scanAndLink(data.actions, ['title', 'description'], 'assigneeId');
                scanAndLink(data.decisions, ['title', 'rationale'], 'ownerId'); // ownerId/madeById
                scanAndLink(data.risks, ['title', 'mitigation'], 'ownerId', 'reported_by_contact_id');
                scanAndLink(data.questions, ['text', 'answer'], 'assignedToId');
                scanAndLink(data.facts, ['content'], 'source', 'stated_by_contact_id');
            }

            // 24-27: Communication Layer
            if (data.emails) {
                for (const email of data.emails) {
                    if (email.fromPersonId) {
                        const rel = createRel(email.id, email.fromPersonId, 'SENT_BY');
                        if (rel) relationships.push(rel);
                    }
                    // SENT_TO, HAS_ATTACHMENT...
                }
            }

            if (data.events) {
                for (const event of data.events) {
                    // LINKED_TO (CalendarEvent -> Document/Action)
                    if (event.linkedDocId) {
                        const rel = createRel(event.id, event.linkedDocId, 'LINKED_TO');
                        if (rel) relationships.push(rel);
                    }
                    if (event.linkedActionId) {
                        const rel = createRel(event.id, event.linkedActionId, 'LINKED_TO');
                        if (rel) relationships.push(rel);
                    }

                    // INVOLVES (CalendarEvent -> Contact) - V3: Uses calendar_event_contacts
                    if (event.calendar_event_contacts && Array.isArray(event.calendar_event_contacts)) {
                        for (const contactLink of event.calendar_event_contacts) {
                            const rel = createRel(event.id, contactLink.contact_id, 'INVOLVES', { role: contactLink.role });
                            if (rel) relationships.push(rel);
                        }
                    } else if (event.linkedContactIds && Array.isArray(event.linkedContactIds)) {
                        // Fallback to legacy array if join table empty
                        for (const contactId of event.linkedContactIds) {
                            const rel = createRel(event.id, contactId, 'INVOLVES');
                            if (rel) relationships.push(rel);
                        }
                    } else if (event.attendees && Array.isArray(event.attendees)) {
                        // Fallback to attendees
                        for (const personId of event.attendees) {
                            const rel = createRel(event.id, personId, 'INVOLVES');
                            if (rel) relationships.push(rel);
                        }
                    }
                }
            }

            // Sync collected relationships
            if (relationships.length > 0) {
                const result = await this.graphProvider.createRelationshipsBatch(relationships);
                if (result.ok) {
                    results.edges += result.created;
                } else {
                    results.errors.push(...(result.errors || []));
                    log.warn({ event: 'graphrag_sync_edges_error', error: result.errors }, 'Failed to sync edges');
                }
            }

            // ==================== PHASE 3: ENTITY LINKS (New V3) ====================
            if (data.entityLinks && data.entityLinks.length > 0) {
                const entityLinks = [];
                for (const link of data.entityLinks) {
                    // Map link_type to UpperSnakeCase edge type
                    const edgeType = link.link_type.toUpperCase();
                    // Map from/to types to node labels (simple usually, but let's be safe)
                    // The graph provider's createRelationshipsBatch handles ID resolution if we provide IDs

                    // We need to resolve the "Graph ID" for these entities.
                    // Since we used deterministic IDs or original IDs in Phase 1, we can try to resolve them.
                    const rel = createRel(link.from_entity_id, link.to_entity_id, edgeType, {
                        source: link.source,
                        confidence: link.confidence,
                        metadata: link.metadata
                    });

                    if (rel) {
                        entityLinks.push(rel);
                    }
                }

                if (entityLinks.length > 0) {
                    const linkResult = await this.graphProvider.createRelationshipsBatch(entityLinks);
                    if (linkResult.ok) {
                        results.edges += linkResult.created;
                        log.info({ event: 'graphrag_sync_entity_links', count: linkResult.created }, 'Synced entity links');
                    }
                }
            }

            // 28: SIMILAR_TO (Semantic)
            if (options.computeSimilarity) {
                const simResult = await this.computeSimilarityEdges();
                results.edges += simResult.created;
                log.info({ event: 'graphrag_similarity_edges', created: simResult.created }, 'Computed similarity edges');
            }

            // Reconcile Stale Entries (Full Resync Only)
            if (options.clear && this.graphProvider.pruneStale) {
                // Since this was a full "clear" start, we don't strictly *need* pruneStale 
                // because we wiped the graph.
                // But if options.clear was FALSE, we might want to prune.
                // However, the GraphProvider.clear() was called at start.
                // So everything is fresh.
                // If we implemented incremental sync, pruneStale would be used here.
            } else if (!options.clear && this.graphProvider.pruneStale) {
                // Incremental Sync: Prune anything not touched in this sync?
                // That requires tracking what WAS touched.
                // For now, let's skip complex reconciliation in this MVP step.
            }

        } catch (error) {
            log.error({ event: 'graphrag_sync_error', error: error.message, stack: error.stack }, 'Sync failed');
            results.errors.push(error.message);

            // Update status to failed
            if (this.graphProvider && typeof this.graphProvider.updateSyncStatus === 'function') {
                await this.graphProvider.updateSyncStatus({
                    sync_status: 'failed',
                    health_status: 'error',
                    error: error.message
                });
            }
        }

        const duration = Date.now() - startTime;
        log.info({ event: 'graphrag_sync_complete', duration, results }, 'Graph sync completed');

        // Update status to idle (completed) with fresh stats
        if (this.graphProvider && typeof this.graphProvider.getStats === 'function' && typeof this.graphProvider.updateSyncStatus === 'function') {
            log.info('Fetching graph stats for final status update...');
            const stats = await this.graphProvider.getStats();
            log.info({ event: 'graphrag_sync_stats', stats }, 'Graph stats fetched');

            const updateResult = await this.graphProvider.updateSyncStatus({
                sync_status: 'idle',
                node_count: stats.ok ? stats.nodeCount : results.nodes,
                edge_count: stats.ok ? stats.edgeCount : results.edges,
                last_synced_at: new Date().toISOString(),
                health_status: 'healthy',
                error: null
            });
            log.info({ event: 'graphrag_sync_status_update', result: updateResult }, 'Status update result');
            if (!updateResult.ok) {
                console.error('FAILED TO UPDATE SYNC STATUS:', updateResult.error);
            }
        }

        return results;
    }

    /**
     * Compute semantic similarity edges between nodes
     * @param {number} threshold - Similarity threshold (0.0 - 1.0)
     * @returns {Promise<{created: number}>}
     */
    async computeSimilarityEdges(threshold = 0.8) {
        if (!this.graphProvider || !this.graphProvider.supabase) {
            log.warn('GraphProvider or Supabase client not available for similarity computation');
            return { created: 0 };
        }

        let createdCount = 0;

        // Define mapping for similarity tables
        const mappings = [
            { label: 'Fact', table: 'fact_similarities', fromCol: 'fact_id', toCol: 'similar_fact_id' },
            { label: 'Decision', table: 'decision_similarities', fromCol: 'decision_id', toCol: 'similar_decision_id' },
            { label: 'Question', table: 'question_similarities', fromCol: 'question_id', toCol: 'similar_question_id' }
        ];

        for (const map of mappings) {
            try {
                // Query similarity table directly
                const { data: similarities, error } = await this.graphProvider.supabase
                    .from(map.table)
                    .select('*')
                    .gte('similarity_score', threshold);

                if (error) {
                    log.error({ event: 'graphrag_similarity_error', table: map.table, error }, 'Failed to fetch similarities');
                    continue;
                }

                if (!similarities || similarities.length === 0) continue;

                // Prepare relationships batch
                const relationships = similarities.map(s => ({
                    fromId: s[map.fromCol],
                    toId: s[map.toCol],
                    type: 'SIMILAR_TO',
                    properties: {
                        score: s.similarity_score,
                        source_table: map.table
                    }
                }));

                // Batch create
                const result = await this.graphProvider.createRelationshipsBatch(relationships);
                if (result.ok) {
                    createdCount += result.created;
                }

            } catch (err) {
                log.error({ event: 'graphrag_similarity_exception', table: map.table, error: err.message }, 'Exception computing similarities');
            }
        }

        return { created: createdCount };
    }

    /**
     * Query the knowledge base using GraphRAG
     * @param {string} userQuery - User's natural language query
     * @param {object} options - Query options
     * @returns {Promise<{answer: string, sources: Array, queryType: string}>}
     */
    async query(userQuery, options = {}) {
        const startTime = Date.now();

        // Check cache first (unless disabled)
        if (this.enableCache && !options.noCache) {
            const cached = this.queryCache.getQuery(userQuery);
            if (cached) {
                return {
                    ...cached,
                    cached: true,
                    latencyMs: Date.now() - startTime
                };
            }
        }

        // 1. Classify query type with ontology analysis
        const queryAnalysis = this.classifyQuery(userQuery);
        const queryType = queryAnalysis.type;
        log.debug({ event: 'graphrag_query_type', queryType, entityHints: queryAnalysis.entityHints.length, relationHints: queryAnalysis.relationHints.length }, 'Query type');

        // 2. Execute appropriate search strategy
        let results = [];
        let aiGeneratedCypher = null;

        // Check if graph provider is available and connected
        const graphAvailable = this.graphProvider && this.graphProvider.connected;

        if (graphAvailable) {
            // ============ AI-POWERED CYPHER GENERATION ============
            // Try AI-generated Cypher query first (most intelligent approach)
            if (this.useCypherGenerator) {
                try {
                    const cypherGen = getCypherGenerator({
                        llmProvider: this.llmProvider,
                        llmModel: this.llmModel,
                        llmConfig: this.llmConfig,
                        ontology: this.ontology
                    });

                    const generated = await cypherGen.generate(userQuery, {
                        provider: this.llmProvider,
                        model: this.llmModel
                    });

                    if (generated.cypher && generated.confidence >= 0.3) {
                        aiGeneratedCypher = generated;
                        log.debug({ event: 'graphrag_cypher_generated', confidence: generated.confidence, cypherPreview: generated.cypher.substring(0, 100) }, 'AI generated Cypher');

                        const cypherResult = await this.graphProvider.query(generated.cypher);
                        if (cypherResult.ok && cypherResult.results?.length > 0) {
                            results = cypherResult.results.map(r => ({
                                type: this.inferNodeType(r),
                                content: this.formatGraphResult(r),
                                data: r,
                                source: 'ai_cypher',
                                confidence: generated.confidence
                            }));
                            log.debug({ event: 'graphrag_cypher_results', count: results.length }, 'AI Cypher returned results');
                        }
                    }
                } catch (error) {
                    log.warn({ event: 'graphrag_cypher_failed', reason: error.message }, 'AI Cypher generation failed');
                }
            }

            // ============ ONTOLOGY PATTERN MATCHING ============
            // If AI generation didn't work, try ontology pattern matching
            if (results.length === 0 && queryAnalysis.matchedPattern?.cypher) {
                try {
                    const cypherResult = await this.graphProvider.query(queryAnalysis.matchedPattern.cypher);
                    if (cypherResult.ok && cypherResult.results?.length > 0) {
                        results = cypherResult.results.map(r => ({
                            type: queryAnalysis.matchedPattern.pattern.entityTypes[0] || 'Entity',
                            content: this.formatGraphResult(r),
                            data: r,
                            source: 'ontology_pattern'
                        }));
                    }
                } catch (error) {
                    log.warn({ event: 'graphrag_ontology_pattern_failed', reason: error.message }, 'Ontology pattern query failed');
                }
            }
        } else {
            log.debug({ event: 'graphrag_fallback_search' }, 'Graph provider not available, using fallback search');
        }

        // ============ FALLBACK SEARCH ============
        // If graph queries didn't work or graph not available, use hybrid search
        if (results.length === 0) {
            switch (queryType) {
                case 'structural':
                    results = await this.structuralSearch(userQuery, queryAnalysis);
                    break;
                case 'semantic':
                    results = await this.semanticSearch(userQuery, queryAnalysis);
                    break;
                case 'hybrid':
                default:
                    results = await this.hybridSearch(userQuery, queryAnalysis);
                    break;
            }
        }

        log.debug({ event: 'graphrag_found_items', count: results.length }, 'Found relevant items');

        // 3. Generate response using LLM
        const response = await this.generateResponse(userQuery, results, options);

        const latencyMs = Date.now() - startTime;
        log.debug({ event: 'graphrag_latency', latencyMs }, 'Total latency');

        const result = {
            answer: response.answer,
            sources: response.sources,
            queryType,
            queryAnalysis: {
                entityHints: queryAnalysis.entityHints,
                relationHints: queryAnalysis.relationHints,
                matchedPattern: queryAnalysis.matchedPattern?.patternName || null
            },
            // Include AI-generated Cypher info if used
            aiCypher: aiGeneratedCypher ? {
                query: aiGeneratedCypher.cypher,
                explanation: aiGeneratedCypher.explanation,
                confidence: aiGeneratedCypher.confidence,
                cached: aiGeneratedCypher.cached || false
            } : null,
            graphAvailable,
            latencyMs
        };

        // Cache the result
        if (this.enableCache && result.sources.length > 0) {
            this.queryCache.setQuery(userQuery, result, { ttl: this.cacheTTL });
        }

        return result;
    }

    /**
     * Format a graph result for display
     * @param {object} result - Raw graph result
     * @returns {string}
     */
    formatGraphResult(result) {
        if (!result) return '';

        // Handle node results
        if (result.properties) {
            const props = result.properties;
            const name = props.name || props.title || props.content || props.id;
            const extra = [];
            if (props.role) extra.push(props.role);
            if (props.organization) extra.push(props.organization);
            if (props.status) extra.push(props.status);
            return extra.length > 0 ? `${name} (${extra.join(', ')})` : name;
        }

        // Handle array of nodes
        if (Array.isArray(result)) {
            return result.map(r => this.formatGraphResult(r)).join(', ');
        }

        return JSON.stringify(result);
    }

    /**
     * Infer the node type from a graph result
     * @param {object} result - Graph query result row
     * @returns {string}
     */
    inferNodeType(result) {
        if (!result) return 'Entity';

        // Check for direct labels property
        if (result.labels && result.labels.length > 0) {
            return result.labels[0];
        }
        if (result._labels && result._labels.length > 0) {
            return result._labels[0];
        }

        // Check nested node objects
        for (const key of Object.keys(result)) {
            const val = result[key];
            if (val && typeof val === 'object') {
                if (val.labels?.length > 0) return val.labels[0];
                if (val._labels?.length > 0) return val._labels[0];
            }
        }

        // Try to infer from properties
        if (result.properties || result._properties) {
            const props = result.properties || result._properties;
            if (props.role || props.organization) return 'Person';
            if (props.title && props.date) return 'Meeting';
            if (props.content && props.type) return 'Document';
            if (props.status && props.priority) return 'Task';
        }

        return 'Entity';
    }

    /**
     * Classify query type for routing
     * Uses ontology for better query understanding
     * @param {string} query - User query
     * @returns {{type: string, entityHints: Array, relationHints: Array, matchedPattern: object|null}}
     */
    classifyQuery(query) {
        const q = query.toLowerCase();
        const result = {
            type: 'hybrid',
            entityHints: [],
            relationHints: [],
            matchedPattern: null
        };

        // Try ontology pattern matching first
        if (this.useOntology) {
            const patternMatch = this.ontology.matchQueryPattern(query);
            if (patternMatch) {
                result.matchedPattern = patternMatch;
                result.type = 'structural'; // Ontology patterns are typically structural
                log.debug({ event: 'graphrag_pattern_matched', patternName: patternMatch.patternName }, 'Matched ontology pattern');
            }

            // Get entity and relation hints from ontology
            const hints = this.ontology.extractEntityHints(query);
            result.entityHints = hints.entityHints || [];
            result.relationHints = hints.relationHints || [];
        }

        // If no ontology pattern matched, use rule-based classification
        if (!result.matchedPattern) {
            // Structural patterns - relationship/graph queries
            const structuralPatterns = [
                /quem (reporta|trabalha|lidera|gere|gerencia|são|sao)/i,
                /who (reports|works|leads|manages|are|is)/i,
                /hierarquia|organograma|estrutura/i,
                /hierarchy|org.?chart|structure/i,
                /relação entre|ligação entre|conexão entre/i,
                /relationship between|connection between/i,
                /quantos|quantas|total de|count of|how many/i,
                /subordinados|diretos|equipa de/i,
                /subordinates|direct reports|team of/i,
                /lista|listar|list|show all/i,
                /pessoas|people|members|team/i
            ];

            // Semantic patterns - meaning/content queries
            const semanticPatterns = [
                /o que (sabemos|é|significa|quer dizer)/i,
                /what (do we know|is|does it mean)/i,
                /como funciona|explica|descreve/i,
                /how does|explain|describe/i,
                /resume|sumariza|summarize/i,
                /porque|por que|why/i,
                /informação sobre|about|regarding/i
            ];

            // Check structural patterns
            for (const pattern of structuralPatterns) {
                if (pattern.test(q)) {
                    result.type = 'structural';
                    break;
                }
            }

            // Check semantic patterns (only if not already structural)
            if (result.type !== 'structural') {
                for (const pattern of semanticPatterns) {
                    if (pattern.test(q)) {
                        result.type = 'semantic';
                        break;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Structural search using graph traversal
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Promise<Array>}
     */
    async structuralSearch(query, queryAnalysis = {}) {
        const results = [];
        const q = query.toLowerCase();

        // Extract entities from query (enhanced with ontology hints)
        const entities = this.extractEntities(query, queryAnalysis);

        // Detect "list all" type queries
        const isListQuery = /quem (são|sao|é|e)|who (are|is)|list|listar|mostrar|show|todas as|all the|pessoas|people|members|team/i.test(q);

        // Determine which entity types to search based on query
        let targetTypes = [];
        if (/pessoas|people|quem|who|team|members|equipa/i.test(q)) targetTypes.push('Person');
        if (/projetos?|projects?/i.test(q)) targetTypes.push('Project');
        if (/reuniões?|meetings?/i.test(q)) targetTypes.push('Meeting');
        if (/decisões?|decisions?/i.test(q)) targetTypes.push('Decision');
        if (/riscos?|risks?/i.test(q)) targetTypes.push('Risk');
        if (/tarefas?|tasks?|todos?/i.test(q)) targetTypes.push('Task');
        if (/tecnologias?|tech|technologies?/i.test(q)) targetTypes.push('Technology');
        if (/clientes?|clients?/i.test(q)) targetTypes.push('Client');

        // If no specific type detected but it's a list query, default to Person
        if (targetTypes.length === 0 && isListQuery) {
            targetTypes.push('Person');
        }

        // Add entity hints from ontology
        if (queryAnalysis.entityHints?.length > 0) {
            for (const hint of queryAnalysis.entityHints) {
                if (!targetTypes.includes(hint.type)) {
                    targetTypes.push(hint.type);
                }
            }
        }

        // Check if this is a cross-project query
        const isCrossProjectQuery = /across projects|multiple projects|all projects|cross.?project|em todos os projetos|varios projetos/i.test(q);

        // Search for target types in graph - PARALLEL for better performance
        if (this.graphProvider && this.graphProvider.connected && targetTypes.length > 0) {
            // Run all type searches in parallel
            const searchPromises = targetTypes.map(async (targetType) => {
                try {
                    // Use multiGraphManager for shared entities or cross-project queries
                    if (this.multiGraphManager && (this.ontology.isSharedEntity(targetType) || isCrossProjectQuery)) {
                        const typeResult = await this.multiGraphManager.findNodes(targetType, {}, { limit: 50 });
                        if (typeResult.ok && typeResult.nodes?.length > 0) {
                            return { type: targetType, nodes: typeResult.nodes, crossProject: true };
                        }
                    } else {
                        const typeResult = await this.graphProvider.findNodes(targetType, {}, { limit: 50 });
                        if (typeResult.ok && typeResult.nodes?.length > 0) {
                            return { type: targetType, nodes: typeResult.nodes };
                        }
                    }
                } catch (error) {
                    log.warn({ event: 'graphrag_search_error', targetType, reason: error.message }, 'Error searching');
                }
                return null;
            });

            const searchResults = await Promise.all(searchPromises);

            // Process results and deduplicate
            const seen = new Set();
            for (const result of searchResults) {
                if (!result) continue;
                for (const node of result.nodes) {
                    const key = node.properties.name || node.properties.title || node.id;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    // For cross-project results, include project info
                    const nodeData = {
                        type: result.type.toLowerCase(),
                        content: this.formatGraphResult(node),
                        data: node.properties,
                        source: result.crossProject ? 'graph_cross_project' : 'graph_type_search'
                    };

                    // Add project context for shared entities
                    if (node.properties?.projects?.length > 0) {
                        nodeData.projects = node.properties.projects;
                    }

                    results.push(nodeData);
                }
            }
        }

        if (this.graphProvider && this.graphProvider.connected) {
            // Use graph database for structural queries
            for (const entity of entities) {
                // Find person nodes
                const personResult = await this.graphProvider.findNodes('Person', {}, { limit: 100 });

                if (personResult.ok) {
                    const matchingPerson = personResult.nodes.find(n =>
                        n.properties.name?.toLowerCase().includes(entity.toLowerCase())
                    );

                    if (matchingPerson) {
                        results.push({
                            type: 'person',
                            content: `${matchingPerson.properties.name} - ${matchingPerson.properties.role || 'Unknown role'}`,
                            data: matchingPerson.properties,
                            source: 'graph'
                        });

                        // Traverse relationships
                        const pathResult = await this.graphProvider.traversePath(
                            matchingPerson.id,
                            ['REPORTS_TO', 'MANAGES', 'LEADS', 'MEMBER_OF'],
                            2
                        );

                        if (pathResult.ok && pathResult.paths.length > 0) {
                            results.push({
                                type: 'relationship',
                                content: `Relationships found for ${matchingPerson.properties.name}`,
                                data: pathResult.paths,
                                source: 'graph'
                            });
                        }
                    }
                }
            }
        }

        // Fall back to storage if graph not available or no results
        if (results.length === 0 && this.storage) {
            const people = this.storage.getPeople();
            const relationships = this.storage.getRelationships();

            for (const entity of entities) {
                const matchingPeople = people.filter(p =>
                    p.name?.toLowerCase().includes(entity.toLowerCase())
                );

                for (const person of matchingPeople) {
                    results.push({
                        type: 'person',
                        content: `${person.name} - ${person.role || 'Unknown role'}`,
                        data: person,
                        source: 'storage'
                    });

                    const relatedRels = relationships.filter(r =>
                        r.from?.toLowerCase() === person.name?.toLowerCase() ||
                        r.to?.toLowerCase() === person.name?.toLowerCase()
                    );

                    for (const rel of relatedRels) {
                        results.push({
                            type: 'relationship',
                            content: `${rel.from} ${rel.type} ${rel.to}`,
                            data: rel,
                            source: 'storage'
                        });
                    }
                }
            }
        }

        return results;
    }

    /**
     * Semantic search using embeddings
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Promise<Array>}
     */
    async semanticSearch(query, queryAnalysis = {}) {
        const results = [];

        // Enrich query with ontology context for better matching
        let enrichedQuery = query;
        if (this.useOntology && this.embeddingEnricher) {
            enrichedQuery = this.embeddingEnricher.enrichQuery(query, queryAnalysis);
            log.debug({ event: 'graphrag_enriched_query' }, 'Enriched query for semantic search');
        }

        if (!this.storage) {
            return results;
        }

        // Check if storage supports Supabase vector search
        const embeddingsData = this.storage.loadEmbeddings();
        const isSupabaseMode = embeddingsData?.isSupabaseMode === true;

        if (isSupabaseMode && this.storage.searchWithEmbedding) {
            // ==================== SUPABASE VECTOR SEARCH ====================
            // Use Supabase match_embeddings RPC for vector search
            log.debug({ event: 'graphrag_supabase_vector' }, 'Using Supabase vector search');

            try {
                // Generate query embedding
                const embResult = await llm.embed({
                    provider: this.embeddingProvider,
                    model: this.embeddingModel,
                    texts: [enrichedQuery],
                    providerConfig: this.getProviderConfig(this.embeddingProvider)
                });

                if (embResult.success && embResult.embeddings?.[0]) {
                    const queryEmbedding = embResult.embeddings[0];

                    // Use Supabase hybrid search
                    const supabaseResults = await this.storage.searchWithEmbedding(
                        query,
                        queryEmbedding,
                        { limit: 15, threshold: 0.5, useHybrid: true }
                    );

                    for (const item of supabaseResults) {
                        results.push({
                            type: item.type,
                            content: item.text,
                            data: item.data,
                            similarity: item.score || item.similarity,
                            source: 'supabase_vector'
                        });
                    }

                    log.debug({ event: 'graphrag_vector_results', count: results.length }, 'Supabase vector search returned results');
                }
            } catch (e) {
                log.warn({ event: 'graphrag_vector_error', reason: e.message }, 'Supabase vector search error, falling back to keyword');
            }
        } else if (embeddingsData && embeddingsData.embeddings?.length > 0) {
            // ==================== LOCAL EMBEDDINGS (JSON) ====================
            // Generate query embedding with enriched query
            const embResult = await llm.embed({
                provider: this.embeddingProvider,
                model: this.embeddingModel,
                texts: [enrichedQuery],
                providerConfig: this.getProviderConfig(this.embeddingProvider)
            });

            if (embResult.success && embResult.embeddings?.[0]) {
                const queryEmbedding = embResult.embeddings[0];
                const { cosineSimilarity } = require('../utils/vectorSimilarity');

                const scored = embeddingsData.embeddings
                    .filter(item => item.embedding && item.embedding.length > 0)
                    .map(item => ({
                        ...item,
                        similarity: cosineSimilarity(queryEmbedding, item.embedding)
                    }))
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 10);

                for (const item of scored) {
                    results.push({
                        type: item.type,
                        content: item.text,
                        data: item.data,
                        similarity: item.similarity,
                        source: 'embeddings'
                    });
                }
            }
        }

        // Fall back to keyword search if embeddings not available or insufficient
        if (results.length < 5) {
            const searchResults = this.storage.search(query, { limit: 10 });

            for (const fact of searchResults.facts || []) {
                results.push({
                    type: 'fact',
                    content: fact.content,
                    data: fact,
                    source: 'keyword'
                });
            }

            for (const decision of searchResults.decisions || []) {
                results.push({
                    type: 'decision',
                    content: decision.content,
                    data: decision,
                    source: 'keyword'
                });
            }

            for (const question of searchResults.questions || []) {
                results.push({
                    type: 'question',
                    content: question.content,
                    data: question,
                    source: 'keyword'
                });
            }
        }

        return results;
    }

    /**
     * Hybrid search combining structural and semantic
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Promise<Array>}
     */
    async hybridSearch(query, queryAnalysis = {}) {
        // Run both searches in parallel
        const [structuralResults, semanticResults] = await Promise.all([
            this.structuralSearch(query, queryAnalysis),
            this.semanticSearch(query, queryAnalysis)
        ]);

        // Merge and deduplicate results
        const merged = [];
        const seen = new Set();

        // Prioritize structural results
        for (const result of structuralResults) {
            const key = `${result.type}:${result.content?.substring(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...result, searchType: 'structural' });
            }
        }

        // Add semantic results
        for (const result of semanticResults) {
            const key = `${result.type}:${result.content?.substring(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...result, searchType: 'semantic' });
            }
        }

        // Sort by relevance (similarity if available, otherwise structural first)
        merged.sort((a, b) => {
            if (a.similarity && b.similarity) {
                return b.similarity - a.similarity;
            }
            if (a.searchType === 'structural' && b.searchType !== 'structural') {
                return -1;
            }
            return 0;
        });

        return merged.slice(0, 15);
    }

    /**
     * Generate response using LLM
     * @param {string} query - Original query
     * @param {Array} results - Search results
     * @param {object} options - Options
     * @returns {Promise<{answer: string, sources: Array}>}
     */
    async generateResponse(query, results, options = {}) {
        if (results.length === 0) {
            return {
                answer: 'Não encontrei informação relevante na base de conhecimento para responder a esta pergunta.',
                sources: []
            };
        }

        // Group results by type for better context organization
        const groupedResults = {};
        for (const r of results) {
            const type = r.type || 'other';
            if (!groupedResults[type]) groupedResults[type] = [];
            groupedResults[type].push(r);
        }

        // Build structured context
        const contextParts = [];
        let sourceIndex = 1;
        const sourceMap = new Map();

        for (const [type, items] of Object.entries(groupedResults)) {
            const typeLabel = this.getTypeLabel(type);
            contextParts.push(`\n### ${typeLabel}:`);

            for (const item of items) {
                const tag = `[${sourceIndex}]`;
                sourceMap.set(sourceIndex, item);

                // Format content based on type
                let content = item.content;
                if (item.data) {
                    if (type === 'person' && item.data.organization) {
                        content = `${item.data.name} - ${item.data.role || 'sem cargo'} (${item.data.organization})`;
                    }
                }

                contextParts.push(`${tag} ${content}`);
                sourceIndex++;
            }
        }

        const context = contextParts.join('\n');

        // Detect query language
        const isPortuguese = /[áàâãéèêíïóôõöúçñ]|quem|qual|como|onde|quando|porque/i.test(query);

        // Generate response using LLM with improved prompt
        const systemPrompt = isPortuguese
            ? `Você é um assistente inteligente que responde a perguntas baseado em informação de uma base de conhecimento.

REGRAS:
1. Use APENAS a informação fornecida no contexto
2. Cite SEMPRE as fontes usando números entre colchetes [1], [2], etc.
3. Se a informação for parcial, indique o que sabe e o que falta
4. Responda de forma clara, estruturada e completa
5. Para listas de pessoas/itens, formate de forma legível
6. Se não houver dados suficientes, diga claramente

FORMATO:
- Para perguntas sobre pessoas: liste nomes, cargos e organizações
- Para perguntas sobre projetos: descreva status, participantes e tecnologias
- Para perguntas sobre decisões: explique a decisão e o contexto`
            : `You are an intelligent assistant that answers questions based on information from a knowledge base.

RULES:
1. Use ONLY the information provided in the context
2. ALWAYS cite sources using numbers in brackets [1], [2], etc.
3. If information is partial, indicate what you know and what's missing
4. Answer clearly, structured and completely
5. For lists of people/items, format readably
6. If there's not enough data, say so clearly`;

        const userPrompt = `${isPortuguese ? 'Contexto' : 'Context'}:
${context}

${isPortuguese ? 'Pergunta' : 'Question'}: ${query}

${isPortuguese ? 'Responda de forma completa e estruturada:' : 'Answer completely and structured:'}`;

        const llmResult = await llm.generateText({
            provider: this.llmProvider,
            model: this.llmModel,
            prompt: userPrompt,
            system: systemPrompt,
            temperature: 0.2, // Lower temperature for more consistent responses
            maxTokens: 1500, // More tokens for complete answers
            providerConfig: this.getProviderConfig(this.llmProvider)
        });

        if (!llmResult.success) {
            log.warn({ event: 'graphrag_llm_error', reason: llmResult.error }, 'LLM error');
            return {
                answer: `Erro ao gerar resposta: ${llmResult.error}`,
                sources: []
            };
        }

        // Build sources list
        const sources = results.map((r, i) => ({
            index: i + 1,
            type: r.type,
            content: r.content?.substring(0, 150),
            source: r.source,
            data: r.data
        }));

        return {
            answer: llmResult.text,
            sources
        };
    }

    /**
     * Get human-readable label for entity type
     * @param {string} type 
     * @returns {string}
     */
    getTypeLabel(type) {
        const labels = {
            'person': 'Pessoas',
            'project': 'Projetos',
            'meeting': 'Reuniões',
            'decision': 'Decisões',
            'task': 'Tarefas',
            'risk': 'Riscos',
            'fact': 'Factos',
            'technology': 'Tecnologias',
            'client': 'Clientes',
            'document': 'Documentos'
        };
        return labels[type.toLowerCase()] || type;
    }

    /**
     * Extract entity names from query
     * Enhanced with ontology-based extraction
     * @param {string} query - User query
     * @param {object} queryAnalysis - Analysis from classifyQuery
     * @returns {Array<string>}
     */
    extractEntities(query, queryAnalysis = {}) {
        const entities = [];

        // Use ontology-based extraction if available
        if (this.useOntology && this.relationInference) {
            try {
                const extracted = this.relationInference.extractWithHeuristics(query, {
                    existingEntities: this.getKnownEntities()
                });

                for (const entity of extracted.entities) {
                    const name = entity.name || entity.title || entity.code;
                    if (name && name.length > 2) {
                        entities.push(name);
                    }
                }
            } catch (error) {
                log.warn({ event: 'graphrag_ontology_extraction_failed', reason: error.message }, 'Ontology extraction failed');
            }
        }

        // Fallback: Simple regex patterns for names
        const patterns = [
            /(?:do|da|de|pelo|pela|the|of)\s+([A-Z][a-záàâãéèêíïóôõöúçñ]+(?:\s+[A-Z][a-záàâãéèêíïóôõöúçñ]+)*)/g,
            /([A-Z][a-záàâãéèêíïóôõöúçñ]+(?:\s+[A-Z][a-záàâãéèêíïóôõöúçñ]+)+)/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                if (match[1] && match[1].length > 2) {
                    entities.push(match[1]);
                }
            }
        }

        // Remove duplicates
        return [...new Set(entities)];
    }

    /**
     * Get known entities from storage for matching
     * @returns {Array}
     */
    getKnownEntities() {
        if (!this.storage) return [];

        const entities = [];

        // Add people
        for (const person of this.storage.knowledge?.people || []) {
            entities.push({ _type: 'Person', ...person });
        }

        // Add projects if available
        for (const project of this.storage.knowledge?.projects || []) {
            entities.push({ _type: 'Project', ...project });
        }

        // Add technologies if available
        for (const tech of this.storage.knowledge?.technologies || []) {
            entities.push({ _type: 'Technology', ...tech });
        }

        return entities;
    }

    /**
     * Get provider config from llmConfig
     * @param {string} providerId - Provider ID
     * @returns {object}
     */
    getProviderConfig(providerId) {
        return this.llmConfig?.providers?.[providerId] || {};
    }



    /**
     * Map storage relationship types to ontology types
     * @param {string} type - Original relationship type
     * @returns {string}
     */
    mapRelationType(type) {
        const mapping = {
            'reports_to': 'REPORTS_TO',
            'reports to': 'REPORTS_TO',
            'manages': 'REPORTS_TO', // Reverse
            'works_with': 'KNOWS',
            'works with': 'KNOWS',
            'knows': 'KNOWS',
            'collaborates': 'KNOWS',
            'works_on': 'WORKS_ON',
            'works on': 'WORKS_ON',
            'member_of': 'WORKS_ON',
            'member of': 'WORKS_ON'
        };

        return mapping[type?.toLowerCase()] || 'RELATED_TO';
    }

    /**
     * Generate enriched embeddings for all entities using ontology
     * @returns {Promise<{ok: boolean, count: number, errors: Array}>}
     */
    async generateEnrichedEmbeddings() {
        if (!this.storage || !this.useOntology) {
            return { ok: false, count: 0, errors: ['Storage or ontology not available'] };
        }

        const embeddings = [];
        const errors = [];

        log.debug({ event: 'graphrag_embeddings_start' }, 'Generating enriched embeddings with ontology');

        // Generate embeddings for each entity type
        const entities = this.getKnownEntities();

        for (const entity of entities) {
            try {
                const enrichedText = this.embeddingEnricher.enrichEntity(entity._type, entity, {});

                const embResult = await llm.embed({
                    provider: this.embeddingProvider,
                    model: this.embeddingModel,
                    texts: [enrichedText],
                    providerConfig: this.getProviderConfig(this.embeddingProvider)
                });

                if (embResult.success && embResult.embeddings?.[0]) {
                    embeddings.push({
                        id: entity.id,
                        type: entity._type,
                        text: enrichedText,
                        embedding: embResult.embeddings[0],
                        data: entity
                    });
                }
            } catch (error) {
                errors.push({ id: entity.id, type: entity._type, error: error.message });
            }
        }

        // Save enriched embeddings
        if (embeddings.length > 0) {
            const existingEmbeddings = this.storage.loadEmbeddings() || { embeddings: [] };

            // Merge with existing, preferring new enriched ones
            const merged = [...embeddings];
            for (const existing of existingEmbeddings.embeddings) {
                const isReplaced = merged.some(e => e.id === existing.id);
                if (!isReplaced) {
                    merged.push(existing);
                }
            }

            this.storage.saveEmbeddings({
                embeddings: merged,
                model: this.embeddingModel,
                generated_at: new Date().toISOString(),
                ontology_enriched: true
            });
        }

        log.debug({ event: 'graphrag_embeddings_complete', count: embeddings.length, errors: errors.length }, 'Generated enriched embeddings');

        return { ok: errors.length === 0, count: embeddings.length, errors };
    }

    // ==================== Cross-Project Query Methods ====================

    /**
     * Query across all projects (requires MultiGraphManager)
     * @param {string} userQuery - User's query
     * @param {object} options - Query options
     * @returns {Promise<object>}
     */
    async queryCrossProject(userQuery, options = {}) {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        const startTime = Date.now();
        const results = {
            shared: [],
            projects: {},
            aggregated: []
        };

        try {
            // Search shared entities (People, Technologies, Clients, Organizations)
            const sharedTypes = this.ontology.getSharedEntityTypes();

            for (const entityType of sharedTypes) {
                const searchResult = await this.multiGraphManager.findNodes(entityType, {}, { limit: 50 });
                if (searchResult.ok && searchResult.nodes?.length > 0) {
                    results.shared.push({
                        type: entityType,
                        nodes: searchResult.nodes.map(n => ({
                            ...n.properties,
                            projects: n.properties?.projects || []
                        }))
                    });
                }
            }

            // Aggregate results
            for (const typeResult of results.shared) {
                for (const node of typeResult.nodes) {
                    results.aggregated.push({
                        type: typeResult.type.toLowerCase(),
                        content: this.formatGraphResult({ properties: node }),
                        data: node,
                        projects: node.projects || [],
                        source: 'cross_project'
                    });
                }
            }

            // Generate response using LLM
            const answer = await this.generateResponse(userQuery, results.aggregated, {
                crossProject: true,
                ...options
            });

            return {
                ok: true,
                answer,
                sources: results.aggregated,
                queryType: 'cross_project',
                latencyMs: Date.now() - startTime
            };
        } catch (error) {
            log.warn({ event: 'graphrag_cross_project_error', reason: error?.message }, 'Cross-project query error');
            return { ok: false, error: error.message };
        }
    }

    /**
     * Find all projects a person participates in
     * @param {string} personName - Person's name
     * @returns {Promise<object>}
     */
    async findPersonProjects(personName) {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        // Search for person in shared graph
        const searchResult = await this.multiGraphManager.findNodes('Person', {}, { limit: 100 });
        if (!searchResult.ok) {
            return { ok: false, error: searchResult.error };
        }

        // Find matching person
        const person = searchResult.nodes?.find(n =>
            n.properties?.name?.toLowerCase().includes(personName.toLowerCase())
        );

        if (!person) {
            return { ok: false, error: 'Person not found', personName };
        }

        return {
            ok: true,
            person: person.properties,
            projects: person.properties?.projects || [],
            projectCount: person.properties?.projects?.length || 0
        };
    }

    /**
     * Find people who work across multiple projects
     * @returns {Promise<object>}
     */
    async findCrossProjectPeople() {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        return this.multiGraphManager.findCrossProjectPeople();
    }

    /**
     * Find connections between projects through shared entities
     * @returns {Promise<object>}
     */
    async findProjectConnections() {
        if (!this.multiGraphManager) {
            return { ok: false, error: 'Multi-graph manager not configured' };
        }

        return this.multiGraphManager.findProjectConnections();
    }
}

module.exports = GraphRAGEngine;
