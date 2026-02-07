/**
 * Theme Toggle Component
 * Button to cycle through theme modes (light/dark/system)
 */

import { theme } from '../services/theme';
import { toast } from '../services/toast';
import { createElement, on } from '../utils/dom';

/**
 * Create theme toggle button element
 */
export function createThemeToggle(container?: HTMLElement): HTMLButtonElement {
  const button = createElement('button', {
    className: 'btn btn-ghost theme-toggle',
    title: `Theme: ${theme.getLabel()} (Ctrl+Shift+T)`,
  });

  // Update button content
  function updateButton(): void {
    button.innerHTML = getThemeIcon();
    button.title = `Theme: ${theme.getLabel()} (Ctrl+Shift+T)`;
    button.setAttribute('data-theme-mode', theme.getMode());
  }

  // Get icon for current theme
  function getThemeIcon(): string {
    const mode = theme.getMode();
    switch (mode) {
      case 'light':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>`;
      case 'dark':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>`;
      case 'system':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>`;
    }
  }

  // Handle click
  on(button, 'click', () => {
    theme.cycle();
    updateButton();
    toast.info(`Theme: ${theme.getLabel()}`);
  });

  // Subscribe to theme changes
  theme.onChange(() => {
    updateButton();
  });

  // Initial update
  updateButton();

  // Append to container if provided
  if (container) {
    container.appendChild(button);
  }

  return button;
}

/**
 * Mount theme toggle to existing element by selector
 */
export function mountThemeToggle(selector: string): HTMLButtonElement | null {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`ThemeToggle: Container not found: ${selector}`);
    return null;
  }
  return createThemeToggle(container as HTMLElement);
}

export default createThemeToggle;
