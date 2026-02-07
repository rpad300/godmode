/**
 * Email Composer Component - SOTA UI
 * Multi-mode email input: paste, upload .eml/.msg, manual entry
 */

import { createElement, on } from '../utils/dom';
import { http } from '../services/api';
import { toast } from '../services/toast';

export interface EmailComposerProps {
  onSave?: (email: unknown) => void;
  onClose?: () => void;
}

type InputMode = 'paste' | 'upload' | 'manual';
let currentMode: InputMode = 'paste';
let composerContainer: HTMLElement | null = null;

/**
 * Show email composer
 */
export function showEmailComposer(props: EmailComposerProps = {}): void {
  const existing = document.getElementById('email-composer-overlay');
  if (existing) existing.remove();

  const overlay = createElement('div', { 
    id: 'email-composer-overlay',
    className: 'composer-overlay' 
  });

  const dialog = createEmailComposer(props);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  on(overlay, 'click', (e) => {
    if (e.target === overlay) {
      closeEmailComposer();
      props.onClose?.();
    }
  });

  requestAnimationFrame(() => overlay.classList.add('visible'));
  composerContainer = dialog;
}

/**
 * Close email composer
 */
export function closeEmailComposer(): void {
  const overlay = document.getElementById('email-composer-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }
  composerContainer = null;
}

/**
 * Create email composer
 */
export function createEmailComposer(props: EmailComposerProps = {}): HTMLElement {
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
      .composer-overlay.visible { opacity: 1; }
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
        background: linear-gradient(135deg, #3b82f6, #60a5fa);
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
      
      /* Manual Mode */
      .manual-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .form-row {
        display: flex;
        gap: 16px;
      }
      .form-row > .form-group { flex: 1; }
      .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      .form-group label .required { color: var(--primary); }
      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 14px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      .form-group textarea {
        min-height: 120px;
        resize: vertical;
      }
      .form-group input::placeholder,
      .form-group textarea::placeholder { color: var(--text-tertiary); }
      
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
      <h2>Add Email</h2>
      <button class="composer-close" id="close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="composer-tabs">
      <button class="composer-tab active" data-mode="paste">Paste Text</button>
      <button class="composer-tab" data-mode="upload">Upload .eml/.msg</button>
      <button class="composer-tab" data-mode="manual">Manual Entry</button>
    </div>
    
    <div class="composer-body" id="composer-body">
      ${renderPasteMode()}
    </div>
    
    <div class="composer-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="save-btn" disabled>Add Email</button>
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
    closeEmailComposer();
    props.onClose?.();
  });

  on(container.querySelector('#cancel-btn') as HTMLElement, 'click', () => {
    closeEmailComposer();
    props.onClose?.();
  });

  on(container.querySelector('#save-btn') as HTMLElement, 'click', () => saveEmail(container, props));

  bindPasteMode(container);

  return container;
}

function renderMode(container: HTMLElement): void {
  const body = container.querySelector('#composer-body') as HTMLElement;
  
  switch (currentMode) {
    case 'paste':
      body.innerHTML = renderPasteMode();
      bindPasteMode(container);
      break;
    case 'upload':
      body.innerHTML = renderUploadMode();
      bindUploadMode(container);
      break;
    case 'manual':
      body.innerHTML = renderManualMode();
      bindManualMode(container);
      break;
  }
}

function renderPasteMode(): string {
  return `
    <div class="paste-section">
      <label>Paste email content:</label>
      <textarea id="email-paste" placeholder="Paste the full email content here...

Include headers if available:
From: sender@example.com
To: recipient@example.com
Subject: Meeting notes
Date: Jan 31, 2026

Email body text..."></textarea>
      <p class="paste-hint">Include headers (From, To, Subject, Date) for better parsing.</p>
    </div>
  `;
}

function bindPasteMode(container: HTMLElement): void {
  const textarea = container.querySelector('#email-paste') as HTMLTextAreaElement;
  const saveBtn = container.querySelector('#save-btn') as HTMLButtonElement;

  if (textarea) {
    on(textarea, 'input', () => {
      saveBtn.disabled = textarea.value.trim().length < 10;
    });
  }
}

