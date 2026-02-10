/**
 * Document Preview Modal - SOTA
 * Full document preview with AI analysis, versions, activity, sharing
 */

import { Document, documentsService } from '../../services/documents';
import { http } from '../../services/api';
import { toast } from '../../services/toast';
import { formatRelativeTime, formatFileSize, formatDateTime } from '../../utils/format';

export interface DocumentPreviewProps {
  document: Document;
  onClose?: () => void;
  onUpdate?: () => void;
}

interface DocumentVersion {
  id: string;
  version_number: number;
  is_current: boolean;
  filename: string;
  file_size: number;
  change_notes?: string;
  ai_change_summary?: string;
  uploaded_by?: string;
  created_at: string;
}

interface DocumentActivity {
  id: string;
  action: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

interface AIAnalysis {
  id: string;
  document_id: string;
  analysis_type: string;
  provider: string;
  model: string;
  status: string;
  entities_extracted?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost?: number;
  latency_ms?: number;
  result?: Record<string, unknown>;
  created_at: string;
}

// State
let currentTab = 'preview';
let isFavorite = false;
let activeReprocessInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Show document preview modal
 */
export function showDocumentPreviewModal(props: DocumentPreviewProps): void {
  const { document: doc } = props;

  const content = document.createElement('div');
  content.className = 'document-preview-modal';
  content.innerHTML = `
    <style>
      .document-preview-modal {
        display: flex;
        flex-direction: column;
        height: 80vh;
        max-height: 800px;
        width: 900px;
        max-width: 95vw;
      }
      .preview-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
      }
      .preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
      }
      .preview-title-section {
        flex: 1;
        min-width: 0;
      }
      .preview-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preview-meta {
        display: flex;
        gap: 12px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .preview-meta span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .preview-actions {
        display: flex;
        gap: 8px;
      }
      .preview-actions .btn {
        padding: 8px 12px;
        font-size: 13px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .btn-favorite {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
      }
      .btn-favorite.active {
        background: rgba(255, 193, 7, 0.1);
        border-color: #ffc107;
        color: #ffc107;
      }
      .preview-tabs {
        display: flex;
        gap: 0;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .preview-tab {
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary);
        background: transparent;
        border: none;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      }
      .preview-tab:hover {
        color: var(--text-primary);
        background: rgba(var(--primary-rgb), 0.05);
      }
      .preview-tab.active {
        color: var(--primary);
      }
      .preview-tab.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--primary);
        border-radius: 2px 2px 0 0;
      }
      .preview-tab-badge {
        margin-left: 6px;
        padding: 2px 6px;
        font-size: 11px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 10px;
        color: var(--primary);
      }
      .preview-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      .preview-section {
        display: none;
      }
      .preview-section.active {
        display: block;
      }
      
      /* Content Preview */
      .content-preview {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        max-height: 500px;
        overflow-y: auto;
      }
      .content-empty, .content-loading {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary);
      }
      .content-loading::after {
        content: '';
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-left: 8px;
        vertical-align: middle;
      }
      .content-empty svg {
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: 16px;
      }
      
      /* Summary Section */
      .summary-card {
        background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), rgba(var(--primary-rgb), 0.02));
        border: 1px solid rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .summary-card h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .summary-card p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-secondary);
      }
      
      /* Entities Grid */
      .entities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-top: 20px;
      }
      .entity-card {
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: background 0.3s ease, transform 0.2s ease;
      }
      .entity-card.updated {
        animation: pulse-highlight 1.5s ease;
      }
      @keyframes pulse-highlight {
        0% { background: rgba(var(--primary-rgb), 0.3); transform: scale(1.02); }
        50% { background: rgba(var(--primary-rgb), 0.15); }
        100% { background: var(--bg-secondary); transform: scale(1); }
      }
      .entity-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      .entity-icon.facts { background: rgba(59, 130, 246, 0.1); }
      .entity-icon.decisions { background: rgba(16, 185, 129, 0.1); }
      .entity-icon.risks { background: rgba(239, 68, 68, 0.1); }
      .entity-icon.actions { background: rgba(245, 158, 11, 0.1); }
      .entity-icon.questions { background: rgba(139, 92, 246, 0.1); }
      .entity-icon.people { background: rgba(6, 182, 212, 0.1); }
      .entity-info h5 {
        margin: 0 0 2px 0;
        font-size: 20px;
        font-weight: 600;
      }
      .entity-info span {
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      /* Analysis List */
      .analysis-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .analysis-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 10px;
        transition: all 0.2s;
      }
      .analysis-item:hover {
        background: rgba(var(--primary-rgb), 0.05);
      }
      .analysis-version {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: var(--primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
      }
      .analysis-info {
        flex: 1;
        min-width: 0;
      }
      .analysis-title {
        font-weight: 500;
        margin-bottom: 4px;
      }
      .analysis-meta {
        font-size: 12px;
        color: var(--text-secondary);
        display: flex;
        gap: 12px;
      }
      .analysis-actions {
        display: flex;
        gap: 8px;
      }
      
      /* Activity Timeline */
      .activity-timeline {
        position: relative;
        padding-left: 24px;
      }
      .activity-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border-color);
      }
      .activity-item {
        position: relative;
        padding: 12px 0 12px 20px;
      }
      .activity-item::before {
        content: '';
        position: absolute;
        left: -20px;
        top: 18px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--primary);
        border: 2px solid var(--bg-primary);
      }
      .activity-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .activity-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
      .activity-text {
        flex: 1;
      }
      .activity-text strong {
        font-weight: 500;
      }
      .activity-time {
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      /* Versions List */
      .versions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .version-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 10px;
        border: 1px solid transparent;
      }
      .version-item.current {
        border-color: var(--primary);
        background: rgba(var(--primary-rgb), 0.05);
      }
      .version-badge {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
      }
      .version-item.current .version-badge {
        background: var(--primary);
        color: white;
      }
      .version-info {
        flex: 1;
        min-width: 0;
      }
      .version-title {
        font-weight: 500;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .version-title .current-tag {
        font-size: 10px;
        padding: 2px 6px;
        background: var(--primary);
        color: white;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .version-notes {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .version-meta {
        font-size: 12px;
        color: var(--text-tertiary);
      }
      .version-ai-summary {
        margin-top: 8px;
        padding: 10px;
        background: rgba(var(--primary-rgb), 0.05);
        border-radius: 6px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .version-ai-summary strong {
        color: var(--primary);
      }
      
      /* Tags Section */
      .tags-section {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }
      .doc-tag {
        padding: 4px 10px;
        background: rgba(var(--primary-rgb), 0.1);
        border-radius: 12px;
        font-size: 12px;
        color: var(--primary);
      }
      
      /* Share Panel */
      .share-panel {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
      }
      .share-link-container {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .share-link-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 13px;
        background: var(--bg-primary);
      }
      .share-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .share-option {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .share-option label {
        font-size: 12px;
        color: var(--text-secondary);
      }
      .share-option input, .share-option select {
        padding: 8px 10px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 13px;
        background: var(--bg-primary);
      }
      
      /* Empty State */
      .empty-section {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary);
      }
      .empty-section svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
        margin-bottom: 12px;
      }
      
      /* Spinner for button loading state */
      .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 6px;
        vertical-align: middle;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      #reprocess-btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }
    </style>
    
    <div class="preview-header">
      <div class="preview-icon">${getDocIcon(doc.filename || '')}</div>
      <div class="preview-title-section">
        <h3 class="preview-title">${escapeHtml(doc.filename || doc.originalName || 'Untitled')}</h3>
        <div class="preview-meta">
          <span>${formatFileSize(doc.size || 0)}</span>
          <span>${formatRelativeTime(doc.created_at)}</span>
          <span class="status-badge status-${doc.status}">${doc.status}</span>
        </div>
      </div>
      <div class="preview-actions">
        <button class="btn btn-favorite ${isFavorite ? 'active' : ''}" id="favorite-btn" title="Favorite">
          ${isFavorite ? '★' : '☆'}
        </button>
        <button class="btn btn-secondary" id="share-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share
        </button>
        <button class="btn btn-secondary" id="download-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
        <button class="btn btn-primary" id="reprocess-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Reprocess
        </button>
      </div>
    </div>
    
    <div class="preview-tabs">
      <button class="preview-tab active" data-tab="preview">Preview</button>
      <button class="preview-tab hidden" data-tab="entities" id="entities-tab">
        Entities
        <span class="preview-tab-badge" id="entities-count">0</span>
      </button>
      <button class="preview-tab" data-tab="analysis">
        AI Analysis
        <span class="preview-tab-badge" id="analysis-count">0</span>
      </button>
      <button class="preview-tab hidden" data-tab="notes" id="notes-tab">
        Meeting Notes
      </button>
      <button class="preview-tab" data-tab="versions">
        Versions
        <span class="preview-tab-badge" id="versions-count">1</span>
      </button>
      <button class="preview-tab" data-tab="activity">Activity</button>
      <button class="preview-tab" data-tab="share">Share</button>
    </div>
    
    <div class="preview-content">
      <!-- Preview Tab -->
      <div class="preview-section active" data-section="preview">
        <div class="summary-card${doc.summary ? '' : ' hidden'}" id="summary-card">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              AI Summary
            </h4>
            <p id="doc-summary">${doc.summary ? escapeHtml(doc.summary) : ''}</p>
          </div>
        
        <div class="entities-grid" id="entities-grid">
          <div class="entity-card" data-entity="facts">
            <div class="entity-icon facts">📋</div>
            <div class="entity-info">
              <h5 class="entity-count">${doc.facts_count || 0}</h5>
              <span>Facts</span>
            </div>
          </div>
          <div class="entity-card" data-entity="decisions">
            <div class="entity-icon decisions">✓</div>
            <div class="entity-info">
              <h5 class="entity-count">${(doc as any).decisions_count || 0}</h5>
              <span>Decisions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="risks">
            <div class="entity-icon risks">⚠️</div>
            <div class="entity-info">
              <h5 class="entity-count">${(doc as any).risks_count || 0}</h5>
              <span>Risks</span>
            </div>
          </div>
          <div class="entity-card" data-entity="actions">
            <div class="entity-icon actions">📌</div>
            <div class="entity-info">
              <h5 class="entity-count">${(doc as any).actions_count || 0}</h5>
              <span>Actions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="questions">
            <div class="entity-icon questions">❓</div>
            <div class="entity-info">
              <h5 class="entity-count">${doc.questions_count || 0}</h5>
              <span>Questions</span>
            </div>
          </div>
          <div class="entity-card" data-entity="people">
            <div class="entity-icon people">👥</div>
            <div class="entity-info">
              <h5 class="entity-count" id="people-count">${(doc as any).people_count || 0}</h5>
              <span>People</span>
            </div>
          </div>
        </div>
        
        ${(doc as any).tags?.length ? `
          <div class="tags-section">
            ${((doc as any).tags as string[]).map(tag => `<span class="doc-tag">#${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <h4 class="document-preview-content-heading">Content Preview</h4>
        <div class="content-preview" id="content-preview">
          <div class="content-loading">Loading content...</div>
        </div>
      </div>
      
      <!-- Entities Tab (full extraction results) -->
      <div class="preview-section" data-section="entities">
        <div class="entities-full-list" id="entities-full-list">
          <div class="empty-section">Loading entities...</div>
        </div>
      </div>
      
      <!-- AI Analysis Tab -->
      <div class="preview-section" data-section="analysis">
        <div class="analysis-list" id="analysis-list">
          <div class="empty-section">Loading analysis history...</div>
        </div>
      </div>
      
      <!-- Versions Tab -->
      <div class="preview-section" data-section="versions">
        <div class="document-preview-actions-row">
          <button class="btn btn-primary" id="upload-version-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload New Version
          </button>
        </div>
        <div class="versions-list" id="versions-list">
          <div class="empty-section">Loading versions...</div>
        </div>
      </div>
      
      <!-- Meeting Notes Tab -->
      <div class="preview-section" data-section="notes">
        <div class="notes-container" id="notes-container">
          <div class="empty-section">No meeting notes available</div>
        </div>
      </div>
      
      <!-- Activity Tab -->
      <div class="preview-section" data-section="activity">
        <div class="activity-timeline" id="activity-timeline">
          <div class="empty-section">Loading activity...</div>
        </div>
      </div>
      
      <!-- Share Tab -->
      <div class="preview-section" data-section="share">
        <div class="share-panel">
          <h4 class="document-preview-share-heading">Create Share Link</h4>
          <div class="share-link-container">
            <input type="text" class="share-link-input" id="share-link-input" placeholder="Generate a link to share..." readonly>
            <button class="btn btn-primary" id="generate-link-btn">Generate</button>
            <button class="btn btn-secondary hidden" id="copy-link-btn">Copy</button>
          </div>
          <div class="share-options">
            <div class="share-option">
              <label>Expires</label>
              <select id="share-expires">
                <option value="1d">1 day</option>
                <option value="7d" selected>7 days</option>
                <option value="30d">30 days</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div class="share-option">
              <label>Max Views</label>
              <input type="number" id="share-max-views" placeholder="Unlimited" min="1">
            </div>
            <div class="share-option">
              <label>Password (optional)</label>
              <input type="password" id="share-password" placeholder="No password">
            </div>
            <div class="share-option">
              <label>Permissions</label>
              <select id="share-permissions">
                <option value="view">View only</option>
                <option value="download">View & Download</option>
              </select>
            </div>
          </div>
        </div>
        <div class="document-preview-active-shares" id="active-shares"></div>
      </div>
    </div>
  `;

  // Bind tab events
  content.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab')!;
      switchTab(content, tabName);
    });
  });

  // Bind action buttons
  content.querySelector('#favorite-btn')?.addEventListener('click', () => toggleFavorite(content, doc));
  content.querySelector('#share-btn')?.addEventListener('click', () => switchTab(content, 'share'));
  content.querySelector('#download-btn')?.addEventListener('click', () => downloadDocument(doc));
  content.querySelector('#reprocess-btn')?.addEventListener('click', () => reprocessDocument(doc, props.onUpdate));
  content.querySelector('#upload-version-btn')?.addEventListener('click', () => uploadNewVersion(doc, content, props.onUpdate));
  content.querySelector('#generate-link-btn')?.addEventListener('click', () => generateShareLink(content, doc));
  content.querySelector('#copy-link-btn')?.addEventListener('click', () => copyShareLink(content));

  // Load data
  loadContentPreview(content, doc.id);
  loadEntities(content, doc.id);
  loadAnalysisHistory(content, doc.id);
  loadVersions(content, doc.id);
  loadActivity(content, doc.id);
  loadMeetingNotes(content, doc.id);
  checkFavoriteStatus(doc.id).then(fav => {
    isFavorite = fav;
    updateFavoriteButton(content);
  });

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay document-preview-overlay';

  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-container document-preview-modal-container';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'document-preview-close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => closePreviewModal(overlay, props.onClose);

  content.classList.add('position-relative');
  content.appendChild(closeBtn);
  modalContainer.appendChild(content);
  overlay.appendChild(modalContainer);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closePreviewModal(overlay, props.onClose);
    }
  });

  // Close on Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePreviewModal(overlay, props.onClose);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  document.body.appendChild(overlay);
}

