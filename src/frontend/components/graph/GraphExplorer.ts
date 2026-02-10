/**
 * GraphExplorer - Main SOTA Knowledge Graph UI Component
 * 
 * Features:
 * - 3-column layout: Filters | Canvas | Details
 * - Tab navigation: Explorer | Ontology | Query | Analytics
 * - Floating AI Copilot
 * - Command Palette (Cmd+K)
 * - Avatar nodes with semantic zoom
 * - Community coloring
 * - Rich hover cards
 */

import { createElement, on } from '../../utils/dom';
import { graphService, GraphNode, GraphStats } from '../../services/graph';
import { toast } from '../../services/toast';
import { fetchWithProject } from '../../services/api';

export interface GraphExplorerProps {
  onNodeSelect?: (node: GraphNode) => void;
  onQueryExecute?: (cypher: string) => void;
}

type TabId = 'explorer' | 'ontology' | 'query' | 'analytics';

type RendererType = 'visjs' | 'falkordb';

interface GraphExplorerState {
  activeTab: TabId;
  isLoading: boolean;
  stats: GraphStats | null;
  selectedNode: GraphNode | null;
  isCopilotOpen: boolean;
  isCommandPaletteOpen: boolean;
  renderer: RendererType;
  filters: {
    entityTypes: string[];
    communityId: number | null;
    searchQuery: string;
  };
}

/**
 * Create the main GraphExplorer component
 */
export function createGraphExplorer(props: GraphExplorerProps = {}): HTMLElement {
  const state: GraphExplorerState = {
    activeTab: 'explorer',
    isLoading: true,
    stats: null,
    selectedNode: null,
    isCopilotOpen: false,
    isCommandPaletteOpen: false,
    renderer: 'falkordb', // Default to FalkorDB canvas for better visuals
    filters: {
      entityTypes: [],
      communityId: null,
      searchQuery: '',
    },
  };

  const container = createElement('div', { className: 'graph-explorer' });
  
  container.innerHTML = `
    <div class="graph-explorer-header">
      <div class="graph-header-left">
        <h1 class="graph-title">
          <svg class="graph-title-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          Knowledge Graph
        </h1>
        <div class="graph-stats-mini" id="graph-stats-mini">
          <span class="stat-loading">Loading...</span>
        </div>
      </div>
      <div class="graph-header-tabs">
        <button class="graph-tab active" data-tab="explorer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Explorer
        </button>
        <button class="graph-tab" data-tab="ontology">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Ontology
        </button>
        <button class="graph-tab" data-tab="query">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          Query
        </button>
        <button class="graph-tab" data-tab="analytics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Analytics
        </button>
      </div>
      <div class="graph-header-actions">
        <button class="graph-action-btn" id="btn-command-palette" title="Command Palette (Ctrl+K)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span class="shortcut-hint">⌘K</span>
        </button>
        <button class="graph-action-btn" id="btn-ai-copilot" title="AI Copilot">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 6v1"/>
            <path d="M12 17v1"/>
            <path d="M6 12h1"/>
            <path d="M17 12h1"/>
          </svg>
          AI Copilot
        </button>
        <button class="graph-action-btn" id="btn-sync" title="Sync to Graph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6"/>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
            <path d="M3 22v-6h6"/>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
        </button>
        <button class="graph-action-btn" id="btn-toggle-renderer" title="Switch Renderer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span id="renderer-label" class="graph-renderer-label">FalkorDB</span>
        </button>
        <button class="graph-action-btn" id="btn-fullscreen" title="Fullscreen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="graph-explorer-body">
      <!-- Left Panel: Filters -->
      <aside class="graph-sidebar graph-sidebar-left" id="graph-sidebar-left">
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
          </h3>
          <div class="filter-search">
            <input type="text" id="graph-search" class="filter-input" placeholder="Search nodes...">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Entity Types
          </h3>
          <div id="entity-type-filters" class="entity-filters">
            <div class="filter-loading">Loading types...</div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            Communities
          </h3>
          <div id="community-filters" class="community-filters">
            <div class="filter-loading">Detecting...</div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Bookmarks
          </h3>
          <div id="bookmarks-list" class="bookmarks-list">
            <div class="empty-state-small">No bookmarks yet</div>
          </div>
        </div>
      </aside>
      
      <!-- Center: Main Content Area -->
      <main class="graph-main">
        <div class="graph-content" id="graph-content">
          <!-- Tab content will be rendered here -->
          <div class="graph-loading">
            <div class="loading-spinner"></div>
            <p>Loading Knowledge Graph...</p>
          </div>
        </div>
        
        <!-- Bottom Bar: Query/Results -->
        <div class="graph-bottom-bar" id="graph-bottom-bar">
          <div class="bottom-bar-tabs">
            <button class="bottom-tab active" data-bottom-tab="quick-actions">Quick Actions</button>
            <button class="bottom-tab" data-bottom-tab="query-history">Query History</button>
            <button class="bottom-tab" data-bottom-tab="results">Results</button>
          </div>
          <div class="bottom-bar-content" id="bottom-bar-content">
            <div class="quick-actions-grid">
              <button class="quick-action-btn" data-action="find-paths">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Find Paths
              </button>
              <button class="quick-action-btn" data-action="detect-communities">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                Detect Communities
              </button>
              <button class="quick-action-btn" data-action="key-people">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Key People
              </button>
              <button class="quick-action-btn" data-action="export-graph">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
              <button class="quick-action-btn" data-action="create-snapshot">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Snapshot
              </button>
              <button class="quick-action-btn" data-action="ai-insights">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                AI Insights
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <!-- Right Panel: Node Details -->
      <aside class="graph-sidebar graph-sidebar-right" id="graph-sidebar-right">
        <div class="node-details-panel" id="node-details-panel">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p>Select a node to view details</p>
          </div>
        </div>
      </aside>
    </div>
    
    <!-- AI Copilot (floating) -->
    <div class="ai-copilot-container hidden" id="ai-copilot-container">
      <!-- Will be populated by AICopilot component -->
    </div>
    
    <!-- Command Palette (modal) -->
    <div class="command-palette-overlay hidden" id="command-palette-overlay">
      <!-- Will be populated by CommandPalette component -->
    </div>
  `;

  // Initialize
  initializeGraphExplorer(container, state, props);

  return container;
}

