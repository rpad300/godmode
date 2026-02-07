/**
 * Documents Panel Component - Clean Minimal Design
 * Document list with elegant search, filters, and cards
 */

import { createElement } from '../utils/dom';
import { documentsService, Document } from '../services/documents';
import { toast } from '../services/toast';
import { formatRelativeTime, formatFileSize } from '../utils/format';
import { http } from '../services/api';

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
  const panel = createElement('div', { className: 'admin-panel' }); // Using standard admin-panel layout

  panel.innerHTML = `
    <!-- Header -->
    <header class="admin-header">
      <div class="admin-header__title">
        <h1>Files</h1>
        <div class="admin-header__meta" id="total-count-wrapper">
          <span id="total-count" class="badge badge--pill badge--primary">0</span> documents
        </div>
      </div>
      <div class="admin-header__actions">
        <!-- View Mode Toggle -->
        <div class="tabs tabs--pills">
          <div class="tab-list" role="tablist">
            <button class="tab-button active view-mode-btn" data-view="grid" role="tab" aria-selected="true" aria-label="Grid view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button class="tab-button view-mode-btn" data-view="list" role="tab" aria-selected="false" aria-label="List view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        
        <button class="gm-btn gm-btn--primary" id="upload-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload
        </button>
      </div>
    </header>

    <!-- Controls -->
    <div class="admin-controls">
      <div class="gm-field" style="max-width: 400px; flex: 1;">
        <div class="gm-input-wrapper" style="position: relative;">
          <svg style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input class="gm-input" style="padding-left: 36px;" type="text" id="docs-search-input" placeholder="Search files..." aria-label="Search files" autocomplete="off">
        </div>
      </div>
      
      <div class="tabs tabs--pills">
        <div class="tab-list" role="tablist" aria-label="Filter by document type">
          <button class="tab-button active filter-chip" data-type="all" role="tab" aria-selected="true">All</button>
          <button class="tab-button filter-chip" data-type="documents" role="tab" aria-selected="false">Documents</button>
          <button class="tab-button filter-chip" data-type="transcripts" role="tab" aria-selected="false">Transcripts</button>
          <button class="tab-button filter-chip" data-type="emails" role="tab" aria-selected="false">Emails</button>
          <button class="tab-button filter-chip" data-type="images" role="tab" aria-selected="false">Images</button>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="admin-toolbar" role="tablist" aria-label="Filter by status" style="border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-4); margin-bottom: var(--space-6); display: flex; gap: var(--space-2); align-items: center;">
      <button class="badge badge--pill badge--success status-chip active" data-status="processed" role="tab" aria-selected="true" style="cursor: pointer; opacity: 1;">
        Processed <span id="count-processed" style="margin-left: 4px; opacity: 0.8;">0</span>
      </button>
      <button class="badge badge--pill badge--warning status-chip" data-status="pending" role="tab" aria-selected="false" style="cursor: pointer; opacity: 0.6; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary);">
        Pending <span id="count-pending" style="margin-left: 4px; opacity: 0.8;">0</span>
      </button>
      <button class="badge badge--pill badge--danger status-chip" data-status="failed" role="tab" aria-selected="false" style="cursor: pointer; opacity: 0.6; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary);">
        Failed <span id="count-failed" style="margin-left: 4px; opacity: 0.8;">0</span>
      </button>
      <button class="badge badge--pill badge--outline status-chip" data-status="deleted" role="tab" aria-selected="false" style="cursor: pointer; opacity: 0.6; color: var(--color-text-secondary);">
        Deleted <span id="count-deleted" style="margin-left: 4px; opacity: 0.8;">0</span>
      </button>
      
      <div style="flex: 1;"></div>
      
      <div class="gm-field" style="width: auto;">
        <select class="gm-select" id="sort-select" aria-label="Sort files" style="min-height: 32px; padding-top: 4px; padding-bottom: 4px;">
          <option value="date">Newest first</option>
          <option value="name">Name A-Z</option>
          <option value="size">Largest first</option>
        </select>
      </div>
    </div>

    <!-- Content -->
    <div class="admin-content" role="main">
      <div id="docs-grid" class="docs-grid" role="list" aria-label="Document list">
        <!-- Content injected here -->
        <div class="gm-loading" aria-live="polite">Loading files…</div>
      </div>
    </div>

    <!-- Selection Bar (Toast style) -->
    <div class="toast-container hidden" id="selection-bar" style="pointer-events: auto;">
      <div class="toast toast--info" role="alert" style="align-items: center;">
        <div class="toast-content" style="display: flex; align-items: center; gap: var(--space-4); width: 100%;">
          <span style="font-weight: 600; white-space: nowrap;"><span id="selected-count">0</span> selected</span>
          <div style="display: flex; gap: var(--space-2);">
            <button class="gm-btn gm-btn--sm gm-btn--secondary" id="bulk-export-btn">Export</button>
            <button class="gm-btn gm-btn--sm gm-btn--secondary" id="bulk-reprocess-btn">Reprocess</button>
            <button class="gm-btn gm-btn--sm gm-btn--danger" id="bulk-delete-btn">Delete</button>
            <button class="gm-btn gm-btn--sm gm-btn--ghost" id="cancel-selection-btn">Cancel</button>
          </div>
        </div>
      </div>
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
    const { showFileUploadModal } = await import('./modals/FileUploadModal');
    showFileUploadModal({ onComplete: () => loadDocuments(panel, props) });
  });

  // Search
  const searchInput = panel.querySelector('#docs-search-input') as HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const newSearch = searchInput.value.trim();
      if (newSearch !== currentSearch) {
        currentSearch = newSearch;
        loadDocuments(panel, props);
      }
    }, 500);
  });

  // Sort select
  panel.querySelector('#sort-select')?.addEventListener('change', (e) => {
    currentSort = (e.target as HTMLSelectElement).value as SortOption;
    renderFilteredDocuments(panel, props);
  });

  // Type filters
  panel.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      currentType = chip.getAttribute('data-type') as TypeFilter;
      renderFilteredDocuments(panel, props);
    });
  });

  // Status chips
  panel.querySelectorAll('.status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // Reset visual styles manually for custom behavior
      panel.querySelectorAll('.status-chip').forEach(c => {
        c.classList.remove('active');
        (c as HTMLElement).style.opacity = '0.6';
        (c as HTMLElement).style.background = 'transparent';
        if (c.classList.contains('badge--outline')) {
           // Deleted state
        } else {
           (c as HTMLElement).style.color = 'var(--color-text-secondary)';
           (c as HTMLElement).style.border = '1px solid var(--color-border)';
        }
      });
      
      chip.classList.add('active');
      (chip as HTMLElement).style.opacity = '1';
      // Re-apply badge styles
      if (chip.classList.contains('badge--success')) {
         (chip as HTMLElement).style.background = 'var(--color-success)'; // Actually badge--success uses color-mix, reset to class defaults via css
         (chip as HTMLElement).removeAttribute('style'); // Clear inline overrides to let CSS take over
         (chip as HTMLElement).style.cursor = 'pointer';
      } else if (chip.classList.contains('badge--warning')) {
         (chip as HTMLElement).removeAttribute('style');
         (chip as HTMLElement).style.cursor = 'pointer';
      } else if (chip.classList.contains('badge--danger')) {
         (chip as HTMLElement).removeAttribute('style');
         (chip as HTMLElement).style.cursor = 'pointer';
      } else {
         (chip as HTMLElement).removeAttribute('style');
         (chip as HTMLElement).style.cursor = 'pointer';
      }

      currentStatus = chip.getAttribute('data-status') as StatusFilter;
      loadDocuments(panel, props);
    });
  });

  // View mode toggle
  panel.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.view-mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentViewMode = btn.getAttribute('data-view') as ViewMode;
      renderFilteredDocuments(panel, props);
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
  grid.innerHTML = '<div class="gm-loading">Loading files…</div>';

  try {
    const result = await documentsService.getAll({
      status: currentStatus === 'all' ? undefined : currentStatus,
      type: currentType === 'all' ? undefined : currentType,
      search: currentSearch || undefined,
      sort: currentSort === 'date' ? 'created_at' : currentSort === 'name' ? 'filename' : undefined,
      order: currentSort === 'date' ? 'desc' : 'asc',
      limit: 100
    });
    
    allDocuments = result.documents || [];
    
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
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">!</div>
        <h3 class="empty-state__title">Failed to load files</h3>
        <p class="empty-state__text">Please try again</p>
      </div>
    `;
  }
}

