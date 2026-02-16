/**
 * Chat Component
 * AI chat interface with multiple sessions, persistence, and contact pills
 */

import { createElement, on, scrollIntoView } from '@lib/dom';
import { dataStore, ChatMessage, ChatSource, ChatRAGInfo } from '@stores/data';
import { http } from '@services/api';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

interface ChatSession {
  id: string;
  title: string;
  context_contact_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactOption {
  id: string;
  name: string;
  role?: string;
  organization?: string;
}

interface ChatAPIResponse {
  success: boolean;
  response: string;
  sessionId?: string;
  model?: string;
  provider?: string;
  confidence?: 'high' | 'medium' | 'low';
  contextQuality?: string;
  queryType?: string;
  sources?: ChatSource[];
  rag?: ChatRAGInfo;
}

export interface ChatProps {
  onSend?: (message: string) => Promise<void>;
  placeholder?: string;
  showSources?: boolean;
  showSessions?: boolean; // Show sidebar with multiple conversations
}

/**
 * Create chat component
 */
export function createChat(props: ChatProps = {}): HTMLElement {
  const showSessions = props.showSessions !== false;

  const chat = createElement('div', { className: 'chat-layout' });

  // State for multiple sessions
  let currentSessionId: string | null = null;
  let sessions: ChatSession[] = [];
  let contacts: ContactOption[] = [];

  // Sidebar (sessions list)
  const sidebar = createElement('div', { className: 'chat-sidebar' });
  const newChatBtn = createElement('button', {
    className: 'chat-new-conversation',
    innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nova conversa`
  });
  const newChatContextWrap = createElement('div', { className: 'chat-new-context-wrap' });
  const newChatContextLabel = createElement('span', { className: 'chat-new-context-label', textContent: 'Como quem?' });
  const newChatContextSelect = createElement('select', { className: 'chat-new-context-select' }) as HTMLSelectElement;
  newChatContextWrap.appendChild(newChatContextLabel);
  newChatContextWrap.appendChild(newChatContextSelect);
  const sessionsList = createElement('div', { className: 'chat-sessions-list' });
  sidebar.appendChild(newChatBtn);
  sidebar.appendChild(newChatContextWrap);
  sidebar.appendChild(sessionsList);

  // Main area
  const mainArea = createElement('div', { className: 'chat-main' });
  const chatContainer = createElement('div', { className: 'chat-container' });

  // Chat header: "Como quem?" context selector
  const chatHeader = createElement('div', { className: 'chat-header' });
  const contextLabel = createElement('label', { className: 'chat-context-label', textContent: 'Como quem?' });
  const contextSelect = createElement('select', { className: 'chat-context-select' }) as HTMLSelectElement;
  chatHeader.appendChild(contextLabel);
  chatHeader.appendChild(contextSelect);

  async function loadContacts(): Promise<void> {
    try {
      const res = await http.get<{ contacts?: Array<{ id: string; name: string; role?: string; organization?: string }> }>('/api/contacts');
      contacts = res.data?.contacts || [];
      renderContextSelect();
    } catch {
      contacts = [];
    }
  }

  function renderContextSelect(): void {
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const currentContextId = currentSession?.context_contact_id || null;
    contextSelect.innerHTML = `<option value="">Sem contexto</option>${contacts.map(c => `<option value="${c.id}" ${c.id === currentContextId ? 'selected' : ''}>${escapeHtml(c.name)}${c.role ? ` - ${c.role}` : ''}${c.organization ? ` (${c.organization})` : ''}</option>`).join('')}`;
    contextSelect.disabled = !currentSessionId;
  }

  function renderNewChatContextSelect(): void {
    newChatContextSelect.innerHTML = `<option value="">Sem contexto</option>${contacts.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.role ? ` - ${c.role}` : ''}${c.organization ? ` (${c.organization})` : ''}</option>`).join('')}`;
  }

  async function onContextChange(): Promise<void> {
    if (!currentSessionId) return;
    const contactId = contextSelect.value || null;
    try {
      await http.put(`/api/chat/sessions/${currentSessionId}`, { contextContactId: contactId });
      const idx = sessions.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) sessions[idx] = { ...sessions[idx], context_contact_id: contactId };
      toast.success('Contexto actualizado');
    } catch (e) {
      toast.error('Falha ao actualizar contexto');
      console.error('[Chat] Update context error:', e);
      renderContextSelect();
    }
  }

  // Messages container
  const messagesContainer = createElement('div', { className: 'chat-messages' });

  // Input container
  const inputContainer = createElement('div', { className: 'chat-input-container' });

  const input = createElement('textarea', {
    className: 'chat-input',
    placeholder: props.placeholder || 'Ask a question about your project...',
  }) as HTMLTextAreaElement;

  const sendBtn = createElement('button', {
    className: 'chat-send-btn',
    innerHTML: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
    </svg>`,
  });

  // Auto-resize textarea
  on(input, 'input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Send on Enter (Shift+Enter for new line)
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Send button click
  on(sendBtn, 'click', handleSend);

  let isLoading = false;

  async function loadSessions(): Promise<void> {
    try {
      const res = await http.get<{ ok: boolean; sessions?: ChatSession[] }>('/api/chat/sessions');
      sessions = res.data?.sessions || [];
      renderSessionsList();
    } catch {
      sessions = [];
    }
  }

  function renderSessionsList(): void {
    sessionsList.innerHTML = sessions.map(s => `
      <button class="chat-session-item ${s.id === currentSessionId ? 'active' : ''}" data-session-id="${s.id}">
        <span class="session-title">${escapeHtml(s.title.length > 40 ? s.title.substring(0, 37) + '...' : s.title)}</span>
        <span class="session-date">${formatRelativeTime(s.updated_at)}</span>
      </button>
    `).join('');
    sessionsList.querySelectorAll('.chat-session-item').forEach(btn => {
      on(btn as HTMLElement, 'click', () => selectSession((btn as HTMLElement).getAttribute('data-session-id')!));
    });
  }

  async function loadMessages(sessionId: string): Promise<void> {
    try {
      const res = await http.get<{ ok: boolean; messages?: Array<{ id: string; role: string; content: string; sources?: ChatSource[]; metadata?: Record<string, unknown>; created_at: string }> }>(`/api/chat/sessions/${sessionId}/messages`);
      const msgs = res.data?.messages || [];
      dataStore.setChatHistory(msgs.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.created_at,
        sources: m.sources,
        queryType: m.metadata?.queryType as string | undefined,
        confidence: m.metadata?.confidence as 'high' | 'medium' | 'low' | undefined
      })));
    } catch {
      dataStore.setChatHistory([]);
    }
  }

  async function selectSession(sessionId: string): Promise<void> {
    currentSessionId = sessionId;
    renderSessionsList();
    dataStore.clearChatHistory();
    await loadMessages(sessionId);
    messagesContainer.innerHTML = '';
    dataStore.getState().chatHistory.forEach(msg => renderMessage(msg, messagesContainer, props.showSources));
  }

  async function createNewSession(contextContactId?: string | null): Promise<void> {
    try {
      const res = await http.post<{ ok: boolean; session?: { id: string; title?: string; context_contact_id?: string | null; created_at?: string; updated_at?: string } }>('/api/chat/sessions', { title: 'Nova conversa', contextContactId: contextContactId || null });
      const session = res.data?.session;
      if (session) {
        sessions.unshift({
          id: session.id,
          title: session.title || 'Nova conversa',
          context_contact_id: session.context_contact_id ?? null,
          created_at: session.created_at || new Date().toISOString(),
          updated_at: session.updated_at || new Date().toISOString()
        });
        await selectSession(session.id);
        renderSessionsList();
      }
    } catch (e) {
      toast.error('Failed to create new conversation');
      console.error('[Chat] Create session error:', e);
    }
  }

  async function handleSend(): Promise<void> {
    const message = input.value.trim();
    if (!message || isLoading) return;

    input.value = '';
    input.style.height = 'auto';
    isLoading = true;
    sendBtn.setAttribute('disabled', 'true');

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    dataStore.addChatMessage(userMessage);
    renderMessage(userMessage, messagesContainer);

    // Show loading
    const loadingEl = createElement('div', { className: 'chat-loading' });
    loadingEl.innerHTML = `
      <div class="chat-loading-dots">
        <span></span><span></span><span></span>
      </div>
      <span>Thinking...</span>
    `;
    messagesContainer.appendChild(loadingEl);
    scrollToBottom(messagesContainer);

    try {
      if (props.onSend) {
        await props.onSend(message);
      } else {
        const response = await http.post<ChatAPIResponse>('/api/chat', {
          message,
          history: dataStore.getState().chatHistory.slice(-10),
          sessionId: currentSessionId,
        });

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date().toISOString(),
          sources: response.data.sources,
          queryType: response.data.queryType,
          confidence: response.data.confidence,
          contextQuality: response.data.contextQuality,
          rag: response.data.rag,
        };
        dataStore.addChatMessage(assistantMessage);
        renderMessage(assistantMessage, messagesContainer, props.showSources);

        // Update current session if backend created one
        if (response.data.sessionId && !currentSessionId) {
          currentSessionId = response.data.sessionId;
          await loadSessions();
          renderSessionsList();
          renderContextSelect();
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: 'Failed to get response. Please try again.',
        timestamp: new Date().toISOString(),
      };
      renderMessage(errorMessage, messagesContainer);
    } finally {
      loadingEl.remove();
      isLoading = false;
      sendBtn.removeAttribute('disabled');
      input.focus();
    }
  }

  inputContainer.appendChild(input);
  inputContainer.appendChild(sendBtn);

  // Quick prompts
  const quickPrompts = createElement('div', { className: 'quick-prompts' });
  const prompts = [
    'Summarize key risks',
    'List open questions',
    'What actions are overdue?',
    'Who are the key contacts?',
  ];

  prompts.forEach(prompt => {
    const btn = createElement('button', {
      className: 'quick-prompt',
      textContent: prompt,
    });
    on(btn, 'click', () => {
      input.value = prompt;
      handleSend();
    });
    quickPrompts.appendChild(btn);
  });

  // Layout assembly
  on(contextSelect, 'change', onContextChange);
  chatContainer.appendChild(chatHeader);
  chatContainer.appendChild(messagesContainer);
  chatContainer.appendChild(quickPrompts);
  chatContainer.appendChild(inputContainer);
  mainArea.appendChild(chatContainer);

  if (showSessions) {
    chat.appendChild(sidebar);
    on(newChatBtn as HTMLElement, 'click', () => createNewSession());
    loadContacts().then(() => renderNewChatContextSelect());
    loadSessions();
  } else {
    chatHeader.classList.add('hidden');
  }
  chat.appendChild(mainArea);

  // Render existing messages (from dataStore - may be empty initially)
  const existingMessages = dataStore.getState().chatHistory;
  existingMessages.forEach(msg => renderMessage(msg, messagesContainer, props.showSources));

  return chat;
}

/**
 * Render a chat message with SOTA RAG info
 */
function renderMessage(
  message: ChatMessage,
  container: HTMLElement,
  showSources = true
): HTMLElement {
  const msgEl = createElement('div', {
    className: `chat-message ${message.role}`,
  });

  let content = escapeHtml(message.content);

  // Parse markdown-like formatting
  content = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  msgEl.innerHTML = `<div class="chat-message-content">${content}</div>`;

  // Add RAG metadata badge for assistant messages
  if (message.role === 'assistant' && (message.confidence || message.rag)) {
    const metaEl = createElement('div', { className: 'chat-meta' });
    const confidenceClass = message.confidence === 'high' ? 'confidence-high' :
      message.confidence === 'medium' ? 'confidence-medium' : 'confidence-low';

    let metaHtml = '';

    // Confidence badge
    if (message.confidence) {
      metaHtml += `<span class="chat-badge ${confidenceClass}" title="Confidence level">${message.confidence}</span>`;
    }

    // Query type badge
    if (message.queryType) {
      metaHtml += `<span class="chat-badge query-type" title="Query classification">${message.queryType}</span>`;
    }

    // RAG method badge
    if (message.rag) {
      const methodLabel = message.rag.usedHyDE ? 'HyDE+RRF' :
        message.rag.graphResults > 0 ? 'Graph+Vector' : 'Hybrid';
      metaHtml += `<span class="chat-badge rag-method" title="RAG method: ${message.rag.method}">${methodLabel}</span>`;

      // Sources count
      const totalSources = message.rag.fusedResults || (message.rag.vectorResults + message.rag.graphResults);
      if (totalSources > 0) {
        metaHtml += `<span class="chat-badge sources-count" title="Sources found">${totalSources} sources</span>`;
      }
    }

    metaEl.innerHTML = metaHtml;
    msgEl.appendChild(metaEl);
  }

  // Add detailed sources if present
  if (showSources && message.sources && message.sources.length > 0) {
    const sourcesEl = createElement('div', { className: 'chat-sources' });

    // Handle both string[] (legacy) and ChatSource[] (SOTA) formats
    if (typeof message.sources[0] === 'string') {
      // Legacy format
      sourcesEl.innerHTML = `
        <span class="sources-label">Sources:</span>
        ${(message.sources as string[]).map(s => `<span class="source-link">${escapeHtml(s)}</span>`).join('')}
      `;
    } else {
      // SOTA format with detailed sources and contact pills
      const sources = message.sources as ChatSource[];
      const contactSources = sources.filter(s => s.contactName);
      const otherSources = sources.filter(s => !s.contactName);
      const topSources = otherSources.slice(0, 5);

      // Contact pills (avatar + name + role)
      if (contactSources.length > 0) {
        const pillsEl = createElement('div', { className: 'chat-contact-pills' });
        pillsEl.innerHTML = contactSources.map(s => `
          <div class="contact-pill">
            ${s.avatarUrl ? `<img class="contact-pill-avatar" src="${escapeHtml(s.avatarUrl)}" alt="" onerror="this.classList.add('hidden')"/>` : `<div class="contact-pill-avatar-placeholder">${escapeHtml((s.contactName || s.type || '?')[0])}</div>`}
            <div class="contact-pill-info">
              <span class="contact-pill-name">${escapeHtml(s.contactName || s.type || 'Contact')}</span>
              ${s.contactRole ? `<span class="contact-pill-role">${escapeHtml(s.contactRole)}</span>` : ''}
            </div>
          </div>
        `).join('');
        msgEl.appendChild(pillsEl);
      }

      sourcesEl.innerHTML = `
        <details class="sources-details">
          <summary class="sources-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            ${sources.length} sources used
          </summary>
          <div class="sources-list">
            ${topSources.map(s => `
              <div class="source-item">
                <span class="source-type">${escapeHtml(s.type || 'unknown')}</span>
                <span class="source-score" title="Relevance score">${Math.round((s.rrfScore || s.score || 0) * 100)}%</span>
                ${s.sourceCount && s.sourceCount > 1 ? `<span class="source-multi" title="Found in multiple searches">x${s.sourceCount}</span>` : ''}
                ${s.source ? `<span class="source-from">${escapeHtml(s.source)}</span>` : ''}
              </div>
            `).join('')}
            ${sources.length > 5 ? `<div class="sources-more">+${sources.length - 5} more</div>` : ''}
          </div>
        </details>
      `;
    }
    msgEl.appendChild(sourcesEl);
  }

  container.appendChild(msgEl);
  scrollToBottom(container);

  return msgEl;
}

/**
 * Scroll container to bottom
 */
function scrollToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Mount chat to container
 */
export function mountChat(selector: string, props: ChatProps = {}): HTMLElement | null {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`Chat: Container not found: ${selector}`);
    return null;
  }

  const chat = createChat(props);
  container.appendChild(chat);
  return chat;
}

export default createChat;
