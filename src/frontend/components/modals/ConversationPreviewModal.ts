/**
 * Conversation Preview Modal - SOTA
 * Full conversation preview with AI extraction results, entities, notes
 */

import { http } from '../../services/api';
import { toast } from '../../services/toast';
import { formatRelativeTime } from '../../utils/format';

export interface Conversation {
  id: string;
  title: string;
  conversation_type: string;
  participants: string[];
  messages: Array<{ speaker: string; text: string; timestamp?: string }>;
  metadata?: {
    extraction_result?: ExtractionResult;
    extractedEntities?: Entity[];
    extractedRelationships?: Relationship[];
    aiProcessedAt?: string;
  };
  summary?: string;
  created_at: string;
}

interface Entity {
  id: string;
  type: string;
  name: string;
  properties?: Record<string, unknown>;
  confidence?: number;
}

interface Relationship {
  id: string;
  from_id: string;
  to_id: string;
  relation: string;
}

interface ExtractionResult {
  summary?: string;
  entities?: Entity[];
  relationships?: Relationship[];
  facts?: Array<{ id: string; content: string; category?: string; confidence?: number }>;
  decisions?: Array<{ id: string; content: string; owner_id?: string; confidence?: number }>;
  action_items?: Array<{ id: string; task: string; owner?: string; status?: string }>;
  questions?: Array<{ id: string; content: string }>;
  notes_rendered_text?: string;
  notes?: {
    key_points?: Array<{ text: string }>;
    outline?: Array<{ topic: string; bullets: Array<{ text: string }> }>;
  };
}

let currentTab = 'messages';

/**
 * Show conversation preview modal
 */
export function showConversationPreviewModal(conversation: Conversation, onClose?: () => void): void {
  const existing = document.querySelector('.conversation-preview-overlay');
  if (existing) existing.remove();

  const content = document.createElement('div');
  content.className = 'conversation-preview-modal';
  content.innerHTML = `
    <style>
      .conversation-preview-modal {
        display: flex;
        flex-direction: column;
        height: 80vh;
        max-height: 800px;
        width: 900px;
        max-width: 95vw;
      }
      .conv-preview-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
      }
      .conv-preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
      }
      .conv-preview-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
      }
      .conv-preview-meta {
        font-size: 13px;
        color: var(--text-secondary);
        display: flex;
        gap: 16px;
      }
      .conv-preview-tabs {
        display: flex;
        gap: 4px;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .conv-preview-tab {
        padding: 12px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.15s ease;
      }
      .conv-preview-tab:hover {
        color: var(--text-primary);
      }
      .conv-preview-tab.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .conv-preview-tab-badge {
        background: var(--bg-tertiary);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        margin-left: 6px;
      }
      .conv-preview-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .conv-preview-section {
        display: none;
      }
      .conv-preview-section.active {
        display: block;
      }
      .messages-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message-item {
        padding: 12px 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
      }
      .message-speaker {
        font-weight: 600;
        color: var(--primary);
        margin-bottom: 4px;
      }
      .message-text {
        color: var(--text-primary);
        line-height: 1.5;
      }
      .message-time {
        font-size: 11px;
        color: var(--text-tertiary);
        margin-top: 4px;
      }
      .entity-card {
        padding: 12px 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .entity-type {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .entity-content {
        color: var(--text-primary);
      }
      .entity-meta {
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
      .notes-rendered {
        padding: 20px;
        background: var(--bg-secondary);
        border-radius: 12px;
        line-height: 1.7;
      }
      .notes-header {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .notes-meta {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-color);
      }
      .notes-topic {
        margin-bottom: 20px;
      }
      .notes-topic-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 10px;
        padding-left: 8px;
        border-left: 3px solid var(--primary);
      }
      .notes-bullet {
        padding: 10px 12px;
        background: var(--bg-primary);
        border-radius: 8px;
        margin-bottom: 8px;
        font-size: 14px;
        line-height: 1.6;
      }
    </style>
    
    <div class="conv-preview-header">
      <div class="conv-preview-icon">💬</div>
      <div class="conv-preview-header-fill">
        <h2 class="conv-preview-title">${escapeHtml(conversation.title || 'Untitled Conversation')}</h2>
        <div class="conv-preview-meta">
          <span>${conversation.participants?.length || 0} participants</span>
          <span>${conversation.messages?.length || 0} messages</span>
          <span>${formatRelativeTime(conversation.created_at)}</span>
        </div>
      </div>
      <button class="btn btn-sm conv-preview-close-btn">×</button>
    </div>
    
    <div class="conv-preview-tabs">
      <button class="conv-preview-tab active" data-tab="messages">Messages</button>
      <button class="conv-preview-tab" data-tab="entities">
        Entities
        <span class="conv-preview-tab-badge" id="entities-count">0</span>
      </button>
      <button class="conv-preview-tab" data-tab="extraction">
        Extraction
        <span class="conv-preview-tab-badge" id="extraction-count">0</span>
      </button>
      <button class="conv-preview-tab hidden" data-tab="notes" id="notes-tab">
        Notes
      </button>
    </div>
    
    <div class="conv-preview-body">
      <div class="conv-preview-section active" data-section="messages" id="messages-container">
        <div class="messages-list">
          ${(conversation.messages || []).map(m => `
            <div class="message-item">
              <div class="message-speaker">${escapeHtml(m.speaker || 'Unknown')}</div>
              <div class="message-text">${escapeHtml(m.text || '')}</div>
              ${m.timestamp ? `<div class="message-time">${m.timestamp}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="conv-preview-section" data-section="entities" id="entities-container">
        <div class="empty-section">Loading entities...</div>
      </div>
      
      <div class="conv-preview-section" data-section="extraction" id="extraction-container">
        <div class="empty-section">Loading extraction results...</div>
      </div>
      
      <div class="conv-preview-section" data-section="notes" id="notes-container">
        <div class="empty-section">No notes available</div>
      </div>
    </div>
  `;

  // Tab switching
  content.querySelectorAll('.conv-preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      content.querySelectorAll('.conv-preview-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      content.querySelectorAll('.conv-preview-section').forEach(s => s.classList.remove('active'));
      content.querySelector(`[data-section="${tabName}"]`)?.classList.add('active');
    });
  });

  // Close button
  content.querySelector('.close-btn')?.addEventListener('click', () => {
    overlay.remove();
    onClose?.();
  });

  // Load extraction data
  loadExtractionData(content, conversation);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay overlay-preview conversation-preview-overlay';

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

