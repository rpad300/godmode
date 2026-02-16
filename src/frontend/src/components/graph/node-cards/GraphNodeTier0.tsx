
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
