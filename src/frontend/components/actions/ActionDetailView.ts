/**
 * Action Detail View
 * Full-page view for action details: task, status, priority, assignee, due date, source, timeline
 */

import { createElement, on } from '../../utils/dom';
import { Action, ActionEvent, ActionAssigneeSuggestion, actionsService } from '../../services/actions';
import { decisionsService, Decision } from '../../services/decisions';
import { contactsService, Contact } from '../../services/contacts';
import { toast } from '../../services/toast';
import { formatRelativeTime, formatDateTime } from '../../utils/format';
import { createCommentsThread } from '../CommentsThread';
import { appStore } from '../../stores/app';

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((s) => s[0]).join('').toUpperCase().substring(0, 2);
}

export interface ActionDetailViewProps {
  action: Action;
  onClose: () => void;
  onUpdate?: (action: Action) => void;
  /** When user clicks the linked decision (optional, e.g. open decision detail) */
  onDecisionClick?: (decisionId: string | number) => void;
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
    refined_with_ai: '✨',
    rollback: '↩️',
  };
  return icons[eventType] || '•';
}

function getActionEventDescription(ev: ActionEvent): string {
  const data = ev.event_data || {};
  const actor = ev.actor_name ? ` by ${ev.actor_name}` : '';

  switch (ev.event_type) {
    case 'created':
      return `Created${actor}`;
    case 'refined_with_ai':
      return `Refined with AI${actor}`;
    case 'rollback':
      return `Restored previous version${actor}`;
    case 'updated': {
      const changes = (data.changes as Array<{ field: string; from: string; to: string }>) || [];
      if (changes.length === 0) return `Updated${actor}`;
      const textFields = ['Description', 'Task', 'DoD', 'Acceptance criteria'];
      const hasLongText = changes.some((c) => textFields.includes(c.field));
      if (hasLongText && changes.length >= 2) {
        return `Fields updated${actor}`;
      }
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

type DodItem = { text: string; done: boolean };

function normalizeDefinitionOfDone(raw: (string | { text?: string; done?: boolean })[] | undefined): DodItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { text: item, done: false };
    return { text: (item.text ?? '').toString(), done: Boolean(item.done) };
  });
}

