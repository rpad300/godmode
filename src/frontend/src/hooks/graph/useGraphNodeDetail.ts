/**
 * Purpose:
 *   Provides detailed data for the currently selected graph node, including
 *   its base properties (from the cached node list) and semantically similar
 *   neighbours fetched on demand via a Supabase RPC call.
 *
 * Responsibilities:
 *   - Resolve the selected node from the already-cached node list (avoids extra fetch)
 *   - Fetch semantic neighbours via graphApi.getSemanticNeighbors when a node is selected
 *   - Disable the neighbours query when no node is selected
 *
 * Key dependencies:
 *   - GraphContext (useGraphState): selectedNodeId
 *   - ProjectContext (useProject): currentProjectId
 *   - useGraphNodes: cached node list for local lookup
 *   - graphApi.getSemanticNeighbors: Supabase RPC (find_semantic_neighbors)
 *
 * Side effects:
 *   - Network request to Supabase RPC when a node is selected
 *
 * Notes:
 *   - Neighbours query has a 5-minute staleTime to avoid refetching on re-selection.
 *   - The RPC uses a cosine similarity threshold of 0.78 and a limit of 10.
 *
 * @returns {{ node, neighbors, isLoadingNeighbors }}
 */
import { useQuery } from '@tanstack/react-query';
import { useProject } from '@/contexts/ProjectContext';
import { useGraphState } from '@/contexts/GraphContext';
import { graphApi } from '@/lib/graph-api';
import { useGraphNodes } from './useGraphNodes';

export function useGraphNodeDetail() {
    const { currentProjectId } = useProject();
    const { selectedNodeId } = useGraphState();
    const { data: nodes } = useGraphNodes();

    // 1. Get Selected Node from local cache
    const selectedNode = nodes?.find(n => n.id === selectedNodeId) || null;

    // 2. Fetch Semantic Neighbors (RPC)
    const neighborsQuery = useQuery({
        queryKey: ['graph', 'neighbors', selectedNodeId, currentProjectId],
        queryFn: async () => {
            if (!selectedNodeId || !currentProjectId) return [];
            return await graphApi.getSemanticNeighbors(selectedNodeId, currentProjectId);
        },
        enabled: !!selectedNodeId && !!currentProjectId,
        staleTime: 5 * 60 * 1000,
    });

    return {
        node: selectedNode,
        neighbors: neighborsQuery.data || [],
        isLoadingNeighbors: neighborsQuery.isLoading
    };
}
