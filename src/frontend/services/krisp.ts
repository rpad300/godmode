/**
 * Krisp Integration Service
 * Handles Krisp AI Meeting Assistant integration
 */

import { http } from './api';

// ==================== Types ====================

export interface KrispWebhook {
  id: string;
  user_id: string;
  webhook_token: string;
  webhook_secret: string;
  webhook_url: string;
  is_active: boolean;
  events_enabled: string[];
  last_event_at?: string;
  total_events_received: number;
  created_at: string;
  updated_at: string;
}

export interface KrispTranscript {
  id: string;
  user_id: string;
  krisp_meeting_id: string;
  source: 'webhook' | 'mcp_sync';
  event_type: string;
  krisp_title: string;
  display_title?: string;
  meeting_date: string;
  duration_minutes?: number;
  speakers: string[];
  has_unidentified_speakers: boolean;
  matched_project_id?: string;
  project_confidence?: number;
  project_candidates?: ProjectCandidate[];
  status_reason?: string;
  matched_contacts?: MatchedContact[];
  transcript_text?: string;
  action_items?: unknown[];
  key_points?: unknown[];
  notes?: unknown;
  status: 'pending' | 'quarantine' | 'ambiguous' | 'matched' | 'processed' | 'failed' | 'skipped';
  retry_count: number;
  processed_document_id?: string;
  received_at: string;
  projects?: {
    id: string;
    name: string;
    project_number: string;
  };
}

export interface ProjectCandidate {
  projectId: string;
  projectName: string;
  projectNumber: string;
  count: number;
  percentage: number;
}

export interface MatchedContact {
  speaker: string;
  contact_id: string | null;
  contact_name: string | null;
  action: string;
  confidence: number;
}

export interface KrispSpeakerMapping {
  id: string;
  user_id?: string;
  project_id: string;
  speaker_name: string;
  contact_id: string;
  is_global: boolean;
  is_active: boolean;
  confidence: number;
  source: string;
  contacts?: {
    id: string;
    name: string;
  };
}

export interface TranscriptsSummary {
  total_count: number;
  pending_count: number;
  quarantine_count: number;
  ambiguous_count: number;
  processed_count: number;
  failed_count: number;
}

export interface QuarantineStats {
  total: number;
  quarantine: number;
  ambiguous: number;
  maxedOut: number;
  readyForRetry: number;
}

// ==================== Webhook Management ====================

/**
 * Get or create Krisp webhook configuration
 */
export async function getWebhook(): Promise<KrispWebhook | null> {
  try {
    const response = await http.get<{ webhook: KrispWebhook }>('/api/krisp/webhook');
    return response.data.webhook;
  } catch {
    return null;
  }
}

/**
 * Regenerate webhook credentials
 */
export async function regenerateWebhook(): Promise<KrispWebhook | null> {
  try {
    const response = await http.post<{ webhook: KrispWebhook }>('/api/krisp/webhook/regenerate');
    return response.data.webhook;
  } catch {
    return null;
  }
}

/**
 * Toggle webhook active status
 */
export async function toggleWebhook(isActive: boolean): Promise<boolean> {
  try {
    await http.put('/api/krisp/webhook/toggle', { is_active: isActive });
    return true;
  } catch {
    return false;
  }
}

/**
 * Update enabled events
 */
export async function updateEnabledEvents(events: string[]): Promise<string[]> {
  const response = await http.put<{ events: string[] }>('/api/krisp/webhook/events', { events });
  return response.data.events;
}

// ==================== Transcript Management ====================

/**
 * Get transcripts with optional filtering
 */
