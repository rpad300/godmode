/**
 * Processing Modal Component
 * Shows progress for file processing operations
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal, updateModalContent } from '../Modal';

const MODAL_ID = 'processing-modal';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  message?: string;
}

export interface ProcessingModalProps {
  title?: string;
  steps?: ProcessingStep[];
  onCancel?: () => void;
  allowCancel?: boolean;
}

let currentSteps: ProcessingStep[] = [];
let cancelCallback: (() => void) | undefined;

/**
 * Show processing modal
 */
export function showProcessingModal(props: ProcessingModalProps = {}): void {
  const {
    title = 'Processing',
    steps = [],
    onCancel,
    allowCancel = true,
  } = props;

  currentSteps = steps;
  cancelCallback = onCancel;

  // Remove existing modal if any
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'processing-content' });
  renderContent(content);

  const footer = allowCancel ? createFooter() : null;

  const modal = createModal({
    id: MODAL_ID,
    title,
    content,
    size: 'md',
    closable: false,
    footer,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Render processing content
 */
function renderContent(container: HTMLElement): void {
  container.innerHTML = `
    <div class="processing-steps">
      ${currentSteps.map(step => renderStep(step)).join('')}
    </div>
    <div class="processing-overall">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${calculateOverallProgress()}%"></div>
      </div>
      <div class="progress-text">${calculateOverallProgress()}% complete</div>
    </div>
  `;
}

/**
 * Render a single step
 */
function renderStep(step: ProcessingStep): string {
  const statusIcon = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    error: '❌',
  }[step.status];

  const statusClass = step.status;

  return `
    <div class="processing-step ${statusClass}" data-step-id="${step.id}">
      <span class="step-icon">${statusIcon}</span>
      <div class="step-content">
        <div class="step-label">${step.label}</div>
        ${step.message ? `<div class="step-message">${step.message}</div>` : ''}
        ${step.status === 'running' && step.progress !== undefined ? `
          <div class="step-progress">
            <div class="progress-bar small">
              <div class="progress-fill" style="width: ${step.progress}%"></div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Calculate overall progress
 */
function calculateOverallProgress(): number {
  if (currentSteps.length === 0) return 0;

  const completed = currentSteps.filter(s => s.status === 'completed').length;
  const running = currentSteps.find(s => s.status === 'running');
  const runningProgress = running?.progress || 0;

  return Math.round(
    ((completed + (running ? runningProgress / 100 : 0)) / currentSteps.length) * 100
  );
}

/**
 * Create footer with cancel button
 */
function createFooter(): HTMLElement {
  const footer = createElement('div', { className: 'modal-footer' });

  const cancelBtn = createElement('button', {
    className: 'btn btn-secondary',
    textContent: 'Cancel',
  });

  on(cancelBtn, 'click', () => {
    cancelCallback?.();
    closeProcessingModal();
  });

  footer.appendChild(cancelBtn);
  return footer;
}

/**
 * Update processing step
 */
export function updateProcessingStep(
  stepId: string,
  updates: Partial<ProcessingStep>
): void {
  const stepIndex = currentSteps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) return;

  currentSteps[stepIndex] = { ...currentSteps[stepIndex], ...updates };

  // Re-render
  const modal = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (modal) {
    const content = modal.querySelector('.processing-content');
    if (content) {
      renderContent(content as HTMLElement);
    }
  }
}

/**
 * Add a new step
 */
export function addProcessingStep(step: ProcessingStep): void {
  currentSteps.push(step);

  const modal = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (modal) {
    const content = modal.querySelector('.processing-content');
    if (content) {
      renderContent(content as HTMLElement);
    }
  }
}

/**
 * Set all steps at once
 */
export function setProcessingSteps(steps: ProcessingStep[]): void {
  currentSteps = steps;

  const modal = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (modal) {
    const content = modal.querySelector('.processing-content');
    if (content) {
      renderContent(content as HTMLElement);
    }
  }
}

/**
 * Close processing modal
 */
export function closeProcessingModal(): void {
  closeModal(MODAL_ID);
  currentSteps = [];
  cancelCallback = undefined;
}

/**
 * Check if processing modal is open
 */
export function isProcessingModalOpen(): boolean {
  const modal = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  return modal?.classList.contains('open') || false;
}

export default showProcessingModal;
