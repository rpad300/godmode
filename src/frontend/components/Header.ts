/**
 * Header Component
 * Main application header with project selector and user menu
 */

import { createElement, on, $, show, hide } from '../utils/dom';
import { appStore } from '../stores/app';
import { uiStore } from '../stores/ui';
import { theme } from '../services/theme';
import { createThemeToggle } from './ThemeToggle';

export interface HeaderProps {
  onProjectChange?: (projectId: string) => void;
  onLogout?: () => void;
  onSettings?: () => void;
}

/**
 * Create header element
 */
export function createHeader(props: HeaderProps = {}): HTMLElement {
  const header = createElement('header', { className: 'app-header' });

  // Logo and title
  const logoSection = createElement('div', { className: 'header-logo' });
  logoSection.innerHTML = `
    <span class="logo-icon">⚡</span>
    <h1>GodMode</h1>
  `;

  // Actions section
  const actionsSection = createElement('div', { className: 'header-actions' });

  // Project selector
  const projectSelector = createProjectSelector(props.onProjectChange);
  actionsSection.appendChild(projectSelector);

  // Theme toggle
  const themeToggle = createThemeToggle();
  actionsSection.appendChild(themeToggle);

  // User menu
  const userMenu = createUserMenu(props);
  actionsSection.appendChild(userMenu);

  // Mobile menu button
  const mobileMenuBtn = createElement('button', {
    className: 'mobile-menu-btn',
    innerHTML: '☰',
  });
  on(mobileMenuBtn, 'click', () => {
    uiStore.toggleSidebar();
  });

  header.appendChild(mobileMenuBtn);
  header.appendChild(logoSection);
  header.appendChild(actionsSection);

  return header;
}

/**
 * Create project selector dropdown
 */
function createProjectSelector(onProjectChange?: (projectId: string) => void): HTMLElement {
  const container = createElement('div', { className: 'project-selector' });

  const button = createElement('button', {
    className: 'project-btn',
  });

  const dropdown = createElement('div', { className: 'project-dropdown' });

  // Update button text
  function updateButton(): void {
    const state = appStore.getState();
    const projectName = state.currentProjectId || 'Select Project';
    button.innerHTML = `
      <span class="project-name">${projectName}</span>
      <span class="dropdown-arrow">▼</span>
    `;
  }

  // Toggle dropdown
  let isOpen = false;
  on(button, 'click', (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    dropdown.classList.toggle('show', isOpen);
  });

  // Close on outside click
  on(document, 'click', () => {
    isOpen = false;
    dropdown.classList.remove('show');
  });

  // Subscribe to state changes
  appStore.subscribe(() => {
    updateButton();
  });

  // Initial update
  updateButton();

  container.appendChild(button);
  container.appendChild(dropdown);

  return container;
}

/**
 * Create user menu dropdown
 */
function createUserMenu(props: HeaderProps): HTMLElement {
  const container = createElement('div', { className: 'user-menu' });

  const button = createElement('button', { className: 'user-menu-btn' });

  const dropdown = createElement('div', { className: 'user-dropdown' });

  // Update button
  function updateButton(): void {
    const state = appStore.getState();
    const user = state.currentUser;
    const initials = user?.name
      ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : user?.email?.[0]?.toUpperCase() || '?';

    button.innerHTML = `
      <div class="user-avatar">${initials}</div>
      <span class="user-name">${user?.name || user?.email || 'Guest'}</span>
    `;
  }

  // Update dropdown content
  function updateDropdown(): void {
    const state = appStore.getState();
    const user = state.currentUser;

    dropdown.innerHTML = `
      <div class="user-dropdown-header">
        <strong>${user?.name || 'Guest'}</strong>
        <span class="text-muted">${user?.email || ''}</span>
        ${user?.role ? `<span class="role-badge ${user.role}">${user.role}</span>` : ''}
      </div>
      <div class="user-dropdown-items">
        <button data-action="settings">
          <span>⚙️</span> Settings
        </button>
        <button data-action="shortcuts">
          <span>⌨️</span> Shortcuts
        </button>
        <button data-action="logout" class="text-error">
          <span>🚪</span> Logout
        </button>
      </div>
    `;

    // Bind action handlers
    const settingsBtn = dropdown.querySelector('[data-action="settings"]');
    const shortcutsBtn = dropdown.querySelector('[data-action="shortcuts"]');
    const logoutBtn = dropdown.querySelector('[data-action="logout"]');

    if (settingsBtn) {
      on(settingsBtn as HTMLElement, 'click', () => {
        props.onSettings?.();
        closeDropdown();
      });
    }

    if (shortcutsBtn) {
      on(shortcutsBtn as HTMLElement, 'click', () => {
        // Show shortcuts modal
        uiStore.openModal('shortcuts');
        closeDropdown();
      });
    }

    if (logoutBtn) {
      on(logoutBtn as HTMLElement, 'click', () => {
        props.onLogout?.();
        closeDropdown();
      });
    }
  }

  // Toggle dropdown
  let isOpen = false;
  function closeDropdown(): void {
    isOpen = false;
    dropdown.classList.remove('show');
  }

  on(button, 'click', (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    dropdown.classList.toggle('show', isOpen);
    if (isOpen) {
      updateDropdown();
    }
  });

  // Close on outside click
  on(document, 'click', closeDropdown);

  // Subscribe to state changes
  appStore.subscribe(updateButton);

  // Initial update
  updateButton();

  container.appendChild(button);
  container.appendChild(dropdown);

  return container;
}

/**
 * Mount header to existing element
 */
export function mountHeader(selector: string, props: HeaderProps = {}): HTMLElement | null {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`Header: Container not found: ${selector}`);
    return null;
  }

  const header = createHeader(props);
  container.appendChild(header);
  return header;
}

export default createHeader;
