import React, { useCallback, useEffect } from 'react';
import { ReactFlow, Controls, Background, ReactFlowProvider, BackgroundVariant, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Share2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';


import { GraphProvider, useGraphState } from '@/contexts/GraphContext';
import { useGraphData } from '@/hooks/graph/useGraphData';
import { useGraphSync } from '@/hooks/graph/useGraphSync';
import { useGraphLayout } from '@/hooks/graph/useGraphLayout';
import GraphCardNode from '@/components/graph/GraphCardNode';
import { GraphSidePanel } from '@/components/graph/GraphSidePanel';
import { GraphToolbar } from '@/components/graph/GraphToolbar';
import { GraphStatusBar } from '@/components/graph/GraphStatusBar';
import { Button } from '@/components/ui/button';
import MultiEdge from '@/components/graph/MultiEdge';

const nodeTypes = {
  card: GraphCardNode,
  graphCard: GraphCardNode
};

const edgeTypes = {
  multi: MultiEdge
};

export default function GraphPage() {
  return (
    <GraphProvider>
      <div className="relative h-full w-full overflow-hidden bg-background" style={{ height: 'calc(100vh - 4rem)' }}>
        <ReactFlowProvider>
          <GraphPageContent />
        </ReactFlowProvider>
      </div>
    </GraphProvider>
  );
}

function GraphPageContent() {
  // ZOOM LOD LOGIC
  const [zoomLevel, setZoomLevel] = React.useState<'low' | 'med' | 'high'>('med');

  const {
    nodes: dataNodes,
    edges: dataEdges,
    isLoading: nodesLoading,
    error
  } = useGraphData();

  const { sync, isSyncing } = useGraphSync();
  const { setSelectedNodeId, selectedNodeId } = useGraphState();

  // Layout Logic
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(dataNodes, dataEdges);

  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onMove = useCallback((evt: any, viewport: any) => {
    const z = viewport.zoom;
    if (z < 0.6 && zoomLevel !== 'low') setZoomLevel('low');
    else if (z >= 0.6 && z < 1.2 && zoomLevel !== 'med') setZoomLevel('med');
    else if (z >= 1.2 && zoomLevel !== 'high') setZoomLevel('high');
  }, [zoomLevel]);

  // Sync Layout to React Flow
  useEffect(() => {
    if (!layoutedNodes) return;

    setNodes(layoutedNodes.map(n => ({
      ...n,
      type: 'card',
      selected: n.id === selectedNodeId,
      style: { ...n.style, opacity: 1 } // Reset opacity on data change
    })));

    setEdges(layoutedEdges.map(e => ({
      ...e,
      type: 'multi', // Always use multi-edge
      // styles come from transformer now
    })));
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, selectedNodeId]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // HOVER INTERACTIONS
  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: any) => {
    // 1. Identify connections
    const connectedEdgeIds = new Set<string>();
    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(node.id);

    edges.forEach((e) => {
      if (e.source === node.id || e.target === node.id) {
        connectedEdgeIds.add(e.id);
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      }
    });

    // 2. Dim/Highlight Nodes
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: connectedNodeIds.has(n.id) ? 1 : 0.15,
          transition: 'opacity 0.2s ease-in-out',
        },
      }))
    );

    // 3. Highlight Edges
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        animated: connectedEdgeIds.has(e.id) || e.data?.animated, // Keep existing animation or force it
        style: {
          ...e.style,
          opacity: connectedEdgeIds.has(e.id) ? 1 : 0.1,
          strokeWidth: connectedEdgeIds.has(e.id) ? 2.5 : (e.style?.strokeWidth || 1),
          zIndex: connectedEdgeIds.has(e.id) ? 999 : 0, // visual layering
        },
      }))
    );
  }, [edges, setNodes, setEdges]);

  const onNodeMouseLeave = useCallback(() => {
    // Reset to defaults
    // We rely on the transformer's initial state which is preserved in layoutedNodes/Edges? 
    // Actually, we modified state. We need to revert.
    // Simplest way: Re-apply the layouted state (triggering the effect might be too heavy? No, just local set)

    if (layoutedNodes) {
      setNodes(layoutedNodes.map(n => ({
        ...n,
        type: 'card',
        selected: n.id === selectedNodeId,
        style: { ...n.style, opacity: 1, transition: 'opacity 0.2s' }
      })));
    }

    if (layoutedEdges) {
      setEdges(layoutedEdges.map(e => ({
        ...e,
        type: 'multi',
        // Revert to original transformer styles
      })));
    }
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, selectedNodeId]);


  // 1. Loading State
  if (nodesLoading && (!dataNodes || dataNodes.length === 0)) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Loading Graph Topology...</span>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Failed to load graph</h3>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  // 3. Empty State
  if (!nodesLoading && dataNodes && dataNodes.length === 0) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center max-w-lg p-8 rounded-xl border bg-card/50">
          <div className="rounded-full bg-muted p-6">
            <Share2 className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold">Knowledge Graph is Empty</h3>
            <p className="text-muted-foreground">
              Sync your project data to visualize relationships between documents, tasks, and team members.
            </p>
          </div>
          <Button size="lg" onClick={() => sync()} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              'Start Sync'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // 4. Render Graph
  return (
    <>
      <div className={cn("absolute inset-0 z-0 transition-colors duration-500",
        zoomLevel === 'low' ? "graph-zoom-low" :
          zoomLevel === 'med' ? "graph-zoom-med" : "graph-zoom-high"
      )}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onMove={onMove} // Track zoom
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          proOptions={{ hideAttribution: true }}
          onlyRenderVisibleElements={true}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="hsl(var(--border))" />
          <Controls className="!bg-card !border-border !shadow-sm" />
        </ReactFlow>
      </div>

      <GraphToolbar />
      <GraphStatusBar />
      <GraphSidePanel edges={edges} />
    </>
  );
}
