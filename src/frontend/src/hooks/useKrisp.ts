import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCurrentProjectId } from '../lib/api-client';
import { queryKeys } from './useGodMode';

function pid(): string { return getCurrentProjectId() ?? '__none__'; }

// ── Krisp OAuth / MCP Integration ───────────────────────────────────────────

export interface KrispOAuthStatus {
  connected: boolean;
  expiresAt?: number | null;
  hasRefreshToken?: boolean;
}

export interface KrispSummarySection {
  title: string;
  description: string;
}

export interface KrispActionItem {
  title: string;
  completed: boolean;
  assignee?: string;
}

export interface KrispMeeting {
  meeting_id: string;
  name: string;
  date: string;
  speakers: string[];
  attendees: string[];
  detailed_summary: KrispSummarySection[];
  key_points: string[];
  action_items: KrispActionItem[];
  importedTo: Array<{ projectId: string; projectName: string }>;
  isImported: boolean;
}

export interface KrispImportOptions {
  transcript: boolean;
  keyPoints: boolean;
  actionItems: boolean;
  outline: boolean;
  audio: boolean;
}

export interface KrispImportResult {
  meetingId: string;
  success: boolean;
  transcriptDocId?: string;
  audioDocId?: string;
  title?: string;
  error?: string;
}

export function useKrispOAuthStatus() {
  return useQuery<KrispOAuthStatus>({
    queryKey: ['krispOAuthStatus'],
    queryFn: () => apiClient.get<KrispOAuthStatus>('/api/krisp/oauth/status'),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useKrispOAuthAuthorize() {
  return useMutation({
    mutationFn: () => apiClient.get<{ url: string; state: string }>('/api/krisp/oauth/authorize'),
  });
}

export function useKrispOAuthDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ success: boolean }>('/api/krisp/oauth/disconnect', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['krispOAuthStatus'] });
      qc.invalidateQueries({ queryKey: ['krispOAuthMeetings'] });
    },
  });
}

export function useKrispOAuthMeetings(params?: {
  search?: string;
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.after) qs.set('after', params.after);
  if (params?.before) qs.set('before', params.before);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return useQuery<{ meetings: KrispMeeting[]; total: number }>({
    queryKey: ['krispOAuthMeetings', params],
    queryFn: () => apiClient.get(`/api/krisp/oauth/meetings${query ? `?${query}` : ''}`),
    enabled: params?.enabled !== false,
    staleTime: 60_000,
  });
}

export interface KrispMeetingPreview {
  transcript: string | null;
  audioUrl: string | null;
  error?: string;
}

export function useKrispMeetingPreview(meetingId: string | null) {
  return useQuery<KrispMeetingPreview>({
    queryKey: ['krispMeetingPreview', meetingId],
    queryFn: () => apiClient.get(`/api/krisp/oauth/meetings/${meetingId}/preview`),
    enabled: !!meetingId,
    staleTime: 5 * 60_000,
  });
}

export function useKrispOAuthImportMeetings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { meetingIds: string[]; projectId: string; importOptions?: Partial<KrispImportOptions> }) =>
      apiClient.post<{
        results: KrispImportResult[];
        succeeded: number;
        failed: number;
        total: number;
      }>('/api/krisp/oauth/meetings/import', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['krispOAuthMeetings'] });
      qc.invalidateQueries({ queryKey: queryKeys.files });
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (list, read, read-all, delete)
// ═══════════════════════════════════════════════════════════════════════════════

export interface Notification {
  id: string;
  type: string;
  title?: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => apiClient.get<{ ok: boolean; notifications: Notification[]; total: number }>(`/api/notifications?limit=${limit}`),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: queryKeys.notificationsCount });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/api/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: queryKeys.notificationsCount });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: queryKeys.notificationsCount });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE PIPELINE (synthesize, embed, search, status)
// ═══════════════════════════════════════════════════════════════════════════════

export function useKnowledgeSynthesize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { incremental?: boolean }) =>
      apiClient.post<{ ok: boolean; [key: string]: unknown }>('/api/knowledge/synthesize', options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.facts });
      qc.invalidateQueries({ queryKey: queryKeys.decisions });
      qc.invalidateQueries({ queryKey: queryKeys.questions });
      qc.invalidateQueries({ queryKey: queryKeys.risks });
      qc.invalidateQueries({ queryKey: queryKeys.actions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error: Error) => {
      console.error('Knowledge synthesis failed:', error.message);
    },
  });
}

