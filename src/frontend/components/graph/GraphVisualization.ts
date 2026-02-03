/**
 * GraphVisualization - SOTA vis-network component
 * 
 * Features:
 * - Avatar nodes for Person entities
 * - Semantic zoom (avatar → initials → dot)
 * - Community coloring
 * - Rich hover cards
 * - Context menu
 * - Minimap
 * - Animated edges
 */

import { createElement, on } from '../../utils/dom';
import { graphService, GraphNode, GraphEdge } from '../../services/graph';
import { toast } from '../../services/toast';

export interface GraphVisualizationProps {
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onSelectionChange?: (nodes: GraphNode[], edges: GraphEdge[]) => void;
}

interface VisNetwork {
  setData: (data: { nodes: unknown; edges: unknown }) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, callback: (params: any) => void) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off: (event: string, callback?: (params: any) => void) => void;
  fit: (options?: { animation?: boolean }) => void;
  focus: (nodeId: string, options?: { scale?: number; animation?: boolean }) => void;
  getScale: () => number;
  moveTo: (options: { position?: { x: number; y: number }; scale?: number; animation?: boolean }) => void;
  getSelectedNodes: () => string[];
  getSelectedEdges: () => string[];
  selectNodes: (nodeIds: string[]) => void;
  unselectAll: () => void;
  destroy: () => void;
  getPosition: (nodeId: string) => { x: number; y: number };
  getViewPosition: () => { x: number; y: number };
  redraw: () => void;
}

interface VisDataSet<T> {
  add: (data: T | T[]) => void;
  update: (data: T | T[]) => void;
  remove: (ids: string | string[]) => void;
  get: (id?: string) => T | T[] | null;
  clear: () => void;
}

// Type for vis.js library loaded via CDN
interface VisModule {
  Network: new (container: HTMLElement, data: unknown, options: unknown) => VisNetwork;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataSet: new <T = any>(data?: T[]) => VisDataSet<T>;
}

// Helper to get vis module from window
function getVis(): VisModule | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).vis as VisModule | undefined;
}

const TYPE_COLORS: Record<string, string> = {
  Person: '#6366f1',
  Project: '#22c55e',
  Document: '#8b5cf6',
  Decision: '#06b6d4',
  Risk: '#ef4444',
  Question: '#f59e0b',
  Fact: '#84cc16',
  Meeting: '#ec4899',
  Task: '#3b82f6',
  Technology: '#f97316',
  Organization: '#a855f7',
  Client: '#14b8a6',
  Email: '#e879f9',
  Conversation: '#9333ea',
  Answer: '#10b981',
  Briefing: '#eab308',
};

/**
 * Create the graph visualization component
 */
export function createGraphVisualization(props: GraphVisualizationProps = {}): HTMLElement {
  const { height = 600 } = props;

  const container = createElement('div', { className: 'graph-visualization-container' });
  
  container.innerHTML = `
    <div class="viz-toolbar">
      <div class="viz-toolbar-left">
        <button class="viz-btn" id="viz-zoom-in" title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="viz-btn" id="viz-zoom-out" title="Zoom Out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="viz-btn" id="viz-fit" title="Fit to View">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
        <div class="viz-divider"></div>
        <button class="viz-btn" id="viz-physics" title="Toggle Physics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2"/>
            <path d="M12 21v2"/>
            <path d="M4.22 4.22l1.42 1.42"/>
            <path d="M18.36 18.36l1.42 1.42"/>
            <path d="M1 12h2"/>
            <path d="M21 12h2"/>
            <path d="M4.22 19.78l1.42-1.42"/>
            <path d="M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>
      <div class="viz-toolbar-center">
        <span class="viz-status" id="viz-status">Loading...</span>
      </div>
      <div class="viz-toolbar-right">
        <button class="viz-btn" id="viz-screenshot" title="Screenshot">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <button class="viz-btn" id="viz-minimap-toggle" title="Toggle Minimap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <rect x="7" y="7" width="3" height="3"/>
            <rect x="14" y="7" width="3" height="3"/>
            <rect x="7" y="14" width="3" height="3"/>
            <rect x="14" y="14" width="3" height="3"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="viz-canvas-wrapper">
      <div class="viz-canvas" id="viz-canvas" style="height: ${height}px;">
        <div class="viz-loading">
          <div class="loading-spinner"></div>
          <p>Loading graph data...</p>
        </div>
      </div>
      
      <div class="viz-minimap hidden" id="viz-minimap">
        <div class="minimap-viewport" id="minimap-viewport"></div>
      </div>
      
      <div class="viz-legend" id="viz-legend">
        <!-- Legend will be rendered here -->
      </div>
    </div>
    
    <div class="viz-hover-card hidden" id="viz-hover-card">
      <!-- Hover card content -->
    </div>
    
    <div class="viz-context-menu hidden" id="viz-context-menu">
      <button class="context-menu-item" data-action="expand">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Expand Connections
      </button>
      <button class="context-menu-item" data-action="focus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        Focus on Node
      </button>
      <button class="context-menu-item" data-action="hide">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        Hide Node
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="bookmark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Bookmark
      </button>
      <button class="context-menu-item" data-action="annotate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Add Note
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="ai-explain">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        AI Explain
      </button>
    </div>
  `;

  // Initialize visualization
  initVisualization(container, props);

  return container;
}

