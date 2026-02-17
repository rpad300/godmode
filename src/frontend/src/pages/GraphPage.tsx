import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Share2, RefreshCw, Loader2, Search, X, Filter, AlertTriangle,
} from 'lucide-react';
import { GraphProvider, useGraphState } from '../contexts/GraphContext';
import { useGraphData } from '../hooks/graph/useGraphData';
import { useGraphLayout } from '../hooks/graph/useGraphLayout';
import { useGraphSync } from '../hooks/graph/useGraphSync';
import { cn } from '../lib/utils';

const NODE_COLORS: Record<string, string> = {
  Project: '#6366f1', Person: '#ec4899', Team: '#8b5cf6',
  Document: '#06b6d4', Fact: '#f59e0b', Decision: '#a855f7',
  Risk: '#ef4444', Action: '#22c55e', Question: '#3b82f6',
  Email: '#f97316', Contact: '#ec4899', Sprint: '#14b8a6',
};

function GraphPageInner() {
  const { filters, setFilters, toggleType, selectedNodeId, setSelectedNodeId } = useGraphState();
  const { nodes: rawNodes, edges: rawEdges, isLoading, error } = useGraphData();
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(rawNodes, rawEdges);
  const { sync, isSyncing, status } = useGraphSync();
  const [showFilters, setShowFilters] = useState(false);

  // Convert to React Flow format
  const rfNodes: Node[] = useMemo(() =>
    layoutedNodes.map(n => ({
      id: n.id,
      position: n.position || { x: 0, y: 0 },
      data: { label: n.data?.label || n.id, type: n.label || n.data?.type || 'unknown', tier: n.data?.tier ?? 2 },
      type: 'default',
      style: {
        background: NODE_COLORS[n.label || ''] || '#64748b',
        color: '#fff',
        border: selectedNodeId === n.id ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: n.data?.tier === 0 ? '50%' : '12px',
        padding: n.data?.tier === 0 ? '16px' : '8px 12px',
        fontSize: n.data?.tier === 0 ? '14px' : n.data?.tier === 1 ? '12px' : '10px',
        fontWeight: n.data?.tier === 0 ? '700' : '500',
        width: n.data?.tier === 0 ? '80px' : 'auto',
        height: n.data?.tier === 0 ? '80px' : 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: selectedNodeId === n.id ? '0 0 20px rgba(99,102,241,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
      },
    })),
    [layoutedNodes, selectedNodeId]
  );

  const rfEdges: Edge[] = useMemo(() =>
    layoutedEdges.map(e => ({
      id: e.id, source: e.source, target: e.target,
      label: e.label || undefined,
      animated: e.animated || false,
      style: e.style || { stroke: 'rgba(148,163,184,0.4)', strokeWidth: 1 },
      type: 'default',
      labelStyle: { fontSize: '8px', fill: '#94a3b8' },
    })),
    [layoutedEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => { setNodes(rfNodes); }, [rfNodes]);
  useEffect(() => { setEdges(rfEdges); }, [rfEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
  }, [selectedNodeId, setSelectedNodeId]);

  const selectedNode = rawNodes.find(n => n.id === selectedNodeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">Knowledge Graph</h1>
        <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load graph. Try syncing.</p>
          <button onClick={() => sync()} className="mt-3 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Sync Graph</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">Knowledge Graph</h1>
          <span className="text-[10px] text-muted-foreground">{rawNodes.length} nodes · {rawEdges.length} edges</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="Search nodes..."
              className="pl-7 pr-3 py-1 bg-secondary border border-border rounded-lg text-[10px] text-foreground w-40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn('px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1', showFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary border-border text-muted-foreground')}>
            <Filter className="w-3 h-3" /> Filters
          </button>
          <button onClick={() => sync()} disabled={isSyncing} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
            {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex items-center gap-1.5 px-6 py-2 border-b border-border bg-secondary/30 flex-wrap">
          {Object.entries(filters.toggles).map(([type, active]) => (
            <button key={type} onClick={() => toggleType(type)} className={cn('px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border', active ? 'border-primary/30 text-foreground' : 'border-border text-muted-foreground/50 line-through')} style={{ backgroundColor: active ? `${NODE_COLORS[type] || '#64748b'}20` : undefined }}>
              {type}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex">
        <div className="flex-1 relative">
          {rawNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-muted-foreground">No graph data. Process documents and sync to populate.</p>
                <button onClick={() => sync()} className="mt-3 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Sync Graph</button>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView fitViewOptions={{ padding: 0.3 }}
              minZoom={0.1} maxZoom={3}
              proOptions={{ hideAttribution: true }}
              style={{ background: 'hsl(var(--background))' }}
            >
              <Background color="hsl(var(--border))" gap={24} size={1} />
              <Controls showInteractive={false} />
              <MiniMap nodeColor={(n) => NODE_COLORS[n.data?.type as string] || '#64748b'} />
            </ReactFlow>
          )}
        </div>

        {selectedNode && (
          <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground truncate">{selectedNode.data?.label || selectedNode.id}</h3>
              <button onClick={() => setSelectedNodeId(null)} className="p-1 rounded hover:bg-secondary"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Type</span>
                <p className="text-xs font-medium mt-0.5 px-2 py-0.5 rounded inline-block" style={{ backgroundColor: `${NODE_COLORS[selectedNode.label || ''] || '#64748b'}20`, color: NODE_COLORS[selectedNode.label || ''] || '#64748b' }}>
                  {selectedNode.label || selectedNode.data?.type || 'unknown'}
                </p>
              </div>
              {selectedNode.data?.tier !== undefined && (
                <div><span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tier</span><p className="text-xs text-foreground mt-0.5">{selectedNode.data.tier}</p></div>
              )}
              {selectedNode.data?.metadata && typeof selectedNode.data.metadata === 'object' && (
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Details</span>
                  <div className="mt-1 space-y-1">
                    {Object.entries(selectedNode.data.metadata as Record<string, unknown>).filter(([_, v]) => v != null && v !== '').slice(0, 8).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2 text-[10px]">
                        <span className="text-muted-foreground capitalize flex-shrink-0">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-foreground break-all">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Connections</span>
                <div className="mt-1 space-y-1">
                  {rawEdges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId).slice(0, 10).map(e => {
                    const otherId = e.source === selectedNodeId ? e.target : e.source;
                    const otherNode = rawNodes.find(n => n.id === otherId);
                    return (
                      <button key={e.id} onClick={() => setSelectedNodeId(otherId)} className="w-full text-left flex items-center gap-2 text-[10px] px-2 py-1 rounded hover:bg-secondary transition-colors">
                        <span className="text-muted-foreground truncate">{e.label || 'related'}</span>
                        <span className="text-foreground truncate">{otherNode?.data?.label || otherId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {status && (
        <div className="flex items-center gap-3 px-6 py-1.5 border-t border-border text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className={cn('w-1.5 h-1.5 rounded-full', status.health_status === 'healthy' ? 'bg-success' : status.health_status === 'degraded' ? 'bg-warning' : 'bg-destructive')} />
            {status.health_status}
          </div>
          {status.last_synced_at && <span>Synced: {new Date(status.last_synced_at).toLocaleString()}</span>}
          <span>{status.node_count} nodes</span>
          <span>{status.edge_count} edges</span>
        </div>
      )}
    </div>
  );
}

export default function GraphPage() {
  return (
    <GraphProvider>
      <GraphPageInner />
    </GraphProvider>
  );
}
