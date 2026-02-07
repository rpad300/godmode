/**
 * Knowledge Graph Component
 * Interactive graph visualization using vis-network
 */

import { createElement, on } from '../utils/dom';
import { graphService, GraphNode, GraphEdge, GraphStats } from '../services/graph';
import { toast } from '../services/toast';

export interface KnowledgeGraphProps {
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  height?: number;
}

interface VisNetwork {
  setData: (data: { nodes: unknown[]; edges: unknown[] }) => void;
  on: (event: string, callback: (params: unknown) => void) => void;
  fit: () => void;
  focus: (nodeId: string, options?: { scale?: number }) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    vis?: {
      Network: new (container: HTMLElement, data: unknown, options: unknown) => VisNetwork;
      DataSet: new (data: unknown[]) => unknown;
    };
  }
}

const NODE_COLORS: Record<string, string> = {
  Person: '#6366f1',
  Document: '#22c55e',
  Question: '#f59e0b',
  Risk: '#ef4444',
  Action: '#8b5cf6',
  Decision: '#06b6d4',
  Fact: '#84cc16',
  Email: '#ec4899',
  default: '#9ca3af',
};

/**
 * Create knowledge graph component
 */
export function createKnowledgeGraph(props: KnowledgeGraphProps = {}): HTMLElement {
  const { height = 500 } = props;

  const container = createElement('div', { className: 'knowledge-graph' });

  container.innerHTML = `
    <div class="graph-toolbar">
      <div class="graph-filters">
        <label class="filter-item">
          <input type="checkbox" checked data-type="Person"> People
        </label>
        <label class="filter-item">
          <input type="checkbox" checked data-type="Document"> Documents
        </label>
        <label class="filter-item">
          <input type="checkbox" checked data-type="Question"> Questions
        </label>
        <label class="filter-item">
          <input type="checkbox" checked data-type="Risk"> Risks
        </label>
      </div>
      <div class="graph-actions">
        <input type="search" id="graph-search" class="search-input" placeholder="Search nodes...">
        <button class="btn btn-sm" id="graph-refresh">Refresh</button>
        <button class="btn btn-sm" id="graph-fit">Fit</button>
      </div>
    </div>
    <div class="graph-container" id="graph-container" style="height: ${height}px;">
      <div class="graph-loading">Loading graph...</div>
    </div>
    <div class="graph-stats" id="graph-stats"></div>
    <div class="node-details" id="node-details" style="display: none;"></div>
  `;

  // Initialize graph
  initGraph(container, props);

  return container;
}

/**
 * Initialize graph visualization
 */
async function initGraph(container: HTMLElement, props: KnowledgeGraphProps): Promise<void> {
  const graphContainer = container.querySelector('#graph-container') as HTMLElement;
  const statsContainer = container.querySelector('#graph-stats') as HTMLElement;

  // Check if vis-network is available
  if (!window.vis) {
    graphContainer.innerHTML = `
      <div class="graph-fallback">
        <p>Graph visualization requires vis-network library</p>
        <p class="text-muted">Add vis-network to enable interactive graph</p>
      </div>
    `;
    await loadStats(statsContainer);
    return;
  }

  try {
    // Load graph data
    const { nodes, edges } = await graphService.getVisualizationData();
    
    if (nodes.length === 0) {
      graphContainer.innerHTML = `
        <div class="graph-empty">
          <p>No graph data available</p>
          <p class="text-muted">Process some documents to populate the knowledge graph</p>
        </div>
      `;
      return;
    }

    // Create vis-network
    const network = createVisNetwork(graphContainer, nodes, edges, props);
    
    // Bind toolbar events
    bindToolbarEvents(container, network, nodes, props);

    // Load stats
    await loadStats(statsContainer);

  } catch (error) {
    graphContainer.innerHTML = `
      <div class="graph-error">
        <p>Failed to load graph</p>
        <button class="btn btn-sm" id="retry-graph">Retry</button>
      </div>
    `;
    const retryBtn = graphContainer.querySelector('#retry-graph');
    if (retryBtn) {
      on(retryBtn as HTMLElement, 'click', () => initGraph(container, props));
    }
  }
}

/**
 * Create vis-network instance
 */
