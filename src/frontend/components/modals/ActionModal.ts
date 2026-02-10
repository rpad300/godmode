/**
 * Action Modal Component
 * Create, view and edit actions/tasks
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { Action } from '../../services/actions';
import { actionsService } from '../../services/actions';
import { getSprints } from '../../services/sprints';
import { contactsService } from '../../services/contacts';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

const MODAL_ID = 'action-modal';

export interface ActionModalProps {
  mode: 'view' | 'edit' | 'create';
  action?: Action;
  onSave?: (action: Action) => void;
  onDelete?: (actionId: string) => void;
}

function taskText(a: Action | undefined): string {
  return (a?.content ?? a?.task ?? '') as string;
}
function dueDateText(a: Action | undefined): string {
  return (a?.due_date ?? (a as { dueDate?: string })?.dueDate ?? '') as string;
}
function createdText(a: Action | undefined): string {
  return (a?.created_at ?? (a as { createdAt?: string })?.createdAt ?? '') as string;
}
function parentStoryRef(a: Action | undefined): string {
  return (a?.parent_story_ref ?? '') as string;
}
function sizeEstimate(a: Action | undefined): string {
  return (a?.size_estimate ?? '') as string;
}
function descriptionText(a: Action | undefined): string {
  return (a?.description ?? '') as string;
}
function dodList(a: Action | undefined): string[] {
  return Array.isArray(a?.definition_of_done) ? a.definition_of_done : [];
}
function acList(a: Action | undefined): string[] {
  return Array.isArray(a?.acceptance_criteria) ? a.acceptance_criteria : [];
}

/**
 * Show action modal
 */
