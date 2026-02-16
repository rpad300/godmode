/**
 * App State Selectors
 * SOTA pattern for decoupled state access and derived state.
 * Ref: Phase 10.2 State Management Hardening
 */

import { appStore, Project, User, ProjectConfig, AppState } from './app';

// Base Selectors
export const selectState = (): AppState => appStore.getState();

export const selectCurrentProject = (): Project | null => selectState().currentProject;
export const selectCurrentProjectId = (): string | null => selectState().currentProjectId;
export const selectCurrentUser = (): User | null => selectState().currentUser;
export const selectIsLoading = (): boolean => selectState().isLoading;
export const selectError = (): string | null => selectState().error;
export const selectIsOnline = (): boolean => selectState().isOnline;
export const selectConfig = (): ProjectConfig => selectState().config;

// Derived Selectors
export const selectIsAuthenticated = (): boolean => !!selectCurrentUser();
export const selectProjectName = (): string => selectCurrentProject()?.name || '';
export const selectProjectSettings = (): Record<string, unknown> => selectCurrentProject()?.settings || {};

export const selectAiProvider = (): string => selectConfig().aiProvider || 'openai';
export const selectAiModel = (): string => selectConfig().aiModel || 'gpt-4';

/**
 * Type-safe selector for specific config keys
 */
export function selectConfigValue<K extends keyof ProjectConfig>(key: K): ProjectConfig[K] | undefined {
    return selectConfig()[key];
}

/**
 * Check if user has specific role
 */
export function selectHasRole(role: User['role']): boolean {
    const user = selectCurrentUser();
    if (!user) return false;
    if (role === 'member') return true; // Everyone is at least member
    if (role === 'admin') return user.role === 'admin' || user.role === 'superadmin';
    return user.role === role;
}
