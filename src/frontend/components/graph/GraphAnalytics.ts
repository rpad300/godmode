/**
 * GraphAnalytics - Analytics and insights dashboard
 * 
 * Features:
 * - Stats cards with key metrics
 * - Community visualization
 * - Centrality ranking
 * - Key people list
 * - Bridge nodes
 * - AI-generated insights
 */

import { createElement, on } from '../../utils/dom';
import { graphService, GraphStats, Community, CentralityMetrics, BridgeNode, GraphInsight } from '../../services/graph';
import { toast } from '../../services/toast';

export interface GraphAnalyticsProps {
  onNodeSelect?: (nodeId: string) => void;
}

interface AnalyticsState {
  stats: GraphStats | null;
  communities: Community[];
  centrality: CentralityMetrics;
  bridges: BridgeNode[];
  insights: GraphInsight[];
  isLoading: boolean;
}

/**
 * Create the graph analytics component
 */
export function createGraphAnalytics(props: GraphAnalyticsProps = {}): HTMLElement {
  const state: AnalyticsState = {
    stats: null,
    communities: [],
    centrality: { topNodes: [] },
    bridges: [],
    insights: [],
    isLoading: true,
  };

  const container = createElement('div', { className: 'graph-analytics' });
  
  container.innerHTML = `
    <div class="analytics-grid">
      <!-- Stats Cards Row -->
      <div class="stats-cards" id="stats-cards">
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-nodes">-</div>
            <div class="stat-label">Total Nodes</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-edges">-</div>
            <div class="stat-label">Total Edges</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-communities">-</div>
            <div class="stat-label">Communities</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value" id="stat-people">-</div>
            <div class="stat-label">People</div>
          </div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="analytics-main">
        <!-- Left Column -->
        <div class="analytics-column">
          <!-- Entity Types Distribution -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                Entity Distribution
              </h3>
            </div>
            <div class="card-content" id="entity-distribution">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>

          <!-- Communities -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                Communities
              </h3>
              <button class="card-action" id="btn-detect-communities">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 2v6h-6"/>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                </svg>
                Detect
              </button>
            </div>
            <div class="card-content" id="communities-list">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>
        </div>

        <!-- Center Column -->
        <div class="analytics-column">
          <!-- Key People -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Key People (by Centrality)
              </h3>
            </div>
            <div class="card-content" id="key-people">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>

          <!-- Bridge Nodes -->
          <div class="analytics-card">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                Bridge Nodes
              </h3>
            </div>
            <div class="card-content" id="bridge-nodes">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="analytics-column">
          <!-- AI Insights -->
          <div class="analytics-card analytics-card-full">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                AI Insights
              </h3>
              <button class="card-action" id="btn-generate-insights">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Generate
              </button>
            </div>
            <div class="card-content" id="ai-insights">
              <div class="loading-state"><div class="loading-spinner"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize
  initAnalytics(container, state, props);

  return container;
}

/**
 * Initialize analytics
 */
async function initAnalytics(
  container: HTMLElement,
  state: AnalyticsState,
  props: GraphAnalyticsProps
): Promise<void> {
  // Bind actions
  const btnDetectCommunities = container.querySelector('#btn-detect-communities');
  if (btnDetectCommunities) {
    on(btnDetectCommunities as HTMLElement, 'click', async () => {
      toast.info('Detecting communities...');
      const communities = await graphService.getCommunities();
      state.communities = communities;
      renderCommunities(container, state, props);
      toast.success(`Found ${communities.length} communities`);
    });
  }

  const btnGenerateInsights = container.querySelector('#btn-generate-insights');
  if (btnGenerateInsights) {
    on(btnGenerateInsights as HTMLElement, 'click', async () => {
      toast.info('Generating AI insights...');
      const insights = await graphService.getInsights();
      state.insights = insights;
      renderInsights(container, state);
      toast.success(`Generated ${insights.length} insights`);
    });
  }

  // Load data
  await loadAnalyticsData(container, state, props);
}

/**
 * Load all analytics data
 */
async function loadAnalyticsData(
  container: HTMLElement,
  state: AnalyticsState,
  props: GraphAnalyticsProps
): Promise<void> {
  try {
    const [stats, communities, centrality, bridges, insights] = await Promise.all([
      graphService.getStats(),
      graphService.getCommunities(),
      graphService.getCentrality(),
      graphService.getBridges(),
      graphService.getInsights(),
    ]);

    state.stats = stats;
    state.communities = communities;
    state.centrality = centrality;
    state.bridges = bridges;
    state.insights = insights;
    state.isLoading = false;

    // Render all sections
    renderStats(container, state);
    renderEntityDistribution(container, state);
    renderCommunities(container, state, props);
    renderKeyPeople(container, state, props);
    renderBridgeNodes(container, state, props);
    renderInsights(container, state);

  } catch (error) {
    console.error('[GraphAnalytics] Failed to load:', error);
    state.isLoading = false;
  }
}

/**
 * Render stats cards
 */
function renderStats(container: HTMLElement, state: AnalyticsState): void {
  const stats = state.stats;
  if (!stats) return;

  const nodeCount = container.querySelector('#stat-nodes');
  const edgeCount = container.querySelector('#stat-edges');
  const communityCount = container.querySelector('#stat-communities');
  const peopleCount = container.querySelector('#stat-people');

  if (nodeCount) nodeCount.textContent = formatNumber(stats.nodeCount);
  if (edgeCount) edgeCount.textContent = formatNumber(stats.edgeCount);
  if (communityCount) communityCount.textContent = formatNumber(state.communities.length);
  if (peopleCount) {
    const people = stats.nodeTypes?.Person || stats.nodeTypes?.person || 0;
    peopleCount.textContent = formatNumber(people);
  }
}

/**
 * Render entity distribution
 */
function renderEntityDistribution(container: HTMLElement, state: AnalyticsState): void {
  const el = container.querySelector('#entity-distribution');
  if (!el || !state.stats?.nodeTypes) {
    if (el) el.innerHTML = '<div class="empty-state-small">No data available</div>';
    return;
  }

  const types = Object.entries(state.stats.nodeTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const total = types.reduce((sum, [, count]) => sum + count, 0);
  const maxCount = Math.max(...types.map(([, count]) => count));

  el.innerHTML = `
    <div class="distribution-chart">
      ${types.map(([type, count]) => {
        const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
        const width = maxCount > 0 ? (count / maxCount * 100) : 0;
        return `
          <div class="distribution-row">
            <div class="distribution-label">
              <span class="type-dot" style="--type-color: ${getTypeColor(type)}"></span>
              <span class="type-name">${escapeHtml(type)}</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar" style="--bar-width: ${width}%; --bar-color: ${getTypeColor(type)}"></div>
            </div>
            <div class="distribution-value">${count} (${percentage}%)</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render communities
 */
function renderCommunities(
  container: HTMLElement,
  state: AnalyticsState,
  props: GraphAnalyticsProps
): void {
  const el = container.querySelector('#communities-list');
  if (!el) return;

  if (state.communities.length === 0) {
    el.innerHTML = `
      <div class="empty-state-small">
        <p>No communities detected</p>
        <p class="text-muted">Click "Detect" to find communities</p>
      </div>
    `;
    return;
  }

  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

  el.innerHTML = `
    <div class="communities-grid">
      ${state.communities.slice(0, 6).map((community, i) => `
        <div class="community-card" data-id="${community.id}">
          <div class="community-header">
            <div class="community-color" style="--community-color: ${colors[i % colors.length]}"></div>
            <span class="community-name">${community.hub?.name || `Community ${i + 1}`}</span>
          </div>
          <div class="community-stats">
            <span class="community-size">${community.size} members</span>
          </div>
          ${community.members.slice(0, 3).map(m => `
            <div class="community-member">
              <span class="member-type" style="--member-type-color: ${getTypeColor(m.type)}">${m.type}</span>
              <span class="member-name">${escapeHtml(m.name)}</span>
            </div>
          `).join('')}
          ${community.members.length > 3 ? `<div class="community-more">+${community.members.length - 3} more</div>` : ''}
        </div>
      `).join('')}
    </div>
    ${state.communities.length > 6 ? `<div class="show-more">+${state.communities.length - 6} more communities</div>` : ''}
  `;

  // Bind click events
  el.querySelectorAll('.community-card').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      if (id) {
        toast.info(`Filtering by community ${id}`);
        // TODO: Filter graph by community
      }
    });
  });
}

/**
 * Render key people
 */
function renderKeyPeople(
  container: HTMLElement,
  state: AnalyticsState,
  props: GraphAnalyticsProps
): void {
  const el = container.querySelector('#key-people');
  if (!el) return;

  if (!state.centrality.topNodes || state.centrality.topNodes.length === 0) {
    el.innerHTML = '<div class="empty-state-small">No centrality data available</div>';
    return;
  }

  const maxConnections = Math.max(...state.centrality.topNodes.map(n => n.connections));

  el.innerHTML = `
    <div class="key-people-list">
      ${state.centrality.topNodes.slice(0, 10).map((person, i) => `
        <div class="key-person" data-id="${person.id}">
          <div class="person-rank">${i + 1}</div>
          <div class="person-avatar">
            ${person.avatarUrl
              ? `<img src="${person.avatarUrl}" alt="" onerror="this.classList.add('gm-none')">`
              : `<div class="avatar-placeholder">${getInitials(person.name)}</div>`
            }
          </div>
          <div class="person-info">
            <div class="person-name">${escapeHtml(person.name)}</div>
            <div class="person-type">${person.type}</div>
          </div>
          <div class="person-metrics">
            <div class="connections-bar-container">
              <div class="connections-bar" style="--bar-width: ${(person.connections / maxConnections) * 100}%"></div>
            </div>
            <span class="connections-count">${person.connections}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  el.querySelectorAll('.key-person').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const id = item.getAttribute('data-id');
      if (id) props.onNodeSelect?.(id);
    });
  });
}

/**
 * Render bridge nodes
 */
function renderBridgeNodes(
  container: HTMLElement,
  state: AnalyticsState,
  props: GraphAnalyticsProps
): void {
  const el = container.querySelector('#bridge-nodes');
  if (!el) return;

  if (state.bridges.length === 0) {
    el.innerHTML = '<div class="empty-state-small">No bridge nodes detected</div>';
    return;
  }

  el.innerHTML = `
    <div class="bridge-nodes-list">
      ${state.bridges.slice(0, 8).map(bridge => `
        <div class="bridge-node" data-id="${bridge.id}">
          <div class="bridge-info">
            <span class="bridge-name">${escapeHtml(bridge.name)}</span>
            <span class="bridge-connections">Connects ${bridge.connects} groups</span>
          </div>
          ${bridge.org1 && bridge.org2 ? `
            <div class="bridge-path">
              <span class="org">${escapeHtml(bridge.org1)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span class="org">${escapeHtml(bridge.org2)}</span>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  el.querySelectorAll('.bridge-node').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const id = item.getAttribute('data-id');
      if (id) props.onNodeSelect?.(id);
    });
  });
}

/**
 * Render AI insights
 */
function renderInsights(container: HTMLElement, state: AnalyticsState): void {
  const el = container.querySelector('#ai-insights');
  if (!el) return;

  if (state.insights.length === 0) {
    el.innerHTML = `
      <div class="empty-state-small">
        <p>No insights available</p>
        <p class="text-muted">Click "Generate" to create AI insights</p>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="insights-list">
      ${state.insights.map(insight => `
        <div class="insight-card insight-${insight.importance}">
          <div class="insight-header">
            <span class="insight-type">${insight.type}</span>
            <span class="insight-importance">${insight.importance}</span>
          </div>
          <h4 class="insight-title">${escapeHtml(insight.title)}</h4>
          <p class="insight-description">${escapeHtml(insight.description)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Get type color
 */
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
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
  };
  return colors[type] || '#6b7280';
}

/**
 * Get initials
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
 * Format number
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createGraphAnalytics;
