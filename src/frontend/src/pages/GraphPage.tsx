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
  Share2, RefreshCw, Loader2, Search, Filter, AlertTriangle,
  Sparkles, Code, BarChart3, Layers, Settings,
  Cpu, Link2,
} from 'lucide-react';
import { GraphProvider, useGraphState } from '../contexts/GraphContext';
import { useGraphData } from '../hooks/graph/useGraphData';
import { useGraphLayout } from '../hooks/graph/useGraphLayout';
import { useGraphSync } from '../hooks/graph/useGraphSync';
import { cn } from '../lib/utils';
import { NODE_COLORS } from '../lib/graph-transformer';
import GraphCardNode from '../components/graph/GraphCardNode';
import MultiEdge from '../components/graph/MultiEdge';
import { GraphSidePanel } from '../components/graph/GraphSidePanel';
import GraphQueryBuilder from '../components/graph/GraphQueryBuilder';
import GraphAnalytics from '../components/graph/GraphAnalytics';
import GraphOntology from '../components/graph/GraphOntology';
import GraphCopilot from '../components/graph/GraphCopilot';
import GraphSettings from '../components/graph/GraphSettings';

const nodeTypes = { graphCard: GraphCardNode };
const edgeTypes = { multiEdge: MultiEdge };

type Tab = 'explorer' | 'query' | 'analytics' | 'ontology' | 'settings';

function GraphPageInner() {
  const { filters, setFilters, toggleType, selectedNodeId, setSelectedNodeId } = useGraphState();
  const { nodes: rawNodes, edges: rawEdges, isLoading, error } = useGraphData();
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(rawNodes, rawEdges);
  const { sync, isSyncing, status } = useGraphSync();
  const [tab, setTab] = useState<Tab>('explorer');
  const [showFilters, setShowFilters] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  const rfNodes: Node[] = useMemo(() =>
    layoutedNodes.map(n => ({
      id: n.id,
      position: n.position || { x: 0, y: 0 },
      data: {
        ...n.data,
        label: n.data?.label || n.id,
        type: n.label || n.data?.type || 'unknown',
        tier: n.data?.tier ?? 2,
      },
      type: 'graphCard',
      selected: selectedNodeId === n.id,
    })),
    [layoutedNodes, selectedNodeId]
  );

  const rfEdges: Edge[] = useMemo(() =>
    layoutedEdges.map(e => ({
      id: e.id, source: e.source, target: e.target,
      animated: e.animated || false,
      style: e.style || { stroke: 'rgba(148,163,184,0.4)', strokeWidth: 1 },
      type: 'multiEdge',
      data: e.data,
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

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const tabList: { key: Tab; label: string; icon: typeof Share2 }[] = [
    { key: 'explorer', label: 'Explorer', icon: Share2 },
    { key: 'query', label: 'Query', icon: Code },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'ontology', label: 'Ontology', icon: Layers },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  const legendTypes = useMemo(() =>
    Object.entries(NODE_COLORS).filter(([type]) => rawNodes.some(n => (n.label || n.data?.type) === type)),
    [rawNodes]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gm-border-primary bg-gm-surface-primary shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-gm-text-primary">Knowledge Graph</h1>
          <span className="text-[11px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full">
            {rawNodes.length} nodes · {rawEdges.length} edges
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gm-surface-secondary rounded-lg border border-gm-border-primary overflow-hidden" role="tablist">
            {tabList.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  role="tab" aria-selected={tab === t.key}
                  className={cn('px-3 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors',
                    tab === t.key ? 'bg-gm-interactive-primary text-gm-text-on-brand' : 'text-gm-text-tertiary hover:text-gm-text-primary')}>
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'explorer' && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
                <input
                  value={filters.searchQuery}
                  onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  placeholder="Search nodes..."
                  aria-label="Search graph nodes"
                  className="pl-7 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-[11px] text-gm-text-primary w-40 focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
                />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors',
                  showFilters ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary')}>
                <Filter className="w-3.5 h-3.5" /> Filters
              </button>
            </>
          )}

          <button onClick={() => sync()} disabled={isSyncing}
            aria-label="Sync knowledge graph"
            className="px-2.5 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-[11px] font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1 disabled:opacity-50 transition-colors">
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync
          </button>
          <button onClick={() => setShowCopilot(!showCopilot)}
            aria-expanded={showCopilot}
            className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors border',
              showCopilot ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary')}>
            <Sparkles className="w-3.5 h-3.5" /> AI Copilot
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && tab === 'explorer' && (
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-gm-border-primary bg-[var(--gm-surface-hover)] flex-wrap shrink-0">
          {Object.entries(filters.toggles).map(([type, active]) => (
            <button key={type} onClick={() => toggleType(type)}
              className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border',
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
            {/* Graph Canvas -- forced dark background for node contrast */}
            <div className="flex-1 relative dark">
              {isLoading ? (
                <div className="flex items-center justify-center h-full bg-slate-950">
                  <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full bg-slate-950">
                  <div className="text-center">
                    <AlertTriangle className="h-10 w-10 text-gm-status-danger mx-auto mb-3" />
                    <p className="text-xs text-slate-400 mb-3">Failed to load graph. Try syncing.</p>
                    <button onClick={() => sync()} className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium">Sync Graph</button>
                  </div>
                </div>
              ) : rawNodes.length === 0 ? (
                <div className="flex items-center justify-center h-full bg-slate-950">
                  <div className="text-center">
                    <Share2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-sm text-slate-400 mb-1">No graph data yet</p>
                    <p className="text-xs text-gray-500 mb-3">Process documents and sync to populate the knowledge graph</p>
                    <button onClick={() => sync()} className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover transition-colors">Sync Graph</button>
                  </div>
                </div>
              ) : (
                <ReactFlow
                  nodes={nodes} edges={edges}
                  nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  nodesFocusable edgesFocusable
                  fitView fitViewOptions={{ padding: 0.3 }}
                  minZoom={0.1} maxZoom={3}
                  proOptions={{ hideAttribution: true }}
                  className="bg-slate-950"
                >
                  <Background color="rgba(148,163,184,0.1)" gap={24} size={1} />
                  <Controls showInteractive={false} className="!bg-slate-900 !border-slate-700 !rounded-lg !shadow-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700" />
                  <MiniMap nodeColor={(n) => NODE_COLORS[n.data?.type as string] || '#64748b'}
                    className="!bg-slate-900 !border-slate-700 !rounded-lg" maskColor="rgba(15,23,42,0.7)" />
                </ReactFlow>
              )}

              {/* Legend */}
              {rawNodes.length > 0 && (
                <div className="absolute bottom-14 left-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-2.5 flex flex-wrap gap-x-3 gap-y-1.5 max-w-xs">
                  {legendTypes.map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-slate-400">{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Side Panel for selected node -- uses rich component */}
            {selectedNodeId && (
              <GraphSidePanel edges={rawEdges} />
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
        <div className="flex items-center gap-3 px-5 py-1.5 border-t border-gm-border-primary text-[11px] text-gm-text-tertiary bg-gm-surface-secondary shrink-0">
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