export function showActionModal(props: ActionModalProps): void {
  const { mode, action, onSave, onDelete } = props;
  const isEdit = mode === 'edit' && action?.id;
  const isView = mode === 'view';

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'action-modal-content' });

  if (isView && action) {
    const due = dueDateText(action);
    const isOverdue = due && new Date(due) < new Date() && action.status !== 'completed';
    const parent = parentStoryRef(action);
    const size = sizeEstimate(action);
    const desc = descriptionText(action);
    const dod = dodList(action);
    const ac = acList(action);

    content.innerHTML = `
      <div class="action-view">
        <div class="action-meta">
          <span class="priority-badge priority-${action.priority || 'medium'}">${action.priority || 'medium'}</span>
          <span class="status-badge ${action.status}">${action.status.replace('_', ' ')}</span>
          ${isOverdue ? '<span class="status-badge overdue">Overdue</span>' : ''}
        </div>
        
        <div class="action-task-large ${action.status === 'completed' ? 'completed' : ''}">
          ${escapeHtml(taskText(action))}
        </div>
        
        <div class="action-details">
          ${action.assignee ? `<div class="detail-item"><strong>Assignee:</strong> ${escapeHtml(action.assignee)}</div>` : ''}
          ${due ? `<div class="detail-item"><strong>Due Date:</strong> ${due}</div>` : ''}
          ${size ? `<div class="detail-item"><strong>Effort:</strong> ${escapeHtml(size)}</div>` : ''}
          ${parent ? `<div class="detail-item"><strong>Parent Story:</strong> ${escapeHtml(parent)}</div>` : ''}
          ${action.generation_source ? `<div class="detail-item"><strong>Source:</strong> ${escapeHtml(action.generation_source)}</div>` : ''}
          ${(action.sprint_id || action.sprint_name) ? `<div class="detail-item"><strong>Sprint:</strong> ${escapeHtml((action.sprint_name as string) || action.sprint_id || '')}</div>` : ''}
          ${action.task_points != null ? `<div class="detail-item"><strong>Task points:</strong> ${action.task_points}</div>` : ''}
          ${(action.requested_by || (action as { requested_by_contact_id?: string }).requested_by_contact_id) ? `<div class="detail-item" id="action-view-requester-wrap"><strong>Requested by:</strong> <span id="action-view-requester-card">${escapeHtml((action.requested_by as string) || '')}</span></div>` : ''}
          <div class="detail-item"><strong>Created:</strong> ${formatRelativeTime(createdText(action))}</div>
        </div>
        ${desc ? `<div class="action-description"><strong>Description</strong><p>${escapeHtml(desc)}</p></div>` : ''}
        ${dod.length ? `<div class="action-dod"><strong>Definition of Done</strong><ul>${dod.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
        ${ac.length ? `<div class="action-ac"><strong>Acceptance Criteria</strong><ul>${ac.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
      </div>
    `;
  } else {
    const dodStr = dodList(action).join('\n');
    const acStr = acList(action).join('\n');
    content.innerHTML = `
      <form id="action-form" class="action-form">
        <div class="form-group action-generate-block">
          <label>Generate from description (AI, uses Sprint Board rules)</label>
          <textarea id="action-description-draft" rows="2" placeholder="e.g. Add JWT validation to the API">${isEdit && action ? escapeHtml([taskText(action), descriptionText(action)].filter(Boolean).join('\n\n')) : ''}</textarea>
          <div class="action-generate-buttons mt-1">
            <button type="button" class="btn btn-secondary btn-sm" id="action-generate-btn">Generate from description</button>
            ${isEdit && action ? '<button type="button" class="btn btn-outline-secondary btn-sm" id="action-regenerate-ai-btn">Regenerate with AI</button>' : ''}
          </div>
        </div>
        <div class="form-group">
          <label for="action-task">Task (title) *</label>
          <textarea id="action-task" rows="2" required 
                    placeholder="Concrete action e.g. Implementar validação JWT no backend">${escapeHtml(taskText(action))}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="action-parent-story-id">Parent User Story</label>
            <div class="form-row-inline">
              <select id="action-parent-story-id">
                <option value="">— None —</option>
              </select>
              <button type="button" class="btn btn-secondary btn-sm" id="action-new-story-btn">New story</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" id="action-edit-story-btn" title="Edit selected story (title, story points)">Edit story</button>
            </div>
          </div>
          <div class="form-group">
            <label for="action-size">Size (estimate)</label>
            <input type="text" id="action-size" 
                   value="${escapeHtml(sizeEstimate(action))}" 
                   placeholder="e.g. 1 day, 8h (max 8h)">
          </div>
        </div>
        <div class="form-group">
          <label for="action-sprint-id">Sprint</label>
          <select id="action-sprint-id">
            <option value="">— None —</option>
          </select>
        </div>
        <div class="form-group">
          <label for="action-task-points">Task points (optional)</label>
          <input type="number" id="action-task-points" min="0" step="1" 
                 value="${action?.task_points != null ? String(action.task_points) : ''}" 
                 placeholder="e.g. 2">
        </div>
        <div class="form-group">
          <label for="action-depends-on">Depends on (other tasks)</label>
          <select id="action-depends-on" multiple class="form-select-multi">
            <option value="" disabled>Loading...</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="action-description">Description (technical)</label>
          <textarea id="action-description" rows="3" 
                    placeholder="Implementation notes">${escapeHtml(descriptionText(action))}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="action-priority">Priority</label>
            <select id="action-priority">
              <option value="low" ${action?.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${action?.priority === 'medium' || !action ? 'selected' : ''}>Medium</option>
              <option value="high" ${action?.priority === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="action-status">Status</label>
            <select id="action-status">
              <option value="pending" ${action?.status === 'pending' || !action ? 'selected' : ''}>Pending</option>
              <option value="in_progress" ${action?.status === 'in_progress' ? 'selected' : ''}>Active (In Progress)</option>
              <option value="completed" ${action?.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="cancelled" ${action?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="action-assignee">Assignee</label>
            <input type="text" id="action-assignee" 
                   value="${escapeHtml(action?.assignee ?? action?.owner ?? '')}" 
                   placeholder="Who is responsible?">
          </div>
          
          <div class="form-group">
            <label for="action-due">Due Date</label>
            <input type="date" id="action-due" 
                   value="${dueDateText(action)}">
          </div>
        </div>
        
        <div class="form-group action-requester-picker-wrap">
          <label>Requested by (optional)</label>
          <input type="hidden" id="action-requested-by-contact-id" value="${escapeHtml((action?.requested_by_contact_id as string) ?? '')}">
          <input type="hidden" id="action-requested-by" value="${escapeHtml((action?.requested_by as string) ?? '')}">
          <div class="action-assignee-picker-trigger" id="action-modal-requester-trigger" title="Select who requested this task">
            <span class="action-assignee-picker-value" id="action-modal-requester-value">${(action?.requested_by as string) ? escapeHtml(action.requested_by as string) : '<span class="text-muted">Select requester...</span>'}</span>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
          <div id="action-modal-requester-dropdown" class="action-assignee-picker-dropdown hidden">
            <div class="action-assignee-picker-search">
              <input type="text" id="action-modal-requester-search" placeholder="Search contacts..." autocomplete="off">
            </div>
            <div id="action-modal-requester-list" class="action-assignee-picker-list">Loading...</div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="action-dod">Definition of Done (one per line)</label>
          <textarea id="action-dod" rows="3" 
                    placeholder="e.g. Código testado localmente&#10;PR criado e revisto">${escapeHtml(dodStr)}</textarea>
        </div>
        
        <div class="form-group">
          <label for="action-ac">Acceptance Criteria (one per line)</label>
          <textarea id="action-ac" rows="3" 
                    placeholder="e.g. Middleware rejeita tokens inválidos com 401&#10;Testes unitários passam">${escapeHtml(acStr)}</textarea>
        </div>
      </form>
    `;
  }

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  if (isView && action) {
    const editBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Edit',
    });

    const closeBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Close',
    });

    // Quick complete button if not completed
    if (action.status !== 'completed') {
      const completeBtn = createElement('button', {
        className: 'btn btn-success',
        textContent: 'Mark Complete',
      });

      on(completeBtn, 'click', async () => {
        try {
          const updated = await actionsService.update(action.id, { status: 'completed' });
          toast.success('Action completed');
          onSave?.(updated);
          closeModal(MODAL_ID);
        } catch {
          // Error shown by API service
        }
      });

      footer.appendChild(completeBtn);
    }

    on(closeBtn, 'click', () => closeModal(MODAL_ID));
    on(editBtn, 'click', () => {
      closeModal(MODAL_ID);
      showActionModal({ ...props, mode: 'edit' });
    });

    footer.appendChild(closeBtn);
    footer.appendChild(editBtn);
  } else {
    const cancelBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Cancel',
    });

    const saveBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: isEdit ? 'Save Changes' : 'Create Action',
    });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));

    on(saveBtn, 'click', async () => {
      const form = content.querySelector('#action-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const getValue = (id: string) => (content.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value.trim() || '';
      const lines = (id: string) => getValue(id).split(/\n/).map((s: string) => s.trim()).filter(Boolean);

      const contentVal = getValue('action-task');
      const parentStoryIdEl = content.querySelector('#action-parent-story-id') as HTMLSelectElement;
      const dependsOnEl = content.querySelector('#action-depends-on') as HTMLSelectElement;
      const parentStoryId = parentStoryIdEl?.value?.trim() || undefined;
      const dependsOn = dependsOnEl ? Array.from((dependsOnEl as HTMLSelectElement).selectedOptions).map(o => o.value).filter(Boolean) : [];

      const sprintIdEl = content.querySelector('#action-sprint-id') as HTMLSelectElement;
      const sprintId = sprintIdEl?.value?.trim() || undefined;
      const payload = {
        content: contentVal,
        status: getValue('action-status') as Action['status'],
        priority: getValue('action-priority') as Action['priority'],
        assignee: getValue('action-assignee') || undefined,
        due_date: getValue('action-due') || undefined,
        parent_story_id: parentStoryId,
        size_estimate: getValue('action-size') || undefined,
        description: getValue('action-description') || undefined,
        definition_of_done: lines('action-dod'),
        acceptance_criteria: lines('action-ac'),
        depends_on: dependsOn.length ? dependsOn : undefined,
        requested_by: getValue('action-requested-by') || undefined,
        requested_by_contact_id: getValue('action-requested-by-contact-id') || undefined,
        sprint_id: sprintId,
        task_points: (() => {
          const v = getValue('action-task-points');
          if (v === '' || v == null) return undefined;
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 ? n : undefined;
        })(),
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        if (isEdit) {
          const updated = await actionsService.update(action!.id, payload);
          toast.success('Action updated');
          onSave?.(updated);
        } else {
          const created = await actionsService.create(payload);
          toast.success('Action created');
          onSave?.(created);
        }

        closeModal(MODAL_ID);
      } catch {
        // Error shown by API service
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Action';
      }
    });

    if (isEdit) {
      const deleteBtn = createElement('button', {
        className: 'btn btn-danger',
        textContent: 'Delete',
      });

      on(deleteBtn, 'click', async () => {
        const { confirm } = await import('../Modal');
        const confirmed = await confirm(
          'Are you sure you want to delete this action?',
          {
            title: 'Delete Action',
            confirmText: 'Delete',
            confirmClass: 'btn-danger',
          }
        );

        if (confirmed) {
          try {
            await actionsService.delete(action!.id);
            toast.success('Action deleted');
            onDelete?.(String(action!.id));
            closeModal(MODAL_ID);
          } catch {
            // Error shown by API service
          }
        }
      });

      footer.appendChild(deleteBtn);
    }

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
  }

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: isView ? 'Action Details' : (isEdit ? 'Edit Action' : 'New Action'),
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  if (isView && action && (action.requested_by || (action as { requested_by_contact_id?: string }).requested_by_contact_id)) {
    const cardEl = content.querySelector('#action-view-requester-card') as HTMLElement;
    if (cardEl) {
      (async () => {
        try {
          const res = await contactsService.getAll();
          const contacts = (res?.contacts || []) as { id?: string; name?: string; role?: string; photoUrl?: string; avatarUrl?: string }[];
          const cid = (action as { requested_by_contact_id?: string }).requested_by_contact_id;
          const contact = cid
            ? contacts.find((c) => c.id && String(c.id) === String(cid))
            : contacts.find(
                (c) =>
                  (c.name || '').trim().toLowerCase() === (action.requested_by as string)?.trim().toLowerCase() ||
                  (c.name || '').toLowerCase().includes((action.requested_by as string)?.toLowerCase() || '')
              );
          const name = contact?.name ?? (action.requested_by as string) ?? '';
          const role = contact?.role ?? '';
          const photoUrl = contact?.photoUrl || contact?.avatarUrl || null;
          const initials = name ? name.trim().split(/\s+/).map((s) => s[0]).join('').toUpperCase().substring(0, 2) : '?';
          if (contact) {
            cardEl.innerHTML = `
              <div class="action-view-requester-card-inner assignee-chip">
                <div class="assignee-avatar">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" onerror="this.parentElement.innerHTML='${initials}'">` : initials}</div>
                <div class="action-assignee-card-info">
                  <div class="action-assignee-card-name">${escapeHtml(name)}</div>
                  ${role ? `<div class="action-assignee-card-role">${escapeHtml(role)}</div>` : ''}
                </div>
              </div>
            `;
          }
        } catch {
          /* keep text fallback */
        }
      })();
    }
  }

  if (!isView && content) {
    (async () => {
      const stories = await actionsService.getUserStories();
      const parentSelect = content.querySelector('#action-parent-story-id') as HTMLSelectElement;
      if (parentSelect) {
        parentSelect.innerHTML = '<option value="">— None —</option>';
        stories.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.story_points != null ? `${s.title} (${s.story_points} pt)` : s.title;
          if (action?.parent_story_id && String(s.id) === String(action.parent_story_id)) opt.selected = true;
          parentSelect.appendChild(opt);
        });
      }
      const sprints = await getSprints();
      const sprintSelect = content.querySelector('#action-sprint-id') as HTMLSelectElement;
      if (sprintSelect) {
        sprintSelect.innerHTML = '<option value="">— None —</option>';
        sprints.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          if (action?.sprint_id && String(s.id) === String(action.sprint_id)) opt.selected = true;
          sprintSelect.appendChild(opt);
        });
      }
      const actions = await actionsService.getAll();
      const depSelect = content.querySelector('#action-depends-on') as HTMLSelectElement;
      if (depSelect) {
        depSelect.innerHTML = '';
        const currentId = action?.id ? String(action.id) : '';
        actions.filter(a => String(a.id) !== currentId).forEach(a => {
          const opt = document.createElement('option');
          opt.value = String(a.id);
          opt.textContent = ((a.content || a.task) || '').substring(0, 60) + (((a.content || a.task) || '').length > 60 ? '...' : '');
          if (Array.isArray(action?.depends_on) && action.depends_on.includes(String(a.id))) opt.selected = true;
          depSelect.appendChild(opt);
        });
      }
    })();
    const newStoryBtn = content.querySelector('#action-new-story-btn');
    if (newStoryBtn) {
      on(newStoryBtn as HTMLElement, 'click', async () => {
        const title = window.prompt('User story title');
        if (!title?.trim()) return;
        const pointsInput = window.prompt('Story points (optional, number). Leave empty to skip.');
        let story_points: number | undefined;
        if (pointsInput != null && pointsInput.trim() !== '') {
          const n = Number(pointsInput.trim());
          if (Number.isFinite(n) && n >= 0) story_points = n;
        }
        try {
          const story = await actionsService.addUserStory({ title: title.trim(), story_points });
          const parentSelect = content.querySelector('#action-parent-story-id') as HTMLSelectElement;
          if (parentSelect) {
            const opt = document.createElement('option');
            opt.value = story.id;
            opt.textContent = story.story_points != null ? `${story.title} (${story.story_points} pt)` : story.title;
            opt.selected = true;
            parentSelect.appendChild(opt);
          }
          toast.success('User story created');
        } catch (e) {
          toast.error((e as Error).message || 'Failed to create story');
        }
      });
    }
    const editStoryBtn = content.querySelector('#action-edit-story-btn');
    if (editStoryBtn) {
      on(editStoryBtn as HTMLElement, 'click', async () => {
        const parentSelect = content.querySelector('#action-parent-story-id') as HTMLSelectElement;
        const storyId = parentSelect?.value?.trim();
        if (!storyId) {
          toast.error('Select a user story first');
          return;
        }
        try {
          const story = await actionsService.getUserStory(storyId);
          if (!story) {
            toast.error('Story not found');
            return;
          }
          const newTitle = window.prompt('User story title', story.title);
          if (newTitle == null) return;
          const title = newTitle.trim();
          if (!title) {
            toast.error('Title is required');
            return;
          }
          const pointsInput = window.prompt('Story points (optional, number). Leave empty to clear.', story.story_points != null ? String(story.story_points) : '');
          let story_points: number | null | undefined = undefined;
          if (pointsInput != null) {
            if (pointsInput.trim() === '') story_points = null;
            else {
              const n = Number(pointsInput.trim());
              if (Number.isFinite(n) && n >= 0) story_points = n;
            }
          }
          await actionsService.updateUserStory(storyId, { title, ...(story_points !== undefined ? { story_points } : {}) });
          if (parentSelect) {
            const opt = parentSelect.selectedOptions?.[0];
            if (opt) opt.textContent = story_points != null ? `${title} (${story_points} pt)` : title;
          }
          toast.success('User story updated');
        } catch (e) {
          toast.error((e as Error).message || 'Failed to update story');
        }
      });
    }
    const runGenerateFromDraft = async (btn: HTMLButtonElement, btnLabel: string) => {
      const draftEl = content.querySelector('#action-description-draft') as HTMLTextAreaElement;
      const draft = draftEl?.value?.trim() || '';
      if (!draft) {
        toast.error('Enter a short description first');
        return;
      }
      btn.textContent = 'Generating...';
      btn.disabled = true;
      try {
        const parentSelect = content.querySelector('#action-parent-story-id') as HTMLSelectElement;
        const parentRef = parentSelect?.selectedOptions?.[0]?.textContent || '';
        const result = await actionsService.suggestTaskFromDescription({ user_input: draft, parent_story_ref: parentRef || undefined });
        (content.querySelector('#action-task') as HTMLTextAreaElement).value = result.task;
        (content.querySelector('#action-description') as HTMLTextAreaElement).value = result.description;
        (content.querySelector('#action-size') as HTMLInputElement).value = result.size_estimate;
        (content.querySelector('#action-dod') as HTMLTextAreaElement).value = result.definition_of_done.join('\n');
        (content.querySelector('#action-ac') as HTMLTextAreaElement).value = result.acceptance_criteria.join('\n');
        toast.success(btn.id === 'action-regenerate-ai-btn' ? 'Task regenerated with AI' : 'Task generated from description');
      } catch (e) {
        toast.error((e as Error).message || 'Failed to generate');
      } finally {
        btn.disabled = false;
        btn.textContent = btnLabel;
      }
    };
    const genBtn = content.querySelector('#action-generate-btn');
    if (genBtn) {
      on(genBtn as HTMLElement, 'click', () => runGenerateFromDraft(genBtn as HTMLButtonElement, 'Generate from description'));
    }
    const regenBtn = content.querySelector('#action-regenerate-ai-btn');
    if (regenBtn) {
      on(regenBtn as HTMLElement, 'click', () => runGenerateFromDraft(regenBtn as HTMLButtonElement, 'Regenerate with AI'));
    }
    const requesterTrigger = content.querySelector('#action-modal-requester-trigger');
    const requesterDropdown = content.querySelector('#action-modal-requester-dropdown') as HTMLElement;
    const requesterValue = content.querySelector('#action-modal-requester-value');
    const requesterList = content.querySelector('#action-modal-requester-list') as HTMLElement;
    const requesterSearch = content.querySelector('#action-modal-requester-search') as HTMLInputElement;
    const requesterContactIdInput = content.querySelector('#action-requested-by-contact-id') as HTMLInputElement;
    const requesterNameInput = content.querySelector('#action-requested-by') as HTMLInputElement;
    if (requesterTrigger && requesterDropdown && requesterList && requesterContactIdInput && requesterNameInput) {
      let requesterContacts: { id: string; name: string; role?: string }[] = [];
      const escapeHtml = (s: string) => {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
      };
      const getInitials = (name: string) => name.trim().split(/\s+/).map((s) => s[0]).join('').toUpperCase().substring(0, 2);
      const renderRequesterList = (filter = '') => {
        const filtered = filter
          ? requesterContacts.filter(
              (c) =>
                (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
                (c.role || '').toLowerCase().includes(filter.toLowerCase())
            )
          : requesterContacts;
        if (requesterContacts.length === 0) {
          requesterList.innerHTML = '<div class="empty-state">Loading...</div>';
          return;
        }
        requesterList.innerHTML =
          '<div class="action-assignee-card-picker" data-contact-id="" data-contact-name=""><div class="action-assignee-card-info"><div class="action-assignee-card-name text-muted">No requester</div></div></div>' +
          filtered
            .map(
              (c) => `
            <div class="action-assignee-card-picker" data-contact-id="${escapeHtml(c.id)}" data-contact-name="${escapeHtml(c.name || '')}">
              <div class="action-assignee-card-info">
                <div class="action-assignee-card-name">${escapeHtml(c.name || '')}</div>
                ${c.role ? `<div class="action-assignee-card-role">${escapeHtml(c.role)}</div>` : ''}
              </div>
            </div>
          `
            )
            .join('');
        requesterList.querySelectorAll('.action-assignee-card-picker').forEach((card) => {
          on(card as HTMLElement, 'click', () => {
            const id = card.getAttribute('data-contact-id') || '';
            const name = card.getAttribute('data-contact-name') || '';
            requesterContactIdInput.value = id;
            requesterNameInput.value = name;
            if (requesterValue) requesterValue.innerHTML = name ? escapeHtml(name) : '<span class="text-muted">Select requester...</span>';
            requesterDropdown.classList.add('hidden');
          });
        });
      };
      on(requesterTrigger as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const isOpen = !requesterDropdown.classList.contains('hidden');
        requesterDropdown.classList.toggle('hidden', isOpen);
        if (!isOpen && requesterContacts.length === 0) {
          requesterList.innerHTML = '<div class="empty-state">Loading...</div>';
          try {
            const res = await contactsService.getAll();
            requesterContacts = (res?.contacts || []).map((c) => ({ id: c.id, name: c.name || '', role: c.role }));
            renderRequesterList(requesterSearch?.value || '');
          } catch {
            requesterList.innerHTML = '<div class="empty-state">Failed to load contacts</div>';
          }
        } else if (!isOpen) renderRequesterList(requesterSearch?.value || '');
      });
      if (requesterSearch) requesterSearch.addEventListener('input', () => renderRequesterList(requesterSearch.value));
      const closeRequesterDropdown = () => {
        if (requesterDropdown && !requesterDropdown.classList.contains('hidden')) requesterDropdown.classList.add('hidden');
      };
      let removed = false;
      const removeListeners = () => {
        if (removed) return;
        removed = true;
        document.removeEventListener('click', clickHandler);
        document.removeEventListener('keydown', keyHandler);
      };
      const clickHandler = (e: MouseEvent) => {
        const modalEl = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
        if (!modalEl?.classList.contains('open')) {
          removeListeners();
          return;
        }
        const target = e.target as HTMLElement;
        if (!target.closest('.action-requester-picker-wrap')) closeRequesterDropdown();
      };
      const keyHandler = (e: KeyboardEvent) => {
        const modalEl = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
        if (!modalEl?.classList.contains('open')) {
          removeListeners();
          return;
        }
        if (e.key === 'Escape') closeRequesterDropdown();
      };
      document.addEventListener('click', clickHandler);
      document.addEventListener('keydown', keyHandler);
    }
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

export default showActionModal;
