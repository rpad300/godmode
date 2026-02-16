import { useState, useCallback, useRef } from 'react';
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
  Trash2,
  AlertCircle,
  Mic,
  MessageCircle,
  File,
  X,
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
import {
  usePendingFiles,
  useProcessFiles,
  useExportProject,
  useResetData,
  useUploadFiles,
  useDeletePendingFile,
  type PendingFile,
} from '../../hooks/useGodMode';

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/sot', label: 'Source of Truth', icon: FileText },
  { to: '/timeline', label: 'Timeline', icon: Calendar },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/team-analysis', label: 'Team Analysis', icon: Network },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/emails', label: 'Emails', icon: Mail },
  { to: '/graph', label: 'Graph', icon: Share2 },
  { to: '/costs', label: 'Costs', icon: DollarSign },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Admin', icon: Shield },
];

const dropZones = [
  { type: 'documents', label: 'Documents', hint: 'PDF, DOCX, TXT, MD', icon: File },
  { type: 'transcripts', label: 'Transcripts', hint: 'TXT, MD (Krisp, Otter)', icon: Mic },
  { type: 'emails', label: 'Email', hint: 'Paste or upload .eml', icon: Mail },
  { type: 'conversations', label: 'Conversation', hint: 'WhatsApp, Slack, Teams', icon: MessageCircle },
];

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDropZoneRef = useRef<string | null>(null);

  // Queries & mutations
  const { data: pendingFiles = [] } = usePendingFiles();
  const processFiles = useProcessFiles();
  const exportProject = useExportProject();
  const resetData = useResetData();
  const uploadFiles = useUploadFiles();
  const deletePendingFile = useDeletePendingFile();

  // ── Process Files ────────────────────────────────────────────────────────
  const handleProcessFiles = useCallback(() => {
    if (pendingFiles.length === 0) return;
    processFiles.mutate(undefined);
  }, [pendingFiles.length, processFiles]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    exportProject.mutate({ includeEmbeddings: false });
  }, [exportProject]);

  // ── Reset Data ────────────────────────────────────────────────────────────
  const handleResetConfirm = useCallback(() => {
    resetData.mutate(undefined, {
      onSettled: () => setResetDialogOpen(false),
    });
  }, [resetData]);

  // ── File Drop ─────────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent, _type: string) => {
      e.preventDefault();
      setDragOverType(null);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadFiles.mutate(files);
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
    activeDropZoneRef.current = type;
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        uploadFiles.mutate(files);
      }
      e.target.value = '';
    },
    [uploadFiles]
  );

  // ── Delete Pending File ───────────────────────────────────────────────────
  const handleDeleteFile = useCallback(
    (file: PendingFile) => {
      deletePendingFile.mutate({ folder: file.folder, filename: file.filename });
    },
    [deletePendingFile]
  );

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
                  >
                    <span className="truncate mr-2">{file.filename}</span>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
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
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider px-2 mb-1">
            Menu
          </div>
          {navItems.map((item) => {
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
              onClick={handleExport}
              disabled={exportProject.isPending}
            >
              <Download className="h-4 w-4" />
              {exportProject.isPending ? 'Exporting...' : 'Export'}
            </Button>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              // Copy overdue items
              const el = document.createElement('textarea');
              el.value = JSON.stringify({ overdue: 'items' }); // placeholder
              document.body.appendChild(el);
              el.select();
              document.execCommand('copy');
              document.body.removeChild(el);
            }}
          >
            <AlertCircle className="h-4 w-4" />
            Copy Overdue
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
    </>
  );
}
