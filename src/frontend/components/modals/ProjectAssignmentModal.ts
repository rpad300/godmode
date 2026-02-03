/**
 * Project Assignment Modal
 * Assign a Krisp transcript to a project manually
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { toast } from '../../services/toast';
import { http } from '../../services/api';
import * as krispService from '../../services/krisp';
import type { KrispTranscript, ProjectCandidate, TranscriptSummary } from '../../services/krisp';

const MODAL_ID = 'project-assignment-modal';

interface Project {
  id: string;
  name: string;
  project_number?: string;
}

export interface ProjectAssignmentModalProps {
  transcript: KrispTranscript;
  onAssign?: () => void;
  onClose?: () => void;
}

let currentProps: ProjectAssignmentModalProps | null = null;
let userProjects: Project[] = [];

/**
 * Show project assignment modal
 */
export async function showProjectAssignmentModal(props: ProjectAssignmentModalProps): Promise<void> {
  currentProps = props;
  const { transcript } = props;

  // Remove existing modal
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'project-assignment' });

  content.innerHTML = `
    <style>
      .project-assignment {
        padding: 16px 0;
      }
      .assignment-info {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--bg-secondary, #f8fafc);
        border-radius: 8px;
      }
      .assignment-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text-primary, #1e293b);
      }
      .assignment-reason {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f59e0b;
        font-size: 14px;
        margin-bottom: 12px;
      }
      .assignment-reason svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }
      .speakers-list {
        font-size: 13px;
        color: var(--text-secondary, #64748b);
      }
      .speakers-list strong {
        color: var(--text-primary, #1e293b);
      }
      .candidates-section {
        margin-bottom: 24px;
      }
      .candidates-section h4 {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 12px;
        color: var(--text-secondary, #64748b);
      }
      .candidate-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .candidate-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 2px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .candidate-item:hover {
        border-color: var(--primary-light, #fda4af);
        background: var(--bg-secondary, #f8fafc);
      }
      .candidate-item.selected {
        border-color: var(--primary, #e11d48);
        background: #fef2f2;
      }
      .candidate-radio {
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-color, #e2e8f0);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .candidate-item.selected .candidate-radio {
        border-color: var(--primary, #e11d48);
      }
      .candidate-item.selected .candidate-radio::after {
        content: '';
        width: 10px;
        height: 10px;
        background: var(--primary, #e11d48);
        border-radius: 50%;
      }
      .candidate-info {
        flex: 1;
      }
      .candidate-name {
        font-weight: 500;
        color: var(--text-primary, #1e293b);
      }
      .candidate-code {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
      }
      .candidate-confidence {
        font-size: 13px;
        padding: 4px 10px;
        background: var(--bg-tertiary, #f1f5f9);
        border-radius: 12px;
        color: var(--text-secondary, #64748b);
      }
      .project-select-section {
        margin-bottom: 24px;
      }
      .project-select-section h4 {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 12px;
        color: var(--text-secondary, #64748b);
      }
      .project-select {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        font-size: 14px;
        background: white;
      }
      .action-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color, #e2e8f0);
      }
      .btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      .btn-secondary {
        background: var(--bg-secondary, #f1f5f9);
        color: var(--text-primary, #1e293b);
      }
      .btn-secondary:hover {
        background: var(--bg-tertiary, #e2e8f0);
      }
      .btn-primary {
        background: var(--primary, #e11d48);
        color: white;
      }
      .btn-primary:hover {
        opacity: 0.9;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-danger {
        background: transparent;
        color: #dc2626;
        border: 1px solid #dc2626;
      }
      .btn-danger:hover {
        background: #fef2f2;
      }
      [data-theme="dark"] .assignment-info {
        background: rgba(30,41,59,0.5);
      }
      [data-theme="dark"] .candidate-item.selected {
        background: rgba(225,29,72,0.1);
      }
      [data-theme="dark"] .project-select {
        background: rgba(30,41,59,0.8);
        color: white;
      }
      
      /* Meeting Summary Styles */
      .meeting-summary {
        margin-bottom: 24px;
        padding: 16px;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 12px;
        border: 1px solid #bae6fd;
      }
      [data-theme="dark"] .meeting-summary {
        background: linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(56,189,248,0.05) 100%);
        border-color: rgba(56,189,248,0.2);
      }
      .summary-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-weight: 600;
        color: #0369a1;
      }
      [data-theme="dark"] .summary-header {
        color: #38bdf8;
      }
      .summary-header svg {
        width: 18px;
        height: 18px;
      }
      .summary-topic {
        font-size: 15px;
        color: var(--text-primary, #1e293b);
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .summary-section {
        margin-bottom: 12px;
      }
      .summary-section:last-child {
        margin-bottom: 0;
      }
      .summary-section-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: #0369a1;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }
      [data-theme="dark"] .summary-section-title {
        color: #7dd3fc;
      }
      .summary-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .summary-list li {
        position: relative;
        padding-left: 16px;
        font-size: 13px;
        color: var(--text-secondary, #475569);
        margin-bottom: 4px;
        line-height: 1.4;
      }
      .summary-list li::before {
        content: '•';
        position: absolute;
        left: 0;
        color: #0ea5e9;
      }
      .summary-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--text-secondary, #64748b);
        font-size: 14px;
      }
      .summary-loading .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e2e8f0;
        border-top-color: #0ea5e9;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .refresh-summary-btn {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: #0369a1;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .refresh-summary-btn:hover {
        background: rgba(3, 105, 161, 0.1);
      }
      [data-theme="dark"] .refresh-summary-btn {
        color: #38bdf8;
      }
      [data-theme="dark"] .refresh-summary-btn:hover {
        background: rgba(56, 189, 248, 0.1);
      }
      .summary-source {
        font-size: 11px;
        color: var(--text-tertiary, #94a3b8);
        text-align: right;
        margin-top: 8px;
      }
    </style>
    
    <!-- Meeting Summary Section -->
    <div class="meeting-summary" id="meeting-summary">
      <div class="summary-loading">
        <div class="spinner"></div>
        <span>Generating meeting summary...</span>
      </div>
    </div>
    
    <div class="assignment-info">
      <div class="assignment-title">${escapeHtml(transcript.krisp_title || 'Untitled Meeting')}</div>
      ${transcript.status_reason ? `
        <div class="assignment-reason">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          ${escapeHtml(transcript.status_reason)}
        </div>
      ` : ''}
      <div class="speakers-list">
        <strong>Speakers:</strong> ${transcript.speakers?.join(', ') || 'None identified'}
      </div>
    </div>
    
    <div id="assignment-content">
      <div class="loading-spinner"></div>
    </div>
    
    <div class="action-buttons">
      <button type="button" class="btn btn-danger" id="skip-btn">Skip Transcript</button>
      <div style="flex: 1;"></div>
      <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button type="button" class="btn btn-primary" id="assign-btn" disabled>Assign to Project</button>
    </div>
  `;

  const modal = createModal({
    id: MODAL_ID,
    title: 'Assign to Project',
    content,
    size: 'md',
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  // Bind button events
  bindButtonEvents(content);

  // Load summary and projects in parallel
  loadMeetingSummary(content, transcript);
  await loadProjectOptions(content, transcript);
}

/**
 * Bind button events
 */
function bindButtonEvents(container: HTMLElement): void {
  const cancelBtn = container.querySelector('#cancel-btn');
  if (cancelBtn) {
    on(cancelBtn as HTMLElement, 'click', () => {
      closeModal(MODAL_ID);
      currentProps?.onClose?.();
    });
  }

  const skipBtn = container.querySelector('#skip-btn');
  if (skipBtn) {
    on(skipBtn as HTMLElement, 'click', async () => {
      if (!currentProps?.transcript) return;
      
      if (!confirm('Are you sure you want to skip this transcript? It will not be processed.')) return;

      const success = await krispService.skipTranscript(currentProps.transcript.id, 'Manually skipped');
      
      if (success) {
        toast.success('Transcript skipped');
        closeModal(MODAL_ID);
        currentProps?.onAssign?.();
      } else {
        toast.error('Failed to skip transcript');
      }
    });
  }

  const assignBtn = container.querySelector('#assign-btn');
  if (assignBtn) {
    on(assignBtn as HTMLElement, 'click', async () => {
      const selected = container.querySelector('.candidate-item.selected, .project-select') as HTMLElement;
      let projectId: string | null = null;

      // Check if a candidate is selected
      const selectedCandidate = container.querySelector('.candidate-item.selected');
      if (selectedCandidate) {
        projectId = selectedCandidate.getAttribute('data-project-id');
      } else {
        // Check the dropdown
        const selectEl = container.querySelector('.project-select') as HTMLSelectElement;
        if (selectEl?.value) {
          projectId = selectEl.value;
        }
      }

      if (!projectId || !currentProps?.transcript) {
        toast.error('Please select a project');
        return;
      }

      (assignBtn as HTMLButtonElement).disabled = true;
      assignBtn.textContent = 'Assigning...';

      const success = await krispService.assignProject(currentProps.transcript.id, projectId);

      if (success) {
        toast.success('Transcript assigned to project');
        closeModal(MODAL_ID);
        currentProps?.onAssign?.();
      } else {
        toast.error('Failed to assign project');
        (assignBtn as HTMLButtonElement).disabled = false;
        assignBtn.textContent = 'Assign to Project';
      }
    });
  }
}

/**
 * Load project options
 */
async function loadProjectOptions(container: HTMLElement, transcript: KrispTranscript): Promise<void> {
  const contentEl = container.querySelector('#assignment-content');
  if (!contentEl) return;

  try {
    // Load user's projects
    const response = await http.get<{ projects: Project[] }>('/api/projects');
    userProjects = response.data.projects || [];

    // Get candidates from transcript
    const candidates = transcript.project_candidates || [];

    let html = '';

    // Show candidates if available
    if (candidates.length > 0) {
      html += `
        <div class="candidates-section">
          <h4>Suggested Projects (based on speakers)</h4>
          <div class="candidate-list">
            ${candidates.map((c: ProjectCandidate) => `
              <div class="candidate-item" data-project-id="${c.projectId}">
                <div class="candidate-radio"></div>
                <div class="candidate-info">
                  <div class="candidate-name">${escapeHtml(c.projectName || 'Unknown')}</div>
                  <div class="candidate-code">${escapeHtml(c.projectNumber || '')}</div>
                </div>
                <div class="candidate-confidence">${Math.round(c.percentage * 100)}% match</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Show project dropdown for other projects
    html += `
      <div class="project-select-section">
        <h4>${candidates.length > 0 ? 'Or select another project' : 'Select a project'}</h4>
        <select class="project-select">
          <option value="">Choose a project...</option>
          ${userProjects.map(p => `
            <option value="${p.id}">${p.project_number ? `${p.project_number} - ` : ''}${escapeHtml(p.name)}</option>
          `).join('')}
        </select>
      </div>
    `;

    contentEl.innerHTML = html;

    // Bind candidate selection
    contentEl.querySelectorAll('.candidate-item').forEach(item => {
      on(item as HTMLElement, 'click', () => {
        // Deselect all
        contentEl.querySelectorAll('.candidate-item').forEach(i => i.classList.remove('selected'));
        // Select this one
        item.classList.add('selected');
        // Clear dropdown
        const select = contentEl.querySelector('.project-select') as HTMLSelectElement;
        if (select) select.value = '';
        // Enable assign button
        const assignBtn = container.querySelector('#assign-btn') as HTMLButtonElement;
        if (assignBtn) assignBtn.disabled = false;
      });
    });

    // Bind dropdown change
    const select = contentEl.querySelector('.project-select');
    if (select) {
      on(select as HTMLElement, 'change', () => {
        // Deselect candidates
        contentEl.querySelectorAll('.candidate-item').forEach(i => i.classList.remove('selected'));
        // Enable/disable assign button
        const assignBtn = container.querySelector('#assign-btn') as HTMLButtonElement;
        if (assignBtn) {
          assignBtn.disabled = !(select as HTMLSelectElement).value;
        }
      });
    }

  } catch (error) {
    console.error('[ProjectAssignmentModal] Error loading projects:', error);
    contentEl.innerHTML = '<p style="color: #dc2626;">Failed to load projects. Please try again.</p>';
  }
}

/**
 * Load and display meeting summary
 */
async function loadMeetingSummary(
  container: HTMLElement, 
  transcript: KrispTranscript,
  forceRegenerate = false
): Promise<void> {
  const summaryEl = container.querySelector('#meeting-summary');
  if (!summaryEl) return;

  // Show loading state
  if (forceRegenerate) {
    summaryEl.innerHTML = `
      <div class="summary-loading">
        <div class="spinner"></div>
        <span>Regenerating summary...</span>
      </div>
    `;
  }

  try {
    const summary = await krispService.generateSummary(transcript.id, { forceRegenerate });

    if (!summary) {
      summaryEl.innerHTML = `
        <div class="summary-header">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Meeting Summary
          <button class="refresh-summary-btn" title="Regenerate summary">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
        <p style="color: var(--text-secondary); font-size: 13px;">Unable to generate summary.</p>
      `;
      bindRefreshButton(container, transcript);
      return;
    }

    // Build summary HTML with refresh button
    let html = `
      <div class="summary-header">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span style="flex: 1;">Meeting Summary</span>
        <button class="refresh-summary-btn" title="Regenerate summary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
    `;

    // Topic/main subject
    if (summary.topic) {
      html += `<div class="summary-topic">${escapeHtml(summary.topic)}</div>`;
    } else if (summary.notes) {
      html += `<div class="summary-topic">${escapeHtml(summary.notes)}</div>`;
    }

    // Key Points
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      html += `
        <div class="summary-section">
          <div class="summary-section-title">Key Points</div>
          <ul class="summary-list">
            ${summary.keyPoints.slice(0, 5).map(point => `<li>${escapeHtml(String(point))}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Action Items
    if (summary.actionItems && summary.actionItems.length > 0) {
      html += `
        <div class="summary-section">
          <div class="summary-section-title">Action Items</div>
          <ul class="summary-list">
            ${summary.actionItems.slice(0, 5).map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Decisions
    if (summary.decisions && summary.decisions.length > 0) {
      html += `
        <div class="summary-section">
          <div class="summary-section-title">Decisions</div>
          <ul class="summary-list">
            ${summary.decisions.slice(0, 3).map(dec => `<li>${escapeHtml(String(dec))}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Next Steps
    if (summary.nextSteps) {
      html += `
        <div class="summary-section">
          <div class="summary-section-title">Next Steps</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">${escapeHtml(summary.nextSteps)}</p>
        </div>
      `;
    }

    // Source indicator
    const sourceLabels: Record<string, string> = {
      'krisp_metadata': 'From Krisp',
      'ai_generated': 'AI Generated',
      'excerpt_fallback': 'Excerpt',
      'no_content': ''
    };
    if (summary.source && sourceLabels[summary.source]) {
      html += `<div class="summary-source">${sourceLabels[summary.source]}</div>`;
    }

    summaryEl.innerHTML = html;
    
    // Bind refresh button
    bindRefreshButton(container, transcript);

  } catch (error) {
    console.error('[ProjectAssignmentModal] Summary error:', error);
    summaryEl.innerHTML = `
      <div class="summary-header">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span style="flex: 1;">Meeting Summary</span>
        <button class="refresh-summary-btn" title="Regenerate summary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
      <p style="color: var(--text-secondary); font-size: 13px;">Could not load summary.</p>
    `;
    bindRefreshButton(container, transcript);
  }
}

/**
 * Bind refresh summary button
 */
function bindRefreshButton(container: HTMLElement, transcript: KrispTranscript): void {
  const btn = container.querySelector('.refresh-summary-btn');
  if (btn) {
    on(btn as HTMLElement, 'click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await loadMeetingSummary(container, transcript, true);
      toast.success('Summary regenerated');
    });
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

/**
 * Close the modal
 */
export function closeProjectAssignmentModal(): void {
  closeModal(MODAL_ID);
}
