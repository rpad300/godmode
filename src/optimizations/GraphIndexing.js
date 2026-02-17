/**
 * Purpose:
 *   Create and manage graph database indexes to accelerate Cypher query
 *   performance on commonly filtered/sorted properties.
 *
 * Responsibilities:
 *   - Provision a predefined set of indexes on key label/property pairs
 *     (Person.name, Meeting.date, etc.)
 *   - Create, drop, and list individual indexes via Cypher DDL
 *   - Create full-text indexes for free-text search
 *   - Statically analyze Cypher queries and suggest missing indexes
 *   - Track which indexes have been created in-process (createdIndexes Set)
 *
 * Key dependencies:
 *   - graphProvider (injected): Cypher DDL execution
 *
 * Side effects:
 *   - Creates and drops indexes in the graph database (schema mutations)
 *
 * Notes:
 *   - Index syntax varies between graph database engines; creation failures
 *     are caught and reported rather than thrown.
 *   - "already exists" errors are treated as success to make
 *     createDefaultIndexes idempotent.
 *   - analyzeQueryForIndexes is a heuristic regex parser, not a full
 *     Cypher AST analyzer.
 */

/**
 * Creates and manages graph database indexes for query acceleration.
 *
 * @param {object} options
 * @param {object} options.graphProvider - Graph database adapter
 */
class GraphIndexing {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        
        // Default indexes to create
        this.defaultIndexes = [
            { label: 'Person', property: 'name' },
            { label: 'Person', property: 'email' },
            { label: 'Project', property: 'name' },
            { label: 'Meeting', property: 'title' },
            { label: 'Meeting', property: 'date' },
            { label: 'Document', property: 'title' },
            { label: 'Technology', property: 'name' },
            { label: 'Organization', property: 'name' },
            { label: 'Decision', property: 'date' },
            { label: 'Task', property: 'status' }
        ];

        // Track created indexes
        this.createdIndexes = new Set();
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Create default indexes
     */
    async createDefaultIndexes() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const results = [];
        
        for (const idx of this.defaultIndexes) {
            const result = await this.createIndex(idx.label, idx.property);
            results.push({ ...idx, ...result });
        }

        return {
            created: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            details: results
        };
    }

    /**
     * Create a single index
     */
    async createIndex(label, property) {
        const indexKey = `${label}:${property}`;
        
        if (this.createdIndexes.has(indexKey)) {
            return { success: true, status: 'already_exists' };
        }

        try {
            // Some graph providers use different syntax
            // Try the CREATE INDEX syntax
            const query = `CREATE INDEX FOR (n:${label}) ON (n.${property})`;
            
            const result = await this.graphProvider.query(query);
            
            if (result.ok) {
                this.createdIndexes.add(indexKey);
                return { success: true, status: 'created' };
            }
            
            // Index might already exist
            if (result.error?.includes('already exists') || result.error?.includes('Index')) {
                this.createdIndexes.add(indexKey);
                return { success: true, status: 'already_exists' };
            }

            return { success: false, error: result.error };
        } catch (e) {
            // Some graph DBs don't support explicit index creation
            return { success: false, error: e.message };
        }
    }

    /**
     * Drop an index
     */
    async dropIndex(label, property) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        try {
            const query = `DROP INDEX ON :${label}(${property})`;
            const result = await this.graphProvider.query(query);
            
            const indexKey = `${label}:${property}`;
            this.createdIndexes.delete(indexKey);
            
            return { success: result.ok };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * List all indexes
     */
    async listIndexes() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        try {
            // Try different query syntaxes for different graph DBs
            let result = await this.graphProvider.query('CALL db.indexes()');
            
            if (!result.ok) {
                // Try alternative
                result = await this.graphProvider.query('SHOW INDEXES');
            }

            return {
                success: result.ok,
                indexes: result.results || [],
                tracked: Array.from(this.createdIndexes)
            };
        } catch (e) {
            return { 
                success: false, 
                error: e.message,
                tracked: Array.from(this.createdIndexes)
            };
        }
    }

    /**
     * Statically analyze a Cypher query string and suggest indexes for
     * properties used in WHERE, ORDER BY, and MATCH patterns.
     * @param {string} query - Cypher query to analyze
     * @returns {Array<{property: string, reason: string, query: string}>}
     */
    analyzeQueryForIndexes(query) {
        const suggestions = [];
        const queryLower = query.toLowerCase();

        // Find WHERE clauses with property comparisons
        const whereMatches = query.matchAll(/WHERE\s+(\w+)\.(\w+)\s*[=<>!]/gi);
        for (const match of whereMatches) {
            suggestions.push({
                property: match[2],
                reason: 'Used in WHERE clause',
                query: `CREATE INDEX ON :Node(${match[2]})`
            });
        }

        // Find ORDER BY clauses
        const orderMatches = query.matchAll(/ORDER BY\s+(\w+)\.(\w+)/gi);
        for (const match of orderMatches) {
            suggestions.push({
                property: match[2],
                reason: 'Used in ORDER BY clause',
                query: `CREATE INDEX ON :Node(${match[2]})`
            });
        }

        // Find MATCH with property patterns
        const matchPropMatches = query.matchAll(/MATCH\s*\([^)]*\{(\w+):/gi);
        for (const match of matchPropMatches) {
            suggestions.push({
                property: match[1],
                reason: 'Used in MATCH pattern',
                query: `CREATE INDEX ON :Node(${match[1]})`
            });
        }

        return [...new Map(suggestions.map(s => [s.property, s])).values()];
    }

    /**
     * Create full-text index for search
     */
    async createFullTextIndex(label, properties) {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        try {
            const propsStr = properties.join(', n.');
            const indexName = `fulltext_${label.toLowerCase()}`;
            
            const query = `CALL db.idx.fulltext.createNodeIndex('${indexName}', ['${label}'], ['${properties.join("', '")}'])`;
            
            const result = await this.graphProvider.query(query);
            return { success: result.ok, indexName };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Get index statistics
     */
    async getIndexStats() {
        const indexes = await this.listIndexes();
        
        return {
            totalIndexes: indexes.indexes?.length || this.createdIndexes.size,
            trackedIndexes: Array.from(this.createdIndexes),
            defaultIndexCount: this.defaultIndexes.length
        };
    }
}

// Singleton
let graphIndexingInstance = null;
function getGraphIndexing(options = {}) {
    if (!graphIndexingInstance) {
        graphIndexingInstance = new GraphIndexing(options);
    }
    if (options.graphProvider) {
        graphIndexingInstance.setGraphProvider(options.graphProvider);
    }
    return graphIndexingInstance;
}

module.exports = { GraphIndexing, getGraphIndexing };
