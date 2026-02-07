/**
 * Legacy Bridge
 * Provides compatibility layer for legacy index.html code
 * 
 * This module exposes the new modular services and stores as global
 * variables that match the original monolithic code's expectations.
 */

import { appStore, Project, User } from '../stores/app';
import { uiStore } from '../stores/ui';
import { dataStore, Question, Risk, Action, Decision, Contact } from '../stores/data';
import { chartsStore } from '../stores/charts';
import { http, api } from '../services/api';
import type { ChatMessage } from '../stores/data';
import type { MainTab } from '../stores/ui';
import { toast } from '../services/toast';
import { theme } from '../services/theme';
import { storage } from '../services/storage';
import { shortcuts } from '../services/shortcuts';
import { undoManager } from '../services/undo';

// ============================================================================
// Global Variable Compatibility
// ============================================================================

/**
 * Legacy global variable getters/setters
 * These provide compatibility with code that expects global variables
 */

// Current project (was: currentProject)
Object.defineProperty(window, 'currentProject', {
  get: () => appStore.getState().currentProject,
  set: (value: Project | null) => appStore.setCurrentProject(value),
  configurable: true,
});

// Current project ID (was: currentProjectId)
Object.defineProperty(window, 'currentProjectId', {
  get: () => appStore.getState().currentProjectId,
  set: (value: string | null) => appStore.setCurrentProjectId(value),
  configurable: true,
});

// Current user (was: currentUser)
Object.defineProperty(window, 'currentUser', {
  get: () => appStore.getState().currentUser,
  set: (value: User | null) => appStore.setCurrentUser(value),
  configurable: true,
});

// Auth configured (was: authConfigured)
Object.defineProperty(window, 'authConfigured', {
  get: () => appStore.getState().authConfigured,
  set: (value: boolean) => appStore.setAuthConfigured(value),
  configurable: true,
});

// Current tab (was: currentTab)
Object.defineProperty(window, 'currentTab', {
  get: () => uiStore.getState().currentTab,
  set: (value: MainTab) => uiStore.setTab(value),
  configurable: true,
});

// Questions (was: questions)
Object.defineProperty(window, 'questions', {
  get: () => dataStore.getState().questions,
  set: (value: Question[]) => dataStore.setQuestions(value),
  configurable: true,
});

// Risks (was: risks)
Object.defineProperty(window, 'risks', {
  get: () => dataStore.getState().risks,
  set: (value: Risk[]) => dataStore.setRisks(value),
  configurable: true,
});

// Actions (was: actions)
Object.defineProperty(window, 'actions', {
  get: () => dataStore.getState().actions,
  set: (value: Action[]) => dataStore.setActions(value),
  configurable: true,
});

// Decisions (was: decisions)
Object.defineProperty(window, 'decisions', {
  get: () => dataStore.getState().decisions,
  set: (value: Decision[]) => dataStore.setDecisions(value),
  configurable: true,
});

// Contacts (was: contacts)
Object.defineProperty(window, 'contacts', {
  get: () => dataStore.getState().contacts,
  set: (value: Contact[]) => dataStore.setContacts(value),
  configurable: true,
});

// Chat history (was: chatHistory)
Object.defineProperty(window, 'chatHistory', {
  get: () => dataStore.getState().chatHistory,
  set: (value: ChatMessage[]) => dataStore.setChatHistory(value),
  configurable: true,
});

// ============================================================================
// Legacy Function Compatibility
// ============================================================================

/**
 * Legacy API function
 * Maps to new http service
 */