export function useKnowledgeResynthesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: boolean; [key: string]: unknown }>('/api/knowledge/resynthesis'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.facts });
      qc.invalidateQueries({ queryKey: queryKeys.decisions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useKnowledgeEmbed() {
  return useMutation({
    mutationFn: (options?: { model?: string }) =>
      apiClient.post<{ ok: boolean; count?: number; [key: string]: unknown }>('/api/knowledge/embed', options),
    onError: (error: Error) => {
      console.error('Embedding generation failed:', error.message);
    },
  });
}

export function useKnowledgeRegenerate() {
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: boolean; [key: string]: unknown }>('/api/knowledge/regenerate'),
  });
}

export function useKnowledgeSearch(query: string, options?: { semantic?: boolean; limit?: number }) {
  const qs = new URLSearchParams();
  if (query) qs.set('q', query);
  if (options?.semantic) qs.set('semantic', 'true');
  if (options?.limit) qs.set('limit', String(options.limit));
  return useQuery({
    queryKey: ['knowledgeSearch', query, options],
    queryFn: () => apiClient.get<{ results: Array<Record<string, unknown>> }>(`/api/knowledge/search?${qs}`),
    enabled: !!query && query.length > 2,
  });
}

export function useKnowledgeStatus() {
  return useQuery({
    queryKey: ['knowledgeStatus'],
    queryFn: () => apiClient.get<{ ok: boolean; embeddingStatus?: Record<string, unknown>; models?: string[] }>('/api/knowledge/status'),
    staleTime: 30_000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY RESTORE (soft-delete trash / restore)
// ═══════════════════════════════════════════════════════════════════════════════

export function useDeletedFacts() {
  return useQuery({
    queryKey: ['deletedFacts'],
    queryFn: () => apiClient.get<{ facts: Array<Record<string, unknown>> }>('/api/facts/deleted'),
  });
}

export function useRestoreFact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/facts/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletedFacts'] });
      qc.invalidateQueries({ queryKey: queryKeys.facts });
    },
  });
}

export function useDeletedDecisions() {
  return useQuery({
    queryKey: ['deletedDecisions'],
    queryFn: () => apiClient.get<{ decisions: Array<Record<string, unknown>> }>('/api/decisions/deleted'),
  });
}

export function useRestoreDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/decisions/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletedDecisions'] });
      qc.invalidateQueries({ queryKey: queryKeys.decisions });
    },
  });
}

export function useDeletedRisks() {
  return useQuery({
    queryKey: ['deletedRisks'],
    queryFn: () => apiClient.get<{ risks: Array<Record<string, unknown>> }>('/api/risks/deleted'),
  });
}

export function useRestoreRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/risks/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletedRisks'] });
      qc.invalidateQueries({ queryKey: queryKeys.risks });
    },
  });
}

export function useDeletedActions() {
  return useQuery({
    queryKey: ['deletedActions'],
    queryFn: () => apiClient.get<{ actions: Array<Record<string, unknown>> }>('/api/actions/deleted'),
  });
}

export function useRestoreAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/actions/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletedActions'] });
      qc.invalidateQueries({ queryKey: queryKeys.actions });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY EVENTS (audit trail)
// ═══════════════════════════════════════════════════════════════════════════════

