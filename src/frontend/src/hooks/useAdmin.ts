import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCurrentProjectId } from '../lib/api-client';
import type { HealthData, BriefingHistoryItem, TrendsData } from './useGodMode';
import { queryKeys } from './useGodMode';

function pid(): string { return getCurrentProjectId() ?? '__none__'; }

// ── Admin / System ──────────────────────────────────────────────────────────

export interface SystemStats {
  cpu: number;
  ram: number;
  disk: number;
  latency: number;
  storageBreakdown?: Array<{ category: string; size: number; color: string }>;
  totalStorage?: number;
  timestamp?: string;
}

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => apiClient.get<SystemStats>('/api/system/stats'),
  });
}

export function useSystemConfig() {
  return useQuery({
    queryKey: queryKeys.systemConfig,
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/system/config'),
  });
}

export function useUpdateSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value, category }: { key: string; value: unknown; category?: string }) =>
      apiClient.post<{ success: boolean }>('/api/system/config', { key, value, category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminProviders });
      qc.invalidateQueries({ queryKey: queryKeys.systemConfig });
    },
  });
}

export function useApplyPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: string) =>
      apiClient.post<{ success: boolean; preset: string; config: unknown }>('/api/system/preset', { preset }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminProviders }),
  });
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: queryKeys.adminAudit,
    queryFn: () =>
      apiClient.get<{ logs: Array<{
        id: string;
        config_key?: string;
        table_name?: string;
        action?: string;
        operation?: string;
        new_value?: unknown;
        old_value?: unknown;
        changed_by_email?: string;
        changed_at: string;
      }> }>('/api/system/audit'),
  });
}

// ── System Prompts ──────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
  variables: string[];
  lastModified: string;
  isActive: boolean;
  description?: string;
}

export function useSystemPrompts() {
  return useQuery({
    queryKey: ['systemPrompts'],
    queryFn: () => apiClient.get<{ templates: PromptTemplate[] }>('/api/system/prompts'),
  });
}

export function useSavePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, prompt, change_reason, is_active, description }: {
      key: string; prompt?: string; change_reason?: string; is_active?: boolean; description?: string;
    }) => apiClient.put<{ success: boolean }>(`/api/system/prompts/${key}`, { prompt, change_reason, is_active, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['systemPrompts'] });
      qc.invalidateQueries({ queryKey: ['promptVersions'] });
    },
  });
}

export function usePromptVersions(key: string | null) {
  return useQuery({
    queryKey: ['promptVersions', key],
    queryFn: () => apiClient.get<{ current_version?: number; versions: Array<{ id: string; version: number; created_at: string; created_by?: string; change_reason?: string }> }>(
      `/api/system/prompts/${key}/versions`
    ),
    enabled: !!key,
  });
}

export function usePromptVersionContent(key: string | null, version: number | null) {
  return useQuery({
    queryKey: ['promptVersionContent', key, version],
    queryFn: () => apiClient.get<{ version: { prompt_template: string; version: number; created_at: string; change_reason?: string } }>(
      `/api/system/prompts/${key}/versions/${version}`
    ),
    enabled: !!key && version != null,
  });
}

export function useRestorePromptVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, version }: { key: string; version: number }) =>
      apiClient.post<{ success: boolean }>(`/api/system/prompts/${key}/restore`, { version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['systemPrompts'] });
      qc.invalidateQueries({ queryKey: ['promptVersions'] });
    },
  });
}

export function usePromptPreview(type: string | null) {
  return useQuery({
    queryKey: ['promptPreview', type],
    queryFn: () => apiClient.get<{ ok: boolean; type: string; prompt: unknown; ontologyContext: unknown }>(
      `/api/prompts/preview?type=${type}`
    ),
    enabled: !!type,
  });
}

export function useOntologyContext() {
  return useQuery({
    queryKey: ['ontologyContext'],
    queryFn: () => apiClient.get<{ ok: boolean; entityTypes: unknown[]; relationTypes: unknown[] }>('/api/prompts/ontology'),
  });
}

// ── System Users ────────────────────────────────────────────────────────────

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastActive?: string;
  joinedAt?: string;
  avatar?: string;
}

