/**
 * Documents Panel Component - Clean Minimal Design
 * Document list with elegant search, filters, and cards
 */

import { createElement } from '@lib/dom';
import { documentsService, Document } from '@services/documents';
import { toast } from '@services/toast';
import { formatRelativeTime, formatFileSize } from '@lib/format';
import { http, fetchWithProject } from '@services/api';

export interface DocumentsPanelProps {
  onDocumentClick?: (document: Document) => void;
}

type StatusFilter = 'processed' | 'pending' | 'failed' | 'deleted' | 'all';
type TypeFilter = 'all' | 'documents' | 'transcripts' | 'emails' | 'images';
type SortOption = 'date' | 'name' | 'size';
type ViewMode = 'grid' | 'list';

let currentStatus: StatusFilter = 'processed';
let currentType: TypeFilter = 'all';
let currentSort: SortOption = 'date';
let currentViewMode: ViewMode = 'grid';
let currentSearch = '';
let selectedDocuments: Set<string> = new Set();
let allDocuments: Document[] = [];

/**
 * Create documents panel - Clean Minimal
 */
export function createDocumentsPanel(props: DocumentsPanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'documents-panel-minimal' });

  panel.innerHTML = `
    <style>
      .documents-panel-minimal {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary);
        padding: 32px;
      }

      /* Header - Minimal */
      .docs-header-minimal {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 32px;
      }
      .docs-title-section {
        display: flex;
        align-items: baseline;
        gap: 16px;
      }
      .docs-title-section h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .docs-total-count {
        font-size: 16px;
        color: var(--text-tertiary);
        font-weight: 400;
      }
      .docs-header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      
      /* View Mode Toggle */
      .view-mode-toggle {
        display: flex;
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 4px;
        gap: 2px;
      }
      .view-mode-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        color: var(--text-tertiary);
        transition: all 0.15s ease;
      }
      .view-mode-btn:hover {
        color: var(--text-primary);
        background: var(--bg-tertiary);
      }
      .view-mode-btn.active {
        background: var(--primary);
        color: white;
      }
      .view-mode-btn svg {
        width: 18px;
        height: 18px;
      }

      .btn-minimal {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
      }
      .btn-minimal.primary {
        background: var(--primary);
        color: white;
      }
      .btn-minimal.primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .btn-minimal.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      .btn-minimal.secondary:hover {
        background: var(--bg-tertiary);
      }
      .btn-minimal svg {
        width: 16px;
        height: 16px;
      }

      /* Search and Filters - Single Line */
      .docs-controls {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .docs-search-minimal {
        flex: 1;
        min-width: 280px;
        max-width: 400px;
        position: relative;
      }
      .docs-search-minimal input {
        width: 100%;
        padding: 12px 16px 12px 44px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        font-size: 14px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        transition: all 0.15s ease;
      }
      .docs-search-minimal input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      .docs-search-minimal input::placeholder {
        color: var(--text-tertiary);
      }
      .docs-search-minimal svg {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-tertiary);
        width: 18px;
        height: 18px;
      }

      /* Filter Chips */
      .docs-filters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .filter-chip-minimal {
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        background: var(--bg-secondary);
        color: var(--text-secondary);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .filter-chip-minimal:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      .filter-chip-minimal.active {
        background: var(--primary);
        color: white;
      }

      /* Divider with status */
      .docs-status-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 0;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 24px;
      }
      .status-chip {
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        background: transparent;
        border: none;
        color: var(--text-secondary);
      }
      .status-chip:hover {
        background: var(--bg-tertiary);
      }
      .status-chip.active {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      .status-chip.active.processed { color: #10b981; background: rgba(16, 185, 129, 0.1); }
      .status-chip.active.pending { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
      .status-chip.active.failed { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
      .status-chip.active.deleted { color: #6b7280; background: rgba(107, 114, 128, 0.1); }
      .status-chip .chip-count {
        margin-left: 6px;
        padding: 2px 6px;
        font-size: 10px;
        background: rgba(0,0,0,0.05);
        border-radius: 6px;
      }
      [data-theme="dark"] .status-chip .chip-count {
        background: rgba(255,255,255,0.1);
      }
      .status-chip.active .chip-count {
        background: rgba(0,0,0,0.1);
      }
      .docs-sort-minimal {
        margin-left: auto;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        font-size: 13px;
        color: var(--text-primary);
        cursor: pointer;
      }

      /* Documents Grid - Larger Cards */
      .docs-content-minimal {
        flex: 1;
        overflow-y: auto;
      }
      .docs-grid-minimal {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 20px;
      }
      
      /* List View Mode */
      .docs-grid-minimal.list-view {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .docs-grid-minimal.list-view .doc-card-minimal {
        flex-direction: row;
        align-items: center;
        padding: 12px 20px;
        gap: 16px;
        border-radius: 12px;
      }
      .docs-grid-minimal.list-view .doc-card-header {
        flex-shrink: 0;
        gap: 12px;
      }
      .docs-grid-minimal.list-view .doc-card-header .doc-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
        border-radius: 8px;
      }
      .docs-grid-minimal.list-view .doc-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 24px;
        min-width: 0;
      }
      .docs-grid-minimal.list-view .doc-filename {
        flex: 1;
        min-width: 0;
        margin: 0;
      }
      .docs-grid-minimal.list-view .doc-meta {
        display: flex;
        gap: 16px;
        color: var(--text-tertiary);
        font-size: 13px;
        flex-shrink: 0;
      }
      .docs-grid-minimal.list-view .doc-status-badge {
        margin: 0;
        flex-shrink: 0;
      }
      .docs-grid-minimal.list-view .doc-summary-section,
      .docs-grid-minimal.list-view .doc-entities-mini,
      .docs-grid-minimal.list-view .doc-card-hover {
        display: none;
      }

      /* Document Card - Clean Design */
      .doc-card-minimal {
        background: var(--bg-secondary);
        border-radius: 16px;
        border: 1px solid var(--border-color);
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .doc-card-minimal:hover {
        border-color: rgba(var(--primary-rgb), 0.4);
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        transform: translateY(-2px);
      }
      .doc-card-minimal.selected {
        border-color: var(--primary);
        background: rgba(var(--primary-rgb), 0.02);
      }

      /* Card Header */
      .doc-card-top {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      .doc-icon-minimal {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
      }
      .doc-icon-minimal.pdf { background: linear-gradient(135deg, #fef2f2, #fee2e2); }
      .doc-icon-minimal.doc { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
      .doc-icon-minimal.img { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
      .doc-icon-minimal.txt { background: linear-gradient(135deg, #fefce8, #fef9c3); }
      .doc-icon-minimal.default { background: linear-gradient(135deg, #f5f5f5, #e5e5e5); }
      [data-theme="dark"] .doc-icon-minimal.pdf { background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.doc { background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.img { background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.txt { background: linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.1)); }
      [data-theme="dark"] .doc-icon-minimal.default { background: linear-gradient(135deg, rgba(107,114,128,0.15), rgba(107,114,128,0.1)); }

      .doc-info-minimal {
        flex: 1;
        min-width: 0;
      }
      .doc-filename-minimal {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .doc-meta-minimal {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-tertiary);
      }
      .doc-meta-minimal .sep {
        color: var(--border-color);
      }
      .doc-status-badge {
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        text-transform: capitalize;
      }
      .doc-status-badge.processed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
      .doc-status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      .doc-status-badge.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      .doc-status-badge.deleted { background: rgba(107, 114, 128, 0.1); color: #6b7280; }

      /* Card Summary */
      .doc-summary-minimal {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Card Footer */
      .doc-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
      }
      .doc-entities {
        display: flex;
        gap: 16px;
      }
      .doc-entity-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .doc-entity-item .icon {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      }
      .doc-entity-item.facts .icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
      .doc-entity-item.decisions .icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
      .doc-entity-item.risks .icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

      .doc-actions-minimal {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .doc-card-minimal:hover .doc-actions-minimal {
        opacity: 1;
      }
      .doc-action-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .doc-action-btn:hover {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
      }
      .doc-action-btn.favorite.active {
        color: #f59e0b;
      }
      .doc-action-btn.favorite:hover {
        background: #f59e0b;
        border-color: #f59e0b;
        color: white;
      }

      /* Selection */
      .doc-select-checkbox {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid var(--border-color);
        background: var(--bg-primary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 0.15s ease;
        font-size: 12px;
        color: white;
      }
      .doc-card-minimal:hover .doc-select-checkbox,
      .doc-card-minimal.selected .doc-select-checkbox {
        opacity: 1;
      }
      .doc-card-minimal.selected .doc-select-checkbox {
        background: var(--primary);
        border-color: var(--primary);
      }

      /* Selection Bar */
      .selection-bar-minimal {
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 24px;
        background: #1e293b;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.25);
        z-index: 100;
        animation: slideUp 0.25s ease;
      }
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      .selection-bar-minimal.hidden { display: none; }
      .selection-count-minimal {
        color: white;
        font-weight: 600;
        padding-right: 16px;
        border-right: 1px solid rgba(255,255,255,0.2);
      }
      .selection-count-minimal span { color: #60a5fa; }
      .selection-bar-minimal .btn-minimal {
        padding: 8px 16px;
        font-size: 13px;
      }
      .selection-bar-minimal .btn-minimal.secondary {
        background: rgba(255,255,255,0.1);
        color: white;
        border-color: transparent;
      }
      .selection-bar-minimal .btn-minimal.secondary:hover {
        background: rgba(255,255,255,0.2);
      }
      .selection-bar-minimal .btn-minimal.danger {
        background: #ef4444;
        color: white;
        border: none;
      }

      /* Empty State */
      .docs-empty-minimal {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 40px;
        text-align: center;
        grid-column: 1 / -1;
      }
      .docs-empty-minimal .empty-icon {
        width: 80px;
        height: 80px;
        border-radius: 24px;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        margin-bottom: 24px;
      }
      .docs-empty-minimal h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .docs-empty-minimal p {
        margin: 0 0 24px 0;
        color: var(--text-secondary);
      }

      /* Loading */
      .docs-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        grid-column: 1 / -1;
        color: var(--text-secondary);
        gap: 12px;
      }
      .docs-loading::after {
        content: '';
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Accessibility: Screen reader only content */
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      
      /* Focus styles for keyboard navigation */
      .doc-card-minimal:focus {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      .doc-card-minimal:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
    </style>
    
    <!-- Header -->
    <div class="docs-header-minimal">
      <div class="docs-title-section">
        <h1>Files</h1>
        <span class="docs-total-count"><span id="total-count">0</span> documents</span>
      </div>
      <div class="docs-header-actions">
        <!-- View Mode Toggle -->
        <div class="view-mode-toggle">
          <button class="view-mode-btn active" data-view="grid" title="Grid view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button class="view-mode-btn" data-view="list" title="List view">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
        <button class="btn-minimal primary" id="upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload
        </button>
      </div>
    </div>

    <!-- Controls -->
    <div class="docs-controls" role="search">
      <div class="docs-search-minimal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input type="text" id="docs-search-input" placeholder="Search files..." 
               aria-label="Search files" autocomplete="off">
      </div>
      <div class="docs-filters" role="tablist" aria-label="Filter by document type">
        <button class="filter-chip-minimal active" data-type="all" role="tab" aria-selected="true">All</button>
        <button class="filter-chip-minimal" data-type="documents" role="tab" aria-selected="false">Documents</button>
        <button class="filter-chip-minimal" data-type="transcripts" role="tab" aria-selected="false">Transcripts</button>
        <button class="filter-chip-minimal" data-type="emails" role="tab" aria-selected="false">Emails</button>
        <button class="filter-chip-minimal" data-type="images" role="tab" aria-selected="false">Images</button>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="docs-status-bar" role="tablist" aria-label="Filter by status">
      <button class="status-chip active processed" data-status="processed" role="tab" aria-selected="true">
        Processed <span class="chip-count" id="count-processed" aria-label="count">0</span>
      </button>
      <button class="status-chip pending" data-status="pending" role="tab" aria-selected="false">
        Pending <span class="chip-count" id="count-pending" aria-label="count">0</span>
      </button>
      <button class="status-chip failed" data-status="failed" role="tab" aria-selected="false">
        Failed <span class="chip-count" id="count-failed" aria-label="count">0</span>
      </button>
      <button class="status-chip deleted" data-status="deleted" role="tab" aria-selected="false">
        Deleted <span class="chip-count" id="count-deleted" aria-label="count">0</span>
      </button>
      <label for="sort-select" class="visually-hidden">Sort order</label>
      <select class="docs-sort-minimal" id="sort-select" aria-label="Sort files">
        <option value="date">Newest first</option>
        <option value="name">Name A-Z</option>
        <option value="size">Largest first</option>
      </select>
    </div>

    <!-- Content -->
    <div class="docs-content-minimal" role="main">
      <div class="docs-grid-minimal" id="docs-grid" role="list" aria-label="Document list" tabindex="0">
        <div class="docs-loading" aria-live="polite">Loading files</div>
      </div>
    </div>

    <!-- Selection Bar -->
    <div class="selection-bar-minimal hidden" id="selection-bar" role="toolbar" aria-label="Bulk actions">
      <span class="selection-count-minimal" aria-live="polite"><span id="selected-count">0</span> selected</span>
      <button class="btn-minimal secondary" id="bulk-export-btn" aria-label="Export selected files">Export</button>
      <button class="btn-minimal secondary" id="bulk-reprocess-btn" aria-label="Reprocess selected files">Reprocess</button>
      <button class="btn-minimal danger" id="bulk-delete-btn" aria-label="Delete selected files">Delete</button>
      <button class="btn-minimal secondary" id="cancel-selection-btn" aria-label="Cancel selection">Cancel</button>
    </div>
  `;

  // Bind events
  bindPanelEvents(panel, props);

  // Initial load
  loadDocuments(panel, props);

  return panel;
}

