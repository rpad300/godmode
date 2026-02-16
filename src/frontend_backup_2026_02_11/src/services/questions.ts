/**
 * Questions Service
 * Handles question CRUD, answering, and AI suggestions
 */

import { http } from './api';

// Types
export interface Question {
  id: string | number;
  content: string;
  context?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'resolved' | 'reopened' | 'dismissed' | 'open' | 'answered' | 'closed' | 'deferred';
  assigned_to?: string;
  assigned_at?: string;
  answer?: string;
  answer_source?: 'manual' | 'manual-edit' | 'auto-detected' | 'document' | 'ai';
  answered_at?: string;
  answered_by_contact_id?: string;
  answered_by_name?: string;
  answer_provenance?: {
    sources: Array<{ type: string; id?: string; content: string; confidence: number }>;
    synthesis_method?: string;
  };
  category?: string;
  source_file?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  previous_answer?: string;
  edit_history?: Array<{
    answer: string;
    edited_at: string;
  }>;
  cached_suggestions?: AssigneeSuggestion[];
  suggestions_generated_at?: string;
  why?: string;
  confidence?: number;
  // SOTA fields
  extracted_entities?: Array<{ type: string; name: string; entity_id?: string; confidence?: number }>;
  extracted_topics?: Array<{ name: string; type?: string; confidence?: number }>;
  sla_hours?: number;
  sla_breached?: boolean;
  sla_breached_at?: string;
  follow_up_to?: string;
  generation_source?: 'manual' | 'extracted' | 'template' | 'ai_generated';
  cluster_id?: number;
  cluster_label?: string;
  // Dismissed tracking
  dismissed_at?: string;
  dismissed_by?: string;
  dismissed_reason?: 'duplicate' | 'not_relevant' | 'out_of_scope' | 'answered_elsewhere' | 'no_longer_needed' | 'other';
  // Deferred tracking
  deferred_at?: string;
  deferred_by?: string;
  deferred_until?: string;
  deferred_reason?: string;
  // Reopened tracking
  reopened_at?: string;
  reopened_by?: string;
  reopened_reason?: string;
  reopen_count?: number;
  // Resolution type
  resolution_type?: 'answered_manual' | 'answered_auto' | 'answered_ai' | 'dismissed' | 'merged' | 'superseded';
  // Merged/Superseded
  merged_into_id?: string;
  superseded_by_id?: string;
  // Usefulness feedback
  was_useful?: boolean;
  usefulness_feedback?: string;
  // Requester role - who the question is FROM (their perspective)
  requester_role?: string;
  requester_role_prompt?: string;
  requester_contact_id?: string;
  requester_name?: string;
}

export interface CreateQuestionRequest {
  content: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string;
  context?: string;
  skipDedup?: boolean;
}

export interface UpdateQuestionRequest {
  content?: string;
  context?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'assigned' | 'resolved' | 'reopened' | 'dismissed';
  assigned_to?: string;
  category?: string;
  reopen_reason?: string;
  dismissed_reason?: string;
}

export interface AnswerQuestionRequest {
  answer: string;
  source?: 'manual' | 'manual-edit' | 'auto-detected' | 'document' | 'ai';
  followupQuestions?: string;
  answeredByContactId?: string;
  answeredByName?: string;
  answerProvenance?: {
    sources: Array<{ type: string; id?: string; content: string; confidence: number }>;
    synthesis_method?: string;
  };
}

export interface AssigneeSuggestion {
  person: string;
  score: number;
  reason: string;
  contactId?: string;
  role?: string;
  organization?: string;
  method: string;
}

export interface CreateQuestionResponse {
  success: boolean;
  id?: number;
  action?: string;
  duplicate?: boolean;
  existingId?: number;
  similarity?: number;
  message?: string;
}

export interface AnswerQuestionResponse {
  success: boolean;
  question: Question;
  followupsCreated: number;
  message: string;
}

export interface SuggestAssigneeResponse {
  suggestions: AssigneeSuggestion[];
  category: string;
  method: string;
  cached: boolean;
  cachedAt?: string;
}

/**
 * Get all questions
 */
export async function getQuestions(filters?: {
  status?: string;
  priority?: string;
}): Promise<Question[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);

    const query = params.toString();
    const url = query ? `/api/questions?${query}` : '/api/questions';

    // ... existing getQuestions ...
    const response = await http.get<{ questions: Question[] }>(url);
    return response.data.questions || [];
  } catch {
    return [];
  }
}

/**
 * Get a single question by ID
 */
export async function getQuestion(id: string | number): Promise<Question | null> {
  try {
    const response = await http.get<{ question: Question }>(`/api/questions/${id}`);
    return response.data.question || null;
  } catch {
    return null;
  }
}

/**
 * Create a new question
 */
export async function createQuestion(data: CreateQuestionRequest): Promise<CreateQuestionResponse> {
  const response = await http.post<CreateQuestionResponse>('/api/questions', data);
  return response.data;
}

/**
 * Update a question
 */
export async function updateQuestion(id: string | number, data: UpdateQuestionRequest): Promise<Question> {
  const response = await http.put<{ question: Question }>(`/api/questions/${id}`, data);
  return response.data.question;
}

/**
 * Delete/dismiss a question
 */
