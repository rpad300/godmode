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
  costs: ['costs'] as const,
  history: ['history'] as const,
  emails: ['emails'] as const,
  processStatus: ['processStatus'] as const,
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
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

// ── Processing ──────────────────────────────────────────────────────────────

export function useProcessFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { provider?: string; model?: string }) =>
      apiClient.post<ProcessResult>('/api/process', options),
    onSuccess: () => {
      // Invalidate queries that will change after processing
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
    refetchInterval: 3000, // Poll while active
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
      // Invalidate all data queries after reset
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
    mutationFn: (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
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
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/questions'),
  });
}

// ── Facts ───────────────────────────────────────────────────────────────────

export function useFacts() {
  return useQuery({
    queryKey: queryKeys.facts,
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/facts'),
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
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/actions'),
  });
}

// ── Decisions ───────────────────────────────────────────────────────────────

export function useDecisions() {
  return useQuery({
    queryKey: queryKeys.decisions,
    queryFn: () => apiClient.get<Array<Record<string, unknown>>>('/api/decisions'),
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

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      apiClient.post<{ response: string; sources?: unknown[] }>('/api/ask', { question: message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory });
    },
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

export function useCosts() {
  return useQuery({
    queryKey: queryKeys.costs,
    queryFn: () => apiClient.get<Record<string, unknown>>('/api/costs'),
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
