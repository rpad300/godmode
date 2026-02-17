/**
 * Purpose:
 *   Interactive React Flow visualization of the ontology schema, rendering
 *   entity types as draggable cards and relationship types as labeled edges.
 *
 * Responsibilities:
 *   - Converts OntologySchema entityTypes into React Flow nodes arranged
 *     in a grid layout (sqrt-based column count)
 *   - Converts relationTypes into smoothstep animated edges with arrow
 *     markers; handles array-typed from/to and filters out wildcards
 *   - EntityNode: custom node component showing entity name and up to 5
 *     property badges with types
 *   - Supports node dragging, edge connections (addEdge), minimap, and
 *     zoom controls
 *
 * Key dependencies:
 *   - @xyflow/react: ReactFlow, Controls, MiniMap, Background
 *   - OntologySchema (ontology types): schema shape with entityTypes
 *     and relationTypes
 *
 * Side effects:
 *   - None (receives schema as prop; graph state is local)
 *
 * Notes:
 *   - Grid layout spacing (250x200px) works well for up to ~20 entities;
 *     larger schemas may benefit from a force-directed layout.
 *   - Wildcard ('*') source/target entries are skipped.
 */
import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    BackgroundVariant,
    Connection,
    Edge,
    Node,
    MarkerType,
    NodeProps,
    Handle,
    Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EntityType, RelationshipType, OntologySchema } from '../../types/ontology';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OntologyVisualizerProps {
    schema: OntologySchema;
}

// Custom Node Component
const EntityNode = ({ data }: NodeProps) => {
    const properties = data.properties as Record<string, any>;
    return (
        <Card className="min-w-[180px] border shadow-sm bg-card">
            <div className="bg-muted/50 p-2 border-b font-bold text-center text-sm flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {data.label as string}
            </div>
            <div className="p-3 text-xs space-y-1.5">
                {Object.keys(properties).slice(0, 5).map(prop => (
                    <div key={prop} className="flex justify-between items-center gap-2">
                        <span className="font-mono text-muted-foreground">{prop}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {properties[prop].type}
                        </Badge>
                    </div>
                ))}
                {Object.keys(properties).length > 5 && (
                    <div className="text-muted-foreground text-[10px] italic text-center pt-1 border-t mt-1">
                        + {Object.keys(properties).length - 5} more
                    </div>
                )}
            </div>
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-muted-foreground" />
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-primary" />
        </Card>
    );
};

const nodeTypes = {
    entity: EntityNode,
};

export function OntologyVisualizer({ schema }: OntologyVisualizerProps) {

    // Convert Schema to Nodes and Edges
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];
        const entities = Object.keys(schema.entityTypes);

        // Simple Grid Layout Calculation
        const cols = Math.ceil(Math.sqrt(entities.length));
        const SPACING_X = 250;
        const SPACING_Y = 200;

        entities.forEach((name, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            nodes.push({
                id: name,
                type: 'entity',
                position: { x: col * SPACING_X, y: row * SPACING_Y },
                data: { label: name, properties: schema.entityTypes[name].properties },
            });
        });

        Object.entries(schema.relationTypes).forEach(([relName, relType]) => {
            const sources = Array.isArray(relType.from) ? relType.from : [relType.from];
            const targets = Array.isArray(relType.to) ? relType.to : [relType.to];

            sources.forEach(source => {
                targets.forEach(target => {
                    // Handle wildcard '*' options if necessary, for now assume explicit types
                    if (source === '*' || target === '*') return;

                    // Avoid self-loops for cleanliness unless explicit
                    // if (source === target) return; 

                    edges.push({
                        id: `${relName}-${source}-${target}`, // Unique ID
                        source: source,
                        target: target,
                        label: relName,
                        type: 'smoothstep',
                        animated: true,
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            width: 20,
                            height: 20,
                        },
                        style: { strokeWidth: 1.5, stroke: '#94a3b8' },
                        labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 10 },
                        labelBgStyle: { fill: '#f1f5f9', fillOpacity: 0.7 },
                    });
                });
            });
        });

        return { nodes, edges };
    }, [schema]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    return (
        <div className="w-full h-[600px] border rounded-lg bg-slate-50 dark:bg-slate-950/50">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                defaultEdgeOptions={{ type: 'smoothstep' }}
            >
                <Controls />
                <MiniMap
                    nodeColor={() => '#64748b'}
                    maskColor="rgba(0, 0, 0, 0.1)"
                    className="bg-background border rounded"
                />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}