export function useSystemUsers() {
  return useQuery({
    queryKey: ['systemUsers'],
    queryFn: () => apiClient.get<{ ok: boolean; users: SystemUser[]; stats: { totalUsers: number; activeUsers: number; pendingInvitations: number } }>(
      '/api/system/users'
    ),
  });
}

export function useCreateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password?: string; name: string; role: string }) =>
      apiClient.post<{ ok: boolean }>('/api/system/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['systemUsers'] }),
  });
}

export function useUpdateSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; role?: string; status?: string; email?: string; password?: string }) =>
      apiClient.put<{ ok: boolean }>(`/api/system/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['systemUsers'] }),
  });
}

export function useDeleteSystemUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ ok: boolean }>(`/api/system/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['systemUsers'] }),
  });
}

// ── Health ──────────────────────────────────────────────────────────────────

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.get<HealthData>('/api/sot/health'),
    staleTime: 60_000,
  });
}

// ── Briefing History ────────────────────────────────────────────────────────

export function useBriefingHistory(limit = 10) {
  return useQuery({
    queryKey: queryKeys.briefingHistory,
    queryFn: () =>
      apiClient.get<{ ok: boolean; history: BriefingHistoryItem[]; total: number }>(
        `/api/briefing/history?limit=${limit}`
      ),
  });
}

// ── Trends ──────────────────────────────────────────────────────────────────

export function useTrends(days = 7) {
  return useQuery({
    queryKey: queryKeys.trends(days),
    queryFn: () => apiClient.get<TrendsData>(`/api/trends?days=${days}`),
    staleTime: 60_000,
  });
}

// ── Costs Summary ────────────────────────────────────────────────────────────

export interface CostsSummary {
  total: number;
  byProvider?: Record<string, number>;
  byModel?: Record<string, number>;
  byOperation?: Record<string, number>;
  byContext?: Record<string, number>;
  period?: { start: string; end: string };
  dailyBreakdown?: Array<{ date: string; cost: number; calls: number }>;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  previousPeriodCost?: number | null;
  percentChange?: number | null;
  budgetLimit?: number | null;
  budgetUsedPercent?: number | null;
  budgetAlertTriggered?: boolean;
}

export function useCostsSummary(period = 'month') {
  return useQuery({
    queryKey: queryKeys.costsSummary(period),
    queryFn: () => apiClient.get<CostsSummary>(`/api/costs/summary?period=${period}`),
    staleTime: 120_000,
  });
}

export function useRecentLLMRequests(limit = 20) {
  return useQuery({
    queryKey: ['costsRecent', limit],
    queryFn: () => apiClient.get<{ requests: Array<Record<string, unknown>> }>(`/api/costs/recent?limit=${limit}`),
    staleTime: 30_000,
  });
}

export function useModelStats() {
  return useQuery({
    queryKey: ['costsModels'],
    queryFn: () => apiClient.get<{ models: Array<Record<string, unknown>> }>('/api/costs/models'),
    staleTime: 120_000,
  });
}

export function usePricingTable() {
  return useQuery({
    queryKey: ['costsPricing'],
    queryFn: () => apiClient.get<{ pricing: Array<{ model: string; inputPer1M: number; outputPer1M: number }> }>('/api/costs/pricing'),
    staleTime: 300_000,
  });
}

export function useBudget(period = 'month') {
  return useQuery({
    queryKey: ['costsBudget', period],
    queryFn: () => apiClient.get<{ budget: { limit_usd: number; alert_threshold_percent: number; period: string; current_spend?: number } | null }>(`/api/costs/budget?period=${period}`),
    staleTime: 60_000,
  });
}

export function useSetBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { period: string; limit_usd: number; alert_threshold_percent?: number }) =>
      apiClient.post('/api/costs/budget', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costsBudget'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.costsSummary('month') });
    },
  });
}

export function useResetCosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/api/costs/reset'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costs('month') });
      queryClient.invalidateQueries({ queryKey: queryKeys.costsSummary('month') });
      queryClient.invalidateQueries({ queryKey: ['costsRecent'] });
      queryClient.invalidateQueries({ queryKey: ['costsModels'] });
    },
  });
}

// ── Notifications Count ──────────────────────────────────────────────────────