/**
 * Render filtered documents
 */
function renderFilteredDocuments(panel: HTMLElement, props: DocumentsPanelProps): void {
  let filtered = [...allDocuments];
  
  if (currentSort === 'size') {
    filtered.sort((a, b) => (b.size || 0) - (a.size || 0));
  }
  
  const grid = panel.querySelector('#docs-grid') as HTMLElement;
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📁</div>
        <h3 class="empty-state__title">No files found</h3>
        <p class="empty-state__text">Upload files to get started</p>
        <button class="gm-btn gm-btn--primary" id="empty-upload-btn">Upload Files</button>
      </div>
    `;
    
    grid.querySelector('#empty-upload-btn')?.addEventListener('click', async () => {
      const { showFileUploadModal } = await import('./modals/FileUploadModal');
      showFileUploadModal({ onComplete: () => loadDocuments(panel, props) });
    });
    return;
  }

  if (currentViewMode === 'list') {
    renderListView(grid, filtered, props);
  } else {
    renderGridView(grid, filtered, props);
  }
}

function renderGridView(container: HTMLElement, documents: Document[], props: DocumentsPanelProps): void {
  // Use standard grid layout
  container.className = 'docs-grid';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
  container.style.gap = 'var(--space-5)';

  container.innerHTML = documents.map(doc => {
    const isSelected = selectedDocuments.has(doc.id);
    const icon = getDocumentIcon(doc.filename || '');
    const badgeClass = getStatusBadgeClass(doc.status);
    
    return `
      <div class="card ${isSelected ? 'is-selected' : ''}" 
           data-id="${doc.id}" 
           style="position: relative; cursor: pointer; transition: all 0.2s ease; ${isSelected ? 'border-color: var(--color-primary); background-color: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));' : ''}"
           tabindex="0">
        
        <div class="checkbox-control" style="position: absolute; top: var(--space-4); left: var(--space-4); z-index: 10; ${isSelected ? 'opacity: 1;' : 'opacity: 0;'}" role="checkbox" aria-checked="${isSelected}"></div>

        <div class="card__header" style="display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-3);">
          <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--color-surface-2); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            ${icon}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;" title="${escapeHtml(doc.filename)}">
              ${escapeHtml(doc.filename || 'Untitled')}
            </div>
            <div style="font-size: var(--font-size-caption); color: var(--color-text-secondary);">
              ${formatFileSize((doc as any).file_size || doc.size || 0)} • ${formatRelativeTime(doc.created_at)}
            </div>
          </div>
          <span class="badge ${badgeClass}">${doc.status}</span>
        </div>

        ${doc.summary ? `<div style="font-size: var(--font-size-small); color: var(--color-text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: var(--space-4);">${escapeHtml(doc.summary)}</div>` : ''}

        <div class="card__footer" style="margin-top: auto; padding-top: var(--space-3); border-top: 1px solid var(--color-border-muted); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: var(--space-3); font-size: var(--font-size-caption); color: var(--color-text-secondary);">
            ${(doc.facts_count || 0) > 0 ? `<span>📋 ${doc.facts_count}</span>` : ''}
            ${((doc as any).decisions_count || 0) > 0 ? `<span>✓ ${(doc as any).decisions_count}</span>` : ''}
          </div>
          <button class="gm-btn gm-btn--ghost gm-btn--sm doc-favorite-btn ${(doc as any).is_favorite ? 'active' : ''}" style="padding: 4px;">
            ${(doc as any).is_favorite ? '★' : '☆'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  attachCardEvents(container, documents, props);
}

