/**
 * Risks Service
 * Handles risk CRUD operations
 */

import { http } from './api';

export interface Risk {
  id: string | number;
  content: string;
  title?: string;
  description?: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  mitigation?: string;
  contingency?: string;
  status: 'open' | 'mitigating' | 'mitigated' | 'accepted' | 'closed';
  owner?: string;
  category?: 'technical' | 'schedule' | 'budget' | 'resource' | 'scope' | 'external' | 'other';
  source_file?: string;
  source_document_id?: string;
  generation_source?: 'extracted' | 'quick_capture' | 'manual' | 'import';
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface RiskEvent {
  id: string;
  risk_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  actor_name?: string;
  created_at: string;
}

export interface CreateRiskRequest {
  content: string;
  title?: string;
  impact?: 'low' | 'medium' | 'high' | 'critical';
  likelihood?: 'low' | 'medium' | 'high';
  mitigation?: string;
  owner?: string;
  category?: string;
}

export interface UpdateRiskRequest {
  content?: string;
  title?: string;
  impact?: 'low' | 'medium' | 'high' | 'critical';
  likelihood?: 'low' | 'medium' | 'high';
  mitigation?: string;
  contingency?: string;
  status?: 'open' | 'mitigating' | 'mitigated' | 'accepted' | 'closed';
  owner?: string;
  category?: string;
}

/**
 * Get all risks
 */
export async function getRisks(status?: string): Promise<Risk[]> {
  try {
    const url = status ? `/api/risks?status=${status}` : '/api/risks';
    const response = await http.get<{ risks: Risk[] }>(url);
    return response.data.risks || [];
  } catch {
    return [];
  }
}

/**
 * Get a single risk by id
 */
export async function getRisk(id: string | number): Promise<Risk | null> {
  try {
    const response = await http.get<{ risk: Risk }>(`/api/risks/${id}`);
    return response.data.risk ?? null;
  } catch {
    return null;
  }
}

/**
 * Get soft-deleted risks (for restore)
 */
export async function getDeletedRisks(): Promise<Risk[]> {
  try {
    const response = await http.get<{ risks: Risk[] }>('/api/risks/deleted');
    return response.data.risks || [];
  } catch {
    return [];
  }
}

/**
 * Restore a soft-deleted risk
 */
export async function restoreRisk(id: string | number): Promise<Risk> {
  const response = await http.post<{ risk: Risk }>(`/api/risks/${id}/restore`, {});
  return response.data.risk;
}

/**
 * Get risk timeline events
 */
export async function getRiskEvents(id: string | number): Promise<RiskEvent[]> {
  try {
    const response = await http.get<{ events: RiskEvent[] }>(`/api/risks/${id}/events`);
    return response.data.events || [];
  } catch {
    return [];
  }
}

/**
 * Get risks grouped by category
 */
export async function getRisksByCategory(): Promise<Record<string, Risk[]>> {
  try {
    const response = await http.get<{ risksByCategory: Record<string, Risk[]> }>('/api/risks/by-category');
    return response.data.risksByCategory || {};
  } catch {
    return {};
  }
}

/**
 * Create a new risk
 */
export async function createRisk(data: CreateRiskRequest): Promise<Risk> {
  const response = await http.post<{ risk: Risk; id: string | number }>('/api/risks', data);
  return response.data.risk || { ...data, id: response.data.id, status: 'open', created_at: new Date().toISOString() } as Risk;
}

/**
 * Update a risk
 */
export async function updateRisk(id: string | number, data: UpdateRiskRequest): Promise<Risk> {
  const response = await http.put<{ risk: Risk }>(`/api/risks/${id}`, data);
  return response.data.risk;
}

/**
 * Delete a risk
 */
export async function deleteRisk(id: string | number): Promise<void> {
  await http.delete(`/api/risks/${id}`);
}

/**
 * Calculate risk score (impact x likelihood)
 */
export function calculateRiskScore(impact: string, likelihood: string): number {
  const impactScores: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const likelihoodScores: Record<string, number> = { low: 1, medium: 2, high: 3 };
  return (impactScores[impact] || 2) * (likelihoodScores[likelihood] || 2);
}

/**
 * AI suggest owner and mitigation from risk content
 */
export interface RiskOwnerSuggestion {
  name: string;
  reason: string;
  score?: number;
}

export async function suggestRisk(options: { content: string; impact?: string; likelihood?: string; probability?: string }): Promise<{
  suggested_owner: string;
  suggested_mitigation: string;
  suggested_owners: RiskOwnerSuggestion[];
}> {
  const response = await http.post<{
    suggested_owner?: string;
    suggested_mitigation?: string;
    suggested_owners?: RiskOwnerSuggestion[];
    error?: string;
  }>('/api/risks/suggest', {
    content: options.content?.trim() || '',
    impact: options.impact || 'medium',
    likelihood: options.likelihood ?? options.probability ?? 'medium',
  });
  if (response.data.error) throw new Error(response.data.error);
  const owners = Array.isArray(response.data.suggested_owners) ? response.data.suggested_owners : [];
  return {
    suggested_owner: response.data.suggested_owner ?? (owners[0]?.name ?? ''),
    suggested_mitigation: response.data.suggested_mitigation ?? '',
    suggested_owners: owners,
  };
}

/**
 * Get risk matrix data
 */
export function getRiskMatrixData(risks: Risk[]): Record<string, Risk[]> {
  const matrix: Record<string, Risk[]> = {};
  
  risks.filter(r => r.status !== 'mitigated' && r.status !== 'closed').forEach(risk => {
    const impact = (risk.impact || '').toString().toLowerCase();
    const likelihood = (risk.likelihood || '').toString().toLowerCase();
    const key = `${impact}-${likelihood}`;
    if (!matrix[key]) matrix[key] = [];
    matrix[key].push(risk);
  });
  
  return matrix;
}

export const risksService = {
  getAll: getRisks,
  get: getRisk,
  getByCategory: getRisksByCategory,
  getDeleted: getDeletedRisks,
  restore: restoreRisk,
  getEvents: getRiskEvents,
  suggest: suggestRisk,
  create: createRisk,
  update: updateRisk,
  delete: deleteRisk,
  calculateScore: calculateRiskScore,
  getMatrixData: getRiskMatrixData,
};
