<<<<<<< HEAD
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Filter, Layers, User, Clock, Zap, Loader2 } from 'lucide-react';
import { useSprints, useSOTData } from '@/hooks/useGodMode';

type EventType = 'sprint' | 'action' | 'decision' | 'risk';
type ViewMode = 'week' | 'month';

const EVENT_COLORS: Record<EventType, { bg: string; border: string; text: string }> = {
  sprint: { bg: 'bg-primary/15', border: 'border-primary/40', text: 'text-primary' },
  action: { bg: 'bg-accent/15', border: 'border-accent/40', text: 'text-accent' },
  decision: { bg: 'bg-info/15', border: 'border-info/40', text: 'text-info' },
  risk: { bg: 'bg-destructive/15', border: 'border-destructive/40', text: 'text-destructive' },
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-success',
  done: 'bg-success',
  approved: 'bg-success',
  active: 'bg-primary',
  in_progress: 'bg-primary',
  planning: 'bg-warning',
  pending: 'bg-warning',
  open: 'bg-warning',
  overdue: 'bg-destructive',
  mitigated: 'bg-success',
  rejected: 'bg-destructive',
};

interface GanttEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: EventType;
  status: string;
  owner?: string;
  description?: string;
  children?: GanttEvent[];
}

const parseDate = (d: string) => new Date(d);
const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const TimelinePage = () => {
  const { data: sprints = [], isLoading: sprintsLoading } = useSprints();
  const { data: sotData, isLoading: sotLoading } = useSOTData();
  const actions = sotData?.actions || [];
  const decisions = sotData?.decisions || [];
  const risks = sotData?.risks || [];

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(['sprint', 'action', 'decision', 'risk']));
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());

  // Initialize expanded sprints when data loads
  useMemo(() => {
    if (sprints.length > 0) {
      setExpandedSprints(new Set(sprints.filter(s => s.status === 'active').map(s => s.id)));
    }
  }, [sprints]);

  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const toggleType = (type: EventType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const toggleSprint = (id: string) => {
    setExpandedSprints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Build events
  const events = useMemo(() => {
    const items: GanttEvent[] = [];

    if (activeTypes.has('sprint')) {
      sprints.forEach(sprint => {
        // mockUserStories are not available in current API, using actions with sprintId as children
        const sprintActions = actions.filter(a => a.sprintId === sprint.id);

        const children: GanttEvent[] = [];
        sprintActions.forEach(action => {
          children.push({
            id: action.id,
            title: action.title,
            startDate: sprint.startDate || sprint.start_date, // Handle snake_case from DB
            endDate: sprint.endDate || sprint.end_date,
            type: 'action',
            status: action.status,
            description: action.description,
          });
        });

        items.push({
          id: sprint.id,
          title: sprint.name,
          startDate: sprint.startDate || sprint.start_date,
          endDate: sprint.endDate || sprint.end_date,
          type: 'sprint',
          status: sprint.status,
          description: sprint.context || sprint.goal,
          children,
        });
      });
    }

    if (activeTypes.has('action')) {
      actions.filter(a => !a.sprintId && a.deadline).forEach(action => {
        items.push({
          id: `a-${action.id}`,
          title: action.title,
          startDate: action.createdAt || action.deadline!, // Fallback to deadline if createdAt missing
          endDate: action.deadline!,
          type: 'action',
          status: action.status,
          owner: action.owner,
          description: action.description,
        });
      });
    }

    if (activeTypes.has('decision')) {
      decisions.forEach(d => {
        items.push({
          id: `d-${d.id}`,
          title: d.title,
          startDate: d.date,
          endDate: d.date,
          type: 'decision',
          status: d.status,
          owner: d.owner,
          description: d.description,
        });
      });
    }

    if (activeTypes.has('risk')) {
      risks.forEach(r => {
        items.push({
          id: `r-${r.id}`,
          title: r.title,
          startDate: '2026-02-01', // Risk doesn't have date usually, defaulting for viz
          endDate: '2026-03-07',
          type: 'risk',
          status: r.status,
          owner: r.owner,
          description: r.description,
        });
      });
    }

    return items;
  }, [activeTypes, sprints, actions, decisions, risks]);

  // Calculate time range
  const allDates = useMemo(() => {
    const dates: Date[] = [];
    events.forEach(e => {
      dates.push(parseDate(e.startDate));
      dates.push(parseDate(e.endDate));
      e.children?.forEach(c => {
        dates.push(parseDate(c.startDate));
        dates.push(parseDate(c.endDate));
      });
    });
    if (dates.length === 0) {
      dates.push(new Date('2026-01-27'));
      dates.push(new Date('2026-03-07'));
    }
    return dates;
  }, [events]);

  const rangeStart = useMemo(() => {
    const min = new Date(Math.min(...allDates.map(d => d.getTime())));
    min.setDate(min.getDate() - 2);
    return min;
  }, [allDates]);

  const rangeEnd = useMemo(() => {
    const max = new Date(Math.max(...allDates.map(d => d.getTime())));
    max.setDate(max.getDate() + 3);
    return max;
  }, [allDates]);

  const totalDays = daysBetween(rangeStart, rangeEnd);
  const dayWidth = viewMode === 'week' ? 32 : 12;
  const chartWidth = totalDays * dayWidth;

  const today = new Date('2026-02-11');
  const todayOffset = daysBetween(rangeStart, today);

  // Generate date labels
  const dateLabels = useMemo(() => {
    const labels: { date: Date; offset: number }[] = [];
    const step = viewMode === 'week' ? 1 : 3;
    for (let i = 0; i <= totalDays; i += step) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      labels.push({ date: d, offset: i });
    }
    return labels;
  }, [rangeStart, totalDays, viewMode]);

  const getBarStyle = (start: string, end: string) => {
    const s = daysBetween(rangeStart, parseDate(start));
    const duration = Math.max(1, daysBetween(parseDate(start), parseDate(end)));
    return {
      left: `${s * dayWidth}px`,
      width: `${duration * dayWidth}px`,
    };
  };

  const getPointStyle = (date: string) => {
    const offset = daysBetween(rangeStart, parseDate(date));
    return { left: `${offset * dayWidth}px` };
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gantt view · {sprints.length} sprints · {actions.length} actions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Filters + Legend */}
      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Show:</span>
        </div>
        {(Object.keys(EVENT_COLORS) as EventType[]).map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${activeTypes.has(type)
              ? `${EVENT_COLORS[type].bg} ${EVENT_COLORS[type].border} ${EVENT_COLORS[type].text}`
              : 'bg-secondary/50 border-border text-muted-foreground'
              }`}
          >
            <div className={`w-2 h-2 rounded-full ${activeTypes.has(type) ? EVENT_COLORS[type].bg.replace('/15', '') : 'bg-muted-foreground/30'}`}
              style={activeTypes.has(type) ? { backgroundColor: `hsl(var(--${type === 'sprint' ? 'primary' : type === 'action' ? 'accent' : type === 'decision' ? 'info' : 'destructive'}))` } : {}}
            />
            {type.charAt(0).toUpperCase() + type.slice(1)}s
          </button>
        ))}
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-hidden border border-border rounded-xl bg-card">
        <div className="flex h-full">
          {/* Left labels column */}
          <div className="w-56 flex-shrink-0 border-r border-border bg-secondary/30">
            {/* Header */}
            <div className="h-10 border-b border-border flex items-center px-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</span>
            </div>
            {/* Rows */}
            <div className="overflow-y-auto" style={{ height: 'calc(100% - 40px)' }}>
              {events.map(event => (
                <div key={event.id}>
                  <div
                    className={`h-10 flex items-center gap-2 px-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${event.children ? 'cursor-pointer' : ''}`}
                    onClick={() => event.children && toggleSprint(event.id)}
                  >
                    {event.children && (
                      <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expandedSprints.has(event.id) ? 'rotate-90' : ''}`} />
                    )}
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[event.status] || 'bg-muted-foreground'}`} />
                    <span className={`text-xs truncate ${event.type === 'sprint' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {event.title}
                    </span>
                  </div>
                  {event.children && expandedSprints.has(event.id) && event.children.map(child => (
                    <div key={child.id} className="h-9 flex items-center gap-2 px-3 pl-8 border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[child.status] || 'bg-muted-foreground'}`} />
                      <span className="text-[11px] text-muted-foreground truncate">{child.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right chart area */}
          <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
            <div style={{ width: `${chartWidth}px`, minWidth: '100%' }}>
              {/* Date header */}
              <div className="h-10 border-b border-border relative flex-shrink-0">
                {dateLabels.map((label, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-end pb-1.5"
                    style={{ left: `${label.offset * dayWidth}px` }}
                  >
                    <span className={`text-[10px] whitespace-nowrap ${label.date.getDay() === 0 || label.date.getDay() === 6 ? 'text-muted-foreground/50' : 'text-muted-foreground'
                      }`}>
                      {formatDate(label.date)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chart body */}
              <div className="relative" style={{ height: 'calc(100% - 40px)' }}>
                {/* Today marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-destructive/60 z-20"
                  style={{ left: `${todayOffset * dayWidth}px` }}
                >
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-destructive text-destructive-foreground text-[9px] rounded-b font-medium whitespace-nowrap">
                    Today
                  </div>
                </div>

                {/* Weekend shading */}
                {Array.from({ length: totalDays }).map((_, i) => {
                  const d = new Date(rangeStart);
                  d.setDate(d.getDate() + i);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  if (!isWeekend) return null;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 bg-muted/20"
                      style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                    />
                  );
                })}

                {/* Event bars */}
                {events.map(event => {
                  const isSingleDay = event.startDate === event.endDate;
                  return (
                    <div key={event.id}>
                      {/* Main bar */}
                      <div className="h-10 relative">
                        {isSingleDay ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 z-10"
                            style={getPointStyle(event.startDate)}
                          >
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${EVENT_COLORS[event.type].border} ${EVENT_COLORS[event.type].bg}`}
                              onMouseEnter={() => setHoveredEvent(event.id)}
                              onMouseLeave={() => setHoveredEvent(null)}
                            />
                          </div>
                        ) : (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.4 }}
                            className={`absolute top-1.5 h-7 rounded-md border ${EVENT_COLORS[event.type].bg} ${EVENT_COLORS[event.type].border} flex items-center px-2 z-10 origin-left`}
                            style={getBarStyle(event.startDate, event.endDate)}
                            onMouseEnter={() => setHoveredEvent(event.id)}
                            onMouseLeave={() => setHoveredEvent(null)}
                          >
                            <span className={`text-[10px] font-medium truncate ${EVENT_COLORS[event.type].text}`}>
                              {event.title}
                            </span>
                          </motion.div>
                        )}

                        {/* Tooltip */}
                        {hoveredEvent === event.id && (
                          <div
                            className="absolute z-30 bg-popover border border-border rounded-lg p-3 shadow-xl"
                            style={{ left: `${daysBetween(rangeStart, parseDate(event.startDate)) * dayWidth}px`, top: '38px', minWidth: '200px' }}
                          >
                            <p className="text-xs font-semibold text-foreground">{event.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{event.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${EVENT_COLORS[event.type].bg} ${EVENT_COLORS[event.type].text}`}>{event.type}</span>
                              <span className="text-[9px] text-muted-foreground">{event.startDate}{event.startDate !== event.endDate ? ` → ${event.endDate}` : ''}</span>
                              {event.owner && <span className="text-[9px] text-muted-foreground">· {event.owner}</span>}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Children rows */}
                      {event.children && expandedSprints.has(event.id) && event.children.map(child => (
                        <div key={child.id} className="h-9 relative">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`absolute top-1.5 h-6 rounded border ${EVENT_COLORS[child.type].bg} ${EVENT_COLORS[child.type].border} flex items-center px-2 z-10 origin-left opacity-70 hover:opacity-100 transition-opacity`}
                            style={getBarStyle(child.startDate, child.endDate)}
                            onMouseEnter={() => setHoveredEvent(child.id)}
                            onMouseLeave={() => setHoveredEvent(null)}
                          >
                            <span className={`text-[9px] truncate ${EVENT_COLORS[child.type].text}`}>
                              {child.title}
                            </span>
                          </motion.div>

                          {hoveredEvent === child.id && (
                            <div
                              className="absolute z-30 bg-popover border border-border rounded-lg p-3 shadow-xl"
                              style={{ left: `${daysBetween(rangeStart, parseDate(child.startDate)) * dayWidth}px`, top: '32px', minWidth: '180px' }}
                            >
                              <p className="text-xs font-semibold text-foreground">{child.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[child.status] || 'bg-muted-foreground'}`} />
                                <span className="text-[9px] text-muted-foreground">{(child.status || '').replace('_', ' ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelinePage;
=======
import { useHistory } from '../hooks/useGodMode';
import { Calendar } from 'lucide-react';

export default function TimelinePage() {
  const { data, isLoading } = useHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading timeline...</div>
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Timeline</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          No timeline events yet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 rounded-lg border bg-[hsl(var(--card))] p-4">
              <Calendar className="h-5 w-5 text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm">{String((item as Record<string, unknown>).description ?? (item as Record<string, unknown>).content ?? '')}</p>
                {(item as Record<string, unknown>).timestamp && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    {new Date(String((item as Record<string, unknown>).timestamp)).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
>>>>>>> origin/claude/migrate-to-react-uJJbl
