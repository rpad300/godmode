/**
 * Action Detail View
 * Full-page view for action details: task, status, priority, assignee, due date, source, timeline
 */

import { createElement, on } from '../../utils/dom';
import { Action, ActionEvent, ActionAssigneeSuggestion, actionsService } from '../../services/actions';
import { contactsService, Contact } from '../../services/contacts';
import { toast } from '../../services/toast';
import { formatRelativeTime, formatDateTime } from '../../utils/format';

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join('').toUpperCase().substring(0, 2);
}

export interface ActionDetailViewProps {
  action: Action;
  onClose: () => void;
  onUpdate?: (action: Action) => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}

function taskText(a: Action): string {
  return (a.content ?? a.task ?? '') as string;
}

function getActionEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    created: '📝',
    updated: '✏️',
    deleted: '🗑️',
    restored: '↩️',
  };
  return icons[eventType] || '•';
}

function getActionEventDescription(ev: ActionEvent): string {
  const data = ev.event_data || {};
  const actor = ev.actor_name ? ` by ${ev.actor_name}` : '';

  switch (ev.event_type) {
    case 'created':
      return `Created${actor}`;
    case 'updated': {
      const changes = (data.changes as Array<{ field: string; from: string; to: string }>) || [];
      if (changes.length === 0) return `Updated${actor}`;
      if (changes.length === 1) {
        const c = changes[0];
        const toStr = String(c.to).trim() ? c.to : '—';
        const fromStr = String(c.from).trim() ? c.from : '—';
        return `${c.field} changed: ${fromStr} → ${toStr}${actor}`;
      }
      return `${changes.map((c) => `${c.field}: ${c.from || '—'} → ${c.to || '—'}`).join('; ')}${actor}`;
    }
    case 'deleted':
      return `Deleted${data.reason ? ` (${data.reason})` : ''}${actor}`;
    case 'restored':
      return `Restored${actor}`;
    default:
      return ev.event_type;
  }
}

