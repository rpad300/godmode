/**
 * Modal Component
 * Reusable modal dialog
 */

import { createElement, on, addClass, removeClass, show, hide } from '../utils/dom';
import { uiStore } from '../stores/ui';
import { shortcuts } from '../services/shortcuts';

export interface ModalProps {
  id: string;
  title: string;
  content?: string | HTMLElement;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  footer?: HTMLElement | null;
}

// Store active modals
const activeModals: Map<string, HTMLElement> = new Map();

/**
 * Create modal element
 */
export function createModal(props: ModalProps): HTMLElement {
  const {
    id,
    title,
    content,
    size = 'md',
    closable = true,
    onClose,
    onOpen,
    footer,
  } = props;

  // Backdrop
  const modal = createElement('div', {
    className: `modal modal-${size}`,
  });
  modal.setAttribute('data-modal-id', id);

  // Content wrapper
  const modalContent = createElement('div', { className: 'modal-content' });

  // Header
  const header = createElement('div', { className: 'modal-header' });
  header.innerHTML = `<h3>${title}</h3>`;

  if (closable) {
    const closeBtn = createElement('button', {
      className: 'modal-close',
      innerHTML: '×',
    });
    on(closeBtn, 'click', () => closeModal(id));
    header.appendChild(closeBtn);
  }

  // Body
  const body = createElement('div', { className: 'modal-body' });
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content) {
    body.appendChild(content);
  }

  // Footer
  const footerEl = footer || createElement('div', { className: 'modal-footer' });

  // Assemble
  modalContent.appendChild(header);
  modalContent.appendChild(body);
  if (footer !== null) {
    modalContent.appendChild(footerEl);
  }
  modal.appendChild(modalContent);

  // Click backdrop to close
  if (closable) {
    on(modal, 'click', (e) => {
      if (e.target === modal) {
        closeModal(id);
      }
    });
  }

  // Store reference
  activeModals.set(id, modal);

  return modal;
}

/**
 * Open a modal by ID
 */
export function openModal(id: string): void {
  const modal = activeModals.get(id) || document.querySelector(`[data-modal-id="${id}"]`) as HTMLElement;
  if (!modal) {
    console.warn(`Modal not found: ${id}`);
    return;
  }

  addClass(modal, 'open');
  document.body.classList.add('modal-open');

  // Update UI store
  uiStore.openModal(id);

  // Focus first input
  setTimeout(() => {
    const firstInput = modal.querySelector('input, textarea, select, button') as HTMLElement;
    firstInput?.focus();
  }, 100);
}

/**
 * Close a modal by ID
 */
export function closeModal(id: string): void {
  const modal = activeModals.get(id) || document.querySelector(`[data-modal-id="${id}"]`) as HTMLElement;
  if (!modal) return;

  removeClass(modal, 'open');
  document.body.classList.remove('modal-open');

  // Update UI store
  uiStore.closeModal();
}

/**
 * Close all open modals
 */
export function closeAllModals(): void {
  activeModals.forEach((_, id) => closeModal(id));
}

/**
 * Check if modal is open
 */
export function isModalOpen(id: string): boolean {
  const modal = activeModals.get(id);
  return modal?.classList.contains('open') || false;
}

/**
 * Update modal content
 */
export function updateModalContent(id: string, content: string | HTMLElement): void {
  const modal = activeModals.get(id);
  if (!modal) return;

  const body = modal.querySelector('.modal-body');
  if (!body) return;

  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.innerHTML = '';
    body.appendChild(content);
  }
}

/**
 * Update modal title
 */
export function updateModalTitle(id: string, title: string): void {
  const modal = activeModals.get(id);
  if (!modal) return;

  const titleEl = modal.querySelector('.modal-header h3');
  if (titleEl) {
    titleEl.textContent = title;
  }
}

/**
 * Create and show a confirm dialog
 */
export function confirm(
  message: string,
  options: {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: string;
  } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const {
      title = 'Confirm',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmClass = 'btn-primary',
    } = options;

    const id = `confirm-${Date.now()}`;

    const footer = createElement('div', { className: 'modal-footer' });

    const cancelBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: cancelText,
    });

    const confirmBtn = createElement('button', {
      className: `btn ${confirmClass}`,
      textContent: confirmText,
    });

    on(cancelBtn, 'click', () => {
      closeModal(id);
      modal.remove();
      activeModals.delete(id);
      resolve(false);
    });

    on(confirmBtn, 'click', () => {
      closeModal(id);
      modal.remove();
      activeModals.delete(id);
      resolve(true);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    const modal = createModal({
      id,
      title,
      content: `<p>${message}</p>`,
      size: 'sm',
      closable: true,
      onClose: () => resolve(false),
      footer,
    });

    document.body.appendChild(modal);
    openModal(id);
  });
}

/**
 * Create and show an alert dialog
 */
export function alert(message: string, title = 'Alert'): Promise<void> {
  return new Promise((resolve) => {
    const id = `alert-${Date.now()}`;

    const footer = createElement('div', { className: 'modal-footer' });

    const okBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'OK',
    });

    on(okBtn, 'click', () => {
      closeModal(id);
      modal.remove();
      activeModals.delete(id);
      resolve();
    });

    footer.appendChild(okBtn);

    const modal = createModal({
      id,
      title,
      content: `<p>${message}</p>`,
      size: 'sm',
      closable: true,
      onClose: () => resolve(),
      footer,
    });

    document.body.appendChild(modal);
    openModal(id);
  });
}

/**
 * Create and show a prompt dialog
 */
export function prompt(
  message: string,
  options: {
    title?: string;
    placeholder?: string;
    defaultValue?: string;
  } = {}
): Promise<string | null> {
  return new Promise((resolve) => {
    const id = `prompt-${Date.now()}`;
    const { title = 'Input', placeholder = '', defaultValue = '' } = options;

    const content = createElement('div', { className: 'prompt-content' });
    content.innerHTML = `
      <p>${message}</p>
      <input type="text" class="prompt-input gm-w-full gm-p-2 gm-mt-2" placeholder="${placeholder}" value="${defaultValue}">
    `;

    const footer = createElement('div', { className: 'modal-footer' });

    const cancelBtn = createElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Cancel',
    });

    const okBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'OK',
    });

    on(cancelBtn, 'click', () => {
      closeModal(id);
      modal.remove();
      activeModals.delete(id);
      resolve(null);
    });

    on(okBtn, 'click', () => {
      const input = modal.querySelector('.prompt-input') as HTMLInputElement;
      const value = input?.value || '';
      closeModal(id);
      modal.remove();
      activeModals.delete(id);
      resolve(value);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);

    const modal = createModal({
      id,
      title,
      content,
      size: 'sm',
      closable: true,
      onClose: () => resolve(null),
      footer,
    });

    document.body.appendChild(modal);
    openModal(id);

    // Focus input after modal opens
    setTimeout(() => {
      const input = modal.querySelector('.prompt-input') as HTMLInputElement;
      input?.focus();
    }, 100);
  });
}

// Register Escape key to close modals
shortcuts.register({
  key: 'Escape',
  description: 'Close modal',
  handler: () => {
    const state = uiStore.getState();
    if (state.modalOpen) {
      closeModal(state.modalOpen);
    }
  },
});

export default createModal;
