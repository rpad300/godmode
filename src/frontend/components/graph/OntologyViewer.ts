/**
 * OntologyViewer - Visual schema explorer and editor
 * 
 * SOTA v2.0 Features:
 * - Entity type visualization with colors and icons
 * - Relationship type explorer
 * - AI suggestions panel with auto-approve
 * - Schema statistics with usage counts
 * - Interactive hierarchy view
 * - Sync status indicator (Supabase Graph)
 * - LLM Analysis integration
 * - Audit trail / change history
 * 
 * SOTA v2.1 Features:
 * - Background jobs monitoring and control
 * - Continuous optimization status
 */

import { createElement, on } from '../../utils/dom';
import { 
  graphService, 
  OntologySchema, 
  OntologyEntityType, 
  OntologyRelationType, 
  OntologySuggestion,
  OntologyTypeStats,
  OntologySyncStatus,
  OntologyChange,
  BackgroundWorkerStatus,
  BackgroundWorkerStats,
  OntologyJob,
  BackgroundJobExecution
} from '../../services/graph';
import { toast } from '../../services/toast';

export interface OntologyViewerProps {
  onEntitySelect?: (entity: OntologyEntityType) => void;
  onRelationSelect?: (relation: OntologyRelationType) => void;
}

interface ViewerState {
  schema: OntologySchema | null;
  suggestions: OntologySuggestion[];
  typeStats: OntologyTypeStats | null;
  syncStatus: OntologySyncStatus | null;
  changes: OntologyChange[];
  workerStatus: BackgroundWorkerStatus | null;
  workerStats: BackgroundWorkerStats | null;
  jobs: OntologyJob[];
  jobLog: BackgroundJobExecution[];
  compliance: { valid: boolean; score: number; issues: Array<{ type: string; severity: string; message: string; count?: number }> } | null;
  falkorBrowserInfo: { browserUrl: string; isCloud: boolean; note: string } | null;
  unusedTypes: { entities: string[]; relations: string[] } | null;
  activeTab: 'entities' | 'relations' | 'graph' | 'suggestions' | 'analytics' | 'history' | 'jobs' | 'tools';
  searchQuery: string;
  isLoading: boolean;
  isAnalyzing: boolean;
  isSyncing: boolean;
}

/**
 * Create the ontology viewer component
 */
export function createOntologyViewer(props: OntologyViewerProps = {}): HTMLElement {
  const state: ViewerState = {
    schema: null,
    suggestions: [],
    typeStats: null,
    syncStatus: null,
    changes: [],
    workerStatus: null,
    workerStats: null,
    jobs: [],
    jobLog: [],
    compliance: null,
    falkorBrowserInfo: null,
    unusedTypes: null,
    activeTab: 'entities',
    searchQuery: '',
    isLoading: true,
    isAnalyzing: false,
    isSyncing: false,
  };

  const container = createElement('div', { className: 'ontology-viewer' });
  
  container.innerHTML = `
    <div class="ontology-header">
      <div class="ontology-tabs">
        <button class="ontology-tab active" data-tab="entities">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M20.4 14.5L16 10l-5.5 5.5"/>
            <path d="M14 14.5L10.5 11 7 14.5"/>
          </svg>
          Entities
        </button>
        <button class="ontology-tab" data-tab="relations">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Relations
        </button>
        <button class="ontology-tab" data-tab="graph">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="18" r="3"/>
            <line x1="9" y1="6" x2="15" y2="6"/>
            <line x1="6" y1="9" x2="6" y2="15"/>
            <line x1="18" y1="9" x2="18" y2="15"/>
            <line x1="9" y1="18" x2="15" y2="18"/>
          </svg>
          Graph
        </button>
        <button class="ontology-tab" data-tab="analytics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Analytics
        </button>
        <button class="ontology-tab" data-tab="suggestions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          AI
          <span class="badge hidden" id="suggestions-badge">0</span>
        </button>
        <button class="ontology-tab" data-tab="history">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          History
        </button>
        <button class="ontology-tab" data-tab="jobs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Jobs
          <span class="badge job-status-badge hidden" id="jobs-badge"></span>
        </button>
        <button class="ontology-tab" data-tab="tools">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Tools
        </button>
      </div>
      <div class="ontology-actions">
        <button class="btn btn-sm btn-ghost" id="btn-sync" title="Sync to graph">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <div class="sync-indicator" id="sync-indicator" title="Sync status">
          <span class="sync-dot"></span>
        </div>
      </div>
      <div class="ontology-search">
        <input type="text" id="ontology-search" placeholder="Search..." class="search-input">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
    </div>
    
    <div class="ontology-content" id="ontology-content">
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading ontology schema...</p>
      </div>
    </div>
    
    <div class="ontology-footer">
      <div class="ontology-stats" id="ontology-stats">
        <!-- Stats will be rendered here -->
      </div>
      <div class="ontology-source" id="ontology-source">
        <!-- Source info -->
      </div>
      <div class="ontology-version" id="ontology-version">
        <!-- Version info -->
      </div>
    </div>
  `;

  // Initialize
  initOntologyViewer(container, state, props);

  return container;
}

/**
 * Initialize the viewer
 */
async function initOntologyViewer(
  container: HTMLElement,
  state: ViewerState,
  props: OntologyViewerProps
): Promise<void> {
  // Bind tabs
  const tabs = container.querySelectorAll('.ontology-tab');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      const tabId = tab.getAttribute('data-tab') as ViewerState['activeTab'];
      if (tabId) {
        switchTab(container, state, tabId, props);
      }
    });
  });

  // Bind search
  const searchInput = container.querySelector('#ontology-search') as HTMLInputElement;
  if (searchInput) {
    on(searchInput, 'input', () => {
      state.searchQuery = searchInput.value.toLowerCase();
      renderCurrentTab(container, state, props);
    });
  }

  // Bind sync button
  const syncBtn = container.querySelector('#btn-sync');
  if (syncBtn) {
    on(syncBtn as HTMLElement, 'click', async () => {
      if (state.isSyncing) return;
      state.isSyncing = true;
      syncBtn.classList.add('syncing');
      toast.info('Syncing ontology to graph...');
      
      const result = await graphService.forceOntologySync();
      
      state.isSyncing = false;
      syncBtn.classList.remove('syncing');
      
      if (result.ok) {
        toast.success('Ontology synced to graph');
        await loadOntologyData(container, state, props);
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
    });
  }

  // Load data
  await loadOntologyData(container, state, props);
}

/**
 * Load ontology data
 */
