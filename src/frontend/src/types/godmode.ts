/**
 * Purpose:
 *   Core domain type definitions for the GodMode application. Covers
 *   navigation tabs, projects, dashboard stats, extracted entities
 *   (facts, questions, risks, actions, decisions), contacts and their
 *   relationships, sprints, user stories, chat messages, processed files,
 *   and project membership.
 *
 * Responsibilities:
 *   - Provide shared TypeScript interfaces consumed by pages, hooks, and components
 *   - Declare the Window.electron.storage bridge for Electron desktop builds
 *
 * Key dependencies:
 *   - None (pure type declarations)
 *
 * Side effects:
 *   - Augments the global Window interface with an electron.storage API
 *
 * Notes:
 *   - TabId union must stay in sync with the route definitions in App.tsx.
 *   - The Window.electron declaration enables type-safe IPC when running inside
 *     an Electron shell; it is inert in the browser build.
 *   - ProjectMember.role uses display strings like "Top G", "Admin", etc.
 */
export type TabId = 'dashboard' | 'chat' | 'sot' | 'timeline' | 'contacts' | 'team-analysis' | 'files' | 'emails' | 'conversations' | 'graph' | 'costs' | 'history' | 'projects' | 'companies' | 'settings' | 'user-settings' | 'admin' | 'profile' | 'sprints';

export interface Category {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  color?: string;
  project_id?: string;
}

export interface ProjectRole {
  id: string;
  name: string;
  description: string;
  active: boolean;
  category?: string;
  role_context?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  documentsCount: number;
  factsCount: number;
  questionsCount: number;
  risksCount: number;
  actionsCount: number;
  role?: string;
  rolePrompt?: string;
  company_id?: string;
  company?: string;
  settings?: {
    roles?: ProjectRole[];
    category_leads?: Record<string, string>; // category_id -> user_id
  };
}

export interface DashboardStats {
  totalDocuments: number;
  totalFacts: number;
  totalQuestions: number;
  totalRisks: number;
  totalActions: number;
  totalDecisions: number;
  totalPeople: number;
  overdueActions: number;
  weeklyActivity?: { day: string; facts: number; actions: number; questions: number }[];
  activeSprint?: any;
  recentHistory?: any[];
  factsByCategory?: Record<string, number>;
  questionsByPriority?: { critical: number; high: number; medium: number; resolved: number };
  risksByImpact?: { high: number; medium: number; low: number };
  actionsByStatus?: { completed: number; in_progress: number; pending: number; overdue: number };
}

export interface Fact {
  id: string;
  content: string;
  category: 'technical' | 'process' | 'policy' | 'people' | 'timeline';
  source: string;
  confidence: number;
  createdAt: string;
}

export interface Question {
  id: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  status: 'open' | 'answered' | 'dismissed';
  answer?: string;
  source: string;
}

export interface Risk {
  id: string;
  content: string;
  impact: 'high' | 'medium' | 'low';
  likelihood: 'high' | 'medium' | 'low';
  mitigation?: string;
  owner?: string;
  status: 'open' | 'mitigated' | 'accepted';
  reported_by?: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  context?: string;
  status: 'planning' | 'active' | 'completed';
}

export interface UserStory {
  id: string;
  title: string;
  description?: string;
  sprintId: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  acceptanceCriteria?: string[];
}

export interface Action {
  id: string;
  task: string;
  description?: string;
  owner?: string;
  deadline?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'high' | 'medium' | 'low';
  sprint_id?: string;
  parent_story_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Decision {
  id: string;
  content: string;
  rationale?: string;
  owner?: string;
  decision_date?: string;
  status: 'approved' | 'pending' | 'rejected' | 'active';
  context?: string;
  impact?: string;
  made_by?: string;
  approved_by?: string;
  summary?: string;
}

export interface Contact {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  avatarUrl?: string;
  avatar?: string;
  photo_url?: string;
  department?: string;
  location?: string;
  timezone?: string;
  notes?: string;
  mentionCount?: number;
  aliases?: string[];
  is_favorite?: boolean;
  isFavorite?: boolean;
  tags?: string[];
  cargo?: string;
  empresa?: string;
}

export interface ContactRole {
  id: string;
  name: string;
  projectId: string;
}

export interface ContactRelationship {
  id: string;
  type: string;
  notes?: string;
  direction: 'forward' | 'backward';
  other_contact: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
    photo_url?: string;
  };
}

export interface ContactMention {
  id: string;
  type: 'document' | 'email' | 'conversation' | 'transcription';
  text: string;
  source: string;
  date: string;
  link?: string | null;
}

declare global {
  interface Window {
    electron: {
      storage: {
        getContacts: () => Promise<Contact[]>;
        getContactById: (id: string) => Promise<Contact | null>;
        addContact: (contact: Omit<Contact, 'id'>) => Promise<Contact>;
        updateContact: (id: string, updates: Partial<Contact>) => Promise<Contact>;
        deleteContact: (id: string) => Promise<boolean>;
        getProjects: () => Promise<Project[]>;
        getRoles: () => Promise<{ id: string; name: string }[]>;
        addRole: (name: string) => Promise<{ id: string; name: string }>;
        getContactProjects: (contactId: string) => Promise<any[]>;
        addContactToProject: (contactId: string, projectId: string, options?: any) => Promise<any>;
        removeContactFromProject: (contactId: string, projectId: string) => Promise<any>;
        getContactRelationships: (contactId: string) => Promise<ContactRelationship[]>;
        addContactRelationship: (data: any) => Promise<ContactRelationship>;
        getContactActivity: (contactId: string) => Promise<any[]>;
      };
    };
  }
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ProcessedFile {
  id: string;
  name: string;
  type: 'document' | 'transcript' | 'email' | 'conversation';
  size: string;
  processedAt: string;
  status: 'processed' | 'pending' | 'error';
  factsExtracted: number;
}

export interface ProjectMember {
  user_id: string;
  display_name: string;
  email?: string;
  role: string; // "Top G", "Admin", etc.
  avatar_url?: string;
  joined_at?: string;
  linked_contact_id?: string;
  linked_contact?: Contact;
  timezone?: string; // Important for Golden Hours
}
