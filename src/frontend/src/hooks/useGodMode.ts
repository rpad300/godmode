/**
 * Purpose:
 *   Central collection of React Query hooks that cover every API domain
 *   in the GodMode application: dashboard, projects, files, processing,
 *   entities (questions, facts, risks, actions, decisions), contacts,
 *   chat, team analysis, costs, emails, admin, API keys, webhooks,
 *   audit/history, documents, briefing, and project configuration.
 *
 * Responsibilities:
 *   - Define canonical query keys (queryKeys) for cache identity
 *   - Provide useQuery hooks for read operations with appropriate staleTime / refetchInterval
 *   - Provide useMutation hooks that invalidate related caches on success
 *   - Export TypeScript interfaces for each API response shape
 *
 * Key dependencies:
 *   - @tanstack/react-query: query/mutation lifecycle
 *   - lib/api-client: authenticated HTTP methods (get, post, put, delete, upload)
 *
 * Side effects:
 *   - All hooks trigger network requests; mutations invalidate query caches
 *   - usePendingFiles polls every 10s; useProcessStatus polls every 3s
 *
 * Notes:
 *   - Entity CRUD hooks (questions, facts, etc.) follow the same pattern:
 *     list, create, update, delete with dashboard/stats invalidation on write.
 *   - Some response interfaces use [key: string]: unknown for extensibility;
 *     tighten these as the API contracts stabilise.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCurrentProjectId } from '../lib/api-client';
import { supabase as supabaseClient } from '../lib/supabase';

// ── Query Keys ──────────────────────────────────────────────────────────────
// Every project-scoped key includes the current projectId for cache isolation.
// Getters ensure the projectId is read at call-time, not at module-load time.

function pid(): string { return getCurrentProjectId() ?? '__none__'; }

export const queryKeys = {
  get dashboard() { return ['dashboard', pid()] as const; },
  get stats() { return ['stats', pid()] as const; },
  get questions() { return ['questions', pid()] as const; },
  get facts() { return ['facts', pid()] as const; },
  get risks() { return ['risks', pid()] as const; },
  get actions() { return ['actions', pid()] as const; },
  get decisions() { return ['decisions', pid()] as const; },
  get contacts() { return ['contacts', pid()] as const; },
  get files() { return ['files', pid()] as const; },
  get documents() { return ['documents', pid()] as const; },
  get pendingFiles() { return ['pendingFiles', pid()] as const; },
  get projects() { return ['projects'] as const; },
  get chatHistory() { return ['chatHistory', pid()] as const; },
  get teamAnalysis() { return ['teamAnalysis', pid()] as const; },
  get graph() { return ['graph', pid()] as const; },
  costs: (period: string) => ['costs', period, pid()] as const,
  get history() { return ['history', pid()] as const; },
  get emails() { return ['emails', pid()] as const; },
  get processStatus() { return ['processStatus', pid()] as const; },
  get adminStats() { return ['adminStats'] as const; },
  get adminProviders() { return ['adminProviders'] as const; },
  get adminAudit() { return ['adminAudit', pid()] as const; },
  get health() { return ['health'] as const; },
  get briefingHistory() { return ['briefingHistory', pid()] as const; },
  trends: (days: number) => ['trends', days, pid()] as const,
  costsSummary: (period: string) => ['costsSummary', period, pid()] as const,
  get notificationsCount() { return ['notificationsCount', pid()] as const; },
  get notifications() { return ['notifications', pid()] as const; },
  get sotAlerts() { return ['sotAlerts', pid()] as const; },
  get emailsNeedingResponse() { return ['emailsNeedingResponse', pid()] as const; },
  get sprints() { return ['sprints', pid()] as const; },
  sprintDetail: (id: string) => ['sprint', id, pid()] as const,
  get chatSessions() { return ['chatSessions', pid()] as const; },
  chatMessages: (sessionId: string) => ['chatMessages', sessionId, pid()] as const,
  get conflicts() { return ['conflicts', pid()] as const; },
  get contactsStats() { return ['contactsStats', pid()] as const; },
  get conversations() { return ['conversations', pid()] as const; },
  get conversationsStats() { return ['conversationsStats', pid()] as const; },
  get syncDashboard() { return ['syncDashboard', pid()] as const; },
  get systemConfig() { return ['systemConfig'] as const; },
  get knowledgeStatus() { return ['knowledgeStatus', pid()] as const; },
  get deletedFacts() { return ['deletedFacts', pid()] as const; },
  get deletedDecisions() { return ['deletedDecisions', pid()] as const; },
  get deletedRisks() { return ['deletedRisks', pid()] as const; },
  get deletedActions() { return ['deletedActions', pid()] as const; },
  get sotVersions() { return ['sotVersions', pid()] as const; },
  get timeline() { return ['timeline', pid()] as const; },
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface DashboardData {
  stats?: {
    questions?: number;
    facts?: number;
    decisions?: number;
    risks?: number;
    actions?: number;
    contacts?: number;
    documents?: number;
  };
  recentActivity?: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
  documents?: { total?: number; processed?: number; pending?: number };
  totalFacts?: number;
  totalQuestions?: number;
  totalRisks?: number;
  totalActions?: number;
  totalDecisions?: number;
  totalPeople?: number;
  overdueActions?: number;
  factsVerifiedCount?: number;
  factsByCategory?: Record<string, number>;
  actionsByStatus?: Record<string, number>;
  risksByImpact?: Record<string, number>;
  questionsByPriority?: Record<string, number>;
  questionAging?: { fresh?: number; aging?: number; stale?: number; critical?: number };
  weeklyActivity?: Array<{ date: string; facts?: number; questions?: number; risks?: number; actions?: number }>;
  trends?: Record<string, unknown>;
  trendInsights?: Record<string, unknown>;
  overdueItems?: Array<{ id: string; content?: string; assignee?: string; due_date?: string }>;
  recentHistory?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface HealthData {
  score: number;
  status: string;
  color: string;
  factors: Array<{
    type: 'positive' | 'negative';
    factor: string;
    impact?: number;
    detail?: string;
  }>;
  calculatedAt?: string;
}

export interface BriefingHistoryItem {
  id: string;
  summary?: string;
  content?: string;
  briefing?: string;
  generated_at?: string;
  created_at?: string;
  provider?: string;
  model?: string;
  tokens_used?: number;
}

export interface TrendsData {
  trends?: Record<string, unknown>;
  history?: Array<{ date: string; facts?: number; questions?: number; risks?: number; actions?: number }>;
}

export interface PendingFile {
  filename: string;
  folder: string;
  size: number;
  uploadedAt: string;
  status: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface ProcessResult {
  status: string;
  message: string;
}

export interface ProcessStatus {
  status: string;
  progress?: number;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
}

export interface ExportResult {
  ok: boolean;
  [key: string]: unknown;
}

export interface ResetResult {
  success: boolean;
  message: string;
  graphCleared?: boolean;
}

export interface CleanupResult {
  ok: boolean;
  message: string;
  stats?: Record<string, number>;
  graphCleaned?: boolean;
}

export interface ChatSource {
  type: string;
  id: string | number;
  title?: string;
  excerpt?: string;
  score?: number;
  rrfScore?: number;
  source?: string;
  sourceCount?: number;
  contactName?: string;
  contactRole?: string;
  avatarUrl?: string;
}

export interface ChatRAGInfo {
  method?: string;
  vectorResults: number;
  graphResults: number;
  fusedResults?: number;
  usedHyDE?: boolean;
  tokenBudget?: {
    estimated?: number;
    limit?: number | null;
    truncated?: boolean;
  };
}

export interface ChatResponse {
  success?: boolean;
  message?: string;
  response: string;
  sources: ChatSource[];
  contextQuality?: 'high' | 'medium' | 'low' | 'none';
  confidence?: 'high' | 'medium' | 'low';
  queryType?: string;
  rag?: ChatRAGInfo;
  model?: string;
  provider?: string;
  sessionId?: string;
  suggestedFollowups?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  context_contact_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  role: string;
  content: string;
  sources?: ChatSource[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Question {
  id: string;
  content?: string;
  question?: string;
  status: string;
  priority?: string;
  created_at?: string;
  createdAt?: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee?: string;
  dueDate?: string;
  status: string;
  priority?: string;
}

export interface Fact {
  id: string;
  content: string;
  source?: string;
  [key: string]: unknown;
}

export interface Decision {
  id: string;
  decision?: string;
  content?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CostSummary {
  totalCost?: number;
  total?: number;
  breakdown?: Array<{ model?: string; name?: string; cost?: number; requests?: number }>;
  models?: Array<{ model?: string; name?: string; cost?: number; requests?: number }>;
  period?: string;
  periodStart?: string;
  periodEnd?: string;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiClient.get<DashboardData>('/api/dashboard'),
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const res = await apiClient.get<{ stats: Record<string, unknown> } | Record<string, unknown>>('/api/stats');
      return (res as any).stats || res;
    },
  });
}

// ── Projects ────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const res = await apiClient.get<{ projects: Project[] } | Project[]>('/api/projects');
      return Array.isArray(res) ? res : (res.projects || []);
    },
  });
}

// ── Pending Files ───────────────────────────────────────────────────────────

export function usePendingFiles() {
  return useQuery({
    queryKey: queryKeys.pendingFiles,
    queryFn: async () => {
      const res = await apiClient.get<{ files: PendingFile[] } | PendingFile[]>('/api/files');
      return Array.isArray(res) ? res : (res.files || []);
    },
    refetchInterval: (query) => {
      const files = query.state.data;
      const hasPending = Array.isArray(files) && files.some((f: PendingFile) => f.status === 'pending' || f.status === 'processing');
      return hasPending ? 5_000 : false;
    },
  });
}

// ── Processing ──────────────────────────────────────────────────────────────

export function useProcessFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { provider?: string; model?: string }) =>
      apiClient.post<ProcessResult>('/api/process', options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingFiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.facts });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks });
      queryClient.invalidateQueries({ queryKey: queryKeys.actions });
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions });
    },
    onError: (error: Error) => {
      console.error('File processing failed:', error.message);
    },
  });
}

export function useProcessStatus() {
  return useQuery({
    queryKey: queryKeys.processStatus,
    queryFn: () => apiClient.get<ProcessStatus>('/api/process/status'),
    refetchInterval: (query) => {
      const status = query.state.data as ProcessStatus | undefined;
      const isActive = status?.status === 'processing' || status?.status === 'running';
      return isActive ? 3_000 : false;
    },
  });
}

// ── Export ───────────────────────────────────────────────────────────────────

export function useExportProject() {
  return useMutation({
    mutationFn: (options?: { includeEmbeddings?: boolean }) =>
      apiClient.post<ExportResult>('/api/export', options),
  });
}

// ── Reset / Cleanup ─────────────────────────────────────────────────────────

export function useResetData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { clearArchived?: boolean }) =>
      apiClient.post<ResetResult>('/api/reset', options),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useCleanupOrphans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<CleanupResult>('/api/cleanup-orphans'),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

// ── File Upload ─────────────────────────────────────────────────────────────

export function useUploadFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ files, type, sprintId, taskId, source }: {
      files: File[];
      type: string;
      sprintId?: string;
      taskId?: string;
      source?: string;
    }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('type', type);
      if (sprintId && sprintId !== 'none') formData.append('sprintId', sprintId);
      if (taskId && taskId !== 'none') formData.append('actionId', taskId);
      if (source) formData.append('source', source);
      return apiClient.upload<{ success: boolean; files: string[] }>('/api/upload', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingFiles });
    },
  });
}

// ── Delete Pending File ─────────────────────────────────────────────────────

export function useDeletePendingFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folder, filename }: { folder: string; filename: string }) =>
      apiClient.delete(`/api/files/${folder}/${filename}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingFiles });
    },
  });
}

// ── Briefing ────────────────────────────────────────────────────────────────

export interface Briefing {
  content: string;
  generated_at?: string;
  sections?: Record<string, unknown>;
  [key: string]: unknown;
}

export function useBriefing(refresh?: boolean) {
  return useQuery({
    queryKey: ['briefing', refresh],
    queryFn: () => apiClient.get<Briefing>(`/api/briefing${refresh ? '?refresh=true' : ''}`),
    enabled: true,
  });
}

export function useSotChat() {
  return useMutation({
    mutationFn: (data: { message: string; history?: Array<{ role: string; content: string }> }) =>
      apiClient.post<{ response: string; sources?: ChatSource[] }>('/api/sot/chat', data),
    onError: (error: Error) => {
      console.error('SOT chat failed:', error.message);
    },
  });
}

// ── Project Config ──────────────────────────────────────────────────────────

export interface ProjectConfig {
  projectName?: string;
  llm?: {
    provider?: string;
    models?: Record<string, string>;
    embeddingsProvider?: string;
    providers?: Record<string, { apiKey?: string; baseUrl?: string; host?: string; port?: number; manualModels?: string[] }>;
  };
  prompts?: Record<string, string>;
  pdfToImages?: boolean;
  [key: string]: unknown;
}

export function useProjectConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => apiClient.get<ProjectConfig>('/api/config'),
  });
}

export function useUpdateProjectConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProjectConfig>) =>
      apiClient.post<ProjectConfig>('/api/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

// ── Documents ───────────────────────────────────────────────────────────────

export interface DocumentItem {
  id: string;
  filename: string;
  original_filename?: string;
  type?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  size?: number;
  content_preview?: string;
  entity_counts?: { facts?: number; questions?: number; decisions?: number; risks?: number; actions?: number };
  metadata?: {
    krisp_meeting_id?: string;
    source?: string;
    is_audio?: boolean;
    drive_web_link?: string;
    audio_document_id?: string;
    speakers?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface DocumentsResponse {
  documents: DocumentItem[];
  total: number;
  statusCounts?: { processed?: number; pending?: number; processing?: number; failed?: number; deleted?: number };
}

export function useDocuments(params?: { status?: string; limit?: number; offset?: number; search?: string; type?: string; sort?: string; order?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.search) qs.set('search', params.search);
  if (params?.type) qs.set('type', params.type);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.order) qs.set('order', params.order);
  const queryString = qs.toString();
  return useQuery({
    queryKey: [...queryKeys.documents, queryString],
    queryFn: () => apiClient.get<DocumentsResponse>(`/api/documents${queryString ? `?${queryString}` : ''}`),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useReprocessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/documents/${id}/reprocess`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

// ── Document Detail & Actions ────────────────────────────────────────────────

export function useDocumentDetail(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'detail', id],
    queryFn: () => apiClient.get<{ document: Record<string, unknown> }>(`/api/documents/${id}`),
    enabled: !!id,
  });
}

export function useDocumentExtraction(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'extraction', id],
    queryFn: () => apiClient.get<{ extraction: Record<string, unknown> }>(`/api/documents/${id}/extraction`),
    enabled: !!id,
  });
}

export function useDocumentSummary(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'summary', id],
    queryFn: async () => {
      const res = await apiClient.get<{ document: Record<string, unknown> }>(`/api/documents/${id}`);
      return { summary: (res.document?.summary as string) || (res.document?.ai_summary as string) || '' };
    },
    enabled: !!id,
  });
}

export function useDocumentAnalysis(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'analysis', id],
    queryFn: () => apiClient.get<{ analyses: Array<Record<string, unknown>> }>(`/api/documents/${id}/analysis`),
    enabled: !!id,
  });
}

export function useDocumentVersions(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'versions', id],
    queryFn: () => apiClient.get<{ versions: Array<Record<string, unknown>> }>(`/api/documents/${id}/versions`),
    enabled: !!id,
  });
}

export function useDocumentActivity(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'activity', id],
    queryFn: () => apiClient.get<{ activities: Array<Record<string, unknown>> }>(`/api/documents/${id}/activity`),
    enabled: !!id,
  });
}

export function useToggleDocumentFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/documents/${id}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

export function useRestoreDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/documents/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

export function useReprocessCheck(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.documents, 'reprocess-check', id],
    queryFn: () => apiClient.get<{ has_content: boolean; hash_match: boolean; existing_entities: number }>(`/api/documents/${id}/reprocess/check`),
    enabled: false,
  });
}

export function useShareDocument() {
  return useMutation({
    mutationFn: ({ id, expires, maxViews }: { id: string; expires?: string; maxViews?: number }) =>
      apiClient.post<{ url: string; token: string }>(`/api/documents/${id}/share`, { expires, max_views: maxViews }),
  });
}

// ── Bulk Document Operations ─────────────────────────────────────────────────

export function useBulkDeleteDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/api/documents/bulk/delete', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useBulkReprocessDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/api/documents/bulk/reprocess', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

export function useBulkExportDocuments() {
  return useMutation({
    mutationFn: async ({ ids, format }: { ids: string[]; format?: 'original' | 'markdown' }) => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const pid = getCurrentProjectId();
      if (pid) headers['X-Project-Id'] = pid;
      const res = await fetch('/api/documents/bulk/export', {
        method: 'POST', headers, credentials: 'include',
        body: JSON.stringify({ ids, format: format || 'original' }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'documents-export.zip'; a.click();
      URL.revokeObjectURL(url);
    },
  });
}

// ── Conversations ────────────────────────────────────────────────────────────

export function useConversations(params?: { sourceApp?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.sourceApp) qs.set('sourceApp', params.sourceApp);
  if (params?.search) qs.set('search', params.search);
  const queryString = qs.toString();
  return useQuery({
    queryKey: [...queryKeys.conversations, queryString],
    queryFn: () => apiClient.get<{ ok: boolean; conversations: Array<Record<string, unknown>>; total: number }>(
      `/api/conversations${queryString ? `?${queryString}` : ''}`
    ),
  });
}

export function useConversationDetail(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.conversations, 'detail', id],
    queryFn: () => apiClient.get<{ ok: boolean; conversation: Record<string, unknown> }>(`/api/conversations/${id}`),
    enabled: !!id,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useReembedConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/conversations/${id}/reembed`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useParseConversation() {
  return useMutation({
    mutationFn: ({ text, formatHint }: { text: string; formatHint?: string }) =>
      apiClient.post<{ ok: boolean; format: string; confidence: number; messagesPreview: unknown[]; stats: Record<string, unknown> }>(
        '/api/conversations/parse', { text, formatHint }
      ),
  });
}

export function useImportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { text: string; formatHint?: string; meta?: Record<string, unknown>; skipAI?: boolean }) =>
      apiClient.post<{ ok: boolean; id: string; title: string; summary: string; stats: Record<string, unknown> }>(
        '/api/conversations', data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.facts });
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.actions });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/api/conversations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useSummarizeConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ ok: boolean; summary?: string }>(`/api/conversations/${id}/summarize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

// ── Email Extended ───────────────────────────────────────────────────────────

export function useEmailStats() {
  return useQuery({
    queryKey: [...queryKeys.emails, 'stats'],
    queryFn: () => apiClient.get<{ ok: boolean; total: number; unread?: number; starred?: number; needing_response?: number }>('/api/emails/stats'),
    staleTime: 30_000,
  });
}

export function useStarEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      apiClient.put(`/api/emails/${id}/${starred ? 'star' : 'unstar'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useArchiveEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put(`/api/emails/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useMarkEmailRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      apiClient.put(`/api/emails/${id}/${read ? 'read' : 'unread'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useEmailThread(threadId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.emails, 'thread', threadId],
    queryFn: () => apiClient.get<{ ok: boolean; emails: Array<Record<string, unknown>> }>(`/api/emails/thread/${threadId}`),
    enabled: !!threadId,
  });
}

// ── Questions ───────────────────────────────────────────────────────────────

export function useQuestions() {
  return useQuery({
    queryKey: queryKeys.questions,
    queryFn: async () => {
      const res = await apiClient.get<{ questions: Question[] } | Question[]>('/api/questions');
      return Array.isArray(res) ? res : (res.questions || []);
    },
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post<Question>('/api/questions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string;[key: string]: unknown }) =>
      apiClient.put<Question>(`/api/questions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ── Facts ───────────────────────────────────────────────────────────────────

export function useFacts() {
  return useQuery({
    queryKey: queryKeys.facts,
    queryFn: async () => {
      const res = await apiClient.get<{ facts: Fact[] } | Fact[]>('/api/facts');
      return Array.isArray(res) ? res : (res.facts || []);
    },
  });
}

export function useCreateFact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post<Fact>('/api/facts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.facts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateFact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string;[key: string]: unknown }) =>
      apiClient.put<Fact>(`/api/facts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.facts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteFact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/facts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.facts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ── Risks ───────────────────────────────────────────────────────────────────

export function useRisks() {
  return useQuery({
    queryKey: queryKeys.risks,
    queryFn: async () => {
      const res = await apiClient.get<{ risks: Record<string, unknown>[] } | Record<string, unknown>[]>('/api/risks');
      return Array.isArray(res) ? res : (res.risks || []);
    },
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/risks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string;[key: string]: unknown }) =>
      apiClient.put(`/api/risks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/risks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ── Actions ─────────────────────────────────────────────────────────────────

export function useActions() {
  return useQuery({
    queryKey: queryKeys.actions,
    queryFn: async () => {
      const res = await apiClient.get<{ actions: ActionItem[] } | ActionItem[]>('/api/actions');
      return Array.isArray(res) ? res : (res.actions || []);
    },
  });
}

export function useCreateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/actions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string;[key: string]: unknown }) =>
      apiClient.put(`/api/actions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/actions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ── Decisions ───────────────────────────────────────────────────────────────

export function useDecisions() {
  return useQuery({
    queryKey: queryKeys.decisions,
    queryFn: async () => {
      const res = await apiClient.get<{ decisions: Decision[] } | Decision[]>('/api/decisions');
      return Array.isArray(res) ? res : (res.decisions || []);
    },
  });
}

export function useCreateDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/decisions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string;[key: string]: unknown }) =>
      apiClient.put(`/api/decisions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/decisions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ── AI Suggestion Hooks (real LLM calls) ────────────────────────────────────

export function useAiSuggestDecision() {
  return useMutation({
    mutationFn: (data: { content: string; rationale?: string }) =>
      apiClient.post<{ rationale: string; impact: string; impact_summary: string; summary: string }>('/api/decisions/suggest', data),
  });
}

export function useAiSuggestDecisionOwner() {
  return useMutation({
    mutationFn: (data: { content: string; rationale?: string }) =>
      apiClient.post<{ suggested_owners: Array<Record<string, unknown>> }>('/api/decisions/suggest-owner', data),
  });
}

export function useAiSuggestRisk() {
  return useMutation({
    mutationFn: (data: { content: string; impact?: string; likelihood?: string }) =>
      apiClient.post<{ suggested_owner: string; suggested_mitigation: string; suggested_owners: Array<Record<string, unknown>> }>('/api/risks/suggest', data),
  });
}

export function useAiSuggestAction() {
  return useMutation({
    mutationFn: (data: { content: string }) =>
      apiClient.post<{ suggested_assignees: Array<Record<string, unknown>> }>('/api/actions/suggest', data),
  });
}

export function useAiSuggestTask() {
  return useMutation({
    mutationFn: (data: { user_input: string; parent_story_ref?: string }) =>
      apiClient.post<{ task: string; description: string; size_estimate: string; definition_of_done: string; acceptance_criteria: string }>('/api/actions/suggest-task', data),
  });
}

export function useAiSimilarFacts(id: string) {
  return useQuery({
    queryKey: ['similarFacts', id],
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>(`/api/facts/${id}/similar?limit=5`),
    enabled: !!id,
  });
}

// ── Contacts ────────────────────────────────────────────────────────────────

export function useContacts(params?: { search?: string; role?: string; organization?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.role) qs.set('role', params.role);
  if (params?.organization) qs.set('organization', params.organization);
  const queryString = qs.toString();
  return useQuery({
    queryKey: [...queryKeys.contacts, queryString],
    queryFn: () => apiClient.get<{ contacts: Array<Record<string, unknown>>; total?: number }>(
      `/api/contacts${queryString ? `?${queryString}` : ''}`
    ),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post('/api/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string;[key: string]: unknown }) =>
      apiClient.put(`/api/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useUploadContactAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, file }: { contactId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.upload<{ ok: boolean; avatar_url: string }>(`/api/contacts/${contactId}/avatar`, fd);
      return res.avatar_url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

export function useDeleteContactAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      await apiClient.delete(`/api/contacts/${contactId}/avatar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ── Contact Extended Operations ──────────────────────────────────────────────

export function useContactDuplicates() {
  return useQuery({
    queryKey: [...queryKeys.contacts, 'duplicates'],
    queryFn: () => apiClient.get<{ ok: boolean; duplicates: unknown[]; groups: number }>('/api/contacts/duplicates'),
    staleTime: 120_000,
  });
}

export function useMergeContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactIds: string[]) =>
      apiClient.post('/api/contacts/merge', { contactIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useEnrichContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      apiClient.post<{ ok: boolean; suggestions: Record<string, unknown> }>(`/api/contacts/${contactId}/enrich`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

export function useExportContacts() {
  return useMutation({
    mutationFn: async (format: 'json' | 'csv') => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const pid = getCurrentProjectId();
      if (pid) headers['X-Project-Id'] = pid;
      const response = await fetch(`/api/contacts/export/${format}`, { headers, credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ format, data }: { format: 'json' | 'csv'; data: unknown }) =>
      apiClient.post(`/api/contacts/import/${format}`, format === 'csv' ? { csv: data } : data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUnmatchedParticipants() {
  return useQuery({
    queryKey: [...queryKeys.contacts, 'unmatched'],
    queryFn: () => apiClient.get<{ ok: boolean; unmatched: Array<{ name: string; count?: number }>; total: number }>('/api/contacts/unmatched'),
    staleTime: 60_000,
  });
}

export function useLinkParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantName, contactId }: { participantName: string; contactId: string }) =>
      apiClient.post('/api/contacts/link-participant', { participantName, contactId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.contacts, 'unmatched'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

export function useUnlinkParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (participantName: string) =>
      apiClient.post('/api/contacts/unlink-participant', { participantName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.contacts, 'unmatched'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

export function useSyncPeopleToContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/api/contacts/sync-from-people', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteRelationship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, toContactId, type }: { contactId: string; toContactId: string; type: string }) => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const pid = getCurrentProjectId();
      if (pid) headers['X-Project-Id'] = pid;
      const res = await fetch(`/api/contacts/${contactId}/relationships`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({ toContactId, type }),
      });
      if (!res.ok) throw new Error('Failed to delete relationship');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

// ── Chat ────────────────────────────────────────────────────────────────────

export function useSendChatMessage() {
  return useMutation({
    mutationFn: ({
      message,
      history,
      sessionId,
      deepReasoning,
      context,
    }: {
      message: string;
      history?: Array<{ role: string; content: string }>;
      sessionId?: string | null;
      deepReasoning?: boolean;
      context?: Record<string, unknown>;
    }) =>
      apiClient.post<ChatResponse>('/api/chat', {
        message,
        history: history ?? [],
        semantic: true,
        sessionId: sessionId ?? undefined,
        deepReasoning: deepReasoning || undefined,
        context: context ?? undefined,
      }),
    onError: (error: Error) => {
      console.error('Chat message failed:', error.message);
    },
  });
}

export function useChatMessageFeedback() {
  return useMutation({
    mutationFn: ({ sessionId, messageId, feedback }: { sessionId: string; messageId: string; feedback: 'up' | 'down' | null }) =>
      apiClient.post<{ ok: boolean }>(`/api/chat/sessions/${sessionId}/messages/${messageId}/feedback`, { feedback }),
  });
}

// ── Chat Sessions ───────────────────────────────────────────────────────────

export function useChatSessions() {
  return useQuery({
    queryKey: queryKeys.chatSessions,
    queryFn: () => apiClient.get<{ ok: boolean; sessions: ChatSession[] }>('/api/chat/sessions'),
    staleTime: 30_000,
  });
}

export function useCreateChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; contextContactId?: string | null }) =>
      apiClient.post<{ ok: boolean; session: ChatSession }>('/api/chat/sessions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
  });
}

export function useUpdateChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, ...data }: { sessionId: string; title?: string; contextContactId?: string | null }) =>
      apiClient.put<{ ok: boolean }>(`/api/chat/sessions/${sessionId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
  });
}

export function useDeleteChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.delete<{ ok: boolean }>(`/api/chat/sessions/${sessionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
  });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.chatMessages(sessionId ?? ''),
    queryFn: () =>
      apiClient.get<{ ok: boolean; messages: ChatMessageRecord[] }>(
        `/api/chat/sessions/${sessionId}/messages`
      ),
    enabled: !!sessionId,
    staleTime: 10_000,
  });
}

// ── Team Analysis ───────────────────────────────────────────────────────────

export function useTeamAnalysis() {
  return useQuery({
    queryKey: queryKeys.teamAnalysis,
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/team-analysis'),
  });
}

export function useTeamProfiles() {
  return useQuery({
    queryKey: ['teamProfiles'],
    queryFn: () => apiClient.get<{ profiles: Array<Record<string, unknown>> }>('/api/team-analysis/profiles'),
  });
}

export function useTeamDynamics() {
  return useQuery({
    queryKey: ['teamDynamics'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/team-analysis/team'),
  });
}

export function useTeamRelationships() {
  return useQuery({
    queryKey: ['teamRelationships'],
    queryFn: () => apiClient.get<{ relationships: Array<Record<string, unknown>> }>('/api/team-analysis/relationships'),
  });
}

export function useRunTeamAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { forceReanalysis?: boolean }) =>
      apiClient.post<Record<string, unknown>>('/api/team-analysis/team/analyze', opts || {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamDynamics'] });
      qc.invalidateQueries({ queryKey: ['teamProfiles'] });
      qc.invalidateQueries({ queryKey: ['teamRelationships'] });
      qc.invalidateQueries({ queryKey: queryKeys.teamAnalysis });
    },
  });
}

export function useAnalyzeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, forceReanalysis }: { personId: string; forceReanalysis?: boolean }) =>
      apiClient.post<Record<string, unknown>>(`/api/team-analysis/profiles/${personId}/analyze`, { forceReanalysis }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamProfiles'] });
    },
  });
}

export function useTeamGraph() {
  return useQuery({
    queryKey: ['teamGraph'],
    queryFn: () => apiClient.get<{ ok: boolean; nodes: unknown[]; edges: unknown[] }>('/api/team-analysis/graph'),
  });
}

export function useSyncTeamGraph() {
  return useMutation({
    mutationFn: () => apiClient.post<Record<string, unknown>>('/api/team-analysis/sync-graph', {}),
  });
}

export function useTeamAdminProjects() {
  return useQuery({
    queryKey: ['teamAdminProjects'],
    queryFn: () => apiClient.get<{ ok: boolean; projects: Array<Record<string, unknown>> }>('/api/team-analysis/admin/projects'),
  });
}

export function useAdminRunProjectAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, forceReanalysis }: { projectId: string; forceReanalysis?: boolean }) =>
      apiClient.post<Record<string, unknown>>(`/api/team-analysis/admin/projects/${projectId}/analyze`, { forceReanalysis: forceReanalysis ?? true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamAdminProjects'] });
      qc.invalidateQueries({ queryKey: ['teamDynamics'] });
      qc.invalidateQueries({ queryKey: ['teamProfiles'] });
    },
  });
}

// ── Costs ───────────────────────────────────────────────────────────────────

export function useCosts(period: string = 'month') {
  return useQuery({
    queryKey: queryKeys.costs(period),
    queryFn: () => apiClient.get<CostSummary>(`/api/costs?period=${period}`),
  });
}

// ── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  key_prefix?: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  rate_limit?: number;
  scopes?: string[];
  is_active?: boolean;
}

export function useApiKeys(projectId: string) {
  return useQuery({
    queryKey: ['apiKeys', projectId],
    queryFn: () => apiClient.get<{ keys: ApiKey[] }>(`/api/projects/${projectId}/api-keys`),
    enabled: !!projectId,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; name: string; expires_in_days?: number; rate_limit?: number; scopes?: string[] }) =>
      apiClient.post<{ key: ApiKey; raw_key?: string }>(`/api/projects/${projectId}/api-keys`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

// ── Project LLM Provider Keys ────────────────────────────────────────────────

export interface ProjectProviderStatus {
  id: string;
  aliases?: string[];
  name: string;
  configured: boolean;
  hasProjectKey: boolean;
  hasSystemKey: boolean;
  source: 'project' | 'system' | null;
  masked: string | null;
}

export function useProjectProviders(projectId: string | null) {
  return useQuery({
    queryKey: ['projectProviders', projectId],
    queryFn: () => apiClient.get<{ ok: boolean; providers: ProjectProviderStatus[] }>(`/api/projects/${projectId}/providers`),
    enabled: !!projectId,
  });
}

export function useSaveProjectProviderKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, provider, apiKey }: { projectId: string; provider: string; apiKey: string }) =>
      apiClient.post<{ ok: boolean; provider: string }>(`/api/projects/${projectId}/providers`, { provider, apiKey }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projectProviders', vars.projectId] });
    },
  });
}

export function useDeleteProjectProviderKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, provider }: { projectId: string; provider: string }) =>
      apiClient.delete<{ ok: boolean }>(`/api/projects/${projectId}/providers/${provider}`),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['projectProviders', vars.projectId] });
    },
  });
}

export const useSetProjectProviderKey = useSaveProjectProviderKey;

export function useValidateProjectProviderKey() {
  return useMutation({
    mutationFn: ({ projectId, provider }: { projectId: string; provider: string }) =>
      apiClient.post<{ ok: boolean }>(`/api/projects/${projectId}/providers/validate`, { provider }),
  });
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active?: boolean;
  secret?: string;
  created_at: string;
  updated_at?: string;
  headers?: Record<string, string>;
  retry_count?: number;
}

export function useWebhooks(projectId: string) {
  return useQuery({
    queryKey: ['webhooks', projectId],
    queryFn: () => apiClient.get<{ webhooks: Webhook[] }>(`/api/projects/${projectId}/webhooks`),
    enabled: !!projectId,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; url: string; events: string[]; headers?: Record<string, string>; retry_count?: number }) =>
      apiClient.post<{ webhook: Webhook }>(`/api/projects/${projectId}/webhooks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ success: boolean }>(`/api/webhooks/${id}/test`),
  });
}

// ── Audit / History ─────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export function useActivityLog(options?: { limit?: number; offset?: number; action?: string; since?: string }) {
  const projectId = pid();
  const qs = new URLSearchParams();
  if (options?.limit) qs.set('limit', String(options.limit));
  if (options?.offset) qs.set('offset', String(options.offset));
  if (options?.action) qs.set('action', options.action);
  if (options?.since) qs.set('since', options.since);
  const qStr = qs.toString();
  return useQuery({
    queryKey: ['activity', projectId, options?.limit, options?.offset, options?.action, options?.since],
    queryFn: () => apiClient.get<{ activities: ActivityEntry[]; total: number }>(
      `/api/projects/${projectId}/activity${qStr ? `?${qStr}` : ''}`
    ),
    enabled: !!projectId,
  });
}

export interface ProcessingHistoryEntry {
  timestamp: string;
  action: string;
  filename?: string;
  files_processed?: number;
  facts_extracted?: number;
  questions_added?: number;
  decisions_added?: number;
  risks_added?: number;
  actions_added?: number;
  people_added?: number;
  document_id?: string;
  status?: string;
  model_used?: string;
  tokens_used?: number;
  duration_ms?: number;
}

export function useProcessingHistory() {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: async () => {
      const res = await apiClient.get<{ history: ProcessingHistoryEntry[] }>('/api/history');
      return (res as { history?: ProcessingHistoryEntry[] })?.history ?? [];
    },
  });
}

/** @deprecated Use useActivityLog or useProcessingHistory instead */
export function useHistory() {
  return useProcessingHistory();
}