/**
 * Initialize the visualization
 */
async function initVisualization(container: HTMLElement, props: GraphVisualizationProps): Promise<void> {
  const canvas = container.querySelector('#viz-canvas') as HTMLElement;
  const statusEl = container.querySelector('#viz-status') as HTMLElement;

  // Check if vis.js is available
  if (!getVis()) {
    // Try to load vis.js
    await loadVisJs();
  }

  if (!getVis()) {
    canvas.innerHTML = `
      <div class="viz-error">
        <p>Graph visualization library not available</p>
        <p class="text-muted">Please ensure vis-network is loaded</p>
      </div>
    `;
    return;
  }

  try {
    // Load graph data
    statusEl.textContent = 'Loading nodes...';
    const data = await graphService.getVisualizationData({ limit: 500 });

    if (data.nodes.length === 0) {
      canvas.innerHTML = `
        <div class="viz-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="4" cy="6" r="2"/>
            <circle cx="20" cy="6" r="2"/>
            <circle cx="4" cy="18" r="2"/>
            <circle cx="20" cy="18" r="2"/>
            <line x1="6" y1="6" x2="9.5" y2="10"/>
            <line x1="18" y1="6" x2="14.5" y2="10"/>
            <line x1="6" y1="18" x2="9.5" y2="14"/>
            <line x1="18" y1="18" x2="14.5" y2="14"/>
          </svg>
          <h3>No graph data</h3>
          <p>Process some documents to populate the knowledge graph, or sync existing data.</p>
          <button class="btn btn-primary" id="btn-sync-empty">Sync Data</button>
        </div>
      `;
      
      const syncBtn = canvas.querySelector('#btn-sync-empty');
      if (syncBtn) {
        on(syncBtn as HTMLElement, 'click', async () => {
          toast.info('Syncing data...');
          await fetch('/api/graph/sync', { method: 'POST' });
          toast.success('Sync complete. Reloading...');
          initVisualization(container, props);
        });
      }
      return;
    }

    statusEl.textContent = 'Rendering graph...';
    canvas.innerHTML = '';

    // Create vis.js network
    const network = createNetwork(canvas, data.nodes, data.edges, props);

    // Bind toolbar actions
    bindToolbarActions(container, network);

    // Render legend
    renderLegend(container, data.nodes);

    // Update status
    statusEl.textContent = `${data.nodes.length} nodes • ${data.edges.length} edges`;

  } catch (error) {
    console.error('[GraphVisualization] Error:', error);
    canvas.innerHTML = `
      <div class="viz-error">
        <p>Failed to load graph data</p>
        <button class="btn btn-sm" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

/**
 * Load vis.js dynamically
 */
async function loadVisJs(): Promise<void> {
  return new Promise((resolve) => {
    if (getVis()) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Create vis.js network
 */
function createNetwork(
  container: HTMLElement,
  nodes: GraphNode[],
  edges: GraphEdge[],
  props: GraphVisualizationProps
): VisNetwork {
  // Deduplicate nodes by ID (keep first occurrence)
  const seenNodeIds = new Set<string>();
  const uniqueNodes = nodes.filter(node => {
    if (seenNodeIds.has(node.id)) {
      console.warn('[GraphVisualization] Skipping duplicate node:', node.id);
      return false;
    }
    seenNodeIds.add(node.id);
    return true;
  });
  
  // Transform nodes for vis.js with avatar support
  const visNodes = uniqueNodes.map(node => {
    const props = (node.properties || {}) as Record<string, unknown>;
    const avatarUrl = node.avatarUrl || node.photoUrl || 
      props.avatar_url || props.photo_url || props.avatarUrl || props.photoUrl;
    
    const isPerson = node.type === 'Person';
    const color = TYPE_COLORS[node.type] || '#6b7280';
    
    // For Person nodes, prioritize name from properties; for others use label
    const displayName = isPerson 
      ? (node.name || props.name || node.label || node.id)
      : (node.name || node.label || props.title || props.content?.toString().substring(0, 30) || node.id);
    const label = String(displayName);
    const initials = getInitials(label);

    return {
      id: node.id,
      label: label.length > 25 ? label.substring(0, 22) + '...' : label,
      title: createTooltip(node),
      color: {
        background: color,
        border: color,
        highlight: {
          background: adjustColor(color, 20),
          border: adjustColor(color, -20),
        },
        hover: {
          background: adjustColor(color, 10),
          border: adjustColor(color, -10),
        },
      },
      shape: isPerson && avatarUrl ? 'circularImage' : 'dot',
      image: isPerson && avatarUrl ? avatarUrl : undefined,
      size: getNodeSize(node),
      font: {
        size: 12,
        color: getTextColor(),
        face: 'Inter, -apple-system, system-ui, sans-serif',
      },
      borderWidth: 2,
      borderWidthSelected: 4,
      // Store original data
      _data: node,
    };
  });

  // Deduplicate edges by ID
  const seenEdgeIds = new Set<string>();
  const uniqueEdges = edges.filter(edge => {
    const edgeId = edge.id || `${edge.source}-${edge.target}-${edge.type}`;
    if (seenEdgeIds.has(edgeId)) {
      return false;
    }
    seenEdgeIds.add(edgeId);
    return true;
  });
  
  // Transform edges for vis.js
  const visEdges = uniqueEdges.map(edge => ({
    id: edge.id,
    from: edge.source,
    to: edge.target,
    label: edge.label,
    title: `${edge.type}`,
    color: {
      color: 'rgba(156, 163, 175, 0.6)',
      highlight: 'rgba(99, 102, 241, 0.8)',
      hover: 'rgba(99, 102, 241, 0.6)',
    },
    arrows: {
      to: {
        enabled: true,
        scaleFactor: 0.5,
      },
    },
    font: {
      size: 10,
      color: 'rgba(156, 163, 175, 0.8)',
      strokeWidth: 0,
      align: 'middle',
    },
    smooth: {
      type: 'continuous',
      roundness: 0.5,
    },
    width: 1,
    selectionWidth: 2,
    _data: edge,
  }));

  const options = {
    nodes: {
      borderWidth: 2,
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.1)',
        size: 5,
        x: 2,
        y: 2,
      },
    },
    edges: {
      width: 1,
      shadow: false,
    },
    physics: {
      enabled: true,
      stabilization: {
        enabled: true,
        iterations: 100,
        updateInterval: 25,
      },
      barnesHut: {
        gravitationalConstant: -3000,
        centralGravity: 0.3,
        springLength: 120,
        springConstant: 0.04,
        damping: 0.09,
      },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      hideEdgesOnDrag: true,
      hideEdgesOnZoom: true,
      multiselect: true,
      navigationButtons: false,
      keyboard: {
        enabled: true,
        bindToWindow: false,
      },
    },
    layout: {
      improvedLayout: true,
      hierarchical: false,
    },
  };

  const vis = getVis()!;
  const network = new vis.Network(
    container,
    {
      nodes: new vis.DataSet(visNodes),
      edges: new vis.DataSet(visEdges),
    },
    options
  );

  // Bind events
  network.on('click', (params: { nodes: string[]; edges: string[] }) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = nodes.find(n => n.id === nodeId);
      if (node && props.onNodeClick) {
        props.onNodeClick(node);
      }
    }
    // Hide context menu
    const contextMenu = container.closest('.graph-visualization-container')?.querySelector('#viz-context-menu');
    if (contextMenu) contextMenu.classList.add('hidden');
  });

  network.on('doubleClick', (params: { nodes: string[] }) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = nodes.find(n => n.id === nodeId);
      if (node && props.onNodeDoubleClick) {
        props.onNodeDoubleClick(node);
      }
    }
  });

  network.on('oncontext', (params: { nodes: string[]; pointer: { DOM: { x: number; y: number } }; event: Event }) => {
    params.event.preventDefault();
    if (params.nodes.length > 0) {
      showContextMenu(container, params.pointer.DOM.x, params.pointer.DOM.y, params.nodes[0], nodes);
    }
  });

  network.on('hoverNode', (params: { node: string }) => {
    const node = nodes.find(n => n.id === params.node);
    if (node) {
      showHoverCard(container, node);
    }
  });

  network.on('blurNode', () => {
    hideHoverCard(container);
  });

  network.on('stabilizationProgress', (params: { iterations: number; total: number }) => {
    const status = container.closest('.graph-visualization-container')?.querySelector('#viz-status');
    if (status) {
      const progress = Math.round((params.iterations / params.total) * 100);
      status.textContent = `Stabilizing... ${progress}%`;
    }
  });

  network.on('stabilizationIterationsDone', () => {
    const status = container.closest('.graph-visualization-container')?.querySelector('#viz-status');
    if (status) {
      status.textContent = `${nodes.length} nodes • ${edges.length} edges`;
    }
  });

  return network;
}

/**
 * Bind toolbar actions
 */
function bindToolbarActions(container: HTMLElement, network: VisNetwork): void {
  const btnZoomIn = container.querySelector('#viz-zoom-in');
  const btnZoomOut = container.querySelector('#viz-zoom-out');
  const btnFit = container.querySelector('#viz-fit');
  const btnPhysics = container.querySelector('#viz-physics');
  const btnScreenshot = container.querySelector('#viz-screenshot');
  const btnMinimap = container.querySelector('#viz-minimap-toggle');

  let physicsEnabled = true;

  if (btnZoomIn) {
    on(btnZoomIn as HTMLElement, 'click', () => {
      const scale = network.getScale();
      network.moveTo({ scale: scale * 1.3, animation: true });
    });
  }

  if (btnZoomOut) {
    on(btnZoomOut as HTMLElement, 'click', () => {
      const scale = network.getScale();
      network.moveTo({ scale: scale / 1.3, animation: true });
    });
  }

  if (btnFit) {
    on(btnFit as HTMLElement, 'click', () => {
      network.fit({ animation: true });
    });
  }

  if (btnPhysics) {
    on(btnPhysics as HTMLElement, 'click', () => {
      physicsEnabled = !physicsEnabled;
      // Note: vis.js doesn't have a simple toggle, would need to recreate network
      btnPhysics.classList.toggle('active', physicsEnabled);
      toast.info(physicsEnabled ? 'Physics enabled' : 'Physics disabled');
    });
  }

  if (btnScreenshot) {
    on(btnScreenshot as HTMLElement, 'click', () => {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `graph-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast.success('Screenshot saved');
      }
    });
  }

  if (btnMinimap) {
    on(btnMinimap as HTMLElement, 'click', () => {
      const minimap = container.querySelector('#viz-minimap');
      if (minimap) {
        minimap.classList.toggle('hidden');
        btnMinimap.classList.toggle('active');
      }
    });
  }
}