export function useEntityEvents(entityType: 'facts' | 'decisions' | 'risks' | 'actions', entityId: string | null) {
  return useQuery({
    queryKey: ['entityEvents', entityType, entityId],
    queryFn: () => apiClient.get<{ events: Array<Record<string, unknown>> }>(`/api/${entityType}/${entityId}/events`),
    enabled: !!entityId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOT EXPORT & TRACEABILITY
// ═══════════════════════════════════════════════════════════════════════════════

export function useSotExport(format: 'md' | 'html' | 'json') {
  return useQuery({
    queryKey: ['sotExport', format],
    queryFn: () => apiClient.get<string>(`/api/sot/export/${format}`),
    enabled: false,
  });
}

export function useSotTrace(type: string, id: string | null) {
  return useQuery({
    queryKey: ['sotTrace', type, id],
    queryFn: () => apiClient.get<{ trace: Record<string, unknown> }>(`/api/sot/trace/${type}/${id}`),
    enabled: !!id,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPRINT MANAGEMENT (full CRUD + AI generation + reports)
// ═══════════════════════════════════════════════════════════════════════════════

import type { Sprint, SprintReport, SprintGenerateResult, ProposedTask } from '../types/godmode';

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; start_date: string; end_date: string; context?: string; goals?: string[]; analysis_start_date?: string; analysis_end_date?: string }) =>
      apiClient.post<{ sprint: Sprint }>('/api/sprints', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sprints });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useSprint(id: string | null) {
  return useQuery({
    queryKey: ['sprint', id],
    queryFn: () => apiClient.get<{ sprint: Sprint }>(`/api/sprints/${id}`),
    enabled: !!id,
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Sprint> & { id: string }) =>
      apiClient.put<{ ok: boolean; sprint: Sprint }>(`/api/sprints/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sprints });
      qc.invalidateQueries({ queryKey: ['sprint'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/sprints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sprints });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useSprintStatusTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, status }: { sprintId: string; status: 'planning' | 'active' | 'completed' }) =>
      apiClient.patch<{ ok: boolean; sprint: Sprint }>(`/api/sprints/${sprintId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sprints });
      qc.invalidateQueries({ queryKey: ['sprint'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useSprintGenerateTasks() {
  return useMutation({
    mutationFn: (sprintId: string) =>
      apiClient.post<SprintGenerateResult>(`/api/sprints/${sprintId}/generate`),
  });
}

export function useSprintApplyTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, new_tasks, existing_action_ids }: { sprintId: string; new_tasks: ProposedTask[]; existing_action_ids?: string[] }) =>
      apiClient.post<{ ok: boolean; created: number; linked: number }>(`/api/sprints/${sprintId}/apply`, { new_tasks, existing_action_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sprints });
      qc.invalidateQueries({ queryKey: queryKeys.actions });
      qc.invalidateQueries({ queryKey: ['sprintReport'] });
    },
  });
}

export function useSprintReport(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprintReport', sprintId],
    queryFn: () => apiClient.get<SprintReport>(`/api/sprints/${sprintId}/report`),
    enabled: !!sprintId,
  });
}

export function useSprintReportAnalyze() {
  return useMutation({
    mutationFn: (sprintId: string) =>
      apiClient.post<{ analysis: string; ai_analysis: string | null }>(`/api/sprints/${sprintId}/report/analyze`),
  });
}

export function useSprintBusinessReport() {
  return useMutation({
    mutationFn: (sprintId: string) =>
      apiClient.post<{ summary: string; business_report: string | null }>(`/api/sprints/${sprintId}/report/business`),
  });
}

export function useSprintReportDocument() {
  return useMutation({
    mutationFn: ({ sprintId, style, include_analysis, include_business }: { sprintId: string; style?: string; include_analysis?: boolean; include_business?: boolean }) =>
      apiClient.post<{ html: string }>(`/api/sprints/${sprintId}/report/document`, { style, include_analysis, include_business }),
  });
}

export function useSprintReportPresentation() {
  return useMutation({
    mutationFn: ({ sprintId, include_analysis, include_business }: { sprintId: string; include_analysis?: boolean; include_business?: boolean }) =>
      apiClient.post<{ html: string }>(`/api/sprints/${sprintId}/report/presentation`, { include_analysis, include_business }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPRINT ADVANCED FEATURES (velocity, health, retro, standup, capacity, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

import type { SprintVelocity, SprintHealthScore, SprintRetrospective, SprintStandup, SprintCapacity } from '../types/godmode';

export function useSprintVelocity(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprintVelocity', sprintId],
    queryFn: () => apiClient.get<SprintVelocity & { velocity_history: SprintVelocity[] }>(`/api/sprints/${sprintId}/velocity`),
    enabled: !!sprintId,
  });
}

export function useSprintHealth(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprintHealth', sprintId],
    queryFn: () => apiClient.get<SprintHealthScore>(`/api/sprints/${sprintId}/health`),
    enabled: !!sprintId,
    refetchInterval: 60_000,
  });
}

export function useSprintRetrospective() {
  return useMutation({
    mutationFn: ({ sprintId, went_well, went_wrong, action_items }: { sprintId: string; went_well?: string[]; went_wrong?: string[]; action_items?: string[] }) =>
      apiClient.post<SprintRetrospective>(`/api/sprints/${sprintId}/retrospective`, { went_well, went_wrong, action_items }),
  });
}

export function useSprintClone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, name, offset_days, clone_tasks, context }: { sprintId: string; name?: string; offset_days?: number; clone_tasks?: boolean; context?: string }) =>
      apiClient.post<{ ok: boolean; sprint: Sprint; tasks_cloned: number }>(`/api/sprints/${sprintId}/clone`, { name, offset_days, clone_tasks, context }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sprints });
    },
  });
}

export function useSprintStandup() {
  return useMutation({
    mutationFn: (sprintId: string) =>
      apiClient.post<SprintStandup>(`/api/sprints/${sprintId}/standup`),
  });
}