/**
 * Bind panel events
 */
function bindPanelEvents(panel: HTMLElement, props: DocumentsPanelProps): void {
  // Upload button
  panel.querySelector('#upload-btn')?.addEventListener('click', async () => {
    const { showFileUploadModal } = await import('@components/modals/FileUploadModal');
    showFileUploadModal({ onComplete: () => loadDocuments(panel, props) });
  });

  // Search with server-side filtering and 500ms debounce
  const searchInput = panel.querySelector('#docs-search-input') as HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const newSearch = searchInput.value.trim();
      if (newSearch !== currentSearch) {
        currentSearch = newSearch;
        // Trigger server-side search if query is 2+ chars or empty
        if (currentSearch.length >= 2 || currentSearch.length === 0) {
          loadDocuments(panel, props);
        }
      }
    }, 500); // Increased debounce for better UX
  });

  // Sort select
  panel.querySelector('#sort-select')?.addEventListener('change', (e) => {
    currentSort = (e.target as HTMLSelectElement).value as SortOption;
    renderFilteredDocuments(panel, props);
  });

  // Type filters
  panel.querySelectorAll('.filter-chip-minimal').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.filter-chip-minimal').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentType = chip.getAttribute('data-type') as TypeFilter;
      renderFilteredDocuments(panel, props);
    });
  });

  // Status chips
  panel.querySelectorAll('.status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.status-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentStatus = chip.getAttribute('data-status') as StatusFilter;
      loadDocuments(panel, props);
    });
  });

  // View mode toggle
  panel.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentViewMode = btn.getAttribute('data-view') as ViewMode;

      const grid = panel.querySelector('#docs-grid');
      if (grid) {
        if (currentViewMode === 'list') {
          grid.classList.add('list-view');
        } else {
          grid.classList.remove('list-view');
        }
      }
    });
  });

  // Bulk actions
  panel.querySelector('#bulk-delete-btn')?.addEventListener('click', () => bulkDelete(panel, props));
  panel.querySelector('#bulk-export-btn')?.addEventListener('click', () => bulkExport());
  panel.querySelector('#bulk-reprocess-btn')?.addEventListener('click', () => bulkReprocess(panel, props));
  panel.querySelector('#cancel-selection-btn')?.addEventListener('click', () => {
    selectedDocuments.clear();
    updateSelection(panel);
  });
}

