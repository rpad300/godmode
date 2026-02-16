/**
 * Briefing Panel Component
 * Displays daily AI-generated briefing with history
 */

import { createElement, on } from '@lib/dom';
import { chatService, Briefing, BriefingHistoryItem } from '@services/chat';
import { toast } from '@services/toast';
import { formatRelativeTime } from '@lib/format';

export interface BriefingPanelProps {
  onActionClick?: (action: { type: string; id: string }) => void;
}

let currentBriefing: Briefing | null = null;
let showHistory = false;

/**
 * Create briefing panel
 */
export function createBriefingPanel(props: BriefingPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'briefing-panel' });

  panel.innerHTML = `
    <div class="briefing-header">
      <h2>Daily Briefing</h2>
      <div class="briefing-actions">
        <button class="btn btn-sm" id="toggle-history-btn">History</button>
        <button class="btn btn-sm btn-primary" id="refresh-briefing-btn">Refresh</button>
      </div>
    </div>
    <div class="briefing-content" id="briefing-content">
      <div class="loading">Generating briefing...</div>
    </div>
    <div class="briefing-history hidden" id="briefing-history"></div>
  `;

  // Bind events
  const refreshBtn = panel.querySelector('#refresh-briefing-btn');
  if (refreshBtn) {
    on(refreshBtn as HTMLElement, 'click', () => loadBriefing(panel, true, props));
  }

  const historyBtn = panel.querySelector('#toggle-history-btn');
  if (historyBtn) {
    on(historyBtn as HTMLElement, 'click', () => {
      showHistory = !showHistory;
      const historyContainer = panel.querySelector('#briefing-history') as HTMLElement;
      historyContainer.classList.toggle('hidden', !showHistory);
      if (showHistory) {
        loadHistory(historyContainer);
      }
    });
  }

  // Initial load
  loadBriefing(panel, false, props);

  return panel;
}

/**
 * Load briefing
 */
async function loadBriefing(
  panel: HTMLElement,
  refresh: boolean,
  props: BriefingPanelProps
): Promise<void> {
  const content = panel.querySelector('#briefing-content') as HTMLElement;
  content.innerHTML = '<div class="loading">Generating briefing...</div>';

  try {
    const briefing = await chatService.getBriefing(refresh);
    currentBriefing = briefing;
    renderBriefing(content, briefing, props);
  } catch {
    content.innerHTML = '<div class="error">Failed to generate briefing</div>';
  }
}

/**
 * Render briefing content
 */
function renderBriefing(
  container: HTMLElement,
  briefing: Briefing,
  props: BriefingPanelProps
): void {
  container.innerHTML = `
    <div class="briefing-meta">
      <span class="briefing-date">${formatDate(briefing.generated_at)}</span>
      ${briefing.cached ? `<span class="cached-badge">Cached</span>` : ''}
    </div>

    <div class="briefing-text">
      ${renderMarkdown(briefing.briefing)}
    </div>

    ${briefing.analysis ? `
      <div class="briefing-analysis">
        <h4>Analysis</h4>
        <div class="analysis-content">${renderMarkdown(briefing.analysis)}</div>
      </div>
    ` : ''}

  `;
}

/**
 * Load briefing history
 */
async function loadHistory(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div class="loading">Loading history...</div>';

  try {
    const history = await chatService.getBriefingHistory(10);

    if (!history || history.length === 0) {
      container.innerHTML = '<p class="empty">No previous briefings</p>';
      return;
    }

    container.innerHTML = `
      <h4>Previous Briefings</h4>
      <div class="history-list">
        ${history.map((item: BriefingHistoryItem) => `
          <div class="history-item" data-id="${item.id}">
            <div class="history-date">${formatDate(item.generated_at)}</div>
            <div class="history-preview">${escapeHtml(item.briefing.substring(0, 150))}...</div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind click events
    container.querySelectorAll('.history-item').forEach(item => {
      on(item as HTMLElement, 'click', () => {
        const id = item.getAttribute('data-id');
        const historyItem = history.find((h: BriefingHistoryItem) => h.id === id);
        if (historyItem) {
          showHistoryDetail(container.closest('.briefing-panel') as HTMLElement, historyItem);
        }
      });
    });
  } catch {
    container.innerHTML = '<div class="error">Failed to load history</div>';
  }
}

/**
 * Show history detail
 */
function showHistoryDetail(panel: HTMLElement, item: BriefingHistoryItem): void {
  const content = panel.querySelector('#briefing-content') as HTMLElement;

  content.innerHTML = `
    <div class="history-detail">
      <button class="btn btn-sm back-btn" id="back-to-current">← Back to current</button>
      <div class="briefing-meta">
        <span class="briefing-date">${formatDate(item.generated_at)}</span>
        <span class="history-badge">Historical</span>
      </div>
      <div class="briefing-text">${renderMarkdown(item.briefing)}</div>
    </div>
  `;

  const backBtn = content.querySelector('#back-to-current');
  if (backBtn && currentBriefing) {
    on(backBtn as HTMLElement, 'click', () => {
      renderBriefing(content, currentBriefing!, {});
    });
  }
}

/**
 * Simple markdown renderer
 */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^## (.*$)/gm, '<h4>$1</h4>')
    .replace(/^# (.*$)/gm, '<h3>$1</h3>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hul])/g, '$1')
    .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
}

/**
 * Format date
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format label
 */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createBriefingPanel;
