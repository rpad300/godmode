/**
 * Purpose:
 *   Central orchestrator for Retrieval-Augmented Generation (RAG) that combines
 *   graph traversal, semantic vector search, and LLM-powered answer generation.
 *   Acts as the primary entry point for knowledge-base queries and data synchronisation.
 *
 * Responsibilities:
 *   - Sync heterogeneous project data (people, tasks, documents, sprints, etc.) into a
 *     graph database via a three-phase pipeline: nodes -> relationships -> entity links
 *   - Route incoming queries through an AI Cypher generator, ontology pattern matching,
 *     or fallback hybrid (structural + semantic) search strategies
 *   - Generate grounded, source-cited answers using an LLM and the retrieved context
 *   - Support cross-project queries via MultiGraphManager
 *   - Cache query results with a configurable TTL for latency reduction
 *
 * Key dependencies:
 *   - ../llm: unified LLM/embedding abstraction (provider-agnostic)
 *   - ../ontology: OntologyManager, RelationInference, EmbeddingEnricher
 *   - ../utils: QueryCache, SyncTracker
 *   - ./CypherGenerator: AI-powered natural-language-to-Cypher translation
 *   - crypto: deterministic ID generation (MD5)
 *
 * Side effects:
 *   - Writes nodes and relationships to the configured graph provider
 *   - Updates sync status records (sync_status, health_status) in the graph provider
 *   - Calls external LLM/embedding APIs for query answering and vector search
 *
 * Notes:
 *   - LLM/embedding provider and model are intentionally NOT hard-coded; they must be
 *     supplied via options (sourced from admin config) at construction time.
 *   - Deterministic node IDs are scoped by projectId to prevent cross-project collisions
 *     while still allowing explicit UUIDs from the source system.
 *   - The AUTHORED_BY edge creation was moved to Phase 2 to fix a sequencing bug
 *     where it previously tried to push to the `relationships` array before declaration.
 *   - Query classification supports both English and Portuguese patterns.
 */

const { logger } = require('../logger');
const llmRouter = require('../llm/router');
const { getOntologyManager, getRelationInference, getEmbeddingEnricher } = require('../ontology');
const { getQueryCache, getSyncTracker } = require('../utils');
const { getCypherGenerator } = require('./CypherGenerator');
const { getReranker } = require('./Reranker');
const { getCommunityDetection } = require('./CommunityDetection');
const { getMultiHopReasoning } = require('./MultiHopReasoning');
const { HyDE } = require('./HyDE');
const crypto = require('crypto');

const log = logger.child({ module: 'graphrag-engine' });

