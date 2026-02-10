/**
 * Krisp Manager Modal
 * Manage Krisp transcripts, quarantine, and speaker mappings
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { toast } from '../../services/toast';
import * as krispService from '../../services/krisp';
import * as projectsService from '../../services/projects';
import type { KrispTranscript, KrispSpeakerMapping, McpMeeting } from '../../services/krisp';
import type { ProjectListItem } from '../../services/projects';

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
  // Projects for import
  projects: ProjectListItem[];
  selectedProjectId: string;
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
  },
  projects: [],
  selectedProjectId: ''
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
      .krisp-item.needs-project {
        border: 1px solid rgba(225, 29, 72, 0.2);
        background: rgba(225, 29, 72, 0.02);
      }
      .krisp-item-assign {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .krisp-item-assign select {
        padding: 6px 10px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        font-size: 12px;
        background: white;
        min-width: 150px;
        cursor: pointer;
      }
      .krisp-item-assign select:focus {
        outline: none;
        border-color: var(--primary, #e11d48);
      }
      .krisp-item-assign button {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 6px;
        border: none;
        background: var(--primary, #e11d48);
        color: white;
        cursor: pointer;
        white-space: nowrap;
      }
      .krisp-item-assign button:disabled {
        background: #cbd5e1;
        cursor: not-allowed;
      }
      .krisp-item-assign button:not(:disabled):hover {
        background: #be123c;
      }
      .project-tag {
        padding: 2px 6px;
        background: rgba(225, 29, 72, 0.1);
        color: var(--primary, #e11d48);
        border-radius: 4px;
        font-size: 11px;
      }
      [data-theme="dark"] .krisp-item-assign select {
        background: rgba(30,41,59,0.8);
        color: white;
        border-color: rgba(255,255,255,0.1);
      }
      [data-theme="dark"] .krisp-item.needs-project {
        background: rgba(225, 29, 72, 0.05);
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
      .import-project-selector {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .import-project-selector label {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-primary, #1e293b);
        white-space: nowrap;
      }
      .import-project-selector select {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        background: white;
        font-size: 14px;
        cursor: pointer;
      }
      .import-project-selector select:focus {
        outline: none;
        border-color: var(--primary, #e11d48);
      }
      [data-theme="dark"] .import-project-selector {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .import-project-selector select {
        background: rgba(30,41,59,0.8);
        color: white;
        border-color: rgba(255,255,255,0.1);
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
      .import-meeting-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      .summary-btn {
        padding: 6px 12px;
        font-size: 11px;
        border-radius: 6px;
        border: 1px solid var(--border-color, #e2e8f0);
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      .summary-btn:hover {
        background: var(--bg-secondary, #f8fafc);
        border-color: var(--primary, #e11d48);
      }
      .summary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .summary-btn svg {
        width: 14px;
        height: 14px;
      }
      .summary-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .summary-modal {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .summary-modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .summary-modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .summary-modal-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        color: var(--text-secondary, #64748b);
        padding: 4px;
      }
      .summary-modal-body {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(80vh - 60px);
      }
      .summary-section {
        margin-bottom: 20px;
      }
      .summary-section:last-child {
        margin-bottom: 0;
      }
      .summary-section h4 {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-secondary, #64748b);
        margin: 0 0 8px 0;
        letter-spacing: 0.5px;
      }
      .summary-section p {
        margin: 0;
        color: var(--text-primary, #1e293b);
        line-height: 1.6;
      }
      .summary-section ul {
        margin: 0;
        padding-left: 20px;
        color: var(--text-primary, #1e293b);
      }
      .summary-section li {
        margin-bottom: 6px;
        line-height: 1.4;
      }
      .summary-loading {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary, #64748b);
      }
      [data-theme="dark"] .summary-btn {
        background: rgba(30,41,59,0.8);
        border-color: rgba(255,255,255,0.1);
        color: white;
      }
      [data-theme="dark"] .summary-modal {
        background: var(--bg-primary, #0f172a);
        color: white;
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
        <svg class="krisp-tab-svg-ml" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
  // Fetch transcripts and projects in parallel
  const [transcripts, projects] = await Promise.all([
    krispService.getTranscripts({ limit: 50 }),
    projectsService.getProjects()
  ]);
  
  state.transcripts = transcripts;
  state.projects = projects;

  // Update badge
  updateBadge('transcripts-count', transcripts.length);

  if (transcripts.length === 0) {
    container.innerHTML = `
      <div class="krisp-empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p>No transcripts yet</p>
        <p class="krisp-hint">Configure your Krisp webhook in Profile &gt; Integrations</p>
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
        <p class="krisp-hint">All speakers are identified correctly</p>
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
        <p class="krisp-hint">Mappings are created when you manually link speakers to contacts</p>
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
  const { label } = krispService.formatStatus(transcript.status);
  const duration = krispService.formatDuration(transcript.duration_minutes);
  const date = transcript.meeting_date ? new Date(transcript.meeting_date).toLocaleDateString() : '-';
  const speakers = transcript.speakers?.length || 0;
  const needsProject = transcript.status === 'pending' && !transcript.matched_project_id;
  
  // Build project options for pending transcripts without project
  const projectOptions = state.projects.map(p => 
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
  ).join('');

  return `
    <div class="krisp-item ${needsProject ? 'needs-project' : ''}" data-id="${transcript.id}">
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
          ${transcript.projects?.name ? `<span class="project-tag">${escapeHtml(transcript.projects.name)}</span>` : ''}
        </div>
      </div>
      ${needsProject ? `
        <div class="krisp-item-assign">
          <select class="assign-project-select" data-transcript-id="${transcript.id}">
            <option value="">Select project...</option>
            ${projectOptions}
          </select>
          <button class="assign-project-btn" data-transcript-id="${transcript.id}" disabled>
            Assign
          </button>
        </div>
      ` : transcript.status === 'matched' ? `
        <div class="krisp-item-actions">
          <span class="krisp-item-status status-${transcript.status}">${label}</span>
          <button class="process-btn primary" data-id="${transcript.id}" title="Process and create document">
            Process
          </button>
        </div>
      ` : `
        <span class="krisp-item-status status-${transcript.status}">${label}</span>
      `}
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
          <span class="krisp-status-reason">${transcript.status_reason || label}</span>
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
  // Click to show details (but not when clicking assign controls)
  container.querySelectorAll('.krisp-item').forEach(item => {
    on(item as HTMLElement, 'click', (e) => {
      const target = e.target as HTMLElement;
      // Ignore clicks on assign controls
      if (target.closest('.krisp-item-assign')) return;
      
      const id = item.getAttribute('data-id');
      const transcript = state.transcripts.find(t => t.id === id);
      if (transcript) {
        showTranscriptDetail(transcript);
      }
    });
  });
  
  // Project selection dropdowns
  container.querySelectorAll('.assign-project-select').forEach(select => {
    on(select as HTMLElement, 'change', () => {
      const transcriptId = select.getAttribute('data-transcript-id');
      const btn = container.querySelector(`.assign-project-btn[data-transcript-id="${transcriptId}"]`) as HTMLButtonElement;
      if (btn) {
        btn.disabled = !(select as HTMLSelectElement).value;
      }
    });
    
    // Stop propagation to prevent item click
    on(select as HTMLElement, 'click', (e) => e.stopPropagation());
  });
  
  // Assign project buttons
  container.querySelectorAll('.assign-project-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const transcriptId = btn.getAttribute('data-transcript-id');
      if (!transcriptId) return;
      
      const select = container.querySelector(`.assign-project-select[data-transcript-id="${transcriptId}"]`) as HTMLSelectElement;
      const projectId = select?.value;
      if (!projectId) return;
      
      // Disable button and show loading
      (btn as HTMLButtonElement).disabled = true;
      btn.textContent = 'Assigning...';
      
      const success = await krispService.assignProject(transcriptId, projectId);
      
      if (success) {
        const project = state.projects.find(p => p.id === projectId);
        toast.success(`Assigned to ${project?.name || 'project'}`);
        // Reload the transcripts list
        await loadTranscripts(container);
      } else {
        toast.error('Failed to assign project');
        (btn as HTMLButtonElement).disabled = false;
        btn.textContent = 'Assign';
      }
    });
  });
  
  // Process buttons (for MATCHED transcripts)
  container.querySelectorAll('.process-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;

      btn.textContent = 'Processing...';
      (btn as HTMLButtonElement).disabled = true;
      
      const success = await krispService.processTranscript(id);
      
      if (success) {
        toast.success('Transcript processed - document created');
        await loadTranscripts(container);
      } else {
        toast.error('Processing failed');
        btn.textContent = 'Process';
        (btn as HTMLButtonElement).disabled = false;
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
 * Show transcript detail modal
 */
