/**
 * Purpose:
 *   Concrete GraphProvider implementation backed by Supabase PostgreSQL.
 *   Stores graph nodes and relationships in two tables (`graph_nodes`,
 *   `graph_relationships`) using JSONB properties, enabling full graph
 *   operations without a dedicated graph database.
 *
 * Responsibilities:
 *   - CRUD for nodes and relationships, using upsert for idempotent writes
 *   - Multi-graph isolation via a `graph_name` column on every row
 *   - Project-scoped queries via an optional `project_id` filter
 *   - Translate a subset of Cypher patterns into Supabase PostgREST queries
 *     (count, node match, relationship match, detach delete, merge)
 *   - Full-text search using PostgreSQL websearch with ILIKE fallback
 *   - Graph statistics: node/relationship counts, label and type distributions
 *   - Sync status tracking via `graph_sync_status` table
 *   - Data hygiene: prune stale entries, deduplicate Meeting nodes, clean
 *     orphaned relationships
 *
 * Key dependencies:
 *   - ../GraphProvider: abstract base class
 *   - ../../logger: structured logging
 *   - A Supabase JS client instance (injected via config.supabase)
 *
 * Side effects:
 *   - All write operations mutate the `graph_nodes`, `graph_relationships`,
 *     and `graph_sync_status` tables in Supabase
 *   - connect() probes the `graph_nodes` table; if missing, returns an error
 *     indicating the migration has not been run
 *   - disconnect() is a no-op because the Supabase client is shared/external
 *
 * Notes:
 *   - _executeCypher() is a pattern-matching translator, NOT a full Cypher parser.
 *     It recognises specific Cypher shapes (count, match-return, detach-delete,
 *     merge-set) and silently returns empty results for unsupported patterns.
 *   - Relationship IDs default to `{type}:{fromId}:{toId}`, making them
 *     deterministic and idempotent under upsert.
 *   - updateNode() enforces project-level access control: if a project context
 *     is set, nodes belonging to a different project are rejected.
 *   - deleteNode() cascades to relationships referencing the deleted node.
 *   - getSprintReportContext() performs a manual multi-hop join
 *     (Sprint <- IN_SPRINT <- Action <- ASSIGNED_TO <- Person) via three
 *     sequential Supabase queries, since the Cypher translator cannot handle
 *     this pattern natively.
 */

const { logger } = require('../../logger');
const GraphProvider = require('../GraphProvider');

const log = logger.child({ module: 'supabase-graph' });

class SupabaseGraphProvider extends GraphProvider {
    constructor(config = {}) {
        super(config);
        this.supabase = config.supabase || null;
        this.graphName = config.graphName || 'default';
        this.projectId = config.projectId || null;
        this.currentGraphName = this.graphName;

        log.debug({ event: 'supabase_graph_config', graphName: this.graphName, projectId: this.projectId, hasClient: !!this.supabase }, 'Config');
    }

    setProjectContext(projectId) {
        this.projectId = projectId;
        log.debug({ event: 'supabase_graph_set_project_context', projectId }, 'Set project context');
    }

    static get capabilities() {
        return {
            nodes: true,
            relationships: true,
            indexes: true,
            fullTextSearch: true,
            cypher: 'basic',
            multiGraph: true,
            realtime: true
        };
    }

    static get info() {
        return {
            id: 'supabase',
            label: 'Supabase Graph',
            capabilities: this.capabilities
        };
    }

    isConfigured() {
        return !!this.supabase;
    }

    async connect() {
        if (!this.supabase) {
            return { ok: false, error: 'Supabase client not provided' };
        }

        try {
            // Test connection
            const { error } = await this.supabase.from('graph_nodes').select('id').limit(1);

            if (error && error.code === '42P01') {
                // Table doesn't exist - create schema
                log.warn({ event: 'supabase_graph_tables_not_found' }, 'Tables not found, need to run migration');
                return { ok: false, error: 'Graph tables not found. Run migration 056_graph_tables.sql' };
            }

            if (error) {
                throw error;
            }

            this.connected = true;
            this.log('connected', { graphName: this.graphName });
            return { ok: true };
        } catch (error) {
            this.log('connect_error', { error: error.message });
            return { ok: false, error: error.message };
        }
    }

    async disconnect() {
        this.connected = false;
        // Supabase client is shared, don't close it
    }

