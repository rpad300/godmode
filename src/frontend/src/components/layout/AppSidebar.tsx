import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, FileText, Calendar, Users, Network,
  FolderOpen, Mail, GitBranch, DollarSign, Clock, Settings, Shield,
  ChevronLeft, ChevronRight, Zap, Upload, Trash2, AlertCircle, FileUp, FolderKanban, User, Building2,
  Layers, Plus, File, Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import type { TabId } from '@/types/godmode';

export type ImportFileType = 'documents' | 'transcripts' | 'emails' | 'conversations';

interface PendingFile {
  filename: string;
  type: string;
  size: number;
  status: string;
  created_at?: string;
  emailId?: string;
}

interface AppSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onImportFile?: (type: ImportFileType) => void;
}

interface NavGroup {
  label: string;
  items: { id: TabId; label: string; icon: React.ElementType }[];
  adminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: 'Project',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'sot', label: 'Source of Truth', icon: FileText },
      { id: 'timeline', label: 'Timeline', icon: Calendar },
      { id: 'contacts', label: 'Contacts', icon: Users },
      { id: 'team-analysis', label: 'Team Analysis', icon: Network },
      { id: 'files', label: 'Files', icon: FolderOpen },
      { id: 'emails', label: 'Emails', icon: Mail },
      { id: 'graph', label: 'Graph', icon: GitBranch },
      { id: 'costs', label: 'Costs', icon: DollarSign },
      { id: 'history', label: 'History', icon: Clock },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'User',
    items: [
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'companies', label: 'Companies', icon: Building2 },
      { id: 'user-settings', label: 'Settings', icon: Settings },
      { id: 'profile', label: 'Profile', icon: User },
    ],
  },
  {
    label: 'Platform',
    adminOnly: true,
    items: [
      { id: 'admin', label: 'Admin', icon: Shield },
    ],
  },
];

const dropZones = [
  { type: 'documents', label: 'Documents', hint: 'PDF, DOCX, TXT', icon: FileText },
  { type: 'transcripts', label: 'Transcripts', hint: 'TXT, MD', icon: FileUp },
  { type: 'emails', label: 'Email', hint: '.eml, paste', icon: Mail },
  { type: 'conversations', label: 'Conversation', hint: 'Slack, Teams', icon: MessageSquare },
];

const AppSidebar = ({ activeTab, onTabChange, onImportFile }: AppSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPendingFiles = async () => {
      try {
        const files = await apiClient.get<PendingFile[]>('/api/files');
        setPendingFiles(Array.isArray(files) ? files : []);
      } catch (error) {
        console.error('Failed to fetch pending files', error);
      }
    };

    fetchPendingFiles();
    // Poll every 10 seconds
    const interval = setInterval(fetchPendingFiles, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleProcessFiles = async () => {
    try {
      setIsProcessing(true);
      await apiClient.post('/api/process', { provider: 'auto' });
      toast({
        title: "Processing Started",
        description: "Your files are being processed in the background.",
      });
    } catch (error) {
      console.error('Processing failed:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to start processing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      // Use the project export endpoint which returns a downloadable file
      const response = await apiClient.get<Blob>('/api/projects/current/export', {
        responseType: 'blob'
      });

      // Create url from blob and trigger download
      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({
        title: "Export Successful",
        description: "Project data exported successfully.",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export project data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetData = async () => {
    try {
      setIsResetting(true);
      await apiClient.post('/api/data/cleanup', {
        factsMaxAgeDays: 0,
        questionsMaxAgeDays: 0,
        archive: false
      });
      toast({
        title: "Data Reset",
        description: "Project data has been cleared.",
      });
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Reset failed:', error);
      toast({
        title: "Reset Failed",
        description: "Failed to reset project data.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <aside
      className={`h-full border-r border-sidebar-border flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'
        }`}
      style={{ background: 'var(--gradient-sidebar)' }}
    >
      {/* Collapse toggle */}
      <div className="flex justify-end p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-md bg-sidebar-accent flex items-center justify-center hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-sidebar-foreground" /> : <ChevronLeft className="w-4 h-4 text-sidebar-foreground" />}
        </button>
      </div>

      {/* Drop zones */}
      {!collapsed && (
        <div className="px-3 mb-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Add Files</p>
          <div className="grid grid-cols-2 gap-1.5">
            {dropZones.map((zone) => (
              <div
                key={zone.type}
                onClick={() => onImportFile?.(zone.type as ImportFileType)}
                className="flex flex-col items-center gap-1 p-2 rounded-md border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
              >
                <zone.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">{zone.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Files */}
      {!collapsed && pendingFiles.length > 0 && (
        <div className="px-3 py-2">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">Pending Files</p>
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group">
                <File className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="truncate flex-1">{file.filename}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Pending" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation grouped */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <p className={`text-[10px] uppercase tracking-widest mb-1.5 px-2 ${group.adminOnly ? 'text-destructive/60' : 'text-muted-foreground'
                }`}>
                {group.label}
              </p>
            )}
            {collapsed && group.label !== navGroups[0].label && (
              <div className="border-t border-sidebar-border mx-1 my-2" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all relative group ${isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : group.adminOnly
                        ? 'text-destructive/70 hover:bg-destructive/5 hover:text-destructive'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                      />
                    )}
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Actions */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">Actions</p>
          <button
            onClick={handleProcessFiles}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {isProcessing ? 'Processing...' : 'Process Files'}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isExporting ? '...' : 'Export'}
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors">
              <AlertCircle className="w-3.5 h-3.5" /> Overdue
            </button>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={isResetting}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Reset Data
          </button>
        </div>
      )}

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all processed data (facts, questions, insights) from this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
};

export default AppSidebar;
