
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { GraphNode } from '@/types/graph';
import { GraphNodeFrame } from './GraphNodeFrame';
import { NodeContentRenderer } from './NodeContentRenderers';
import { getNodeTheme } from './node-styles';

// Tier 1 - Primary Entities (Document, Person, Contact, Team, Sprint, Email, CalendarEvent)
export const GraphNodeTier1 = memo((props: NodeProps<GraphNode>) => {
    const { data, selected } = props;
    const { label, type, _display } = data;
    // Default width can be adjusted based on type if needed, user snippet had 200 min width usually
    const { width } = _display || { width: 220 };

    // Determine type for theme lookup
    const nodeType = type || label || 'default';
    const theme = getNodeTheme(nodeType, 1);

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

GraphNodeTier1.displayName = 'GraphNodeTier1';