export function useNotificationsCount() {
  return useQuery({
    queryKey: queryKeys.notificationsCount,
    queryFn: () => apiClient.get<{ count: number }>('/api/notifications/count'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── SOT Alerts ───────────────────────────────────────────────────────────────

export interface SotAlert {
  type: string;
  severity: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export function useSotAlerts() {
  return useQuery({
    queryKey: queryKeys.sotAlerts,
    queryFn: () => apiClient.get<{ alerts: SotAlert[] }>('/api/sot/alerts'),
    staleTime: 60_000,
  });
}

export function useSotInsights() {
  return useQuery({
    queryKey: ['sotInsights'],
    queryFn: () => apiClient.get<{ insights: Array<Record<string, unknown>> }>('/api/sot/insights'),
    staleTime: 60_000,
  });
}

export function useSotDelta() {
  return useQuery({
    queryKey: ['sotDelta'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/sot/delta'),
    staleTime: 60_000,
  });
}

export function useSotTimeline(limit = 50) {
  return useQuery({
    queryKey: ['sotTimeline', limit],
    queryFn: () => apiClient.get<{ timeline: Array<Record<string, unknown>> }>(`/api/sot/timeline?limit=${limit}`),
    staleTime: 60_000,
  });
}

export function useSotEnhanced() {
  return useQuery({
    queryKey: ['sotEnhanced'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/sot/enhanced'),
    staleTime: 120_000,
  });
}

export function useSotVersions() {
  return useQuery({
    queryKey: ['sotVersions'],
    queryFn: () => apiClient.get<{ versions: Array<Record<string, unknown>> }>('/api/sot/versions'),
  });
}

export function useSotCompare(v1: string | number, v2: string | number) {
  return useQuery({
    queryKey: ['sotCompare', v1, v2],
    queryFn: () => apiClient.get<Record<string, unknown>>(`/api/sot/compare?v1=${v1}&v2=${v2}`),
    enabled: !!v1 && !!v2,
  });
}

export function useSotGenerateSummary() {
  return useMutation({
    mutationFn: () => apiClient.post<{ content?: string; summary?: string }>('/api/sot/executive-summary', {}),
  });
}

// ── Emails Needing Response ──────────────────────────────────────────────────

export interface EmailNeedingResponse {
  id: string;
  subject?: string;
  from?: string;
  from_name?: string;
  received_at?: string;
  snippet?: string;
  [key: string]: unknown;
}

export function useEmailsNeedingResponse() {
  return useQuery({
    queryKey: queryKeys.emailsNeedingResponse,
    queryFn: () => apiClient.get<{ ok: boolean; emails: EmailNeedingResponse[]; count: number }>(
      '/api/emails/needing-response'
    ),
    staleTime: 60_000,
  });
}

// ── Sprints ──────────────────────────────────────────────────────────────────

export interface Sprint {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  goal?: string;
  context?: string;
  [key: string]: unknown;
}

export function useSprints() {
  return useQuery({
    queryKey: queryKeys.sprints,
    queryFn: () => apiClient.get<{ sprints: Sprint[] }>('/api/sprints'),
    staleTime: 60_000,
  });
}

// ── Conflicts ────────────────────────────────────────────────────────────────

export interface Conflict {
  fact_a?: string;
  fact_b?: string;
  decision_a?: string;
  decision_b?: string;
  explanation?: string;
  severity?: string;
  [key: string]: unknown;
}

export function useConflicts() {
  return useQuery({
    queryKey: queryKeys.conflicts,
    queryFn: () => apiClient.get<{ conflicts: Conflict[]; analyzed_facts?: number; message?: string }>(
      '/api/conflicts'
    ),
    staleTime: 300_000,
  });
}

// ── Contacts Stats ───────────────────────────────────────────────────────────

export interface ContactsStats {
  total: number;
  byOrganization?: Record<string, number>;
  byTag?: Record<string, number>;
  tags?: string[];
  teams?: number;
  knowledgePeople?: number;
  unmatchedCount?: number;
}

export function useContactsStats() {
  return useQuery({
    queryKey: queryKeys.contactsStats,
    queryFn: () => apiClient.get<ContactsStats & { ok: boolean }>('/api/contacts/stats'),
    staleTime: 60_000,
  });
}

// ── Conversations Stats ──────────────────────────────────────────────────────

export interface ConversationsStats {
  total: number;
  bySource?: Record<string, number>;
  totalMessages?: number;
}

export function useConversationsStats() {
  return useQuery({
    queryKey: queryKeys.conversationsStats,
    queryFn: () => apiClient.get<ConversationsStats & { ok: boolean }>('/api/conversations/stats'),
    staleTime: 60_000,
  });
}

// ── Sync Dashboard ───────────────────────────────────────────────────────────

export interface SyncDashboard {
  summary?: {
    totalDeletes?: number;
    totalRestores?: number;
    graphSyncRate?: string;
    avgDuration?: string;
  };
  byType?: Record<string, number>;
  health?: {
    graphSync?: string;
    performance?: string;
  };
  [key: string]: unknown;
}

export function useSyncDashboard() {
  return useQuery({
    queryKey: queryKeys.syncDashboard,
    queryFn: () => apiClient.get<{ ok: boolean; dashboard: SyncDashboard }>('/api/sync/stats/dashboard'),
    staleTime: 120_000,
  });
}

// ── Admin: LLM Providers & Models ───────────────────────────────────────────

export function useLLMProviders() {
  return useQuery({
    queryKey: ['llmProviders'],
    queryFn: () => apiClient.get<unknown>('/api/llm/providers'),
  });
}

// System provider key status from Supabase secrets (shows which are configured + masked keys)
export function useSystemProviderKeys() {
  return useQuery({
    queryKey: ['systemProviderKeys'],
    queryFn: () => apiClient.get<{ ok: boolean; providers: Array<{ id: string; aliases?: string[]; name?: string; configured: boolean; source: string | null; masked: string | null }> }>('/api/system/providers'),
  });
}

export function useSaveSystemProviderKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: string; apiKey: string }) =>
      apiClient.post<{ ok: boolean; provider: string }>('/api/system/providers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['systemProviderKeys'] });
      qc.invalidateQueries({ queryKey: ['llmProviders'] });
      qc.invalidateQueries({ queryKey: queryKeys.projectConfig });
    },
  });
}

export function useLLMModels() {
  return useQuery({
    queryKey: ['llmModels'],
    queryFn: () => apiClient.get<unknown>('/api/llm/models'),
  });
}

export function useLLMMetadataModels() {
  return useQuery({
    queryKey: ['llmMetadataModels'],
    queryFn: () => apiClient.get<unknown>('/api/llm/metadata/models'),
  });
}

export function useLLMMetadataStatus() {
  return useQuery({
    queryKey: ['llmMetadataStatus'],
    queryFn: () => apiClient.get<unknown>('/api/llm/metadata/status'),
  });
}

export function useLLMMetadataSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/llm/metadata/sync', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llmModels'] });
      qc.invalidateQueries({ queryKey: ['llmMetadataModels'] });
      qc.invalidateQueries({ queryKey: ['llmMetadataStatus'] });
    },
  });
}

