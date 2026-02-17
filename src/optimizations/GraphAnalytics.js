/**
 * Purpose:
 *   Compute and surface analytical insights from the knowledge graph,
 *   including centrality, clustering, key people, and density metrics.
 *
 * Responsibilities:
 *   - Produce a comprehensive analytics snapshot (getAnalytics) by
 *     running multiple parallel Cypher queries
 *   - Identify most-connected (central) nodes via degree count
 *   - Detect clusters by organization and by project membership
 *   - Rank key people by connection count, decisions made, and meeting
 *     attendance
 *   - Report entity-type and relationship-type distributions
 *   - Find bridge nodes that connect distinct organizations
 *   - Generate human-readable insight summaries
 *
 * Key dependencies:
 *   - graphProvider (injected): Cypher queries against the knowledge graph
 *
 * Side effects:
 *   - Executes multiple read-only Cypher queries; no graph mutations
 *
 * Notes:
 *   - Centrality is approximated by raw degree count, not a full
 *     betweenness or PageRank algorithm.
 *   - Bridge-node detection depends on WORKS_AT and WORKS_ON relationship
 *     types existing in the graph.
 */

/**
 * Computes analytical metrics over the knowledge graph (centrality,
 * clusters, key people, distributions, bridge nodes, insights).
 *
 * @param {object} options
 * @param {object} options.graphProvider - Graph database adapter
 */
