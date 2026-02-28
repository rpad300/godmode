import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Share2, RefreshCw, Loader2, Search, Filter, AlertTriangle,
  Sparkles, Code, BarChart3, Layers, Settings,
  Cpu, Link2, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Network, GitBranch, Circle, Sun, Orbit, Play, Pause,
  Download, HelpCircle, Users, X, Copy, Focus, Route,
  TrendingUp, Bookmark, FolderClosed, Clock, Save, Trash2,
} from 'lucide-react';
import { GraphProvider, useGraphState } from '../contexts/GraphContext';
import { useGraphData } from '../hooks/graph/useGraphData';
import { useSigmaGraph } from '../hooks/graph/useSigmaGraph';
import type { LayoutType } from '../hooks/graph/useSigmaGraph';
import { useGraphSync } from '../hooks/graph/useGraphSync';
import { cn } from '../lib/utils';
import { NODE_COLORS, toSigmaGraph, transformGraphData } from '../lib/graph-transformer';
import { GraphSidePanel } from '../components/graph/GraphSidePanel';
import GraphQueryBuilder from '../components/graph/GraphQueryBuilder';
import GraphAnalytics from '../components/graph/GraphAnalytics';
import GraphOntology from '../components/graph/GraphOntology';
import GraphCopilot from '../components/graph/GraphCopilot';
import GraphSettings from '../components/graph/GraphSettings';
import type { GraphLayoutType } from '../types/graph';
import louvain from 'graphology-communities-louvain';
import { bidirectional } from 'graphology-shortest-path';
import { connectedComponents } from 'graphology-components';

type Tab = 'explorer' | 'query' | 'analytics' | 'ontology' | 'settings';

const LAYOUT_OPTIONS: { key: GraphLayoutType; label: string; icon: typeof Network }[] = [
  { key: 'force', label: 'Force', icon: Network },
  { key: 'dagre', label: 'Hierarchy', icon: GitBranch },
  { key: 'concentric', label: 'Concentric', icon: Circle },
  { key: 'radial', label: 'Radial', icon: Sun },
  { key: 'forceAtlas2', label: 'Atlas', icon: Orbit },
];

const SHORTCUTS_INFO = [
  { key: 'Esc', action: 'Deselect / Close' },
  { key: '+', action: 'Zoom in' },
  { key: '-', action: 'Zoom out' },
  { key: '0', action: 'Reset view' },
  { key: 'F', action: 'Fullscreen' },
  { key: 'Shift+Click', action: 'Multi-select' },
  { key: 'Right-click', action: 'Context menu' },
];

// ---------------------------------------------------------------------------
// Context Menu
// ---------------------------------------------------------------------------

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

