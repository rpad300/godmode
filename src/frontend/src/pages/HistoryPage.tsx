import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  useActivityLog, useProcessingHistory,
  type ActivityEntry, type ProcessingHistoryEntry,
} from '../hooks/useGodMode';
import { useProject } from '../contexts/ProjectContext';
import {
  Search, Download, ChevronDown, X, Plus, Pencil, Trash2,
  RotateCw, Zap, Upload, Clock, Filter, FileText, HelpCircle,
  ShieldAlert, Lightbulb, CheckSquare, GitCommit, Users, Mail,
  Calendar, Activity, Cpu, UserPlus, UserMinus, Settings, Key,
  MessageSquare, LogIn, LogOut, Loader2, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PersonAvatar } from '../components/shared/PersonAvatar';
import { ErrorState } from '../components/shared/ErrorState';
import { Skeleton } from '../components/ui/skeleton';

// ── Style tokens (aligned with ProfilePage) ────────────────────────────────

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';

type HistoryTab = 'activity' | 'processing';

const NAV_ITEMS: { id: HistoryTab; label: string; icon: typeof Activity }[] = [
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'processing', label: 'Processing', icon: Cpu },
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Action / Entity config ──────────────────────────────────────────────────

const ACTION_CFG: Record<string, { icon: typeof Plus; color: string; bg: string; border: string; label: string }> = {
  created:   { icon: Plus,       color: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  label: 'Created' },
  updated:   { icon: Pencil,     color: 'text-blue-500',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   label: 'Updated' },
  deleted:   { icon: Trash2,     color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: 'Deleted' },
  restored:  { icon: RotateCw,   color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Restored' },
  processed: { icon: Zap,        color: 'text-cyan-500',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   label: 'Processed' },
  uploaded:  { icon: Upload,     color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Uploaded' },
  added:     { icon: UserPlus,   color: 'text-emerald-500',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',label: 'Added' },
  removed:   { icon: UserMinus,  color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Removed' },
  changed:   { icon: Settings,   color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', label: 'Changed' },
  login:     { icon: LogIn,      color: 'text-teal-500',   bg: 'bg-teal-500/10',   border: 'border-teal-500/30',   label: 'Login' },
  logout:    { icon: LogOut,     color: 'text-slate-500',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  label: 'Logout' },
  access:    { icon: Key,        color: 'text-rose-500',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   label: 'Access' },
  comment:   { icon: MessageSquare, color: 'text-sky-500', bg: 'bg-sky-500/10',    border: 'border-sky-500/30',    label: 'Comment' },
};

const ENTITY_CFG: Record<string, { icon: typeof FileText; label: string }> = {
  project:  { icon: FileText,    label: 'Project' },
  document: { icon: FileText,    label: 'Document' },
  fact:     { icon: Lightbulb,   label: 'Fact' },
  question: { icon: HelpCircle,  label: 'Question' },
  risk:     { icon: ShieldAlert, label: 'Risk' },
  action:   { icon: CheckSquare, label: 'Action' },
  decision: { icon: GitCommit,   label: 'Decision' },
  contact:  { icon: Users,       label: 'Contact' },
  email:    { icon: Mail,        label: 'Email' },
  member:   { icon: Users,       label: 'Member' },
  invite:   { icon: UserPlus,    label: 'Invite' },
  content:  { icon: FileText,    label: 'Content' },
  comment:  { icon: MessageSquare, label: 'Comment' },
  settings: { icon: Settings,    label: 'Settings' },
  user:     { icon: Users,       label: 'User' },
  password: { icon: Key,         label: 'Auth' },
  admin:    { icon: Key,         label: 'Admin' },
};

const DEFAULT_ACTION = { icon: Pencil, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Action' };
const DEFAULT_ENTITY = { icon: FileText, label: 'Item' };

function parseActivityAction(action: string): { actionKey: string; entityKey: string } {
  const parts = action.split('.');
  const entityKey = parts[0] || 'item';
  const actionKey = parts[1] || 'updated';
  return { actionKey, entityKey };
}

function getActionCfg(key: string) {
  return ACTION_CFG[key] || DEFAULT_ACTION;
}

function getEntityCfg(key: string) {
  return ENTITY_CFG[key] || DEFAULT_ENTITY;
}

// ── Time helpers ────────────────────────────────────────────────────────────

function getDateKey(ts: string): string {
  return ts ? new Date(ts).toISOString().split('T')[0] : 'unknown';
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function relativeTime(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function snakeToTitle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Unified entry type ──────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  actionKey: string;
  entityKey: string;
  title: string;
  description?: string;
  timestamp: string;
  actor?: { name: string; avatar_url?: string };
  metadata?: Record<string, unknown>;
  source: 'activity' | 'processing';
}

function activityToTimeline(a: ActivityEntry): TimelineEntry {
  const { actionKey, entityKey } = parseActivityAction(a.action);
  const meta = a.metadata || {};
  const name = String(meta.name || meta.target_name || meta.filename || '');
  const aCfg = getActionCfg(actionKey);
  const eCfg = getEntityCfg(entityKey);
  return {
    id: a.id,
    actionKey,
    entityKey,
    title: name || `${eCfg.label} ${aCfg.label.toLowerCase()}`,
    description: meta.description ? String(meta.description) : undefined,
    timestamp: a.created_at,
    actor: a.actor ? {
      name: a.actor.display_name || a.actor.username || 'Unknown',
      avatar_url: a.actor.avatar_url || undefined,
    } : undefined,
    metadata: meta,
    source: 'activity',
  };
}

function processingToTimeline(p: ProcessingHistoryEntry, idx: number): TimelineEntry {
  const stats: string[] = [];
  if (p.facts_extracted) stats.push(`${p.facts_extracted} facts`);
  if (p.questions_added) stats.push(`${p.questions_added} questions`);
  if (p.decisions_added) stats.push(`${p.decisions_added} decisions`);
  if (p.risks_added) stats.push(`${p.risks_added} risks`);
  if (p.actions_added) stats.push(`${p.actions_added} actions`);
  if (p.people_added) stats.push(`${p.people_added} contacts`);
  return {
    id: `proc-${idx}-${p.timestamp}`,
    actionKey: 'processed',
    entityKey: 'document',
    title: p.filename || 'Document processing',
    description: stats.length ? `Extracted: ${stats.join(', ')}` : undefined,
    timestamp: p.timestamp,
    metadata: {
      status: p.status,
      model: p.model_used,
      tokens: p.tokens_used,
      duration_ms: p.duration_ms,
      files_processed: p.files_processed,
    },
    source: 'processing',
  };
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="flex-1 p-6 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-36 bg-[var(--gm-surface-secondary)]" />
        <Skeleton className="h-8 w-48 rounded-lg bg-[var(--gm-surface-secondary)]" />
      </div>
      <div className="flex gap-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-7 w-20 rounded-lg bg-[var(--gm-surface-secondary)]" />)}</div>
      {[1, 2, 3].map(g => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-4 w-40 bg-[var(--gm-surface-secondary)]" />
          {[1, 2, 3].map(i => (
            <div key={i} className={cn(CARD, 'flex items-start gap-3 p-3')}>
              <Skeleton className="h-9 w-9 rounded-lg shrink-0 bg-[var(--gm-surface-secondary)]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3 bg-[var(--gm-surface-secondary)]" />
                <Skeleton className="h-2.5 w-1/3 bg-[var(--gm-surface-secondary)]" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Filter pill button ──────────────────────────────────────────────────────

function FilterPill({
  active, onClick, icon: Icon, label, activeColor, activeBg, activeBorder,
}: {
  active: boolean; onClick: () => void; icon: typeof Plus; label: string;
  activeColor?: string; activeBg?: string; activeBorder?: string;
}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn(
        'px-2 py-1 rounded-md text-[10px] font-medium transition-all border flex items-center gap-1',
        active
          ? `${activeBg || 'bg-blue-500/10'} ${activeBorder || 'border-blue-500/30'} ${activeColor || 'text-blue-500'}`
          : 'bg-[var(--gm-surface-secondary)] border-transparent text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:border-[var(--gm-border-primary)]'
      )}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

// ── Timeline entry card ─────────────────────────────────────────────────────

function EntryCard({ entry, isOpen, onToggle }: { entry: TimelineEntry; isOpen: boolean; onToggle: () => void }) {
  const aCfg = getActionCfg(entry.actionKey);
  const eCfg = getEntityCfg(entry.entityKey);
  const ActionIcon = aCfg.icon;
  const meta = entry.metadata;

  return (
    <div className={cn(CARD, 'overflow-hidden hover:border-[var(--gm-interactive-primary)] hover:shadow-md')}>
      <div className="py-3 px-4 flex items-start gap-3 cursor-pointer" onClick={onToggle}>
        <div className={cn('rounded-lg flex items-center justify-center shrink-0 h-8 w-8', aCfg.bg)}>
          <ActionIcon className={cn('w-4 h-4', aCfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', aCfg.bg, aCfg.border, aCfg.color)}>
              {aCfg.label}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-surface-secondary)] text-[var(--gm-text-tertiary)]">
              {eCfg.label}
            </span>
          </div>
          <p className="text-sm text-[var(--gm-text-primary)] mt-1 leading-snug truncate">{entry.title}</p>
          {entry.description && (
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5 truncate">{entry.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {entry.actor && (
              <div className="flex items-center gap-1.5">
                <PersonAvatar person={{ name: entry.actor.name, avatar_url: entry.actor.avatar_url }} size="xs" />
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">{entry.actor.name}</span>
              </div>
            )}
            {entry.timestamp && (
              <span className="text-[10px] text-[var(--gm-text-tertiary)] opacity-60" title={new Date(entry.timestamp).toLocaleString()}>
                {relativeTime(entry.timestamp)}
              </span>
            )}
            {entry.source === 'processing' && meta?.model && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gm-surface-secondary)] text-[var(--gm-text-tertiary)]">
                {String(meta.model)}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-[var(--gm-text-tertiary)] transition-transform mt-1', isOpen && 'rotate-180')} />
      </div>
      {isOpen && meta && Object.keys(meta).length > 0 && (
        <div className="px-4 pb-3 border-t border-[var(--gm-border-primary)] pt-3">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
              <div key={k} className="contents">
                <span className="text-[10px] font-medium text-[var(--gm-text-tertiary)]">{snakeToTitle(k)}</span>
                <span className="text-[10px] text-[var(--gm-text-secondary)] truncate">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 50;

const ACTIVITY_ACTION_FILTERS = [
  { key: 'created',   label: 'Created' },
  { key: 'updated',   label: 'Updated' },
  { key: 'deleted',   label: 'Deleted' },
  { key: 'processed', label: 'Processed' },
  { key: 'uploaded',  label: 'Uploaded' },
  { key: 'added',     label: 'Added' },
  { key: 'removed',   label: 'Removed' },
  { key: 'changed',   label: 'Changed' },
] as const;

const ENTITY_FILTERS = [
  'project', 'document', 'content', 'member', 'invite', 'fact',
  'question', 'risk', 'action', 'decision', 'contact', 'email',
] as const;

export default function HistoryPage() {
  const { project } = useProject();
  const [tab, setTab] = useState<HistoryTab>('activity');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const searchRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const activityQuery = useActivityLog({ limit: 500 });
  const processingQuery = useProcessingHistory();

  // Auto-select processing tab if activity is empty but processing has data
  const [autoSwitched, setAutoSwitched] = useState(false);
  useEffect(() => {
    if (autoSwitched) return;
    if (!activityQuery.isLoading && !processingQuery.isLoading) {
      const actCount = activityQuery.data?.activities?.length ?? 0;
      const procCount = (processingQuery.data ?? []).length;
      if (actCount === 0 && procCount > 0) {
        setTab('processing');
        setAutoSwitched(true);
      }
    }
  }, [activityQuery.isLoading, processingQuery.isLoading, activityQuery.data, processingQuery.data, autoSwitched]);

  const isLoading = tab === 'activity' ? activityQuery.isLoading : processingQuery.isLoading;
  const isError = tab === 'activity' ? activityQuery.isError : processingQuery.isError;
  const refetch = tab === 'activity' ? activityQuery.refetch : processingQuery.refetch;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    setExpandedId(null);
  }, [tab, actionFilter, entityFilter, dateFrom, dateTo, debouncedSearch]);

  const allEntries: TimelineEntry[] = useMemo(() => {
    if (tab === 'activity') {
      const raw = activityQuery.data;
      const activities = raw?.activities ?? [];
      return activities.map(activityToTimeline);
    }
    const history = processingQuery.data ?? [];
    return history.map(processingToTimeline);
  }, [tab, activityQuery.data, processingQuery.data]);

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (actionFilter && e.actionKey !== actionFilter) return false;
      if (entityFilter && e.entityKey !== entityFilter) return false;
      if (dateFrom && e.timestamp < dateFrom) return false;
      if (dateTo) {
        const endDate = dateTo + 'T23:59:59.999Z';
        if (e.timestamp > endDate) return false;
      }
      if (debouncedSearch) {
        const text = `${e.title} ${e.description || ''} ${e.actor?.name || ''} ${e.actionKey} ${e.entityKey}`.toLowerCase();
        if (!text.includes(debouncedSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [allEntries, actionFilter, entityFilter, dateFrom, dateTo, debouncedSearch]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    const order: string[] = [];
    visible.forEach(e => {
      const dk = getDateKey(e.timestamp);
      if (!map.has(dk)) { map.set(dk, []); order.push(dk); }
      map.get(dk)!.push(e);
    });
    const todayKey = new Date().toISOString().split('T')[0];
    return order.map(dk => ({
      dateKey: dk,
      label: dk === 'unknown' ? 'Unknown Date' : getDateLabel(dk),
      isToday: dk === todayKey,
      entries: map.get(dk)!,
    }));
  }, [visible]);

  const clearFilters = useCallback(() => {
    setSearch(''); setActionFilter(''); setEntityFilter('');
    setDateFrom(''); setDateTo('');
  }, []);
  const hasFilters = search || actionFilter || entityFilter || dateFrom || dateTo;

  const handleExport = useCallback((format: 'json' | 'csv') => {
    setShowExport(false);
    const rows = filtered.map(e => ({
      action: e.actionKey, entity: e.entityKey,
      title: e.title, description: e.description || '',
      actor: e.actor?.name || '', timestamp: e.timestamp,
    }));
    let blob: Blob, filename: string;
    const dateSuffix = new Date().toISOString().split('T')[0];
    if (format === 'json') {
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      filename = `history-${dateSuffix}.json`;
    } else {
      const hdr = Object.keys(rows[0] || {});
      const csv = [hdr.join(','), ...rows.map(r => hdr.map(h => `"${String((r as Record<string, string>)[h] || '').replace(/"/g, '""')}"`).join(','))];
      blob = new Blob([csv.join('\n')], { type: 'text/csv' });
      filename = `history-${dateSuffix}.csv`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') { (e.target as HTMLElement).blur(); setSearch(''); }
        return;
      }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setExpandedId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[var(--gm-bg-primary)]">
      {/* Side nav */}
      <aside className="w-52 shrink-0 border-r border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] flex flex-col">
        <div className="px-4 py-4 border-b border-[var(--gm-border-primary)]">
          <h1 className="text-sm font-bold text-[var(--gm-text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--gm-accent-primary)]" /> History
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                  active
                    ? 'bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] shadow-sm'
                    : 'text-[var(--gm-text-secondary)] hover:bg-[var(--gm-surface-secondary)] hover:text-[var(--gm-text-primary)]'
                )}>
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                {item.id === 'activity' && activityQuery.data?.total !== undefined && activityQuery.data.total > 0 && (
                  <span className={cn(
                    'ml-auto text-[9px] px-1.5 py-0.5 rounded-full',
                    active ? 'bg-white/20 text-white' : 'bg-[var(--gm-surface-secondary)] text-[var(--gm-text-tertiary)]'
                  )}>
                    {activityQuery.data.total}
                  </span>
                )}
                {item.id === 'processing' && !processingQuery.isLoading && (processingQuery.data ?? []).length > 0 && (
                  <span className={cn(
                    'ml-auto text-[9px] px-1.5 py-0.5 rounded-full',
                    active ? 'bg-white/20 text-white' : 'bg-[var(--gm-surface-secondary)] text-[var(--gm-text-tertiary)]'
                  )}>
                    {(processingQuery.data ?? []).length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header toolbar */}
        <div className="shrink-0 border-b border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)]">
          <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <SectionHeader
                  title={tab === 'activity' ? 'Activity Log' : 'Processing History'}
                  subtitle={tab === 'activity' ? 'All actions and changes in this project' : 'Document processing sessions and results'}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--gm-text-tertiary)] bg-[var(--gm-surface-secondary)] px-2 py-0.5 rounded-full">
                  {filtered.length}{allEntries.length > filtered.length ? ` / ${allEntries.length}` : ''} entries
                </span>
                <div className="relative" ref={exportRef}>
                  <button onClick={() => setShowExport(!showExport)} aria-expanded={showExport}
                    className={BTN_SECONDARY}>
                    <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                  </button>
                  {showExport && (
                    <div className={cn(CARD, 'absolute right-0 top-full mt-1 z-30 min-w-[130px] overflow-hidden')}>
                      <button onClick={() => handleExport('csv')}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-secondary)] transition-colors">
                        Export CSV
                      </button>
                      <button onClick={() => handleExport('json')}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-secondary)] transition-colors">
                        Export JSON
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Search + date range */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search history... (press / to focus)" aria-label="Search history"
                  className={cn(INPUT, '!pl-8 !pr-8 !py-1.5 !text-xs')} />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  aria-label="Date from"
                  className={cn(INPUT, '!w-[130px] !py-1.5 !text-[10px]')} />
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  aria-label="Date to"
                  className={cn(INPUT, '!w-[130px] !py-1.5 !text-[10px]')} />
              </div>
            </div>

            {/* Action filters */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5" role="toolbar" aria-label="Filter by action type">
              <Filter className="w-3 h-3 text-[var(--gm-text-tertiary)] mr-0.5" />
              {ACTIVITY_ACTION_FILTERS.map(f => {
                const cfg = getActionCfg(f.key);
                return (
                  <FilterPill key={f.key}
                    active={actionFilter === f.key}
                    onClick={() => setActionFilter(actionFilter === f.key ? '' : f.key)}
                    icon={cfg.icon} label={f.label}
                    activeColor={cfg.color} activeBg={cfg.bg} activeBorder={cfg.border}
                  />
                );
              })}
            </div>

            {/* Entity filters */}
            <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Filter by entity type">
              <span className="w-3 mr-0.5" />
              {ENTITY_FILTERS.map(key => {
                const cfg = getEntityCfg(key);
                return (
                  <FilterPill key={key}
                    active={entityFilter === key}
                    onClick={() => setEntityFilter(entityFilter === key ? '' : key)}
                    icon={cfg.icon} label={cfg.label}
                    activeColor="text-blue-400"
                    activeBg="bg-blue-500/10"
                    activeBorder="border-blue-500/30"
                  />
                );
              })}
              {hasFilters && (
                <button onClick={clearFilters}
                  className="px-2 py-1 rounded-md text-[10px] font-medium text-[var(--gm-text-tertiary)] hover:text-red-500 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <HistorySkeleton />
          ) : isError ? (
            <div className="p-6">
              <ErrorState message={`Failed to load ${tab === 'activity' ? 'activity log' : 'processing history'}.`} onRetry={() => refetch()} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-5">
              <div className="w-20 h-20 rounded-full bg-[var(--gm-surface-secondary)] flex items-center justify-center mb-4">
                <Clock className="w-10 h-10 text-[var(--gm-text-tertiary)] opacity-30" />
              </div>
              <p className="text-sm font-medium text-[var(--gm-text-secondary)] mb-1">
                {tab === 'activity' ? 'No activity found' : 'No processing history'}
              </p>
              <p className="text-xs text-[var(--gm-text-tertiary)] opacity-60 max-w-sm mb-4">
                {hasFilters
                  ? 'Try adjusting your filters or search terms.'
                  : tab === 'activity'
                    ? 'Activity will appear here as changes are made to the project.'
                    : 'Processing history will appear here after documents are processed.'}
              </p>
              <div className="flex items-center gap-2">
                {hasFilters && (
                  <button onClick={clearFilters} className={BTN_PRIMARY}>Clear Filters</button>
                )}
                {!hasFilters && tab === 'activity' && (processingQuery.data ?? []).length > 0 && (
                  <button onClick={() => setTab('processing')} className={BTN_SECONDARY}>
                    <Cpu className="w-3.5 h-3.5" /> View Processing History
                  </button>
                )}
                {!hasFilters && tab === 'processing' && (activityQuery.data?.activities?.length ?? 0) > 0 && (
                  <button onClick={() => setTab('activity')} className={BTN_SECONDARY}>
                    <Activity className="w-3.5 h-3.5" /> View Activity Log
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-4">
              {grouped.map(group => (
                <div key={group.dateKey} className="mb-6">
                  <div className="sticky top-0 z-10 flex items-center gap-3 py-2 bg-[var(--gm-bg-primary)]">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0',
                      group.isToday ? 'bg-[var(--gm-interactive-primary)] ring-2 ring-blue-500/30' : 'bg-[var(--gm-text-tertiary)] opacity-40')} />
                    <span className={cn('text-[11px] font-semibold uppercase tracking-wider',
                      group.isToday ? 'text-[var(--gm-interactive-primary)]' : 'text-[var(--gm-text-tertiary)]')}>
                      {group.label}
                    </span>
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] opacity-50">{group.entries.length}</span>
                    <div className="flex-1 h-px bg-[var(--gm-border-primary)]" />
                  </div>

                  <div className="ml-[5px] border-l-2 border-[var(--gm-border-primary)] space-y-1.5 pl-5">
                    {group.entries.map(entry => (
                      <EntryCard key={entry.id} entry={entry}
                        isOpen={expandedId === entry.id}
                        onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <button onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)} className={BTN_SECONDARY}>
                    Load More ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}

              {!hasMore && filtered.length > 0 && (
                <div className="flex items-center justify-center gap-3 py-3 text-[9px] text-[var(--gm-text-tertiary)] opacity-40">
                  <span>End of history</span>
                  <span className="mx-2">·</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] text-[8px]">/</kbd> search</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] text-[8px]">Esc</kbd> collapse</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
