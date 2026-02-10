/**
 * File Upload Modal Component
 * Handle file uploads with progress
 */

import { createElement, on, addClass, removeClass } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { toast } from '../../services/toast';
import { formatFileSize } from '../../utils/format';
import { getSprints } from '../../services/sprints';
import { getActions } from '../../services/actions';
import type { Sprint } from '../../services/sprints';
import type { Action } from '../../services/actions';

const MODAL_ID = 'file-upload-modal';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface FileUploadModalProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // bytes
  onUpload?: (files: File[]) => Promise<void>;
  onComplete?: (results: UploadFile[]) => void;
}

let uploadQueue: UploadFile[] = [];
let isUploading = false;
let sprintsList: Sprint[] = [];
let actionsList: Action[] = [];
let selectedSprintId = '';
let selectedActionId = '';

/**
 * Show file upload modal
 */
export function showFileUploadModal(props: FileUploadModalProps = {}): void {
  const {
    accept = '*/*',
    multiple = true,
    maxSize = 50 * 1024 * 1024, // 50MB default
    onUpload,
    onComplete,
  } = props;

  uploadQueue = [];
  isUploading = false;
  selectedSprintId = '';
  selectedActionId = '';

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'file-upload-modal-content' });

  function render(): void {
    const sprintOptions = sprintsList.map(s => `<option value="${s.id}" ${s.id === selectedSprintId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    const actionOptions = actionsList.map(a => `<option value="${a.id}" ${a.id === selectedActionId ? 'selected' : ''}>${escapeHtml((a.content || a.task || String(a.id)).slice(0, 60))}${(a.content || a.task || '').length > 60 ? '…' : ''}</option>`).join('');

    content.innerHTML = `
      <div class="drop-zone" id="drop-zone">
        <div class="drop-zone-icon">📁</div>
        <div class="drop-zone-text">
          <strong>Drop files here</strong> or click to browse
        </div>
        <div class="drop-zone-hint">
          ${multiple ? 'You can upload multiple files' : 'Single file only'}
          ${maxSize ? ` • Max ${formatFileSize(maxSize)}` : ''}
        </div>
        <input type="file" id="file-input" ${accept !== '*/*' ? `accept="${accept}"` : ''} ${multiple ? 'multiple' : ''} hidden>
      </div>

      <div class="upload-association" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color, #e2e8f0);">
        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Associate with (optional)</label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 140px;">
            <select id="upload-sprint-select" class="form-select" style="width: 100%;">
              <option value="">No sprint</option>
              ${sprintOptions}
            </select>
            <span class="form-hint" style="font-size: 0.75rem; color: var(--text-tertiary);">Sprint</span>
          </div>
          <div style="flex: 1; min-width: 180px;">
            <select id="upload-action-select" class="form-select" style="width: 100%;">
              <option value="">No task</option>
              ${actionOptions}
            </select>
            <span class="form-hint" style="font-size: 0.75rem; color: var(--text-tertiary);">Task</span>
          </div>
        </div>
      </div>
      
      ${uploadQueue.length > 0 ? `
        <div class="upload-list">
          <h4>Files (${uploadQueue.length})</h4>
          ${uploadQueue.map(f => renderFileItem(f)).join('')}
        </div>
      ` : ''}
    `;

    bindDropZone();
    bindFileItems();
    bindSprintTaskSelectors();
  }

  function bindDropZone(): void {
    const dropZone = content.querySelector('#drop-zone') as HTMLElement;
    const fileInput = content.querySelector('#file-input') as HTMLInputElement;

    if (!dropZone || !fileInput) return;

    // Click to browse
    on(dropZone, 'click', () => fileInput.click());

    // File input change
    on(fileInput, 'change', () => {
      if (fileInput.files) {
        addFiles(Array.from(fileInput.files), maxSize);
        render();
      }
    });

    // Drag and drop
    on(dropZone, 'dragover', (e) => {
      e.preventDefault();
      addClass(dropZone, 'drag-over');
    });

    on(dropZone, 'dragleave', () => {
      removeClass(dropZone, 'drag-over');
    });

    on(dropZone, 'drop', (e) => {
      e.preventDefault();
      removeClass(dropZone, 'drag-over');
      
      const dt = (e as DragEvent).dataTransfer;
      if (dt?.files) {
        addFiles(Array.from(dt.files), maxSize);
        render();
      }
    });
  }

  function bindFileItems(): void {
    content.querySelectorAll('[data-action="remove"]').forEach(btn => {
      on(btn as HTMLElement, 'click', () => {
        const fileId = btn.getAttribute('data-file-id');
        if (fileId) {
          uploadQueue = uploadQueue.filter(f => f.id !== fileId);
          render();
        }
      });
    });
  }

  async function loadSprints(): Promise<void> {
    try {
      sprintsList = await getSprints();
    } catch {
      sprintsList = [];
    }
  }

  async function loadActionsForSprint(sprintId: string): Promise<void> {
    try {
      actionsList = await getActions(undefined, sprintId || undefined);
    } catch {
      actionsList = [];
    }
  }

  function bindSprintTaskSelectors(): void {
    const sprintSelect = content.querySelector('#upload-sprint-select') as HTMLSelectElement;
    const actionSelect = content.querySelector('#upload-action-select') as HTMLSelectElement;
    if (sprintSelect) {
      on(sprintSelect, 'change', async () => {
        selectedSprintId = sprintSelect.value || '';
        selectedActionId = '';
        await loadActionsForSprint(selectedSprintId);
        render();
      });
    }
    if (actionSelect) {
      on(actionSelect, 'change', () => {
        selectedActionId = actionSelect.value || '';
      });
    }
  }

  render();
  loadSprints().then(() => render());

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const cancelBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Cancel',
  });

  const uploadBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Upload',
  });

  on(cancelBtn, 'click', () => {
    if (isUploading) {
      toast.warning('Upload in progress');
      return;
    }
    closeModal(MODAL_ID);
  });

  on(uploadBtn, 'click', async () => {
    if (uploadQueue.length === 0) {
      toast.warning('No files selected');
      return;
    }

    if (isUploading) return;

    isUploading = true;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    try {
      if (onUpload) {
        const files = uploadQueue.map(f => f.file);
        await onUpload(files);
        
        // Mark all as completed
        uploadQueue.forEach(f => {
          f.status = 'completed';
          f.progress = 100;
        });
      } else {
        // Default upload behavior
        await uploadFiles(uploadQueue, render);
      }

      toast.success('Upload complete');
      onComplete?.(uploadQueue);
      closeModal(MODAL_ID);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      isUploading = false;
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload';
      render();
    }
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(uploadBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Upload Files',
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Add files to queue
 */
function addFiles(files: File[], maxSize: number): void {
  files.forEach(file => {
    if (file.size > maxSize) {
      toast.error(`${file.name} exceeds max size`);
      return;
    }

    // Check for duplicates
    if (uploadQueue.some(f => f.file.name === file.name && f.file.size === file.size)) {
      return;
    }

    uploadQueue.push({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending',
    });
  });
}

/**
 * Render file item
 */
function renderFileItem(item: UploadFile): string {
  const icon = getFileIcon(item.file.type);
  const statusClass = item.status;

  return `
    <div class="upload-item ${statusClass}" data-file-id="${item.id}">
      <span class="file-icon">${icon}</span>
      <div class="file-info">
        <div class="file-name">${escapeHtml(item.file.name)}</div>
        <div class="file-size">${formatFileSize(item.file.size)}</div>
        ${item.status === 'uploading' ? `
          <div class="progress-bar">
            <div class="progress-fill" style="--progress: ${item.progress}"></div>
          </div>
        ` : ''}
        ${item.error ? `<div class="file-error">${escapeHtml(item.error)}</div>` : ''}
      </div>
      <div class="file-status">
        ${item.status === 'completed' ? '✓' : ''}
        ${item.status === 'error' ? '✕' : ''}
        ${item.status === 'pending' ? `
          <button class="btn-sm btn-danger" data-action="remove" data-file-id="${item.id}">×</button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Default upload handler
 */
async function uploadFiles(
  files: UploadFile[],
  rerender: () => void
): Promise<void> {
  for (const file of files) {
    file.status = 'uploading';
    rerender();

    try {
      const formData = new FormData();
      formData.append('file', file.file);
      if (selectedSprintId) formData.append('sprintId', selectedSprintId);
      if (selectedActionId) formData.append('actionId', selectedActionId);

      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            file.progress = Math.round((e.loaded / e.total) * 100);
            rerender();
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            file.status = 'completed';
            file.progress = 100;
            resolve();
          } else {
            file.status = 'error';
            file.error = 'Upload failed';
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          file.status = 'error';
          file.error = 'Network error';
          reject(new Error('Network error'));
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    } catch {
      file.status = 'error';
    }

    rerender();
  }
}

/**
 * Get icon for file type
 */
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  if (mimeType.includes('text')) return '📃';
  return '📁';
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default showFileUploadModal;
