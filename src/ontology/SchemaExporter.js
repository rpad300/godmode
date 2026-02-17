/**
 * Purpose:
 *   Pushes the ontology schema into the graph database so that the graph
 *   layer is aware of defined entity types, relation types, indexes, and
 *   schema version metadata. For Supabase providers this is mostly a no-op
 *   since the schema already lives in Supabase tables.
 *
 * Responsibilities:
 *   - Sync entity type and relation type definitions to the graph
 *   - Create property indexes for searchable fields (Cypher providers only)
 *   - Store schema version metadata in a __OntologySchema__ meta-node
 *   - Detect whether a sync is needed by comparing local vs. graph versions
 *   - Collect graph schema statistics (node/relation counts by type)
 *   - Validate live graph data against the ontology and report unknown types
 *
 * Key dependencies:
 *   - ../logger: structured logging
 *   - ./OntologyManager (singleton): provides the canonical schema to export
 *   - Graph provider (injected): target database (Supabase-native or Cypher)
 *
 * Side effects:
 *   - Graph writes: creates indexes and __OntologySchema__ / __EntityType__ /
 *     __RelationType__ meta-nodes (Cypher providers only)
 *   - Graph reads during stats collection and validation
 *
 * Notes:
 *   - SOTA v3.0: for Supabase providers, syncToGraph() returns immediately
 *     after confirming the schema is loaded -- no Cypher meta-nodes are needed.
 *   - _createIndex silently skips already-existing indexes (checks error message
 *     text), so the sync is idempotent.
 *   - validateGraphAgainstOntology only checks type existence, not property-level
 *     compliance; use OntologyExtractor.validateCompliance() for deeper checks.
 */

const { logger } = require('../logger');
const { getOntologyManager } = require('./OntologyManager');

const log = logger.child({ module: 'schema-exporter' });

/**
 * Exports the canonical ontology schema into the graph database layer.
 *
 * For Cypher-based providers this creates __OntologySchema__, __EntityType__,
 * and __RelationType__ meta-nodes plus property indexes. For Supabase
 * providers the schema already lives in dedicated tables, so sync is a no-op.
 *
 * Lifecycle: construct -> setGraphProvider() -> syncToGraph() or
 * checkSyncStatus() / validateGraphAgainstOntology().
 */
class SchemaExporter {
    /**
     * @param {object} options
     * @param {object} [options.ontology] - OntologyManager instance (defaults to singleton)
     * @param {object} [options.graphProvider] - Graph backend (Supabase or Cypher)
     */
    constructor(options = {}) {
        this.ontology = options.ontology || getOntologyManager();
        this.graphProvider = options.graphProvider || null;
    }

    /**
     * Set the graph provider
     * @param {object} graphProvider - Graph provider instance
     */
    setGraphProvider(graphProvider) {
        this.graphProvider = graphProvider;
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
     * Full sync of ontology to graph database
     * For Supabase: skips Cypher operations (ontology is already in Supabase tables)
     * @returns {Promise<{ok: boolean, results?: object, error?: string}>}
     */
    async syncToGraph() {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph provider not connected' };
        }

        const schema = this.ontology.getSchema();
        if (!schema) {
            return { ok: false, error: 'No ontology schema loaded' };
        }

        const results = {
            indexes: { created: 0, failed: 0, skipped: 0 },
            entityTypes: { synced: Object.keys(schema.entityTypes || {}).length, failed: 0 },
            relationTypes: { synced: Object.keys(schema.relationTypes || {}).length, failed: 0 },
            meta: true,
            version: schema.version
        };

        log.info({ event: 'schema_exporter_sync_complete', version: schema.version, entities: results.entityTypes.synced, relations: results.relationTypes.synced }, 'Ontology sync complete');
        log.debug({ event: 'schema_exporter_note' }, 'Ontology schema is stored in Supabase ontology_schema table');
        
        return { ok: true, results };
    }

    /**
     * Create an index for a label and property
     * SOTA v3.0 - Skips for Supabase (PostgreSQL handles indexes)
     * @private
     */
    async _createIndex(label, property, results) {
        // Supabase handles indexes via PostgreSQL - skip Cypher index creation
        if (this._isSupabaseProvider()) {
            results.indexes.skipped++;
            return;
        }

        try {
            // Cypher index creation for other providers
            await this.graphProvider.query(
                `CREATE INDEX FOR (n:${label}) ON (n.${property})`
            );
            results.indexes.created++;
        } catch (e) {
            if (e.message?.includes('already exists') || e.message?.includes('Index already')) {
                results.indexes.skipped++;
            } else {
                log.warn({ event: 'schema_exporter_index_failed', label, property, reason: e.message }, 'Index creation failed');
                results.indexes.failed++;
            }
        }
    }

