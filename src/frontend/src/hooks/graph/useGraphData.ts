/**
 * Purpose:
 *   Composes raw graph nodes and edges with the current filter state to produce
 *   the final, display-ready lists consumed by the graph visualisation layer.
 *
 * Responsibilities:
 *   - Derive activeLabels from filter toggles and pass them to useGraphNodes
 *   - Transform raw data through graph-transformer (tier assignment, styling, Person/Contact merge)
 *   - Deduplicate Tier 0 (Project) nodes to enforce a single centre node
 *   - Apply client-side filters: type toggles, tier threshold, search query
 *   - Remove edges whose source or target was filtered out, and hide SIMILAR_TO when disabled
 *
 * Key dependencies:
 *   - useGraphNodes / useGraphEdges: server data fetching
 *   - GraphContext (useGraphState): current filter state
 *   - graph-transformer: transformGraphData for styling, tier config, Person/Contact merging
 *
 * Side effects:
 *   - None (pure derivation via useMemo)
 *
 * Notes:
 *   - Re-computes only when rawNodes, rawEdges, or filters change.
 *   - Tier filtering uses (node.data.tier ?? 2) > filters.minTier, so unknown tiers
 *     default to 2 and are hidden when minTier < 2.
 *
 * @returns {{ nodes, edges, isLoading, error }}
 */
import { useMemo } from 'react';
import { useGraphNodes } from './useGraphNodes';
import { useGraphEdges } from './useGraphEdges';
import { useGraphState } from '@/contexts/GraphContext';
import { transformGraphData, TIER_CONFIG } from '@/lib/graph-transformer';
import { GraphNode, GraphEdge } from '@/types/graph';

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
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
            if (!filters.showSemantic && (edge.data?.originalLabel === 'SIMILAR_TO' || edge.label === 'SIMILAR_TO')) return false;
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
