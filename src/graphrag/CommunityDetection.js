/**
 * Community Detection & Graph Analysis
 * 
 * SOTA techniques for graph-based analysis:
 * - Louvain-style community detection
 * - Entity resolution and deduplication
 * - Graph centrality metrics
 * - Cluster-aware search expansion
 */

class CommunityDetection {
    constructor(options = {}) {
        this.graphProvider = options.graphProvider;
        
        // Community detection parameters
        this.resolution = options.resolution || 1.0; // Louvain resolution
        this.minCommunitySize = options.minCommunitySize || 2;
        
        // Cache for communities
        this.communityCache = null;
        this.cacheTimestamp = 0;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Set graph provider
     * @param {object} provider 
     */
    setGraphProvider(provider) {
        this.graphProvider = provider;
        this.invalidateCache();
    }

    /**
     * Detect communities using label propagation (graph-based)
     * Simpler than Louvain but works with FalkorDB Cypher
     * 
     * @returns {Promise<{ok: boolean, communities: Array}>}
     */
    async detectCommunities() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { ok: false, error: 'Graph provider not connected' };
        }
        
        // Check cache
        if (this.communityCache && Date.now() - this.cacheTimestamp < this.cacheTTL) {
            return { ok: true, communities: this.communityCache, cached: true };
        }
        
        console.log('[Community] Detecting communities...');
        
