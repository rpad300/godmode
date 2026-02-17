/**
 * Purpose:
 *   Performs a comprehensive, platform-wide sweep of all data types to discover
 *   and materialise relationships in the knowledge graph. Unlike RelationInference
 *   (which works on ad-hoc text), this class processes structured Supabase records
 *   across every domain entity: contacts, teams, questions, risks, decisions,
 *   actions, facts, documents, meetings/transcripts, and conversations.
 *
 * Responsibilities:
 *   - Infer WORKS_WITH / REPORTS_TO from contact org/dept/role data
 *   - Infer MEMBER_OF from explicit team membership records
 *   - Link questions, risks, decisions, actions, facts, and documents to the
 *     contacts who own, created, or are mentioned in them
 *   - Infer KNOWS / PARTICIPATED_IN from meeting attendee lists
 *   - Link knowledge items (facts, questions, risks, decisions, actions) back
 *     to the meeting/transcript that produced them via source_file matching
 *   - Create RELATED_TO edges between items extracted from the same source
 *   - Persist high-confidence relationships directly to the graph; queue
 *     low-confidence ones as suggestions for human review
 *   - Write contact-to-contact relationships to the contact_relationships
 *     Supabase table for the social graph
 *
 * Key dependencies:
 *   - ../logger: structured logging
 *   - ../llm (getLLM): available but currently unused (reserved for future
 *     AI-assisted inference)
 *   - Storage layer (injected): Supabase-backed data access for all entity types
 *   - Graph provider (injected via storage): writes nodes and relationships
 *
 * Side effects:
 *   - Creates graph nodes (Meeting, Question, Risk, Decision, Action, Fact,
 *     Document) and relationship edges
 *   - Writes to Supabase tables: contact_relationships, ontology_changes
 *   - Performs many Supabase SELECT queries across multiple tables
 *   - Accesses this.storage._supabase.supabase for direct queries -- relies on
 *     internal storage implementation detail
 *
 * Notes:
 *   - autoApproveThreshold (default 0.8) controls which inferred relationships
 *     are written directly vs. queued as suggestions.
 *   - Contact name matching (findContactByName) uses case-insensitive partial
 *     matching; this can produce false positives for short or common first names.
 *   - The source_file -> transcript matching in inferMeetingRelationships uses
 *     a 1-hour timestamp tolerance window, which may mis-match rapid successive
 *     transcripts.
 *   - linkItemsFromSameSource creates Meeting nodes from source_file identifiers
 *     even when no transcript record exists -- these act as synthetic grouping
 *     nodes.
 *   - The O(n^2) pair generation (WORKS_WITH, KNOWS) can be expensive for large
 *     teams or meetings; no explicit cap is applied beyond the upstream query
 *     limits.
 */

const { logger } = require('../logger');
const { getLLM } = require('../llm');

const log = logger.child({ module: 'relationship-inferrer' });

class RelationshipInferrer {
    constructor(options = {}) {
        this.storage = options.storage || null;
        this.graphProvider = options.graphProvider || null;
        this.llmProvider = options.llmProvider || 'openai';
        this.autoApproveThreshold = options.autoApproveThreshold || 0.8;
    }

    setStorage(storage) {
        this.storage = storage;
        this.graphProvider = storage?.getGraphProvider?.();
        log.debug({ event: 'relationship_inferrer_graph_provider', hasProvider: !!this.graphProvider, connected: !!this.graphProvider?.connected }, 'Graph provider status');
    }

