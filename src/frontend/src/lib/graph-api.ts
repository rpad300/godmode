/**
 * Purpose:
 *   Data access layer for the knowledge graph. All operations go through
 *   the backend API (via apiClient) which uses the admin client, avoiding
 *   Supabase RLS issues on the frontend.
 *
 * Responsibilities:
 *   - getSyncStatus / triggerSync / triggerResync: orchestrate graph sync
 *   - getNodes / getEdges: fetch graph data via backend endpoints
 *   - getSemanticNeighbors: vector-similarity lookups via Supabase RPC
 *
 * Key dependencies:
 *   - lib/api-client: authenticated calls to /api/graphrag/* endpoints
 *   - lib/supabase: only used for RPC calls (semantic search)
 */
import { apiClient } from './api-client';
import { supabase } from './supabase';
import { GraphNode, GraphEdge, GraphSyncStatus } from '../types/graph';

export const graphApi = {
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

    getNodes: async (projectId: string, _labels?: string[]): Promise<GraphNode[]> => {
        const response = await apiClient.get<{ nodes: any[] }>(`/api/graphrag/nodes`, { params: { project_id: projectId } });
        const nodes = response.nodes || [];

        return nodes.map((n: any) => ({
            id: n.id,
            label: n.label,
            data: {
                ...n.properties,
                label: n.properties?.name || n.properties?.title || n.label,
                type: n.label,
                project_id: n.project_id
            },
            position: { x: 0, y: 0 }
        }));
    },

    getEdges: async (projectId: string): Promise<GraphEdge[]> => {
        const response = await apiClient.get<{ edges: any[] }>(`/api/graphrag/edges`, { params: { project_id: projectId } });
        const edges = response.edges || [];

        return edges.map((e: any) => ({
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
