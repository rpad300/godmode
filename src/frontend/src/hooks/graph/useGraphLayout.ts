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

        // Dynamic Radius Calculation
        // Tier 1 (People/Teams) - Item width approx 80px (w-16 + gap)
        const t1CircumferenceNeeded = Math.max(tier1.length * 100, 1000);
        const t1Radius = Math.max(options.tier1Radius, t1CircumferenceNeeded / (2 * Math.PI));

        // Tier 2 (Docs/Actions) - Item width approx 40px (small dot + gap)
        // Ensure Tier 2 is at least 200px outside Tier 1
        const t2CircumferenceNeeded = Math.max(tier2.length * 50, 2000);
        const t2Radius = Math.max(options.tier2Radius, t1Radius + 250, t2CircumferenceNeeded / (2 * Math.PI));

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
