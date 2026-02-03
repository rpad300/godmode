/**
 * Sidebar Component
 * Navigation sidebar with tabs
 */

import { createElement, on, addClass, removeClass } from '../utils/dom';
import { uiStore, MainTab } from '../stores/ui';
import { appStore } from '../stores/app';

export interface SidebarTab {
  id: MainTab;
  label: string;
  icon: string;
  badge?: number;
}

export interface SidebarProps {
  tabs?: SidebarTab[];
  onTabChange?: (tabId: MainTab) => void;
}

const defaultTabs: SidebarTab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'sot', label: 'Source of Truth', icon: '📋' },
  { id: 'timeline', label: 'Timeline', icon: '📅' },
  { id: 'org', label: 'Org Chart', icon: '👥' },
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'emails', label: 'Emails', icon: '📧' },
  { id: 'contacts', label: 'Contacts', icon: '📇' },
  { id: 'roles', label: 'Roles', icon: '🔐' },
  { id: 'graph', label: 'Graph DB', icon: '🕸️' },
  { id: 'costs', label: 'Costs', icon: '💰' },
  { id: 'history', label: 'History', icon: '🕐' },
];

// Admin tab - only shown for superadmin users
const adminTab: SidebarTab = { id: 'admin', label: 'Admin', icon: '⚙️' };

/**
 * Get tabs based on user role
 */
function getTabsForUser(): SidebarTab[] {
  const state = appStore.getState();
  const isSuperAdmin = state.currentUser?.role === 'superadmin';
  
  if (isSuperAdmin) {
    return [...defaultTabs, adminTab];
  }
  return defaultTabs;
}

/**
 * Create a tab button element
 */
function createTabButton(tab: SidebarTab, props: SidebarProps): HTMLButtonElement {
  const button = createElement('button', {
    className: 'sidebar-tab',
  }) as HTMLButtonElement;
  button.setAttribute('data-tab', tab.id);

  button.innerHTML = `
    <span class="tab-icon">${tab.icon}</span>
    <span class="tab-label">${tab.label}</span>
    ${tab.badge ? `<span class="tab-badge">${tab.badge}</span>` : ''}
  `;

  on(button, 'click', () => {
    uiStore.setTab(tab.id);
    props.onTabChange?.(tab.id);

    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      uiStore.setSidebarOpen(false);
    }
  });

  return button;
}

/**
 * Rebuild navigation tabs based on current user
 */
function rebuildNavigation(nav: HTMLElement, props: SidebarProps): void {
  const tabs = props.tabs || getTabsForUser();
  const currentTab = uiStore.getState().currentTab;
  
  // Clear existing tabs
  nav.innerHTML = '';
  
  // Add tabs
  tabs.forEach(tab => {
    const button = createTabButton(tab, props);
    if (tab.id === currentTab) {
      addClass(button, 'active');
    }
    nav.appendChild(button);
  });
}

/**
 * Create sidebar element
 */
export function createSidebar(props: SidebarProps = {}): HTMLElement {
  const sidebar = createElement('aside', { className: 'sidebar' });

  // Close button for mobile
  const closeBtn = createElement('button', {
    className: 'sidebar-close-btn',
    innerHTML: '✕',
  });
  on(closeBtn, 'click', () => {
    uiStore.setSidebarOpen(false);
  });
  sidebar.appendChild(closeBtn);

  // Navigation
  const nav = createElement('nav', { className: 'sidebar-nav' });
  
  // Initial build
  rebuildNavigation(nav, props);

  sidebar.appendChild(nav);
  
  // Subscribe to app store to rebuild when user changes (for admin tab visibility)
  appStore.subscribe(() => {
    rebuildNavigation(nav, props);
  });

  // Subscribe to UI state changes
  uiStore.subscribe((state) => {
    // Update active tab
    const buttons = nav.querySelectorAll('.sidebar-tab');
    buttons.forEach(btn => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId === state.currentTab) {
        addClass(btn as HTMLElement, 'active');
      } else {
        removeClass(btn as HTMLElement, 'active');
      }
    });

    // Update sidebar visibility (mobile)
    if (state.sidebarOpen) {
      addClass(sidebar, 'mobile-open');
    } else {
      removeClass(sidebar, 'mobile-open');
    }
  });

  // Set initial active state
  const initialState = uiStore.getState();
  const initialActiveBtn = nav.querySelector(`[data-tab="${initialState.currentTab}"]`);
  if (initialActiveBtn) {
    addClass(initialActiveBtn as HTMLElement, 'active');
  }

  return sidebar;
}

/**
 * Update tab badge
 */
export function updateTabBadge(tabId: MainTab, count: number | null): void {
  const tab = document.querySelector(`.sidebar-tab[data-tab="${tabId}"]`);
  if (!tab) return;

  let badge = tab.querySelector('.tab-badge');

  if (count === null || count === 0) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = createElement('span', { className: 'tab-badge' });
    tab.appendChild(badge);
  }

  badge.textContent = count > 99 ? '99+' : String(count);
}

/**
 * Mount sidebar to existing element
 */
export function mountSidebar(selector: string, props: SidebarProps = {}): HTMLElement | null {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn(`Sidebar: Container not found: ${selector}`);
    return null;
  }

  const sidebar = createSidebar(props);
  container.appendChild(sidebar);
  return sidebar;
}

export default createSidebar;
