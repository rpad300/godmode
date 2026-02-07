/**
 * Action Modal Component
 * Create, view and edit actions/tasks
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { Action } from '../../services/actions';
import { actionsService } from '../../services/actions';
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
          <div class="detail-item"><strong>Created:</strong> ${formatRelativeTime(createdText(action))}</div>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <form id="action-form" class="action-form">
        <div class="form-group">
          <label for="action-task">Task *</label>
          <textarea id="action-task" rows="2" required 
                    placeholder="What needs to be done?">${escapeHtml(taskText(action))}</textarea>
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
              <option value="in_progress" ${action?.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
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

      const contentVal = getValue('action-task');
      const payload = {
        content: contentVal,
        status: getValue('action-status') as Action['status'],
        priority: getValue('action-priority') as Action['priority'],
        assignee: getValue('action-assignee') || undefined,
        due_date: getValue('action-due') || undefined,
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
