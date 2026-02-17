/**
 * Purpose:
 *   Enrich graph relationships with temporal metadata (createdAt, validFrom,
 *   validTo) and enable point-in-time and timeline queries.
 *
 * Responsibilities:
 *   - Create relationships with automatic temporal properties (createdAt,
 *     validFrom, optional validTo, confidence)
 *   - Query relationships valid at a specific timestamp
 *   - Retrieve a chronological timeline of all relationships for a given
 *     entity
 *   - Expire (soft-delete) relationships by setting validTo
 *   - Retrieve the full history between two specific entities
 *   - Backfill createdAt/validFrom on existing relationships that lack
 *     temporal metadata
 *
 * Key dependencies:
 *   - graphProvider (injected): Cypher read/write for temporal properties
 *
 * Side effects:
 *   - Mutates relationship properties in the graph database (SET operations)
 *   - enrichExistingRelations bulk-updates all relationships missing timestamps
 *
 * Notes:
 *   - Temporal queries rely on relationships having string-formatted ISO
 *     timestamps stored as properties; native datetime() is used for
 *     enrichment but string comparison is used for filtering.
 *   - expireRelation does not delete the relationship; it sets validTo,
 *     preserving history for audit purposes.
 */

/**
 * Manages temporal metadata (createdAt, validFrom, validTo) on graph
 * relationships and enables point-in-time and timeline queries.
 *
 * @param {object} options
 * @param {object} options.graphProvider - Graph database adapter
 */
class TemporalRelations {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Create or update a relationship with temporal metadata fields.
     * @param {string} fromNode - Source node name
     * @param {string} toNode - Target node name
     * @param {string} relationType - Cypher relationship type label
     * @param {object} [properties] - Additional properties; may include validFrom, validTo, confidence
     * @returns {Promise<{success?: boolean, relationship?: object, error?: string}>}
     */
    async createTemporalRelation(fromNode, toNode, relationType, properties = {}) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const temporalProps = {
            ...properties,
            createdAt: new Date().toISOString(),
            validFrom: properties.validFrom || new Date().toISOString(),
            validTo: properties.validTo || null,
            confidence: properties.confidence || 1.0
        };

        const query = `
            MATCH (a {name: $fromName}), (b {name: $toName})
            MERGE (a)-[r:${relationType}]->(b)
            SET r += $props
            RETURN r
        `;

        try {
            const result = await this.graphProvider.query(query, {
                fromName: fromNode,
                toName: toNode,
                props: temporalProps
            });
            return { success: result.ok, relationship: result.results?.[0] };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Get relationships valid at a specific point in time
     */
    async getRelationsAtTime(timestamp) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (a)-[r]->(b)
            WHERE (r.validFrom IS NULL OR r.validFrom <= $timestamp)
              AND (r.validTo IS NULL OR r.validTo >= $timestamp)
            RETURN a.name as from, type(r) as relation, b.name as to, r.createdAt as createdAt
            LIMIT 100
        `;

        try {
            const result = await this.graphProvider.query(query, { timestamp });
            return { relations: result.results || [] };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Get relationship timeline for an entity
     */
    async getEntityTimeline(entityName) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (e {name: $name})-[r]-(other)
            WHERE r.createdAt IS NOT NULL
            RETURN type(r) as relation, other.name as relatedTo, labels(other)[0] as relatedType,
                   r.createdAt as createdAt, r.validFrom as validFrom, r.validTo as validTo
            ORDER BY r.createdAt DESC
            LIMIT 50
        `;

        try {
            const result = await this.graphProvider.query(query, { name: entityName });
            return { timeline: result.results || [] };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Soft-expire a relationship by setting its validTo date. The relationship
     * is not deleted, preserving it for historical queries.
     * @param {string} fromNode - Source node name
     * @param {string} toNode - Target node name
     * @param {string} relationType - Cypher relationship type label
     * @param {string|null} [expireDate] - ISO date; defaults to now
     * @returns {Promise<{success?: boolean, error?: string}>}
     */
    async expireRelation(fromNode, toNode, relationType, expireDate = null) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (a {name: $fromName})-[r:${relationType}]->(b {name: $toName})
            SET r.validTo = $expireDate, r.expiredAt = datetime()
            RETURN r
        `;

        try {
            const result = await this.graphProvider.query(query, {
                fromName: fromNode,
                toName: toNode,
                expireDate: expireDate || new Date().toISOString()
            });
            return { success: result.ok };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Get relationship history between two entities
     */
    async getRelationshipHistory(entity1, entity2) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH (a {name: $name1})-[r]-(b {name: $name2})
            RETURN type(r) as relation, r.createdAt as createdAt, r.validFrom as validFrom, 
                   r.validTo as validTo, r.confidence as confidence
            ORDER BY r.createdAt
        `;

        try {
            const result = await this.graphProvider.query(query, { name1: entity1, name2: entity2 });
            return { history: result.results || [] };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Add temporal metadata to existing relationships
     */
    async enrichExistingRelations() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const query = `
            MATCH ()-[r]->()
            WHERE r.createdAt IS NULL
            SET r.createdAt = datetime(), r.validFrom = datetime()
            RETURN count(r) as updated
        `;

        try {
            const result = await this.graphProvider.query(query);
            return { updated: result.results?.[0]?.updated || 0 };
        } catch (e) {
            return { error: e.message };
        }
    }
}

// Singleton
let temporalRelationsInstance = null;
function getTemporalRelations(options = {}) {
    if (!temporalRelationsInstance) {
        temporalRelationsInstance = new TemporalRelations(options);
    }
    if (options.graphProvider) {
        temporalRelationsInstance.setGraphProvider(options.graphProvider);
    }
    return temporalRelationsInstance;
}

module.exports = { TemporalRelations, getTemporalRelations };
