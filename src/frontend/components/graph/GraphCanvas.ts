/**
 * GraphCanvas - Graph visualization component using @falkordb/canvas
 * 
 * High-performance graph visualization with support for:
 * - Contact avatars
 * - Rich tooltips
 * - Custom node styling
 * 
 * Data source: Supabase (graph_nodes, graph_relationships tables)
 */

import { createElement, on } from '../../utils/dom';
import { graphService, GraphNode, GraphEdge } from '../../services/graph';
import { toast } from '../../services/toast';
import { fetchWithProject } from '../../services/api';

// Type definitions for canvas nodes
interface CanvasNode {
  id: string | number;
  labels: string[];
  color: string;
  visible: boolean;
  size?: number;
  caption?: string;
  image?: string; // Avatar URL for contacts
  data: Record<string, unknown>;
}

interface CanvasLink {
  id: string | number;
  relationship: string;
  color: string;
  source: string | number;
  target: string | number;
  visible: boolean;
  data: Record<string, unknown>;
}

interface CanvasData {
  nodes: CanvasNode[];
  links: CanvasLink[];
}

interface CanvasElement extends HTMLElement {
  setData: (data: CanvasData) => void;
  getData: () => CanvasData;
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

export interface GraphCanvasProps {
  onNodeClick?: (node: GraphNode) => void;
  onNodeRightClick?: (node: GraphNode) => void;
  onLinkClick?: (edge: GraphEdge) => void;
  onDataLoaded?: (stats: { nodeCount: number; edgeCount: number }) => void;
  height?: number;
}

// Alias for backward compatibility
export type FalkorDBCanvasProps = GraphCanvasProps;

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
 * Create the Graph Canvas component
 */
export function createGraphCanvas(props: GraphCanvasProps = {}): HTMLElement {
  const container = createElement('div', { className: 'graph-canvas-container' });
  
  container.innerHTML = `
    <div class="graph-canvas-wrapper" style="--graph-height: ${props.height || 500}px;">
      <div class="graph-canvas-loading">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading graph data...</p>
      </div>
      <falkordb-canvas id="graph-canvas"></falkordb-canvas>
      <div class="graph-avatar-overlay" id="avatar-overlay"></div>
    </div>
    <div class="graph-canvas-controls">
      <button class="btn btn-sm" id="gc-zoom-in" title="Zoom In">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="gc-zoom-out" title="Zoom Out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="gc-fit" title="Fit to View">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
      <button class="btn btn-sm" id="gc-refresh" title="Refresh Data">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>
    <div class="graph-canvas-legend">
      <h5>Legend</h5>
      <div id="gc-legend">
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
async function initCanvas(container: HTMLElement, props: GraphCanvasProps): Promise<void> {
  // Import the web component
  try {
    await import('@falkordb/canvas');
  } catch (e) {
    console.error('[GraphCanvas] Failed to load @falkordb/canvas:', e);
    toast.error('Failed to load graph visualization library');
    return;
  }

  const canvasEl = container.querySelector('#graph-canvas') as CanvasElement;
  const loadingEl = container.querySelector('.graph-canvas-loading') as HTMLElement;
  const legendEl = container.querySelector('#gc-legend') as HTMLElement;
  const avatarOverlay = container.querySelector('#avatar-overlay') as HTMLElement;
  
  if (!canvasEl) {
    console.error('[GraphCanvas] Canvas element not found');
    return;
  }

  // Get container dimensions
  const wrapper = container.querySelector('.graph-canvas-wrapper') as HTMLElement;
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
    onNodeClick: (node: { id: string | number; data: Record<string, unknown> }, event: MouseEvent) => {
      const originalNode = originalNodes.get(String(node.id));
      if (originalNode) {
        // Show tooltip with avatar
        showNodeTooltipInternal(originalNode, event.clientX, event.clientY, avatarOverlay);
        
        if (props.onNodeClick) {
          props.onNodeClick(originalNode);
        }
      }
    },
    onNodeHover: (node: { id: string | number; data: Record<string, unknown> } | null, event?: MouseEvent) => {
      if (node && event?.clientX !== undefined && event?.clientY !== undefined) {
        const originalNode = originalNodes.get(String(node.id));
        if (originalNode) {
          showNodeTooltipInternal(originalNode, event.clientX, event.clientY, avatarOverlay);
        }
      } else if (!node) {
        hideNodeTooltipInternal(avatarOverlay);
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
          <button class="btn btn-primary btn-sm" id="gc-sync">Sync Data</button>
        </div>
      `;
      canvasEl.setIsLoading(false);
      
      const syncBtn = loadingEl.querySelector('#gc-sync');
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

    // Transform data to canvas format
    const canvasData = transformData(data.nodes, data.edges);
    
    // Update legend
    updateLegend(legendEl, data.nodes);
    
    // Set data
    canvasEl.setData(canvasData);
    canvasEl.setIsLoading(false);
    loadingEl.classList.add('gm-none');
    
    // Render avatar overlays for Contact nodes
    renderAvatarOverlays(avatarOverlay, data.nodes, canvasEl);
    
    // Fit to view after layout settles
    setTimeout(() => canvasEl.zoomToFit(1.2), 1000);
    
    console.log(`[GraphCanvas] Loaded ${data.nodes.length} nodes and ${data.edges.length} edges`);
    
    // Notify parent of loaded data stats
    props.onDataLoaded?.({ nodeCount: data.nodes.length, edgeCount: data.edges.length });
    
  } catch (error) {
    console.error('[GraphCanvas] Error loading data:', error);
    loadingEl.innerHTML = `<p class="graph-canvas-error">Failed to load graph data</p>`;
    canvasEl.setIsLoading(false);
  }