export async function deleteQuestion(id: string | number, reason?: string): Promise<void> {
  await http.delete(`/api/questions/${id}`, {
    body: JSON.stringify({ reason }),
  });
}

/**
 * Answer a question
 */
export async function answerQuestion(
  id: string | number,
  data: AnswerQuestionRequest
): Promise<AnswerQuestionResponse> {
  const response = await http.post<AnswerQuestionResponse>(`/api/questions/${id}/answer`, data);
  return response.data;
}

/**
 * Get questions grouped by person
 */
export async function getQuestionsByPerson(): Promise<Record<string, Question[]>> {
  try {
    const response = await http.get<{ questionsByPerson: Record<string, Question[]> }>('/api/questions/by-person');
    return response.data.questionsByPerson || {};
  } catch {
    return {};
  }
}

/**
 * Get questions grouped by team/category
 */
export async function getQuestionsByTeam(): Promise<Record<string, Question[]>> {
  try {
    const response = await http.get<{ questionsByTeam: Record<string, Question[]> }>('/api/questions/by-team');
    return response.data.questionsByTeam || {};
  } catch {
    return {};
  }
}

/**
 * Get AI-powered assignee suggestions
 */
export async function suggestAssignee(options: {
  content?: string;
  id?: string | number;
  useAI?: boolean;
  refresh?: boolean;
}): Promise<SuggestAssigneeResponse> {
  const params = new URLSearchParams();
  if (options.content) params.set('content', options.content);
  if (options.id) params.set('id', String(options.id));
  if (options.useAI === false) params.set('ai', 'false');
  if (options.refresh) params.set('refresh', 'true');

  const response = await http.get<SuggestAssigneeResponse>(
    `/api/questions/suggest-assignee?${params.toString()}`,
    { signal: AbortSignal.timeout(90000) }
  );
  return response.data;
}

/**
 * Reopen a resolved question
 */
export async function reopenQuestion(id: string | number, reason: string): Promise<Question> {
  const response = await http.post<{ question: Question }>(`/api/questions/${id}/reopen`, { reason });
  return response.data.question;
}

/**
 * Dismiss a question (permanently close without answer)
 */
export async function dismissQuestion(
  id: string | number,
  reason: 'duplicate' | 'not_relevant' | 'out_of_scope' | 'answered_elsewhere' | 'no_longer_needed' | 'other',
  details?: string
): Promise<Question> {
  const response = await http.post<{ question: Question }>(`/api/questions/${id}/dismiss`, {
    reason,
    details
  });
  return response.data.question;
}

/**
 * Defer a question (postpone for later)
 */
export async function deferQuestion(
  id: string | number,
  until: string | Date,
  reason?: string
): Promise<Question> {
  const response = await http.post<{ question: Question }>(`/api/questions/${id}/defer`, {
    until: typeof until === 'string' ? until : until.toISOString(),
    reason
  });
  return response.data.question;
}

/**
 * Merge a question into another
 */
export async function mergeQuestion(
  sourceId: string | number,
  targetId: string | number
): Promise<{ source: Question; target: Question }> {
  const response = await http.post<{ source: Question; target: Question }>(
    `/api/questions/${sourceId}/merge`,
    { targetId }
  );
  return response.data;
}

/**
 * Submit feedback on an answer
 */
export async function submitAnswerFeedback(
  id: string | number,
  wasUseful: boolean,
  feedback?: string
): Promise<Question> {
  const response = await http.post<{ question: Question }>(`/api/questions/${id}/feedback`, {
    wasUseful,
    feedback
  });
  return response.data.question;
}

/**
 * Get deferred questions that are due
 */
export async function getDueDeferredQuestions(): Promise<Question[]> {
  try {
    const response = await http.get<{ questions: Question[] }>('/api/questions/deferred/due');
    return response.data.questions || [];
  } catch {
    return [];
  }
}

/**
 * Get question lifecycle stats
 */
export async function getLifecycleStats(): Promise<Record<string, number>> {
  try {
    const response = await http.get<{ stats: Record<string, number> }>('/api/questions/stats/lifecycle');
    return response.data.stats || {};
  } catch {
    return {};
  }
}

/**
 * Get question statistics
 */
export function getQuestionStats(questions: Question[]): {
  total: number;
  pending: number;
  assigned: number;
  resolved: number;
  critical: number;
  overdue: number;
} {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    total: questions.length,
    pending: questions.filter(q => q.status === 'pending').length,
    assigned: questions.filter(q => q.status === 'assigned').length,
    resolved: questions.filter(q => q.status === 'resolved').length,
    critical: questions.filter(q => q.priority === 'critical' && q.status !== 'resolved').length,
    overdue: questions.filter(q => {
      if (q.status === 'resolved') return false;
      const created = new Date(q.created_at);
      return created < sevenDaysAgo;
    }).length,
  };
}

// Export as namespace
export const questionsService = {
  getAll: getQuestions,
  get: getQuestion,
  create: createQuestion,
  update: updateQuestion,
  delete: deleteQuestion,
  answer: answerQuestion,
  getByPerson: getQuestionsByPerson,
  getByTeam: getQuestionsByTeam,
  suggestAssignee,
  reopen: reopenQuestion,
  getStats: getQuestionStats,
  dismissQuestion,
  deferQuestion,
  submitAnswerFeedback,
};
