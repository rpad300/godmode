/**
 * Knowledge Panel Component
 * Knowledge base management with export, regenerate, status
 */

import { createElement, on } from '../utils/dom';
import { knowledgeService, EmbeddingStatus } from '../services/documents';
import { toast } from '../services/toast';

export interface KnowledgePanelProps {
  onExport?: (format: 'md' | 'json') => void;
}

/**
 * Create knowledge panel
 */
export function createKnowledgePanel(props: KnowledgePanelProps = {}): HTMLElement {
  const panel = createElement('div', { className: 'knowledge-panel' });

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Knowledge Base</h2>
    </div>
    <div class="panel-content">
      <div class="knowledge-status" id="knowledge-status">
        <div class="loading">Loading status...</div>
      </div>
      <div class="knowledge-actions">
        <div class="action-group">
          <h4>Export</h4>
          <div class="action-buttons">
            <button class="btn btn-sm" id="export-md-btn">Export Markdown</button>
            <button class="btn btn-sm" id="export-json-btn">Export JSON</button>
          </div>
        </div>
        <div class="action-group">
          <h4>Maintenance</h4>
          <div class="action-buttons">
            <button class="btn btn-sm" id="regenerate-btn">Regenerate Files</button>
            <button class="btn btn-sm" id="synthesize-btn">Synthesize Facts</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind events
  const exportMdBtn = panel.querySelector('#export-md-btn');
  if (exportMdBtn) {
    on(exportMdBtn as HTMLElement, 'click', () => exportKnowledge('md', props));
  }

  const exportJsonBtn = panel.querySelector('#export-json-btn');
  if (exportJsonBtn) {
    on(exportJsonBtn as HTMLElement, 'click', () => exportKnowledge('json', props));
  }

  const regenerateBtn = panel.querySelector('#regenerate-btn');
  if (regenerateBtn) {
    on(regenerateBtn as HTMLElement, 'click', () => regenerateKnowledge(panel));
  }

  const synthesizeBtn = panel.querySelector('#synthesize-btn');
  if (synthesizeBtn) {
    on(synthesizeBtn as HTMLElement, 'click', () => synthesizeFacts(panel));
  }

  // Load status
  loadStatus(panel);

  return panel;
}

/**
 * Load embedding status
 */
async function loadStatus(panel: HTMLElement): Promise<void> {
  const container = panel.querySelector('#knowledge-status') as HTMLElement;

  try {
    const status = await knowledgeService.getStatus();
    renderStatus(container, status);
  } catch {
    container.innerHTML = '<div class="error">Failed to load status</div>';
  }
}

/**
 * Render status
 */
function renderStatus(container: HTMLElement, status: EmbeddingStatus): void {
  container.innerHTML = `
    <div class="status-grid">
      <div class="status-item">
        <span class="status-label">Documents Embedded</span>
        <span class="status-value">${status.embedded}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Total Chunks</span>
        <span class="status-value">${status.totalChunks}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Embedding Model</span>
        <span class="status-value">${status.model || 'Default'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Last Updated</span>
        <span class="status-value">${status.lastUpdated ? formatDate(status.lastUpdated) : 'Never'}</span>
      </div>
    </div>
    ${status.available_embedding_models && status.available_embedding_models.length > 0 ? `
      <div class="available-models">
        <h5>Available Models</h5>
        <div class="model-list">
          ${status.available_embedding_models.map((model: string) => `
            <span class="model-badge">${model}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Export knowledge base
 */
async function exportKnowledge(format: 'md' | 'json', props: KnowledgePanelProps): Promise<void> {
  if (props.onExport) {
    props.onExport(format);
    return;
  }

  try {
    if (format === 'md') {
      await knowledgeService.exportMarkdown();
    } else {
      await knowledgeService.exportJson();
    }
    toast.success(`Knowledge base exported as ${format.toUpperCase()}`);
  } catch {
    toast.error('Failed to export knowledge base');
  }
}

/**
 * Regenerate knowledge files
 */
async function regenerateKnowledge(panel: HTMLElement): Promise<void> {
  if (!confirm('This will regenerate all knowledge files. Continue?')) return;

  const btn = panel.querySelector('#regenerate-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Regenerating...';

  try {
    await knowledgeService.regenerate();
    toast.success('Knowledge files regenerated');
    loadStatus(panel);
  } catch {
    toast.error('Failed to regenerate knowledge files');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Regenerate Files';
  }
}

/**
 * Synthesize facts
 */
async function synthesizeFacts(panel: HTMLElement): Promise<void> {
  if (!confirm('This will consolidate and synthesize facts using AI. This may take a while. Continue?')) return;

  const btn = panel.querySelector('#synthesize-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Synthesizing...';

  try {
    await knowledgeService.synthesize();
    toast.success('Facts synthesized');
    loadStatus(panel);
  } catch {
    toast.error('Failed to synthesize facts');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Synthesize Facts';
  }
}

/**
 * Format date
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

export default createKnowledgePanel;
