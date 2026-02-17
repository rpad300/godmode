/**
 * Purpose:
 *   Tier 0 (Project Hub) graph node card — the largest and most prominent
 *   node type, representing top-level project entities in the knowledge graph.
 *
 * Responsibilities:
 *   - Extracts display width from node data (default 280px)
 *   - Applies the "Project" theme via getNodeTheme
 *   - Delegates visual rendering to GraphNodeFrame + NodeContentRenderer
 *
 * Key dependencies:
 *   - GraphNodeFrame: shared card wrapper with handles and accent bar
 *   - NodeContentRenderer: renders Project-specific body content
 *   - getNodeTheme: returns color theme for "Project" at tier 0
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Memoized for performance; displayName set for React DevTools.
 */
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { GraphNode } from '@/types/graph';
import { GraphNodeFrame } from './GraphNodeFrame';
import { NodeContentRenderer } from './NodeContentRenderers';
import { getNodeTheme } from './node-styles';

// Tier 0 - Project Hub
export const GraphNodeTier0 = memo((props: NodeProps<GraphNode>) => {
    const { data, selected } = props;
    const { type, _display } = data;
    const { width } = _display || { width: 280 };

    const theme = getNodeTheme('Project', 0);

    return (
        <GraphNodeFrame
            theme={theme}
            selected={selected}
            width={width}
        >
            <NodeContentRenderer type="Project" data={data} theme={theme} />
        </GraphNodeFrame>
    );
});

GraphNodeTier0.displayName = 'GraphNodeTier0';
