/**
 * Actions Service
 * Handles action item CRUD operations
 */

import { http } from './api';

/** API returns task, owner, deadline (action_items table). We expose content, assignee, due_date for UI. DevOps Sprint Board fields included. */
export interface Action {
  id: string | number;
  /** UI: use content; API may return task (title of the task - concrete action) */
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
  /** Parent User Story reference e.g. US-102 */
  parent_story_ref?: string;
  /** Parent User Story UUID (from user_stories table) */
  parent_story_id?: string;
  /** Estimate e.g. 1 day, 8h (max 8h per task) */
  size_estimate?: string;
  /** Technical description / implementation notes */
  description?: string;
  /** Definition of Done checklist (strings or { text, done } for checkmarks) */
  definition_of_done?: (string | { text: string; done?: boolean })[];
  /** Acceptance criteria checklist */
  acceptance_criteria?: string[];
  /** How the action was created: extracted, quick_capture, manual, import, sprint_generated */
  generation_source?: 'extracted' | 'quick_capture' | 'manual' | 'import' | 'sprint_generated';
  source_email_id?: string;
  source_type?: 'transcript' | 'email' | 'manual';
  requested_by?: string;
  requested_by_contact_id?: string;
  supporting_document_ids?: string[];
  /** Sprint this task belongs to */
  sprint_id?: string;
  sprint_name?: string;
  /** Optional task points for velocity/breakdown */
  task_points?: number;
  /** Optional decision this task implements / is driven by */
  decision_id?: string | null;
}

export interface CreateActionRequest {
  content: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  parent_story_ref?: string;
  parent_story_id?: string;
  size_estimate?: string;
  description?: string;
  definition_of_done?: string[];
  acceptance_criteria?: string[];
  depends_on?: string[];
  generation_source?: 'extracted' | 'quick_capture' | 'manual' | 'import';
  source_document_id?: string;
  source_email_id?: string;
  source_type?: 'transcript' | 'email' | 'manual';
  requested_by?: string;
  requested_by_contact_id?: string;
  supporting_document_ids?: string[];
  sprint_id?: string;
  task_points?: number;
  decision_id?: string | null;
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
  parent_story_ref?: string;
  parent_story_id?: string;
  size_estimate?: string;
  description?: string;
  definition_of_done?: (string | { text: string; done?: boolean })[];
  acceptance_criteria?: string[];
  source_email_id?: string;
  source_type?: 'transcript' | 'email' | 'manual';
  requested_by?: string;
  requested_by_contact_id?: string;
  supporting_document_ids?: string[];
  sprint_id?: string;
  task_points?: number;
  decision_id?: string | null;
  /** Backend: emit refined_with_ai event and store snapshot for rollback */
  refined_with_ai?: boolean;
  /** Backend: restore action from a previous snapshot (e.g. from timeline) */
  restore_snapshot?: { content?: string; task?: string; description?: string; definition_of_done?: (string | { text: string; done?: boolean })[]; acceptance_criteria?: string[]; size_estimate?: string };
}

/** Normalize API row (task, owner, deadline) to UI shape (content, assignee, due_date); preserve sprint board fields */
function normalizeAction(row: Record<string, unknown>): Action {
  return {
    ...row,
    content: (row.content ?? row.task) as string,
    assignee: (row.assignee ?? row.owner) as string | undefined,
    due_date: (row.due_date ?? row.deadline) as string | undefined,
    definition_of_done: Array.isArray(row.definition_of_done) ? row.definition_of_done as (string | { text: string; done?: boolean })[] : [],
    acceptance_criteria: Array.isArray(row.acceptance_criteria) ? row.acceptance_criteria as string[] : [],
    depends_on: Array.isArray(row.depends_on) ? row.depends_on as string[] : [],
    sprint_id: row.sprint_id as string | undefined,
    sprint_name: (row.sprint_name ?? (row.sprints as { name?: string })?.name ?? (row.sprint as { name?: string })?.name) as string | undefined,
  } as Action;
}

/**
 * Get all actions (optionally filter by status, sprint, or decision)
 */
export async function getActions(status?: string, sprintId?: string, decisionId?: string | null): Promise<Action[]> {
  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (sprintId) params.set('sprint_id', sprintId);
    if (decisionId) params.set('decision_id', decisionId);
    const q = params.toString();
    const url = q ? `/api/actions?${q}` : '/api/actions';
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
    parent_story_ref: data.parent_story_ref,
    parent_story_id: data.parent_story_id,
    size_estimate: data.size_estimate,
    description: data.description,
    definition_of_done: data.definition_of_done,
    acceptance_criteria: data.acceptance_criteria,
    depends_on: data.depends_on,
    generation_source: data.generation_source,
    source_document_id: data.source_document_id,
    source_email_id: data.source_email_id,
    source_type: data.source_type,
    requested_by: data.requested_by,
    requested_by_contact_id: data.requested_by_contact_id,
    supporting_document_ids: data.supporting_document_ids,
    sprint_id: data.sprint_id,
    task_points: data.task_points,
    decision_id: data.decision_id ?? null,
  };
  const response = await http.post<{ action: Record<string, unknown>; id: string | number }>('/api/actions', payload);
  const raw = response.data.action || { ...payload, id: response.data.id, created_at: new Date().toISOString() };
  return normalizeAction(raw);
}

/**
 * Update an action
 */
