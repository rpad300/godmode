/**
 * Sprints Service
 * Create sprint, generate tasks from emails/transcripts, apply
 */

import { http } from './api';

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  context?: string;
  analysis_start_date?: string;
  analysis_end_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProposedTask {
  task: string;
  description?: string;
  size_estimate?: string;
  definition_of_done?: string[];
  acceptance_criteria?: string[];
  priority?: string;
  due_date?: string;
}

export interface SprintGenerateResult {
  proposed_new_tasks: ProposedTask[];
  existing_action_ids: string[];
  existing_details?: { id: string; task: string; status: string }[];
}

export interface SprintApplyResult {
  ok: boolean;
  created: number;
  linked: number;
  sprint: Sprint;
}

export async function getSprints(): Promise<Sprint[]> {
  try {
    const response = await http.get<{ sprints: Sprint[] }>('/api/sprints');
    return response.data.sprints || [];
  } catch {
    return [];
  }
}

export async function getSprint(id: string): Promise<Sprint | null> {
  try {
    const response = await http.get<{ sprint: Sprint }>(`/api/sprints/${id}`);
    return response.data.sprint || null;
  } catch {
    return null;
  }
}

export async function createSprint(data: {
  name: string;
  start_date: string;
  end_date: string;
  context?: string;
  analysis_start_date?: string;
  analysis_end_date?: string;
}): Promise<Sprint> {
  const response = await http.post<{ sprint: Sprint }>('/api/sprints', data);
  return response.data.sprint;
}

export async function generateSprintTasks(
  sprintId: string,
  body?: { analysis_start_date?: string; analysis_end_date?: string }
): Promise<SprintGenerateResult> {
  const response = await http.post<SprintGenerateResult>(`/api/sprints/${sprintId}/generate`, body || {});
  return response.data;
}

export async function applySprintGeneration(
  sprintId: string,
  body: { new_tasks: ProposedTask[]; existing_action_ids: string[] }
): Promise<SprintApplyResult> {
  const response = await http.post<SprintApplyResult>(`/api/sprints/${sprintId}/apply`, body);
  return response.data;
}

/** Report: sprint + actions + breakdown for charts */
export interface SprintReport {
  sprint: Sprint;
  actions: Array<{ id: string; task?: string; content?: string; status?: string; owner?: string; task_points?: number }>;
  breakdown: { by_status: Record<string, number>; by_assignee: Record<string, number> };
  total_task_points: number;
  completed_task_points: number;
  total_tasks: number;
  completed_tasks: number;
}

export async function getSprintReport(sprintId: string): Promise<SprintReport | null> {
  try {
    const response = await http.get<SprintReport>(`/api/sprints/${sprintId}/report`);
    return response.data ?? null;
  } catch {
    return null;
  }
}

export async function analyzeSprintReport(sprintId: string): Promise<{ analysis: string; ai_analysis: string | null; error?: string }> {
  const response = await http.post<{ analysis: string; ai_analysis: string | null; error?: string }>(
    `/api/sprints/${sprintId}/report/analyze`,
    {}
  );
  return response.data;
}

export async function getSprintBusinessReport(sprintId: string): Promise<{
  summary: string;
  business_report: string | null;
  error?: string;
}> {
  const response = await http.post<{ summary: string; business_report: string | null; error?: string }>(
    `/api/sprints/${sprintId}/report/business`,
    {}
  );
  return response.data;
}

export type ReportDocumentStyle =
  | ''
  | 'sprint_report_style_corporate_classic'
  | 'sprint_report_style_modern_minimal'
  | 'sprint_report_style_startup_tech'
  | 'sprint_report_style_consultancy';

export async function generateSprintReportDocument(
  sprintId: string,
  options?: { include_analysis?: boolean; include_business?: boolean; style?: ReportDocumentStyle }
): Promise<{ html: string }> {
  const response = await http.post<{ html: string }>(`/api/sprints/${sprintId}/report/document`, {
    include_analysis: options?.include_analysis ?? false,
    include_business: options?.include_business ?? false,
    style: options?.style ?? '',
  });
  return response.data;
}

export async function generateSprintReportPresentation(
  sprintId: string,
  options?: { include_analysis?: boolean; include_business?: boolean }
): Promise<{ html: string }> {
  const response = await http.post<{ html: string }>(`/api/sprints/${sprintId}/report/presentation`, {
    include_analysis: options?.include_analysis ?? false,
    include_business: options?.include_business ?? false,
  });
  return response.data;
}
