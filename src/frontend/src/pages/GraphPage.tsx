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
  Sparkles, Code, BarChart3, Layers, Cpu, Link2, GitBranch,
  Maximize2, ChevronRight, Settings,
} from 'lucide-react';
import { GraphProvider, useGraphState } from '../contexts/GraphContext';
import { useGraphData } from '../hooks/graph/useGraphData';
import { useGraphLayout } from '../hooks/graph/useGraphLayout';
import { useGraphSync } from '../hooks/graph/useGraphSync';
import { cn } from '../lib/utils';
import GraphQueryBuilder from '../components/graph/GraphQueryBuilder';
import GraphAnalytics from '../components/graph/GraphAnalytics';
import GraphOntology from '../components/graph/GraphOntology';
import GraphCopilot from '../components/graph/GraphCopilot';
import GraphSettings from '../components/graph/GraphSettings';

const NODE_COLORS: Record<string, string> = {
  Project: '#6366f1', Person: '#ec4899', Team: '#8b5cf6',
  Document: '#06b6d4', Fact: '#f59e0b', Decision: '#a855f7',
  Risk: '#ef4444', Action: '#22c55e', Question: '#3b82f6',
  Email: '#f97316', Contact: '#ec4899', Sprint: '#14b8a6',
};

type Tab = 'explorer' | 'query' | 'analytics' | 'ontology' | 'settings';