export function useLLMCapabilities() {
  return useQuery({
    queryKey: ['llmCapabilities'],
    queryFn: () => apiClient.get<unknown>('/api/llm/capabilities'),
  });
}

export function useLLMRoutingStatus() {
  return useQuery({
    queryKey: ['llmRoutingStatus'],
    queryFn: () => apiClient.get<unknown>('/api/llm/routing/status'),
  });
}

export function useUpdateLLMRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post<unknown>('/api/llm/routing/config', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['llmRoutingStatus'] }); qc.invalidateQueries({ queryKey: ['llmProviders'] }); },
  });
}

export function useTestLLMProvider() {
  return useMutation({
    mutationFn: (provider: string) => apiClient.post<unknown>(`/api/llm/test/${provider}`, {}),
  });
}

// ── Admin: LLM Queue ────────────────────────────────────────────────────────

export function useLLMQueueStatus() {
  return useQuery({
    queryKey: ['llmQueueStatus'],
    queryFn: () => apiClient.get<unknown>('/api/llm/queue/status'),
    refetchInterval: (query) => {
      const data = query.state.data as Record<string, unknown> | undefined;
      const queueSize = Number(data?.pending ?? data?.queue_size ?? 0);
      return queueSize > 0 ? 5_000 : 30_000;
    },
  });
}

