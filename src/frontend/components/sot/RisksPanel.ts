/**
 * Risks Panel Component
 * Displays and manages risks with view tabs, search, grouping, detail view, and removed section (SOTA parity)
 */

import { createElement, on } from '../../utils/dom';
import { risksService, Risk } from '../../services/risks';
import { dataStore } from '../../stores/data';
import { showRiskModal } from '../modals/RiskModal';
import { createRiskDetailView, RiskDetailViewProps } from '../risks/RiskDetailView';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

function riskDetailProps(containerEl: HTMLElement, props: RisksPanelProps, risk: Risk): RiskDetailViewProps {
  return {
    risk,
    onClose: () => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createRisksPanel(props));
    },
    onUpdate: (updatedRisk?: Risk) => {
      containerEl.innerHTML = '';
      if (updatedRisk) {
        containerEl.appendChild(createRiskDetailView(riskDetailProps(containerEl, props, updatedRisk)));
      } else {
        containerEl.appendChild(createRisksPanel(props));
      }
    },
  };
}

export interface RisksPanelProps {
  onRiskClick?: (risk: Risk) => void;
  useDetailView?: boolean;
  containerElement?: HTMLElement;
}

let currentFilter: string = 'all';
let currentSearch: string = '';
let currentView: 'status' | 'source' = 'status';
let showMatrix: boolean = false;
let lastLoadedRisks: Risk[] = [];

/**
 * Create risks panel
 */