/**
 * Load extraction data from conversation metadata
 */
function loadExtractionData(container: HTMLElement, conversation: Conversation): void {
  const meta = conversation.metadata;
  const extraction = meta?.extraction_result;
  
  // Update entities tab
  const entities = meta?.extractedEntities || extraction?.entities || [];
  const entitiesContainer = container.querySelector('#entities-container') as HTMLElement;
  const entitiesCount = container.querySelector('#entities-count') as HTMLElement;
  
  if (entitiesCount) entitiesCount.textContent = String(entities.length);
  
  if (entities.length > 0) {
    entitiesContainer.innerHTML = entities.map(e => `
      <div class="entity-card">
        <div class="entity-type">${escapeHtml(e.type)}</div>
        <div class="entity-content">${escapeHtml(e.name)}</div>
        ${e.confidence ? `<div class="entity-meta">Confidence: ${Math.round(e.confidence * 100)}%</div>` : ''}
      </div>
    `).join('');
  } else {
    entitiesContainer.innerHTML = '<div class="empty-section">No entities extracted</div>';
  }
  
  // Update extraction tab
  const extractionContainer = container.querySelector('#extraction-container') as HTMLElement;
  const facts = extraction?.facts || [];
  const decisions = extraction?.decisions || [];
  const actions = extraction?.action_items || [];
  const questions = extraction?.questions || [];
  
  const extractionCount = container.querySelector('#extraction-count') as HTMLElement;
  const totalItems = facts.length + decisions.length + actions.length + questions.length;
  if (extractionCount) extractionCount.textContent = String(totalItems);
  
  if (totalItems > 0) {
    let html = '';
    
    if (facts.length > 0) {
      html += `<div class="section-title">Facts (${facts.length})</div>`;
      html += facts.map(f => `
        <div class="entity-card">
          <div class="entity-type">${f.category || 'fact'}</div>
          <div class="entity-content">${escapeHtml(f.content)}</div>
        </div>
      `).join('');
    }
    
    if (decisions.length > 0) {
      html += `<div class="section-title section-title-mt">Decisions (${decisions.length})</div>`;
      html += decisions.map(d => `
        <div class="entity-card">
          <div class="entity-content">${escapeHtml(d.content)}</div>
        </div>
      `).join('');
    }
    
    if (actions.length > 0) {
      html += `<div class="section-title section-title-mt">Action Items (${actions.length})</div>`;
      html += actions.map(a => `
        <div class="entity-card">
          <div class="entity-content">${escapeHtml(a.task)}</div>
          ${a.owner ? `<div class="entity-meta">Owner: ${escapeHtml(a.owner)}</div>` : ''}
        </div>
      `).join('');
    }
    
    if (questions.length > 0) {
      html += `<div class="section-title section-title-mt">Questions (${questions.length})</div>`;
      html += questions.map(q => `
        <div class="entity-card">
          <div class="entity-content">${escapeHtml(q.content)}</div>
        </div>
      `).join('');
    }
    
    extractionContainer.innerHTML = html;
  } else {
    extractionContainer.innerHTML = '<div class="empty-section">No extraction results available</div>';
  }
  
  // Update notes tab
  const notesContainer = container.querySelector('#notes-container') as HTMLElement;
  const notesTab = container.querySelector('#notes-tab') as HTMLElement;
  const notesText = extraction?.notes_rendered_text;
  
  if (notesText) {
    if (notesTab) notesTab.classList.remove('hidden');
    notesContainer.innerHTML = `
      <div class="notes-rendered">
        ${renderNotesAsHtml(notesText)}
        <div class="conv-notes-actions-mt">
          <button class="btn btn-secondary btn-sm" id="copy-notes-btn">📋 Copy Notes</button>
        </div>
      </div>
    `;
    
    container.querySelector('#copy-notes-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(notesText);
      toast.success('Notes copied to clipboard');
    });
  } else if (extraction?.notes?.outline?.length) {
    if (notesTab) notesTab.classList.remove('hidden');
    const outline = extraction.notes.outline;
    notesContainer.innerHTML = `
      <div class="notes-rendered">
        ${outline.map(t => `
          <div class="notes-topic">
            <div class="notes-topic-title">${escapeHtml(t.topic)}</div>
            ${t.bullets?.map(b => `<div class="notes-bullet">${escapeHtml(b.text)}</div>`).join('') || ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

/**
 * Render notes text as HTML
 */
function renderNotesAsHtml(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let currentTopic = '';
  let bulletsHtml = '';
  let headerDone = false;
  let metaDone = false;
  
  const flushTopic = () => {
    if (currentTopic && bulletsHtml) {
      html += `
        <div class="notes-topic">
          <div class="notes-topic-title">${escapeHtml(currentTopic)}</div>
          ${bulletsHtml}
        </div>
      `;
    }
    currentTopic = '';
    bulletsHtml = '';
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (!headerDone && trimmed.startsWith('📝')) {
      html += `<div class="notes-header">${escapeHtml(trimmed)}</div>`;
      headerDone = true;
      continue;
    }
    
    if (!metaDone && trimmed.startsWith('🕞')) {
      html += `<div class="notes-meta">${escapeHtml(trimmed)}</div>`;
      metaDone = true;
      continue;
    }
    
    if (trimmed.startsWith('-')) {
      const bulletText = trimmed.substring(1).trim();
      bulletsHtml += `<div class="notes-bullet">${escapeHtml(bulletText)}</div>`;
      continue;
    }
    
    flushTopic();
    currentTopic = trimmed;
  }
  
  flushTopic();
  
  if (!html.includes('notes-topic')) {
    return `<pre class="conv-notes-pre">${escapeHtml(text)}</pre>`;
  }
  
  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showConversationPreviewModal;
