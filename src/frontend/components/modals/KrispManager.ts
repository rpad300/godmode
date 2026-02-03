/**
 * Krisp Manager Modal
 * Manage Krisp transcripts, quarantine, and speaker mappings
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { toast } from '../../services/toast';
import * as krispService from '../../services/krisp';
import type { KrispTranscript, KrispSpeakerMapping, McpMeeting } from '../../services/krisp';

const MODAL_ID = 'krisp-manager-modal';

type TabId = 'transcripts' | 'quarantine' | 'mappings' | 'import';

interface KrispManagerState {
  activeTab: TabId;
  transcripts: KrispTranscript[];
  quarantine: KrispTranscript[];
  mappings: KrispSpeakerMapping[];
  loading: boolean;
  selectedTranscript: KrispTranscript | null;
  // Import state
  mcpMeetings: McpMeeting[];
  importedIds: Set<string>;
  selectedMeetings: Set<string>;
  importFilters: {
    search: string;
    after: string;
    before: string;
    domain: string;
  };
}

let state: KrispManagerState = {
  activeTab: 'transcripts',
  transcripts: [],
  quarantine: [],
  mappings: [],
  loading: false,
  selectedTranscript: null,
  mcpMeetings: [],
  importedIds: new Set(),
  selectedMeetings: new Set(),
  importFilters: {
    search: '',
    after: '',
    before: '',
    domain: ''
  }
};

let containerRef: HTMLElement | null = null;

/**
 * Show Krisp Manager modal
 * @param initialTab - Optional tab to open by default
 */
