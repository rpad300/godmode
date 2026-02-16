/**
 * Transcript Composer Component - SOTA UI
 * Multi-mode transcript input: paste text or upload file
 */

import { createElement, on } from '@lib/dom';
import { toast } from '@services/toast';
import { fetchWithProject } from '@services/api';
import { getSprints } from '@services/sprints';
import { getActions } from '@services/actions';

export interface TranscriptComposerProps {
  onImport?: (document: unknown) => void;
  onClose?: () => void;
}

type InputMode = 'paste' | 'upload';
let currentMode: InputMode = 'paste';

/**
 * Show transcript composer modal
 */
export function showTranscriptComposer(props: TranscriptComposerProps = {}): void {
  const existing = document.getElementById('transcript-composer-overlay');
  if (existing) existing.remove();

  const overlay = createElement('div', {
    id: 'transcript-composer-overlay',
    className: 'composer-overlay'
  });

  const dialog = createTranscriptComposer(props);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  on(overlay, 'click', (e) => {
    if (e.target === overlay) {
      closeTranscriptComposer();
      props.onClose?.();
    }
  });

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

/**
 * Close transcript composer
 */
export function closeTranscriptComposer(): void {
  const overlay = document.getElementById('transcript-composer-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }
}

/**
 * Create transcript composer
 */
function createTranscriptComposer(props: TranscriptComposerProps): HTMLElement {
  const container = createElement('div', { className: 'composer-modal' });

  container.innerHTML = `
    <style>
      .composer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .composer-overlay.visible {
        opacity: 1;
      }
      .composer-overlay.visible .composer-modal {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .composer-modal {
        width: 640px;
        max-width: 95vw;
        max-height: 85vh;
        background: var(--bg-primary);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(20px) scale(0.98);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Header */
      .composer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
      }
      .composer-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .composer-close {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--bg-secondary);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        transition: all 0.15s ease;
      }
      .composer-close:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      
      /* Tabs */
      .composer-tabs {
        display: flex;
        padding: 0 24px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .composer-tab {
        padding: 14px 20px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary);
        background: none;
        border: none;
        cursor: pointer;
        position: relative;
        transition: color 0.15s ease;
      }
      .composer-tab:hover {
        color: var(--text-primary);
      }
      .composer-tab.active {
        color: var(--primary);
      }
      .composer-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--primary);
        border-radius: 2px 2px 0 0;
      }
      
      /* Content */
      .composer-body {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
      }
      
      /* Paste Mode */
      .paste-section label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 12px;
      }
      .paste-section textarea {
        width: 100%;
        min-height: 280px;
        padding: 16px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 13px;
        line-height: 1.6;
        resize: vertical;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .paste-section textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      .paste-section textarea::placeholder {
        color: var(--text-tertiary);
      }
      .paste-hint {
        margin-top: 12px;
        font-size: 13px;
        color: var(--text-tertiary);
      }
      
      /* Source Select */
      .source-row {
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .source-row label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .source-row select {
        flex: 1;
        max-width: 200px;
        padding: 10px 14px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 13px;
        cursor: pointer;
      }
      .source-row select:focus {
        outline: none;
        border-color: var(--primary);
      }
      
      /* Upload Mode */
      .upload-section .dropzone {
        border: 2px dashed var(--border-color);
        border-radius: 16px;
        padding: 60px 40px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--bg-secondary);
      }
      .upload-section .dropzone:hover,
      .upload-section .dropzone.dragover {
        border-color: var(--primary);
        background: rgba(var(--primary-rgb), 0.03);
      }
      .dropzone-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .dropzone-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .dropzone-hint {
        font-size: 13px;
        color: var(--text-tertiary);
      }
      
      /* Selected File */
      .selected-file {
        display: none;
        align-items: center;
        gap: 16px;
        margin-top: 20px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 12px;
        border: 1px solid var(--border-color);
      }
      .selected-file.visible {
        display: flex;
      }
      .file-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, white));
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }
      .file-info {
        flex: 1;
        min-width: 0;
      }
      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .file-size {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-top: 2px;
      }
      .file-remove {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        color: var(--text-tertiary);
        font-size: 18px;
        transition: all 0.15s ease;
      }
      .file-remove:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      
      /* Footer */
      .composer-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .composer-footer .btn {
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
      }
      .composer-footer .btn-secondary {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      .composer-footer .btn-secondary:hover {
        background: var(--bg-tertiary);
      }
      .composer-footer .btn-primary {
        background: var(--primary);
        color: white;
      }
      .composer-footer .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .composer-footer .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    </style>
    
    <div class="composer-header">
      <h2>Import Transcript</h2>
      <button class="composer-close" id="close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="composer-tabs">
      <button class="composer-tab active" data-mode="paste">Paste Text</button>
      <button class="composer-tab" data-mode="upload">Upload File</button>
    </div>
    
    <div class="composer-body" id="composer-body">
      ${renderPasteMode()}
    </div>
    
    <div class="composer-association" style="padding: 12px 24px; border-top: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
      <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">Associate with (optional)</span>
      <select id="transcript-sprint-select" class="form-select" style="min-width: 140px;"><option value="">No sprint</option></select>
      <select id="transcript-action-select" class="form-select" style="min-width: 180px;"><option value="">No task</option></select>
    </div>
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="import-btn" disabled>Process Transcript</button>
    </div>
  `;

  // Bind tabs
  container.querySelectorAll('.composer-tab').forEach(tab => {
    on(tab as HTMLElement, 'click', () => {
      container.querySelectorAll('.composer-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.getAttribute('data-mode') as InputMode;
      renderMode(container);
    });
  });

  // Bind close
  on(container.querySelector('#close-btn') as HTMLElement, 'click', () => {
    closeTranscriptComposer();
    props.onClose?.();
  });

  // Bind cancel
  on(container.querySelector('#cancel-btn') as HTMLElement, 'click', () => {
    closeTranscriptComposer();
    props.onClose?.();
  });

  // Bind import
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;
  on(importBtn, 'click', () => handleImport(container, props));

  // Initial binding
  bindPasteMode(container);
  initTranscriptSprintTask(container);

  return container;
}

async function initTranscriptSprintTask(container: HTMLElement): Promise<void> {
  const sprintSelect = container.querySelector('#transcript-sprint-select') as HTMLSelectElement;
  const actionSelect = container.querySelector('#transcript-action-select') as HTMLSelectElement;
  if (!sprintSelect || !actionSelect) return;
  try {
    const sprints = await getSprints();
    sprints.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sprintSelect.appendChild(opt);
    });
    on(sprintSelect, 'change', async () => {
      const sprintId = sprintSelect.value || '';
      actionSelect.innerHTML = '<option value="">No task</option>';
      if (!sprintId) return;
      try {
        const actions = await getActions(undefined, sprintId);
        actions.forEach(a => {
          const opt = document.createElement('option');
          opt.value = String(a.id);
          opt.textContent = (a.content || a.task || String(a.id)).slice(0, 60) + ((a.content || a.task || '').length > 60 ? '…' : '');
          actionSelect.appendChild(opt);
        });
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

function renderMode(container: HTMLElement): void {
  const body = container.querySelector('#composer-body') as HTMLElement;
  body.innerHTML = currentMode === 'paste' ? renderPasteMode() : renderUploadMode();

  if (currentMode === 'paste') {
    bindPasteMode(container);
  } else {
    bindUploadMode(container);
  }
}

function renderPasteMode(): string {
  return `
    <div class="paste-section">
      <label>Paste meeting transcript:</label>
      <textarea id="transcript-input" placeholder="Paste your meeting transcript here...

Supported formats:
• Krisp transcripts
• Otter.ai transcripts  
• Zoom meeting transcripts
• Google Meet transcripts
• Microsoft Teams transcripts

Example:
Speaker 1 (00:00:05):
Hello everyone, welcome to today's meeting.

Speaker 2 (00:00:12):
Thanks for having us. Let's get started."></textarea>
      <p class="paste-hint">Include speaker names and timestamps if available for better parsing.</p>
      <div class="source-row">
        <label>Source:</label>
        <select id="source-select">
          <option value="">Auto-detect</option>
          <option value="krisp">Krisp</option>
          <option value="otter">Otter.ai</option>
          <option value="zoom">Zoom</option>
          <option value="meet">Google Meet</option>
          <option value="teams">Microsoft Teams</option>
        </select>
      </div>
    </div>
  `;
}

function bindPasteMode(container: HTMLElement): void {
  const textarea = container.querySelector('#transcript-input') as HTMLTextAreaElement;
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;

  if (textarea) {
    on(textarea, 'input', () => {
      importBtn.disabled = textarea.value.trim().length < 20;
    });
  }
}

function renderUploadMode(): string {
  return `
    <div class="upload-section">
      <div class="dropzone" id="file-dropzone">
        <div class="dropzone-icon">🎙️</div>
        <p class="dropzone-title">Drop transcript file here</p>
        <p class="dropzone-hint">or click to browse • .txt, .md, .srt, .vtt</p>
        <input type="file" id="file-input" accept=".txt,.md,.srt,.vtt,.json" hidden>
      </div>
      <div class="selected-file" id="selected-file">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name" id="file-name"></div>
          <div class="file-size" id="file-size"></div>
        </div>
        <button class="file-remove" id="file-remove">×</button>
      </div>
    </div>
  `;
}

function bindUploadMode(container: HTMLElement): void {
  const dropzone = container.querySelector('#file-dropzone') as HTMLElement;
  const input = container.querySelector('#file-input') as HTMLInputElement;
  const selectedFile = container.querySelector('#selected-file') as HTMLElement;
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;

  on(dropzone, 'click', () => input.click());

  on(dropzone, 'dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  on(dropzone, 'dragleave', () => dropzone.classList.remove('dragover'));

  on(dropzone, 'drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) selectFile(file, container);
  });

  on(input, 'change', () => {
    if (input.files?.[0]) selectFile(input.files[0], container);
  });

  on(container.querySelector('#file-remove') as HTMLElement, 'click', () => {
    selectedFile.classList.remove('visible');
    (container as any)._fileContent = null;
    importBtn.disabled = true;
  });
}

function selectFile(file: File, container: HTMLElement): void {
  const selectedFile = container.querySelector('#selected-file') as HTMLElement;
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;

  container.querySelector('#file-name')!.textContent = file.name;
  container.querySelector('#file-size')!.textContent = formatFileSize(file.size);
  selectedFile.classList.add('visible');

  const reader = new FileReader();
  reader.onload = () => {
    (container as any)._fileContent = reader.result;
    importBtn.disabled = false;
  };
  reader.readAsText(file);
}

function getContent(container: HTMLElement): string {
  if (currentMode === 'paste') {
    return (container.querySelector('#transcript-input') as HTMLTextAreaElement)?.value || '';
  }
  return (container as any)._fileContent || '';
}

async function handleImport(container: HTMLElement, props: TranscriptComposerProps): Promise<void> {
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;
  const cancelBtn = container.querySelector('#cancel-btn') as HTMLButtonElement;
  const content = getContent(container);
  if (!content) return;

  // Prevent double-click
  if (importBtn.disabled) return;

  importBtn.disabled = true;
  cancelBtn.disabled = true;

  // Show processing state in footer
  const footer = container.querySelector('.composer-footer') as HTMLElement;
  const originalFooter = footer.innerHTML;

  footer.innerHTML = `
    <div class="transcript-status-row">
      <div class="processing-spinner"></div>
      <div class="transcript-status-fill">
        <div class="transcript-status-title" id="processing-status">Uploading transcript...</div>
        <div class="transcript-status-detail" id="processing-detail">Please wait</div>
      </div>
    </div>
  `;

  const statusEl = footer.querySelector('#processing-status') as HTMLElement;
  const detailEl = footer.querySelector('#processing-detail') as HTMLElement;

  try {
    const sourceSelect = container.querySelector('#source-select') as HTMLSelectElement;
    const formData = new FormData();
    const filename = `transcript_${Date.now()}.txt`;
    formData.append('file', new Blob([content], { type: 'text/plain' }), filename);
    formData.append('folder', 'newtranscripts');
    if (sourceSelect?.value) formData.append('source', sourceSelect.value);
    const sprintSelect = container.querySelector('#transcript-sprint-select') as HTMLSelectElement;
    const actionSelect = container.querySelector('#transcript-action-select') as HTMLSelectElement;
    if (sprintSelect?.value) formData.append('sprintId', sprintSelect.value);
    if (actionSelect?.value) formData.append('actionId', actionSelect.value);

    // Step 1: Upload
    statusEl.textContent = 'Uploading transcript...';
    detailEl.textContent = `${formatFileSize(content.length)} • ${filename}`;

    const response = await fetchWithProject('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed (${response.status})`);
    }

    const result = await response.json();

    // Step 2: Processing started
    statusEl.textContent = 'Transcript uploaded!';
    detailEl.textContent = 'AI processing will start automatically';

    // Show success state briefly
    footer.innerHTML = `
      <div class="transcript-status-row">
        <div class="transcript-success-icon">✓</div>
        <div class="transcript-status-fill">
          <div class="transcript-success-title">Transcript imported successfully!</div>
          <div class="transcript-status-detail">AI extraction will process in the background</div>
        </div>
      </div>
      <button class="btn btn-primary transcript-done-btn" id="done-btn">Done</button>
    `;

    // Bind done button
    footer.querySelector('#done-btn')?.addEventListener('click', () => {
      props.onImport?.(result);
      closeTranscriptComposer();
    });

    // Auto-close after 3 seconds
    setTimeout(() => {
      props.onImport?.(result);
      closeTranscriptComposer();
    }, 3000);

  } catch (err) {
    console.error('[TranscriptComposer] Error:', err);

    // Show error state
    footer.innerHTML = `
      <div class="transcript-status-row">
        <div class="transcript-error-icon">✕</div>
        <div class="transcript-status-fill">
          <div class="transcript-error-title">Import failed</div>
          <div class="transcript-status-detail">${err instanceof Error ? err.message : 'Unknown error'}</div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary transcript-retry-btn" id="retry-btn">Try Again</button>
    `;

    // Bind retry button
    footer.querySelector('#retry-btn')?.addEventListener('click', () => {
      footer.innerHTML = originalFooter;
      const newImportBtn = footer.querySelector('#import-btn') as HTMLButtonElement;
      const newCancelBtn = footer.querySelector('#cancel-btn') as HTMLButtonElement;
      if (newImportBtn) {
        newImportBtn.disabled = false;
        newImportBtn.addEventListener('click', () => handleImport(container, props));
      }
      if (newCancelBtn) {
        newCancelBtn.disabled = false;
        newCancelBtn.addEventListener('click', () => {
          closeTranscriptComposer();
          props.onClose?.();
        });
      }
    });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default showTranscriptComposer;
