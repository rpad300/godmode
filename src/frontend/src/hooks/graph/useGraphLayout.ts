/**
 * Purpose:
 *   Computes concentric-circle positions for graph nodes based on their tier.
 *   Tier 0 (Project) sits at the centre, Tier 1 on an inner ring, Tier 2 on
 *   an outer ring. Radii scale dynamically to prevent node overlap.
 *
 * Responsibilities:
 *   - Partition nodes by tier (0, 1, 2)
 *   - Calculate minimum radius for each ring based on node count and item width
 *   - Distribute nodes evenly around each circle
 *   - Assign { x, y } positions on each node in-place
 *
 * Key dependencies:
 *   - @/types/graph: GraphNode, GraphEdge
 *
 * Side effects:
 *   - Mutates node.position in-place within the useMemo (safe because the array
 *     is only consumed downstream after layout)
 *
 * Notes:
 *   - Edges are passed through unchanged; layout only affects node positions.
 *   - Tier 2 ring is guaranteed to be at least 250px outside Tier 1 ring.
 *   - Nodes with no explicit tier default to tier 2 via (n.data.tier ?? 2).
 *
 * @param nodes - flat list of GraphNode (tier info in node.data.tier)
 * @param edges - flat list of GraphEdge (returned as-is)
 * @param options - center coordinates and base radii for tier 1 and tier 2
 * @returns {{ nodes: GraphNode[], edges: GraphEdge[] }}
 */
import { useMemo } from 'react';
import { GraphNode, GraphEdge } from '@/types/graph';

interface LayoutOptions {
    center: { x: number; y: number };
    tier1Radius: number;
    tier2Radius: number;
}

export function useGraphLayout(nodes: GraphNode[], edges: GraphEdge[], options: LayoutOptions = { center: { x: 0, y: 0 }, tier1Radius: 300, tier2Radius: 600 }) {

    const layoutedNodes = useMemo(() => {
        if (!nodes || nodes.length === 0) return [];

        const tier0 = nodes.filter(n => (n.data.tier ?? 2) === 0);
        const tier1 = nodes.filter(n => (n.data.tier ?? 2) === 1);
        const tier2 = nodes.filter(n => (n.data.tier ?? 2) === 2);

        // Dynamic Radius Calculation – sized for card-based nodes (200-280 px wide)
        const T1_ITEM_ARC = 260;
        const T2_ITEM_ARC = 260;
        const t1CircumferenceNeeded = Math.max(tier1.length * T1_ITEM_ARC, 1600);
        const t1Radius = Math.max(options.tier1Radius, t1CircumferenceNeeded / (2 * Math.PI));

        const t2CircumferenceNeeded = Math.max(tier2.length * T2_ITEM_ARC, 3200);
        const t2Radius = Math.max(options.tier2Radius, t1Radius + 400, t2CircumferenceNeeded / (2 * Math.PI));

        // 1. Position Tier 0 (Center)
        const centerNode = tier0[0];
        if (centerNode) {
            centerNode.position = { ...options.center };
        }

        // 2. Position Tier 1 (Circle 1)
        if (tier1.length > 0) {
            const angleStep = (2 * Math.PI) / tier1.length;
            tier1.forEach((node, i) => {
                const angle = i * angleStep;
                node.position = {
                    x: options.center.x + t1Radius * Math.cos(angle),
                    y: options.center.y + t1Radius * Math.sin(angle)
                };
            });
        }

        // 3. Position Tier 2 (Circle 2)
        if (tier2.length > 0) {
            const angleStep = (2 * Math.PI) / tier2.length;
            tier2.forEach((node, i) => {
                const angle = i * angleStep;
                node.position = {
                    x: options.center.x + t2Radius * Math.cos(angle),
                    y: options.center.y + t2Radius * Math.sin(angle)
                };
            });
        }

        return [...tier0, ...tier1, ...tier2];
    }, [nodes, options.center.x, options.center.y, options.tier1Radius, options.tier2Radius]);

    return { nodes: layoutedNodes, edges };
}
