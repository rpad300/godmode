/**
 * Invite Modal Component
 * Invite new team members
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { http } from '../../services/api';
import { toast } from '../../services/toast';

const MODAL_ID = 'invite-modal';

interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  photo_url?: string;
  organization?: string;
  role?: string;
}

interface ProjectMember {
  user_id: string;
  linked_contact_id?: string;
}

export interface InviteModalProps {
  projectId: string;
  onInvite?: () => void;
  onInviteSent?: (email: string) => void;
}

// Cache for loaded data
let cachedMembers: ProjectMember[] = [];

/**
 * Show invite modal
 */
export function showInviteModal(props: InviteModalProps): void {
  const { projectId, onInviteSent } = props;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'invite-modal-content' });

  content.innerHTML = `
    <style>
      .invite-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
      }
      
      .invite-tab-btn {
        flex: 1;
        padding: 12px 16px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #64748b);
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      }
      
      .invite-tab-btn:hover {
        color: var(--text-primary, #1e293b);
      }
      
      .invite-tab-btn.active {
        color: #e11d48;
      }
      
      .invite-tab-btn.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: #e11d48;
      }
      
      .invite-tab-content {
        display: none;
      }
      
      .invite-tab-content.active {
        display: block;
      }
      
      .contacts-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      
      .contact-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
      }
      
      .contact-option:last-child {
        border-bottom: none;
      }
      
      .contact-option:hover {
        background: var(--bg-secondary, #f8fafc);
      }
      
      .contact-option.selected {
        background: linear-gradient(135deg, rgba(225,29,72,0.08) 0%, rgba(225,29,72,0.04) 100%);
      }
      
      .contact-option input[type="radio"] {
        display: none;
      }
      
      .contact-option .radio-circle {
        width: 18px;
        height: 18px;
        border: 2px solid var(--border-color, #cbd5e1);
        border-radius: 50%;
        flex-shrink: 0;
        position: relative;
        transition: all 0.2s;
      }
      
      .contact-option.selected .radio-circle {
        border-color: #e11d48;
      }
      
      .contact-option.selected .radio-circle::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 8px;
        height: 8px;
        background: #e11d48;
        border-radius: 50%;
      }
      
      .contact-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 600;
        flex-shrink: 0;
        overflow: hidden;
      }
      
      .contact-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .contact-info {
        flex: 1;
        min-width: 0;
      }
      
      .contact-name {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        margin-bottom: 2px;
      }
      
      .contact-email {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .no-contacts-msg {
        padding: 24px;
        text-align: center;
        color: var(--text-secondary, #64748b);
      }
      
      .email-status {
        margin-top: 8px;
        padding: 8px 12px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        font-size: 12px;
        color: #166534;
        display: none;
      }
      
      .email-status.show {
        display: block;
      }
      
      .email-status.error {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }
    </style>
    
    <!-- Tabs -->
    <div class="invite-tabs">
      <button type="button" class="invite-tab-btn active" data-tab="new">
        New Email
      </button>
      <button type="button" class="invite-tab-btn" data-tab="contacts">
        Existing Contacts
      </button>
    </div>
    
    <!-- Tab: New Email -->
    <div class="invite-tab-content active" id="tab-new">
      <form id="invite-form" class="invite-form">
        <div class="form-group">
          <label for="invite-email">Email Address *</label>
          <input type="email" id="invite-email" required 
                 placeholder="colleague@example.com">
          <div class="form-hint">They will receive an email invitation to join this project</div>
        </div>
        
        <div class="form-group">
          <label for="invite-role">Access Level</label>
          <select id="invite-role">
            <option value="read">Viewer - Can view data only</option>
            <option value="write" selected>Member - Can view and edit data</option>
            <option value="admin">Admin - Can manage team and settings</option>
          </select>
          <div class="form-hint" style="margin-top: 4px;">You can assign a project role after they join.</div>
        </div>
        
        <div class="form-group">
          <label for="invite-message">Personal Message (optional)</label>
          <textarea id="invite-message" rows="2" 
                    placeholder="Add a personal note to the invitation..."></textarea>
        </div>
        
        <div class="email-status" id="email-status"></div>
      </form>
    </div>
    
    <!-- Tab: Existing Contacts -->
    <div class="invite-tab-content" id="tab-contacts">
      <div id="contacts-list" class="contacts-list">
        <div class="no-contacts-msg">Loading contacts...</div>
      </div>
      
      <div class="form-group">
        <label for="invite-role-contact">Access Level</label>
        <select id="invite-role-contact">
          <option value="read">Viewer - Can view data only</option>
          <option value="write" selected>Member - Can view and edit data</option>
          <option value="admin">Admin - Can manage team and settings</option>
        </select>
      </div>
      
      <div class="add-options" style="display: flex; gap: 12px; margin-top: 16px;">
        <button type="button" id="btn-add-direct" class="btn btn-primary" style="flex: 1;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Add to Team
        </button>
        <button type="button" id="btn-send-invite" class="btn btn-secondary" style="flex: 1;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Send Invitation
        </button>
      </div>
      <div class="form-hint" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
        <strong>Add to Team:</strong> Adds contact as team member directly (no email sent)<br>
        <strong>Send Invitation:</strong> Sends an email invitation to join
      </div>
      
      <div class="email-status" id="email-status-contact"></div>
    </div>
    
    <div class="invite-link-section" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color, #e2e8f0);">
      <h4 style="margin: 0 0 8px; font-size: 13px; color: var(--text-secondary, #64748b);">Or share invite link</h4>
      <div class="input-group" style="display: flex; gap: 8px;">
        <input type="text" id="invite-link" readonly 
               value="Generating link..." class="form-control" style="flex: 1;">
        <button type="button" id="btn-copy-link" class="btn btn-secondary">Copy</button>
      </div>
    </div>
  `;

  // State
  let activeTab = 'new';
  let selectedContact: Contact | null = null;

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const cancelBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Cancel',
  });

  const sendBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Send Invitation',
  });

  on(cancelBtn, 'click', () => closeModal(MODAL_ID));

  // Handler for sending email invitation (New Email tab)
  on(sendBtn, 'click', async () => {
    if (activeTab !== 'new') return; // Only for new email tab
    
    const form = content.querySelector('#invite-form') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const email = (content.querySelector('#invite-email') as HTMLInputElement).value.trim();
    const role = (content.querySelector('#invite-role') as HTMLSelectElement).value;
    const message = (content.querySelector('#invite-message') as HTMLTextAreaElement).value.trim();

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    const statusEl = content.querySelector('#email-status') as HTMLElement;

    try {
      const response = await http.post<{ success: boolean; email_sent: boolean }>(`/api/projects/${projectId}/invites`, {
        email,
        role,
        message: message || undefined,
      });

      if (response.data.email_sent) {
        statusEl.textContent = `✓ Invitation email sent to ${email}`;
        statusEl.classList.remove('error');
        statusEl.classList.add('show');
      } else {
        statusEl.textContent = `Invitation created, but email could not be sent. Share the link manually.`;
        statusEl.classList.add('error', 'show');
      }

      toast.success(`Invitation sent to ${email}`);
      onInviteSent?.(email);
      setTimeout(() => closeModal(MODAL_ID), 1500);
    } catch {
      statusEl.textContent = 'Failed to create invitation';
      statusEl.classList.add('error', 'show');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Invitation';
    }
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(sendBtn);

  // Bind contacts tab buttons after modal is created
  setTimeout(() => {
    const btnAddDirect = content.querySelector('#btn-add-direct') as HTMLButtonElement;
    const btnSendInvite = content.querySelector('#btn-send-invite') as HTMLButtonElement;
    const statusEl = content.querySelector('#email-status-contact') as HTMLElement;

    // Add directly without email
    if (btnAddDirect) {
      on(btnAddDirect, 'click', async () => {
        if (!selectedContact) {
          toast.error('Please select a contact');
          return;
        }
        
        const role = (content.querySelector('#invite-role-contact') as HTMLSelectElement).value;
        
        btnAddDirect.disabled = true;
        btnAddDirect.innerHTML = '<span class="spinner"></span> Adding...';

        try {
          // Add contact as team member directly (without email)
          await http.post(`/api/projects/${projectId}/members/add-contact`, {
            contact_id: selectedContact.id,
            role,
          });

          statusEl.textContent = `✓ ${selectedContact.name} added to team`;
          statusEl.classList.remove('error');
          statusEl.classList.add('show');

          toast.success(`${selectedContact.name} added to team`);
          onInviteSent?.(selectedContact.email || selectedContact.name);
          setTimeout(() => closeModal(MODAL_ID), 1000);
        } catch (error: any) {
          const msg = error?.response?.data?.error || 'Failed to add member';
          statusEl.textContent = msg;
          statusEl.classList.add('error', 'show');
          toast.error(msg);
        } finally {
          btnAddDirect.disabled = false;
          btnAddDirect.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Add to Team
          `;
        }
      });
    }

    // Send invitation email
    if (btnSendInvite) {
      on(btnSendInvite, 'click', async () => {
        if (!selectedContact || !selectedContact.email) {
          toast.error('Please select a contact with an email address');
          return;
        }

        const role = (content.querySelector('#invite-role-contact') as HTMLSelectElement).value;

        btnSendInvite.disabled = true;
        btnSendInvite.innerHTML = '<span class="spinner"></span> Sending...';

        try {
          const response = await http.post<{ success: boolean; email_sent: boolean }>(`/api/projects/${projectId}/invites`, {
            email: selectedContact.email,
            role,
          });

          if (response.data.email_sent) {
            statusEl.textContent = `✓ Invitation email sent to ${selectedContact.email}`;
            statusEl.classList.remove('error');
            statusEl.classList.add('show');
          } else {
            statusEl.textContent = `Invitation created, but email could not be sent.`;
            statusEl.classList.add('error', 'show');
          }

          toast.success(`Invitation sent to ${selectedContact.name}`);
          onInviteSent?.(selectedContact.email);
          setTimeout(() => closeModal(MODAL_ID), 1500);
        } catch {
          statusEl.textContent = 'Failed to send invitation';
          statusEl.classList.add('error', 'show');
        } finally {
          btnSendInvite.disabled = false;
          btnSendInvite.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Send Invitation
          `;
        }
      });
    }
  }, 0);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Invite Team Member',
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Generate invite link
  generateInviteLink(content, projectId);

  // Tab switching
  const tabBtns = content.querySelectorAll('.invite-tab-btn');
  tabBtns.forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const tabId = btn.getAttribute('data-tab') || 'new';
      activeTab = tabId;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      content.querySelectorAll('.invite-tab-content').forEach(tab => {
        tab.classList.toggle('active', tab.id === `tab-${tabId}`);
      });
    });
  });

  // Load contacts for the contacts tab (pass projectId to filter already-linked contacts)
  loadContacts(content, projectId, (contact) => {
    selectedContact = contact;
  });

  // Bind copy button
  setTimeout(() => {
    const copyBtn = content.querySelector('#btn-copy-link');
    if (copyBtn) {
      on(copyBtn as HTMLElement, 'click', () => {
        const linkInput = content.querySelector('#invite-link') as HTMLInputElement;
        navigator.clipboard.writeText(linkInput.value).then(() => {
          toast.success('Link copied to clipboard');
        }).catch(() => {
          // Fallback
          linkInput.select();
          document.execCommand('copy');
          toast.success('Link copied');
        });
      });
    }
  }, 0);
}