/**
 * Load documents
 */
async function loadDocuments(panel: HTMLElement, props: DocumentsPanelProps): Promise<void> {
  const grid = panel.querySelector('#docs-grid') as HTMLElement;
  grid.innerHTML = '<div class="docs-loading" aria-live="polite">Loading files</div>';

  try {
    // Use server-side filtering for better performance
    const result = await documentsService.getAll({
      status: currentStatus === 'all' ? undefined : currentStatus,
      type: currentType === 'all' ? undefined : currentType,
      search: currentSearch || undefined,
      sort: currentSort === 'date' ? 'created_at' : currentSort === 'name' ? 'filename' : undefined,
      order: currentSort === 'date' ? 'desc' : 'asc',
      limit: 100 // Load more items for better UX
    });

    allDocuments = result.documents || [];

    console.log('%c[DocumentsPanel] Load result:', 'color: green; font-weight: bold', {
      total: result.total,
      docsCount: allDocuments.length,
      firstDoc: allDocuments[0],
      currentStatus,
      currentType
    });

    // Update counts
    const statuses = result.statuses || {};
    panel.querySelector('#total-count')!.textContent = String(result.total || allDocuments.length);
    panel.querySelector('#count-processed')!.textContent = String(statuses.processed || 0);
    panel.querySelector('#count-pending')!.textContent = String((statuses.pending || 0) + (statuses.processing || 0));
    panel.querySelector('#count-failed')!.textContent = String(statuses.failed || 0);
    panel.querySelector('#count-deleted')!.textContent = String(statuses.deleted || 0);

    renderFilteredDocuments(panel, props);
  } catch (err) {
    console.error('[DocumentsPanel] Failed to load:', err);
    grid.innerHTML = '<div class="docs-empty-minimal"><div class="empty-icon">!</div><h3>Failed to load files</h3><p>Please try again</p></div>';
  }
}

