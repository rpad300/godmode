/**
 * Decisions Panel Component
 * Displays and manages decisions with conflict detection, filters, detail view, and removed section
 */

import { createElement, on } from '@lib/dom';
import { decisionsService, Decision, DecisionConflict } from '@services/decisions';
import { dataStore } from '@stores/data';
import { showDecisionModal } from '../modals/DecisionModal';
import { createDecisionDetailView, DecisionDetailViewProps } from '../decisions/DecisionDetailView';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

/** Build DecisionDetailView props with onDecisionClick so similar-decision clicks open that decision in the same container */
function decisionDetailProps(containerEl: HTMLElement, props: DecisionsPanelProps, decision: Decision): DecisionDetailViewProps {
  return {
    decision,
    onClose: () => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createDecisionsPanel(props));
    },
    onUpdate: () => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createDecisionsPanel(props));
    },
    onDecisionClick: (clickedDecision) => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createDecisionDetailView(decisionDetailProps(containerEl, props, clickedDecision)));
    },
  };
}

export interface DecisionsPanelProps {
  onDecisionClick?: (decision: Decision) => void;
  useDetailView?: boolean;
  containerElement?: HTMLElement;
}

let currentFilter: string = 'all';
let currentSearch: string = '';
let currentView: 'status' | 'source' = 'status';

/**
 * Create decisions panel
 */
export function createDecisionsPanel(props: DecisionsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'sot-panel decisions-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Decisions</h2>
        <span class="panel-count" id="decisions-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="decisions-filter" class="filter-select">
          <option value="all">All</option>
          <option value="proposed">Proposed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="deferred">Deferred</option>
          <option value="active">Active</option>
          <option value="superseded">Superseded</option>
          <option value="revoked">Revoked</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="status">By Status</button>
          <button class="view-tab" data-view="source">By Source</button>
        </div>
        <input type="search" id="decisions-search" class="search-input" placeholder="Search decisions..." title="Search">
        <button class="btn btn-secondary btn-sm" id="check-conflicts-btn" title="Check for conflicting decisions">Check Conflicts</button>
        <button class="btn btn-primary btn-sm" id="add-decision-btn">+ Add</button>
      </div>
    </div>
    <div id="conflicts-container" class="conflicts-container hidden"></div>
    <div class="panel-content" id="decisions-content">
      <div class="loading">Loading decisions...</div>
    </div>
    <div id="removed-decisions-container" class="removed-decisions-container hidden"></div>
  `;

  const filterSelect = panel.querySelector('#decisions-filter') as HTMLSelectElement;
  on(filterSelect, 'change', () => {
    currentFilter = filterSelect.value;
    loadDecisions(panel, props);
  });

  const viewTabs = panel.querySelectorAll('.view-tab');
  viewTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.getAttribute('data-view') as 'status' | 'source';
      loadDecisions(panel, props);
    });
  });

  const searchInput = panel.querySelector('#decisions-search') as HTMLInputElement;
  let searchTimeout: number;
  on(searchInput, 'input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      currentSearch = searchInput.value.trim();
      loadDecisions(panel, props);
    }, 300);
  });

  const checkConflictsBtn = panel.querySelector('#check-conflicts-btn');
  if (checkConflictsBtn) {
    on(checkConflictsBtn as HTMLElement, 'click', async () => {
      const container = panel.querySelector('#conflicts-container') as HTMLElement;
      await checkConflicts(container, panel, props);
    });
  }

  const addBtn = panel.querySelector('#add-decision-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showDecisionModal({
        mode: 'create',
        onSave: () => {
          loadDecisions(panel, props);
          refreshRemovedSection(panel, props);
        },
      });
    });
  }

  loadDecisions(panel, props);
  refreshRemovedSection(panel, props);

  return panel;
}

async function checkConflicts(container: HTMLElement, panel: HTMLElement, props: DecisionsPanelProps): Promise<void> {
  container.classList.remove('hidden');
  container.innerHTML = '<div class="loading">Checking for conflicts...</div>';
  try {
    const result = await decisionsService.runDecisionCheck();
    const conflicts = result.conflicts || [];
    if (conflicts.length === 0) {
      container.innerHTML = `
        <div class="no-conflicts">
          <span class="success-icon">✓</span>
          <p>No conflicts detected</p>
        </div>
      `;
      return;
    }
    container.innerHTML = conflicts.map((c: DecisionConflict) => createConflictCard(c, panel, props)).join('');
    bindConflictCards(container, panel, props);
  } catch {
    container.innerHTML = '<div class="error">Failed to check conflicts</div>';
  }
}

function createConflictCard(c: DecisionConflict, panel: HTMLElement, props: DecisionsPanelProps): string {
  const d1 = c.decision1;
  const d2 = c.decision2;
  const desc = (c.description || c.reason || 'Conflict').substring(0, 200);
  return `
    <div class="conflict-card-sota" data-decision-id1="${d1.id}" data-decision-id2="${d2.id}">
      <div class="conflict-card-priority-bar conflict-card-priority-bar-warning"></div>
      <div class="conflict-card-body">
        <div class="conflict-card-header">
          <span class="conflict-type-badge">Conflict</span>
          <p class="conflict-description">${escapeHtml(desc)}</p>
        </div>
        <div class="conflict-pair">
          <div class="conflict-item">
            <div class="conflict-item-content">${escapeHtml((d1.content || '').substring(0, 120))}${(d1.content || '').length > 120 ? '…' : ''}</div>
            <button type="button" class="btn btn-sm conflict-keep-btn" data-keep-id="${d1.id}" data-discard-id="${d2.id}">Keep this</button>
          </div>
          <div class="conflict-vs">vs</div>
          <div class="conflict-item">
            <div class="conflict-item-content">${escapeHtml((d2.content || '').substring(0, 120))}${(d2.content || '').length > 120 ? '…' : ''}</div>
            <button type="button" class="btn btn-sm conflict-keep-btn" data-keep-id="${d2.id}" data-discard-id="${d1.id}">Keep this</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindConflictCards(container: HTMLElement, panel: HTMLElement, props: DecisionsPanelProps): void {
  container.querySelectorAll('.conflict-keep-btn').forEach((btn) => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const keepId = (btn as HTMLElement).getAttribute('data-keep-id');
      const discardId = (btn as HTMLElement).getAttribute('data-discard-id');
      if (!keepId || !discardId) return;
      try {
        await decisionsService.delete(discardId);
        await decisionsService.runDecisionCheck();
        await decisionsService.update(keepId, { status: 'approved' as const });
        toast.success('Conflict resolved');
        loadDecisions(panel, props);
        await checkConflicts(container, panel, props);
        refreshRemovedSection(panel, props);
      } catch {
        toast.error('Failed to resolve conflict');
      }
    });
  });
}

