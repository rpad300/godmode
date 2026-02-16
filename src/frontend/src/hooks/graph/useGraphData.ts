import { useMemo } from 'react';
import { useGraphNodes } from './useGraphNodes';
import { useGraphEdges } from './useGraphEdges';
import { useGraphState } from '@/contexts/GraphContext'; // Wait, need to check import path
import { transformGraphData, TIER_CONFIG } from '@/lib/graph-transformer';
import { GraphNode, GraphEdge } from '@/types/graph';

// Context is in @/contexts/GraphContext
// Need to ensure GraphContext.tsx exports useGraphState

export function useGraphData() {
    const { filters } = useGraphState();

    // Compute active labels for server-side filtering
    const activeLabels = useMemo(() => {
        return Object.entries(filters.toggles)
            .filter(([_, isActive]) => isActive)
            .map(([type]) => type);
    }, [filters.toggles]);

    const { data: rawNodes, isLoading: nodesLoading, error: nodesError } = useGraphNodes(activeLabels);
    const { data: rawEdges, isLoading: edgesLoading, error: edgesError } = useGraphEdges();

    const { nodes, edges } = useMemo(() => {
        if (!rawNodes || !rawEdges) return { nodes: [], edges: [] };

        // 1. Transform raw data
        const { nodes: transformedNodes, edges: transformedEdges } = transformGraphData(rawNodes as GraphNode[], rawEdges as GraphEdge[]);

        // 1b. Deduplicate Tier 0 (Project) nodes - Enforce Singleton
        const tier0Indices = transformedNodes
            .map((n, i) => (n.data.tier === 0 ? i : -1))
            .filter(i => i !== -1);

        let nodesToProcess = transformedNodes;

        if (tier0Indices.length > 1) {
            // Keep only the first Tier 0 node, remove others
            const indicesToRemove = new Set(tier0Indices.slice(1));
            nodesToProcess = transformedNodes.filter((_, i) => !indicesToRemove.has(i));
        }

        // 2. Filter Nodes
        const filteredNodes = nodesToProcess.filter(node => {
            // Type toggle
            // Type toggle
            if (filters.toggles[node.label] === false) return false;

            // Tier
            if ((node.data.tier ?? 2) > filters.minTier) return false;

            // Search
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const label = node.data.label?.toLowerCase() || '';
                const type = node.label.toLowerCase();
                if (!label.includes(query) && !type.includes(query)) return false;
            }

            return true;
        });

        // 3. Filter Edges (keep edges only if both source/target exist in filtered nodes)
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = transformedEdges.filter(edge => {
            // Connectivity check
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;

            // Semantic check
            if (!filters.showSemantic && edge.label === 'SIMILAR_TO') return false;

            return true;
        });

        return { nodes: filteredNodes, edges: filteredEdges };
    }, [rawNodes, rawEdges, filters]);

    return {
        nodes,
        edges,
        isLoading: nodesLoading || edgesLoading,
        error: nodesError || edgesError
    };
}
