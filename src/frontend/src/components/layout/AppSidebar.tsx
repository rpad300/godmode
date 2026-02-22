/**
 * Purpose:
 *   Primary sidebar navigation and file-management panel for the
 *   authenticated application. Combines route navigation, drag-and-drop
 *   file upload, pending-file management, and bulk data operations.
 *
 * Responsibilities:
 *   - Renders navigation links for all main application routes
 *   - Provides drag-and-drop zones for four file types (documents,
 *     transcripts, emails, conversations) with click-to-upload fallback
 *   - Lists pending (unprocessed) files with delete capability
 *   - Exposes action buttons: Process Files, Export Knowledge (download
 *     and clipboard), Copy Overdue items, Clean Orphans, Reset Data
 *   - Shows confirmation dialogs for destructive actions (reset, cleanup)
 *   - Mobile-responsive: slides in/out with overlay backdrop
 *
 * Key dependencies:
 *   - useGodMode hooks: usePendingFiles, useProcessFiles, useExportProject,
 *     useResetData, useCleanupOrphans, useUploadFiles, useDeletePendingFile,
 *     useQuestions, useActions, useFacts, useDecisions
 *   - react-router-dom (NavLink): route-aware navigation links
 *   - sonner (toast): user feedback on clipboard operations
 *
 * Side effects:
 *   - Network: uploads files, triggers processing, resets/cleans data via
 *     TanStack Query mutations
 *   - Clipboard: writes JSON exports and overdue summaries
 *   - DOM: creates and clicks a temporary <a> element for file download
 *
 * Notes:
 *   - The overdue threshold for questions is hardcoded to 7 days.
 *   - exportProject hook is imported but suppressed with `void`; server-side
 *     export may be re-enabled later.
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Calendar,
  Users,
  Network,
  FolderOpen,
  Mail,
  Share2,
  DollarSign,
  Clock,
  Settings,
  Shield,
  Zap,
  Download,
  Clipboard,
  Trash2,
  AlertCircle,
  Mic,
  MessageCircle,
  File,
  X,
  Wrench,
  User,
  FileBarChart,
  Search,
  Activity,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import {
  usePendingFiles,
  useProcessFiles,
  useExportProject,
  useResetData,
  useCleanupOrphans,
  useUploadFiles,
  useDeletePendingFile,
  useQuestions,
  useActions,
  useFacts,
  useDecisions,
  useImportEmail,
  useImportConversation,
  type PendingFile,
} from '../../hooks/useGodMode';
import ImportDocumentModal from '../files/ImportDocumentModal';
import ImportTranscriptModal from '../files/ImportTranscriptModal';
import AddEmailModal from '../files/AddEmailModal';
import ImportConversationModal from '../files/ImportConversationModal';

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard }
interface NavSection { title: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    title: 'Project',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/chat', label: 'Chat', icon: MessageSquare },
      { to: '/sot', label: 'Source of Truth', icon: FileText },
      { to: '/timeline', label: 'Timeline', icon: Calendar },
      { to: '/contacts', label: 'Contacts', icon: Users },
      { to: '/team-analysis', label: 'Team Analysis', icon: Network },
      { to: '/files', label: 'Files', icon: FolderOpen },
      { to: '/emails', label: 'Emails', icon: Mail },
      { to: '/conversations', label: 'Conversations', icon: MessageCircle },
      { to: '/graph', label: 'Graph', icon: Share2 },
      { to: '/costs', label: 'Costs', icon: DollarSign },
      { to: '/history', label: 'History', icon: Clock },
      { to: '/sprints', label: 'Sprints', icon: Calendar },
      { to: '/reports', label: 'Reports', icon: FileBarChart },
      { to: '/search', label: 'Search', icon: Search },
      { to: '/optimizations', label: 'Optimizations', icon: Activity },
      { to: '/settings', label: 'Project Settings', icon: Settings },
    ],
  },
  {
    title: 'User',
    items: [
      { to: '/profile', label: 'Profile', icon: User },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/admin', label: 'Admin', icon: Shield },
    ],
  },
];

const dropZones = [
  { type: 'documents', label: 'Documents', hint: 'PDF, DOCX, TXT, MD', icon: File, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.rtf,.odt,.csv,.json,.xml,.yaml,.yml,.html,.htm' },
  { type: 'transcripts', label: 'Transcripts', hint: 'TXT, MD (Krisp, Otter)', icon: Mic, accept: '.txt,.md,.srt,.vtt' },
  { type: 'emails', label: 'Email', hint: 'Paste or upload .eml', icon: Mail, accept: '.eml,.msg' },
  { type: 'conversations', label: 'Conversation', hint: 'WhatsApp, Slack, Teams', icon: MessageCircle, accept: '.txt,.json' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDropZoneRef = useRef<string>('documents');

  // Modal state for each Add Files type
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [convModalOpen, setConvModalOpen] = useState(false);

  // Queries & mutations
  const { data: pendingFiles = [] } = usePendingFiles();
  const { data: questions = [] } = useQuestions();
  const { data: actions = [] } = useActions();
  const { data: facts = [] } = useFacts();
  const { data: decisions = [] } = useDecisions();
  const processFiles = useProcessFiles();
  const exportProject = useExportProject();
  const resetData = useResetData();
  const cleanupOrphans = useCleanupOrphans();
  const uploadFiles = useUploadFiles();
  const deletePendingFile = useDeletePendingFile();
  const importEmail = useImportEmail();
  const importConversation = useImportConversation();

  // suppress unused var warning — exportProject is available for server-side export
  void exportProject;

  // ── Process Files ────────────────────────────────────────────────────────
  const handleProcessFiles = useCallback(() => {
    if (pendingFiles.length === 0) return;
    processFiles.mutate(undefined, {
      onError: (err: Error) => {
        toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
      },
    });
  }, [pendingFiles.length, processFiles]);

  // ── Export Knowledge (file download) ──────────────────────────────────────
  const handleExportKnowledge = useCallback(() => {
    const knowledge = {
      facts: facts ?? [],
      decisions: decisions ?? [],
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(knowledge, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'godmode-knowledge-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [facts, decisions]);

  // ── Export Knowledge (clipboard) ──────────────────────────────────────────
  const handleCopyKnowledge = useCallback(async () => {
    const knowledge = {
      facts: facts ?? [],
      decisions: decisions ?? [],
    };
    await navigator.clipboard.writeText(JSON.stringify(knowledge, null, 2));
  }, [facts, decisions]);

  // ── Copy Overdue ──────────────────────────────────────────────────────────
  const handleCopyOverdue = useCallback(async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const overdueActions = (actions ?? []).filter((a) => {
      if (a.status === 'completed') return false;
      if (!a.dueDate) return false;
      return new Date(a.dueDate) < now;
    });

    const overdueQuestions = (questions ?? []).filter((q) => {
      if (q.status === 'resolved' || q.status === 'answered' || q.status === 'dismissed') return false;
      const createdAt = q.created_at ?? q.createdAt;
      if (!createdAt) return false;
      return new Date(createdAt) < sevenDaysAgo;
    });

    const overdue = {
      actions: overdueActions,
      questions: overdueQuestions,
      exportedAt: now.toISOString(),
    };

    await navigator.clipboard.writeText(JSON.stringify(overdue, null, 2));
    toast.success(`Copied ${overdueActions.length} actions and ${overdueQuestions.length} questions`);
  }, [actions, questions]);

  // ── Reset Data ────────────────────────────────────────────────────────────
  const handleResetConfirm = useCallback(() => {
    resetData.mutate(undefined, {
      onSettled: () => setResetDialogOpen(false),
    });
  }, [resetData]);

  // ── Cleanup Orphans ───────────────────────────────────────────────────────
  const handleCleanupConfirm = useCallback(() => {
    cleanupOrphans.mutate(undefined, {
      onSettled: () => setCleanupDialogOpen(false),
    });
  }, [cleanupOrphans]);

  // ── File Drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent, type: string) => {
      e.preventDefault();
      setDragOverType(null);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadFiles.mutate({ files, type }, {
          onSuccess: () => toast.success(`${files.length} file(s) uploaded`),
          onError: (err: Error) => toast.error(`Upload failed: ${err.message}`),
        });
      }
    },
    [uploadFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOverType(type);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverType(null);
  }, []);

  const handleDropZoneClick = useCallback((type: string) => {
    switch (type) {
      case 'documents': setDocModalOpen(true); break;
      case 'transcripts': setTranscriptModalOpen(true); break;
      case 'emails': setEmailModalOpen(true); break;
      case 'conversations': setConvModalOpen(true); break;
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        uploadFiles.mutate({ files, type: activeDropZoneRef.current }, {
          onSuccess: () => toast.success(`${files.length} file(s) uploaded`),
          onError: (err: Error) => toast.error(`Upload failed: ${err.message}`),
        });
      }
      e.target.value = '';
    },
    [uploadFiles]
  );

  // ── Modal Import Handlers ────────────────────────────────────────────────
  const handleDocumentImport = useCallback((data: { content: string; title: string; sprintId: string; taskId: string; file?: File | null }) => {
    if (data.file) {
      uploadFiles.mutate({ files: [data.file], type: 'documents', sprintId: data.sprintId, taskId: data.taskId }, {
        onSuccess: () => toast.success('Document uploaded — ready for processing'),
        onError: (err: Error) => toast.error(`Upload failed: ${err.message}`),
      });
    } else if (data.content?.trim()) {
      const filename = (data.title?.trim() || 'Pasted Document').replace(/[^a-zA-Z0-9_\- ]/g, '') + '.txt';
      const blob = new Blob([data.content], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      uploadFiles.mutate({ files: [file], type: 'documents', sprintId: data.sprintId, taskId: data.taskId }, {
        onSuccess: () => toast.success('Document imported — ready for processing'),
        onError: (err: Error) => toast.error(`Import failed: ${err.message}`),
      });
    }
  }, [uploadFiles]);

  const handleTranscriptImport = useCallback((data: { content: string; source: string; sprintId: string; taskId: string; file?: File | null }) => {
    if (data.file) {
      uploadFiles.mutate({ files: [data.file], type: 'transcripts', sprintId: data.sprintId, taskId: data.taskId, source: data.source }, {
        onSuccess: () => toast.success('Transcript uploaded — AI processing started'),
        onError: (err: Error) => toast.error(`Upload failed: ${err.message}`),
      });
    } else if (data.content?.trim()) {
      const blob = new Blob([data.content], { type: 'text/plain' });
      const file = new File([blob], 'transcript.txt', { type: 'text/plain' });
      uploadFiles.mutate({ files: [file], type: 'transcripts', sprintId: data.sprintId, taskId: data.taskId, source: data.source }, {
        onSuccess: () => toast.success('Transcript imported — AI processing started'),
        onError: (err: Error) => toast.error(`Import failed: ${err.message}`),
      });
    }
  }, [uploadFiles]);

  const handleEmailImport = useCallback((data: { tab: string; content: string; manual: { from: string; date: string; to: string; cc: string; subject: string; body: string }; sprintId: string; taskId: string; file?: File | null }) => {
    const buildPayload = async () => {
      const base: Record<string, unknown> = {};
      if (data.sprintId && data.sprintId !== 'none') base.sprint_id = data.sprintId;
      if (data.taskId && data.taskId !== 'none') base.action_id = data.taskId;

      if (data.tab === 'paste' && data.content?.trim()) {
        return { ...base, emailText: data.content };
      }
      if (data.tab === 'upload' && data.file) {
        const buffer = await data.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const ext = data.file.name.split('.').pop()?.toLowerCase();
        if (ext === 'msg') {
          return { ...base, msgBase64: b64, filename: data.file.name };
        }
        return { ...base, emlBase64: b64, filename: data.file.name };
      }
      if (data.tab === 'manual') {
        const toList = data.manual.to.split(',').map(e => e.trim()).filter(Boolean).map(e => ({ email: e }));
        const ccList = data.manual.cc ? data.manual.cc.split(',').map(e => e.trim()).filter(Boolean).map(e => ({ email: e })) : [];
        return {
          ...base,
          from: { email: data.manual.from },
          to: toList,
          cc: ccList,
          subject: data.manual.subject,
          body: data.manual.body,
          date: data.manual.date || undefined,
        };
      }
      return null;
    };

    buildPayload().then(payload => {
      if (!payload) { toast.error('No email content provided'); return; }
      importEmail.mutate(payload, {
        onSuccess: (result) => {
          const email = (result as Record<string, unknown>).email as Record<string, unknown> | undefined;
          const subject = email?.subject || 'Email';
          toast.success(`Email imported: "${subject}"`);
        },
        onError: (err: Error) => toast.error(`Email import failed: ${err.message}`),
      });
    });
  }, [importEmail]);

  const handleConversationImport = useCallback((data: {
    content: string;
    format: string;
    title: string;
    channelName: string;
    documentDate: string;
    skipAI: boolean;
    sprintId: string;
    taskId: string;
    file?: File | null;
  }) => {
    const text = data.content?.trim();
    if (!text || text.length < 20) {
      toast.error('Conversation text is too short (min 20 characters)');
      return;
    }
    importConversation.mutate({
      text,
      formatHint: data.format !== 'auto' ? data.format : undefined,
      meta: {
        title: data.title || undefined,
        channelName: data.channelName || undefined,
        documentDate: data.documentDate || undefined,
      },
      skipAI: data.skipAI,
    }, {
      onSuccess: (result) => {
        const r = result as Record<string, unknown>;
        const stats = r.stats as Record<string, unknown> | undefined;
        toast.success(`Conversation imported: "${r.title || 'Conversation'}" (${stats?.messageCount ?? '?'} messages)`);
      },
      onError: (err: Error) => toast.error(`Conversation import failed: ${err.message}`),
    });
  }, [importConversation]);

  // ── Delete Pending File ───────────────────────────────────────────────────
  const handleDeleteFile = useCallback(
    (file: PendingFile) => {
      deletePendingFile.mutate({ folder: file.folder, filename: file.filename });
    },
    [deletePendingFile]
  );

  // Memoize overdue counts for badge
  const overdueCount = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const a = Array.isArray(actions) ? actions.filter((item) => {
      if (item.status === 'completed') return false;
      return item.dueDate ? new Date(item.dueDate) < now : false;
    }).length : 0;
    const q = Array.isArray(questions) ? questions.filter((item) => {
      if (item.status === 'resolved' || item.status === 'answered') return false;
      const createdAt = item.created_at ?? item.createdAt;
      return createdAt ? new Date(createdAt) < sevenDaysAgo : false;
    }).length : 0;
    return a + q;
  }, [actions, questions]);

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] flex flex-col border-r bg-[hsl(var(--card))]',
          'transform transition-transform duration-200 md:relative md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drop Zones */}
        <div className="p-3 border-b">
          <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
            Add Files
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {dropZones.map((zone) => {
              const Icon = zone.icon;
              return (
                <div
                  key={zone.type}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md border border-dashed cursor-pointer transition-colors text-xs',
                    'hover:bg-[hsl(var(--accent))]',
                    dragOverType === zone.type && 'bg-[hsl(var(--accent))] border-[hsl(var(--ring))]'
                  )}
                  onClick={() => handleDropZoneClick(zone.type)}
                  onDrop={(e) => handleDrop(e, zone.type)}
                  onDragOver={(e) => handleDragOver(e, zone.type)}
                  onDragLeave={handleDragLeave}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{zone.label}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                      {zone.hint}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>

        {/* Pending Files */}
        <div className="px-3 py-2 border-b">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Pending
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {pendingFiles.length} files
            </Badge>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {pendingFiles.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] py-1">No files pending</p>
            ) : (
              <ul className="space-y-0.5">
                {pendingFiles.map((file) => (
                  <li
                    key={`${file.folder}/${file.filename}`}
                    className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-[hsl(var(--accent))]"
                    title={`${file.filename} (${formatFileSize(file.size)})`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="truncate block">{file.filename}</span>
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      aria-label={`Delete ${file.filename}`}
                      className="shrink-0 ml-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="text-[10px] font-bold text-[hsl(var(--primary))] uppercase tracking-widest px-2 mb-1">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium'
                          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="p-3 border-t space-y-2">
          <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">
            Actions
          </div>
          <Button
            className="w-full"
            onClick={handleProcessFiles}
            disabled={pendingFiles.length === 0 || processFiles.isPending}
          >
            <Zap className="h-4 w-4" />
            {processFiles.isPending ? 'Processing...' : 'Process Files'}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleExportKnowledge}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleCopyKnowledge}
              title="Copy knowledge to clipboard"
              aria-label="Copy knowledge to clipboard"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleCopyOverdue}
          >
            <AlertCircle className="h-4 w-4" />
            Copy Overdue
            {overdueCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px]">{overdueCount}</Badge>
            )}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setCleanupDialogOpen(true)}
          >
            <Wrench className="h-4 w-4" />
            Clean Orphans
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setResetDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Reset Data
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Reset Project Data</DialogTitle>
          <DialogDescription>
            This will permanently delete all knowledge data (facts, decisions, questions, risks,
            actions) for the current project. Team, contacts, and cost data will be preserved.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleResetConfirm}
            disabled={resetData.isPending}
          >
            {resetData.isPending ? 'Resetting...' : 'Reset Data'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Cleanup Orphans Confirmation Dialog */}
      <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Clean Orphan Data</DialogTitle>
          <DialogDescription>
            This will remove orphaned data entries that are not linked to any documents. Continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCleanupDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCleanupConfirm}
            disabled={cleanupOrphans.isPending}
          >
            {cleanupOrphans.isPending ? 'Cleaning...' : 'Clean Orphans'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Files Modals */}
      <ImportDocumentModal
        open={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        onImport={handleDocumentImport}
        loading={uploadFiles.isPending}
      />
      <ImportTranscriptModal
        open={transcriptModalOpen}
        onClose={() => setTranscriptModalOpen(false)}
        onImport={handleTranscriptImport}
        loading={uploadFiles.isPending}
      />
      <AddEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onImport={handleEmailImport}
        loading={importEmail.isPending}
      />
      <ImportConversationModal
        open={convModalOpen}
        onClose={() => setConvModalOpen(false)}
        onImport={handleConversationImport}
        loading={importConversation.isPending}
      />
    </>
  );
}