export function createRisksPanel(props: RisksPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'sot-panel risks-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Risks</h2>
        <span class="panel-count" id="risks-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="risks-filter" class="filter-select">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="mitigating">Mitigating</option>
          <option value="mitigated">Mitigated</option>
          <option value="high">High Impact</option>
        </select>
        <div class="view-tabs">
          <button class="view-tab active" data-view="status">By Status</button>
          <button class="view-tab" data-view="source">By Source</button>
        </div>
        <input type="search" id="risks-search" class="search-input" placeholder="Search risks..." title="Search">
        <button class="btn btn-secondary btn-sm" id="toggle-matrix-btn">Show Matrix</button>
        <button class="btn btn-primary btn-sm" id="add-risk-btn">+ Add</button>
      </div>
    </div>
    <div id="risk-matrix-container" class="risk-matrix-container" style="display: none;"></div>
    <div class="panel-content" id="risks-content">
      <div class="loading">Loading risks...</div>
    </div>
    <div id="removed-risks-container" class="removed-risks-container" style="display: none;"></div>
  `;

  const filterSelect = panel.querySelector('#risks-filter') as HTMLSelectElement;
  on(filterSelect, 'change', () => {
    currentFilter = filterSelect.value;
    loadRisks(panel, props);
  });

  const viewTabs = panel.querySelectorAll('.view-tab');
  viewTabs.forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.getAttribute('data-view') as 'status' | 'source';
      loadRisks(panel, props);
    });
  });

  const searchInput = panel.querySelector('#risks-search') as HTMLInputElement;
  let searchTimeout: number;
  on(searchInput, 'input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      currentSearch = searchInput.value.trim();
      loadRisks(panel, props);
    }, 300);
  });

  const matrixBtn = panel.querySelector('#toggle-matrix-btn') as HTMLButtonElement;
  on(matrixBtn, 'click', () => {
    showMatrix = !showMatrix;
    matrixBtn.textContent = showMatrix ? 'Hide Matrix' : 'Show Matrix';
    const matrixContainer = panel.querySelector('#risk-matrix-container') as HTMLElement;
    matrixContainer.style.display = showMatrix ? 'block' : 'none';
    if (showMatrix) {
      const risksToShow = lastLoadedRisks.length > 0 ? lastLoadedRisks : (dataStore.getState().risks as unknown as Risk[]) || [];
      renderRiskMatrix(matrixContainer, Array.isArray(risksToShow) ? risksToShow : []);
    }
  });

  const addBtn = panel.querySelector('#add-risk-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showRiskModal({
        mode: 'create',
        onSave: () => {
          loadRisks(panel, props);
          refreshRemovedSection(panel, props);
        },
      });
    });
  }

  loadRisks(panel, props);
  refreshRemovedSection(panel, props);

  return panel;
}

async function refreshRemovedSection(panel: HTMLElement, props: RisksPanelProps): Promise<void> {
  const container = panel.querySelector('#removed-risks-container') as HTMLElement;
  if (!container) return;
  try {
    const deleted = await risksService.getDeleted();
    if (deleted.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    container.style.display = 'block';
    container.innerHTML = `
      <div class="removed-risks-section">
        <div class="removed-risks-header section-header-sota">
          <h3>Removed risks</h3>
          <span class="panel-count removed-count">${deleted.length}</span>
        </div>
        <p class="removed-risks-hint">Restore to bring the risk back; it will be synced to the graph.</p>
        <div class="removed-risks-list">
          ${deleted.map((r) => `
            <div class="removed-risk-item" data-risk-id="${r.id}">
              <div class="removed-risk-content">${escapeHtml(truncate(r.content ?? '', 100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.conflict-resolve-restore').forEach((restoreBtn) => {
      on(restoreBtn as HTMLElement, 'click', async () => {
        const id = (restoreBtn as HTMLElement).closest('.removed-risk-item')?.getAttribute('data-risk-id');
        if (!id) return;
        try {
          await risksService.restore(id);
          toast.success('Risk restored');
          loadRisks(panel, props);
          refreshRemovedSection(panel, props);
        } catch {
          toast.error('Failed to restore risk');
        }
      });
    });
  } catch {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s;
  return s.substring(0, len) + '…';
}

function filterRisksBySearch(risks: Risk[], q: string): Risk[] {
  if (!q) return risks;
  const lower = q.toLowerCase();
  return risks.filter(
    r =>
      (r.content || '').toLowerCase().includes(lower) ||
      (r.mitigation || '').toLowerCase().includes(lower) ||
      (r.owner || '').toLowerCase().includes(lower) ||
      (r.source_file || '').toLowerCase().includes(lower)
  );
}

async function loadRisks(panel: HTMLElement, props: RisksPanelProps): Promise<void> {
  const content = panel.querySelector('#risks-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const status = currentFilter === 'all' || currentFilter === 'high' ? undefined : currentFilter;
    let risks = await risksService.getAll(status);
    if (currentFilter === 'high') {
      risks = risks.filter(r => r.impact === 'high' || r.impact === 'critical');
    }
    risks = filterRisksBySearch(risks, currentSearch);

    if (currentView === 'source') {
      renderRisksBySource(content, risks, props);
    } else {
      renderRisks(content, risks, props);
    }
    lastLoadedRisks = risks;
    dataStore.setRisks(risks as unknown as []);
    updateCount(panel, risks.length);

    if (showMatrix) {
      const matrixContainer = panel.querySelector('#risk-matrix-container') as HTMLElement;
      renderRiskMatrix(matrixContainer, risks);
    }
  } catch {
    content.innerHTML = '<div class="error">Failed to load risks</div>';
  }
}

function renderRisks(container: HTMLElement, risks: Risk[], props: RisksPanelProps): void {
  if (risks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${currentSearch ? 'No risks match your search' : 'No risks found'}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Risk</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showRiskModal({ mode: 'create', onSave: () => loadRisks(container.closest('.risks-panel') as HTMLElement, props) });
      });
    }
    return;
  }

  const contacts: ContactLike[] = (dataStore.getState().contacts || []) as ContactLike[];
  const byStatus: Record<string, Risk[]> = {};
  risks.forEach(r => {
    const s = (r.status || 'open').toLowerCase();
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(r);
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
          ${byStatus[status].map(r => createRiskCard(r, contacts)).join('')}
        </div>
      </div>
    `).join('');
  } else {
    container.innerHTML = risks.map(r => createRiskCard(r, contacts)).join('');
  }
  bindRiskCards(container, risks, props);
}

