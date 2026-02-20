import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, ChevronDown, ChevronUp, Loader2, FileText, Users,
  Mail, MessageSquare, Zap, Target, AlertTriangle, HelpCircle,
  CheckCircle2, Trash2, Edit2, Plus, Eye, Building2, RefreshCw,
} from 'lucide-react';
import { useProjectActivity, type ActivityEntry } from '@/hooks/useGodMode';
import { useProject } from '@/hooks/useProject';

const actionIcons: Record<string, typeof Activity> = {
  'company.created': Building2,
  'company.updated': Edit2,
  'company.deleted': Trash2,
  'document.uploaded': FileText,
  'document.processed': Zap,
  'document.deleted': Trash2,
  'contact.created': Users,
  'contact.updated': Edit2,
  'contact.merged': Users,
  'email.ingested': Mail,
  'email.analyzed': Zap,
  'conversation.imported': MessageSquare,
  'fact.created': CheckCircle2,
  'decision.created': Zap,
  'risk.created': AlertTriangle,
  'action.created': Target,
  'question.created': HelpCircle,
  'fact.deleted': Trash2,
  'decision.deleted': Trash2,
  'member.added': Plus,
  'member.removed': Trash2,
  'project.created': Plus,
  'project.updated': Edit2,
  'sprint.created': Target,
};

const actionColors: Record<string, string> = {
  created: 'text-green-400',
  uploaded: 'text-blue-400',
  processed: 'text-purple-400',
  deleted: 'text-red-400',
  updated: 'text-amber-400',
  merged: 'text-cyan-400',
  imported: 'text-indigo-400',
  ingested: 'text-indigo-400',
  analyzed: 'text-purple-400',
  added: 'text-green-400',
  removed: 'text-red-400',
};

function getActionColor(action: string): string {
  const verb = action.split('.').pop() || '';
  return actionColors[verb] || 'text-[hsl(var(--muted-foreground))]';
}

function formatAction(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface ActivityPanelProps {
  collapsed?: boolean;
  maxItems?: number;
  showFilter?: boolean;
}

export function ActivityPanel({ collapsed: initialCollapsed, maxItems = 30, showFilter }: ActivityPanelProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false);
  const [actionFilter, setActionFilter] = useState('');
  const { projectId } = useProject();
  const { data, isLoading, refetch } = useProjectActivity(projectId, { limit: maxItems, action: actionFilter || undefined });

  const activities = data?.activities ?? [];
  const total = data?.total ?? 0;

  const actionTypes = [...new Set(activities.map(a => a.action.split('.')[0]))];

  return (
    <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--secondary))] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">Activity Feed</span>
          {total > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); refetch(); }}
            className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {collapsed ? <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-[hsl(var(--border))]">
              {showFilter && actionTypes.length > 1 && (
                <div className="px-4 py-2 flex gap-1 flex-wrap border-b border-[hsl(var(--border))]">
                  <button
                    onClick={() => setActionFilter('')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      !actionFilter ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    All
                  </button>
                  {actionTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setActionFilter(t)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors capitalize ${
                        actionFilter === t ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[hsl(var(--muted-foreground))]">
                    No activity recorded yet.
                  </div>
                ) : (
                  <div className="px-4 py-2 space-y-0.5">
                    {activities.map((entry, i) => {
                      const Icon = actionIcons[entry.action] || Activity;
                      const color = getActionColor(entry.action);
                      return (
                        <motion.div
                          key={entry.id || i}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-center gap-3 py-2 group hover:bg-[hsl(var(--secondary))] rounded-lg px-2 transition-colors"
                        >
                          <div className={`flex-shrink-0 ${color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[hsl(var(--foreground))] truncate">
                              {entry.actor_name && (
                                <span className="font-medium">{entry.actor_name} </span>
                              )}
                              {formatAction(entry.action)}
                              {entry.target_type && (
                                <span className="text-[hsl(var(--muted-foreground))]"> on {entry.target_type}</span>
                              )}
                            </p>
                          </div>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))] flex-shrink-0">
                            {timeAgo(entry.created_at)}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ActivityPanel;