/**
 * Generate invite link
 */
async function generateInviteLink(container: HTMLElement, projectId: string): Promise<void> {
  const linkInput = container.querySelector('#invite-link') as HTMLInputElement;

  try {
    const response = await http.get<{ link?: string; invite_url?: string }>(`/api/projects/${projectId}/invites/link`);
    linkInput.value = response.data.link || response.data.invite_url || 'Link not available';
  } catch {
    // Try alternate endpoint
    try {
      const response = await http.post<{ invite_url?: string; token?: string }>(`/api/projects/${projectId}/invites`, {
        email: '',
        role: 'member',
        generate_link_only: true,
      });
      if (response.data.invite_url) {
        linkInput.value = response.data.invite_url;
      } else {
        linkInput.value = 'Use email invitation instead';
      }
    } catch {
      linkInput.value = 'Use email invitation instead';
    }
  }
}

/**
 * Load project members to filter out already-linked contacts
 */
async function loadProjectMembers(projectId: string): Promise<void> {
  try {
    const response = await http.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`);
    cachedMembers = response.data.members || [];
  } catch (error) {
    console.warn('[InviteModal] Failed to load project members:', error);
    cachedMembers = [];
  }
}

/**
 * Load contacts for selection
 */
async function loadContacts(container: HTMLElement, projectId: string, onSelect: (contact: Contact | null) => void): Promise<void> {
  const listEl = container.querySelector('#contacts-list') as HTMLElement;
  if (!listEl) return;

  try {
    // Load members first to know which contacts are already linked
    await loadProjectMembers(projectId);
    
    const response = await http.get<{ contacts: Contact[] }>('/api/contacts');
    const contacts = response.data.contacts || [];
    
    // Get IDs of contacts already linked to project members
    const linkedContactIds = new Set(
      cachedMembers
        .filter(m => m.linked_contact_id)
        .map(m => m.linked_contact_id)
    );
    
    // Filter to contacts not already linked to a member
    // Note: For "Add to Team" we don't require email, only for "Send Invitation"
    const availableContacts = contacts.filter(c => !linkedContactIds.has(c.id));

    if (availableContacts.length === 0) {
      listEl.innerHTML = `
        <div class="no-contacts-msg">
          ${linkedContactIds.size > 0 
            ? 'All contacts are already team members.' 
            : 'No contacts found.'}
          <br>
          <small style="opacity: 0.7;">Add contacts in the Contacts panel.</small>
        </div>
      `;
      return;
    }

    listEl.innerHTML = availableContacts.map(contact => {
      const initials = contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const avatarUrl = contact.avatar_url || contact.photo_url;
      const hasEmail = !!contact.email;
      const subtitle = [contact.email, contact.organization].filter(Boolean).join(' • ') || contact.role || 'No email';
      
      return `
        <label class="contact-option" data-id="${contact.id}" data-has-email="${hasEmail}">
          <input type="radio" name="contact-select" value="${contact.id}">
          <span class="radio-circle"></span>
          <div class="contact-avatar">
            ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(contact.name)}">` : initials}
          </div>
          <div class="contact-info">
            <div class="contact-name">${escapeHtml(contact.name)}</div>
            <div class="contact-email">${escapeHtml(subtitle)}${!hasEmail ? ' <span style="color: #f59e0b; font-size: 10px;">(no email)</span>' : ''}</div>
          </div>
        </label>
      `;
    }).join('');

    // Bind selection events
    const options = listEl.querySelectorAll('.contact-option');
    options.forEach(option => {
      on(option as HTMLElement, 'click', () => {
        options.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        
        const contactId = option.getAttribute('data-id');
        const selectedContact = availableContacts.find(c => c.id === contactId) || null;
        onSelect(selectedContact);
      });
    });
  } catch (error) {
    listEl.innerHTML = `
      <div class="no-contacts-msg">
        Failed to load contacts
      </div>
    `;
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

export default showInviteModal;
