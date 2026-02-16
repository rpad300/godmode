/**
 * AICopilot - AI-powered chat for the Knowledge Graph
 * 
 * Features:
 * - Natural language queries using GraphRAG
 * - Voice input (Web Speech API)
 * - Reasoning chain visualization
 * - Node highlighting
 * - Query suggestions
 * - Persistent chat history
 */

import { createElement, on } from '@lib/dom';
import { graphService, GraphRAGResponse, GraphChatMessage } from '@services/graph';
import { toast } from '@services/toast';

export interface AICopilotProps {
  onClose?: () => void;
  onHighlightNodes?: (nodeIds: string[]) => void;
  onExecuteQuery?: (cypher: string) => void;
}

interface CopilotState {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: GraphRAGResponse;
    timestamp: Date;
  }>;
  isLoading: boolean;
  sessionId: string;
  isRecording: boolean;
}

/**
 * Create the AI Copilot component
 */
export function createAICopilot(props: AICopilotProps = {}): HTMLElement {
  const state: CopilotState = {
    messages: [],
    isLoading: false,
    sessionId: crypto.randomUUID(),
    isRecording: false,
  };

  const container = createElement('div', { className: 'ai-copilot' });

  container.innerHTML = `
    <div class="copilot-header">
      <div class="copilot-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 6v1M12 17v1M6 12h1M17 12h1"/>
        </svg>
        <span>AI Copilot</span>
      </div>
      <div class="copilot-actions">
        <button class="copilot-btn" id="copilot-history" title="Chat History">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
        <button class="copilot-btn" id="copilot-clear" title="Clear Chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <button class="copilot-btn" id="copilot-close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="copilot-messages" id="copilot-messages">
      <div class="copilot-welcome">
        <div class="welcome-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h3>Hello! I'm your AI assistant.</h3>
        <p>Ask me anything about your knowledge graph. I can help you:</p>
        <ul class="welcome-list">
          <li>Find connections between people and projects</li>
          <li>Explain relationships and patterns</li>
          <li>Summarize information about entities</li>
          <li>Generate Cypher queries</li>
        </ul>
      </div>
    </div>
    
    <div class="copilot-suggestions" id="copilot-suggestions">
      <button class="suggestion-chip" data-query="Who are the key people in this project?">
        Key people
      </button>
      <button class="suggestion-chip" data-query="What are the main risks?">
        Main risks
      </button>
      <button class="suggestion-chip" data-query="Show recent decisions">
        Recent decisions
      </button>
      <button class="suggestion-chip" data-query="Find connections between teams">
        Team connections
      </button>
    </div>
    
    <div class="copilot-input-area">
      <div class="copilot-input-wrapper">
        <textarea
          id="copilot-input"
          class="copilot-input"
          placeholder="Ask about your knowledge graph..."
          rows="1"
        ></textarea>
        <button class="copilot-voice-btn ${isVoiceSupported() ? '' : 'hidden'}" id="copilot-voice" title="Voice Input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      </div>
      <button class="copilot-send-btn" id="copilot-send" title="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  `;

  // Initialize
  initCopilot(container, state, props);

  return container;
}

/**
 * Initialize the copilot
 */
