/**
 * Create Sprint Modal
 * Create sprint, generate tasks from emails/transcripts, preview and apply
 */

import { createElement, on } from '../../utils/dom';
import { createModal, openModal, closeModal } from '../Modal';
import { createSprint, generateSprintTasks, applySprintGeneration, ProposedTask, Sprint } from '../../services/sprints';
import { toast } from '../../services/toast';

const MODAL_ID = 'create-sprint-modal';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export interface CreateSprintModalProps {
  onSuccess?: (sprint: Sprint) => void;
}

export function showCreateSprintModal(props: CreateSprintModalProps = {}): void {
  const { onSuccess } = props;
  const existing = document.querySelector(`[data-modal-id="${MODAL_ID}"]`);
  if (existing) existing.remove();

  const content = createElement('div', { className: 'create-sprint-modal-content' });
  content.innerHTML = `
    <form id="create-sprint-form" class="create-sprint-form">
      <div class="form-group">
        <label for="sprint-name">Sprint name *</label>
        <input type="text" id="sprint-name" required placeholder="e.g. Sprint 12">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sprint-start">Start date *</label>
          <input type="date" id="sprint-start" required>
        </div>
        <div class="form-group">
          <label for="sprint-end">End date *</label>
          <input type="date" id="sprint-end" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sprint-analysis-start">Analysis period start</label>
          <input type="date" id="sprint-analysis-start" title="From when to consider emails/transcripts">
        </div>
        <div class="form-group">
          <label for="sprint-analysis-end">Analysis period end</label>
          <input type="date" id="sprint-analysis-end" title="Until when to consider emails/transcripts">
        </div>
      </div>
      <div class="form-group">
        <label for="sprint-context">Sprint context / goals</label>
        <textarea id="sprint-context" rows="3" placeholder="What is the focus of this sprint? Goals, priorities..."></textarea>
      </div>
    </form>
    <div id="create-sprint-step2" class="create-sprint-preview hidden">
      <p class="create-sprint-preview-intro">Review proposed tasks and existing actions to link. Then click Apply.</p>
      <div class="form-group">
        <label>New tasks to create</label>
        <div id="create-sprint-new-tasks-list" class="create-sprint-tasks-list"></div>
      </div>
      <div class="form-group">
        <label>Existing actions to add to this sprint</label>
        <div id="create-sprint-existing-list" class="create-sprint-existing-list"></div>
      </div>
    </div>
  `;

  const footer = createElement('div', { className: 'modal-footer' });
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" id="create-sprint-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-primary" id="create-sprint-generate-btn">Create Sprint & Generate Tasks</button>
    <button type="button" class="btn btn-primary hidden" id="create-sprint-apply-btn">Apply</button>
  `;

  const modal = createModal({
    id: MODAL_ID,
    title: 'Create Sprint',
    content,
    size: 'lg',
    closable: true,
    footer,
    onClose: () => {},
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);

  let createdSprint: Sprint | null = null;
  let proposedNewTasks: ProposedTask[] = [];
  let existingActionIds: string[] = [];
  const existingCheckboxes: Map<string, HTMLInputElement> = new Map();

  const getVal = (id: string) => (content.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement)?.value?.trim() || '';
  const form = content.querySelector('#create-sprint-form') as HTMLFormElement;
  const step2 = content.querySelector('#create-sprint-step2') as HTMLElement;
  const generateBtn = content.querySelector('#create-sprint-generate-btn') as HTMLButtonElement;
  const applyBtn = content.querySelector('#create-sprint-apply-btn') as HTMLButtonElement;
  const cancelBtn = content.querySelector('#create-sprint-cancel-btn') as HTMLButtonElement;

  on(cancelBtn, 'click', () => closeModal(MODAL_ID));

  on(generateBtn, 'click', async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const name = getVal('sprint-name');
    const start_date = getVal('sprint-start');
    const end_date = getVal('sprint-end');
    if (new Date(end_date) < new Date(start_date)) {
      toast.error('End date must be after start date');
      return;
    }
    generateBtn.disabled = true;
    generateBtn.textContent = 'Creating...';
    try {
      createdSprint = await createSprint({
        name,
        start_date,
        end_date,
        context: getVal('sprint-context') || undefined,
        analysis_start_date: getVal('sprint-analysis-start') || undefined,
        analysis_end_date: getVal('sprint-analysis-end') || undefined,
      });
      generateBtn.textContent = 'Generating tasks...';
      const result = await generateSprintTasks(createdSprint.id, {
        analysis_start_date: getVal('sprint-analysis-start') || undefined,
        analysis_end_date: getVal('sprint-analysis-end') || undefined,
      });
      proposedNewTasks = result.proposed_new_tasks || [];
      existingActionIds = result.existing_action_ids || [];
      const existingDetails = result.existing_details || [];

      form.classList.add('hidden');
      step2.classList.remove('hidden');
      generateBtn.classList.add('hidden');
      applyBtn.classList.remove('hidden');

      const newList = content.querySelector('#create-sprint-new-tasks-list') as HTMLElement;
      newList.innerHTML = proposedNewTasks.length
        ? proposedNewTasks.map((t, i) => `
          <div class="create-sprint-task-item" data-index="${i}">
            <div class="create-sprint-task-title">${escapeHtml((t.task || '').slice(0, 120))}${(t.task || '').length > 120 ? '…' : ''}</div>
            ${t.size_estimate ? `<span class="create-sprint-task-size">${escapeHtml(t.size_estimate)}</span>` : ''}
          </div>
        `).join('')
        : '<p class="text-muted">No new tasks suggested.</p>';

      const existingList = content.querySelector('#create-sprint-existing-list') as HTMLElement;
      existingCheckboxes.clear();
      if (existingDetails.length) {
        existingList.innerHTML = existingDetails.map((a) => {
          const checked = existingActionIds.includes(a.id);
          return `
            <label class="create-sprint-existing-item">
              <input type="checkbox" data-action-id="${a.id}" ${checked ? 'checked' : ''}>
              <span>${escapeHtml((a.task || '').slice(0, 80))}${(a.task || '').length > 80 ? '…' : ''}</span>
              <span class="create-sprint-existing-status">${escapeHtml(a.status || '')}</span>
            </label>
          `;
        }).join('');
        existingList.querySelectorAll('input[type=checkbox]').forEach((cb) => {
          existingCheckboxes.set((cb as HTMLInputElement).dataset.actionId!, cb as HTMLInputElement);
        });
      } else {
        existingList.innerHTML = '<p class="text-muted">No existing actions suggested.</p>';
      }
      toast.success('Sprint created. Review and click Apply to add tasks.');
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Create Sprint & Generate Tasks';
    }
  });

  on(applyBtn, 'click', async () => {
    if (!createdSprint) return;
    const selectedExisting = Array.from(existingCheckboxes.entries())
      .filter(([, el]) => el.checked)
      .map(([id]) => id);
    applyBtn.disabled = true;
    applyBtn.textContent = 'Applying...';
    try {
      await applySprintGeneration(createdSprint.id, {
        new_tasks: proposedNewTasks,
        existing_action_ids: selectedExisting,
      });
      toast.success('Sprint applied. New tasks created and existing actions linked.');
      closeModal(MODAL_ID);
      onSuccess?.(createdSprint);
    } catch (e) {
      toast.error((e as Error).message || 'Apply failed');
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }
  });
}
