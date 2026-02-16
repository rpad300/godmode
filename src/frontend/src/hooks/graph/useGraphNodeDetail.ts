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