export function useAuditSummary(projectId: string, days: number = 30) {
  return useQuery({
    queryKey: ['audit', projectId, days],
    queryFn: () => apiClient.get<Record<string, unknown>>(`/api/projects/${projectId}/audit/summary?days=${days}`),
    enabled: !!projectId,
  });
}

// ── Emails ──────────────────────────────────────────────────────────────────

export function useEmails(params?: { requires_response?: boolean; direction?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.requires_response !== undefined) qs.set('requires_response', String(params.requires_response));
  if (params?.direction) qs.set('direction', params.direction);
  if (params?.limit) qs.set('limit', String(params.limit));
  const queryString = qs.toString();
  return useQuery({
    queryKey: [...queryKeys.emails, queryString],
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>(`/api/emails${queryString ? `?${queryString}` : ''}`),
  });
}

export function useEmail(id: string) {
  return useQuery({
    queryKey: ['email', id],
    queryFn: () => apiClient.get<Record<string, unknown>>(`/api/emails/${id}`),
    enabled: !!id,
  });
}

export function useDeleteEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/emails/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useMarkEmailResponded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/emails/${id}/mark-responded`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useGenerateEmailResponse() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ response: string; draft?: string }>(`/api/emails/${id}/response`),
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { to: string[]; cc?: string[]; subject: string; body: string; replyToId?: string }) =>
      apiClient.post<{ ok: boolean; email?: Record<string, unknown> }>('/api/emails/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useImportEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post<{ ok: boolean; email?: Record<string, unknown> }>('/api/emails', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.facts });
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions });
      queryClient.invalidateQueries({ queryKey: queryKeys.actions });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks });
    },
  });
}

export function useCategorizeEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ ok: boolean; category?: string; priority?: string; sentiment?: string }>(`/api/emails/${id}/categorize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export function useGenerateEmailSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ ok: boolean; summary?: string }>(`/api/emails/${id}/summarize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails });
    },
  });
}

export * from './useAdmin';

export * from './useKrisp';

// ── Optimizations ────────────────────────────────────────────────────────────

export function useOptimizationsAnalytics() {
  return useQuery({ queryKey: ['optimAnalytics', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/analytics') });
}
export function useOptimizationsInsights() {
  return useQuery({ queryKey: ['optimInsights', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/insights') });
}
export function useOptimizationsSummary() {
  return useQuery({ queryKey: ['optimSummary', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/summary') });
}
export function useOptimizationsDigest() {
  return useQuery({ queryKey: ['optimDigest', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/digest') });
}
export function useOptimizationsHealth() {
  return useQuery({ queryKey: ['optimHealth', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/health') });
}
export function useOptimizationsHealthSummary() {
  return useQuery({ queryKey: ['optimHealthSummary', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/health/summary') });
}
export function useOptimizationsSuggestions() {
  return useQuery({ queryKey: ['optimSuggestions', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/suggestions') });
}
export function useOptimizationsUsage() {
  return useQuery({ queryKey: ['optimUsage', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/usage') });
}
export function useOptimizationsCacheStats() {
  return useQuery({ queryKey: ['optimCache', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/cache/stats') });
}
export function useOptimizationsDedup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { threshold?: number }) => apiClient.post<unknown>('/api/optimizations/dedup', body || {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['optimAnalytics'] }),
  });
}
export function useOptimizationsResolveDuplicates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids: string[] }) => apiClient.post<unknown>('/api/optimizations/resolve-duplicates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['optimAnalytics'] }),
  });
}
export function useOptimizationsTag() {
  return useMutation({ mutationFn: (body: { ids?: string[] }) => apiClient.post<unknown>('/api/optimizations/tag', body) });
}
export function useOptimizationsNER() {
  return useMutation({ mutationFn: (body: { text: string; lang?: string }) => apiClient.post<unknown>('/api/optimizations/ner', body) });
}
export function useOptimizationsContextOptimize() {
  return useMutation({ mutationFn: (body: { query: string; context?: string }) => apiClient.post<unknown>('/api/optimizations/context/optimize', body) });
}
export function useOptimizationsCacheClear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/optimizations/cache/clear', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['optimCache'] }),
  });
}
export function useOptimizationsFeedback() {
  return useMutation({ mutationFn: (body: Record<string, unknown>) => apiClient.post<unknown>('/api/optimizations/feedback', body) });
}
export function useOptimizationsFeedbackStats() {
  return useQuery({ queryKey: ['optimFeedbackStats', pid()], queryFn: () => apiClient.get<unknown>('/api/optimizations/feedback/stats') });
}

// ── Advanced Search ──────────────────────────────────────────────────────────

export function useSearchFulltext() {
  return useMutation({ mutationFn: (body: { query: string; types?: string[]; limit?: number }) => apiClient.post<unknown>('/api/search', body) });
}
export function useSearchSuggest(query: string) {
  return useQuery({
    queryKey: ['searchSuggest', query, pid()],
    queryFn: () => apiClient.get<unknown>(`/api/search/suggest?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });
}
export function useSearchStats() {
  return useQuery({ queryKey: ['searchStats', pid()], queryFn: () => apiClient.get<unknown>('/api/search/stats') });
}
export function useSearchIndex() {
  return useMutation({ mutationFn: () => apiClient.post<unknown>('/api/search/index', {}) });
}