export async function showKrispManager(initialTab: TabId = 'transcripts'): Promise<void> {
  // Reset state
  state = {
    activeTab: initialTab,
    transcripts: [],
    quarantine: [],
    mappings: [],
    loading: false,
    selectedTranscript: null,
    mcpMeetings: [],
    importedIds: new Set(),
    selectedMeetings: new Set(),
    importFilters: {
      search: '',
      after: '',
      before: '',
      domain: ''
    }
  };

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'krisp-manager' });
  containerRef = content;

  content.innerHTML = `
    <style>
      .krisp-manager {
        min-height: 450px;
        padding-bottom: 16px;
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
      
      /* Import tab styles */
      .import-filters {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .import-filters .filter-row {
        display: flex;
        gap: 12px;
        grid-column: 1 / -1;
      }
      .import-filters label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary, #64748b);
      }
      .import-filters input {
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        font-size: 14px;
        background: white;
      }
      .import-filters .search-row {
        display: flex;
        gap: 12px;
        align-items: flex-end;
        grid-column: 1 / -1;
      }
      .import-filters .search-row label {
        flex: 1;
      }
      .import-filters .search-btn {
        padding: 8px 20px;
        background: var(--primary, #e11d48);
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
      }
      .import-filters .search-btn:hover {
        opacity: 0.9;
      }
      .import-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        margin-bottom: 8px;
      }
      .import-header label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
      }
      .import-header .count {
        color: var(--text-secondary, #64748b);
        font-size: 13px;
      }
      .import-meeting {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .import-meeting:hover {
        background: var(--bg-tertiary, #f1f5f9);
      }
      .import-meeting.selected {
        background: rgba(225, 29, 72, 0.05);
        border: 1px solid rgba(225, 29, 72, 0.2);
      }
      .import-meeting.imported {
        opacity: 0.6;
      }
      .import-meeting input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      .import-meeting-content {
        flex: 1;
        min-width: 0;
      }
      .import-meeting-title {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .import-meeting-title .imported-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #dcfce7;
        color: #166534;
      }
      .import-meeting-meta {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        margin-top: 2px;
      }
      .import-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-top: 1px solid var(--border-color, #e2e8f0);
        margin-top: 16px;
      }
      .import-footer .selected-count {
        font-size: 14px;
        color: var(--text-secondary, #64748b);
      }
      .import-btn {
        padding: 10px 24px;
        background: var(--primary, #e11d48);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .import-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .import-btn:not(:disabled):hover {
        opacity: 0.9;
      }
      .import-note {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #92400e;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .import-note svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      [data-theme="dark"] .import-filters {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .import-filters input {
        background: rgba(30,41,59,0.8);
        color: white;
        border-color: rgba(255,255,255,0.1);
      }
      [data-theme="dark"] .import-meeting {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .import-meeting.selected {
        background: rgba(225,29,72,0.1);
        border-color: rgba(225,29,72,0.3);
      }
      [data-theme="dark"] .import-note {
        background: rgba(251,191,36,0.1);
        border-color: rgba(251,191,36,0.3);
        color: #fcd34d;
      }
    </style>
    
    <div class="krisp-tabs">
      <button class="krisp-tab ${initialTab === 'transcripts' ? 'active' : ''}" data-tab="transcripts">
        Transcripts
        <span class="badge" id="transcripts-count">0</span>
      </button>
      <button class="krisp-tab ${initialTab === 'quarantine' ? 'active' : ''}" data-tab="quarantine">
        Quarantine
        <span class="badge warning" id="quarantine-count">0</span>
      </button>
      <button class="krisp-tab ${initialTab === 'mappings' ? 'active' : ''}" data-tab="mappings">
        Mappings
        <span class="badge" id="mappings-count">0</span>
      </button>
      <button class="krisp-tab ${initialTab === 'import' ? 'active' : ''}" data-tab="import">
        Import
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 6px;">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
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
      case 'import':
        await loadImport(contentEl as HTMLElement);
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

// ==================== Import Tab ====================

/**
 * Load import tab
 */
async function loadImport(container: HTMLElement): Promise<void> {
  // Render the import UI with filters
  container.innerHTML = `
    <div class="import-note">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <strong>Import from Krisp</strong><br>
        Use the search filters below to find meetings in your Krisp account. 
        The search uses the Krisp MCP - make sure you have it connected in Cursor.
      </div>
    </div>
    
    <div class="import-filters">
      <label>
        From Date
        <input type="date" id="import-after" value="${state.importFilters.after}" />
      </label>
      <label>
        To Date
        <input type="date" id="import-before" value="${state.importFilters.before}" />
      </label>
      <label>
        Participant Domain
        <input type="text" id="import-domain" placeholder="e.g. company.com" value="${state.importFilters.domain}" />
      </label>
      <div class="search-row">
        <label style="flex: 1;">
          Search Text
          <input type="text" id="import-search" placeholder="Search by title, content, attendees..." value="${state.importFilters.search}" />
        </label>
        <button class="search-btn" id="import-search-btn">
          Search Krisp
        </button>
      </div>
    </div>
    
    <div id="import-results">
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <p>Use the filters above to search for meetings</p>
        <p style="font-size: 12px; margin-top: 8px;">Tip: Set a date range to find recent meetings</p>
      </div>
    </div>
  `;
  
  bindImportFilters(container);
}

/**
 * Bind import filter events
 */
function bindImportFilters(container: HTMLElement): void {
  const searchBtn = container.querySelector('#import-search-btn');
  
  if (searchBtn) {
    on(searchBtn as HTMLElement, 'click', () => {
      // Save filter values to state
      const afterInput = container.querySelector('#import-after') as HTMLInputElement;
      const beforeInput = container.querySelector('#import-before') as HTMLInputElement;
      const domainInput = container.querySelector('#import-domain') as HTMLInputElement;
      const searchInput = container.querySelector('#import-search') as HTMLInputElement;
      
      state.importFilters = {
        after: afterInput?.value || '',
        before: beforeInput?.value || '',
        domain: domainInput?.value || '',
        search: searchInput?.value || ''
      };
      
      // Show instructions for MCP search
      showMcpSearchInstructions(container);
    });
  }
  
  // Enter key triggers search
  const searchInput = container.querySelector('#import-search');
  if (searchInput) {
    on(searchInput as HTMLElement, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        searchBtn?.dispatchEvent(new Event('click'));
      }
    });
  }
}

/**
 * Show MCP search instructions
 * Since MCP calls need to be made through Cursor, we show the user how to do it
 */
function showMcpSearchInstructions(container: HTMLElement): void {
  const resultsEl = container.querySelector('#import-results');
  if (!resultsEl) return;
  
  const { after, before, domain, search } = state.importFilters;
  
  // Build the MCP call example
  const args: Record<string, unknown> = {};
  if (after) args.after = after;
  if (before) args.before = before;
  if (domain) args.participant_domains = [domain];
  if (search) args.search = search;
  args.limit = 50;
  args.fields = ['name', 'date', 'speakers', 'attendees', 'meeting_notes'];
  
  const mcpCall = JSON.stringify(args, null, 2);
  
  resultsEl.innerHTML = `
    <div style="background: var(--bg-secondary, #f8fafc); border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px;">Search Krisp Meetings</h4>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        To search your Krisp meetings, use the Krisp MCP in Cursor. Copy the command below:
      </p>
      <div style="background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto;">