export function useLLMQueuePending() {
  return useQuery({
    queryKey: ['llmQueuePending'],
    queryFn: () => apiClient.get<unknown>('/api/llm/queue/pending'),
  });
}

export function useLLMQueueRetryable() {
  return useQuery({
    queryKey: ['llmQueueRetryable'],
    queryFn: () => apiClient.get<unknown>('/api/llm/queue/retryable'),
  });
}

export function useLLMQueueHistory() {
  return useQuery({
    queryKey: ['llmQueueHistory'],
    queryFn: () => apiClient.get<unknown>('/api/llm/queue/history'),
  });
}

export function useLLMQueueAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id }: { action: string; id?: string }) => {
      const url = id ? `/api/llm/queue/${action}/${id}` : `/api/llm/queue/${action}`;
      return apiClient.post<unknown>(url, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llmQueueStatus'] });
      qc.invalidateQueries({ queryKey: ['llmQueuePending'] });
      qc.invalidateQueries({ queryKey: ['llmQueueRetryable'] });
      qc.invalidateQueries({ queryKey: ['llmQueueHistory'] });
    },
  });
}

// ── Admin: Graph Settings ───────────────────────────────────────────────────

export function useGraphConfig() {
  return useQuery({
    queryKey: ['graphConfig'],
    queryFn: () => apiClient.get<unknown>('/api/graph/config'),
  });
}

export function useGraphStatus() {
  return useQuery({
    queryKey: ['graphStatus'],
    queryFn: () => apiClient.get<unknown>('/api/graph/status'),
  });
}

export function useGraphInsights() {
  return useQuery({
    queryKey: ['graphInsights'],
    queryFn: () => apiClient.get<unknown>('/api/graph/insights'),
  });
}

export function useGraphList() {
  return useQuery({
    queryKey: ['graphList'],
    queryFn: () => apiClient.get<unknown>('/api/graph/list'),
  });
}

export function useGraphMultiStats() {
  return useQuery({
    queryKey: ['graphMultiStats'],
    queryFn: () => apiClient.get<unknown>('/api/graph/multi-stats'),
  });
}

export function useGraphSyncStatus() {
  return useQuery({
    queryKey: ['graphSyncStatus'],
    queryFn: () => apiClient.get<unknown>('/api/graph/sync/status'),
  });
}

export function useGraphProviders() {
  return useQuery({
    queryKey: ['graphProviders'],
    queryFn: () => apiClient.get<unknown>('/api/graph/providers'),
  });
}

export function useGraphConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post<unknown>('/api/graph/connect', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graphStatus'] });
      qc.invalidateQueries({ queryKey: ['graphConfig'] });
    },
  });
}

export function useGraphTest() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post<unknown>('/api/graph/test', body),
  });
}

export function useGraphSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/graph/sync', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graphStatus'] }),
  });
}

export function useGraphFullSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/graph/sync/full', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graphStatus'] });
      qc.invalidateQueries({ queryKey: ['graphSyncStatus'] });
    },
  });
}

export function useGraphCreateIndexes() {
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/graph/indexes', {}),
  });
}

export function useGraphCleanupOrphans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/graph/cleanup-orphans', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graphList'] }),
  });
}

export function useGraphCleanupDuplicates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/graph/cleanup-duplicates', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graphStatus'] }),
  });
}

export function useGraphSyncCleanup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/graph/sync/cleanup', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graphStatus'] }),
  });
}

