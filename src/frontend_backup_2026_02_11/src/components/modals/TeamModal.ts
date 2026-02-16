/**
 * Team Modal Component
 * Manage project team members
 */

import { createElement, on } from '@lib/dom';
import { createModal, openModal, closeModal } from '@components/Modal';
import { http } from '@services/api';
import { toast } from '@services/toast';

const MODAL_ID = 'team-modal';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'member';
  joinedAt: string;
  avatarUrl?: string;
}

export interface TeamModalProps {
  projectId?: string;
  mode?: 'view' | 'edit' | 'manage' | 'create';
  team?: { id: string; name: string };
  onInvite?: () => void;
  onSave?: (team: { name: string; description?: string }) => void;
  onRemove?: (memberId: string) => void;
  onRoleChange?: (memberId: string, role: TeamMember['role']) => void;
}

let currentMembers: TeamMember[] = [];

/**
 * Show team modal
 */
export async function showTeamModal(props: TeamModalProps): Promise<void> {
  const { projectId, onInvite, onRemove, onRoleChange } = props;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'team-modal-content' });
  content.innerHTML = '<div class="loading">Loading team members...</div>';

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const inviteBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Invite Member',
  });

  const closeBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Close',
  });

  on(closeBtn, 'click', () => closeModal(MODAL_ID));
  on(inviteBtn, 'click', () => {
    closeModal(MODAL_ID);
    onInvite?.();
  });

  footer.appendChild(closeBtn);
  footer.appendChild(inviteBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Team Members',
    content,
    size: 'lg',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Load team members
  try {
    const response = await http.get<TeamMember[]>(`/api/projects/${projectId}/members`);
    currentMembers = response.data;
    renderMembers(content, props);
  } catch {
    content.innerHTML = '<div class="error">Failed to load team members</div>';
  }
}

/**
 * Render team members list
 */
function renderMembers(container: HTMLElement, props: TeamModalProps): void {
  if (currentMembers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No team members yet</p>
        <p class="text-muted">Invite members to collaborate on this project</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="team-list">
      ${currentMembers.map(member => renderMemberCard(member)).join('')}
    </div>
  `;

  // Bind actions
  container.querySelectorAll('.member-card').forEach(card => {
    const memberId = card.getAttribute('data-member-id');
    if (!memberId) return;

    const member = currentMembers.find(m => m.id === memberId);
    if (!member) return;

    // Role change
    const roleSelect = card.querySelector('.role-select') as HTMLSelectElement;
    if (roleSelect) {
      on(roleSelect, 'change', async () => {
        const newRole = roleSelect.value as TeamMember['role'];
        try {
          await http.patch(`/api/projects/${props.projectId}/members/${memberId}`, { role: newRole });
          member.role = newRole;
          toast.success('Role updated');
          props.onRoleChange?.(memberId, newRole);
        } catch {
          roleSelect.value = member.role;
        }
      });
    }

    // Remove member
    const removeBtn = card.querySelector('.btn-remove');
    if (removeBtn) {
      on(removeBtn as HTMLElement, 'click', async () => {
        const { confirm } = await import('@components/Modal');
        const confirmed = await confirm(
          `Remove ${member.name} from this project?`,
          {
            title: 'Remove Member',
            confirmText: 'Remove',
            confirmClass: 'btn-danger',
          }
        );

        if (confirmed) {
          try {
            await http.delete(`/api/projects/${props.projectId}/members/${memberId}`);
            currentMembers = currentMembers.filter(m => m.id !== memberId);
            renderMembers(container, props);
            toast.success('Member removed');
            props.onRemove?.(memberId);
          } catch {
            // Error shown by API service
          }
        }
      });
    }
  });
}

/**
 * Render individual member card
 */
function renderMemberCard(member: TeamMember): string {
  const initials = member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isSuperadmin = member.role === 'superadmin';

  return `
    <div class="member-card" data-member-id="${member.id}">
      <div class="member-avatar">
        ${member.avatarUrl
      ? `<img src="${member.avatarUrl}" alt="${escapeHtml(member.name)}">`
      : initials
    }
      </div>
      <div class="member-info">
        <div class="member-name">${escapeHtml(member.name)}</div>
        <div class="member-email">${escapeHtml(member.email)}</div>
      </div>
      <div class="member-role">
        ${isSuperadmin
      ? `<span class="role-badge superadmin">Owner</span>`
      : `<select class="role-select form-control">
              <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
            </select>`
    }
      </div>
      <div class="member-actions">
        ${!isSuperadmin
      ? `<button class="btn btn-sm btn-danger btn-remove" title="Remove member">✕</button>`
      : ''
    }
      </div>
    </div>
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showTeamModal;
