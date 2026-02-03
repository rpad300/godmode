/**
 * App Store
 * Core application state
 */

import { storage } from '../services/storage';

// Types
export interface User {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'member';
  name?: string;
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: 'active' | 'archived' | 'completed';
  createdAt?: string;
  updatedAt?: string;
  ownerId?: string;
  settings?: Record<string, unknown>;
}

export interface ProjectConfig {
  aiProvider?: string;
  aiModel?: string;
  language?: string;
  timezone?: string;
  analyticsEnabled?: boolean;
  errorReportingEnabled?: boolean;
  aiImprovementEnabled?: boolean;
}

export interface AppState {
  currentProjectId: string | null;
  currentProject: Project | null;
  currentUser: User | null;
  authConfigured: boolean;
  config: ProjectConfig;
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  version: string;
}

// Initial state
const initialState: AppState = {
  currentProjectId: storage.get('currentProjectId', null),
  currentProject: storage.get('currentProject', null),
  currentUser: null,
  authConfigured: false,
  config: {},
  isLoading: false,
  error: null,
  isOnline: navigator.onLine,
  version: '1.0.0',
};

// State
let state: AppState = { ...initialState };

// Listeners
const listeners: Set<(state: AppState) => void> = new Set();

/**
 * Notify all listeners of state change
 */
function notify(): void {
  listeners.forEach(fn => fn(state));
}

/**
 * Get current state
 */
export function getState(): AppState {
  return state;
}

/**
 * Subscribe to state changes
 */
export function subscribe(callback: (state: AppState) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Set current project by ID only
 */
export function setCurrentProjectId(projectId: string | null): void {
  state = { ...state, currentProjectId: projectId };
  if (projectId) {
    storage.set('currentProjectId', projectId);
  } else {
    storage.remove('currentProjectId');
    storage.remove('currentProject');
    state = { ...state, currentProject: null };
  }
  notify();
}

/**
 * Set current project (full object)
 */
export function setCurrentProject(project: Project | null): void {
  state = { 
    ...state, 
    currentProject: project,
    currentProjectId: project?.id || null,
  };
  if (project) {
    storage.set('currentProject', project);
    storage.set('currentProjectId', project.id);
  } else {
    storage.remove('currentProject');
    storage.remove('currentProjectId');
  }
  notify();
}

/**
 * Set current user
 */
export function setCurrentUser(user: User | null): void {
  state = { ...state, currentUser: user };
  notify();
}

/**
 * Set auth configured status
 */
export function setAuthConfigured(configured: boolean): void {
  state = { ...state, authConfigured: configured };
  notify();
}

/**
 * Set project config
 */
export function setConfig(config: Partial<ProjectConfig>): void {
  state = { ...state, config: { ...state.config, ...config } };
  notify();
}

/**
 * Set loading state
 */
export function setLoading(isLoading: boolean): void {
  state = { ...state, isLoading };
  notify();
}

/**
 * Set error
 */
export function setError(error: string | null): void {
  state = { ...state, error };
  notify();
}

/**
 * Set online status
 */
export function setOnline(online: boolean): void {
  state = { ...state, isOnline: online };
  notify();
}

/**
 * Reset to initial state
 */
export function reset(): void {
  state = { ...initialState };
  notify();
}

/**
 * Initialize app store
 * Sets up online/offline listeners
 */
export function initAppStore(): void {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}

// Export as namespace
export const appStore = {
  getState,
  subscribe,
  setCurrentProject,
  setCurrentProjectId,
  setCurrentUser,
  setAuthConfigured,
  setConfig,
  setLoading,
  setError,
  setOnline,
  reset,
  init: initAppStore,
};