function createVisNetwork(
  container: HTMLElement,
  nodes: GraphNode[],
  edges: GraphEdge[],
  props: KnowledgeGraphProps
): VisNetwork {
  container.innerHTML = ''; // Clear loading

  const visNodes = nodes.map(n => ({
    id: n.id,
    label: n.label || n.name || n.id,
    color: NODE_COLORS[n.type] || NODE_COLORS.default,
    title: `${n.type}: ${n.label || n.name || n.id}`,
    shape: 'dot',
    size: getNodeSize(n),
  }));

  const visEdges = edges.map(e => ({
    from: e.source,
    to: e.target,
    label: e.type,
    arrows: 'to',
    color: { color: '#9ca3af', opacity: 0.6 },
  }));

  const options = {
    nodes: {
      borderWidth: 2,
      shadow: true,
      font: {
        size: 12,
        color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#333',
      },
    },
    edges: {
      width: 1,
      shadow: false,
      smooth: {
        type: 'continuous',
      },
      font: {
        size: 10,
        color: '#9ca3af',
      },
    },
    physics: {
      stabilization: {
        iterations: 100,
      },
      barnesHut: {
        gravitationalConstant: -5000,
        springLength: 150,
      },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
    },
  };

  const network = new window.vis!.Network(container, {
    nodes: new window.vis!.DataSet(visNodes),
    edges: new window.vis!.DataSet(visEdges),
  }, options);

  // Node click handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  network.on('click', (params: any) => {
    if (params.nodes && params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = nodes.find(n => n.id === nodeId);
      if (node && props.onNodeClick) {
        props.onNodeClick(node);
      }
      showNodeDetails(container, node);
    }
  });

  return network;
}

/**
 * Get node size based on connections
 */
function getNodeSize(node: GraphNode): number {
  const connections = (node as unknown as { connections?: number }).connections || 1;
  return Math.min(10 + connections * 2, 30);
}

/**
 * Bind toolbar events
 */
function bindToolbarEvents(
  container: HTMLElement,
  network: VisNetwork,
  nodes: GraphNode[],
  props: KnowledgeGraphProps
): void {
  // Search
  const searchInput = container.querySelector('#graph-search') as HTMLInputElement;
  on(searchInput, 'input', () => {
    const query = searchInput.value.toLowerCase();
    const matchingNode = nodes.find(n => 
      (n.label || n.name || n.id).toLowerCase().includes(query)
    );
    if (matchingNode) {
      network.focus(matchingNode.id, { scale: 1.5 });
    }
  });

  // Refresh
  const refreshBtn = container.querySelector('#graph-refresh');
  if (refreshBtn) {
    on(refreshBtn as HTMLElement, 'click', () => {
      initGraph(container, props);
    });
  }

  // Fit
  const fitBtn = container.querySelector('#graph-fit');
  if (fitBtn) {
    on(fitBtn as HTMLElement, 'click', () => {
      network.fit();
    });
  }

  // Filters
  container.querySelectorAll('.filter-item input').forEach(checkbox => {
    on(checkbox as HTMLElement, 'change', () => {
      // TODO: Implement filtering
      toast.info('Filtering not yet implemented');
    });
  });
}

/**
 * Show node details
 */
function showNodeDetails(container: HTMLElement, node?: GraphNode): void {
  const detailsContainer = container.querySelector('#node-details') as HTMLElement;
  
  if (!node) {
    detailsContainer.style.display = 'none';
    return;
  }

  detailsContainer.style.display = 'block';
  detailsContainer.innerHTML = `
    <div class="details-header">
      <span class="node-type" style="background: ${NODE_COLORS[node.type] || NODE_COLORS.default}">${node.type}</span>
      <span class="node-label">${escapeHtml(node.label || node.name || node.id)}</span>
      <button class="btn-icon close-details">×</button>
    </div>
    ${node.properties ? `
      <div class="details-properties">
        ${Object.entries(node.properties).map(([key, value]) => `
          <div class="property">
            <span class="property-key">${escapeHtml(key)}:</span>
            <span class="property-value">${escapeHtml(String(value))}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  const closeBtn = detailsContainer.querySelector('.close-details');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', () => {
      detailsContainer.style.display = 'none';
    });
  }
}

/**
 * Load graph stats
 */
async function loadStats(container: HTMLElement): Promise<void> {
  try {
    const stats = await graphService.getStats();
    renderStats(container, stats);
  } catch {
    container.innerHTML = '';
  }
}

/**
 * Render stats
 */
function renderStats(container: HTMLElement, stats: GraphStats): void {
  container.innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${stats.nodeCount}</span>
      <span class="stat-label">Nodes</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${stats.edgeCount}</span>
      <span class="stat-label">Edges</span>
    </div>
    ${stats.nodeTypes ? Object.entries(stats.nodeTypes).map(([type, count]) => `
      <div class="stat-item type-${type.toLowerCase()}">
        <span class="stat-value">${count}</span>
        <span class="stat-label">${type}</span>
      </div>
    `).join('') : ''}
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createKnowledgeGraph;