function closePreviewModal(overlay: HTMLElement, onClose?: () => void): void {
  // Clear any active reprocess polling interval
  if (activeReprocessInterval) {
    clearInterval(activeReprocessInterval);
    activeReprocessInterval = null;
  }
  
  overlay.style.animation = 'fadeOut 0.2s ease-out';
  setTimeout(() => {
    overlay.remove();
    onClose?.();
  }, 200);
}

function switchTab(container: HTMLElement, tabName: string): void {
  currentTab = tabName;
  
  container.querySelectorAll('.preview-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
  });
  
  container.querySelectorAll('.preview-section').forEach(s => {
    s.classList.toggle('active', s.getAttribute('data-section') === tabName);
  });
}

/**
 * Load document content preview
 */
async function loadContentPreview(container: HTMLElement, docId: string): Promise<void> {
  const contentEl = container.querySelector('#content-preview') as HTMLElement;
  
  try {
    // Fetch full document with content
    const response = await http.get<{ document?: { content?: string } } | { content?: string }>(`/api/documents/${docId}`);
    const doc = (response.data as { document?: { content?: string } }).document || response.data;
    const content = doc?.content;
    
    if (content) {
      const truncated = content.length > 5000;
      contentEl.innerHTML = `<pre class="conv-notes-pre">${escapeHtml(content.substring(0, 5000))}${truncated ? '\n\n... (truncated)' : ''}</pre>`;
    } else {
      contentEl.innerHTML = '<div class="content-empty">No content extracted</div>';
    }
  } catch (err) {
    console.error('[Preview] Failed to load content:', err);
    contentEl.innerHTML = '<div class="content-empty">Failed to load content</div>';
  }
}

/**
 * Load full entities from extraction_result
 */