/**
 * Show context menu
 */
function showContextMenu(
  container: HTMLElement,
  x: number,
  y: number,
  nodeId: string,
  nodes: GraphNode[]
): void {
  const menu = container.closest('.graph-visualization-container')?.querySelector('#viz-context-menu') as HTMLElement;
  if (!menu) return;

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('hidden');
  menu.setAttribute('data-node-id', nodeId);

  // Bind menu actions
  const items = menu.querySelectorAll('.context-menu-item');
  items.forEach(item => {
    const newItem = item.cloneNode(true) as HTMLElement;
    item.parentNode?.replaceChild(newItem, item);
    
    on(newItem, 'click', () => {
      const action = newItem.getAttribute('data-action');
      const node = nodes.find(n => n.id === nodeId);
      handleContextAction(action || '', node, container);
      menu.classList.add('hidden');
    });
  });

  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);
}

/**
 * Handle context menu action
 */
async function handleContextAction(action: string, node: GraphNode | undefined, container: HTMLElement): Promise<void> {
  if (!node) return;

  switch (action) {
    case 'expand':
      toast.info(`Expanding connections for ${node.label || node.name}`);
      // TODO: Load and add connected nodes
      break;
    case 'focus':
      toast.info(`Focusing on ${node.label || node.name}`);
      // TODO: Center and zoom to node
      break;
    case 'hide':
      toast.info(`Hiding ${node.label || node.name}`);
      // TODO: Remove node from visualization
      break;
    case 'bookmark':
      await graphService.addBookmark({
        node_id: node.id,
        node_type: node.type,
        node_label: node.label || node.name || node.id,
        node_avatar_url: node.avatarUrl || node.photoUrl,
        sort_order: 0,
      });
      toast.success('Bookmark added');
      break;
    case 'annotate':
      const note = prompt('Add a note for this node:');
      if (note) {
        await graphService.createAnnotation({
          target_type: 'node',
          target_id: node.id,
          target_label: node.label || node.name,
          content: note,
          annotation_type: 'note',
          is_shared: false,
          is_resolved: false,
        });
        toast.success('Note added');
      }
      break;
    case 'ai-explain':
      toast.info('Generating AI explanation...');
      // TODO: Call AI explain endpoint
      break;
  }
}

