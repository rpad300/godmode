/**
 * Member Permissions Modal - SOTA Design
 * Edit granular permissions for a project member
 */

import { on } from '@lib/dom';
import { createModal, openModal, closeModal } from '@components/Modal';
import { http } from '@services/api';
import { toast } from '@services/toast';

const MODAL_ID = 'member-permissions-modal';

interface MemberPermissionsProps {
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  currentRole: string;
  currentPermissions?: string[];
  onSave?: () => void;
}

// Permission definitions organized by category
const PERMISSION_CATEGORIES = [
  {
    id: 'view',
    name: 'View',
    icon: '👁️',
    color: '#3b82f6',
    permissions: [
      { id: 'view:dashboard', name: 'Dashboard', desc: 'View project dashboard and stats' },
      { id: 'view:chat', name: 'AI Chat', desc: 'Use the AI assistant' },
      { id: 'view:sot', name: 'Source of Truth', desc: 'View decisions, risks, actions, questions' },
      { id: 'view:contacts', name: 'Contacts', desc: 'View project contacts' },
      { id: 'view:documents', name: 'Documents', desc: 'View uploaded documents' },
      { id: 'view:emails', name: 'Emails', desc: 'View email history' },
      { id: 'view:team', name: 'Team', desc: 'View team members' },
    ],
  },
  {
    id: 'comment',
    name: 'Comment',
    icon: '💬',
    color: '#8b5cf6',
    permissions: [
      { id: 'comment:sot', name: 'Comment on Items', desc: 'Add comments to decisions, risks, etc.' },
      { id: 'comment:documents', name: 'Comment on Docs', desc: 'Add comments to documents' },
    ],
  },
  {
    id: 'edit',
    name: 'Edit',
    icon: '✏️',
    color: '#10b981',
    permissions: [
      { id: 'edit:questions', name: 'Questions', desc: 'Create and edit questions' },
      { id: 'edit:risks', name: 'Risks', desc: 'Create and edit risks' },
      { id: 'edit:actions', name: 'Actions', desc: 'Create and edit actions' },
      { id: 'edit:decisions', name: 'Decisions', desc: 'Create and edit decisions' },
      { id: 'edit:contacts', name: 'Contacts', desc: 'Create and edit contacts' },
      { id: 'edit:documents', name: 'Documents', desc: 'Upload and edit documents' },
    ],
  },
  {
    id: 'manage',
    name: 'Manage',
    icon: '⚙️',
    color: '#f59e0b',
    permissions: [
      { id: 'manage:team', name: 'Team', desc: 'Invite and remove team members' },
      { id: 'manage:roles', name: 'Roles', desc: 'Create and assign roles' },
      { id: 'manage:settings', name: 'Settings', desc: 'Change project settings' },
      { id: 'manage:integrations', name: 'Integrations', desc: 'Configure integrations' },
    ],
  },
  {
    id: 'delete',
    name: 'Delete',
    icon: '🗑️',
    color: '#ef4444',
    permissions: [
      { id: 'delete:data', name: 'Delete Data', desc: 'Permanently delete items' },
      { id: 'export:data', name: 'Export Data', desc: 'Export project data' },
    ],
  },
];

// Default permission sets for each role
const ROLE_DEFAULTS: Record<string, string[]> = {
  viewer: [
    'view:dashboard', 'view:chat', 'view:sot', 'view:contacts', 'view:documents', 'view:emails', 'view:team',
  ],
  editor: [
    'view:dashboard', 'view:chat', 'view:sot', 'view:contacts', 'view:documents', 'view:emails', 'view:team',
    'comment:sot', 'comment:documents',
    'edit:questions', 'edit:risks', 'edit:actions', 'edit:decisions', 'edit:contacts', 'edit:documents',
  ],
  admin: [
    'view:dashboard', 'view:chat', 'view:sot', 'view:contacts', 'view:documents', 'view:emails', 'view:team',
    'comment:sot', 'comment:documents',
    'edit:questions', 'edit:risks', 'edit:actions', 'edit:decisions', 'edit:contacts', 'edit:documents',
    'manage:team', 'manage:roles', 'manage:settings', 'manage:integrations',
    'delete:data', 'export:data',
  ],
  owner: [
    'view:dashboard', 'view:chat', 'view:sot', 'view:contacts', 'view:documents', 'view:emails', 'view:team',
    'comment:sot', 'comment:documents',
    'edit:questions', 'edit:risks', 'edit:actions', 'edit:decisions', 'edit:contacts', 'edit:documents',
    'manage:team', 'manage:roles', 'manage:settings', 'manage:integrations',
    'delete:data', 'export:data',
  ],
};

