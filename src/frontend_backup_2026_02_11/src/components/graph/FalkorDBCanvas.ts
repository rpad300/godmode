/**
 * FalkorDBCanvas - Integration with @falkordb/canvas web component
 * 
 * A high-quality graph visualization using the official FalkorDB canvas library.
 * Provides better performance and nicer visuals than vis.js.
 */

import { createElement, on } from '@lib/dom';
import { graphService, GraphNode, GraphEdge } from '@services/graph';
import { toast } from '@services/toast';
import { fetchWithProject } from '@services/api';

// Type definitions for falkordb-canvas
interface FalkorDBCanvasNode {
  id: string | number;
  labels: string[];
  color: string;
  visible: boolean;
  size?: number;
  caption?: string;
  data: Record<string, unknown>;
}

interface FalkorDBCanvasLink {
  id: string | number;
  relationship: string;
  color: string;
  source: string | number;
  target: string | number;
  visible: boolean;
  data: Record<string, unknown>;
}

interface FalkorDBCanvasData {
  nodes: FalkorDBCanvasNode[];
  links: FalkorDBCanvasLink[];
}

interface FalkorDBCanvasElement extends HTMLElement {
  setData: (data: FalkorDBCanvasData) => void;
  getData: () => FalkorDBCanvasData;
  setConfig: (config: Record<string, unknown>) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setBackgroundColor: (color: string) => void;
  setForegroundColor: (color: string) => void;
  setIsLoading: (loading: boolean) => void;
  zoomToFit: (padding?: number) => void;
  getZoom: () => number;
  zoom: (level: number) => void;
}

export interface FalkorDBCanvasProps {
  onNodeClick?: (node: GraphNode) => void;
  onNodeRightClick?: (node: GraphNode) => void;
  onLinkClick?: (edge: GraphEdge) => void;
  onDataLoaded?: (stats: { nodeCount: number; edgeCount: number }) => void;
  height?: number;
}

// Color mapping for node types
const TYPE_COLORS: Record<string, string> = {
  Person: '#6366f1',      // Indigo
  Organization: '#8b5cf6', // Purple
  Project: '#10b981',     // Emerald
  Meeting: '#f59e0b',     // Amber
  Document: '#3b82f6',    // Blue
  Fact: '#22c55e',        // Green
  Decision: '#06b6d4',    // Cyan
  Risk: '#ef4444',        // Red
  Task: '#14b8a6',        // Teal
  Question: '#f97316',    // Orange
  Technology: '#eab308',  // Yellow
  Client: '#ec4899',      // Pink
  Team: '#84cc16',        // Lime
  Regulation: '#a3a3a3',  // Gray
  Answer: '#22d3ee',      // Light cyan
  Email: '#60a5fa',       // Light blue
  Conversation: '#c084fc', // Light purple
  Action: '#4ade80',      // Light green
  Briefing: '#fbbf24',    // Light amber
};

// Store original nodes for click callbacks
let originalNodes: Map<string, GraphNode> = new Map();
let originalEdges: Map<string, GraphEdge> = new Map();

/**
 * Create the FalkorDB Canvas component
 */
export function createFalkorDBCanvas(props: FalkorDBCanvasProps = {}): HTMLElement {
  const container = createElement('div', { className: 'falkordb-canvas-container' });

  container.innerHTML = `
    <div class="falkordb-canvas-wrapper" style="--graph-height: ${props.height || 500}px;">
      <div class="falkordb-canvas-loading">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading graph data...</p>
      </div>
      <falkordb-canvas id="falkordb-graph"></falkordb-canvas>
    </div>
    <div class="falkordb-canvas-controls">
      <button class="btn btn-sm" id="fdb-zoom-in" title="Zoom In">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="fdb-zoom-out" title="Zoom Out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="fdb-fit" title="Fit to View">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="fdb-refresh" title="Refresh Data">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>
    <div class="falkordb-canvas-legend">
      <h5>Legend</h5>
      <div id="fdb-legend">
        <!-- Legend items will be added dynamically -->
      </div>
    </div>
  `;

  // Initialize after DOM is ready
  setTimeout(() => initCanvas(container, props), 100);

  return container;
}

/**
 * Initialize the canvas
 */
