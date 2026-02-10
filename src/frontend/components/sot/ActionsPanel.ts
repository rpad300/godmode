/**
 * Actions Panel Component
 * Displays and manages action items
 */

import { createElement, on } from '../../utils/dom';
import { actionsService, Action } from '../../services/actions';
import { getSprints, getSprint } from '../../services/sprints';
import type { Sprint } from '../../services/sprints';
import { dataStore } from '../../stores/data';
import { showActionModal } from '../modals/ActionModal';
import { showCreateSprintModal } from '../sprints/CreateSprintModal';
import { showSprintReportModal } from '../sprints/SprintReportModal';
import { createActionDetailView, ActionDetailViewProps } from '../actions/ActionDetailView';
import { formatRelativeTime, formatDate } from '../../utils/format';
import { toast } from '../../services/toast';

type ViewMode = 'list' | 'by_sprint' | 'by_story';

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
let currentSprintId: string = '';
let currentViewMode: ViewMode = 'by_sprint';

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
        <div class="view-mode-tabs" role="tablist">
          <button type="button" class="view-mode-tab" data-view="list" title="Flat list">List</button>
          <button type="button" class="view-mode-tab active" data-view="by_sprint" title="Group by sprint">Sprints</button>
          <button type="button" class="view-mode-tab" data-view="by_story" title="Group by user story">Stories</button>
        </div>
        <select id="actions-sprint-filter" class="filter-select" title="Sprint (List view)">
          <option value="">All sprints</option>
        </select>
        <select id="actions-filter" class="filter-select">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <button class="btn btn-outline-primary btn-sm" id="create-sprint-btn" title="Create sprint and generate tasks from emails/transcripts">Sprint</button>
        <button class="btn btn-primary btn-sm" id="add-action-btn">+ Add</button>
      </div>
    </div>
    <div id="actions-report-strip" class="actions-report-strip hidden"></div>
    <div id="actions-sprint-detail" class="actions-sprint-detail hidden"></div>
    <div class="panel-content" id="actions-content">
      <div class="loading">Loading actions...</div>
    </div>
    <div id="removed-actions-container" class="removed-actions-container hidden"></div>
  `;

  // Populate sprint filter and bind
  (async () => {
    const sprintSelect = panel.querySelector('#actions-sprint-filter') as HTMLSelectElement;
    if (!sprintSelect) return;
    try {
      const sprints = await getSprints();
      sprints.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (s.id === currentSprintId) opt.selected = true;
        sprintSelect.appendChild(opt);
      });
      on(sprintSelect, 'change', () => {
        currentSprintId = sprintSelect.value || '';
        loadActions(panel, props);
      });
    } catch {
      // ignore
    }
  })();

  panel.querySelectorAll('.view-mode-tab').forEach((tab) => {
    on(tab as HTMLElement, 'click', () => {
      const view = (tab as HTMLElement).getAttribute('data-view') as ViewMode;
      if (!view || view === currentViewMode) return;
      currentViewMode = view;
      panel.querySelectorAll('.view-mode-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      loadActions(panel, props);
    });
  });

  const filterSelect = panel.querySelector('#actions-filter') as HTMLSelectElement;
  on(filterSelect, 'change', () => {
    currentFilter = filterSelect.value;
    loadActions(panel, props);
  });

  const createSprintBtn = panel.querySelector('#create-sprint-btn');
  if (createSprintBtn) {
    on(createSprintBtn as HTMLElement, 'click', () => {
      showCreateSprintModal({
        onSuccess: () => loadActions(panel, props),
      });
    });
  }
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
  refreshRemovedActionsSection(panel, props);
  refreshReportStrip(panel);

  return panel;
}

/**
 * Load and render the Sprint detail header when a sprint is selected
 */
async function refreshSprintDetailHeader(panel: HTMLElement): Promise<void> {
  const container = panel.querySelector('#actions-sprint-detail') as HTMLElement;
  if (!container) return;
  if (!currentSprintId) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  try {
    const sprint = await getSprint(currentSprintId);
    if (!sprint) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('hidden');
    const start = sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : '—';
    const end = sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : '—';
    container.innerHTML = `
      <div class="sprint-detail-header">
        <div class="sprint-detail-title">${escapeHtml(sprint.name)}</div>
        <div class="sprint-detail-meta">${start} – ${end}</div>
        ${sprint.context ? `<div class="sprint-detail-context">${escapeHtml(sprint.context)}</div>` : ''}
        <button type="button" class="btn btn-outline-primary btn-sm sprint-report-btn" id="sprint-report-open-btn" data-sprint-id="${escapeHtml(sprint.id)}" data-sprint-name="${escapeHtml(sprint.name)}">Sprint report</button>
      </div>
    `;
    const reportBtn = container.querySelector('#sprint-report-open-btn');
    if (reportBtn) {
      on(reportBtn as HTMLElement, 'click', () => {
        const id = (reportBtn as HTMLElement).getAttribute('data-sprint-id');
        const name = (reportBtn as HTMLElement).getAttribute('data-sprint-name') || undefined;
        if (id) showSprintReportModal({ sprintId: id, sprintName: name || undefined, onClose: () => {} });
      });
    }
  } catch {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
}

/**
 * Load and render the actions report strip (by status)
 */
async function refreshReportStrip(panel: HTMLElement): Promise<void> {
  const strip = panel.querySelector('#actions-report-strip') as HTMLElement;
  if (!strip) return;
  try {
    const report = await actionsService.getReport();
    const byStatus = report.by_status || {};
    const bySprint = report.by_sprint || {};
    const parts: string[] = [];
    ['pending', 'in_progress', 'completed', 'cancelled'].forEach((s) => {
      const n = byStatus[s] ?? 0;
      if (n > 0) parts.push(`${s.replace('_', ' ')}: ${n}`);
    });
    const sprintParts = Object.entries(bySprint)
      .filter(([k]) => k !== '(no sprint)')
      .map(([, v]) => `${v.name}: ${v.count}`);
    if (sprintParts.length > 0) parts.push(`Sprints: ${sprintParts.join(' · ')}`);
    if (parts.length === 0) {
      strip.classList.add('hidden');
      strip.innerHTML = '';
      return;
    }
    strip.classList.remove('hidden');
    strip.innerHTML = `<span class="actions-report-label">By status:</span> ${parts.join(' · ')}`;
  } catch {
    strip.classList.add('hidden');
    strip.innerHTML = '';
  }
}

/**
 * Load and render the "Removed actions" section (for restore). Syncs with graph on restore.
 */
async function refreshRemovedActionsSection(panel: HTMLElement, props: ActionsPanelProps): Promise<void> {
  const container = panel.querySelector('#removed-actions-container') as HTMLElement;
  if (!container) return;
  try {
    const deleted = await actionsService.getDeletedActions();
    if (deleted.length === 0) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('hidden');
    const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max) + '…' : s);
    container.innerHTML = `
      <div class="removed-actions-section">
        <div class="removed-actions-header section-header-sota">
          <h3>Removed actions</h3>
          <span class="panel-count removed-count">${deleted.length}</span>
        </div>
        <p class="removed-actions-hint">Restore to undo; action will be synced back to the graph.</p>
        <div class="removed-actions-list">
          ${deleted.map((a) => `
            <div class="removed-action-item" data-action-id="${a.id}">
              <div class="removed-action-content">${escapeHtml(truncate((a.task || a.content || ''), 100))}</div>
              <button type="button" class="btn btn-sm conflict-resolve-restore">Restore</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.conflict-resolve-restore').forEach((btn) => {
      const item = (btn as HTMLElement).closest('.removed-action-item');
      const id = item?.getAttribute('data-action-id');
      if (id) {
        on(btn as HTMLElement, 'click', async () => {
          try {
            await actionsService.restoreAction(id);
            toast.success('Action restored');
            await loadActions(panel, props);
            refreshRemovedActionsSection(panel, props);
          } catch {
            toast.error('Failed to restore action');
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
 * Load actions (list or grouped by sprint / story)
 */
async function loadActions(panel: HTMLElement, props: ActionsPanelProps): Promise<void> {
  const content = panel.querySelector('#actions-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const status = currentFilter === 'all' || currentFilter === 'overdue' ? undefined : currentFilter;
    const sprintFilter = currentViewMode === 'list' ? (currentSprintId || undefined) : undefined;
    let actions = await actionsService.getAll(status, sprintFilter);

    if (currentFilter === 'overdue') {
      actions = actions.filter(a => actionsService.isOverdue(a));
    }

    dataStore.setActions(actions as unknown as []);

    if (currentViewMode === 'by_sprint') {
      await renderGroupedBySprint(content, actions, panel, props);
    } else if (currentViewMode === 'by_story') {
      await renderGroupedByStory(content, actions, panel, props);
    } else {
      renderActions(content, actions, props);
    }

    updateCount(panel, actions.length);
    refreshRemovedActionsSection(panel, props);
    refreshReportStrip(panel);
    refreshSprintDetailHeader(panel);
  } catch {
    content.innerHTML = '<div class="error">Failed to load actions</div>';
  }
}

/**
 * Group actions by sprint and render sections (Sprint A, Sprint B, Tasks without sprint)
 */
async function renderGroupedBySprint(
  content: HTMLElement,
  actions: Action[],
  panel: HTMLElement,
  props: ActionsPanelProps
): Promise<void> {
  const sprints = await getSprints();
  const bySprint = new Map<string, Action[]>();
  const noSprint: Action[] = [];

  for (const a of actions) {
    const sid = (a as { sprint_id?: string }).sprint_id;
    if (sid) {
      if (!bySprint.has(sid)) bySprint.set(sid, []);
      bySprint.get(sid)!.push(a);
    } else {
      noSprint.push(a);
    }
  }

  const sprintList = sprints.filter((s) => bySprint.has(s.id));
  content.innerHTML = '';

  for (const sprint of sprintList) {
    const groupActions = bySprint.get(sprint.id) || [];
    const section = createGroupSection(
      `${sprint.name} (${groupActions.length})`,
      groupActions,
      panel,
      props,
      () => {
        currentSprintId = sprint.id;
        refreshSprintDetailHeader(panel);
      }
    );
    content.appendChild(section);
  }

  const noSprintSection = createGroupSection('Tasks without sprint', noSprint, panel, props);
  content.appendChild(noSprintSection);
}

/**
 * Group actions by user story and render sections (Story 1, Story 2, Tasks without story)
 */
async function renderGroupedByStory(
  content: HTMLElement,
  actions: Action[],
  panel: HTMLElement,
  props: ActionsPanelProps
): Promise<void> {
  const stories = await actionsService.getUserStories();
  const byStory = new Map<string, Action[]>();
  const noStory: Action[] = [];

  for (const a of actions) {
    const storyId = (a as { parent_story_id?: string }).parent_story_id;
    if (storyId) {
      if (!byStory.has(storyId)) byStory.set(storyId, []);
      byStory.get(storyId)!.push(a);
    } else {
      noStory.push(a);
    }
  }

  content.innerHTML = '';

  for (const story of stories) {
    const groupActions = byStory.get(story.id) || [];
    if (groupActions.length === 0 && !byStory.has(story.id)) continue;
    const title = story.story_points != null ? `${story.title} (${story.story_points} pt)` : story.title;
    const section = createGroupSection(`${title} — ${groupActions.length} tasks`, groupActions, panel, props);
    content.appendChild(section);
  }

  const noStorySection = createGroupSection('Tasks without story', noStory, panel, props);
  content.appendChild(noStorySection);
}

function createGroupSection(
  title: string,
  groupActions: Action[],
  panel: HTMLElement,
  props: ActionsPanelProps,
  onHeaderClick?: () => void
): HTMLElement {
  const section = createElement('div', { className: 'actions-group' });
  const header = createElement('div', { className: 'actions-group-header' });
  header.innerHTML = `<h3 class="actions-group-title">${escapeHtml(title)}</h3><span class="actions-group-count">${groupActions.length}</span>`;
  if (onHeaderClick) header.style.cursor = 'pointer';
  if (onHeaderClick) on(header, 'click', onHeaderClick);
  section.appendChild(header);
  const listEl = createElement('div', { className: 'actions-group-list' });
  section.appendChild(listEl);
  if (groupActions.length === 0) {
    listEl.innerHTML = '<p class="actions-group-empty">No tasks</p>';
  } else {
    renderActionCards(listEl, groupActions, props);
  }
  return section;
}

type ContactLike = { id?: string; name?: string; role?: string; photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string; aliases?: string[] };

function findContactById(contacts: ContactLike[], id: string): ContactLike | undefined {
  if (!id || !contacts.length) return undefined;
  return contacts.find((c) => (c as { id?: string }).id && String((c as { id: string }).id) === String(id));
}

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
 * Render action cards into a container (used by list view and grouped sections)
 */
function renderActionCards(container: HTMLElement, actions: Action[], props: ActionsPanelProps): void {
  if (actions.length === 0) return;
  const panel = (container.closest && container.closest('.actions-panel')) as HTMLElement | null;
  const contacts: ContactLike[] = (dataStore.getState().contacts || []) as ContactLike[];
  const priorityBarColor: Record<string, string> = { high: '#ea580c', medium: '#ca8a04', low: '#16a34a' };
  container.innerHTML = actions.map(action => buildActionCardHtml(action, contacts, priorityBarColor)).join('');
  bindActionCards(container, actions, props, panel || undefined);
}

function buildActionCardHtml(
  action: Action,
  contacts: ContactLike[],
  priorityBarColor: Record<string, string>
): string {
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
  const requestedBy = (action as { requested_by?: string }).requested_by ?? '';
  const requestedByContactId = (action as { requested_by_contact_id?: string }).requested_by_contact_id ?? '';
  const requesterContact = requestedByContactId
    ? findContactById(contacts, requestedByContactId)
    : requestedBy
      ? findContactByAssignee(contacts, requestedBy)
      : undefined;
  const requesterName = requesterContact?.name ?? requestedBy;
  const requesterPhotoUrl = getContactPhotoUrl(requesterContact);
  const requesterChipHtml =
    requesterName || requestedByContactId
      ? `
    <div class="requester-chip card-source-chip">
      <span class="requester-label">Requested by</span>
      <div class="assignee-chip requester-chip-inner">
        <div class="assignee-avatar">${requesterPhotoUrl ? `<img src="${escapeHtml(requesterPhotoUrl)}" alt="${escapeHtml(requesterName || '')}" onerror="this.parentElement.innerHTML='${getInitials(requesterName || '?')}'">` : getInitials(requesterName || '?')}</div>
        <span class="assignee-name">${escapeHtml(requesterName || 'Unknown')}</span>
      </div>
    </div>
  `
      : '';
  const dueChip = action.due_date ? `<span class="card-source-chip">Due: ${formatDate(action.due_date)}</span>` : '<span class="card-source-chip text-muted">No due date</span>';
  return `
    <div class="action-card-sota question-card-sota ${isOverdue ? 'overdue' : ''}" data-id="${action.id}" style="--action-priority-bar: ${barColor}">
      <div class="card-priority-bar action-priority-bar"></div>
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
            ${requesterChipHtml}
            ${dueChip}
          </div>
          <div class="card-assignment">
            <button type="button" class="btn-link action-view-link">View</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindActionCards(container: HTMLElement, actions: Action[], props: ActionsPanelProps, panel?: HTMLElement | null): void {
  const reload = () => (panel ? loadActions(panel, props) : undefined);
  container.querySelectorAll('.action-card-sota').forEach((card) => {
    on(card as HTMLElement, 'click', (e) => {
      if ((e.target as HTMLElement).closest('.card-assignment')) return;
      const id = card.getAttribute('data-id');
      const action = actions.find((a) => String(a.id) === id);
      if (!action) return;
      if (props.useDetailView && props.containerElement) {
        const containerEl = props.containerElement;
        containerEl.innerHTML = '';
        containerEl.appendChild(createActionDetailView(actionDetailProps(containerEl, props, action)));
      } else if (props.onActionClick) {
        props.onActionClick(action);
      } else {
        showActionModal({ mode: 'edit', action, onSave: reload });
      }
    });
    const viewLink = card.querySelector('.action-view-link');
    if (viewLink) {
      on(viewLink as HTMLElement, 'click', (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        const action = actions.find((a) => String(a.id) === id);
        if (!action) return;
        if (props.useDetailView && props.containerElement) {
          const containerEl = props.containerElement;
          containerEl.innerHTML = '';
          containerEl.appendChild(createActionDetailView(actionDetailProps(containerEl, props, action)));
        } else if (props.onActionClick) {
          props.onActionClick(action);
        } else {
          showActionModal({ mode: 'edit', action, onSave: reload });
        }
      });
    }
  });
}

/**
 * Render actions list (flat view)
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
  renderActionCards(container, actions, props);
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
