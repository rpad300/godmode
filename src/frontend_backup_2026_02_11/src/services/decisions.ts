/**
 * Decisions Service
 * Handles decision CRUD operations
 */

import { http } from './api';

export interface Decision {
  id: string | number;
  content: string;
  status: 'proposed' | 'approved' | 'rejected' | 'deferred' | 'active' | 'superseded' | 'revoked';
  rationale?: string;
  made_by?: string;
  approved_by?: string;
  decided_at?: string;
  impact?: 'low' | 'medium' | 'high';
  reversible?: boolean;
  source?: string;
  source_file?: string;
  source_document_id?: string;
  owner?: string;
  context?: string;
  decision_date?: string;
  generation_source?: 'extracted' | 'quick_capture' | 'manual' | 'import';
  created_at: string;
  updated_at?: string;
  summary?: string;
}

export interface DecisionSuggestResponse {
  rationale: string;
  impact: 'high' | 'medium' | 'low';
  impact_summary: string;
  summary: string;
}

export interface DecisionOwnerSuggestion {
  name: string;
  reason?: string;
  score?: number;
}

export interface DecisionEvent {
  id: string;
  decision_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  actor_user_id?: string;
  actor_name?: string;
  created_at: string;
}

export interface DecisionConflict {
  decisionId1: string | number;
  decisionId2: string | number;
  decision1: Decision;
  decision2: Decision;
  conflictType: string;
  description?: string;
  reason?: string;
  confidence?: number;
}

export interface SimilarDecisionItem {
  decision: Decision;
  similarityScore: number;
}

export interface CreateDecisionRequest {
  content: string;
  status?: 'proposed' | 'approved' | 'rejected' | 'deferred';
  rationale?: string;
  made_by?: string;
  impact?: 'low' | 'medium' | 'high';
  summary?: string;
}

export interface UpdateDecisionRequest {
  content?: string;
  status?: 'proposed' | 'approved' | 'rejected' | 'deferred' | 'active' | 'superseded' | 'revoked';
  rationale?: string;
  made_by?: string;
  approved_by?: string;
  decided_at?: string;
  impact?: 'low' | 'medium' | 'high';
  reversible?: boolean;
  summary?: string;
}

/**
 * Get all decisions
 */
export async function getDecisions(status?: string): Promise<Decision[]> {
  try {
    const url = status ? `/api/decisions?status=${status}` : '/api/decisions';
    const response = await http.get<{ decisions: Decision[] }>(url);
    return response.data.decisions || [];
  } catch {
    return [];
  }
}

/**
 * Get a single decision
 */
export async function getDecision(id: string | number): Promise<Decision | null> {
  try {
    const response = await http.get<{ decision: Decision }>(`/api/decisions/${id}`);
    return response.data.decision;
  } catch {
    return null;
  }
}

/**
 * List soft-deleted decisions (for restore / undo)
 */
export async function getDeletedDecisions(): Promise<Decision[]> {
  try {
    const response = await http.get<{ decisions: Decision[] }>('/api/decisions/deleted');
    return response.data.decisions || [];
  } catch {
    return [];
  }
}

/**
 * Restore a soft-deleted decision
 */
export async function restoreDecision(id: string | number): Promise<Decision> {
  const response = await http.post<{ decision: Decision }>(`/api/decisions/${id}/restore`, {});
  return response.data.decision;
}

/**
 * Get decision events (timeline)
 */
export async function getDecisionEvents(decisionId: string | number): Promise<DecisionEvent[]> {
  try {
    const response = await http.get<{ events: DecisionEvent[] }>(`/api/decisions/${decisionId}/events`);
    return response.data.events || [];
  } catch {
    return [];
  }
}

/**
 * Get similar decisions
 */
export async function getSimilarDecisions(decisionId: string | number, limit = 10): Promise<SimilarDecisionItem[]> {
  try {
    const params = new URLSearchParams();
    if (limit !== 10) params.set('limit', String(limit));
    const query = params.toString();
    const url = query ? `/api/decisions/${decisionId}/similar?${query}` : `/api/decisions/${decisionId}/similar`;
    const response = await http.get<{ similar: SimilarDecisionItem[] }>(url);
    return response.data.similar || [];
  } catch {
    return [];
  }
}

/**
 * Run decision-check (AI conflict detection, records events)
 */
export async function runDecisionCheck(): Promise<{ ok: boolean; conflicts: DecisionConflict[]; analyzed_decisions: number; events_recorded: number }> {
  const response = await http.post<{ ok: boolean; conflicts: DecisionConflict[]; analyzed_decisions: number; events_recorded: number }>('/api/decision-check/run', {});
  return response.data;
}

/**
 * Detect conflicts between decisions (no events recorded)
 */
export async function detectConflicts(): Promise<DecisionConflict[]> {
  try {
    const response = await http.get<{ conflicts: DecisionConflict[] }>('/api/conflicts/decisions');
    return response.data.conflicts || [];
  } catch {
    return [];
  }
}

/**
 * AI suggest: rationale, impact, impact_summary, one-line summary from decision content
 */
export async function suggest(content: string, rationale?: string): Promise<DecisionSuggestResponse> {
  const response = await http.post<DecisionSuggestResponse>('/api/decisions/suggest', {
    content: content.trim(),
    rationale: rationale?.trim() || '',
  });
  return response.data;
}

/**
 * AI suggest owner (made_by) from decision content; backend uses project contacts only.
 */
export async function suggestOwner(content: string, rationale?: string): Promise<{ suggested_owners: DecisionOwnerSuggestion[] }> {
  const response = await http.post<{ suggested_owners: DecisionOwnerSuggestion[] }>('/api/decisions/suggest-owner', {
    content: content.trim(),
    rationale: rationale?.trim() || '',
  });
  return response.data;
}

/**
 * Create a new decision
 */
export async function createDecision(data: CreateDecisionRequest): Promise<Decision> {
  const response = await http.post<{ decision: Decision; id: string | number }>('/api/decisions', data);
  return response.data.decision || { ...data, id: response.data.id, status: data.status || 'proposed', created_at: new Date().toISOString() } as Decision;
}

/**
 * Update a decision
 */
export async function updateDecision(id: string | number, data: UpdateDecisionRequest): Promise<Decision> {
  const response = await http.put<{ decision: Decision }>(`/api/decisions/${id}`, data);
  return response.data.decision;
}

/**
 * Delete a decision
 */
export async function deleteDecision(id: string | number): Promise<void> {
  await http.delete(`/api/decisions/${id}`);
}

/**
 * Approve a decision
 */
export async function approveDecision(id: string | number, approvedBy: string): Promise<Decision> {
  return updateDecision(id, {
    status: 'approved',
    approved_by: approvedBy,
    decided_at: new Date().toISOString(),
  });
}

/**
 * Reject a decision
 */
export async function rejectDecision(id: string | number, rationale?: string): Promise<Decision> {
  return updateDecision(id, {
    status: 'rejected',
    rationale,
    decided_at: new Date().toISOString(),
  });
}

export const decisionsService = {
  getAll: getDecisions,
  get: getDecision,
  create: createDecision,
  update: updateDecision,
  delete: deleteDecision,
  approve: approveDecision,
  reject: rejectDecision,
  getDeletedDecisions,
  restore: restoreDecision,
  getEvents: getDecisionEvents,
  getSimilarDecisions,
  runDecisionCheck,
  detectConflicts,
  suggest,
  suggestOwner,
};