function getDescriptionBodyHtml(a: Action, _assigneeStr: string): string {
  const dod = normalizeDefinitionOfDone((a.definition_of_done as (string | { text?: string; done?: boolean })[]) || []);
  const ac = (a.acceptance_criteria || []).map((item) => (typeof item === 'string' ? item : String(item)));
  // Task title is shown in the header; Assignee in Assignment section; Status in header badge — avoid duplicating here
  const dlParts: string[] = [];
  if (a.parent_story_ref || a.parent_story_id) {
    dlParts.push(`<dt>Parent</dt><dd>${escapeHtml(String(a.parent_story_ref || a.parent_story_id))}</dd>`);
  }
  if (a.size_estimate) {
    dlParts.push(`<dt>Size</dt><dd>${escapeHtml(a.size_estimate)}</dd>`);
  }
  const dlHtml = dlParts.length
    ? `<dl class="action-description-dl">${dlParts.join('')}</dl>`
    : '';
  const descHtml = a.description ? `<div class="action-description-text"><strong>Description</strong><p>${escapeHtml(a.description).replace(/\n/g, '<br>')}</p></div>` : '';
  const dodHtml = dod.length
    ? `<div class="action-dod"><strong>Definition of Done</strong><ul class="action-checklist action-dod-list">${dod.map((item, i) => `<li class="dod-item ${item.done ? 'dod-done' : ''}" data-dod-index="${i}"><button type="button" class="dod-item-toggle" data-dod-index="${i}" aria-label="${item.done ? 'Mark undone' : 'Mark done'}">${item.done ? '✔' : '☐'}</button><span class="dod-item-text">${escapeHtml(item.text)}</span></li>`).join('')}</ul></div>`
    : '';
  const acHtml = ac.length ? `<div class="action-ac"><strong>Acceptance criteria</strong><ul class="action-checklist">${ac.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
  return `${dlHtml}${descHtml}${dodHtml}${acHtml}`;
}

export function createActionDetailView(props: ActionDetailViewProps): HTMLElement {
  const { action, onClose, onUpdate, onDecisionClick } = props;
  let currentAction: Action = action;

  const container = createElement('div', { className: 'action-detail-view question-detail-view' });

  const task = taskText(action);
  const due = action.due_date ?? (action as { deadline?: string }).deadline ?? '';
  const assignee = action.assignee ?? action.owner ?? '';
  const projectName = appStore.getState().currentProject?.name ?? null;

  container.innerHTML = `
    <div class="question-detail-header action-detail-header">
      <div class="breadcrumb">
        <a href="#" class="breadcrumb-link" id="back-to-list">Actions</a>
        <span class="breadcrumb-separator">›</span>
        ${projectName ? `<span class="breadcrumb-project" title="Project">${escapeHtml(projectName)}</span><span class="breadcrumb-separator">›</span>` : ''}
        <span class="breadcrumb-current">Action #${String(action.id).substring(0, 8)}</span>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="action-refine-ai-btn" title="Refine task description, DoD and acceptance criteria with AI">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Refine with AI
        </button>
        <span class="status-badge status-${(action.status || 'pending').toLowerCase()}">${escapeHtml(String(action.status).replace('_', ' '))}</span>
        <button class="btn btn-icon" id="close-detail" title="Close">×</button>
      </div>
    </div>

    <div class="question-detail-content action-detail-content">
      <div id="action-view-content">
        <section class="detail-section action-main">
          <div class="question-badges action-badges">
            ${projectName ? `<span class="project-badge" title="Project">${escapeHtml(projectName)}</span>` : ''}
            ${action.priority ? `<span class="priority-pill priority-${action.priority}">${escapeHtml(action.priority)}</span>` : ''}
            <span class="question-date action-date">Created ${formatRelativeTime(action.created_at)}</span>
          </div>
          <h2 class="question-text action-task-text">${escapeHtml(task)}</h2>
        </section>

        <section class="detail-section action-description-structured" id="action-description-section">
          <h3 class="section-header-sota">Description</h3>
          <div class="action-description-body">${getDescriptionBodyHtml(action, assignee)}</div>
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
                <button type="button" class="btn-ai-suggest" id="action-ai-suggest-btn" title="Suggest who should do this task (assignee) from task content">
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
              <div id="action-contact-picker" class="contact-picker-sota hidden">
                <div class="picker-search">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input type="text" id="action-contact-search" placeholder="Search contacts..." autocomplete="off">
                </div>
                <div id="action-contact-list" class="contact-list-grid">Loading...</div>
              </div>

              <!-- AI Suggestions Panel -->
              <div id="action-suggestions-panel" class="suggestions-panel-sota action-suggestions-panel hidden gm-mb-3"></div>

              <!-- Due date, Sprint (Status is only in header badge) -->
              <dl class="metadata-list action-meta-inline">
                <dt>Due date</dt>
                <dd>${due ? formatDate(due) : '—'}</dd>
                ${(action.sprint_id || action.sprint_name) ? `
                <dt>Sprint</dt>
                <dd>${escapeHtml((action.sprint_name as string) || String(action.sprint_id))}</dd>
                ` : ''}
              </dl>
            </section>

            <section class="detail-section" id="action-decision-section">
              <div class="section-header"><h3>Implementing decision</h3></div>
              <div id="action-decision-display" class="action-decision-display">
                ${(action as Action).decision_id ? `<p class="text-muted">Loading…</p>` : '<p class="text-muted">No decision linked</p>'}
              </div>
              <div class="action-decision-actions">
                <button type="button" class="btn btn-sm btn-outline-secondary" id="action-link-decision-btn">${(action as Action).decision_id ? 'Change' : 'Link decision'}</button>
                <button type="button" class="btn btn-sm btn-link ${!(action as Action).decision_id ? 'hidden' : ''}" id="action-unlink-decision-btn">Unlink</button>
              </div>
              <div id="action-decision-picker" class="action-decision-picker hidden">
                <div class="picker-search"><input type="text" id="action-decision-search" placeholder="Search decisions..." autocomplete="off"></div>
                <div id="action-decision-list" class="action-decision-list">Loading…</div>
              </div>
            </section>

            <section class="detail-section" id="action-source-section">
              <div class="section-header"><h3>Source</h3></div>
              <div class="source-content">
              ${[
                action.source_file ? `<p class="source-file"><strong>File:</strong> ${escapeHtml(action.source_file)}</p>` : '',
                action.source_document_id ? `<p class="source-doc"><a href="#" class="doc-link" data-document-id="${escapeHtml(String(action.source_document_id))}">View source document</a></p>` : '',
                action.source_type ? `<p class="source-type"><strong>Origin:</strong> ${escapeHtml(action.source_type)}</p>` : '',
                action.generation_source ? `<p class="source-meta"><strong>Generation:</strong> <span class="status-pill">${escapeHtml(action.generation_source)}</span></p>` : '',
                action.requested_by ? `<div id="action-requester-display" class="requester-display"><p><strong>Requested by:</strong> ${escapeHtml(action.requested_by)}</p></div>` : '',
              ].filter(Boolean).join('') || '<p class="text-muted">No source recorded</p>'}
              </div>
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

            <section class="detail-section" id="action-comments-section">
              <div id="action-comments-mount"></div>
            </section>

            <section class="detail-section" id="action-similar-section">
              <h3 class="section-header-sota">Similar actions</h3>
              <div id="action-similar-mount" class="action-similar-list"><span class="text-muted">Loading…</span></div>
            </section>
          </div>
        </div>

        <div class="detail-actions">
          <button type="button" class="btn btn-secondary" id="edit-action-btn">Edit</button>
          <button type="button" class="btn btn-danger" id="delete-action-btn">Delete</button>
        </div>
      </div>

      <div id="action-edit-form" class="action-detail-edit-form hidden">
        <form id="action-inline-form" class="action-form">
          <div class="form-group">
            <div class="gm-flex gm-flex-center gm-justify-between gm-flex-wrap gm-gap-2 gm-mb-2">
              <label for="action-edit-task" class="gm-mb-0">Task *</label>
              <button type="button" class="btn-ai-suggest btn-sm" id="action-edit-ai-suggest-btn" title="Suggest assignee from task content">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                AI suggest
              </button>
            </div>
            <textarea id="action-edit-task" rows="3" required placeholder="What needs to be done?">${escapeHtml(task)}</textarea>
          </div>
          <div id="action-edit-suggestions-panel" class="suggestions-panel-sota action-suggestions-panel hidden gm-mb-4"></div>
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
              <div id="action-assignee-picker-dropdown" class="action-assignee-picker-dropdown hidden">
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
          <div class="form-group action-requester-picker-wrap">
            <label>Requested by</label>
            <input type="hidden" id="action-edit-requester-contact-id" value="${escapeHtml((action.requested_by_contact_id as string) || '')}">
            <input type="hidden" id="action-edit-requester-name" value="${escapeHtml((action.requested_by as string) || '')}">
            <div class="action-assignee-picker-trigger" id="action-requester-picker-trigger" title="Click to select who requested this task">
              <span class="action-assignee-picker-value" id="action-requester-picker-value">${(action.requested_by as string) ? escapeHtml(action.requested_by as string) : '<span class="text-muted">Select requester...</span>'}</span>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div id="action-requester-picker-dropdown" class="action-assignee-picker-dropdown hidden">
              <div class="action-assignee-picker-search">
                <input type="text" id="action-requester-picker-search" placeholder="Search contacts..." autocomplete="off">
              </div>
              <div id="action-requester-picker-list" class="action-assignee-picker-list">Loading...</div>
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

  const refineAiBtn = container.querySelector('#action-refine-ai-btn');
  if (refineAiBtn) {
    on(refineAiBtn as HTMLElement, 'click', async () => {
      const task = taskText(action);
      const desc = (action.description ?? '') as string;
      const userInput = [task, desc].filter(Boolean).join('\n\n');
      if (!userInput.trim()) {
        toast.error('Task has no content to refine');
        return;
      }
      (refineAiBtn as HTMLButtonElement).disabled = true;
      (refineAiBtn as HTMLButtonElement).textContent = 'Refining...';
      try {
        const result = await actionsService.suggestTaskFromDescription({
          user_input: userInput,
          parent_story_ref: (action.parent_story_ref as string) || undefined,
        });
        const updated = await actionsService.update(action.id, {
          content: result.task,
          description: result.description,
          definition_of_done: result.definition_of_done,
          acceptance_criteria: result.acceptance_criteria,
          size_estimate: result.size_estimate,
          refined_with_ai: true,
        });
        toast.success('Task refined with AI');
        currentAction = updated;
        refreshDescriptionAndTimeline();
        onUpdate?.(updated);
      } catch (e) {
        toast.error((e as Error).message || 'Failed to refine');
      } finally {
        (refineAiBtn as HTMLButtonElement).disabled = false;
        (refineAiBtn as HTMLButtonElement).innerHTML = `
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Refine with AI
        `;
      }
    });
  }

  function bindDodToggles(): void {
    const bodyEl = container.querySelector('#action-description-section .action-description-body');
    if (!bodyEl) return;
    bodyEl.querySelectorAll('.dod-item-toggle').forEach((btn) => {
      on(btn as HTMLElement, 'click', async () => {
        const idx = parseInt((btn as HTMLElement).getAttribute('data-dod-index') ?? '-1', 10);
        if (idx < 0) return;
        const dod = normalizeDefinitionOfDone((currentAction.definition_of_done as (string | { text?: string; done?: boolean })[]) || []);
        if (idx >= dod.length) return;
        const li = (btn as HTMLElement).closest('.dod-item');
        const previousDone = dod[idx].done;
        dod[idx].done = !dod[idx].done;
        const payload = dod.map((item) => ({ text: item.text, done: item.done }));
        // Optimistic UI: update DOM immediately
        if (li) li.classList.toggle('dod-done', dod[idx].done);
        (btn as HTMLButtonElement).textContent = dod[idx].done ? '✔' : '☐';
        (btn as HTMLButtonElement).setAttribute('aria-label', dod[idx].done ? 'Mark undone' : 'Mark done');
        try {
          const updated = await actionsService.update(currentAction.id, { definition_of_done: payload });
          currentAction = updated;
          toast.success(dod[idx].done ? 'Marked done' : 'Marked undone');
        } catch (e) {
          // Revert optimistic update
          dod[idx].done = previousDone;
          if (li) li.classList.toggle('dod-done', previousDone);
          (btn as HTMLButtonElement).textContent = previousDone ? '✔' : '☐';
          (btn as HTMLButtonElement).setAttribute('aria-label', previousDone ? 'Mark undone' : 'Mark done');
          toast.error((e as Error).message || 'Failed to update');
        }
      });
    });
  }

  function renderTimeline(el: HTMLElement | null): void {
    if (!el) return;
    actionsService.getEvents(currentAction.id).then((events: ActionEvent[]) => {
      if (events.length === 0) {
        el.innerHTML = '<p class="empty-state">No events recorded</p>';
        bindDodToggles();
        return;
      }
      const html = events.map((ev) => {
        const icon = getActionEventIcon(ev.event_type);
        const description = getActionEventDescription(ev);
        const data = ev.event_data || {};
        const snapshot = data.snapshot as Record<string, unknown> | undefined;
        const hasRestore = ev.event_type === 'refined_with_ai' && snapshot && typeof snapshot === 'object';
        const snapshotAttr = hasRestore ? ` data-snapshot="${escapeHtml(JSON.stringify(snapshot))}"` : '';
        const restoreBtn = hasRestore
          ? `<button type="button" class="btn btn-sm btn-outline-secondary action-restore-btn"${snapshotAttr} title="Restore this version">Restore</button>`
          : '';
        return `
          <div class="timeline-item action-event-${escapeHtml(ev.event_type)}">
            <div class="timeline-icon">${icon}</div>
            <div class="timeline-content">
              <div class="timeline-title-row">
                <span class="timeline-title">${escapeHtml(description)}</span>
                ${restoreBtn}
              </div>
              <div class="timeline-date">${formatDateTime(ev.created_at)}</div>
            </div>
          </div>`;
      }).join('');
      el.innerHTML = `<div class="timeline-list">${html}</div>`;
      el.querySelectorAll('.action-restore-btn').forEach((btn) => {
        on(btn as HTMLElement, 'click', async () => {
          const raw = (btn as HTMLElement).getAttribute('data-snapshot');
          if (!raw) return;
          const restoreBtn = btn as HTMLButtonElement;
          restoreBtn.disabled = true;
          const originalText = restoreBtn.textContent || 'Restore';
          restoreBtn.textContent = 'Restoring…';
          try {
            const snapshot = JSON.parse(raw) as { content?: string; task?: string; description?: string; definition_of_done?: (string | { text: string; done?: boolean })[]; acceptance_criteria?: string[]; size_estimate?: string };
            const updated = await actionsService.update(currentAction.id, { restore_snapshot: snapshot });
            toast.success('Previous version restored');
            currentAction = updated;
            refreshDescriptionAndTimeline();
            onUpdate?.(updated);
          } catch (e) {
            toast.error((e as Error).message || 'Failed to restore');
            restoreBtn.disabled = false;
            restoreBtn.textContent = originalText;
          }
        });
      });
      bindDodToggles();
    }).catch(() => {
      el.innerHTML = '<p class="error">Failed to load timeline</p>';
    });
  }

  function refreshDescriptionAndTimeline(): void {
    const taskEl = container.querySelector('.action-task-text');
    if (taskEl) taskEl.textContent = taskText(currentAction);
    const bodyEl = container.querySelector('#action-description-section .action-description-body');
    if (bodyEl) {
      bodyEl.innerHTML = getDescriptionBodyHtml(currentAction, currentAction.assignee ?? (currentAction as Action).owner ?? '');
      bindDodToggles();
    }
    const timelineEl = container.querySelector('#timeline-content') as HTMLElement | null;
    if (timelineEl) timelineEl.innerHTML = '<span class="text-muted">Loading…</span>';
    renderTimeline(timelineEl);
  }

  function refreshDecisionSection(): void {
    const displayEl = container.querySelector('#action-decision-display') as HTMLElement;
    const linkBtn = container.querySelector('#action-link-decision-btn') as HTMLButtonElement;
    const unlinkBtn = container.querySelector('#action-unlink-decision-btn');
    const decisionId = (currentAction as Action).decision_id;
    if (!displayEl) return;
    if (decisionId) {
      displayEl.innerHTML = '<p class="text-muted">Loading…</p>';
      decisionsService.getDecision(decisionId).then((d: Decision | null) => {
        if (!displayEl) return;
        const title = (d?.summary || d?.content || '').toString().trim().substring(0, 80) + ((d?.content || '').toString().length > 80 ? '…' : '');
        displayEl.innerHTML = `<p><a href="#" class="decision-link" data-decision-id="${escapeHtml(String(decisionId))}">${escapeHtml(title || `Decision #${String(decisionId).substring(0, 8)}`)}</a></p>`;
        displayEl.querySelector('.decision-link') && on(displayEl.querySelector('.decision-link') as HTMLElement, 'click', (e) => {
          e.preventDefault();
          onDecisionClick?.(decisionId);
        });
      }).catch(() => {
        displayEl.innerHTML = `<p><a href="#" class="decision-link" data-decision-id="${escapeHtml(String(decisionId))}">Decision #${String(decisionId).substring(0, 8)}</a></p>`;
      });
      if (linkBtn) linkBtn.textContent = 'Change';
      if (unlinkBtn) (unlinkBtn as HTMLElement).classList.remove('hidden');
    } else {
      displayEl.innerHTML = '<p class="text-muted">No decision linked</p>';
      if (linkBtn) linkBtn.textContent = 'Link decision';
      if (unlinkBtn) (unlinkBtn as HTMLElement).classList.add('hidden');
    }
  }

  const viewContent = container.querySelector('#action-view-content') as HTMLElement;
  const editForm = container.querySelector('#action-edit-form') as HTMLElement;

  const commentsMount = container.querySelector('#action-comments-mount') as HTMLElement;
  if (commentsMount) {
    const projectId = appStore.getState().currentProject?.id;
    const commentsThread = createCommentsThread({
      targetType: 'action',
      targetId: String(action.id),
      projectId: projectId || undefined,
    });
    commentsMount.appendChild(commentsThread);
  }

  const similarMount = container.querySelector('#action-similar-mount') as HTMLElement;
  if (similarMount) {
    (async () => {
      try {
        const similar = await actionsService.getSimilar(action.id);
        if (similar.length === 0) {
          similarMount.innerHTML = '<span class="text-muted">No similar actions found. Rebuild RAG embeddings to enable.</span>';
          return;
        }
        similarMount.innerHTML = similar
          .map(
            (a) => `
          <div class="action-similar-card" data-action-id="${escapeHtml(String(a.id))}" role="button" tabindex="0">
            <span class="action-similar-status status-pill status-${(a.status || 'pending').toLowerCase()}">${escapeHtml(String(a.status || 'pending').replace('_', ' '))}</span>
            <span class="action-similar-task">${escapeHtml(((a.content || a.task) || '').toString().trim().substring(0, 80))}${((a.content || a.task) || '').toString().length > 80 ? '…' : ''}</span>
          </div>
        `
          )
          .join('');
        similarMount.querySelectorAll('.action-similar-card').forEach((el) => {
          on(el as HTMLElement, 'click', () => {
            const id = (el as HTMLElement).getAttribute('data-action-id');
            const chosen = similar.find((a) => String(a.id) === id);
            if (chosen) onUpdate?.(chosen);
          });
        });
      } catch {
        similarMount.innerHTML = '<span class="text-muted">Could not load similar actions.</span>';
      }
    })();
  }

  // Implementing decision: load linked decision and bind Link/Unlink/Picker
  (() => {
    refreshDecisionSection();
    const linkBtn = container.querySelector('#action-link-decision-btn');
    const unlinkBtn = container.querySelector('#action-unlink-decision-btn');
    const pickerEl = container.querySelector('#action-decision-picker') as HTMLElement;
    const listEl = container.querySelector('#action-decision-list') as HTMLElement;
    const searchInput = container.querySelector('#action-decision-search') as HTMLInputElement;

    const renderDecisionList = (decisions: Decision[], filter = '') => {
      if (!listEl) return;
      const f = filter.trim().toLowerCase();
      const filtered = f ? decisions.filter((d) => (d.content || '').toLowerCase().includes(f) || (d.summary || '').toLowerCase().includes(f)) : decisions;
      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No decisions match</div>';
        return;
      }
      listEl.innerHTML = filtered
        .map((d) => {
          const title = (d.summary || d.content || '').toString().trim().substring(0, 60) + ((d.content || '').toString().length > 60 ? '…' : '');
          return `<div class="action-decision-item" data-decision-id="${escapeHtml(String(d.id))}" role="button" tabindex="0">${escapeHtml(title)}</div>`;
        })
        .join('');
      listEl.querySelectorAll('.action-decision-item').forEach((el) => {
        on(el as HTMLElement, 'click', async () => {
          const id = (el as HTMLElement).getAttribute('data-decision-id');
          if (!id) return;
          try {
            const updated = await actionsService.update(currentAction.id, { decision_id: id });
            currentAction = updated as Action;
            onUpdate?.(updated as Action);
            refreshDecisionSection();
            if (pickerEl) pickerEl.classList.add('hidden');
            toast.success('Decision linked');
          } catch (e) {
            toast.error((e as Error).message || 'Failed to link decision');
          }
        });
      });
    };

    if (linkBtn) {
      on(linkBtn as HTMLElement, 'click', async () => {
        if (!pickerEl || !listEl) return;
        const isOpen = !pickerEl.classList.contains('hidden');
        pickerEl.classList.toggle('hidden', isOpen);
        if (!isOpen) {
          listEl.innerHTML = 'Loading…';
          try {
            const decisions = await decisionsService.getDecisions();
            renderDecisionList(decisions, searchInput?.value || '');
          } catch {
            listEl.innerHTML = '<div class="empty-state">Failed to load decisions</div>';
          }
        }
      });
    }
    if (unlinkBtn) {
      on(unlinkBtn as HTMLElement, 'click', async () => {
        try {
          const updated = await actionsService.update(currentAction.id, { decision_id: null });
          currentAction = updated as Action;
          onUpdate?.(updated as Action);
          refreshDecisionSection();
          toast.success('Decision unlinked');
        } catch (e) {
          toast.error((e as Error).message || 'Failed to unlink');
        }
      });
    }
    if (searchInput && listEl) {
      searchInput.addEventListener('input', () => {
        decisionsService.getDecisions().then((decisions) => renderDecisionList(decisions, searchInput.value));
      });
    }
    document.addEventListener('click', (e) => {
      if (pickerEl && !(e.target as HTMLElement).closest('#action-decision-section') && !pickerEl.classList.contains('hidden')) {
        pickerEl.classList.add('hidden');
      }
    });
  })();

  const editBtn = container.querySelector('#edit-action-btn');
  if (editBtn) {
    on(editBtn as HTMLElement, 'click', () => {
      viewContent.classList.add('hidden');
      editForm.classList.remove('hidden');
    });
  }

  const cancelEditBtn = container.querySelector('#action-cancel-edit-btn');
  if (cancelEditBtn) {
    on(cancelEditBtn as HTMLElement, 'click', () => {
      editForm.classList.add('hidden');
      viewContent.classList.remove('hidden');
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
          assigneePickerDropdown.classList.add('hidden');
        });
      });
    };
    on(assigneePickerTrigger as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const isOpen = !assigneePickerDropdown.classList.contains('hidden');
      assigneePickerDropdown.classList.toggle('hidden', isOpen);
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
      if (!target.closest('.action-assignee-picker-wrap') && !assigneePickerDropdown?.classList.contains('hidden')) {
        assigneePickerDropdown.classList.add('hidden');
      }
    });
  }

  const requesterPickerTrigger = container.querySelector('#action-requester-picker-trigger');
  const requesterPickerDropdown = container.querySelector('#action-requester-picker-dropdown') as HTMLElement;
  const requesterPickerValue = container.querySelector('#action-requester-picker-value');
  const requesterContactIdInput = container.querySelector('#action-edit-requester-contact-id') as HTMLInputElement;
  const requesterNameInput = container.querySelector('#action-edit-requester-name') as HTMLInputElement;
  const requesterPickerList = container.querySelector('#action-requester-picker-list') as HTMLElement;
  const requesterPickerSearch = container.querySelector('#action-requester-picker-search') as HTMLInputElement;
  if (requesterPickerTrigger && requesterPickerDropdown && requesterPickerList && requesterContactIdInput && requesterNameInput) {
    let requesterContacts: Contact[] = [];
    const renderRequesterPickerList = (filter = '') => {
      const filtered = filter
        ? requesterContacts.filter(
            (c) =>
              (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
              (c.role || '').toLowerCase().includes(filter.toLowerCase())
          )
        : requesterContacts;
      if (requesterContacts.length === 0) {
        requesterPickerList.innerHTML = '<div class="empty-state">Loading contacts...</div>';
        return;
      }
      requesterPickerList.innerHTML =
        '<div class="action-assignee-card-picker" data-contact-id="" data-contact-name=""><div class="action-assignee-card-info"><div class="action-assignee-card-name text-muted">No requester</div></div></div>' +
        filtered
          .map((c) => {
            const photoUrl = (c as { photoUrl?: string }).photoUrl || (c as { avatarUrl?: string }).avatarUrl;
            return `
            <div class="action-assignee-card-picker" data-contact-id="${escapeHtml(c.id)}" data-contact-name="${escapeHtml(c.name || '')}">
              <div class="action-assignee-card-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.innerHTML='${getInitials(c.name || '')}'">` : getInitials(c.name || '')}</div>
              <div class="action-assignee-card-info">
                <div class="action-assignee-card-name">${escapeHtml(c.name || '')}</div>
                ${c.role ? `<div class="action-assignee-card-role">${escapeHtml(c.role)}</div>` : ''}
              </div>
            </div>
          `;
          })
          .join('');
      requesterPickerList.querySelectorAll('.action-assignee-card-picker').forEach((card) => {
        on(card as HTMLElement, 'click', () => {
          const id = card.getAttribute('data-contact-id') || '';
          const name = card.getAttribute('data-contact-name') || '';
          requesterContactIdInput.value = id;
          requesterNameInput.value = name;
          if (requesterPickerValue) requesterPickerValue.innerHTML = name ? escapeHtml(name) : '<span class="text-muted">Select requester...</span>';
          requesterPickerDropdown.classList.add('hidden');
        });
      });
    };
    on(requesterPickerTrigger as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const isOpen = !requesterPickerDropdown.classList.contains('hidden');
      requesterPickerDropdown.classList.toggle('hidden', isOpen);
      if (!isOpen && requesterContacts.length === 0) {
        requesterPickerList.innerHTML = '<div class="empty-state">Loading...</div>';
        try {
          const res = await contactsService.getAll();
          requesterContacts = res?.contacts || [];
          renderRequesterPickerList(requesterPickerSearch?.value || '');
        } catch {
          requesterPickerList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
        }
      } else if (!isOpen) renderRequesterPickerList(requesterPickerSearch?.value || '');
    });
    if (requesterPickerSearch) {
      requesterPickerSearch.addEventListener('input', () => renderRequesterPickerList(requesterPickerSearch.value));
    }
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-requester-picker-wrap') && !requesterPickerDropdown?.classList.contains('hidden')) {
        requesterPickerDropdown.classList.add('hidden');
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
      editSuggestionsPanel.classList.remove('hidden');
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
              editSuggestionsPanel.classList.add('hidden');
              toast.success(`Assignee set to ${name}`);
            });
          });
        }
        const hideBtn = editSuggestionsPanel.querySelector('#action-edit-hide-suggest-btn');
        if (hideBtn) on(hideBtn as HTMLElement, 'click', () => { editSuggestionsPanel.classList.add('hidden'); });
      } catch {
        editSuggestionsPanel.innerHTML = '<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="action-edit-hide-suggest-btn">Close</button></div>';
        const h = editSuggestionsPanel.querySelector('#action-edit-hide-suggest-btn');
        if (h) on(h as HTMLElement, 'click', () => { editSuggestionsPanel.classList.add('hidden'); });
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
      const requesterContactIdEl = container.querySelector('#action-edit-requester-contact-id') as HTMLInputElement;
      const requesterNameEl = container.querySelector('#action-edit-requester-name') as HTMLInputElement;
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
          requested_by_contact_id: requesterContactIdEl?.value?.trim() || undefined,
          requested_by: requesterNameEl?.value?.trim() || undefined,
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
      suggestionsPanel.classList.remove('hidden');
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
                suggestionsPanel.classList.add('hidden');
              } catch {
                toast.error('Failed to assign');
              }
            });
          });
        }
        const hideBtn = suggestionsPanel.querySelector('#action-hide-suggest-btn');
        if (hideBtn) on(hideBtn as HTMLElement, 'click', () => { suggestionsPanel.classList.add('hidden'); });
      } catch {
        suggestionsPanel.innerHTML = '<div class="suggestions-error">Failed to get suggestions. <button type="button" class="btn-link" id="action-hide-suggest-btn">Close</button></div>';
        const h = suggestionsPanel.querySelector('#action-hide-suggest-btn');
        if (h) on(h as HTMLElement, 'click', () => { suggestionsPanel.classList.add('hidden'); });
      } finally {
        (aiSuggestBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  const timelineEl = container.querySelector('#timeline-content');
  if (timelineEl) renderTimeline(timelineEl as HTMLElement);
  bindDodToggles();

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
          if (actionContactPicker) actionContactPicker.classList.add('hidden');
          onUpdate?.(updated);
        } catch {
          toast.error('Failed to save assignment');
        }
      });
    });
  };

  const showActionPicker = () => {
    if (!actionContactPicker) return;
    actionContactPicker.classList.toggle('hidden');
    if (!actionContactPicker.classList.contains('hidden') && viewContacts.length === 0) {
      contactsService.getAll().then((res) => {
        viewContacts = res?.contacts || [];
        renderActionContactGrid(actionContactSearch?.value || '');
      }).catch(() => {
        if (actionContactList) actionContactList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
      });
    } else if (!actionContactPicker.classList.contains('hidden')) {
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

  function findContactByRequester(contacts: Contact[], action: Action): Contact | undefined {
    if (!contacts.length) return undefined;
    if (action.requested_by_contact_id) {
      const byId = contacts.find((c) => String(c.id) === String(action.requested_by_contact_id));
      if (byId) return byId;
    }
    const name = (action.requested_by || '').trim();
    if (!name) return undefined;
    const n = name.toLowerCase();
    const byExact = contacts.find((c) => (c.name || '').trim().toLowerCase() === n);
    if (byExact) return byExact;
    const byPartial = contacts.find((c) => (c.name || '').trim().toLowerCase().includes(n) || n.includes((c.name || '').trim().toLowerCase()));
    return byPartial;
  }

  // Load contacts to show assigned role/avatar and requester card
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
    const requesterDisplay = container.querySelector('#action-requester-display') as HTMLElement;
    if (requesterDisplay && (action.requested_by || action.requested_by_contact_id)) {
      const requesterContact = findContactByRequester(viewContacts, action);
      if (requesterContact) {
        const photoUrl = getContactPhotoUrl(requesterContact);
        const name = requesterContact.name || action.requested_by || '—';
        requesterDisplay.innerHTML = `
          <p class="requested-by-label">Requested by</p>
          <div class="assigned-contact-display requester-contact-card">
            <div class="contact-avatar-lg">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" onerror="this.parentElement.textContent='${getInitials(name)}'">` : getInitials(name)}</div>
            <div class="contact-details">
              <div class="contact-name-lg">${escapeHtml(name)}</div>
              ${requesterContact.role ? `<div class="contact-role-sm">${escapeHtml(requesterContact.role)}</div>` : ''}
            </div>
          </div>
        `;
      }
    }
  }).catch(() => {});

  return container;
}