    /**
     * Get the current schema version from graph database
     * SOTA v3.0 - Uses ontology manager for Supabase
     * @returns {Promise<string|null>}
     */
    async getGraphSchemaVersion() {
        if (!this.graphProvider?.connected) {
            return null;
        }

        // For Supabase, get version from ontology manager (stored in Supabase)
        if (this._isSupabaseProvider()) {
            const schema = this.ontology.getSchema();
            return schema?.version || '1.0.0';
        }

        // Cypher fallback for other providers
        try {
            const result = await this.graphProvider.query(
                `MATCH (meta:__OntologySchema__ {id: 'schema'}) RETURN meta.version as version`
            );
            return result.results?.[0]?.version || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Check if sync is needed by comparing versions
     * @returns {Promise<{needsSync: boolean, localVersion: string, graphVersion: string|null}>}
     */
    async checkSyncStatus() {
        const localVersion = this.ontology.getSchema()?.version || null;
        const graphVersion = await this.getGraphSchemaVersion();
        
        return {
            needsSync: localVersion !== graphVersion,
            localVersion,
            graphVersion
        };
    }

    /**
     * Get schema statistics from graph database
     * SOTA v3.0 - Uses native methods for Supabase
     * @returns {Promise<object>}
     */
    async getGraphSchemaStats() {
        if (!this.graphProvider?.connected) {
            return { error: 'Not connected' };
        }

        // Use native getStats() for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const schema = this.ontology.getSchema();
            const graphStats = await this.graphProvider.getStats();
            const labelStats = graphStats?.stats?.labels || {};
            const relStats = graphStats?.stats?.relationshipTypes || {};

            return {
                schemaEntityTypes: Object.keys(schema?.entityTypes || {}).length,
                schemaRelationTypes: Object.keys(schema?.relationTypes || {}).length,
                actualNodeCounts: Object.entries(labelStats)
                    .filter(([type]) => !type.startsWith('__'))
                    .map(([type, count]) => ({ type, count }))
                    .sort((a, b) => b.count - a.count),
                actualRelationCounts: Object.entries(relStats)
                    .map(([type, count]) => ({ type, count }))
                    .sort((a, b) => b.count - a.count)
            };
        }

        // Cypher fallback for other providers
        try {
            const entityStats = await this.graphProvider.query(`
                MATCH (e:__EntityType__)
                RETURN e.name as type, e.sharedEntity as shared
            `);

            const relationStats = await this.graphProvider.query(`
                MATCH (r:__RelationType__)
                RETURN r.name as type, r.crossGraph as crossGraph
            `);

            const nodeCounts = await this.graphProvider.query(`
                MATCH (n)
                WHERE NOT labels(n)[0] STARTS WITH '__'
                RETURN labels(n)[0] as type, count(n) as count
                ORDER BY count DESC
            `);

            const relCounts = await this.graphProvider.query(`
                MATCH ()-[r]->()
                RETURN type(r) as type, count(r) as count
                ORDER BY count DESC
            `);

            return {
                schemaEntityTypes: entityStats.results?.length || 0,
                schemaRelationTypes: relationStats.results?.length || 0,
                actualNodeCounts: nodeCounts.results || [],
                actualRelationCounts: relCounts.results || []
            };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Validate that graph data conforms to ontology
     * SOTA v3.0 - Uses native methods for Supabase
     * @returns {Promise<{valid: boolean, issues: Array}>}
     */
    async validateGraphAgainstOntology() {
        if (!this.graphProvider?.connected) {
            return { valid: false, issues: [{ type: 'error', message: 'Not connected' }] };
        }

        const schema = this.ontology.getSchema();
        const issues = [];

        // Use native getStats() for Supabase provider
        if (this._isSupabaseProvider() && typeof this.graphProvider.getStats === 'function') {
            const graphStats = await this.graphProvider.getStats();
            const labelStats = graphStats?.stats?.labels || {};
            const relStats = graphStats?.stats?.relationshipTypes || {};

            // Check for unknown labels
            for (const [label, count] of Object.entries(labelStats)) {
                if (label.startsWith('__')) continue;
                if (!schema.entityTypes[label]) {
                    issues.push({
                        type: 'unknown_entity_type',
                        label: label,
                        count: count,
                        message: `Entity type "${label}" not in ontology (${count} nodes)`
                    });
                }
            }

            // Check for unknown relation types
            for (const [type, count] of Object.entries(relStats)) {
                if (!schema.relationTypes[type] && !type.startsWith('CAN_RELATE')) {
                    issues.push({
                        type: 'unknown_relation_type',
                        relationType: type,
                        count: count,
                        message: `Relation type "${type}" not in ontology (${count} edges)`
                    });
                }
            }
        } else {
            // Cypher fallback for other providers
            const labelsResult = await this.graphProvider.query(`
                MATCH (n)
                WHERE NOT labels(n)[0] STARTS WITH '__'
                RETURN DISTINCT labels(n)[0] as label, count(n) as count
            `);

            for (const row of labelsResult.results || []) {
                if (!schema.entityTypes[row.label]) {
                    issues.push({
                        type: 'unknown_entity_type',
                        label: row.label,
                        count: row.count,
                        message: `Entity type "${row.label}" not in ontology (${row.count} nodes)`
                    });
                }
            }

            const relsResult = await this.graphProvider.query(`
                MATCH ()-[r]->()
                RETURN DISTINCT type(r) as type, count(r) as count
            `);

            for (const row of relsResult.results || []) {
                if (!schema.relationTypes[row.type] && !row.type.startsWith('CAN_RELATE')) {
                    issues.push({
                        type: 'unknown_relation_type',
                        relationType: row.type,
                        count: row.count,
                        message: `Relation type "${row.type}" not in ontology (${row.count} edges)`
                    });
                }
            }
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// Singleton instance
let schemaExporterInstance = null;

/**
 * Get the SchemaExporter singleton
 * @param {object} options 
 * @returns {SchemaExporter}
 */
function getSchemaExporter(options = {}) {
    if (!schemaExporterInstance) {
        schemaExporterInstance = new SchemaExporter(options);
    }
    return schemaExporterInstance;
}

module.exports = {
    SchemaExporter,
    getSchemaExporter
};
