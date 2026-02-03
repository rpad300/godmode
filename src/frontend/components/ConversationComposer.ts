/**
 * Conversation Composer Component - SOTA UI
 * Multi-mode conversation/transcript input
 */

import { createElement, on } from '../utils/dom';
import { conversationsService } from '../services/documents';
import { toast } from '../services/toast';

export interface ConversationComposerProps {
  onImport?: (conversation: unknown) => void;
  onClose?: () => void;
}

type InputMode = 'paste' | 'upload';
let currentMode: InputMode = 'paste';

/**
 * Show conversation composer modal
 */
export function showConversationComposer(props: ConversationComposerProps = {}): void {
  const existing = document.getElementById('conversation-composer-overlay');
  if (existing) existing.remove();

  const overlay = createElement('div', { 
    id: 'conversation-composer-overlay',
    className: 'composer-overlay' 
  });

  const dialog = createConversationComposer(props);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  on(overlay, 'click', (e) => {
    if (e.target === overlay) {
      closeConversationComposer();
      props.onClose?.();
    }
  });

  requestAnimationFrame(() => overlay.classList.add('visible'));
}

/**
 * Close conversation composer
 */
export function closeConversationComposer(): void {
  const overlay = document.getElementById('conversation-composer-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }
}

/**
 * Create conversation composer
 */
function createConversationComposer(props: ConversationComposerProps): HTMLElement {
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
      .composer-tab:hover { color: var(--text-primary); }
      .composer-tab.active { color: var(--primary); }
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
      
      .composer-body {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
      }
      
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
        font-family: 'SF Mono', Monaco, monospace;
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
      .paste-section textarea::placeholder { color: var(--text-tertiary); }
      .paste-hint {
        margin-top: 12px;
        font-size: 13px;
        color: var(--text-tertiary);
      }
      
      .format-row {
        margin-top: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .format-row label {
        font-size: 13px;
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .format-row select {
        flex: 1;
        max-width: 200px;
        padding: 10px 14px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 13px;
      }
      
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
      .dropzone-icon { font-size: 48px; margin-bottom: 16px; }
      .dropzone-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .dropzone-hint { font-size: 13px; color: var(--text-tertiary); }
      
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
      .selected-file.visible { display: flex; }
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
      .file-info { flex: 1; min-width: 0; }
      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .file-size { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
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
      
      .preview-area {
        margin-top: 20px;
        padding: 16px;
        background: var(--bg-tertiary);
        border-radius: 12px;
        display: none;
      }
      .preview-area.visible { display: block; }
      .preview-area h4 {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .preview-stats {
        display: flex;
        gap: 24px;
        font-size: 14px;
      }
      .preview-stats span { color: var(--text-secondary); }
      .preview-stats strong { color: var(--text-primary); }
      
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
      .composer-footer .btn-secondary:hover { background: var(--bg-tertiary); }
      .composer-footer .btn-outline {
        background: transparent;
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }
      .composer-footer .btn-outline:hover { background: var(--bg-tertiary); }
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
      <h2>Import Conversation</h2>
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
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-outline" id="preview-btn" disabled>Preview</button>
      <button class="btn btn-primary" id="import-btn" disabled>Import</button>
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

  on(container.querySelector('#close-btn') as HTMLElement, 'click', () => {
    closeConversationComposer();
    props.onClose?.();
  });

  on(container.querySelector('#cancel-btn') as HTMLElement, 'click', () => {
    closeConversationComposer();
    props.onClose?.();
  });

  on(container.querySelector('#preview-btn') as HTMLElement, 'click', () => handlePreview(container));
  on(container.querySelector('#import-btn') as HTMLElement, 'click', () => handleImport(container, props));

  bindPasteMode(container);

  return container;
}

function renderMode(container: HTMLElement): void {
  const body = container.querySelector('#composer-body') as HTMLElement;
  body.innerHTML = currentMode === 'paste' ? renderPasteMode() : renderUploadMode();
  
  if (currentMode === 'paste') bindPasteMode(container);
  else bindUploadMode(container);
}

function renderPasteMode(): string {
  return `
    <div class="paste-section">
      <label>Paste conversation or transcript:</label>
      <textarea id="conversation-input" placeholder="Paste your conversation here...

Supported formats:
• WhatsApp, Slack, Teams, Discord chats
• Meeting transcripts (Zoom, Google Meet)
• Email threads
• Any text with speaker names

Example:
[10:30] John: Hello everyone
[10:31] Jane: Hi John!
[10:32] John: Let's discuss the project..."></textarea>
      <p class="paste-hint">Include timestamps and speaker names for better parsing.</p>
      <div class="format-row">
        <label>Format:</label>
        <select id="format-select">
          <option value="">Auto-detect</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="slack">Slack</option>
          <option value="teams">Microsoft Teams</option>
          <option value="discord">Discord</option>
          <option value="zoom">Zoom Transcript</option>
          <option value="generic">Generic Chat</option>
        </select>
      </div>
    </div>
    <div class="preview-area" id="preview-area"></div>
  `;
}

function bindPasteMode(container: HTMLElement): void {
  const textarea = container.querySelector('#conversation-input') as HTMLTextAreaElement;
  const previewBtn = container.querySelector('#preview-btn') as HTMLButtonElement;
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;

  if (textarea) {
    on(textarea, 'input', () => {
      const hasContent = textarea.value.trim().length > 10;
      previewBtn.disabled = !hasContent;
      importBtn.disabled = !hasContent;
    });
  }
}

function renderUploadMode(): string {
  return `
    <div class="upload-section">
      <div class="dropzone" id="file-dropzone">
        <div class="dropzone-icon">💬</div>
        <p class="dropzone-title">Drop chat file here</p>
        <p class="dropzone-hint">or click to browse • .txt, .json</p>
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
    <div class="preview-area" id="preview-area"></div>
  `;
}

function bindUploadMode(container: HTMLElement): void {
  const dropzone = container.querySelector('#file-dropzone') as HTMLElement;
  const input = container.querySelector('#file-input') as HTMLInputElement;
  const selectedFile = container.querySelector('#selected-file') as HTMLElement;
  const previewBtn = container.querySelector('#preview-btn') as HTMLButtonElement;
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;

  on(dropzone, 'click', () => input.click());
  on(dropzone, 'dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  on(dropzone, 'dragleave', () => dropzone.classList.remove('dragover'));
  on(dropzone, 'drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files[0]) selectFile(e.dataTransfer.files[0], container);
  });
  on(input, 'change', () => { if (input.files?.[0]) selectFile(input.files[0], container); });
  on(container.querySelector('#file-remove') as HTMLElement, 'click', () => {
    selectedFile.classList.remove('visible');
    (container as any)._fileContent = null;
    previewBtn.disabled = true;
    importBtn.disabled = true;
  });
}

function selectFile(file: File, container: HTMLElement): void {
  const selectedFile = container.querySelector('#selected-file') as HTMLElement;
  const previewBtn = container.querySelector('#preview-btn') as HTMLButtonElement;
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;
  
  container.querySelector('#file-name')!.textContent = file.name;
  container.querySelector('#file-size')!.textContent = formatFileSize(file.size);
  selectedFile.classList.add('visible');

  const reader = new FileReader();
  reader.onload = () => {
    (container as any)._fileContent = reader.result;
    previewBtn.disabled = false;
    importBtn.disabled = false;
  };
  reader.readAsText(file);
}

function getContent(container: HTMLElement): string {
  if (currentMode === 'paste') {
    return (container.querySelector('#conversation-input') as HTMLTextAreaElement)?.value || '';
  }
  return (container as any)._fileContent || '';
}

async function handlePreview(container: HTMLElement): Promise<void> {
  const previewBtn = container.querySelector('#preview-btn') as HTMLButtonElement;
  const previewArea = container.querySelector('#preview-area') as HTMLElement;
  const content = getContent(container);
  if (!content) return;

  previewBtn.disabled = true;
  previewBtn.textContent = 'Parsing...';

  try {
    const result = await conversationsService.parsePreview(content);
    previewArea.classList.add('visible');
    previewArea.innerHTML = `
      <h4>Preview</h4>
      <div class="preview-stats">
        <span>Messages: <strong>${result.message_count || 0}</strong></span>
        <span>Participants: <strong>${result.participants?.length || 0}</strong></span>
        <span>Format: <strong>${result.format || 'Unknown'}</strong></span>
      </div>
    `;
  } catch {
    toast.error('Failed to parse conversation');
  } finally {
    previewBtn.disabled = false;
    previewBtn.textContent = 'Preview';
  }
}

async function handleImport(container: HTMLElement, props: ConversationComposerProps): Promise<void> {
  const importBtn = container.querySelector('#import-btn') as HTMLButtonElement;
  const content = getContent(container);
  const formatSelect = container.querySelector('#format-select') as HTMLSelectElement;
  if (!content) return;

  importBtn.disabled = true;
  importBtn.textContent = 'Importing...';

  try {
    const result = await conversationsService.import(content, { formatHint: formatSelect?.value });
    toast.success('Conversation imported');
    props.onImport?.(result);
    closeConversationComposer();
  } catch {
    toast.error('Failed to import conversation');
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Import';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default showConversationComposer;
