/**
 * React Query hooks for GodMode data fetching and mutations.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

// ── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  stats: ['stats'] as const,
  questions: ['questions'] as const,
  facts: ['facts'] as const,
  risks: ['risks'] as const,
  actions: ['actions'] as const,
  decisions: ['decisions'] as const,
  contacts: ['contacts'] as const,
  files: ['files'] as const,
  pendingFiles: ['pendingFiles'] as const,
  projects: ['projects'] as const,
  chatHistory: ['chatHistory'] as const,
  teamAnalysis: ['teamAnalysis'] as const,
  graph: ['graph'] as const,
  costs: (period: string) => ['costs', period] as const,
  history: ['history'] as const,
  emails: ['emails'] as const,
  processStatus: ['processStatus'] as const,
  adminStats: ['adminStats'] as const,
  adminProviders: ['adminProviders'] as const,
  adminAudit: ['adminAudit'] as const,
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
  [key: string]: unknown;
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
}

export interface ChatResponse {
  message?: string;
  response: string;
  sources: ChatSource[];
  contextQuality?: 'high' | 'medium' | 'low' | 'none';
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
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/stats'),
  });
}

// ── Projects ────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiClient.get<Project[]>('/api/projects'),
  });
}

// ── Pending Files ───────────────────────────────────────────────────────────

export function usePendingFiles() {
  return useQuery({
    queryKey: queryKeys.pendingFiles,
    queryFn: () => apiClient.get<PendingFile[]>('/api/files'),
    refetchInterval: 10000,
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
  });
}

export function useProcessStatus() {
  return useQuery({
    queryKey: queryKeys.processStatus,
    queryFn: () => apiClient.get<ProcessStatus>('/api/process/status'),
    refetchInterval: 3000,
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
    mutationFn: ({ files, type }: { files: File[]; type: string }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('type', type);
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

// ── Questions ───────────────────────────────────────────────────────────────

export function useQuestions() {
  return useQuery({
    queryKey: queryKeys.questions,
    queryFn: () => apiClient.get<Question[]>('/api/questions'),
  });
}

// ── Facts ───────────────────────────────────────────────────────────────────

export function useFacts() {
  return useQuery({
    queryKey: queryKeys.facts,
    queryFn: () => apiClient.get<Fact[]>('/api/facts'),
  });
}

// ── Risks ───────────────────────────────────────────────────────────────────

export function useRisks() {
  return useQuery({
    queryKey: queryKeys.risks,
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/risks'),
  });
}

// ── Actions ─────────────────────────────────────────────────────────────────

export function useActions() {
  return useQuery({
    queryKey: queryKeys.actions,
    queryFn: () => apiClient.get<ActionItem[]>('/api/actions'),
  });
}

// ── Decisions ───────────────────────────────────────────────────────────────

export function useDecisions() {
  return useQuery({
    queryKey: queryKeys.decisions,
    queryFn: () => apiClient.get<Decision[]>('/api/decisions'),
  });
}

// ── Contacts ────────────────────────────────────────────────────────────────

export function useContacts() {
  return useQuery({
    queryKey: queryKeys.contacts,
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/contacts'),
  });
}

// ── Chat ────────────────────────────────────────────────────────────────────

export function useSendChatMessage() {
  return useMutation({
    mutationFn: ({
      message,
      history,
    }: {
      message: string;
      history?: Array<{ role: string; content: string }>;
    }) =>
      apiClient.post<ChatResponse>('/api/chat', {
        message,
        history: history ?? [],
        semantic: true,
      }),
  });
}

// ── Team Analysis ───────────────────────────────────────────────────────────

export function useTeamAnalysis() {
  return useQuery({
    queryKey: queryKeys.teamAnalysis,
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/team-analysis'),
  });
}

// ── Costs ───────────────────────────────────────────────────────────────────

export function useCosts(period: string = 'month') {
  return useQuery({
    queryKey: queryKeys.costs(period),
    queryFn: () => apiClient.get<CostSummary>(`/api/costs?period=${period}`),
  });
}

// ── History ─────────────────────────────────────────────────────────────────

export function useHistory() {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/history'),
  });
}

// ── Emails ──────────────────────────────────────────────────────────────────

export function useEmails() {
  return useQuery({
    queryKey: queryKeys.emails,
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/emails'),
  });
}

// ── Admin ───────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/admin/stats'),
  });
}

export function useAdminProviders() {
  return useQuery({
    queryKey: queryKeys.adminProviders,
    queryFn: () =>
      apiClient.get<
        Array<{ id: string; name: string; enabled: boolean; models: string[]; status?: string }>
      >('/api/admin/providers'),
  });
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: queryKeys.adminAudit,
    queryFn: () =>
      apiClient.get<
        Array<{
          id: string;
          table_name: string;
          operation: string;
          changed_by_email?: string;
          changed_at: string;
        }>
      >('/api/admin/audit'),
  });
}
