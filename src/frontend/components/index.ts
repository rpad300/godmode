/**
 * Components Index
 * Re-exports all components
 */

// UI Components
export { createThemeToggle, mountThemeToggle } from './ThemeToggle';
export { createHeader, mountHeader } from './Header';
export { createSidebar, mountSidebar, updateTabBadge } from './Sidebar';
export { getToastContainer, createToastElement, showToastInContainer } from './Toast';
export { initProjectSelector, createProjectSelector } from './ProjectSelector';
export type { ProjectSelectorOptions } from './ProjectSelector';

// Modal System
export { 
  createModal, 
  openModal, 
  closeModal, 
  closeAllModals, 
  isModalOpen,
  updateModalContent,
  updateModalTitle,
  confirm,
  alert 
} from './Modal';

// Main Views
export { createDashboard, mountDashboard } from './Dashboard';
export { createChat, mountChat } from './Chat';
export { createSourceOfTruth, mountSourceOfTruth } from './SourceOfTruth';

// SOT Panels
export * from './sot';

// Questions (Detail View)
export * from './questions';

// Widgets
export * from './widgets';

// File Uploader
export { createFileUploader } from './FileUploader';
export type { FileUploaderProps } from './FileUploader';

// Visualizations
export { createKnowledgeGraph } from './KnowledgeGraph';
export type { KnowledgeGraphProps } from './KnowledgeGraph';
export { createTimeline } from './Timeline';
export type { TimelineProps } from './Timeline';
export { createTimelinePanel } from './TimelinePanel';
export type { TimelinePanelProps } from './TimelinePanel';
export { createCostsDashboard } from './CostsDashboard';
export type { CostsDashboardProps } from './CostsDashboard';

// Global Search
export { initGlobalSearch, openSearch, closeSearch, toggleSearch } from './GlobalSearch';
export type { GlobalSearchProps, SearchResult } from './GlobalSearch';

// Bulk Actions & Sync
export { createBulkActionsBar, toggleSelection, selectItem, deselectItem, clearSelection, getSelectedIds, isSelected, createBulkCheckbox } from './BulkActions';
export type { BulkActionsProps } from './BulkActions';
export { createSyncStatus, createSyncIndicator } from './SyncStatus';
export type { SyncStatusProps } from './SyncStatus';

// Specialized Modals
export { 
  // Core
  showSettingsModal,
  showProcessingModal,
  updateProcessingStep,
  addProcessingStep,
  setProcessingSteps,
  closeProcessingModal,
  isProcessingModalOpen,
  showAuthModal,
  closeAuthModal,
  // Project
  showProjectModal,
  showCompaniesModal,
  // Data
  showContactModal,
  showQuestionModal,
  showRiskModal,
  showActionModal,
  showDecisionModal,
  // Team
  showTeamModal,
  showInviteModal,
  showRoleModal,
  // Export & Upload
  showExportModal,
  showFileUploadModal,
  // Utility
  showDeveloperModal,
  showShortcutsModal,
  showNotificationsModal,
  // Email
  showEmailModal,
  // Graph
  showGraphModal,
  // History & Comments
  showHistoryModal,
  showCommentModal,
  // Profile
  showProfileModal,
  closeProfileModal,
  // Fact
  showFactModal,
  closeFactModal,
} from './modals';

// Panels - Briefing & Reports
export { createBriefingPanel } from './BriefingPanel';
export type { BriefingPanelProps } from './BriefingPanel';
export { createReportsPanel } from './ReportsPanel';
export type { ReportsPanelProps } from './ReportsPanel';

// Panels - Contacts & Teams
export { createContactsPanel } from './ContactsPanel';
export type { ContactsPanelProps } from './ContactsPanel';
export { createTeamsPanel } from './TeamsPanel';
export type { TeamsPanelProps } from './TeamsPanel';
export { createOrgChart } from './OrgChart';
export type { OrgChartProps } from './OrgChart';

// Panels - Documents & Knowledge
export { createDocumentsPanel } from './DocumentsPanel';
export type { DocumentsPanelProps } from './DocumentsPanel';
export { createKnowledgePanel } from './KnowledgePanel';
export type { KnowledgePanelProps } from './KnowledgePanel';
export { createConversationsPanel } from './ConversationsPanel';
export type { ConversationsPanelProps } from './ConversationsPanel';

// Panels - Emails
export { createEmailsPanel } from './EmailsPanel';
export type { EmailsPanelProps } from './EmailsPanel';
export { createEmailComposer, showEmailComposer, closeEmailComposer } from './EmailComposer';
export type { EmailComposerProps } from './EmailComposer';

// Panels - Notifications, Comments, Members
export { createNotificationsDropdown, initNotificationsDropdown } from './NotificationsDropdown';
export type { NotificationsDropdownProps } from './NotificationsDropdown';
export { createCommentsThread } from './CommentsThread';
export type { CommentsThreadProps } from './CommentsThread';
export { createMembersPanel } from './MembersPanel';
export type { MembersPanelProps } from './MembersPanel';

// Panels - Admin
export { createApiKeysPanel } from './ApiKeysPanel';
export type { ApiKeysPanelProps } from './ApiKeysPanel';
export { createWebhooksPanel } from './WebhooksPanel';
export type { WebhooksPanelProps } from './WebhooksPanel';
export { createAuditPanel } from './AuditPanel';
export type { AuditPanelProps } from './AuditPanel';
export { renderRolesPanel } from './RolesPanel';
export { initAdminPanel } from './AdminPanel';

// Panels - History
export { createHistoryPanel, exportHistory } from './HistoryPanel';
export type { HistoryPanelProps, HistoryEntry as HistoryPanelEntry } from './HistoryPanel';

// Type exports
export type { HeaderProps } from './Header';
export type { SidebarProps, SidebarTab } from './Sidebar';
export type { ModalProps } from './Modal';
export type { DashboardProps, DashboardStats } from './Dashboard';
export type { ChatProps } from './Chat';
export type { SourceOfTruthProps } from './SourceOfTruth';
export type { 
  ProcessingStep, 
  ProcessingModalProps, 
  AuthMode, 
  AuthModalProps,
  ProjectData,
  ProjectModalProps,
  ContactModalProps,
  QuestionModalProps,
  RiskModalProps,
  ActionModalProps,
  DecisionModalProps,
  TeamMember,
  TeamModalProps,
  InviteModalProps,
  Role,
  RoleModalProps,
  ExportFormat,
  ExportScope,
  ExportModalProps,
  UploadFile,
  FileUploadModalProps,
  Notification,
  NotificationsModalProps,
  Email,
  EmailModalProps,
  GraphNode,
  GraphEdge,
  GraphModalProps,
  HistoryEntry,
  HistoryModalProps,
  Comment,
  CommentModalProps,
} from './modals';
