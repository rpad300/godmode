/**
 * Sync Status Component
 * Shows synchronization status and dead letters
 */

import { createElement, on } from '@lib/dom';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

export interface SyncStatusProps {
  showDetails?: boolean;
}

interface SyncState {
  connected: boolean;
  lastSync: string | null;
  pendingCount: number;
  errorCount: number;
}

interface DeadLetter {
  id: string;
  type: string;
  payload: unknown;
  error: string;
  failedAt: string;
  retryCount: number;
}

/**
 * Create sync status component
 */
export function createSyncStatus(props: SyncStatusProps = {}): HTMLElement {
  const container = createElement('div', { className: 'sync-status' });

  container.innerHTML = `
    <div class="sync-indicator" id="sync-indicator">
      <span class="sync-icon">⟳</span>
      <span class="sync-text">Checking...</span>
    </div>
    ${props.showDetails ? `
      <div class="sync-details hidden" id="sync-details">
        <div class="sync-info"></div>
        <div class="dead-letters"></div>
      </div>
    ` : ''}
  `;

  const indicator = container.querySelector('#sync-indicator') as HTMLElement;

  // Toggle details on click
  if (props.showDetails) {
    on(indicator, 'click', () => {
      const details = container.querySelector('#sync-details') as HTMLElement;
      const wasHidden = details.classList.contains('hidden');
      details.classList.toggle('hidden');
      if (wasHidden) {
        loadSyncDetails(container);
      }
    });
  }

  // Initial check
  checkSyncStatus(container);

  // Periodic refresh
  setInterval(() => checkSyncStatus(container), 30000);

  return container;
}

/**
 * Check sync status
 */
async function checkSyncStatus(container: HTMLElement): Promise<void> {
  try {
    const response = await http.get<SyncState>('/api/sync/status');
    updateIndicator(container, response.data);
  } catch {
    updateIndicator(container, {
      connected: false,
      lastSync: null,
      pendingCount: 0,
      errorCount: 0,
    });
  }
}

/**
 * Update indicator
 */
function updateIndicator(container: HTMLElement, state: SyncState): void {
  const icon = container.querySelector('.sync-icon') as HTMLElement;
  const text = container.querySelector('.sync-text') as HTMLElement;
  const indicator = container.querySelector('.sync-indicator') as HTMLElement;

  if (!state.connected) {
    icon.textContent = '⚠';
    text.textContent = 'Disconnected';
    indicator.classList.remove('synced', 'syncing');
    indicator.classList.add('error');
  } else if (state.pendingCount > 0) {
    icon.textContent = '⟳';
    text.textContent = `Syncing (${state.pendingCount})`;
    indicator.classList.remove('synced', 'error');
    indicator.classList.add('syncing');
  } else if (state.errorCount > 0) {
    icon.textContent = '!';
    text.textContent = `${state.errorCount} errors`;
    indicator.classList.remove('synced', 'syncing');
    indicator.classList.add('error');
  } else {
    icon.textContent = '✓';
    text.textContent = state.lastSync ? formatRelativeTime(state.lastSync) : 'Synced';
    indicator.classList.remove('syncing', 'error');
    indicator.classList.add('synced');
  }
}

/**
 * Load sync details
 */
async function loadSyncDetails(container: HTMLElement): Promise<void> {
  const infoContainer = container.querySelector('.sync-info') as HTMLElement;
  const deadLettersContainer = container.querySelector('.dead-letters') as HTMLElement;

  infoContainer.innerHTML = '<div class="loading">Loading...</div>';

  try {
    // Get sync status
    const statusResponse = await http.get<SyncState>('/api/sync/status');
    const state = statusResponse.data;

    infoContainer.innerHTML = `
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value ${state.connected ? 'success' : 'error'}">
            ${state.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Last Sync</span>
          <span class="info-value">${state.lastSync ? formatRelativeTime(state.lastSync) : 'Never'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Pending</span>
          <span class="info-value">${state.pendingCount}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Errors</span>
          <span class="info-value ${state.errorCount > 0 ? 'error' : ''}">${state.errorCount}</span>
        </div>
      </div>
    `;

    // Get dead letters
    const deadLettersResponse = await http.get<{ deadLetters: DeadLetter[] }>('/api/sync/dead-letters');
    const deadLetters = deadLettersResponse.data.deadLetters || [];

    if (deadLetters.length > 0) {
      deadLettersContainer.innerHTML = `
        <h4>Failed Operations</h4>
        <div class="dead-letters-list">
          ${deadLetters.map(dl => `
            <div class="dead-letter" data-id="${dl.id}">
              <div class="dl-header">
                <span class="dl-type">${dl.type}</span>
                <span class="dl-time">${formatRelativeTime(dl.failedAt)}</span>
              </div>
              <div class="dl-error">${escapeHtml(dl.error)}</div>
              <div class="dl-actions">
                <button class="btn btn-sm retry-btn" data-id="${dl.id}">Retry</button>
                <span class="dl-retries">${dl.retryCount} attempts</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Bind retry buttons
      deadLettersContainer.querySelectorAll('.retry-btn').forEach(btn => {
        on(btn as HTMLElement, 'click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;

          try {
            await http.post(`/api/sync/retry/${id}`);
            toast.success('Retry scheduled');
            loadSyncDetails(container);
          } catch {
            toast.error('Retry failed');
          }
        });
      });
    } else {
      deadLettersContainer.innerHTML = '';
    }
  } catch {
    infoContainer.innerHTML = '<div class="error">Failed to load details</div>';
  }
}

/**
 * Create mini sync indicator for header
 */
export function createSyncIndicator(): HTMLElement {
  const indicator = createElement('div', { className: 'sync-indicator-mini' });
  indicator.innerHTML = '<span class="sync-dot"></span>';

  // Initial check
  checkMiniStatus(indicator);

  // Periodic refresh
  setInterval(() => checkMiniStatus(indicator), 30000);

  return indicator;
}

/**
 * Check mini status
 */
async function checkMiniStatus(indicator: HTMLElement): Promise<void> {
  try {
    const response = await http.get<SyncState>('/api/sync/status');
    const dot = indicator.querySelector('.sync-dot') as HTMLElement;

    if (!response.data.connected) {
      dot.className = 'sync-dot error';
      indicator.title = 'Disconnected';
    } else if (response.data.errorCount > 0) {
      dot.className = 'sync-dot warning';
      indicator.title = `${response.data.errorCount} sync errors`;
    } else {
      dot.className = 'sync-dot success';
      indicator.title = 'Synced';
    }
  } catch {
    const dot = indicator.querySelector('.sync-dot') as HTMLElement;
    dot.className = 'sync-dot error';
    indicator.title = 'Connection error';
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

export default createSyncStatus;
