/**
 * Keyboard Utilities
 * Helper functions and constants for keyboard interactions
 */

/**
 * Keyboard key constants
 */
export const Keys = {
  Enter: 'Enter',
  Space: ' ',
  Escape: 'Escape',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Backspace: 'Backspace',
  Delete: 'Delete',
} as const;

/**
 * Command/Ctrl key detection (cross-platform)
 */
export function isModKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

/**
 * Check if key combination matches
 */
export function isHotkey(
  event: KeyboardEvent | React.KeyboardEvent,
  key: string,
  options: {
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    ctrl?: boolean;
  } = {}
): boolean {
  if (event.key.toLowerCase() !== key.toLowerCase()) return false;
  
  if (options.shift !== undefined && event.shiftKey !== options.shift) return false;
  if (options.alt !== undefined && event.altKey !== options.alt) return false;
  if (options.meta !== undefined && event.metaKey !== options.meta) return false;
  if (options.ctrl !== undefined && event.ctrlKey !== options.ctrl) return false;
  
  return true;
}

/**
 * Global keyboard event handler registry
 */
type KeyboardHandler = (event: KeyboardEvent) => void;

const handlers = new Map<string, KeyboardHandler>();

export function registerGlobalShortcut(
  key: string,
  handler: KeyboardHandler,
  options: {
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    ctrl?: boolean;
  } = {}
): () => void {
  const id = `${key}-${JSON.stringify(options)}`;
  
  const globalHandler = (event: KeyboardEvent) => {
    if (isHotkey(event, key, options)) {
      event.preventDefault();
      handler(event);
    }
  };
  
  handlers.set(id, globalHandler);
  window.addEventListener('keydown', globalHandler);
  
  // Return cleanup function
  return () => {
    const handler = handlers.get(id);
    if (handler) {
      window.removeEventListener('keydown', handler);
      handlers.delete(id);
    }
  };
}

/**
 * Focus next/previous element
 */
export function focusNextElement(currentElement: HTMLElement, direction: 'next' | 'previous' = 'next') {
  const focusableElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
  
  const currentIndex = focusableElements.indexOf(currentElement);
  
  if (currentIndex === -1) return;
  
  const nextIndex = direction === 'next'
    ? (currentIndex + 1) % focusableElements.length
    : (currentIndex - 1 + focusableElements.length) % focusableElements.length;
  
  focusableElements[nextIndex]?.focus();
}

/**
 * Handle arrow key navigation in a list
 */
export function handleArrowNavigation(
  event: KeyboardEvent | React.KeyboardEvent,
  options: {
    onUp?: () => void;
    onDown?: () => void;
    onLeft?: () => void;
    onRight?: () => void;
    onHome?: () => void;
    onEnd?: () => void;
  }
) {
  switch (event.key) {
    case Keys.ArrowUp:
      event.preventDefault();
      options.onUp?.();
      break;
    case Keys.ArrowDown:
      event.preventDefault();
      options.onDown?.();
      break;
    case Keys.ArrowLeft:
      event.preventDefault();
      options.onLeft?.();
      break;
    case Keys.ArrowRight:
      event.preventDefault();
      options.onRight?.();
      break;
    case Keys.Home:
      event.preventDefault();
      options.onHome?.();
      break;
    case Keys.End:
      event.preventDefault();
      options.onEnd?.();
      break;
  }
}
