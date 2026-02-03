/**
 * Webhooks Panel Component
 * Manage webhooks with CRUD and test functionality
 */

import { createElement, on } from '../utils/dom';
import { http } from '../services/api';
import { toast } from '../services/toast';
import { formatRelativeTime } from '../utils/format';

export interface WebhooksPanelProps {
  projectId?: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  created_at: string;
  last_triggered?: string;
  last_status?: number;
}

const AVAILABLE_EVENTS = [
  'question.created',
  'question.updated',
  'question.answered',
  'risk.created',
  'risk.updated',
  'risk.mitigated',
  'action.created',
  'action.completed',
  'decision.created',
  'decision.approved',
  'decision.rejected',
  'document.uploaded',
  'document.processed',
  'chat.message',
];

/**
 * Create webhooks panel
 */
export function createWebhooksPanel(props: WebhooksPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'webhooks-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Webhooks</h2>
        <span class="panel-count" id="webhooks-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary btn-sm" id="create-webhook-btn">+ Add Webhook</button>
      </div>
    </div>
    <div class="panel-content" id="webhooks-content">
      <div class="loading">Loading webhooks...</div>
    </div>
  `;

  // Bind create button
  const createBtn = panel.querySelector('#create-webhook-btn');
  if (createBtn) {
    on(createBtn as HTMLElement, 'click', () => showWebhookModal(panel, props));
  }

  // Initial load
  loadWebhooks(panel, props);

  return panel;
}

/**
 * Load webhooks
 */
async function loadWebhooks(panel: HTMLElement, props: WebhooksPanelProps): Promise<void> {
  const content = panel.querySelector('#webhooks-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const response = await http.get<{ webhooks: Webhook[] }>('/api/webhooks');
    renderWebhooks(content, response.data.webhooks || [], panel, props);
    updateCount(panel, response.data.webhooks?.length || 0);
  } catch {
    content.innerHTML = '<div class="error">Failed to load webhooks</div>';
  }
}

/**
 * Render webhooks
 */
function renderWebhooks(
  container: HTMLElement, 
  webhooks: Webhook[],
  panel: HTMLElement,
  props: WebhooksPanelProps
): void {
  if (webhooks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No webhooks configured</p>
        <p class="hint">Webhooks allow you to receive real-time notifications when events occur</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="webhooks-list">
      ${webhooks.map(webhook => `
        <div class="webhook-card ${webhook.active ? '' : 'inactive'}" data-id="${webhook.id}">
          <div class="webhook-status">
            <span class="status-indicator ${webhook.active ? 'active' : 'inactive'}"></span>
          </div>
          <div class="webhook-info">
            <div class="webhook-name">${escapeHtml(webhook.name)}</div>
            <div class="webhook-url">${escapeHtml(webhook.url)}</div>
            <div class="webhook-events">
              ${webhook.events.slice(0, 3).map(e => `<span class="event-badge">${e}</span>`).join('')}
              ${webhook.events.length > 3 ? `<span class="more-events">+${webhook.events.length - 3}</span>` : ''}
            </div>
            <div class="webhook-meta">
              Created ${formatRelativeTime(webhook.created_at)}
              ${webhook.last_triggered 
                ? `• Last triggered ${formatRelativeTime(webhook.last_triggered)} (${webhook.last_status})` 
                : '• Never triggered'
              }
            </div>
          </div>
          <div class="webhook-actions">
            <button class="btn btn-sm test-webhook-btn" data-id="${webhook.id}">Test</button>
            <button class="btn btn-sm edit-webhook-btn" data-id="${webhook.id}">Edit</button>
            <button class="btn btn-sm btn-danger delete-webhook-btn" data-id="${webhook.id}">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind events
  container.querySelectorAll('.test-webhook-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;

      const button = btn as HTMLButtonElement;
      button.disabled = true;
      button.textContent = 'Testing...';

      try {
        await http.post(`/api/webhooks/${id}/test`);
        toast.success('Test webhook sent');
      } catch {
        toast.error('Failed to send test webhook');
      } finally {
        button.disabled = false;
        button.textContent = 'Test';
      }
    });
  });

  container.querySelectorAll('.edit-webhook-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const webhook = webhooks.find(w => w.id === id);
      if (webhook) {
        showWebhookModal(panel, props, webhook);
      }
    });
  });

  container.querySelectorAll('.delete-webhook-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id || !confirm('Delete this webhook?')) return;

      try {
        await http.delete(`/api/webhooks/${id}`);
        toast.success('Webhook deleted');
        loadWebhooks(panel, props);
      } catch {
        toast.error('Failed to delete webhook');
      }
    });
  });
}

