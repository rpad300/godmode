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
import type { GraphNode, GraphEdge } from '@/types/graph';

export function useGraphData() {
    const { filters } = useGraphState();

    // Fetch ALL nodes from server (no server-side label filtering).
    // Client-side filtering in the useMemo below handles type toggles.
    // This avoids missing node types not listed in DEFAULT_FILTERS.
    const { data: rawNodes, isLoading: nodesLoading, error: nodesError } = useGraphNodes();
    const { data: rawEdges, isLoading: edgesLoading, error: edgesError } = useGraphEdges();

    const { nodes, edges } = useMemo(() => {
        if (!rawNodes || !rawEdges) return { nodes: [], edges: [] };

        // 1. Transform raw data
        const { nodes: transformedNodes, edges: transformedEdges } = transformGraphData(rawNodes as GraphNode[], rawEdges as GraphEdge[]);

        // 1b. Deduplicate Project nodes - keep only one Project node
        const projectIndices = transformedNodes
            .map((n, i) => (n.label === 'Project' ? i : -1))
            .filter(i => i !== -1);

        let nodesToProcess = transformedNodes;

        if (projectIndices.length > 1) {
            const indicesToRemove = new Set(projectIndices.slice(1));
            nodesToProcess = transformedNodes.filter((_, i) => !indicesToRemove.has(i));
        }

        // 2. Filter Nodes
        const filteredNodes = nodesToProcess.filter(node => {
            // Type toggle
            if (filters.toggles[node.label || ''] === false) return false;

            // Tier
            if ((node.data.tier ?? 2) > filters.minTier) return false;

            // Search
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const label = node.data.label?.toLowerCase() || '';
                const type = (node.label || '').toLowerCase();
                if (!label.includes(query) && !type.includes(query)) return false;
            }

            // Time range filter
            if (filters.timeRange) {
                const [minTs, maxTs] = filters.timeRange;
                const ts = node.data.created_at || node.data.updated_at || node.data.date;
                if (ts) {
                    const nodeTs = new Date(ts).getTime();
                    if (!isNaN(nodeTs) && (nodeTs < minTs || nodeTs > maxTs)) return false;
                }
            }

            return true;
        });

        // 2b. Node Grouping -- collapse types into super-nodes
        const collapsedTypes = filters.collapsedTypes;
        let groupedNodes = filteredNodes;
        let groupedEdges = transformedEdges;
        const superNodeMap = new Map<string, string>();

        if (collapsedTypes.size > 0) {
            const superNodes: GraphNode[] = [];
            const kept: GraphNode[] = [];
            const typeCounts = new Map<string, number>();

            for (const n of filteredNodes) {
                const type = n.label || '';
                if (collapsedTypes.has(type)) {
                    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
                    superNodeMap.set(n.id, `__group_${type}`);
                } else {
                    kept.push(n);
                }
            }

            for (const [type, count] of typeCounts) {
                const superNodeId = `__group_${type}`;
                superNodes.push({
                    id: superNodeId,
                    label: type,
                    data: {
                        label: `${type} (${count})`,
                        type,
                        tier: TIER_CONFIG[type] ?? 2,
                        _isGroup: true,
                        _groupCount: count,
                        _display: { width: 200, height: 80, colorToken: type.toLowerCase() },
                    },
                });
            }

            groupedNodes = [...kept, ...superNodes];

            const groupNodeIds = new Set(groupedNodes.map(n => n.id));
            const seenEdgeKeys = new Set<string>();
            const rewired: GraphEdge[] = [];

            for (const e of transformedEdges) {
                let src = superNodeMap.get(e.source) || e.source;
                let tgt = superNodeMap.get(e.target) || e.target;
                if (src === tgt) continue;
                if (!groupNodeIds.has(src) || !groupNodeIds.has(tgt)) continue;
                const key = `${src}__${tgt}__${e.data?.originalLabel || ''}`;
                if (seenEdgeKeys.has(key)) continue;
                seenEdgeKeys.add(key);
                rewired.push({ ...e, id: key, source: src, target: tgt });
            }
            groupedEdges = rewired;
        }

        // 3. Filter Edges (keep edges only if both source/target exist in final nodes)
        const nodeIds = new Set(groupedNodes.map(n => n.id));
        const filteredEdges = groupedEdges.filter(edge => {
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
            if (!filters.showSemantic && (edge.data?.originalLabel === 'SIMILAR_TO' || edge.label === 'SIMILAR_TO')) return false;
            return true;
        });

        return { nodes: groupedNodes, edges: filteredEdges };
    }, [rawNodes, rawEdges, filters]);

    return {
        nodes,
        edges,
        isLoading: nodesLoading || edgesLoading,
        error: nodesError || edgesError
    };
}