/**
 * GraphRAGEngine
 *
 * Lifecycle:
 *   1. Construct with a graphProvider, storage backend, and LLM config.
 *   2. Optionally attach a MultiGraphManager for cross-project support.
 *   3. Call syncToGraph(data) to ingest project data into the graph.
 *   4. Call query(userQuery) to perform RAG: classify -> search -> generate.
 *
 * Key invariants:
 *   - graphProvider may be null (graceful degradation to storage-based search).
 *   - All LLM calls go through the shared `llm` module; provider/model come from options.
 *   - Query cache is keyed on the raw query string and has a 5-minute default TTL.
 */
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
        this._resolvedConfig = options.config || { llm: this.llmConfig };

        // Ontology integration
        this.ontology = options.ontology || getOntologyManager();
        this.relationInference = options.relationInference || getRelationInference();
        this.embeddingEnricher = options.embeddingEnricher || getEmbeddingEnricher();

        // Enable ontology features
        this.useOntology = options.useOntology !== false;

        // HyDE (Hypothetical Document Embeddings) for improved semantic search
        this.useHyDE = options.useHyDE !== false;
        this.hyde = new HyDE({
            config: this._resolvedConfig,
            llmProvider: this.llmProvider,
            llmModel: this.llmModel,
            llmConfig: this.llmConfig,
            embeddingProvider: this.embeddingProvider,
            embeddingModel: this.embeddingModel
        });

        // Reranker for result quality improvement
        this.useReranker = options.useReranker !== false;
        this.reranker = getReranker({
            config: this._resolvedConfig,
            llmProvider: this.llmProvider,
            llmModel: this.llmModel,
            llmConfig: this.llmConfig
        });

        // Community detection for result expansion
        this.useCommunityExpansion = options.useCommunityExpansion !== false;
        this.communityDetection = null; // Lazy-init (needs graphProvider)

        // Multi-hop reasoning for complex queries
        this.useMultiHop = options.useMultiHop !== false;
        this.multiHop = null; // Lazy-init

        // Cache for query results
        this.queryCache = options.queryCache || getQueryCache();
        this.enableCache = options.enableCache !== false;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Lazy-init community detection (needs connected graphProvider)
     */
    _getCommunityDetection() {
        if (!this.communityDetection && this.graphProvider?.connected) {
            this.communityDetection = getCommunityDetection({
                graphProvider: this.graphProvider
            });
        }
        return this.communityDetection;
    }

    /**
     * Lazy-init multi-hop reasoning (needs LLM config)
     */
    _getMultiHop() {
        if (!this.multiHop && this.llmProvider) {
            this.multiHop = getMultiHopReasoning({
                llmProvider: this.llmProvider,
                llmModel: this.llmModel,
                llmConfig: this.llmConfig,
                config: this._resolvedConfig,
                graphProvider: this.graphProvider
            });
        }
        return this.multiHop;
    }

    /**
     * Heuristic to detect complex multi-hop queries that benefit from
     * decomposition. Avoids the cost of an LLM classification call for
     * simple questions.
     */
    _isComplexQuery(query) {
        if ((query.match(/\?/g) || []).length > 1) return true;
        const words = query.split(/\s+/).length;
        if (words > 25 && /\b(e|and|também|also|além|besides|depois|then|comparar|compare)\b/i.test(query)) return true;
        if (/\b(relação entre|relationship between|diferença|difference|comparar|compare|correlação|correlation)\b/i.test(query)) return true;
        if (/\b(quais.*todos|which.*all|list all.*and|enumera|listar)\b/i.test(query) && words > 15) return true;
        return false;
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

            // Resolve a text name to a contact ID via fuzzy match
            const allContacts = [...(data.contacts || []), ...(data.people || [])];
            const resolveNameToContactId = (name) => {
                if (!name || name.length < 2) return null;
                const lower = name.trim().toLowerCase();
                for (const c of allContacts) {
                    const cName = (c.name || c.full_name || '').trim().toLowerCase();
                    if (cName && (cName === lower || cName.includes(lower) || lower.includes(cName))) {
                        return c.id;
                    }
                }
                return null;
            };

            // ==================== PHASE 1: NODES ====================

            // 1. Project Node
            if (data.project) {
                await syncNodes('Project', [data.project], p => ({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    description: p.description,
                    company_id: p.company_id,
                    ...p.metadata
                }), 'id');
            }

            // 1b. Company Node (from project.company join)
            if (data.project?.company) {
                const c = data.project.company;
                await syncNodes('Company', [c], co => ({
                    id: co.id,
                    name: co.name,
                    domain: co.domain,
                    industry: co.industry,
                    description: co.description,
                    ...co.metadata
                }), 'name');
            }

            // 2. Sprint Nodes
            await syncNodes('Sprint', data.sprints, s => ({
                id: s.id,
                name: s.name,
                status: s.status,
                goal: s.goal,
                start_date: s.start_date,
                end_date: s.end_date,
                ...s.metadata
            }), 'name');

            // 3. UserStory Nodes
            await syncNodes('UserStory', data.userStories, s => ({
                id: s.id,
                title: s.title,
                status: s.status,
                story_points: s.story_points,
                description: s.description,
                ...s.metadata
            }), 'title');

            // 4. Task Nodes (mapped from action_items)
            await syncNodes('Task', data.actions, a => ({
                id: a.id,
                title: a.task || a.title,
                status: a.status,
                priority: a.priority,
                description: a.description,
                deadline: a.deadline,
                sprint_id: a.sprint_id,
                parent_story_id: a.parent_story_id,
                requested_by_contact_id: a.requested_by_contact_id,
                source_document_id: a.source_document_id,
                source_email_id: a.source_email_id,
                decision_id: a.decision_id,
                owner: a.owner,
                ...a.metadata
            }), 'title');

            // 5. Document Nodes
            await syncNodes('Document', data.documents, d => ({
                id: d.id,
                title: d.title,
                type: d.type,
                url: d.url,
                last_modified: d.last_modified || d.updated_at,
                sprint_id: d.sprint_id,
                uploaded_by: d.uploaded_by,
                ...d.metadata
            }), 'url');

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
                source_label: p.label || 'Person',
                ...p.metadata
            }), 'email');

            // 7b. Contacts (separate from People -- preserves Contact label in graph)
            if (data.contacts) {
                await syncNodes('Contact', data.contacts, c => ({
                    id: c.id,
                    name: c.name || c.full_name,
                    email: c.email,
                    phone: c.phone,
                    company: c.company || c.organization,
                    role: c.role || c.job_title,
                    linked_person_id: c.linked_person_id,
                    avatar: c.avatar_url || c.avatar,
                    ...c.metadata
                }), 'email');
            }

            // 8. Facts
            await syncNodes('Fact', data.facts, f => ({
                id: f.id,
                content: f.content,
                source: f.source,
                category: f.category,
                source_document_id: f.source_document_id,
                ...f.metadata
            }), 'content');

            // 9. Decisions
            await syncNodes('Decision', data.decisions, d => ({
                id: d.id,
                title: d.title,
                status: d.status,
                impact: d.impact,
                rationale: d.rationale,
                made_by: d.made_by,
                source_document_id: d.source_document_id,
                ...d.metadata
            }), 'title');

            // 10. Risks
            await syncNodes('Risk', data.risks, r => ({
                id: r.id,
                title: r.title || r.content,
                status: r.status,
                severity: r.severity || r.impact,
                probability: r.probability,
                mitigation: r.mitigation,
                source_document_id: r.source_document_id,
                ...r.metadata
            }), 'title');

            // 11. Emails
            await syncNodes('Email', data.emails, e => ({
                id: e.id,
                subject: e.subject,
                from_name: e.from_name,
                from_email: e.from_email,
                date_sent: e.date_sent,
                sender_contact_id: e.sender_contact_id,
                thread_id: e.thread_id,
                in_reply_to: e.in_reply_to,
                sprint_id: e.sprint_id,
                ...e.metadata
            }), 'id');

            // 12. CalendarEvents
            await syncNodes('CalendarEvent', data.events, e => ({
                id: e.id,
                title: e.title,
                start_at: e.start_at || e.start,
                end_at: e.end_at || e.end,
                location: e.location,
                type: e.type,
                linked_document_id: e.linked_document_id,
                linked_action_id: e.linked_action_id,
                linked_contact_ids: e.linked_contact_ids,
                ...e.metadata
            }), 'id');

            // 13. Questions
            await syncNodes('Question', data.questions, q => ({
                id: q.id,
                content: q.content || q.text,
                status: q.status,
                answer: q.answer,
                source_document_id: q.source_document_id,
                requester_contact_id: q.requester_contact_id,
                answered_by_contact_id: q.answered_by_contact_id,
                ...q.metadata
            }), 'content');


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
                linkToProject(data.people);
                linkToProject(data.risks);
                linkToProject(data.decisions);
                linkToProject(data.facts);
                linkToProject(data.questions);
                linkToProject(data.emails);
                linkToProject(data.events);
                linkToProject(data.contacts);

                // BELONGS_TO_COMPANY (Project -> Company)
                if (data.project.company_id && data.project.company) {
                    const rel = createRel(data.project.id, data.project.company.id, 'BELONGS_TO_COMPANY');
                    if (rel) relationships.push(rel);
                }
            }

            // Contact -> Person linkage (IS_CONTACT_OF)
            if (data.contacts) {
                const personIdSet = new Set((data.people || []).map(p => p.id));
                for (const contact of data.contacts) {
                    if (contact.linked_person_id && personIdSet.has(contact.linked_person_id)) {
                        const rel = createRel(contact.id, contact.linked_person_id, 'IS_CONTACT_OF');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // Contact -> Company (WORKS_AT) via text name matching
            if (data.contacts && data.project?.company) {
                const companyNode = data.project.company;
                const companyNames = [companyNode.name, companyNode.domain].filter(Boolean).map(n => n.toLowerCase());
                for (const contact of data.contacts) {
                    const cCompany = (contact.company || contact.organization || '').toLowerCase().trim();
                    if (cCompany && companyNames.some(cn => cn.includes(cCompany) || cCompany.includes(cn))) {
                        const rel = createRel(contact.id, companyNode.id, 'WORKS_AT');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // Document -> Sprint (if linked), Document -> Contact (author)
            if (data.documents) {
                for (const doc of data.documents) {
                    if (doc.sprint_id) {
                        const rel = createRel(doc.id, doc.sprint_id, 'PLANNED_IN');
                        if (rel) relationships.push(rel);
                    }
                    // uploaded_by_contact_id links to contacts; uploaded_by links to auth.users (skip)
                    if (doc.uploaded_by_contact_id) {
                        const rel = createRel(doc.id, doc.uploaded_by_contact_id, 'AUTHORED_BY');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // 16: MEMBER_OF_TEAM (Contact -> Team)
            if (data.teams) {
                for (const team of data.teams) {
                    // getTeams() returns members as: team_members(contact:contacts(id,name,...))
                    if (team.members && Array.isArray(team.members)) {
                        for (const member of team.members) {
                            const contactId = member?.contact?.id || member?.contact_id || (typeof member === 'string' ? member : null);
                            if (contactId) {
                                const rel = createRel(contactId, team.id, 'MEMBER_OF_TEAM');
                                if (rel) relationships.push(rel);
                            }
                        }
                    }
                    if (team.lead_id || team.leadId) {
                        const rel = createRel(team.lead_id || team.leadId, team.id, 'LEADS_TEAM');
                        if (rel) relationships.push(rel);
                    }
                    if (team.parent_team_id) {
                        const rel = createRel(team.id, team.parent_team_id, 'PARENT_OF');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // 17-20: Work Layer
            // Task relationships (action_items table uses snake_case)
            if (data.actions) {
                for (const task of data.actions) {
                    // PLANNED_IN (Task -> Sprint)
                    if (task.sprint_id) {
                        const rel = createRel(task.id, task.sprint_id, 'PLANNED_IN');
                        if (rel) relationships.push(rel);
                    }
                    // IMPLEMENTS (Task -> UserStory)
                    if (task.parent_story_id) {
                        const rel = createRel(task.id, task.parent_story_id, 'IMPLEMENTS');
                        if (rel) relationships.push(rel);
                    }
                    // EXTRACTED_FROM (Task -> Document)
                    if (task.source_document_id) {
                        const rel = createRel(task.id, task.source_document_id, 'EXTRACTED_FROM');
                        if (rel) relationships.push(rel);
                    }
                    // DERIVED_FROM (Task -> Email)
                    if (task.source_email_id) {
                        const rel = createRel(task.id, task.source_email_id, 'DERIVED_FROM');
                        if (rel) relationships.push(rel);
                    }
                    // REQUESTED_BY (Task -> Contact)
                    if (task.requested_by_contact_id) {
                        const rel = createRel(task.id, task.requested_by_contact_id, 'MENTIONS', { type: 'requested_by' });
                        if (rel) relationships.push(rel);
                    }
                    // LINKED_TO (Task -> Decision)
                    if (task.decision_id) {
                        const rel = createRel(task.id, task.decision_id, 'LINKED_TO');
                        if (rel) relationships.push(rel);
                    }
                    // DEPENDS_ON (Task -> Task) from task_dependencies join
                    if (task.depends_on && Array.isArray(task.depends_on)) {
                        for (const dep of task.depends_on) {
                            const depId = dep?.depends_on_id || (typeof dep === 'string' ? dep : null);
                            if (depId) {
                                const rel = createRel(task.id, depId, 'DEPENDS_ON');
                                if (rel) relationships.push(rel);
                            }
                        }
                    }
                    // ASSIGNED_TO (Task -> Contact) via FK or text name resolution
                    const taskOwnerId = task.owner_contact_id || resolveNameToContactId(task.owner);
                    if (taskOwnerId) {
                        const rel = createRel(task.id, taskOwnerId, 'ASSIGNED_TO');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // UserStory relationships
            if (data.userStories) {
                for (const story of data.userStories) {
                    if (story.source_document_id) {
                        const rel = createRel(story.id, story.source_document_id, 'EXTRACTED_FROM');
                        if (rel) relationships.push(rel);
                    }
                    if (story.source_email_id) {
                        const rel = createRel(story.id, story.source_email_id, 'DERIVED_FROM');
                        if (rel) relationships.push(rel);
                    }
                    if (story.requested_by_contact_id) {
                        const rel = createRel(story.id, story.requested_by_contact_id, 'MENTIONS', { type: 'requested_by' });
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // 21-23: Knowledge Layer
            // EXTRACTED_FROM (Fact/Decision/Risk/Question -> Document)
            const linkExtraction = (items) => {
                if (!items) return;
                for (const item of items) {
                    if (item.source_document_id) {
                        const rel = createRel(item.id, item.source_document_id, 'EXTRACTED_FROM');
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

                scanAndLink(data.actions, ['task', 'description'], 'owner', 'owner_contact_id');
                scanAndLink(data.decisions, ['title', 'rationale'], 'made_by', 'made_by_contact_id');
                scanAndLink(data.risks, ['title', 'content', 'mitigation'], 'owner', 'owner_contact_id');
                scanAndLink(data.questions, ['content', 'answer'], 'owner', 'assigned_to_contact_id');
                scanAndLink(data.facts, ['content'], 'source');
            }

            // 24-27: Communication Layer
            if (data.emails) {
                for (const email of data.emails) {
                    // SENT_BY (Email -> Contact) -- sender_contact_id is the FK
                    if (email.sender_contact_id) {
                        const rel = createRel(email.id, email.sender_contact_id, 'SENT_BY');
                        if (rel) relationships.push(rel);
                    }
                    // Email -> Sprint
                    if (email.sprint_id) {
                        const rel = createRel(email.id, email.sprint_id, 'PLANNED_IN');
                        if (rel) relationships.push(rel);
                    }
                    // Email threading: REPLY_TO
                    if (email.in_reply_to) {
                        const rel = createRel(email.id, email.in_reply_to, 'REPLY_TO');
                        if (rel) relationships.push(rel);
                    }
                    // Email recipients (SENT_TO) -- fetched from email_recipients join
                    if (email.recipients && Array.isArray(email.recipients)) {
                        for (const recipient of email.recipients) {
                            const contactId = recipient?.contact_id || (typeof recipient === 'string' ? recipient : null);
                            if (contactId) {
                                const rel = createRel(email.id, contactId, 'SENT_TO', { type: recipient?.recipient_type });
                                if (rel) relationships.push(rel);
                            }
                        }
                    }
                    // Email attachments (HAS_ATTACHMENT) -- fetched from email_attachments join
                    if (email.attachments && Array.isArray(email.attachments)) {
                        for (const attachment of email.attachments) {
                            const docId = attachment?.document_id || (typeof attachment === 'string' ? attachment : null);
                            if (docId) {
                                const rel = createRel(email.id, docId, 'HAS_ATTACHMENT');
                                if (rel) relationships.push(rel);
                            }
                        }
                    }
                }
            }

            // CalendarEvent relationships
            if (data.events) {
                for (const event of data.events) {
                    // LINKED_TO (CalendarEvent -> Document)
                    if (event.linked_document_id) {
                        const rel = createRel(event.id, event.linked_document_id, 'LINKED_TO');
                        if (rel) relationships.push(rel);
                    }
                    // LINKED_TO (CalendarEvent -> Action)
                    if (event.linked_action_id) {
                        const rel = createRel(event.id, event.linked_action_id, 'LINKED_TO');
                        if (rel) relationships.push(rel);
                    }

                    // INVOLVES (CalendarEvent -> Contact) -- linked_contact_ids is UUID[]
                    if (event.linked_contact_ids && Array.isArray(event.linked_contact_ids)) {
                        for (const contactId of event.linked_contact_ids) {
                            if (contactId) {
                                const rel = createRel(event.id, contactId, 'INVOLVES');
                                if (rel) relationships.push(rel);
                            }
                        }
                    }
                }
            }

            // Decision ownership edges (FK or text name resolution)
            if (data.decisions) {
                for (const dec of data.decisions) {
                    const decOwnerId = dec.owner_contact_id || resolveNameToContactId(dec.made_by);
                    if (decOwnerId) {
                        const rel = createRel(dec.id, decOwnerId, 'OWNED_BY');
                        if (rel) relationships.push(rel);
                    }
                    if (dec.made_by_contact_id && dec.made_by_contact_id !== decOwnerId) {
                        const rel = createRel(dec.id, dec.made_by_contact_id, 'AUTHORED_BY');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // Risk ownership edges (FK or text name resolution)
            if (data.risks) {
                for (const risk of data.risks) {
                    const riskOwnerId = risk.owner_contact_id || resolveNameToContactId(risk.owner);
                    if (riskOwnerId) {
                        const rel = createRel(risk.id, riskOwnerId, 'OWNED_BY');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // Question attribution and assignment edges
            if (data.questions) {
                for (const q of data.questions) {
                    if (q.requester_contact_id) {
                        const rel = createRel(q.id, q.requester_contact_id, 'MENTIONS', { type: 'requester' });
                        if (rel) relationships.push(rel);
                    }
                    if (q.answered_by_contact_id) {
                        const rel = createRel(q.id, q.answered_by_contact_id, 'MENTIONS', { type: 'answered_by' });
                        if (rel) relationships.push(rel);
                    }
                    if (q.assigned_to_contact_id) {
                        const rel = createRel(q.id, q.assigned_to_contact_id, 'ASSIGNED_TO');
                        if (rel) relationships.push(rel);
                    }
                }
            }

            // Contact ↔ Contact explicit relationships from contact_relationships table
            if (data.contactRelationships && Array.isArray(data.contactRelationships)) {
                for (const cr of data.contactRelationships) {
                    if (cr.from_contact_id && cr.to_contact_id && cr.relationship_type) {
                        const relType = cr.relationship_type.toUpperCase().replace(/\s+/g, '_');
                        const rel = createRel(cr.from_contact_id, cr.to_contact_id, relType, {
                            strength: cr.strength,
                            notes: cr.notes
                        });
                        if (rel) relationships.push(rel);
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
                const seenLinkKeys = new Set();
                let skippedLinks = 0;

                for (const link of data.entityLinks) {
                    if (!link.link_type || !link.from_entity_id || !link.to_entity_id) {
                        skippedLinks++;
                        continue;
                    }

                    const edgeType = link.link_type.toUpperCase();

                    // Deduplicate by from+to+type
                    const linkKey = `${link.from_entity_id}:${link.to_entity_id}:${edgeType}`;
                    if (seenLinkKeys.has(linkKey)) continue;
                    seenLinkKeys.add(linkKey);

                    const rel = createRel(link.from_entity_id, link.to_entity_id, edgeType, {
                        source: link.source,
                        confidence: link.confidence,
                        ...(link.metadata && typeof link.metadata === 'object' ? link.metadata : {})
                    });

                    if (rel) {
                        entityLinks.push(rel);
                    }
                }

                if (skippedLinks > 0) {
                    log.warn({ event: 'graphrag_entity_links_skipped', count: skippedLinks }, 'Skipped invalid entity links (missing type or IDs)');
                }

                if (entityLinks.length > 0) {
                    const linkResult = await this.graphProvider.createRelationshipsBatch(entityLinks);
                    if (linkResult.ok) {
                        results.edges += linkResult.created;
                        log.info({ event: 'graphrag_sync_entity_links', count: linkResult.created }, 'Synced entity links');
                    } else {
                        results.errors.push(...(linkResult.errors || []));
                        log.warn({ event: 'graphrag_entity_links_error', errors: linkResult.errors }, 'Failed to sync entity links');
                    }
                }
            }

            // 28: SIMILAR_TO (Semantic) - auto-trigger unless explicitly disabled
            if (options.computeSimilarity !== false) {
                try {
                    const simResult = await this.computeSimilarityEdges();
                    results.edges += simResult.created;
                    log.info({ event: 'graphrag_similarity_edges', created: simResult.created }, 'Computed similarity edges');
                } catch (simError) {
                    log.warn({ event: 'graphrag_similarity_error', reason: simError.message }, 'Similarity computation failed (non-blocking)');
                }
            }

            // Reconcile Stale Entries (Full Resync Only)
            if (options.clear && this.graphProvider.pruneStale) {
                // Full clear was called at start, so everything is fresh.
            } else if (!options.clear && this.graphProvider.pruneStale) {
                // Incremental sync reconciliation - not yet implemented.
            }

            // Embedding generation for semantic search
            if (options.generateEmbeddings !== false) {
                try {
                    const embResult = await this._generateSyncEmbeddings(data);
                    log.info({ event: 'graphrag_sync_embeddings', count: embResult.count, errors: embResult.errors }, 'Generated embeddings for graph entities');
                } catch (embError) {
                    log.warn({ event: 'graphrag_sync_embeddings_error', reason: embError.message }, 'Embedding generation failed (non-blocking)');
                }
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

        const mappings = [
            { label: 'Fact', table: 'fact_similarities', fromCol: 'fact_id', toCol: 'similar_fact_id', hasProjectId: false },
            { label: 'Decision', table: 'decision_similarities', fromCol: 'decision_id', toCol: 'similar_decision_id', hasProjectId: false },
            { label: 'Question', table: 'question_similarities', fromCol: 'question_id', toCol: 'similar_question_id', hasProjectId: false },
            { label: 'Risk', table: 'risk_similarities', fromCol: 'risk_id', toCol: 'similar_risk_id', hasProjectId: true }
        ];

        for (const map of mappings) {
            try {
                let query = this.graphProvider.supabase
                    .from(map.table)
                    .select('*')
                    .gte('similarity_score', threshold);

                if (this.currentProjectId && map.hasProjectId) {
                    query = query.eq('project_id', this.currentProjectId);
                }

                const { data: similarities, error } = await query;

                if (error) {
                    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('column')) {
                        log.debug({ event: 'graphrag_similarity_table_missing', table: map.table }, 'Similarity table not found, skipping');
                    } else {
                        log.error({ event: 'graphrag_similarity_error', table: map.table, error }, 'Failed to fetch similarities');
                    }
                    continue;
                }

                if (!similarities || similarities.length === 0) continue;

                const relationships = similarities.map(s => ({
                    fromId: s[map.fromCol],
                    toId: s[map.toCol],
                    type: 'SIMILAR_TO',
                    properties: {
                        score: s.similarity_score,
                        source_table: map.table
                    }
                }));

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
     * Batch-generate embeddings for entities created during syncToGraph().
     * Uses the ontology EmbeddingEnricher for richer text, then calls the
     * embedding LLM in batches of BATCH_SIZE to minimise API round-trips.
     * Results are upserted into the Supabase `embeddings` table via storage.
     */
    async _generateSyncEmbeddings(data) {
        const BATCH_SIZE = 50;
        let count = 0;
        let errorCount = 0;

        // Ontology PascalCase -> DB lowercase mapping for composite IDs.
        // The embeddings table stores lowercase entity_type values; graph/ontology
        // uses PascalCase internally. We pass the PascalCase ontologyType to the
        // EmbeddingEnricher (which needs ontology schema lookups) but store with
        // the lowercase dbType.
        const toEmbed = [];
        const push = (ontologyType, dbType, items, textFn) => {
            for (const item of items || []) {
                if (!item.id) continue;
                const enriched = this.embeddingEnricher
                    ? this.embeddingEnricher.enrichEntity(ontologyType, item, {})
                    : null;
                const text = enriched || textFn(item);
                if (text && text.length > 5) {
                    toEmbed.push({ id: item.id, dbType, text });
                }
            }
        };

        push('Person',        'person',         data.people,                      p => `[Person] ${p.name || ''} ${p.role || ''}`);
        push('Document',      'document',        data.documents,                  d => `[Document] ${d.title || d.filename || ''} ${(d.content || '').substring(0, 300)}`);
        push('Email',         'email',           data.emails,                     e => `[Email] ${e.subject || ''} from ${e.from_name || e.from_email || ''} ${(e.body || '').substring(0, 300)}`);
        push('Sprint',        'sprint',          data.sprints,                    s => `[Sprint] ${s.title || s.name || ''} ${s.goal || ''}`);
        push('UserStory',     'user_story',      data.userStories,                s => `[UserStory] ${s.title || ''} ${s.description || ''}`);
        push('Action',        'action',          data.actions,                    a => `[Task] ${a.task || a.title || ''} ${a.details || ''}`);
        push('Decision',      'decision',        data.decisions,                  d => `[Decision] ${d.decision || d.title || ''} ${d.rationale || ''}`);
        push('Risk',          'risk',            data.risks,                      r => `[Risk] ${r.title || r.risk || ''} ${r.mitigation || ''}`);
        push('Fact',          'fact',            data.facts,                      f => `[Fact] ${f.fact || f.content || ''} ${f.category || ''}`);
        push('Question',      'question',        data.questions,                  q => `[Question] ${q.question || q.text || ''} ${q.answer || ''}`);
        push('Technology',    'technology',       data.technologies,               t => `[Technology] ${t.name || ''} ${t.category || ''} ${t.description || ''}`);
        push('Contact',       'contact',         data.contacts,                   c => `[Contact] ${c.name || ''} ${c.email || ''} ${c.company || ''} ${c.role || ''}`);
        push('CalendarEvent', 'calendar_event',  data.events,                     e => `[CalendarEvent] ${e.title || e.summary || ''} ${e.description || ''}`);
        push('Meeting',       'meeting',         data.meetings,                   m => `[Meeting] ${m.title || ''} ${m.summary || ''} ${m.date || ''}`);
        push('Team',          'team',            data.teams,                      t => `[Team] ${t.name || ''} ${t.description || ''}`);
        push('Company',       'company',         data.companies || (data.company ? [data.company] : []),
                                                                                  c => `[Company] ${c.name || ''} ${c.industry || ''} ${c.description || ''}`);
        push('Conversation',  'conversation',    data.conversations,              c => `[Conversation] ${c.title || ''} ${c.conversation_type || ''} ${(c.participants || []).join(', ')}`);

        if (toEmbed.length === 0) {
            return { count: 0, errors: 0 };
        }

        log.info({ event: 'graphrag_embedding_start', total: toEmbed.length }, 'Starting embedding generation for synced entities');

        for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
            const batch = toEmbed.slice(i, i + BATCH_SIZE);
            const texts = batch.map(e => e.text);

            try {
                const embResult = await llmRouter.routeAndExecute('embeddings', 'embed', {
                    texts,
                    context: 'graphrag-sync-embed'
                }, this._resolvedConfig);

                if (embResult.success && embResult.result?.embeddings?.length > 0) {
                    const items = batch.map((e, idx) => ({
                        id: `${e.dbType}_${e.id}`,
                        type: e.dbType,
                        text: e.text,
                        embedding: embResult.result.embeddings[idx] || null
                    })).filter(item => item.embedding);

                    if (items.length > 0 && this.storage?.saveEmbeddings) {
                        await this.storage.saveEmbeddings(items);
                        count += items.length;
                    }
                }
            } catch (batchErr) {
                errorCount++;
                log.warn({ event: 'graphrag_embedding_batch_error', batch: i / BATCH_SIZE, reason: batchErr.message }, 'Embedding batch failed');
            }
        }

        log.info({ event: 'graphrag_embedding_done', count, errors: errorCount, total: toEmbed.length }, 'Embedding generation complete');
        return { count, errors: errorCount };
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
        let multiHopResult = null;

        // 2a. Multi-hop reasoning for complex multi-part queries
        if (this.useMultiHop && this._isComplexQuery(userQuery)) {
            try {
                const multiHop = this._getMultiHop();
                if (multiHop) {
                    const retrieveFn = async (q) => {
                        const subAnalysis = this.classifyQuery(q);
                        return await this.hybridSearch(q, { queryAnalysis: subAnalysis });
                    };
                    multiHopResult = await multiHop.execute(userQuery, retrieveFn);
                    if (multiHopResult.isMultiHop && multiHopResult.results?.length > 0) {
                        results = multiHopResult.results;
                        log.debug({ event: 'graphrag_multihop', subQueries: multiHopResult.subQueryCount, results: results.length }, 'Multi-hop reasoning produced results');
                    }
                }
            } catch (error) {
                log.warn({ event: 'graphrag_multihop_failed', reason: error.message }, 'Multi-hop reasoning failed, falling through');
            }
        }

        // Check if graph provider is available and connected
        const graphAvailable = this.graphProvider && this.graphProvider.connected;

        if (results.length === 0 && graphAvailable) {
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
        } else if (results.length === 0) {
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

        // 3. Post-retrieval: Rerank, expand, and deduplicate
        if (results.length > 0) {
            // 3a. Community-based expansion (add related entities from same community)
            if (this.useCommunityExpansion) {
                try {
                    const cd = this._getCommunityDetection();
                    if (cd) {
                        results = await cd.expandWithCommunity(results, { maxExpansion: 3 });
                        log.debug({ event: 'graphrag_community_expanded', count: results.length }, 'Community expansion applied');
                    }
                } catch (e) {
                    log.warn({ event: 'graphrag_community_error', reason: e.message }, 'Community expansion failed');
                }
            }

            // 3b. Query-dependent reranking (lightweight heuristic boost by query type)
            if (this.useReranker && this.reranker) {
                try {
                    results = this.reranker.queryDependentRerank(userQuery, results, queryAnalysis);
                    log.debug({ event: 'graphrag_reranked', count: results.length }, 'Query-dependent reranking applied');
                } catch (e) {
                    log.warn({ event: 'graphrag_rerank_error', reason: e.message }, 'Reranking failed');
                }
            }

            // 3c. Final deduplication -- merge results with same type + similar content
            results = this._deduplicateResults(results);
        }

        // 4. Generate response using LLM
        // If multi-hop produced a synthesized answer, prefer it
        const response = (multiHopResult?.isMultiHop && multiHopResult.synthesis?.answer)
            ? { answer: multiHopResult.synthesis.answer, sources: results.map(r => ({ type: r.type, content: r.content?.substring(0, 200) })) }
            : await this.generateResponse(userQuery, results, options);

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
            aiCypher: aiGeneratedCypher ? {
                query: aiGeneratedCypher.cypher,
                explanation: aiGeneratedCypher.explanation,
                confidence: aiGeneratedCypher.confidence,
                cached: aiGeneratedCypher.cached || false
            } : null,
            multiHop: multiHopResult?.isMultiHop ? {
                subQueryCount: multiHopResult.subQueryCount,
                reasoningChain: multiHopResult.reasoningChain,
                confidence: multiHopResult.synthesis?.confidence
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
     * Average multiple embedding vectors with L2 normalization.
     * Used by HyDE to combine query + hypothetical document embeddings.
     */
    _averageEmbeddings(embeddings) {
        if (!embeddings || embeddings.length === 0) return [];
        if (embeddings.length === 1) return embeddings[0];

        const dim = embeddings[0].length;
        const avg = new Array(dim).fill(0);
        for (const emb of embeddings) {
            for (let i = 0; i < dim; i++) {
                avg[i] += emb[i];
            }
        }
        // L2 normalize
        let norm = 0;
        for (let i = 0; i < dim; i++) {
            avg[i] /= embeddings.length;
            norm += avg[i] * avg[i];
        }
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (let i = 0; i < dim; i++) avg[i] /= norm;
        }
        return avg;
    }

    /**
     * Deduplicate results by type + content similarity.
     * Keeps the first occurrence (highest rank) when duplicates are found.
     */
    _deduplicateResults(results) {
        if (!results || results.length <= 1) return results;

        const seen = new Map();
        const deduped = [];

        for (const r of results) {
            const content = (r.content || '').toLowerCase().trim();
            const dataId = r.data?.id || r.data?.name || r.data?.title || '';
            // Prefer data ID for dedup (exact match), fall back to content prefix
            const key = dataId
                ? `${r.type}:${dataId}`
                : `${r.type}:${content.substring(0, 80)}`;

            if (!seen.has(key)) {
                seen.set(key, true);
                deduped.push(r);
            }
        }

        return deduped;
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
            const structuralPatterns = [
                /quem (reporta|trabalha|lidera|gere|gerencia)/i,
                /who (reports|works|leads|manages)/i,
                /hierarquia|organograma|estrutura organizacional/i,
                /hierarchy|org.?chart|organizational structure/i,
                /relação entre|ligação entre|conexão entre/i,
                /relationship between|connection between|link between/i,
                /quantos|quantas|total de|count of|how many/i,
                /subordinados de|diretos de|equipa de|equipa do/i,
                /subordinates of|direct reports of|team of/i,
                /^lista(r|) (todos?|todas?|all|os |as )/i,
                /^(show|list) all /i,
                /sprints? (do|da|de |for |in )/i,
                /tarefas? (do|da|de |for |in |atribuídas?)/i,
                /tasks? (for|in|assigned|of) /i,
                /documentos? (do|da|de |for )/i,
                /emails? (do|da|de |from|to|sent) /i,
                /decisões? (do|da|de |for |in )/i,
                /riscos? (do|da|de |for |in )/i
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
        if (/pessoas|people|quem|who|members|equipa/i.test(q)) targetTypes.push('Person');
        if (/contactos?|contacts?/i.test(q)) targetTypes.push('Contact');
        if (/projetos?|projects?/i.test(q)) targetTypes.push('Project');
        if (/decisões?|decisoes?|decisions?/i.test(q)) targetTypes.push('Decision');
        if (/riscos?|risks?/i.test(q)) targetTypes.push('Risk');
        if (/tarefas?|tasks?|ações?|acoes?|actions?/i.test(q)) targetTypes.push('Action');
        if (/factos?|facts?|informações?|findings?/i.test(q)) targetTypes.push('Fact');
        if (/questões?|questoes?|questions?|perguntas?/i.test(q)) targetTypes.push('Question');
        if (/documentos?|documents?|ficheiros?|files?/i.test(q)) targetTypes.push('Document');
        if (/emails?|e-mails?|correio/i.test(q)) targetTypes.push('Email');
        if (/sprints?|iterações?|iteracoes?/i.test(q)) targetTypes.push('Sprint');
        if (/equipas?|teams?/i.test(q)) targetTypes.push('Team');
        if (/reuniões?|reunioes?|meetings?/i.test(q)) targetTypes.push('Meeting');
        if (/tecnologias?|tech|technologies?/i.test(q)) targetTypes.push('Technology');
        if (/clientes?|clients?/i.test(q)) targetTypes.push('Client');
        if (/empresas?|compan(y|ies)|organiza(ção|tion|ções|tions)/i.test(q)) targetTypes.push('Company');
        if (/eventos?|events?|calendário|calendar/i.test(q)) targetTypes.push('CalendarEvent');
        if (/histórias?|stories?|user.?stories?/i.test(q)) targetTypes.push('UserStory');

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

        // Entity-name matching: fetch Person nodes once, match all entities against them
        if (this.graphProvider && this.graphProvider.connected && entities.length > 0) {
            const personResult = await this.graphProvider.findNodes('Person', {}, { limit: 200 });
            const allPersonNodes = personResult.ok ? (personResult.nodes || []) : [];

            const traversalPromises = [];
            const matchedPersonIds = new Set();

            for (const entity of entities) {
                const lowerEntity = entity.toLowerCase();
                const matchingPerson = allPersonNodes.find(n =>
                    n.properties.name?.toLowerCase().includes(lowerEntity) &&
                    !matchedPersonIds.has(n.id)
                );

                if (matchingPerson) {
                    matchedPersonIds.add(matchingPerson.id);
                    results.push({
                        type: 'person',
                        content: `${matchingPerson.properties.name} - ${matchingPerson.properties.role || 'Unknown role'}`,
                        data: { ...matchingPerson.properties, id: matchingPerson.id },
                        source: 'graph'
                    });

                    traversalPromises.push(
                        this.graphProvider.traversePath(
                            matchingPerson.id,
                            ['REPORTS_TO', 'MANAGES', 'LEADS_TEAM', 'MEMBER_OF_TEAM', 'ASSIGNED_TO', 'PARTICIPATES_IN', 'BELONGS_TO_PROJECT'],
                            2
                        ).then(pathResult => {
                            if (pathResult.ok && pathResult.paths?.length > 0) {
                                const pathDescriptions = pathResult.paths.map(p => {
                                    const from = p.from?.properties?.name || p.from?.id || '?';
                                    const to = p.to?.properties?.name || p.to?.id || '?';
                                    const rel = p.type || p.relationship?.type || '?';
                                    return `${from} -[${rel}]-> ${to}`;
                                }).join('; ');
                                return {
                                    type: 'relationship',
                                    content: `Relationships for ${matchingPerson.properties.name}: ${pathDescriptions}`,
                                    data: { person: matchingPerson.properties.name, paths: pathResult.paths },
                                    source: 'graph'
                                };
                            }
                            return null;
                        }).catch(() => null)
                    );
                }
            }

            // Run all traversals in parallel
            const traversalResults = await Promise.all(traversalPromises);
            for (const tr of traversalResults) {
                if (tr) results.push(tr);
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

        // HyDE: generate hypothetical documents to improve embedding quality
        let hydeTexts = null;
        if (this.useHyDE && this.hyde) {
            try {
                const hypotheticalDocs = await this.hyde.generateHypotheticalDocuments(enrichedQuery, {
                    numDocs: 1,
                    entityType: queryAnalysis.entityHints?.[0] || ''
                });
                if (hypotheticalDocs.length > 0) {
                    hydeTexts = [enrichedQuery, ...hypotheticalDocs];
                    log.debug({ event: 'graphrag_hyde_generated', count: hypotheticalDocs.length }, 'HyDE hypothetical documents generated');
                }
            } catch (e) {
                log.warn({ event: 'graphrag_hyde_error', reason: e.message }, 'HyDE generation failed, using enriched query');
            }
        }

        if (!this.storage) {
            return results;
        }

        // Check if storage supports Supabase vector search
        const embeddingsData = this.storage.loadEmbeddings();
        const isSupabaseMode = embeddingsData?.isSupabaseMode === true;

        if (isSupabaseMode && this.storage.searchWithEmbedding) {
            // ==================== SUPABASE VECTOR SEARCH ====================
            log.debug({ event: 'graphrag_supabase_vector' }, 'Using Supabase vector search');

            try {
                // Embed all texts (original + HyDE hypothetical docs) and average
                const textsToEmbed = hydeTexts || [enrichedQuery];
                const embRouterResult = await llmRouter.routeAndExecute('embeddings', 'embed', {
                    texts: textsToEmbed,
                    context: 'graphrag-supabase-vector'
                }, this._resolvedConfig);

                if (embRouterResult.success && embRouterResult.result?.embeddings?.[0]) {
                    let queryEmbedding;
                    const allEmbeddings = embRouterResult.result.embeddings;
                    if (allEmbeddings.length > 1) {
                        queryEmbedding = this._averageEmbeddings(allEmbeddings);
                    } else {
                        queryEmbedding = allEmbeddings[0];
                    }

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
            const textsToEmbed = hydeTexts || [enrichedQuery];
            const embRouterResult = await llmRouter.routeAndExecute('embeddings', 'embed', {
                texts: textsToEmbed,
                context: 'graphrag-local-vector'
            }, this._resolvedConfig);

            if (embRouterResult.success && embRouterResult.result?.embeddings?.[0]) {
                const allEmbeddings = embRouterResult.result.embeddings;
                const queryEmbedding = allEmbeddings.length > 1
                    ? this._averageEmbeddings(allEmbeddings)
                    : allEmbeddings[0];
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

        // Use Reciprocal Rank Fusion if Reranker is available
        if (this.useReranker && this.reranker && (structuralResults.length > 0 || semanticResults.length > 0)) {
            try {
                const fused = this.reranker.reciprocalRankFusion(
                    [structuralResults, semanticResults],
                    60
                );
                log.debug({ event: 'graphrag_rrf_fused', structural: structuralResults.length, semantic: semanticResults.length, fused: fused.length }, 'RRF fusion applied');
                return fused.slice(0, 15);
            } catch (e) {
                log.warn({ event: 'graphrag_rrf_error', reason: e.message }, 'RRF fusion failed, using naive merge');
            }
        }

        // Fallback: naive merge with dedup
        const merged = [];
        const seen = new Set();

        for (const result of structuralResults) {
            const key = result.data?.id || `${result.type}:${result.content?.substring(0, 80)}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...result, searchType: 'structural' });
            }
        }

        for (const result of semanticResults) {
            const key = result.data?.id || `${result.type}:${result.content?.substring(0, 80)}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push({ ...result, searchType: 'semantic' });
            }
        }

        merged.sort((a, b) => {
            if (a.similarity && b.similarity) return b.similarity - a.similarity;
            if (a.searchType === 'structural' && b.searchType !== 'structural') return -1;
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

        // Build structured context with character budget
        const MAX_CONTEXT_CHARS = 8000;
        const contextParts = [];
        let sourceIndex = 1;
        let totalChars = 0;

        for (const [type, items] of Object.entries(groupedResults)) {
            const typeLabel = this.getTypeLabel(type);
            contextParts.push(`\n### ${typeLabel}:`);

            for (const item of items) {
                if (totalChars >= MAX_CONTEXT_CHARS) break;

                const tag = `[${sourceIndex}]`;
                let content = item.content || '';

                // Enrich based on entity type
                if (item.data) {
                    if (type === 'person' || type === 'contact') {
                        const d = item.data;
                        content = `${d.name || content} - ${d.role || 'sem cargo'}${d.organization ? ` (${d.organization})` : ''}${d.email ? ` [${d.email}]` : ''}`;
                    } else if (type === 'relationship' && item.data.paths) {
                        content = item.content;
                    } else if (type === 'risk' && item.data) {
                        const d = item.data;
                        content = `${d.title || d.content || content}${d.severity ? ` | Severidade: ${d.severity}` : ''}${d.status ? ` | Status: ${d.status}` : ''}`;
                    } else if (type === 'action' || type === 'task') {
                        const d = item.data;
                        content = `${d.title || content}${d.priority ? ` | Prioridade: ${d.priority}` : ''}${d.status ? ` | Status: ${d.status}` : ''}`;
                    }
                }

                // Truncate individual items to prevent one huge item from consuming all budget
                if (content.length > 500) content = content.substring(0, 500) + '...';

                const line = `${tag} ${content}`;
                totalChars += line.length;
                contextParts.push(line);
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

        const routerResult = await llmRouter.routeAndExecute('processing', 'generateText', {
            prompt: userPrompt,
            system: systemPrompt,
            temperature: 0.2,
            maxTokens: 1500,
            context: 'graphrag-generate-response'
        }, this._resolvedConfig);

        if (!routerResult.success) {
            log.warn({ event: 'graphrag_llm_error', reason: routerResult.error?.message || routerResult.error }, 'LLM error');
            return {
                answer: `Erro ao gerar resposta: ${routerResult.error?.message || routerResult.error}`,
                sources: []
            };
        }
        const llmResult = { success: true, text: routerResult.result?.text || routerResult.result?.response };

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
            'contact': 'Contactos',
            'project': 'Projetos',
            'meeting': 'Reuniões',
            'decision': 'Decisões',
            'task': 'Tarefas',
            'action': 'Ações',
            'risk': 'Riscos',
            'fact': 'Factos',
            'question': 'Questões',
            'technology': 'Tecnologias',
            'client': 'Clientes',
            'company': 'Empresas',
            'document': 'Documentos',
            'email': 'Emails',
            'sprint': 'Sprints',
            'team': 'Equipas',
            'userstory': 'User Stories',
            'calendarevent': 'Eventos de Calendário',
            'relationship': 'Relações',
            'other': 'Outros'
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

                const embRouterResult = await llmRouter.routeAndExecute('embeddings', 'embed', {
                    texts: [enrichedText],
                    context: 'graphrag-enriched-embed'
                }, this._resolvedConfig);

                if (embRouterResult.success && embRouterResult.result?.embeddings?.[0]) {
                    embeddings.push({
                        id: entity.id,
                        type: entity._type,
                        text: enrichedText,
                        embedding: embRouterResult.result.embeddings[0],
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
