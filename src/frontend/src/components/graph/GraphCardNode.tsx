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