// ── Decision Conflicts ──────────────────────────────────────────────────────

export function useDecisionConflicts() {
  return useQuery({
    queryKey: ['decisionConflicts', pid()],
    queryFn: () => apiClient.get<{ conflicts: Array<Record<string, unknown>>; total?: number }>('/api/conflicts/decisions'),
  });
}
export function useRunFactCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/fact-check/run', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conflicts'] }),
  });
}
export function useRunDecisionCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>('/api/decision-check/run', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['decisionConflicts'] }),
  });
}

// ── Ollama Management ────────────────────────────────────────────────────────

export function useOllamaRecommended() {
  return useQuery({ queryKey: ['ollamaRecommended'], queryFn: () => apiClient.get<unknown>('/api/ollama/recommended'), enabled: false });
}
export function useOllamaPull() {
  return useMutation({ mutationFn: (body: { model: string }) => apiClient.post<unknown>('/api/ollama/pull', body) });
}
export function useModelUnload() {
  return useMutation({ mutationFn: (body?: { model?: string }) => apiClient.post<unknown>('/api/models/unload', body || {}) });
}

// ── Project Management (Activate / Stats / Import-Export / Providers) ────────

export function useProjectStats(projectId: string) {
  return useQuery({
    queryKey: ['projectStats', projectId],
    queryFn: () => apiClient.get<Record<string, unknown>>(`/api/projects/${projectId}/stats`),
    enabled: !!projectId,
  });
}

export function useActivateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => apiClient.put<unknown>(`/api/projects/${projectId}/activate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useSetDefaultProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => apiClient.post<unknown>(`/api/projects/${projectId}/set-default`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useImportProject() {
  return useMutation({
    mutationFn: (body: { data: unknown; name?: string }) => apiClient.post<unknown>('/api/projects/import', body),
  });
}

// ── Timeline ────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  type: string;
  date: string;
  title?: string;
  content?: string;
  description?: string;
  owner?: string;
  status?: string;
  entity_id?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  totalEvents: number;
  startDate: string;
  endDate: string;
}

export function useTimeline(params: { types?: string; startDate?: string; endDate?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.types) qs.set('types', params.types);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return useQuery({
    queryKey: [...queryKeys.timeline, query],
    queryFn: () => apiClient.get<TimelineResponse>(`/api/timeline${query ? `?${query}` : ''}`),
    staleTime: 30_000,
  });
}