/**
 * Show webhook modal (create/edit)
 */
function showWebhookModal(panel: HTMLElement, props: WebhooksPanelProps, webhook?: Webhook): void {
  const isEdit = !!webhook;
  const overlay = createElement('div', { className: 'modal-overlay' });
  
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Webhook' : 'Create Webhook'}</h2>
        <button class="btn-icon close-modal">×</button>
      </div>
      <form id="webhook-form" class="modal-body">
        <div class="form-group">
          <label for="webhook-name">Name *</label>
          <input type="text" id="webhook-name" required value="${escapeHtml(webhook?.name || '')}" placeholder="e.g., Slack Notifications">
        </div>
        <div class="form-group">
          <label for="webhook-url">URL *</label>
          <input type="url" id="webhook-url" required value="${escapeHtml(webhook?.url || '')}" placeholder="https://your-endpoint.com/webhook">
        </div>
        <div class="form-group">
          <label for="webhook-secret">Secret (Optional)</label>
          <input type="text" id="webhook-secret" value="${escapeHtml(webhook?.secret || '')}" placeholder="Used to sign payloads">
        </div>
        <div class="form-group">
          <label>Events *</label>
          <div class="events-grid">
            ${AVAILABLE_EVENTS.map(event => `
              <label class="checkbox-label">
                <input type="checkbox" name="events" value="${event}" ${webhook?.events.includes(event) ? 'checked' : ''}>
                ${event}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="webhook-active" ${webhook?.active !== false ? 'checked' : ''}>
            Active
          </label>
        </div>
      </form>
      <div class="modal-footer">
        <button class="btn btn-secondary close-modal">Cancel</button>
        <button class="btn btn-primary" id="submit-webhook-btn">${isEdit ? 'Save' : 'Create'}</button>
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

  const submitBtn = overlay.querySelector('#submit-webhook-btn');
  if (submitBtn) {
    on(submitBtn as HTMLElement, 'click', async () => {
      const form = overlay.querySelector('#webhook-form') as HTMLFormElement;
      const nameInput = form.querySelector('#webhook-name') as HTMLInputElement;
      const urlInput = form.querySelector('#webhook-url') as HTMLInputElement;
      const secretInput = form.querySelector('#webhook-secret') as HTMLInputElement;
      const activeCheckbox = form.querySelector('#webhook-active') as HTMLInputElement;
      const eventCheckboxes = form.querySelectorAll('input[name="events"]:checked');

      if (!nameInput.value.trim() || !urlInput.value.trim()) {
        toast.error('Name and URL are required');
        return;
      }

      const events = Array.from(eventCheckboxes).map(cb => (cb as HTMLInputElement).value);
      if (events.length === 0) {
        toast.error('Select at least one event');
        return;
      }

      const data = {
        name: nameInput.value.trim(),
        url: urlInput.value.trim(),
        secret: secretInput.value.trim() || undefined,
        events,
        active: activeCheckbox.checked,
      };

      const btn = submitBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = isEdit ? 'Saving...' : 'Creating...';

      try {
        if (isEdit) {
          await http.put(`/api/webhooks/${webhook!.id}`, data);
          toast.success('Webhook updated');
        } else {
          await http.post('/api/webhooks', data);
          toast.success('Webhook created');
        }
        overlay.remove();
        loadWebhooks(panel, props);
      } catch {
        toast.error(`Failed to ${isEdit ? 'update' : 'create'} webhook`);
        btn.disabled = false;
        btn.textContent = isEdit ? 'Save' : 'Create';
      }
    });
  }
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#webhooks-count');
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

export default createWebhooksPanel;