export function createActionDetailView(props: ActionDetailViewProps): HTMLElement {
  const { action, onClose, onUpdate } = props;

  const container = createElement('div', { className: 'action-detail-view question-detail-view' });

  const task = taskText(action);
  const due = action.due_date ?? (action as { deadline?: string }).deadline ?? '';
  const assignee = action.assignee ?? action.owner ?? '';

  container.innerHTML = `
    <div class="question-detail-header action-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Actions</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">Action #${String(action.id).substring(0, 8)}</span>
      </div>
      <div class="header-actions">
        <span class="status-badge status-${(action.status || 'pending').toLowerCase()}">${escapeHtml(String(action.status).replace('_', ' '))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content action-detail-content">
      <div id="action-view-content">
        <section class="detail-section action-main">
          <div class="question-badges action-badges">
            ${action.priority ? `<span class="priority-pill priority-${action.priority}">${escapeHtml(action.priority)}</span>` : ''}
            <span class="question-date action-date">Created ${formatRelativeTime(action.created_at)}</span>
          </div>
          <h2 class="question-text action-task-text">${escapeHtml(task)}</h2>
        </section>

        <div class="detail-columns">
          <div class="detail-column-left">
            <!-- Assignment Section - SOTA (aligned with Questions) -->
            <section class="detail-section" id="action-assignment-section">
              <div class="section-header-sota">
                <h3>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Assignment
                  <span class="section-subtitle">Who should do this?</span>
                </h3>
                <button type="button" class="btn-ai-suggest" id="action-ai-suggest-btn" title="Suggest assignee from task content">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  AI Suggest
                </button>
              </div>

              <!-- Current Assignment Display -->
              <div id="action-current-assignment" class="current-assignment-card">
                ${assignee ? `
                  <div class="assigned-contact-display">
                    <div class="contact-avatar-lg" id="action-assigned-avatar">${getInitials(assignee)}</div>
                    <div class="contact-details">
                      <div class="contact-name-lg">${escapeHtml(assignee)}</div>
                      <div class="contact-role-sm" id="action-assigned-role">—</div>
                    </div>
                    <button class="btn-change-assignment" id="action-change-assignee-btn" type="button">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      Change
                    </button>
                  </div>
                ` : `
                  <div class="no-assignment">
                    <div class="no-assignment-icon">
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                    </div>
                    <span>No one assigned</span>
                    <p class="no-assignment-hint">Use AI Suggest or choose manually</p>
                    <button class="btn-assign-now" id="action-show-picker-btn" type="button">Choose Manually</button>
                  </div>
                `}
              </div>

              <!-- Contact Picker (hidden by default) -->
              <div id="action-contact-picker" class="contact-picker-sota" style="display: none;">
                <div class="picker-search">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input type="text" id="action-contact-search" placeholder="Search contacts..." autocomplete="off">
                </div>
                <div id="action-contact-list" class="contact-list-grid">Loading...</div>
              </div>

              <!-- AI Suggestions Panel -->
              <div id="action-suggestions-panel" class="suggestions-panel-sota action-suggestions-panel" style="display: none; margin-bottom: 12px;"></div>

              <!-- Due date & Status (details) -->
              <dl class="metadata-list action-meta-inline">
                <dt>Due date</dt>
                <dd>${due ? formatDate(due) : '—'}</dd>
                <dt>Status</dt>
                <dd>${escapeHtml(String(action.status).replace('_', ' '))}</dd>
              </dl>
            </section>

            <section class="detail-section">
              <div class="section-header"><h3>Source</h3></div>
              ${action.source_file ? `<p class="source-file">${escapeHtml(action.source_file)}</p>` : ''}
              ${action.source_document_id ? `
                <p class="source-doc">
                  <a href="#" class="doc-link" data-document-id="${escapeHtml(String(action.source_document_id))}">View source document</a>
                </p>
              ` : ''}
              ${!action.source_file && !action.source_document_id ? '<p class="text-muted">No source recorded</p>' : ''}
            </section>
          </div>

          <div class="detail-column-right">
            <section class="detail-section metadata-section">
              <h3>Metadata</h3>
              <dl class="metadata-list">
                <dt>Created</dt>
                <dd>${formatDate(action.created_at)}</dd>
                ${action.updated_at ? `<dt>Updated</dt><dd>${formatDate(action.updated_at)}</dd>` : ''}
              </dl>
            </section>

            <section class="detail-section" id="action-timeline-section">
              <h3>Timeline</h3>
              <div id="timeline-content" class="timeline-content">
                <span class="text-muted">Loading…</span>
              </div>
            </section>
          </div>
        </div>

        <div class="detail-actions">
          <button type="button" class="btn btn-secondary" id="edit-action-btn">Edit</button>
          <button type="button" class="btn btn-danger" id="delete-action-btn">Delete</button>
        </div>
      </div>

      <div id="action-edit-form" class="action-detail-edit-form" style="display: none;">
        <form id="action-inline-form" class="action-form">
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
              <label for="action-edit-task" style="margin-bottom: 0;">Task *</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="action-edit-ai-suggest-btn" title="Suggest assignee from task content">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="action-edit-task" rows="3" required placeholder="What needs to be done?">${escapeHtml(task)}</textarea>
          </div>
          <div id="action-edit-suggestions-panel" class="suggestions-panel-sota action-suggestions-panel" style="display: none; margin-bottom: 16px;"></div>
          <div class="form-row">
            <div class="form-group">
              <label for="action-edit-status">Status</label>
              <select id="action-edit-status">
                <option value="pending" ${action.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="in_progress" ${action.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${action.status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="cancelled" ${action.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            <div class="form-group">
              <label for="action-edit-priority">Priority</label>
              <select id="action-edit-priority">
                <option value="low" ${action.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${action.priority === 'medium' || !action.priority ? 'selected' : ''}>Medium</option>
                <option value="high" ${action.priority === 'high' ? 'selected' : ''}>High</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group action-assignee-picker-wrap">
              <label>Assignee</label>
              <input type="hidden" id="action-edit-assignee" value="${escapeHtml(assignee)}">
              <div class="action-assignee-picker-trigger" id="action-assignee-picker-trigger" title="Click to select from project contacts">
                <span class="action-assignee-picker-value" id="action-assignee-picker-value">${assignee ? escapeHtml(assignee) : '<span class="text-muted">Select assignee...</span>'}</span>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div id="action-assignee-picker-dropdown" class="action-assignee-picker-dropdown" style="display: none;">
                <div class="action-assignee-picker-search">
                  <input type="text" id="action-assignee-picker-search" placeholder="Search contacts..." autocomplete="off">
                </div>
                <div id="action-assignee-picker-list" class="action-assignee-picker-list">Loading...</div>
              </div>
            </div>
            <div class="form-group">
              <label for="action-edit-due">Due date</label>
              <input type="date" id="action-edit-due" value="${due ? due.split('T')[0] : ''}">
            </div>
          </div>
        </form>
        <div class="detail-actions">
          <button type="button" class="btn btn-primary" id="action-save-btn">Save</button>
          <button type="button" class="btn btn-secondary" id="action-cancel-edit-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="action-delete-in-edit-btn">Delete</button>
        </div>
      </div>
    </div>
  `;

  const backLink = container.querySelector('#back-to-list');
  if (backLink) {
    on(backLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      onClose();
    });
  }
  const closeBtn = container.querySelector('#close-detail');
  if (closeBtn) {
    on(closeBtn as HTMLElement, 'click', onClose);
  }

  const viewContent = container.querySelector('#action-view-content') as HTMLElement;
  const editForm = container.querySelector('#action-edit-form') as HTMLElement;

  const editBtn = container.querySelector('#edit-action-btn');
  if (editBtn) {
    on(editBtn as HTMLElement, 'click', () => {
      viewContent.style.display = 'none';
      editForm.style.display = 'block';
    });
  }

  const cancelEditBtn = container.querySelector('#action-cancel-edit-btn');
  if (cancelEditBtn) {
    on(cancelEditBtn as HTMLElement, 'click', () => {
      editForm.style.display = 'none';
      viewContent.style.display = 'block';
    });
  }

  const assigneePickerTrigger = container.querySelector('#action-assignee-picker-trigger');
  const assigneePickerDropdown = container.querySelector('#action-assignee-picker-dropdown') as HTMLElement;
  const assigneePickerValue = container.querySelector('#action-assignee-picker-value');
  const assigneeHiddenInput = container.querySelector('#action-edit-assignee') as HTMLInputElement;
  const assigneePickerList = container.querySelector('#action-assignee-picker-list') as HTMLElement;
  const assigneePickerSearch = container.querySelector('#action-assignee-picker-search') as HTMLInputElement;
  if (assigneePickerTrigger && assigneePickerDropdown && assigneePickerList && assigneeHiddenInput) {
    let editFormContacts: Contact[] = [];
    const renderAssigneePickerList = (filter = '') => {
      const filtered = filter
        ? editFormContacts.filter(
            (c) =>
              (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
              (c.role || '').toLowerCase().includes(filter.toLowerCase())
          )
        : editFormContacts;
      if (editFormContacts.length === 0) {
        assigneePickerList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
        return;
      }
      if (filtered.length === 0) {
        assigneePickerList.innerHTML = '<div class="empty-state">No contacts match</div>';
        return;
      }
      assigneePickerList.innerHTML = filtered
        .map((c) => {
          const photoUrl = (c as { photoUrl?: string }).photoUrl || (c as { avatarUrl?: string }).avatarUrl;
          const selected = (assigneeHiddenInput?.value || '').trim() === (c.name || '').trim();
          return `
            <div class="action-assignee-card-picker ${selected ? 'selected' : ''}" data-contact-name="${escapeHtml(c.name || '')}">
              <div class="action-assignee-card-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(c.name || '')}'">` : getInitials(c.name || '')}</div>
              <div class="action-assignee-card-info">
                <div class="action-assignee-card-name">${escapeHtml(c.name || '')}</div>
                ${c.role ? `<div class="action-assignee-card-role">${escapeHtml(c.role)}</div>` : ''}
              </div>
            </div>
          `;
        })
        .join('');
      assigneePickerList.querySelectorAll('.action-assignee-card-picker').forEach((card) => {
        on(card as HTMLElement, 'click', () => {
          const name = card.getAttribute('data-contact-name') || '';
          assigneeHiddenInput.value = name;
          if (assigneePickerValue) assigneePickerValue.innerHTML = name ? escapeHtml(name) : '<span class="text-muted">Select assignee...</span>';
          assigneePickerDropdown.style.display = 'none';
        });
      });
    };
    on(assigneePickerTrigger as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const isOpen = assigneePickerDropdown.style.display === 'block';
      assigneePickerDropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen && editFormContacts.length === 0) {
        assigneePickerList.innerHTML = '<div class="empty-state">Loading...</div>';
        try {
          const res = await contactsService.getAll();
          editFormContacts = res?.contacts || [];
          renderAssigneePickerList(assigneePickerSearch?.value || '');
        } catch {
          assigneePickerList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
        }
      } else if (!isOpen) renderAssigneePickerList(assigneePickerSearch?.value || '');
    });
    if (assigneePickerSearch) {
      assigneePickerSearch.addEventListener('input', () => renderAssigneePickerList(assigneePickerSearch.value));
    }
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-assignee-picker-wrap') && assigneePickerDropdown?.style.display === 'block') {
        assigneePickerDropdown.style.display = 'none';
      }
    });
  }

  // AI suggest in edit form (suggest assignee from task; fill picker only, user clicks Save)
  const editAiSuggestBtn = container.querySelector('#action-edit-ai-suggest-btn');
  const editSuggestionsPanel = container.querySelector('#action-edit-suggestions-panel') as HTMLElement;
  const editAssigneeHiddenInput = container.querySelector('#action-edit-assignee') as HTMLInputElement;
  const editAssigneePickerValue = container.querySelector('#action-assignee-picker-value');
  if (editAiSuggestBtn && editSuggestionsPanel) {
    on(editAiSuggestBtn as HTMLElement, 'click', async () => {
      const taskEl = container.querySelector('#action-edit-task') as HTMLTextAreaElement;
      const content = taskEl?.value?.trim() || '';
      if (!content) {
        toast.warning('Enter task content first');
        return;
      }
      const btn = editAiSuggestBtn as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = '<span class="spin">⋯</span> Analyzing...';
      editSuggestionsPanel.style.display = 'block';
      editSuggestionsPanel.innerHTML = '<div class="suggestions-loading"><div class="loading-text">AI is suggesting assignees...</div></div>';
      try {
        if (viewContacts.length === 0) {
          const res = await contactsService.getAll();
          viewContacts = res?.contacts || [];
        }
        const { suggested_assignees } = await actionsService.suggest({ content });
        if (!suggested_assignees?.length) {
          editSuggestionsPanel.innerHTML = '<div class="no-suggestions"><div class="no-suggestions-text">No suggestions</div><button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close</button></div>';
        } else {
          editSuggestionsPanel.innerHTML = `
            <div class="suggestions-header-sota"><div class="ai-badge">✨ AI Recommended</div></div>
            <div class="suggestions-list-sota">
              ${suggested_assignees.map((s: ActionAssigneeSuggestion) => {
                const contact = findContactByAssignee(s.name);
                const photoUrl = getContactPhotoUrl(contact);
                const roleOrReason = contact?.role ?? s.reason ?? '';
                return `
                <div class="action-suggestion-card suggestion-card-sota">
                  <div class="suggestion-card-left">
                    <div class="suggestion-avatar-sota">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(s.name)}'">` : getInitials(s.name)}</div>
                    <div class="suggestion-score-ring" style="--score-color: ${(s.score ?? 0) >= 70 ? 'var(--success)' : (s.score ?? 0) >= 50 ? 'var(--warning)' : 'var(--text-muted)'}">${s.score ?? 0}</div>
                    <div>
                      <div class="suggestion-name">${escapeHtml(s.name)}</div>
                      ${roleOrReason ? `<div class="suggestion-reason">${escapeHtml(roleOrReason)}</div>` : ''}
                    </div>
                  </div>
                  <button type="button" class="btn-select-suggestion" data-assignee-name="${escapeHtml(s.name)}">Assign</button>
                </div>
              `;
              }).join('')}
            </div>
            <div class="suggestions-footer"><button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close suggestions</button></div>
          `;
          editSuggestionsPanel.querySelectorAll('.btn-select-suggestion').forEach((assignBtn) => {
            const name = (assignBtn as HTMLElement).getAttribute('data-assignee-name') || '';
            if (!name) return;
            on(assignBtn as HTMLElement, 'click', () => {
              if (editAssigneeHiddenInput) editAssigneeHiddenInput.value = name;
              if (editAssigneePickerValue) editAssigneePickerValue.innerHTML = escapeHtml(name);
              editSuggestionsPanel.style.display = 'none';
              toast.success(`Assignee set to ${name}`);
            });
          });
        }
        const hideBtn = editSuggestionsPanel.querySelector('#action-edit-hide-suggest-btn');
        if (hideBtn) on(hideBtn as HTMLElement, 'click', () => { editSuggestionsPanel.style.display = 'none'; });
      } catch {
        editSuggestionsPanel.innerHTML = '<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close</button></div>';
        const h = editSuggestionsPanel.querySelector('#action-edit-hide-suggest-btn');
        if (h) on(h as HTMLElement, 'click', () => { editSuggestionsPanel.style.display = 'none'; });
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> AI suggest';
      }
    });
  }

  const saveBtn = container.querySelector('#action-save-btn');
  if (saveBtn) {
    on(saveBtn as HTMLElement, 'click', async () => {
      const taskEl = container.querySelector('#action-edit-task') as HTMLTextAreaElement;
      const statusEl = container.querySelector('#action-edit-status') as HTMLSelectElement;
      const priorityEl = container.querySelector('#action-edit-priority') as HTMLSelectElement;
      const assigneeEl = container.querySelector('#action-edit-assignee') as HTMLInputElement;
      const dueEl = container.querySelector('#action-edit-due') as HTMLInputElement;
      if (!taskEl?.value.trim()) {
        toast.warning('Task is required');
        return;
      }
      try {
        const updated = await actionsService.update(action.id, {
          content: taskEl.value.trim(),
          status: statusEl?.value as Action['status'],
          priority: priorityEl?.value as Action['priority'],
          assignee: assigneeEl?.value.trim() || undefined,
          due_date: dueEl?.value || undefined,
        });
        toast.success('Action updated');
        onUpdate?.(updated);
      } catch {
        toast.error('Failed to update action');
      }
    });
  }

  const deleteBtn = container.querySelector('#delete-action-btn');
  const deleteInEditBtn = container.querySelector('#action-delete-in-edit-btn');
  const doDelete = async () => {
    const { confirm } = await import('../Modal');
    const confirmed = await confirm('Are you sure you want to delete this action?', {
      title: 'Delete Action',
      confirmText: 'Delete',
      confirmClass: 'btn-danger',
    });
    if (confirmed) {
      try {
        await actionsService.delete(action.id);
        toast.success('Action deleted');
        onClose();
      } catch {
        toast.error('Failed to delete action');
      }
    }
  };
  if (deleteBtn) on(deleteBtn as HTMLElement, 'click', doDelete);
  if (deleteInEditBtn) on(deleteInEditBtn as HTMLElement, 'click', doDelete);

  const docLink = container.querySelector('.doc-link[data-document-id]');
  if (docLink) {
    on(docLink as HTMLElement, 'click', (e) => {
      e.preventDefault();
      const docId = (docLink as HTMLElement).getAttribute('data-document-id');
      if (docId) {
        window.dispatchEvent(new CustomEvent('godmode:navigate', {
          detail: { tab: 'files', documentId: docId }
        }));
      }
    });
  }

  const aiSuggestBtn = container.querySelector('#action-ai-suggest-btn');
  const suggestionsPanel = container.querySelector('#action-suggestions-panel') as HTMLElement;
  if (aiSuggestBtn && suggestionsPanel) {
    on(aiSuggestBtn as HTMLElement, 'click', async () => {
      (aiSuggestBtn as HTMLButtonElement).disabled = true;
      suggestionsPanel.style.display = 'block';
      suggestionsPanel.innerHTML = '<div class="suggestions-loading">Loading suggestions...</div>';
      try {
        const task = taskText(action);
        if (viewContacts.length === 0) {
          const res = await contactsService.getAll();
          viewContacts = res?.contacts || [];
        }
        const { suggested_assignees } = await actionsService.suggest({ content: task });
        if (!suggested_assignees?.length) {
          suggestionsPanel.innerHTML = '<div class="no-suggestions">No suggestions. <button type="button" class="btn-link" id="action-hide-suggest-btn">Close suggestions</button></div>';
        } else {
          suggestionsPanel.innerHTML = `
            <div class="suggestions-header-sota">
              <div class="ai-badge">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI Recommended
              </div>
            </div>
            <div class="suggestions-list-sota">
              ${suggested_assignees.map((s: ActionAssigneeSuggestion, i: number) => {
                const contact = findContactByAssignee(s.name);
                const photoUrl = getContactPhotoUrl(contact);
                const roleOrReason = contact?.role ?? s.reason ?? '';
                return `
                <div class="suggestion-card-sota" data-index="${i}">
                  <div class="suggestion-rank">#${i + 1}</div>
                  <div class="suggestion-avatar-sota">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(s.name)}'">` : getInitials(s.name)}</div>
                  <div class="suggestion-info-sota">
                    <div class="suggestion-name-sota">${escapeHtml(s.name)}</div>
                    ${roleOrReason ? `<div class="suggestion-reason-sota">${escapeHtml(roleOrReason)}</div>` : ''}
                  </div>
                  <div class="suggestion-score-sota" style="--score-color: ${(s.score ?? 0) >= 70 ? 'var(--success)' : (s.score ?? 0) >= 50 ? 'var(--warning)' : 'var(--text-muted)'}">
                    <div class="score-ring">
                      <svg viewBox="0 0 36 36">
                        <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                        <path class="score-fill" stroke-dasharray="${s.score ?? 0}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      </svg>
                      <div class="score-value">${s.score ?? 0}%</div>
                    </div>
                    <div class="score-label">Match</div>
                  </div>
                  <button type="button" class="btn-select-suggestion" data-assignee-name="${escapeHtml(s.name)}">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Assign
                  </button>
                </div>
              `;
              }).join('')}
            </div>
            <div class="suggestions-footer"><button type="button" class="btn-link" id="action-hide-suggest-btn">Close suggestions</button></div>
          `;
          suggestionsPanel.querySelectorAll('.btn-select-suggestion').forEach((btn) => {
            on(btn as HTMLElement, 'click', async () => {
              const name = (btn as HTMLElement).getAttribute('data-assignee-name') || '';
              if (!name) return;
              try {
                const updated = await actionsService.update(action.id, { assignee: name });
                toast.success(`Assigned to ${name}`);
                onUpdate?.(updated);
                suggestionsPanel.style.display = 'none';
              } catch {
                toast.error('Failed to assign');
              }
            });
          });
        }
        const hideBtn = suggestionsPanel.querySelector('#action-hide-suggest-btn');
        if (hideBtn) on(hideBtn as HTMLElement, 'click', () => { suggestionsPanel.style.display = 'none'; });
      } catch {
        suggestionsPanel.innerHTML = '<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="action-hide-suggest-btn">Close</button></div>';
        const h = suggestionsPanel.querySelector('#action-hide-suggest-btn');
        if (h) on(h as HTMLElement, 'click', () => { suggestionsPanel.style.display = 'none'; });
      } finally {
        (aiSuggestBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  const timelineEl = container.querySelector('#timeline-content');
  if (timelineEl) {
    actionsService.getEvents(action.id).then((events: ActionEvent[]) => {
      if (events.length === 0) {
        (timelineEl as HTMLElement).innerHTML = '<p class="empty-state">No events recorded</p>';
        return;
      }
      const html = events.map((ev) => {
        const icon = getActionEventIcon(ev.event_type);
        const description = getActionEventDescription(ev);
        return `
          <div class="timeline-item action-event-${escapeHtml(ev.event_type)}">
            <div class="timeline-icon">${icon}</div>
            <div class="timeline-content">
              <div class="timeline-title">${escapeHtml(description)}</div>
              <div class="timeline-date">${formatDateTime(ev.created_at)}</div>
            </div>
          </div>`;
      }).join('');
      (timelineEl as HTMLElement).innerHTML = `<div class="timeline-list">${html}</div>`;
    }).catch(() => {
      (timelineEl as HTMLElement).innerHTML = '<p class="error">Failed to load timeline</p>';
    });
  }

  // Contact picker in view: load contacts, show picker on Change/Choose Manually, on select update assignee via API
  let viewContacts: Contact[] = [];
  const actionContactPicker = container.querySelector('#action-contact-picker') as HTMLElement;
  const actionContactList = container.querySelector('#action-contact-list') as HTMLElement;
  const actionContactSearch = container.querySelector('#action-contact-search') as HTMLInputElement;

  function getContactPhotoUrl(c: Contact | undefined): string | null {
    if (!c) return null;
    const u = c as { photoUrl?: string; avatarUrl?: string; photo_url?: string; avatar_url?: string };
    return u.photoUrl || u.avatarUrl || u.photo_url || u.avatar_url || null;
  }

  const renderActionContactGrid = (filter = '') => {
    if (!actionContactList) return;
    const list = filter
      ? viewContacts.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
            (c.role || '').toLowerCase().includes(filter.toLowerCase()) ||
            ((c as { organization?: string }).organization || '').toLowerCase().includes(filter.toLowerCase())
        )
      : viewContacts;
    if (viewContacts.length === 0) {
      actionContactList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
      return;
    }
    if (list.length === 0) {
      actionContactList.innerHTML = '<div class="empty-state">No contacts match</div>';
      return;
    }
    actionContactList.innerHTML = list
      .map((c) => {
        const photoUrl = getContactPhotoUrl(c);
        const isCurrent = (assignee || '').trim() === (c.name || '').trim();
        return `
          <div class="contact-card-picker ${isCurrent ? 'selected' : ''}" data-contact-name="${escapeHtml(c.name || '')}">
            <div class="contact-avatar-picker">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(c.name || '')}'">` : getInitials(c.name || '')}</div>
            <div class="contact-info-picker">
              <div class="contact-name-picker">${escapeHtml(c.name || '')}</div>
              ${c.role ? `<div class="contact-role-picker">${escapeHtml(c.role)}</div>` : ''}
            </div>
          </div>`;
      })
      .join('');
    actionContactList.querySelectorAll('.contact-card-picker').forEach((card) => {
      on(card as HTMLElement, 'click', async () => {
        const name = card.getAttribute('data-contact-name') || '';
        if (!name) return;
        try {
          const updated = await actionsService.update(action.id, { assignee: name });
          toast.success(`Assigned to ${name}`);
          if (actionContactPicker) actionContactPicker.style.display = 'none';
          onUpdate?.(updated);
        } catch {
          toast.error('Failed to save assignment');
        }
      });
    });
  };

  const showActionPicker = () => {
    if (!actionContactPicker) return;
    actionContactPicker.style.display = actionContactPicker.style.display === 'none' ? 'block' : 'none';
    if (actionContactPicker.style.display === 'block' && viewContacts.length === 0) {
      contactsService.getAll().then((res) => {
        viewContacts = res?.contacts || [];
        renderActionContactGrid(actionContactSearch?.value || '');
      }).catch(() => {
        if (actionContactList) actionContactList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
      });
    } else if (actionContactPicker.style.display === 'block') {
      renderActionContactGrid(actionContactSearch?.value || '');
    }
    if (actionContactSearch) actionContactSearch.focus();
  };

  const changeBtn = container.querySelector('#action-change-assignee-btn');
  const showPickerBtn = container.querySelector('#action-show-picker-btn');
  if (changeBtn && actionContactPicker) on(changeBtn as HTMLElement, 'click', showActionPicker);
  if (showPickerBtn && actionContactPicker) on(showPickerBtn as HTMLElement, 'click', showActionPicker);
  if (actionContactSearch) {
    actionContactSearch.addEventListener('input', () => renderActionContactGrid(actionContactSearch.value));
  }

  // Find contact by assignee name: exact name, partial name, or any alias (case-insensitive)
  function findContactByAssignee(name: string): Contact | undefined {
    if (!name || !viewContacts.length) return undefined;
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    const byExact = viewContacts.find((c) => (c.name || '').trim().toLowerCase() === n);
    if (byExact) return byExact;
    const byPartial = viewContacts.find(
      (c) =>
        (c.name || '').trim().toLowerCase().includes(n) ||
        n.includes((c.name || '').trim().toLowerCase())
    );
    if (byPartial) return byPartial;
    const byAlias = viewContacts.find((c) =>
      (c.aliases || []).some((a) => String(a).trim().toLowerCase() === n)
    );
    if (byAlias) return byAlias;
    return viewContacts.find((c) =>
      (c.aliases || []).some((a) => {
        const aLower = String(a).trim().toLowerCase();
        return aLower.includes(n) || n.includes(aLower);
      })
    );
  }

  // Load contacts to show assigned role and avatar in current-assignment card
  contactsService.getAll().then((res) => {
    viewContacts = res?.contacts || [];
    const contact = findContactByAssignee(assignee);
    const roleEl = container.querySelector('#action-assigned-role');
    if (roleEl) roleEl.textContent = contact?.role ?? '—';
    const avatarEl = container.querySelector('#action-assigned-avatar');
    if (avatarEl && assignee) {
      const photoUrl = getContactPhotoUrl(contact);
      if (photoUrl) {
        avatarEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = photoUrl;
        img.alt = '';
        img.onerror = () => { avatarEl.textContent = getInitials(assignee); };
        avatarEl.appendChild(img);
      }
    }
  }).catch(() => {});

  return container;
}
