/**
 * Graph Service - SOTA Knowledge Graph UI
 * Handles knowledge graph, visualization, GraphRAG, analytics, and Supabase persistence
 */

import { http, fetchWithProject } from './api';

// ============================================
// TYPES - Graph Data
// ============================================

export interface GraphNode {
  id: string;
  label: string;
  name?: string;
  type: string;
  properties?: Record<string, unknown>;
  // Avatar/visual properties
  avatarUrl?: string;
  photoUrl?: string;
  role?: string;
  organization?: string;
  department?: string;
  email?: string;
  // Graph metrics
  connections?: number;
  centrality?: number;
  communityId?: number;
  // Position (for saved layouts)
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats?: GraphStats;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  density?: number;
  nodeTypes?: Record<string, number>;
  edgeTypes?: Record<string, number>;
  avgConnections?: number;
  communities?: number;
  graphName?: string;
  connected?: boolean;
}

// ============================================
// TYPES - Ontology
// ============================================

export interface OntologyEntityType {
  name: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  sharedEntity?: boolean;
  properties?: Array<{
    name: string;
    type: string;
    required?: boolean;
    searchable?: boolean;
  }>;
}

export interface OntologyRelationType {
  name: string;
  label?: string;
  description?: string;
  fromTypes: string[];
  toTypes: string[];
  properties?: Array<{
    name: string;
    type: string;
  }>;
}

export interface OntologySchema {
  version: string;
  entityTypes: Record<string, OntologyEntityType>;
  relationTypes: Record<string, OntologyRelationType>;
  queryPatterns?: Record<string, { cypher: string; description: string }>;
}

export interface OntologySuggestion {
  id: string;
  type: 'entity' | 'relation';
  name: string;
  description?: string;
  fromTypes?: string[];
  toTypes?: string[];
  properties?: string[];
  source?: string;
  example?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// ============================================
// TYPES - Analytics
// ============================================

export interface Community {
  id: number;
  size: number;
  members: Array<{ id: string; name: string; type: string }>;
  types?: Record<string, number>;
  hub?: { id: string; name: string };
}

export interface CentralityMetrics {
  topNodes: Array<{
    id: string;
    name: string;
    type: string;
    connections: number;
    centrality: number;
    avatarUrl?: string;
  }>;
}

export interface BridgeNode {
  id: string;
  name: string;
  org1?: string;
  org2?: string;
  connects: number;
}

export interface GraphInsight {
  type: string;
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  relatedNodes?: string[];
}

// ============================================
// TYPES - GraphRAG
// ============================================

export interface GraphRAGResponse {
  ok: boolean;
  answer: string;
  sources: Array<{
    type: string;
    content: string;
    id?: string;
  }>;
  queryType: 'structural' | 'semantic' | 'hybrid';
  cypherGenerated?: string;
  reasoningChain?: Array<{
    step: string;
    input: string;
    output: unknown;
    reasoning?: string;
  }>;
  highlightedNodes?: string[];
  latencyMs: number;
  confidence?: number;
  cached?: boolean;
}

export interface MultiHopResult {
  answer: string;
  reasoningChain: Array<{
    step: string;
    input: string;
    output: unknown;
    reasoning?: string;
  }>;
  subQueries?: Array<{ query: string; result: unknown }>;
  confidence: number;
}

// ============================================
// TYPES - Query
// ============================================

export interface CypherQueryResult {
  ok: boolean;
  results: Array<Record<string, unknown>>;
  columns?: string[];
  executionTimeMs?: number;
  error?: string;
}

// ============================================
// TYPES - Supabase Persistence
// ============================================

export interface GraphQueryHistory {
  id: string;
  project_id: string;
  user_id: string;
  query_type: 'cypher' | 'natural_language' | 'visual' | 'template';
  query_text: string;
  query_name?: string;
  generated_cypher?: string;
  result_count?: number;
  execution_time_ms?: number;
  is_favorite: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GraphSavedView {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description?: string;
  view_config: {
    filters?: {
      entityTypes?: string[];
      communityIds?: number[];
      dateRange?: { start?: string; end?: string };
    };
    layout?: {
      type: 'physics' | 'hierarchical' | 'manual';
      positions?: Record<string, { x: number; y: number }>;
    };
    zoom?: { scale: number; position: { x: number; y: number } };
    selectedNodes?: string[];
    highlightedPaths?: string[][];
    communityColors?: Record<number, string>;
    showLabels?: boolean;
    showEdgeLabels?: boolean;
  };
  thumbnail_url?: string;
  is_default: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface GraphBookmark {
  id: string;
  project_id: string;
  user_id: string;
  node_id: string;
  node_type: string;
  node_label: string;
  node_avatar_url?: string;
  note?: string;
  color?: string;
  sort_order: number;
  created_at: string;
}

export interface GraphAnnotation {
  id: string;
  project_id: string;
  user_id: string;
  target_type: 'node' | 'edge' | 'path' | 'region';
  target_id: string;
  target_label?: string;
  content: string;
  annotation_type: 'note' | 'warning' | 'highlight' | 'question' | 'todo';
  color?: string;
  icon?: string;
  is_shared: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GraphChatMessage {
  id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    queryType?: string;
    cypherGenerated?: string;
    sources?: unknown[];
    reasoningChain?: unknown[];
    highlightedNodes?: string[];
    executionTimeMs?: number;
    confidence?: number;
    isVoiceInput?: boolean;
  };
  is_pinned: boolean;
  created_at: string;
}

export interface GraphSnapshot {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description?: string;
  snapshot_type: 'manual' | 'auto' | 'milestone' | 'before_change';
  snapshot_data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: GraphStats;
    communities?: Community[];
    capturedAt: string;
  };
  node_count: number;
  edge_count: number;
  file_size_bytes?: number;
  is_baseline: boolean;
  tags?: string[];
  created_at: string;
}

// ============================================
// TYPES - Timeline & Costs (existing)
// ============================================

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  content?: string;
  type: 'fact' | 'question' | 'question_answered' | 'decision' | 'risk' | 'action' | 'action_completed' | 'deadline' | 'document' | 'transcript' | 'email' | 'conversation' | 'chat_session';
  entity_id?: string;
  entity_type?: string;
  metadata?: Record<string, unknown>;
  importance?: 'low' | 'medium' | 'high';
  user?: string;
  actor?: string;
  owner?: string;
  icon?: string;
  color?: string;
  status?: string;
}

export interface TimelineData {
  events: TimelineEvent[];
  startDate: string;
  endDate: string;
  totalEvents: number;
}

export interface LLMCost {
  id: string;
  provider: string;
  model: string;
  operation: string;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byOperation: Record<string, number>;
  byContext?: Record<string, number>;
  period: { start: string; end: string };
  dailyBreakdown: Array<{ date: string; cost: number; calls: number }>;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  previousPeriodCost?: number | null;
  percentChange?: number | null;
  budgetLimit?: number | null;
  budgetUsedPercent?: number | null;
  budgetAlertTriggered?: boolean;
}

// ============================================
// GRAPH DATA FUNCTIONS
// ============================================

/**
 * Get visualization data for vis-network
 */
export async function getVisualizationData(options?: {
  types?: string[];
  limit?: number;
  communityId?: number;
}): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  try {
    const params = new URLSearchParams();
    if (options?.types?.length) params.set('types', options.types.join(','));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.communityId !== undefined) params.set('communityId', String(options.communityId));