(window as unknown as Record<string, unknown>).api = async function legacyApi(
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  try {
    let response;
    switch (method.toUpperCase()) {
      case 'GET':
        response = await http.get(endpoint);
        break;
      case 'POST':
        response = await http.post(endpoint, body);
        break;
      case 'PUT':
        response = await http.put(endpoint, body);
        break;
      case 'PATCH':
        response = await http.patch(endpoint, body);
        break;
      case 'DELETE':
        response = await http.delete(endpoint);
        break;
      default:
        response = await api(endpoint, { method, body: body ? JSON.stringify(body) : undefined });
    }
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

/**
 * Legacy showToast function
 */
(window as unknown as Record<string, unknown>).showToast = function legacyShowToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
): void {
  toast[type](message);
};

/**
 * Legacy setTheme function
 */
(window as unknown as Record<string, unknown>).setTheme = function legacySetTheme(
  newTheme: 'light' | 'dark' | 'system'
): void {
  theme.set(newTheme);
};

/**
 * Legacy toggleTheme function
 */
(window as unknown as Record<string, unknown>).toggleTheme = function legacyToggleTheme(): void {
  theme.toggle();
};

/**
 * Legacy localStorage wrappers
 */
(window as unknown as Record<string, unknown>).getStorageItem = function legacyGetItem(
  key: string,
  defaultValue: unknown = null
): unknown {
  return storage.get(key, defaultValue);
};

(window as unknown as Record<string, unknown>).setStorageItem = function legacySetItem(
  key: string,
  value: unknown
): void {
  storage.set(key, value);
};

/**
 * Legacy switchTab function
 */
(window as unknown as Record<string, unknown>).switchTab = function legacySwitchTab(
  tabName: MainTab
): void {
  uiStore.setTab(tabName);
};

/**
 * Legacy refreshData function
 */
(window as unknown as Record<string, unknown>).refreshData = async function legacyRefreshData(): Promise<void> {
  const projectId = appStore.getState().currentProjectId;
  if (!projectId) return;

  try {
    const [questionsRes, risksRes, actionsRes, decisionsRes, contactsRes] = await Promise.all([
      http.get<Question[]>(`/api/projects/${projectId}/questions`),
      http.get<Risk[]>(`/api/projects/${projectId}/risks`),
      http.get<Action[]>(`/api/projects/${projectId}/actions`),
      http.get<Decision[]>(`/api/projects/${projectId}/decisions`),
      http.get<Contact[]>(`/api/projects/${projectId}/contacts`),
    ]);

    dataStore.setQuestions(questionsRes.data);
    dataStore.setRisks(risksRes.data);
    dataStore.setActions(actionsRes.data);
    dataStore.setDecisions(decisionsRes.data);
    dataStore.setContacts(contactsRes.data);
  } catch (error) {
    console.error('Failed to refresh data:', error);
  }
};

// ============================================================================
// Chart Compatibility
// ============================================================================

/**
 * Legacy chart management
 */
(window as unknown as Record<string, unknown>).registerChart = function(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chart: any,
  selector: string,
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' = 'bar'
): void {
  chartsStore.registerChart(id, chart, selector, type);
};

(window as unknown as Record<string, unknown>).destroyChart = function(id: string): void {
  chartsStore.destroyChart(id);
};

(window as unknown as Record<string, unknown>).getChart = function(id: string): unknown {
  return chartsStore.getChart(id);
};

// ============================================================================
// Keyboard Shortcuts Compatibility
// ============================================================================

/**
 * Legacy keyboard shortcut registration
 */
(window as unknown as Record<string, unknown>).registerShortcut = function(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean; description?: string } = {}
): void {
  shortcuts.register({
    key,
    ctrl: options.ctrl,
    shift: options.shift,
    alt: options.alt,
    handler: callback,
    description: options.description || 'Custom shortcut',
  });
};

// ============================================================================
// Undo/Redo Compatibility
// ============================================================================

/**
 * Legacy undo/redo
 */
(window as unknown as Record<string, unknown>).pushUndoAction = function(
  description: string,
  undo: () => void | Promise<void>,
  redo: () => void | Promise<void>
): void {
  undoManager.push({
    id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description,
    undo,
    redo,
  });
};

(window as unknown as Record<string, unknown>).undoLastAction = function(): Promise<boolean> {
  return undoManager.undo();
};

(window as unknown as Record<string, unknown>).redoLastAction = function(): Promise<boolean> {
  return undoManager.redo();
};

// ============================================================================
// Export for direct imports
// ============================================================================

export function initLegacyBridge(): void {
  console.log('[GodMode] Legacy bridge initialized');
  
  // Initialize app store listeners
  appStore.init();
  
  // Log compatibility mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[GodMode] Running in compatibility mode for legacy code');
  }
}

export default initLegacyBridge;
