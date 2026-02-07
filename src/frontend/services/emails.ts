/**
 * Emails Service
 * Handles email management and AI responses
 */

import { http } from './api';

export interface Email {
  id: string;
  message_id?: string;
  from: string;
  from_name?: string;
  from_email?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  body_text?: string;
  body_html?: string;
  date: string;
  thread_id?: string;
  labels?: string[];
  is_read: boolean;
  read?: boolean; // Alias for is_read
  is_starred: boolean;
  has_attachments: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
  // Direction and response tracking
  direction?: 'inbound' | 'outbound' | 'internal';
  requires_response?: boolean;
  response_sent?: boolean;
  response_drafted?: boolean;
  draft_response?: string;
  // AI fields
  ai_summary?: string;
  ai_category?: string;
  ai_sentiment?: 'positive' | 'neutral' | 'negative';
  ai_priority?: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  message_count: number;
  last_message_date: string;
  messages: Email[];
  summary?: string;
}

export interface DraftEmail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  replyTo?: string;
  threadId?: string;
}

export interface AIResponseSuggestion {
  tone: 'professional' | 'friendly' | 'formal' | 'brief';
  response: string;
  confidence: number;
}

/**
 * Get all emails
 */
export async function getEmails(filters?: {
  folder?: string;
  label?: string;
  unread?: boolean;
  starred?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  direction?: 'inbound' | 'outbound' | 'internal';
}): Promise<{ emails: Email[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (filters?.folder) params.set('folder', filters.folder);
    if (filters?.label) params.set('label', filters.label);
    if (filters?.unread) params.set('unread', 'true');
    if (filters?.starred) params.set('starred', 'true');
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const query = params.toString();
    const url = query ? `/api/emails?${query}` : '/api/emails';
    
    const response = await http.get<{ emails: Email[]; total: number }>(url);
    return response.data;
  } catch {
    return { emails: [], total: 0 };
  }
}

/**
 * Get a single email
 */
export async function getEmail(id: string): Promise<Email | null> {
  try {
    const response = await http.get<{ email: Email }>(`/api/emails/${id}`);
    return response.data.email;
  } catch {
    return null;
  }
}

/**
 * Get email thread
 */
export async function getEmailThread(threadId: string): Promise<EmailThread | null> {
  try {
    const response = await http.get<{ thread: EmailThread }>(`/api/emails/thread/${threadId}`);
    return response.data.thread;
  } catch {
    return null;
  }
}

/**
 * Mark email as read
 */
export async function markAsRead(id: string): Promise<void> {
  await http.put(`/api/emails/${id}/read`);
}

/**
 * Mark email as unread
 */
export async function markAsUnread(id: string): Promise<void> {
  await http.put(`/api/emails/${id}/unread`);
}

/**
 * Star an email
 */
export async function starEmail(id: string): Promise<void> {
  await http.put(`/api/emails/${id}/star`);
}

/**
 * Unstar an email
 */
export async function unstarEmail(id: string): Promise<void> {
  await http.put(`/api/emails/${id}/unstar`);
}

/**
 * Archive an email
 */
export async function archiveEmail(id: string): Promise<void> {
  await http.put(`/api/emails/${id}/archive`);
}

/**
 * Delete an email
 */
export async function deleteEmail(id: string): Promise<void> {
  await http.delete(`/api/emails/${id}`);
}

/**
 * Send an email
 */
export async function sendEmail(draft: DraftEmail): Promise<{ success: boolean; messageId: string }> {
  const response = await http.post<{ success: boolean; messageId: string }>('/api/emails/send', draft);
  return response.data;
}

/**
 * Save as draft
 */
export async function saveDraft(draft: DraftEmail): Promise<{ id: string }> {
  const response = await http.post<{ id: string }>('/api/emails/draft', draft);
  return response.data;
}

/**
 * Generate AI response
 */
export async function generateAIResponse(emailId: string, tone?: string): Promise<AIResponseSuggestion[]> {
  const response = await http.post<{ suggestions: AIResponseSuggestion[] }>(`/api/emails/${emailId}/ai-response`, {
    tone,
  });
  return response.data.suggestions || [];
}

/**
 * Generate AI summary of email
 */
export async function generateSummary(emailId: string): Promise<string> {
  const response = await http.post<{ summary: string }>(`/api/emails/${emailId}/summarize`);
  return response.data.summary || '';
}

/**
 * Categorize email with AI
 */
export async function categorizeEmail(emailId: string): Promise<{
  category: string;
  priority: string;
  sentiment: string;
}> {
  const response = await http.post<{
    category: string;
    priority: string;
    sentiment: string;
  }>(`/api/emails/${emailId}/categorize`);
  return response.data;
}

/**
 * Get email stats
 */
export async function getEmailStats(): Promise<{
  total: number;
  unread: number;
  starred: number;
  today: number;
  byCategory: Record<string, number>;
}> {
  const response = await http.get<{
    total: number;
    unread: number;
    starred: number;
    today: number;
    byCategory: Record<string, number>;
  }>('/api/emails/stats');
  return response.data;
}

/**
 * Sync emails from provider
 */
export async function syncEmails(): Promise<{ synced: number; errors: number }> {
  const response = await http.post<{ synced: number; errors: number }>('/api/emails/sync');
  return response.data;
}

/**
 * Get email by ID (alias for get)
 */
export async function getById(id: string): Promise<Email | null> {
  return getEmail(id);
}

/**
 * Get emails needing response
 */
export async function getNeedingResponse(): Promise<Email[]> {
  try {
    const response = await http.get<{ emails: Email[] }>('/api/emails?requires_response=true&response_sent=false');
    return response.data.emails || [];
  } catch {
    return [];
  }
}

/**
 * Mark email as responded
 */
export async function markResponded(id: string): Promise<void> {
  await http.put(`/api/emails/${id}/responded`);
}

/**
 * Generate response (alias for generateAIResponse)
 */
export async function generateResponse(emailId: string, tone?: string): Promise<AIResponseSuggestion[]> {
  return generateAIResponse(emailId, tone);
}

export const emailsService = {
  getAll: getEmails,
  get: getEmail,
  getById,
  getThread: getEmailThread,
  markAsRead,
  markAsUnread,
  star: starEmail,
  unstar: unstarEmail,
  archive: archiveEmail,
  delete: deleteEmail,
  send: sendEmail,
  saveDraft,
  generateAIResponse,
  generateResponse,
  generateSummary,
  categorize: categorizeEmail,
  getStats: getEmailStats,
  sync: syncEmails,
  getNeedingResponse,
  markResponded,
};
