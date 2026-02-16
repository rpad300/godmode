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
