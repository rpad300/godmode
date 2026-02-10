/**
 * History Panel Component
 * Display processing history timeline
 */

import { createElement, on } from '../utils/dom';
import { http, fetchWithProject } from '../services/api';
import { formatRelativeTime, formatDate } from '../utils/format';
import { toast } from '../services/toast';

export interface HistoryEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'process' | 'upload';
  entityType: string;
  entityId: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  actor: {
    id: string;
    name: string;
    email?: string;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryPanelProps {
  onRestore?: (entry: HistoryEntry) => void;
  onExport?: () => void;
}

let entries: HistoryEntry[] = [];
let page = 1;
let hasMore = true;
let loading = false;
let currentFilters = {
  action: '' as string,
  entityType: '' as string,
  dateFrom: '' as string,
  dateTo: '' as string,
};

/**
 * Create history panel
 */
export function createHistoryPanel(props: HistoryPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'history-panel' });

  panel.innerHTML = `
    <div class="history-filters">
      <select id="history-action-filter" class="filter-select">
        <option value="">All Actions</option>
        <option value="create">Created</option>
        <option value="update">Updated</option>
        <option value="delete">Deleted</option>
        <option value="restore">Restored</option>
        <option value="process">Processed</option>
        <option value="upload">Uploaded</option>
      </select>
      <select id="history-entity-filter" class="filter-select">
        <option value="">All Types</option>
        <option value="document">Documents</option>
        <option value="fact">Facts</option>
        <option value="question">Questions</option>
        <option value="risk">Risks</option>
        <option value="action">Actions</option>
        <option value="decision">Decisions</option>
        <option value="contact">Contacts</option>
        <option value="email">Emails</option>
      </select>
      <input type="date" id="history-date-from" class="filter-date" placeholder="From">
      <input type="date" id="history-date-to" class="filter-date" placeholder="To">
      <button class="btn btn-sm" id="history-clear-filters">Clear</button>
    </div>
    <div class="history-content" id="history-content">
      <div class="loading">Loading history...</div>
    </div>
  `;

  // Bind filter events
  bindFilters(panel, props);

  // Initial load
  loadHistory(panel, props);

  return panel;
}

/**
 * Bind filter event handlers
 */
function bindFilters(panel: HTMLElement, props: HistoryPanelProps): void {
  const actionFilter = panel.querySelector('#history-action-filter') as HTMLSelectElement;
  const entityFilter = panel.querySelector('#history-entity-filter') as HTMLSelectElement;
  const dateFromInput = panel.querySelector('#history-date-from') as HTMLInputElement;
  const dateToInput = panel.querySelector('#history-date-to') as HTMLInputElement;
  const clearBtn = panel.querySelector('#history-clear-filters') as HTMLButtonElement;

  const applyFilters = () => {
    currentFilters = {
      action: actionFilter.value,
      entityType: entityFilter.value,
      dateFrom: dateFromInput.value,
      dateTo: dateToInput.value,
    };
    entries = [];
    page = 1;
    hasMore = true;
    loadHistory(panel, props);
  };

  on(actionFilter, 'change', applyFilters);
  on(entityFilter, 'change', applyFilters);
  on(dateFromInput, 'change', applyFilters);
  on(dateToInput, 'change', applyFilters);

  on(clearBtn, 'click', () => {
    actionFilter.value = '';
    entityFilter.value = '';
    dateFromInput.value = '';
    dateToInput.value = '';
    applyFilters();
  });
}

/**
 * Load history entries
 */
async function loadHistory(panel: HTMLElement, props: HistoryPanelProps): Promise<void> {
  if (loading) return;

  const content = panel.querySelector('#history-content') as HTMLElement;
  
  if (page === 1) {
    content.innerHTML = '<div class="loading">Loading history...</div>';
  }

  loading = true;

  try {
    const params = new URLSearchParams({ page: String(page), limit: '30' });
    if (currentFilters.action) params.set('action', currentFilters.action);
    if (currentFilters.entityType) params.set('entityType', currentFilters.entityType);
    if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
    if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);

    const response = await http.get<{ entries: HistoryEntry[]; hasMore: boolean }>(
      `/api/history?${params}`
    );

    entries = page === 1 ? response.data.entries : [...entries, ...response.data.entries];
    hasMore = response.data.hasMore;
    page++;

    renderHistory(content, props);
  } catch {
    if (page === 1) {
      content.innerHTML = '<div class="error">Failed to load history</div>';
    }
  } finally {
    loading = false;
  }
}

/**
 * Render history timeline
 */