class GraphAnalytics {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
    }

    setGraphProvider(provider) {
        this.graphProvider = provider;
    }

    /**
     * Run all analytics queries in parallel and return a combined snapshot.
     * @returns {Promise<{overview: object, centralNodes: Array, clusters: object, keyPeople: object, entityDistribution: Array, relationshipTypes: Array, recentActivity: object, generatedAt: string}>}
     */
    async getAnalytics() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { error: 'Graph not connected' };
        }

        const [
            overview,
            centralNodes,
            clusters,
            keyPeople,
            entityDistribution,
            relationshipTypes,
            recentActivity
        ] = await Promise.all([
            this.getOverview(),
            this.getCentralNodes(),
            this.getClusters(),
            this.getKeyPeople(),
            this.getEntityDistribution(),
            this.getRelationshipTypes(),
            this.getRecentActivity()
        ]);

        return {
            overview,
            centralNodes,
            clusters,
            keyPeople,
            entityDistribution,
            relationshipTypes,
            recentActivity,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Graph overview stats
     */
    async getOverview() {
        try {
            const nodeCount = await this.graphProvider.query('MATCH (n) RETURN count(n) as count');
            const edgeCount = await this.graphProvider.query('MATCH ()-[r]->() RETURN count(r) as count');
            const labelCounts = await this.graphProvider.query('MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC');

            return {
                totalNodes: nodeCount.results?.[0]?.count || 0,
                totalEdges: edgeCount.results?.[0]?.count || 0,
                nodesByLabel: labelCounts.results || []
            };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Find most connected/central nodes
     */
    async getCentralNodes(limit = 10) {
        try {
            const result = await this.graphProvider.query(`
                MATCH (n)-[r]-()
                WITH n, count(r) as connections
                RETURN n.name as name, labels(n)[0] as type, connections
                ORDER BY connections DESC
                LIMIT ${limit}
            `);
            return result.results || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Detect clusters/communities
     */
    async getClusters() {
        try {
            // Find connected components via organization/project
            const byOrg = await this.graphProvider.query(`
                MATCH (p:Person)
                WHERE p.organization IS NOT NULL
                RETURN p.organization as cluster, collect(p.name) as members, count(p) as size
                ORDER BY size DESC
                LIMIT 10
            `);

            const byProject = await this.graphProvider.query(`
                MATCH (p:Person)-[:WORKS_ON]->(proj:Project)
                RETURN proj.name as cluster, collect(p.name) as members, count(p) as size
                ORDER BY size DESC
                LIMIT 10
            `);

            return {
                byOrganization: byOrg.results || [],
                byProject: byProject.results || []
            };
        } catch (e) {
            return { byOrganization: [], byProject: [] };
        }
    }

    /**
     * Identify key people (most connections, decisions, etc.)
     */
    async getKeyPeople(limit = 10) {
        try {
            // People with most connections
            const connected = await this.graphProvider.query(`
                MATCH (p:Person)-[r]-()
                WITH p, count(r) as connections
                RETURN p.name as name, p.role as role, p.organization as org, connections
                ORDER BY connections DESC
                LIMIT ${limit}
            `);

            // People who made decisions
            const decisionMakers = await this.graphProvider.query(`
                MATCH (p:Person)-[:MADE]->(d:Decision)
                RETURN p.name as name, count(d) as decisions
                ORDER BY decisions DESC
                LIMIT ${limit}
            `);

            // People in most meetings
            const meetingAttendees = await this.graphProvider.query(`
                MATCH (p:Person)-[:ATTENDS]->(m:Meeting)
                RETURN p.name as name, count(m) as meetings
                ORDER BY meetings DESC
                LIMIT ${limit}
            `);

            return {
                mostConnected: connected.results || [],
                topDecisionMakers: decisionMakers.results || [],
                frequentMeetingAttendees: meetingAttendees.results || []
            };
        } catch (e) {
            return { mostConnected: [], topDecisionMakers: [], frequentMeetingAttendees: [] };
        }
    }

    /**
     * Entity distribution by type
     */
    async getEntityDistribution() {
        try {
            const result = await this.graphProvider.query(`
                MATCH (n)
                RETURN labels(n)[0] as type, count(n) as count
                ORDER BY count DESC
            `);
            return result.results || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Relationship type distribution
     */
    async getRelationshipTypes() {
        try {
            const result = await this.graphProvider.query(`
                MATCH ()-[r]->()
                RETURN type(r) as relationship, count(r) as count
                ORDER BY count DESC
            `);
            return result.results || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Recent activity (nodes/edges added recently)
     */
    async getRecentActivity() {
        try {
            const recentNodes = await this.graphProvider.query(`
                MATCH (n)
                WHERE n.createdAt IS NOT NULL
                RETURN n.name as name, labels(n)[0] as type, n.createdAt as createdAt
                ORDER BY n.createdAt DESC
                LIMIT 20
            `);

            return {
                recentNodes: recentNodes.results || []
            };
        } catch (e) {
            return { recentNodes: [] };
        }
    }

    /**
     * Find bridge nodes (connect different clusters)
     */
    async getBridgeNodes(limit = 10) {
        try {
            const result = await this.graphProvider.query(`
                MATCH (p:Person)-[:WORKS_AT]->(o1:Organization)
                MATCH (p)-[:WORKS_ON]->(proj:Project)
                MATCH (p2:Person)-[:WORKS_ON]->(proj)
                WHERE p <> p2
                MATCH (p2)-[:WORKS_AT]->(o2:Organization)
                WHERE o1 <> o2
                RETURN p.name as bridge, o1.name as org1, o2.name as org2, count(DISTINCT p2) as connects
                ORDER BY connects DESC
                LIMIT ${limit}
            `);
            return result.results || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Get insights about the graph
     */
    async getInsights() {
        const analytics = await this.getAnalytics();
        const insights = [];

        // Key person insight
        if (analytics.keyPeople?.mostConnected?.length > 0) {
            const top = analytics.keyPeople.mostConnected[0];
            insights.push({
                type: 'key_person',
                title: 'Most Connected Person',
                description: `${top.name} has ${top.connections} connections, making them a central figure in the knowledge graph.`,
                importance: 'high'
            });
        }

        // Cluster insight
        if (analytics.clusters?.byOrganization?.length > 1) {
            const orgs = analytics.clusters.byOrganization;
            insights.push({
                type: 'organizations',
                title: 'Organization Distribution',
                description: `${orgs.length} organizations identified. Largest: ${orgs[0].cluster} with ${orgs[0].size} members.`,
                importance: 'medium'
            });
        }

        // Graph density
        if (analytics.overview?.totalNodes > 0) {
            const density = analytics.overview.totalEdges / analytics.overview.totalNodes;
            insights.push({
                type: 'density',
                title: 'Graph Connectivity',
                description: `Average ${density.toFixed(1)} relationships per entity. ${density > 2 ? 'Well connected.' : 'Consider adding more relationships.'}`,
                importance: density > 2 ? 'low' : 'medium'
            });
        }

        return insights;
    }
}

// Singleton
let graphAnalyticsInstance = null;
function getGraphAnalytics(options = {}) {
    if (!graphAnalyticsInstance) {
        graphAnalyticsInstance = new GraphAnalytics(options);
    }
    if (options.graphProvider) {
        graphAnalyticsInstance.setGraphProvider(options.graphProvider);
    }
    return graphAnalyticsInstance;
}

module.exports = { GraphAnalytics, getGraphAnalytics };
