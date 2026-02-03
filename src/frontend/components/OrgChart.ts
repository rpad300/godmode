/**
 * Org Chart Component
 * Interactive organization chart using vis-network
 */

import { createElement, on } from '../utils/dom';
import { contactsService, Contact } from '../services/contacts';
import { showContactModal } from './modals/ContactModal';

export interface OrgChartProps {
  onNodeClick?: (contact: Contact) => void;
}

interface OrgNode {
  id: string;
  label: string;
  title: string;
  level: number;
  color?: string;
}

interface OrgEdge {
  from: string;
  to: string;
  arrows: string;
}

// vis.js types - using any for callback params to avoid conflicts with other vis.js declarations
interface VisNetworkOrgChart {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, callback: (params: any) => void) => void;
  fit: () => void;
  destroy: () => void;
}

// Helper to get vis module from window
function getVisOrgChart(): { Network: new (container: HTMLElement, data: unknown, options: unknown) => VisNetworkOrgChart; DataSet: new (data: unknown[]) => unknown } | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).vis;
}

/**
 * Create org chart
 */
export function createOrgChart(props: OrgChartProps = {}): HTMLElement {
  const container = createElement('div', { className: 'org-chart' });

  container.innerHTML = `
    <div class="chart-toolbar">
      <button class="btn btn-sm" id="fit-chart-btn">Fit</button>
      <button class="btn btn-sm" id="refresh-chart-btn">Refresh</button>
    </div>
    <div class="chart-container" id="org-chart-container">
      <div class="loading">Loading org chart...</div>
    </div>
  `;

  // Bind toolbar events
  const fitBtn = container.querySelector('#fit-chart-btn');
  if (fitBtn) {
    on(fitBtn as HTMLElement, 'click', () => {
      const network = (container as unknown as { _network?: { fit: () => void } })._network;
      network?.fit();
    });
  }

  const refreshBtn = container.querySelector('#refresh-chart-btn');
  if (refreshBtn) {
    on(refreshBtn as HTMLElement, 'click', () => loadOrgChart(container, props));
  }

  // Initial load
  loadOrgChart(container, props);

  return container;
}

/**
 * Load org chart data
 */
async function loadOrgChart(container: HTMLElement, props: OrgChartProps): Promise<void> {
  const chartContainer = container.querySelector('#org-chart-container') as HTMLElement;
  chartContainer.innerHTML = '<div class="loading">Loading...</div>';

  try {
    // Get contacts with relationships
    const { contacts } = await contactsService.getAll({});
    
    if (contacts.length === 0) {
      chartContainer.innerHTML = `
        <div class="empty-state">
          <p>No contacts to display</p>
        </div>
      `;
      return;
    }

    // Build org chart data
    const { nodes, edges } = buildOrgData(contacts);

    // Check if vis-network is available
    if (!getVisOrgChart()) {
      renderFallbackChart(chartContainer, contacts, props);
      return;
    }

    // Create vis-network
    renderVisNetwork(chartContainer, nodes, edges, contacts, props);
  } catch {
    chartContainer.innerHTML = '<div class="error">Failed to load org chart</div>';
  }
}

/**
 * Build org chart data from contacts
 */
function buildOrgData(contacts: Contact[]): { nodes: OrgNode[]; edges: OrgEdge[] } {
  const nodes: OrgNode[] = [];
  const edges: OrgEdge[] = [];
  const levels: Map<string, number> = new Map();

  // First pass: identify hierarchy
  contacts.forEach(contact => {
    const reportsTo = contact.relationships?.find(r => r.type === 'reports_to');
    if (reportsTo) {
      // Has a manager
      const managerLevel = levels.get(reportsTo.contactId) || 0;
      levels.set(String(contact.id), managerLevel + 1);
    } else {
      // Top level
      levels.set(String(contact.id), 0);
    }
  });

  // Build nodes
  contacts.forEach(contact => {
    nodes.push({
      id: String(contact.id),
      label: contact.name,
      title: `${contact.name}${contact.role ? `\n${contact.role}` : ''}${contact.organization ? `\n${contact.organization}` : ''}`,
      level: levels.get(String(contact.id)) || 0,
      color: contact.teams?.[0]?.color,
    });
  });

  // Build edges (reports_to relationships)
  contacts.forEach(contact => {
    contact.relationships?.forEach(rel => {
      if (rel.type === 'reports_to') {
        edges.push({
          from: rel.contactId,
          to: String(contact.id),
          arrows: 'to',
        });
      }
    });
  });

  return { nodes, edges };
}

/**
 * Render vis-network
 */
function renderVisNetwork(
  container: HTMLElement,
  nodes: OrgNode[],
  edges: OrgEdge[],
  contacts: Contact[],
  props: OrgChartProps
): void {
  container.innerHTML = '';

  const visNodes = nodes.map(n => ({
    id: n.id,
    label: n.label,
    title: n.title,
    level: n.level,
    color: {
      background: n.color || '#6366f1',
      border: n.color || '#4f46e5',
      highlight: { background: '#818cf8', border: '#6366f1' },
    },
    font: { color: '#ffffff' },
    shape: 'box',
    margin: 10,
  }));

  const options = {
    layout: {
      hierarchical: {
        direction: 'UD',
        sortMethod: 'directed',
        levelSeparation: 100,
        nodeSpacing: 150,
      },
    },
    nodes: {
      borderWidth: 2,
      shadow: true,
    },
    edges: {
      color: { color: '#9ca3af', highlight: '#6366f1' },
      width: 2,
      smooth: { type: 'cubicBezier' },
    },
    physics: false,
    interaction: {
      hover: true,
      tooltipDelay: 200,
    },
  };

  const vis = getVisOrgChart()!;
  const network = new vis.Network(container, {
    nodes: new vis.DataSet(visNodes),
    edges: new vis.DataSet(edges),
  }, options);

  // Store reference for fit button
  (container.closest('.org-chart') as unknown as { _network: typeof network })._network = network;

  // Node click handler
  network.on('click', (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const contact = contacts.find(c => String(c.id) === nodeId);
      if (contact) {
        if (props.onNodeClick) {
          props.onNodeClick(contact);
        } else {
          showContactModal({ mode: 'view', contact });
        }
      }
    }
  });

  network.fit();
}

/**
 * Render fallback chart (when vis-network not available)
 */
function renderFallbackChart(container: HTMLElement, contacts: Contact[], props: OrgChartProps): void {
  // Group by organization
  const byOrg: Record<string, Contact[]> = {};
  contacts.forEach(c => {
    const org = c.organization || 'Other';
    if (!byOrg[org]) byOrg[org] = [];
    byOrg[org].push(c);
  });

  container.innerHTML = `
    <div class="fallback-org-chart">
      ${Object.entries(byOrg).map(([org, members]) => `
        <div class="org-group">
          <h4 class="org-name">${escapeHtml(org)}</h4>
          <div class="org-members">
            ${members.map(contact => `
              <div class="org-member" data-id="${contact.id}">
                <div class="member-avatar">${getInitials(contact.name)}</div>
                <div class="member-info">
                  <div class="member-name">${escapeHtml(contact.name)}</div>
                  ${contact.role ? `<div class="member-role">${escapeHtml(contact.role)}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  container.querySelectorAll('.org-member').forEach(el => {
    on(el as HTMLElement, 'click', () => {
      const id = el.getAttribute('data-id');
      const contact = contacts.find(c => String(c.id) === id);
      if (contact) {
        if (props.onNodeClick) {
          props.onNodeClick(contact);
        } else {
          showContactModal({ mode: 'view', contact });
        }
      }
    });
  });
}

/**
 * Get initials
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createOrgChart;
