import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, FileText, Calendar, Users, Network,
  FolderOpen, Mail, GitBranch, DollarSign, Clock, Settings, Shield,
  ChevronLeft, ChevronRight, Zap, Upload, Trash2, AlertCircle, FileUp, FolderKanban, User, Building2
} from 'lucide-react';
import type { TabId } from '@/types/godmode';

export type ImportFileType = 'documents' | 'transcripts' | 'emails' | 'conversations';

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

  return (
    <aside
      className={`h-full border-r border-sidebar-border flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
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

      {/* Pending files */}
      {!collapsed && (
        <div className="px-3 mb-3">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending</span>
            <span className="text-[10px] text-muted-foreground">1 file</span>
          </div>
          <div className="text-xs text-muted-foreground px-1">Sprint Retrospective.txt</div>
        </div>
      )}

      {/* Navigation grouped */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <p className={`text-[10px] uppercase tracking-widest mb-1.5 px-2 ${
                group.adminOnly ? 'text-destructive/60' : 'text-muted-foreground'
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all relative group ${
                      isActive
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
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Zap className="w-4 h-4" /> Process Files
          </button>
          <div className="flex gap-1.5">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors">
              <Upload className="w-3.5 h-3.5" /> Export
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors">
              <AlertCircle className="w-3.5 h-3.5" /> Overdue
            </button>
          </div>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Reset Data
          </button>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