async function loadEntities(container: HTMLElement, docId: string): Promise<void> {
  const listEl = container.querySelector('#entities-full-list') as HTMLElement;
  const entitiesTab = container.querySelector('#entities-tab') as HTMLElement;
  const entitiesCount = container.querySelector('#entities-count') as HTMLElement;
  const peopleCountEl = container.querySelector('#people-count') as HTMLElement;
  
  try {
    const response = await http.get<{ extraction?: { 
      entities?: Array<{ id: string; type: string; name: string; confidence?: number }>;
      facts?: Array<{ id: string; content: string; category?: string; confidence?: number }>;
      decisions?: Array<{ id: string; content: string }>;
      action_items?: Array<{ id: string; task: string; owner?: string; status?: string }>;
      questions?: Array<{ id: string; content: string }>;
      risks?: Array<{ id: string; content: string; severity?: string }>;
      participants?: Array<{ name: string; role?: string; organization?: string; contact_id?: string; contact_name?: string }>;
    } }>(`/api/documents/${docId}/extraction`);
    
    const extraction = response.data.extraction;
    if (!extraction) {
      listEl.innerHTML = '<div class="empty-section">No extraction data available</div>';
      return;
    }
    
    const entities = extraction.entities || [];
    const facts = extraction.facts || [];
    const decisions = extraction.decisions || [];
    const actions = extraction.action_items || [];
    const questions = extraction.questions || [];
    const risks = extraction.risks || [];
    const participants = extraction.participants || [];
    
    // Also get Person entities from graph entities
    const personEntities = entities.filter(e => e.type?.toLowerCase() === 'person');
    
    // Merge participants and person entities (deduplicated by name)
    const allPeople = [...participants];
    for (const pe of personEntities) {
      if (!allPeople.some(p => p.name?.toLowerCase() === pe.name?.toLowerCase())) {
        allPeople.push({ name: pe.name, role: undefined, organization: undefined });
      }
    }
    
    // Update people count in the grid
    if (peopleCountEl) {
      peopleCountEl.textContent = String(allPeople.length);
    }
    
    const totalItems = entities.length + facts.length + decisions.length + actions.length + questions.length + risks.length + allPeople.length;
    
    if (totalItems === 0) {
      listEl.innerHTML = '<div class="empty-section">No entities extracted</div>';
      return;
    }
    
    // Show tab
    if (entitiesTab) entitiesTab.classList.remove('hidden');
    if (entitiesCount) entitiesCount.textContent = String(totalItems);
    
    // Build HTML
    let html = `<style>
      .entity-section { margin-bottom: 24px; }
      .entity-section-title { 
        font-size: 14px; 
        font-weight: 600; 
        color: var(--text-secondary); 
        margin-bottom: 12px; 
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .entity-section-count {
        font-size: 11px;
        background: rgba(var(--primary-rgb), 0.1);
        padding: 2px 8px;
        border-radius: 10px;
        color: var(--primary);
      }
      .entity-item {
        padding: 12px 16px;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .entity-item-type {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-tertiary);
        margin-bottom: 4px;
      }
      .entity-item-content {
        color: var(--text-primary);
      }
      .entity-item-meta {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 4px;
      }
    </style>`;
    
    // Graph entities
    if (entities.length > 0) {
      html += `<div class="entity-section">
        <div class="entity-section-title">
          🔗 Graph Entities
          <span class="entity-section-count">${entities.length}</span>
        </div>
        ${entities.map(e => `
          <div class="entity-item">
            <div class="entity-item-type">${escapeHtml(e.type)}</div>
            <div class="entity-item-content">${escapeHtml(e.name)}</div>
            ${e.confidence ? `<div class="entity-item-meta">Confidence: ${Math.round(e.confidence * 100)}%</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }
    
    // Facts
    if (facts.length > 0) {
      html += `<div class="entity-section">
        <div class="entity-section-title">
          📋 Facts
          <span class="entity-section-count">${facts.length}</span>
        </div>
        ${facts.map(f => `
          <div class="entity-item">
            ${f.category ? `<div class="entity-item-type">${escapeHtml(f.category)}</div>` : ''}
            <div class="entity-item-content">${escapeHtml(f.content)}</div>
            ${f.confidence ? `<div class="entity-item-meta">Confidence: ${Math.round(f.confidence * 100)}%</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }
    
    // Decisions
    if (decisions.length > 0) {
      html += `<div class="entity-section">
        <div class="entity-section-title">
          ✓ Decisions
          <span class="entity-section-count">${decisions.length}</span>
        </div>
        ${decisions.map(d => `
          <div class="entity-item">
            <div class="entity-item-content">${escapeHtml(d.content)}</div>
          </div>
        `).join('')}
      </div>`;
    }
    
    // Action Items
    if (actions.length > 0) {
      html += `<div class="entity-section">
        <div class="entity-section-title">
          📌 Action Items
          <span class="entity-section-count">${actions.length}</span>
        </div>
        ${actions.map(a => `
          <div class="entity-item">
            <div class="entity-item-content">☐ ${escapeHtml(a.task)}</div>
            ${a.owner ? `<div class="entity-item-meta">Owner: ${escapeHtml(a.owner)}</div>` : ''}
            ${a.status ? `<div class="entity-item-meta">Status: ${escapeHtml(a.status)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }
    
    // Questions
    if (questions.length > 0) {
      html += `<div class="entity-section">
        <div class="entity-section-title">
          ❓ Questions
          <span class="entity-section-count">${questions.length}</span>
        </div>
        ${questions.map(q => `
          <div class="entity-item">
            <div class="entity-item-content">${escapeHtml(q.content)}</div>
          </div>
        `).join('')}
      </div>`;
    }
    
    // Risks
    if (risks.length > 0) {
      html += `<div class="entity-section">
        <div class="entity-section-title">
          ⚠️ Risks
          <span class="entity-section-count">${risks.length}</span>
        </div>
        ${risks.map(r => `
          <div class="entity-item">
            <div class="entity-item-content">${escapeHtml(r.content)}</div>
            ${r.severity ? `<div class="entity-item-meta">Severity: ${escapeHtml(r.severity)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
    }
    
    // People/Participants
    if (allPeople.length > 0) {
      html += `<div class="entity-section" id="people-section">
        <div class="entity-section-title">
          👥 People
          <span class="entity-section-count">${allPeople.length}</span>
        </div>
        <style>
          .person-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border-radius: 8px;
            margin-bottom: 8px;
            gap: 12px;
          }
          .person-info {
            flex: 1;
            min-width: 0;
          }
          .person-name {
            font-weight: 500;
            color: var(--text-primary);
          }
          .person-role {
            font-size: 12px;
            color: var(--text-tertiary);
            margin-top: 2px;
          }
          .person-linked {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--success);
          }
          .person-linked svg {
            width: 14px;
            height: 14px;
          }
          .person-unlinked {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .person-link-btn {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            background: var(--bg-primary);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .person-link-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
            background: rgba(var(--primary-rgb), 0.05);
          }
          .person-create-btn {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 4px;
            border: none;
            background: var(--primary);
            color: white;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .person-create-btn:hover {
            opacity: 0.9;
          }
        </style>
        ${allPeople.map((p, idx) => `
          <div class="person-item" data-person-index="${idx}" data-person-name="${escapeHtml(p.name || '')}">
            <div class="person-info">
              <div class="person-name">${escapeHtml(p.name || 'Unknown')}</div>
              ${p.role || p.organization ? `
                <div class="person-role">
                  ${p.role ? escapeHtml(p.role) : ''}${p.role && p.organization ? ' at ' : ''}${p.organization ? escapeHtml(p.organization) : ''}
                </div>
              ` : ''}
            </div>
            ${p.contact_id ? `
              <div class="person-linked">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Linked to ${escapeHtml(p.contact_name || 'contact')}
              </div>
            ` : `
              <div class="person-unlinked">
                <button class="person-link-btn" data-action="link" data-name="${escapeHtml(p.name || '')}">
                  Link to Contact
                </button>
                <button class="person-create-btn" data-action="create" data-name="${escapeHtml(p.name || '')}" data-role="${escapeHtml(p.role || '')}" data-org="${escapeHtml(p.organization || '')}">
                  + Create Contact
                </button>
              </div>
            `}
          </div>
        `).join('')}
      </div>`;
    }
    
    listEl.innerHTML = html;
    
    // Setup people link handlers
    setupPeopleLinkHandlers(container, docId);
  } catch (err) {
    listEl.innerHTML = '<div class="empty-section">Failed to load entities</div>';
  }
}

/**
 * Setup event handlers for linking people to contacts
 */
function setupPeopleLinkHandlers(container: HTMLElement, docId: string): void {
  const peopleSection = container.querySelector('#people-section');
  if (!peopleSection) return;
  
  // Get project ID from URL or data attribute
  const projectId = (window as any).currentProjectId || 
    document.body.dataset.projectId || 
    container.closest('[data-project-id]')?.getAttribute('data-project-id') ||
    '';
  
  // Handle Link to Contact buttons
  peopleSection.querySelectorAll('.person-link-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const personName = (btn as HTMLElement).dataset.name || '';
      await showContactLinkDropdown(btn as HTMLElement, personName, projectId, container, docId);
    });
  });
  
  // Handle Create Contact buttons
  peopleSection.querySelectorAll('.person-create-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const personName = (btn as HTMLElement).dataset.name || '';
      const personRole = (btn as HTMLElement).dataset.role || '';
      const personOrg = (btn as HTMLElement).dataset.org || '';
      
      await createContactFromPerson(personName, personRole, personOrg, projectId, btn as HTMLElement, container, docId);
    });
  });
}

/**
 * Show dropdown to select existing contact for linking
 */
async function showContactLinkDropdown(
  btnEl: HTMLElement, 
  personName: string, 
  projectId: string, 
  container: HTMLElement, 
  docId: string
): Promise<void> {
  // Remove any existing dropdown
  document.querySelectorAll('.contact-link-dropdown').forEach(d => d.remove());
  
  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'contact-link-dropdown';
  dropdown.innerHTML = `
    <style>
      .contact-link-dropdown {
        position: absolute;
        z-index: 10000;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 280px;
        max-height: 300px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .contact-link-search {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
      }
      .contact-link-search input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 13px;
      }
      .contact-link-search input:focus {
        outline: none;
        border-color: var(--primary);
      }
      .contact-link-list {
        overflow-y: auto;
        max-height: 220px;
        padding: 8px;
      }
      .contact-link-item {
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .contact-link-item:hover {
        background: var(--bg-secondary);
      }
      .contact-link-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        font-weight: 500;
      }
      .contact-link-info {
        flex: 1;
        min-width: 0;
      }
      .contact-link-name {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 13px;
      }
      .contact-link-email {
        font-size: 11px;
        color: var(--text-tertiary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .contact-link-empty {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary);
        font-size: 13px;
      }
      .contact-link-loading {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary);
      }
    </style>
    <div class="contact-link-search">
      <input type="text" placeholder="Search contacts..." autofocus>
    </div>
    <div class="contact-link-list">
      <div class="contact-link-loading">Loading contacts...</div>
    </div>
  `;
  
  // Position dropdown near button
  const rect = btnEl.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${Math.max(10, rect.left - 100)}px`;
  
  document.body.appendChild(dropdown);
  
  // Focus search input
  const searchInput = dropdown.querySelector('input') as HTMLInputElement;
  searchInput?.focus();
  
  // Load contacts
  try {
    const response = await http.get<{ contacts: Array<{ id: string; name: string; email?: string }> }>(
      `/api/contacts?project_id=${projectId}&limit=100`
    );
    const contacts = response.data.contacts || [];
    
    const listEl = dropdown.querySelector('.contact-link-list') as HTMLElement;
    
    if (contacts.length === 0) {
      listEl.innerHTML = '<div class="contact-link-empty">No contacts found</div>';
    } else {
      renderContactList(listEl, contacts, personName, projectId, container, docId, dropdown);
    }
    
    // Setup search filter
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const filtered = contacts.filter(c => 
        c.name?.toLowerCase().includes(query) || 
        c.email?.toLowerCase().includes(query)
      );
      renderContactList(listEl, filtered, personName, projectId, container, docId, dropdown);
    });
    
  } catch (err) {
    console.error('[People] Failed to load contacts:', err);
    const listEl = dropdown.querySelector('.contact-link-list') as HTMLElement;
    listEl.innerHTML = '<div class="contact-link-empty">Failed to load contacts</div>';
  }
  
  // Close on click outside
  const closeHandler = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node) && e.target !== btnEl) {
      dropdown.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 100);
  
  // Close on Escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dropdown.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Render list of contacts in dropdown
 */
function renderContactList(
  listEl: HTMLElement,
  contacts: Array<{ id: string; name: string; email?: string }>,
  personName: string,
  projectId: string,
  container: HTMLElement,
  docId: string,
  dropdown: HTMLElement
): void {
  if (contacts.length === 0) {
    listEl.innerHTML = '<div class="contact-link-empty">No matching contacts</div>';
    return;
  }
  
  listEl.innerHTML = contacts.map(c => {
    const initials = (c.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return `
      <div class="contact-link-item" data-contact-id="${c.id}" data-contact-name="${escapeHtml(c.name || '')}">
        <div class="contact-link-avatar">${initials}</div>
        <div class="contact-link-info">
          <div class="contact-link-name">${escapeHtml(c.name || 'Unknown')}</div>
          ${c.email ? `<div class="contact-link-email">${escapeHtml(c.email)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  listEl.querySelectorAll('.contact-link-item').forEach(item => {
    item.addEventListener('click', async () => {
      const contactId = (item as HTMLElement).dataset.contactId || '';
      const contactName = (item as HTMLElement).dataset.contactName || '';
      
      try {
        await http.post('/api/contacts/link-participant', {
          projectId,
          participantName: personName,
          contactId
        });
        
        toast.success(`Linked "${personName}" to ${contactName}`);
        dropdown.remove();
        
        // Reload entities to show updated status
        loadEntities(container, docId);
      } catch (err) {
        console.error('[People] Failed to link:', err);
        toast.error('Failed to link contact');
      }
    });
  });
}

/**
 * Create a new contact from a person detected in document
 */
async function createContactFromPerson(
  name: string,
  role: string,
  organization: string,
  projectId: string,
  btnEl: HTMLElement,
  container: HTMLElement,
  docId: string
): Promise<void> {
  const originalText = btnEl.textContent;
  btnEl.textContent = 'Creating...';
  (btnEl as HTMLButtonElement).disabled = true;
  
  try {
    const response = await http.post<{ ok: boolean; contact?: { id: string; name: string }; error?: string }>(
      '/api/contacts',
      {
        project_id: projectId,
        name,
        role: role || undefined,
        organization: organization || undefined,
        source: 'document_extraction'
      }
    );
    
    if (response.data.ok && response.data.contact) {
      toast.success(`Created contact: ${response.data.contact.name}`);
      
      // Reload entities to show updated status
      loadEntities(container, docId);
    } else {
      toast.error(response.data.error || 'Failed to create contact');
      btnEl.textContent = originalText;
      (btnEl as HTMLButtonElement).disabled = false;
    }
  } catch (err) {
    console.error('[People] Failed to create contact:', err);
    toast.error('Failed to create contact');
    btnEl.textContent = originalText;
    (btnEl as HTMLButtonElement).disabled = false;
  }
}

async function loadAnalysisHistory(container: HTMLElement, docId: string): Promise<void> {
  const listEl = container.querySelector('#analysis-list') as HTMLElement;
  
  try {
    const response = await http.get<{ analyses: AIAnalysis[] }>(`/api/documents/${docId}/analysis`);
    const analyses = response.data.analyses || [];
    
    container.querySelector('#analysis-count')!.textContent = String(analyses.length);
    
    if (analyses.length === 0) {
      listEl.innerHTML = `
        <div class="empty-section">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p>No AI analyses yet</p>
          <button class="btn btn-primary btn-sm" id="run-analysis-btn">Run Analysis</button>
        </div>
      `;
      
      // Add click handler for Run Analysis button
      const runAnalysisBtn = listEl.querySelector('#run-analysis-btn');
      if (runAnalysisBtn) {
        runAnalysisBtn.addEventListener('click', async () => {
          const btn = runAnalysisBtn as HTMLButtonElement;
          const originalText = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Analyzing...';
          
          try {
            // Trigger reprocess via API
            const response = await http.post(`/api/documents/${docId}/reprocess`, {});
            if (response.data.success) {
              toast.success('Analysis started');
              // Poll for completion and reload
              setTimeout(() => loadAnalysisHistory(container, docId), 3000);
            } else {
              toast.error(response.data.error || 'Failed to start analysis');
              btn.disabled = false;
              btn.textContent = originalText;
            }
          } catch (err: any) {
            toast.error(err.message || 'Failed to run analysis');
            btn.disabled = false;
            btn.textContent = originalText;
          }
        });
      }
      return;
    }
    
    listEl.innerHTML = analyses.map((a, i) => `
      <div class="analysis-item" data-id="${a.id}">
        <div class="analysis-version">v${analyses.length - i}</div>
        <div class="analysis-info">
          <div class="analysis-title">${capitalizeFirst(a.analysis_type)}</div>
          <div class="analysis-meta">
            <span>${a.provider}/${a.model}</span>
            <span>${a.entities_extracted || 0} entities</span>
            <span>${(a.input_tokens || 0) + (a.output_tokens || 0)} tokens</span>
            ${a.cost ? `<span>$${a.cost.toFixed(4)}</span>` : ''}
          </div>
          <div class="analysis-timestamp">
            ${formatDateTime(a.created_at)} (${formatRelativeTime(a.created_at)})
          </div>
        </div>
        <div class="analysis-actions">
          <button class="btn btn-sm view-analysis-btn">View</button>
          <button class="btn btn-sm compare-analysis-btn">Compare</button>
        </div>
      </div>
    `).join('');
    
    // Add click handlers for View buttons
    listEl.querySelectorAll('.view-analysis-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const analysis = analyses[idx];
        showAnalysisDetail(container, analysis);
      });
    });
    
    // Add click handlers for Compare buttons
    listEl.querySelectorAll('.compare-analysis-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        if (analyses.length < 2) {
          toast.info('Need at least 2 analyses to compare');
          return;
        }
        toast.info('Compare feature coming soon');
      });
    });
  } catch {
    listEl.innerHTML = '<div class="empty-section">No analysis history available</div>';
  }
}

/**
 * Show analysis detail in a modal overlay
 * Fetches extraction_result from the document if not available in analysis
 * Uses /extraction endpoint to get enriched participant data with contact linking
 */
async function showAnalysisDetail(container: HTMLElement, analysis: AIAnalysis): Promise<void> {
  // Try to get the full result with enriched participants
  let fullResult = analysis.result;
  if (analysis.document_id) {
    try {
      // Use /extraction endpoint which enriches participants with contact info
      const extractionResponse = await http.get<{ extraction?: Record<string, unknown> }>(`/api/documents/${analysis.document_id}/extraction`);
      if (extractionResponse.data.extraction) {
        fullResult = extractionResponse.data.extraction;
        console.log('[Analysis] Loaded enriched extraction from /extraction endpoint');
      }
    } catch (err) {
      console.warn('[Analysis] Could not load extraction:', err);
      // Fallback to document API
      if (!fullResult) {
        try {
          const docResponse = await http.get<{ document?: { extraction_result?: Record<string, unknown> }, extraction_result?: Record<string, unknown> }>(`/api/documents/${analysis.document_id}`);
          fullResult = docResponse.data.document?.extraction_result || docResponse.data.extraction_result;
        } catch {
          // ignore
        }
      }
    }
  }
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'analysis-detail-overlay';

  // Format the result JSON nicely
  const resultJson = fullResult 
    ? JSON.stringify(fullResult, null, 2) 
    : 'No detailed result available';
  
  // Build summary from result if available
  let summary = '';
  let peopleDetected: Array<{
    name: string; 
    role?: string; 
    organization?: string;
    contact_id?: string;
    contact_name?: string;
    contact_email?: string;
    contact_avatar?: string;
    contact_role?: string;
  }> = [];
  if (fullResult) {
    const r = fullResult as any;
    if (r.summary) summary = r.summary;
    else if (r.meeting?.title) summary = `Meeting: ${r.meeting.title}`;
    
    // Extract people from participants and entities
    const participants = r.participants || [];
    const entities = r.entities || [];
    const personEntities = entities.filter((e: any) => e.type?.toLowerCase() === 'person');
    
    // Merge and deduplicate
    const peopleNames = new Set<string>();
    for (const p of participants) {
      if (p.name && !peopleNames.has(p.name.toLowerCase())) {
        peopleNames.add(p.name.toLowerCase());
        peopleDetected.push({ 
          name: p.name, 
          role: p.role, 
          organization: p.organization,
          contact_id: p.contact_id,
          contact_name: p.contact_name,
          contact_email: p.contact_email,
          contact_avatar: p.contact_avatar,
          contact_role: p.contact_role
        });
      }
    }
    for (const pe of personEntities) {
      if (pe.name && !peopleNames.has(pe.name.toLowerCase())) {
        peopleNames.add(pe.name.toLowerCase());
        peopleDetected.push({ 
          name: pe.name,
          contact_id: pe.contact_id,
          contact_name: pe.contact_name,
          contact_email: pe.contact_email,
          contact_avatar: pe.contact_avatar,
          contact_role: pe.contact_role
        });
      }
    }
  }
  
  // Separate linked and unlinked people
  const linkedPeople = peopleDetected.filter(p => p.contact_id);
  const unlinkedPeople = peopleDetected.filter(p => !p.contact_id);
  
  // Build people section HTML with separate linked and unlinked sections
  const peopleSectionHtml = peopleDetected.length > 0 ? `
    <div class="analysis-people-section">
      <h4 class="analysis-people-title">
        <span class="analysis-people-title-emoji">👥</span> People Detected
        <span class="analysis-people-badge">${peopleDetected.length}</span>
        ${linkedPeople.length > 0 ? `<span class="analysis-people-badge analysis-people-badge-linked">✓ ${linkedPeople.length} linked</span>` : ''}
      </h4>
      
      ${linkedPeople.length > 0 ? `
        <div class="analysis-people-linked-wrap">
          <div class="analysis-people-section-label">Linked to Contacts</div>
          <div class="analysis-people-chips">
            ${linkedPeople.map(p => `
              <div class="person-chip linked entity-chip entity-chip-linked" data-name="${escapeHtml(p.name)}" data-contact-id="${escapeHtml(p.contact_id || '')}" data-contact-name="${escapeHtml(p.contact_name || '')}">
                ${p.contact_avatar ? `
                  <img class="entity-chip-avatar" src="${escapeHtml(p.contact_avatar)}" alt="">
                ` : `
                  <div class="entity-chip-avatar-placeholder">${(p.contact_name || p.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</div>
                `}
                <div class="entity-chip-body">
                  <div class="entity-chip-linked-row">
                    <span class="entity-chip-name">${escapeHtml(p.name)}</span>
                    <svg class="entity-chip-linked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div class="entity-chip-meta entity-chip-meta-ellipsis">
                    → ${escapeHtml(p.contact_name || 'Contact')}${p.contact_role ? ` • ${escapeHtml(p.contact_role)}` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${unlinkedPeople.length > 0 ? `
        <div>
          <div class="analysis-people-section-label">
            ${linkedPeople.length > 0 ? 'Not Yet Linked' : 'Click to Link or Create Contact'}
          </div>
          <div class="analysis-people-chips">
            ${unlinkedPeople.map(p => `
              <div class="person-chip unlinked entity-chip entity-chip-unlinked" data-name="${escapeHtml(p.name)}" data-role="${escapeHtml(p.role || '')}" data-org="${escapeHtml(p.organization || '')}">
                <div class="entity-chip-avatar-placeholder">${(p.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div class="entity-chip-body">
                  <div class="entity-chip-name">${escapeHtml(p.name)}</div>
                  ${p.role || p.organization ? `<div class="entity-chip-meta">${p.role || ''}${p.role && p.organization ? ' • ' : ''}${p.organization || ''}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <p class="analysis-people-hint">
        💡 Click on any person to ${linkedPeople.length > 0 ? 'view/change the link' : 'link them to a contact or create a new one'}
      </p>
    </div>
  ` : '';
  
  const content = document.createElement('div');
  content.className = 'analysis-detail-content';

  content.innerHTML = `
    <div class="analysis-detail-header">
      <div>
        <h3 class="analysis-detail-title">${capitalizeFirst(analysis.analysis_type)} Analysis</h3>
        <p class="analysis-detail-meta">
          ${analysis.provider}/${analysis.model} • ${analysis.entities_extracted || 0} entities • ${formatRelativeTime(analysis.created_at)}
        </p>
      </div>
      <button type="button" class="close-analysis-btn analysis-detail-close-btn">&times;</button>
    </div>
    ${summary ? `
      <div class="analysis-detail-summary-block">
        <strong class="analysis-detail-summary-label">Summary:</strong>
        <p class="analysis-detail-summary-text">${escapeHtml(summary)}</p>
      </div>
    ` : ''}
    <div class="analysis-detail-body">
      <div class="analysis-detail-stats">
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${analysis.entities_extracted || 0}</div>
          <div class="analysis-detail-stat-label">Entities</div>
        </div>
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${analysis.input_tokens || 0}</div>
          <div class="analysis-detail-stat-label">Input Tokens</div>
        </div>
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${analysis.output_tokens || 0}</div>
          <div class="analysis-detail-stat-label">Output Tokens</div>
        </div>
        <div class="analysis-detail-stat">
          <div class="analysis-detail-stat-value">${analysis.latency_ms ? `${(analysis.latency_ms / 1000).toFixed(1)}s` : '-'}</div>
          <div class="analysis-detail-stat-label">Latency</div>
        </div>
      </div>
      ${peopleSectionHtml}
      <details class="analysis-detail-raw-wrap">
        <summary class="analysis-detail-raw-summary">Raw Result JSON</summary>
        <pre class="analysis-detail-raw-pre">${escapeHtml(resultJson)}</pre>
      </details>
    </div>
  `;
  
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Close handlers
  const closeBtn = content.querySelector('.close-analysis-btn');
  closeBtn?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  // Person chip click handlers
  const projectId = (window as any).currentProjectId || 
    document.body.dataset.projectId || 
    container.closest('[data-project-id]')?.getAttribute('data-project-id') ||
    '';
  
  content.querySelectorAll('.person-chip').forEach(chip => {
    const el = chip as HTMLElement;
    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      const personName = el.dataset.name || '';
      const personRole = el.dataset.role || '';
      const personOrg = el.dataset.org || '';
      const currentContactId = el.dataset.contactId || '';
      const currentContactName = el.dataset.contactName || '';
      
      await showPersonLinkMenu(el, personName, personRole, personOrg, projectId, currentContactId, currentContactName);
    });
    
    /* Hover is handled via .entity-chip-linked:hover and .entity-chip-unlinked:hover in modals.css */
  });
}

/**
 * Show menu to link a person to contact or create new
 */
async function showPersonLinkMenu(
  chipEl: HTMLElement,
  personName: string,
  personRole: string,
  personOrg: string,
  projectId: string,
  currentContactId: string = '',
  currentContactName: string = ''
): Promise<void> {
  // Remove any existing menu
  document.querySelectorAll('.person-link-menu').forEach(m => m.remove());
  
  const isLinked = !!currentContactId;
  
  const menu = document.createElement('div');
  menu.className = 'person-link-menu';
  menu.innerHTML = `
    <style>
      .person-link-menu {
        position: fixed;
        z-index: 10002;
        background: var(--bg-primary, #1a1a2e);
        border: 1px solid var(--border-color, #333);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        min-width: 320px;
        max-height: 450px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .person-link-menu-header {
        padding: 16px;
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-header h4 {
        margin: 0 0 4px 0;
        color: var(--text-primary, #fff);
        font-size: 14px;
      }
      .person-link-menu-header p {
        margin: 0;
        color: var(--text-tertiary, #666);
        font-size: 12px;
      }
      .person-link-menu-current {
        padding: 12px 16px;
        background: rgba(16, 185, 129, 0.1);
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-current-label {
        font-size: 11px;
        color: #10b981;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }
      .person-link-menu-current-contact {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--bg-secondary, #252542);
        border-radius: 8px;
      }
      .person-link-menu-current-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981, #059669);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 13px;
        font-weight: 600;
      }
      .person-link-menu-current-info {
        flex: 1;
      }
      .person-link-menu-current-name {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-primary, #fff);
      }
      .person-link-menu-current-badge {
        font-size: 11px;
        color: #10b981;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .person-link-menu-unlink-btn {
        padding: 6px 12px;
        font-size: 12px;
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .person-link-menu-unlink-btn:hover {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.5);
      }
      .person-link-menu-divider {
        padding: 8px 16px;
        font-size: 11px;
        color: var(--text-tertiary, #666);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-search {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color, #333);
      }
      .person-link-menu-search input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border-color, #333);
        border-radius: 8px;
        background: var(--bg-secondary, #252542);
        color: var(--text-primary, #fff);
        font-size: 13px;
      }
      .person-link-menu-search input:focus {
        outline: none;
        border-color: var(--accent-color, #6366f1);
      }
      .person-link-menu-list {
        overflow-y: auto;
        max-height: 180px;
        padding: 8px;
      }
      .person-link-menu-item {
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text-primary, #fff);
      }
      .person-link-menu-item:hover {
        background: var(--bg-secondary, #252542);
      }
      .person-link-menu-item.selected {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .person-link-menu-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-color, #6366f1), #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
      }
      .person-link-menu-info {
        flex: 1;
        min-width: 0;
      }
      .person-link-menu-name {
        font-weight: 500;
        font-size: 13px;
      }
      .person-link-menu-email {
        font-size: 11px;
        color: var(--text-tertiary, #666);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .person-link-menu-actions {
        padding: 12px 16px;
        border-top: 1px solid var(--border-color, #333);
        display: flex;
        gap: 8px;
      }
      .person-link-menu-btn {
        flex: 1;
        padding: 10px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .person-link-menu-btn.primary {
        background: var(--accent-color, #6366f1);
        color: white;
        border: none;
      }
      .person-link-menu-btn.primary:hover {
        opacity: 0.9;
      }
      .person-link-menu-btn.secondary {
        background: transparent;
        color: var(--text-secondary, #888);
        border: 1px solid var(--border-color, #333);
      }
      .person-link-menu-btn.secondary:hover {
        border-color: var(--text-secondary, #888);
      }
      .person-link-menu-empty {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary, #666);
        font-size: 13px;
      }
      .person-link-menu-loading {
        padding: 20px;
        text-align: center;
        color: var(--text-tertiary, #666);
      }
    </style>
    <div class="person-link-menu-header">
      <h4>${isLinked ? 'Change Link' : 'Link'} "${escapeHtml(personName)}"</h4>
      <p>${isLinked ? 'Change the linked contact or unlink' : 'Select an existing contact or create a new one'}</p>
    </div>
    ${isLinked ? `
      <div class="person-link-menu-current">
        <div class="person-link-menu-current-label">Currently Linked To</div>
        <div class="person-link-menu-current-contact">
          <div class="person-link-menu-current-avatar">${(currentContactName || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div class="person-link-menu-current-info">
            <div class="person-link-menu-current-name">${escapeHtml(currentContactName)}</div>
            <div class="person-link-menu-current-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Linked
            </div>
          </div>
          <button class="person-link-menu-unlink-btn unlink-btn">Unlink</button>
        </div>
      </div>
      <div class="person-link-menu-divider">Or change to another contact</div>
    ` : ''}
    <div class="person-link-menu-search">
      <input type="text" placeholder="Search contacts..." autofocus>
    </div>
    <div class="person-link-menu-list">
      <div class="person-link-menu-loading">Loading contacts...</div>
    </div>
    <div class="person-link-menu-actions">
      <button class="person-link-menu-btn secondary cancel-btn">Cancel</button>
      <button class="person-link-menu-btn primary create-btn">+ Create New Contact</button>
    </div>
  `;
  
  // Position menu near chip
  const rect = chipEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 420)}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
  
  document.body.appendChild(menu);
  
  // Focus search input
  const searchInput = menu.querySelector('input') as HTMLInputElement;
  searchInput?.focus();
  
  // Load contacts
  try {
    const response = await http.get<{ contacts: Array<{ id: string; name: string; email?: string }> }>(
      `/api/contacts?project_id=${projectId}&limit=100`
    );
    const contacts = response.data.contacts || [];
    
    const listEl = menu.querySelector('.person-link-menu-list') as HTMLElement;
    
    const renderContacts = (filtered: typeof contacts) => {
      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="person-link-menu-empty">No matching contacts</div>';
        return;
      }
      
      listEl.innerHTML = filtered.map(c => {
        const initials = (c.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const avatar = (c as any).avatar_url || (c as any).photo_url || '';
        const role = (c as any).role || '';
        return `
          <div class="person-link-menu-item" 
               data-contact-id="${c.id}" 
               data-contact-name="${escapeHtml(c.name || '')}"
               data-contact-email="${escapeHtml(c.email || '')}"
               data-contact-avatar="${escapeHtml(avatar)}"
               data-contact-role="${escapeHtml(role)}">
            ${avatar ? `
              <img src="${escapeHtml(avatar)}" alt="" class="person-link-menu-avatar person-link-menu-avatar-img">
            ` : `
              <div class="person-link-menu-avatar">${initials}</div>
            `}
            <div class="person-link-menu-info">
              <div class="person-link-menu-name">${escapeHtml(c.name || 'Unknown')}</div>
              ${role ? `<div class="person-link-menu-email">${escapeHtml(role)}</div>` : ''}
              ${c.email ? `<div class="person-link-menu-email">${escapeHtml(c.email)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      // Add click handlers
      listEl.querySelectorAll('.person-link-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
          const contactId = (item as HTMLElement).dataset.contactId || '';
          const contactName = (item as HTMLElement).dataset.contactName || '';
          const contactEmail = (item as HTMLElement).dataset.contactEmail || '';
          const contactAvatar = (item as HTMLElement).dataset.contactAvatar || '';
          const contactRole = (item as HTMLElement).dataset.contactRole || '';
          
          try {
            await http.post('/api/contacts/link-participant', {
              projectId,
              participantName: personName,
              contactId
            });
            
            toast.success(`Linked "${personName}" to ${contactName}`);
            menu.remove();
            
            // Transform chip to show linked status with contact info
            updateChipToLinked(chipEl, personName, contactId, contactName, contactEmail, contactAvatar, contactRole);
          } catch (err) {
            console.error('[People] Failed to link:', err);
            toast.error('Failed to link contact');
          }
        });
      });
    };
    
    renderContacts(contacts);
    
    // Search filter
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const filtered = contacts.filter(c => 
        c.name?.toLowerCase().includes(query) || 
        c.email?.toLowerCase().includes(query)
      );
      renderContacts(filtered);
    });
    
  } catch (err) {
    console.error('[People] Failed to load contacts:', err);
    const listEl = menu.querySelector('.person-link-menu-list') as HTMLElement;
    listEl.innerHTML = '<div class="person-link-menu-empty">Failed to load contacts</div>';
  }
  
  // Cancel button
  menu.querySelector('.cancel-btn')?.addEventListener('click', () => menu.remove());
  
  // Unlink button (only if currently linked)
  menu.querySelector('.unlink-btn')?.addEventListener('click', async () => {
    try {
      await http.post('/api/contacts/unlink-participant', {
        projectId,
        participantName: personName
      });
      
      toast.success(`Unlinked "${personName}"`);
      menu.remove();
      
      // Transform chip back to unlinked state
      updateChipToUnlinked(chipEl, personName, personRole, personOrg);
    } catch (err) {
      console.error('[People] Failed to unlink:', err);
      toast.error('Failed to unlink contact');
    }
  });
  
  // Create new contact button
  menu.querySelector('.create-btn')?.addEventListener('click', async () => {
    try {
      const response = await http.post<{ ok: boolean; contact?: { id: string; name: string; role?: string; avatar_url?: string }; error?: string }>(
        '/api/contacts',
        {
          project_id: projectId,
          name: personName,
          role: personRole || undefined,
          organization: personOrg || undefined,
          source: 'document_extraction'
        }
      );
      
      if (response.data.ok && response.data.contact) {
        toast.success(`Created contact: ${response.data.contact.name}`);
        menu.remove();
        
        // Transform chip to show linked status
        updateChipToLinked(
          chipEl, 
          personName, 
          response.data.contact.id, 
          response.data.contact.name,
          '',
          response.data.contact.avatar_url || '',
          response.data.contact.role || personRole
        );
      } else {
        toast.error(response.data.error || 'Failed to create contact');
      }
    } catch (err) {
      console.error('[People] Failed to create contact:', err);
      toast.error('Failed to create contact');
    }
  });
  
  // Close on click outside
  const closeHandler = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && e.target !== chipEl) {
      menu.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 100);
  
  // Close on Escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Update a person chip to show unlinked status
 */
function updateChipToUnlinked(
  chipEl: HTMLElement,
  personName: string,
  personRole: string,
  personOrg: string
): void {
  const initials = (personName || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  
  chipEl.classList.remove('linked');
  chipEl.classList.add('unlinked', 'entity-chip', 'entity-chip-unlinked');
  delete chipEl.dataset.contactId;
  delete chipEl.dataset.contactName;

  chipEl.innerHTML = `
    <div class="entity-chip-avatar-placeholder">${initials}</div>
    <div class="entity-chip-body">
      <div class="entity-chip-name">${escapeHtml(personName)}</div>
      ${personRole || personOrg ? `<div class="entity-chip-meta">${personRole || ''}${personRole && personOrg ? ' • ' : ''}${personOrg || ''}</div>` : ''}
    </div>
  `;
}

/**
 * Update a person chip to show linked status with contact info
 */
function updateChipToLinked(
  chipEl: HTMLElement,
  personName: string,
  contactId: string,
  contactName: string,
  contactEmail: string,
  contactAvatar: string,
  contactRole: string
): void {
  const initials = (contactName || personName || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  
  chipEl.classList.remove('entity-chip-unlinked');
  chipEl.classList.add('linked', 'entity-chip', 'entity-chip-linked');
  chipEl.dataset.contactId = contactId;
  chipEl.dataset.contactName = contactName;

  chipEl.innerHTML = `
    ${contactAvatar ? `
      <img class="entity-chip-avatar" src="${escapeHtml(contactAvatar)}" alt="">
    ` : `
      <div class="entity-chip-avatar-placeholder">${initials}</div>
    `}
    <div class="entity-chip-body">
      <div class="entity-chip-linked-row">
        <span class="entity-chip-name">${escapeHtml(personName)}</span>
        <svg class="entity-chip-linked-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="entity-chip-meta entity-chip-meta-ellipsis">
        → ${escapeHtml(contactName)}${contactRole ? ` • ${escapeHtml(contactRole)}` : ''}
      </div>
    </div>
  `;
}

async function loadVersions(container: HTMLElement, docId: string): Promise<void> {
  const listEl = container.querySelector('#versions-list') as HTMLElement;
  
  try {
    const response = await http.get<{ versions: DocumentVersion[] }>(`/api/documents/${docId}/versions`);
    const versions = response.data.versions || [];
    
    container.querySelector('#versions-count')!.textContent = String(versions.length || 1);
    
    if (versions.length === 0) {
      listEl.innerHTML = `
        <div class="version-item current">
          <div class="version-badge">v1</div>
          <div class="version-info">
            <div class="version-title">Current Version <span class="current-tag">Current</span></div>
            <div class="version-notes">Initial upload</div>
          </div>
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = versions.map(v => `
      <div class="version-item ${v.is_current ? 'current' : ''}" data-id="${v.id}">
        <div class="version-badge">v${v.version_number}</div>
        <div class="version-info">
          <div class="version-title">
            ${escapeHtml(v.filename)}
            ${v.is_current ? '<span class="current-tag">Current</span>' : ''}
          </div>
          ${v.change_notes ? `<div class="version-notes">"${escapeHtml(v.change_notes)}"</div>` : ''}
          <div class="version-meta">
            ${formatFileSize(v.file_size)} • ${formatRelativeTime(v.created_at)}
          </div>
          ${v.ai_change_summary ? `
            <div class="version-ai-summary">
              <strong>AI:</strong> ${escapeHtml(v.ai_change_summary)}
            </div>
          ` : ''}
        </div>
        <div class="version-actions version-actions-row">
          <button class="btn btn-sm view-version-btn">View</button>
          ${!v.is_current ? '<button class="btn btn-sm restore-version-btn">Restore</button>' : ''}
          ${v.version_number > 1 ? '<button class="btn btn-sm diff-version-btn">Diff</button>' : ''}
        </div>
      </div>
    `).join('');
  } catch {
    listEl.innerHTML = '<div class="empty-section">Version history not available</div>';
  }
}

async function loadActivity(container: HTMLElement, docId: string): Promise<void> {
  const timelineEl = container.querySelector('#activity-timeline') as HTMLElement;
  
  try {
    const response = await http.get<{ activities: DocumentActivity[] }>(`/api/documents/${docId}/activity`);
    const activities = response.data.activities || [];
    
    if (activities.length === 0) {
      timelineEl.innerHTML = '<div class="empty-section">No activity recorded</div>';
      return;
    }
    
    timelineEl.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-avatar">
            ${a.user_avatar ? `<img src="${a.user_avatar}" alt="">` : getInitials(a.user_name || 'System')}
          </div>
          <div class="activity-text">
            <strong>${escapeHtml(a.user_name || 'System')}</strong> ${getActionText(a.action)}
          </div>
          <div class="activity-time">${formatRelativeTime(a.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch {
    timelineEl.innerHTML = '<div class="empty-section">Activity not available</div>';
  }
}

/**
 * Load meeting notes (v1.6 notes_rendered_text from extraction)
 */
async function loadMeetingNotes(container: HTMLElement, docId: string): Promise<void> {
  const notesContainer = container.querySelector('#notes-container') as HTMLElement;
  const notesTab = container.querySelector('#notes-tab') as HTMLElement;
  
  try {
    // Fetch extraction data to get notes_rendered_text
    const response = await http.get<{ extraction?: { notes_rendered_text?: string; notes?: { key_points?: unknown[]; outline?: unknown[] } } }>(`/api/documents/${docId}/extraction`);
    const extraction = response.data.extraction;
    
    // Check if notes exist
    const hasNotes = extraction?.notes_rendered_text || (extraction?.notes?.key_points?.length || 0) > 0;
    
    if (!hasNotes) {
      // Hide notes tab if no notes
      if (notesTab) notesTab.classList.add('hidden');
      return;
    }
    
    // Show notes tab
    if (notesTab) notesTab.classList.remove('hidden');
    
    // Render notes
    const notesText = extraction?.notes_rendered_text || '';
    const notes = extraction?.notes;
    
    if (notesText) {
      // Render with rich formatting
      notesContainer.innerHTML = `
        <style>
          .notes-rendered {
            padding: 20px;
            background: var(--bg-secondary);
            border-radius: 12px;
            line-height: 1.7;
          }
          .notes-header {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .notes-meta {
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
          }
          .notes-topic {
            margin-bottom: 20px;
          }
          .notes-topic-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 10px;
            padding-left: 8px;
            border-left: 3px solid var(--primary);
          }
          .notes-bullet {
            padding: 10px 12px;
            background: var(--bg-primary);
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 14px;
            color: var(--text-primary);
            line-height: 1.6;
          }
          .notes-bullet:last-child {
            margin-bottom: 0;
          }
          .notes-actions {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
          }
        </style>
        <div class="notes-rendered">
          ${renderNotesAsHtml(notesText)}
          <div class="notes-actions">
            <button class="btn btn-secondary btn-sm" id="copy-notes-btn">
              📋 Copy Notes
            </button>
          </div>
        </div>
      `;
      
      // Add copy handler
      container.querySelector('#copy-notes-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(notesText);
        toast.success('Notes copied to clipboard');
      });
    } else if (notes) {
      // Fallback: render from structured notes
      const keyPoints = (notes.key_points as Array<{ text: string }>)?.map(kp => `• ${kp.text}`).join('\n') || '';
      const outline = (notes.outline as Array<{ topic: string; bullets: Array<{ text: string }> }>)?.map(
        o => `**${o.topic}**\n${o.bullets?.map(b => `  • ${b.text}`).join('\n') || ''}`
      ).join('\n\n') || '';
      
      notesContainer.innerHTML = `
        <div class="notes-structured">
          ${keyPoints ? `<div class="notes-section"><h4>Key Points</h4><pre class="conv-notes-pre">${escapeHtml(keyPoints)}</pre></div>` : ''}
          ${outline ? `<div class="notes-section"><h4>Outline</h4><pre class="conv-notes-pre">${escapeHtml(outline)}</pre></div>` : ''}
        </div>
      `;
    }
  } catch {
    notesContainer.innerHTML = '<div class="empty-section">Meeting notes not available</div>';
    if (notesTab) notesTab.classList.add('hidden');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render notes_rendered_text as styled HTML
 * Parses the text format:
 * - 📝 GodMode Notes (header)
 * - 🕞 Started at... (meta)
 * - Topic Name (topic titles - lines without leading -)
 * - - Bullet text (bullets - lines starting with -)
 */
function renderNotesAsHtml(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let currentTopic = '';
  let bulletsHtml = '';
  let headerDone = false;
  let metaDone = false;
  
  const flushTopic = () => {
    if (currentTopic && bulletsHtml) {
      html += `
        <div class="notes-topic">
          <div class="notes-topic-title">${escapeHtml(currentTopic)}</div>
          ${bulletsHtml}
        </div>
      `;
    }
    currentTopic = '';
    bulletsHtml = '';
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Header line (📝 GodMode Notes)
    if (!headerDone && trimmed.startsWith('📝')) {
      html += `<div class="notes-header">${escapeHtml(trimmed)}</div>`;
      headerDone = true;
      continue;
    }
    
    // Meta line (🕞 Started at...)
    if (!metaDone && trimmed.startsWith('🕞')) {
      html += `<div class="notes-meta">${escapeHtml(trimmed)}</div>`;
      metaDone = true;
      continue;
    }
    
    // Bullet line (starts with -)
    if (trimmed.startsWith('-')) {
      const bulletText = trimmed.substring(1).trim();
      bulletsHtml += `<div class="notes-bullet">${escapeHtml(bulletText)}</div>`;
      continue;
    }
    
    // Topic title (any other non-empty line)
    flushTopic();
    currentTopic = trimmed;
  }
  
  // Flush last topic
  flushTopic();
  
  // If no structured content found, fallback to pre
  if (!html.includes('notes-topic')) {
    return `<pre class="conv-notes-pre">${escapeHtml(text)}</pre>`;
  }
  
  return html;
}

async function checkFavoriteStatus(docId: string): Promise<boolean> {
  try {
    const response = await http.get<{ is_favorite: boolean }>(`/api/documents/${docId}/favorite`);
    return response.data.is_favorite || false;
  } catch {
    return false;
  }
}

function updateFavoriteButton(container: HTMLElement): void {
  const btn = container.querySelector('#favorite-btn') as HTMLButtonElement;
  if (btn) {
    btn.classList.toggle('active', isFavorite);
    btn.innerHTML = isFavorite ? '★' : '☆';
  }
}

async function toggleFavorite(container: HTMLElement, doc: Document): Promise<void> {
  try {
    await http.post(`/api/documents/${doc.id}/favorite`);
    isFavorite = !isFavorite;
    updateFavoriteButton(container);
    toast.success(isFavorite ? 'Added to favorites' : 'Removed from favorites');
  } catch {
    toast.error('Failed to update favorite');
  }
}

function downloadDocument(doc: Document): void {
  window.open(`/api/documents/${doc.id}/download`, '_blank');
}

/**
 * Refresh modal content after reprocessing
 * Updates counters, summary, content preview and reloads AI Analysis tab
 */
async function refreshModalContent(container: HTMLElement, docId: string): Promise<void> {
  try {
    // 1. Fetch updated document data
    const response = await http.get<Document>(`/api/documents/${docId}`);
    const updatedDoc = response.data;
    
    // 2. Update entity counters
    const entityTypes = ['facts', 'decisions', 'risks', 'actions', 'questions'];
    for (const type of entityTypes) {
      const card = container.querySelector(`[data-entity="${type}"]`);
      if (card) {
        const countEl = card.querySelector('.entity-count');
        if (countEl) {
          const count = (updatedDoc as any)[`${type}_count`] || 0;
          countEl.textContent = String(count);
          
          // Add highlight animation
          card.classList.add('updated');
          setTimeout(() => card.classList.remove('updated'), 1500);
        }
      }
    }
    
    // 3. Update summary
    const summaryCard = container.querySelector('#summary-card') as HTMLElement;
    const summaryEl = container.querySelector('#doc-summary');
    if (summaryCard && summaryEl) {
      if (updatedDoc.summary) {
        summaryCard.classList.remove('hidden');
        summaryEl.textContent = updatedDoc.summary;
      } else {
        summaryCard.classList.add('hidden');
      }
    }
    
    // 4. Update content preview
    const contentPreview = container.querySelector('#content-preview');
    if (contentPreview && updatedDoc.content) {
      const truncated = updatedDoc.content.length > 5000;
      contentPreview.innerHTML = escapeHtml(updatedDoc.content.substring(0, 5000)) + 
        (truncated ? '\n\n... (truncated)' : '');
    }
    
    // 5. Update status badge in header
    const statusBadge = container.querySelector('.status-chip');
    if (statusBadge) {
      statusBadge.className = `status-chip ${updatedDoc.status}`;
      statusBadge.textContent = capitalizeFirst(updatedDoc.status);
    }
    
    // 6. Reload AI Analysis tab
    loadAnalysisHistory(container, docId);
    
    // 7. Reload Activity tab
    loadActivity(container, docId);
    
    console.log('[Modal] Refreshed content for document:', docId);
  } catch (err) {
    console.error('[Modal] Failed to refresh content:', err);
  }
}

async function reprocessDocument(doc: Document, onUpdate?: () => void): Promise<void> {
  const reprocessBtn = document.querySelector('#reprocess-btn') as HTMLButtonElement;
  const modalContainer = document.querySelector('.document-preview-modal') as HTMLElement;
  const originalBtnContent = reprocessBtn?.innerHTML || '';
  
  try {
    // Step 1: Check hash and existing entities
    if (reprocessBtn) {
      reprocessBtn.disabled = true;
      reprocessBtn.innerHTML = `<span class="spinner"></span> Checking...`;
    }
    
    const checkResponse = await http.get<{
      hash_match: boolean;
      existing_entities: Record<string, number>;
      total_entities: number;
      current_hash: string;
      has_content: boolean;
    }>(`/api/documents/${doc.id}/reprocess/check`);
    
    const check = checkResponse.data;
    
    if (!check.has_content) {
      toast.error('No content available for reprocessing');
      return;
    }
    
    // Step 2: Confirm if hash matches or has existing entities
    let shouldProceed = true;
    
    if (check.hash_match || check.total_entities > 0) {
      const hashMsg = check.hash_match ? 'Content has not changed since last processing.\n' : '';
      const entitiesMsg = check.total_entities > 0 
        ? `There are ${check.total_entities} extracted entities that will be replaced.\n` 
        : '';
      
      shouldProceed = confirm(
        `${hashMsg}${entitiesMsg}\nAre you sure you want to reprocess?\n\nThis will:\n- Remove all existing entities from this document\n- Create new entities with AI analysis\n- Use AI tokens`
      );
    }
    
    if (!shouldProceed) {
      toast.info('Reprocessing cancelled');
      return;
    }
    
    // Step 3: Start reprocessing with progress feedback
    if (reprocessBtn) {
      reprocessBtn.innerHTML = `<span class="spinner"></span> Processing...`;
    }
    toast.info('Reprocessing started...');
    
    await http.post(`/api/documents/${doc.id}/reprocess`, { force: true });
    
    // Step 4: Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    
    const pollStatus = async () => {
      attempts++;
      
      try {
        const statusResponse = await http.get<{ status: string }>(`/api/documents/${doc.id}`);
        const status = statusResponse.data.status;
        
        if (status === 'processed') {
          toast.success('Document reprocessed successfully!');
          // Refresh modal content with updated data
          if (modalContainer) {
            await refreshModalContent(modalContainer, doc.id);
          }
          onUpdate?.();
          return true;
        } else if (status === 'failed') {
          toast.error('Reprocessing failed');
          return true;
        } else if (attempts >= maxAttempts) {
          toast.warning('Reprocessing still in progress. Check back later.');
          return true;
        }
        
        // Update button with progress
        if (reprocessBtn) {
          reprocessBtn.innerHTML = `<span class="spinner"></span> Processing... (${attempts}s)`;
        }
        
        return false;
      } catch {
        return attempts >= maxAttempts;
      }
    };
    
    // Poll every 2 seconds (track interval for cleanup)
    activeReprocessInterval = setInterval(async () => {
      const done = await pollStatus();
      if (done) {
        if (activeReprocessInterval) {
          clearInterval(activeReprocessInterval);
          activeReprocessInterval = null;
        }
        if (reprocessBtn) {
          reprocessBtn.disabled = false;
          reprocessBtn.innerHTML = originalBtnContent;
        }
      }
    }, 2000);
    
  } catch (err) {
    console.error('[Reprocess] Error:', err);
    toast.error('Failed to reprocess document');
  } finally {
    if (reprocessBtn) {
      reprocessBtn.disabled = false;
      reprocessBtn.innerHTML = originalBtnContent;
    }
  }
}

async function uploadNewVersion(doc: Document, container: HTMLElement, onUpdate?: () => void): Promise<void> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.txt,.md';
  
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    
    const notes = prompt('Change notes (optional):');
    
    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('change_notes', notes);
    
    try {
      toast.info('Uploading new version...');
      await fetchWithProject(`/api/documents/${doc.id}/versions`, {
        method: 'POST',
        body: formData,
      });
      toast.success('New version uploaded');
      loadVersions(container, doc.id);
      onUpdate?.();
    } catch {
      toast.error('Failed to upload new version');
    }
  };
  
  input.click();
}

async function generateShareLink(container: HTMLElement, doc: Document): Promise<void> {
  const expires = (container.querySelector('#share-expires') as HTMLSelectElement).value;
  const maxViews = (container.querySelector('#share-max-views') as HTMLInputElement).value;
  const password = (container.querySelector('#share-password') as HTMLInputElement).value;
  const permissions = (container.querySelector('#share-permissions') as HTMLSelectElement).value;
  
  try {
    const response = await http.post<{ url: string; token: string }>(`/api/documents/${doc.id}/share`, {
      expires,
      max_views: maxViews ? parseInt(maxViews) : null,
      password: password || null,
      permissions: [permissions === 'download' ? 'view' : permissions, ...(permissions === 'download' ? ['download'] : [])]
    });
    
    const input = container.querySelector('#share-link-input') as HTMLInputElement;
    input.value = response.data.url;
    
    (container.querySelector('#generate-link-btn') as HTMLElement)?.classList.add('hidden');
    (container.querySelector('#copy-link-btn') as HTMLElement)?.classList.remove('hidden');
    
    toast.success('Share link generated');
  } catch {
    toast.error('Failed to generate share link');
  }
}

function copyShareLink(container: HTMLElement): void {
  const input = container.querySelector('#share-link-input') as HTMLInputElement;
  navigator.clipboard.writeText(input.value);
  toast.success('Link copied to clipboard');
}

function getDocIcon(filename: string): string {
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

function getActionText(action: string): string {
  const actions: Record<string, string> = {
    created: 'uploaded this document',
    viewed: 'viewed this document',
    downloaded: 'downloaded this document',
    updated: 'updated this document',
    version_uploaded: 'uploaded a new version',
    analyzed: 'ran AI analysis',
    reprocessed: 'reprocessed this document',
    shared: 'shared this document',
    unshared: 'removed share link',
    deleted: 'deleted this document',
    restored: 'restored this document',
    tagged: 'added tags',
    favorited: 'added to favorites',
    unfavorited: 'removed from favorites',
    commented: 'commented on this document'
  };
  return actions[action] || action;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
