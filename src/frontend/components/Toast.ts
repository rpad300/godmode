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

  // Position styles
  const positionStyles: Record<string, string> = {
    'top-right': 'top: 20px; right: 20px;',
    'top-left': 'top: 20px; left: 20px;',
    'bottom-right': 'bottom: 20px; right: 20px;',
    'bottom-left': 'bottom: 20px; left: 20px;',
    'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
    'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);',
  };

  container.style.cssText = `
    position: fixed;
    ${positionStyles[position]}
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
    pointer-events: none;
  `;

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

  const colors: Record<string, string> = {
    success: 'var(--success)',
    error: 'var(--error)',
    warning: 'var(--warning)',
    info: 'var(--accent)',
  };

  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: ${colors[type]};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-size: 14px;
    pointer-events: auto;
    cursor: pointer;
    animation: slideInRight 0.3s ease;
  `;

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
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  toast.style.transition = 'all 0.3s ease';

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
