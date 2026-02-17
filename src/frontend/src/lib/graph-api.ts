/**
 * Purpose:
 *   Data access layer for the knowledge graph. Combines two transport
 *   strategies: backend API calls (via apiClient) for sync operations,
 *   and direct Supabase queries for read-heavy data access (nodes, edges,
 *   semantic neighbours).
 *
 * Responsibilities:
 *   - getSyncStatus / triggerSync / triggerResync: orchestrate graph sync via backend
 *   - getNodes / getEdges: fetch graph data directly from Supabase tables for low latency
 *   - getSemanticNeighbors: invoke a Supabase RPC (find_semantic_neighbors) for
 *     vector-similarity lookups
 *
 * Key dependencies:
 *   - lib/api-client: authenticated calls to /api/graphrag/* endpoints
 *   - lib/supabase: direct PostgREST queries to graph_nodes, graph_relationships,
 *     and RPC for embedding-based similarity search
 *
 * Side effects:
 *   - Network requests to both the backend API and Supabase
 *
 * Notes:
 *   - getNodes maps DB rows to the GraphNode shape expected by React Flow,
 *     initialising position to {0,0} since layout is computed client-side.
 *   - getEdges maps from_id/to_id to source/target to match React Flow convention.
 *   - Semantic neighbour search defaults: threshold 0.78, limit 10.
 */
import { apiClient } from './api-client';
import { supabase } from './supabase';
import { GraphNode, GraphEdge, GraphSyncStatus } from '../types/graph';

export const graphApi = {
    // --- Sync Operations (via Backend API) ---

    getSyncStatus: async (projectId: string): Promise<GraphSyncStatus> => {
        const response = await apiClient.get<any>(`/api/graphrag/sync-status`, { params: { project_id: projectId } });
        return response.status || response;
    },

    triggerSync: async (projectId: string) => {
        return apiClient.post(`/api/graphrag/sync`, { project_id: projectId });
    },

    triggerResync: async (projectId: string) => {
        return apiClient.post(`/api/graphrag/resync`, { project_id: projectId });
    },

    // --- Data Operations (via Supabase Direct) ---

    getNodes: async (projectId: string, labels?: string[]): Promise<GraphNode[]> => {
        let query = supabase
            .from('graph_nodes')
            .select('*')
            .eq('project_id', projectId);

        if (labels && labels.length > 0) {
            query = query.in('label', labels);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Map to frontend structure if needed, or assume DB structure matches
        return (data || []).map((n: any) => ({
            id: n.id,
            label: n.label,
            data: {
                ...n.properties,
                label: n.properties.name || n.properties.title || n.label,
                type: n.label,
                project_id: n.project_id
            },
            position: { x: 0, y: 0 } // Layout will calculate this
        }));
    },

    getEdges: async (projectId: string): Promise<GraphEdge[]> => {
        const { data, error } = await supabase
            .from('graph_relationships')
            .select('*')
            .eq('project_id', projectId);

        if (error) throw error;

        return (data || []).map((e: any) => ({
            id: e.id,
            source: e.from_id,
            target: e.to_id,
            label: e.type,
            data: e.properties
        }));
    },

    getSemanticNeighbors: async (entityId: string, projectId: string, threshold = 0.78, limit = 10) => {
        const { data, error } = await supabase.rpc('find_semantic_neighbors', {
            p_entity_id: entityId,
            p_project_id: projectId,
            p_threshold: threshold,
            p_limit: limit
        });

        if (error) throw error;
        return data || [];
    }
};