function renderUploadMode(): string {
  return `
    <div class="upload-section">
      <div class="dropzone" id="file-dropzone">
        <div class="dropzone-icon">📧</div>
        <p class="dropzone-title">Drop email file here</p>
        <p class="dropzone-hint">or click to browse • .eml, .msg</p>
        <input type="file" id="file-input" accept=".eml,.msg" hidden>
      </div>
      <div class="selected-file" id="selected-file">
        <div class="file-icon">📧</div>
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
  const saveBtn = container.querySelector('#save-btn') as HTMLButtonElement;

  on(dropzone, 'click', () => input.click());
  on(dropzone, 'dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  on(dropzone, 'dragleave', () => dropzone.classList.remove('dragover'));
  on(dropzone, 'drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files[0]) handleFileSelect(e.dataTransfer.files[0], container);
  });
  on(input, 'change', () => { if (input.files?.[0]) handleFileSelect(input.files[0], container); });
  on(container.querySelector('#file-remove') as HTMLElement, 'click', () => {
    selectedFile.classList.remove('visible');
    (container as any)._emlFile = null;
    saveBtn.disabled = true;
  });
}

function handleFileSelect(file: File, container: HTMLElement): void {
  const selectedFile = container.querySelector('#selected-file') as HTMLElement;
  const saveBtn = container.querySelector('#save-btn') as HTMLButtonElement;
  
  container.querySelector('#file-name')!.textContent = file.name;
  container.querySelector('#file-size')!.textContent = formatFileSize(file.size);
  selectedFile.classList.add('visible');
  
  (container as any)._emlFile = file;
  saveBtn.disabled = false;
}

function renderManualMode(): string {
  return `
    <form class="manual-form" id="manual-form">
      <div class="form-row">
        <div class="form-group">
          <label>From <span class="required">*</span></label>
          <input type="email" name="from" placeholder="sender@example.com" required>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="datetime-local" name="date">
        </div>
      </div>
      <div class="form-group">
        <label>To <span class="required">*</span></label>
        <input type="text" name="to" placeholder="recipient@example.com (comma-separated)" required>
      </div>
      <div class="form-group">
        <label>CC</label>
        <input type="text" name="cc" placeholder="cc@example.com (comma-separated)">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" name="subject" placeholder="Email subject">
      </div>
      <div class="form-group">
        <label>Body <span class="required">*</span></label>
        <textarea name="body" placeholder="Email content..." required></textarea>
      </div>
    </form>
  `;
}

function bindManualMode(container: HTMLElement): void {
  const form = container.querySelector('#manual-form') as HTMLFormElement;
  const saveBtn = container.querySelector('#save-btn') as HTMLButtonElement;

  const checkValidity = () => {
    const from = form.querySelector('[name="from"]') as HTMLInputElement;
    const to = form.querySelector('[name="to"]') as HTMLInputElement;
    const body = form.querySelector('[name="body"]') as HTMLTextAreaElement;
    saveBtn.disabled = !from.value || !to.value || !body.value;
  };

  form.querySelectorAll('input, textarea').forEach(el => {
    on(el as HTMLElement, 'input', checkValidity);
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveEmail(container: HTMLElement, props: EmailComposerProps): Promise<void> {
  const saveBtn = container.querySelector('#save-btn') as HTMLButtonElement;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Processing...';

  try {
    let data: Record<string, unknown>;

    switch (currentMode) {
      case 'paste': {
        const text = (container.querySelector('#email-paste') as HTMLTextAreaElement).value;
        data = { emailText: text };
        break;
      }
      case 'upload': {
        const file = (container as any)._emlFile as File;
        if (!file) throw new Error('No file selected');
        
        const base64 = await fileToBase64(file);
        if (file.name.toLowerCase().endsWith('.msg')) {
          data = { msgBase64: base64, filename: file.name };
        } else {
          data = { emlBase64: base64, filename: file.name };
        }
        break;
      }
      case 'manual': {
        const form = container.querySelector('#manual-form') as HTMLFormElement;
        const formData = new FormData(form);
        data = {
          from: formData.get('from'),
          to: (formData.get('to') as string).split(',').map(e => e.trim()),
          cc: formData.get('cc') ? (formData.get('cc') as string).split(',').map(e => e.trim()) : undefined,
          subject: formData.get('subject'),
          body: formData.get('body'),
          date: formData.get('date') || undefined,
        };
        break;
      }
    }

    const result = await http.post('/api/emails/import', data);
    toast.success('Email added successfully');
    props.onSave?.(result);
    closeEmailComposer();
  } catch (err) {
    toast.error('Failed to add email');
    console.error('[EmailComposer] Error:', err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Add Email';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default showEmailComposer;
