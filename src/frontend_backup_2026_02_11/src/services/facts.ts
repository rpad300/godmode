/**
 * Facts Service
 * Handles facts CRUD and conflict detection
 */

import { http } from './api';

export interface Fact {
  id: string | number;
  content: string;
  source?: string;
  source_file?: string;
  source_document_id?: string;
  category?: string;
  confidence?: number;
  verified?: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateFactRequest {
  content: string;
  source?: string;
  category?: string;
  verified?: boolean;
}

export interface UpdateFactRequest {
  content?: string;
  source?: string;
  category?: string;
  verified?: boolean;
}

export interface FactConflict {
  factId1: string | number;
  factId2: string | number;
  fact1: Fact;
  fact2: Fact;
  conflictType: 'contradiction' | 'inconsistency' | 'outdated' | 'process';
  description?: string;
  reason?: string;
  confidence?: number;
}

/**
 * Get all facts
 */
export async function getFacts(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
  verified?: boolean;
}): Promise<{ facts: Fact[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.search) params.set('search', options.search);
    if (options?.category) params.set('category', options.category);
    if (options?.verified !== undefined) params.set('verified', String(options.verified));

    const query = params.toString();
    const url = query ? `/api/facts?${query}` : '/api/facts';

    const response = await http.get<{ facts: Fact[]; total?: number }>(url);
    return {
      facts: response.data.facts || [],
      total: response.data.total || response.data.facts?.length || 0,
    };
  } catch {
    return { facts: [], total: 0 };
  }
}

/**
 * Get a single fact
 */
export async function getFact(id: string | number): Promise<Fact | null> {
  try {
    const response = await http.get<{ fact: Fact }>(`/api/facts/${id}`);
    return response.data.fact;
  } catch {
    return null;
  }
}

/**
 * Create a new fact
 */
export async function createFact(data: CreateFactRequest): Promise<Fact> {
  const response = await http.post<{ fact: Fact; id: string | number }>('/api/facts', data);
  return response.data.fact || {
    ...data,
    id: response.data.id,
    created_at: new Date().toISOString(),
  } as Fact;
}

/**
 * Update a fact
 */
export async function updateFact(id: string | number, data: UpdateFactRequest): Promise<Fact> {
  const response = await http.put<{ fact: Fact }>(`/api/facts/${id}`, data);
  return response.data.fact;
}

/**
 * Delete a fact (soft delete; syncs removal to graph/FalkorDB)
 */
export async function deleteFact(id: string | number): Promise<void> {
  await http.delete(`/api/facts/${id}`);
}

/**
 * List soft-deleted facts (for restore / undo)
 */
export async function getDeletedFacts(): Promise<Fact[]> {
  try {
    const response = await http.get<{ facts: Fact[] }>('/api/facts/deleted');
    return response.data.facts || [];
  } catch {
    return [];
  }
}

/**
 * Restore a soft-deleted fact (undo); syncs back to graph/FalkorDB
 */
export async function restoreFact(id: string | number): Promise<Fact> {
  const response = await http.post<{ fact: Fact }>(`/api/facts/${id}/restore`, {});
  return response.data.fact;
}

/**
 * Verify a fact
 */
export async function verifyFact(id: string | number): Promise<Fact> {
  return updateFact(id, { verified: true });
}

/**
 * Run full fact-check (AI analysis, records conflict_detected events)
 */
export async function runFactCheck(): Promise<{ ok: boolean; conflicts: FactConflict[]; analyzed_facts: number; events_recorded: number }> {
  const response = await http.post<{ ok: boolean; conflicts: FactConflict[]; analyzed_facts: number; events_recorded: number }>('/api/fact-check/run', {});
  return response.data;
}

/**
 * Detect conflicts between facts
 */
export async function detectConflicts(): Promise<FactConflict[]> {
  try {
    const response = await http.get<{ conflicts: FactConflict[] }>('/api/conflicts');
    return response.data.conflicts || [];
  } catch {
    return [];
  }
}

/**
 * Get facts by category
 */
export async function getFactsByCategory(): Promise<Record<string, Fact[]>> {
  try {
    const { facts } = await getFacts({ limit: 1000 });
    const grouped: Record<string, Fact[]> = {};
    
    facts.forEach(fact => {
      const category = fact.category || 'Uncategorized';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(fact);
    });
    
    return grouped;
  } catch {
    return {};
  }
}

/**
 * Get facts grouped by source (source_file or source)
 */
export async function getFactsBySource(): Promise<Record<string, Fact[]>> {
  try {
    const { facts } = await getFacts({ limit: 1000 });
    const grouped: Record<string, Fact[]> = {};
    
    facts.forEach(fact => {
      const source = fact.source_file || fact.source || 'Unknown source';
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(fact);
    });
    
    return grouped;
  } catch {
    return {};
  }
}

/**
 * Get facts by source document id
 */
export async function getFactsByDocument(documentId: string): Promise<Fact[]> {
  try {
    const params = new URLSearchParams({ document_id: documentId });
    const response = await http.get<{ facts: Fact[] }>(`/api/facts?${params}`);
    return response.data.facts || [];
  } catch {
    return [];
  }
}

export interface FactEvent {
  id: string;
  fact_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  actor_user_id?: string;
  actor_name?: string;
  created_at: string;
}

/**
 * Get fact events (timeline) for a fact
 */
export async function getFactEvents(factId: string | number): Promise<FactEvent[]> {
  try {
    const response = await http.get<{ events: FactEvent[] }>(`/api/facts/${factId}/events`);
    return response.data.events || [];
  } catch {
    return [];
  }
}

export interface SimilarFactItem {
  fact: Fact;
  similarityScore: number;
}

/**
 * Get similar facts (from fact_similarities cache or computed)
 */
export async function getSimilarFacts(factId: string | number, limit = 10): Promise<SimilarFactItem[]> {
  try {
    const params = new URLSearchParams();
    if (limit !== 10) params.set('limit', String(limit));
    const query = params.toString();
    const url = query ? `/api/facts/${factId}/similar?${query}` : `/api/facts/${factId}/similar`;
    const response = await http.get<{ similar: SimilarFactItem[] }>(url);
    return response.data.similar || [];
  } catch {
    return [];
  }
}

/**
 * Search facts
 */
export async function searchFacts(query: string, limit = 20): Promise<Fact[]> {
  const { facts } = await getFacts({ search: query, limit });
  return facts;
}

/**
 * Get fact statistics
 */
export function getFactStats(facts: Fact[]): {
  total: number;
  verified: number;
  unverified: number;
  byCategory: Record<string, number>;
} {
  const stats = {
    total: facts.length,
    verified: facts.filter(f => f.verified).length,
    unverified: facts.filter(f => !f.verified).length,
    byCategory: {} as Record<string, number>,
  };

  facts.forEach(fact => {
    const category = fact.category || 'Uncategorized';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
  });

  return stats;
}

export const factsService = {
  getAll: getFacts,
  get: getFact,
  create: createFact,
  update: updateFact,
  delete: deleteFact,
  deleteFact, // Alias for backwards compatibility
  verify: verifyFact,
  verifyFact, // Alias for backwards compatibility
  detectConflicts,
  getByCategory: getFactsByCategory,
  getBySource: getFactsBySource,
  getByDocument: getFactsByDocument,
  getEvents: getFactEvents,
  getSimilarFacts,
  search: searchFacts,
  getStats: getFactStats,
  getDeletedFacts,
  restoreFact,
  runFactCheck,
};