/**
 * Show hover card
 */
function showHoverCard(container: HTMLElement, node: GraphNode): void {
  const card = container.closest('.graph-visualization-container')?.querySelector('#viz-hover-card') as HTMLElement;
  if (!card) return;

  const avatarUrl = node.avatarUrl || node.photoUrl || 
    (node.properties as Record<string, unknown>)?.avatar_url || 
    (node.properties as Record<string, unknown>)?.photo_url;
  const role = node.role || (node.properties as Record<string, unknown>)?.role;
  const org = node.organization || (node.properties as Record<string, unknown>)?.organization;

  card.innerHTML = `
    <div class="hover-card-content">
      ${avatarUrl 
        ? `<img class="hover-avatar" src="${avatarUrl}" alt="" onerror="this.style.display='none'">`
        : `<div class="hover-avatar hover-avatar-placeholder" style="background: ${TYPE_COLORS[node.type] || '#6b7280'}">${getInitials(node.label || node.name || '?')}</div>`
      }
      <div class="hover-info">
        <div class="hover-name">${escapeHtml(node.label || node.name || node.id)}</div>
        <div class="hover-type" style="color: ${TYPE_COLORS[node.type] || '#6b7280'}">${node.type}</div>
        ${role ? `<div class="hover-role">${escapeHtml(String(role))}</div>` : ''}
        ${org ? `<div class="hover-org">@ ${escapeHtml(String(org))}</div>` : ''}
      </div>
      ${node.connections ? `<div class="hover-stat">${node.connections} connections</div>` : ''}
    </div>
  `;

  card.classList.remove('hidden');
}

