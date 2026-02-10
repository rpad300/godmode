/**
 * Graph Modal Component
 * Display graph/network visualizations
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { chartsStore } from '../../stores/charts';

const MODAL_ID = 'graph-modal';

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  color?: string;
  size?: number;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: string;
  color?: string;
}

export interface GraphModalProps {
  title?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
}

/**
 * Show graph modal
 */
export function showGraphModal(props: GraphModalProps): void {
  const { title = 'Graph View', nodes, edges, onNodeClick, onEdgeClick } = props;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'graph-modal-content' });

  content.innerHTML = `
    <div class="graph-toolbar">
      <div class="graph-info">
        <span>Nodes: ${nodes.length}</span>
        <span>Edges: ${edges.length}</span>
      </div>
      <div class="graph-controls">
        <button class="btn btn-sm btn-secondary" data-action="zoom-in" title="Zoom In">+</button>
        <button class="btn btn-sm btn-secondary" data-action="zoom-out" title="Zoom Out">−</button>
        <button class="btn btn-sm btn-secondary" data-action="fit" title="Fit to View">⊡</button>
        <button class="btn btn-sm btn-secondary" data-action="fullscreen" title="Fullscreen">⛶</button>
      </div>
    </div>
    <div id="graph-container" class="graph-container">
      <div class="graph-placeholder">
        <p>Loading graph visualization...</p>
        <p class="text-muted">Requires vis-network library</p>
      </div>
    </div>
    <div class="graph-legend">
      ${getUniqueTypes(nodes).map(type => `
        <span class="legend-item">
          <span class="legend-color" style="--legend-color: ${getTypeColor(type)}"></span>
          ${type}
        </span>
      `).join('')}
    </div>
  `;

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const exportBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Export Image',
  });

  const closeBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Close',
  });

  on(exportBtn, 'click', () => {
    // Export graph as image
    const canvas = content.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'graph.png';
      link.href = canvas.toDataURL();
      link.click();
    } else {
      toast.warning('Graph not rendered');
    }
  });

  on(closeBtn, 'click', () => {
    // Destroy network before closing
    chartsStore.destroyNetwork('modal-graph');
    closeModal(MODAL_ID);
  });

  footer.appendChild(exportBtn);
  footer.appendChild(closeBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title,
    content,
    size: 'xl',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Initialize graph after modal is visible
  setTimeout(() => {
    initializeGraph(content, nodes, edges, onNodeClick, onEdgeClick);
    bindControls(content);
  }, 100);
}

/**
 * Initialize graph visualization
 */
function initializeGraph(
  container: HTMLElement,
  nodes: GraphNode[],
  edges: GraphEdge[],
  onNodeClick?: (node: GraphNode) => void,
  onEdgeClick?: (edge: GraphEdge) => void
): void {
  const graphContainer = container.querySelector('#graph-container') as HTMLElement;
  
  // Check if vis-network is available
  if (typeof (window as unknown as { vis?: unknown }).vis === 'undefined') {
    graphContainer.innerHTML = `
      <div class="graph-fallback">
        <h4>Graph Data</h4>
        <div class="graph-data">
          <strong>Nodes (${nodes.length}):</strong>
          <ul>${nodes.slice(0, 10).map(n => `<li>${n.label} (${n.type || 'default'})</li>`).join('')}</ul>
          ${nodes.length > 10 ? `<p class="text-muted">...and ${nodes.length - 10} more</p>` : ''}
        </div>
        <div class="graph-data">
          <strong>Edges (${edges.length}):</strong>
          <ul>${edges.slice(0, 10).map(e => `<li>${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}</li>`).join('')}</ul>
          ${edges.length > 10 ? `<p class="text-muted">...and ${edges.length - 10} more</p>` : ''}
        </div>
        <p class="text-muted"><em>vis-network library not loaded</em></p>
      </div>
    `;
    return;
  }

  const vis = (window as unknown as { vis: typeof import('vis-network') }).vis;

  // Prepare data
  const visNodes = new vis.DataSet(
    nodes.map(n => ({
      id: n.id,
      label: n.label,
      color: n.color || getTypeColor(n.type),
      size: n.size || 20,
    }))
  );

  const visEdges = new vis.DataSet(
    edges.map(e => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label,
      color: e.color,
    }))
  );

  const options = {
    nodes: {
      shape: 'dot',
      font: { color: '#eaeaea', size: 12 },
      borderWidth: 2,
    },
    edges: {
      arrows: 'to',
      color: { color: '#2a2a4a', highlight: '#e94560' },
      font: { color: '#a0a0a0', size: 10 },
    },
    physics: {
      enabled: true,
      stabilization: { iterations: 100 },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
    },
  };

  graphContainer.innerHTML = '';
  const network = new vis.Network(graphContainer, { nodes: visNodes, edges: visEdges }, options);

  // Store reference
  chartsStore.registerNetwork('modal-graph', network, '#graph-container');

  // Bind events
  if (onNodeClick) {
    network.on('click', (params: { nodes: string[] }) => {
      if (params.nodes.length > 0) {
        const node = nodes.find(n => n.id === params.nodes[0]);
        if (node) onNodeClick(node);
      }
    });
  }

  if (onEdgeClick) {
    network.on('click', (params: { edges: string[] }) => {
      if (params.edges.length > 0) {
        const edge = edges.find(e => e.id === params.edges[0]);
        if (edge) onEdgeClick(edge);
      }
    });
  }
}

/**
 * Bind control buttons
 */
function bindControls(container: HTMLElement): void {
  const network = chartsStore.getNetwork('modal-graph') as { 
    moveTo?: (options: object) => void;
    fit?: () => void;
  } | null;
  
  if (!network) return;

  container.querySelectorAll('[data-action]').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const action = btn.getAttribute('data-action');
      
      switch (action) {
        case 'zoom-in':
          network.moveTo?.({ scale: 1.2 });
          break;
        case 'zoom-out':
          network.moveTo?.({ scale: 0.8 });
          break;
        case 'fit':
          network.fit?.();
          break;
        case 'fullscreen':
          const graphContainer = container.querySelector('.graph-container') as HTMLElement;
          if (graphContainer) {
            graphContainer.requestFullscreen?.();
          }
          break;
      }
    });
  });
}

/**
 * Get unique node types
 */
function getUniqueTypes(nodes: GraphNode[]): string[] {
  const types = new Set(nodes.map(n => n.type || 'default'));
  return Array.from(types);
}

/**
 * Get color for type
 */
function getTypeColor(type?: string): string {
  const colors: Record<string, string> = {
    person: '#4ecdc4',
    organization: '#e94560',
    document: '#ffe66d',
    event: '#ff6b6b',
    location: '#45b7d1',
    default: '#a0a0a0',
  };
  return colors[type || 'default'] || colors.default;
}

// Toast import for export feedback
import { toast } from '../../services/toast';

export default showGraphModal;
