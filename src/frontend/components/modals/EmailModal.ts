/**
 * Email Modal Component
 * View and compose emails
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { http } from '../../services/api';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

const MODAL_ID = 'email-modal';

export interface Email {
  id: string;
  from: { name: string; email: string };
  to: Array<{ name: string; email: string }>;
  cc?: Array<{ name: string; email: string }>;
  subject: string;
  body: string;
  bodyHtml?: string;
  date: string;
  read: boolean;
  attachments?: Array<{ name: string; size: number; type: string }>;
  thread?: Email[];
}

export interface EmailModalProps {
  mode: 'view' | 'compose' | 'reply';
  email?: Email;
  onSend?: (email: Partial<Email>) => Promise<void>;
}

/**
 * Show email modal
 */
export function showEmailModal(props: EmailModalProps): void {
  const { mode, email, onSend } = props;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'email-modal-content' });

  if (mode === 'view' && email) {
    content.innerHTML = `
      <div class="email-view">
        <div class="email-header">
          <div class="email-subject">${escapeHtml(email.subject)}</div>
          <div class="email-meta">
            <div class="email-from">
              <strong>${escapeHtml(email.from.name)}</strong>
              <span class="text-muted">&lt;${escapeHtml(email.from.email)}&gt;</span>
            </div>
            <div class="email-to">
              To: ${email.to.map(r => escapeHtml(r.name || r.email)).join(', ')}
            </div>
            ${email.cc?.length ? `
              <div class="email-cc">
                Cc: ${email.cc.map(r => escapeHtml(r.name || r.email)).join(', ')}
              </div>
            ` : ''}
            <div class="email-date">${formatRelativeTime(email.date)}</div>
          </div>
        </div>
        
        <div class="email-body">
          ${email.bodyHtml || escapeHtml(email.body).replace(/\n/g, '<br>')}
        </div>
        
        ${email.attachments?.length ? `
          <div class="email-attachments">
            <h4>Attachments (${email.attachments.length})</h4>
            <div class="attachments-list">
              ${email.attachments.map(a => `
                <div class="attachment-item">
                  <span class="attachment-icon">📎</span>
                  <span class="attachment-name">${escapeHtml(a.name)}</span>
                  <span class="attachment-size">${formatBytes(a.size)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${email.thread?.length ? `
          <div class="email-thread">
            <h4>Thread (${email.thread.length} messages)</h4>
            ${email.thread.map(t => `
              <div class="thread-message">
                <div class="thread-header">
                  <strong>${escapeHtml(t.from.name)}</strong>
                  <span>${formatRelativeTime(t.date)}</span>
                </div>
                <div class="thread-preview">${escapeHtml(t.body.slice(0, 100))}...</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    // Compose / Reply mode
    const isReply = mode === 'reply' && email;
    const replyTo = isReply ? email.from.email : '';
    const replySubject = isReply ? `Re: ${email.subject}` : '';

    content.innerHTML = `
      <form id="email-form" class="email-form">
        <div class="form-group">
          <label for="email-to">To *</label>
          <input type="text" id="email-to" required 
                 value="${replyTo}" 
                 placeholder="recipient@example.com">
        </div>
        
        <div class="form-group">
          <label for="email-cc">Cc</label>
          <input type="text" id="email-cc" 
                 placeholder="cc@example.com">
        </div>
        
        <div class="form-group">
          <label for="email-subject">Subject *</label>
          <input type="text" id="email-subject" required 
                 value="${escapeHtml(replySubject)}" 
                 placeholder="Email subject">
        </div>
        
        <div class="form-group">
          <label for="email-body">Message *</label>
          <textarea id="email-body" rows="10" required 
                    placeholder="Write your message...">${isReply ? `\n\n---\nOn ${email.date}, ${email.from.name} wrote:\n${email.body}` : ''}</textarea>
        </div>
        
        <div class="form-group">
          <label>Attachments</label>
          <div class="attachment-dropzone" id="attachment-zone">
            <span>Drop files here or click to attach</span>
            <input type="file" id="attachment-input" multiple hidden>
          </div>
          <div id="attachments-preview"></div>
        </div>
      </form>
    `;

    // Bind attachment zone
    setTimeout(() => {
      const zone = content.querySelector('#attachment-zone') as HTMLElement;
      const input = content.querySelector('#attachment-input') as HTMLInputElement;

      if (zone && input) {
        on(zone, 'click', () => input.click());
        on(input, 'change', () => {
          // Handle file selection
          if (input.files) {
            const preview = content.querySelector('#attachments-preview') as HTMLElement;
            preview.innerHTML = Array.from(input.files)
              .map(f => `<div class="attachment-item">${escapeHtml(f.name)}</div>`)
              .join('');
          }
        });
      }
    }, 0);
  }

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  if (mode === 'view') {
    const replyBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Reply',
    });

    const forwardBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Forward',
    });

    const closeBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Close',
    });

    on(replyBtn, 'click', () => {
      closeModal(MODAL_ID);
      showEmailModal({ ...props, mode: 'reply' });
    });

    on(forwardBtn, 'click', () => {
      // Forward logic
      toast.info('Forward not implemented');
    });

    on(closeBtn, 'click', () => closeModal(MODAL_ID));

    footer.appendChild(closeBtn);
    footer.appendChild(forwardBtn);
    footer.appendChild(replyBtn);
  } else {
    const cancelBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Cancel',
    });

    const sendBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Send',
    });

    on(cancelBtn, 'click', () => closeModal(MODAL_ID));

    on(sendBtn, 'click', async () => {
      const form = content.querySelector('#email-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const to = (content.querySelector('#email-to') as HTMLInputElement).value;
      const cc = (content.querySelector('#email-cc') as HTMLInputElement).value;
      const subject = (content.querySelector('#email-subject') as HTMLInputElement).value;
      const body = (content.querySelector('#email-body') as HTMLTextAreaElement).value;

      const emailData: Partial<Email> = {
        to: to.split(',').map(e => ({ name: '', email: e.trim() })),
        cc: cc ? cc.split(',').map(e => ({ name: '', email: e.trim() })) : undefined,
        subject,
        body,
      };

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';

      try {
        if (onSend) {
          await onSend(emailData);
        } else {
          await http.post('/api/emails/send', emailData);
        }
        toast.success('Email sent');
        closeModal(MODAL_ID);
      } catch {
        // Error shown by API service
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(sendBtn);
  }

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: mode === 'view' ? 'Email' : (mode === 'reply' ? 'Reply' : 'Compose Email'),
    content,
    size: 'lg',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showEmailModal;
