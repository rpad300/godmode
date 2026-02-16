/**
 * History Modal Component
 * Display change history / audit log
 */

import { createElement, on } from '@lib/dom';
import { createModal, openModal, closeModal } from '@components/Modal';
import { http } from '@services/api';
import { formatRelativeTime } from '@lib/format';

const MODAL_ID = 'history-modal';

export interface HistoryEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
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

export interface HistoryModalProps {
  entityType?: string;
  entityId?: string;
  title?: string;
  onRestore?: (entry: HistoryEntry) => void;
}

let entries: HistoryEntry[] = [];
let page = 1;
let hasMore = true;
let loading = false;

/**
 * Show history modal
 */
export async function showHistoryModal(props: HistoryModalProps = {}): Promise<void> {
  const { entityType, entityId, title = 'History', onRestore } = props;

  entries = [];
  page = 1;
  hasMore = true;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'history-modal-content' });
  content.innerHTML = '<div class="loading">Loading history...</div>';

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const closeBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Close',
  });

  on(closeBtn, 'click', () => closeModal(MODAL_ID));
  footer.appendChild(closeBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title,
    content,
    size: 'lg',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Load initial data
  await loadHistory(content, entityType, entityId, onRestore);
}

/**
 * Load history entries
 */
async function loadHistory(
  container: HTMLElement,
  entityType?: string,
  entityId?: string,
  onRestore?: (entry: HistoryEntry) => void
): Promise<void> {
  if (loading || !hasMore) return;

  loading = true;

  try {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (entityType) params.set('entityType', entityType);
    if (entityId) params.set('entityId', entityId);

    const response = await http.get<{ entries: HistoryEntry[]; hasMore: boolean }>(
      `/api/history?${params}`
    );

    entries = [...entries, ...response.data.entries];
    hasMore = response.data.hasMore;
    page++;

    render(container, onRestore);
  } catch {
    container.innerHTML = '<div class="error">Failed to load history</div>';
  } finally {
    loading = false;
  }
}

/**
 * Render history
 */
function render(container: HTMLElement, onRestore?: (entry: HistoryEntry) => void): void {
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📜</span>
        <p>No history entries</p>
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
          <div class="history-date">${date}</div>
          ${items.map(entry => renderEntry(entry)).join('')}
        </div>
      `).join('')}
    </div>
    ${hasMore ? `
      <div class="history-load-more">
        <button class="btn btn-secondary" data-action="load-more">Load More</button>
      </div>
    ` : ''}
  `;

  // Bind load more
  const loadMoreBtn = container.querySelector('[data-action="load-more"]');
  if (loadMoreBtn) {
    on(loadMoreBtn as HTMLElement, 'click', async () => {
      await loadHistory(container, undefined, undefined, onRestore);
    });
  }

  // Bind restore buttons
  if (onRestore) {
    container.querySelectorAll('[data-action="restore"]').forEach(btn => {
      on(btn as HTMLElement, 'click', async () => {
        const entryId = btn.getAttribute('data-entry-id');
        const entry = entries.find(e => e.id === entryId);
        if (entry) {
          const { confirm } = await import('@components/Modal');
          const confirmed = await confirm(
            'Are you sure you want to restore this version?',
            { title: 'Restore', confirmText: 'Restore' }
          );
          if (confirmed) {
            onRestore(entry);
          }
        }
      });
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
}

/**
 * Render single entry
 */
function renderEntry(entry: HistoryEntry): string {
  const actionIcons: Record<string, string> = {
    create: '➕',
    update: '✏️',
    delete: '🗑️',
    restore: '↩️',
  };

  const actionColors: Record<string, string> = {
    create: 'success',
    update: 'info',
    delete: 'danger',
    restore: 'warning',
  };

  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

  return `
    <div class="history-entry ${actionColors[entry.action]}" data-entry-id="${entry.id}">
      <div class="history-icon">${actionIcons[entry.action]}</div>
      <div class="history-content">
        <div class="history-summary">
          <strong>${entry.actor.name}</strong>
          ${entry.action}d
          <span class="entity-type">${entry.entityType}</span>
          ${entry.entityName ? `"${escapeHtml(entry.entityName)}"` : ''}
        </div>
        <div class="history-time">${formatRelativeTime(entry.timestamp)}</div>
        
        ${hasChanges ? `
          <div class="history-changes">
            ${Object.entries(entry.changes!).map(([field, change]) => `
              <div class="change-item">
                <span class="change-field">${field}:</span>
                <span class="change-old">${formatValue(change.old)}</span>
                <span class="change-arrow">→</span>
                <span class="change-new">${formatValue(change.new)}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn-link" data-action="expand">Show details</button>
        ` : ''}
        
        ${entry.action === 'delete' ? `
          <button class="btn btn-sm btn-secondary" data-action="restore" data-entry-id="${entry.id}">
            Restore
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Group entries by date
 */
function groupByDate(items: HistoryEntry[]): Record<string, HistoryEntry[]> {
  const groups: Record<string, HistoryEntry[]> = {};

  items.forEach(item => {
    const date = new Date(item.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
  });

  return groups;
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showHistoryModal;