    async testConnection() {
        if (!this.supabase) {
            return { ok: false, error: 'Supabase client not configured' };
        }

        try {
            const { data, error } = await this.supabase.rpc('graph_test_connection');

            if (error) {
                // Fallback to simple query
                const { error: selectError } = await this.supabase
                    .from('graph_nodes')
                    .select('id')
                    .limit(1);

                if (selectError) throw selectError;
                return { ok: true, message: 'Connected to Supabase Graph' };
            }

            return { ok: true, message: data || 'Connected' };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ==================== Multi-Graph Operations ====================

    async switchGraph(graphName) {
        this.graphName = graphName;
        this.currentGraphName = graphName;
        return { ok: true, graphName };
    }

    async listGraphs() {
        try {
            const { data, error } = await this.supabase
                .from('graph_nodes')
                .select('graph_name')
                .not('graph_name', 'is', null);

            if (error) throw error;

            const graphs = [...new Set((data || []).map(r => r.graph_name))];
            return { ok: true, graphs };
        } catch (error) {
            return { ok: false, error: error.message, graphs: [] };
        }
    }

    async deleteGraph(graphName) {
        try {
            // Delete relationships first


            if (this.projectId) {
                await this.supabase
                    .from('graph_relationships')
                    .delete()
                    .eq('graph_name', graphName)
                    .eq('project_id', this.projectId);
            } else {
                await this.supabase
                    .from('graph_relationships')
                    .delete()
                    .eq('graph_name', graphName);
            }

            // Delete nodes

            if (this.projectId) {
                await this.supabase
                    .from('graph_nodes')
                    .delete()
                    .eq('graph_name', graphName)
                    .eq('project_id', this.projectId);
            } else {
                await this.supabase
                    .from('graph_nodes')
                    .delete()
                    .eq('graph_name', graphName);
            }

            log.info({ event: 'supabase_graph_deleted', graphName }, 'Deleted graph');
            return { ok: true, deleted: graphName };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ==================== Node Operations ====================

    async ensureConnected() {
        if (!this.connected) {
            const result = await this.connect();
            return result.ok;
        }
        return true;
    }

    async createNode(label, properties) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            const nodeId = properties.id || this.generateId();
            const nodeData = {
                id: nodeId,
                label,
                properties: { ...properties, id: nodeId },
                graph_name: this.currentGraphName,
                project_id: this.projectId
            };

            const { data, error } = await this.supabase
                .from('graph_nodes')
                .upsert(nodeData, { onConflict: 'id' })
                .select()
                .single();

            if (error) throw error;

            return { ok: true, nodeId: data.id };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async createNodesBatch(label, nodesData) {
        if (!await this.ensureConnected()) {
            return { ok: false, created: 0, errors: ['Not connected'] };
        }

        try {
            const nodes = nodesData.map(node => {
                const id = node.id || this.generateId();
                return {
                    id: id,
                    label,
                    properties: { ...node, id },
                    graph_name: this.currentGraphName,
                    project_id: this.projectId
                };
            });

            const { data, error } = await this.supabase
                .from('graph_nodes')
                .upsert(nodes, { onConflict: 'id' })
                .select();

            if (error) throw error;

            this.log('createNodesBatch', { label, total: nodesData.length, created: data?.length || 0 });
            return { ok: true, created: data?.length || 0, errors: [] };
        } catch (error) {
            return { ok: false, created: 0, errors: [error.message] };
        }
    }

    async findNodes(label, filters = {}, options = {}) {
        if (!await this.ensureConnected()) {
            return { ok: false, nodes: [], error: 'Not connected' };
        }

        try {
            const { limit = 100, offset = 0 } = options;

            let query = this.supabase
                .from('graph_nodes')
                .select('*')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            if (label) {
                query = query.eq('label', label);
            }

            // Apply property filters using containedBy
            for (const [key, value] of Object.entries(filters)) {
                query = query.contains('properties', { [key]: value });
            }

            query = query.range(offset, offset + limit - 1);

            const { data, error } = await query;

            if (error) throw error;

            const nodes = (data || []).map(row => {
                const props = row.properties || {};
                return {
                    id: row.id,
                    label: row.label,
                    labels: [row.label],
                    properties: props,
                    ...props
                };
            });

            this.log('findNodes', { label, count: nodes.length });
            return { ok: true, nodes };
        } catch (error) {
            return { ok: false, nodes: [], error: error.message };
        }
    }

    async getNode(nodeId) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            let query = this.supabase
                .from('graph_nodes')
                .select('*')
                .eq('id', nodeId)
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            const { data, error } = await query.single();

            if (error) throw error;

            const node = {
                id: data.id,
                label: data.label,
                labels: [data.label],
                ...(data.properties || {})
            };

            return { ok: true, node };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async updateNode(nodeId, properties) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            // Get existing properties
            const { data: existing, error: getError } = await this.supabase
                .from('graph_nodes')
                .select('properties, project_id')
                .eq('id', nodeId)
                .maybeSingle();

            if (getError) throw getError;
            if (!existing) return { ok: false, error: 'Node not found' };

            // Verify project access if context is set
            if (this.projectId && existing.project_id && existing.project_id !== this.projectId) {
                return { ok: false, error: 'Access denied: Node belongs to another project' };
            }

            const mergedProps = { ...(existing.properties || {}), ...properties, id: nodeId };

            const { error } = await this.supabase
                .from('graph_nodes')
                .update({ properties: mergedProps, updated_at: new Date().toISOString() })
                .eq('id', nodeId);

            if (error) throw error;

            return { ok: true, nodeId };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async deleteNode(nodeId) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            // Verify ownership before delete
            if (this.projectId) {
                const { data: existing } = await this.supabase
                    .from('graph_nodes')
                    .select('project_id')
                    .eq('id', nodeId)
                    .single();

                if (existing && existing.project_id && existing.project_id !== this.projectId) {
                    return { ok: false, error: 'Access denied: Node belongs to another project' };
                }
            }

            // Delete relationships first (scoped)
            let relQuery = this.supabase
                .from('graph_relationships')
                .delete()
                .eq('graph_name', this.currentGraphName)
                .or(`from_id.eq.${nodeId},to_id.eq.${nodeId}`);

            if (this.projectId) {
                relQuery = relQuery.eq('project_id', this.projectId);
            }
            await relQuery;

            // Delete node (scoped)
            let nodeQuery = this.supabase
                .from('graph_nodes')
                .delete()
                .eq('id', nodeId)
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                nodeQuery = nodeQuery.eq('project_id', this.projectId);
            }
            const { error } = await nodeQuery;

            if (error) throw error;

            return { ok: true, deleted: true };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ==================== Relationship Operations ====================

    async createRelationship(fromId, toId, type, properties = {}) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            const relId = properties.id || `${type}:${fromId}:${toId}`;
            const relData = {
                id: relId,
                from_id: fromId,
                to_id: toId,
                type,
                properties: { ...properties, id: relId },
                graph_name: this.currentGraphName,
                project_id: this.projectId
            };

            const { data, error } = await this.supabase
                .from('graph_relationships')
                .upsert(relData, { onConflict: 'id' })
                .select()
                .single();

            if (error) throw error;

            return { ok: true, relationshipId: data.id };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async createRelationshipsBatch(relationships) {
        if (!await this.ensureConnected()) {
            return { ok: false, created: 0, errors: ['Not connected'] };
        }

        try {
            const rels = relationships.map(rel => ({
                id: rel.id || `${rel.type}:${rel.fromId}:${rel.toId}`,
                from_id: rel.fromId,
                to_id: rel.toId,
                type: rel.type,
                properties: rel.properties || {},
                graph_name: this.currentGraphName,
                project_id: this.projectId
            }));

            const { data, error } = await this.supabase
                .from('graph_relationships')
                .upsert(rels, { onConflict: 'id' })
                .select();

            if (error) throw error;

            return { ok: true, created: data?.length || 0, errors: [] };
        } catch (error) {
            return { ok: false, created: 0, errors: [error.message] };
        }
    }

    async findRelationships(options = {}) {
        if (!await this.ensureConnected()) {
            return { ok: false, relationships: [], error: 'Not connected' };
        }

        try {
            const { fromId, toId, type, limit = 100 } = options;

            let query = this.supabase
                .from('graph_relationships')
                .select('*')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            if (fromId) query = query.eq('from_id', fromId);
            if (toId) query = query.eq('to_id', toId);
            if (type) query = query.eq('type', type);

            query = query.limit(limit);

            const { data, error } = await query;

            if (error) throw error;

            const relationships = (data || []).map(row => ({
                id: row.id,
                from: row.from_id,
                to: row.to_id,
                type: row.type,
                ...(row.properties || {})
            }));

            return { ok: true, relationships };
        } catch (error) {
            return { ok: false, relationships: [], error: error.message };
        }
    }

    /**
     * Get sprint report context from the graph (Supabase-native).
     * Returns sprint node properties and assignees (Person names) linked via IN_SPRINT and ASSIGNED_TO.
     * @param {string} sprintId - Sprint node id
     * @returns {Promise<{ok: boolean, sprint?: {name?: string, context?: string}, assignees?: string[], error?: string}>}
     */
    async getSprintReportContext(sprintId) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }
        try {
            const g = this.currentGraphName;

            const { data: sprintNode, error: e0 } = await this.supabase
                .from('graph_nodes')
                .select('id, label, properties')
                .eq('graph_name', g)
                .eq('id', sprintId)
                .eq('label', 'Sprint')
                .maybeSingle();

            if (e0) throw e0;
            const sprint = sprintNode?.properties || {};

            const { data: inSprintRels, error: e1 } = await this.supabase
                .from('graph_relationships')
                .select('from_id')
                .eq('graph_name', g)
                .eq('to_id', sprintId)
                .eq('type', 'IN_SPRINT');

            if (e1) throw e1;
            const actionIds = [...new Set((inSprintRels || []).map(r => r.from_id))];
            if (actionIds.length === 0) {
                return { ok: true, sprint: { name: sprint.name, context: sprint.context }, assignees: [] };
            }

            const { data: assignedRels, error: e2 } = await this.supabase
                .from('graph_relationships')
                .select('from_id')
                .eq('graph_name', g)
                .eq('type', 'ASSIGNED_TO')
                .in('to_id', actionIds);

            if (e2) throw e2;
            const personIds = [...new Set((assignedRels || []).map(r => r.from_id))];
            if (personIds.length === 0) {
                return { ok: true, sprint: { name: sprint.name, context: sprint.context }, assignees: [] };
            }

            const { data: personNodes, error: e3 } = await this.supabase
                .from('graph_nodes')
                .select('id, properties')
                .eq('graph_name', g)
                .eq('label', 'Person')
                .in('id', personIds);

            if (e3) throw e3;
            const assignees = (personNodes || []).map(n => (n.properties && n.properties.name) || n.id).filter(Boolean);
            const uniqueAssignees = [...new Set(assignees)];

            return {
                ok: true,
                sprint: { name: sprint.name, context: sprint.context },
                assignees: uniqueAssignees
            };
        } catch (error) {
            log.debug({ event: 'get_sprint_report_context_error', sprintId, reason: error.message }, 'getSprintReportContext failed');
            return { ok: false, error: error.message };
        }
    }

    async deleteRelationship(relId) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            const { error } = await this.supabase
                .from('graph_relationships')
                .delete()
                .eq('id', relId);

            if (error) throw error;

            return { ok: true, deleted: true };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ==================== Sync Operations ====================

    async getSyncStatus() {
        if (!await this.ensureConnected() || !this.projectId) {
            return { ok: false, error: 'Not connected or no project context' };
        }
        try {
            const { data, error } = await this.supabase
                .from('graph_sync_status')
                .select('*')
                .eq('project_id', this.projectId)
                .eq('graph_name', this.currentGraphName)
                .maybeSingle();

            if (error) throw error;

            // Get live stats to supplement the status
            const stats = await this.getStats();

            // Map DB fields to Frontend Interface
            const statusObj = data || {};

            return {
                ok: true,
                status: {
                    ...statusObj,
                    node_count: stats.ok ? stats.nodeCount : 0,
                    edge_count: stats.ok ? stats.edgeCount : 0,
                    sync_status: statusObj.pending_count > 0 ? 'syncing' : (statusObj.health_status === 'unhealthy' ? 'failed' : 'idle'),
                    last_synced_at: statusObj.updated_at || new Date().toISOString(),
                    health_status: statusObj.health_status || 'unknown'
                }
            };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async updateSyncStatus(status) {
        if (!await this.ensureConnected() || !this.projectId) {
            return { ok: false, error: 'Not connected or no project context' };
        }
        try {
            // Filter fields to match DB schema (graph_sync_status)
            const payload = {
                project_id: this.projectId,
                graph_name: this.currentGraphName,
                updated_at: new Date().toISOString()
            };

            // Map allowed fields
            if (status.last_connected_at) payload.last_connected_at = status.last_connected_at;
            if (status.last_error !== undefined) payload.last_error = status.last_error;
            if (status.health_status) payload.health_status = status.health_status;

            const { data, error } = await this.supabase
                .from('graph_sync_status')
                .upsert(payload, { onConflict: 'project_id,graph_name' })
                .select()
                .single();

            if (error) throw error;
            return { ok: true, status: data };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async pruneStale(thresholdDate) {
        if (!await this.ensureConnected() || !this.projectId) {
            return { ok: false, error: 'Not connected or no project context' };
        }
        try {
            // Delete relationships first
            const { count: relCount, error: relError } = await this.supabase
                .from('graph_relationships')
                .delete({ count: 'exact' })
                .eq('project_id', this.projectId)
                .eq('graph_name', this.currentGraphName)
                .lt('created_at', thresholdDate); // Delete anything older than threshold (relationships are immutable)

            if (relError) throw relError;

            // Delete nodes
            const { count: nodeCount, error: nodeError } = await this.supabase
                .from('graph_nodes')
                .delete({ count: 'exact' })
                .eq('project_id', this.projectId)
                .eq('graph_name', this.currentGraphName)
                .lt('updated_at', thresholdDate);

            if (nodeError) throw nodeError;

            return { ok: true, deletedNodes: nodeCount, deletedRelationships: relCount };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ==================== Query Operations ====================

    async query(cypher, params = {}) {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected', data: [] };
        }

        try {
            const result = await this._executeCypher(cypher, params);
            return { ok: true, data: result.data, metadata: result.metadata };
        } catch (error) {
            return { ok: false, error: error.message, data: [] };
        }
    }

    async _executeCypher(cypher, params = {}) {
        const cypherLower = cypher.toLowerCase().trim();

        // MATCH (n) RETURN count(n) as count
        if (cypherLower.includes('count(n)')) {
            const labelMatch = cypher.match(/\(n:(\w+)\)/);

            let query = this.supabase
                .from('graph_nodes')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            if (labelMatch) {
                query = query.eq('label', labelMatch[1]);
            }

            const { count, error } = await query;
            if (error) throw error;

            return { data: [{ count: count || 0 }], metadata: {} };
        }

        // MATCH ()-[r]->() RETURN count(r) as count
        if (cypherLower.includes('count(r)')) {
            let query = this.supabase
                .from('graph_relationships')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            const { count, error } = await query;
            if (error) throw error;

            return { data: [{ count: count || 0 }], metadata: {} };
        }

        // MATCH (a:Label)-[r:TYPE]->(b:Label) pattern with optional WHERE
        const relPatternMatch = cypher.match(
            /MATCH\s*\((\w+)(?::(\w+))?\)\s*-\[(\w+):(\w+)\]->\s*\((\w+)(?::(\w+))?\)/i
        );
        if (relPatternMatch) {
            const [, fromAlias, fromLabel, relAlias, relType, toAlias, toLabel] = relPatternMatch;
            const limitMatch = cypher.match(/LIMIT\s+(\d+)/i);
            const limit = limitMatch ? parseInt(limitMatch[1]) : 100;

            let query = this.supabase
                .from('graph_relationships')
                .select(`
                    id, from_id, to_id, type, properties,
                    from_node:graph_nodes!from_id(id, label, properties),
                    to_node:graph_nodes!to_id(id, label, properties)
                `)
                .eq('graph_name', this.currentGraphName)
                .eq('type', relType);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            const { data: rels, error: relError } = await query;
            if (relError) throw relError;

            let results = (rels || []).filter(r => {
                if (fromLabel && r.from_node?.label !== fromLabel) return false;
                if (toLabel && r.to_node?.label !== toLabel) return false;
                return true;
            });

            // Parse WHERE clauses for property filtering on JSONB properties
            results = this._applyWhereFilters(cypher, results, {
                [fromAlias]: 'from_node',
                [toAlias]: 'to_node',
                [relAlias]: null
            }, params);

            const mapped = results.slice(0, limit).map(r => ({
                [fromAlias]: r.from_node ? {
                    id: r.from_node.id,
                    labels: [r.from_node.label],
                    ...(r.from_node.properties || {})
                } : { id: r.from_id },
                [relAlias]: {
                    id: r.id,
                    type: r.type,
                    ...(r.properties || {})
                },
                [toAlias]: r.to_node ? {
                    id: r.to_node.id,
                    labels: [r.to_node.label],
                    ...(r.to_node.properties || {})
                } : { id: r.to_id }
            }));

            return { data: mapped, metadata: {} };
        }

        // MATCH (n:Label) with WHERE + property filters
        const nodeMatchWithWhere = cypherLower.match(/match\s*\((\w+)(?::(\w+))?\)/) && cypherLower.includes('where');
        if (nodeMatchWithWhere && !cypherLower.includes('-[') && cypherLower.includes('return')) {
            const nodeMatch = cypher.match(/MATCH\s*\((\w+)(?::(\w+))?\)/i);
            if (nodeMatch) {
                const [, alias, label] = nodeMatch;
                const limitMatch = cypher.match(/LIMIT\s+(\d+)/i);

                let query = this.supabase
                    .from('graph_nodes')
                    .select('*')
                    .eq('graph_name', this.currentGraphName);

                if (this.projectId) {
                    query = query.eq('project_id', this.projectId);
                }

                if (label) {
                    query = query.eq('label', label);
                }

                const { data, error } = await query;
                if (error) throw error;

                let results = (data || []).map(r => ({ _row: r }));

                results = this._applyNodeWhereFilters(cypher, results, alias, params);

                const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
                const mapped = results.slice(0, limit).map(r => ({
                    [alias]: { id: r._row.id, labels: [r._row.label], ...(r._row.properties || {}) },
                    nodeLabels: [r._row.label]
                }));

                return { data: mapped, metadata: {} };
            }
        }

        // MATCH (n) RETURN n, labels(n) -- simple node match without WHERE
        if (cypherLower.match(/match\s*\(n.*\)\s*return/i) && !cypherLower.includes('-[')) {
            const labelMatch = cypher.match(/\(n:(\w+)\)/);
            const limitMatch = cypher.match(/limit\s+(\d+)/i);

            let query = this.supabase
                .from('graph_nodes')
                .select('*')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            if (labelMatch) {
                query = query.eq('label', labelMatch[1]);
            }
            if (limitMatch) {
                query = query.limit(parseInt(limitMatch[1]));
            }

            const { data, error } = await query;
            if (error) throw error;

            const results = (data || []).map(r => ({
                n: { id: r.id, labels: [r.label], ...(r.properties || {}) },
                nodeLabels: [r.label]
            }));

            return { data: results, metadata: {} };
        }

        // MATCH (from)-[r]->(to) RETURN from, r, to (untyped relationship)
        if (cypherLower.includes('-[r]->') || cypherLower.includes('from)-[r]->(to)')) {
            const limitMatch = cypher.match(/limit\s+(\d+)/i);
            const limit = limitMatch ? parseInt(limitMatch[1]) : 100;

            let query = this.supabase
                .from('graph_relationships')
                .select(`
                    id, from_id, to_id, type, properties,
                    from_node:graph_nodes!from_id(id, label, properties),
                    to_node:graph_nodes!to_id(id, label, properties)
                `)
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            query = query.limit(limit);

            const { data: rels, error: relError } = await query;

            if (relError) throw relError;

            const results = (rels || []).map(r => ({
                from: r.from_node ? {
                    id: r.from_node.id,
                    labels: [r.from_node.label],
                    ...(r.from_node.properties || {})
                } : { id: r.from_id },
                r: {
                    id: r.id,
                    type: r.type,
                    ...(r.properties || {})
                },
                to: r.to_node ? {
                    id: r.to_node.id,
                    labels: [r.to_node.label],
                    ...(r.to_node.properties || {})
                } : { id: r.to_id }
            }));

            return { data: results, metadata: {} };
        }

        // RETURN 1 as test
        if (cypherLower.includes('return 1')) {
            return { data: [{ test: 1 }], metadata: {} };
        }

        // MATCH (n) DETACH DELETE n
        if (cypherLower.includes('detach delete')) {
            let relQuery = this.supabase
                .from('graph_relationships')
                .delete()
                .eq('graph_name', this.currentGraphName);

            let nodeQuery = this.supabase
                .from('graph_nodes')
                .delete()
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                relQuery = relQuery.eq('project_id', this.projectId);
                nodeQuery = nodeQuery.eq('project_id', this.projectId);
            }

            await relQuery;
            await nodeQuery;

            return { data: [], metadata: { cleared: true } };
        }

        // MERGE (n:Label {id: $id}) SET n.prop = $value
        const mergeMatch = cypher.match(/MERGE\s*\(\w+:(\w+)\s*\{id:\s*\$(\w+)\}\)/i);
        if (mergeMatch) {
            const label = mergeMatch[1];
            const idParam = mergeMatch[2];
            const nodeId = params[idParam];

            // Extract SET properties
            const props = { id: nodeId };
            const setMatches = cypher.matchAll(/(\w+)\.\s*(\w+)\s*=\s*\$(\w+)/g);
            for (const m of setMatches) {
                const propName = m[2];
                const paramName = m[3];
                if (params[paramName] !== undefined) {
                    props[propName] = params[paramName];
                }
            }

            // Upsert the node
            await this.createNode(label, props);
            return { data: [props], metadata: { merged: true } };
        }

        log.warn({ event: 'cypher_unsupported', cypher: cypher.substring(0, 200) }, 'Cypher pattern not supported by Supabase translator');
        return { data: [], metadata: { unsupported: true, error: 'Query pattern not supported by the Supabase Cypher translator. Falling back to alternative retrieval.' } };
    }

    /**
     * Apply WHERE clause filters to relationship query results.
     * Supports: properties->>'key' ILIKE '%val%', = 'val', IN ('a','b')
     */
    _applyWhereFilters(cypher, results, aliasMap, params) {
        const whereMatch = cypher.match(/WHERE\s+(.*?)(?:\s+RETURN)/is);
        if (!whereMatch) return results;

        const whereClauses = whereMatch[1];

        // Parse ILIKE conditions: alias.properties->>'key' ILIKE '%' || $param || '%'
        const ilikePattern = /(\w+)\.properties->>'(\w+)'\s+ILIKE\s+'%'\s*\|\|\s*\$(\w+)\s*\|\|\s*'%'/gi;
        let ilikeMatch;
        while ((ilikeMatch = ilikePattern.exec(whereClauses)) !== null) {
            const [, alias, prop, paramName] = ilikeMatch;
            const value = (params[paramName] || '').toLowerCase();
            const nodeKey = aliasMap[alias];
            if (!value) continue;

            results = results.filter(r => {
                const node = nodeKey ? r[nodeKey] : r;
                const propVal = node?.properties?.[prop] || '';
                return propVal.toLowerCase().includes(value);
            });
        }

        // Parse equality conditions: alias.properties->>'key' = 'value' or $param
        const eqPattern = /(\w+)\.properties->>'(\w+)'\s*=\s*(?:'([^']*)'|\$(\w+))/gi;
        let eqMatch;
        while ((eqMatch = eqPattern.exec(whereClauses)) !== null) {
            const [, alias, prop, literal, paramName] = eqMatch;
            const value = literal || params[paramName] || '';
            const nodeKey = aliasMap[alias];

            results = results.filter(r => {
                const node = nodeKey ? r[nodeKey] : r;
                const propVal = node?.properties?.[prop] || '';
                return propVal === value;
            });
        }

        // Parse IN conditions: alias.properties->>'key' IN ('a', 'b')
        const inPattern = /(\w+)\.properties->>'(\w+)'\s+IN\s*\(([^)]+)\)/gi;
        let inMatch;
        while ((inMatch = inPattern.exec(whereClauses)) !== null) {
            const [, alias, prop, valuesStr] = inMatch;
            const values = valuesStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            const nodeKey = aliasMap[alias];

            results = results.filter(r => {
                const node = nodeKey ? r[nodeKey] : r;
                const propVal = node?.properties?.[prop] || '';
                return values.includes(propVal);
            });
        }

        return results;
    }

    /**
     * Apply WHERE clause filters to simple node query results.
     * Each result has shape { _row: { id, label, properties } }
     */
    _applyNodeWhereFilters(cypher, results, alias, params) {
        const whereMatch = cypher.match(/WHERE\s+(.*?)(?:\s+RETURN)/is);
        if (!whereMatch) return results;

        const whereClauses = whereMatch[1];

        // ILIKE: alias.properties->>'key' ILIKE '%' || $param || '%'
        const ilikePattern = /(\w+)\.properties->>'(\w+)'\s+ILIKE\s+'%'\s*\|\|\s*\$(\w+)\s*\|\|\s*'%'/gi;
        let m;
        while ((m = ilikePattern.exec(whereClauses)) !== null) {
            const [, , prop, paramName] = m;
            const value = (params[paramName] || '').toLowerCase();
            if (!value) continue;
            results = results.filter(r => {
                const propVal = r._row.properties?.[prop] || '';
                return propVal.toLowerCase().includes(value);
            });
        }

        // Equality: alias.properties->>'key' = 'value' or $param
        const eqPattern = /(\w+)\.properties->>'(\w+)'\s*=\s*(?:'([^']*)'|\$(\w+))/gi;
        while ((m = eqPattern.exec(whereClauses)) !== null) {
            const [, , prop, literal, paramName] = m;
            const value = literal || params[paramName] || '';
            results = results.filter(r => {
                const propVal = r._row.properties?.[prop] || '';
                return propVal === value;
            });
        }

        // IN: alias.properties->>'key' IN ('a', 'b')
        const inPattern = /(\w+)\.properties->>'(\w+)'\s+IN\s*\(([^)]+)\)/gi;
        while ((m = inPattern.exec(whereClauses)) !== null) {
            const [, , prop, valuesStr] = m;
            const values = valuesStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            results = results.filter(r => {
                const propVal = r._row.properties?.[prop] || '';
                return values.includes(propVal);
            });
        }

        // CONTAINS: alias.properties->>'key' CONTAINS 'value'
        const containsPattern = /(\w+)\.properties->>'(\w+)'\s+CONTAINS\s+'([^']*)'/gi;
        while ((m = containsPattern.exec(whereClauses)) !== null) {
            const [, , prop, value] = m;
            results = results.filter(r => {
                const propVal = r._row.properties?.[prop] || '';
                return propVal.toLowerCase().includes(value.toLowerCase());
            });
        }

