/**
 * Project Assignment Modal
 * Assign a Krisp transcript to a project manually
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { toast } from '../../services/toast';
import { http } from '../../services/api';
import * as krispService from '../../services/krisp';
import type { KrispTranscript, ProjectCandidate } from '../../services/krisp';

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
    </style>
    
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

  // Load projects and render
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