export async function getTranscripts(options: {
  status?: string | string[];
  projectId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<KrispTranscript[]> {
  const params = new URLSearchParams();
  
  if (options.status) {
    if (Array.isArray(options.status)) {
      params.append('status', options.status.join(','));
    } else {
      params.append('status', options.status);
    }
  }
  if (options.projectId) params.append('project_id', options.projectId);
  if (options.limit) params.append('limit', String(options.limit));
  if (options.offset) params.append('offset', String(options.offset));

  const url = `/api/krisp/transcripts${params.toString() ? `?${params}` : ''}`;
  const response = await http.get<{ transcripts: KrispTranscript[] }>(url);
  return response.data.transcripts;
}

/**
 * Get transcript by ID
 */
export async function getTranscript(id: string): Promise<KrispTranscript | null> {
  try {
    const response = await http.get<{ transcript: KrispTranscript }>(`/api/krisp/transcripts/${id}`);
    return response.data.transcript;
  } catch {
    return null;
  }
}

/**
 * Get transcripts summary
 */
export async function getTranscriptsSummary(): Promise<TranscriptsSummary | null> {
  try {
    const response = await http.get<{ summary: TranscriptsSummary }>('/api/krisp/transcripts/summary');
    return response.data.summary;
  } catch {
    return null;
  }
}

/**
 * Assign transcript to a project
 */
export async function assignProject(transcriptId: string, projectId: string): Promise<boolean> {
  try {
    await http.post(`/api/krisp/transcripts/${transcriptId}/assign`, { project_id: projectId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Skip/discard a transcript
 */
export async function skipTranscript(transcriptId: string, reason?: string): Promise<boolean> {
  try {
    await http.post(`/api/krisp/transcripts/${transcriptId}/skip`, { reason });
    return true;
  } catch {
    return false;
  }
}

/**
 * Force retry processing
 */
export async function retryTranscript(transcriptId: string): Promise<boolean> {
  try {
    await http.post(`/api/krisp/transcripts/${transcriptId}/retry`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Process a MATCHED transcript (create document)
 */
export async function processTranscript(transcriptId: string): Promise<boolean> {
  try {
    await http.post(`/api/krisp/transcripts/${transcriptId}/process`);
    return true;
  } catch {
    return false;
  }
}

// ==================== Speaker Mappings ====================

/**
 * Get speaker mappings
 */
export async function getMappings(): Promise<KrispSpeakerMapping[]> {
  try {
    const response = await http.get<{ mappings: KrispSpeakerMapping[] }>('/api/krisp/mappings');
    return response.data.mappings;
  } catch {
    return [];
  }
}

/**
 * Create speaker mapping
 */
export async function createMapping(
  speakerName: string,
  contactId: string,
  projectId: string,
  isGlobal = false
): Promise<KrispSpeakerMapping | null> {
  try {
    const response = await http.post<{ mapping: KrispSpeakerMapping }>('/api/krisp/mappings', {
      speaker_name: speakerName,
      contact_id: contactId,
      project_id: projectId,
      is_global: isGlobal
    });
    return response.data.mapping;
  } catch {
    return null;
  }
}

/**
 * Delete speaker mapping
 */
export async function deleteMapping(mappingId: string): Promise<boolean> {
  try {
    await http.delete(`/api/krisp/mappings/${mappingId}`);
    return true;
  } catch {
    return false;
  }
}

// ==================== AI Summary ====================

export interface TranscriptSummary {
  title: string;
  date?: string;
  duration?: number;
  speakers: string[];
  topic?: string;
  keyPoints: string[];
  actionItems: string[];
  decisions?: string[];
  nextSteps?: string;
  notes?: string;
  source: 'krisp_metadata' | 'ai_generated' | 'excerpt_fallback' | 'no_content';
}

export interface GenerateSummaryOptions {
  forceRegenerate?: boolean;
}

/**
 * Generate AI summary of a transcript
 */
export async function generateSummary(
  transcriptId: string, 
  options: GenerateSummaryOptions = {}
): Promise<TranscriptSummary | null> {
  try {
    const response = await http.post<{ summary: TranscriptSummary }>(
      `/api/krisp/transcripts/${transcriptId}/summary`,
      { forceRegenerate: options.forceRegenerate || false }
    );
    return response.data.summary;
  } catch {
    return null;
  }
}

// ==================== Quarantine ====================

/**
 * Get quarantine statistics
 */
export async function getQuarantineStats(): Promise<QuarantineStats | null> {
  try {
    const response = await http.get<{ stats: QuarantineStats }>('/api/krisp/quarantine/stats');
    return response.data.stats;
  } catch {
    return null;
  }
}

/**
 * Get quarantined transcripts
 */
export async function getQuarantinedTranscripts(): Promise<KrispTranscript[]> {
  return getTranscripts({ status: ['quarantine', 'ambiguous'] });
}

// ==================== MCP Import ====================

export interface McpMeeting {
  meeting_id: string;
  name: string;
  date: string;
  url?: string;
  speakers?: string[];
  attendees?: string[];
  is_recurring?: boolean;
  meeting_notes?: {
    detailed_summary?: string;
    key_points?: string[];
    action_items?: string[];
  };
  transcript?: {
    status?: string;
    text?: string;
  };
}

export interface McpSearchFilters {
  search?: string;
  after?: string;
  before?: string;
  participantDomains?: string[];
  limit?: number;
  offset?: number;
}

export interface ImportResult {
  meetingId: string;
  title?: string;
  success: boolean;
  transcriptId?: string;
  error?: string;
  duplicate?: boolean;
}

export interface ImportResponse {
  success: boolean;
  results: ImportResult[];
  imported: number;
  skipped: number;
  failed: number;
}

export interface ImportHistoryItem {
  id: string;
  krisp_meeting_id: string;
  krisp_title: string;
  meeting_date: string;
  status: string;
  created_at: string;
}

/**
 * Check which meetings have already been imported
 */
export async function getImportedMeetingIds(meetingIds: string[]): Promise<string[]> {
  if (!meetingIds.length) return [];
  
  try {
    const response = await http.get<{ imported: string[] }>(
      `/api/krisp/mcp/imported?ids=${meetingIds.join(',')}`
    );
    return response.data.imported;
  } catch {
    return [];
  }
}

/**
 * Import meetings from MCP data
 */
export async function importMeetings(
  meetings: McpMeeting[], 
  options: { forceReimport?: boolean } = {}
): Promise<ImportResponse | null> {
  try {
    const response = await http.post<ImportResponse>('/api/krisp/mcp/import', {
      meetings,
      forceReimport: options.forceReimport
    });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Import a single meeting
 */
export async function importMeeting(
  meeting: McpMeeting,
  options: { forceReimport?: boolean } = {}
): Promise<ImportResult | null> {
  const result = await importMeetings([meeting], options);
  return result?.results[0] || null;
}

/**
 * Get import history
 */
export async function getImportHistory(
  options: { limit?: number; offset?: number } = {}
): Promise<ImportHistoryItem[]> {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    
    const url = `/api/krisp/mcp/history${params.toString() ? '?' + params.toString() : ''}`;
    const response = await http.get<{ history: ImportHistoryItem[] }>(url);
    return response.data.history;
  } catch {
    return [];
  }
}

// ==================== Available Meetings (MCP Sync) ====================

export interface AvailableMeeting {
  id: string;
  user_id: string;
  krisp_meeting_id: string;
  meeting_name: string;
  meeting_date: string;
  meeting_url?: string;
  is_recurring: boolean;
  attendees: string[];
  speakers: string[];
  key_points: string[];
  action_items: unknown[];
  summary?: string;
  is_imported: boolean;
  imported_at?: string;
  imported_transcript_id?: string;
  first_seen_at: string;
  last_synced_at: string;
}

export interface AvailableMeetingsStats {
  total_available: number;
  total_imported: number;
  total_pending: number;
  oldest_meeting?: string;
  newest_meeting?: string;
  last_sync?: string;
}

export interface AvailableMeetingsResponse {
  meetings: AvailableMeeting[];
  stats: AvailableMeetingsStats;
}

export interface SyncMeetingsResponse {
  success: boolean;
  synced: number;
  errors: number;
}

export interface ImportAvailableResponse {
  success: boolean;
  imported: number;
  errors: Array<{ meetingId: string; error: string }>;
}

/**
 * Get available meetings from catalog
 */
export async function getAvailableMeetings(options: {
  limit?: number;
  offset?: number;
  showImported?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
} = {}): Promise<AvailableMeetingsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.showImported === false) params.set('showImported', 'false');
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    if (options.search) params.set('search', options.search);
    
    const url = `/api/krisp/available${params.toString() ? '?' + params.toString() : ''}`;
    const response = await http.get<AvailableMeetingsResponse>(url);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Sync meetings from MCP (called by Cursor agent)
 */
export async function syncMeetingsFromMcp(meetings: McpMeeting[]): Promise<SyncMeetingsResponse | null> {
  try {
    const response = await http.post<SyncMeetingsResponse>('/api/krisp/available/sync', { meetings });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Import selected available meetings
 */
export async function importAvailableMeetings(meetingIds: string[], projectId?: string): Promise<ImportAvailableResponse | null> {
  try {
    const response = await http.post<ImportAvailableResponse>('/api/krisp/available/import', { 
      meetingIds,
      projectId 
    });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Get available meetings stats
 */
export async function getAvailableMeetingsStats(): Promise<AvailableMeetingsStats | null> {
  try {
    const response = await http.get<{ stats: AvailableMeetingsStats }>('/api/krisp/available/stats');
    return response.data.stats;
  } catch {
    return null;
  }
}

/**
 * AI Summary result interface
 */
export interface MeetingSummary {
  key_points: string[];
  action_items: string[];
  excerpt: string;
  speakers?: string[];
  attendees?: string[];
  meeting_date?: string;
  mentioned_people?: string[];
}

export interface GenerateSummaryResponse {
  success: boolean;
  summary?: MeetingSummary;
  error?: string;
}

/**
 * Generate AI summary for a specific available meeting
 */
export async function generateAvailableMeetingSummary(meetingId: string): Promise<GenerateSummaryResponse | null> {
  try {
    const response = await http.post<GenerateSummaryResponse>('/api/krisp/available/summary', { meetingId });
    return response.data;
  } catch {
    return null;
  }
}

// ==================== Helpers ====================

/**
 * Format transcript status for display
 */
export function formatStatus(status: KrispTranscript['status']): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'blue' },
    quarantine: { label: 'Quarantine', color: 'yellow' },
    ambiguous: { label: 'Ambiguous', color: 'orange' },
    matched: { label: 'Matched', color: 'cyan' },
    processed: { label: 'Processed', color: 'green' },
    failed: { label: 'Failed', color: 'red' },
    skipped: { label: 'Skipped', color: 'gray' }
  };
  
  return statusMap[status] || { label: status, color: 'gray' };
}

/**
 * Format duration for display
 */
export function formatDuration(minutes?: number): string {
  if (!minutes) return '-';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Check if transcript needs action
 */
export function needsAction(transcript: KrispTranscript): boolean {
  return ['quarantine', 'ambiguous', 'failed'].includes(transcript.status);
}

/**
 * Get action items count
 */
export function getActionItemsCount(transcript: KrispTranscript): number {
  if (Array.isArray(transcript.action_items)) {
    return transcript.action_items.length;
  }
  return 0;
}
