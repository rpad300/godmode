/**
 * Actions Service
 * Handles action item CRUD operations
 */

import { http } from './api';

/** API returns task, owner, deadline (action_items table). We expose content, assignee, due_date for UI. */
export interface Action {
  id: string | number;
  /** UI: use content; API may return task */
  content?: string;
  task?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  /** UI: use assignee; API may return owner */
  assignee?: string;
  owner?: string;
  /** UI: use due_date; API may return deadline */
  due_date?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  source_file?: string;
  source_document_id?: string;
  depends_on?: string[];
  blocked_by?: string[];
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface CreateActionRequest {
  content: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface UpdateActionRequest {
  content?: string;
  task?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee?: string;
  owner?: string;
  due_date?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  depends_on?: string[];
  blocked_by?: string[];
}

/** Normalize API row (task, owner, deadline) to UI shape (content, assignee, due_date) */
function normalizeAction(row: Record<string, unknown>): Action {
  return {
    ...row,
    content: (row.content ?? row.task) as string,
    assignee: (row.assignee ?? row.owner) as string | undefined,
    due_date: (row.due_date ?? row.deadline) as string | undefined,
  } as Action;
}

/**
 * Get all actions
 */
export async function getActions(status?: string): Promise<Action[]> {
  try {
    const url = status ? `/api/actions?status=${status}` : '/api/actions';
    const response = await http.get<{ actions: Record<string, unknown>[] }>(url);
    const raw = response.data.actions || [];
    return raw.map(normalizeAction);
  } catch {
    return [];
  }
}

/**
 * Create a new action
 */
export async function createAction(data: CreateActionRequest): Promise<Action> {
  const payload = {
    content: data.content,
    task: data.content,
    assignee: data.assignee,
    owner: data.assignee,
    due_date: data.due_date,
    deadline: data.due_date,
    status: data.status,
    priority: data.priority,
  };
  const response = await http.post<{ action: Record<string, unknown>; id: string | number }>('/api/actions', payload);
  const raw = response.data.action || { ...payload, id: response.data.id, created_at: new Date().toISOString() };
  return normalizeAction(raw);
}

/**
 * Update an action
 */
export async function updateAction(id: string | number, data: UpdateActionRequest): Promise<Action> {
  const payload = {
    ...data,
    task: data.content ?? data.task,
    owner: data.assignee ?? data.owner,
    deadline: data.due_date ?? data.deadline,
  };
  const response = await http.put<{ action: Record<string, unknown> }>(`/api/actions/${id}`, payload);
  const raw = response.data.action;
  return raw ? normalizeAction(raw) : {} as Action;
}

/**
 * Delete an action
 */
export async function deleteAction(id: string | number): Promise<void> {
  await http.delete(`/api/actions/${id}`);
}

export interface ActionEvent {
  id: string;
  action_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  actor_name?: string;
  created_at: string;
}

export interface ActionAssigneeSuggestion {
  name: string;
  reason?: string;
  score?: number;
}

/**
 * Suggest assignees for an action from task content (AI + project contacts).
 */
export async function suggestAssignees(options: { content: string }): Promise<{ suggested_assignees: ActionAssigneeSuggestion[] }> {
  try {
    const response = await http.post<{ suggested_assignees: ActionAssigneeSuggestion[] }>('/api/actions/suggest', {
      content: (options.content || '').trim(),
    });
    return {
      suggested_assignees: Array.isArray(response.data.suggested_assignees) ? response.data.suggested_assignees : [],
    };
  } catch {
    return { suggested_assignees: [] };
  }
}

/**
 * Get action timeline events
 */
export async function getActionEvents(id: string | number): Promise<ActionEvent[]> {
  try {
    const response = await http.get<{ events: ActionEvent[] }>(`/api/actions/${id}/events`);
    return response.data.events || [];
  } catch {
    return [];
  }
}

/**
 * Check if action is overdue
 */
export function isOverdue(action: Action): boolean {
  if (!action.due_date || action.status === 'completed' || action.status === 'cancelled') {
    return false;
  }
  return new Date(action.due_date) < new Date();
}

/**
 * Get action statistics
 */
export function getActionStats(actions: Action[]): {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
} {
  return {
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    completed: actions.filter(a => a.status === 'completed').length,
    overdue: actions.filter(a => isOverdue(a)).length,
  };
}

export const actionsService = {
  getAll: getActions,
  create: createAction,
  update: updateAction,
  delete: deleteAction,
  getEvents: getActionEvents,
  suggest: suggestAssignees,
  isOverdue,
  getStats: getActionStats,
};
