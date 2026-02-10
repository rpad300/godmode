/**
 * Email Preview Modal - SOTA
 * Full email preview with AI extraction results, entities, analysis
 */

import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

export interface EmailData {
  id: string;
  subject: string;
  from: { name: string; email: string };
  to: Array<{ name: string; email: string }>;
  cc?: Array<{ name: string; email: string }>;
  body: string;
  body_html?: string;
  date: string;
  attachments?: Array<{ name: string; size: number }>;
  // AI extraction fields
  extracted_entities?: ExtractionResult;
  ai_summary?: string;
  detected_intent?: string;
  sentiment?: string;
  requires_response?: boolean;
  processed_at?: string;
}

interface ExtractionResult {
  summary?: string;
  intent?: string;
  sentiment?: string;
  key_points?: string[];
  action_items?: Array<{ task: string; owner?: string }>;
  questions?: string[];
  entities?: Array<{ type: string; name: string; confidence?: number }>;
  contacts?: Array<{ name: string; email?: string; title?: string; organization?: string }>;
}

let currentTab = 'content';

/**
 * Show email preview modal
 */
export function showEmailPreviewModal(email: EmailData, onClose?: () => void): void {
  const existing = document.querySelector('.email-preview-overlay');
  if (existing) existing.remove();

  const extraction = email.extracted_entities;
  const hasExtraction = extraction && (
    extraction.key_points?.length || 
    extraction.action_items?.length || 
    extraction.entities?.length
  );

  const content = document.createElement('div');
  content.className = 'email-preview-modal';
  content.innerHTML = `
    <style>
      .email-preview-modal {
        display: flex;
        flex-direction: column;
        height: 80vh;
        max-height: 800px;
        width: 900px;
        max-width: 95vw;
      }
      .email-preview-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
      }
      .email-preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
        flex-shrink: 0;
      }
      .email-preview-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
        line-height: 1.3;
      }
      .email-preview-meta {
        font-size: 13px;
        color: var(--text-secondary);
      }
      .email-preview-meta-row {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
      }
      .email-preview-meta-label {
        color: var(--text-tertiary);
        min-width: 40px;
      }
      .email-preview-badges {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }
      .email-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }
      .email-badge.intent {
        background: rgba(var(--primary-rgb), 0.1);
        color: var(--primary);
      }
      .email-badge.sentiment-positive {
        background: rgba(46, 160, 67, 0.1);
        color: #2ea043;
      }
      .email-badge.sentiment-negative {
        background: rgba(248, 81, 73, 0.1);
        color: #f85149;
      }
      .email-badge.sentiment-neutral {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
      }
      .email-badge.response-needed {
        background: rgba(248, 81, 73, 0.1);
        color: #f85149;
      }
      .email-preview-tabs {
        display: flex;
        gap: 4px;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .email-preview-tab {
        padding: 12px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.15s ease;
      }
      .email-preview-tab:hover {
        color: var(--text-primary);
      }
      .email-preview-tab.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .email-preview-tab-badge {
        background: var(--bg-tertiary);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        margin-left: 6px;
      }
      .email-preview-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .email-preview-section {
        display: none;
      }
      .email-preview-section.active {
        display: block;
      }
      .email-content-body {
        background: var(--bg-secondary);
        padding: 20px;
        border-radius: 12px;
        line-height: 1.7;
      }
      .extraction-card {
        padding: 12px 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .extraction-type {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .extraction-content {
        color: var(--text-primary);
      }
      .extraction-meta {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 4px;
      }
      .section-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 12px;
        text-transform: uppercase;
      }
      .empty-section {
        text-align: center;
        padding: 40px;
        color: var(--text-tertiary);
      }
      .ai-summary-box {
        padding: 16px;
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
        border-left: 3px solid var(--primary);
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .ai-summary-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      .key-points-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .key-points-list li {
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        gap: 8px;
      }
      .key-points-list li:last-child {
        border-bottom: none;
      }
      .key-points-list li::before {
        content: "•";
        color: var(--primary);
      }
      .contact-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .contact-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .contact-info {
        flex: 1;
      }
      .contact-name {
        font-weight: 600;
      }
      .contact-details {
        font-size: 12px;
        color: var(--text-secondary);
      }
    </style>
    
    <div class="email-preview-header">
      <div class="email-preview-icon">📧</div>
      <div class="email-preview-header-fill">
        <h2 class="email-preview-title">${escapeHtml(email.subject || 'No Subject')}</h2>
        <div class="email-preview-meta">
          <div class="email-preview-meta-row">
            <span class="email-preview-meta-label">From:</span>
            <span><strong>${escapeHtml(email.from?.name || '')}</strong> &lt;${escapeHtml(email.from?.email || '')}&gt;</span>
          </div>
          <div class="email-preview-meta-row">
            <span class="email-preview-meta-label">To:</span>
            <span>${(email.to || []).map(r => escapeHtml(r.name || r.email)).join(', ')}</span>
          </div>
          <div class="email-preview-meta-row">
            <span class="email-preview-meta-label">Date:</span>
            <span>${formatRelativeTime(email.date)}</span>
          </div>
        </div>
        <div class="email-preview-badges">
          ${extraction?.intent ? `<span class="email-badge intent">📋 ${escapeHtml(extraction.intent)}</span>` : ''}
          ${extraction?.sentiment ? `<span class="email-badge sentiment-${extraction.sentiment}">${getSentimentEmoji(extraction.sentiment)} ${escapeHtml(extraction.sentiment)}</span>` : ''}
          ${email.requires_response ? `<span class="email-badge response-needed">⚠️ Response Needed</span>` : ''}
        </div>
      </div>
      <button class="btn btn-sm email-preview-close-btn">×</button>
    </div>
    
    <div class="email-preview-tabs">
      <button class="email-preview-tab active" data-tab="content">Content</button>
      <button class="email-preview-tab ${!hasExtraction ? 'hidden' : ''}" data-tab="analysis">
        Analysis
      </button>
      <button class="email-preview-tab ${!extraction?.entities?.length ? 'hidden' : ''}" data-tab="entities">
        Entities
        <span class="email-preview-tab-badge">${extraction?.entities?.length || 0}</span>
      </button>
      <button class="email-preview-tab ${!extraction?.contacts?.length ? 'hidden' : ''}" data-tab="contacts">
        Contacts
        <span class="email-preview-tab-badge">${extraction?.contacts?.length || 0}</span>
      </button>
    </div>
    
    <div class="email-preview-body">
      <div class="email-preview-section active" data-section="content">
        ${extraction?.summary || email.ai_summary ? `
          <div class="ai-summary-box">
            <div class="ai-summary-label">🤖 AI Summary</div>
            <div>${escapeHtml(extraction?.summary || email.ai_summary || '')}</div>
          </div>
        ` : ''}
        <div class="email-content-body">
          ${email.body_html || escapeHtml(email.body || '').replace(/\n/g, '<br>')}
        </div>
      </div>
      
      <div class="email-preview-section" data-section="analysis">
        ${extraction?.key_points?.length ? `
          <div class="section-title">Key Points</div>
          <ul class="key-points-list">
            ${extraction.key_points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${extraction?.action_items?.length ? `
          <div class="section-title section-title-mt">Action Items</div>
          ${extraction.action_items.map(a => `
            <div class="extraction-card">
              <div class="extraction-content">☐ ${escapeHtml(a.task)}</div>
              ${a.owner ? `<div class="extraction-meta">Owner: ${escapeHtml(a.owner)}</div>` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${extraction?.questions?.length ? `
          <div class="section-title section-title-mt">Questions</div>
          ${extraction.questions.map(q => `
            <div class="extraction-card">
              <div class="extraction-content">❓ ${escapeHtml(q)}</div>
            </div>
          `).join('')}
        ` : ''}
        
        ${!extraction?.key_points?.length && !extraction?.action_items?.length && !extraction?.questions?.length ? `
          <div class="empty-section">No analysis available</div>
        ` : ''}
      </div>
      
      <div class="email-preview-section" data-section="entities">
        ${extraction?.entities?.length ? extraction.entities.map(e => `
          <div class="extraction-card">
            <div class="extraction-type">${escapeHtml(e.type)}</div>
            <div class="extraction-content">${escapeHtml(e.name)}</div>
            ${e.confidence ? `<div class="extraction-meta">Confidence: ${Math.round(e.confidence * 100)}%</div>` : ''}
          </div>
        `).join('') : '<div class="empty-section">No entities extracted</div>'}
      </div>
      
      <div class="email-preview-section" data-section="contacts">
        ${extraction?.contacts?.length ? extraction.contacts.map(c => `
          <div class="contact-card">
            <div class="contact-avatar">${getInitials(c.name)}</div>
            <div class="contact-info">
              <div class="contact-name">${escapeHtml(c.name)}</div>
              <div class="contact-details">
                ${c.title ? escapeHtml(c.title) + (c.organization ? ' at ' : '') : ''}
                ${c.organization ? escapeHtml(c.organization) : ''}
                ${c.email ? `<br>${escapeHtml(c.email)}` : ''}
              </div>
            </div>
          </div>
        `).join('') : '<div class="empty-section">No contacts extracted</div>'}
      </div>
    </div>
  `;

  // Tab switching
  content.querySelectorAll('.email-preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      content.querySelectorAll('.email-preview-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      content.querySelectorAll('.email-preview-section').forEach(s => s.classList.remove('active'));
      content.querySelector(`[data-section="${tabName}"]`)?.classList.add('active');
    });
  });

  // Close button
  content.querySelector('.close-btn')?.addEventListener('click', () => {
    overlay.remove();
    onClose?.();
  });

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay overlay-preview email-preview-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-preview-box';
  modal.appendChild(content);
  overlay.appendChild(modal);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onClose?.();
    }
  });

  // Close on escape
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      onClose?.();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);

  document.body.appendChild(overlay);
}

function getSentimentEmoji(sentiment: string): string {
  switch (sentiment?.toLowerCase()) {
    case 'positive': return '😊';
    case 'negative': return '😟';
    default: return '😐';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showEmailPreviewModal;