function GraphContextMenu({
  menu,
  onClose,
  onCopyLabel,
  onFocus,
  onSelectNeighbors,
  onPathFrom,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onCopyLabel: () => void;
  onFocus: () => void;
  onSelectNeighbors: () => void;
  onPathFrom: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const items = [
    { label: 'Copy Label', icon: Copy, action: onCopyLabel },
    { label: 'Focus Here', icon: Focus, action: onFocus },
    { label: 'Select Neighbors', icon: Users, action: onSelectNeighbors },
    { label: 'Find Path From Here', icon: Route, action: onPathFrom },
  ];

  return (
    <div
      ref={ref}
      className="absolute z-30 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.action(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <item.icon className="w-3.5 h-3.5 text-slate-400" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts Tooltip
// ---------------------------------------------------------------------------

function ShortcutsTooltip() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setShow(v => !v)}
        className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        title="Keyboard shortcuts"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-3 min-w-[200px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Keyboard Shortcuts</p>
          {SHORTCUTS_INFO.map(s => (
            <div key={s.key} className="flex items-center justify-between py-1">
              <kbd className="text-[10px] bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300 font-mono">{s.key}</kbd>
              <span className="text-[10px] text-slate-400 ml-3">{s.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph Explorer
// ---------------------------------------------------------------------------

function GraphExplorer() {
  const {
    filters, selectedNodeId, setSelectedNodeId, setHoveredNodeId,
    selectedNodeIds, toggleNodeInSelection, clearSelection,
    pathStartId, setPathStartId, pathEndId, setPathEndId,
    pathNodeIds, setPathNodeIds,
    communityMode, setCommunityMode,
    importanceMode,
  } = useGraphState();
  const { nodes: rawNodes, edges: rawEdges, isLoading, error } = useGraphData();
  const { sync } = useGraphSync();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(false);
  const stopLayoutRef = useRef<() => void>(() => {});
  const isLayoutRunningRef = useRef(false);

  // Track shift key globally
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const sigmaGraph = useMemo(() => {
    if (!rawNodes.length) return null;
    const { nodes, edges } = transformGraphData(rawNodes, rawEdges);
    return toSigmaGraph(nodes, edges, importanceMode);
  }, [rawNodes, rawEdges, importanceMode]);

  // Community detection
  const sigmaGraphWithCommunities = useMemo(() => {
    if (!sigmaGraph) return null;
    try {
      louvain.assign(sigmaGraph);
    } catch { /* ignore if graph is too small */ }
    return sigmaGraph;
  }, [sigmaGraph]);

  // Shortest path computation
  useEffect(() => {
    if (!pathStartId || !pathEndId || !sigmaGraphWithCommunities) {
      if (pathNodeIds.length > 0) setPathNodeIds([]);
      return;
    }
    try {
      const path = bidirectional(sigmaGraphWithCommunities, pathStartId, pathEndId);
      setPathNodeIds(path || []);
    } catch {
      setPathNodeIds([]);
    }
  }, [pathStartId, pathEndId, sigmaGraphWithCommunities]);

  // Search highlighting
  const searchHighlightIds = useMemo(() => {
    const ids = new Set<string>();
    const query = filters.searchQuery?.toLowerCase();
    if (!query || !sigmaGraphWithCommunities) return ids;
    sigmaGraphWithCommunities.forEachNode((node, attrs) => {
      const label = ((attrs.label as string) || '').toLowerCase();
      const type = ((attrs.nodeType as string) || '').toLowerCase();
      if (label.includes(query) || type.includes(query)) ids.add(node);
    });
    return ids;
  }, [filters.searchQuery, sigmaGraphWithCommunities]);

  // Graph stats
  const graphStats = useMemo(() => {
    const g = sigmaGraphWithCommunities;
    if (!g || g.order === 0) return null;
    const nodeCount = g.order;
    const edgeCount = g.size;
    const maxEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    let totalDegree = 0;
    g.forEachNode((node) => { totalDegree += g.degree(node); });
    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    let components = 0;
    try { components = connectedComponents(g).length; } catch { /* ignore */ }
    return { nodeCount, edgeCount, density, avgDegree, components };
  }, [sigmaGraphWithCommunities]);

  const handleNodeClick = useCallback((nodeId: string) => {
    // If in path finder mode and waiting for end node
    if (pathStartId && !pathEndId) {
      setPathEndId(nodeId);
      return;
    }

    if (shiftRef.current) {
      toggleNodeInSelection(nodeId);
      return;
    }

    // Stop FA2 layout so nodes don't move after selection
    if (isLayoutRunningRef.current) stopLayoutRef.current();

    clearSelection();
    setSelectedNodeId((prev: string | null) => prev === nodeId ? null : nodeId);
  }, [setSelectedNodeId, toggleNodeInSelection, clearSelection, pathStartId, pathEndId, setPathEndId]);

  const handleStageClick = useCallback(() => {
    setSelectedNodeId(null);
    clearSelection();
    setContextMenu(null);
  }, [setSelectedNodeId, clearSelection]);

  const handleNodeRightClick = useCallback((nodeId: string, screenX: number, screenY: number) => {
    setContextMenu({ nodeId, x: screenX, y: screenY });
  }, []);

  const {
    containerRef, minimapRef, fitView, zoomIn, zoomOut, focusNode,
    isLayoutRunning, startLayout, stopLayout, applyLayout,
    exportPNG, getNeighborIds, getNodeLabel, refreshSize,
    status: sigmaStatus, hoveredNode,
  } = useSigmaGraph(sigmaGraphWithCommunities, {
    onNodeClick: handleNodeClick,
    onNodeRightClick: handleNodeRightClick,
    onStageClick: handleStageClick,
    onNodeHover: setHoveredNodeId,
    selectedNodeId,
    selectedNodeIds,
    searchHighlightIds,
    pathNodeIds,
    communityMode,
  });

  // Keep refs in sync for use in callbacks defined before useSigmaGraph
  stopLayoutRef.current = stopLayout;
  isLayoutRunningRef.current = isLayoutRunning;

  // When side panel opens/closes, Sigma's container resizes -- tell it to recalculate
  useEffect(() => {
    const t = setTimeout(() => refreshSize(), 50);
    return () => clearTimeout(t);
  }, [selectedNodeId, refreshSize]);

  // Apply layout when layout type changes
  useEffect(() => {
    if (sigmaStatus === 'ready' && filters.layout) {
      applyLayout(filters.layout as LayoutType);
    }
  }, [filters.layout]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key) {
        case 'Escape':
          setSelectedNodeId(null);
          clearSelection();
          setContextMenu(null);
          setPathStartId(null);
          setPathEndId(null);
          setPathNodeIds([]);
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          fitView();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, fitView, setSelectedNodeId, clearSelection, setPathStartId, setPathEndId, setPathNodeIds]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Context menu actions
  const handleCopyLabel = useCallback(() => {
    if (!contextMenu) return;
    const label = getNodeLabel(contextMenu.nodeId);
    navigator.clipboard.writeText(label).catch(() => {});
  }, [contextMenu, getNodeLabel]);

  const handleFocusNode = useCallback(() => {
    if (!contextMenu) return;
    focusNode(contextMenu.nodeId);
  }, [contextMenu, focusNode]);

  const handleSelectNeighbors = useCallback(() => {
    if (!contextMenu) return;
    const neighbors = getNeighborIds(contextMenu.nodeId);
    toggleNodeInSelection(contextMenu.nodeId);
    neighbors.forEach(id => toggleNodeInSelection(id));
  }, [contextMenu, getNeighborIds, toggleNodeInSelection]);

  const handlePathFrom = useCallback(() => {
    if (!contextMenu) return;
    setPathStartId(contextMenu.nodeId);
    setPathEndId(null);
    setPathNodeIds([]);
  }, [contextMenu, setPathStartId, setPathEndId, setPathNodeIds]);

  const clearPath = useCallback(() => {
    setPathStartId(null);
    setPathEndId(null);
    setPathNodeIds([]);
  }, [setPathStartId, setPathEndId, setPathNodeIds]);

  const legendTypes = Object.entries(NODE_COLORS).filter(([type]) =>
    rawNodes.some(n => (n.label || n.data?.type) === type)
  );

  const showOverlay = isLoading || !!error || rawNodes.length === 0 || (sigmaStatus !== 'ready' && rawNodes.length > 0);

  return (
    <div ref={wrapperRef} className="flex-1 flex overflow-hidden bg-slate-950">
      <div className="flex-1 relative dark">
        <div ref={containerRef} className="w-full h-full bg-slate-950" style={{ cursor: 'grab' }} />

        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
            <div className="pointer-events-auto text-center">
              {isLoading && (
                <Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary mx-auto" />
              )}
              {!isLoading && error && (
                <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-6">
                  <AlertTriangle className="h-10 w-10 text-gm-status-danger mx-auto mb-3" />
                  <p className="text-xs text-slate-400 mb-3">Failed to load graph. Try syncing.</p>
                  <button onClick={() => sync()} className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium">Sync Graph</button>
                </div>
              )}
              {!isLoading && !error && rawNodes.length === 0 && (
                <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-6">
                  <Share2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-sm text-slate-400 mb-1">No graph data yet</p>
                  <p className="text-xs text-gray-500 mb-3">Process documents and sync to populate the knowledge graph</p>
                  <button onClick={() => sync()} className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover transition-colors">Sync Graph</button>
                </div>
              )}
              {!isLoading && !error && rawNodes.length > 0 && (sigmaStatus === 'initializing' || sigmaStatus === 'waiting-data') && (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-300">Initializing graph engine...</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Hover Tooltip */}
        {hoveredNode && !selectedNodeId && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 border border-slate-600 rounded-lg px-3 py-2 shadow-xl"
            style={{ left: hoveredNode.screenX + 16, top: hoveredNode.screenY - 10, maxWidth: 240 }}
          >
            <p className="text-xs font-semibold text-slate-100 truncate">{hoveredNode.label}</p>
            {hoveredNode.type && <p className="text-[10px] text-slate-400 mt-0.5">{hoveredNode.type}</p>}
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <GraphContextMenu
            menu={contextMenu}
            onClose={() => setContextMenu(null)}
            onCopyLabel={handleCopyLabel}
            onFocus={handleFocusNode}
            onSelectNeighbors={handleSelectNeighbors}
            onPathFrom={handlePathFrom}
          />
        )}

        {/* Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
          <button onClick={zoomIn} className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" title="Zoom in (+)">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={zoomOut} className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" title="Zoom out (-)">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={fitView} className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors" title="Reset view (0)">
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-full h-px bg-slate-700 my-0.5" />
          <button
            onClick={isLayoutRunning ? stopLayout : startLayout}
            className={cn('p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg transition-colors',
              isLayoutRunning ? 'text-amber-400 hover:text-amber-300' : 'text-slate-300 hover:text-white hover:bg-slate-800')}
            title={isLayoutRunning ? 'Stop layout' : 'Run layout'}
          >
            {isLayoutRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="w-full h-px bg-slate-700 my-0.5" />
          <button
            onClick={() => setCommunityMode(!communityMode)}
            className={cn('p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg transition-colors',
              communityMode ? 'text-purple-400 hover:text-purple-300 border-purple-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800')}
            title={communityMode ? 'Disable community colors' : 'Color by community'}
          >
            <Users className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen}
            className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={exportPNG}
            className="p-1.5 bg-slate-900/90 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="Export as PNG"
          >
            <Download className="w-4 h-4" />
          </button>
          <div className="w-full h-px bg-slate-700 my-0.5" />
          <ShortcutsTooltip />
        </div>

        {/* Layout running indicator */}
        {isLayoutRunning && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 border border-amber-500/30 rounded-full px-3 py-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-amber-300 font-medium">Layout optimizing...</span>
          </div>
        )}

        {/* Search match count */}
        {searchHighlightIds.size > 0 && (
          <div className="absolute top-3 left-3 z-10 bg-cyan-900/80 border border-cyan-500/30 rounded-full px-3 py-1">
            <span className="text-[10px] text-cyan-200 font-medium">{searchHighlightIds.size} matches</span>
          </div>
        )}

        {/* Multi-select indicator */}
        {selectedNodeIds.size > 1 && (
          <div className="absolute top-10 left-3 z-10 bg-indigo-900/80 border border-indigo-500/30 rounded-full px-3 py-1 flex items-center gap-2">
            <span className="text-[10px] text-indigo-200 font-medium">{selectedNodeIds.size} selected</span>
            <button onClick={clearSelection} className="text-indigo-300 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Path finder status */}
        {pathStartId && (
          <div className="absolute bottom-14 left-3 z-10 bg-green-900/80 border border-green-500/30 rounded-lg px-3 py-2 max-w-[240px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-green-200 font-bold uppercase">Path Finder</span>
              <button onClick={clearPath} className="text-green-300 hover:text-white"><X className="w-3 h-3" /></button>
            </div>
            <p className="text-[10px] text-green-300 truncate">From: {getNodeLabel(pathStartId)}</p>
            {pathEndId ? (
              <p className="text-[10px] text-green-300 truncate">To: {getNodeLabel(pathEndId)}</p>
            ) : (
              <p className="text-[10px] text-green-400 italic">Click a node to set destination</p>
            )}
            {pathNodeIds.length > 0 && (
              <p className="text-[10px] text-green-200 mt-1 font-medium">{pathNodeIds.length - 1} hops</p>
            )}
            {pathEndId && pathNodeIds.length === 0 && (
              <p className="text-[10px] text-red-400 mt-1">No path found</p>
            )}
          </div>
        )}

        {/* Legend */}
        {legendTypes.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-2.5 flex flex-wrap gap-x-3 gap-y-1.5 max-w-xs z-10">
            {legendTypes.map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-slate-400">{type}</span>
              </div>
            ))}
          </div>
        )}

        {/* Minimap */}
        <canvas
          ref={minimapRef}
          width={200}
          height={140}
          className="absolute bottom-3 right-3 z-10 rounded-lg border border-slate-700 bg-slate-950/80 backdrop-blur-sm"
          style={{ width: 200, height: 140 }}
        />
      </div>

      {selectedNodeId && <GraphSidePanel edges={rawEdges} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved Views (localStorage-based)
// ---------------------------------------------------------------------------

interface SavedViewLocal {
  id: string;
  name: string;
  filters: any;
  timestamp: number;
}

const SAVED_VIEWS_KEY = 'godmode_graph_saved_views';

function loadSavedViews(): SavedViewLocal[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedViews(views: SavedViewLocal[]) {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
}

// ---------------------------------------------------------------------------
// Search Autocomplete
// ---------------------------------------------------------------------------

function SearchAutocomplete({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: { id: string; label: string; type: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return suggestions
      .filter(s => s.label.toLowerCase().includes(q) || s.type.toLowerCase().includes(q))
      .slice(0, 12);
  }, [value, suggestions]);

  const showDropdown = focused && filtered.length > 0;

  useEffect(() => {
    if (!focused) {
      const t = setTimeout(() => setOpen(false), 150);
      return () => clearTimeout(t);
    }
    setOpen(true);
  }, [focused]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search nodes..."
        aria-label="Search graph nodes"
        className="pl-7 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-[11px] text-gm-text-primary w-44 focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
      />
      {open && showDropdown && (
        <div ref={listRef} className="absolute top-full left-0 mt-1 z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl w-64 max-h-[240px] overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); onChange(s.label); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[s.type] || '#64748b' }} />
              <span className="truncate">{s.label}</span>
              <span className="ml-auto text-[9px] text-slate-500">{s.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time Slider
// ---------------------------------------------------------------------------

function TimeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
}) {
  const range = max - min;
  if (range <= 0) return null;

  const current = value || [min, max];
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

  return (
    <div className="flex items-center gap-2">
      <Clock className="w-3.5 h-3.5 text-gm-text-tertiary shrink-0" />
      <span className="text-[10px] text-gm-text-tertiary shrink-0">{formatDate(current[0])}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={current[0]}
        onChange={e => onChange([Number(e.target.value), current[1]])}
        className="w-20 h-1 accent-blue-500 cursor-pointer"
        title="Start date"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={current[1]}
        onChange={e => onChange([current[0], Number(e.target.value)])}
        className="w-20 h-1 accent-blue-500 cursor-pointer"
        title="End date"
      />
      <span className="text-[10px] text-gm-text-tertiary shrink-0">{formatDate(current[1])}</span>
      {value && (
        <button onClick={() => onChange(null)} className="text-slate-400 hover:text-white" title="Clear time filter">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph Page Inner (header, tabs, filter bar, status bar)
// ---------------------------------------------------------------------------

function GraphPageInner() {
  const {
    filters, setFilters, toggleType, selectedNodeId, communityMode,
    importanceMode, setImportanceMode, toggleCollapsedType,
  } = useGraphState();
  const { nodes: rawNodes, edges: rawEdges } = useGraphData();
  const { sync, isSyncing, status } = useGraphSync();
  const [tab, setTab] = useState<Tab>('explorer');
  const [showFilters, setShowFilters] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedViewLocal[]>(loadSavedViews);
  const [viewName, setViewName] = useState('');

  // Compute graph stats from the actual rendered graph for the status bar
  const graphStats = useMemo(() => {
    if (!rawNodes.length) return null;
    const nodeCount = rawNodes.length;
    const edgeCount = rawEdges.length;
    const maxEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    return { nodeCount, edgeCount, density };
  }, [rawNodes, rawEdges]);

  // Search autocomplete suggestions
  const searchSuggestions = useMemo(() => {
    return rawNodes.map(n => ({
      id: n.id,
      label: n.data?.label || n.label || n.id,
      type: n.label || 'unknown',
    }));
  }, [rawNodes]);

  // Time range bounds (min/max timestamp of all nodes)
  const timeRangeBounds = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const n of rawNodes) {
      const ts = n.data?.created_at || n.data?.updated_at || n.data?.date;
      if (ts) {
        const t = new Date(ts).getTime();
        if (!isNaN(t)) {
          if (t < min) min = t;
          if (t > max) max = t;
        }
      }
    }
    return min < max ? { min, max } : null;
  }, [rawNodes]);

  // Groupable types (those with more than 2 nodes)
  const groupableTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of rawNodes) {
      const type = n.label || '';
      if (type) counts.set(type, (counts.get(type) || 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [rawNodes]);

  // Saved views
  const handleSaveView = useCallback(() => {
    if (!viewName.trim()) return;
    const view: SavedViewLocal = {
      id: Date.now().toString(36),
      name: viewName.trim(),
      filters: {
        toggles: filters.toggles,
        layout: filters.layout,
        searchQuery: filters.searchQuery,
        minTier: filters.minTier,
        showSemantic: filters.showSemantic,
        collapsedTypes: Array.from(filters.collapsedTypes),
        timeRange: filters.timeRange,
      },
      timestamp: Date.now(),
    };
    const next = [view, ...savedViews].slice(0, 20);
    setSavedViews(next);
    persistSavedViews(next);
    setViewName('');
  }, [viewName, filters, savedViews]);

  const handleLoadView = useCallback((view: SavedViewLocal) => {
    const cfg = view.filters;
    setFilters(prev => ({
      ...prev,
      toggles: cfg.toggles || prev.toggles,
      layout: cfg.layout || prev.layout,
      searchQuery: cfg.searchQuery || '',
      minTier: cfg.minTier ?? prev.minTier,
      showSemantic: cfg.showSemantic ?? prev.showSemantic,
      collapsedTypes: new Set<string>(cfg.collapsedTypes || []),
      timeRange: cfg.timeRange || null,
    }));
    setShowViews(false);
  }, [setFilters]);

  const handleDeleteView = useCallback((id: string) => {
    const next = savedViews.filter(v => v.id !== id);
    setSavedViews(next);
    persistSavedViews(next);
  }, [savedViews]);

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
          <h1 className="text-sm font-bold text-gm-text-primary">Knowledge Graph</h1>
          <span className="text-[11px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full">
            {rawNodes.length} nodes · {rawEdges.length} edges
          </span>
          {communityMode && (
            <span className="text-[11px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              Communities
            </span>
          )}
          {importanceMode && (
            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              PageRank
            </span>
          )}
          {filters.collapsedTypes.size > 0 && (
            <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {filters.collapsedTypes.size} grouped
            </span>
          )}
          {filters.timeRange && (
            <span className="text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              Time filtered
            </span>
          )}
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
              <div className="flex bg-gm-surface-secondary rounded-lg border border-gm-border-primary overflow-hidden">
                {LAYOUT_OPTIONS.map(lo => {
                  const LoIcon = lo.icon;
                  return (
                    <button key={lo.key}
                      onClick={() => setFilters(prev => ({ ...prev, layout: lo.key }))}
                      title={lo.label}
                      className={cn('px-2 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors',
                        filters.layout === lo.key ? 'bg-blue-600/20 text-blue-400' : 'text-gm-text-tertiary hover:text-gm-text-primary')}
                    >
                      <LoIcon className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">{lo.label}</span>
                    </button>
                  );
                })}
              </div>

              <SearchAutocomplete
                value={filters.searchQuery}
                onChange={v => setFilters(prev => ({ ...prev, searchQuery: v }))}
                suggestions={searchSuggestions}
              />
              <button onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors',
                  showFilters ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary')}>
                <Filter className="w-3.5 h-3.5" /> Filters
              </button>
              <button
                onClick={() => setImportanceMode(!importanceMode)}
                className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors',
                  importanceMode ? 'bg-amber-600/10 border-amber-500/30 text-amber-400' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary')}
                title={importanceMode ? 'Disable PageRank sizing' : 'Size nodes by importance (PageRank)'}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Rank
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowViews(!showViews)}
                  className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors',
                    showViews ? 'bg-blue-600/10 border-blue-600/30 text-gm-interactive-primary' : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary')}
                  title="Saved views"
                >
                  <Bookmark className="w-3.5 h-3.5" /> Views
                </button>
                {showViews && (
                  <div className="absolute right-0 top-full mt-1 z-40 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-3 min-w-[220px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Saved Views</p>
                    <div className="flex gap-1 mb-2">
                      <input
                        value={viewName}
                        onChange={e => setViewName(e.target.value)}
                        placeholder="View name..."
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-[11px] text-slate-200 focus:outline-none"
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveView(); }}
                      />
                      <button onClick={handleSaveView} className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-medium hover:bg-blue-500" disabled={!viewName.trim()}>
                        <Save className="w-3 h-3" />
                      </button>
                    </div>
                    {savedViews.length === 0 && (
                      <p className="text-[10px] text-slate-500 italic">No saved views yet</p>
                    )}
                    {savedViews.map(v => (
                      <div key={v.id} className="flex items-center justify-between py-1 group">
                        <button
                          onClick={() => handleLoadView(v)}
                          className="text-[11px] text-slate-300 hover:text-white truncate flex-1 text-left"
                        >
                          {v.name}
                        </button>
                        <span className="text-[9px] text-slate-600 mx-1">{new Date(v.timestamp).toLocaleDateString()}</span>
                        <button onClick={() => handleDeleteView(v.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
        <div className="border-b border-gm-border-primary bg-[var(--gm-surface-hover)] shrink-0">
          {/* Type toggles */}
          <div className="flex items-center gap-1.5 px-5 py-2 flex-wrap">
            {Object.entries(filters.toggles).map(([type, active]) => (
              <button key={type} onClick={() => toggleType(type)}
                className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border',
                  active ? 'border-current/20 text-gm-text-primary' : 'border-gm-border-primary text-gray-500 line-through')}
                style={{ backgroundColor: active ? `${NODE_COLORS[type] || '#64748b'}15` : undefined, color: active ? NODE_COLORS[type] || '#64748b' : undefined }}>
                {type}
              </button>
            ))}
          </div>
          {/* Group / Time row */}
          <div className="flex items-center gap-3 px-5 py-1.5 border-t border-gm-border-primary/50 flex-wrap">
            {/* Grouping */}
            {groupableTypes.length > 0 && (
              <div className="flex items-center gap-1">
                <FolderClosed className="w-3.5 h-3.5 text-gm-text-tertiary" />
                <span className="text-[10px] text-gm-text-tertiary mr-1">Group:</span>
                {groupableTypes.map(g => (
                  <button
                    key={g.type}
                    onClick={() => toggleCollapsedType(g.type)}
                    className={cn('px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                      filters.collapsedTypes.has(g.type)
                        ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300'
                        : 'bg-gm-surface-secondary border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary'
                    )}
                  >
                    {g.type} ({g.count})
                  </button>
                ))}
              </div>
            )}
            {/* Time slider */}
            {timeRangeBounds && (
              <TimeSlider
                min={timeRangeBounds.min}
                max={timeRangeBounds.max}
                value={filters.timeRange}
                onChange={v => setFilters(prev => ({ ...prev, timeRange: v }))}
              />
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'explorer' && <GraphExplorer />}
        {tab === 'query' && <div className="flex-1 bg-gm-surface-primary"><GraphQueryBuilder /></div>}
        {tab === 'analytics' && <div className="flex-1 bg-gm-surface-primary"><GraphAnalytics /></div>}
        {tab === 'ontology' && <div className="flex-1 bg-gm-surface-primary"><GraphOntology /></div>}
        {tab === 'settings' && <div className="flex-1 bg-gm-surface-primary"><GraphSettings /></div>}
      </div>

      {/* Status Bar (enriched) */}
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
          {graphStats && (
            <>
              <span className="text-slate-500">|</span>
              <span>Density: {(graphStats.density * 100).toFixed(1)}%</span>
            </>
          )}
          {selectedNodeId && <span className="text-blue-400">Selected: {selectedNodeId.slice(0, 8)}...</span>}
          <span className="ml-auto text-[10px] text-slate-500">Layout: {filters.layout}</span>
        </div>
      )}

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
