/**
 * Conversations Panel Component
 * Conversation list with import and re-embed
 */

import { createElement, on } from '@lib/dom';
import { conversationsService } from '@services/documents';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';
import { showConversationComposer } from './ConversationComposer';
import { showConversationPreviewModal } from './modals/ConversationPreviewModal';

export interface ConversationsPanelProps {
  onConversationClick?: (conversation: Conversation) => void;
}

interface Conversation {
  id: string;
  title?: string;
  participants?: string[];
  message_count?: number;
  source?: string;
  created_at: string;
  embedded?: boolean;
}

/**
 * Create conversations panel
 */
export function createConversationsPanel(props: ConversationsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'conversations-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Conversations</h2>
        <span class="panel-count" id="conversations-count">0</span>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary btn-sm" id="import-conv-btn">Import</button>
      </div>
    </div>
    <div class="panel-content" id="conversations-content">
      <div class="loading">Loading conversations...</div>
    </div>
  `;

  // Bind import button
  const importBtn = panel.querySelector('#import-conv-btn');
  if (importBtn) {
    on(importBtn as HTMLElement, 'click', () => showImportDialog(panel, props));
  }

  // Initial load
  loadConversations(panel, props);

  return panel;
}

/**
 * Load conversations
 */
async function loadConversations(panel: HTMLElement, props: ConversationsPanelProps): Promise<void> {
  const content = panel.querySelector('#conversations-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const conversations = await conversationsService.getAll();
    renderConversations(content, conversations, props);
    updateCount(panel, conversations.length);
  } catch {
    content.innerHTML = '<div class="error">Failed to load conversations</div>';
  }
}

/**
 * Render conversations
 */
function renderConversations(
  container: HTMLElement,
  conversations: Conversation[],
  props: ConversationsPanelProps
): void {
  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No conversations imported</p>
        <p class="text-muted">Import chat transcripts, meeting notes, or message threads</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="conversations-list">
      ${conversations.map(conv => createConversationCard(conv)).join('')}
    </div>
  `;

  // Bind events
  container.querySelectorAll('.conversation-card').forEach(card => {
    on(card as HTMLElement, 'click', async (e) => {
      if ((e.target as HTMLElement).closest('.conv-actions')) return;

      const id = card.getAttribute('data-id');
      const conv = conversations.find(c => c.id === id);
      if (conv) {
        // Fetch full conversation with metadata
        try {
          const fullConv = await conversationsService.getById(id!);
          showConversationPreviewModal(fullConv as any);
        } catch {
          // Fallback to basic data
          showConversationPreviewModal(conv as any);
        }

        if (props.onConversationClick) {
          props.onConversationClick(conv);
        }
      }
    });

    // Re-embed button
    const reembedBtn = card.querySelector('.reembed-btn');
    if (reembedBtn) {
      on(reembedBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        if (!id) return;

        const btn = reembedBtn as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
          await conversationsService.reembed(id);
          toast.success('Conversation re-embedded');
          loadConversations(container.closest('.conversations-panel') as HTMLElement, props);
        } catch {
          toast.error('Failed to re-embed conversation');
          btn.disabled = false;
          btn.textContent = 'Re-embed';
        }
      });
    }

    // Delete button
    const deleteBtn = card.querySelector('.delete-conv-btn');
    if (deleteBtn) {
      on(deleteBtn as HTMLElement, 'click', async (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-id');
        if (!id) return;

        if (!confirm('Delete this conversation?')) return;

        try {
          await conversationsService.delete(id);
          toast.success('Conversation deleted');
          loadConversations(container.closest('.conversations-panel') as HTMLElement, props);
        } catch {
          toast.error('Failed to delete conversation');
        }
      });
    }
  });
}

/**
 * Create conversation card HTML
 */
function createConversationCard(conv: Conversation): string {
  return `
    <div class="conversation-card" data-id="${conv.id}">
      <div class="conv-icon">💬</div>
      <div class="conv-info">
        <div class="conv-title">${escapeHtml(conv.title || 'Untitled Conversation')}</div>
        <div class="conv-meta">
          ${conv.participants ? `<span>${conv.participants.length} participants</span>` : ''}
          ${conv.message_count ? `<span>${conv.message_count} messages</span>` : ''}
          <span>${formatRelativeTime(conv.created_at)}</span>
        </div>
      </div>
      <div class="conv-status">
        ${conv.embedded
      ? '<span class="embedded-badge">Embedded</span>'
      : '<span class="not-embedded-badge">Not embedded</span>'
    }
      </div>
      <div class="conv-actions">
        <button class="btn btn-sm reembed-btn">Re-embed</button>
        <button class="btn btn-sm btn-danger delete-conv-btn">Delete</button>
      </div>
    </div>
  `;
}

/**
 * Show import dialog using ConversationComposer
 */
function showImportDialog(panel: HTMLElement, props: ConversationsPanelProps): void {
  showConversationComposer({
    onImport: () => {
      loadConversations(panel, props);
    },
    onClose: () => {
      // Nothing to do on close
    }
  });
}

/**
 * Update count
 */
function updateCount(panel: HTMLElement, count: number): void {
  const countEl = panel.querySelector('#conversations-count');
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

export default createConversationsPanel;
