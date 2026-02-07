/**
 * Emails Panel Component
 * Email list with filters and management
 */

import { createElement, on } from '../utils/dom';
import { emailsService, Email } from '../services/emails';
import { showEmailModal } from './modals/EmailModal';
import { showEmailPreviewModal } from './modals/EmailPreviewModal';
import { toast } from '../services/toast';
import { formatRelativeTime } from '../utils/format';

export interface EmailsPanelProps {
  onEmailClick?: (email: Email) => void;
}

type DirectionFilter = 'all' | 'inbound' | 'outbound' | 'internal';
let currentDirection: DirectionFilter = 'all';
let showNeedsResponse = false;

/**
 * Create emails panel
 */
export function createEmailsPanel(props: EmailsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'emails-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Emails</h2>
        <span class="panel-count" id="emails-count">0</span>
      </div>
      <div class="panel-actions">
        <select id="direction-filter" class="filter-select">
          <option value="all">All</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="internal">Internal</option>
        </select>
        <label class="checkbox-label">
          <input type="checkbox" id="needs-response-filter"> Needs Response
        </label>
        <button class="btn btn-primary btn-sm" id="add-email-btn">+ Add Email</button>
      </div>
    </div>
    <div class="panel-content" id="emails-content">
      <div class="loading">Loading emails...</div>
    </div>
  `;

  // Bind events
  const directionFilter = panel.querySelector('#direction-filter') as HTMLSelectElement;
  on(directionFilter, 'change', () => {
    currentDirection = directionFilter.value as DirectionFilter;
    loadEmails(panel, props);
  });

  const needsResponseFilter = panel.querySelector('#needs-response-filter') as HTMLInputElement;
  on(needsResponseFilter, 'change', () => {
    showNeedsResponse = needsResponseFilter.checked;
    loadEmails(panel, props);
  });

  const addBtn = panel.querySelector('#add-email-btn');
  if (addBtn) {
    on(addBtn as HTMLElement, 'click', async () => {
      const { createEmailComposer, showEmailComposer } = await import('./EmailComposer');
      showEmailComposer({
        onSave: () => loadEmails(panel, props),
      });
    });
  }

  // Initial load
  loadEmails(panel, props);

  return panel;
}

/**
 * Load emails
 */
async function loadEmails(panel: HTMLElement, props: EmailsPanelProps): Promise<void> {
  const content = panel.querySelector('#emails-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    let emails: Email[];

    if (showNeedsResponse) {
      emails = await emailsService.getNeedingResponse();
    } else {
      const result = await emailsService.getAll({
        direction: currentDirection === 'all' ? undefined : currentDirection,
      });
      emails = result.emails;
    }

    renderEmails(content, emails, props);
    updateCount(panel, emails.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load emails</div>';
  }
}

/**
 * Render emails
 */
function renderEmails(container: HTMLElement, emails: Email[], props: EmailsPanelProps): void {
  if (emails.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No emails found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="emails-list">
      ${emails.map(email => createEmailCard(email)).join('')}
    </div>
  `;

  // Bind events
  container.querySelectorAll('.email-card').forEach(card => {
    on(card as HTMLElement, 'click', async (e) => {
      if ((e.target as HTMLElement).closest('.email-actions')) return;
      
      const id = card.getAttribute('data-id');
      const email = emails.find(e => String(e.id) === id);
      if (email) {
        // Fetch full email data with extraction results
        try {
          const fullEmail = await emailsService.getById(id!);
          showEmailPreviewModal(fullEmail as any);
        } catch {
          // Fallback to basic modal
          showEmailPreviewModal(email as any);
        }
        
        if (props.onEmailClick) {
          props.onEmailClick(email);
        }
      }
    });

    // Mark responded
    const respondedBtn = card.querySelector('.mark-responded-btn');
    if (respondedBtn) {
      on(respondedBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        if (!id) return;

        try {
          await emailsService.markResponded(id);
          toast.success('Marked as responded');
          loadEmails(container.closest('.emails-panel') as HTMLElement, props);
        } catch {
          toast.error('Failed to update email');
        }
      });
    }

    // Generate response
    const generateBtn = card.querySelector('.generate-response-btn');
    if (generateBtn) {
      on(generateBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        if (!id) return;

        const btn = generateBtn as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = 'Generating...';

        try {
          const suggestions = await emailsService.generateResponse(id);
          const draft = suggestions[0]?.response || '';
          toast.success('Response generated');
          
          // Show the generated draft
          const email = emails.find(e => String(e.id) === id);
          if (email) {
            email.draft_response = draft;
            // Open email modal with draft
            showEmailModal({ mode: 'view', email: email as unknown as Parameters<typeof showEmailModal>[0]['email'] });
          }
        } catch {
          toast.error('Failed to generate response');
        } finally {
          btn.disabled = false;
          btn.textContent = 'AI Response';
        }
      });
    }
  });
}

/**
 * Create email card HTML
 */
function createEmailCard(email: Email): string {
  const directionIcon = email.direction === 'inbound' ? '📥' : email.direction === 'outbound' ? '📤' : '🔄';
  const needsResponse = email.requires_response && !email.response_sent;

  return `
    <div class="email-card ${needsResponse ? 'needs-response' : ''}" data-id="${email.id}">
      <div class="email-direction">${directionIcon}</div>
      <div class="email-info">
        <div class="email-header">
          <span class="email-from">${escapeHtml(email.from_name || email.from_email || email.from || '')}</span>
          <span class="email-date">${formatRelativeTime(email.created_at || email.date || new Date().toISOString())}</span>
        </div>
        <div class="email-subject">${escapeHtml(email.subject || '(No subject)')}</div>
        <div class="email-preview">${escapeHtml(getPreview(email.body_text || ''))}</div>
      </div>
      <div class="email-badges">
        ${needsResponse ? '<span class="needs-response-badge">Needs Response</span>' : ''}
        ${email.response_drafted ? '<span class="draft-badge">Draft Ready</span>' : ''}
        ${email.response_sent ? '<span class="responded-badge">Responded</span>' : ''}
        ${email.ai_summary ? '<span class="ai-badge">AI Analyzed</span>' : ''}
      </div>
      <div class="email-actions">
        ${needsResponse ? `
          <button class="btn btn-sm generate-response-btn">AI Response</button>
          <button class="btn btn-sm mark-responded-btn">Mark Responded</button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Get preview text
 */
function getPreview(text: string, maxLength = 100): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned;
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#emails-count');
  if (countEl) countEl.textContent = String(count);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createEmailsPanel;