/**
 * Render filtered documents
 * Note: Server-side filtering is used for status, type, and search.
 * This function now handles only local sorting for size (server doesn't support size sort).
 */
function renderFilteredDocuments(panel: HTMLElement, props: DocumentsPanelProps): void {
  let filtered = [...allDocuments];

  // Only need to handle size sorting locally (server handles date and name)
  if (currentSort === 'size') {
    filtered.sort((a, b) => (b.size || 0) - (a.size || 0));
  }

  renderDocumentsGrid(panel, filtered, props);
}

/**
 * Get document type from filename
 */
function getDocType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext || '')) return 'document';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) return 'image';
  if (['eml', 'msg'].includes(ext || '')) return 'email';
  return 'document';
}

/**
 * Render documents grid
 */
function renderDocumentsGrid(panel: HTMLElement, documents: Document[], props: DocumentsPanelProps): void {
  const grid = panel.querySelector('#docs-grid') as HTMLElement;

  if (documents.length === 0) {
    grid.innerHTML = `
      <div class="docs-empty-minimal">
        <div class="empty-icon">📁</div>
        <h3>No files found</h3>
        <p>Upload files to get started</p>
        <button class="btn-minimal primary" id="empty-upload-btn">Upload Files</button>
      </div>
    `;

    grid.querySelector('#empty-upload-btn')?.addEventListener('click', async () => {
      const { showFileUploadModal } = await import('@components/modals/FileUploadModal');
      showFileUploadModal({ onComplete: () => loadDocuments(panel, props) });
    });
    return;
  }

  // Add data-index for potential virtual scrolling
  grid.innerHTML = documents.map((doc, index) => createDocumentCard(doc, index)).join('');

  // Add total count and scroll height data for virtual scrolling
  grid.setAttribute('data-total', String(documents.length));

  // Bind card events
  grid.querySelectorAll('.doc-card-minimal').forEach(card => {
    const id = card.getAttribute('data-id')!;
    const doc = documents.find(d => String(d.id) === id);

    // Click to preview
    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.doc-select-checkbox') || target.closest('.doc-action-btn')) return;

      if (doc && props.onDocumentClick) {
        props.onDocumentClick(doc);
      }
    });

    // Keyboard navigation
    (card as HTMLElement).addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      const cards = Array.from(grid.querySelectorAll('.doc-card-minimal'));
      const currentIndex = cards.indexOf(card);

      switch (ke.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (doc && props.onDocumentClick) {
            props.onDocumentClick(doc);
          }
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < cards.length - 1) {
            (cards[currentIndex + 1] as HTMLElement).focus();
          }
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            (cards[currentIndex - 1] as HTMLElement).focus();
          }
          break;
        case 's':
          e.preventDefault();
          // Toggle selection
          if (selectedDocuments.has(id)) {
            selectedDocuments.delete(id);
          } else {
            selectedDocuments.add(id);
          }
          updateSelection(panel);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (doc && confirm(`Delete "${doc.filename}"?`)) {
            documentsService.delete(id, { softDelete: true }).then(() => {
              toast.success('File deleted');
              loadDocuments(panel, props);
            }).catch(() => toast.error('Failed to delete'));
          }
          break;
      }
    });

    // Checkbox for selection
    card.querySelector('.doc-select-checkbox')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedDocuments.has(id)) {
        selectedDocuments.delete(id);
      } else {
        selectedDocuments.add(id);
      }
      updateSelection(panel);
    });

    // Favorite toggle
    card.querySelector('.doc-action-btn.favorite')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await http.post(`/api/documents/${id}/favorite`);
        (e.target as HTMLElement).classList.toggle('active');
        toast.success('Updated favorites');
      } catch {
        toast.error('Failed to update favorite');
      }
    });
  });
}