    /**
     * Run full relationship inference on ALL platform data
     */
    async inferAllRelationships() {
        log.info({ event: 'relationship_inferrer_full_analysis_start' }, 'Starting FULL platform analysis');
        
        const results = {
            analyzed: { 
                contacts: 0, teams: 0, questions: 0, risks: 0, 
                decisions: 0, actions: 0, facts: 0, documents: 0,
                meetings: 0, conversations: 0
            },
            inferred: { total: 0, autoApproved: 0, pending: 0 },
            relationships: [],
            nodes: []
        };

        // Get Supabase client for direct queries
        this.supabase = this.storage?._supabase?.supabase;
        this.projectId = this.storage?.currentProjectId;
        
        log.debug({ event: 'relationship_inferrer_project', projectId: this.projectId, hasSupabase: !!this.supabase }, 'Project and Supabase');

        try {
            // Load all contacts first (needed for name matching)
            this.contacts = await this.storage?.getContacts?.() || [];
            this.contactByName = {};
            this.contactById = {};
            for (const c of this.contacts) {
                if (c.name) this.contactByName[c.name.toLowerCase()] = c;
                if (c.id) this.contactById[c.id] = c;
            }
            
            log.debug({ event: 'relationship_inferrer_contacts_loaded', count: this.contacts.length }, 'Contacts loaded for matching');

            // 1. Contact relationships (org, dept, roles)
            const contactRels = await this.inferContactRelationships();
            results.analyzed.contacts = contactRels.analyzed;
            results.relationships.push(...contactRels.relationships);

            // 2. Team memberships
            const teamRels = await this.inferTeamMemberships();
            results.analyzed.teams = teamRels.analyzed;
            results.relationships.push(...teamRels.relationships);
            results.nodes.push(...(teamRels.nodes || []));

            // 3. Questions - who asked, who should answer
            const questionRels = await this.inferQuestionRelationships();
            results.analyzed.questions = questionRels.analyzed;
            results.relationships.push(...questionRels.relationships);
            results.nodes.push(...(questionRels.nodes || []));

            // 4. Risks - owner, affected contacts
            const riskRels = await this.inferRiskRelationships();
            results.analyzed.risks = riskRels.analyzed;
            results.relationships.push(...riskRels.relationships);
            results.nodes.push(...(riskRels.nodes || []));

            // 5. Decisions - maker, affected people
            const decisionRels = await this.inferDecisionRelationships();
            results.analyzed.decisions = decisionRels.analyzed;
            results.relationships.push(...decisionRels.relationships);
            results.nodes.push(...(decisionRels.nodes || []));

            // 6. Actions - assignee, creator
            const actionRels = await this.inferActionRelationships();
            results.analyzed.actions = actionRels.analyzed;
            results.relationships.push(...actionRels.relationships);
            results.nodes.push(...(actionRels.nodes || []));

            // 7. Facts - mentioned people, related topics
            const factRels = await this.inferFactRelationships();
            results.analyzed.facts = factRels.analyzed;
            results.relationships.push(...factRels.relationships);
            results.nodes.push(...(factRels.nodes || []));

            // 8. Documents - uploader, mentioned people
            const docRels = await this.inferDocumentRelationships();
            results.analyzed.documents = docRels.analyzed;
            results.relationships.push(...docRels.relationships);
            results.nodes.push(...(docRels.nodes || []));

            // 9. Meetings/Transcripts - participants
            const meetingRels = await this.inferMeetingRelationships();
            results.analyzed.meetings = meetingRels.analyzed;
            results.relationships.push(...meetingRels.relationships);
            results.nodes.push(...(meetingRels.nodes || []));

            // 10. Conversations - participants
            const convRels = await this.inferConversationRelationships();
            results.analyzed.conversations = convRels.analyzed;
            results.relationships.push(...convRels.relationships);

            // Save all nodes first
            log.debug({ event: 'relationship_inferrer_creating_nodes', count: results.nodes.length }, 'Creating nodes');
            let nodesCreated = 0;
            for (const node of results.nodes) {
                try {
                    const result = await this.graphProvider?.createNode(node.label, node.properties);
                    if (result?.ok) nodesCreated++;
                } catch (e) {
                    // Node might already exist
                }
            }
            log.debug({ event: 'relationship_inferrer_nodes_created', created: nodesCreated, total: results.nodes.length }, 'Nodes created');

            // Save all relationships
            log.debug({ event: 'relationship_inferrer_saving_rels', count: results.relationships.length }, 'Saving relationships');
            let relsSaved = 0;
            for (const rel of results.relationships) {
                try {
                    if (rel.confidence >= this.autoApproveThreshold) {
                        await this.saveRelationship(rel);
                        results.inferred.autoApproved++;
                        relsSaved++;
                    } else {
                        await this.saveSuggestion(rel);
                        results.inferred.pending++;
                    }
                    results.inferred.total++;
                } catch (e) {
                    // Relationship might already exist
                    log.warn({ event: 'relationship_inferrer_save_error', reason: e.message }, 'Save error');
                }
            }
            log.debug({ event: 'relationship_inferrer_saved', relsSaved, pending: results.inferred.pending }, 'Saved to graph and suggestions');

            log.debug({ event: 'relationship_inferrer_complete', analyzed: results.analyzed, inferred: results.inferred }, 'Analysis complete');
            return { ok: true, results };

        } catch (error) {
            log.error({ event: 'relationship_inferrer_error', reason: error.message }, 'Error');
            return { ok: false, error: error.message, results };
        }
    }

    /**
     * Infer relationships between contacts based on shared attributes
     */
    async inferContactRelationships() {
        const relationships = [];
        let analyzed = 0;

        try {
            const contacts = await this.storage?.getContacts?.() || [];
            analyzed = contacts.length;

            // Group by organization
            const byOrg = {};
            for (const contact of contacts) {
                if (contact.organization) {
                    if (!byOrg[contact.organization]) byOrg[contact.organization] = [];
                    byOrg[contact.organization].push(contact);
                }
            }

            // Create WORKS_WITH relationships for people in same org
            for (const [org, orgContacts] of Object.entries(byOrg)) {
                if (orgContacts.length > 1) {
                    for (let i = 0; i < orgContacts.length; i++) {
                        for (let j = i + 1; j < orgContacts.length; j++) {
                            relationships.push({
                                fromId: orgContacts[i].id,
                                fromName: orgContacts[i].name,
                                toId: orgContacts[j].id,
                                toName: orgContacts[j].name,
                                type: 'WORKS_WITH',
                                confidence: 0.85,
                                reason: `Both work at ${org}`,
                                source: 'organization_match'
                            });
                        }
                    }
                }
            }

            // Group by department within org
            const byDept = {};
            for (const contact of contacts) {
                if (contact.organization && contact.department) {
                    const key = `${contact.organization}::${contact.department}`;
                    if (!byDept[key]) byDept[key] = [];
                    byDept[key].push(contact);
                }
            }

            // Create stronger WORKS_WITH for same department
            for (const [dept, deptContacts] of Object.entries(byDept)) {
                if (deptContacts.length > 1) {
                    for (let i = 0; i < deptContacts.length; i++) {
                        for (let j = i + 1; j < deptContacts.length; j++) {
                            // Update existing relationship confidence
                            const existing = relationships.find(r => 
                                (r.fromId === deptContacts[i].id && r.toId === deptContacts[j].id) ||
                                (r.fromId === deptContacts[j].id && r.toId === deptContacts[i].id)
                            );
                            if (existing) {
                                existing.confidence = 0.95;
                                existing.reason += ` (same department: ${dept.split('::')[1]})`;
                            }
                        }
                    }
                }
            }

            // Infer REPORTS_TO from role names
            const managers = contacts.filter(c => 
                c.role?.toLowerCase().includes('manager') ||
                c.role?.toLowerCase().includes('director') ||
                c.role?.toLowerCase().includes('lead') ||
                c.role?.toLowerCase().includes('head')
            );

            for (const manager of managers) {
                // Find people in same org/dept who might report to this manager
                const potentialReports = contacts.filter(c => 
                    c.id !== manager.id &&
                    c.organization === manager.organization &&
                    c.department === manager.department &&
                    !c.role?.toLowerCase().includes('manager') &&
                    !c.role?.toLowerCase().includes('director')
                );

                for (const report of potentialReports) {
                    relationships.push({
                        fromId: report.id,
                        fromName: report.name,
                        toId: manager.id,
                        toName: manager.name,
                        type: 'REPORTS_TO',
                        confidence: 0.7,
                        reason: `${manager.name} has managerial role in same department`,
                        source: 'role_inference'
                    });
                }
            }

            log.debug({ event: 'relationship_inferrer_contact_analysis', analyzed, relationships: relationships.length }, 'Contact analysis');

        } catch (e) {
            log.error({ event: 'relationship_inferrer_contact_error', reason: e.message }, 'Contact analysis error');
        }

        return { analyzed, relationships };
    }