function renderListView(container: HTMLElement, documents: Document[], props: DocumentsPanelProps): void {
  container.className = 'docs-list';
  container.style.display = 'block';

  const rows = documents.map(doc => {
    const isSelected = selectedDocuments.has(doc.id);
    const icon = getDocumentIcon(doc.filename || '');
    const badgeClass = getStatusBadgeClass(doc.status);

    return `
      <tr class="${isSelected ? 'is-selected' : ''}" data-id="${doc.id}" style="cursor: pointer;">
        <td class="table-cell-fit">
          <div class="checkbox-control ${isSelected ? 'checked' : ''}" style="pointer-events: none; border-color: ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}; background-color: ${isSelected ? 'var(--color-primary)' : 'transparent'};"></div>
        </td>
        <td class="table-cell-fit">
          <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--color-surface-2); display: flex; align-items: center; justify-content: center;">${icon}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(doc.filename || 'Untitled')}</div>
          <div style="font-size: var(--font-size-caption); color: var(--color-text-muted); display: none;" class="mobile-only">
            ${formatFileSize((doc as any).file_size || doc.size || 0)} • ${doc.status}
          </div>
        </td>
        <td style="color: var(--color-text-secondary);">${formatFileSize((doc as any).file_size || doc.size || 0)}</td>
        <td style="color: var(--color-text-secondary);">${formatRelativeTime(doc.created_at)}</td>
        <td><span class="badge ${badgeClass}">${doc.status}</span></td>
        <td class="table-cell-right">
           <button class="gm-btn gm-btn--ghost gm-btn--sm doc-favorite-btn ${(doc as any).is_favorite ? 'active' : ''}">
            ${(doc as any).is_favorite ? '★' : '☆'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 40px;"></th>
            <th style="width: 48px;"></th>
            <th>Name</th>
            <th>Size</th>
            <th>Date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  // Re-attach events to rows
  const tbody = container.querySelector('tbody');
  if (tbody) attachCardEvents(tbody, documents, props, true);
}

function attachCardEvents(container: HTMLElement, documents: Document[], props: DocumentsPanelProps, isList = false): void {
  const selector = isList ? 'tr' : '.card';
  
  container.querySelectorAll(selector).forEach(el => {
    const element = el as HTMLElement;
    const id = element.getAttribute('data-id')!;
    const doc = documents.find(d => String(d.id) === id);

    // Click (Selection vs Navigation logic)
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // If clicking checkbox area or holding Shift/Cmd, toggle selection
      // For now, simplify: Click = Open, Ctrl/Cmd+Click = Select?
      // Or: Checkbox is explicit.
      
      if (target.closest('.checkbox-control') || e.ctrlKey || e.metaKey) {
        toggleSelection(id);
      } else if (target.closest('.doc-favorite-btn')) {
        // Handled separately
      } else {
        if (doc && props.onDocumentClick) props.onDocumentClick(doc);
      }
    });

    // Favorite
    element.querySelector('.doc-favorite-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await http.post(`/api/documents/${id}/favorite`);
        (e.target as HTMLElement).classList.toggle('active');
        toast.success('Updated favorites');
      } catch {
        toast.error('Failed to update');
      }
    });
  });
}

function toggleSelection(id: string) {
  if (selectedDocuments.has(id)) {
    selectedDocuments.delete(id);
  } else {
    selectedDocuments.add(id);
  }
  
  const panel = document.querySelector('.admin-panel');
  if (panel) updateSelection(panel as HTMLElement);
}


function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'processed': return 'badge--success';
    case 'pending':
    case 'processing': return 'badge--warning';
    case 'failed': return 'badge--danger';
    case 'deleted': return 'badge--outline';
    default: return 'badge--info';
  }
}

function updateSelection(panel: HTMLElement): void {
  const count = selectedDocuments.size;
  const selectionBar = panel.querySelector('#selection-bar') as HTMLElement;
  
  if (count > 0) {
    selectionBar.classList.remove('hidden');
    // Ensure it is visible
    selectionBar.style.display = 'flex';
  } else {
    selectionBar.classList.add('hidden');
    selectionBar.style.display = 'none';
  }
  
  panel.querySelector('#selected-count')!.textContent = String(count);
  
  // Update visual state of cards/rows
  const grid = panel.querySelector('#docs-grid');
  if (!grid) return;

  // Grid view
  grid.querySelectorAll('.card').forEach(card => {
    const id = card.getAttribute('data-id')!;
    const isSelected = selectedDocuments.has(id);
    card.classList.toggle('is-selected', isSelected);
    
    // Update inline styles for selection border
    if (isSelected) {
       (card as HTMLElement).style.borderColor = 'var(--color-primary)';
       (card as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))';
       const cb = card.querySelector('.checkbox-control') as HTMLElement;
       if (cb) cb.style.opacity = '1';
    } else {
       (card as HTMLElement).style.borderColor = '';
       (card as HTMLElement).style.backgroundColor = '';
       const cb = card.querySelector('.checkbox-control') as HTMLElement;
       if (cb) cb.style.opacity = '0';
    }
  });

  // List view
  grid.querySelectorAll('tr').forEach(row => {
    const id = row.getAttribute('data-id')!;
    const isSelected = selectedDocuments.has(id);
    row.classList.toggle('is-selected', isSelected);
    
    const cb = row.querySelector('.checkbox-control') as HTMLElement;
    if (cb) {
       cb.classList.toggle('checked', isSelected);
       if (isSelected) {
         cb.style.borderColor = 'var(--color-primary)';
         cb.style.backgroundColor = 'var(--color-primary)';
       } else {
         cb.style.borderColor = 'var(--color-border)';
         cb.style.backgroundColor = 'transparent';
       }
    }
  });
}

// Helpers reused from original
function showLoadingOverlay(panel: HTMLElement, message: string): HTMLElement {
  // Simple implementation using new primitives if possible, or inline styles for now
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop is-visible';
  overlay.style.zIndex = '200';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  
  overlay.innerHTML = `
    <div class="card" style="padding: var(--space-6); text-align: center;">
      <div class="gm-loading" style="margin-bottom: var(--space-4);"></div>
      <div>${message}</div>
    </div>
  `;
  panel.appendChild(overlay);
  return overlay;
}

function hideLoadingOverlay(overlay: HTMLElement): void {
  overlay.remove();
}

function setBulkButtonsDisabled(panel: HTMLElement, disabled: boolean): void {
  const buttons = panel.querySelectorAll('#bulk-delete-btn, #bulk-export-btn, #bulk-reprocess-btn');
  buttons.forEach(btn => {
    (btn as HTMLButtonElement).disabled = disabled;
  });
}

// Bulk actions logic remains same
async function bulkDelete(panel: HTMLElement, props: DocumentsPanelProps): Promise<void> {
  const count = selectedDocuments.size;
  if (!confirm(`Delete ${count} files?`)) return;
  const overlay = showLoadingOverlay(panel, `Deleting ${count} files...`);
  setBulkButtonsDisabled(panel, true);
  try {
    const ids = Array.from(selectedDocuments);
    await http.post('/api/documents/bulk/delete', { ids });
    toast.success(`Deleted ${count} files`);
    selectedDocuments.clear();
    loadDocuments(panel, props);
  } catch (err) {
    toast.error('Failed to delete files');
  } finally {
    hideLoadingOverlay(overlay);
    setBulkButtonsDisabled(panel, false);
  }
}

async function bulkExport(): Promise<void> {
  // Logic same as original
  const count = selectedDocuments.size;
  toast.info(`Preparing export of ${count} files...`);
  try {
     const ids = Array.from(selectedDocuments);
     const response = await http.post<Blob>('/api/documents/bulk/export', { ids, format: 'original' }, { responseType: 'blob' });
     const blob = response.data;
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `export-${Date.now()}.zip`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     toast.success('Export started');
  } catch {
     toast.error('Export failed');
  }
}

async function bulkReprocess(panel: HTMLElement, props: DocumentsPanelProps): Promise<void> {
  const count = selectedDocuments.size;
  if (!confirm(`Reprocess ${count} files?`)) return;
  const overlay = showLoadingOverlay(panel, 'Queuing...');
  setBulkButtonsDisabled(panel, true);
  try {
    const ids = Array.from(selectedDocuments);
    await http.post('/api/documents/bulk/reprocess', { ids });
    toast.success('Reprocessing queued');
    selectedDocuments.clear();
    loadDocuments(panel, props);
  } catch {
    toast.error('Failed to reprocess');
  } finally {
    hideLoadingOverlay(overlay);
    setBulkButtonsDisabled(panel, false);
  }
}

function getDocumentIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return '📄';
    case 'doc': case 'docx': return '📝';
    case 'xls': case 'xlsx': return '📊';
    case 'jpg': case 'png': return '🖼️';
    default: return '📁';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default createDocumentsPanel;