/**
 * Initialize the GraphExplorer
 */
async function initializeGraphExplorer(
  container: HTMLElement,
  state: GraphExplorerState,
  props: GraphExplorerProps
): Promise<void> {
  // Bind tab switching
  const tabs = container.querySelectorAll('.graph-tab');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      const tabId = tab.getAttribute('data-tab') as TabId;
      if (tabId) {
        switchTab(container, state, tabId, props);
      }
    });
  });

  // Bind bottom bar tabs
  const bottomTabs = container.querySelectorAll('.bottom-tab');
  bottomTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      bottomTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // TODO: Switch bottom bar content
    });
  });

  // Bind header actions
  const btnCopilot = container.querySelector('#btn-ai-copilot');
  if (btnCopilot) {
    on(btnCopilot as HTMLElement, 'click', () => toggleAICopilot(container, state));
  }

  const btnCommandPalette = container.querySelector('#btn-command-palette');
  if (btnCommandPalette) {
    on(btnCommandPalette as HTMLElement, 'click', () => toggleCommandPalette(container, state));
  }

  const btnSync = container.querySelector('#btn-sync');
  if (btnSync) {
    on(btnSync as HTMLElement, 'click', () => syncGraph(container));
  }

  const btnToggleRenderer = container.querySelector('#btn-toggle-renderer');
  if (btnToggleRenderer) {
    on(btnToggleRenderer as HTMLElement, 'click', async () => {
      // Toggle between renderers
      state.renderer = state.renderer === 'falkordb' ? 'visjs' : 'falkordb';
      const label = container.querySelector('#renderer-label');
      if (label) label.textContent = state.renderer === 'falkordb' ? 'FalkorDB' : 'vis.js';
      
      // Reload the explorer tab
      if (state.activeTab === 'explorer') {
        const tabContent = container.querySelector('.graph-tab-content') as HTMLElement;
        if (tabContent) {
          toast.info(`Switching to ${state.renderer === 'falkordb' ? 'FalkorDB Canvas' : 'vis.js'}...`);
          await loadExplorerTab(tabContent, state, props);
        }
      }
    });
  }

  const btnFullscreen = container.querySelector('#btn-fullscreen');
  if (btnFullscreen) {
    on(btnFullscreen as HTMLElement, 'click', () => toggleFullscreen(container));
  }

  // Bind search
  const searchInput = container.querySelector('#graph-search') as HTMLInputElement;
  if (searchInput) {
    on(searchInput, 'input', () => {
      state.filters.searchQuery = searchInput.value;
      // TODO: Filter nodes
    });
  }

  // Bind keyboard shortcuts
  on(document, 'keydown', (e: Event) => {
    const event = e as KeyboardEvent;
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      toggleCommandPalette(container, state);
    }
  });

  // Bind quick actions
  const quickActionBtns = container.querySelectorAll('.quick-action-btn');
  quickActionBtns.forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const action = btn.getAttribute('data-action');
      if (action) {
        handleQuickAction(action, container, state);
      }
    });
  });

  // Load initial data
  await loadInitialData(container, state, props);
}