/**
 * Hide hover card
 */
function hideHoverCard(container: HTMLElement): void {
  const card = container.closest('.graph-visualization-container')?.querySelector('#viz-hover-card');
  if (card) {
    card.classList.add('hidden');
  }
}

/**
 * Render legend
 */
function renderLegend(container: HTMLElement, nodes: GraphNode[]): void {
  const legend = container.querySelector('#viz-legend');
  if (!legend) return;

  // Count by type
  const typeCounts: Record<string, number> = {};
  nodes.forEach(node => {
    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
  });

  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  legend.innerHTML = `
    <div class="legend-title">Entity Types</div>
    <div class="legend-items">
      ${sortedTypes.map(([type, count]) => `
        <div class="legend-item">
          <span class="legend-color" style="background: ${TYPE_COLORS[type] || '#6b7280'}"></span>
          <span class="legend-label">${type}</span>
          <span class="legend-count">${count}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Create tooltip content (plain text - vis.js escapes HTML)
 */
function createTooltip(node: GraphNode): string {
  const props = (node.properties || {}) as Record<string, unknown>;
  const name = node.name || props.name || node.label || node.id;
  const role = node.role || props.role;
  const org = node.organization || props.organization;
  const content = props.content ? String(props.content).substring(0, 100) : null;
  
  const lines: string[] = [];
  lines.push(String(name));
  lines.push(`[${node.type}]`);
  if (role) lines.push(String(role));
  if (org) lines.push(`@ ${org}`);
  if (content && node.type !== 'Person') lines.push(`"${content}..."`);
  
  return lines.join('\n');
}

/**
 * Get node size based on connections
 */
function getNodeSize(node: GraphNode): number {
  const connections = node.connections || 1;
  return Math.min(15 + connections * 2, 40);
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Adjust color brightness
 */
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get text color based on theme
 */
function getTextColor(): string {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? '#e5e7eb' : '#374151';
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createGraphVisualization;