async function refreshRemovedSection(panel: HTMLElement, props: DecisionsPanelProps): Promise<void> {
  const container = panel.querySelector('#removed-decisions-container') as HTMLElement;
  if (!container) return;
  try {
    const deleted = await decisionsService.getDeletedDecisions();
    if (deleted.length === 0) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="removed-decisions-section">
        <div class="removed-decisions-header section-header-sota">
          <h3>Removed decisions</h3>
          <span class="panel-count removed-count">${deleted.length}</span>
        </div>
        <p class="removed-decisions-hint">Restore to undo a conflict resolution; decision will be synced back to the graph.</p>
        <div class="removed-decisions-list">
          ${deleted.map((d) => `
            <div class="removed-decision-item" data-decision-id="${d.id}">
              <div class="removed-decision-content">${escapeHtml(truncate(d.content ?? '', 100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.conflict-resolve-restore').forEach((restoreBtn) => {
      on(restoreBtn as HTMLElement, 'click', async () => {
        const id = (restoreBtn as HTMLElement).closest('.removed-decision-item')?.getAttribute('data-decision-id');
        if (!id) return;
        try {
          await decisionsService.restore(id);
          toast.success('Decision restored');
          loadDecisions(panel, props);
          refreshRemovedSection(panel, props);
        } catch {
          toast.error('Failed to restore decision');
        }
      });
    });
  } catch {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s;
  return s.substring(0, len) + '…';
}

/**
 * Filter decisions by search (client-side)
 */
function filterDecisionsBySearch(decisions: Decision[], q: string): Decision[] {
  if (!q) return decisions;
  const lower = q.toLowerCase();
  return decisions.filter(
    d =>
      (d.content || '').toLowerCase().includes(lower) ||
      (d.rationale || '').toLowerCase().includes(lower) ||
      (d.made_by || '').toLowerCase().includes(lower) ||
      (d.source_file || '').toLowerCase().includes(lower)
  );
}

/**
 * Load decisions
 */
async function loadDecisions(panel: HTMLElement, props: DecisionsPanelProps): Promise<void> {
  const content = panel.querySelector('#decisions-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const status = currentFilter === 'all' ? undefined : currentFilter;
    const raw = await decisionsService.getAll(status);
    const decisions = filterDecisionsBySearch(raw, currentSearch);

    if (currentView === 'source') {
      renderDecisionsBySource(content, decisions, props);
    } else {
      renderDecisions(content, decisions, props);
    }
    dataStore.setDecisions(raw as unknown as []);
    updateCount(panel, decisions.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load decisions</div>';
  }
}

/**
 * Render decisions list (grouped by status when multiple statuses)
 */
function renderDecisions(container: HTMLElement, decisions: Decision[], props: DecisionsPanelProps): void {
  if (decisions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${currentSearch ? 'No decisions match your search' : 'No decisions found'}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Decision</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showDecisionModal({ mode: 'create', onSave: () => loadDecisions(container.closest('.decisions-panel') as HTMLElement, props) });
      });
    }
    return;
  }

  const contacts: ContactLike[] = (dataStore.getState().contacts || []) as ContactLike[];
  const byStatus: Record<string, Decision[]> = {};
  decisions.forEach(d => {
    const s = (d.status || 'active').toLowerCase();
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(d);
  });
  const statuses = Object.keys(byStatus);

  if (statuses.length > 1) {
    container.innerHTML = statuses.map(status => `
      <div class="question-group">
        <div class="group-header">
          <h3>${escapeHtml(status)}</h3>
          <span class="group-count">${byStatus[status].length}</span>
        </div>
        <div class="group-items">
          ${byStatus[status].map(d => createDecisionCard(d, contacts)).join('')}
        </div>
      </div>
    `).join('');
  } else {
    container.innerHTML = decisions.map(d => createDecisionCard(d, contacts)).join('');
  }

  bindDecisionCards(container, decisions, props);
}

/**
 * Render decisions grouped by source
 */
function renderDecisionsBySource(container: HTMLElement, decisions: Decision[], props: DecisionsPanelProps): void {
  if (decisions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${currentSearch ? 'No decisions match your search' : 'No decisions found'}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Decision</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showDecisionModal({ mode: 'create', onSave: () => loadDecisions(container.closest('.decisions-panel') as HTMLElement, props) });
      });
    }
    return;
  }
  const contacts: ContactLike[] = (dataStore.getState().contacts || []) as ContactLike[];
  const bySource: Record<string, Decision[]> = {};
  decisions.forEach(d => {
    const src = d.source_file || d.source || 'Unknown source';
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(d);
  });
  container.innerHTML = Object.entries(bySource).map(([source, list]) => `
    <div class="question-group">
      <div class="group-header">
        <h3>${escapeHtml(source)}</h3>
        <span class="group-count">${list.length}</span>
      </div>
      <div class="group-items">
        ${list.map(d => createDecisionCard(d, contacts)).join('')}
      </div>
    </div>
  `).join('');

  bindDecisionCards(container, decisions, props);
}

function bindDecisionCards(container: HTMLElement, decisions: Decision[], props: DecisionsPanelProps): void {
  container.querySelectorAll('.decision-card-sota').forEach((card) => {
    on(card as HTMLElement, 'click', (e) => {
      if ((e.target as HTMLElement).closest('.card-actions')) return;
      const id = card.getAttribute('data-id');
      const decision = decisions.find((d) => String(d.id) === id);
      if (!decision) return;
      if (props.useDetailView && props.containerElement) {
        const containerEl = props.containerElement;
        containerEl.innerHTML = '';
        containerEl.appendChild(createDecisionDetailView(decisionDetailProps(containerEl, props, decision)));
      } else if (props.onDecisionClick) {
        props.onDecisionClick(decision);
      } else {
        showDecisionModal({
          mode: 'edit',
          decision: { ...decision, decision: decision.content, madeBy: decision.made_by, madeAt: decision.created_at },
          onSave: () => loadDecisions(container.closest('.decisions-panel') as HTMLElement, props),
        });
      }
    });

    const approveBtn = card.querySelector('.approve-btn');
    const rejectBtn = card.querySelector('.reject-btn');
    const id = card.getAttribute('data-id');

    if (approveBtn && id) {
      on(approveBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        try {
          await decisionsService.approve(id, 'Current User');
          loadDecisions(container.closest('.decisions-panel') as HTMLElement, props);
        } catch {
          // no-op
        }
      });
    }
    if (rejectBtn && id) {
      on(rejectBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        try {
          await decisionsService.reject(id);
          loadDecisions(container.closest('.decisions-panel') as HTMLElement, props);
        } catch {
          // no-op
        }
      });
    }
  });
}

/** Status bar color (left edge) - align with fact category bar */
const STATUS_BAR_COLOR: Record<string, string> = {
  proposed: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  deferred: '#6b7280',
  active: '#3b82f6',
  superseded: '#8b5cf6',
  revoked: '#6b7280',
};

type ContactLike = { name?: string; role?: string; photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string; aliases?: string[] };

function findContactByOwner(contacts: ContactLike[], name: string): ContactLike | undefined {
  if (!name || !contacts.length) return undefined;
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const byExact = contacts.find((c) => (c.name || '').trim().toLowerCase() === n);
  if (byExact) return byExact;
  const byPartial = contacts.find(
    (c) =>
      (c.name || '').trim().toLowerCase().includes(n) ||
      n.includes((c.name || '').trim().toLowerCase())
  );
  if (byPartial) return byPartial;
  const byAlias = contacts.find((c) =>
    (c.aliases || []).some((a) => String(a).trim().toLowerCase() === n)
  );
  return byAlias || contacts.find((c) =>
    (c.aliases || []).some((a) => {
      const aLower = String(a).trim().toLowerCase();
      return aLower.includes(n) || n.includes(aLower);
    })
  );
}

function getContactPhotoUrl(c: ContactLike | undefined): string | null {
  if (!c) return null;
  return c.photoUrl || c.avatarUrl || c.photo_url || c.avatar_url || null;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].substring(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function createDecisionCard(decision: Decision, contacts: ContactLike[]): string {
  const status = (decision.status || 'active').toLowerCase();
  const statusClass = status.replace(/\s+/g, '-');
  const barColor = STATUS_BAR_COLOR[status] ?? STATUS_BAR_COLOR.active;
  const content = decision.content || '';
  const source = decision.source_file || decision.source || '';
  const owner = decision.made_by || (decision as { owner?: string }).owner || '';
  const contact = owner ? findContactByOwner(contacts, owner) : undefined;
  const photoUrl = getContactPhotoUrl(contact);
  const ownerChipHtml = owner
    ? `
        <div class="assignee-chip">
          <div class="assignee-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(owner)}" onerror="this.parentElement.innerHTML='${getInitials(owner)}'">` : getInitials(owner)}</div>
          <div class="assignee-info">
            <span class="assignee-name">${escapeHtml(owner)}</span>
            ${contact?.role ? `<span class="assignee-role">${escapeHtml(contact.role)}</span>` : ''}
          </div>
        </div>
      `
    : '<span class="card-owner-placeholder text-muted">No owner</span>';
  const sourceChip = source ? `<span class="card-source-chip">${escapeHtml(source.substring(0, 40))}${source.length > 40 ? '…' : ''}</span>` : '<span class="card-source-chip text-muted">No source</span>';

  return `
    <div class="decision-card-sota question-card-sota" data-id="${decision.id}" style="--decision-status-bar: ${barColor}">
      <div class="card-priority-bar decision-status-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="priority-pill status-${statusClass}">${escapeHtml(String(decision.status))}</span>
            ${decision.impact ? `<span class="status-pill">${escapeHtml(decision.impact)} impact</span>` : ''}
          </div>
          <span class="card-timestamp">${formatRelativeTime(decision.decided_at || decision.created_at)}</span>
        </div>
        <div class="card-question-text">${escapeHtml(content)}</div>
        ${(decision as any).summary ? `<div class="card-summary text-muted">${escapeHtml((decision as any).summary)}</div>` : ''}
        ${decision.rationale ? `<div class="card-rationale text-muted">${escapeHtml((decision.rationale || '').substring(0, 100))}${(decision.rationale || '').length > 100 ? '…' : ''}</div>` : ''}
        <div class="card-bottom-row">
          <div class="card-requester">
            ${sourceChip}
            ${ownerChipHtml}
          </div>
          <div class="card-assignment">
            ${decision.status === 'proposed' || decision.status === 'active'
      ? `<span class="card-actions"><button type="button" class="btn btn-sm btn-success approve-btn">Approve</button><button type="button" class="btn btn-sm btn-danger reject-btn">Reject</button></span>`
      : '<button type="button" class="btn-link decision-view-link">View</button>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#decisions-count');
  if (countEl) countEl.textContent = String(count);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createDecisionsPanel;
