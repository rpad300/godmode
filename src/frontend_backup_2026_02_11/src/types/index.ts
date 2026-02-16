/**
 * Types Index
 * Common type definitions
 */

// Re-export types from stores
export type {
  User,
  ProjectConfig,
  AppState,
} from '../stores/app';

export type {
  MainTab,
  SotView,
  DevTab,
  SelectedPerson,
  UIState,
} from '../stores/ui';

export type {
  Question,
  Risk,
  Action,
  Decision,
  Contact,
  ChatMessage,
  DataState,
} from '../stores/data';

export type {
  ChartInstance,
  NetworkInstance,
  ChartsState,
} from '../stores/charts';

// API Types
export interface ApiProject {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  settings?: Record<string, unknown>;
}

export interface ApiStats {
  total_questions: number;
  answered_questions: number;
  total_risks: number;
  high_priority_risks: number;
  total_actions: number;
  completed_actions: number;
  total_decisions: number;
  total_contacts: number;
  health_score: number;
}

export interface ApiConfig {
  aiProvider?: string;
  aiModel?: string;
  language?: string;
  auth?: {
    configured: boolean;
    provider?: string;
  };
}

// Processing Types
export interface ProcessingJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// File Types
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

// Event Types
export interface CustomEvents {
  'project:changed': { projectId: string };
  'data:updated': { type: string };
  'theme:changed': { theme: 'light' | 'dark' };
  'modal:open': { modalId: string };
  'modal:close': { modalId: string };
  'toast:show': { message: string; type: string };
}

// Utility Types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;
