/**
 * Purpose:
 *   When a parent entity is deleted, automatically removes or unlinks
 *   dependent data in both the graph database and local storage.
 *
 * Responsibilities:
 *   - Define cascade rules per entity type (contact, conversation, project,
 *     team, meeting) specifying which Cypher queries to run and which local
 *     cleanup methods to invoke
 *   - Execute graph-side cascades (DETACH DELETE, nullify foreign references)
 *   - Execute local-side cleanups (unassign action items, remove embeddings)
 *   - Provide a dry-run preview of what a cascade would do
 *
 * Key dependencies:
 *   - graphProvider: Cypher query interface for graph mutations
 *   - storage: local in-memory data store (actions, decisions, embeddings)
 *
 * Side effects:
 *   - Deletes or mutates graph nodes and relationships
 *   - Mutates in-memory storage objects (nullifies assignee fields, filters
 *     embeddings)
 *
 * Notes:
 *   - Cascade rules are defined declaratively in `this.cascadeRules`.
 *     Adding a new entity type only requires a new entry there.
 *   - Local cleanup methods (removeFromActionItems, etc.) mutate objects
 *     in place; the caller must persist storage afterward if needed.
 *   - `removeRelatedFacts` and `removeRelatedDecisions` for meetings are
 *     stub implementations (TODO: confirm whether they need real logic).
 */

class CascadeDelete {
    constructor(options = {}) {
        this.storage = options.storage;
        this.graphProvider = options.graphProvider;
        
        // Define cascade rules
        this.cascadeRules = {
            contact: {
                // When a contact is deleted, also handle:
                graphQueries: [
                    // Remove person node
                    'MATCH (p:Person {name: $name}) DETACH DELETE p',
                    // Remove from any decisions where they're responsible
                    'MATCH (d:Decision {responsible: $name}) SET d.responsible = null',
                    // Remove from tasks assigned to them
                    'MATCH (t:Task {assignee: $name}) SET t.assignee = null'
                ],
                localCleanup: ['removeFromActionItems', 'removeFromDecisions']
            },
            conversation: {
                graphQueries: [
                    'MATCH (c:Conversation {id: $id}) DETACH DELETE c',
                    'MATCH (n) WHERE n.source = $id WITH n WHERE NOT (n)--() DELETE n'
                ],
                localCleanup: ['removeRelatedEmbeddings']
            },
            project: {
                graphQueries: [
                    'MATCH (p:Project {id: $id}) DETACH DELETE p',
                    'MATCH (n) WHERE n.projectId = $id DETACH DELETE n'
                ],
                localCleanup: []
            },
            team: {
                graphQueries: [
                    'MATCH (t:Team {id: $id}) DETACH DELETE t'
                ],
                localCleanup: []
            },
            meeting: {
                graphQueries: [
                    'MATCH (m:Meeting {id: $id}) DETACH DELETE m',
                    'MATCH (d:Decision {meetingId: $id}) DETACH DELETE d',
                    'MATCH (t:Task {meetingId: $id}) DETACH DELETE t'
                ],
                localCleanup: ['removeRelatedFacts', 'removeRelatedDecisions']
            }
        };
    }

    setStorage(storage) {
        this.storage = storage;
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Execute cascade delete for an item
     */
    async cascadeDelete(type, item) {
        const results = {
            type,
            itemId: item.id,
            graphDeleted: [],
            localCleanup: [],
            errors: []
        };

        const rules = this.cascadeRules[type];
        if (!rules) {
            return { ...results, message: 'No cascade rules defined for type' };
        }

        // Execute graph queries
        if (this.graphProvider && this.graphProvider.connected) {
            for (const query of rules.graphQueries) {
                try {
                    const params = {
                        id: item.id,
                        name: item.name,
                        title: item.title,
                        email: item.email
                    };
                    await this.graphProvider.query(query, params);
                    results.graphDeleted.push(query.substring(0, 50) + '...');
                } catch (e) {
                    results.errors.push(`Graph query failed: ${e.message}`);
                }
            }
        }

        // Execute local cleanup
        if (this.storage) {
            for (const cleanup of rules.localCleanup) {
                try {
                    await this[cleanup](item);
                    results.localCleanup.push(cleanup);
                } catch (e) {
                    results.errors.push(`Local cleanup ${cleanup} failed: ${e.message}`);
                }
            }
        }

        return results;
    }

    // Local cleanup methods
    async removeFromActionItems(contact) {
        if (!this.storage) return;
        const actions = this.storage.getActions?.() || [];
        for (const action of actions) {
            if (action.assignee === contact.name || action.assigned_to === contact.name) {
                action.assignee = null;
                action.assigned_to = null;
            }
        }
    }

    async removeFromDecisions(contact) {
        if (!this.storage) return;
        const decisions = this.storage.getDecisions?.() || [];
        for (const decision of decisions) {
            if (decision.responsible === contact.name) {
                decision.responsible = null;
            }
        }
    }

    async removeRelatedEmbeddings(conversation) {
        if (!this.storage) return;
        const embeddings = this.storage.loadEmbeddings?.();
        if (embeddings && embeddings.embeddings) {
            const filtered = embeddings.embeddings.filter(e => 
                !e.id?.startsWith(`conv_${conversation.id}_`)
            );
            if (filtered.length < embeddings.embeddings.length) {
                this.storage.saveEmbeddings?.(filtered);
            }
        }
    }

    async removeRelatedFacts(meeting) {
        // Would remove facts extracted from this meeting
    }

    async removeRelatedDecisions(meeting) {
        // Would remove decisions from this meeting
    }

    /**
     * Preview what would be deleted (dry run)
     */
    previewCascade(type, item) {
        const rules = this.cascadeRules[type];
        if (!rules) {
            return { message: 'No cascade rules defined' };
        }

        return {
            type,
            item: item.name || item.title || item.id,
            wouldExecute: {
                graphQueries: rules.graphQueries.length,
                localCleanup: rules.localCleanup
            }
        };
    }
}

// Singleton
let instance = null;
function getCascadeDelete(options = {}) {
    if (!instance) {
        instance = new CascadeDelete(options);
    }
    if (options.storage) instance.setStorage(options.storage);
    if (options.graphProvider) instance.setGraphProvider(options.graphProvider);
    return instance;
}

module.exports = { CascadeDelete, getCascadeDelete };
