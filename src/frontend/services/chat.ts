/**
 * Chat Service
 * Handles chat and AI interactions
 */

import { http } from './api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: ChatSource[];
  contextQuality?: 'high' | 'medium' | 'low' | 'none';
}

export interface ChatSource {
  type: 'fact' | 'document' | 'question' | 'decision';
  id: string | number;
  title?: string;
  excerpt?: string;
}

export interface ChatRequest {
  message: string;
  context?: string;
  history?: Array<{ role: string; content: string }>;
  semantic?: boolean;
  deepReasoning?: boolean;
}

export interface ChatResponse {
  message: string;
  response: string;
  sources: ChatSource[];
  contextQuality: 'high' | 'medium' | 'low' | 'none';
}

export interface AskRequest {
  question: string;
  model?: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: {
    facts: number;
    questions: number;
    decisions: number;
    knowledgeItems: number;
  };
}

export interface SotChatRequest {
  message: string;
  model?: string;
}

export interface SotChatResponse {
  response: string;
  model: string;
  healthScore: number;
}

export interface BriefingResponse {
  briefing: string;
  analysis: string;
  generated_at: string;
  stats: Record<string, number>;
  cached: boolean;
  cacheSource?: 'supabase' | 'memory';
}

export interface BriefingHistoryItem {
  id: string;
  briefing: string;
  generated_at: string;
}

// Type alias for backwards compatibility
export type Briefing = BriefingResponse;

// Chat history for context
let chatHistory: ChatMessage[] = [];

/**
 * Send a chat message
 */
export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await http.post<ChatResponse>('/api/chat', {
    message: request.message,
    context: request.context,
    history: request.history || chatHistory.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    })),
    semantic: request.semantic ?? true,
    deepReasoning: request.deepReasoning ?? false,
  });

  // Add to history
  const userMessage: ChatMessage = {
    id: `msg-${Date.now()}-user`,
    role: 'user',
    content: request.message,
    timestamp: new Date().toISOString(),
  };

  const assistantMessage: ChatMessage = {
    id: `msg-${Date.now()}-assistant`,
    role: 'assistant',
    content: response.data.response,
    timestamp: new Date().toISOString(),
    sources: response.data.sources,
    contextQuality: response.data.contextQuality,
  };

  chatHistory.push(userMessage, assistantMessage);

  return response.data;
}

/**
 * Ask a question about the knowledge base
 */
export async function ask(request: AskRequest): Promise<AskResponse> {
  const response = await http.post<AskResponse>('/api/ask', request);
  return response.data;
}

/**
 * Chat with SOT context
 */
export async function sotChat(request: SotChatRequest): Promise<SotChatResponse> {
  const response = await http.post<SotChatResponse>('/api/sot/chat', request);
  return response.data;
}

/**
 * Get daily briefing
 */
export async function getBriefing(refresh = false): Promise<BriefingResponse> {
  const url = refresh ? '/api/briefing?refresh=true' : '/api/briefing';
  const response = await http.get<BriefingResponse>(url);
  return response.data;
}

/**
 * Get briefing history
 */
export async function getBriefingHistory(limit = 30): Promise<BriefingHistoryItem[]> {
  const response = await http.get<{ history: BriefingHistoryItem[]; total: number }>(`/api/briefing/history?limit=${limit}`);
  return response.data.history || [];
}

/**
 * Get weekly report
 */
export async function getWeeklyReport(): Promise<string> {
  const response = await http.get<string>('/api/reports/weekly');
  return typeof response.data === 'string' ? response.data : '';
}

/**
 * Generate executive summary
 */
export async function generateExecutiveSummary(): Promise<string> {
  const response = await http.post<{ summary: string }>('/api/sot/executive-summary');
  return response.data.summary || '';
}

/**
 * Get chat history
 */
export function getChatHistory(): ChatMessage[] {
  return [...chatHistory];
}

/**
 * Clear chat history
 */
export function clearChatHistory(): void {
  chatHistory = [];
}

/**
 * Add message to history
 */
export function addToHistory(message: ChatMessage): void {
  chatHistory.push(message);
}

export const chatService = {
  send: sendMessage,
  ask,
  sotChat,
  getBriefing,
  getBriefingHistory,
  getWeeklyReport,
  generateExecutiveSummary,
  getHistory: getChatHistory,
  clearHistory: clearChatHistory,
  addToHistory,
};
