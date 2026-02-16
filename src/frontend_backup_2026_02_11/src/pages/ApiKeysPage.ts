/**
 * API Keys Panel Component
 * Manage API keys with create, copy, revoke
 */

import { createElement, on } from '@lib/dom';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

export interface ApiKeysPanelProps {
  projectId?: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used?: string;
  expires_at?: string;
  scopes: string[];
}

/**
 * Create API keys panel
 */
export function createApiKeysPanel(props: ApiKeysPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'api-keys-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>API Keys</h2>
        <span class="panel-count" id="keys-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary btn-sm" id="create-key-btn">+ Create Key</button>
      </div>
    </div>
    <div class="panel-content" id="keys-content">
      <div class="loading">Loading API keys...</div>
    </div>
  `;

  // Bind create button
  const createBtn = panel.querySelector('#create-key-btn');
  if (createBtn) {
    on(createBtn as HTMLElement, 'click', () => showCreateKeyModal(panel, props));
  }

  // Initial load
  loadApiKeys(panel, props);

  return panel;
}

/**
 * Load API keys
 */
async function loadApiKeys(panel: HTMLElement, props: ApiKeysPanelProps): Promise<void> {
  const content = panel.querySelector('#keys-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const response = await http.get<{ keys: ApiKey[] }>('/api/keys');
    renderApiKeys(content, response.data.keys || [], panel, props);
    updateCount(panel, response.data.keys?.length || 0);
  } catch {
    content.innerHTML = '<div class="error">Failed to load API keys</div>';
  }
}

/**
 * Render API keys
 */
function renderApiKeys(
  container: HTMLElement,
  keys: ApiKey[],
  panel: HTMLElement,
  props: ApiKeysPanelProps
): void {
  if (keys.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No API keys created yet</p>
        <p class="hint">Create an API key to access the GodMode API programmatically</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="keys-list">
      ${keys.map(key => `
        <div class="key-card" data-id="${key.id}">
          <div class="key-info">
            <div class="key-name">${escapeHtml(key.name)}</div>
            <div class="key-preview">${key.key_prefix}••••••••</div>
            <div class="key-meta">
              Created ${formatRelativeTime(key.created_at)}
              ${key.last_used ? `• Last used ${formatRelativeTime(key.last_used)}` : '• Never used'}
              ${key.expires_at ? `• Expires ${formatRelativeTime(key.expires_at)}` : ''}
            </div>
            ${key.scopes.length > 0 ? `
              <div class="key-scopes">
                ${key.scopes.map(s => `<span class="scope-badge">${s}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="key-actions">
            <button class="btn btn-sm revoke-key-btn" data-id="${key.id}">Revoke</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind revoke buttons
  container.querySelectorAll('.revoke-key-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id || !confirm('Revoke this API key? This action cannot be undone.')) return;

      try {
        await http.delete(`/api/keys/${id}`);
        toast.success('API key revoked');
        loadApiKeys(panel, props);
      } catch {
        toast.error('Failed to revoke API key');
      }
    });
  });
}

/**
 * Show create key modal
 */
function showCreateKeyModal(panel: HTMLElement, props: ApiKeysPanelProps): void {
  const overlay = createElement('div', { className: 'modal-overlay' });

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Create API Key</h2>
        <button class="btn-icon close-modal">×</button>
      </div>
      <form id="create-key-form" class="modal-body">
        <div class="form-group">
          <label for="key-name">Key Name *</label>
          <input type="text" id="key-name" required placeholder="e.g., My Integration">
        </div>
        <div class="form-group">
          <label for="key-expiry">Expires</label>
          <select id="key-expiry">
            <option value="">Never</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
        </div>
        <div class="form-group">
          <label>Scopes</label>
          <div class="scopes-grid">
            <label class="checkbox-label">
              <input type="checkbox" name="scopes" value="read" checked> Read
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="scopes" value="write"> Write
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="scopes" value="chat"> Chat
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="scopes" value="admin"> Admin
            </label>
          </div>
        </div>
      </form>
      <div class="modal-footer">
        <button class="btn btn-secondary close-modal">Cancel</button>
        <button class="btn btn-primary" id="submit-key-btn">Create Key</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Bind events
  overlay.querySelectorAll('.close-modal').forEach(btn => {
    on(btn as HTMLElement, 'click', () => overlay.remove());
  });

  on(overlay, 'click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const submitBtn = overlay.querySelector('#submit-key-btn');
  if (submitBtn) {
    on(submitBtn as HTMLElement, 'click', async () => {
      const form = overlay.querySelector('#create-key-form') as HTMLFormElement;
      const nameInput = form.querySelector('#key-name') as HTMLInputElement;
      const expirySelect = form.querySelector('#key-expiry') as HTMLSelectElement;
      const scopeCheckboxes = form.querySelectorAll('input[name="scopes"]:checked');

      if (!nameInput.value.trim()) {
        toast.error('Key name is required');
        return;
      }

      const scopes = Array.from(scopeCheckboxes).map(cb => (cb as HTMLInputElement).value);

      const btn = submitBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Creating...';

      try {
        const response = await http.post<{ key: string; id: string }>('/api/keys', {
          name: nameInput.value.trim(),
          expires_in_days: expirySelect.value ? parseInt(expirySelect.value) : null,
          scopes,
        });

        // Show the generated key
        showNewKeyModal(response.data.key);
        overlay.remove();
        loadApiKeys(panel, props);
      } catch {
        toast.error('Failed to create API key');
        btn.disabled = false;
        btn.textContent = 'Create Key';
      }
    });
  }
}

/**
 * Show new key modal with copy button
 */
function showNewKeyModal(key: string): void {
  const overlay = createElement('div', { className: 'modal-overlay' });

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>API Key Created</h2>
      </div>
      <div class="modal-body">
        <p class="warning-text">⚠️ Copy this key now! You won't be able to see it again.</p>
        <div class="key-display">
          <code id="new-key-value">${escapeHtml(key)}</code>
          <button class="btn btn-sm" id="copy-key-btn">Copy</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary close-modal">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Copy button
  const copyBtn = overlay.querySelector('#copy-key-btn');
  if (copyBtn) {
    on(copyBtn as HTMLElement, 'click', async () => {
      try {
        await navigator.clipboard.writeText(key);
        toast.success('Key copied to clipboard');
        copyBtn.textContent = 'Copied!';
      } catch {
        toast.error('Failed to copy');
      }
    });
  }

  // Close button
  overlay.querySelectorAll('.close-modal').forEach(btn => {
    on(btn as HTMLElement, 'click', () => overlay.remove());
  });
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#keys-count');
  if (countEl) countEl.textContent = String(count);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createApiKeysPanel;
