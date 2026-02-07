/**
 * File Uploader Component
 * Drag-and-drop file upload with progress and file list
 */

import { createElement, on } from '../utils/dom';
import { documentsService, UploadResult, ProcessingStatus } from '../services/documents';
import { toast } from '../services/toast';
import { formatFileSize } from '../utils/format';

export interface FileUploaderProps {
  onUploadComplete?: (result: UploadResult) => void;
  onProcessingStart?: () => void;
  allowedTypes?: string[];
  maxFileSize?: number; // in bytes
  multiple?: boolean;
}

interface QueuedFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

let fileQueue: QueuedFile[] = [];
let isProcessing = false;

/**
 * Create file uploader component
 */
export function createFileUploader(props: FileUploaderProps = {}): HTMLElement {
  const { allowedTypes, maxFileSize = 50 * 1024 * 1024, multiple = true } = props;

  const uploader = createElement('div', { className: 'file-uploader' });

  uploader.innerHTML = `
    <div class="dropzone" id="dropzone">
      <div class="dropzone-content">
        <div class="dropzone-icon">📤</div>
        <div class="dropzone-text">
          <p>Drag & drop files here</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
        <input type="file" id="file-input" ${multiple ? 'multiple' : ''} 
               ${allowedTypes ? `accept="${allowedTypes.join(',')}"` : ''} hidden>
      </div>
    </div>
    <div class="file-queue gm-hidden" id="file-queue"></div>
    <div class="upload-actions gm-hidden" id="upload-actions">
      <button class="btn btn-secondary" id="clear-queue-btn">Clear</button>
      <button class="btn btn-primary" id="upload-btn">Upload Files</button>
    </div>
    <div class="processing-status gm-hidden" id="processing-status"></div>
  `;

  const dropzone = uploader.querySelector('#dropzone') as HTMLElement;
  const fileInput = uploader.querySelector('#file-input') as HTMLInputElement;
  const queueContainer = uploader.querySelector('#file-queue') as HTMLElement;
  const actionsContainer = uploader.querySelector('#upload-actions') as HTMLElement;
  const statusContainer = uploader.querySelector('#processing-status') as HTMLElement;

  // Click to browse
  on(dropzone, 'click', () => fileInput.click());

  // File input change
  on(fileInput, 'change', () => {
    if (fileInput.files) {
      addFilesToQueue(Array.from(fileInput.files), maxFileSize);
      updateQueueUI(queueContainer, actionsContainer);
    }
    fileInput.value = ''; // Reset for same file selection
  });

  // Drag events
  on(dropzone, 'dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  on(dropzone, 'dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  on(dropzone, 'drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      addFilesToQueue(files, maxFileSize);
      updateQueueUI(queueContainer, actionsContainer);
    }
  });

  // Clear queue
  const clearBtn = uploader.querySelector('#clear-queue-btn');
  if (clearBtn) {
    on(clearBtn as HTMLElement, 'click', () => {
      fileQueue = [];
      updateQueueUI(queueContainer, actionsContainer);
    });
  }

  // Upload button
  const uploadBtn = uploader.querySelector('#upload-btn');
  if (uploadBtn) {
    on(uploadBtn as HTMLElement, 'click', async () => {
      await uploadFiles(queueContainer, actionsContainer, statusContainer, props);
    });
  }

  // Check processing status on mount
  checkProcessingStatus(statusContainer);

  return uploader;
}

/**
 * Add files to queue
 */
function addFilesToQueue(files: File[], maxSize: number): void {
  files.forEach(file => {
    // Check size
    if (file.size > maxSize) {
      toast.warning(`${file.name} is too large (max ${formatFileSize(maxSize)})`);
      return;
    }

    // Check if already in queue
    if (fileQueue.some(f => f.file.name === file.name && f.file.size === file.size)) {
      return;
    }

    fileQueue.push({
      file,
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: 'pending',
    });
  });
}

/**
 * Update queue UI
 */
function updateQueueUI(container: HTMLElement, actionsContainer: HTMLElement): void {
  if (fileQueue.length === 0) {
    container.classList.add('gm-hidden');
    actionsContainer.classList.add('gm-hidden');
    return;
  }

  container.classList.remove('gm-hidden');
  actionsContainer.classList.remove('gm-hidden');

  container.innerHTML = fileQueue.map(qf => `
    <div class="queued-file ${qf.status}" data-id="${qf.id}">
      <div class="file-info">
        <span class="file-icon">${getFileIcon(qf.file.type)}</span>
        <span class="file-name">${escapeHtml(qf.file.name)}</span>
        <span class="file-size">${formatFileSize(qf.file.size)}</span>
      </div>
      <div class="file-status">
        ${qf.status === 'uploading' ? `
          <div class="progress-bar">
            <div class="progress-fill" data-width="${qf.progress}"></div>
          </div>
          <span class="progress-text">${qf.progress}%</span>
        ` : qf.status === 'complete' ? `
          <span class="status-icon success">✓</span>
        ` : qf.status === 'error' ? `
          <span class="status-icon error">✕</span>
          <span class="error-text">${escapeHtml(qf.error || 'Error')}</span>
        ` : `
          <button class="btn-icon remove-file" data-id="${qf.id}">×</button>
        `}
      </div>
    </div>
  `).join('');

  container.querySelectorAll<HTMLElement>('.progress-fill[data-width]').forEach(el => {
    const w = Number(el.dataset.width || '0');
    el.style.width = `${Math.max(0, Math.min(100, w))}%`;
  });

  // Bind remove buttons
  container.querySelectorAll('.remove-file').forEach(btn => {
    on(btn as HTMLElement, 'click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      fileQueue = fileQueue.filter(f => f.id !== id);
      updateQueueUI(container, actionsContainer);
    });
  });
}