  // Bind control buttons
  const zoomInBtn = container.querySelector('#gc-zoom-in');
  const zoomOutBtn = container.querySelector('#gc-zoom-out');
  const fitBtn = container.querySelector('#gc-fit');
  const refreshBtn = container.querySelector('#gc-refresh');

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
 * Transform GodMode data to canvas format
 */
function transformData(nodes: GraphNode[], edges: GraphEdge[]): CanvasData {
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
  const canvasNodes: CanvasNode[] = uniqueNodes.map(node => {
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
  const canvasLinks: CanvasLink[] = [];
  
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

/**
 * Render avatar overlays for Contact nodes
 * Since the canvas library doesn't support images natively, we overlay avatar images
 */
function renderAvatarOverlays(overlayEl: HTMLElement, nodes: GraphNode[], _canvasEl: CanvasElement): void {
  if (!overlayEl) return;
  
  // Clear existing overlays
  overlayEl.innerHTML = '';
  
  // Add a style for the tooltip that shows avatars
  const style = document.createElement('style');
  style.textContent = `
    .graph-node-tooltip {
      position: fixed;
      background: var(--bg-primary, #ffffff);
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 10000;
      pointer-events: none;
      min-width: 220px;
      max-width: 300px;
      opacity: 0;
      transform: translateY(5px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .graph-node-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .graph-node-tooltip .tooltip-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .graph-node-tooltip .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--border-color, #e5e7eb);
      flex-shrink: 0;
    }
    .graph-node-tooltip .avatar-placeholder {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 18px;
      flex-shrink: 0;
    }
    .graph-node-tooltip .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .graph-node-tooltip .name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary, #1f2937);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .graph-node-tooltip .role {
      font-size: 12px;
      color: var(--text-muted, #6b7280);
    }
    .graph-node-tooltip .org {
      font-size: 11px;
      color: var(--text-tertiary, #9ca3af);
    }
    .graph-node-tooltip .email {
      font-size: 11px;
      color: var(--primary, #6366f1);
      margin-top: 4px;
    }
    .graph-node-tooltip .node-type {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-secondary, #f3f4f6);
      color: var(--text-muted, #6b7280);
      text-transform: uppercase;
    }
  `;
  overlayEl.appendChild(style);
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'graph-node-tooltip';
  tooltip.id = 'graph-tooltip';
  overlayEl.appendChild(tooltip);
  
  // Store all node data for tooltip display
  (window as unknown as Record<string, unknown>).__graphNodeData = nodes.reduce((acc, node) => {
    acc[node.id] = {
      id: node.id,
      name: node.name || node.properties?.name || node.properties?.title || node.properties?.content?.substring(0, 50),
      type: node.type || node.label,
      avatarUrl: node.avatarUrl || node.properties?.avatar_url || node.properties?.avatarUrl,
      role: node.role || node.properties?.role,
      organization: node.organization || node.properties?.organization,
      email: node.email || node.properties?.email,
      content: node.properties?.content,
      status: node.properties?.status,
      severity: node.properties?.severity
    };
    return acc;
  }, {} as Record<string, unknown>);
}

/**
 * Show tooltip for a node (internal function)
 */
function showNodeTooltipInternal(node: GraphNode, x: number, y: number, overlayEl: HTMLElement): void {
  const tooltip = overlayEl?.querySelector('#graph-tooltip') as HTMLElement;
  if (!tooltip) return;
  
  const nodeData = (window as unknown as Record<string, Record<string, Record<string, string>>>).__graphNodeData;
  const data = nodeData?.[node.id] || {
    name: node.name || node.properties?.name,
    type: node.type || node.label,
    avatarUrl: node.avatarUrl || node.properties?.avatar_url,
    role: node.role || node.properties?.role,
    organization: node.organization || node.properties?.organization,
    email: node.email || node.properties?.email
  };
  
  const nodeType = data.type || 'Unknown';
  const isContact = nodeType === 'Contact' || nodeType === 'Person';
  const initials = (data.name || '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  
  let avatarHtml = '';
  if (isContact) {
    if (data.avatarUrl) {
      avatarHtml = `<img class="avatar" src="${data.avatarUrl}" alt="${data.name}" onerror="this.outerHTML='<div class=\\'avatar-placeholder\\'>${initials}</div>'"/>`;
    } else {
      avatarHtml = `<div class="avatar-placeholder">${initials}</div>`;
    }
  }
  
  let contentHtml = '';
  if (isContact) {
    contentHtml = `
      ${avatarHtml}
      <div class="info">
        <span class="name">${data.name || 'Unknown'}</span>
        ${data.role ? `<span class="role">${data.role}</span>` : ''}
        ${data.organization ? `<span class="org">${data.organization}</span>` : ''}
        ${data.email ? `<span class="email">${data.email}</span>` : ''}
      </div>
    `;
  } else {
    // For non-contact nodes, show relevant info
    const displayName = data.name || data.content?.substring(0, 100) || data.id;
    contentHtml = `
      <div class="info">
        <span class="name">${displayName}</span>
        ${data.status ? `<span class="role">Status: ${data.status}</span>` : ''}
        ${data.severity ? `<span class="role">Severity: ${data.severity}</span>` : ''}
      </div>
    `;
  }
  
  tooltip.innerHTML = `
    <span class="node-type">${nodeType}</span>
    <div class="tooltip-content">
      ${contentHtml}
    </div>
  `;
  
  // Position tooltip
  const padding = 15;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Show tooltip first to get dimensions
  tooltip.style.left = '-9999px';
  tooltip.classList.add('visible');
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Calculate position
  let left = x + padding;
  let top = y - tooltipRect.height / 2;
  
  // Adjust if going off-screen
  if (left + tooltipRect.width > viewportWidth - padding) {
    left = x - tooltipRect.width - padding;
  }
  if (top < padding) {
    top = padding;
  }
  if (top + tooltipRect.height > viewportHeight - padding) {
    top = viewportHeight - tooltipRect.height - padding;
  }
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

/**
 * Hide node tooltip (internal function)
 */
function hideNodeTooltipInternal(overlayEl: HTMLElement): void {
  const tooltip = overlayEl?.querySelector('#graph-tooltip') as HTMLElement;
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

/**
 * Show tooltip for a node (public API)
 */
export function showNodeTooltip(nodeId: string, x: number, y: number): void {
  const overlay = document.getElementById('avatar-overlay');
  const nodeData = (window as unknown as Record<string, Record<string, Record<string, string>>>).__graphNodeData;
  
  if (!overlay || !nodeData || !nodeData[nodeId]) return;
  
  const fakeNode = { id: nodeId, ...nodeData[nodeId] } as unknown as GraphNode;
  showNodeTooltipInternal(fakeNode, x, y, overlay);
}

/**
 * Hide node tooltip (public API)
 */
export function hideNodeTooltip(): void {
  const overlay = document.getElementById('avatar-overlay');
  if (overlay) {
    hideNodeTooltipInternal(overlay);
  }
}

// Backward compatibility alias
export const createFalkorDBCanvas = createGraphCanvas;

export default { createGraphCanvas, createFalkorDBCanvas, showNodeTooltip, hideNodeTooltip };
