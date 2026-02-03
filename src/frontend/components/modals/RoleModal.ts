/**
 * Role Modal Component
 * Manage user roles and permissions
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { http } from '../../services/api';
import { toast } from '../../services/toast';

const MODAL_ID = 'role-modal';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  color?: string;
  isDefault?: boolean;
}

export interface RoleModalProps {
  mode: 'view' | 'edit' | 'create';
  role?: Role;
  availablePermissions?: string[];
  onSave?: (role: Role) => void;
  onDelete?: (roleId: string) => void;
}

const defaultPermissions = [
  'view:dashboard',
  'view:chat',
  'view:sot',
  'view:contacts',
  'edit:questions',
  'edit:risks',
  'edit:actions',
  'edit:decisions',
  'edit:contacts',
  'manage:team',
  'manage:settings',
  'manage:roles',
  'delete:data',
  'export:data',
];

/**
 * Show role modal
 */
export function showRoleModal(props: RoleModalProps): void {
  const { mode, role, availablePermissions = defaultPermissions, onSave, onDelete } = props;
  const isEdit = mode === 'edit' && role?.id;
  const isView = mode === 'view';

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'role-modal-content' });

  if (isView && role) {
    content.innerHTML = `
      <div class="role-view">
        <div class="role-header-info">
          <div class="role-color-badge" style="background: ${role.color || '#e94560'}"></div>
          <div>
            <h3>${escapeHtml(role.name)}</h3>
            ${role.description ? `<p class="text-muted">${escapeHtml(role.description)}</p>` : ''}
          </div>
        </div>
        
        <div class="role-permissions">
          <h4>Permissions (${role.permissions.length})</h4>
          <div class="permissions-list">
            ${role.permissions.map(p => `
              <span class="permission-tag">${formatPermission(p)}</span>
            `).join('')}
          </div>
        </div>
        
        ${role.isDefault ? '<p class="text-muted"><em>This is a system role and cannot be modified.</em></p>' : ''}
      </div>
    `;
  } else {
    const rolePermissions = role?.permissions || [];
    
    content.innerHTML = `
      <form id="role-form" class="role-form">
        <div class="form-row">
          <div class="form-group" style="flex: 1">
            <label for="role-name">Role Name *</label>
            <input type="text" id="role-name" required 
                   value="${role?.name || ''}" 
                   placeholder="e.g., Project Manager">
          </div>
          <div class="form-group" style="width: 80px">
            <label for="role-color">Color</label>
            <input type="color" id="role-color" 
                   value="${role?.color || '#e94560'}">
          </div>
        </div>
        
        <div class="form-group">
          <label for="role-description">Description</label>
          <textarea id="role-description" rows="2" 
                    placeholder="Brief description of this role...">${role?.description || ''}</textarea>
        </div>
        
        <div class="form-group">
          <label>Permissions</label>
          <div class="permissions-grid">
            ${availablePermissions.map(p => `
              <label class="permission-checkbox">
                <input type="checkbox" name="permissions" value="${p}" 
                       ${rolePermissions.includes(p) ? 'checked' : ''}>
                <span>${formatPermission(p)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        
        <div class="form-group">
          <button type="button" class="btn btn-sm btn-secondary" data-action="select-all">Select All</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="select-none">Select None</button>
        </div>
      </form>
    `;

    // Bind select all/none
    setTimeout(() => {
      const selectAll = content.querySelector('[data-action="select-all"]');
      const selectNone = content.querySelector('[data-action="select-none"]');

      if (selectAll) {
        on(selectAll as HTMLElement, 'click', () => {
          content.querySelectorAll('[name="permissions"]').forEach(cb => {
            (cb as HTMLInputElement).checked = true;
          });
        });
      }

      if (selectNone) {
        on(selectNone as HTMLElement, 'click', () => {
          content.querySelectorAll('[name="permissions"]').forEach(cb => {
            (cb as HTMLInputElement).checked = false;
          });
        });
      }
    }, 0);
  }

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  if (isView) {
    const editBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Edit',
    });

    const closeBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Close',
    });

    on(closeBtn, 'click', () => closeModal(MODAL_ID));

    if (!role?.isDefault) {
      on(editBtn, 'click', () => {
        closeModal(MODAL_ID);
        showRoleModal({ ...props, mode: 'edit' });
      });
      footer.appendChild(editBtn);
    }

    footer.appendChild(closeBtn);
  } else {
    const cancelBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Cancel',
    });

    const saveBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: isEdit ? 'Save Changes' : 'Create Role',
    });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));

    on(saveBtn, 'click', async () => {
      const form = content.querySelector('#role-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const name = (content.querySelector('#role-name') as HTMLInputElement).value.trim();
      const description = (content.querySelector('#role-description') as HTMLTextAreaElement).value.trim();
      const color = (content.querySelector('#role-color') as HTMLInputElement).value;
      
      const permissions: string[] = [];
      content.querySelectorAll('[name="permissions"]:checked').forEach(cb => {
        permissions.push((cb as HTMLInputElement).value);
      });

      const roleData: Role = {
        id: role?.id || `role-${Date.now()}`,
        name,
        description: description || undefined,
        color,
        permissions,
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        if (isEdit) {
          await http.put(`/api/roles/${role!.id}`, roleData);
          toast.success('Role updated');
        } else {
          const response = await http.post<{ id: string }>('/api/roles', roleData);
          roleData.id = response.data.id;
          toast.success('Role created');
        }

        onSave?.(roleData);
        closeModal(MODAL_ID);
      } catch {
        // Error shown by API service
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Role';
      }
    });

    if (isEdit && !role?.isDefault) {
      const deleteBtn = createElement('button', {
        className: 'btn btn-danger',
        textContent: 'Delete',
      });

      on(deleteBtn, 'click', async () => {
        const { confirm } = await import('../Modal');
        const confirmed = await confirm(
          `Are you sure you want to delete the "${role!.name}" role?`,
          {
            title: 'Delete Role',
            confirmText: 'Delete',
            confirmClass: 'btn-danger',
          }
        );

        if (confirmed) {
          try {
            await http.delete(`/api/roles/${role!.id}`);
            toast.success('Role deleted');
            onDelete?.(role!.id);
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
    title: isView ? 'Role Details' : (isEdit ? 'Edit Role' : 'New Role'),
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Format permission for display
 */
function formatPermission(permission: string): string {
  return permission
    .replace(':', ': ')
    .split(/[_:]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showRoleModal;