CallMcpTool({
  server: "user-Krisp",
  toolName: "search_meetings",
  arguments: ${mcpCall}
})</div>
      <p style="font-size: 12px; color: var(--text-secondary); margin-top: 12px;">
        After getting the results, paste the meeting data below to import:
      </p>
      <textarea id="import-paste-data" placeholder="Paste the search_meetings results here..." style="width: 100%; min-height: 120px; margin-top: 8px; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
      <div style="display: flex; gap: 12px; margin-top: 12px;">
        <button id="import-parse-btn" style="padding: 8px 16px; background: var(--primary, #e11d48); color: white; border: none; border-radius: 6px; cursor: pointer;">
          Parse Meetings
        </button>
      </div>
    </div>
  `;
  
  bindPasteDataHandler(container);
}

/**
 * Bind paste data handler
 */
function bindPasteDataHandler(container: HTMLElement): void {
  const parseBtn = container.querySelector('#import-parse-btn');
  
  if (parseBtn) {
    on(parseBtn as HTMLElement, 'click', async () => {
      const textarea = container.querySelector('#import-paste-data') as HTMLTextAreaElement;
      if (!textarea?.value.trim()) {
        toast.error('Please paste the meeting data first');
        return;
      }
      
      try {
        const data = JSON.parse(textarea.value);
        const meetings = extractMeetingsFromMcpResponse(data);
        
        if (meetings.length === 0) {
          toast.error('No meetings found in the pasted data');
          return;
        }
        
        // Check which are already imported
        const meetingIds = meetings.map(m => m.meeting_id);
        const importedIds = await krispService.getImportedMeetingIds(meetingIds);
        state.importedIds = new Set(importedIds);
        state.mcpMeetings = meetings;
        state.selectedMeetings = new Set();
        
        // Render meeting list
        renderMeetingList(container);
        
        toast.success(`Found ${meetings.length} meetings`);
        
      } catch (error) {
        console.error('[KrispManager] Parse error:', error);
        toast.error('Failed to parse meeting data. Make sure it\'s valid JSON.');
      }
    });
  }
}

/**
 * Extract meetings from MCP response
 */
function extractMeetingsFromMcpResponse(data: unknown): McpMeeting[] {
  // Handle various response formats
  if (Array.isArray(data)) {
    return data.filter(m => m.meeting_id);
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.meetings)) {
      return obj.meetings.filter((m: McpMeeting) => m.meeting_id);
    }
    if (Array.isArray(obj.results)) {
      return obj.results.filter((m: McpMeeting) => m.meeting_id);
    }
    if (Array.isArray(obj.data)) {
      return obj.data.filter((m: McpMeeting) => m.meeting_id);
    }
    // Single meeting
    if (obj.meeting_id) {
      return [obj as McpMeeting];
    }
  }
  return [];
}

/**
 * Render meeting list for import
 */
function renderMeetingList(container: HTMLElement): void {
  const resultsEl = container.querySelector('#import-results');
  if (!resultsEl) return;
  
  const meetings = state.mcpMeetings;
  const selectedCount = state.selectedMeetings.size;
  const notImportedCount = meetings.filter(m => !state.importedIds.has(m.meeting_id)).length;
  
  resultsEl.innerHTML = `
    <div class="import-header">
      <label>
        <input type="checkbox" id="select-all" ${selectedCount === notImportedCount && notImportedCount > 0 ? 'checked' : ''} />
        Select All (${notImportedCount} available)
      </label>
      <span class="count">Showing ${meetings.length} meetings</span>
    </div>
    
    <div class="krisp-list">
      ${meetings.map(m => renderImportMeetingItem(m)).join('')}
    </div>
    
    <div class="import-footer">
      <span class="selected-count">${selectedCount} selected</span>
      <button class="import-btn" id="import-selected-btn" ${selectedCount === 0 ? 'disabled' : ''}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import ${selectedCount} Meeting${selectedCount !== 1 ? 's' : ''}
      </button>
    </div>
  `;
  
  bindMeetingListActions(container);
}

/**
 * Render single import meeting item
 */
function renderImportMeetingItem(meeting: McpMeeting): string {
  const isImported = state.importedIds.has(meeting.meeting_id);
  const isSelected = state.selectedMeetings.has(meeting.meeting_id);
  const speakers = meeting.speakers?.join(', ') || meeting.attendees?.join(', ') || 'No participants';
  const date = meeting.date ? new Date(meeting.date).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';
  
  return `
    <div class="import-meeting ${isSelected ? 'selected' : ''} ${isImported ? 'imported' : ''}" data-id="${meeting.meeting_id}">
      <input type="checkbox" ${isSelected ? 'checked' : ''} ${isImported ? 'disabled' : ''} />
      <div class="import-meeting-content">
        <div class="import-meeting-title">
          ${escapeHtml(meeting.name || 'Untitled Meeting')}
          ${isImported ? '<span class="imported-badge">Imported</span>' : ''}
        </div>
        <div class="import-meeting-meta">
          ${date} · ${speakers}
        </div>
      </div>
    </div>
  `;
}

/**
 * Bind meeting list actions
 */
function bindMeetingListActions(container: HTMLElement): void {
  // Select all checkbox
  const selectAll = container.querySelector('#select-all');
  if (selectAll) {
    on(selectAll as HTMLElement, 'change', () => {
      const checked = (selectAll as HTMLInputElement).checked;
      
      if (checked) {
        // Select all not-imported meetings
        state.mcpMeetings.forEach(m => {
          if (!state.importedIds.has(m.meeting_id)) {
            state.selectedMeetings.add(m.meeting_id);
          }
        });
      } else {
        state.selectedMeetings.clear();
      }
      
      renderMeetingList(container);
    });
  }
  
  // Individual meeting checkboxes
  container.querySelectorAll('.import-meeting').forEach(item => {
    on(item as HTMLElement, 'click', (e) => {
      const id = item.getAttribute('data-id');
      if (!id || state.importedIds.has(id)) return;
      
      // Toggle selection
      if (state.selectedMeetings.has(id)) {
        state.selectedMeetings.delete(id);
      } else {
        state.selectedMeetings.add(id);
      }
      
      renderMeetingList(container);
    });
  });
  
  // Import button
  const importBtn = container.querySelector('#import-selected-btn');
  if (importBtn) {
    on(importBtn as HTMLElement, 'click', async () => {
      if (state.selectedMeetings.size === 0) return;
      
      importBtn.setAttribute('disabled', 'true');
      importBtn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px;"></span> Importing...';
      
      // Get selected meetings data
      const selectedMeetings = state.mcpMeetings.filter(m => state.selectedMeetings.has(m.meeting_id));
      
      // Import via API
      const result = await krispService.importMeetings(selectedMeetings);
      
      if (result) {
        toast.success(`Imported ${result.imported} meetings${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`);
        
        // Add newly imported to the set
        result.results.forEach(r => {
          if (r.success) {
            state.importedIds.add(r.meetingId);
          }
        });
        
        state.selectedMeetings.clear();
        renderMeetingList(container);
      } else {
        toast.error('Import failed');
        importBtn.removeAttribute('disabled');
        importBtn.innerHTML = `Import ${state.selectedMeetings.size} Meetings`;
      }
    });
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
