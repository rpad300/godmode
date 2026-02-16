/**
 * Modals Index
 * Re-exports all modal components
 */

// Core Modals
export { showSettingsModal } from './SettingsModal';
export { 
  showProcessingModal, 
  updateProcessingStep, 
  addProcessingStep,
  setProcessingSteps,
  closeProcessingModal, 
  isProcessingModalOpen 
} from './ProcessingModal';
export type { ProcessingStep, ProcessingModalProps } from './ProcessingModal';

export { showAuthModal, closeAuthModal } from './AuthModal';
export type { AuthMode, AuthModalProps } from './AuthModal';

// Project Modals
export { showProjectModal } from './ProjectModal';
export type { ProjectData, ProjectModalProps } from './ProjectModal';

export { showCompaniesModal } from './CompaniesModal';

// Data Modals
export { showContactModal } from './ContactModal';
export type { ContactModalProps } from './ContactModal';

export { showQuestionModal } from './QuestionModal';
export type { QuestionModalProps } from './QuestionModal';

export { showRiskModal } from './RiskModal';
export type { RiskModalProps } from './RiskModal';

export { showActionModal } from './ActionModal';
export type { ActionModalProps } from './ActionModal';

export { showDecisionModal } from './DecisionModal';
export type { DecisionModalProps } from './DecisionModal';

// Team Modals
export { showTeamModal } from './TeamModal';
export type { TeamMember, TeamModalProps } from './TeamModal';

export { showInviteModal } from './InviteModal';
export type { InviteModalProps } from './InviteModal';

export { showRoleModal } from './RoleModal';
export type { Role, RoleModalProps } from './RoleModal';

// Export Modal
export { showExportModal } from './ExportModal';
export type { ExportFormat, ExportScope, ExportModalProps } from './ExportModal';

// File Upload
export { showFileUploadModal } from './FileUploadModal';
export type { UploadFile, FileUploadModalProps } from './FileUploadModal';

// Utility Modals
export { showDeveloperModal } from './DeveloperModal';
export { showShortcutsModal } from './ShortcutsModal';
export { showNotificationsModal } from './NotificationsModal';
export type { Notification, NotificationsModalProps } from './NotificationsModal';

// Email Modal
export { showEmailModal } from './EmailModal';
export type { Email, EmailModalProps } from './EmailModal';

// Graph Modal
export { showGraphModal } from './GraphModal';
export type { GraphNode, GraphEdge, GraphModalProps } from './GraphModal';

// History Modal
export { showHistoryModal } from './HistoryModal';
export type { HistoryEntry, HistoryModalProps } from './HistoryModal';

// Comment Modal
export { showCommentModal } from './CommentModal';
export type { Comment, CommentModalProps } from './CommentModal';

// Profile Modal
export { showProfileModal, closeProfileModal } from './ProfileModal';
export type { ProfileModalProps } from './ProfileModal';

// Fact Modal
export { showFactModal, closeFactModal } from './FactModal';
export type { FactModalProps } from './FactModal';

// Document Preview Modal
export { showDocumentPreviewModal } from './DocumentPreviewModal';
export type { DocumentPreviewProps } from './DocumentPreviewModal';

// Conversation Preview Modal
export { showConversationPreviewModal } from './ConversationPreviewModal';
export type { Conversation as ConversationPreview } from './ConversationPreviewModal';

// Email Preview Modal
export { showEmailPreviewModal } from './EmailPreviewModal';
export type { EmailData } from './EmailPreviewModal';

// Krisp Modals
export { showKrispManager, closeKrispManager } from './KrispManager';
export { showProjectAssignmentModal, closeProjectAssignmentModal } from './ProjectAssignmentModal';
export type { ProjectAssignmentModalProps } from './ProjectAssignmentModal';
