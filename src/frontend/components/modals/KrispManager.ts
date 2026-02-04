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
      .import-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        padding: 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
      }
      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
      }
      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--primary, #e11d48);
      }
      .stat-label {
        font-size: 11px;
        color: var(--text-secondary, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .import-meeting-summary {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        margin-top: 4px;
        line-height: 1.4;
      }
      [data-theme="dark"] .import-stats {
        background: rgba(255,255,255,0.03);
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
 * Load import tab - fetches available meetings from the catalog
 */
async function loadImport(container: HTMLElement): Promise<void> {
  // Fetch available meetings from the API
  const result = await krispService.getAvailableMeetings({
    limit: 100,
    showImported: true,
    startDate: state.importFilters.after || undefined,
    endDate: state.importFilters.before || undefined,
    search: state.importFilters.search || undefined
  });

  const stats = result?.stats || {
    total_available: 0,
    total_imported: 0,
    total_pending: 0,
    last_sync: null
  };

  const lastSync = stats.last_sync 
    ? new Date(stats.last_sync).toLocaleString()
    : 'Never';

  // Render the import UI
  container.innerHTML = `
    <div class="import-note">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <strong>Import from Krisp</strong><br>
        Meetings synced from Krisp are shown below. To sync new meetings, ask Cursor: 
        <em>"sincroniza as meetings do Krisp"</em>
      </div>
    </div>
    
    <div class="import-stats">
      <div class="stat-item">
        <span class="stat-value">${stats.total_available}</span>
        <span class="stat-label">Available</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.total_imported}</span>
        <span class="stat-label">Imported</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.total_pending}</span>
        <span class="stat-label">Pending</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" style="font-size: 12px;">${lastSync}</span>
        <span class="stat-label">Last Sync</span>
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
      <div class="search-row">
        <label style="flex: 1;">
          Search
          <input type="text" id="import-search" placeholder="Search by title..." value="${state.importFilters.search}" />
        </label>
        <button class="search-btn" id="import-filter-btn">
          Filter
        </button>
      </div>
    </div>
    
    <div id="import-results">
      ${renderAvailableMeetingsList(result?.meetings || [])}
    </div>
  `;
  
  // Store meetings in state
  if (result?.meetings) {
    state.mcpMeetings = result.meetings.map(m => ({
      meeting_id: m.krisp_meeting_id,
      name: m.meeting_name,
      date: m.meeting_date,
      speakers: m.speakers,
      attendees: m.attendees,
      meeting_notes: {
        key_points: m.key_points,
        action_items: m.action_items
      }
    }));
    state.importedIds = new Set(
      result.meetings.filter(m => m.is_imported).map(m => m.krisp_meeting_id)
    );
  }
  
  bindImportFilters(container);
}

/**
 * Render available meetings list
 */
function renderAvailableMeetingsList(meetings: krispService.AvailableMeeting[]): string {
  if (meetings.length === 0) {
    return `
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No meetings synced yet</p>
        <p style="font-size: 12px; margin-top: 8px;">
          Ask Cursor to sync: <em>"sincroniza as meetings do Krisp de [data] a [data]"</em>
        </p>
      </div>
    `;
  }

  const notImportedCount = meetings.filter(m => !m.is_imported).length;
  
  return `
    <div class="import-header">
      <label>
        <input type="checkbox" id="select-all" />
        Select All (${notImportedCount} available)
      </label>
      <span class="count">Showing ${meetings.length} meetings</span>
    </div>
    
    <div class="krisp-list">
      ${meetings.map(m => renderAvailableMeetingItem(m)).join('')}
    </div>
    
    <div class="import-footer">
      <span class="selected-count" id="selected-count">0 selected</span>
      <button class="import-btn" id="import-selected-btn" disabled>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import Selected
      </button>
    </div>
  `;
}

/**
 * Render single available meeting item
 */
function renderAvailableMeetingItem(meeting: krispService.AvailableMeeting): string {
  const isImported = meeting.is_imported;
  const isSelected = state.selectedMeetings.has(meeting.krisp_meeting_id);
  const speakers = meeting.speakers?.join(', ') || meeting.attendees?.join(', ') || 'No participants';
  const date = meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';
  
  return `
    <div class="import-meeting ${isSelected ? 'selected' : ''} ${isImported ? 'imported' : ''}" data-id="${meeting.krisp_meeting_id}">
      <input type="checkbox" ${isSelected ? 'checked' : ''} ${isImported ? 'disabled' : ''} />
      <div class="import-meeting-content">
        <div class="import-meeting-title">
          ${escapeHtml(meeting.meeting_name || 'Untitled Meeting')}
          ${isImported ? '<span class="imported-badge">Imported</span>' : ''}
        </div>
        <div class="import-meeting-meta">
          ${date} · ${escapeHtml(speakers.substring(0, 100))}${speakers.length > 100 ? '...' : ''}
        </div>
        ${meeting.summary ? `<div class="import-meeting-summary">${escapeHtml(meeting.summary.substring(0, 150))}${meeting.summary.length > 150 ? '...' : ''}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Bind import filter events
 */
function bindImportFilters(container: HTMLElement): void {
  const filterBtn = container.querySelector('#import-filter-btn');
  
  if (filterBtn) {
    on(filterBtn as HTMLElement, 'click', async () => {
      // Save filter values to state
      const afterInput = container.querySelector('#import-after') as HTMLInputElement;
      const beforeInput = container.querySelector('#import-before') as HTMLInputElement;
      const searchInput = container.querySelector('#import-search') as HTMLInputElement;
      
      state.importFilters = {
        after: afterInput?.value || '',
        before: beforeInput?.value || '',
        domain: '',
        search: searchInput?.value || ''
      };
      
      // Reload the import tab with new filters
      await loadImport(container);
    });
  }
  
  // Enter key triggers filter
  const searchInput = container.querySelector('#import-search');
  if (searchInput) {
    on(searchInput as HTMLElement, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        filterBtn?.dispatchEvent(new Event('click'));
      }
    });
  }
  
  // Bind meeting list actions
  bindAvailableMeetingListActions(container);
}

/**
 * Bind available meeting list actions
 */
function bindAvailableMeetingListActions(container: HTMLElement): void {
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
      
      updateImportSelectionUI(container);
    });
  }
  
  // Individual meeting checkboxes
  container.querySelectorAll('.import-meeting').forEach(item => {
    on(item as HTMLElement, 'click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') return; // Let checkbox handle itself
      
      const id = item.getAttribute('data-id');
      if (!id || state.importedIds.has(id)) return;
      
      // Toggle selection
      if (state.selectedMeetings.has(id)) {
        state.selectedMeetings.delete(id);
      } else {
        state.selectedMeetings.add(id);
      }
      
      updateImportSelectionUI(container);
    });
    
    // Also handle checkbox change directly
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox) {
      on(checkbox as HTMLElement, 'change', () => {
        const id = item.getAttribute('data-id');
        if (!id || state.importedIds.has(id)) return;
        
        if ((checkbox as HTMLInputElement).checked) {
          state.selectedMeetings.add(id);
        } else {
          state.selectedMeetings.delete(id);
        }
        
        updateImportSelectionUI(container);
      });
    }
  });
  
  // Import button
  const importBtn = container.querySelector('#import-selected-btn');
  if (importBtn) {
    on(importBtn as HTMLElement, 'click', async () => {
      if (state.selectedMeetings.size === 0) return;
      
      importBtn.setAttribute('disabled', 'true');
      importBtn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px;"></span> Importing...';
      
      // Get selected meeting IDs (krisp_meeting_id)
      const selectedIds = Array.from(state.selectedMeetings);
      
      // Import via new API
      const result = await krispService.importAvailableMeetings(selectedIds);
      
      if (result) {
        if (result.imported > 0) {
          toast.success(`Imported ${result.imported} meeting${result.imported !== 1 ? 's' : ''}`);
        }
        if (result.errors.length > 0) {
          toast.warning(`${result.errors.length} failed to import`);
        }
        
        // Reload to show updated state
        state.selectedMeetings.clear();
        await loadImport(container);
      } else {
        toast.error('Import failed');
        importBtn.removeAttribute('disabled');
        importBtn.innerHTML = `Import Selected`;
      }
    });
  }
}

/**
 * Update import selection UI
 */
function updateImportSelectionUI(container: HTMLElement): void {
  const selectedCount = state.selectedMeetings.size;
  
  // Update selected count
  const countEl = container.querySelector('#selected-count');
  if (countEl) {
    countEl.textContent = `${selectedCount} selected`;
  }
  
  // Update import button
  const importBtn = container.querySelector('#import-selected-btn');
  if (importBtn) {
    if (selectedCount > 0) {
      importBtn.removeAttribute('disabled');
      importBtn.innerHTML = `
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import ${selectedCount} Meeting${selectedCount !== 1 ? 's' : ''}
      `;
    } else {
      importBtn.setAttribute('disabled', 'true');
      importBtn.innerHTML = `
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Import Selected
      `;
    }
  }
  
  // Update checkboxes visual state
  container.querySelectorAll('.import-meeting').forEach(item => {
    const id = item.getAttribute('data-id');
    const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
    
    if (id && checkbox && !state.importedIds.has(id)) {
      const isSelected = state.selectedMeetings.has(id);
      checkbox.checked = isSelected;
      item.classList.toggle('selected', isSelected);
    }
  });
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
