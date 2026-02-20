/**
 * Accessibility Utilities
 * Helper functions for accessible UI patterns
 */

/**
 * Generate a unique ID for form fields
 */
export function generateId(prefix: string = 'godmode'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Screen reader only styles (visually hidden but accessible)
 */
export const srOnlyStyles = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden' as const,
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  borderWidth: 0,
};

/**
 * Create accessible label association
 */
export function createLabelProps(id: string, label?: string) {
  return {
    id,
    'aria-label': label,
  };
}

/**
 * Create accessible description association
 */
export function createDescriptionProps(id: string, descriptionId?: string) {
  return {
    id,
    'aria-describedby': descriptionId,
  };
}

/**
 * Announce to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', priority);
  announcer.setAttribute('aria-atomic', 'true');
  announcer.setAttribute('role', 'status');
  Object.assign(announcer.style, srOnlyStyles);
  
  document.body.appendChild(announcer);
  
  // Delay to ensure screen reader picks it up
  setTimeout(() => {
    announcer.textContent = message;
  }, 100);
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(announcer);
  }, 1000);
}

/**
 * Trap focus within an element (for modals, dialogs)
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement?.focus();
        e.preventDefault();
      }
    }
  };
  
  element.addEventListener('keydown', handleKeyDown);
  
  // Focus first element
  firstElement?.focus();
  
  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}
