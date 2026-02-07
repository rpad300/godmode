/**
 * Export Modal Component
 * Export project data in various formats
 */

import { createElement, on, addClass, removeClass } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { http } from '../../services/api';
import { toast } from '../../services/toast';
import { appStore } from '../../stores/app';

const MODAL_ID = 'export-modal';

export type ExportFormat = 'json' | 'csv' | 'pdf' | 'markdown';
export type ExportScope = 'all' | 'questions' | 'risks' | 'actions' | 'decisions' | 'contacts';

export interface ExportModalProps {
  defaultFormat?: ExportFormat;
  defaultScope?: ExportScope;
  onExport?: (format: ExportFormat, scope: ExportScope) => void;
}

/**
 * Show export modal
 */
export function showExportModal(props: ExportModalProps = {}): void {
  const { defaultFormat = 'json', defaultScope = 'all' } = props;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'export-modal-content' });

  content.innerHTML = `
    <div class="export-options">
      <div class="form-group">
        <label>What to Export</label>
        <div class="scope-options">
          <label class="radio-card ${defaultScope === 'all' ? 'selected' : ''}">
            <input type="radio" name="export-scope" value="all" ${defaultScope === 'all' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">📦</span>
              <span class="label">Everything</span>
            </div>
          </label>
          <label class="radio-card ${defaultScope === 'questions' ? 'selected' : ''}">
            <input type="radio" name="export-scope" value="questions" ${defaultScope === 'questions' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">❓</span>
              <span class="label">Questions</span>
            </div>
          </label>
          <label class="radio-card ${defaultScope === 'risks' ? 'selected' : ''}">
            <input type="radio" name="export-scope" value="risks" ${defaultScope === 'risks' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">⚠️</span>
              <span class="label">Risks</span>
            </div>
          </label>
          <label class="radio-card ${defaultScope === 'actions' ? 'selected' : ''}">
            <input type="radio" name="export-scope" value="actions" ${defaultScope === 'actions' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">✅</span>
              <span class="label">Actions</span>
            </div>
          </label>
          <label class="radio-card ${defaultScope === 'decisions' ? 'selected' : ''}">
            <input type="radio" name="export-scope" value="decisions" ${defaultScope === 'decisions' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">🎯</span>
              <span class="label">Decisions</span>
            </div>
          </label>
          <label class="radio-card ${defaultScope === 'contacts' ? 'selected' : ''}">
            <input type="radio" name="export-scope" value="contacts" ${defaultScope === 'contacts' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">👥</span>
              <span class="label">Contacts</span>
            </div>
          </label>
        </div>
      </div>
      
      <div class="form-group">
        <label>Format</label>
        <div class="format-options">
          <label class="radio-card ${defaultFormat === 'json' ? 'selected' : ''}">
            <input type="radio" name="export-format" value="json" ${defaultFormat === 'json' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">{ }</span>
              <span class="label">JSON</span>
              <span class="hint">Full data backup</span>
            </div>
          </label>
          <label class="radio-card ${defaultFormat === 'csv' ? 'selected' : ''}">
            <input type="radio" name="export-format" value="csv" ${defaultFormat === 'csv' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">📊</span>
              <span class="label">CSV</span>
              <span class="hint">Spreadsheet</span>
            </div>
          </label>
          <label class="radio-card ${defaultFormat === 'markdown' ? 'selected' : ''}">
            <input type="radio" name="export-format" value="markdown" ${defaultFormat === 'markdown' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">📝</span>
              <span class="label">Markdown</span>
              <span class="hint">Documentation</span>
            </div>
          </label>
          <label class="radio-card ${defaultFormat === 'pdf' ? 'selected' : ''}">
            <input type="radio" name="export-format" value="pdf" ${defaultFormat === 'pdf' ? 'checked' : ''}>
            <div class="radio-card-content">
              <span class="icon">📄</span>
              <span class="label">PDF</span>
              <span class="hint">Report</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  `;

  // Handle radio card selection styling
  content.querySelectorAll('.radio-card input').forEach(input => {
    on(input as HTMLElement, 'change', () => {
      const group = (input as HTMLInputElement).name;
      content.querySelectorAll(`[name="${group}"]`).forEach(radio => {
        const card = radio.closest('.radio-card');
        if (card) {
          if ((radio as HTMLInputElement).checked) {
            addClass(card as HTMLElement, 'selected');
          } else {
            removeClass(card as HTMLElement, 'selected');
          }
        }
      });
    });
  });

  // Footer
  const footer = createElement('div', { className: 'modal-footer' });

  const cancelBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Cancel',
  });

  const exportBtn = createElement('button', {
    className: 'btn btn-primary',
    textContent: 'Export',
  });

  on(cancelBtn, 'click', () => closeModal(MODAL_ID));

  on(exportBtn, 'click', async () => {
    const format = (content.querySelector('[name="export-format"]:checked') as HTMLInputElement)?.value as ExportFormat;
    const scope = (content.querySelector('[name="export-scope"]:checked') as HTMLInputElement)?.value as ExportScope;

    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';

    try {
      await performExport(format, scope);
      props.onExport?.(format, scope);
      closeModal(MODAL_ID);
    } catch {
      // Error handled in performExport
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export';
    }
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(exportBtn);

  // Create modal
  const modal = createModal({
    id: MODAL_ID,
    title: 'Export Data',
    content,
    size: 'md',
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Perform the export
 */
async function performExport(format: ExportFormat, scope: ExportScope): Promise<void> {
  const projectId = appStore.getState().currentProjectId;
  if (!projectId) {
    toast.error('No project selected');
    return;
  }

  try {
    const response = await http.get<unknown>(`/api/projects/${projectId}/export`, {
      headers: {
        'Accept': getContentType(format),
      },
    });

    // Create download
    const blob = createBlob(response.data, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godmode-${scope}-${new Date().toISOString().split('T')[0]}.${getExtension(format)}`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Export completed');
  } catch {
    toast.error('Export failed');
    throw new Error('Export failed');
  }
}

/**
 * Get content type for format
 */
function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'markdown': return 'text/markdown';
    case 'pdf': return 'application/pdf';
  }
}

/**
 * Get file extension for format
 */
function getExtension(format: ExportFormat): string {
  switch (format) {
    case 'json': return 'json';
    case 'csv': return 'csv';
    case 'markdown': return 'md';
    case 'pdf': return 'pdf';
  }
}

/**
 * Create blob from data
 */
function createBlob(data: unknown, format: ExportFormat): Blob {
  let content: string;
  let type: string;

  switch (format) {
    case 'json':
      content = JSON.stringify(data, null, 2);
      type = 'application/json';
      break;
    case 'csv':
      content = typeof data === 'string' ? data : JSON.stringify(data);
      type = 'text/csv';
      break;
    case 'markdown':
      content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      type = 'text/markdown';
      break;
    case 'pdf':
      // PDF would need special handling
      content = typeof data === 'string' ? data : '';
      type = 'application/pdf';
      break;
  }

  return new Blob([content], { type });
}

export default showExportModal;
