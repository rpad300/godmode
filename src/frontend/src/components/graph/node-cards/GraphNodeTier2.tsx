
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { GraphNode } from '@/types/graph';
import { GraphNodeFrame } from './GraphNodeFrame';
import { NodeContentRenderer } from './NodeContentRenderers';
import { getNodeTheme } from './node-styles';

// Tier 2 - Knowledge Details (Facts, Decisions, Risks, Actions, Questions, UserStories)
export const GraphNodeTier2 = memo((props: NodeProps<GraphNode>) => {
    const { data, selected } = props;
    const { label, type, _display } = data;
    const { width } = _display || { width: 220 };

    const nodeType = type || label || 'default';
    const theme = getNodeTheme(nodeType, 2);

    return (
        <GraphNodeFrame
            theme={theme}
            selected={selected}
            width={width}
        >
            <NodeContentRenderer type={nodeType} data={data} theme={theme} />
        </GraphNodeFrame>
    );
});

GraphNodeTier2.displayName = 'GraphNodeTier2';
