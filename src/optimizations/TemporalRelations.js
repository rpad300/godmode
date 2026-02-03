/**
 * Temporal Relations Module
 * Adds timestamps to relationships and enables time-based queries
 */

class TemporalRelations {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Create a relationship with temporal metadata
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
     * Expire a relationship (set validTo)
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
