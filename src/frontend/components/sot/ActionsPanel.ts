/**
 * Actions Panel Component
 * Displays and manages action items
 */

import { createElement, on } from '../../utils/dom';
import { actionsService, Action } from '../../services/actions';
import { dataStore } from '../../stores/data';
import { showActionModal } from '../modals/ActionModal';
import { createActionDetailView, ActionDetailViewProps } from '../actions/ActionDetailView';
import { formatRelativeTime, formatDate } from '../../utils/format';

function actionDetailProps(containerEl: HTMLElement, props: ActionsPanelProps, action: Action): ActionDetailViewProps {
  return {
    action,
    onClose: () => {
      containerEl.innerHTML = '';
      containerEl.appendChild(createActionsPanel(props));
    },
    onUpdate: (updatedAction?: Action) => {
      containerEl.innerHTML = '';
      if (updatedAction) {
        containerEl.appendChild(createActionDetailView(actionDetailProps(containerEl, props, updatedAction)));
      } else {
        containerEl.appendChild(createActionsPanel(props));
      }
    },
  };
}

export interface ActionsPanelProps {
  onActionClick?: (action: Action) => void;
  useDetailView?: boolean;
  containerElement?: HTMLElement;
}

let currentFilter: string = 'all';

/**
 * Create actions panel
 */
export function createActionsPanel(props: ActionsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'sot-panel actions-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Actions</h2>
        <span class="panel-count" id="actions-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="actions-filter" class="filter-select">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <button class="btn btn-primary btn-sm" id="add-action-btn">+ Add</button>
      </div>
    </div>
    <div class="panel-content" id="actions-content">
      <div class="loading">Loading actions...</div>
    </div>
  `;

  // Bind events
  const filterSelect = panel.querySelector('#actions-filter') as HTMLSelectElement;
  on(filterSelect, 'change', () => {
    currentFilter = filterSelect.value;
    loadActions(panel, props);
  });

  const addBtn = panel.querySelector('#add-action-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', () => {
      showActionModal({
        mode: 'create',
        onSave: () => loadActions(panel, props),
      });
    });
  }

  // Initial load
  loadActions(panel, props);

  return panel;
}

/**
 * Load actions
 */
async function loadActions(panel: HTMLElement, props: ActionsPanelProps): Promise<void> {
  const content = panel.querySelector('#actions-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const status = currentFilter === 'all' || currentFilter === 'overdue' ? undefined : currentFilter;
    let actions = await actionsService.getAll(status);

    // Filter overdue
    if (currentFilter === 'overdue') {
      actions = actions.filter(a => actionsService.isOverdue(a));
    }

    renderActions(content, actions, props);
    dataStore.setActions(actions as unknown as []);
    updateCount(panel, actions.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load actions</div>';
  }
}

type ContactLike = { name?: string; role?: string; photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string; aliases?: string[] };

function findContactByAssignee(contacts: ContactLike[], name: string): ContactLike | undefined {
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

/**
 * Render actions list
 */
function renderActions(container: HTMLElement, actions: Action[], props: ActionsPanelProps): void {
  if (actions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No actions found</p>
        <button class="btn btn-primary" id="empty-add-btn">Add Action</button>
      </div>
    `;
    const addBtn = container.querySelector('#empty-add-btn');
    if (addBtn) {
      on(addBtn as HTMLElement, 'click', () => {
        showActionModal({ mode: 'create' });
      });
    }
    return;
  }

  const contacts: ContactLike[] = (dataStore.getState().contacts || []) as ContactLike[];
  const priorityBarColor: Record<string, string> = { high: '#ea580c', medium: '#ca8a04', low: '#16a34a' };

  container.innerHTML = actions.map(action => {
    const isOverdue = actionsService.isOverdue(action);
    const priority = (action.priority || 'medium').toLowerCase();
    const barColor = priorityBarColor[priority] ?? priorityBarColor.medium;
    const content = (action.content ?? (action as { task?: string }).task ?? '').trim();
    const assignee = action.assignee ?? (action as { owner?: string }).owner ?? '';
    const contact = assignee ? findContactByAssignee(contacts, assignee) : undefined;
    const photoUrl = getContactPhotoUrl(contact);
    const assigneeChipHtml = assignee
      ? `
        <div class="assignee-chip">
          <div class="assignee-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(assignee)}" onerror="this.parentElement.innerHTML='${getInitials(assignee)}'">` : getInitials(assignee)}</div>
          <div class="assignee-info">
            <span class="assignee-name">${escapeHtml(assignee)}</span>
            ${contact?.role ? `<span class="assignee-role">${escapeHtml(contact.role)}</span>` : ''}
          </div>
        </div>
      `
      : '';
    const dueChip = action.due_date ? `<span class="card-source-chip">Due: ${formatDate(action.due_date)}</span>` : '<span class="card-source-chip text-muted">No due date</span>';
    return `
      <div class="action-card-sota question-card-sota ${isOverdue ? 'overdue' : ''}" data-id="${action.id}" style="--action-priority-bar: ${barColor}">
        <div class="card-priority-bar action-priority-bar" style="background: ${barColor}"></div>
        <div class="card-body">
          <div class="card-top-row">
            <div class="card-badges">
              <span class="status-pill status-${(action.status || 'pending').toLowerCase()}">${escapeHtml(String(action.status).replace('_', ' '))}</span>
              ${action.priority ? `<span class="priority-pill priority-${action.priority}">${escapeHtml(action.priority)}</span>` : ''}
              ${isOverdue ? '<span class="status-pill overdue">OVERDUE</span>' : ''}
            </div>
            <span class="card-timestamp">${formatRelativeTime(action.created_at)}</span>
          </div>
          <div class="card-question-text">${escapeHtml(content)}</div>
          <div class="card-bottom-row">
            <div class="card-requester">
              ${assigneeChipHtml}
              ${dueChip}
            </div>
            <div class="card-assignment">
              <button type="button" class="btn-link action-view-link">View</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind click events
  container.querySelectorAll('.action-card-sota').forEach(card => {
    on(card as HTMLElement, 'click', (e) => {
      if ((e.target as HTMLElement).closest('.card-assignment')) return;
      const id = card.getAttribute('data-id');
      const action = actions.find(a => String(a.id) === id);
      if (!action) return;
      if (props.useDetailView && props.containerElement) {
        const containerEl = props.containerElement;
        containerEl.innerHTML = '';
        containerEl.appendChild(createActionDetailView(actionDetailProps(containerEl, props, action)));
      } else if (props.onActionClick) {
        props.onActionClick(action);
      } else {
        showActionModal({
          mode: 'edit',
          action,
          onSave: () => loadActions(container.closest('.actions-panel') as HTMLElement, props),
        });
      }
    });
    const viewLink = card.querySelector('.action-view-link');
    if (viewLink) {
      on(viewLink as HTMLElement, 'click', (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        const action = actions.find(a => String(a.id) === id);
        if (!action) return;
        if (props.useDetailView && props.containerElement) {
          const containerEl = props.containerElement;
          containerEl.innerHTML = '';
          containerEl.appendChild(createActionDetailView(actionDetailProps(containerEl, props, action)));
        } else if (props.onActionClick) {
          props.onActionClick(action);
        } else {
          showActionModal({
            mode: 'edit',
            action,
            onSave: () => loadActions(container.closest('.actions-panel') as HTMLElement, props),
          });
        }
      });
    }
  });
}

/**
 * Update count badge
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#actions-count');
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

export default createActionsPanel;