    // First try to get nodes
    const nodesResponse = await http.get<{ ok: boolean; nodes?: GraphNode[]; results?: unknown[] }>(
      `/api/graph/nodes?${params.toString()}`
    );
    
    // Then get relationships
    const edgesResponse = await http.get<{ ok: boolean; relationships?: GraphEdge[]; results?: unknown[] }>(
      `/api/graph/relationships?${params.toString()}`
    );

    const nodes = nodesResponse.data.nodes || nodesResponse.data.results?.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        id: String(r.id || r.nodeId || ''),
        label: String(r.name || r.label || r.title || (r.content as string)?.substring(0, 50) || ''),
        name: String(r.name || ''),
        type: String(r.type || r.label || 'Unknown'),
        avatarUrl: (r.avatarUrl || r.avatar_url || r.photoUrl || r.photo_url) as string | undefined,
        role: r.role as string | undefined,
        organization: r.organization as string | undefined,
        properties: r,
      };
    }) || [];

    // Map relationships to expected format (from/to -> source/target)
    const rawEdges = edgesResponse.data.relationships || edgesResponse.data.results || [];
    const edges = rawEdges.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        id: String(r.id || `${r.from || r.source}-${r.to || r.target}-${r.type}`),
        source: String(r.from || r.source || ''),
        target: String(r.to || r.target || ''),
        label: String(r.type || r.label || ''),
        type: String(r.type || ''),
      };
    });

    return { nodes: nodes as GraphNode[], edges: edges as GraphEdge[] };
  } catch (error) {
    console.error('[GraphService] getVisualizationData error:', error);
    return { nodes: [], edges: [] };
  }
}

/**
 * Get graph statistics
 */
export async function getStats(): Promise<GraphStats> {
  try {
    const response = await http.get<{ 
      ok: boolean; 
      stats?: GraphStats;
      nodes?: number;
      relationships?: number;
      enabled?: boolean;
      connected?: boolean;
      graphName?: string;
    }>('/api/graph/status');
    
    if (response.data.stats) {
      return {
        ...response.data.stats,
        graphName: response.data.graphName,
        connected: response.data.connected,
      };
    }
    
    return {
      nodeCount: response.data.nodes || 0,
      edgeCount: response.data.relationships || 0,
      graphName: response.data.graphName,
      connected: response.data.connected,
    };
  } catch {
    return { nodeCount: 0, edgeCount: 0, connected: false };
  }
}

/**
 * Get knowledge graph data (legacy)
 */
export async function getGraph(options?: {
  type?: string;
  depth?: number;
  limit?: number;
}): Promise<GraphData> {
  try {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.depth) params.set('depth', String(options.depth));
    if (options?.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    const url = query ? `/api/graph?${query}` : '/api/graph';

    const response = await http.get<GraphData>(url);
    return response.data;
  } catch {
    return { nodes: [], edges: [] };
  }
}

/**
 * Get entity graph (centered on a specific entity)
 */
export async function getEntityGraph(entityId: string, depth = 2): Promise<GraphData> {
  try {
    const response = await http.get<GraphData>(`/api/graph/entity/${entityId}?depth=${depth}`);
    return response.data;
  } catch {
    return { nodes: [], edges: [] };
  }
}

/**
 * Get related entities
 */
export async function getRelatedEntities(entityId: string): Promise<GraphNode[]> {
  try {
    const response = await http.get<{ related: GraphNode[] }>(`/api/graph/related/${entityId}`);
    return response.data.related || [];
  } catch {
    return [];
  }
}

// ============================================
// ONTOLOGY FUNCTIONS
// ============================================

/**
 * Get full ontology schema
 */
export async function getOntologySchema(): Promise<OntologySchema | null> {
  try {
    const response = await http.get<{ ok: boolean; schema: OntologySchema }>('/api/ontology/schema');
    return response.data.schema || null;
  } catch {
    return null;
  }
}

/**
 * Get entity types
 */
export async function getOntologyEntities(): Promise<OntologyEntityType[]> {
  try {
    const response = await http.get<{ ok: boolean; entityTypes: OntologyEntityType[] }>('/api/ontology/entities');
    return response.data.entityTypes || [];
  } catch {
    return [];
  }
}

/**
 * Get relation types
 */
export async function getOntologyRelations(): Promise<OntologyRelationType[]> {
  try {
    const response = await http.get<{ ok: boolean; relationTypes: OntologyRelationType[] }>('/api/ontology/relations');
    return response.data.relationTypes || [];
  } catch {
    return [];
  }
}

/**
 * Get ontology suggestions
 */
export async function getOntologySuggestions(): Promise<OntologySuggestion[]> {
  try {
    const response = await http.get<{ ok: boolean; suggestions: OntologySuggestion[] }>('/api/ontology/suggestions');
    return response.data.suggestions || [];
  } catch {
    return [];
  }
}

/**
 * Approve ontology suggestion
 */
export async function approveOntologySuggestion(suggestionId: string): Promise<boolean> {
  try {
    const response = await http.post<{ ok: boolean }>(`/api/ontology/suggestions/${suggestionId}/approve`, {});
    return response.data.ok;
  } catch {
    return false;
  }
}

/**
 * Reject ontology suggestion
 */