async function initCanvas(container: HTMLElement, props: FalkorDBCanvasProps): Promise<void> {
  // Import the web component
  try {
    await import('@falkordb/canvas');
  } catch (e) {
    console.error('[FalkorDBCanvas] Failed to load @falkordb/canvas:', e);
    toast.error('Failed to load graph visualization library');
    return;
  }

  const canvasEl = container.querySelector('#falkordb-graph') as FalkorDBCanvasElement;
  const loadingEl = container.querySelector('.falkordb-canvas-loading') as HTMLElement;
  const legendEl = container.querySelector('#fdb-legend') as HTMLElement;

  if (!canvasEl) {
    console.error('[FalkorDBCanvas] Canvas element not found');
    return;
  }

  // Get container dimensions
  const wrapper = container.querySelector('.falkordb-canvas-wrapper') as HTMLElement;
  const width = wrapper.clientWidth || 800;
  const height = wrapper.clientHeight || 500;

  // Determine theme colors
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const fgColor = isDark ? '#e5e7eb' : '#1f2937';

  // Configure canvas
  canvasEl.setWidth(width);
  canvasEl.setHeight(height);
  canvasEl.setBackgroundColor(bgColor);
  canvasEl.setForegroundColor(fgColor);
  canvasEl.setIsLoading(true);

  // Set up callbacks
  canvasEl.setConfig({
    onNodeClick: (node: { id: string | number; data: Record<string, unknown> }) => {
      const originalNode = originalNodes.get(String(node.id));
      if (originalNode && props.onNodeClick) {
        props.onNodeClick(originalNode);
      }
    },
    onNodeRightClick: (node: { id: string | number; data: Record<string, unknown> }, event: MouseEvent) => {
      event.preventDefault();
      const originalNode = originalNodes.get(String(node.id));
      if (originalNode && props.onNodeRightClick) {
        props.onNodeRightClick(originalNode);
      }
    },
    onLinkClick: (link: { id: string | number; data: Record<string, unknown> }) => {
      const originalEdge = originalEdges.get(String(link.id));
      if (originalEdge && props.onLinkClick) {
        props.onLinkClick(originalEdge);
      }
    },
    onEngineStop: () => {
      // Layout simulation stopped (can fire multiple times during stabilization)
    }
  });

  // Load data
  try {
    const data = await graphService.getVisualizationData({ limit: 500 });

    if (data.nodes.length === 0) {
      loadingEl.innerHTML = `
        <div class="graph-canvas-no-data">
          <p class="loading-text">No graph data available</p>
          <button class="btn btn-primary btn-sm" id="fdb-sync">Sync Data</button>
        </div>
      `;
      canvasEl.setIsLoading(false);

      const syncBtn = loadingEl.querySelector('#fdb-sync');
      if (syncBtn) {
        on(syncBtn as HTMLElement, 'click', async () => {
          toast.info('Syncing data...');
          await fetchWithProject('/api/graph/sync', { method: 'POST' });
          toast.success('Sync complete. Reloading...');
          initCanvas(container, props);
        });
      }
      return;
    }

    // Transform data to FalkorDB canvas format
    const canvasData = transformData(data.nodes, data.edges);

    // Update legend
    updateLegend(legendEl, data.nodes);

    // Set data
    canvasEl.setData(canvasData);
    canvasEl.setIsLoading(false);
    loadingEl.classList.add('gm-none');

    // Fit to view after layout settles
    setTimeout(() => canvasEl.zoomToFit(1.2), 1000);

    console.log(`[FalkorDBCanvas] Loaded ${data.nodes.length} nodes and ${data.edges.length} edges`);

    // Notify parent of loaded data stats
    props.onDataLoaded?.({ nodeCount: data.nodes.length, edgeCount: data.edges.length });

  } catch (error) {
    console.error('[FalkorDBCanvas] Error loading data:', error);
    loadingEl.innerHTML = `<p class="graph-canvas-error">Failed to load graph data</p>`;
    canvasEl.setIsLoading(false);
  }

  // Bind control buttons
  const zoomInBtn = container.querySelector('#fdb-zoom-in');
  const zoomOutBtn = container.querySelector('#fdb-zoom-out');
  const fitBtn = container.querySelector('#fdb-fit');
  const refreshBtn = container.querySelector('#fdb-refresh');

  if (zoomInBtn) {
    on(zoomInBtn as HTMLElement, 'click', () => {
      const currentZoom = canvasEl.getZoom?.() || 1;
      canvasEl.zoom?.(currentZoom * 1.2);
    });
  }

  if (zoomOutBtn) {
    on(zoomOutBtn as HTMLElement, 'click', () => {
      const currentZoom = canvasEl.getZoom?.() || 1;
      canvasEl.zoom?.(currentZoom / 1.2);
    });
  }

  if (fitBtn) {
    on(fitBtn as HTMLElement, 'click', () => {
      canvasEl.zoomToFit?.(1.2);
    });
  }

  if (refreshBtn) {
    on(refreshBtn as HTMLElement, 'click', async () => {
      toast.info('Refreshing graph...');
      loadingEl.classList.remove('gm-none');
      canvasEl.setIsLoading(true);
      await initCanvas(container, props);
      toast.success('Graph refreshed');
    });
  }
}