export function useGraphDeleteGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (graphName: string) => apiClient.delete<unknown>(`/api/graph/delete/${encodeURIComponent(graphName)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graphList'] }),
  });
}

export function useGraphQuery() {
  return useMutation({
    mutationFn: (body: { query: string }) => apiClient.post<unknown>('/api/graph/query', body),
  });
}

export function useGraphSyncProjects() {
  return useMutation({
    mutationFn: (body?: { projectIds?: string[] }) => apiClient.post<unknown>('/api/graph/sync-projects', body || {}),
  });
}

// ── GraphRAG ─────────────────────────────────────────────────────────────────

export function useGraphRAGQuery() {
  return useMutation({
    mutationFn: (data: { query: string; options?: Record<string, unknown> }) =>
      apiClient.post<{ ok: boolean; answer?: string; sources?: unknown[]; cypherUsed?: string; reasoning?: string[] }>('/api/graphrag/query', data),
  });
}

export function useGraphRAGCommunities() {
  return useQuery({
    queryKey: ['graphragCommunities'],
    queryFn: () => apiClient.get<{ ok: boolean; communities: Array<Record<string, unknown>> }>('/api/graphrag/communities'),
    staleTime: 120_000,
  });
}

export function useGraphRAGCentrality() {
  return useQuery({
    queryKey: ['graphragCentrality'],
    queryFn: () => apiClient.get<{ ok: boolean; nodes: Array<Record<string, unknown>> }>('/api/graphrag/centrality'),
    staleTime: 120_000,
  });
}

export function useGraphRAGBridges() {
  return useQuery({
    queryKey: ['graphragBridges'],
    queryFn: () => apiClient.get<{ ok: boolean; bridges: Array<Record<string, unknown>> }>('/api/graphrag/bridges'),
    staleTime: 120_000,
  });
}

export function useGraphRAGEnhanceQuery() {
  return useMutation({
    mutationFn: (data: { query: string }) =>
      apiClient.post<{ ok: boolean; cypher?: string; explanation?: string }>('/api/graphrag/enhance-query', data),
  });
}

// ── Admin: Ontology ─────────────────────────────────────────────────────────

export function useOntologySchema() {
  return useQuery({
    queryKey: ['ontologySchema'],
    queryFn: () => apiClient.get<unknown>('/api/ontology'),
  });
}

export function useOntologyStats() {
  return useQuery({
    queryKey: ['ontologyStats'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/stats'),
  });
}

export function useOntologyEntities() {
  return useQuery({
    queryKey: ['ontologyEntities'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/entities'),
  });
}

export function useOntologyRelations() {
  return useQuery({
    queryKey: ['ontologyRelations'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/relations'),
  });
}

export function useOntologySuggestions() {
  return useQuery({
    queryKey: ['ontologySuggestions'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/suggestions'),
  });
}

export function useOntologyWorkerStatus() {
  return useQuery({
    queryKey: ['ontologyWorkerStatus'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/worker/status'),
  });
}

export function useOntologySyncStatus() {
  return useQuery({
    queryKey: ['ontologySyncStatus'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/sync/status'),
  });
}

export function useOntologyChanges() {
  return useQuery({
    queryKey: ['ontologyChanges'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/changes'),
  });
}

export function useOntologyCompliance() {
  return useQuery({
    queryKey: ['ontologyCompliance'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/validate-compliance'),
    enabled: false,
  });
}

export function useOntologyDiff() {
  return useQuery({
    queryKey: ['ontologyDiff'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/diff'),
    enabled: false,
  });
}

export function useOntologyUnused() {
  return useQuery({
    queryKey: ['ontologyUnused'],
    queryFn: () => apiClient.get<unknown>('/api/ontology/unused-types'),
    enabled: false,
  });
}

export function useOntologyAnalyzeGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/ontology/analyze-graph', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ontologySuggestions'] }),
  });
}

export function useOntologyForceSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/ontology/sync/force', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ontologySyncStatus'] }),
  });
}

export function useOntologyApproveSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; [k: string]: unknown }) =>
      apiClient.post<unknown>(`/api/ontology/suggestions/${id}/approve`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ontologySuggestions'] });
      qc.invalidateQueries({ queryKey: ['ontologySchema'] });
    },
  });
}

export function useOntologyRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.post<unknown>(`/api/ontology/suggestions/${id}/reject`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ontologySuggestions'] }),
  });
}

export function useOntologyAutoApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { minConfidence?: number }) =>
      apiClient.post<unknown>('/api/ontology/suggestions/auto-approve', opts || {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ontologySuggestions'] });
      qc.invalidateQueries({ queryKey: ['ontologySchema'] });
    },
  });
}

export function useOntologyWorkerTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: string }) =>
      apiClient.post<unknown>('/api/ontology/worker/trigger', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ontologyWorkerStatus'] }),
  });
}

export function useOntologyCleanup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { entities?: string[]; relations?: string[] }) =>
      apiClient.post<unknown>('/api/ontology/cleanup', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ontologySchema'] });
      qc.invalidateQueries({ queryKey: ['ontologyStats'] });
    },
  });
}

export function useOntologyInferRelationships() {
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/ontology/infer-relationships', {}),
  });
}

export function useOntologyAddEntityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; properties?: unknown[]; color?: string }) =>
      apiClient.post<unknown>('/api/ontology/entity-type', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ontologySchema'] }),
  });
}

export function useOntologyAddRelationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; from?: string; to?: string }) =>
      apiClient.post<unknown>('/api/ontology/relation-type', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ontologySchema'] }),
  });
}

// ── Admin: Team Analysis Config ─────────────────────────────────────────────

export function useTeamAnalysisConfig() {
  return useQuery({
    queryKey: ['teamAnalysisConfig'],
    queryFn: () => apiClient.get<unknown>('/api/team-analysis/config'),
  });
}

export function useUpdateTeamAnalysisConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.put<unknown>('/api/team-analysis/config', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamAnalysisConfig'] }),
  });
}

// ── Admin: Google Drive ─────────────────────────────────────────────────────

export function useGoogleDriveAdmin() {
  return useQuery({
    queryKey: ['googleDriveAdmin'],
    queryFn: () => apiClient.get<unknown>('/api/system/google-drive'),
  });
}

export function useUpdateGoogleDriveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post<unknown>('/api/system/google-drive', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['googleDriveAdmin'] }),
  });
}

export function useGoogleDriveSync() {
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/google-drive/sync', {}),
  });
}

export function useGoogleDriveBootstrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/system/google-drive/bootstrap-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['googleDriveAdmin'] }),
  });
}

// ── Admin: Billing ──────────────────────────────────────────────────────────

export function useBillingProjects() {
  return useQuery({
    queryKey: ['billingProjects'],
    queryFn: () => apiClient.get<unknown>('/api/admin/billing/projects'),
  });
}

export function useBillingPricing() {
  return useQuery({
    queryKey: ['billingPricing'],
    queryFn: () => apiClient.get<unknown>('/api/admin/billing/pricing'),
  });
}

export function useUpdateBillingPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post<unknown>('/api/admin/billing/pricing', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billingPricing'] }),
  });
}

export function useBillingPricingTiers() {
  return useQuery({
    queryKey: ['billingPricingTiers'],
    queryFn: () => apiClient.get<unknown>('/api/admin/billing/pricing/tiers'),
  });
}

export function useUpdateBillingPricingTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tiers: unknown[] }) => apiClient.post<unknown>('/api/admin/billing/pricing/tiers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billingPricingTiers'] }),
  });
}

export function useBillingExchangeRate() {
  return useQuery({
    queryKey: ['billingExchangeRate'],
    queryFn: () => apiClient.get<unknown>('/api/admin/billing/exchange-rate'),
  });
}

export function useUpdateExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { auto: boolean; manualRate?: number }) => apiClient.post<unknown>('/api/admin/billing/exchange-rate', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billingExchangeRate'] }),
  });
}

export function useRefreshExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/admin/billing/exchange-rate/refresh', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billingExchangeRate'] }),
  });
}

export function useBillingProjectAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, action, data }: { projectId: string; action: string; data?: Record<string, unknown> }) =>
      apiClient.post<unknown>(`/api/admin/billing/projects/${projectId}/${action}`, data || {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billingProjects'] }),
  });
}

// ── Admin: Audit Logs ───────────────────────────────────────────────────────

export function useAdminAuditLogs(params?: { page?: number; limit?: number; search?: string; filter?: string }) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.filter) qs.set('filter', params.filter);
  const query = qs.toString();
  return useQuery({
    queryKey: ['adminAuditLogs', params],
    queryFn: () => apiClient.get<unknown>(`/api/admin/audit/logs${query ? `?${query}` : ''}`),
  });
}

// ── Admin: Ollama ───────────────────────────────────────────────────────────

export function useOllamaModels() {
  return useQuery({
    queryKey: ['ollamaModels'],
    queryFn: () => apiClient.get<unknown>('/api/ollama/models'),
    enabled: false,
  });
}

export function useOllamaTest() {
  return useQuery({
    queryKey: ['ollamaTest'],
    queryFn: () => apiClient.get<unknown>('/api/ollama/test'),
    enabled: false,
  });
}