        return results;
    }

    // ==================== Graph Traversal ====================

    /**
     * BFS traversal from a start node following specified relationship types.
     * Returns paths as { from, to, type, relationship } objects up to maxDepth hops.
     */
    async traversePath(startNodeId, relTypes = [], maxDepth = 2, direction = 'both') {
        if (!this.connected) return { ok: false, paths: [], error: 'Not connected' };

        try {
            const paths = [];
            const visited = new Set([startNodeId]);
            let frontier = [startNodeId];

            for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
                const nextFrontier = [];

                for (const nodeId of frontier) {
                    // Fetch relationships where nodeId is source or target
                    let query = this.supabase
                        .from('graph_relationships')
                        .select(`
                            id, from_id, to_id, type, properties,
                            from_node:graph_nodes!from_id(id, label, properties),
                            to_node:graph_nodes!to_id(id, label, properties)
                        `)
                        .eq('graph_name', this.currentGraphName);

                    if (this.projectId) {
                        query = query.eq('project_id', this.projectId);
                    }

                    if (relTypes.length > 0) {
                        query = query.in('type', relTypes);
                    }

                    if (direction === 'outgoing') {
                        query = query.eq('from_id', nodeId);
                    } else if (direction === 'incoming') {
                        query = query.eq('to_id', nodeId);
                    } else {
                        query = query.or(`from_id.eq.${nodeId},to_id.eq.${nodeId}`);
                    }

                    const { data, error } = await query.limit(50);
                    if (error || !data) continue;

                    for (const rel of data) {
                        const neighborId = rel.from_id === nodeId ? rel.to_id : rel.from_id;

                        paths.push({
                            from: rel.from_node || { id: rel.from_id },
                            to: rel.to_node || { id: rel.to_id },
                            type: rel.type,
                            relationship: { id: rel.id, type: rel.type, properties: rel.properties }
                        });

                        if (!visited.has(neighborId)) {
                            visited.add(neighborId);
                            nextFrontier.push(neighborId);
                        }
                    }
                }

                frontier = nextFrontier;
            }

            return { ok: true, paths };
        } catch (error) {
            this.log('error', 'traversePath failed', { error: error.message });
            return { ok: false, paths: [], error: error.message };
        }
    }

    // ==================== Search Operations ====================

    async search(query, options = {}) {
        if (!await this.ensureConnected()) {
            return { ok: false, results: [], error: 'Not connected' };
        }

        try {
            const { limit = 20, label } = options;

            // Use PostgreSQL full-text search
            let dbQuery = this.supabase
                .from('graph_nodes')
                .select('*')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                dbQuery = dbQuery.eq('project_id', this.projectId);
            }

            dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' })
                .limit(limit);

            if (label) {
                dbQuery = dbQuery.eq('label', label);
            }

            const { data, error } = await dbQuery;

            if (error) {
                // Fallback to ILIKE search on properties
                let fallbackDataQuery = this.supabase
                    .from('graph_nodes')
                    .select('*')
                    .eq('graph_name', this.currentGraphName);

                if (this.projectId) {
                    fallbackDataQuery = fallbackDataQuery.eq('project_id', this.projectId);
                }

                const { data: fallbackData, error: fallbackError } = await fallbackDataQuery
                    .ilike('properties::text', `%${query}%`)
                    .limit(limit);

                if (fallbackError) throw fallbackError;

                const results = (fallbackData || []).map(r => ({
                    id: r.id,
                    label: r.label,
                    ...(r.properties || {})
                }));

                return { ok: true, results };
            }

            const results = (data || []).map(r => ({
                id: r.id,
                label: r.label,
                ...(r.properties || {})
            }));

            return { ok: true, results };
        } catch (error) {
            return { ok: false, results: [], error: error.message };
        }
    }

    // ==================== Stats Operations ====================

    async getStats() {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            // Get node count
            let nodeCountQuery = this.supabase
                .from('graph_nodes')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                nodeCountQuery = nodeCountQuery.eq('project_id', this.projectId);
            }

            const { count: nodeCount, error: nodeError } = await nodeCountQuery;

            if (nodeError) throw nodeError;

            // Get relationship count
            let relCountQuery = this.supabase
                .from('graph_relationships')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                relCountQuery = relCountQuery.eq('project_id', this.projectId);
            }

            const { count: relCount, error: relError } = await relCountQuery;

            if (relError) throw relError;

            // Get label distribution
            let labelQuery = this.supabase
                .from('graph_nodes')
                .select('label')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                labelQuery = labelQuery.eq('project_id', this.projectId);
            }

            const { data: labels } = await labelQuery;

            const labelCounts = {};
            (labels || []).forEach(r => {
                labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
            });

            // Get relationship type distribution
            let typeQuery = this.supabase
                .from('graph_relationships')
                .select('type')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                typeQuery = typeQuery.eq('project_id', this.projectId);
            }

            const { data: relTypes } = await typeQuery;

            const typeCounts = {};
            (relTypes || []).forEach(r => {
                typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
            });

            return {
                ok: true,
                provider: 'supabase',
                graphName: this.currentGraphName,
                nodes: nodeCount || 0,
                relationships: relCount || 0,
                nodeCount: nodeCount || 0,
                edgeCount: relCount || 0,
                stats: {
                    nodeCount: nodeCount || 0,
                    edgeCount: relCount || 0,
                    labels: labelCounts,
                    relationshipTypes: typeCounts
                }
            };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    async clear() {
        return this.deleteGraph(this.currentGraphName);
    }

    async drop() {
        return this.deleteGraph(this.currentGraphName);
    }

    /**
     * Clean up duplicate Meeting nodes
     * Keeps deterministic IDs (meeting_xxx) and removes auto-generated ones
     */
    async cleanupDuplicateMeetings() {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            // Get all Meeting nodes
            let query = this.supabase
                .from('graph_nodes')
                .select('id, properties')
                .eq('graph_name', this.currentGraphName)
                .eq('label', 'Meeting');

            if (this.projectId) {
                query = query.eq('project_id', this.projectId);
            }

            const { data: meetings, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            // Group by source property
            const bySource = new Map();
            for (const meeting of meetings || []) {
                const source = meeting.properties?.source;
                if (!source) continue;
                if (!bySource.has(source)) bySource.set(source, []);
                bySource.get(source).push(meeting);
            }

            const toDelete = [];
            const remappings = []; // { from: oldId, to: newId }

            for (const [source, nodes] of bySource) {
                if (nodes.length <= 1) continue;

                // Prefer deterministic ID (starts with meeting_)
                const deterministicNode = nodes.find(n => n.id.startsWith('meeting_'));
                const keepId = deterministicNode?.id || nodes[0].id;

                for (const node of nodes) {
                    if (node.id !== keepId) {
                        toDelete.push(node.id);
                        remappings.push({ from: node.id, to: keepId });
                    }
                }
            }

            if (toDelete.length === 0) {
                return { ok: true, deleted: 0, remapped: 0, message: 'No duplicates found' };
            }

            // Remap relationships pointing to deleted nodes
            for (const { from, to } of remappings) {
                // Update from_id
                await this.supabase
                    .from('graph_relationships')
                    .update({ from_id: to })
                    .eq('graph_name', this.currentGraphName)
                    .eq('from_id', from);

                // Update to_id
                await this.supabase
                    .from('graph_relationships')
                    .update({ to_id: to })
                    .eq('graph_name', this.currentGraphName)
                    .eq('to_id', from);
            }

            // Delete duplicate nodes
            const { error: deleteError } = await this.supabase
                .from('graph_nodes')
                .delete()
                .eq('graph_name', this.currentGraphName)
                .in('id', toDelete);

            if (deleteError) throw deleteError;

            log.debug({ event: 'supabase_graph_cleaned_duplicates', count: toDelete.length }, 'Cleaned up duplicate Meeting nodes');

            return {
                ok: true,
                deleted: toDelete.length,
                remapped: remappings.length,
                deletedIds: toDelete
            };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    /**
     * Clean up orphaned relationships (where nodes don't exist)
     */
    async cleanupOrphanedRelationships() {
        if (!await this.ensureConnected()) {
            return { ok: false, error: 'Not connected' };
        }

        try {
            // Get all node IDs
            let nodeQuery = this.supabase
                .from('graph_nodes')
                .select('id')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                nodeQuery = nodeQuery.eq('project_id', this.projectId);
            }

            const { data: nodes } = await nodeQuery;

            const nodeIds = new Set((nodes || []).map(n => n.id));

            // Get all relationships
            let relQuery = this.supabase
                .from('graph_relationships')
                .select('id, from_id, to_id')
                .eq('graph_name', this.currentGraphName);

            if (this.projectId) {
                relQuery = relQuery.eq('project_id', this.projectId);
            }

            const { data: rels } = await relQuery;

            // Find orphaned relationships
            const orphanedIds = (rels || [])
                .filter(r => !nodeIds.has(r.from_id) || !nodeIds.has(r.to_id))
                .map(r => r.id);

            if (orphanedIds.length === 0) {
                return { ok: true, deleted: 0, message: 'No orphaned relationships found' };
            }

            // Delete orphaned relationships
            let deleteQuery = this.supabase
                .from('graph_relationships')
                .delete()
                .eq('graph_name', this.currentGraphName)
                .in('id', orphanedIds);

            if (this.projectId) {
                deleteQuery = deleteQuery.eq('project_id', this.projectId);
            }

            const { error: deleteError } = await deleteQuery;

            if (deleteError) throw deleteError;

            log.debug({ event: 'supabase_graph_cleaned_orphans', count: orphanedIds.length }, 'Cleaned up orphaned relationships');

            return { ok: true, deleted: orphanedIds.length };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }
}

module.exports = SupabaseGraphProvider;
