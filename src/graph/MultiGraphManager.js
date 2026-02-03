/**
 * MultiGraphManager - Manages multiple graphs for multi-project architecture
 * 
 * Architecture:
 * - One shared graph (_shared) for common entities: Person, Technology, Client, Organization
 * - One graph per project (project_{id}) for project-specific data: Facts, Meetings, Decisions, etc.
 * 
 * This allows:
 * - No duplication of people across projects
 * - Easy cross-project queries ("In which projects is João?")
 * - Project isolation for sensitive data
 */

class MultiGraphManager {
    constructor(provider) {
        this.provider = provider;
        this.sharedGraphName = '_shared';
        this.currentProjectId = null;
        this.graphCache = new Map(); // Cache graph references
        
        // Entity types that go in the shared graph
        this.sharedEntityTypes = ['Person', 'Technology', 'Client', 'Organization'];
        
        // Entity types that go in project-specific graphs
        this.projectEntityTypes = ['Fact', 'Meeting', 'Decision', 'Risk', 'Task', 'Document', 'Project'];
    }

    /**
     * Initialize the manager with a project context
     * @param {string} projectId - Current project ID
     */
    async initialize(projectId) {
        this.currentProjectId = projectId;
        
        // Ensure shared graph exists
        await this.provider.switchGraph(this.sharedGraphName);
        
        // Switch to project graph
        if (projectId) {
            await this.provider.switchGraph(this.getProjectGraphName(projectId));
        }
        
        return { ok: true };
    }

    /**
     * Get the graph name for a project
     * @param {string} projectId 
     * @returns {string}
     */
    getProjectGraphName(projectId) {
        return `project_${projectId}`;
    }

    /**
     * Determine which graph should store an entity type
     * @param {string} entityType - The entity type (Person, Fact, etc.)
     * @returns {string} Graph name ('_shared' or 'project_{id}')
     */
    getGraphForEntityType(entityType) {
        if (this.sharedEntityTypes.includes(entityType)) {
            return this.sharedGraphName;
        }
        return this.getProjectGraphName(this.currentProjectId);
    }

    /**
     * Check if an entity type is shared across projects
     * @param {string} entityType 
     * @returns {boolean}
     */
    isSharedEntity(entityType) {
        return this.sharedEntityTypes.includes(entityType);
    }

    /**
     * Create a node in the appropriate graph
     * @param {string} label - Node label (entity type)
     * @param {object} properties - Node properties
     * @param {string} projectId - Optional project ID override
     * @returns {Promise<object>}
     */
    async createNode(label, properties, projectId = null) {
        const targetGraph = this.isSharedEntity(label) 
            ? this.sharedGraphName 
            : this.getProjectGraphName(projectId || this.currentProjectId);
        
        await this.provider.switchGraph(targetGraph);
        
        // Add project reference for shared entities
        if (this.isSharedEntity(label) && (projectId || this.currentProjectId)) {
            properties.projects = properties.projects || [];
            const pid = projectId || this.currentProjectId;
            if (!properties.projects.includes(pid)) {
                properties.projects.push(pid);
            }
        }
        
        return this.provider.createNode(label, properties);
    }

    /**
     * Create multiple nodes in batch, routing to correct graphs
     * @param {string} label - Node label
     * @param {Array<object>} nodesData - Array of node properties
     * @param {string} projectId - Optional project ID override
     * @returns {Promise<object>}
     */
    async createNodesBatch(label, nodesData, projectId = null) {
        const targetGraph = this.isSharedEntity(label) 
            ? this.sharedGraphName 
            : this.getProjectGraphName(projectId || this.currentProjectId);
        
        await this.provider.switchGraph(targetGraph);
        
        // Add project references for shared entities
        if (this.isSharedEntity(label) && (projectId || this.currentProjectId)) {
            const pid = projectId || this.currentProjectId;
            nodesData = nodesData.map(props => ({
                ...props,
                projects: [...(props.projects || []), pid].filter((v, i, a) => a.indexOf(v) === i)
            }));
        }
        
        return this.provider.createNodesBatch(label, nodesData);
    }