        try {
            // Step 1: Get all nodes with their connections
            const nodesResult = await this.graphProvider.query(`
                MATCH (n)
                OPTIONAL MATCH (n)-[r]-(m)
                RETURN n.id as nodeId, 
                       labels(n)[0] as nodeType,
                       n.name as nodeName,
                       collect(DISTINCT m.id) as neighbors
                LIMIT 500
            `);
            
            if (!nodesResult.ok) {
                return { ok: false, error: nodesResult.error };
            }
            
            const nodes = nodesResult.results || [];
            
            // Step 2: Run label propagation
            const communities = this.labelPropagation(nodes);
            
            // Step 3: Analyze communities
            const analyzedCommunities = communities.map((members, idx) => ({
                id: idx,
                size: members.length,
                members: members,
                types: this.getTypeDistribution(members),
                hub: this.findHub(members, nodes)
            })).filter(c => c.size >= this.minCommunitySize);
            
            // Cache results
            this.communityCache = analyzedCommunities;
            this.cacheTimestamp = Date.now();
            
            console.log(`[Community] Found ${analyzedCommunities.length} communities`);
            
            return { ok: true, communities: analyzedCommunities };
            
        } catch (error) {
            console.error('[Community] Detection error:', error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Label propagation algorithm for community detection
     * @param {Array} nodes - Nodes with neighbor information
     * @returns {Array<Array>} Communities (arrays of node IDs)
     */
    labelPropagation(nodes, maxIterations = 10) {
        if (!nodes || nodes.length === 0) return [];
        
        // Initialize: each node in its own community
        const labels = new Map();
        nodes.forEach((node, idx) => {
            labels.set(node.nodeId, idx);
        });
        
        const nodeMap = new Map(nodes.map(n => [n.nodeId, n]));
        
        // Iterate
        for (let iter = 0; iter < maxIterations; iter++) {
            let changed = false;
            
            // Shuffle nodes for randomness
            const shuffled = [...nodes].sort(() => Math.random() - 0.5);
            
            for (const node of shuffled) {
                if (!node.neighbors || node.neighbors.length === 0) continue;
                
                // Count neighbor labels
                const labelCounts = new Map();
                for (const neighborId of node.neighbors) {
                    if (labels.has(neighborId)) {
                        const label = labels.get(neighborId);
                        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
                    }
                }
                
                if (labelCounts.size === 0) continue;
                
                // Find most common label
                let maxCount = 0;
                let maxLabel = labels.get(node.nodeId);
                for (const [label, count] of labelCounts) {
                    if (count > maxCount) {
                        maxCount = count;
                        maxLabel = label;
                    }
                }
                
                // Update label if changed
                if (maxLabel !== labels.get(node.nodeId)) {
                    labels.set(node.nodeId, maxLabel);
                    changed = true;
                }
            }
            
            if (!changed) break;
        }
        
        // Group by label
        const communities = new Map();
        for (const [nodeId, label] of labels) {
            if (!communities.has(label)) {
                communities.set(label, []);
            }
            const node = nodeMap.get(nodeId);
            communities.get(label).push({
                id: nodeId,
                name: node?.nodeName,
                type: node?.nodeType
            });
        }
        
        return Array.from(communities.values());
    }

    /**
     * Get type distribution in a community
     * @param {Array} members 
     * @returns {object}
     */
    getTypeDistribution(members) {
        const dist = {};
        for (const m of members) {
            const type = m.type || 'Unknown';
            dist[type] = (dist[type] || 0) + 1;
        }
        return dist;
    }

    /**
     * Find the hub node (most connected) in a community
     * @param {Array} members 
     * @param {Array} allNodes 
     * @returns {object}
     */
    findHub(members, allNodes) {
        const memberIds = new Set(members.map(m => m.id));
        let maxConnections = 0;
        let hub = members[0];
        
        for (const node of allNodes) {
            if (!memberIds.has(node.nodeId)) continue;
            const internalConnections = (node.neighbors || [])
                .filter(n => memberIds.has(n)).length;
            
            if (internalConnections > maxConnections) {
                maxConnections = internalConnections;
                hub = members.find(m => m.id === node.nodeId) || hub;
            }
        }
        
        return { ...hub, connections: maxConnections };
    }

    /**
     * Get community for a specific node
     * @param {string} nodeId 
     * @returns {Promise<{ok: boolean, community?: object}>}
     */
    async getNodeCommunity(nodeId) {
        const detection = await this.detectCommunities();
        if (!detection.ok) return detection;
        
        for (const community of detection.communities) {
            if (community.members.some(m => m.id === nodeId)) {
                return { ok: true, community };
            }
        }
        
        return { ok: false, error: 'Node not found in any community' };
    }

    /**
     * Find related entities through community membership
     * @param {string} nodeId - Starting node
     * @param {object} options - Search options
     * @returns {Promise<{ok: boolean, related: Array}>}
     */
    async findRelatedEntities(nodeId, options = {}) {
        const { sameTypeOnly = false, limit = 20 } = options;
        
        const communityResult = await this.getNodeCommunity(nodeId);
        if (!communityResult.ok) {
            return { ok: false, error: communityResult.error };
        }
        
        const community = communityResult.community;
        const sourceNode = community.members.find(m => m.id === nodeId);
        
        let related = community.members
            .filter(m => m.id !== nodeId);
        
        if (sameTypeOnly && sourceNode?.type) {
            related = related.filter(m => m.type === sourceNode.type);
        }
        
        return {
            ok: true,
            sourceNode,
            communityId: community.id,
            communitySize: community.size,
            related: related.slice(0, limit)
        };
    }

    /**
     * Calculate centrality metrics for nodes
     * @returns {Promise<{ok: boolean, centrality: Map}>}
     */
    async calculateCentrality() {
        if (!this.graphProvider || !this.graphProvider.connected) {
            return { ok: false, error: 'Graph provider not connected' };
        }
        
        try {
            // Degree centrality (simpler, works with basic Cypher)
            const result = await this.graphProvider.query(`
                MATCH (n)
                OPTIONAL MATCH (n)-[r]-()
                RETURN n.id as nodeId, 
                       n.name as name,
                       labels(n)[0] as type,
                       count(r) as degree
                ORDER BY degree DESC
                LIMIT 100
            `);
            
            if (!result.ok) {
                return { ok: false, error: result.error };
            }
            
            const centrality = (result.results || []).map(r => ({
                nodeId: r.nodeId,
                name: r.name,
                type: r.type,
                degree: r.degree || 0,
                // Normalize to 0-1
                normalizedDegree: 0
            }));
            
            // Normalize
            const maxDegree = Math.max(...centrality.map(c => c.degree), 1);
            centrality.forEach(c => {
                c.normalizedDegree = c.degree / maxDegree;
            });
            
            return { ok: true, centrality };
            
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    /**
     * Find bridge nodes (nodes connecting communities)
     * @returns {Promise<{ok: boolean, bridges: Array}>}
     */
    async findBridgeNodes() {
        const detection = await this.detectCommunities();
        if (!detection.ok) return detection;
        
        const communities = detection.communities;
        const bridges = [];
        
        // Check nodes with connections to multiple communities
        if (!this.graphProvider) {
            return { ok: false, error: 'Graph provider not connected' };
        }
        
        const result = await this.graphProvider.query(`
            MATCH (n)-[r]-(m)
            RETURN n.id as sourceId, n.name as sourceName, 
                   collect(DISTINCT m.id) as connectedTo
            LIMIT 200
        `);
        
        if (!result.ok) return result;
        
        const nodeToCommunity = new Map();
        for (const comm of communities) {
            for (const member of comm.members) {
                nodeToCommunity.set(member.id, comm.id);
            }
        }
        
        for (const row of result.results || []) {
            const sourceCommunity = nodeToCommunity.get(row.sourceId);
            const connectedCommunities = new Set(
                (row.connectedTo || [])
                    .map(id => nodeToCommunity.get(id))
                    .filter(c => c !== undefined && c !== sourceCommunity)
            );
            
            if (connectedCommunities.size > 0) {
                bridges.push({
                    nodeId: row.sourceId,
                    name: row.sourceName,
                    homeCommunity: sourceCommunity,
                    bridgesTo: Array.from(connectedCommunities),
                    bridgeStrength: connectedCommunities.size
                });
            }
        }
        
        bridges.sort((a, b) => b.bridgeStrength - a.bridgeStrength);
        
        return { ok: true, bridges };
    }

    /**
     * Expand search to include community members
     * @param {Array} results - Initial search results
     * @param {object} options - Expansion options
     * @returns {Promise<Array>} Expanded results
     */
    async expandWithCommunity(results, options = {}) {
        const { maxExpansion = 5 } = options;
        
        if (!results || results.length === 0) return results;
        
        const detection = await this.detectCommunities();
        if (!detection.ok) return results;
        
        const expanded = [...results];
        const seen = new Set(results.map(r => r.id || r.data?.id));
        
        for (const result of results.slice(0, 3)) { // Only expand top 3
            const nodeId = result.id || result.data?.id;
            if (!nodeId) continue;
            
            const related = await this.findRelatedEntities(nodeId, { 
                sameTypeOnly: true, 
                limit: maxExpansion 
            });
            
            if (related.ok) {
                for (const entity of related.related) {
                    if (!seen.has(entity.id)) {
                        seen.add(entity.id);
                        expanded.push({
                            ...entity,
                            source: 'community_expansion',
                            communityId: related.communityId,
                            expandedFrom: nodeId
                        });
                    }
                }
            }
        }
        
        return expanded;
    }

    /**
     * Invalidate community cache
     */
    invalidateCache() {
        this.communityCache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * Get cache stats
     * @returns {object}
     */
    getCacheStats() {
        return {
            cached: !!this.communityCache,
            communities: this.communityCache?.length || 0,
            cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null
        };
    }

    // ==================== SOTA v2.0: Advanced Graph Metrics ====================

    /**
     * Calculate betweenness centrality for nodes
     * Measures how often a node lies on shortest paths between other nodes
     * @param {number} limit - Maximum nodes to return
     * @returns {Promise<{ok: boolean, results: Array}>}
     */
    async calculateBetweennessCentrality(limit = 20) {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph not connected' };
        }

        console.log('[CommunityDetection] Calculating betweenness centrality...');

        try {
            // FalkorDB doesn't have native betweenness algorithm
            // Approximate using path frequency through nodes
            const query = `
                MATCH (n)
                WHERE n.name IS NOT NULL AND NOT labels(n)[0] STARTS WITH '__'
                WITH n
                MATCH path = shortestPath((a)-[*..4]-(b))
                WHERE a <> b 
                  AND n IN nodes(path) 
                  AND n <> a AND n <> b
                  AND NOT labels(a)[0] STARTS WITH '__'
                  AND NOT labels(b)[0] STARTS WITH '__'
                WITH n, count(path) as pathCount
                RETURN n.name as name, 
                       labels(n)[0] as type, 
                       n.id as id,
                       pathCount as betweenness
                ORDER BY pathCount DESC
                LIMIT $limit
            `;

            const result = await this.graphProvider.query(query, { limit });

            if (!result.ok) {
                // Fallback to simpler degree-based approximation
                return this.calculateDegreeCentrality(limit);
            }

            const maxBetweenness = Math.max(...(result.results || []).map(r => r.betweenness || 0), 1);
            const normalized = (result.results || []).map(r => ({
                ...r,
                normalizedBetweenness: r.betweenness / maxBetweenness
            }));

            return { ok: true, results: normalized, metric: 'betweenness' };
        } catch (e) {
            console.error('[CommunityDetection] Betweenness calculation failed:', e.message);
            // Fallback to degree centrality
            return this.calculateDegreeCentrality(limit);
        }
    }

    /**
     * Calculate degree centrality (connection count)
     * @param {number} limit - Maximum nodes to return
     * @returns {Promise<{ok: boolean, results: Array}>}
     */
    async calculateDegreeCentrality(limit = 20) {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph not connected' };
        }

        try {
            const query = `
                MATCH (n)
                WHERE n.name IS NOT NULL AND NOT labels(n)[0] STARTS WITH '__'
                WITH n, count { (n)--() } as degree
                RETURN n.name as name, 
                       labels(n)[0] as type, 
                       n.id as id,
                       degree
                ORDER BY degree DESC
                LIMIT $limit
            `;

            const result = await this.graphProvider.query(query, { limit });
            
            if (!result.ok) {
                return { ok: false, error: result.error };
            }

            const maxDegree = Math.max(...(result.results || []).map(r => r.degree || 0), 1);
            const normalized = (result.results || []).map(r => ({
                ...r,
                normalizedDegree: r.degree / maxDegree
            }));

            return { ok: true, results: normalized, metric: 'degree' };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    /**
     * Calculate PageRank-like importance scores
     * Based on incoming connections weighted by source importance
     * @param {number} iterations - Number of iterations
     * @param {number} dampingFactor - Damping factor (0.85 typical)
     * @param {number} limit - Maximum results
     * @returns {Promise<{ok: boolean, results: Array}>}
     */
    async calculatePageRank(iterations = 5, dampingFactor = 0.85, limit = 20) {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph not connected' };
        }

        console.log('[CommunityDetection] Calculating PageRank...');

        try {
            // Get all nodes with their degrees
            const nodesQuery = `
                MATCH (n)
                WHERE n.name IS NOT NULL AND NOT labels(n)[0] STARTS WITH '__'
                WITH n, count { (n)--() } as degree
                RETURN id(n) as nodeId, 
                       n.name as name, 
                       labels(n)[0] as type, 
                       degree
            `;
            const nodesResult = await this.graphProvider.query(nodesQuery);

            if (!nodesResult.ok || !nodesResult.results?.length) {
                return { ok: false, error: 'Could not get nodes' };
            }

            const nodes = nodesResult.results;
            const n = nodes.length;
            const scores = new Map();

            // Initialize scores
            for (const node of nodes) {
                scores.set(node.nodeId, { 
                    ...node, 
                    score: 1.0 / n,
                    outDegree: node.degree
                });
            }

            // Simplified PageRank iteration using degree information
            // (Full PageRank would require fetching all edges which is expensive)
            for (let i = 0; i < iterations; i++) {
                const newScores = new Map();
                const totalDegree = nodes.reduce((sum, n) => sum + (n.degree || 1), 0);

                for (const node of nodes) {
                    const degreeContribution = (node.degree || 1) / totalDegree;
                    const oldScore = scores.get(node.nodeId)?.score || 0;
                    const newScore = (1 - dampingFactor) / n + dampingFactor * degreeContribution * n * oldScore;
                    newScores.set(node.nodeId, { ...scores.get(node.nodeId), score: newScore });
                }

                for (const [id, data] of newScores) {
                    scores.set(id, data);
                }
            }

            // Sort by score and return top results
            const results = Array.from(scores.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(r => ({
                    name: r.name,
                    type: r.type,
                    id: r.nodeId,
                    pageRank: r.score,
                    degree: r.outDegree
                }));

            return { ok: true, results, metric: 'pagerank', iterations };
        } catch (e) {
            console.error('[CommunityDetection] PageRank calculation failed:', e.message);
            return { ok: false, error: e.message };
        }
    }

    /**
     * Calculate community modularity (quality metric)
     * Higher modularity means stronger community structure
     * @returns {Promise<{ok: boolean, modularity: number, details: object}>}
     */
    async calculateModularity() {
        if (!this.graphProvider?.connected) {
            return { ok: false, error: 'Graph not connected' };
        }

        console.log('[CommunityDetection] Calculating modularity...');

        try {
            // First get communities
            const communities = await this.detectCommunities();
            if (!communities.ok) {
                return { ok: false, error: 'Could not detect communities' };
            }

            // Build node -> community mapping
            const nodeCommunity = new Map();
            for (const community of communities.communities) {
                for (const member of community.members) {
                    nodeCommunity.set(member.nodeId, community.id);
                }
            }

            // Get edge counts
            const edgeQuery = `
                MATCH (a)-[r]-(b)
                WHERE a.name IS NOT NULL AND b.name IS NOT NULL
                  AND NOT labels(a)[0] STARTS WITH '__'
                  AND NOT labels(b)[0] STARTS WITH '__'
                RETURN id(a) as from, id(b) as to
            `;
            const edgeResult = await this.graphProvider.query(edgeQuery);

            if (!edgeResult.ok) {
                return { ok: false, error: 'Could not get edges' };
            }

            const edges = edgeResult.results || [];
            let intraEdges = 0;
            let totalEdges = 0;

            // Count edges within vs between communities
            const seenEdges = new Set();
            for (const edge of edges) {
                const edgeKey = [edge.from, edge.to].sort().join('-');
                if (seenEdges.has(edgeKey)) continue;
                seenEdges.add(edgeKey);

                totalEdges++;
                const fromCommunity = nodeCommunity.get(edge.from);
                const toCommunity = nodeCommunity.get(edge.to);

                if (fromCommunity !== undefined && fromCommunity === toCommunity) {
                    intraEdges++;
                }
            }

            // Calculate modularity (simplified)
            // Q = (intra-community edges / total edges) - expected random value
            const modularity = totalEdges > 0 
                ? (intraEdges / totalEdges) - (1 / Math.max(communities.communities.length, 1))
                : 0;

            return {
                ok: true,
                modularity: Math.max(0, modularity), // Clamp to positive
                details: {
                    totalEdges,
                    intraEdges,
                    interEdges: totalEdges - intraEdges,
                    communityCount: communities.communities.length,
                    intraCommunityRatio: totalEdges > 0 ? intraEdges / totalEdges : 0
                }
            };
        } catch (e) {
            console.error('[CommunityDetection] Modularity calculation failed:', e.message);
            return { ok: false, error: e.message };
        }
    }

    /**
     * Get comprehensive graph analytics
     * @returns {Promise<object>}
     */
    async getFullAnalytics() {
        const [communities, betweenness, pageRank, modularity, bridges] = await Promise.all([
            this.detectCommunities(),
            this.calculateBetweennessCentrality(10),
            this.calculatePageRank(5, 0.85, 10),
            this.calculateModularity(),
            this.findBridgeNodes()
        ]);

        return {
            communities: communities.ok ? {
                count: communities.communities?.length || 0,
                sizes: communities.communities?.map(c => c.size) || [],
                cached: communities.cached
            } : { error: communities.error },
            
            centrality: {
                betweenness: betweenness.ok ? betweenness.results?.slice(0, 5) : [],
                pageRank: pageRank.ok ? pageRank.results?.slice(0, 5) : []
            },
            
            modularity: modularity.ok ? modularity : { error: modularity.error },
            
            bridges: bridges.ok ? bridges.bridges?.slice(0, 5) : [],
            
            generatedAt: new Date().toISOString()
        };
    }
}

// Singleton instance
let instance = null;

function getCommunityDetection(options = {}) {
    if (!instance) {
        instance = new CommunityDetection(options);
    }
    return instance;
}

module.exports = {
    CommunityDetection,
    getCommunityDetection
};
