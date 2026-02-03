/**
 * UI Store
 * User interface state
 */

// Types
export type MainTab = 'dashboard' | 'chat' | 'sot' | 'timeline' | 'org' | 'files' | 'emails' | 'contacts' | 'team-analysis' | 'roles' | 'graph' | 'costs' | 'history' | 'admin';
export type SotView = 'questions' | 'facts' | 'risks' | 'actions' | 'decisions';
export type DevTab = 'info' | 'logs' | 'settings';

export interface SelectedPerson {
  id: string;
  name: string;
  type: 'contact' | 'member';
}

export interface UIState {
  currentTab: MainTab;
  currentDevTab: DevTab;
  sotCurrentView: SotView;
  selectedPerson: SelectedPerson | null;
  sidebarOpen: boolean;
  modalOpen: string | null;
  searchQuery: string;
  filterActive: boolean;
}

// Initial state
const initialState: UIState = {
  currentTab: 'dashboard',
  currentDevTab: 'info',
  sotCurrentView: 'questions',
  selectedPerson: null,
  sidebarOpen: true,
  modalOpen: null,
  searchQuery: '',
  filterActive: false,
};

// State
let state: UIState = { ...initialState };

// Listeners
const listeners: Set<(state: UIState) => void> = new Set();

/**
 * Notify all listeners
 */
function notify(): void {
  listeners.forEach(fn => fn(state));
}

/**
 * Get current state
 */
export function getState(): UIState {
  return state;
}

/**
 * Subscribe to state changes
 */
export function subscribe(callback: (state: UIState) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Set main tab
 */
export function setTab(tab: MainTab): void {
  state = { ...state, currentTab: tab };
  notify();
}

/**
 * Set developer tab
 */
export function setDevTab(tab: DevTab): void {
  state = { ...state, currentDevTab: tab };
  notify();
}

/**
 * Set Source of Truth view
 */
export function setSotView(view: SotView): void {
  state = { ...state, sotCurrentView: view };
  notify();
}

/**
 * Set selected person
 */
export function setSelectedPerson(person: SelectedPerson | null): void {
  state = { ...state, selectedPerson: person };
  notify();
}

/**
 * Toggle sidebar
 */
export function toggleSidebar(): void {
  state = { ...state, sidebarOpen: !state.sidebarOpen };
  notify();
}

/**
 * Set sidebar open state
 */
export function setSidebarOpen(open: boolean): void {
  state = { ...state, sidebarOpen: open };
  notify();
}

/**
 * Open modal
 */
export function openModal(modalId: string): void {
  state = { ...state, modalOpen: modalId };
  notify();
}

/**
 * Close modal
 */
export function closeModal(): void {
  state = { ...state, modalOpen: null };
  notify();
}

/**
 * Set search query
 */
export function setSearchQuery(query: string): void {
  state = { ...state, searchQuery: query };
  notify();
}

/**
 * Toggle filter
 */
export function toggleFilter(): void {
  state = { ...state, filterActive: !state.filterActive };
  notify();
}

/**
 * Reset to initial state
 */
export function reset(): void {
  state = { ...initialState };
  notify();
}

// Export as namespace
export const uiStore = {
  getState,
  subscribe,
  setTab,
  setDevTab,
  setSotView,
  setSelectedPerson,
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  setSearchQuery,
  toggleFilter,
  reset,
};