/**
 * Upload files
 */
async function uploadFiles(
  queueContainer: HTMLElement,
  actionsContainer: HTMLElement,
  statusContainer: HTMLElement,
  props: FileUploaderProps
): Promise<void> {
  const pendingFiles = fileQueue.filter(f => f.status === 'pending');
  if (pendingFiles.length === 0) return;

  // Disable buttons during upload
  const uploadBtn = actionsContainer.querySelector('#upload-btn') as HTMLButtonElement;
  if (uploadBtn) uploadBtn.disabled = true;

  try {
    // Mark all as uploading
    pendingFiles.forEach(f => {
      f.status = 'uploading';
      f.progress = 0;
    });
    updateQueueUI(queueContainer, actionsContainer);

    // Upload files
    const result = await documentsService.upload(
      pendingFiles.map(f => f.file),
      (progress) => {
        pendingFiles.forEach(f => {
          f.progress = progress;
        });
        updateQueueUI(queueContainer, actionsContainer);
      }
    );

    // Mark as complete
    pendingFiles.forEach(f => {
      f.status = 'complete';
      f.progress = 100;
    });
    updateQueueUI(queueContainer, actionsContainer);

    toast.success(`Uploaded ${result.files.length} file(s)`);
    props.onUploadComplete?.(result);

    // Clear completed after delay
    setTimeout(() => {
      fileQueue = fileQueue.filter(f => f.status !== 'complete');
      updateQueueUI(queueContainer, actionsContainer);
    }, 2000);

    // Check if processing started
    if (result.processingStarted) {
      props.onProcessingStart?.();
      pollProcessingStatus(statusContainer);
    }
  } catch (error) {
    pendingFiles.forEach(f => {
      f.status = 'error';
      f.error = error instanceof Error ? error.message : 'Upload failed';
    });
    updateQueueUI(queueContainer, actionsContainer);
  } finally {
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

/**
 * Check processing status
 */
async function checkProcessingStatus(container: HTMLElement): Promise<void> {
  try {
    const status = await documentsService.getProcessingStatus();
    if (status.isProcessing || status.queueLength > 0) {
      renderProcessingStatus(container, status);
      pollProcessingStatus(container);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Poll processing status
 */
let pollingInterval: number | null = null;

function pollProcessingStatus(container: HTMLElement): void {
  if (pollingInterval) return;

  pollingInterval = window.setInterval(async () => {
    try {
      const status = await documentsService.getProcessingStatus();
      renderProcessingStatus(container, status);

      if (!status.isProcessing && status.queueLength === 0) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        setTimeout(() => {
          container.classList.add('gm-hidden');
        }, 3000);
      }
    } catch {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    }
  }, 2000);
}

/**
 * Render processing status
 */
function renderProcessingStatus(container: HTMLElement, status: ProcessingStatus): void {
  container.classList.remove('gm-hidden');

  container.innerHTML = `
    <div class="processing-header">
      <span class="processing-icon">${status.isProcessing ? '⏳' : '✓'}</span>
      <span class="processing-title">${status.isProcessing ? 'Processing...' : 'Complete'}</span>
    </div>
    <div class="processing-stats">
      <span>Completed: ${status.completedCount}</span>
      <span>Pending: ${status.queueLength}</span>
      ${status.errorCount > 0 ? `<span class="error">Errors: ${status.errorCount}</span>` : ''}
    </div>
    ${status.processingFile ? `<div class="current-file">Current: ${escapeHtml(status.processingFile)}</div>` : ''}
    ${status.isProcessing ? `
      <div class="processing-progress">
        <div class="progress-bar">
          <div class="progress-fill" data-width="${(status.completedCount / (status.completedCount + status.queueLength + 1)) * 100}"></div>
        </div>
      </div>
    ` : ''}
  `;

  container.querySelectorAll<HTMLElement>('.progress-fill[data-width]').forEach(el => {
    const w = Number(el.dataset.width || '0');
    el.style.width = `${Math.max(0, Math.min(100, w))}%`;
  });
}

/**
 * Get file icon based on type
 */
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
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

export default createFileUploader;
