/**
 * Fact Modal
 * CRUD modal for facts
 */

import { createModal, openModal, closeModal } from '@components/Modal';
import { createElement, on } from '@lib/dom';
import { factsService, Fact, CreateFactRequest } from '@services/facts';
import { toast } from '@services/toast';

const MODAL_ID = 'fact-modal';

export interface FactModalProps {
  mode: 'view' | 'create' | 'edit';
  fact?: Fact;
  onSave?: (fact: Fact) => void;
  onDelete?: (factId: string | number) => void;
  onClose?: () => void;
}

let currentProps: FactModalProps = { mode: 'create' };

/**
 * Show fact modal
 */
export function showFactModal(props: FactModalProps): void {
  currentProps = props;

  const title = props.mode === 'create'
    ? 'Add Fact'
    : props.mode === 'edit'
      ? 'Edit Fact'
      : 'View Fact';

  const modal = createModal({
    id: MODAL_ID,
    title,
    size: 'md',
    content: createModalContent(props),
    onClose: props.onClose,
  });

  document.body.appendChild(modal);
  openModal(MODAL_ID);
}

/**
 * Create modal content
 */
function createModalContent(props: FactModalProps): HTMLElement {
  const container = createElement('div', { className: 'fact-modal-content' });
  const fact = props.fact;
  const isViewMode = props.mode === 'view';

  container.innerHTML = `
    <form id="fact-form" class="fact-form">
      <div class="form-group">
        <label for="content">Fact Content *</label>
        <textarea id="content" name="content" rows="4" required 
                  ${isViewMode ? 'disabled' : ''}
                  placeholder="Enter the fact...">${escapeHtml(fact?.content || '')}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="source">Source</label>
          <input type="text" id="source" name="source" 
                 ${isViewMode ? 'disabled' : ''}
                 value="${escapeHtml(fact?.source || '')}"
                 placeholder="Document, conversation, etc.">
        </div>
        <div class="form-group">
          <label for="category">Category</label>
          <input type="text" id="category" name="category" 
                 ${isViewMode ? 'disabled' : ''}
                 value="${escapeHtml(fact?.category || '')}"
                 placeholder="Technical, Business, etc.">
        </div>
      </div>

      ${fact?.verified ? `
        <div class="verified-info">
          <span class="verified-badge">✓ Verified</span>
          ${fact.verified_by ? `<span>by ${escapeHtml(fact.verified_by)}</span>` : ''}
          ${fact.verified_at ? `<span>on ${formatDate(fact.verified_at)}</span>` : ''}
        </div>
      ` : ''}

      ${fact?.source_file ? `
        <div class="source-file">
          <span class="label">Source File:</span>
          <span class="value">${escapeHtml(fact.source_file)}</span>
        </div>
      ` : ''}

      ${fact ? `
        <div class="metadata">
          <span>Created: ${formatDate(fact.created_at)}</span>
          ${fact.updated_at ? `<span>Updated: ${formatDate(fact.updated_at)}</span>` : ''}
        </div>
      ` : ''}

      <div class="form-actions">
        ${props.mode === 'view' ? `
          <button type="button" class="btn btn-secondary" id="edit-btn">Edit</button>
          ${!fact?.verified ? `<button type="button" class="btn btn-success" id="verify-btn">Verify</button>` : ''}
          <button type="button" class="btn btn-danger" id="delete-btn">Delete</button>
        ` : `
          <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary">
            ${props.mode === 'create' ? 'Add Fact' : 'Save Changes'}
          </button>
        `}
      </div>
    </form>
  `;

  bindEvents(container, props);
  return container;
}

/**
 * Bind event handlers
 */
function bindEvents(container: HTMLElement, props: FactModalProps): void {
  const form = container.querySelector('#fact-form') as HTMLFormElement;

  // Form submit
  if (form) {
    on(form, 'submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data: CreateFactRequest = {
        content: formData.get('content') as string,
        source: formData.get('source') as string || undefined,
        category: formData.get('category') as string || undefined,
      };

      if (!data.content.trim()) {
        toast.error('Fact content is required');
        return;
      }

      try {
        let savedFact: Fact;

        if (props.mode === 'create') {
          savedFact = await factsService.create(data);
          toast.success('Fact added');
        } else {
          savedFact = await factsService.update(props.fact!.id, data);
          toast.success('Fact updated');
        }

        closeModal(MODAL_ID);
        props.onSave?.(savedFact);
      } catch {
        toast.error('Failed to save fact');
      }
    });
  }

  // Cancel button
  const cancelBtn = container.querySelector('#cancel-btn');
  if (cancelBtn) {
    on(cancelBtn as HTMLElement, 'click', () => {
      closeModal(MODAL_ID);
    });
  }

  // Edit button (in view mode)
  const editBtn = container.querySelector('#edit-btn');
  if (editBtn) {
    on(editBtn as HTMLElement, 'click', () => {
      closeModal(MODAL_ID);
      showFactModal({
        ...props,
        mode: 'edit',
      });
    });
  }

  // Verify button
  const verifyBtn = container.querySelector('#verify-btn');
  if (verifyBtn && props.fact) {
    on(verifyBtn as HTMLElement, 'click', async () => {
      try {
        const verifiedFact = await factsService.verify(props.fact!.id);
        toast.success('Fact verified');
        closeModal(MODAL_ID);
        props.onSave?.(verifiedFact);
      } catch {
        toast.error('Failed to verify fact');
      }
    });
  }

  // Delete button
  const deleteBtn = container.querySelector('#delete-btn');
  if (deleteBtn && props.fact) {
    on(deleteBtn as HTMLElement, 'click', async () => {
      if (!confirm('Are you sure you want to delete this fact?')) return;

      try {
        await factsService.delete(props.fact!.id);
        toast.success('Fact deleted');
        closeModal(MODAL_ID);
        props.onDelete?.(props.fact!.id);
      } catch {
        toast.error('Failed to delete fact');
      }
    });
  }
}

/**
 * Format date
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function closeFactModal(): void {
  closeModal(MODAL_ID);
}