    /**
     * Find nodes, searching in the appropriate graph
     * @param {string} label - Node label
     * @param {object} filters - Search filters
     * @param {object} options - Query options
     * @returns {Promise<object>}
     */
    async findNodes(label, filters = {}, options = {}) {
        const targetGraph = this.isSharedEntity(label) 
            ? this.sharedGraphName 
            : this.getProjectGraphName(this.currentProjectId);
        
        await this.provider.switchGraph(targetGraph);
        return this.provider.findNodes(label, filters, options);
    }

    /**
     * Create a cross-graph reference (relationship from shared to project entity)
     * @param {string} sharedEntityId - ID of the shared entity
     * @param {string} projectEntityId - ID of the project entity
     * @param {string} relationType - Relationship type
     * @param {object} properties - Relationship properties
     * @returns {Promise<object>}
     */
    async createCrossReference(sharedEntityId, projectEntityId, relationType, properties = {}) {
        // Cross-references are stored in the project graph
        await this.provider.switchGraph(this.getProjectGraphName(this.currentProjectId));
        
        // Store reference with the shared entity ID
        return this.provider.createNode('_CrossRef', {
            sharedEntityId,
            projectEntityId,
            relationType,
            ...properties
        });
    }

    /**
     * Find all projects a person participates in
     * @param {string} personId - Person ID
     * @returns {Promise<{ok: boolean, projects: Array}>}
     */
    async findPersonProjects(personId) {
        await this.provider.switchGraph(this.sharedGraphName);
        
        const result = await this.provider.findNodes('Person', { id: personId });
        if (!result.ok || !result.nodes?.length) {
            return { ok: false, projects: [], error: 'Person not found' };
        }
        
        const person = result.nodes[0];
        const projects = person.properties?.projects || [];
        
        return { 
            ok: true, 
            person: person.properties,
            projects,
            projectCount: projects.length
        };
    }

    /**
     * Find all people who work on multiple projects
     * @returns {Promise<{ok: boolean, people: Array}>}
     */
    async findCrossProjectPeople() {
        await this.provider.switchGraph(this.sharedGraphName);
        
        // Find people with more than one project
        const cypher = `
            MATCH (p:Person)
            WHERE size(p.projects) > 1
            RETURN p
            ORDER BY size(p.projects) DESC
        `;
        
        const result = await this.provider.query(cypher);
        if (!result.ok) {
            return { ok: false, people: [], error: result.error };
        }
        
        const people = (result.results || []).map(row => ({
            ...row.p?.properties,
            projectCount: row.p?.properties?.projects?.length || 0
        }));
        
        return { ok: true, people };
    }

    /**
     * Query across all project graphs
     * @param {string} cypher - Cypher query (will be run on each graph)
     * @param {Array<string>} projectIds - Project IDs to query (empty = all)
     * @returns {Promise<{ok: boolean, results: object}>}
     */
    async queryAcrossProjects(cypher, projectIds = []) {
        const results = {
            shared: null,
            projects: {}
        };
        
        // Query shared graph
        await this.provider.switchGraph(this.sharedGraphName);
        const sharedResult = await this.provider.query(cypher);
        if (sharedResult.ok) {
            results.shared = sharedResult.results;
        }
        
        // Query each project graph
        const targetProjects = projectIds.length > 0 ? projectIds : await this.listProjectGraphs();
        
        for (const projectId of targetProjects) {
            await this.provider.switchGraph(this.getProjectGraphName(projectId));
            const projectResult = await this.provider.query(cypher);
            if (projectResult.ok) {
                results.projects[projectId] = projectResult.results;
            }
        }
        
        // Restore current project context
        if (this.currentProjectId) {
            await this.provider.switchGraph(this.getProjectGraphName(this.currentProjectId));
        }
        
        return { ok: true, results };
    }

    /**
     * List all project graphs
     * @returns {Promise<Array<string>>}
     */
    async listProjectGraphs() {
        // This would need to be tracked separately or query FalkorDB for graph list
        // For now, return from cache
        const graphs = [];
        for (const [name] of this.graphCache) {
            if (name.startsWith('project_')) {
                graphs.push(name.replace('project_', ''));
            }
        }
        return graphs;
    }