function renderRisksBySource(container: HTMLElement, risks: Risk[], props: RisksPanelProps): void {
  if (risks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${currentSearch ? 'No risks match your search' : 'No risks found'}</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Risk</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showRiskModal({ mode: 'create', onSave: () => loadRisks(container.closest('.risks-panel') as HTMLElement, props) });
      });
    }
    return;
  }
  const contacts: ContactLike[] = (dataStore.getState().contacts || []) as ContactLike[];
  const bySource: Record<string, Risk[]> = {};
  risks.forEach(r => {
    const src = r.source_file || 'Unknown source';
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(r);
  });
  container.innerHTML = Object.entries(bySource).map(([source, list]) => `
    <div class="question-group">
      <div class="group-header">
        <h3>${escapeHtml(source)}</h3>
        <span class="group-count">${list.length}</span>
      </div>
      <div class="group-items">
        ${list.map(r => createRiskCard(r, contacts)).join('')}
      </div>
    </div>
  `).join('');
  bindRiskCards(container, risks, props);
}

const IMPACT_BAR_COLOR: Record<string, string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'color-mix(in srgb, var(--color-warning) 80%, transparent)',
  low: 'var(--color-success)',
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

function createRiskCard(risk: Risk, contacts: ContactLike[]): string {
  const impact = (risk.impact || 'medium').toLowerCase();
  const barColor = IMPACT_BAR_COLOR[impact] ?? IMPACT_BAR_COLOR.medium;
  const content = risk.content || '';
  const source = risk.source_file || '';
  const owner = risk.owner || '';
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
  const sourceChip = source ? `<span class="card-source-chip">${escapeHtml(truncate(source, 40))}</span>` : '<span class="card-source-chip text-muted">No source</span>';

  return `
    <div class="risk-card-sota question-card-sota" data-id="${risk.id}" data-bar-color="${barColor}">
      <div class="card-priority-bar risk-impact-bar"></div>
      <div class="card-body">
        <div class="card-top-row">
          <div class="card-badges">
            <span class="priority-pill impact-${impact}">${escapeHtml(risk.impact || 'medium')}</span>
            <span class="status-pill">L: ${escapeHtml(risk.likelihood || 'medium')}</span>
            <span class="status-pill status-${(risk.status || 'open').toLowerCase()}">${escapeHtml(risk.status || 'open')}</span>
          </div>
          <span class="card-timestamp">${formatRelativeTime(risk.created_at)}</span>
        </div>
        <div class="card-question-text">${escapeHtml(content)}</div>
        ${risk.mitigation ? `<div class="card-mitigation text-muted">${escapeHtml(truncate(risk.mitigation, 120))}</div>` : ''}
        <div class="card-bottom-row">
          <div class="card-requester">
            ${sourceChip}
            ${ownerChipHtml}
          </div>
          <div class="card-assignment">
            <button type="button" class="btn-link risk-view-link">View</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindRiskCards(container: HTMLElement, risks: Risk[], props: RisksPanelProps): void {
  // Apply dynamic impact bar colors without embedding inline styles
  container.querySelectorAll<HTMLElement>('.risk-card-sota[data-bar-color]').forEach(card => {
    const c = card.dataset.barColor || '';
    if (!c) return;
    card.style.setProperty('--risk-impact-bar', c);
    const bar = card.querySelector<HTMLElement>('.risk-impact-bar');
    if (bar) bar.style.background = c;
  });

  container.querySelectorAll('.risk-card-sota').forEach((card) => {
    on(card as HTMLElement, 'click', (e) => {
      if ((e.target as HTMLElement).closest('.card-actions')) return;
      const id = card.getAttribute('data-id');
      const risk = risks.find(r => String(r.id) === id);
      if (!risk) return;
      if (props.useDetailView && props.containerElement) {
        const containerEl = props.containerElement;
        containerEl.innerHTML = '';
        containerEl.appendChild(createRiskDetailView(riskDetailProps(containerEl, props, risk)));
      } else if (props.onRiskClick) {
        props.onRiskClick(risk);
      } else {
        showRiskModal({
          mode: 'edit',
          risk: { ...risk },
          onSave: () => loadRisks(container.closest('.risks-panel') as HTMLElement, props),
        });
      }
    });
  });
}

function renderRiskMatrix(container: HTMLElement, risks: Risk[]): void {
  const activeRisks = risks.filter(r => r.status !== 'mitigated' && r.status !== 'closed');
  const getSeverity = (impact?: string, likelihood?: string): string => {
    const impactLevel = ['low', 'medium', 'high', 'critical'].indexOf((impact || '').toString().toLowerCase() || 'low');
    const likelihoodLevel = ['low', 'medium', 'high'].indexOf((likelihood || '').toString().toLowerCase() || 'low');
    const score = impactLevel + likelihoodLevel;
    if (score >= 4) return 'critical';
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  };
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  activeRisks.forEach(risk => {
    const severity = getSeverity(risk.impact, risk.likelihood);
    counts[severity as keyof typeof counts]++;
  });
  const total = activeRisks.length;
  const mitigated = risks.length - activeRisks.length;
  const getPercent = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;
  let conicStops = '';
  let currentDeg = 0;
  const colors = {
    critical: 'var(--color-danger)',
    high: 'color-mix(in srgb, var(--color-warning) 85%, transparent)',
    medium: 'var(--color-warning)',
    low: 'var(--color-success)'
  };
  (['critical', 'high', 'medium', 'low'] as const).forEach(level => {
    const percent = getPercent(counts[level]);
    const degrees = (percent / 100) * 360;
    if (degrees > 0) {
      conicStops += `${colors[level]} ${currentDeg}deg ${currentDeg + degrees}deg, `;
      currentDeg += degrees;
    }
  });
  if (!conicStops) conicStops = 'var(--color-border) 0deg 360deg';
  else conicStops = conicStops.slice(0, -2);

  const conicStopsAttr = encodeURIComponent(conicStops);

  container.innerHTML = `
    <div class="risk-summary">
      <div class="risk-summary-header">
        <h4>Risk Overview</h4>
        <span class="risk-total">${total} active</span>
      </div>
      <div class="risk-summary-content">
        <div class="risk-donut-container">
          <div class="risk-donut" data-conic-stops="${conicStopsAttr}">
            <div class="risk-donut-center">
              <span class="donut-value">${total}</span>
              <span class="donut-label">Risks</span>
            </div>
          </div>
        </div>
        <div class="risk-bars">
          <div class="risk-bar-item critical">
            <span class="bar-icon">🔴</span>
            <span class="bar-label">Critical</span>
            <div class="bar-track"><div class="bar-fill" data-width="${getPercent(counts.critical)}"></div></div>
            <span class="bar-count">${counts.critical}</span>
          </div>
          <div class="risk-bar-item high">
            <span class="bar-icon">🟠</span>
            <span class="bar-label">High</span>
            <div class="bar-track"><div class="bar-fill" data-width="${getPercent(counts.high)}"></div></div>
            <span class="bar-count">${counts.high}</span>
          </div>
          <div class="risk-bar-item medium">
            <span class="bar-icon">🟡</span>
            <span class="bar-label">Medium</span>
            <div class="bar-track"><div class="bar-fill" data-width="${getPercent(counts.medium)}"></div></div>
            <span class="bar-count">${counts.medium}</span>
          </div>
          <div class="risk-bar-item low">
            <span class="bar-icon">🟢</span>
            <span class="bar-label">Low</span>
            <div class="bar-track"><div class="bar-fill" data-width="${getPercent(counts.low)}"></div></div>
            <span class="bar-count">${counts.low}</span>
          </div>
        </div>
      </div>
      ${mitigated > 0 ? `<div class="risk-mitigated"><span class="mitigated-icon">✓</span><span>${mitigated} risk${mitigated > 1 ? 's' : ''} mitigated</span></div>` : ''}
    </div>
  `;

  // Apply donut and bar widths without inline styles in HTML
  const donut = container.querySelector<HTMLElement>('.risk-donut[data-conic-stops]');
  const donutStops = donut?.dataset.conicStops ? decodeURIComponent(donut.dataset.conicStops) : '';
  if (donut && donutStops) donut.style.background = `conic-gradient(${donutStops})`;

  container.querySelectorAll<HTMLElement>('.risk-bars .bar-fill[data-width]').forEach(el => {
    const w = Number(el.dataset.width || 0);
    if (!Number.isFinite(w)) return;
    el.style.width = `${Math.max(0, Math.min(100, w))}%`;
  });
}

function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#risks-count');
  if (countEl) countEl.textContent = String(count);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createRisksPanel;