function initCopilot(container: HTMLElement, state: CopilotState, props: AICopilotProps): void {
  const messagesEl = container.querySelector('#copilot-messages') as HTMLElement;
  const inputEl = container.querySelector('#copilot-input') as HTMLTextAreaElement;
  const sendBtn = container.querySelector('#copilot-send') as HTMLElement;
  const voiceBtn = container.querySelector('#copilot-voice') as HTMLElement;
  const clearBtn = container.querySelector('#copilot-clear') as HTMLElement;
  const closeBtn = container.querySelector('#copilot-close') as HTMLElement;
  const historyBtn = container.querySelector('#copilot-history') as HTMLElement;

  // Send message
  const sendMessage = async () => {
    const query = inputEl.value.trim();
    if (!query || state.isLoading) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    await processQuery(container, state, query, props);
  };

  // Bind send button
  on(sendBtn, 'click', sendMessage);

  // Bind enter key
  on(inputEl, 'keydown', (e: Event) => {
    const event = e as KeyboardEvent;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  on(inputEl, 'input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // Voice input
  if (voiceBtn && isVoiceSupported()) {
    on(voiceBtn, 'click', () => toggleVoiceInput(container, state, inputEl));
  }

  // Clear chat
  on(clearBtn, 'click', () => {
    state.messages = [];
    state.sessionId = crypto.randomUUID();
    messagesEl.innerHTML = getWelcomeHTML();
  });

  // Close
  on(closeBtn, 'click', () => props.onClose?.());

  // History
  on(historyBtn, 'click', () => showChatHistory(container));

  // Suggestion chips
  const chips = container.querySelectorAll('.suggestion-chip');
  chips.forEach(chip => {
    on(chip as HTMLElement, 'click', () => {
      const query = chip.getAttribute('data-query');
      if (query) {
        inputEl.value = query;
        sendMessage();
      }
    });
  });

  // Load previous session if exists
  loadSession(state);
}

/**
 * Process query
 */
async function processQuery(
  container: HTMLElement,
  state: CopilotState,
  query: string,
  props: AICopilotProps
): Promise<void> {
  state.isLoading = true;
  const messagesEl = container.querySelector('#copilot-messages') as HTMLElement;
  const suggestionsEl = container.querySelector('#copilot-suggestions') as HTMLElement;

  // Hide welcome and suggestions
  const welcome = messagesEl.querySelector('.copilot-welcome');
  if (welcome) welcome.remove();
  suggestionsEl.classList.add('hidden');

  // Add user message
  const userMessage = { role: 'user' as const, content: query, timestamp: new Date() };
  state.messages.push(userMessage);
  appendMessage(messagesEl, userMessage);

  // Add loading indicator
  const loadingEl = createElement('div', { className: 'copilot-message assistant loading' });
  loadingEl.innerHTML = `
    <div class="message-avatar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(loadingEl);
  scrollToBottom(messagesEl);

  try {
    // Call GraphRAG
    const response = await graphService.query(query);

    // Remove loading
    loadingEl.remove();

    // Add assistant message
    const assistantMessage = {
      role: 'assistant' as const,
      content: response.answer,
      metadata: response,
      timestamp: new Date(),
    };
    state.messages.push(assistantMessage);
    appendMessage(messagesEl, assistantMessage, props);

    // Save to history
    saveMessage(state, userMessage);
    saveMessage(state, assistantMessage);

    // Highlight nodes if available
    if (response.highlightedNodes?.length && props.onHighlightNodes) {
      props.onHighlightNodes(response.highlightedNodes);
    }

  } catch (error) {
    loadingEl.remove();
    const errorMessage = {
      role: 'assistant' as const,
      content: 'Sorry, I encountered an error processing your question. Please try again.',
      timestamp: new Date(),
    };
    state.messages.push(errorMessage);
    appendMessage(messagesEl, errorMessage);
  }

  state.isLoading = false;
  scrollToBottom(messagesEl);
}

/**
 * Append message to chat
 */
function appendMessage(
  container: HTMLElement,
  message: { role: 'user' | 'assistant' | 'system'; content: string; metadata?: GraphRAGResponse; timestamp: Date },
  props?: AICopilotProps
): void {
  const el = createElement('div', { className: `copilot-message ${message.role}` });

  if (message.role === 'user') {
    el.innerHTML = `
      <div class="message-content">${escapeHtml(message.content)}</div>
      <div class="message-avatar user-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    `;
  } else {
    const meta = message.metadata;

    el.innerHTML = `
      <div class="message-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-text">${formatMarkdown(message.content)}</div>
        
        ${meta?.reasoningChain?.length ? `
          <div class="reasoning-chain">
            <button class="reasoning-toggle" data-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              Reasoning Chain (${meta.reasoningChain.length} steps)
            </button>
            <div class="reasoning-steps hidden">
              ${meta.reasoningChain.map((step, i) => `
                <div class="reasoning-step">
                  <div class="step-number">${i + 1}</div>
                  <div class="step-content">
                    <div class="step-name">${escapeHtml(step.step)}</div>
                    ${step.reasoning ? `<div class="step-reasoning">${escapeHtml(step.reasoning)}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${meta?.cypherGenerated ? `
          <div class="cypher-preview">
            <button class="cypher-toggle" data-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Generated Cypher
            </button>
            <div class="cypher-code hidden">
              <pre><code>${escapeHtml(meta.cypherGenerated)}</code></pre>
              <button class="cypher-run-btn" title="Execute Query">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run
              </button>
            </div>
          </div>
        ` : ''}
        
        ${meta?.sources?.length ? `
          <div class="message-sources">
            <span class="sources-label">Sources:</span>
            ${meta.sources.slice(0, 3).map(s => `
              <span class="source-chip">${s.type}</span>
            `).join('')}
            ${meta.sources.length > 3 ? `<span class="source-more">+${meta.sources.length - 3} more</span>` : ''}
          </div>
        ` : ''}
        
        <div class="message-meta">
          <span class="meta-type">${meta?.queryType || 'hybrid'}</span>
          ${meta?.latencyMs ? `<span class="meta-latency">${meta.latencyMs}ms</span>` : ''}
          ${meta?.confidence ? `<span class="meta-confidence">${Math.round(meta.confidence * 100)}% confident</span>` : ''}
        </div>
      </div>
    `;

    // Bind reasoning toggle
    setTimeout(() => {
      const reasoningToggle = el.querySelector('.reasoning-toggle');
      if (reasoningToggle) {
        on(reasoningToggle as HTMLElement, 'click', () => {
          const steps = el.querySelector('.reasoning-steps');
          const expanded = reasoningToggle.getAttribute('data-expanded') === 'true';
          reasoningToggle.setAttribute('data-expanded', String(!expanded));
          steps?.classList.toggle('hidden');
          const icon = reasoningToggle.querySelector('svg');
          if (icon) icon.style.transform = expanded ? '' : 'rotate(90deg)';
        });
      }

      const cypherToggle = el.querySelector('.cypher-toggle');
      if (cypherToggle) {
        on(cypherToggle as HTMLElement, 'click', () => {
          const code = el.querySelector('.cypher-code');
          const expanded = cypherToggle.getAttribute('data-expanded') === 'true';
          cypherToggle.setAttribute('data-expanded', String(!expanded));
          code?.classList.toggle('hidden');
        });
      }

      const cypherRunBtn = el.querySelector('.cypher-run-btn');
      if (cypherRunBtn && meta?.cypherGenerated && props?.onExecuteQuery) {
        on(cypherRunBtn as HTMLElement, 'click', () => {
          props.onExecuteQuery!(meta.cypherGenerated!);
          toast.info('Executing query...');
        });
      }
    }, 0);
  }

  container.appendChild(el);
}

/**
 * Toggle voice input
 */
function toggleVoiceInput(container: HTMLElement, state: CopilotState, inputEl: HTMLTextAreaElement): void {
  if (!isVoiceSupported()) {
    toast.error('Voice input not supported in this browser');
    return;
  }

  const voiceBtn = container.querySelector('#copilot-voice') as HTMLElement;

  if (state.isRecording) {
    // Stop recording
    state.isRecording = false;
    voiceBtn.classList.remove('recording');
    // Recognition will be stopped by the recognition object
  } else {
    // Start recording
    state.isRecording = true;
    voiceBtn.classList.add('recording');

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Speech recognition not available');
      state.isRecording = false;
      voiceBtn.classList.remove('recording');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'pt-PT'; // Portuguese, change as needed

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      inputEl.value = transcript;
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    };

    recognition.onend = () => {
      state.isRecording = false;
      voiceBtn.classList.remove('recording');
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      state.isRecording = false;
      voiceBtn.classList.remove('recording');
      if (event.error !== 'aborted') {
        toast.error('Voice recognition failed');
      }
    };

    recognition.start();
  }
}

/**
 * Check if voice is supported
 */
function isVoiceSupported(): boolean {
  return !!(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

/**
 * Show chat history
 */
async function showChatHistory(container: HTMLElement): Promise<void> {
  try {
    const sessions = await graphService.getChatSessions();

    if (sessions.length === 0) {
      toast.info('No chat history found');
      return;
    }

    // TODO: Show history modal
    toast.info(`${sessions.length} previous sessions found`);
  } catch {
    toast.error('Failed to load chat history');
  }
}

/**
 * Load session
 */
function loadSession(state: CopilotState): void {
  // Could load from localStorage for quick resume
  const saved = localStorage.getItem('copilot_session');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.sessionId && data.messages) {
        state.sessionId = data.sessionId;
        // Don't restore messages for now, start fresh
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Save message to Supabase
 */
async function saveMessage(
  state: CopilotState,
  message: { role: 'user' | 'assistant' | 'system'; content: string; metadata?: GraphRAGResponse }
): Promise<void> {
  try {
    await graphService.saveChatMessage({
      session_id: state.sessionId,
      role: message.role,
      content: message.content,
      metadata: message.metadata ? {
        queryType: message.metadata.queryType,
        cypherGenerated: message.metadata.cypherGenerated,
        sources: message.metadata.sources,
        reasoningChain: message.metadata.reasoningChain,
        highlightedNodes: message.metadata.highlightedNodes,
        executionTimeMs: message.metadata.latencyMs,
        confidence: message.metadata.confidence,
      } : undefined,
      is_pinned: false,
    });
  } catch {
    // Silent fail - don't interrupt UX
  }
}

/**
 * Get welcome HTML
 */
function getWelcomeHTML(): string {
  return `
    <div class="copilot-welcome">
      <div class="welcome-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <h3>Hello! I'm your AI assistant.</h3>
      <p>Ask me anything about your knowledge graph.</p>
    </div>
  `;
}

/**
 * Scroll to bottom
 */
function scrollToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}

/**
 * Format markdown (basic)
 */
function formatMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// TypeScript interfaces for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export default createAICopilot;
