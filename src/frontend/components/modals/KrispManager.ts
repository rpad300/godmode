/**
 * Krisp Manager Modal
 * Manage Krisp transcripts, quarantine, and speaker mappings
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { toast } from '../../services/toast';
import * as krispService from '../../services/krisp';
import type { KrispTranscript, KrispSpeakerMapping } from '../../services/krisp';

const MODAL_ID = 'krisp-manager-modal';

type TabId = 'transcripts' | 'quarantine' | 'mappings';

interface KrispManagerState {
  activeTab: TabId;
  transcripts: KrispTranscript[];
  quarantine: KrispTranscript[];
  mappings: KrispSpeakerMapping[];
  loading: boolean;
  selectedTranscript: KrispTranscript | null;
}

let state: KrispManagerState = {
  activeTab: 'transcripts',
  transcripts: [],
  quarantine: [],
  mappings: [],
  loading: false,
  selectedTranscript: null,
};

let containerRef: HTMLElement | null = null;

/**
 * Show Krisp Manager modal
 */
export async function showKrispManager(): Promise<void> {
  // Reset state
  state = {
    activeTab: 'transcripts',
    transcripts: [],
    quarantine: [],
    mappings: [],
    loading: false,
    selectedTranscript: null,
  };

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'krisp-manager' });
  containerRef = content;

  content.innerHTML = `
    <style>
      .krisp-manager {
        min-height: 500px;
      }
      .krisp-tabs {
        display: flex;
        gap: 4px;
        padding: 0 16px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        margin-bottom: 16px;
      }
      .krisp-tab {
        padding: 12px 20px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #64748b);
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: all 0.2s;
      }
      .krisp-tab:hover {
        color: var(--text-primary, #1e293b);
      }
      .krisp-tab.active {
        color: var(--primary, #e11d48);
        border-bottom-color: var(--primary, #e11d48);
      }
      .krisp-tab .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        margin-left: 8px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 10px;
        background: var(--bg-tertiary, #f1f5f9);
        color: var(--text-secondary, #64748b);
      }
      .krisp-tab.active .badge {
        background: var(--primary, #e11d48);
        color: white;
      }
      .krisp-tab .badge.warning {
        background: #fef3c7;
        color: #92400e;
      }
      .krisp-content {
        padding: 0 16px 16px;
      }
      .krisp-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .krisp-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .krisp-item:hover {
        background: var(--bg-tertiary, #f1f5f9);
      }
      .krisp-item-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--bg-tertiary, #f1f5f9);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .krisp-item-icon svg {
        width: 20px;
        height: 20px;
        color: var(--text-secondary, #64748b);
      }
      .krisp-item-content {
        flex: 1;
        min-width: 0;
      }
      .krisp-item-title {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .krisp-item-meta {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        display: flex;
        gap: 12px;
        margin-top: 2px;
      }
      .krisp-item-status {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
      }
      .status-pending { background: #dbeafe; color: #1e40af; }
      .status-quarantine { background: #fef3c7; color: #92400e; }
      .status-ambiguous { background: #fed7aa; color: #9a3412; }
      .status-matched { background: #cffafe; color: #0e7490; }
      .status-processed { background: #dcfce7; color: #166534; }
      .status-failed { background: #fecaca; color: #991b1b; }
      .status-skipped { background: #e2e8f0; color: #475569; }
      .krisp-item-actions {
        display: flex;
        gap: 8px;
      }
      .krisp-item-actions button {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 6px;
        border: 1px solid var(--border-color, #e2e8f0);
        background: white;
        cursor: pointer;
        transition: all 0.2s;
      }
      .krisp-item-actions button:hover {
        background: var(--bg-secondary, #f8fafc);
      }
      .krisp-item-actions button.primary {
        background: var(--primary, #e11d48);
        color: white;
        border-color: var(--primary, #e11d48);
      }
      .krisp-item-actions button.primary:hover {
        opacity: 0.9;
      }
      .krisp-empty {
        text-align: center;
        padding: 48px 16px;
        color: var(--text-secondary, #64748b);
      }
      .krisp-empty svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      .krisp-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px;
      }
      .mapping-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
      }
      .mapping-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mapping-arrow {
        color: var(--text-tertiary, #94a3b8);
      }
      .mapping-speaker {
        font-family: monospace;
        background: var(--bg-tertiary, #f1f5f9);
        padding: 4px 8px;
        border-radius: 4px;
      }
      .mapping-contact {
        font-weight: 500;
      }
      .mapping-badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #dbeafe;
        color: #1e40af;
      }
      [data-theme="dark"] .krisp-item,
      [data-theme="dark"] .mapping-item {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .krisp-item:hover {
        background: rgba(30,41,59,0.8);
      }
      [data-theme="dark"] .krisp-item-actions button {
        background: rgba(30,41,59,0.8);
        border-color: rgba(255,255,255,0.1);
      }
    </style>
    
    <div class="krisp-tabs">
      <button class="krisp-tab active" data-tab="transcripts">
        Transcripts
        <span class="badge" id="transcripts-count">0</span>
      </button>
      <button class="krisp-tab" data-tab="quarantine">
        Quarantine
        <span class="badge warning" id="quarantine-count">0</span>
      </button>
      <button class="krisp-tab" data-tab="mappings">
        Mappings
        <span class="badge" id="mappings-count">0</span>
      </button>
    </div>
    
    <div class="krisp-content" id="krisp-content">
      <div class="krisp-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  const modal = createModal({
    id: MODAL_ID,
    title: 'Krisp Transcripts',
    content,
    size: 'xl',
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Bind tab events
  bindTabEvents(content);

  // Load initial data
  await loadTabContent('transcripts');
}

/**
 * Bind tab switching events
 */
function bindTabEvents(container: HTMLElement): void {
  const tabs = container.querySelectorAll('.krisp-tab');
  tabs.forEach(tab => {
    on(tab as HTMLElement, 'click', async () => {
      const tabId = tab.getAttribute('data-tab') as TabId;
      if (tabId === state.activeTab) return;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTab = tabId;

      await loadTabContent(tabId);
    });
  });
}

/**
 * Load tab content
 */
async function loadTabContent(tabId: TabId): Promise<void> {
  if (!containerRef) return;

  const contentEl = containerRef.querySelector('#krisp-content');
  if (!contentEl) return;

  contentEl.innerHTML = '<div class="krisp-loading"><div class="loading-spinner"></div></div>';
  state.loading = true;

  try {
    switch (tabId) {
      case 'transcripts':
        await loadTranscripts(contentEl as HTMLElement);
        break;
      case 'quarantine':
        await loadQuarantine(contentEl as HTMLElement);
        break;
      case 'mappings':
        await loadMappings(contentEl as HTMLElement);
        break;
    }
  } catch (error) {
    console.error('[KrispManager] Error loading tab:', error);
    contentEl.innerHTML = '<div class="krisp-empty"><p>Failed to load. Please try again.</p></div>';
  } finally {
    state.loading = false;
  }
}

/**
 * Load transcripts list
 */
async function loadTranscripts(container: HTMLElement): Promise<void> {
  const transcripts = await krispService.getTranscripts({ limit: 50 });
  state.transcripts = transcripts;

  // Update badge
  updateBadge('transcripts-count', transcripts.length);

  if (transcripts.length === 0) {
    container.innerHTML = `
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Configure your Krisp webhook in Profile &gt; Integrations</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="krisp-list">${transcripts.map(t => renderTranscriptItem(t)).join('')}</div>`;
  bindTranscriptActions(container);
}

/**
 * Load quarantine list
 */
async function loadQuarantine(container: HTMLElement): Promise<void> {
  const quarantine = await krispService.getQuarantinedTranscripts();
  state.quarantine = quarantine;

  // Update badge
  updateBadge('quarantine-count', quarantine.length);

  if (quarantine.length === 0) {
    container.innerHTML = `
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No transcripts in quarantine</p>
        <p style="font-size: 12px; margin-top: 8px;">All speakers are identified correctly</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="krisp-list">${quarantine.map(t => renderQuarantineItem(t)).join('')}</div>`;
  bindQuarantineActions(container);
}

/**
 * Load mappings list
 */
async function loadMappings(container: HTMLElement): Promise<void> {
  const mappings = await krispService.getMappings();
  state.mappings = mappings;

  // Update badge
  updateBadge('mappings-count', mappings.length);

  if (mappings.length === 0) {
    container.innerHTML = `
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        <p>No speaker mappings</p>
        <p style="font-size: 12px; margin-top: 8px;">Mappings are created when you manually link speakers to contacts</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="krisp-list">${mappings.map(m => renderMappingItem(m)).join('')}</div>`;
  bindMappingActions(container);
}

/**
 * Render transcript item
 */
function renderTranscriptItem(transcript: KrispTranscript): string {
  const { label, color } = krispService.formatStatus(transcript.status);
  const duration = krispService.formatDuration(transcript.duration_minutes);
  const date = transcript.meeting_date ? new Date(transcript.meeting_date).toLocaleDateString() : '-';
  const speakers = transcript.speakers?.length || 0;

  return `
    <div class="krisp-item" data-id="${transcript.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${escapeHtml(transcript.display_title || transcript.krisp_title || 'Untitled Meeting')}</div>
        <div class="krisp-item-meta">
          <span>${date}</span>
          <span>${duration}</span>
          <span>${speakers} speakers</span>
          ${transcript.projects?.name ? `<span>${escapeHtml(transcript.projects.name)}</span>` : ''}
        </div>
      </div>
      <span class="krisp-item-status status-${transcript.status}">${label}</span>
    </div>
  `;
}

/**
 * Render quarantine item with actions
 */
function renderQuarantineItem(transcript: KrispTranscript): string {
  const { label } = krispService.formatStatus(transcript.status);
  const duration = krispService.formatDuration(transcript.duration_minutes);
  const date = transcript.meeting_date ? new Date(transcript.meeting_date).toLocaleDateString() : '-';

  return `
    <div class="krisp-item" data-id="${transcript.id}">
      <div class="krisp-item-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div class="krisp-item-content">
        <div class="krisp-item-title">${escapeHtml(transcript.krisp_title || 'Untitled Meeting')}</div>
        <div class="krisp-item-meta">
          <span>${date}</span>
          <span>${duration}</span>
          <span style="color: #f59e0b;">${transcript.status_reason || label}</span>
        </div>
      </div>
      <div class="krisp-item-actions">
        <button class="retry-btn" data-id="${transcript.id}" title="Retry processing">Retry</button>
        <button class="assign-btn primary" data-id="${transcript.id}" title="Assign to project">Assign</button>
        <button class="skip-btn" data-id="${transcript.id}" title="Discard">Skip</button>
      </div>
    </div>
  `;
}

/**
 * Render mapping item
 */
function renderMappingItem(mapping: KrispSpeakerMapping): string {
  return `
    <div class="mapping-item" data-id="${mapping.id}">
      <div class="mapping-info">
        <span class="mapping-speaker">${escapeHtml(mapping.speaker_name)}</span>
        <span class="mapping-arrow">→</span>
        <span class="mapping-contact">${escapeHtml(mapping.contacts?.name || 'Unknown')}</span>
        ${mapping.is_global ? '<span class="mapping-badge">Global</span>' : ''}
      </div>
      <button class="delete-mapping-btn" data-id="${mapping.id}" title="Remove mapping">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>
  `;
}

/**
 * Bind transcript click actions
 */
function bindTranscriptActions(container: HTMLElement): void {
  container.querySelectorAll('.krisp-item').forEach(item => {
    on(item as HTMLElement, 'click', () => {
      const id = item.getAttribute('data-id');
      const transcript = state.transcripts.find(t => t.id === id);
      if (transcript) {
        showTranscriptDetail(transcript);
      }
    });
  });
}

/**
 * Bind quarantine action buttons
 */
function bindQuarantineActions(container: HTMLElement): void {
  // Retry buttons
  container.querySelectorAll('.retry-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;

      btn.textContent = '...';
      const success = await krispService.retryTranscript(id);
      
      if (success) {
        toast.success('Retry queued');
        await loadTabContent('quarantine');
      } else {
        toast.error('Retry failed');
        btn.textContent = 'Retry';
      }
    });
  });

  // Assign buttons
  container.querySelectorAll('.assign-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const transcript = state.quarantine.find(t => t.id === id);
      if (transcript) {
        const { showProjectAssignmentModal } = await import('./ProjectAssignmentModal');
        showProjectAssignmentModal({
          transcript,
          onAssign: async () => {
            await loadTabContent('quarantine');
          }
        });
      }
    });
  });

  // Skip buttons
  container.querySelectorAll('.skip-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Are you sure you want to skip this transcript?')) return;

      const success = await krispService.skipTranscript(id, 'Manually skipped');
      
      if (success) {
        toast.success('Transcript skipped');
        await loadTabContent('quarantine');
      } else {
        toast.error('Failed to skip');
      }
    });
  });
}

/**
 * Bind mapping action buttons
 */
function bindMappingActions(container: HTMLElement): void {
  container.querySelectorAll('.delete-mapping-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (!confirm('Are you sure you want to delete this mapping?')) return;

      const success = await krispService.deleteMapping(id);
      
      if (success) {
        toast.success('Mapping deleted');
        await loadTabContent('mappings');
      } else {
        toast.error('Failed to delete');
      }
    });
  });
}

/**
 * Show transcript detail (simple for now)
 */
function showTranscriptDetail(transcript: KrispTranscript): void {
  // For now, just show an alert with basic info
  // In phase 3, this could be a full detail modal
  const info = [
    `Title: ${transcript.display_title || transcript.krisp_title}`,
    `Status: ${transcript.status}`,
    `Speakers: ${transcript.speakers?.join(', ') || 'None'}`,
    `Project: ${transcript.projects?.name || 'Not assigned'}`,
  ].join('\n');

  alert(info);
}

/**
 * Update badge count
 */
function updateBadge(id: string, count: number): void {
  if (!containerRef) return;
  const badge = containerRef.querySelector(`#${id}`);
  if (badge) {
    badge.textContent = String(count);
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

/**
 * Close the modal
 */
export function closeKrispManager(): void {
  closeModal(MODAL_ID);
}