function renderHistory(container: HTMLElement, props: HistoryPanelProps): void {
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📜</span>
        <p>No history entries found</p>
        <span class="empty-hint">Processing and editing activity will appear here</span>
      </div>
    `;
    return;
  }

  // Group by date
  const grouped = groupByDate(entries);

  container.innerHTML = `
    <div class="history-timeline">
      ${Object.entries(grouped).map(([date, items]) => `
        <div class="history-date-group">
          <div class="history-date-header">${date}</div>
          <div class="history-items">
            ${items.map(entry => renderEntry(entry, props)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    ${hasMore ? `
      <div class="history-load-more">
        <button class="btn btn-secondary" id="load-more-history">Load More</button>
      </div>
    ` : `
      <div class="history-end">
        <span>End of history</span>
      </div>
    `}
  `;

  // Bind load more
  const loadMoreBtn = container.querySelector('#load-more-history');
  if (loadMoreBtn) {
    on(loadMoreBtn as HTMLElement, 'click', async () => {
      const panel = container.closest('.history-panel') as HTMLElement;
      await loadHistory(panel, props);
    });
  }

  // Bind expand buttons
  container.querySelectorAll('[data-action="expand"]').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const changesEl = btn.closest('.history-entry')?.querySelector('.history-changes');
      if (changesEl) {
        changesEl.classList.toggle('expanded');
        btn.textContent = changesEl.classList.contains('expanded') ? 'Hide details' : 'Show details';
      }
    });
  });

  // Bind restore buttons
  if (props.onRestore) {
    container.querySelectorAll('[data-action="restore"]').forEach(btn => {
      on(btn as HTMLElement, 'click', () => {
        const entryId = btn.getAttribute('data-entry-id');
        const entry = entries.find(e => e.id === entryId);
        if (entry && props.onRestore) {
          props.onRestore(entry);
        }
      });
    });
  }
}

/**
 * Render single entry
 */
function renderEntry(entry: HistoryEntry, props: HistoryPanelProps): string {
  const actionIcons: Record<string, string> = {
    create: '➕',
    update: '✏️',
    delete: '🗑️',
    restore: '↩️',
    process: '⚙️',
    upload: '📤',
  };

  const actionColors: Record<string, string> = {
    create: 'success',
    update: 'info',
    delete: 'danger',
    restore: 'warning',
    process: 'info',
    upload: 'success',
  };

  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

  return `
    <div class="history-entry ${actionColors[entry.action] || 'info'}" data-entry-id="${entry.id}">
      <div class="history-icon">${actionIcons[entry.action] || '📝'}</div>
      <div class="history-content">
        <div class="history-summary">
          <strong>${escapeHtml(entry.actor.name)}</strong>
          ${getActionVerb(entry.action)}
          <span class="entity-type">${entry.entityType}</span>
          ${entry.entityName ? `"${escapeHtml(entry.entityName)}"` : ''}
        </div>
        <div class="history-time">${formatRelativeTime(entry.timestamp)}</div>
        
        ${hasChanges ? `
          <div class="history-changes">
            ${Object.entries(entry.changes!).slice(0, 5).map(([field, change]) => `
              <div class="change-item">
                <span class="change-field">${formatFieldName(field)}:</span>
                <span class="change-old">${formatValue(change.old)}</span>
                <span class="change-arrow">→</span>
                <span class="change-new">${formatValue(change.new)}</span>
              </div>
            `).join('')}
            ${Object.keys(entry.changes!).length > 5 ? `<div class="change-more">+${Object.keys(entry.changes!).length - 5} more changes</div>` : ''}
          </div>
          <button class="btn-link" data-action="expand">Show details</button>
        ` : ''}
        
        ${entry.action === 'delete' && props.onRestore ? `
          <button class="btn btn-sm btn-secondary" data-action="restore" data-entry-id="${entry.id}">
            Restore
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Get action verb
 */
function getActionVerb(action: string): string {
  const verbs: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
    restore: 'restored',
    process: 'processed',
    upload: 'uploaded',
  };
  return verbs[action] || action;
}

/**
 * Group entries by date
 */
function groupByDate(items: HistoryEntry[]): Record<string, HistoryEntry[]> {
  const groups: Record<string, HistoryEntry[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  items.forEach(item => {
    const itemDate = new Date(item.timestamp);
    let dateLabel: string;
    
    if (itemDate.toDateString() === today) {
      dateLabel = 'Today';
    } else if (itemDate.toDateString() === yesterday) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = itemDate.toLocaleDateString(undefined, { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(item);
  });

  return groups;
}

/**
 * Format field name
 */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 50 ? str.substring(0, 47) + '...' : str;
  }
  const str = String(value);
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Export history
 */
export async function exportHistory(format: 'json' | 'csv' = 'json'): Promise<void> {
  try {
    const params = new URLSearchParams({ format, limit: '1000' });
    if (currentFilters.action) params.set('action', currentFilters.action);
    if (currentFilters.entityType) params.set('entityType', currentFilters.entityType);
    if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
    if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);

    const response = await fetchWithProject(`/api/history/export?${params}`);
    const blob = await response.blob();
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('History exported successfully');
  } catch {
    toast.error('Failed to export history');
  }
}

export default createHistoryPanel;
