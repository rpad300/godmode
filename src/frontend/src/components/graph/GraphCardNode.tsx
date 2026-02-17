/**
 * Purpose:
 *   React Flow custom node component that delegates rendering to the
 *   appropriate tier-specific card component based on the node's tier value.
 *
 * Responsibilities:
 *   - Reads `data.tier` from the React Flow node props (defaults to tier 2)
 *   - Routes to GraphNodeTier0 (project hub), GraphNodeTier1 (primary
 *     entities), or GraphNodeTier2 (knowledge details)
 *
 * Key dependencies:
 *   - @xyflow/react (NodeProps): provides standard React Flow node props
 *   - GraphNodeTier0/1/2: tier-specific rendering components
 *   - GraphNode (graph types): typed node data shape
 *
 * Side effects:
 *   - None (pure delegation)
 *
 * Notes:
 *   - Wrapped in React.memo for render performance in large graphs.
 *   - The component is anonymous (no displayName); React DevTools will
 *     show it as "Anonymous".
 */
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { GraphNode } from '@/types/graph';
import { GraphNodeTier0 } from './node-cards/GraphNodeTier0';
import { GraphNodeTier1 } from './node-cards/GraphNodeTier1';
import { GraphNodeTier2 } from './node-cards/GraphNodeTier2';

export default memo((props: NodeProps<GraphNode>) => {
    const { data } = props;
    const tier = data.tier ?? 2;

    switch (tier) {
        case 0:
            return <GraphNodeTier0 {...props} />;
        case 1:
            return <GraphNodeTier1 {...props} />;
        case 2:
        default:
            return <GraphNodeTier2 {...props} />;
    }
});
