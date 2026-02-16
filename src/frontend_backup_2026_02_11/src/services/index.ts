/**
 * Services Index
 * Re-exports all services for convenient importing
 */

export { theme, ThemeService } from './theme';
export type { ThemeMode, EffectiveTheme } from './theme';

export { toast } from './toast';
export type { ToastType } from './toast';

export { api, http, configureApi, ApiError, addRequestInterceptor, addResponseInterceptor, getProjectHeaders, fetchWithProject, setProjectIdGetter } from './api';
export type { ApiResponse, ApiError as ApiErrorType } from './api';

export { storage } from './storage';

export { shortcuts, ShortcutService } from './shortcuts';
export type { Shortcut } from './shortcuts';

export { undoManager, UndoService } from './undo';
export type { UndoAction } from './undo';

export { auth } from './auth';
export type {
  AuthStatus,
  LoginRequest,
  RegisterRequest,
  AuthUser,
  UserProfile
} from './auth';

export { projects } from './projects';
export type {
  ProjectListItem,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectStats,
} from './projects';

export {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  analyzeCompany,
  getTemplate,
  updateTemplate,
  generateTemplate,
} from './companies';
export type {
  Company,
  BrandAssets,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  TemplateType,
} from './companies';

export { dashboardService } from './dashboard';
export type {
  DashboardData,
  TrendData,
  TrendMetric,
  TrendHistory,
  HealthData,
  Insight,
  Alert,
} from './dashboard';

export { questionsService } from './questions';
export type {
  Question,
  CreateQuestionRequest,
  UpdateQuestionRequest,
  AnswerQuestionRequest,
  AssigneeSuggestion,
} from './questions';

export { risksService } from './risks';
export type { Risk, CreateRiskRequest, UpdateRiskRequest } from './risks';

export { actionsService } from './actions';
export type { Action, CreateActionRequest, UpdateActionRequest } from './actions';

export { decisionsService } from './decisions';
export type { Decision, CreateDecisionRequest, UpdateDecisionRequest } from './decisions';

export { chatService } from './chat';
export type {
  ChatMessage,
  ChatSource,
  ChatRequest,
  ChatResponse,
  AskRequest,
  AskResponse,
  BriefingResponse,
} from './chat';

export { contactsService, teamsService } from './contacts';
export type {
  Contact,
  Team,
  CreateContactRequest,
  UpdateContactRequest,
  CreateTeamRequest,
} from './contacts';

export { documentsService, knowledgeService, conversationsService } from './documents';
export type { Document, UploadResult, ProcessingStatus, EmbeddingStatus, KnowledgeItem, Conversation } from './documents';

export { emailsService } from './emails';
export type { Email, EmailThread, DraftEmail, AIResponseSuggestion } from './emails';

export { graphService, timelineService, costsService } from './graph';
export type { GraphNode, GraphEdge, GraphData, TimelineEvent, TimelineData, LLMCost, CostSummary, RecentCostRequest } from './graph';

export { notificationsService, commentsService, membersService } from './notifications';
export type { Notification, Comment, ProjectMember } from './notifications';

export {
  userSettingsService,
  projectSettingsService,
  apiKeysService,
  webhooksService,
  auditService
} from './settings';
export type { UserSettings, ProjectSettings, APIKey, Webhook, AuditLogEntry } from './settings';

export { profileService } from './profile';
export type { UserProfile as ProfileUserProfile, UpdateProfileRequest } from './profile';

export { factsService } from './facts';
export type { Fact, CreateFactRequest, UpdateFactRequest, FactConflict } from './facts';

export * as krispService from './krisp';
export type {
  KrispWebhook,
  KrispTranscript,
  KrispSpeakerMapping,
  TranscriptsSummary,
  QuarantineStats,
  ProjectCandidate,
  MatchedContact
} from './krisp';