export async function rejectOntologySuggestion(suggestionId: string): Promise<boolean> {
  try {
    const response = await http.post<{ ok: boolean }>(`/api/ontology/suggestions/${suggestionId}/reject`, {});
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// SOTA v2.0 - ONTOLOGY MANAGEMENT
// ============================================

export interface OntologyTypeStats {
  entities: Record<string, { count: number; inOntology: boolean }>;
  relations: Record<string, { count: number; inOntology: boolean }>;
  unused: { entities: string[]; relations: string[] };
  notInOntology: { entities: string[]; relations: string[] };
}

export interface OntologySyncStatus {
  isListening: boolean;
  syncInProgress: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
  ontologySource: 'supabase' | 'file' | null;
  graphConnected: boolean;
}

export interface OntologyChange {
  id: string;
  change_type: string;
  target_type: string;
  target_name: string;
  old_definition: unknown;
  new_definition: unknown;
  diff: { added: unknown; removed: unknown; modified: unknown } | null;
  reason: string | null;
  source: string;
  changed_at: string;
  changed_by: string | null;
}

export interface LLMAnalysisResult {
  analysis: {
    missingInOntology: Array<{ name: string; type: string; count: number; description: string; confidence: number }>;
    unusedInOntology: Array<{ name: string; type: string }>;
    suggestedRelations: Array<{ from: string; to: string; name: string; description: string }>;
    suggestedInferenceRules: Array<{ name: string; description: string; pattern: string }>;
    summary: string;
  };
  suggestions: OntologySuggestion[];
  summary: string;
}

/**
 * Get type usage statistics from the graph
 */
export async function getOntologyTypeStats(): Promise<OntologyTypeStats | null> {
  try {
    const response = await http.get<{ ok: boolean; stats: OntologyTypeStats }>('/api/ontology/stats');
    return response.data.stats || null;
  } catch {
    return null;
  }
}

/**
 * Get ontology sync status (Supabase Graph)
 */
export async function getOntologySyncStatus(): Promise<OntologySyncStatus | null> {
  try {
    const response = await http.get<{ ok: boolean; status: OntologySyncStatus }>('/api/ontology/sync/status');
    return response.data.status || null;
  } catch {
    return null;
  }
}

/**
 * Force sync ontology to graph
 */
export async function forceOntologySync(): Promise<{ ok: boolean; results?: unknown; error?: string }> {
  try {
    const response = await http.post<{ ok: boolean; results?: unknown; error?: string }>('/api/ontology/sync/force', {});
    return response.data;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Trigger LLM analysis of graph vs ontology
 */
export async function runLLMAnalysis(): Promise<LLMAnalysisResult | null> {
  try {
    const response = await http.post<{ ok: boolean } & LLMAnalysisResult>('/api/ontology/analyze', {});
    if (response.data.ok) {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Auto-approve high confidence suggestions
 */
export async function autoApproveHighConfidence(threshold = 0.85): Promise<{ approved: number; skipped: number }> {
  try {
    const response = await http.post<{ ok: boolean; approved: number; skipped: number }>(
      '/api/ontology/suggestions/auto-approve',
      { threshold }
    );
    return { approved: response.data.approved || 0, skipped: response.data.skipped || 0 };
  } catch {
    return { approved: 0, skipped: 0 };
  }
}

/**
 * Get ontology change history (audit trail)
 */
export async function getOntologyChanges(options: {
  targetType?: string;
  targetName?: string;
  limit?: number;
} = {}): Promise<OntologyChange[]> {
  try {
    const params = new URLSearchParams();
    if (options.targetType) params.append('targetType', options.targetType);
    if (options.targetName) params.append('targetName', options.targetName);
    if (options.limit) params.append('limit', String(options.limit));
    
    const response = await http.get<{ ok: boolean; changes: OntologyChange[] }>(
      `/api/ontology/changes?${params.toString()}`
    );
    return response.data.changes || [];
  } catch {
    return [];
  }
}

/**
 * Migrate schema.json to Supabase
 */
export async function migrateOntologyToSupabase(): Promise<{ success: boolean; counts?: unknown; error?: string }> {
  try {
    const response = await http.post<{ success: boolean; counts?: unknown; error?: string }>(
      '/api/ontology/migrate',
      {}
    );
    return response.data;
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ============================================
// SOTA v2.1 - BACKGROUND WORKER
// ============================================

export interface BackgroundWorkerStatus {
  isRunning: boolean;
  hasPendingAnalysis: boolean;
  lastRun: Record<string, string>;
  graphConnected: boolean;
  llmConfigured: boolean;
  thresholds: {
    autoApprove: number;
    minNodesForAnalysis: number;
    analysisDebounceMs: number;
  };
}

export interface BackgroundWorkerStats {
  totalExecutions: number;
  byType: Record<string, number>;
  byStatus: { completed: number; failed: number };
  avgDuration: number;
}

export interface BackgroundJobExecution {
  type: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  duration?: number;
  results?: unknown;
  error?: string;
}

export interface OntologyJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  runCount: number;
}

/**
 * Get background worker status
 */
export async function getBackgroundWorkerStatus(): Promise<{ status: BackgroundWorkerStatus; stats: BackgroundWorkerStats } | null> {
  try {
    const response = await http.get<{ ok: boolean; status: BackgroundWorkerStatus; stats: BackgroundWorkerStats }>(
      '/api/ontology/worker/status'
    );
    if (response.data.ok) {
      return { status: response.data.status, stats: response.data.stats };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Trigger background analysis manually
 */
export async function triggerBackgroundAnalysis(
  type: 'full' | 'inference' | 'dedup' | 'auto_approve' | 'gaps',
  config: Record<string, unknown> = {}
): Promise<BackgroundJobExecution | null> {
  try {
    const response = await http.post<{ ok: boolean } & BackgroundJobExecution>(
      '/api/ontology/worker/trigger',
      { type, config }
    );
    if (response.data.ok) {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get background worker execution log
 */
export async function getBackgroundWorkerLog(options: {
  type?: string;
  status?: string;
  limit?: number;
} = {}): Promise<BackgroundJobExecution[]> {
  try {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', String(options.limit));
    
    const response = await http.get<{ ok: boolean; log: BackgroundJobExecution[] }>(
      `/api/ontology/worker/log?${params.toString()}`
    );
    return response.data.log || [];
  } catch {
    return [];
  }
}

/**
 * Get ontology-related scheduled jobs
 */
export async function getOntologyJobs(): Promise<OntologyJob[]> {
  try {
    const response = await http.get<{ ok: boolean; jobs: OntologyJob[] }>('/api/ontology/jobs');
    return response.data.jobs || [];
  } catch {
    return [];
  }
}

/**
 * Toggle an ontology job (enable/disable)
 */
export async function toggleOntologyJob(jobId: string, enabled?: boolean): Promise<OntologyJob | null> {
  try {
    const response = await http.post<{ ok: boolean; job: OntologyJob }>(
      `/api/ontology/jobs/${jobId}/toggle`,
      { enabled }
    );
    if (response.data.ok) {
      return response.data.job;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// ONTOLOGY EXTRACTOR (SOTA v2.1)
// ============================================

export interface ExtractedOntology {
  version: string;
  extractedAt: string;
  entityTypes: Record<string, {
    label: string;
    description: string;
    properties: Record<string, { type: string; required: boolean; searchable: boolean }>;
    nodeCount: number;
    extractedFrom: string;
  }>;
  relationTypes: Record<string, {
    label: string;
    description: string;
    fromTypes: string[];
    toTypes: string[];
    edgeCount: number;
    extractedFrom: string;
  }>;
}

export interface ComplianceResult {
  valid: boolean;
  score: number;
  issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    label?: string;
    count?: number;
    suggestion?: string;
  }>;
  stats: {
    totalNodes: number;
    validNodes: number;
    invalidNodes: number;
    unknownTypeNodes: number;
    totalRelationships: number;
    validRelationships: number;
    invalidRelationships: number;
    unknownTypeRelationships: number;
    missingRequiredProperties: number;
    invalidPropertyTypes: number;
  };
}

export interface OntologyDiff {
  entitiesOnlyInA: string[];
  entitiesOnlyInB: string[];
  entitiesInBoth: string[];
  relationsOnlyInA: string[];
  relationsOnlyInB: string[];
  relationsInBoth: string[];
}

export interface GraphBrowserInfo {
  browserUrl: string;
  isCloud: boolean;
  host: string;
  note: string;
}

// Alias for backward compatibility
export type FalkorDBBrowserInfo = GraphBrowserInfo;

/**
 * Extract ontology from graph
 */
export async function extractOntologyFromGraph(): Promise<{ ok: boolean; ontology?: ExtractedOntology; stats?: Record<string, number>; error?: string }> {
  try {
    const response = await http.get<{ ok: boolean; ontology?: ExtractedOntology; stats?: Record<string, number>; error?: string }>('/api/ontology/extract-from-graph');
    return response.data;
  } catch {
    return { ok: false, error: 'Failed to extract ontology' };
  }
}

/**
 * Validate graph compliance against ontology
 */
export async function validateOntologyCompliance(): Promise<ComplianceResult | null> {
  try {
    const response = await http.get<{ ok: boolean } & ComplianceResult>('/api/ontology/validate-compliance');
    if (response.data.ok) {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get diff between current ontology and graph
 */
export async function getOntologyDiff(): Promise<{ diff: OntologyDiff; extractedOntology: ExtractedOntology } | null> {
  try {
    const response = await http.get<{ ok: boolean; diff: OntologyDiff; extractedOntology: ExtractedOntology }>('/api/ontology/diff');
    if (response.data.ok) {
      return { diff: response.data.diff, extractedOntology: response.data.extractedOntology };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Find unused types in ontology
 */
export async function findUnusedOntologyTypes(): Promise<{ entities: string[]; relations: string[] }> {
  try {
    const response = await http.get<{ ok: boolean; unused: { entities: string[]; relations: string[] } }>('/api/ontology/unused-types');
    return response.data.unused || { entities: [], relations: [] };
  } catch {
    return { entities: [], relations: [] };
  }
}

/**
 * Merge extracted ontology with current
 */
export async function mergeOntology(options: { 
  ontology?: ExtractedOntology; 
  mergeProperties?: boolean; 
  mergeEndpoints?: boolean; 
  save?: boolean 
}): Promise<{ ok: boolean; changes?: Array<{ type: string; name: string }>; saved?: boolean }> {
  try {
    const response = await http.post<{ ok: boolean; changes: Array<{ type: string; name: string }>; saved: boolean }>('/api/ontology/merge', options);
    return response.data;
  } catch {
    return { ok: false };
  }
}

/**
 * Cleanup orphan ontology types
 */
export async function cleanupOntology(options: {
  discardEntitiesWithoutRelations?: boolean;
  discardRelationsWithoutEntities?: boolean;
  save?: boolean;
}): Promise<{ ok: boolean; discardedEntities?: Array<{ name: string }>; discardedRelations?: Array<{ name: string }> }> {
  try {
    const response = await http.post<{ ok: boolean; discardedEntities: Array<{ name: string }>; discardedRelations: Array<{ name: string }> }>('/api/ontology/cleanup', options);
    return response.data;
  } catch {
    return { ok: false };
  }
}

/**
 * Get Graph Browser URL info (legacy - kept for compatibility)
 */
export async function getFalkorDBBrowserInfo(): Promise<FalkorDBBrowserInfo | null> {
  try {
    const response = await http.get<{ ok: boolean } & FalkorDBBrowserInfo>('/api/graph/falkordb-browser');
    if (response.data.ok) {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

export interface FalkorDBGraphSyncResult {
  ok: boolean;
  error?: string;
  graphs: string[];
  validGraphs: string[];
  orphanGraphs: string[];
  deleted: string[];
  dryRun: boolean;
}

/**
 * List all graphs in FalkorDB
 */
export async function listAllFalkorDBGraphs(): Promise<{ ok: boolean; graphs: string[] }> {
  try {
    const response = await http.get<{ ok: boolean; graphs: string[] }>('/api/graph/list-all');
    return response.data;
  } catch {
    return { ok: false, graphs: [] };
  }
}

/**
 * Sync graphs with Supabase projects (cleanup orphans)
 * @param dryRun - If true, only report what would be deleted without actually deleting
 */
export async function syncFalkorDBGraphs(dryRun = false): Promise<FalkorDBGraphSyncResult> {
  try {
    const response = await http.post<FalkorDBGraphSyncResult>('/api/graph/sync-projects', { dryRun });
    return response.data;
  } catch {
    return { ok: false, error: 'Request failed', graphs: [], validGraphs: [], orphanGraphs: [], deleted: [], dryRun };
  }
}

/**
 * Delete a specific graph
 */
export async function deleteFalkorDBGraph(graphName: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await http.delete<{ ok: boolean; error?: string }>(`/api/graph/delete/${encodeURIComponent(graphName)}`);
    return response.data;
  } catch {
    return { ok: false, error: 'Request failed' };
  }
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

/**
 * Get detected communities
 */
export async function getCommunities(): Promise<Community[]> {
  try {
    const response = await http.get<{ ok: boolean; communities: Community[] }>('/api/graphrag/communities');
    return response.data.communities || [];
  } catch {
    return [];
  }
}

/**
 * Get centrality metrics
 */
export async function getCentrality(): Promise<CentralityMetrics> {
  try {
    const response = await http.get<{ ok: boolean; centrality: CentralityMetrics }>('/api/graphrag/centrality');
    return response.data.centrality || { topNodes: [] };
  } catch {
    return { topNodes: [] };
  }
}

/**
 * Get bridge nodes
 */
export async function getBridges(): Promise<BridgeNode[]> {
  try {
    const response = await http.get<{ ok: boolean; bridges: BridgeNode[] }>('/api/graphrag/bridges');
    return response.data.bridges || [];
  } catch {
    return [];
  }
}

/**
 * Get AI-generated insights
 */
export async function getInsights(): Promise<GraphInsight[]> {
  try {
    const response = await http.get<{ ok: boolean; insights: GraphInsight[] }>('/api/graph/insights');
    return response.data.insights || [];
  } catch {
    return [];
  }
}

// ============================================
// GRAPHRAG / AI FUNCTIONS
// ============================================

/**
 * Query using GraphRAG
 */
export async function graphRAGQuery(query: string, options?: {
  noCache?: boolean;
}): Promise<GraphRAGResponse> {
  try {
    const response = await http.post<GraphRAGResponse>('/api/graphrag/query', {
      query,
      noCache: options?.noCache,
    });
    return response.data;
  } catch (error) {
    return {
      ok: false,
      answer: 'Failed to process query',
      sources: [],
      queryType: 'hybrid',
      latencyMs: 0,
    };
  }
}

/**
 * Stream GraphRAG response (for AI Copilot)
 */
export function streamGraphRAGQuery(
  query: string,
  onChunk: (chunk: string) => void,
  onComplete: (response: GraphRAGResponse) => void,
  onError: (error: Error) => void
): () => void {
  const controller = new AbortController();
  
  fetchWithProject('/api/graphrag/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Stream request failed');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete({
                ok: true,
                answer: fullResponse,
                sources: [],
                queryType: 'hybrid',
                latencyMs: 0,
              });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                onChunk(parsed.content);
              }
            } catch {
              // Not JSON, treat as raw text
              fullResponse += data;
              onChunk(data);
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError(error);
      }
    });
  
  return () => controller.abort();
}

/**
 * Multi-hop reasoning query
 */
export async function multiHopQuery(query: string): Promise<MultiHopResult> {
  try {
    const response = await http.post<{ ok: boolean } & MultiHopResult>('/api/graphrag/multihop', { query });
    return response.data;
  } catch {
    return {
      answer: 'Failed to process multi-hop query',
      reasoningChain: [],
      confidence: 0,
    };
  }
}

/**
 * Explain connection between two nodes (LLM-powered)
 */
export async function explainConnection(nodeId1: string, nodeId2: string): Promise<{
  explanation: string;
  paths: Array<{ nodes: string[]; relationships: string[] }>;
  facts: string[];
}> {
  try {
    const response = await http.post<{
      ok: boolean;
      explanation: string;
      paths: Array<{ nodes: string[]; relationships: string[] }>;
      facts: string[];
    }>('/api/graphrag/explain', { nodeId1, nodeId2 });
    return response.data;
  } catch {
    return { explanation: 'Unable to explain connection', paths: [], facts: [] };
  }
}

/**
 * Summarize selected nodes (LLM-powered)
 */
export async function summarizeSelection(nodeIds: string[]): Promise<{
  summary: string;
  insights: string[];
  suggestedActions: string[];
}> {
  try {
    const response = await http.post<{
      ok: boolean;
      summary: string;
      insights: string[];
      suggestedActions: string[];
    }>('/api/graphrag/summarize', { nodeIds });
    return response.data;
  } catch {
    return { summary: 'Unable to generate summary', insights: [], suggestedActions: [] };
  }
}

/**
 * Natural language filter (LLM-powered)
 */
export async function naturalLanguageFilter(filterText: string): Promise<{
  filters: {
    entityTypes?: string[];
    properties?: Record<string, unknown>;
    cypher?: string;
  };
  explanation: string;
}> {
  try {
    const response = await http.post<{
      ok: boolean;
      filters: {
        entityTypes?: string[];
        properties?: Record<string, unknown>;
        cypher?: string;
      };
      explanation: string;
    }>('/api/graphrag/filter', { filterText });
    return response.data;
  } catch {
    return { filters: {}, explanation: 'Unable to parse filter' };
  }
}

/**
 * Suggest related nodes to explore
 */
export async function suggestRelated(nodeId: string): Promise<Array<{
  node: GraphNode;
  reason: string;
  relevance: number;
}>> {
  try {
    const response = await http.post<{
      ok: boolean;
      suggestions: Array<{ node: GraphNode; reason: string; relevance: number }>;
    }>('/api/graphrag/suggest-related', { nodeId });
    return response.data.suggestions || [];
  } catch {
    return [];
  }
}

// ============================================
// CYPHER QUERY FUNCTIONS
// ============================================

/**
 * Execute raw Cypher query
 */
export async function executeCypher(cypher: string): Promise<CypherQueryResult> {
  try {
    const response = await http.post<CypherQueryResult>('/api/graph/query', { cypher });
    return response.data;
  } catch (error) {
    return {
      ok: false,
      results: [],
      error: error instanceof Error ? error.message : 'Query failed',
    };
  }
}

/**
 * Get query templates
 */
export async function getQueryTemplates(): Promise<Array<{
  id: string;
  name: string;
  description: string;
  cypher: string;
  category: string;
}>> {
  try {
    const schema = await getOntologySchema();
    if (!schema?.queryPatterns) return [];
    
    return Object.entries(schema.queryPatterns).map(([id, pattern]) => ({
      id,
      name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: pattern.description,
      cypher: pattern.cypher,
      category: 'ontology',
    }));
  } catch {
    return [];
  }
}

// ============================================
// CROSS-PROJECT FUNCTIONS
// ============================================

/**
 * Get list of project graphs
 */
export async function getProjectGraphs(): Promise<Array<{
  graphName: string;
  projectId: string;
  projectName: string;
  nodeCount?: number;
  edgeCount?: number;
}>> {
  try {
    const response = await http.get<{ ok: boolean; graphs: Array<{
      graphName: string;
      projectId: string;
      projectName: string;
      nodeCount?: number;
      edgeCount?: number;
    }> }>('/api/graph/projects');
    return response.data.graphs || [];
  } catch {
    return [];
  }
}

/**
 * Get cross-project entity (shared entities)
 */
export async function getCrossProjectEntities(entityType: string): Promise<Array<{
  entity: GraphNode;
  projects: Array<{ id: string; name: string }>;
}>> {
  try {
    const response = await http.get<{
      ok: boolean;
      entities: Array<{ entity: GraphNode; projects: Array<{ id: string; name: string }> }>;
    }>(`/api/graph/cross-project/${entityType}`);
    return response.data.entities || [];
  } catch {
    return [];
  }
}

// ============================================
// SUPABASE PERSISTENCE - Query History
// ============================================

/**
 * Save query to history
 */
export async function saveQueryHistory(query: Omit<GraphQueryHistory, 'id' | 'project_id' | 'user_id' | 'created_at'>): Promise<GraphQueryHistory | null> {
  try {
    const response = await http.post<{ ok: boolean; query: GraphQueryHistory }>('/api/graph/queries', query);
    return response.data.query || null;
  } catch {
    return null;
  }
}

/**
 * Get query history
 */
export async function getQueryHistory(options?: {
  limit?: number;
  favoritesOnly?: boolean;
}): Promise<GraphQueryHistory[]> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.favoritesOnly) params.set('favorites', 'true');
    
    const response = await http.get<{ ok: boolean; queries: GraphQueryHistory[] }>(
      `/api/graph/queries?${params.toString()}`
    );
    return response.data.queries || [];
  } catch {
    return [];
  }
}

/**
 * Toggle query favorite
 */
export async function toggleQueryFavorite(queryId: string): Promise<boolean> {
  try {
    const response = await http.patch<{ ok: boolean }>(`/api/graph/queries/${queryId}/favorite`, {});
    return response.data.ok;
  } catch {
    return false;
  }
}

/**
 * Delete query from history
 */
export async function deleteQueryHistory(queryId: string): Promise<boolean> {
  try {
    const response = await http.delete<{ ok: boolean }>(`/api/graph/queries/${queryId}`);
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// SUPABASE PERSISTENCE - Saved Views
// ============================================

/**
 * Save current view
 */
export async function saveView(view: Omit<GraphSavedView, 'id' | 'project_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<GraphSavedView | null> {
  try {
    const response = await http.post<{ ok: boolean; view: GraphSavedView }>('/api/graph/views', view);
    return response.data.view || null;
  } catch {
    return null;
  }
}

/**
 * Get saved views
 */
export async function getSavedViews(): Promise<GraphSavedView[]> {
  try {
    const response = await http.get<{ ok: boolean; views: GraphSavedView[] }>('/api/graph/views');
    return response.data.views || [];
  } catch {
    return [];
  }
}

/**
 * Update saved view
 */
export async function updateView(viewId: string, updates: Partial<GraphSavedView>): Promise<boolean> {
  try {
    const response = await http.patch<{ ok: boolean }>(`/api/graph/views/${viewId}`, updates);
    return response.data.ok;
  } catch {
    return false;
  }
}

/**
 * Delete saved view
 */
export async function deleteView(viewId: string): Promise<boolean> {
  try {
    const response = await http.delete<{ ok: boolean }>(`/api/graph/views/${viewId}`);
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// SUPABASE PERSISTENCE - Bookmarks
// ============================================

/**
 * Add bookmark
 */
export async function addBookmark(bookmark: Omit<GraphBookmark, 'id' | 'project_id' | 'user_id' | 'created_at'>): Promise<GraphBookmark | null> {
  try {
    const response = await http.post<{ ok: boolean; bookmark: GraphBookmark }>('/api/graph/bookmarks', bookmark);
    return response.data.bookmark || null;
  } catch {
    return null;
  }
}

/**
 * Get bookmarks
 */
export async function getBookmarks(): Promise<GraphBookmark[]> {
  try {
    const response = await http.get<{ ok: boolean; bookmarks: GraphBookmark[] }>('/api/graph/bookmarks');
    return response.data.bookmarks || [];
  } catch {
    return [];
  }
}

/**
 * Update bookmark
 */
export async function updateBookmark(bookmarkId: string, updates: Partial<GraphBookmark>): Promise<boolean> {
  try {
    const response = await http.patch<{ ok: boolean }>(`/api/graph/bookmarks/${bookmarkId}`, updates);
    return response.data.ok;
  } catch {
    return false;
  }
}

/**
 * Remove bookmark
 */
export async function removeBookmark(bookmarkId: string): Promise<boolean> {
  try {
    const response = await http.delete<{ ok: boolean }>(`/api/graph/bookmarks/${bookmarkId}`);
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// SUPABASE PERSISTENCE - Annotations
// ============================================

/**
 * Create annotation
 */
export async function createAnnotation(annotation: Omit<GraphAnnotation, 'id' | 'project_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<GraphAnnotation | null> {
  try {
    const response = await http.post<{ ok: boolean; annotation: GraphAnnotation }>('/api/graph/annotations', annotation);
    return response.data.annotation || null;
  } catch {
    return null;
  }
}

/**
 * Get annotations
 */
export async function getAnnotations(options?: {
  targetType?: string;
  targetId?: string;
  includeShared?: boolean;
}): Promise<GraphAnnotation[]> {
  try {
    const params = new URLSearchParams();
    if (options?.targetType) params.set('targetType', options.targetType);
    if (options?.targetId) params.set('targetId', options.targetId);
    if (options?.includeShared) params.set('includeShared', 'true');
    
    const response = await http.get<{ ok: boolean; annotations: GraphAnnotation[] }>(
      `/api/graph/annotations?${params.toString()}`
    );
    return response.data.annotations || [];
  } catch {
    return [];
  }
}

/**
 * Update annotation
 */
export async function updateAnnotation(annotationId: string, updates: Partial<GraphAnnotation>): Promise<boolean> {
  try {
    const response = await http.patch<{ ok: boolean }>(`/api/graph/annotations/${annotationId}`, updates);
    return response.data.ok;
  } catch {
    return false;
  }
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(annotationId: string): Promise<boolean> {
  try {
    const response = await http.delete<{ ok: boolean }>(`/api/graph/annotations/${annotationId}`);
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// SUPABASE PERSISTENCE - Chat History
// ============================================

/**
 * Save chat message
 */
export async function saveChatMessage(message: Omit<GraphChatMessage, 'id' | 'project_id' | 'user_id' | 'created_at'>): Promise<GraphChatMessage | null> {
  try {
    const response = await http.post<{ ok: boolean; message: GraphChatMessage }>('/api/graph/chat', message);
    return response.data.message || null;
  } catch {
    return null;
  }
}

/**
 * Get chat sessions
 */
export async function getChatSessions(): Promise<Array<{
  sessionId: string;
  firstMessage: string;
  messageCount: number;
  lastActivity: string;
}>> {
  try {
    const response = await http.get<{
      ok: boolean;
      sessions: Array<{
        sessionId: string;
        firstMessage: string;
        messageCount: number;
        lastActivity: string;
      }>;
    }>('/api/graph/chat/sessions');
    return response.data.sessions || [];
  } catch {
    return [];
  }
}

/**
 * Get chat history for session
 */
export async function getChatHistory(sessionId: string): Promise<GraphChatMessage[]> {
  try {
    const response = await http.get<{ ok: boolean; messages: GraphChatMessage[] }>(
      `/api/graph/chat/session/${sessionId}`
    );
    return response.data.messages || [];
  } catch {
    return [];
  }
}

/**
 * Toggle message pin
 */
export async function toggleChatPin(messageId: string): Promise<boolean> {
  try {
    const response = await http.patch<{ ok: boolean }>(`/api/graph/chat/${messageId}/pin`, {});
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// SUPABASE PERSISTENCE - Snapshots
// ============================================

/**
 * Create snapshot
 */
export async function createSnapshot(snapshot: Omit<GraphSnapshot, 'id' | 'project_id' | 'user_id' | 'created_at'>): Promise<GraphSnapshot | null> {
  try {
    const response = await http.post<{ ok: boolean; snapshot: GraphSnapshot }>('/api/graph/snapshots', snapshot);
    return response.data.snapshot || null;
  } catch {
    return null;
  }
}

/**
 * Get snapshots
 */
export async function getSnapshots(): Promise<GraphSnapshot[]> {
  try {
    const response = await http.get<{ ok: boolean; snapshots: GraphSnapshot[] }>('/api/graph/snapshots');
    return response.data.snapshots || [];
  } catch {
    return [];
  }
}

/**
 * Get snapshot by ID
 */
export async function getSnapshot(snapshotId: string): Promise<GraphSnapshot | null> {
  try {
    const response = await http.get<{ ok: boolean; snapshot: GraphSnapshot }>(`/api/graph/snapshots/${snapshotId}`);
    return response.data.snapshot || null;
  } catch {
    return null;
  }
}

/**
 * Compare snapshots
 */
export async function compareSnapshots(snapshotId1: string, snapshotId2: string): Promise<{
  diff: {
    nodesAdded: GraphNode[];
    nodesRemoved: GraphNode[];
    edgesAdded: GraphEdge[];
    edgesRemoved: GraphEdge[];
    statsComparison: {
      nodeCountDiff: number;
      edgeCountDiff: number;
    };
  };
}> {
  try {
    const response = await http.get<{
      ok: boolean;
      diff: {
        nodesAdded: GraphNode[];
        nodesRemoved: GraphNode[];
        edgesAdded: GraphEdge[];
        edgesRemoved: GraphEdge[];
        statsComparison: { nodeCountDiff: number; edgeCountDiff: number };
      };
    }>(`/api/graph/snapshots/compare?id1=${snapshotId1}&id2=${snapshotId2}`);
    return response.data;
  } catch {
    return {
      diff: {
        nodesAdded: [],
        nodesRemoved: [],
        edgesAdded: [],
        edgesRemoved: [],
        statsComparison: { nodeCountDiff: 0, edgeCountDiff: 0 },
      },
    };
  }
}

/**
 * Delete snapshot
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  try {
    const response = await http.delete<{ ok: boolean }>(`/api/graph/snapshots/${snapshotId}`);
    return response.data.ok;
  } catch {
    return false;
  }
}

// ============================================
// TIMELINE FUNCTIONS (existing)
// ============================================

export async function getTimeline(options?: {
  startDate?: string;
  endDate?: string;
  types?: string[];
  limit?: number;
}): Promise<TimelineData> {
  try {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.types?.length) params.set('types', options.types.join(','));
    if (options?.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    const url = query ? `/api/timeline?${query}` : '/api/timeline';

    const response = await http.get<{
      events?: Array<Record<string, unknown>>;
      totalEvents?: number;
      startDate?: string;
      endDate?: string;
    }>(url);

    const raw = response.data.events || [];
    const events: TimelineEvent[] = raw.map((e: Record<string, unknown>) => ({
      id: String(e.id ?? ''),
      date: String(e.date ?? ''),
      title: String(e.title ?? ''),
      description: e.content != null ? String(e.content) : undefined,
      content: e.content != null ? String(e.content) : undefined,
      type: (e.type as TimelineEvent['type']) ?? 'document',
      entity_id: e.entity_id != null ? String(e.entity_id) : undefined,
      entity_type: e.entity_type != null ? String(e.entity_type) : undefined,
      metadata: (e.metadata as Record<string, unknown>) ?? undefined,
      user: e.owner != null ? String(e.owner) : e.user as string | undefined,
      actor: e.owner != null ? String(e.owner) : e.actor as string | undefined,
      owner: e.owner != null ? String(e.owner) : undefined,
      icon: e.icon as string | undefined,
      color: e.color as string | undefined,
      status: e.status as string | undefined,
    }));

    return {
      events,
      totalEvents: response.data.totalEvents ?? events.length,
      startDate: response.data.startDate ?? '',
      endDate: response.data.endDate ?? '',
    };
  } catch {
    return { events: [], startDate: '', endDate: '', totalEvents: 0 };
  }
}

export async function getEntityTimeline(entityType: string, entityId: string): Promise<TimelineEvent[]> {
  try {
    const response = await http.get<{ events: TimelineEvent[] }>(`/api/timeline/${entityType}/${entityId}`);
    return response.data.events || [];
  } catch {
    return [];
  }
}

// ============================================
// COST FUNCTIONS (existing)
// ============================================

export async function getCosts(options?: {
  startDate?: string;
  endDate?: string;
  provider?: string;
  model?: string;
}): Promise<LLMCost[]> {
  try {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.provider) params.set('provider', options.provider);
    if (options?.model) params.set('model', options.model);

    const query = params.toString();
    const url = query ? `/api/costs?${query}` : '/api/costs';

    const response = await http.get<{ costs: LLMCost[] }>(url);
    return response.data.costs || [];
  } catch {
    return [];
  }
}

export async function getCostSummary(period?: 'day' | 'week' | 'month' | 'all'): Promise<CostSummary> {
  try {
    const url = period ? `/api/costs/summary?period=${period}` : '/api/costs/summary';
    const response = await http.get<Record<string, unknown>>(url);
    const raw = response.data;
    if (!raw) {
      return {
        total: 0,
        byProvider: {},
        byModel: {},
        byOperation: {},
        period: { start: '', end: '' },
        dailyBreakdown: [],
      };
    }
    // Normalize snake_case from API to camelCase for frontend
    const dailyBreakdown = (raw.dailyBreakdown ?? raw.daily_breakdown) as Array<{ date: string; cost: number; calls?: number; requests?: number }> | undefined;
    const normalized = (dailyBreakdown ?? []).map((d) => ({
      date: d.date,
      cost: typeof d.cost === 'number' ? d.cost : parseFloat(String(d.cost)) || 0,
      calls: d.calls ?? d.requests ?? 0,
    }));
    return {
      total: typeof raw.total === 'number' ? raw.total : parseFloat(String(raw.total)) || 0,
      byProvider: (raw.byProvider ?? raw.by_provider ?? {}) as Record<string, number>,
      byModel: (raw.byModel ?? raw.by_model ?? {}) as Record<string, number>,
      byOperation: (raw.byOperation ?? raw.by_operation ?? {}) as Record<string, number>,
      byContext: (raw.byContext ?? raw.by_context) as Record<string, number> | undefined,
      period: (raw.period ?? { start: '', end: '' }) as { start: string; end: string },
      dailyBreakdown: normalized,
      totalInputTokens: (raw.totalInputTokens ?? raw.total_input_tokens) as number | undefined,
      totalOutputTokens: (raw.totalOutputTokens ?? raw.total_output_tokens) as number | undefined,
      previousPeriodCost: (raw.previousPeriodCost ?? raw.previous_period_cost) as number | null | undefined,
      percentChange: (raw.percentChange ?? raw.percent_change) as number | null | undefined,
      budgetLimit: (raw.budgetLimit ?? raw.budget_limit) as number | null | undefined,
      budgetUsedPercent: (raw.budgetUsedPercent ?? raw.budget_used_percent) as number | null | undefined,
      budgetAlertTriggered: (raw.budgetAlertTriggered ?? raw.budget_alert_triggered) as boolean | undefined,
    };
  } catch {
    return {
      total: 0,
      byProvider: {},
      byModel: {},
      byOperation: {},
      period: { start: '', end: '' },
      dailyBreakdown: [],
    };
  }
}

export interface RecentCostRequest {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  operation?: string;
  request_type?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  cost?: number;
  latency_ms?: number | null;
  success?: boolean;
}

export async function getRecentCostRequests(limit = 20): Promise<RecentCostRequest[]> {
  try {
    const response = await http.get<{ requests: RecentCostRequest[] }>(
      `/api/costs/recent?limit=${limit}`
    );
    return response.data?.requests ?? [];
  } catch {
    return [];
  }
}

export interface PricingRow {
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export async function getCostsPricing(): Promise<PricingRow[]> {
  try {
    const response = await http.get<{ pricing: PricingRow[] }>('/api/costs/pricing');
    return response.data?.pricing ?? [];
  } catch {
    return [];
  }
}

export interface CostBudget {
  period: 'week' | 'month';
  limitUsd: number;
  alertThresholdPercent: number;
  notifiedAt?: string | null;
}

export async function getCostsBudget(period: 'week' | 'month'): Promise<CostBudget | null> {
  try {
    const response = await http.get<{ budget: Record<string, unknown> | null }>(
      `/api/costs/budget?period=${period}`
    );
    const raw = response.data?.budget;
    if (!raw) return null;
    const limitUsd = (raw.limitUsd ?? raw.limit_usd) as number | undefined;
    const alertThresholdPercent = (raw.alertThresholdPercent ?? raw.alert_threshold_percent) as number | undefined;
    if (limitUsd == null || !Number.isFinite(Number(limitUsd))) return null;
    return {
      period: (raw.period as 'week' | 'month') ?? period,
      limitUsd: Number(limitUsd),
      alertThresholdPercent: alertThresholdPercent != null ? Math.min(100, Math.max(0, Number(alertThresholdPercent))) : 80,
      notifiedAt: (raw.notifiedAt ?? raw.notified_at) as string | null | undefined,
    };
  } catch {
    return null;
  }
}

export async function setCostsBudget(
  period: 'week' | 'month',
  limitUsd: number,
  alertThresholdPercent: number
): Promise<void> {
  await http.post('/api/costs/budget', {
    period,
    limitUsd,
    alertThresholdPercent,
  });
}

export async function getLLMConfig(): Promise<{
  provider: string;
  model: string;
  available: string[];
  limits?: Record<string, number>;
}> {
  try {
    const response = await http.get<{
      provider: string;
      model: string;
      available: string[];
      limits?: Record<string, number>;
    }>('/api/llm/config');
    return response.data;
  } catch {
    return { provider: 'unknown', model: 'unknown', available: [] };
  }
}

// ============================================
// SERVICE EXPORTS
// ============================================

export const graphService = {
  // Data
  getVisualizationData,
  getStats,
  getGraph,
  getEntityGraph,
  getRelated: getRelatedEntities,
  
  // Ontology
  getOntologySchema,
  getOntologyEntities,
  getOntologyRelations,
  getOntologySuggestions,
  approveOntologySuggestion,
  rejectOntologySuggestion,
  
  // Ontology SOTA v2.0
  getOntologyTypeStats,
  getOntologySyncStatus,
  forceOntologySync,
  runLLMAnalysis,
  autoApproveHighConfidence,
  getOntologyChanges,
  migrateOntologyToSupabase,
  
  // Background Worker (SOTA v2.1)
  getBackgroundWorkerStatus,
  triggerBackgroundAnalysis,
  getBackgroundWorkerLog,
  getOntologyJobs,
  toggleOntologyJob,
  
  // Ontology Extractor (SOTA v2.1)
  extractOntologyFromGraph,
  validateOntologyCompliance,
  getOntologyDiff,
  findUnusedOntologyTypes,
  mergeOntology,
  cleanupOntology,
  getFalkorDBBrowserInfo,
  
  // Graph Management (legacy names kept for compatibility)
  listAllFalkorDBGraphs,
  syncFalkorDBGraphs,
  deleteFalkorDBGraph,
  
  // Analytics
  getCommunities,
  getCentrality,
  getBridges,
  getInsights,
  
  // GraphRAG / AI
  query: graphRAGQuery,
  stream: streamGraphRAGQuery,
  multiHop: multiHopQuery,
  explainConnection,
  summarizeSelection,
  naturalLanguageFilter,
  suggestRelated,
  
  // Cypher
  executeCypher,
  getQueryTemplates,
  
  // Cross-project
  getProjectGraphs,
  getCrossProjectEntities,
  
  // Persistence - Queries
  saveQueryHistory,
  getQueryHistory,
  toggleQueryFavorite,
  deleteQueryHistory,
  
  // Persistence - Views
  saveView,
  getSavedViews,
  updateView,
  deleteView,
  
  // Persistence - Bookmarks
  addBookmark,
  getBookmarks,
  updateBookmark,
  removeBookmark,
  
  // Persistence - Annotations
  createAnnotation,
  getAnnotations,
  updateAnnotation,
  deleteAnnotation,
  
  // Persistence - Chat
  saveChatMessage,
  getChatSessions,
  getChatHistory,
  toggleChatPin,
  
  // Persistence - Snapshots
  createSnapshot,
  getSnapshots,
  getSnapshot,
  compareSnapshots,
  deleteSnapshot,
};

export const timelineService = {
  getAll: getTimeline,
  getTimeline, // Direct export for backwards compatibility
  getForEntity: getEntityTimeline,
};

export const costsService = {
  getAll: getCosts,
  getSummary: getCostSummary,
  getRecentRequests: getRecentCostRequests,
  getPricing: getCostsPricing,
  getBudget: getCostsBudget,
  setBudget: setCostsBudget,
  getLLMConfig,
};
