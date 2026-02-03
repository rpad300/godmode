/**
 * Settings Service
 * Handles user settings, API keys, webhooks, and audit logs
 */

import { http } from './api';

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  notifications?: {
    email: boolean;
    browser: boolean;
    mentions: boolean;
    updates: boolean;
  };
  display?: {
    density: 'compact' | 'comfortable' | 'spacious';
    sidebarCollapsed: boolean;
  };
  ai?: {
    model?: string;
    temperature?: number;
    autoSuggest: boolean;
  };
}

export interface ProjectSettings {
  name: string;
  description?: string;
  userRole?: string;
  userRolePrompt?: string;
  llm?: {
    provider: string;
    model: string;
  };
  processing?: {
    autoExtractFacts: boolean;
    autoCreateQuestions: boolean;
    deduplication: boolean;
  };
  notifications?: {
    dailyBriefing: boolean;
    overdueAlerts: boolean;
  };
}

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used?: string;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  is_active: boolean;
  last_triggered?: string;
  failure_count: number;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  user_email?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

/**
 * Get user settings
 */
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const response = await http.get<UserSettings>('/api/settings');
    return response.data;
  } catch {
    return {};
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(settings: Partial<UserSettings>): Promise<void> {
  await http.put('/api/settings', settings);
}

/**
 * Get project settings
 */
export async function getProjectSettings(projectId?: string): Promise<ProjectSettings | null> {
  try {
    const url = projectId ? `/api/projects/${projectId}/settings` : '/api/project/settings';
    const response = await http.get<{ settings: ProjectSettings }>(url);
    return response.data.settings;
  } catch {
    return null;
  }
}

/**
 * Update project settings
 */
export async function updateProjectSettings(settings: Partial<ProjectSettings>, projectId?: string): Promise<void> {
  const url = projectId ? `/api/projects/${projectId}/settings` : '/api/project/settings';
  await http.put(url, settings);
}

/**
 * Get API keys
 */
export async function getAPIKeys(): Promise<APIKey[]> {
  try {
    const response = await http.get<{ keys: APIKey[] }>('/api/api-keys');
    return response.data.keys || [];
  } catch {
    return [];
  }
}

/**
 * Create API key
 */
export async function createAPIKey(name: string, permissions: string[]): Promise<{ key: string; id: string }> {
  const response = await http.post<{ key: string; id: string }>('/api/api-keys', { name, permissions });
  return response.data;
}

/**
 * Revoke API key
 */
export async function revokeAPIKey(id: string): Promise<void> {
  await http.delete(`/api/api-keys/${id}`);
}

/**
 * Get webhooks
 */
export async function getWebhooks(): Promise<Webhook[]> {
  try {
    const response = await http.get<{ webhooks: Webhook[] }>('/api/webhooks');
    return response.data.webhooks || [];
  } catch {
    return [];
  }
}

/**
 * Create webhook
 */
export async function createWebhook(webhook: {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}): Promise<Webhook> {
  const response = await http.post<{ webhook: Webhook; id: string }>('/api/webhooks', webhook);
  return response.data.webhook || { ...webhook, id: response.data.id, is_active: true, failure_count: 0, created_at: new Date().toISOString() };
}

/**
 * Update webhook
 */
export async function updateWebhook(id: string, updates: Partial<Webhook>): Promise<void> {
  await http.put(`/api/webhooks/${id}`, updates);
}

/**
 * Delete webhook
 */
export async function deleteWebhook(id: string): Promise<void> {
  await http.delete(`/api/webhooks/${id}`);
}

/**
 * Test webhook
 */
export async function testWebhook(id: string): Promise<{ success: boolean; status: number; response?: string }> {
  const response = await http.post<{ success: boolean; status: number; response?: string }>(`/api/webhooks/${id}/test`);
  return response.data;
}

/**
 * Get audit logs
 */
export async function getAuditLogs(options?: {
  action?: string;
  entity_type?: string;
  user_id?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.action) params.set('action', options.action);
    if (options?.entity_type) params.set('entity_type', options.entity_type);
    if (options?.user_id) params.set('user_id', options.user_id);
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const query = params.toString();
    const url = query ? `/api/audit?${query}` : '/api/audit';

    const response = await http.get<{ logs: AuditLogEntry[]; total: number }>(url);
    return response.data;
  } catch {
    return { logs: [], total: 0 };
  }
}

/**
 * Export audit logs
 */
export async function exportAuditLogs(format: 'json' | 'csv', options?: {
  startDate?: string;
  endDate?: string;
}): Promise<Blob> {
  const params = new URLSearchParams();
  params.set('format', format);
  if (options?.startDate) params.set('startDate', options.startDate);
  if (options?.endDate) params.set('endDate', options.endDate);

  const response = await fetch(`/api/audit/export?${params.toString()}`);
  if (!response.ok) throw new Error('Export failed');
  return response.blob();
}

export const userSettingsService = {
  get: getUserSettings,
  update: updateUserSettings,
};

export const projectSettingsService = {
  get: getProjectSettings,
  update: updateProjectSettings,
};

export const apiKeysService = {
  getAll: getAPIKeys,
  create: createAPIKey,
  revoke: revokeAPIKey,
};

export const webhooksService = {
  getAll: getWebhooks,
  create: createWebhook,
  update: updateWebhook,
  delete: deleteWebhook,
  test: testWebhook,
};

export const auditService = {
  getAll: getAuditLogs,
  export: exportAuditLogs,
};