/**
 * Load initial data
 */
async function loadInitialData(
  container: HTMLElement,
  state: GraphExplorerState,
  props: GraphExplorerProps
): Promise<void> {
  try {
    // Load stats
    const stats = await graphService.getStats();
    state.stats = stats;
    updateStatsMini(container, stats);

    // Load entity types for filters
    const entityTypes = await graphService.getOntologyEntities();
    renderEntityTypeFilters(container, entityTypes, state);

    // Load communities
    const communities = await graphService.getCommunities();
    renderCommunityFilters(container, communities, state);

    // Load bookmarks
    const bookmarks = await graphService.getBookmarks();
    renderBookmarks(container, bookmarks);

    // Load the default tab content
    state.isLoading = false;
    await switchTab(container, state, 'explorer', props);

  } catch (error) {
    console.error('[GraphExplorer] Failed to load initial data:', error);
    const content = container.querySelector('#graph-content');
    if (content) {
      content.innerHTML = `
        <div class="graph-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Failed to load graph</h3>
          <p>Please check your graph database connection in Settings.</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

/**
 * Update stats mini display
 */
function updateStatsMini(container: HTMLElement, stats: GraphStats): void {
  const el = container.querySelector('#graph-stats-mini');
  if (el) {
    const graphName = stats.graphName ? `<span class="stat-graph-name" title="${stats.graphName}">${stats.graphName.length > 20 ? stats.graphName.substring(0, 20) + '...' : stats.graphName}</span><span class="stat-divider">•</span>` : '';
    const connectionStatus = stats.connected === false ? '<span class="stat-disconnected" title="Not connected">⚠️</span>' : '';
    el.innerHTML = `
      ${connectionStatus}
      ${graphName}
      <span class="stat-item"><strong>${stats.nodeCount}</strong> nodes</span>
      <span class="stat-divider">•</span>
      <span class="stat-item"><strong>${stats.edgeCount}</strong> edges</span>
      ${stats.communities ? `<span class="stat-divider">•</span><span class="stat-item"><strong>${stats.communities}</strong> communities</span>` : ''}
    `;
  }
}

/**
 * Render entity type filters
 */
function renderEntityTypeFilters(
  container: HTMLElement,
  entityTypes: Array<{ name: string; label: string; color?: string; icon?: string }>,
  state: GraphExplorerState
): void {
  const el = container.querySelector('#entity-type-filters');
  if (!el) return;

  if (entityTypes.length === 0) {
    el.innerHTML = '<div class="empty-state-small">No entity types found</div>';
    return;
  }

  el.innerHTML = entityTypes.map(type => `
    <label class="entity-filter-item">
      <input type="checkbox" checked data-type="${type.name}">
      <span class="entity-filter-color" style="--entity-color: ${type.color || '#6366f1'}"></span>
      <span class="entity-filter-label">${type.label || type.name}</span>
    </label>
  `).join('');

  // Bind checkboxes
  el.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    on(checkbox as HTMLElement, 'change', () => {
      const type = checkbox.getAttribute('data-type');
      if (type) {
        const checked = (checkbox as HTMLInputElement).checked;
        if (checked) {
          state.filters.entityTypes = state.filters.entityTypes.filter(t => t !== type);
        } else {
          state.filters.entityTypes.push(type);
        }
        // TODO: Trigger filter update
      }
    });
  });
}

/**
 * Render community filters
 */
function renderCommunityFilters(
  container: HTMLElement,
  communities: Array<{ id: number; size: number; hub?: { name: string } }>,
  state: GraphExplorerState
): void {
  const el = container.querySelector('#community-filters');
  if (!el) return;

  if (communities.length === 0) {
    el.innerHTML = '<div class="empty-state-small">No communities detected</div>';
    return;
  }

  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

  el.innerHTML = `
    <label class="community-filter-item">
      <input type="radio" name="community" value="" checked>
      <span class="community-filter-label">All communities</span>
    </label>
    ${communities.slice(0, 8).map((c, i) => `
      <label class="community-filter-item">
        <input type="radio" name="community" value="${c.id}">
        <span class="community-filter-color" style="--community-color: ${colors[i % colors.length]}"></span>
        <span class="community-filter-label">${c.hub?.name || `Community ${c.id + 1}`} (${c.size})</span>
      </label>
    `).join('')}
  `;

  // Bind radios
  el.querySelectorAll('input[type="radio"]').forEach(radio => {
    on(radio as HTMLElement, 'change', () => {
      const value = (radio as HTMLInputElement).value;
      state.filters.communityId = value ? parseInt(value) : null;
      // TODO: Trigger filter update
    });
  });
}

/**
 * Render bookmarks
 */
function renderBookmarks(
  container: HTMLElement,
  bookmarks: Array<{ id: string; node_id: string; node_label: string; node_type: string; node_avatar_url?: string }>
): void {
  const el = container.querySelector('#bookmarks-list');
  if (!el) return;

  if (bookmarks.length === 0) {
    el.innerHTML = '<div class="empty-state-small">No bookmarks yet</div>';
    return;
  }

  el.innerHTML = bookmarks.map(b => `
    <div class="bookmark-item" data-node-id="${b.node_id}">
      ${b.node_avatar_url
        ? `<img class="bookmark-avatar" src="${b.node_avatar_url}" alt="">`
        : `<div class="bookmark-avatar-placeholder">${b.node_label.charAt(0)}</div>`
      }
      <div class="bookmark-info">
        <span class="bookmark-label">${b.node_label}</span>
        <span class="bookmark-type">${b.node_type}</span>
      </div>
    </div>
  `).join('');
}

/**
 * Switch tab
 */
async function switchTab(
  container: HTMLElement,
  state: GraphExplorerState,
  tabId: TabId,
  props: GraphExplorerProps
): Promise<void> {
  state.activeTab = tabId;

  // Update tab buttons
  const tabs = container.querySelectorAll('.graph-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
  });

  // Load tab content
  const content = container.querySelector('#graph-content');
  if (!content) return;

  content.innerHTML = `
    <div class="graph-loading">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  `;

  try {
    switch (tabId) {
      case 'explorer':
        await loadExplorerTab(content as HTMLElement, state, props);
        break;
      case 'ontology':
        await loadOntologyTab(content as HTMLElement);
        break;
      case 'query':
        await loadQueryTab(content as HTMLElement, props);
        break;
      case 'analytics':
        await loadAnalyticsTab(content as HTMLElement);
        break;
    }
  } catch (error) {
    console.error(`[GraphExplorer] Failed to load ${tabId} tab:`, error);
    content.innerHTML = `
      <div class="graph-error">
        <p>Failed to load ${tabId}</p>
        <button class="btn btn-sm" onclick="this.closest('.graph-content').innerHTML = ''">Retry</button>
      </div>
    `;
  }
}

/**
 * Load Explorer tab
 */
async function loadExplorerTab(
  container: HTMLElement,
  state: GraphExplorerState,
  props: GraphExplorerProps
): Promise<void> {
  container.innerHTML = '';
  
  if (state.renderer === 'falkordb') {
    // Use FalkorDB Canvas (better visuals, official component)
    const { createGraphCanvas } = await import('./GraphCanvas');
    const viz = createGraphCanvas({
      height: container.clientHeight || 600,
      onNodeClick: (node) => {
        state.selectedNode = node;
        props.onNodeSelect?.(node);
        updateNodeDetails(container.closest('.graph-explorer') as HTMLElement, node);
      },
      onNodeRightClick: (node) => {
        // Show context menu
        toast.info(`${node.name || node.label || node.id}`);
      },
      onDataLoaded: (stats) => {
        // Update the stats mini display with actual counts
        state.stats = { ...state.stats, ...stats };
        const explorer = container.closest('.graph-explorer') as HTMLElement;
        if (explorer) {
          updateStatsMini(explorer, state.stats);
        }
      },
    });
    container.appendChild(viz);
  } else {
    // Use vis.js (legacy, fallback)
    const { createGraphVisualization } = await import('./GraphVisualization');
    const viz = createGraphVisualization({
      height: container.clientHeight || 600,
      onNodeClick: (node) => {
        state.selectedNode = node;
        props.onNodeSelect?.(node);
        updateNodeDetails(container.closest('.graph-explorer') as HTMLElement, node);
      },
      onNodeDoubleClick: (node) => {
        toast.info(`Expanding connections for ${node.label || node.name || node.id}`);
      },
    });
    container.appendChild(viz);
  }
}

/**
 * Load Ontology tab
 */
async function loadOntologyTab(container: HTMLElement): Promise<void> {
  const { createOntologyViewer } = await import('./OntologyViewer');
  container.innerHTML = '';
  const viewer = createOntologyViewer({});
  container.appendChild(viewer);
}

/**
 * Load Query tab
 */
async function loadQueryTab(
  container: HTMLElement,
  props: GraphExplorerProps
): Promise<void> {
  const { createQueryBuilder } = await import('./QueryBuilder');
  container.innerHTML = '';
  const builder = createQueryBuilder({
    onExecute: (cypher, results) => {
      props.onQueryExecute?.(cypher);
    },
  });
  container.appendChild(builder);
}

/**
 * Load Analytics tab
 */
async function loadAnalyticsTab(container: HTMLElement): Promise<void> {
  const { createGraphAnalytics } = await import('./GraphAnalytics');
  container.innerHTML = '';
  const analytics = createGraphAnalytics({});
  container.appendChild(analytics);
}

/**
 * Update node details panel
 */
function updateNodeDetails(container: HTMLElement, node: GraphNode): void {
  const panel = container.querySelector('#node-details-panel');
  if (!panel) return;

  const avatarUrl = node.avatarUrl || node.photoUrl || (node.properties as Record<string, unknown>)?.avatar_url || (node.properties as Record<string, unknown>)?.photo_url;
  const role = node.role || (node.properties as Record<string, unknown>)?.role;
  const organization = node.organization || (node.properties as Record<string, unknown>)?.organization;
  const email = node.email || (node.properties as Record<string, unknown>)?.email;

  panel.innerHTML = `
    <div class="node-details">
      <div class="node-details-header">
        ${avatarUrl
          ? `<img class="node-avatar-large" src="${avatarUrl}" alt="" onerror="this.classList.add('gm-none')">`
          : `<div class="node-avatar-large node-avatar-placeholder" style="--type-color: ${getTypeColor(node.type)}">${(node.label || node.name || '?').charAt(0).toUpperCase()}</div>`
        }
        <div class="node-header-info">
          <h3 class="node-name">${escapeHtml(node.label || node.name || node.id)}</h3>
          <span class="node-type-badge" style="--type-color: ${getTypeColor(node.type)}">${node.type}</span>
        </div>
        <button class="btn-icon node-bookmark-btn" title="Bookmark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
      
      ${role || organization ? `
        <div class="node-role-info">
          ${role ? `<span class="node-role">${escapeHtml(String(role))}</span>` : ''}
          ${organization ? `<span class="node-org">@ ${escapeHtml(String(organization))}</span>` : ''}
        </div>
      ` : ''}
      
      ${email ? `
        <div class="node-contact-info">
          <a href="mailto:${email}" class="node-email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${escapeHtml(String(email))}
          </a>
        </div>
      ` : ''}
      
      <div class="node-stats">
        <div class="node-stat">
          <span class="node-stat-value">${node.connections || 0}</span>
          <span class="node-stat-label">Connections</span>
        </div>
        ${node.centrality ? `
          <div class="node-stat">
            <span class="node-stat-value">${(node.centrality * 100).toFixed(0)}%</span>
            <span class="node-stat-label">Centrality</span>
          </div>
        ` : ''}
        ${node.communityId !== undefined ? `
          <div class="node-stat">
            <span class="node-stat-value">#${node.communityId + 1}</span>
            <span class="node-stat-label">Community</span>
          </div>
        ` : ''}
      </div>
      
      <div class="node-actions">
        <button class="btn btn-sm btn-secondary" data-action="expand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Expand
        </button>
        <button class="btn btn-sm btn-secondary" data-action="find-paths">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Paths
        </button>
        <button class="btn btn-sm btn-secondary" data-action="ai-explain">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          AI Explain
        </button>
      </div>
      
      ${node.properties ? `
        <div class="node-properties">
          <h4>Properties</h4>
          <div class="properties-list">
            ${Object.entries(node.properties)
              .filter(([key]) => !['id', 'name', 'label', 'type', 'avatar_url', 'photo_url', 'avatarUrl', 'photoUrl'].includes(key))
              .slice(0, 10)
              .map(([key, value]) => `
                <div class="property-item">
                  <span class="property-key">${escapeHtml(key)}:</span>
                  <span class="property-value">${escapeHtml(String(value).substring(0, 100))}</span>
                </div>
              `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Toggle AI Copilot
 */
function toggleAICopilot(container: HTMLElement, state: GraphExplorerState): void {
  state.isCopilotOpen = !state.isCopilotOpen;
  const copilotContainer = container.querySelector('#ai-copilot-container');
  
  if (copilotContainer) {
    if (state.isCopilotOpen) {
      copilotContainer.classList.remove('hidden');
      // Load copilot component if not loaded
      if (!copilotContainer.hasChildNodes()) {
        import('./AICopilot').then(({ createAICopilot }) => {
          const copilot = createAICopilot({
            onClose: () => toggleAICopilot(container, state),
            onHighlightNodes: (nodeIds) => {
              // TODO: Highlight nodes in visualization
              console.log('Highlight nodes:', nodeIds);
            },
          });
          copilotContainer.innerHTML = '';
          copilotContainer.appendChild(copilot);
        });
      }
    } else {
      copilotContainer.classList.add('hidden');
    }
  }
}

/**
 * Toggle Command Palette
 */
function toggleCommandPalette(container: HTMLElement, state: GraphExplorerState): void {
  state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
  const overlay = container.querySelector('#command-palette-overlay');
  
  if (overlay) {
    if (state.isCommandPaletteOpen) {
      overlay.classList.remove('hidden');
      // Load command palette if not loaded
      if (!overlay.hasChildNodes()) {
        import('./CommandPalette').then(({ createCommandPalette }) => {
          const palette = createCommandPalette({
            onClose: () => toggleCommandPalette(container, state),
            onAction: (action) => {
              handleQuickAction(action, container, state);
              toggleCommandPalette(container, state);
            },
          });
          overlay.innerHTML = '';
          overlay.appendChild(palette);
        });
      }
      // Focus search input
      setTimeout(() => {
        const input = overlay.querySelector('input');
        if (input) input.focus();
      }, 100);
    } else {
      overlay.classList.add('hidden');
    }
  }
}

/**
 * Sync graph
 */
async function syncGraph(container: HTMLElement): Promise<void> {
  toast.info('Syncing data to graph...');
  try {
    await fetchWithProject('/api/graph/sync', { method: 'POST' });
    toast.success('Graph synced successfully');
    // Reload data
    const stats = await graphService.getStats();
    updateStatsMini(container, stats);
  } catch {
    toast.error('Failed to sync graph');
  }
}

/**
 * Toggle fullscreen
 */
function toggleFullscreen(container: HTMLElement): void {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen();
  }
}

/**
 * Handle quick action
 */
async function handleQuickAction(action: string, container: HTMLElement, state: GraphExplorerState): Promise<void> {
  switch (action) {
    case 'find-paths':
      toast.info('Select two nodes to find paths between them');
      break;
    case 'detect-communities':
      toast.info('Detecting communities...');
      const communities = await graphService.getCommunities();
      toast.success(`Found ${communities.length} communities`);
      break;
    case 'key-people':
      toast.info('Finding key people...');
      const centrality = await graphService.getCentrality();
      if (centrality.topNodes.length > 0) {
        toast.success(`Top person: ${centrality.topNodes[0].name} (${centrality.topNodes[0].connections} connections)`);
      }
      break;
    case 'export-graph':
      toast.info('Exporting graph...');
      // TODO: Implement export
      break;
    case 'create-snapshot':
      toast.info('Creating snapshot...');
      const data = await graphService.getVisualizationData();
      const stats = await graphService.getStats();
      await graphService.createSnapshot({
        name: `Snapshot ${new Date().toLocaleDateString()}`,
        snapshot_type: 'manual',
        snapshot_data: {
          nodes: data.nodes,
          edges: data.edges,
          stats: stats,
          capturedAt: new Date().toISOString(),
        },
        node_count: stats.nodeCount,
        edge_count: stats.edgeCount,
        is_baseline: false,
      });
      toast.success('Snapshot created');
      break;
    case 'ai-insights':
      toast.info('Generating AI insights...');
      const insights = await graphService.getInsights();
      if (insights.length > 0) {
        toast.success(insights[0].description);
      } else {
        toast.info('No insights available');
      }
      break;
    default:
      console.log('Unknown action:', action);
  }
}

/**
 * Get color for entity type
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
    Email: '#e879f9',
  };
  return colors[type] || '#6b7280';
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createGraphExplorer;
