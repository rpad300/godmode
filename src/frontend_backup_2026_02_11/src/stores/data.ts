/**
 * Data Store
 * Application data cache
 */

import type { Fact } from '../services/facts';

// Types
export interface Question {
  id: string;
  content: string;  // Primary field (API uses this)
  question?: string;  // Legacy field for backwards compatibility
  context?: string;
  answer?: string;
  answer_source?: string;
  status: 'open' | 'answered' | 'dismissed' | 'pending' | 'assigned' | 'resolved' | 'reopened' | 'closed' | 'deferred';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
  source?: string;
  source_file?: string;
  created_at?: string;  // API format
  createdAt?: string;   // Legacy format
  updated_at?: string;  // API format
  updatedAt?: string;   // Legacy format
  assigned_to?: string;
  answered_by_contact_id?: string;
  answered_by_name?: string;
  follow_up_to?: string;
  // SOTA fields
  sla_hours?: number;
  sla_breached?: boolean;
  extracted_entities?: Array<{ type: string; name: string; entity_id?: string; confidence?: number }>;
  extracted_topics?: Array<{ name: string; type?: string; confidence?: number }>;
}

export interface Risk {
  id: string | number;
  content?: string;
  description?: string;
  impact: 'high' | 'medium' | 'low' | 'critical';
  probability?: 'high' | 'medium' | 'low';
  likelihood?: 'high' | 'medium' | 'low';
  mitigation?: string;
  owner?: string;
  status: 'open' | 'mitigating' | 'mitigated' | 'accepted' | 'closed';
  createdAt?: string;
  created_at?: string;
}

export interface Action {
  id: string;
  task: string;
  assignee?: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface Decision {
  id: string | number;
  decision: string;
  content?: string;
  rationale?: string;
  madeBy?: string;
  made_by?: string;
  madeAt: string;
  decided_at?: string;
  status: 'proposed' | 'approved' | 'rejected' | 'deferred' | 'active' | 'superseded' | 'revoked';
  source?: string;
  source_file?: string;
  owner?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  organization?: string;
  role?: string;
  rolePrompt?: string;
  department?: string;
  linkedin?: string;
  timezone?: string;
  location?: string;
  photoUrl?: string;
  avatarUrl?: string;
  photo_url?: string;
  avatar_url?: string;
  notes?: string;
  tags?: string[];
  aliases?: string[];
  isFavorite?: boolean;
  is_favorite?: boolean;
}

export interface ChatSource {
  id: string;
  type: string;
  score: number;
  rrfScore?: number;
  semanticScore?: number;
  keywordScore?: number;
  sourceCount?: number;
  source?: string;
  contactName?: string;
  contactRole?: string;
  avatarUrl?: string;
}

export interface ChatRAGInfo {
  method: string;
  vectorResults: number;
  graphResults: number;
  fusedResults: number;
  usedHyDE: boolean;
  entityFilter?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: ChatSource[] | string[];
  queryType?: string;
  confidence?: 'high' | 'medium' | 'low';
  contextQuality?: string;
  rag?: ChatRAGInfo;
}

export interface DataState {
  questions: Question[];
  risks: Risk[];
  actions: Action[];
  decisions: Decision[];
  facts: Fact[];
  contacts: Contact[];
  chatHistory: ChatMessage[];
  projects: Array<{ id: string; name: string }>;
  lastUpdated: Record<string, number>;
}

// Initial state
const initialState: DataState = {
  questions: [],
  risks: [],
  actions: [],
  decisions: [],
  facts: [],
  contacts: [],
  chatHistory: [],
  projects: [],
  lastUpdated: {},
};

// State
let state: DataState = { ...initialState };

// Listeners
const listeners: Set<(state: DataState) => void> = new Set();

/**
 * Notify all listeners
 */
function notify(): void {
  listeners.forEach(fn => fn(state));
}

/**
 * Get current state
 */
export function getState(): DataState {
  return state;
}

/**
 * Subscribe to state changes
 */
export function subscribe(callback: (state: DataState) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Set questions
 */
export function setQuestions(questions: Question[]): void {
  state = { 
    ...state, 
    questions,
    lastUpdated: { ...state.lastUpdated, questions: Date.now() }
  };
  notify();
}

/**
 * Set risks
 */
export function setRisks(risks: Risk[]): void {
  state = { 
    ...state, 
    risks,
    lastUpdated: { ...state.lastUpdated, risks: Date.now() }
  };
  notify();
}

/**
 * Set actions
 */
export function setActions(actions: Action[]): void {
  state = { 
    ...state, 
    actions,
    lastUpdated: { ...state.lastUpdated, actions: Date.now() }
  };
  notify();
}

/**
 * Set decisions
 */
export function setDecisions(decisions: Decision[]): void {
  state = { 
    ...state, 
    decisions,
    lastUpdated: { ...state.lastUpdated, decisions: Date.now() }
  };
  notify();
}

/**
 * Set facts
 */
export function setFacts(facts: Fact[]): void {
  state = { 
    ...state, 
    facts,
    lastUpdated: { ...state.lastUpdated, facts: Date.now() }
  };
  notify();
}

/**
 * Set contacts
 */
export function setContacts(contacts: Contact[]): void {
  state = { 
    ...state, 
    contacts,
    lastUpdated: { ...state.lastUpdated, contacts: Date.now() }
  };
  notify();
}

/**
 * Set chat history
 */
export function setChatHistory(chatHistory: ChatMessage[]): void {
  state = { ...state, chatHistory };
  notify();
}

/**
 * Add chat message
 */
export function addChatMessage(message: ChatMessage): void {
  state = { ...state, chatHistory: [...state.chatHistory, message] };
  notify();
}

/**
 * Set projects
 */
export function setProjects(projects: Array<{ id: string; name: string }>): void {
  state = { 
    ...state, 
    projects,
    lastUpdated: { ...state.lastUpdated, projects: Date.now() }
  };
  notify();
}

/**
 * Clear chat history
 */
export function clearChatHistory(): void {
  state = { ...state, chatHistory: [] };
  notify();
}

/**
 * Reset to initial state
 */
export function reset(): void {
  state = { ...initialState };
  notify();
}

// Export as namespace
export const dataStore = {
  getState,
  subscribe,
  setQuestions,
  setRisks,
  setActions,
  setDecisions,
  setFacts,
  setContacts,
  setChatHistory,
  addChatMessage,
  setProjects,
  clearChatHistory,
  reset,
};
