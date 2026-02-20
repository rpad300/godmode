import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  useTimeline,
  type TimelineEvent,
} from '../hooks/useGodMode';
import {
  Calendar, Filter, Loader2, FileText, HelpCircle, ShieldAlert,
  Lightbulb, CheckSquare, GitCommit, Search, Download, X,
  Mail, MessageSquare, Users, Mic, Clock, ChevronDown,
  ArrowUp, Zap, LayoutGrid, LayoutList, Rows3,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ErrorState } from '../components/shared/ErrorState';
import { Skeleton } from '../components/ui/skeleton';

const EVENT_TYPES = [
  { key: 'question', icon: HelpCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Questions' },
  { key: 'fact', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Facts' },
  { key: 'decision', icon: GitCommit, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Decisions' },
  { key: 'risk', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Risks' },
  { key: 'action', icon: CheckSquare, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Actions' },
  { key: 'document', icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', label: 'Documents' },
  { key: 'email', icon: Mail, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Emails' },
  { key: 'conversation', icon: MessageSquare, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/30', label: 'Conversations' },
  { key: 'contact', icon: Users, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/30', label: 'Contacts' },
  { key: 'transcript', icon: Mic, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', label: 'Transcripts' },
  { key: 'chat_session', icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/30', label: 'Chat' },
  { key: 'deadline', icon: Clock, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'Deadlines' },
] as const;

const typeMap = Object.fromEntries(EVENT_TYPES.map(t => [t.key, t]));

type Density = 'compact' | 'comfortable' | 'spacious';
type DateRange = '7' | '14' | '30' | '90' | 'all';

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name?: string): string {
  if (!name) return '?';
  return name.split(/[\s@]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function getStatusBadge(status?: string) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    active: { label: 'Active', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    completed: { label: 'Completed', cls: 'bg-green-500/10 text-green-500 border-green-500/20' },
    approved: { label: 'Approved', cls: 'bg-green-500/10 text-green-500 border-green-500/20' },
    rejected: { label: 'Rejected', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    overdue: { label: 'Overdue', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    mitigated: { label: 'Mitigated', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  };
  const m = map[s];
  if (!m) return null;
  return <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full border', m.cls)}>{m.label}</span>;
}

function TimelineSkeleton() {
  return (
    <div className="p-5 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32 bg-gm-surface-secondary" />
        <Skeleton className="h-8 w-48 rounded-lg bg-gm-surface-secondary" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-7 w-20 rounded-lg bg-gm-surface-secondary" />)}
      </div>
      {[1, 2, 3].map(g => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-4 w-40 bg-gm-surface-secondary" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3 ml-4 pl-4">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0 bg-gm-surface-secondary" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3 bg-gm-surface-secondary" />
                <Skeleton className="h-2.5 w-1/3 bg-gm-surface-secondary" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function TimelinePage() {
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [density, setDensity] = useState<Density>('comfortable');
  const [showExport, setShowExport] = useState(false);
  const [limit, setLimit] = useState(200);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const startDate = useMemo(() => {
    if (dateRange === 'all') return undefined;
    const d = new Date();
    d.setDate(d.getDate() - Number(dateRange));
    return d.toISOString().split('T')[0];
  }, [dateRange]);

  const typesParam = activeTypes.size > 0 ? Array.from(activeTypes).join(',') : undefined;

  const { data, isLoading, isError, refetch } = useTimeline({
    types: typesParam,
    startDate,
    limit,
  });

  const events = data?.events ?? [];
  const totalEvents = data?.totalEvents ?? 0;

  const filtered = useMemo(() => {
    if (!debouncedSearch) return events;
    const q = debouncedSearch.toLowerCase();
    return events.filter(e => {
      const text = [e.title, e.content, e.description, e.owner, e.type].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [events, debouncedSearch]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const t = e.type || 'unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [events]);

  const grouped = useMemo(() => {
    const groups: { dateKey: string; label: string; isToday: boolean; events: TimelineEvent[] }[] = [];
    const map = new Map<string, TimelineEvent[]>();
    const order: string[] = [];

    filtered.forEach(e => {
      const ts = e.date || '';
      const dateKey = ts ? new Date(ts).toISOString().split('T')[0] : 'unknown';
      if (!map.has(dateKey)) { map.set(dateKey, []); order.push(dateKey); }
      map.get(dateKey)!.push(e);
    });

    const todayKey = new Date().toISOString().split('T')[0];
    order.forEach(dateKey => {
      groups.push({
        dateKey,
        label: dateKey === 'unknown' ? 'Unknown Date' : getDateLabel(dateKey),
        isToday: dateKey === todayKey,
        events: map.get(dateKey)!,
      });
    });
    return groups;
  }, [filtered]);

  const flatEvents = useMemo(() => grouped.flatMap(g => g.events), [grouped]);

  const toggleType = useCallback((key: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveTypes(new Set());
    setSearch('');
    setDateRange('30');
  }, []);

  const handleExport = useCallback((format: 'csv' | 'json') => {
    setShowExport(false);
    const exportData = filtered.map(e => ({
      type: e.type, date: e.date, title: e.title || e.content || e.description || '',
      owner: e.owner || '', status: e.status || '', operation: e.operation || '',
    }));
    let blob: Blob;
    let filename: string;
    if (format === 'json') {
      blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      filename = `timeline-${new Date().toISOString().split('T')[0]}.json`;
    } else {
      const headers = Object.keys(exportData[0] || {});
      const rows = [headers.join(','), ...exportData.map(r => headers.map(h => `"${String((r as Record<string, string>)[h] || '').replace(/"/g, '""')}"`).join(','))];
      blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      filename = `timeline-${new Date().toISOString().split('T')[0]}.csv`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') { (e.target as HTMLElement).blur(); setSearch(''); }
        return;
      }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flatEvents.length - 1)); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Escape') { setSelectedIdx(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flatEvents.length]);

  const densityCls = density === 'compact' ? 'py-2 px-3 gap-2' : density === 'spacious' ? 'py-5 px-5 gap-4' : 'py-3.5 px-4 gap-3';
  const densityIcon = density === 'compact' ? 'h-7 w-7' : density === 'spacious' ? 'h-10 w-10' : 'h-8 w-8';

  if (isLoading) return <TimelineSkeleton />;
  if (isError) return <div className="p-5"><ErrorState message="Failed to load timeline data." onRetry={() => refetch()} /></div>;

  let eventIdx = -1;

  return (
    <div ref={panelRef} className="flex flex-col h-[calc(100vh-4rem)]" tabIndex={-1}>
      {/* Header */}
      <div className="shrink-0 border-b border-gm-border-primary bg-gm-surface-primary sticky top-0 z-20">
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-gm-text-primary">Timeline</h1>
              <span className="text-[10px] text-gm-text-tertiary bg-gm-surface-secondary px-2 py-0.5 rounded-full">
                {filtered.length}{totalEvents > filtered.length ? ` / ${totalEvents}` : ''} events
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Density toggle */}
              <div className="flex items-center border border-gm-border-primary rounded-lg overflow-hidden">
                {([['compact', LayoutList], ['comfortable', Rows3], ['spacious', LayoutGrid]] as [Density, typeof LayoutList][]).map(([d, Icon]) => (
                  <button key={d} onClick={() => setDensity(d)} aria-label={`${d} density`} aria-pressed={density === d}
                    className={cn('p-1.5 transition-colors', density === d ? 'bg-blue-600/10 text-gm-interactive-primary' : 'text-gm-text-tertiary hover:text-gm-text-primary')}>
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              {/* Export dropdown */}
              <div className="relative">
                <button onClick={() => setShowExport(!showExport)} aria-expanded={showExport} aria-label="Export timeline"
                  className="px-2.5 py-1.5 rounded-lg border border-gm-border-primary text-gm-text-tertiary hover:text-gm-text-primary hover:bg-gm-surface-secondary text-xs flex items-center gap-1.5 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                </button>
                {showExport && (
                  <div className="absolute right-0 top-full mt-1 bg-gm-surface-primary border border-gm-border-primary rounded-lg shadow-lg z-30 min-w-[120px]">
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-2 text-xs text-gm-text-primary hover:bg-gm-surface-secondary transition-colors">Export CSV</button>
                    <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-2 text-xs text-gm-text-primary hover:bg-gm-surface-secondary transition-colors">Export JSON</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search + Date range */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search events... (press / to focus)" aria-label="Search timeline events"
                className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-gm-bg-tertiary border border-gm-border-primary text-xs text-gm-text-primary placeholder:text-gm-text-placeholder focus:outline-none focus:border-gm-border-focus transition-colors" />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gm-text-tertiary hover:text-gm-text-primary">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center border border-gm-border-primary rounded-lg overflow-hidden">
              {([['7', '7d'], ['14', '14d'], ['30', '30d'], ['90', '90d'], ['all', 'All']] as [DateRange, string][]).map(([value, label]) => (
                <button key={value} onClick={() => setDateRange(value)} aria-pressed={dateRange === value}
                  className={cn('px-2.5 py-1.5 text-[10px] font-medium transition-colors',
                    dateRange === value ? 'bg-blue-600/10 text-gm-interactive-primary' : 'text-gm-text-tertiary hover:text-gm-text-primary')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Type filters */}
          <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Filter by event type">
            <Filter className="w-3 h-3 text-gm-text-tertiary mr-0.5" />
            {EVENT_TYPES.map(t => {
              const count = typeCounts[t.key] || 0;
              const active = activeTypes.has(t.key);
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => toggleType(t.key)} aria-pressed={active}
                  className={cn('px-2 py-1 rounded-md text-[10px] font-medium transition-all border flex items-center gap-1',
                    active ? `${t.bg} ${t.border} ${t.color}` : 'bg-gm-surface-secondary border-transparent text-gm-text-tertiary hover:text-gm-text-primary hover:border-gm-border-primary')}>
                  <Icon className="w-3 h-3" /> {t.label}
                  {count > 0 && <span className="text-[9px] opacity-70">{count}</span>}
                </button>
              );
            })}
            {(activeTypes.size > 0 || search || dateRange !== '30') && (
              <button onClick={clearFilters} className="px-2 py-1 rounded-md text-[10px] font-medium text-gm-text-tertiary hover:text-gm-status-danger transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-5">
            <div className="w-20 h-20 rounded-full bg-gm-surface-secondary flex items-center justify-center mb-4">
              <Clock className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gm-text-secondary mb-1">No events found</p>
            <p className="text-xs text-gray-400 max-w-sm mb-4">
              {search ? `No events matching "${search}"` : activeTypes.size > 0 ? 'No events for the selected types' : 'No timeline events in this period'}
            </p>
            {(search || activeTypes.size > 0) && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover transition-colors">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="px-5 py-4">
            {grouped.map(group => {
              return (
                <div key={group.dateKey} className="mb-6">
                  {/* Date header */}
                  <div className="sticky top-0 z-10 flex items-center gap-3 py-2 bg-gm-bg-primary backdrop-blur-sm">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', group.isToday ? 'bg-gm-interactive-primary ring-2 ring-blue-600/30' : 'bg-gray-500')} />
                    <span className={cn('text-[11px] font-semibold uppercase tracking-wider', group.isToday ? 'text-gm-interactive-primary' : 'text-gm-text-tertiary')}>
                      {group.label}
                    </span>
                    <span className="text-[10px] text-gray-500">{group.events.length}</span>
                    <div className="flex-1 h-px bg-gm-border-primary" />
                    {group.isToday && (
                      <span className="text-[9px] font-medium text-gm-interactive-primary bg-blue-600/10 px-2 py-0.5 rounded-full">TODAY</span>
                    )}
                  </div>

                  {/* Today marker */}
                  {group.isToday && (
                    <div className="flex items-center gap-2 ml-[5px] my-1">
                      <div className="w-px h-3 bg-gm-interactive-primary" />
                      <div className="flex-1 h-px bg-blue-600/30" />
                    </div>
                  )}

                  {/* Events */}
                  <div className="ml-[5px] border-l-2 border-gm-border-primary space-y-1.5 pl-5">
                    {group.events.map((event, i) => {
                      eventIdx++;
                      const currentIdx = eventIdx;
                      const conf = typeMap[event.type] || { icon: Calendar, color: 'text-gm-text-tertiary', bg: 'bg-gm-surface-secondary', border: 'border-gm-border-primary', label: event.type || 'Event', key: 'unknown' };
                      const Icon = conf.icon;
                      const owner = event.owner || (event as Record<string, unknown>).changed_by_email as string || '';
                      const title = event.title || event.content || event.description || (event as Record<string, unknown>).filename as string || `${conf.label} event`;
                      const ts = event.date || '';
                      const isSelected = currentIdx === selectedIdx;

                      return (
                        <div key={`${group.dateKey}-${i}`}
                          className={cn(
                            'rounded-xl border bg-gm-surface-primary transition-all duration-150 flex items-start',
                            densityCls,
                            isSelected ? 'border-gm-interactive-primary ring-1 ring-blue-600/20 shadow-sm' : 'border-gm-border-primary hover:border-blue-600/20 hover:shadow-sm',
                          )}>
                          {/* Timeline dot connector */}
                          <div className="relative -ml-[29px] mr-2 mt-1 shrink-0">
                            <div className={cn('w-2.5 h-2.5 rounded-full border-2 border-gm-surface-primary', conf.bg.replace('/10', ''))} style={{ backgroundColor: `var(--tw-${conf.color.replace('text-', '')}, currentColor)` }}>
                              <div className={cn('w-full h-full rounded-full', conf.bg)} />
                            </div>
                          </div>

                          {/* Icon */}
                          <div className={cn('rounded-lg flex items-center justify-center shrink-0', conf.bg, densityIcon)}>
                            <Icon className={cn('w-4 h-4', conf.color)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', conf.bg, conf.border, conf.color)}>{conf.label}</span>
                              {event.operation && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary capitalize">{event.operation}</span>
                              )}
                              {getStatusBadge(event.status)}
                            </div>
                            <p className={cn('text-gm-text-primary mt-1 leading-snug', density === 'compact' ? 'text-xs' : 'text-sm')}>
                              {String(title)}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              {owner && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-full bg-gm-surface-secondary flex items-center justify-center">
                                    <span className="text-[7px] font-bold text-gm-text-tertiary">{initials(owner)}</span>
                                  </div>
                                  <span className="text-[10px] text-gm-text-tertiary">{owner}</span>
                                </div>
                              )}
                              {ts && (
                                <span className="text-[10px] text-gray-400" title={new Date(ts).toLocaleString()}>
                                  {relativeTime(ts)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {totalEvents > limit && (
              <div className="flex justify-center py-4">
                <button onClick={() => setLimit(l => l + 200)}
                  className="px-4 py-2 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-xs font-medium text-gm-text-primary hover:bg-gm-surface-hover transition-colors flex items-center gap-1.5">
                  <ArrowUp className="w-3.5 h-3.5 rotate-180" /> Load more ({totalEvents - limit} remaining)
                </button>
              </div>
            )}

            {/* Keyboard hint */}
            <div className="flex items-center justify-center gap-3 py-3 text-[9px] text-gray-500">
              <span><kbd className="px-1 py-0.5 rounded bg-gm-surface-secondary border border-gm-border-primary text-[8px]">J</kbd>/<kbd className="px-1 py-0.5 rounded bg-gm-surface-secondary border border-gm-border-primary text-[8px]">K</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-gm-surface-secondary border border-gm-border-primary text-[8px]">/</kbd> search</span>
              <span><kbd className="px-1 py-0.5 rounded bg-gm-surface-secondary border border-gm-border-primary text-[8px]">Esc</kbd> clear</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