/**
 * Transform GodMode data to FalkorDB canvas format
 */
function transformData(nodes: GraphNode[], edges: GraphEdge[]): FalkorDBCanvasData {
  // Clear and rebuild maps
  originalNodes.clear();
  originalEdges.clear();

  // Deduplicate nodes
  const seenNodeIds = new Set<string>();
  const uniqueNodes = nodes.filter(node => {
    if (seenNodeIds.has(node.id)) return false;
    seenNodeIds.add(node.id);
    return true;
  });

  // Transform nodes
  const canvasNodes: FalkorDBCanvasNode[] = uniqueNodes.map(node => {
    originalNodes.set(node.id, node);

    const props = (node.properties || {}) as Record<string, unknown>;
    const nodeName = node.name || props.name || props.title ||
      (props.content ? String(props.content).substring(0, 30) : null) ||
      node.label || node.id;

    // Build display name based on node type
    let displayName = String(nodeName);
    const nodeType = node.type || node.label || 'Unknown';

    // For Contacts, show name + role/organization
    if (nodeType === 'Contact' || nodeType === 'Person') {
      const role = props.role || node.role;
      const org = props.organization || node.organization;
      if (role) {
        displayName = `${nodeName}\n(${role})`;
      } else if (org) {
        displayName = `${nodeName}\n(${org})`;
      }
    }

    // For Decisions/Risks, truncate long content
    if ((nodeType === 'Decision' || nodeType === 'Risk') && displayName.length > 40) {
      displayName = displayName.substring(0, 37) + '...';
    }

    // For Facts, show truncated content
    if (nodeType === 'Fact') {
      const content = props.content || props.text;
      if (content) {
        displayName = String(content).substring(0, 35) + (String(content).length > 35 ? '...' : '');
      }
    }

    // Determine node size based on importance
    let nodeSize = 6;
    if (nodeType === 'Contact' || nodeType === 'Person') nodeSize = 10;
    else if (nodeType === 'Team') nodeSize = 9;
    else if (nodeType === 'Meeting') nodeSize = 8;
    else if (nodeType === 'Decision') nodeSize = 7;
    else if (nodeType === 'Risk') nodeSize = 7;

    return {
      id: node.id,
      labels: [nodeType],
      color: TYPE_COLORS[nodeType] || '#6b7280',
      visible: true,
      size: nodeSize,
      caption: 'name',
      data: {
        name: displayName,
        type: nodeType,
        originalName: String(nodeName),
        role: props.role || node.role,
        organization: props.organization || node.organization,
        email: props.email || node.email,
        avatarUrl: props.avatarUrl || props.avatar_url || node.avatarUrl,
        ...props
      }
    };
  });

  // Deduplicate and transform edges
  const seenEdgeIds = new Set<string>();
  const canvasLinks: FalkorDBCanvasLink[] = [];

  for (const edge of edges) {
    const edgeId = edge.id || `${edge.source}-${edge.target}-${edge.type}`;
    if (seenEdgeIds.has(edgeId)) continue;
    seenEdgeIds.add(edgeId);

    // Only include edges where both nodes exist
    if (seenNodeIds.has(edge.source) && seenNodeIds.has(edge.target)) {
      originalEdges.set(edgeId, edge);

      canvasLinks.push({
        id: edgeId,
        relationship: edge.type || edge.label || 'RELATED',
        color: '#9ca3af',
        source: edge.source,
        target: edge.target,
        visible: true,
        data: {}
      });
    }
  }

  return { nodes: canvasNodes, links: canvasLinks };
}

/**
 * Update legend with node types
 */
function updateLegend(legendEl: HTMLElement, nodes: GraphNode[]): void {
  const types = new Set<string>();
  nodes.forEach(node => types.add(node.type || 'Unknown'));

  legendEl.innerHTML = Array.from(types).sort().map(type => `
    <span class="graph-legend-item">
      <span class="graph-legend-dot" style="--legend-color: ${TYPE_COLORS[type] || '#6b7280'}"></span>
      ${type}
    </span>
  `).join('');
}

export default { createFalkorDBCanvas };