/**
 * Show member permissions modal
 */
export function showMemberPermissionsModal(props: MemberPermissionsProps): void {
  const { projectId, userId, userName, userEmail, avatarUrl, currentRole, onSave } = props;

  // Use current permissions or defaults for role
  let selectedPermissions = new Set(props.currentPermissions || ROLE_DEFAULTS[currentRole] || []);

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = document.createElement('div');
  content.className = 'member-permissions-content';

  content.innerHTML = `
    <style>
      .member-permissions-content {
        padding: 0;
      }
      
      .member-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        background: linear-gradient(135deg, rgba(225,29,72,0.08) 0%, rgba(225,29,72,0.03) 100%);
        border-bottom: 1px solid var(--border-color);
      }
      
      .member-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 20px;
        overflow: hidden;
      }
      
      .member-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .member-info h4 {
        margin: 0 0 4px;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .member-info p {
        margin: 0;
        font-size: 13px;
        color: var(--text-secondary);
      }
      
      .role-selector {
        margin-left: auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      
      .role-selector label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .role-selector select {
        padding: 8px 32px 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        background: var(--bg-primary);
        color: var(--text-primary);
        cursor: pointer;
      }
      
      .permissions-body {
        padding: 24px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .permission-category {
        margin-bottom: 20px;
      }
      
      .permission-category:last-child {
        margin-bottom: 0;
      }
      
      .category-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
      }
      
      .category-icon {
        font-size: 16px;
      }
      
      .category-name {
        font-weight: 600;
        color: var(--text-primary);
        flex: 1;
      }
      
      .category-toggle {
        font-size: 11px;
        padding: 4px 10px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.15s;
      }
      
      .category-toggle:hover {
        background: var(--bg-secondary);
        border-color: #e11d48;
        color: #e11d48;
      }
      
      .permission-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
      }
      
      .permission-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        background: var(--bg-secondary);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s;
        border: 1px solid transparent;
      }
      
      .permission-item:hover {
        background: var(--bg-tertiary);
      }
      
      .permission-item.selected {
        background: linear-gradient(135deg, rgba(225,29,72,0.1) 0%, rgba(225,29,72,0.05) 100%);
        border-color: rgba(225,29,72,0.3);
      }
      
      .permission-item input {
        margin-top: 2px;
        accent-color: #e11d48;
        width: 16px;
        height: 16px;
      }
      
      .permission-info {
        flex: 1;
        min-width: 0;
      }
      
      .permission-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .permission-desc {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      
      .modal-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      
      .btn {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      
      .btn-secondary {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      
      .btn-secondary:hover {
        background: var(--bg-tertiary);
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
        color: white;
        box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      }
      
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);
      }
    </style>
    
    <div class="member-header">
      <div class="member-avatar">
        ${avatarUrl
      ? `<img src="${avatarUrl}" alt="">`
      : getInitials(userName || userEmail)}
      </div>
      <div class="member-info">
        <h4>${escapeHtml(userName || userEmail)}</h4>
        <p>${escapeHtml(userEmail)}</p>
      </div>
      <div class="role-selector">
        <label>Base Role</label>
        <select id="base-role">
          <option value="viewer" ${currentRole === 'viewer' ? 'selected' : ''}>Viewer</option>
          <option value="editor" ${currentRole === 'editor' ? 'selected' : ''}>Editor</option>
          <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="owner" ${currentRole === 'owner' ? 'selected' : ''}>Owner</option>
        </select>
      </div>
    </div>
    
    <div class="permissions-body">
      ${PERMISSION_CATEGORIES.map(cat => `
        <div class="permission-category" data-category="${cat.id}">
          <div class="category-header">
            <span class="category-icon">${cat.icon}</span>
            <span class="category-name">${cat.name}</span>
            <button type="button" class="category-toggle" data-action="toggle">Toggle All</button>
          </div>
          <div class="permission-grid">
            ${cat.permissions.map(p => `
              <label class="permission-item${selectedPermissions.has(p.id) ? ' selected' : ''}">
                <input type="checkbox" name="permission" value="${p.id}" ${selectedPermissions.has(p.id) ? 'checked' : ''}>
                <div class="permission-info">
                  <div class="permission-name">${p.name}</div>
                  <div class="permission-desc">${p.desc}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" id="btn-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="btn-save">Save Permissions</button>
    </div>
  `;

  // Bind events
  setTimeout(() => {
    // Base role change - apply defaults
    const roleSelect = content.querySelector('#base-role') as HTMLSelectElement;
    if (roleSelect) {
      on(roleSelect, 'change', () => {
        const role = roleSelect.value;
        const defaults = ROLE_DEFAULTS[role] || [];
        selectedPermissions = new Set(defaults);
        updateCheckboxes(content, selectedPermissions);
      });
    }

    // Permission checkbox changes
    content.querySelectorAll('input[name="permission"]').forEach(checkbox => {
      on(checkbox as HTMLElement, 'change', () => {
        const value = (checkbox as HTMLInputElement).value;
        const checked = (checkbox as HTMLInputElement).checked;

        if (checked) {
          selectedPermissions.add(value);
        } else {
          selectedPermissions.delete(value);
        }

        updateItemStyles(content);
      });
    });

    // Category toggle buttons
    content.querySelectorAll('.category-toggle').forEach(btn => {
      on(btn as HTMLElement, 'click', () => {
        const category = btn.closest('.permission-category');
        if (!category) return;

        const checkboxes = category.querySelectorAll('input[name="permission"]');
        const allChecked = Array.from(checkboxes).every(cb => (cb as HTMLInputElement).checked);

        checkboxes.forEach(cb => {
          const input = cb as HTMLInputElement;
          input.checked = !allChecked;
          if (!allChecked) {
            selectedPermissions.add(input.value);
          } else {
            selectedPermissions.delete(input.value);
          }
        });

        updateItemStyles(content);
      });
    });

    // Cancel button
    const cancelBtn = content.querySelector('#btn-cancel');
    if (cancelBtn) {
      on(cancelBtn as HTMLElement, 'click', () => closeModal(MODAL_ID));
    }

    // Save button
    const saveBtn = content.querySelector('#btn-save');
    if (saveBtn) {
      on(saveBtn as HTMLElement, 'click', async () => {
        const role = roleSelect?.value || currentRole;
        const permissions = Array.from(selectedPermissions);

        (saveBtn as HTMLButtonElement).disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          await http.put(`/api/projects/${projectId}/members/${userId}/permissions`, {
            role,
            permissions,
          });

          toast.success('Permissions updated');
          closeModal(MODAL_ID);
          onSave?.();
        } catch (error) {
          toast.error('Failed to update permissions');
          (saveBtn as HTMLButtonElement).disabled = false;
          saveBtn.textContent = 'Save Permissions';
        }
      });
    }
  }, 0);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Member Permissions',
    content,
    size: 'lg',
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Update checkboxes from selected set
 */
function updateCheckboxes(container: HTMLElement, selected: Set<string>): void {
  container.querySelectorAll('input[name="permission"]').forEach(cb => {
    const input = cb as HTMLInputElement;
    input.checked = selected.has(input.value);
  });
  updateItemStyles(container);
}

/**
 * Update item styles based on selection
 */
function updateItemStyles(container: HTMLElement): void {
  container.querySelectorAll('.permission-item').forEach(item => {
    const checkbox = item.querySelector('input[name="permission"]') as HTMLInputElement;
    item.classList.toggle('selected', checkbox?.checked || false);
  });
}

/**
 * Get initials
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showMemberPermissionsModal;
