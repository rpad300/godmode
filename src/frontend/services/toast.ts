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

const typeColors: Record<ToastType, string> = {
  success: 'var(--success)',
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--accent)',
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
  toast.className = 'toast fade-in';
  toast.style.cssText = `
    position: fixed;
    ${opts.position?.includes('bottom') ? 'bottom' : 'top'}: 20px;
    ${opts.position?.includes('right') ? 'right' : 'left'}: 20px;
    background: ${typeColors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    word-wrap: break-word;
  `;
  toast.textContent = message;
  
  // Add to DOM
  document.body.appendChild(toast);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
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
