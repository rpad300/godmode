/**
 * Members Panel Component
 * Project members management with invites
 */

import { createElement, on } from '../utils/dom';
import { membersService, ProjectMember } from '../services/notifications';
import { appStore } from '../stores/app';
import { showInviteModal } from './modals/InviteModal';
import { showMemberPermissionsModal } from './modals/MemberPermissionsModal';
import { toast } from '../services/toast';
import { formatRelativeTime } from '../utils/format';

export interface MembersPanelProps {
  projectId?: string;
  onMemberClick?: (member: ProjectMember) => void;
}

/**
 * Create members panel
 */
export function createMembersPanel(props: MembersPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'members-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Team Members</h2>
        <span class="panel-count" id="members-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary btn-sm" id="invite-member-btn">+ Invite</button>
      </div>
    </div>
    <div class="panel-content" id="members-content">
      <div class="loading">Loading members...</div>
    </div>
    <div class="pending-invites" id="pending-invites"></div>
  `;

  // Bind invite button
  const inviteBtn = panel.querySelector('#invite-member-btn');
  if (inviteBtn) {
    on(inviteBtn as HTMLElement, 'click', () => {
      const projectId = props.projectId || appStore.getState().currentProject?.id;
      if (!projectId) {
        toast.error('No project selected');
        return;
      }
      showInviteModal({
        projectId,
        onInvite: () => loadPendingInvites(panel, projectId),
      });
    });
  }

  // Initial load
  const projectId = props.projectId || appStore.getState().currentProject?.id;
  if (projectId) {
    loadMembers(panel, projectId, props);
    loadPendingInvites(panel, projectId);
  }

  return panel;
}

/**
 * Load members
 */
async function loadMembers(
  panel: HTMLElement, 
  projectId: string,
  props: MembersPanelProps
): Promise<void> {
  const content = panel.querySelector('#members-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const members = await membersService.getAll(projectId);
    renderMembers(content, members, projectId, props);
    updateCount(panel, members.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load members</div>';
  }
}

/**
 * Render members
 */
function renderMembers(
  container: HTMLElement, 
  members: ProjectMember[],
  projectId: string,
  props: MembersPanelProps
): void {
  if (members.length === 0) {
    container.innerHTML = '<div class="empty">No team members</div>';
    return;
  }

  const currentUser = appStore.getState().currentUser;

  container.innerHTML = `
    <div class="members-list">
      ${members.map(member => `
        <div class="member-card" data-id="${member.user_id}">
          <div class="member-avatar">
            ${member.avatar_url 
              ? `<img src="${member.avatar_url}" alt="">`
              : `<span>${getInitials(member.name || member.email)}</span>`
            }
          </div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(member.name || member.email)}</div>
            <div class="member-email">${escapeHtml(member.email)}</div>
          </div>
          <div class="member-role">
            <select class="role-select" data-user-id="${member.user_id}" ${member.user_id === currentUser?.id ? 'disabled' : ''}>
              <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
              <option value="editor" ${member.role === 'editor' ? 'selected' : ''}>Editor</option>
              <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="owner" ${member.role === 'owner' ? 'selected' : ''}>Owner</option>
            </select>
          </div>
          <button class="btn-icon permissions-btn permissions-btn-icon" data-user-id="${member.user_id}" title="Permissions">🔐</button>
          ${member.user_id !== currentUser?.id ? `
            <button class="btn-icon remove-member-btn" data-user-id="${member.user_id}" title="Remove">×</button>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  // Bind role change
  container.querySelectorAll('.role-select').forEach(select => {
    on(select as HTMLElement, 'change', async () => {
      const userId = select.getAttribute('data-user-id');
      const role = (select as HTMLSelectElement).value as 'admin' | 'editor' | 'viewer';
      if (!userId) return;

      try {
        await membersService.updateRole(userId, role, projectId);
        toast.success('Role updated');
      } catch {
        toast.error('Failed to update role');
        loadMembers(container.closest('.members-panel') as HTMLElement, projectId, props);
      }
    });
  });

  // Bind remove buttons
  container.querySelectorAll('.remove-member-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const userId = btn.getAttribute('data-user-id');
      if (!userId || !confirm('Remove this member from the project?')) return;

      try {
        await membersService.remove(projectId, userId);
        toast.success('Member removed');
        loadMembers(container.closest('.members-panel') as HTMLElement, projectId, props);
      } catch {
        toast.error('Failed to remove member');
      }
    });
  });

  // Bind permissions buttons
  container.querySelectorAll('.permissions-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const userId = btn.getAttribute('data-user-id');
      const member = members.find(m => m.user_id === userId);
      if (!member) return;

      showMemberPermissionsModal({
        projectId,
        userId: member.user_id,
        userName: member.name || '',
        userEmail: member.email,
        avatarUrl: member.avatar_url,
        currentRole: member.role,
        currentPermissions: (member as { permissions?: string[] }).permissions,
        onSave: () => {
          loadMembers(container.closest('.members-panel') as HTMLElement, projectId, props);
        },
      });
    });
  });

  // Bind member clicks
  container.querySelectorAll('.member-card').forEach(card => {
    on(card as HTMLElement, 'click', (e) => {
      if ((e.target as HTMLElement).closest('.role-select, .remove-member-btn')) return;
      
      const userId = card.getAttribute('data-id');
      const member = members.find(m => m.user_id === userId);
      if (member && props.onMemberClick) {
        props.onMemberClick(member);
      }
    });
  });
}

/**
 * Load pending invites
 */
async function loadPendingInvites(panel: HTMLElement, projectId: string): Promise<void> {
  const container = panel.querySelector('#pending-invites') as HTMLElement;

  try {
    const invites = await membersService.getInvites(projectId);
    
    if (invites.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="invites-section">
        <h4>Pending Invites</h4>
        <div class="invites-list">
          ${invites.map(invite => `
            <div class="invite-card" data-id="${invite.id}">
              <div class="invite-info">
                <span class="invite-email">${escapeHtml(invite.email)}</span>
                <span class="invite-role">${invite.role}</span>
                <span class="invite-time">Sent ${formatRelativeTime(invite.invited_at || invite.created_at || new Date().toISOString())}</span>
              </div>
              <button class="btn btn-sm cancel-invite-btn" data-id="${invite.id}">Cancel</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Bind cancel buttons
    container.querySelectorAll('.cancel-invite-btn').forEach(btn => {
      on(btn as HTMLElement, 'click', async () => {
        const inviteId = btn.getAttribute('data-id');
        if (!inviteId) return;

        try {
          // TODO: Implement cancel invite in service
          toast.info('Invite cancellation not implemented');
        } catch {
          toast.error('Failed to cancel invite');
        }
      });
    });
  } catch {
    // Ignore
  }
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#members-count');
  if (countEl) countEl.textContent = String(count);
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

export default createMembersPanel;