export function useSprintEstimatePoints() {
  return useMutation({
    mutationFn: ({ sprintId, task, description }: { sprintId: string; task?: string; description?: string }) =>
      apiClient.post<{ points: number; confidence: string; reasoning: string }>(`/api/sprints/${sprintId}/estimate-points`, { task, description }),
  });
}

export function useSprintCapacity() {
  return useMutation({
    mutationFn: ({ sprintId, capacities }: { sprintId: string; capacities: Record<string, number> }) =>
      apiClient.post<{ capacity: SprintCapacity[]; ai_recommendation: string | null }>(`/api/sprints/${sprintId}/capacity`, { capacities }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER STORIES (full CRUD)
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserStory {
  id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  priority?: string;
  status?: string;
  sprint_id?: string;
  story_points?: number;
  created_at?: string;
}

export function useUserStories() {
  return useQuery({
    queryKey: ['userStories'],
    queryFn: () => apiClient.get<{ ok: boolean; stories: UserStory[] }>('/api/user-stories'),
  });
}

export function useCreateUserStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserStory>) =>
      apiClient.post<{ ok: boolean; story: UserStory }>('/api/user-stories', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userStories'] }),
  });
}

export function useUpdateUserStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<UserStory> & { id: string }) =>
      apiClient.put<{ ok: boolean; story: UserStory }>(`/api/user-stories/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userStories'] }),
  });
}

export function useDeleteUserStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/user-stories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userStories'] }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAILS (ingest + management)
// ═══════════════════════════════════════════════════════════════════════════════

export function useIngestEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { emailText?: string; emlBase64?: string; msgBase64?: string; filename?: string; sprint_id?: string }) =>
      apiClient.post<{ ok: boolean; email: Record<string, unknown>; analysis?: Record<string, unknown> }>('/api/emails', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.facts });
      qc.invalidateQueries({ queryKey: queryKeys.decisions });
      qc.invalidateQueries({ queryKey: queryKeys.risks });
      qc.invalidateQueries({ queryKey: queryKeys.actions });
      qc.invalidateQueries({ queryKey: queryKeys.questions });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTIONS ENRICHMENT (AI-assign people)
// ═══════════════════════════════════════════════════════════════════════════════

export function useEnrichQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ ok: boolean; enriched: number }>('/api/questions/enrich'),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.questions }),
  });
}

// useImportConversation is defined above (near useParseConversation)

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANIES (full CRUD + AI analysis)
// ═══════════════════════════════════════════════════════════════════════════════

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  contacts_count?: number;
  analysis?: Record<string, unknown>;
  tags?: string[];
  status?: string;
  created_at: string;
  updated_at?: string;
}

export function useCompanies(params?: { search?: string; industry?: string }) {
  const sp = new URLSearchParams();
  if (params?.search) sp.set('search', params.search);
  if (params?.industry) sp.set('industry', params.industry);
  const qs = sp.toString();
  return useQuery({
    queryKey: ['companies', qs],
    queryFn: () => apiClient.get<{ ok: boolean; companies: Company[]; total: number }>(`/api/companies${qs ? `?${qs}` : ''}`),
  });
}

export function useCompany(id: string | null) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => apiClient.get<{ ok: boolean; company: Company }>(`/api/companies/${id}`),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Company>) =>
      apiClient.post<{ ok: boolean; company: Company }>('/api/companies', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Company> & { id: string }) =>
      apiClient.put<{ ok: boolean; company: Company }>(`/api/companies/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['company'] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/companies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useAnalyzeCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ ok: boolean; analysis: Record<string, unknown> }>(`/api/companies/${id}/analyze`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['company'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface WeeklyReport {
  period: string;
  generated_at: string;
  summary: string;
  highlights: string[];
  risks: string[];
  kpis: Record<string, unknown>;
  sections: Record<string, unknown>;
  html?: string;
}

export function useWeeklyReport(week?: string) {
  const qs = week ? `?week=${week}` : '';
  return useQuery({
    queryKey: ['weeklyReport', week ?? 'current'],
    queryFn: () => apiClient.get<{ ok: boolean; report: WeeklyReport }>(`/api/reports/weekly${qs}`),
  });
}

export function useGenerateWeeklyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params?: { week?: string; regenerate?: boolean }) =>
      apiClient.post<{ ok: boolean; report: WeeklyReport }>('/api/reports/weekly', params ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weeklyReport'] }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export function useGlobalSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ['globalSearch', query],
    queryFn: () => apiClient.get<{ ok: boolean; results: SearchResult[]; total: number }>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: enabled && query.length >= 2,
    staleTime: 10_000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS (threaded comments on any entity)
// ═══════════════════════════════════════════════════════════════════════════════

export interface Comment {
  id: string;
  content: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  target_type: string;
  target_id: string;
  parent_id?: string | null;
  resolved?: boolean;
  replies?: Comment[];
  created_at: string;
  updated_at?: string;
}

export function useComments(targetType: string, targetId: string | null) {
  return useQuery({
    queryKey: ['comments', targetType, targetId],
    queryFn: () => apiClient.get<{ comments: Comment[]; total: number }>(`/api/comments/${targetType}/${targetId}`),
    enabled: !!targetType && !!targetId,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { targetType: string; targetId: string; content: string; parent_id?: string }) =>
      apiClient.post<{ success: boolean; comment: Comment }>(`/api/comments/${data.targetType}/${data.targetId}`, {
        content: data.content,
        parent_id: data.parent_id,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiClient.put<{ success: boolean; comment: Comment }>(`/api/comments/${id}`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useResolveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      apiClient.post<{ success: boolean; comment: Comment }>(`/api/comments/${id}/resolve`, { resolved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED
// ═══════════════════════════════════════════════════════════════════════════════

export interface ActivityEntry {
  id: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export function useProjectActivity(projectId: string | null, params?: { limit?: number; offset?: number; action?: string }) {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.offset) sp.set('offset', String(params.offset));
  if (params?.action) sp.set('action', params.action);
  const qs = sp.toString();
  return useQuery({
    queryKey: ['activity', projectId, qs],
    queryFn: () => apiClient.get<{ activities: ActivityEntry[]; total: number }>(`/api/projects/${projectId}/activity${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAMS (CRUD + members)
// ═══════════════════════════════════════════════════════════════════════════════

export interface Team {
  id: string;
  name: string;
  description?: string;
  color?: string;
  team_type?: string;
  memberCount?: number;
  memberDetails?: Array<{ contactId: string; name?: string; role?: string; isLead?: boolean }>;
  created_at?: string;
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => apiClient.get<{ ok: boolean; teams: Team[] }>('/api/teams'),
  });
}

export function useTeam(id: string | null) {
  return useQuery({
    queryKey: ['team', id],
    queryFn: () => apiClient.get<{ ok: boolean; team: Team; members: Array<Record<string, unknown>> }>(`/api/teams/${id}`),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Team>) =>
      apiClient.post<{ ok: boolean; id: string }>('/api/teams', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Team> & { id: string }) =>
      apiClient.put<{ ok: boolean }>(`/api/teams/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/teams/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, contactId, role, isLead }: { teamId: string; contactId: string; role?: string; isLead?: boolean }) =>
      apiClient.post<{ ok: boolean }>(`/api/teams/${teamId}/members`, { contactId, role, isLead }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, contactId }: { teamId: string; contactId: string }) =>
      apiClient.delete(`/api/teams/${teamId}/members/${contactId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVITES (project invitation system)
// ═══════════════════════════════════════════════════════════════════════════════

export interface Invite {
  id: string;
  project_id: string;
  email?: string;
  role: string;
  token: string;
  status?: string;
  expires_at?: string;
  created_at: string;
  created_by?: string;
}

export function useProjectInvites(projectId: string | null) {
  return useQuery({
    queryKey: ['invites', projectId],
    queryFn: () => apiClient.get<{ invites: Invite[] }>(`/api/projects/${projectId}/invites`),
    enabled: !!projectId,
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; role?: string; email?: string; expiresInHours?: number; message?: string }) =>
      apiClient.post<{ success: boolean; invite: Invite; invite_url: string; token: string; email_sent: boolean }>(`/api/projects/${projectId}/invites`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useGenerateInviteLink() {
  return useMutation({
    mutationFn: (projectId: string) =>
      apiClient.get<{ success: boolean; link: string; token: string; expires_at?: string }>(`/api/projects/${projectId}/invites/link`),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => apiClient.delete(`/api/invites/${inviteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<{ success: boolean; membership: Record<string, unknown> }>('/api/invites/accept', { token }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════════════════════

export function useAuditLog(projectId: string | null, params?: { limit?: number; offset?: number; action?: string }) {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.offset) sp.set('offset', String(params.offset));
  if (params?.action) sp.set('action', params.action);
  const qs = sp.toString();
  return useQuery({
    queryKey: ['audit', projectId, qs],
    queryFn: () => apiClient.get<{ ok: boolean; entries: Array<Record<string, unknown>>; total: number }>(`/api/projects/${projectId}/audit${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}
