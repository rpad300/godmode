/**
 * Toast Container Component
 * Visual container for toast notifications
 */

import { createElement, on } from '../utils/dom';

export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastContainerProps {
  position?: ToastPosition;
  maxToasts?: number;
}

let containerInstance: HTMLElement | null = null;

/**
 * Get or create toast container
 */
export function getToastContainer(props: ToastContainerProps = {}): HTMLElement {
  if (containerInstance) {
    return containerInstance;
  }

  const position = props.position || 'bottom-right';
  const container = createElement('div', {
    className: `toast-container toast-${position}`,
  });

  // Container uses CSS classes for position (toast-container.toast-{position} in layout.css)

  document.body.appendChild(container);
  containerInstance = container;

  return container;
}

/**
 * Create a toast element
 */
export function createToastElement(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration = 3000
): HTMLElement {
  const toast = createElement('div', {
    className: `toast toast-${type} fade-in`,
  });

  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  // Click to dismiss
  on(toast, 'click', () => {
    dismissToast(toast);
  });

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }

  return toast;
}

/**
 * Dismiss a toast with animation
 */
function dismissToast(toast: HTMLElement): void {
  toast.classList.add('toast-dismiss');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

/**
 * Show a toast notification
 */
export function showToastInContainer(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration = 3000
): HTMLElement {
  const container = getToastContainer();
  const toast = createToastElement(message, type, duration);
  container.appendChild(toast);
  return toast;
}

export default getToastContainer;
