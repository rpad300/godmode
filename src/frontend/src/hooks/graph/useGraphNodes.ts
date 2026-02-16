import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useProject } from '@/contexts/ProjectContext';
import { graphApi } from '@/lib/graph-api';
import { GraphNode } from '@/types/graph';

export function useGraphNodes(labels?: string[]) {
    const { currentProjectId } = useProject();

    return useQuery<GraphNode[]>({
        queryKey: ['graph', 'nodes', currentProjectId, labels], // Include labels in key
        queryFn: async () => {
            if (!currentProjectId) return [];
            return await graphApi.getNodes(currentProjectId, labels);
        },
        enabled: !!currentProjectId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: keepPreviousData, // Keep old data while fetching new filter set
    });
}
