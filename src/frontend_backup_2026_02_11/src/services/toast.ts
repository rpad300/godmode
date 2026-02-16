/**
 * SOTA Toast Service
 * Replaces basic alerts with a stacked, animated toast system
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ICONS = {
  success: `<svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
  error: `<svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
  warning: `<svg class="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
  info: `<svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
};

let container: HTMLElement | null = null;
const TOAST_LIMIT = 5;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export const toast = {
  show(message: string, type: ToastType = 'info', options: ToastOptions = {}) {
    const root = ensureContainer();
    const duration = options.duration || 4000;

    // Limit visible toasts
    if (root.children.length >= TOAST_LIMIT) {
      const first = root.firstElementChild;
      if (first) {
        first.classList.add('toast-leaving');
        setTimeout(() => first.remove(), 200);
      }
    }

    const el = document.createElement('div');
    el.className = `toast-sota ${type}`;
    el.innerHTML = `
      <div class="toast-icon">${ICONS[type]}</div>
      <div class="toast-content">
        ${options.title ? `<div class="toast-title">${options.title}</div>` : ''}
        <p class="toast-message">${message}</p>
      </div>
      <button class="toast-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;

    // Close Handler
    const closeBtn = el.querySelector('.toast-close');
    const close = () => {
      el.classList.add('toast-leaving');
      setTimeout(() => {
        if (el.parentElement) el.remove();
      }, 200);
    };
    closeBtn?.addEventListener('click', close);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(close, duration);
    }

    root.appendChild(el);
  },

  success(message: string, options?: ToastOptions) {
    this.show(message, 'success', options);
  },

  error(message: string, options?: ToastOptions) {
    this.show(message, 'error', options);
  },

  warning(message: string, options?: ToastOptions) {
    this.show(message, 'warning', options);
  },

  info(message: string, options?: ToastOptions) {
    this.show(message, 'info', options);
  }
};