    /**
     * Infer team memberships
     */
    async inferTeamMemberships() {
        const relationships = [];
        let analyzed = 0;

        try {
            const teams = await this.storage?.getTeams?.() || [];
            analyzed = teams.length;

            for (const team of teams) {
                // Get team members
                const members = team.members || [];
                
                for (const member of members) {
                    const contactId = member.contact_id || member.contactId || member.id;
                    if (contactId) {
                        relationships.push({
                            fromId: contactId,
                            fromName: member.name || 'Unknown',
                            toId: team.id,
                            toName: team.name,
                            type: 'MEMBER_OF',
                            confidence: 1.0,
                            reason: 'Explicit team membership',
                            source: 'team_data'
                        });
                    }
                }

                // Also create WORKS_WITH between team members
                for (let i = 0; i < members.length; i++) {
                    for (let j = i + 1; j < members.length; j++) {
                        const id1 = members[i].contact_id || members[i].contactId || members[i].id;
                        const id2 = members[j].contact_id || members[j].contactId || members[j].id;
                        if (id1 && id2) {
                            relationships.push({
                                fromId: id1,
                                fromName: members[i].name,
                                toId: id2,
                                toName: members[j].name,
                                type: 'WORKS_WITH',
                                confidence: 0.9,
                                reason: `Both members of team "${team.name}"`,
                                source: 'team_membership'
                            });
                        }
                    }
                }
            }

            log.debug({ event: 'relationship_inferrer_team_analysis', analyzed, relationships: relationships.length }, 'Team analysis');

        } catch (e) {
            log.error({ event: 'relationship_inferrer_team_error', reason: e.message }, 'Team analysis error');
        }

        return { analyzed, relationships };
    }

    /**
     * Infer relationships from Questions (from Supabase)
     */
    async inferQuestionRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            // Get questions from Supabase directly
            let questions = [];
            if (this.supabase && this.projectId) {
                const { data } = await this.supabase
                    .from('questions')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                questions = data || [];
            } else {
                questions = this.storage?.questions?.items || [];
            }
            analyzed = questions.length;
            log.debug({ event: 'relationship_inferrer_found_questions', analyzed }, 'Found questions');

            for (const q of questions) {
                const questionId = `question_${q.id}`;
                
                // Create Question node
                nodes.push({
                    label: 'Question',
                    properties: {
                        id: questionId,
                        content: q.content?.substring(0, 200),
                        status: q.status,
                        priority: q.priority,
                        created_at: q.created_at
                    }
                });

                // Link to who asked (if we can match)
                if (q.asked_by || q.created_by) {
                    const asker = this.findContactByName(q.asked_by || q.created_by);
                    if (asker) {
                        relationships.push({
                            fromId: asker.id,
                            fromName: asker.name,
                            toId: questionId,
                            toName: 'Question',
                            type: 'ASKED',
                            confidence: 0.95,
                            reason: 'Question creator',
                            source: 'question_data'
                        });
                    }
                }

                // Link to assigned contact
                if (q.assigned_to || q.assignee) {
                    const assignee = this.findContactByName(q.assigned_to || q.assignee) || 
                                    this.contactById[q.assigned_to] ||
                                    this.contactById[q.assignee];
                    if (assignee) {
                        relationships.push({
                            fromId: assignee.id,
                            fromName: assignee.name,
                            toId: questionId,
                            toName: 'Question',
                            type: 'SHOULD_ANSWER',
                            confidence: 0.9,
                            reason: 'Question assigned to contact',
                            source: 'question_data'
                        });
                    }
                }

                // Extract mentioned people from question content
                const mentioned = this.extractMentionedContacts(q.content);
                for (const contact of mentioned) {
                    relationships.push({
                        fromId: contact.id,
                        fromName: contact.name,
                        toId: questionId,
                        toName: 'Question',
                        type: 'MENTIONED_IN',
                        confidence: 0.75,
                        reason: 'Name mentioned in question',
                        source: 'question_content'
                    });
                }
            }