/**
 * Create document card HTML
 */
function createDocumentCard(doc: Document, index = 0): string {
  const iconClass = getIconClass(doc.filename || '');
  const icon = getDocumentIcon(doc.filename || '');
  const isSelected = selectedDocuments.has(doc.id);
  const factsCount = doc.facts_count || 0;
  const decisionsCount = (doc as any).decisions_count || 0;
  const risksCount = (doc as any).risks_count || 0;

  const entitiesLabel = [
    factsCount > 0 ? `${factsCount} facts` : '',
    decisionsCount > 0 ? `${decisionsCount} decisions` : '',
    risksCount > 0 ? `${risksCount} risks` : ''
  ].filter(Boolean).join(', ') || 'No entities';

  return `
    <div class="doc-card-minimal ${isSelected ? 'selected' : ''}" 
         data-id="${doc.id}"
         data-index="${index}"
         role="listitem"
         tabindex="0"
         aria-label="${escapeHtml(doc.filename || 'Untitled')}. Status: ${doc.status}. ${entitiesLabel}">
      <div class="doc-select-checkbox" role="checkbox" aria-checked="${isSelected}" aria-label="Select document">${isSelected ? '✓' : ''}</div>
      
      <div class="doc-card-top">
        <div class="doc-icon-minimal ${iconClass}" aria-hidden="true">${icon}</div>
        <div class="doc-info-minimal">
          <div class="doc-filename-minimal">${escapeHtml(doc.filename || 'Untitled')}</div>
          <div class="doc-meta-minimal">
            <span>${formatFileSize((doc as any).file_size || doc.size || 0)}</span>
            <span class="sep" aria-hidden="true">•</span>
            <span>${formatRelativeTime(doc.created_at)}</span>
          </div>
        </div>
        <span class="doc-status-badge ${doc.status}" aria-label="Status: ${doc.status}">${doc.status}</span>
      </div>
      
      ${doc.summary ? `<div class="doc-summary-minimal">${escapeHtml(doc.summary)}</div>` : ''}
      
      <div class="doc-card-footer">
        <div class="doc-entities" aria-label="Extracted entities">
          ${factsCount > 0 ? `<span class="doc-entity-item facts"><span class="icon" aria-hidden="true">📋</span> ${factsCount} facts</span>` : ''}
          ${decisionsCount > 0 ? `<span class="doc-entity-item decisions"><span class="icon" aria-hidden="true">✓</span> ${decisionsCount}</span>` : ''}
          ${risksCount > 0 ? `<span class="doc-entity-item risks"><span class="icon" aria-hidden="true">⚠</span> ${risksCount}</span>` : ''}
          ${factsCount === 0 && decisionsCount === 0 && risksCount === 0 ? '<span class="doc-entity-item text-muted">No entities</span>' : ''}
        </div>
        <div class="doc-actions-minimal">
          <button class="doc-action-btn favorite ${(doc as any).is_favorite ? 'active' : ''}" 
                  title="Favorite" aria-label="${(doc as any).is_favorite ? 'Remove from favorites' : 'Add to favorites'}"
                  aria-pressed="${(doc as any).is_favorite ? 'true' : 'false'}">★</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get icon class based on file type
 */
function getIconClass(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'doc':
    case 'docx': return 'doc';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif': return 'img';
    case 'txt':
    case 'md': return 'txt';
    default: return 'default';
  }
}

/**
 * Update selection state
 */
function updateSelection(panel: HTMLElement): void {
  const count = selectedDocuments.size;
  const selectionBar = panel.querySelector('#selection-bar') as HTMLElement;

  selectionBar.classList.toggle('hidden', count === 0);
  panel.querySelector('#selected-count')!.textContent = String(count);

  // Update card states
  panel.querySelectorAll('.doc-card-minimal').forEach(card => {
    const id = card.getAttribute('data-id')!;
    const isSelected = selectedDocuments.has(id);
    card.classList.toggle('selected', isSelected);
    const checkbox = card.querySelector('.doc-select-checkbox');
    if (checkbox) checkbox.textContent = isSelected ? '✓' : '';
  });
}

/**
 * Show loading overlay on panel
 */
function showLoadingOverlay(panel: HTMLElement, message: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'bulk-loading-overlay';
  overlay.innerHTML = `
    <div class="bulk-loading-content">
      <div class="bulk-loading-spinner"></div>
      <div class="bulk-loading-message">${message}</div>
      <div class="bulk-loading-progress" id="bulk-progress"></div>
    </div>
  `;
  const content = overlay.querySelector('.bulk-loading-content') as HTMLElement;
  panel.classList.add('position-relative');
  panel.appendChild(overlay);
  return overlay;
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay(overlay: HTMLElement): void {
  overlay?.remove();
}

/**
 * Disable bulk action buttons
 */
function setBulkButtonsDisabled(panel: HTMLElement, disabled: boolean): void {
  const buttons = panel.querySelectorAll('#bulk-delete-btn, #bulk-export-btn, #bulk-reprocess-btn');
  buttons.forEach(btn => {
    (btn as HTMLButtonElement).disabled = disabled;
  });
}

/**
 * Bulk delete
 */
async function bulkDelete(panel: HTMLElement, props: DocumentsPanelProps): Promise<void> {
  const count = selectedDocuments.size;
  if (!confirm(`Delete ${count} files? This action can be undone from the Deleted tab.`)) return;

  const overlay = showLoadingOverlay(panel, `Deleting ${count} files...`);
  setBulkButtonsDisabled(panel, true);

  try {
    const ids = Array.from(selectedDocuments);
    const response = await http.post<{ success: boolean; deleted: number; errors: Array<{ id: string; error: string }> }>(
      '/api/documents/bulk/delete',
      { ids }
    );

    const result = response.data;
    if (result.errors && result.errors.length > 0) {
      toast.warning(`Deleted ${result.deleted} files, ${result.errors.length} failed`);
    } else {
      toast.success(`Deleted ${result.deleted} files`);
    }

    selectedDocuments.clear();
    loadDocuments(panel, props);
  } catch (err) {
    console.error('[BulkDelete] Error:', err);
    toast.error('Failed to delete files');
  } finally {
    hideLoadingOverlay(overlay);
    setBulkButtonsDisabled(panel, false);
  }
}

/**
 * Bulk export
 */
async function bulkExport(): Promise<void> {
  const count = selectedDocuments.size;
  toast.info(`Preparing export of ${count} files...`);

  try {
    const ids = Array.from(selectedDocuments);

    // Trigger download via form submission (for ZIP file)
    const response = await fetchWithProject('/api/documents/bulk/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, format: 'original' })
    });

    if (!response.ok) throw new Error('Export failed');

    // Create download link
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-export-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success(`Exported ${count} files`);
  } catch (err) {
    console.error('[BulkExport] Error:', err);
    toast.error('Failed to export files');
  }
}

/**
 * Bulk reprocess
 */
async function bulkReprocess(panel: HTMLElement, props: DocumentsPanelProps): Promise<void> {
  const count = selectedDocuments.size;
  if (!confirm(`Reprocess ${count} files? This will use AI tokens.`)) return;

  const overlay = showLoadingOverlay(panel, `Queuing ${count} files for reprocessing...`);
  setBulkButtonsDisabled(panel, true);

  try {
    const ids = Array.from(selectedDocuments);
    const response = await http.post<{ success: boolean; queued: string[]; failed: Array<{ id: string; error: string }> }>(
      '/api/documents/bulk/reprocess',
      { ids }
    );

    const result = response.data;
    if (result.failed && result.failed.length > 0) {
      toast.warning(`Queued ${result.queued?.length || 0} files, ${result.failed.length} failed`);
    } else {
      toast.success(`Queued ${result.queued?.length || count} files for reprocessing`);
    }

    selectedDocuments.clear();
    updateSelection(panel);

    // Reload after a short delay to show updated statuses
    setTimeout(() => loadDocuments(panel, props), 1000);
  } catch (err) {
    console.error('[BulkReprocess] Error:', err);
    toast.error('Failed to queue files for reprocessing');
  } finally {
    hideLoadingOverlay(overlay);
    setBulkButtonsDisabled(panel, false);
  }
}

/**
 * Get document icon
 */
function getDocumentIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return '📄';
    case 'doc':
    case 'docx': return '📝';
    case 'xls':
    case 'xlsx': return '📊';
    case 'ppt':
    case 'pptx': return '📽️';
    case 'txt':
    case 'md': return '📃';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif': return '🖼️';
    default: return '📁';
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

export default createDocumentsPanel;
