/**
 * Purpose:
 *   Fetches graph nodes for the active project, optionally filtered by label.
 *
 * Responsibilities:
 *   - Query Supabase (via graphApi.getNodes) for nodes matching the current project
 *   - Include labels in the query key so React Query refetches when filters change
 *   - Keep previous data visible while new filter results load (placeholderData)
 *
 * Key dependencies:
 *   - ProjectContext (useProject): supplies currentProjectId
 *   - lib/graph-api (graphApi.getNodes): Supabase direct query
 *
 * Side effects:
 *   - Network request to Supabase (graph_nodes table)
 *
 * Notes:
 *   - Disabled when no project is selected. StaleTime is 5 minutes.
 *   - keepPreviousData prevents the graph from flashing empty on filter change.
 *
 * @param labels - optional array of node type labels to include (server-side filter)
 * @returns React Query result with GraphNode[]
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useProject } from '@/contexts/ProjectContext';
import { graphApi } from '@/lib/graph-api';
import { GraphNode } from '@/types/graph';

export function useGraphNodes(labels?: string[]) {
    const { currentProjectId } = useProject();

    return useQuery<GraphNode[]>({
        queryKey: ['graph', 'nodes', currentProjectId],
        queryFn: async () => {
            if (!currentProjectId) return [];
            return await graphApi.getNodes(currentProjectId);
        },
        enabled: !!currentProjectId,
        staleTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData,
    });
}