function GraphPageInner() {
  const { filters, setFilters, toggleType, selectedNodeId, setSelectedNodeId } = useGraphState();
  const { nodes: rawNodes, edges: rawEdges, isLoading, error } = useGraphData();
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(rawNodes, rawEdges);
  const { sync, isSyncing, status } = useGraphSync();
  const [tab, setTab] = useState<Tab>('explorer');
  const [showFilters, setShowFilters] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);

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
        cursor: 'pointer',
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
    setDetailCollapsed(false);
  }, [selectedNodeId, setSelectedNodeId]);

  const selectedNode = rawNodes.find(n => n.id === selectedNodeId);
  const selectedEdges = rawEdges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);

  const tabList: { key: Tab; label: string; icon: typeof Share2 }[] = [
    { key: 'explorer', label: 'Explorer', icon: Share2 },
    { key: 'query', label: 'Query', icon: Code },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'ontology', label: 'Ontology', icon: Layers },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gm-border-primary bg-gm-surface-primary shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-gm-text-primary">Knowledge Graph</h1>
          <span className="text-[10px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full">
            {rawNodes.length} nodes · {rawEdges.length} edges
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex bg-gm-surface-secondary rounded-lg border border-gm-border-primary overflow-hidden" role="tablist">
            {tabList.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  role="tab" aria-selected={tab === t.key}
                  className={cn('px-3 py-1.5 text-[10px] font-medium flex items-center gap-1 transition-colors',
                    tab === t.key ? 'bg-gm-interactive-primary text-gm-text-on-brand' : 'text-gm-text-tertiary hover:text-gm-text-primary')}>
                  <Icon className="w-3 h-3" /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'explorer' && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gm-text-tertiary" />
                <input
                  value={filters.searchQuery}
                  onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  placeholder="Search nodes..."
                  aria-label="Search graph nodes"
                  className="pl-7 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-[10px] text-gm-text-primary w-36 focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
                />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className={cn('px-2 py-1.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition-colors',
                  showFilters ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary')}>
                <Filter className="w-3 h-3" /> Filters
              </button>
            </>
          )}

          <button onClick={() => sync()} disabled={isSyncing}
            aria-label="Sync knowledge graph"
            className="px-2.5 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-[10px] font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1 disabled:opacity-50 transition-colors">
            {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync
          </button>
          <button onClick={() => setShowCopilot(!showCopilot)}
            aria-expanded={showCopilot}
            className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors border',
              showCopilot ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
            <Sparkles className="w-3 h-3" /> AI Copilot
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && tab === 'explorer' && (
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-gm-border-primary bg-[var(--gm-surface-hover)] flex-wrap shrink-0">
          {Object.entries(filters.toggles).map(([type, active]) => (
            <button key={type} onClick={() => toggleType(type)}
              className={cn('px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border',
                active ? 'border-current/20 text-gm-text-primary' : 'border-gm-border-primary text-gray-500 line-through')}
              style={{ backgroundColor: active ? `${NODE_COLORS[type] || '#64748b'}15` : undefined, color: active ? NODE_COLORS[type] || '#64748b' : undefined }}>
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'explorer' && (
          <>
            {/* Graph Canvas */}
            <div className="flex-1 relative">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <AlertTriangle className="h-10 w-10 text-gm-status-danger mx-auto mb-3" />
                    <p className="text-xs text-gm-text-tertiary mb-3">Failed to load graph. Try syncing.</p>
                    <button onClick={() => sync()} className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium">Sync Graph</button>
                  </div>
                </div>
              ) : rawNodes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Share2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-sm text-gm-text-tertiary mb-1">No graph data yet</p>
                    <p className="text-xs text-gray-400 mb-3">Process documents and sync to populate the knowledge graph</p>
                    <button onClick={() => sync()} className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover transition-colors">Sync Graph</button>
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
                  className="bg-gm-surface-primary"
                >
                  <Background color="rgba(148,163,184,0.15)" gap={24} size={1} />
                  <Controls showInteractive={false} className="!bg-gm-surface-secondary !border-gm-border-primary !rounded-lg !shadow-lg" />
                  <MiniMap nodeColor={(n) => NODE_COLORS[n.data?.type as string] || '#64748b'}
                    className="!bg-gm-surface-secondary !border-gm-border-primary !rounded-lg" />
                </ReactFlow>
              )}

              {/* Legend */}
              {rawNodes.length > 0 && (
                <div className="absolute bottom-14 left-3 bg-gm-surface-primary backdrop-blur-sm border border-gm-border-primary rounded-lg p-2 flex flex-wrap gap-x-3 gap-y-1 max-w-xs">
                  {Object.entries(NODE_COLORS).filter(([type]) => rawNodes.some(n => (n.label || n.data?.type) === type)).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[9px] text-gm-text-tertiary">{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail Panel */}
            {selectedNode && !detailCollapsed && (
              <div className="w-72 border-l border-gm-border-primary bg-gm-surface-primary overflow-y-auto shrink-0">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gm-text-primary truncate">{selectedNode.data?.label || selectedNode.id}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => setDetailCollapsed(true)} aria-label="Collapse detail panel" className="p-1 rounded hover:bg-gm-surface-secondary"><ChevronRight className="w-3.5 h-3.5 text-gm-text-tertiary" /></button>
                      <button onClick={() => setSelectedNodeId(null)} aria-label="Close detail panel" className="p-1 rounded hover:bg-gm-surface-secondary"><X className="w-3.5 h-3.5 text-gm-text-tertiary" /></button>
                    </div>
                  </div>

                  {/* Type badge */}
                  <div>
                    <span className="text-[10px] font-medium text-gm-text-tertiary uppercase tracking-wider">Type</span>
                    <p className="text-xs font-medium mt-0.5 px-2 py-0.5 rounded inline-block"
                      style={{ backgroundColor: `${NODE_COLORS[selectedNode.label || ''] || '#64748b'}20`, color: NODE_COLORS[selectedNode.label || ''] || '#64748b' }}>
                      {selectedNode.label || selectedNode.data?.type || 'unknown'}
                    </p>
                  </div>

                  {selectedNode.data?.tier !== undefined && (
                    <div>
                      <span className="text-[10px] font-medium text-gm-text-tertiary uppercase tracking-wider">Tier</span>
                      <p className="text-xs text-gm-text-primary mt-0.5">{selectedNode.data.tier}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedNode.data?.metadata && typeof selectedNode.data.metadata === 'object' && (
                    <div>
                      <span className="text-[10px] font-medium text-gm-text-tertiary uppercase tracking-wider">Details</span>
                      <div className="mt-1.5 space-y-1.5">
                        {Object.entries(selectedNode.data.metadata as Record<string, unknown>).filter(([_, v]) => v != null && v !== '').slice(0, 10).map(([key, val]) => (
                          <div key={key} className="text-[10px]">
                            <span className="text-gm-text-tertiary capitalize">{key.replace(/_/g, ' ')}</span>
                            <p className="text-gm-text-primary break-all mt-0.5">{String(val).substring(0, 200)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connections */}
                  <div>
                    <span className="text-[10px] font-medium text-gm-text-tertiary uppercase tracking-wider flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Connections ({selectedEdges.length})
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {selectedEdges.slice(0, 15).map(e => {
                        const otherId = e.source === selectedNodeId ? e.target : e.source;
                        const otherNode = rawNodes.find(n => n.id === otherId);
                        const otherType = otherNode?.label || otherNode?.data?.type || '';
                        return (
                          <button key={e.id} onClick={() => { setSelectedNodeId(otherId); setDetailCollapsed(false); }}
                            className="w-full text-left flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg hover:bg-gm-surface-secondary transition-colors">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[otherType] || '#64748b' }} />
                            <span className="text-gm-text-tertiary truncate">{e.label || 'related'}</span>
                            <span className="text-gm-text-primary truncate">{otherNode?.data?.label || otherId}</span>
                          </button>
                        );
                      })}
                      {selectedEdges.length > 15 && <p className="text-[10px] text-gm-text-tertiary text-center">+{selectedEdges.length - 15} more</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Collapsed detail indicator */}
            {selectedNode && detailCollapsed && (
              <button onClick={() => setDetailCollapsed(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-16 bg-gm-surface-secondary border border-gm-border-primary rounded-l-lg flex items-center justify-center hover:bg-gm-surface-hover transition-colors"
                style={{ borderColor: NODE_COLORS[selectedNode.label || ''] || '#64748b' }}>
                <ChevronRight className="w-3 h-3 text-gm-text-tertiary rotate-180" />
              </button>
            )}
          </>
        )}

        {tab === 'query' && (
          <div className="flex-1 bg-gm-surface-primary">
            <GraphQueryBuilder />
          </div>
        )}

        {tab === 'analytics' && (
          <div className="flex-1 bg-gm-surface-primary">
            <GraphAnalytics />
          </div>
        )}

        {tab === 'ontology' && (
          <div className="flex-1 bg-gm-surface-primary">
            <GraphOntology />
          </div>
        )}

        {tab === 'settings' && (
          <div className="flex-1 bg-gm-surface-primary">
            <GraphSettings />
          </div>
        )}
      </div>

      {/* Status Bar */}
      {status && (
        <div className="flex items-center gap-3 px-5 py-1.5 border-t border-gm-border-primary text-[10px] text-gm-text-tertiary bg-gm-surface-secondary shrink-0">
          <div className="flex items-center gap-1">
            <div className={cn('w-1.5 h-1.5 rounded-full',
              status.health_status === 'healthy' ? 'bg-gm-status-success' :
              status.health_status === 'degraded' ? 'bg-gm-status-warning' : 'bg-gm-status-danger')} />
            <span className="capitalize">{status.health_status}</span>
          </div>
          {status.last_synced_at && <span>Synced: {new Date(status.last_synced_at).toLocaleString()}</span>}
          <span className="flex items-center gap-0.5"><Cpu className="w-3 h-3" /> {status.node_count} nodes</span>
          <span className="flex items-center gap-0.5"><Link2 className="w-3 h-3" /> {status.edge_count} edges</span>
        </div>
      )}

      {/* AI Copilot */}
      <GraphCopilot open={showCopilot} onClose={() => setShowCopilot(false)} />
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