async function loadOntologyData(
  container: HTMLElement,
  state: ViewerState,
  props: OntologyViewerProps
): Promise<void> {
  try {
    const [schema, suggestions, typeStats, syncStatus, changes, workerData, jobs, jobLog, falkorBrowserInfo] = await Promise.all([
      graphService.getOntologySchema(),
      graphService.getOntologySuggestions(),
      graphService.getOntologyTypeStats(),
      graphService.getOntologySyncStatus(),
      graphService.getOntologyChanges({ limit: 20 }),
      graphService.getBackgroundWorkerStatus(),
      graphService.getOntologyJobs(),
      graphService.getBackgroundWorkerLog({ limit: 10 }),
      graphService.getFalkorDBBrowserInfo(),
    ]);

    state.schema = schema;
    state.suggestions = suggestions.filter(s => s.status === 'pending');
    state.typeStats = typeStats;
    state.syncStatus = syncStatus;
    state.changes = changes;
    state.workerStatus = workerData?.status || null;
    state.workerStats = workerData?.stats || null;
    state.jobs = jobs;
    state.jobLog = jobLog;
    state.falkorBrowserInfo = falkorBrowserInfo;
    state.isLoading = false;

    // Update suggestions badge
    const badge = container.querySelector('#suggestions-badge') as HTMLElement;
    if (badge) {
      if (state.suggestions.length > 0) {
        badge.textContent = String(state.suggestions.length);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // Update jobs badge
    updateJobsBadge(container, state);

    // Update sync indicator
    updateSyncIndicator(container, state);

    // Update stats
    updateStats(container, state);

    // Render initial tab
    renderCurrentTab(container, state, props);

  } catch (error) {
    console.error('[OntologyViewer] Failed to load:', error);
    const content = container.querySelector('#ontology-content');
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <p>Failed to load ontology schema</p>
          <button class="btn btn-sm" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

/**
 * Update sync status indicator
 */
function updateSyncIndicator(container: HTMLElement, state: ViewerState): void {
  const indicator = container.querySelector('#sync-indicator') as HTMLElement;
  if (!indicator) return;

  const dot = indicator.querySelector('.sync-dot') as HTMLElement;
  if (!dot) return;

  if (state.syncStatus) {
    if (state.syncStatus.syncInProgress) {
      dot.className = 'sync-dot syncing';
      indicator.title = 'Syncing...';
    } else if (state.syncStatus.isListening && state.syncStatus.graphConnected) {
      dot.className = 'sync-dot connected';
      indicator.title = `Connected - Last sync: ${state.syncStatus.lastSyncAt ? new Date(state.syncStatus.lastSyncAt).toLocaleTimeString() : 'never'}`;
    } else if (state.syncStatus.graphConnected) {
      dot.className = 'sync-dot partial';
      indicator.title = 'Connected (realtime sync disabled)';
    } else {
      dot.className = 'sync-dot disconnected';
      indicator.title = 'Graph not connected';
    }
  } else {
    dot.className = 'sync-dot unknown';
    indicator.title = 'Status unknown';
  }

  // Update source info
  const sourceEl = container.querySelector('#ontology-source');
  if (sourceEl && state.syncStatus?.ontologySource) {
    sourceEl.textContent = `Source: ${state.syncStatus.ontologySource}`;
  }
}

/**
 * Switch tab
 */
function switchTab(
  container: HTMLElement,
  state: ViewerState,
  tabId: ViewerState['activeTab'],
  props: OntologyViewerProps
): void {
  state.activeTab = tabId;

  // Update tab buttons
  const tabs = container.querySelectorAll('.ontology-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
  });

  // Render content
  renderCurrentTab(container, state, props);
}

/**
 * Render current tab
 */
function renderCurrentTab(
  container: HTMLElement,
  state: ViewerState,
  props: OntologyViewerProps
): void {
  const content = container.querySelector('#ontology-content') as HTMLElement;
  if (!content || !state.schema) return;

  switch (state.activeTab) {
    case 'entities':
      renderEntitiesTab(content, state, props);
      break;
    case 'relations':
      renderRelationsTab(content, state, props);
      break;
    case 'graph':
      renderGraphTab(content, state, props);
      break;
    case 'analytics':
      renderAnalyticsTab(content, state, container);
      break;
    case 'suggestions':
      renderSuggestionsTab(content, state, container);
      break;
    case 'history':
      renderHistoryTab(content, state);
      break;
    case 'jobs':
      renderJobsTab(content, state, container);
      break;
    case 'tools':
      renderToolsTab(content, state, container);
      break;
  }
}

/**
 * Render entities tab
 */
function renderEntitiesTab(
  container: HTMLElement,
  state: ViewerState,
  props: OntologyViewerProps
): void {
  if (!state.schema || !state.schema.entityTypes) {
    container.innerHTML = `<div class="empty-state"><p>No entity types defined in schema</p></div>`;
    return;
  }

  const entities = Object.entries(state.schema.entityTypes)
    .filter(([name, entity]) => {
      if (!state.searchQuery) return true;
      return name.toLowerCase().includes(state.searchQuery) ||
             (entity.label || '').toLowerCase().includes(state.searchQuery) ||
             (entity.description || '').toLowerCase().includes(state.searchQuery);
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (entities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No entity types found${state.searchQuery ? ' matching "' + escapeHtml(state.searchQuery) + '"' : ''}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="ontology-layout">
      <div class="entity-list">
        ${entities.map(([name, entity]) => {
          const propEntries = Object.entries(entity.properties || {});
          const hasMoreProps = propEntries.length > 5;
          return `
            <div class="entity-card" data-entity="${name}">
              <div class="entity-header">
                <div class="entity-icon-wrapper" style="--entity-color: ${entity.color || '#6366f1'}">
                  <span class="entity-icon-letter">${(entity.label || name).charAt(0).toUpperCase()}</span>
                </div>
                <div class="entity-info">
                  <h4 class="entity-name">${escapeHtml(entity.label || name)}</h4>
                  <span class="entity-key">${escapeHtml(name)}</span>
                </div>
                ${entity.sharedEntity ? '<span class="shared-badge">Shared</span>' : ''}
              </div>
              ${entity.description ? `<p class="entity-description">${escapeHtml(entity.description)}</p>` : ''}
              <div class="entity-properties">
                <h5>PROPERTIES (${propEntries.length})</h5>
                <div class="properties-list" data-entity="${name}" data-expanded="false">
                  ${propEntries.slice(0, 5).map(([propName, prop]) => `
                    <div class="property-row">
                      <span class="property-name ${(prop as Record<string, unknown>).required ? 'required' : ''}">${escapeHtml(propName)}</span>
                      <span class="property-type">${(prop as Record<string, unknown>).type || 'string'}</span>
                    </div>
                  `).join('')}
                  ${hasMoreProps ? `
                    <button class="btn-expand-props" data-entity="${name}">+${propEntries.length - 5} more</button>
                    <div class="properties-hidden hidden">
                      ${propEntries.slice(5).map(([propName, prop]) => `
                        <div class="property-row">
                          <span class="property-name ${(prop as Record<string, unknown>).required ? 'required' : ''}">${escapeHtml(propName)}</span>
                          <span class="property-type">${(prop as Record<string, unknown>).type || 'string'}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="entity-detail-panel" id="entity-detail-panel">
        <div class="detail-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M20.4 14.5L16 10l-5.5 5.5"/>
          </svg>
          <p>Select an entity type to view details</p>
        </div>
      </div>
    </div>
  `;

  // Bind card click events
  container.querySelectorAll('.entity-card').forEach(card => {
    on(card as HTMLElement, 'click', (e) => {
      // Don't trigger if clicking expand button
      if ((e.target as HTMLElement).classList.contains('btn-expand-props')) return;
      
      const name = card.getAttribute('data-entity');
      if (name && state.schema?.entityTypes[name]) {
        // Highlight selected card
        container.querySelectorAll('.entity-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        // Show details and position panel next to the clicked card
        showEntityDetails(container, name, state.schema.entityTypes[name]);
        
        // Position the detail panel to align with the clicked card
        const entityList = container.querySelector('.entity-list');
        const detailPanel = container.querySelector('#entity-detail-panel') as HTMLElement;
        if (entityList && detailPanel) {
          const listRect = entityList.getBoundingClientRect();
          const cardRect = (card as HTMLElement).getBoundingClientRect();
          const offsetTop = cardRect.top - listRect.top;
          detailPanel.style.marginTop = `${Math.max(0, offsetTop)}px`;
        }
        
        props.onEntitySelect?.(state.schema.entityTypes[name]);
      }
    });
  });

  // Bind expand buttons
  container.querySelectorAll('.btn-expand-props').forEach(btn => {
    on(btn as HTMLElement, 'click', (e) => {
      e.stopPropagation();
      const entityName = btn.getAttribute('data-entity');
      const propsList = container.querySelector(`.properties-list[data-entity="${entityName}"]`);
      const hiddenProps = propsList?.querySelector('.properties-hidden') as HTMLElement;
      
      if (hiddenProps) {
        const isExpanded = propsList?.getAttribute('data-expanded') === 'true';
        if (isExpanded) {
          hiddenProps.classList.add('hidden');
          btn.textContent = `+${hiddenProps.querySelectorAll('.property-row').length} more`;
          propsList?.setAttribute('data-expanded', 'false');
        } else {
          hiddenProps.classList.remove('hidden');
          btn.textContent = 'Show less';
          propsList?.setAttribute('data-expanded', 'true');
        }
      }
    });
  });
}

/**
 * Show entity details in the detail panel
 */
function showEntityDetails(container: HTMLElement, name: string, entity: OntologyEntityType): void {
  const panel = container.querySelector('#entity-detail-panel');
  if (!panel) return;

  const propEntries = Object.entries(entity.properties || {});
  
  panel.innerHTML = `
    <div class="detail-header" style="--entity-color: ${entity.color || '#6366f1'};">
      <h3>${escapeHtml(entity.label || name)}</h3>
      <span class="detail-key">${escapeHtml(name)}</span>
      ${entity.sharedEntity ? '<span class="shared-badge">Shared across projects</span>' : ''}
    </div>
    ${entity.description ? `<p class="detail-description">${escapeHtml(entity.description)}</p>` : ''}
    
    <div class="detail-section">
      <h4>Properties (${propEntries.length})</h4>
      <table class="properties-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          ${propEntries.map(([propName, prop]) => {
            const p = prop as Record<string, unknown>;
            return `
              <tr>
                <td><code>${escapeHtml(propName)}</code></td>
                <td><span class="type-badge">${p.type || 'string'}</span></td>
                <td>${p.required ? '<span class="required-badge">Required</span>' : '<span class="optional-badge">Optional</span>'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    ${entity.examples && entity.examples.length > 0 ? `
      <div class="detail-section">
        <h4>Examples</h4>
        <ul class="examples-list">
          ${entity.examples.map(ex => `<li>${escapeHtml(String(ex))}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;
}

/**
 * Render relations tab
 */
function renderRelationsTab(
  container: HTMLElement,
  state: ViewerState,
  props: OntologyViewerProps
): void {
  if (!state.schema || !state.schema.relationTypes) {
    container.innerHTML = `<div class="empty-state"><p>No relation types defined in schema</p></div>`;
    return;
  }

  const relations = Object.entries(state.schema.relationTypes)
    .filter(([name, relation]) => {
      if (!state.searchQuery) return true;
      return name.toLowerCase().includes(state.searchQuery) ||
             (relation.label || '').toLowerCase().includes(state.searchQuery) ||
             (relation.description || '').toLowerCase().includes(state.searchQuery);
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (relations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No relation types found${state.searchQuery ? ' matching "' + escapeHtml(state.searchQuery) + '"' : ''}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="relation-list">
      ${relations.map(([name, relation]) => `
        <div class="relation-card" data-relation="${name}">
          <div class="relation-header">
            <div class="relation-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </div>
            <div class="relation-info">
              <h4 class="relation-name">${escapeHtml(relation.label || name)}</h4>
              <span class="relation-key">${escapeHtml(name)}</span>
            </div>
          </div>
          ${relation.description ? `<p class="relation-description">${escapeHtml(relation.description)}</p>` : ''}
          <div class="relation-types">
            <div class="from-types">
              <span class="types-label">From:</span>
              ${(relation.fromTypes || []).map(t => `<span class="type-chip">${escapeHtml(t)}</span>`).join('')}
            </div>
            <div class="to-types">
              <span class="types-label">To:</span>
              ${(relation.toTypes || []).map(t => `<span class="type-chip">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind click events
  container.querySelectorAll('.relation-card').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const name = card.getAttribute('data-relation');
      if (name && state.schema?.relationTypes[name]) {
        props.onRelationSelect?.(state.schema.relationTypes[name]);
      }
    });
  });
}

/**
 * Render graph visualization tab
 */
function renderGraphTab(
  container: HTMLElement,
  state: ViewerState,
  props: OntologyViewerProps
): void {
  if (!state.schema?.entityTypes || !state.schema?.relationTypes) {
    container.innerHTML = `<div class="empty-state"><p>No schema available for graph visualization</p></div>`;
    return;
  }

  // Create graph container
  container.innerHTML = `
    <div class="ontology-graph-container">
      <div id="ontology-graph-canvas" class="ontology-graph-canvas-inner"></div>
    </div>
    <div class="ontology-graph-legend">
      <h5>Legend</h5>
      <div class="ontology-legend-items">
        ${Object.entries(state.schema.entityTypes).map(([name, entity]) => `
          <span class="graph-legend-item">
            <span class="graph-legend-dot" style="--legend-color: ${(entity as Record<string, unknown>).color || '#6366f1'}"></span>
            ${escapeHtml(name)}
          </span>
        `).join('')}
      </div>
    </div>
  `;

  // Initialize vis.js network after DOM is ready
  setTimeout(() => {
    const canvas = container.querySelector('#ontology-graph-canvas') as HTMLElement;
    if (!canvas) return;

    // Get vis.js library
    const vis = (window as unknown as Record<string, unknown>).vis as {
      Network: new (container: HTMLElement, data: unknown, options: unknown) => unknown;
      DataSet: new <T = unknown>(data?: T[]) => { add: (items: T | T[]) => void };
    };
    
    if (!vis) {
      canvas.innerHTML = '<p class="ontology-graph-fallback">vis.js not loaded</p>';
      return;
    }

    // Create nodes from entity types
    const nodes: Array<{ id: string; label: string; color: string; shape: string; font: { color: string } }> = [];
    const entityColors: Record<string, string> = {};
    
    Object.entries(state.schema!.entityTypes).forEach(([name, entity]) => {
      const color = (entity as Record<string, unknown>).color as string || '#6366f1';
      entityColors[name] = color;
      nodes.push({
        id: name,
        label: name,
        color: color,
        shape: 'dot',
        font: { color: getTextColor() }
      });
    });

    // Create edges from relation types
    const edges: Array<{ from: string; to: string; label: string; arrows: string; color: { color: string } }> = [];
    
    Object.entries(state.schema!.relationTypes).forEach(([name, relation]) => {
      const rel = relation as Record<string, unknown>;
      const fromTypes = (rel.fromTypes || []) as string[];
      const toTypes = (rel.toTypes || []) as string[];
      
      // Create edges for each valid from->to combination
      fromTypes.forEach(from => {
        toTypes.forEach(to => {
          if (state.schema!.entityTypes[from] && state.schema!.entityTypes[to]) {
            edges.push({
              from,
              to,
              label: name,
              arrows: 'to',
              color: { color: 'rgba(156, 163, 175, 0.6)' }
            });
          }
        });
      });
    });

    // Create network
    const data = {
      nodes: new vis.DataSet(nodes),
      edges: new vis.DataSet(edges)
    };

    const options = {
      nodes: {
        size: 30,
        borderWidth: 3,
        font: { 
          size: 14, 
          face: 'Inter, system-ui, sans-serif',
          strokeWidth: 3,
          strokeColor: 'rgba(255,255,255,0.8)'
        },
        shadow: {
          enabled: true,
          size: 10,
          color: 'rgba(0,0,0,0.2)'
        }
      },
      edges: {
        font: { size: 9, align: 'top', color: 'rgba(100,100,100,0.7)' },
        smooth: { 
          type: 'curvedCW',
          roundness: 0.2
        },
        width: 1.5,
        selectionWidth: 3,
        hoverWidth: 2
      },
      physics: {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.1,
          springLength: 250,
          springConstant: 0.02,
          damping: 0.3,
          avoidOverlap: 1
        },
        stabilization: { 
          enabled: true,
          iterations: 200,
          fit: true
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true
      },
      layout: {
        improvedLayout: true,
        randomSeed: 42
      }
    };

    const network = new vis.Network(canvas, data, options);
    
    // Fit to view after stabilization
    (network as { once: (event: string, cb: () => void) => void }).once('stabilizationIterationsDone', () => {
      (network as { fit: () => void }).fit();
    });
  }, 100);
}

/**
 * Get text color based on theme
 */
function getTextColor(): string {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '#e5e7eb' : '#1f2937';
}

/**
 * Render suggestions tab
 */
function renderSuggestionsTab(
  container: HTMLElement,
  state: ViewerState,
  parentContainer: HTMLElement
): void {
  if (state.suggestions.length === 0) {
    const hasGaps = state.typeStats?.notInOntology?.entities?.length || 
                    state.typeStats?.notInOntology?.relations?.length;
    const hasUnused = state.typeStats?.unused?.entities?.length ||
                      state.typeStats?.unused?.relations?.length;
    
    container.innerHTML = `
      <div class="ai-suggestions-empty">
        <div class="ai-status-card">
          <div class="ai-status-icon ${hasGaps ? 'warning' : 'success'}">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${hasGaps ? 
                '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' : 
                '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
            </svg>
          </div>
          <div class="ai-status-text">
            <h3>${hasGaps ? 'Schema gaps detected' : 'Ontology is in sync'}</h3>
            <p>${hasGaps ? 
              'Some types in your graph are not defined in the ontology schema.' : 
              'All entity and relation types in your graph are defined in the ontology.'}</p>
          </div>
        </div>
        
        <div class="ai-insights-grid">
          <div class="ai-insight-card">
            <div class="insight-value">${Object.keys(state.typeStats?.entities || {}).length}</div>
            <div class="insight-label">Entity Types in Graph</div>
          </div>
          <div class="ai-insight-card">
            <div class="insight-value">${Object.keys(state.typeStats?.relations || {}).length}</div>
            <div class="insight-label">Relation Types in Graph</div>
          </div>
          <div class="ai-insight-card ${hasGaps ? 'warning' : ''}">
            <div class="insight-value">${(state.typeStats?.notInOntology?.entities?.length || 0) + (state.typeStats?.notInOntology?.relations?.length || 0)}</div>
            <div class="insight-label">Not in Schema</div>
          </div>
          <div class="ai-insight-card ${hasUnused ? 'muted' : ''}">
            <div class="insight-value">${(state.typeStats?.unused?.entities?.length || 0) + (state.typeStats?.unused?.relations?.length || 0)}</div>
            <div class="insight-label">Unused Types</div>
          </div>
        </div>
        
        <div class="ai-actions">
          <button class="btn btn-primary" id="btn-run-ai-analysis">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Run AI Analysis
          </button>
          <button class="btn btn-ghost" id="btn-check-gaps">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Check for Gaps
          </button>
        </div>
        
        ${hasGaps ? `
          <div class="ai-gaps-preview">
            <h4>Detected Gaps</h4>
            <div class="gaps-list">
              ${state.typeStats?.notInOntology?.entities?.map(name => `
                <span class="gap-chip entity">${escapeHtml(name)}</span>
              `).join('') || ''}
              ${state.typeStats?.notInOntology?.relations?.map(name => `
                <span class="gap-chip relation">${escapeHtml(name)}</span>
              `).join('') || ''}
            </div>
            <p class="text-muted">Click "Check for Gaps" to generate suggestions for these types.</p>
          </div>
        ` : ''}
      </div>
    `;
    
    // Bind AI analysis button
    const analyzeBtn = container.querySelector('#btn-run-ai-analysis');
    if (analyzeBtn) {
      on(analyzeBtn as HTMLElement, 'click', async () => {
        toast.info('Running AI analysis...');
        analyzeBtn.classList.add('loading');
        (analyzeBtn as HTMLButtonElement).disabled = true;
        
        const result = await graphService.runLLMAnalysis();
        
        analyzeBtn.classList.remove('loading');
        (analyzeBtn as HTMLButtonElement).disabled = false;
        
        if (result) {
          toast.success(`Analysis complete: ${result.suggestions?.length || 0} suggestions`);
          const suggestions = await graphService.getOntologySuggestions();
          state.suggestions = suggestions.filter(s => s.status === 'pending');
          renderSuggestionsTab(container, state, parentContainer);
          updateSuggestionsBadge(parentContainer, state);
        } else {
          toast.error('Analysis failed');
        }
      });
    }
    
    // Bind check gaps button
    const checkGapsBtn = container.querySelector('#btn-check-gaps');
    if (checkGapsBtn) {
      on(checkGapsBtn as HTMLElement, 'click', async () => {
        toast.info('Checking for gaps...');
        checkGapsBtn.classList.add('loading');
        (checkGapsBtn as HTMLButtonElement).disabled = true;
        
        const result = await graphService.triggerBackgroundAnalysis('gaps');
        
        checkGapsBtn.classList.remove('loading');
        (checkGapsBtn as HTMLButtonElement).disabled = false;
        
        if (result) {
          toast.success('Gap check complete');
          const suggestions = await graphService.getOntologySuggestions();
          state.suggestions = suggestions.filter(s => s.status === 'pending');
          renderSuggestionsTab(container, state, parentContainer);
          updateSuggestionsBadge(parentContainer, state);
        } else {
          toast.error('Gap check failed');
        }
      });
    }
    
    return;
  }

  container.innerHTML = `
    <div class="suggestions-list">
      ${state.suggestions.map(suggestion => `
        <div class="suggestion-card" data-id="${suggestion.id}">
          <div class="suggestion-header">
            <span class="suggestion-type">${suggestion.type}</span>
            <span class="suggestion-name">${escapeHtml(suggestion.name)}</span>
          </div>
          ${suggestion.description ? `<p class="suggestion-description">${escapeHtml(suggestion.description)}</p>` : ''}
          ${suggestion.example ? `<div class="suggestion-example"><strong>Example:</strong> ${escapeHtml(suggestion.example)}</div>` : ''}
          ${suggestion.source ? `<div class="suggestion-source">Source: ${escapeHtml(suggestion.source)}</div>` : ''}
          <div class="suggestion-actions">
            <button class="btn btn-sm btn-primary btn-approve" data-id="${suggestion.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Approve
            </button>
            <button class="btn btn-sm btn-ghost btn-reject" data-id="${suggestion.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind approve/reject
  container.querySelectorAll('.btn-approve').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        const success = await graphService.approveOntologySuggestion(id);
        if (success) {
          toast.success('Suggestion approved');
          state.suggestions = state.suggestions.filter(s => s.id !== id);
          renderSuggestionsTab(container, state, parentContainer);
          updateSuggestionsBadge(parentContainer, state);
        } else {
          toast.error('Failed to approve suggestion');
        }
      }
    });
  });

  container.querySelectorAll('.btn-reject').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        const success = await graphService.rejectOntologySuggestion(id);
        if (success) {
          toast.info('Suggestion rejected');
          state.suggestions = state.suggestions.filter(s => s.id !== id);
          renderSuggestionsTab(container, state, parentContainer);
          updateSuggestionsBadge(parentContainer, state);
        } else {
          toast.error('Failed to reject suggestion');
        }
      }
    });
  });
}

/**
 * Render analytics tab - SOTA v2.0
 */
function renderAnalyticsTab(
  container: HTMLElement,
  state: ViewerState,
  parentContainer: HTMLElement
): void {
  const stats = state.typeStats;
  const compliance = (stats as unknown as { compliance?: { total: number; valid: number; invalid: number; unchecked: number; percentage: number } })?.compliance;
  
  container.innerHTML = `
    <div class="analytics-container">
      ${compliance ? `
        <div class="compliance-overview">
          <div class="compliance-score ${compliance.percentage >= 90 ? 'excellent' : compliance.percentage >= 70 ? 'good' : 'warning'}">
            <div class="compliance-value">${compliance.percentage}%</div>
            <div class="compliance-label">Ontology Compliance</div>
          </div>
          <div class="compliance-details">
            <div class="compliance-stat">
              <span class="stat-value success">${compliance.valid}</span>
              <span class="stat-label">Valid Nodes</span>
            </div>
            <div class="compliance-stat">
              <span class="stat-value ${compliance.invalid > 0 ? 'error' : ''}">${compliance.invalid}</span>
              <span class="stat-label">Invalid Nodes</span>
            </div>
            <div class="compliance-stat">
              <span class="stat-value muted">${compliance.unchecked}</span>
              <span class="stat-label">Unchecked</span>
            </div>
            <div class="compliance-stat">
              <span class="stat-value">${compliance.total}</span>
              <span class="stat-label">Total Nodes</span>
            </div>
          </div>
        </div>
      ` : ''}
      
      <div class="analytics-header">
        <h3>Ontology Analytics</h3>
        <div class="analytics-actions">
          <button class="btn btn-sm btn-primary" id="btn-analyze">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Run LLM Analysis
          </button>
          <button class="btn btn-sm btn-ghost" id="btn-auto-approve" title="Auto-approve high confidence suggestions">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Auto-Approve
          </button>
        </div>
      </div>
      
      ${stats ? `
        <div class="analytics-grid">
          <div class="analytics-card">
            <h4>Entity Type Usage</h4>
            <div class="usage-list">
              ${Object.entries(stats.entities || {})
                .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
                .slice(0, 10)
                .map(([name, data]) => `
                  <div class="usage-row ${!data.inOntology ? 'not-in-ontology' : ''}">
                    <span class="usage-name">${escapeHtml(name)}</span>
                    <span class="usage-count">${data.count}</span>
                    ${!data.inOntology ? '<span class="warning-badge">Not in schema</span>' : ''}
                  </div>
                `).join('')}
            </div>
          </div>
          
          <div class="analytics-card">
            <h4>Relation Type Usage</h4>
            <div class="usage-list">
              ${Object.entries(stats.relations || {})
                .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
                .slice(0, 10)
                .map(([name, data]) => `
                  <div class="usage-row ${!data.inOntology ? 'not-in-ontology' : ''}">
                    <span class="usage-name">${escapeHtml(name)}</span>
                    <span class="usage-count">${data.count}</span>
                    ${!data.inOntology ? '<span class="warning-badge">Not in schema</span>' : ''}
                  </div>
                `).join('')}
            </div>
          </div>
          
          ${(stats.unused?.entities?.length || stats.unused?.relations?.length) ? `
            <div class="analytics-card warning">
              <h4>Unused in Schema</h4>
              <p class="text-muted">These types are defined in the schema but have no instances in the graph.</p>
              ${stats.unused.entities?.length ? `
                <div class="unused-section">
                  <strong>Entities:</strong>
                  <div class="unused-list">
                    ${stats.unused.entities.map(name => `<span class="unused-chip">${escapeHtml(name)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
              ${stats.unused.relations?.length ? `
                <div class="unused-section">
                  <strong>Relations:</strong>
                  <div class="unused-list">
                    ${stats.unused.relations.map(name => `<span class="unused-chip">${escapeHtml(name)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${(stats.notInOntology?.entities?.length || stats.notInOntology?.relations?.length) ? `
            <div class="analytics-card error">
              <h4>Not in Schema</h4>
              <p class="text-muted">These types exist in the graph but are not defined in the schema.</p>
              ${stats.notInOntology.entities?.length ? `
                <div class="not-in-ontology-section">
                  <strong>Entities:</strong>
                  <div class="not-in-ontology-list">
                    ${stats.notInOntology.entities.map(name => `<span class="error-chip">${escapeHtml(name)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
              ${stats.notInOntology.relations?.length ? `
                <div class="not-in-ontology-section">
                  <strong>Relations:</strong>
                  <div class="not-in-ontology-list">
                    ${stats.notInOntology.relations.map(name => `<span class="error-chip">${escapeHtml(name)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      ` : `
        <div class="empty-state">
          <p>No analytics data available. Make sure the graph is connected.</p>
        </div>
      `}
      
      <div id="analysis-results" class="hidden">
        <!-- LLM analysis results will be rendered here -->
      </div>
    </div>
  `;

  // Bind LLM Analysis button
  const analyzeBtn = container.querySelector('#btn-analyze');
  if (analyzeBtn) {
    on(analyzeBtn as HTMLElement, 'click', async () => {
      if (state.isAnalyzing) return;
      state.isAnalyzing = true;
      analyzeBtn.classList.add('loading');
      (analyzeBtn as HTMLButtonElement).disabled = true;
      toast.info('Running LLM analysis... This may take a moment.');
      
      const result = await graphService.runLLMAnalysis();
      
      state.isAnalyzing = false;
      analyzeBtn.classList.remove('loading');
      (analyzeBtn as HTMLButtonElement).disabled = false;
      
      if (result) {
        toast.success(`Analysis complete: ${result.suggestions?.length || 0} new suggestions`);
        
        // Show results
        const resultsEl = container.querySelector('#analysis-results') as HTMLElement;
        if (resultsEl) {
          resultsEl.classList.remove('hidden');
          resultsEl.innerHTML = `
            <div class="analysis-results">
              <h4>LLM Analysis Results</h4>
              <p class="analysis-summary">${escapeHtml(result.summary || result.analysis?.summary || '')}</p>
              ${result.suggestions?.length ? `
                <p class="text-success">${result.suggestions.length} suggestions were added. Check the AI tab to review them.</p>
              ` : ''}
            </div>
          `;
        }
        
        // Refresh suggestions
        const suggestions = await graphService.getOntologySuggestions();
        state.suggestions = suggestions.filter(s => s.status === 'pending');
        updateSuggestionsBadge(parentContainer, state);
      } else {
        toast.error('Analysis failed. Check console for details.');
      }
    });
  }

  // Bind auto-approve button
  const autoApproveBtn = container.querySelector('#btn-auto-approve');
  if (autoApproveBtn) {
    on(autoApproveBtn as HTMLElement, 'click', async () => {
      if (!state.suggestions.length) {
        toast.info('No pending suggestions to approve');
        return;
      }
      
      const result = await graphService.autoApproveHighConfidence(0.85);
      
      if (result.approved > 0) {
        toast.success(`Auto-approved ${result.approved} high-confidence suggestions`);
        // Refresh suggestions
        const suggestions = await graphService.getOntologySuggestions();
        state.suggestions = suggestions.filter(s => s.status === 'pending');
        updateSuggestionsBadge(parentContainer, state);
      } else {
        toast.info('No suggestions met the confidence threshold');
      }
    });
  }
}

/**
 * Render history tab - SOTA v2.0
 */
function renderHistoryTab(
  container: HTMLElement,
  state: ViewerState
): void {
  if (!state.changes || state.changes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <h3>No change history</h3>
        <p>Changes to the ontology schema will be logged here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="history-container">
      <h3>Ontology Change History</h3>
      <div class="history-list">
        ${state.changes.map(change => {
          const icon = getChangeIcon(change.change_type);
          const color = getChangeColor(change.change_type);
          return `
            <div class="history-item">
              <div class="history-icon" style="--history-color: ${color}">
                ${icon}
              </div>
              <div class="history-content">
                <div class="history-header">
                  <span class="history-type" style="--history-color: ${color}">${formatChangeType(change.change_type)}</span>
                  <span class="history-target">${escapeHtml(change.target_type || '')}/${escapeHtml(change.target_name || '')}</span>
                </div>
                ${change.reason ? `<p class="history-reason">${escapeHtml(change.reason)}</p>` : ''}
                <div class="history-meta">
                  <span class="history-source">${escapeHtml(change.source || 'manual')}</span>
                  <span class="history-date">${new Date(change.changed_at).toLocaleString()}</span>
                </div>
                ${change.diff ? `
                  <details class="history-diff">
                    <summary>View changes</summary>
                    <pre>${escapeHtml(JSON.stringify(change.diff, null, 2))}</pre>
                  </details>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Get icon for change type
 */
function getChangeIcon(changeType: string): string {
  if (changeType.includes('added')) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  if (changeType.includes('removed')) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  if (changeType.includes('modified')) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  }
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
}

/**
 * Get color for change type
 */
function getChangeColor(changeType: string): string {
  if (changeType.includes('added')) return 'var(--color-success, #10b981)';
  if (changeType.includes('removed')) return 'var(--color-error, #ef4444)';
  if (changeType.includes('modified')) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-info, #3b82f6)';
}

/**
 * Format change type for display
 */
function formatChangeType(changeType: string): string {
  return changeType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Render jobs tab - SOTA v2.1 Background Worker
 */
function renderJobsTab(
  container: HTMLElement,
  state: ViewerState,
  parentContainer: HTMLElement
): void {
  const { workerStatus, workerStats, jobs, jobLog } = state;
  
  container.innerHTML = `
    <div class="jobs-container">
      <div class="jobs-header">
        <h3>Background Optimization Jobs</h3>
        <div class="worker-status ${workerStatus?.isRunning ? 'running' : ''}">
          <span class="status-dot ${workerStatus?.isRunning ? 'active' : 'idle'}"></span>
          <span>${workerStatus?.isRunning ? 'Running' : 'Idle'}</span>
          ${workerStatus?.hasPendingAnalysis ? '<span class="pending-badge">Analysis Pending</span>' : ''}
        </div>
      </div>
      
      ${workerStats ? `
        <div class="worker-stats">
          <div class="stat-card">
            <span class="stat-value">${workerStats.totalExecutions}</span>
            <span class="stat-label">Total Executions</span>
          </div>
          <div class="stat-card success">
            <span class="stat-value">${workerStats.byStatus?.completed || 0}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat-card error">
            <span class="stat-value">${workerStats.byStatus?.failed || 0}</span>
            <span class="stat-label">Failed</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${workerStats.avgDuration ? (workerStats.avgDuration / 1000).toFixed(1) + 's' : '-'}</span>
            <span class="stat-label">Avg Duration</span>
          </div>
        </div>
      ` : ''}
      
      <div class="jobs-section">
        <h4>Scheduled Jobs</h4>
        <div class="jobs-list">
          ${jobs.length > 0 ? jobs.map(job => `
            <div class="job-card ${job.enabled ? 'enabled' : 'disabled'}">
              <div class="job-info">
                <div class="job-name">${escapeHtml(job.name)}</div>
                <div class="job-meta">
                  <span class="job-schedule">${escapeHtml(job.schedule)}</span>
                  <span class="job-run-count">${job.runCount} runs</span>
                </div>
                ${job.lastRun ? `<div class="job-last-run">Last: ${new Date(job.lastRun).toLocaleString()}</div>` : ''}
                ${job.nextRun ? `<div class="job-next-run">Next: ${new Date(job.nextRun).toLocaleString()}</div>` : ''}
              </div>
              <div class="job-actions">
                <button class="btn btn-sm ${job.enabled ? 'btn-warning' : 'btn-success'} btn-toggle-job" data-job-id="${job.id}" data-enabled="${job.enabled}">
                  ${job.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="btn btn-sm btn-primary btn-run-job" data-job-type="${job.type.replace('ontology_', '')}">
                  Run Now
                </button>
              </div>
            </div>
          `).join('') : '<p class="text-muted">No scheduled jobs found.</p>'}
        </div>
      </div>
      
      <div class="jobs-section">
        <h4>Quick Actions</h4>
        <div class="quick-actions">
          <button class="btn btn-sm btn-outline" id="btn-run-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
            </svg>
            Full Analysis
          </button>
          <button class="btn btn-sm btn-outline" id="btn-run-inference">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Run Inference
          </button>
          <button class="btn btn-sm btn-outline" id="btn-run-dedup">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Check Duplicates
          </button>
          <button class="btn btn-sm btn-outline" id="btn-run-gaps">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Check Gaps
          </button>
        </div>
      </div>
      
      <div class="jobs-section">
        <h4>Recent Executions</h4>
        <div class="execution-log">
          ${jobLog.length > 0 ? jobLog.map(exec => `
            <div class="execution-item ${exec.status}">
              <div class="execution-type">${formatJobType(exec.type)}</div>
              <div class="execution-status">${exec.status}</div>
              <div class="execution-time">${exec.startedAt ? new Date(exec.startedAt).toLocaleString() : ''}</div>
              <div class="execution-duration">${exec.duration ? (exec.duration / 1000).toFixed(1) + 's' : '-'}</div>
              ${exec.error ? `<div class="execution-error">${escapeHtml(exec.error)}</div>` : ''}
            </div>
          `).join('') : '<p class="text-muted">No recent executions.</p>'}
        </div>
      </div>
    </div>
  `;

  // Bind toggle job buttons
  container.querySelectorAll('.btn-toggle-job').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const jobId = btn.getAttribute('data-job-id');
      const currentlyEnabled = btn.getAttribute('data-enabled') === 'true';
      if (jobId) {
        const result = await graphService.toggleOntologyJob(jobId, !currentlyEnabled);
        if (result) {
          toast.success(`Job ${result.enabled ? 'enabled' : 'disabled'}`);
          // Reload jobs
          state.jobs = await graphService.getOntologyJobs();
          renderJobsTab(container, state, parentContainer);
        } else {
          toast.error('Failed to toggle job');
        }
      }
    });
  });

  // Bind run job buttons
  container.querySelectorAll('.btn-run-job').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const jobType = btn.getAttribute('data-job-type') as 'full' | 'inference' | 'dedup' | 'auto_approve' | 'gaps';
      if (jobType) {
        toast.info(`Running ${jobType}...`);
        const result = await graphService.triggerBackgroundAnalysis(jobType);
        if (result && result.status === 'completed') {
          toast.success(`${jobType} completed`);
        } else if (result?.error) {
          toast.error(`Error: ${result.error}`);
        }
        // Reload log
        state.jobLog = await graphService.getBackgroundWorkerLog({ limit: 10 });
        renderJobsTab(container, state, parentContainer);
      }
    });
  });

  // Bind quick action buttons
  const quickActions = [
    { id: 'btn-run-full', type: 'full' as const },
    { id: 'btn-run-inference', type: 'inference' as const },
    { id: 'btn-run-dedup', type: 'dedup' as const },
    { id: 'btn-run-gaps', type: 'gaps' as const }
  ];

  quickActions.forEach(({ id, type }) => {
    const btn = container.querySelector(`#${id}`);
    if (btn) {
      on(btn as HTMLElement, 'click', async () => {
        toast.info(`Running ${type} analysis...`);
        btn.classList.add('loading');
        (btn as HTMLButtonElement).disabled = true;
        
        const result = await graphService.triggerBackgroundAnalysis(type);
        
        btn.classList.remove('loading');
        (btn as HTMLButtonElement).disabled = false;
        
        if (result && result.status === 'completed') {
          toast.success(`${type} analysis completed`);
        } else if (result?.error) {
          toast.error(`Error: ${result.error}`);
        }
        
        // Reload worker status and log
        const workerData = await graphService.getBackgroundWorkerStatus();
        state.workerStatus = workerData?.status || null;
        state.workerStats = workerData?.stats || null;
        state.jobLog = await graphService.getBackgroundWorkerLog({ limit: 10 });
        renderJobsTab(container, state, parentContainer);
      });
    }
  });
}

/**
 * Render tools tab - SOTA v2.1 Advanced Ontology Tools
 */
function renderToolsTab(
  container: HTMLElement,
  state: ViewerState,
  parentContainer: HTMLElement
): void {
  const { compliance } = state;
  
  container.innerHTML = `
    <div class="tools-container">
      <div class="tools-section graph-status">
        <h4>Graph Database</h4>
        <p class="text-muted">Supabase PostgreSQL graph storage - fully managed, zero configuration.</p>
        <div class="graph-status-card">
          <div class="status-indicator active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Connected to Supabase Graph</span>
          </div>
        </div>
      </div>
      
      <div class="tools-section">
        <h4>Ontology Compliance</h4>
        <p class="text-muted">Validate that your graph data conforms to the ontology schema.</p>
        
        ${compliance ? `
          <div class="compliance-card ${compliance.valid ? 'valid' : 'invalid'}">
            <div class="compliance-header">
              <div class="compliance-score-large ${compliance.score >= 90 ? 'excellent' : compliance.score >= 70 ? 'good' : 'warning'}">
                <span class="score-value">${compliance.score}%</span>
                <span class="score-label">Compliance</span>
              </div>
              <div class="compliance-status">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  ${compliance.valid ? 
                    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : 
                    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                </svg>
                <span>${compliance.valid ? 'Compliant' : 'Issues Found'}</span>
              </div>
            </div>
            
            ${compliance.issues.length > 0 ? `
              <div class="compliance-issues">
                <h5>Issues (${compliance.issues.length})</h5>
                <div class="issues-list">
                  ${compliance.issues.slice(0, 10).map(issue => `
                    <div class="issue-item ${issue.severity}">
                      <span class="issue-type">${issue.type.replace(/_/g, ' ')}</span>
                      <span class="issue-message">${escapeHtml(issue.message)}</span>
                      ${issue.count ? `<span class="issue-count">${issue.count}</span>` : ''}
                    </div>
                  `).join('')}
                  ${compliance.issues.length > 10 ? `<p class="text-muted">...and ${compliance.issues.length - 10} more</p>` : ''}
                </div>
              </div>
            ` : ''}
            
            <div class="compliance-actions">
              <button class="btn btn-outline btn-sm" id="btn-recheck-compliance">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Re-check Compliance
              </button>
              <button class="btn btn-ghost btn-sm" id="btn-clear-compliance">Clear</button>
            </div>
          </div>
        ` : `
          <button class="btn btn-outline" id="btn-validate-compliance">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Run Compliance Check
          </button>
        `}
      </div>
      
      <div class="tools-section">
        <h4>Ontology Extraction</h4>
        <p class="text-muted">Extract ontology schema directly from your graph data.</p>
        <div class="tools-grid">
          <button class="btn btn-outline tool-btn" id="btn-extract-ontology">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Extract from Graph</span>
            <small>Auto-detect entity & relation types</small>
          </button>
          
          <button class="btn btn-outline tool-btn" id="btn-diff-ontology">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <span>Compare with Graph</span>
            <small>See what's different</small>
          </button>
          
          <button class="btn btn-outline tool-btn" id="btn-merge-ontology">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Merge & Update</span>
            <small>Add discovered types to schema</small>
          </button>
          
          <button class="btn btn-outline tool-btn" id="btn-find-unused">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <span>Find Unused Types</span>
            <small>Types in schema but not in graph</small>
          </button>
        </div>
      </div>
      
      ${state.unusedTypes ? `
        <div class="tools-section unused-types-section">
          <h4>Unused Types Found</h4>
          <p class="text-muted">These types are defined in the schema but have no instances in the graph.</p>
          
          ${state.unusedTypes.entities.length > 0 ? `
            <div class="unused-group">
              <h5>Unused Entities (${state.unusedTypes.entities.length})</h5>
              <div class="unused-chips">
                ${state.unusedTypes.entities.map(e => `<span class="unused-chip entity">${escapeHtml(e)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          ${state.unusedTypes.relations.length > 0 ? `
            <div class="unused-group">
              <h5>Unused Relations (${state.unusedTypes.relations.length})</h5>
              <div class="unused-chips">
                ${state.unusedTypes.relations.map(r => `<span class="unused-chip relation">${escapeHtml(r)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          <div class="unused-actions">
            <button class="btn btn-warning btn-sm" id="btn-remove-unused">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Remove All Unused Types
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-clear-unused">Clear</button>
          </div>
        </div>
      ` : ''}
      
      <div class="tools-section">
        <h4>Cleanup</h4>
        <p class="text-muted">Remove orphan types from the ontology schema.</p>
        <div class="cleanup-buttons">
          <button class="btn btn-ghost btn-sm" id="btn-cleanup-entities">
            Remove Entities Without Relations
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-cleanup-relations">
            Remove Relations Without Entities
          </button>
        </div>
      </div>
      
    </div>
  `;

  // Bind event handlers
  
  // Validate compliance (initial and re-check)
  const validateBtn = container.querySelector('#btn-validate-compliance') || container.querySelector('#btn-recheck-compliance');
  if (validateBtn) {
    on(validateBtn as HTMLElement, 'click', async () => {
      toast.info('Validating compliance...');
      validateBtn.classList.add('loading');
      (validateBtn as HTMLButtonElement).disabled = true;
      
      const result = await graphService.validateOntologyCompliance();
      
      validateBtn.classList.remove('loading');
      (validateBtn as HTMLButtonElement).disabled = false;
      
      if (result) {
        state.compliance = result;
        toast.success(`Compliance: ${result.score}% - ${result.issues.length} issues found`);
        renderToolsTab(container, state, parentContainer);
      } else {
        toast.error('Failed to validate compliance');
      }
    });
  }
  
  // Clear compliance results
  const clearComplianceBtn = container.querySelector('#btn-clear-compliance');
  if (clearComplianceBtn) {
    on(clearComplianceBtn as HTMLElement, 'click', () => {
      state.compliance = null;
      renderToolsTab(container, state, parentContainer);
    });
  }
  
  // Extract from graph
  const extractBtn = container.querySelector('#btn-extract-ontology');
  if (extractBtn) {
    on(extractBtn as HTMLElement, 'click', async () => {
      toast.info('Extracting ontology from graph...');
      extractBtn.classList.add('loading');
      
      const result = await graphService.extractOntologyFromGraph();
      
      extractBtn.classList.remove('loading');
      
      if (result.ok && result.ontology) {
        const entityCount = Object.keys(result.ontology.entityTypes).length;
        const relCount = Object.keys(result.ontology.relationTypes).length;
        toast.success(`Extracted: ${entityCount} entities, ${relCount} relations`);
      } else {
        toast.error(result.error || 'Failed to extract ontology');
      }
    });
  }
  
  // Diff ontology
  const diffBtn = container.querySelector('#btn-diff-ontology');
  if (diffBtn) {
    on(diffBtn as HTMLElement, 'click', async () => {
      toast.info('Comparing ontology with graph...');
      diffBtn.classList.add('loading');
      
      const result = await graphService.getOntologyDiff();
      
      diffBtn.classList.remove('loading');
      
      if (result) {
        const { diff } = result;
        const inSchemaOnly = diff.entitiesOnlyInA.length + diff.relationsOnlyInA.length;
        const inGraphOnly = diff.entitiesOnlyInB.length + diff.relationsOnlyInB.length;
        
        if (inSchemaOnly === 0 && inGraphOnly === 0) {
          toast.success('Schema and graph are in sync!');
        } else {
          toast.info(`Diff: ${inSchemaOnly} only in schema, ${inGraphOnly} only in graph`);
        }
      } else {
        toast.error('Failed to compare ontology');
      }
    });
  }
  
  // Merge ontology
  const mergeBtn = container.querySelector('#btn-merge-ontology');
  if (mergeBtn) {
    on(mergeBtn as HTMLElement, 'click', async () => {
      toast.info('Merging ontology...');
      mergeBtn.classList.add('loading');
      
      const result = await graphService.mergeOntology({ 
        mergeProperties: true, 
        mergeEndpoints: true, 
        save: true 
      });
      
      mergeBtn.classList.remove('loading');
      
      if (result.ok) {
        const changeCount = result.changes?.length || 0;
        if (changeCount > 0) {
          toast.success(`Merged: ${changeCount} changes applied`);
        } else {
          toast.info('No new types to merge');
        }
      } else {
        toast.error('Failed to merge ontology');
      }
    });
  }
  
  // Find unused
  const unusedBtn = container.querySelector('#btn-find-unused');
  if (unusedBtn) {
    on(unusedBtn as HTMLElement, 'click', async () => {
      toast.info('Finding unused types...');
      unusedBtn.classList.add('loading');
      
      const unused = await graphService.findUnusedOntologyTypes();
      
      unusedBtn.classList.remove('loading');
      
      state.unusedTypes = unused;
      const total = unused.entities.length + unused.relations.length;
      if (total === 0) {
        toast.success('All types are in use!');
      } else {
        toast.info(`Found ${unused.entities.length} unused entities, ${unused.relations.length} unused relations`);
      }
      renderToolsTab(container, state, parentContainer);
    });
  }
  
  // Remove unused types
  const removeUnusedBtn = container.querySelector('#btn-remove-unused');
  if (removeUnusedBtn) {
    on(removeUnusedBtn as HTMLElement, 'click', async () => {
      if (!state.unusedTypes) return;
      
      toast.info('Removing unused types...');
      removeUnusedBtn.classList.add('loading');
      (removeUnusedBtn as HTMLButtonElement).disabled = true;
      
      // Remove entities and relations
      const result = await graphService.cleanupOntology({
        discardEntitiesWithoutRelations: true,
        discardRelationsWithoutEntities: true,
        save: true
      });
      
      removeUnusedBtn.classList.remove('loading');
      (removeUnusedBtn as HTMLButtonElement).disabled = false;
      
      if (result.ok) {
        const removedCount = (result.discardedEntities?.length || 0) + (result.discardedRelations?.length || 0);
        toast.success(`Removed ${removedCount} unused types`);
        state.unusedTypes = null;
        renderToolsTab(container, state, parentContainer);
      } else {
        toast.error('Failed to remove unused types');
      }
    });
  }
  
  // Clear unused types display
  const clearUnusedBtn = container.querySelector('#btn-clear-unused');
  if (clearUnusedBtn) {
    on(clearUnusedBtn as HTMLElement, 'click', () => {
      state.unusedTypes = null;
      renderToolsTab(container, state, parentContainer);
    });
  }
  
  // Cleanup entities
  const cleanupEntitiesBtn = container.querySelector('#btn-cleanup-entities');
  if (cleanupEntitiesBtn) {
    on(cleanupEntitiesBtn as HTMLElement, 'click', async () => {
      const result = await graphService.cleanupOntology({ 
        discardEntitiesWithoutRelations: true, 
        save: true 
      });
      if (result.ok) {
        toast.success(`Removed ${result.discardedEntities?.length || 0} orphan entities`);
      }
    });
  }
  
  // Cleanup relations
  const cleanupRelationsBtn = container.querySelector('#btn-cleanup-relations');
  if (cleanupRelationsBtn) {
    on(cleanupRelationsBtn as HTMLElement, 'click', async () => {
      const result = await graphService.cleanupOntology({ 
        discardRelationsWithoutEntities: true, 
        save: true 
      });
      if (result.ok) {
        toast.success(`Removed ${result.discardedRelations?.length || 0} orphan relations`);
      }
    });
  }
  
}

/**
 * Format job type for display
 */
function formatJobType(type: string): string {
  return type
    .replace('ontology_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Update jobs badge
 */
function updateJobsBadge(container: HTMLElement, state: ViewerState): void {
  const badge = container.querySelector('#jobs-badge') as HTMLElement;
  if (!badge) return;

  if (state.workerStatus?.isRunning) {
    badge.textContent = '';
    badge.className = 'badge job-status-badge running';
    badge.classList.remove('hidden');
    badge.title = 'Job running';
  } else if (state.workerStatus?.hasPendingAnalysis) {
    badge.textContent = '';
    badge.className = 'badge job-status-badge pending';
    badge.classList.remove('hidden');
    badge.title = 'Analysis pending';
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * Update stats
 */
function updateStats(container: HTMLElement, state: ViewerState): void {
  const statsEl = container.querySelector('#ontology-stats');
  const versionEl = container.querySelector('#ontology-version');

  if (statsEl && state.schema) {
    const entityCount = Object.keys(state.schema.entityTypes || {}).length;
    const relationCount = Object.keys(state.schema.relationTypes || {}).length;
    const queryCount = Object.keys(state.schema.queryPatterns || {}).length;

    statsEl.innerHTML = `
      <span class="stat">${entityCount} entities</span>
      <span class="stat">${relationCount} relations</span>
      <span class="stat">${queryCount} patterns</span>
    `;
  }

  if (versionEl && state.schema) {
    versionEl.innerHTML = `Schema v${state.schema.version}`;
  }
}

/**
 * Update suggestions badge
 */
function updateSuggestionsBadge(container: HTMLElement, state: ViewerState): void {
  const badge = container.querySelector('#suggestions-badge') as HTMLElement;
  if (badge) {
    if (state.suggestions.length > 0) {
      badge.textContent = String(state.suggestions.length);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createOntologyViewer;