    /**
     * Sync data to appropriate graphs based on entity type
     * @param {object} data - Data to sync (organized by type)
     * @param {string} projectId - Project ID
     * @returns {Promise<{ok: boolean, synced: object}>}
     */
    async syncData(data, projectId) {
        const synced = {
            shared: { nodes: 0, errors: [] },
            project: { nodes: 0, errors: [] }
        };
        
        // Sync shared entities
        for (const entityType of this.sharedEntityTypes) {
            const items = data[entityType.toLowerCase() + 's'] || data[entityType.toLowerCase()] || [];
            if (items.length > 0) {
                await this.provider.switchGraph(this.sharedGraphName);
                
                // Add project to each item
                const itemsWithProject = items.map(item => ({
                    ...item,
                    projects: [...new Set([...(item.projects || []), projectId])]
                }));
                
                const result = await this.provider.createNodesBatch(entityType, itemsWithProject);
                if (result.ok) {
                    synced.shared.nodes += result.created || items.length;
                } else {
                    synced.shared.errors.push({ type: entityType, error: result.error });
                }
            }
        }
        
        // Sync project-specific entities
        await this.provider.switchGraph(this.getProjectGraphName(projectId));
        
        for (const entityType of this.projectEntityTypes) {
            const items = data[entityType.toLowerCase() + 's'] || data[entityType.toLowerCase()] || [];
            if (items.length > 0) {
                const result = await this.provider.createNodesBatch(entityType, items);
                if (result.ok) {
                    synced.project.nodes += result.created || items.length;
                } else {
                    synced.project.errors.push({ type: entityType, error: result.error });
                }
            }
        }
        
        return { 
            ok: synced.shared.errors.length === 0 && synced.project.errors.length === 0,
            synced 
        };
    }

    /**
     * Get statistics across all graphs
     * @returns {Promise<object>}
     */
    async getStats() {
        const stats = {
            shared: null,
            projects: {},
            totals: { nodes: 0, relationships: 0 }
        };
        
        // Get shared graph stats
        await this.provider.switchGraph(this.sharedGraphName);
        const sharedStats = await this.provider.getStats();
        if (sharedStats.ok) {
            stats.shared = sharedStats.stats;
            stats.totals.nodes += sharedStats.stats?.nodes || 0;
            stats.totals.relationships += sharedStats.stats?.relationships || 0;
        }
        
        // Get project graph stats
        const projectIds = await this.listProjectGraphs();
        for (const projectId of projectIds) {
            await this.provider.switchGraph(this.getProjectGraphName(projectId));
            const projectStats = await this.provider.getStats();
            if (projectStats.ok) {
                stats.projects[projectId] = projectStats.stats;
                stats.totals.nodes += projectStats.stats?.nodes || 0;
                stats.totals.relationships += projectStats.stats?.relationships || 0;
            }
        }
        
        // Restore current project
        if (this.currentProjectId) {
            await this.provider.switchGraph(this.getProjectGraphName(this.currentProjectId));
        }
        
        return stats;
    }

    /**
     * Find connections between projects through shared entities
     * @returns {Promise<{ok: boolean, connections: Array}>}
     */
    async findProjectConnections() {
        await this.provider.switchGraph(this.sharedGraphName);
        
        // Find people who bridge multiple projects
        const cypher = `
            MATCH (p:Person)
            WHERE size(p.projects) > 1
            RETURN p.name as name, p.projects as projects
        `;
        
        const result = await this.provider.query(cypher);
        if (!result.ok) {
            return { ok: false, connections: [], error: result.error };
        }
        
        // Build connection matrix
        const connections = [];
        const projectPairs = new Map();
        
        for (const row of result.results || []) {
            const projects = row.projects || [];
            for (let i = 0; i < projects.length; i++) {
                for (let j = i + 1; j < projects.length; j++) {
                    const key = [projects[i], projects[j]].sort().join('|');
                    if (!projectPairs.has(key)) {
                        projectPairs.set(key, { 
                            projects: [projects[i], projects[j]], 
                            sharedPeople: [] 
                        });
                    }
                    projectPairs.get(key).sharedPeople.push(row.name);
                }
            }
        }
        
        for (const [_, connection] of projectPairs) {
            connections.push(connection);
        }
        
        return { ok: true, connections };
    }
}

// Singleton instance
let instance = null;

function getMultiGraphManager(provider) {
    if (!instance && provider) {
        instance = new MultiGraphManager(provider);
    }
    return instance;
}

function resetMultiGraphManager() {
    instance = null;
}

module.exports = {
    MultiGraphManager,
    getMultiGraphManager,
    resetMultiGraphManager
};