            log.debug({ event: 'relationship_inferrer_questions_done', analyzed, relationships: relationships.length }, 'Questions analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_question_error', reason: e.message }, 'Question analysis error');
        }

        return { analyzed, relationships, nodes };
    }

    /**
     * Infer relationships from Risks (from Supabase)
     */
    async inferRiskRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            let risks = [];
            if (this.supabase && this.projectId) {
                const { data, error } = await this.supabase
                    .from('risks')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                if (error) log.warn({ event: 'relationship_inferrer_risks_query_error', reason: error.message }, 'Risks query error');
                risks = data || [];
            } else {
                risks = this.storage?.knowledge?.risks || [];
            }
            analyzed = risks.length;
            log.debug({ event: 'relationship_inferrer_found_risks', analyzed }, 'Found risks');

            for (const risk of risks) {
                const riskId = `risk_${risk.id}`;
                
                // Create Risk node
                nodes.push({
                    label: 'Risk',
                    properties: {
                        id: riskId,
                        content: risk.content?.substring(0, 200),
                        severity: risk.impact || risk.severity,
                        status: risk.status,
                        created_at: risk.created_at
                    }
                });

                // Link to owner (owner can be UUID or name string)
                const ownerValue = risk.owner;
                if (ownerValue) {
                    // Try to find by UUID first, then by name
                    const owner = this.contactById[ownerValue] || this.findContactByName(ownerValue);
                    if (owner) {
                        relationships.push({
                            fromId: owner.id,
                            fromName: owner.name,
                            toId: riskId,
                            toName: 'Risk',
                            type: 'OWNS_RISK',
                            confidence: 0.95,
                            reason: `Risk owner: ${ownerValue}`,
                            source: 'risk_data'
                        });
                    }
                }

                // Link to affected contacts
                const affected = risk.affected_contacts || risk.stakeholders || [];
                for (const a of affected) {
                    const contact = this.findContactByName(a) || this.contactById[a];
                    if (contact) {
                        relationships.push({
                            fromId: contact.id,
                            fromName: contact.name,
                            toId: riskId,
                            toName: 'Risk',
                            type: 'AFFECTED_BY',
                            confidence: 0.85,
                            reason: 'Listed as affected by risk',
                            source: 'risk_data'
                        });
                    }
                }

                // Extract mentioned people
                const mentioned = this.extractMentionedContacts(risk.content);
                for (const contact of mentioned) {
                    relationships.push({
                        fromId: contact.id,
                        fromName: contact.name,
                        toId: riskId,
                        toName: 'Risk',
                        type: 'MENTIONED_IN',
                        confidence: 0.7,
                        reason: 'Name mentioned in risk',
                        source: 'risk_content'
                    });
                }
            }

            log.debug({ event: 'relationship_inferrer_risks_done', analyzed, relationships: relationships.length }, 'Risks analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_risk_error', reason: e.message }, 'Risk analysis error');
        }

        return { analyzed, relationships, nodes };
    }

    /**
     * Infer relationships from Decisions (from Supabase)
     */
    async inferDecisionRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            let decisions = [];
            if (this.supabase && this.projectId) {
                const { data, error } = await this.supabase
                    .from('decisions')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                if (error) log.warn({ event: 'relationship_inferrer_decisions_query_error', reason: error.message }, 'Decisions query error');
                decisions = data || [];
            } else {
                decisions = this.storage?.knowledge?.decisions || [];
            }
            analyzed = decisions.length;
            log.debug({ event: 'relationship_inferrer_found_decisions', analyzed }, 'Found decisions');

            for (const dec of decisions) {
                const decisionId = `decision_${dec.id}`;
                
                // Create Decision node
                nodes.push({
                    label: 'Decision',
                    properties: {
                        id: decisionId,
                        content: dec.content?.substring(0, 200),
                        status: dec.status || 'approved',
                        date: dec.decision_date,
                        created_at: dec.created_at
                    }
                });

                // Link to decision maker/owner (owner can be UUID or name string)
                const ownerValue = dec.owner;
                if (ownerValue) {
                    // Try to find by UUID first, then by name
                    const maker = this.contactById[ownerValue] || this.findContactByName(ownerValue);
                    if (maker) {
                        relationships.push({
                            fromId: maker.id,
                            fromName: maker.name,
                            toId: decisionId,
                            toName: 'Decision',
                            type: 'MADE_DECISION',
                            confidence: 0.95,
                            reason: `Decision maker: ${ownerValue}`,
                            source: 'decision_data'
                        });
                    }
                }

                // Link to stakeholders
                const stakeholders = dec.stakeholders || dec.affected || [];
                for (const s of stakeholders) {
                    const contact = this.findContactByName(s) || this.contactById[s];
                    if (contact) {
                        relationships.push({
                            fromId: contact.id,
                            fromName: contact.name,
                            toId: decisionId,
                            toName: 'Decision',
                            type: 'AFFECTED_BY',
                            confidence: 0.85,
                            reason: 'Decision stakeholder',
                            source: 'decision_data'
                        });
                    }
                }

                // Extract mentioned people
                const mentioned = this.extractMentionedContacts(dec.content);
                for (const contact of mentioned) {
                    relationships.push({
                        fromId: contact.id,
                        fromName: contact.name,
                        toId: decisionId,
                        toName: 'Decision',
                        type: 'MENTIONED_IN',
                        confidence: 0.7,
                        reason: 'Name mentioned in decision',
                        source: 'decision_content'
                    });
                }
            }

            log.debug({ event: 'relationship_inferrer_decisions_done', analyzed, relationships: relationships.length }, 'Decisions analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_decision_error', reason: e.message }, 'Decision analysis error');
        }

        return { analyzed, relationships, nodes };
    }

    /**
     * Infer relationships from Actions (from Supabase)
     */
    async inferActionRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            let actions = [];
            if (this.supabase && this.projectId) {
                const { data, error } = await this.supabase
                    .from('actions')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                if (error) log.warn({ event: 'relationship_inferrer_actions_query_error', reason: error.message }, 'Actions query error');
                actions = data || [];
            } else {
                actions = this.storage?.knowledge?.actions || [];
            }
            analyzed = actions.length;
            log.debug({ event: 'relationship_inferrer_found_actions', analyzed }, 'Found actions');

            for (const action of actions) {
                const actionId = `action_${action.id}`;
                
                // Create Action node
                nodes.push({
                    label: 'Action',
                    properties: {
                        id: actionId,
                        title: action.title || action.content?.substring(0, 100),
                        status: action.status,
                        priority: action.priority,
                        due_date: action.due_date,
                        created_at: action.created_at
                    }
                });

                // Link to assignee (assignee is UUID reference to contacts)
                const assigneeId = action.assignee;
                if (assigneeId && this.contactById[assigneeId]) {
                    const assignee = this.contactById[assigneeId];
                    relationships.push({
                        fromId: assignee.id,
                        fromName: assignee.name,
                        toId: actionId,
                        toName: 'Action',
                        type: 'ASSIGNED_TO',
                        confidence: 0.95,
                        reason: 'Action assignee',
                        source: 'action_data'
                    });
                }

                // Link to creator
                if (action.created_by || action.creator) {
                    const creator = this.findContactByName(action.created_by || action.creator);
                    if (creator) {
                        relationships.push({
                            fromId: creator.id,
                            fromName: creator.name,
                            toId: actionId,
                            toName: 'Action',
                            type: 'CREATED',
                            confidence: 0.95,
                            reason: 'Action creator',
                            source: 'action_data'
                        });
                    }
                }
            }

            log.debug({ event: 'relationship_inferrer_actions_done', analyzed, relationships: relationships.length }, 'Actions analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_action_error', reason: e.message }, 'Action analysis error');
        }

        return { analyzed, relationships, nodes };
    }

    /**
     * Infer relationships from Facts (from Supabase)
     */
    async inferFactRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            let facts = [];
            if (this.supabase && this.projectId) {
                const { data } = await this.supabase
                    .from('facts')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                facts = data || [];
            } else {
                facts = this.storage?.knowledge?.facts || [];
            }
            analyzed = facts.length;
            log.debug({ event: 'relationship_inferrer_found_facts', analyzed }, 'Found facts');

            for (const fact of facts) {
                const factId = `fact_${fact.id}`;
                
                // Create Fact node
                nodes.push({
                    label: 'Fact',
                    properties: {
                        id: factId,
                        content: fact.content?.substring(0, 200) || fact.text?.substring(0, 200),
                        category: fact.category,
                        confidence: fact.confidence,
                        source: fact.source_file
                    }
                });

                // Extract mentioned contacts
                const mentioned = this.extractMentionedContacts(fact.content || fact.text);
                for (const contact of mentioned) {
                    relationships.push({
                        fromId: contact.id,
                        fromName: contact.name,
                        toId: factId,
                        toName: 'Fact',
                        type: 'MENTIONED_IN',
                        confidence: 0.8,
                        reason: 'Name mentioned in fact',
                        source: 'fact_content'
                    });
                }

                // If fact mentions two people, they might know each other
                if (mentioned.length >= 2) {
                    for (let i = 0; i < mentioned.length; i++) {
                        for (let j = i + 1; j < mentioned.length; j++) {
                            relationships.push({
                                fromId: mentioned[i].id,
                                fromName: mentioned[i].name,
                                toId: mentioned[j].id,
                                toName: mentioned[j].name,
                                type: 'MENTIONED_TOGETHER',
                                confidence: 0.65,
                                reason: 'Both mentioned in same fact',
                                source: 'fact_co_occurrence'
                            });
                        }
                    }
                }
            }

            log.debug({ event: 'relationship_inferrer_facts_done', analyzed, relationships: relationships.length }, 'Facts analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_fact_error', reason: e.message }, 'Fact analysis error');
        }

        return { analyzed, relationships, nodes };
    }

    /**
     * Infer relationships from Documents (from Supabase)
     */
    async inferDocumentRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            let documents = [];
            if (this.supabase && this.projectId) {
                const { data } = await this.supabase
                    .from('documents')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                documents = data || [];
            } else {
                documents = this.storage?.documents?.items || [];
            }
            analyzed = documents.length;
            log.debug({ event: 'relationship_inferrer_found_documents', analyzed }, 'Found documents');

            for (const doc of documents) {
                const docId = `document_${doc.id}`;
                
                // Create Document node
                nodes.push({
                    label: 'Document',
                    properties: {
                        id: docId,
                        name: doc.name || doc.filename,
                        type: doc.type || doc.file_type,
                        created_at: doc.created_at
                    }
                });

                // Link to uploader
                if (doc.uploaded_by || doc.created_by) {
                    const uploader = this.findContactByName(doc.uploaded_by || doc.created_by);
                    if (uploader) {
                        relationships.push({
                            fromId: uploader.id,
                            fromName: uploader.name,
                            toId: docId,
                            toName: 'Document',
                            type: 'UPLOADED',
                            confidence: 0.95,
                            reason: 'Document uploader',
                            source: 'document_data'
                        });
                    }
                }

                // If document has extracted content, look for mentioned people
                if (doc.content || doc.extracted_text) {
                    const mentioned = this.extractMentionedContacts(doc.content || doc.extracted_text);
                    for (const contact of mentioned) {
                        relationships.push({
                            fromId: contact.id,
                            fromName: contact.name,
                            toId: docId,
                            toName: 'Document',
                            type: 'MENTIONED_IN',
                            confidence: 0.75,
                            reason: 'Name mentioned in document',
                            source: 'document_content'
                        });
                    }
                }
            }

            log.debug({ event: 'relationship_inferrer_documents_done', analyzed, relationships: relationships.length }, 'Documents analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_document_error', reason: e.message }, 'Document analysis error');
        }

        return { analyzed, relationships, nodes };
    }

    /**
     * Infer relationships from Meetings/Transcripts (from Supabase)
     */
    async inferMeetingRelationships() {
        const relationships = [];
        const nodes = [];
        let analyzed = 0;

        try {
            let meetings = [];
            if (this.supabase && this.projectId) {
                // Get transcripts with participants
                const { data } = await this.supabase
                    .from('transcripts')
                    .select('*')
                    .eq('project_id', this.projectId)
                    .is('deleted_at', null);
                meetings = data || [];
            } else {
                meetings = this.storage?.meetings || this.storage?.transcripts || [];
            }
            analyzed = meetings.length;
            log.debug({ event: 'relationship_inferrer_found_meetings', analyzed }, 'Found meetings/transcripts');

            // Also get all facts to build a reverse mapping of source_file -> transcript
            let allFacts = [];
            let allQuestions = [];
            let allRisks = [];
            let allDecisions = [];
            let allActions = [];
            
            if (this.supabase && this.projectId) {
                const [factsRes, questionsRes, risksRes, decisionsRes, actionsRes] = await Promise.all([
                    this.supabase.from('facts').select('id, content, source_file').eq('project_id', this.projectId).is('deleted_at', null),
                    this.supabase.from('questions').select('id, content, source_file').eq('project_id', this.projectId).is('deleted_at', null),
                    this.supabase.from('risks').select('id, content, source_file').eq('project_id', this.projectId).is('deleted_at', null),
                    this.supabase.from('decisions').select('id, content, source_file').eq('project_id', this.projectId).is('deleted_at', null),
                    this.supabase.from('actions').select('id, title, source_file').eq('project_id', this.projectId).is('deleted_at', null)
                ]);
                allFacts = factsRes.data || [];
                allQuestions = questionsRes.data || [];
                allRisks = risksRes.data || [];
                allDecisions = decisionsRes.data || [];
                allActions = actionsRes.data || [];
                
                log.debug({ event: 'relationship_inferrer_loaded_items', facts: allFacts.length, questions: allQuestions.length, risks: allRisks.length, decisions: allDecisions.length, actions: allActions.length }, 'Loaded items');
            }

            for (const meeting of meetings) {
                const meetingId = `meeting_${meeting.id}`;
                
                // Create Meeting node
                nodes.push({
                    label: 'Meeting',
                    properties: {
                        id: meetingId,
                        title: meeting.title || meeting.name,
                        date: meeting.date || meeting.meeting_date,
                        duration: meeting.duration,
                        created_at: meeting.created_at
                    }
                });

                // Link participants
                const participants = meeting.participants || meeting.attendees || [];
                for (const p of participants) {
                    const contact = this.findContactByName(p.name || p) || this.contactById[p.id || p];
                    if (contact) {
                        relationships.push({
                            fromId: contact.id,
                            fromName: contact.name,
                            toId: meetingId,
                            toName: 'Meeting',
                            type: 'PARTICIPATED_IN',
                            confidence: 0.95,
                            reason: 'Meeting participant',
                            source: 'meeting_data'
                        });
                    }
                }

                // Participants who attended same meeting know each other
                const resolvedParticipants = participants
                    .map(p => this.findContactByName(p.name || p) || this.contactById[p.id || p])
                    .filter(Boolean);
                
                for (let i = 0; i < resolvedParticipants.length; i++) {
                    for (let j = i + 1; j < resolvedParticipants.length; j++) {
                        relationships.push({
                            fromId: resolvedParticipants[i].id,
                            fromName: resolvedParticipants[i].name,
                            toId: resolvedParticipants[j].id,
                            toName: resolvedParticipants[j].name,
                            type: 'KNOWS',
                            confidence: 0.85,
                            reason: `Both attended meeting: ${meeting.title || meetingId}`,
                            source: 'meeting_co_attendance'
                        });
                    }
                }

                // If transcript content exists, extract mentioned people
                if (meeting.transcript || meeting.content) {
                    const mentioned = this.extractMentionedContacts(meeting.transcript || meeting.content);
                    for (const contact of mentioned) {
                        // Only add if not already a participant
                        if (!resolvedParticipants.find(p => p.id === contact.id)) {
                            relationships.push({
                                fromId: contact.id,
                                fromName: contact.name,
                                toId: meetingId,
                                toName: 'Meeting',
                                type: 'MENTIONED_IN',
                                confidence: 0.7,
                                reason: 'Name mentioned in meeting transcript',
                                source: 'meeting_transcript'
                            });
                        }
                    }
                }

                // Link items extracted from this transcript
                // Match by transcript ID in source_file (format: "transcript_<id>" or includes the id)
                // Also handle created_at timestamp matching since source_file might be "transcript_1769970559998"
                const transcriptId = meeting.id;
                const titleMatch = meeting.title?.toLowerCase() || '';
                const createdAt = meeting.created_at ? new Date(meeting.created_at).getTime() : null;
                
                // Helper to check if item came from this transcript
                const isFromThisTranscript = (sourceFile) => {
                    if (!sourceFile) return false;
                    const sf = sourceFile.toLowerCase();
                    
                    // Match by UUID ID
                    if (sf.includes(transcriptId)) return true;
                    
                    // Match by title
                    if (titleMatch && sf.includes(titleMatch)) return true;
                    
                    // Match by timestamp (within 1 hour window)
                    if (createdAt) {
                        const timestampMatches = sf.match(/transcript_(\d+)/g) || [];
                        for (const match of timestampMatches) {
                            const ts = parseInt(match.replace('transcript_', ''));
                            if (Math.abs(ts - createdAt) < 3600000) return true; // 1 hour tolerance
                        }
                    }
                    
                    return false;
                };

                // Link facts from this transcript
                for (const fact of allFacts.filter(f => isFromThisTranscript(f.source_file))) {
                    relationships.push({
                        fromId: meetingId,
                        fromName: meeting.title || 'Meeting',
                        toId: `fact_${fact.id}`,
                        toName: 'Fact',
                        type: 'PRODUCED',
                        confidence: 0.95,
                        reason: 'Fact extracted from this transcript',
                        source: 'transcript_extraction'
                    });
                }

                // Link questions from this transcript
                for (const q of allQuestions.filter(q => isFromThisTranscript(q.source_file))) {
                    relationships.push({
                        fromId: meetingId,
                        fromName: meeting.title || 'Meeting',
                        toId: `question_${q.id}`,
                        toName: 'Question',
                        type: 'PRODUCED',
                        confidence: 0.95,
                        reason: 'Question raised in this meeting',
                        source: 'transcript_extraction'
                    });
                }

                // Link risks from this transcript
                for (const r of allRisks.filter(r => isFromThisTranscript(r.source_file))) {
                    relationships.push({
                        fromId: meetingId,
                        fromName: meeting.title || 'Meeting',
                        toId: `risk_${r.id}`,
                        toName: 'Risk',
                        type: 'PRODUCED',
                        confidence: 0.95,
                        reason: 'Risk identified in this meeting',
                        source: 'transcript_extraction'
                    });
                }

                // Link decisions from this transcript
                for (const d of allDecisions.filter(d => isFromThisTranscript(d.source_file))) {
                    relationships.push({
                        fromId: meetingId,
                        fromName: meeting.title || 'Meeting',
                        toId: `decision_${d.id}`,
                        toName: 'Decision',
                        type: 'PRODUCED',
                        confidence: 0.95,
                        reason: 'Decision made in this meeting',
                        source: 'transcript_extraction'
                    });
                }

                // Link actions from this transcript
                for (const a of allActions.filter(a => isFromThisTranscript(a.source_file))) {
                    relationships.push({
                        fromId: meetingId,
                        fromName: meeting.title || 'Meeting',
                        toId: `action_${a.id}`,
                        toName: 'Action',
                        type: 'PRODUCED',
                        confidence: 0.95,
                        reason: 'Action assigned in this meeting',
                        source: 'transcript_extraction'
                    });
                }
            }

            log.debug({ event: 'relationship_inferrer_meetings_done', analyzed, relationships: relationships.length }, 'Meetings analysis');
            
            // BONUS: Even without transcripts in DB, link items that share source_file
            // This creates relationships between facts/questions/risks/decisions/actions from same meeting
            await this.linkItemsFromSameSource(allFacts, allQuestions, allRisks, allDecisions, allActions, relationships, nodes);
            
        } catch (e) {
            log.error({ event: 'relationship_inferrer_meeting_error', reason: e.message }, 'Meeting analysis error');
        }

        return { analyzed, relationships, nodes };
    }
    
    /**
     * Link items that came from the same source (same meeting/transcript)
     */
    async linkItemsFromSameSource(facts, questions, risks, decisions, actions, relationships, nodes) {
        log.debug({ event: 'relationship_inferrer_link_sources' }, 'Linking items from same sources');
        
        // Group items by source_file patterns
        const sourceGroups = new Map();
        
        const addToGroup = (items, type) => {
            for (const item of items) {
                if (!item.source_file) continue;
                // Extract all transcript references
                const sources = item.source_file.split(',').map(s => s.trim());
                for (const source of sources) {
                    if (!sourceGroups.has(source)) {
                        sourceGroups.set(source, []);
                    }
                    sourceGroups.get(source).push({ ...item, itemType: type });
                }
            }
        };
        
        addToGroup(facts, 'Fact');
        addToGroup(questions, 'Question');
        addToGroup(risks, 'Risk');
        addToGroup(decisions, 'Decision');
        addToGroup(actions, 'Action');
        
        log.debug({ event: 'relationship_inferrer_unique_sources', count: sourceGroups.size }, 'Unique sources');
        
        // For each source, create RELATED_TO relationships between items
        for (const [source, items] of sourceGroups) {
            if (items.length < 2) continue;
            
            // Create a Meeting node for this source if not exists
            // Use a deterministic ID based on source to ensure consistency
            const meetingId = `meeting_${source}`;
            nodes.push({
                label: 'Meeting',
                properties: {
                    id: meetingId,  // Explicit ID in properties
                    name: source.replace('transcript_', 'Meeting '),
                    source: source
                }
            });
            
            // Link all items to this meeting
            for (const item of items) {
                const itemId = `${item.itemType.toLowerCase()}_${item.id}`;
                relationships.push({
                    fromId: meetingId,
                    fromName: source,
                    toId: itemId,
                    toName: item.itemType,
                    type: 'PRODUCED',
                    confidence: 0.9,
                    reason: `${item.itemType} extracted from ${source}`,
                    source: 'source_file_analysis'
                });
            }
            
            // Also link items of different types that came from the same source
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const a = items[i];
                    const b = items[j];
                    
                    // Only link different types
                    if (a.itemType === b.itemType) continue;
                    
                    relationships.push({
                        fromId: `${a.itemType.toLowerCase()}_${a.id}`,
                        fromName: a.itemType,
                        toId: `${b.itemType.toLowerCase()}_${b.id}`,
                        toName: b.itemType,
                        type: 'RELATED_TO',
                        confidence: 0.75,
                        reason: `Same source: ${source}`,
                        source: 'source_file_analysis'
                    });
                }
            }
        }
        
        log.debug({ event: 'relationship_inferrer_source_analysis_done', relationships: relationships.length }, 'Source analysis complete');
    }

    /**
     * Infer relationships from Conversations
     */
    async inferConversationRelationships() {
        const relationships = [];
        let analyzed = 0;

        try {
            const conversations = this.storage?.conversations?.items || [];
            analyzed = conversations.length;

            for (const conv of conversations) {
                const convId = `conversation_${conv.id}`;
                
                // Get participants from messages
                const participants = new Set();
                for (const msg of conv.messages || []) {
                    if (msg.sender) participants.add(msg.sender);
                    if (msg.from) participants.add(msg.from);
                }

                // Link participants to conversation
                const resolvedParticipants = [];
                for (const p of participants) {
                    const contact = this.findContactByName(p);
                    if (contact) {
                        resolvedParticipants.push(contact);
                        relationships.push({
                            fromId: contact.id,
                            fromName: contact.name,
                            toId: convId,
                            toName: 'Conversation',
                            type: 'PARTICIPATED_IN',
                            confidence: 0.9,
                            reason: 'Conversation participant',
                            source: 'conversation_data'
                        });
                    }
                }

                // Participants in same conversation know each other
                for (let i = 0; i < resolvedParticipants.length; i++) {
                    for (let j = i + 1; j < resolvedParticipants.length; j++) {
                        relationships.push({
                            fromId: resolvedParticipants[i].id,
                            fromName: resolvedParticipants[i].name,
                            toId: resolvedParticipants[j].id,
                            toName: resolvedParticipants[j].name,
                            type: 'COMMUNICATED_WITH',
                            confidence: 0.9,
                            reason: `Participated in conversation: ${conv.title || convId}`,
                            source: 'conversation_participation'
                        });
                    }
                }
            }

            log.debug({ event: 'relationship_inferrer_conversations_done', analyzed, relationships: relationships.length }, 'Conversations analysis');
        } catch (e) {
            log.error({ event: 'relationship_inferrer_conversation_error', reason: e.message }, 'Conversation analysis error');
        }

        return { analyzed, relationships };
    }

    /**
     * Find contact by name (fuzzy matching)
     */
    findContactByName(name) {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();
        
        // Exact match
        if (this.contactByName[normalized]) {
            return this.contactByName[normalized];
        }
        
        // Partial match (first name or last name)
        for (const [key, contact] of Object.entries(this.contactByName)) {
            if (key.includes(normalized) || normalized.includes(key)) {
                return contact;
            }
            // Check if first name matches
            const firstName = key.split(' ')[0];
            if (firstName === normalized || normalized === firstName) {
                return contact;
            }
        }
        
        return null;
    }

    /**
     * Extract contacts mentioned in text content
     */
    extractMentionedContacts(text) {
        if (!text) return [];
        const mentioned = [];
        const textLower = text.toLowerCase();
        
        for (const contact of this.contacts) {
            if (!contact.name) continue;
            
            // Check if full name is mentioned
            if (textLower.includes(contact.name.toLowerCase())) {
                mentioned.push(contact);
                continue;
            }
            
            // Check first name and last name separately
            const nameParts = contact.name.split(' ');
            if (nameParts.length >= 2) {
                const firstName = nameParts[0].toLowerCase();
                const lastName = nameParts[nameParts.length - 1].toLowerCase();
                
                // Only match if both first and last name appear (to avoid false positives)
                if (firstName.length > 2 && lastName.length > 2) {
                    if (textLower.includes(firstName) && textLower.includes(lastName)) {
                        mentioned.push(contact);
                    }
                }
            }
        }
        
        return mentioned;
    }

    /**
     * Save relationship to graph and Supabase
     */
    async saveRelationship(rel) {
        // Save to graph
        if (this.graphProvider?.connected) {
            try {
                await this.graphProvider.createRelationship(
                    rel.fromId,
                    rel.toId,
                    rel.type,
                    { 
                        confidence: rel.confidence,
                        reason: rel.reason,
                        source: rel.source,
                        inferred_at: new Date().toISOString()
                    }
                );
            } catch (e) {
                log.warn({ event: 'relationship_inferrer_graph_save_error', reason: e.message }, 'Graph save error');
            }
        } else {
            log.warn({ event: 'relationship_inferrer_no_graph', connected: !!this.graphProvider?.connected }, 'No graph provider or not connected');
        }

        // Save to contact_relationships table ONLY if it's a contact-to-contact relationship
        // Check if both IDs look like UUIDs (contact-contact relationship)
        const isUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const isContactToContact = isUUID(rel.fromId) && isUUID(rel.toId) && 
            ['WORKS_WITH', 'REPORTS_TO', 'KNOWS', 'COMMUNICATES_WITH', 'COLLABORATED_WITH'].includes(rel.type);
        
        if (isContactToContact && this.storage?._supabase) {
            try {
                await this.storage._supabase.supabase
                    .from('contact_relationships')
                    .upsert({
                        project_id: this.storage.currentProjectId,
                        from_contact_id: rel.fromId,
                        to_contact_id: rel.toId,
                        relationship_type: rel.type,
                        strength: Math.round(rel.confidence * 5),
                        notes: `[AI Inferred] ${rel.reason}`
                    }, { 
                        onConflict: 'project_id,from_contact_id,to_contact_id,relationship_type',
                        ignoreDuplicates: true 
                    });
            } catch (e) {
                // Might fail if relationship exists
            }
        }
    }

    /**
     * Save low-confidence relationship as suggestion
     */
    async saveSuggestion(rel) {
        // Store in ontology suggestions for user review
        if (this.storage?._supabase) {
            try {
                await this.storage._supabase.supabase
                    .from('ontology_changes')
                    .insert({
                        project_id: this.storage.currentProjectId,
                        change_type: 'relationship_suggestion',
                        target_type: rel.type,
                        target_name: `${rel.fromName} -> ${rel.toName}`,
                        old_definition: null,
                        new_definition: rel,
                        diff: { confidence: rel.confidence },
                        reason: rel.reason,
                        source: rel.source || 'ai_inference'
                    });
            } catch (e) {
                // Ignore duplicates or errors
                log.warn({ event: 'relationship_inferrer_suggestion_save_error', reason: e.message }, 'Suggestion save error');
            }
        }
    }
}

// Singleton
let inferrerInstance = null;

function getRelationshipInferrer(options = {}) {
    if (!inferrerInstance) {
        inferrerInstance = new RelationshipInferrer(options);
    }
    if (options.storage) {
        inferrerInstance.setStorage(options.storage);
    }
    return inferrerInstance;
}

module.exports = {
    RelationshipInferrer,
    getRelationshipInferrer
};
