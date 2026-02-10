/**
 * Facts Panel Component
 * Displays and manages facts with conflict detection, filters, and detail view
 */

import { createElement, on } from '../../utils/dom';
import { factsService, Fact, FactConflict } from '../../services/facts';
import { createFactDetailView, FactDetailViewProps } from '../facts/FactDetailView';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

const CATEGORIES = ['technical', 'process', 'policy', 'people', 'timeline', 'general'] as const;

/** Build FactDetailView props with onFactClick so similar-fact clicks open that fact in the same container */
function factDetailProps(containerEl: HTMLElement, props: FactsPanelProps, fact: Fact): FactDetailViewProps {
  return {
    fact,
    onClose: () => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createFactsPanel(props));
    },
    onUpdate: () => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createFactsPanel(props));
    },
    onFactClick: (clickedFact) => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createFactDetailView(factDetailProps(containerEl, props, clickedFact)));
    },
  };
}

export interface FactsPanelProps {
  onFactClick?: (fact: Fact) => void;
  useDetailView?: boolean;
  containerElement?: HTMLElement;
}

let currentSearch: string = '';
let currentFilter: string = 'all';
let currentView: 'category' | 'source' = 'category';
let showConflicts: boolean = false;

/**
 * Create facts panel
 */
export function createFactsPanel(props: FactsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'sot-panel facts-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Facts</h2>
        <span class="panel-count" id="facts-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="facts-filter" class="filter-select">
          <option value="all">All</option>
          <option value="verified">✓ Verified</option>
          <option value="unverified">Unverified</option>
          <option value="technical">Technical</option>
          <option value="process">Process</option>
          <option value="policy">Policy</option>
          <option value="people">People</option>
          <option value="timeline">Timeline</option>
          <option value="general">General</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="category">By Category</button>
          <button class="view-tab" data-view="source">By Source</button>
        </div>
        <input type="search" id="facts-search" class="search-input" placeholder="Search facts..." title="Search">
        <button class="btn btn-secondary btn-sm" id="check-conflicts-btn" title="Check for conflicting facts">Check Conflicts</button>
        <button class="btn btn-primary btn-sm" id="add-fact-btn">+ Add</button>
      </div>
    </div>
    <div id="conflicts-container" class="conflicts-container hidden"></div>
    <div class="panel-content" id="facts-content">
      <div class="loading">Loading facts...</div>
    </div>
    <div id="removed-facts-container" class="removed-facts-container hidden"></div>
  `;

  // Filter
  const filterSelect = panel.querySelector('#facts-filter') as HTMLSelectElement;
  if (filterSelect) {
    on(filterSelect, 'change', () => {
      currentFilter = filterSelect.value;
      loadFacts(panel, props);
    });
  }

  // View tabs
  const viewTabs = panel.querySelectorAll('.view-tab');
  viewTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.getAttribute('data-view') as 'category' | 'source';
      loadFacts(panel, props);
    });
  });

  // Search
  const searchInput = panel.querySelector('#facts-search') as HTMLInputElement;
  let searchTimeout: number;
  on(searchInput, 'input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      currentSearch = searchInput.value;
      loadFacts(panel, props);
    }, 300);
  });

  const conflictsBtn = panel.querySelector('#check-conflicts-btn');
  if (conflictsBtn) {
    on(conflictsBtn as HTMLElement, 'click', async () => {
      const container = panel.querySelector('#conflicts-container') as HTMLElement;
      await checkConflicts(container, panel, props);
    });
  }

  const addBtn = panel.querySelector('#add-fact-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showAddFactModal(panel, props);
    });
  }

  // Initial load (loadFacts calls refreshRemovedFactsSection at end)
  loadFacts(panel, props);

  return panel;
}

/**
 * Load facts
 */
async function loadFacts(panel: HTMLElement, props: FactsPanelProps): Promise<void> {
  const content = panel.querySelector('#facts-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const categoryFilter = CATEGORIES.includes(currentFilter as typeof CATEGORIES[number])
      ? currentFilter
      : undefined;

    const { facts: rawFacts, total } = await factsService.getAll({
      search: currentSearch || undefined,
      limit: 500,
      category: categoryFilter,
    });

    // Client-side filter for verified/unverified (API may not support these params)
    const facts =
      currentFilter === 'verified' ? rawFacts.filter(f => f.verified) :
      currentFilter === 'unverified' ? rawFacts.filter(f => !f.verified) :
      rawFacts;

    if (currentView === 'source') {
      renderFactsBySource(content, facts, props);
    } else {
      renderFacts(content, facts, props);
    }
    updateCount(panel, facts.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load facts</div>';
  }
  await refreshRemovedFactsSection(panel, props);
}

/**
 * Load and render the "Removed facts" section (for restore / undo). Syncs with graph/FalkorDB on restore.
 */
async function refreshRemovedFactsSection(panel: HTMLElement, props: FactsPanelProps): Promise<void> {
  const container = panel.querySelector('#removed-facts-container') as HTMLElement;
  if (!container) return;
  try {
    const deleted = await factsService.getDeletedFacts();
    if (deleted.length === 0) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="removed-facts-section">
        <div class="removed-facts-header section-header-sota">
          <h3>Removed facts</h3>
          <span class="panel-count removed-count">${deleted.length}</span>
        </div>
        <p class="removed-facts-hint">Restore to undo a conflict resolution; fact will be synced back to the graph.</p>
        <div class="removed-facts-list">
          ${deleted.map(f => `
            <div class="removed-fact-item" data-fact-id="${f.id}">
              <div class="removed-fact-content">${escapeHtml(truncate(f.content ?? '', 100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.conflict-resolve-restore').forEach(btn => {
      const item = (btn as HTMLElement).closest('.removed-fact-item');
      const id = item?.getAttribute('data-fact-id');
      if (id) {
        on(btn as HTMLElement, 'click', async () => {
          try {
            await factsService.restoreFact(id);
            toast.success('Fact restored');
            await loadFacts(panel, props);
            refreshRemovedFactsSection(panel, props);
            const conflictsContainer = panel.querySelector('#conflicts-container') as HTMLElement;
            if (conflictsContainer && !conflictsContainer.classList.contains('hidden')) {
              await checkConflicts(conflictsContainer, panel, props);
            }
          } catch {
            toast.error('Failed to restore fact');
          }
        });
      }
    });
  } catch {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}

/**
 * Render facts list
 */
function renderFacts(container: HTMLElement, facts: Fact[], props: FactsPanelProps): void {
  if (facts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${currentSearch ? 'No facts match your search' : 'No facts found'}</p>
        <button class="btn btn-primary" id="empty-add-fact-btn">Add Fact</button>
      </div>
    `;
    const emptyAddBtn = container.querySelector('#empty-add-fact-btn');
    if (emptyAddBtn) {
      on(emptyAddBtn as HTMLElement, 'click', () => {
        const panel = container.closest('.facts-panel') as HTMLElement;
        if (panel) showAddFactModal(panel, props);
      });
    }
    return;
  }

  // Group by category (same structure as Questions: question-group, group-header, group-items)
  const factsByCategory: Record<string, Fact[]> = {};
  facts.forEach(fact => {
    const cat = fact.category || 'Uncategorized';
    if (!factsByCategory[cat]) factsByCategory[cat] = [];
    factsByCategory[cat].push(fact);
  });
  const categories = Object.keys(factsByCategory);

  if (categories.length > 1) {
    container.innerHTML = Object.entries(factsByCategory).map(([category, catFacts]) => `
      <div class="question-group">
        <div class="group-header">
          <h3>${escapeHtml(category)}</h3>
          <span class="group-count">${catFacts.length}</span>
        </div>
        <div class="group-items">
          ${catFacts.map(fact => createFactCard(fact)).join('')}
        </div>
      </div>
    `).join('');
  } else {
    container.innerHTML = facts.map(fact => createFactCard(fact)).join('');
  }

  // Bind click events (cards use .fact-card-sota, same click target)
  container.querySelectorAll('.fact-card-sota').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const fact = facts.find(f => String(f.id) === id);
      if (!fact) return;
      if (props.useDetailView && props.containerElement) {
        const containerEl = props.containerElement;
        containerEl.innerHTML = '';
        containerEl.appendChild(createFactDetailView(factDetailProps(containerEl, props, fact)));
      } else if (props.onFactClick) {
        props.onFactClick(fact);
      } else {
        import('../modals/FactModal').then(({ showFactModal }) => {
          showFactModal({ mode: 'view', fact });
        });
      }
    });

    // Bind verify button
    const verifyBtn = card.querySelector('.fact-verify-btn');
    if (verifyBtn) {
      on(verifyBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        if (id) {
          try {
            await factsService.verify(id);
            toast.success('Fact verified');
            loadFacts(container.closest('.facts-panel') as HTMLElement, props);
          } catch {
            // Error handled by service
          }
        }
      });
    }
  });
}

/**
 * Render facts grouped by source (same group structure as Questions)
 */
function renderFactsBySource(container: HTMLElement, facts: Fact[], props: FactsPanelProps): void {
  if (facts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${currentSearch ? 'No facts match your search' : 'No facts found'}</p>
        <button class="btn btn-primary" id="empty-add-fact-btn">Add Fact</button>
      </div>
    `;
    const emptyAddBtn = container.querySelector('#empty-add-fact-btn');
    if (emptyAddBtn) {
      on(emptyAddBtn as HTMLElement, 'click', () => {
        const panel = container.closest('.facts-panel') as HTMLElement;
        if (panel) showAddFactModal(panel, props);
      });
    }
    return;
  }
  const bySource: Record<string, Fact[]> = {};
  facts.forEach(fact => {
    const source = fact.source_file || fact.source || 'Unknown source';
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(fact);
  });
  container.innerHTML = Object.entries(bySource).map(([source, catFacts]) => `
    <div class="question-group">
      <div class="group-header">
        <h3>${escapeHtml(source)}</h3>
        <span class="group-count">${catFacts.length}</span>
      </div>
      <div class="group-items">
        ${catFacts.map(fact => createFactCard(fact)).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.fact-card-sota').forEach(card => {
    on(card as HTMLElement, 'click', () => {
      const id = card.getAttribute('data-id');
      const fact = facts.find(f => String(f.id) === id);
      if (!fact) return;
      if (props.useDetailView && props.containerElement) {
        const containerEl = props.containerElement;
        const detailView = createFactDetailView({
          fact,
          onClose: () => {
            containerEl.innerHTML = '';
            const newPanel = createFactsPanel(props);
            containerEl.appendChild(newPanel);
          },
          onUpdate: () => {
            containerEl.innerHTML = '';
            const newPanel = createFactsPanel(props);
            containerEl.appendChild(newPanel);
          },
        });
        containerEl.innerHTML = '';
        containerEl.appendChild(detailView);
      } else if (props.onFactClick) {
        props.onFactClick(fact);
      } else {
        import('../modals/FactModal').then(({ showFactModal }) => {
          showFactModal({ mode: 'view', fact });
        });
      }
    });
    const verifyBtn = card.querySelector('.fact-verify-btn');
    if (verifyBtn) {
      on(verifyBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        if (id) {
          try {
            await factsService.verify(id);
            toast.success('Fact verified');
            loadFacts(container.closest('.facts-panel') as HTMLElement, props);
          } catch {
            // Error handled by service
          }
        }
      });
    }
  });
}

/** Category bar color (left edge) - align with question priority bar */
const CATEGORY_BAR_COLOR: Record<string, string> = {
  technical: '#3b82f6',
  process: '#8b5cf6',
  policy: '#ec4899',
  people: '#10b981',
  timeline: '#f59e0b',
  general: '#6b7280',
};

/**
 * Create fact card HTML - SOTA design aligned with question-card-sota
 */
function createFactCard(fact: Fact): string {
  const category = (fact.category || 'general').toLowerCase();
  const categoryClass = category.replace(/\s+/g, '-');
  const barColor = CATEGORY_BAR_COLOR[category] || CATEGORY_BAR_COLOR.general;
  const confidencePct = fact.confidence != null ? Math.round(fact.confidence * 100) : null;

  return `
    <div class="fact-card-sota question-card-sota ${fact.verified ? 'has-answer' : ''}" data-id="${fact.id}" style="--fact-category-bar: ${barColor}">
      <div class="card-priority-bar fact-category-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="priority-pill fact-category-pill category-${categoryClass}">${escapeHtml(fact.category || 'general')}</span>
            ${confidencePct != null ? `<span class="status-pill status-pending">${confidencePct}%</span>` : ''}
            ${fact.verified ? '<span class="auto-pill">✓ Verified</span>' : ''}
          </div>
          <span class="card-timestamp">${formatRelativeTime(fact.created_at)}</span>
        </div>
        <div class="card-question-text">${escapeHtml(fact.content)}</div>
        <div class="card-bottom-row">
          <div class="card-requester">
            ${fact.source_file || fact.source ? `<span class="card-source-chip">${escapeHtml((fact.source_file || fact.source || '').substring(0, 40))}${(fact.source_file || fact.source || '').length > 40 ? '…' : ''}</span>` : '<span class="card-source-chip text-muted">No source</span>'}
          </div>
          <div class="card-assignment">
            ${fact.verified ? '<span class="answered-badge">Verified</span>' : '<button type="button" class="btn-link fact-verify-btn">Verify</button>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Check for conflicts
 */
async function checkConflicts(container: HTMLElement, panel: HTMLElement, props: FactsPanelProps): Promise<void> {
  container.classList.remove('hidden');
  container.innerHTML = '<div class="loading">Checking for conflicts...</div>';

  try {
    const conflicts = await factsService.detectConflicts();

    if (conflicts.length === 0) {
      container.innerHTML = `
        <div class="no-conflicts">
          <span class="success-icon">✓</span>
          <p>No conflicts detected</p>
        </div>
      `;
      setTimeout(() => {
        container.classList.add('hidden');
      }, 3000);
    } else {
      renderConflicts(container, conflicts, panel, props);
    }
  } catch {
    container.innerHTML = '<div class="error">Failed to check conflicts</div>';
  }
}

/**
 * Render conflicts – SOTA-style cards; each card has "Keep left" / "Keep right" to resolve.
 */
function renderConflicts(container: HTMLElement, conflicts: FactConflict[], panel: HTMLElement, props: FactsPanelProps): void {
  container.innerHTML = `
    <div class="conflicts-section">
      <div class="conflicts-header section-header-sota">
        <h3>Conflicts Detected</h3>
        <span class="conflicts-count panel-count">${conflicts.length}</span>
        <button type="button" class="btn-icon close-conflicts" title="Close">×</button>
      </div>
      <div class="conflicts-list question-group">
        ${conflicts.map((conflict, index) => createConflictCard(conflict, index)).join('')}
      </div>
    </div>
  `;

  const closeBtn = container.querySelector('.close-conflicts');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', () => {
      container.classList.add('hidden');
    });
  }

  conflicts.forEach((conflict, index) => {
    const card = container.querySelector(`[data-conflict-index="${index}"]`);
    if (!card) return;
    const keepLeftBtn = card.querySelector('.conflict-resolve-keep-left');
    const keepRightBtn = card.querySelector('.conflict-resolve-keep-right');
    if (keepLeftBtn) {
      on(keepLeftBtn as HTMLElement, 'click', (e) => {
        e.stopPropagation();
        resolveConflict(conflict, 'left', panel, props, container);
      });
    }
    if (keepRightBtn) {
      on(keepRightBtn as HTMLElement, 'click', (e) => {
        e.stopPropagation();
        resolveConflict(conflict, 'right', panel, props, container);
      });
    }
  });
}

/**
 * Resolve conflict: keep chosen fact, delete the other, refresh facts, re-run AI fact-check, optionally verify kept fact.
 */
async function resolveConflict(
  conflict: FactConflict,
  keep: 'left' | 'right',
  panel: HTMLElement,
  props: FactsPanelProps,
  conflictsContainer: HTMLElement
): Promise<void> {
  const toDelete = keep === 'left' ? conflict.fact2 : conflict.fact1;
  const toKeep = keep === 'left' ? conflict.fact1 : conflict.fact2;
  if (!toDelete?.id) return;
  try {
    await factsService.deleteFact(toDelete.id);
    toast.success(`Removed conflicting fact; kept: "${truncate(toKeep?.content ?? '', 50)}"`);
    await loadFacts(panel, props);
    // Re-run AI fact-check on remaining facts (automatic analysis)
    try {
      await factsService.runFactCheck();
    } catch {
      // Non-blocking
    }
    if (toKeep?.id) {
      try {
        await factsService.verifyFact(toKeep.id);
      } catch {
        // Non-blocking
      }
    }
    await checkConflicts(conflictsContainer, panel, props);
    const updated = await factsService.detectConflicts();
    if (updated.length === 0) {
      conflictsContainer.classList.add('hidden');
      conflictsContainer.innerHTML = '';
    } else {
      renderConflicts(conflictsContainer, updated, panel, props);
    }
    refreshRemovedFactsSection(panel, props);
  } catch {
    toast.error('Failed to resolve conflict');
  }
}

/**
 * Create a single conflict card – isolated layout (no fact-card-sota) + Keep left / Keep right.
 */
function createConflictCard(conflict: FactConflict, index: number): string {
  const type = (conflict.conflictType || 'contradiction').toLowerCase();
  const desc = conflict.description || conflict.reason || 'Conflict detected';
  const barClass = type === 'contradiction' ? 'conflict-bar-contradiction' : type === 'inconsistency' ? 'conflict-bar-inconsistency' : 'conflict-bar-process';

  return `
    <div class="conflict-card-sota" data-conflict-index="${index}">
      <div class="conflict-type-bar ${barClass}"></div>
      <div class="conflict-card-body">
        <div class="conflict-card-top">
          <span class="conflict-type-pill conflict-type-${type}">${escapeHtml(type)}</span>
          ${conflict.confidence != null ? `<span class="conflict-confidence-pill">${Math.round(conflict.confidence * 100)}%</span>` : ''}
        </div>
        <div class="conflict-facts-row">
          <div class="conflict-fact-cell">
            <div class="conflict-fact-snippet">${escapeHtml(truncate(conflict.fact1?.content ?? '', 120))}</div>
            <button type="button" class="btn btn-sm conflict-resolve-keep-left">Keep this</button>
          </div>
          <span class="conflict-vs">vs</span>
          <div class="conflict-fact-cell">
            <div class="conflict-fact-snippet">${escapeHtml(truncate(conflict.fact2?.content ?? '', 120))}</div>
            <button type="button" class="btn btn-sm conflict-resolve-keep-right">Keep this</button>
          </div>
        </div>
        <div class="conflict-description-row">
          <div class="conflict-description">${escapeHtml(desc)}</div>
        </div>
      </div>
    </div>
  `;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + '…';
}

/**
 * Show add fact modal
 */
async function showAddFactModal(panel: HTMLElement, props: FactsPanelProps): Promise<void> {
  // Dynamic import to avoid circular dependency
  const { showFactModal } = await import('../modals/FactModal');
  showFactModal({
    mode: 'create',
    onSave: () => loadFacts(panel, props),
  });
}

/**
 * Update count badge
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#facts-count');
  if (countEl) {
    countEl.textContent = String(count);
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

export default createFactsPanel;
