/**
 * Purpose:
 *   Fetches all graph edges (relationships) for the active project.
 *
 * Responsibilities:
 *   - Query Supabase (via graphApi.getEdges) for the current project's relationships
 *   - Cache results with a 5-minute staleTime to reduce redundant fetches
 *
 * Key dependencies:
 *   - ProjectContext (useProject): supplies currentProjectId
 *   - lib/graph-api (graphApi.getEdges): Supabase direct query
 *
 * Side effects:
 *   - Network request to Supabase (graph_relationships table)
 *
 * Notes:
 *   - Unlike useGraphNodes, edges are not filtered server-side by type;
 *     client-side filtering happens in useGraphData.
 *   - Disabled when no project is selected.
 *
 * @returns React Query result with GraphEdge[]
 */
import { useQuery } from '@tanstack/react-query';
import { useProject } from '@/contexts/ProjectContext';
import { graphApi } from '@/lib/graph-api';
import { GraphEdge } from '@/types/graph';

export function useGraphEdges() {
    const { currentProjectId } = useProject();

    return useQuery<GraphEdge[]>({
        queryKey: ['graph', 'edges', currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            return await graphApi.getEdges(currentProjectId);
        },
        enabled: !!currentProjectId,
        staleTime: 5 * 60 * 1000,
    });
}
