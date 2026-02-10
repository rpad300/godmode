/**
 * Toast Notification Service
 * Displays temporary notification messages
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const defaultOptions: ToastOptions = {
  duration: 3000,
  position: 'bottom-right',
};

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'success',
  options: ToastOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };
  
  // Create toast element
  const toast = document.createElement('div');
  const pos = opts.position || 'bottom-right';
  toast.className = `toast toast-${type} toast--${pos} fade-in`;
  toast.textContent = message;

  // Add to DOM
  document.body.appendChild(toast);

  // Remove after duration
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, opts.duration);
}

/**
 * Show success toast
 */
export function success(message: string, options?: ToastOptions): void {
  showToast(message, 'success', options);
}

/**
 * Show error toast
 */
export function error(message: string, options?: ToastOptions): void {
  showToast(message, 'error', options);
}

/**
 * Show warning toast
 */
export function warning(message: string, options?: ToastOptions): void {
  showToast(message, 'warning', options);
}

/**
 * Show info toast
 */
export function info(message: string, options?: ToastOptions): void {
  showToast(message, 'info', options);
}

// Export as namespace for convenience
export const toast = {
  show: showToast,
  success,
  error,
  warning,
  info,
};
