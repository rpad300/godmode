/**
 * SupabaseGraphProvider - Graph database using Supabase PostgreSQL
 * 
 * Uses Supabase (already in the project) to store graph data.
 * No additional infrastructure needed!
 * 
 * Features:
 * - Uses existing Supabase connection
 * - Real-time sync capabilities
 * - Full PostgreSQL power (JSON, arrays, full-text search)
 * - RLS security
 * - Multi-graph support via project_id
 */

const GraphProvider = require('../GraphProvider');

class SupabaseGraphProvider extends GraphProvider {
    constructor(config = {}) {
        super(config);
        this.supabase = config.supabase || null;
        this.graphName = config.graphName || 'default';
        this.projectId = config.projectId || null;
        this.currentGraphName = this.graphName;
        
        console.log('[SupabaseGraph] Config:', {
            graphName: this.graphName,
            projectId: this.projectId,
            hasClient: !!this.supabase
        });
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
                console.log('[SupabaseGraph] Tables not found, need to run migration');
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
            await this.supabase
                .from('graph_relationships')
                .delete()
                .eq('graph_name', graphName);

            // Delete nodes
            await this.supabase
                .from('graph_nodes')
                .delete()
                .eq('graph_name', graphName);

            console.log(`[SupabaseGraph] Deleted graph: ${graphName}`);
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
            const nodes = nodesData.map(node => ({
                id: node.id || this.generateId(),
                label,
                properties: { ...node, id: node.id || this.generateId() },
                graph_name: this.currentGraphName,
                project_id: this.projectId
            }));

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
            const { data, error } = await this.supabase
                .from('graph_nodes')
                .select('*')
                .eq('id', nodeId)
                .single();

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
                .select('properties')
                .eq('id', nodeId)
                .single();

            if (getError) throw getError;

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
            // Delete relationships first
            await this.supabase
                .from('graph_relationships')
                .delete()
                .or(`from_id.eq.${nodeId},to_id.eq.${nodeId}`);

            // Delete node
            const { error } = await this.supabase
                .from('graph_nodes')
                .delete()
                .eq('id', nodeId);

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
            const relId = properties.id || `${fromId}-${type}-${toId}`;
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
                id: rel.id || `${rel.fromId}-${rel.type}-${rel.toId}`,
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
            
            if (labelMatch) {
                query = query.eq('label', labelMatch[1]);
            }

            const { count, error } = await query;
            if (error) throw error;

            return { data: [{ count: count || 0 }], metadata: {} };
        }

        // MATCH ()-[r]->() RETURN count(r) as count
        if (cypherLower.includes('count(r)')) {
            const { count, error } = await this.supabase
                .from('graph_relationships')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (error) throw error;

            return { data: [{ count: count || 0 }], metadata: {} };
        }

        // MATCH (n) RETURN n, labels(n)
        if (cypherLower.match(/match\s*\(n.*\)\s*return/i)) {
            const labelMatch = cypher.match(/\(n:(\w+)\)/);
            const limitMatch = cypher.match(/limit\s+(\d+)/i);
            
            let query = this.supabase
                .from('graph_nodes')
                .select('*')
                .eq('graph_name', this.currentGraphName);

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

        // MATCH (from)-[r]->(to) RETURN from, r, to
        if (cypherLower.includes('-[r]->') || cypherLower.includes('from)-[r]->(to)')) {
            const limitMatch = cypher.match(/limit\s+(\d+)/i);
            const limit = limitMatch ? parseInt(limitMatch[1]) : 100;

            const { data: rels, error: relError } = await this.supabase
                .from('graph_relationships')
                .select(`
                    id, from_id, to_id, type, properties,
                    from_node:graph_nodes!from_id(id, label, properties),
                    to_node:graph_nodes!to_id(id, label, properties)
                `)
                .eq('graph_name', this.currentGraphName)
                .limit(limit);

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
            await this.supabase
                .from('graph_relationships')
                .delete()
                .eq('graph_name', this.currentGraphName);
            
            await this.supabase
                .from('graph_nodes')
                .delete()
                .eq('graph_name', this.currentGraphName);

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

        // Silently ignore unsupported queries (don't spam logs)
        return { data: [], metadata: { warning: 'Query not fully supported' } };
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
                .eq('graph_name', this.currentGraphName)
                .textSearch('search_vector', query, { type: 'websearch' })
                .limit(limit);

            if (label) {
                dbQuery = dbQuery.eq('label', label);
            }

            const { data, error } = await dbQuery;

            if (error) {
                // Fallback to ILIKE search on properties
                const { data: fallbackData, error: fallbackError } = await this.supabase
                    .from('graph_nodes')
                    .select('*')
                    .eq('graph_name', this.currentGraphName)
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
            const { count: nodeCount, error: nodeError } = await this.supabase
                .from('graph_nodes')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (nodeError) throw nodeError;

            // Get relationship count
            const { count: relCount, error: relError } = await this.supabase
                .from('graph_relationships')
                .select('id', { count: 'exact', head: true })
                .eq('graph_name', this.currentGraphName);

            if (relError) throw relError;

            // Get label distribution
            const { data: labels } = await this.supabase
                .from('graph_nodes')
                .select('label')
                .eq('graph_name', this.currentGraphName);

            const labelCounts = {};
            (labels || []).forEach(r => {
                labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
            });

            // Get relationship type distribution
            const { data: relTypes } = await this.supabase
                .from('graph_relationships')
                .select('type')
                .eq('graph_name', this.currentGraphName);

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
            const { data: meetings, error: fetchError } = await this.supabase
                .from('graph_nodes')
                .select('id, properties')
                .eq('graph_name', this.currentGraphName)
                .eq('label', 'Meeting');

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

            console.log(`[SupabaseGraph] Cleaned up ${toDelete.length} duplicate Meeting nodes`);
            
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
            const { data: nodes } = await this.supabase
                .from('graph_nodes')
                .select('id')
                .eq('graph_name', this.currentGraphName);

            const nodeIds = new Set((nodes || []).map(n => n.id));

            // Get all relationships
            const { data: rels } = await this.supabase
                .from('graph_relationships')
                .select('id, from_id, to_id')
                .eq('graph_name', this.currentGraphName);

            // Find orphaned relationships
            const orphanedIds = (rels || [])
                .filter(r => !nodeIds.has(r.from_id) || !nodeIds.has(r.to_id))
                .map(r => r.id);

            if (orphanedIds.length === 0) {
                return { ok: true, deleted: 0, message: 'No orphaned relationships found' };
            }

            // Delete orphaned relationships
            const { error: deleteError } = await this.supabase
                .from('graph_relationships')
                .delete()
                .eq('graph_name', this.currentGraphName)
                .in('id', orphanedIds);

            if (deleteError) throw deleteError;

            console.log(`[SupabaseGraph] Cleaned up ${orphanedIds.length} orphaned relationships`);
            
            return { ok: true, deleted: orphanedIds.length };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }
}

module.exports = SupabaseGraphProvider;