export async function updateAction(id: string | number, data: UpdateActionRequest): Promise<Action> {
  const payload: Record<string, unknown> = {
    task: data.content ?? data.task,
    owner: data.assignee ?? data.owner,
    deadline: data.due_date ?? data.deadline,
    parent_story_ref: data.parent_story_ref,
    parent_story_id: data.parent_story_id,
    size_estimate: data.size_estimate,
    description: data.description,
    definition_of_done: data.definition_of_done,
    acceptance_criteria: data.acceptance_criteria,
    depends_on: data.depends_on,
    sprint_id: data.sprint_id,
    task_points: data.task_points,
    status: data.status,
    priority: data.priority,
    decision_id: data.decision_id !== undefined ? data.decision_id : undefined,
  };
  if (data.refined_with_ai === true) payload.refined_with_ai = true;
  if (data.restore_snapshot != null) payload.restore_snapshot = data.restore_snapshot;
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

/**
 * List soft-deleted actions (for restore)
 */
export async function getDeletedActions(): Promise<Action[]> {
  try {
    const response = await http.get<{ actions: Record<string, unknown>[] }>('/api/actions/deleted');
    const raw = response.data.actions || [];
    return raw.map(normalizeAction);
  } catch {
    return [];
  }
}

/**
 * Restore a soft-deleted action (syncs back to graph)
 */
export async function restoreAction(id: string | number): Promise<Action> {
  const response = await http.post<{ action: Record<string, unknown> }>(`/api/actions/${id}/restore`, {});
  return normalizeAction(response.data.action || {});
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

export interface SuggestTaskResult {
  task: string;
  description: string;
  size_estimate: string;
  definition_of_done: string[];
  acceptance_criteria: string[];
}

/**
 * Generate full task structure from a short description (AI using Sprint Board prompt from Admin).
 */
export async function suggestTaskFromDescription(options: {
  user_input: string;
  parent_story_ref?: string;
}): Promise<SuggestTaskResult> {
  const response = await http.post<SuggestTaskResult>('/api/actions/suggest-task', {
    user_input: (options.user_input || '').trim(),
    parent_story_ref: options.parent_story_ref || '',
  });
  return {
    task: response.data.task || '',
    description: response.data.description || '',
    size_estimate: response.data.size_estimate || '1 day',
    definition_of_done: Array.isArray(response.data.definition_of_done) ? response.data.definition_of_done : [],
    acceptance_criteria: Array.isArray(response.data.acceptance_criteria) ? response.data.acceptance_criteria : [],
  };
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

export interface BySprintEntry {
  count: number;
  name: string;
}

/**
 * Get actions report (by_status, by_assignee, by_sprint)
 */
export async function getActionsReport(): Promise<{
  by_status: Record<string, number>;
  by_assignee: Record<string, number>;
  by_sprint: Record<string, BySprintEntry>;
}> {
  try {
    const response = await http.get<{
      by_status: Record<string, number>;
      by_assignee: Record<string, number>;
      by_sprint: Record<string, BySprintEntry>;
    }>('/api/actions/report');
    return {
      by_status: response.data?.by_status || {},
      by_assignee: response.data?.by_assignee || {},
      by_sprint: response.data?.by_sprint || {},
    };
  } catch {
    return { by_status: {}, by_assignee: {}, by_sprint: {} };
  }
}

/**
 * Get semantically similar actions (requires embeddings)
 */
export async function getSimilarActions(id: string | number): Promise<Action[]> {
  try {
    const response = await http.get<{ similar: Action[] }>(`/api/actions/${id}/similar`);
    return response.data?.similar || [];
  } catch {
    return [];
  }
}

export interface UserStory {
  id: string;
  title: string;
  description?: string;
  status?: string;
  acceptance_criteria?: string[];
  created_at?: string;
  story_points?: number;
}

export async function getUserStories(status?: string): Promise<UserStory[]> {
  try {
    const url = status ? `/api/user-stories?status=${status}` : '/api/user-stories';
    const response = await http.get<{ user_stories: UserStory[] }>(url);
    return response.data.user_stories || [];
  } catch {
    return [];
  }
}

export async function addUserStory(data: { title: string; description?: string; status?: string; story_points?: number }): Promise<UserStory> {
  const response = await http.post<{ user_story: UserStory; id: string }>('/api/user-stories', data);
  return response.data.user_story || { id: response.data.id, title: data.title, ...data };
}

export async function getUserStory(id: string): Promise<UserStory | null> {
  try {
    const response = await http.get<{ user_story: UserStory }>(`/api/user-stories/${id}`);
    return response.data?.user_story ?? null;
  } catch {
    return null;
  }
}

export async function updateUserStory(
  id: string,
  data: { title?: string; description?: string; status?: string; story_points?: number | null; acceptance_criteria?: string[] }
): Promise<UserStory> {
  const response = await http.put<{ user_story: UserStory }>(`/api/user-stories/${id}`, data);
  return response.data.user_story;
}

export const actionsService = {
  getAll: getActions,
  create: createAction,
  update: updateAction,
  delete: deleteAction,
  getDeletedActions,
  restoreAction,
  getEvents: getActionEvents,
  suggest: suggestAssignees,
  suggestTaskFromDescription,
  getUserStories,
  getUserStory,
  addUserStory,
  updateUserStory,
  isOverdue,
  getStats: getActionStats,
  getReport: getActionsReport,
  getSimilar: getSimilarActions,
};