function showTranscriptDetail(transcript: KrispTranscript): void {
  const needsProject = transcript.status === 'pending' && !transcript.matched_project_id;
  const { label } = krispService.formatStatus(transcript.status);
  const date = transcript.meeting_date 
    ? new Date(transcript.meeting_date).toLocaleDateString('pt-PT', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) 
    : '-';
  
  // Build project options
  const projectOptions = state.projects.map(p => 
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
  ).join('');
  
  const overlay = document.createElement('div');
  overlay.className = 'summary-modal-overlay';
  overlay.innerHTML = `
    <div class="summary-modal krisp-summary-modal-box">
      <div class="summary-modal-header">
        <h3>${escapeHtml(transcript.display_title || transcript.krisp_title || 'Meeting Details')}</h3>
        <button class="summary-modal-close">&times;</button>
      </div>
      <div class="summary-modal-body">
        <div class="krisp-summary-detail-row">
          <div>
            <div class="krisp-summary-detail-label">Status</div>
            <span class="krisp-item-status status-${transcript.status} gm-inline-block">${label}</span>
          </div>
          <div>
            <div class="krisp-summary-detail-label">Date</div>
            <div class="krisp-summary-detail-value">${date}</div>
          </div>
          <div>
            <div class="krisp-summary-detail-label">Speakers</div>
            <div class="krisp-summary-speakers-wrap">
              ${(transcript.speakers || []).map(s => `<span class="krisp-summary-speaker-chip">${escapeHtml(s)}</span>`).join('')}
              ${(!transcript.speakers || transcript.speakers.length === 0) ? '<span class="krisp-summary-no-speakers">No speakers</span>' : ''}
            </div>
          </div>
          <div>
            <div class="krisp-summary-detail-label">Project</div>
            ${transcript.projects?.name 
              ? `<span class="project-tag">${escapeHtml(transcript.projects.name)}</span>`
              : `<span class="krisp-summary-no-speakers">Not assigned</span>`
            }
          </div>
          ${needsProject ? `
            <div class="krisp-summary-assign-wrap">
              <div class="krisp-summary-assign-label">Assign to Project</div>
              <div class="krisp-summary-assign-row">
                <select id="detail-project-select" class="krisp-summary-assign-select">
                  <option value="">Select project...</option>
                  ${projectOptions}
                </select>
                <button type="button" id="detail-assign-btn" class="krisp-summary-assign-btn" disabled>Assign</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close button
  const closeBtn = overlay.querySelector('.summary-modal-close');
  closeBtn?.addEventListener('click', () => overlay.remove());
  
  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  // ESC to close
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  // Project assignment handlers (if needed)
  if (needsProject) {
    const select = overlay.querySelector('#detail-project-select') as HTMLSelectElement;
    const btn = overlay.querySelector('#detail-assign-btn') as HTMLButtonElement;
    
    select?.addEventListener('change', () => {
      btn.disabled = !select.value;
    });
    
    btn?.addEventListener('click', async () => {
      const projectId = select.value;
      if (!projectId) return;
      
      btn.disabled = true;
      btn.textContent = 'Assigning...';
      
      const success = await krispService.assignProject(transcript.id, projectId);
      
      if (success) {
        const project = state.projects.find(p => p.id === projectId);
        toast.success(`Assigned to ${project?.name || 'project'}`);
        overlay.remove();
        // Reload transcripts
        if (containerRef) {
          const contentEl = containerRef.querySelector('#krisp-content');
          if (contentEl) {
            await loadTranscripts(contentEl as HTMLElement);
          }
        }
      } else {
        toast.error('Failed to assign project');
        btn.disabled = false;
        btn.textContent = 'Assign';
      }
    });
  }
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
  // Fetch available meetings and projects in parallel
  const [result, projects] = await Promise.all([
    krispService.getAvailableMeetings({
      limit: 100,
      showImported: true,
      startDate: state.importFilters.after || undefined,
      endDate: state.importFilters.before || undefined,
      search: state.importFilters.search || undefined
    }),
    projectsService.getProjects()
  ]);

  // Store projects in state
  state.projects = projects;
  
  const stats = result?.stats || {
    total_available: 0,
    total_imported: 0,
    total_pending: 0,
    last_sync: null
  };

  const lastSync = stats.last_sync 
    ? new Date(stats.last_sync).toLocaleString()
    : 'Never';

  // Build project options HTML
  const projectOptions = state.projects.map(p => 
    `<option value="${p.id}" ${state.selectedProjectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

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
        <span class="stat-value krisp-stat-value-sm">${lastSync}</span>
        <span class="stat-label">Last Sync</span>
      </div>
    </div>
    
    <div class="import-project-selector">
      <label for="import-project">Import to Project:</label>
      <select id="import-project">
        <option value="">-- Select a project --</option>
        ${projectOptions}
      </select>
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
        <label class="krisp-import-label-flex">
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
        <p class="krisp-hint">
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
 * Safely parse JSON array field (speakers/attendees may be stored as JSON strings)
 */
function parseArrayField(field: unknown): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Render single available meeting item
 */
function renderAvailableMeetingItem(meeting: krispService.AvailableMeeting): string {
  const isImported = meeting.is_imported;
  const isSelected = state.selectedMeetings.has(meeting.krisp_meeting_id);
  const speakersArr = parseArrayField(meeting.speakers);
  const attendeesArr = parseArrayField(meeting.attendees);
  const speakers = speakersArr.length > 0 ? speakersArr.join(', ') : (attendeesArr.length > 0 ? attendeesArr.join(', ') : 'No participants');
  const date = meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';
  
  const keyPointsArr = parseArrayField(meeting.key_points);
  const hasSummary = meeting.summary || keyPointsArr.length > 0;
  
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
      <div class="import-meeting-actions">
        <button class="summary-btn" data-meeting-id="${meeting.krisp_meeting_id}" title="${hasSummary ? 'View/Refresh Summary' : 'Generate AI Summary'}">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          ${hasSummary ? 'Summary' : 'AI Summary'}
        </button>
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
  
  // Project selector change handler
  const projectSelect = container.querySelector('#import-project');
  if (projectSelect) {
    on(projectSelect as HTMLElement, 'change', () => {
      state.selectedProjectId = (projectSelect as HTMLSelectElement).value;
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
  
  // Summary buttons
  container.querySelectorAll('.summary-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async (e) => {
      e.stopPropagation();
      const meetingId = btn.getAttribute('data-meeting-id');
      if (!meetingId) return;
      
      // Find the meeting in state
      const meeting = state.mcpMeetings.find(m => m.meeting_id === meetingId);
      if (!meeting) return;
      
      // Show summary modal
      await showSummaryModal(meetingId, meeting.name || 'Meeting Summary');
    });
  });
  
  // Individual meeting checkboxes
  container.querySelectorAll('.import-meeting').forEach(item => {
    on(item as HTMLElement, 'click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.closest('.summary-btn')) return; // Let checkbox and summary btn handle themselves
      
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
      
      // Check if a project is selected
      if (!state.selectedProjectId) {
        toast.warning('Please select a project to import meetings into');
        return;
      }
      
      importBtn.setAttribute('disabled', 'true');
      importBtn.innerHTML = '<span class="loading-spinner krisp-loading-spinner-sm"></span> Importing...';
      
      // Get selected meeting IDs (krisp_meeting_id)
      const selectedIds = Array.from(state.selectedMeetings);
      
      // Import via new API with projectId
      const result = await krispService.importAvailableMeetings(selectedIds, state.selectedProjectId);
      
      if (result) {
        if (result.imported > 0) {
          const project = state.projects.find(p => p.id === state.selectedProjectId);
          toast.success(`Imported ${result.imported} meeting${result.imported !== 1 ? 's' : ''} to ${project?.name || 'project'}`);
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
 * Show summary modal for a meeting
 */
async function showSummaryModal(meetingId: string, meetingName: string): Promise<void> {
  // Create modal overlay
  const overlay = createElement('div', { className: 'summary-modal-overlay' });
  overlay.innerHTML = `
    <div class="summary-modal">
      <div class="summary-modal-header">
        <h3>${escapeHtml(meetingName)}</h3>
        <button class="summary-modal-close">&times;</button>
      </div>
      <div class="summary-modal-body">
        <div class="summary-loading">
          <div class="loading-spinner"></div>
          <p class="krisp-summary-loading-p">Generating AI summary...</p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close handlers
  const closeModal = () => {
    overlay.remove();
  };
  
  on(overlay.querySelector('.summary-modal-close') as HTMLElement, 'click', closeModal);
  on(overlay, 'click', (e) => {
    if (e.target === overlay) closeModal();
  });
  
  // Escape key closes
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // Generate summary
  try {
    const result = await krispService.generateAvailableMeetingSummary(meetingId);
    const bodyEl = overlay.querySelector('.summary-modal-body');
    
    if (!bodyEl) return;
    
    if (result?.success && result.summary) {
      const { key_points, action_items, excerpt, speakers, attendees, meeting_date, mentioned_people } = result.summary;
      
      // Combine speakers and attendees for participants
      const allParticipants = [...(speakers || []), ...(attendees || [])];
      const uniqueParticipants = [...new Set(allParticipants)];
      
      // Filter mentioned people to exclude those already in participants
      const mentionedFiltered = (mentioned_people || []).filter(
        p => !uniqueParticipants.some(up => up.toLowerCase() === p.toLowerCase())
      );
      
      bodyEl.innerHTML = `
        ${meeting_date ? `
          <div class="summary-section krisp-summary-section-border">
            <div class="krisp-summary-date-row">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              ${new Date(meeting_date).toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ` : ''}
        
        ${uniqueParticipants.length > 0 ? `
          <div class="summary-section">
            <h4>Participants</h4>
            <div class="krisp-summary-participants-wrap">
              ${uniqueParticipants.map(p => `
                <span class="krisp-summary-participant-chip">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${escapeHtml(p)}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${mentionedFiltered.length > 0 ? `
          <div class="summary-section">
            <h4>Also Mentioned</h4>
            <p class="krisp-summary-mentioned-p">People referenced in the discussion:</p>
            <div class="krisp-summary-participants-wrap">
              ${mentionedFiltered.map(p => `
                <span class="krisp-summary-mentioned-chip">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  ${escapeHtml(p)}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${excerpt ? `
          <div class="summary-section">
            <h4>Summary</h4>
            <p>${escapeHtml(excerpt)}</p>
          </div>
        ` : ''}
        
        ${key_points && key_points.length > 0 ? `
          <div class="summary-section">
            <h4>Key Points</h4>
            <ul>
              ${key_points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${action_items && action_items.length > 0 ? `
          <div class="summary-section">
            <h4>Action Items</h4>
            <ul>
              ${action_items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${(!excerpt && (!key_points || key_points.length === 0) && (!action_items || action_items.length === 0) && uniqueParticipants.length === 0) ? `
          <div class="summary-section">
            <p class="krisp-summary-no-data">No summary data available for this meeting. The meeting may not have enough content to generate a summary.</p>
          </div>
        ` : ''}
        
        <div class="krisp-summary-footer">
          <button class="summary-btn refresh-summary-btn" data-meeting-id="${meetingId}">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh Summary
          </button>
        </div>
      `;
      
      // Bind refresh button
      const refreshBtn = bodyEl.querySelector('.refresh-summary-btn');
      if (refreshBtn) {
        on(refreshBtn as HTMLElement, 'click', async () => {
          bodyEl.innerHTML = `
            <div class="summary-loading">
              <div class="loading-spinner"></div>
              <p class="krisp-summary-loading-p">Regenerating AI summary...</p>
            </div>
          `;
          
          // Re-call the API
          const newResult = await krispService.generateAvailableMeetingSummary(meetingId);
          if (newResult?.success && newResult.summary) {
            // Close and reopen to refresh
            closeModal();
            await showSummaryModal(meetingId, meetingName);
          } else {
            bodyEl.innerHTML = `
              <div class="summary-section">
                <p class="krisp-summary-error">Failed to regenerate summary. Please try again.</p>
              </div>
            `;
          }
        });
      }
    } else {
      bodyEl.innerHTML = `
        <div class="summary-section">
          <p class="krisp-summary-error">${escapeHtml(result?.error || 'Failed to generate summary. Please try again.')}</p>
        </div>
      `;
    }
  } catch (error) {
    const bodyEl = overlay.querySelector('.summary-modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="summary-section">
          <p class="krisp-summary-error">An error occurred while generating the summary.</p>
        </div>
      `;
    }
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
