/**
 * Purpose:
 *   Main dashboard page — full-featured view matching the backup SOTA design.
 *   Includes health score, AI briefing, stat cards, donut/bar/trend charts,
 *   golden hours timezone overlap, and recent activity feed.
 *
 * Key dependencies:
 *   - useDashboard, useStats, useHealth, useBriefing, useTrends (useGodMode)
 *   - useProject: active project
 *   - recharts: bar/pie charts
 *   - GoldenHours: timezone overlap visualization
 *   - @tanstack/react-query: cache invalidation
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useDashboard,
  useStats,
  useHealth,
  useBriefing,
  useBriefingHistory,
  useTrends,
  useActions,
  useContacts,
  useCostsSummary,
  useNotificationsCount,
  useSotAlerts,
  useEmailsNeedingResponse,
  useSprints,
  useConflicts,
  useDecisionConflicts,
  useRunFactCheck,
  useRunDecisionCheck,
  useContactsStats,
  useConversationsStats,
  useSyncDashboard,
} from '../hooks/useGodMode';
import type {
  HealthData, CostsSummary, SotAlert, EmailNeedingResponse, Sprint,
  Conflict, ContactsStats, ConversationsStats, SyncDashboard, BriefingHistoryItem,
} from '../hooks/useGodMode';
import { useProject } from '../hooks/useProject';
import { GoldenHours } from '../components/dashboard/GoldenHours';
import { ErrorState } from '../components/shared/ErrorState';
import { DashboardSkeleton } from '../components/shared/PageSkeleton';
import type { Contact } from '../types/godmode';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  CheckSquare,
  Gavel,
  Users,
  FileText,
  FolderOpen,
  RefreshCw,
  Activity,
  Heart,
  Brain,
  Clock,
  AlertCircle,
  DollarSign,
  Bell,
  ShieldAlert,
  Mail,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Zap,
  MessageSquare,
  Database,
  Building2,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeHtml } from '../lib/sanitize';

// ── Stat card definitions ──────────────────────────────────────────────────

const statCards = [
  { key: 'documents', label: 'Documents', icon: FileText, color: '#6366f1', route: '/files' },
  { key: 'facts', label: 'Facts', icon: Lightbulb, color: '#3b82f6', route: '/sot' },
  { key: 'questions', label: 'Questions', icon: HelpCircle, color: '#f59e0b', route: '/sot' },
  { key: 'risks', label: 'Risks', icon: AlertTriangle, color: '#ef4444', route: '/sot' },
  { key: 'actions', label: 'Actions', icon: CheckSquare, color: '#8b5cf6', route: '/sot' },
  { key: 'decisions', label: 'Decisions', icon: Gavel, color: '#10b981', route: '/sot' },
  { key: 'contacts', label: 'People', icon: Users, color: '#06b6d4', route: '/contacts' },
  { key: 'overdue', label: 'Overdue', icon: AlertCircle, color: '#dc2626', route: '/sot' },
];

const donutColors: Record<string, string> = {
  completed: '#10b981',
  in_progress: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#9ca3af',
};

const factsCategoryColors: Record<string, string> = {
  technical: '#3b82f6',
  process: '#8b5cf6',
  policy: '#f59e0b',
  people: '#06b6d4',
  timeline: '#ec4899',
  general: '#64748b',
};

const trendBarColors: Record<string, string> = {
  facts: '#3b82f6',
  questions: '#f59e0b',
  risks: '#ef4444',
  actions: '#8b5cf6',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function DashboardSpinner() {
  return <DashboardSkeleton />;
}

function HealthCard({ health }: { health: HealthData | null | undefined }) {
  if (!health || typeof health.score !== 'number') {
    return (
      <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 flex flex-col items-center justify-center gap-2 min-h-[240px]">
        <Heart className="h-8 w-8 text-gm-text-tertiary" />
        <span className="text-sm text-gm-text-tertiary">Health data unavailable</span>
      </div>
    );
  }

  const score = health.score;
  const statusColor = health.color || '#64748b';
  const factors = health.factors || [];

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 flex flex-col items-center gap-4 shadow-gm-sm">
      {/* Score Ring */}
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="var(--gm-border-primary)"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={statusColor}
            strokeWidth="3"
            strokeDasharray={`${score}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gm-text-primary">{score}</span>
          <span className="text-[10px] uppercase tracking-wider text-gm-text-tertiary">Health</span>
        </div>
      </div>

      {/* Status */}
      <span className="text-sm font-semibold" style={{ color: statusColor }}>
        {health.status}
      </span>

      {/* Factors */}
      {factors.length > 0 && (
        <div className="w-full space-y-1.5">
          {factors.map((f, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-xs px-3 py-1.5 rounded-md ${
                f.type === 'positive'
                  ? 'bg-gm-status-success-bg text-gm-status-success'
                  : 'bg-gm-status-danger-bg text-gm-status-danger'
              }`}
            >
              <span className="mt-0.5 shrink-0">{f.type === 'positive' ? '✓' : '!'}</span>
              <div className="min-w-0">
                <span className="block truncate">{f.factor}</span>
                {f.detail && <span className="block text-[10px] opacity-70 truncate">{f.detail}</span>}
              </div>
              {f.impact && (
                <span className="ml-auto text-[10px] font-semibold uppercase shrink-0 opacity-70">{f.impact}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefingCard({ refresh }: { refresh: boolean }) {
  const { data: briefing, isLoading } = useBriefing(refresh);
  const { data: historyData } = useBriefingHistory(5);
  const [showHistory, setShowHistory] = useState(false);

  const briefingText = briefing?.content || (briefing as Record<string, unknown>)?.briefing as string || '';
  const analysis = (briefing as Record<string, unknown>)?.analysis as string || '';
  const generatedAt = briefing?.generated_at || '';
  const cached = (briefing as Record<string, unknown>)?.cached;
  const historyItems = (historyData as { history?: BriefingHistoryItem[] })?.history ?? [];

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary shadow-gm-sm overflow-hidden flex-1">
      <div className="px-6 py-4 border-b border-gm-border-primary flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gm-text-primary flex items-center gap-2">
            <Brain className="h-5 w-5 text-gm-interactive-primary" />
            Daily Briefing
          </h2>
          {generatedAt && (
            <p className="text-xs text-gm-text-tertiary mt-0.5">
              {new Date(generatedAt).toLocaleString()}
              {cached && <span className="ml-2 px-1.5 py-0.5 bg-gm-surface-secondary rounded text-[10px]">cached</span>}
            </p>
          )}
        </div>
        {historyItems.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-xs text-gm-text-tertiary hover:text-gm-text-primary transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            History
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      <div className="p-6">
        {showHistory && historyItems.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-2">Past Briefings</h4>
            {historyItems.map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--gm-surface-hover)] border border-[var(--gm-border-primary)]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gm-text-tertiary">
                    {(item.generated_at || item.created_at) ? new Date((item.generated_at || item.created_at)!).toLocaleString() : `Briefing ${i + 1}`}
                  </span>
                  {item.model && <span className="text-[9px] text-gm-text-tertiary bg-gm-surface-secondary px-1.5 py-0.5 rounded">{item.model}</span>}
                </div>
                <p className="text-xs text-gm-text-secondary line-clamp-3">
                  {item.summary || item.briefing?.substring(0, 200) || item.content?.substring(0, 200) || 'No content'}
                </p>
              </div>
            ))}
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-3 py-8 justify-center text-gm-text-secondary text-sm">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating briefing...
          </div>
        ) : briefingText ? (
          <div className="space-y-3">
            <div
              className="prose prose-sm max-w-none text-gm-text-primary leading-relaxed
                         [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gm-text-primary [&_h3]:mt-4 [&_h3]:mb-2
                         [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-gm-text-secondary
                         [&_ul]:pl-5 [&_li]:text-sm [&_li]:text-gm-text-secondary [&_li]:mb-1
                         [&_strong]:text-gm-text-primary [&_p]:text-sm [&_p]:text-gm-text-secondary"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(briefingText)) }}
            />
            {analysis && (
              <div className="mt-4 pt-4 border-t border-gm-border-primary">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gm-text-tertiary mb-2">Analysis</h4>
                <div
                  className="text-sm text-gm-text-secondary leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(analysis)) }}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gm-text-tertiary py-4 text-center">No briefing available yet.</p>
        )}
      </div>
    </div>
  );
}

function ActionsDonutChart({ actionsByStatus }: { actionsByStatus: Record<string, number> | undefined }) {
  const data = useMemo(() => {
    if (!actionsByStatus) return [];
    return Object.entries(actionsByStatus)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()),
        value,
        color: donutColors[key] || '#9ca3af',
      }));
  }, [actionsByStatus]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Actions by Status</h3>
        <div className="flex items-center justify-center h-48 text-sm text-gm-text-tertiary">No actions yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Actions by Status</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" stroke="none">
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gm-text-primary">{total}</span>
            <span className="text-[10px] uppercase text-gm-text-tertiary">Total</span>
          </div>
        </div>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gm-text-secondary">{d.name || '—'}: <span className="font-semibold text-gm-text-primary">{d.value}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FactsCategoryChart({ factsByCategory }: { factsByCategory: Record<string, number> | undefined }) {
  if (!factsByCategory) return null;

  const categories = ['technical', 'process', 'policy', 'people', 'timeline', 'general'];
  const total = categories.reduce((s, c) => s + (factsByCategory[c] ?? 0), 0);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Facts by Category</h3>
        <div className="flex items-center justify-center h-48 text-sm text-gm-text-tertiary">No facts yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Facts by Category</h3>
      <div className="space-y-3">
        {categories.map(cat => {
          const count = factsByCategory[cat] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={cat} className="grid grid-cols-[70px_1fr_36px] items-center gap-2">
              <span className="text-xs text-gm-text-secondary capitalize">{cat}</span>
              <div className="h-2.5 bg-gm-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: factsCategoryColors[cat] || '#64748b' }}
                />
              </div>
              <span className="text-xs font-semibold text-gm-text-primary text-right tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TrendInsight {
  metric: string;
  message: string;
  severity: string;
  direction: string;
  sentiment: string;
  delta: number;
  icon?: string;
}

function TrendInsightsBar({ insights }: { insights: TrendInsight[] }) {
  if (!insights || insights.length === 0) return null;
  const severityClass: Record<string, string> = {
    success: 'text-gm-status-success',
    warning: 'text-gm-status-warning',
    info: 'text-gm-text-tertiary',
  };
  return (
    <div className="space-y-1 mt-3 pt-3 border-t border-gm-border-primary">
      {insights.map((ins, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={`shrink-0 ${severityClass[ins.severity] || severityClass.info}`}>
            {ins.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </span>
          <span className="text-gm-text-secondary truncate">{ins.message || '—'}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyTrendsChart({ history, insights }: { history: Array<{ date: string; facts?: number; questions?: number; risks?: number; actions?: number }> | undefined; insights?: TrendInsight[] }) {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.map(entry => ({
      day: entry.date ? new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short' }) : '—',
      facts: entry.facts ?? 0,
      questions: entry.questions ?? 0,
      risks: entry.risks ?? 0,
      actions: entry.actions ?? 0,
    }));
  }, [history]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Weekly Activity</h3>
        <div className="flex items-center justify-center h-48 text-sm text-gm-text-tertiary">No trend data yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-2">Weekly Activity</h3>
      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(trendBarColors).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gm-text-tertiary">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span className="capitalize">{key}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={1} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gm-border-primary)" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--gm-text-tertiary)' }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gm-text-tertiary)' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--gm-surface-primary)',
              border: '1px solid var(--gm-border-primary)',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="facts" fill={trendBarColors.facts} radius={[2, 2, 0, 0]} />
          <Bar dataKey="questions" fill={trendBarColors.questions} radius={[2, 2, 0, 0]} />
          <Bar dataKey="risks" fill={trendBarColors.risks} radius={[2, 2, 0, 0]} />
          <Bar dataKey="actions" fill={trendBarColors.actions} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <TrendInsightsBar insights={insights || []} />
    </div>
  );
}

// ── Question Aging Breakdown ────────────────────────────────────────────────

const agingColors: Record<string, string> = {
  fresh: '#10b981',
  aging: '#f59e0b',
  stale: '#f97316',
  critical: '#ef4444',
};

function QuestionAgingChart({ aging }: { aging: { fresh?: number; aging?: number; stale?: number; critical?: number } | undefined }) {
  if (!aging) return null;
  const entries = [
    { key: 'fresh', label: 'Fresh', count: aging.fresh ?? 0 },
    { key: 'aging', label: 'Aging', count: aging.aging ?? 0 },
    { key: 'stale', label: 'Stale', count: aging.stale ?? 0 },
    { key: 'critical', label: 'Critical', count: aging.critical ?? 0 },
  ];
  const total = entries.reduce((s, e) => s + e.count, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Question Aging</h3>
      <div className="flex h-3 rounded-full overflow-hidden mb-4 bg-gm-surface-hover">
        {entries.map((e) => {
          const pct = total > 0 ? (e.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={e.key}
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: agingColors[e.key] }}
              title={`${e.label}: ${e.count}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {entries.map((e) => (
          <div key={e.key} className="text-center">
            <span className="text-lg font-bold text-gm-text-primary tabular-nums">{e.count}</span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: agingColors[e.key] }} />
              <span className="text-[10px] text-gm-text-tertiary uppercase">{e.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Risks by Impact ─────────────────────────────────────────────────────────

const impactColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

function RisksImpactChart({ risksByImpact }: { risksByImpact: Record<string, number> | undefined }) {
  if (!risksByImpact) return null;
  const order = ['critical', 'high', 'medium', 'low'];
  const data = order.map(k => ({ key: k, count: risksByImpact[k] ?? 0 }));
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Risks by Impact</h3>
      <div className="space-y-3">
        {data.map((d) => {
          const pct = total > 0 ? (d.count / total) * 100 : 0;
          return (
            <div key={d.key} className="grid grid-cols-[70px_1fr_36px] items-center gap-2">
              <span className="text-xs text-gm-text-secondary capitalize">{d.key}</span>
              <div className="h-2.5 bg-gm-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: impactColors[d.key] }}
                />
              </div>
              <span className="text-xs font-semibold text-gm-text-primary text-right tabular-nums">{d.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Questions by Priority ───────────────────────────────────────────────────

const priorityColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
  none: '#94a3b8',
};

function QuestionsPriorityChart({ questionsByPriority }: { questionsByPriority: Record<string, number> | undefined }) {
  if (!questionsByPriority) return null;
  const order = ['critical', 'high', 'medium', 'low', 'none'];
  const data = order.map(k => ({ key: k, count: questionsByPriority[k] ?? 0 })).filter(d => d.count > 0);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Questions by Priority</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="count" stroke="none">
                {data.map((d, i) => <Cell key={i} fill={priorityColors[d.key] || '#94a3b8'} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-gm-text-primary">{total}</span>
            <span className="text-[9px] uppercase text-gm-text-tertiary">Total</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {data.map((d) => (
            <div key={d.key} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: priorityColors[d.key] }} />
              <span className="text-gm-text-secondary capitalize">{d.key}: <span className="font-semibold text-gm-text-primary">{d.count}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Document Processing Progress ────────────────────────────────────────────

function DocProcessingBar({ documents }: { documents: { total?: number; processed?: number; pending?: number } | undefined }) {
  if (!documents || !documents.total || documents.total === 0) return null;
  const processed = documents.processed ?? 0;
  const pending = documents.pending ?? 0;
  const total = documents.total;
  const pct = Math.round((processed / total) * 100);

  if (pending === 0) return null;

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Document Processing</h3>
        <span className="text-xs text-gm-text-secondary tabular-nums">{processed}/{total}</span>
      </div>
      <div className="h-2.5 bg-gm-surface-hover rounded-full overflow-hidden">
        <div
          className="h-full bg-gm-interactive-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gm-text-tertiary">
        <span>{pct}% complete</span>
        <span>{pending} pending</span>
      </div>
    </div>
  );
}

// ── LLM Cost Widget ─────────────────────────────────────────────────────────

function CostWidget({ costs }: { costs: CostsSummary | undefined }) {
  if (!costs) return null;
  const total = costs.total ?? 0;
  const change = costs.percentChange;
  const budget = costs.budgetLimit;
  const budgetPct = costs.budgetUsedPercent;
  const budgetAlert = costs.budgetAlertTriggered;

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-4 w-4 text-gm-text-tertiary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">LLM Costs (Month)</h3>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-2xl font-bold text-gm-text-primary tabular-nums">${total.toFixed(2)}</span>
        {change !== null && change !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium pb-0.5 ${change > 0 ? 'text-gm-status-danger' : change < 0 ? 'text-gm-status-success' : 'text-gm-text-tertiary'}`}>
            {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {budget && budget > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-gm-text-tertiary mb-1">
            <span>Budget: ${budget.toFixed(2)}</span>
            <span className={budgetAlert ? 'text-gm-status-danger font-semibold' : ''}>{budgetPct}% used</span>
          </div>
          <div className="h-1.5 bg-gm-surface-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${budgetAlert ? 'bg-gm-status-danger' : 'bg-gm-interactive-primary'}`}
              style={{ width: `${Math.min(100, budgetPct ?? 0)}%` }}
            />
          </div>
        </div>
      )}
      {costs.byProvider && Object.keys(costs.byProvider).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gm-border-primary space-y-1">
          {Object.entries(costs.byProvider).slice(0, 4).map(([provider, cost]) => (
            <div key={provider} className="flex justify-between text-xs">
              <span className="text-gm-text-secondary capitalize">{provider}</span>
              <span className="text-gm-text-primary tabular-nums font-medium">${(cost as number).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notifications Badge ─────────────────────────────────────────────────────

function NotificationsBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gm-status-info-bg text-gm-status-info text-xs font-semibold">
      <Bell className="w-3.5 h-3.5" />
      {count} unread
    </div>
  );
}

// ── SOT Alerts ──────────────────────────────────────────────────────────────

const alertSeverityColors: Record<string, string> = {
  critical: 'bg-gm-status-danger-bg border-red-500/20 text-gm-status-danger',
  high: 'bg-gm-status-danger-bg border-red-500/20 text-gm-status-danger',
  warning: 'bg-gm-status-warning-bg border-yellow-500/20 text-gm-status-warning',
  medium: 'bg-gm-status-warning-bg border-yellow-500/20 text-gm-status-warning',
  info: 'bg-gm-status-info-bg border-blue-400/20 text-gm-status-info',
  low: 'bg-gm-status-info-bg border-blue-400/20 text-gm-status-info',
};

function SotAlertsSection({ alerts }: { alerts: SotAlert[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="h-5 w-5 text-gm-status-warning" />
        <h3 className="text-sm font-semibold text-gm-text-primary">Alerts</h3>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-gm-status-warning">{alerts.length}</span>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 5).map((alert, i) => {
          const sev = alert.severity?.toLowerCase() || 'info';
          const cls = alertSeverityColors[sev] || alertSeverityColors.info;
          return (
            <div key={i} className={`flex items-start gap-2.5 text-sm px-3 py-2.5 rounded-lg border ${cls}`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gm-text-primary">{alert.message || '(no message)'}</p>
                {alert.entity_type && (
                  <p className="text-[10px] text-gm-text-tertiary mt-0.5 uppercase">{alert.entity_type} {alert.entity_id ? `#${alert.entity_id.slice(0, 8)}` : ''}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Emails Needing Response ─────────────────────────────────────────────────

function EmailsNeedingResponseSection({ emails }: { emails: EmailNeedingResponse[] }) {
  if (!emails || emails.length === 0) return null;
  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-gm-status-warning" />
        <h3 className="text-sm font-semibold text-gm-text-primary">Emails Needing Response</h3>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-gm-status-warning">{emails.length}</span>
      </div>
      <div className="space-y-2">
        {emails.slice(0, 5).map((email) => (
          <div key={email.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--gm-surface-hover)] hover:bg-gm-surface-hover transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-gm-interactive-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gm-text-primary truncate">{email.subject || 'No subject'}</p>
              <p className="text-xs text-gm-text-tertiary mt-0.5">
                {email.from_name || email.from || 'Unknown'}
                {email.received_at && ` · ${new Date(email.received_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sprint Progress ─────────────────────────────────────────────────────────

function SprintWidget({ sprints }: { sprints: Sprint[] }) {
  if (!sprints || sprints.length === 0) return null;

  const active = sprints.find(s => s.status === 'active') || sprints[0];
  if (!active) return null;

  const start = active.start_date ? new Date(active.start_date) : null;
  const end = active.end_date ? new Date(active.end_date) : null;
  const now = new Date();
  let progressPct = 0;
  let daysLeft = 0;

  if (start && end) {
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = now.getTime() - start.getTime();
    progressPct = totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;
    daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-gm-interactive-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Current Sprint</h3>
      </div>
      <p className="text-sm font-semibold text-gm-text-primary mb-1">{active.name || '(unnamed sprint)'}</p>
      {active.goal && (
        <p className="text-xs text-gm-text-secondary mb-3 line-clamp-2">{active.goal}</p>
      )}
      {start && end && (
        <>
          <div className="flex justify-between text-[10px] text-gm-text-tertiary mb-1">
            <span>{start.toLocaleDateString()}</span>
            <span>{daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}</span>
            <span>{end.toLocaleDateString()}</span>
          </div>
          <div className="h-2 bg-gm-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-gm-interactive-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Conflicts Widget ────────────────────────────────────────────────────────

function ConflictsWidget({ conflicts, analyzedFacts }: { conflicts: Conflict[]; analyzedFacts?: number }) {
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-500/20 bg-gm-status-danger-bg p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-gm-status-danger" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">AI Conflicts Detected</h3>
        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-gm-status-danger">{conflicts.length}</span>
      </div>
      {analyzedFacts !== undefined && (
        <p className="text-[10px] text-gm-text-tertiary mb-3">{analyzedFacts} facts analyzed</p>
      )}
      <div className="space-y-2">
        {conflicts.slice(0, 4).map((c, i) => (
          <div key={i} className="p-2.5 rounded-lg bg-gm-bg-secondary border border-[var(--gm-border-primary)] text-xs">
            {c.explanation && <p className="text-gm-text-primary font-medium mb-1">{c.explanation}</p>}
            {c.fact_a && <p className="text-gm-text-secondary truncate">A: {c.fact_a}</p>}
            {c.fact_b && <p className="text-gm-text-secondary truncate">B: {c.fact_b}</p>}
            {c.decision_a && <p className="text-gm-text-secondary truncate">A: {c.decision_a}</p>}
            {c.decision_b && <p className="text-gm-text-secondary truncate">B: {c.decision_b}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Contacts Stats Widget ───────────────────────────────────────────────────

function ContactsStatsWidget({ stats }: { stats: ContactsStats | undefined }) {
  if (!stats || stats.total === 0) return null;
  const topOrgs = stats.byOrganization
    ? Object.entries(stats.byOrganization).sort(([, a], [, b]) => b - a).slice(0, 5)
    : [];

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-gm-text-tertiary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Contacts</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{stats.total}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Total</p>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{stats.teams ?? 0}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Teams</p>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{stats.unmatchedCount ?? 0}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Unmatched</p>
        </div>
      </div>
      {topOrgs.length > 0 && (
        <div className="pt-3 border-t border-gm-border-primary space-y-1">
          {topOrgs.map(([org, count]) => (
            <div key={org} className="flex justify-between text-xs">
              <span className="text-gm-text-secondary truncate mr-2">{org}</span>
              <span className="text-gm-text-primary tabular-nums font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Conversations Stats Widget ──────────────────────────────────────────────

function ConversationsStatsWidget({ stats }: { stats: ConversationsStats | undefined }) {
  if (!stats || stats.total === 0) return null;
  const sources = stats.bySource ? Object.entries(stats.bySource).sort(([, a], [, b]) => b - a) : [];

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-gm-text-tertiary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Conversations</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{stats.total}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Total</p>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{stats.totalMessages ?? 0}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Messages</p>
        </div>
      </div>
      {sources.length > 0 && (
        <div className="pt-3 border-t border-gm-border-primary space-y-1">
          {sources.map(([src, count]) => (
            <div key={src} className="flex justify-between text-xs">
              <span className="text-gm-text-secondary capitalize">{src}</span>
              <span className="text-gm-text-primary tabular-nums font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sync Dashboard Widget ───────────────────────────────────────────────────

function SyncWidget({ sync }: { sync: SyncDashboard | undefined }) {
  if (!sync) return null;
  const summary = sync.summary;
  if (!summary) return null;

  const healthColor = (status?: string) => {
    if (status === 'healthy') return 'text-gm-status-success';
    if (status === 'warning') return 'text-gm-status-warning';
    return 'text-gm-status-danger';
  };

  return (
    <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-gm-text-tertiary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Sync Health</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{summary.totalDeletes ?? 0}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Deletes</p>
        </div>
        <div className="text-center">
          <span className="text-lg font-bold text-gm-text-primary tabular-nums">{summary.totalRestores ?? 0}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase">Restores</p>
        </div>
      </div>
      {sync.health && (
        <div className="pt-3 border-t border-gm-border-primary space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gm-text-secondary">Graph Sync</span>
            <span className={`font-semibold capitalize ${healthColor(sync.health.graphSync)}`}>{sync.health.graphSync}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gm-text-secondary">Performance</span>
            <span className={`font-semibold capitalize ${healthColor(sync.health.performance)}`}>{sync.health.performance}</span>
          </div>
          {summary.graphSyncRate && (
            <div className="flex justify-between text-xs">
              <span className="text-gm-text-secondary">Sync Rate</span>
              <span className="text-gm-text-primary font-medium">{summary.graphSyncRate}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  const raw = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^## (.*$)/gm, '<h4>$1</h4>')
    .replace(/^# (.*$)/gm, '<h3>$1</h3>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.*\S.*)$/gm, '<p>$1</p>');
  return sanitizeHtml(raw);
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashLoading, error: dashError, refetch: refetchDash } = useDashboard();
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useStats();
  const { data: health } = useHealth();
  const { data: trends } = useTrends(7);
  const { data: allActions } = useActions();
  const { data: contactsData } = useContacts();
  const { data: costsData } = useCostsSummary('month');
  const { data: notifData } = useNotificationsCount();
  const { data: sotAlertsData } = useSotAlerts();
  const { data: emailsData } = useEmailsNeedingResponse();
  const { data: sprintsData } = useSprints();
  const { data: conflictsData } = useConflicts();
  const { data: decisionConflictsData } = useDecisionConflicts();
  const runFactCheck = useRunFactCheck();
  const runDecisionCheck = useRunDecisionCheck();
  const { data: contactsStatsData } = useContactsStats();
  const { data: convStatsData } = useConversationsStats();
  const { data: syncData } = useSyncDashboard();
  const { projectId } = useProject();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [briefingRefresh, setBriefingRefresh] = useState(false);

  const allContacts = useMemo<Contact[]>(() => {
    const raw = (contactsData as { contacts?: Array<Record<string, unknown>> })?.contacts;
    if (!raw) return [];
    return raw.map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? 'Unknown'),
      role: String(c.role ?? ''),
      organization: String(c.organization ?? ''),
      email: c.email ? String(c.email) : undefined,
      phone: c.phone ? String(c.phone) : undefined,
      timezone: c.timezone ? String(c.timezone) : undefined,
      avatarUrl: (() => { const v = c.avatarUrl ?? c.avatar ?? c.photo_url; return typeof v === 'string' && v.length > 0 && v !== 'undefined' && v !== 'null' ? v : undefined; })(),
      avatar: c.avatar ? String(c.avatar) : undefined,
      mentionCount: Number(c.mentionCount ?? c.mention_count ?? 0),
    }));
  }, [contactsData]);

  const teamContacts = useMemo<Contact[]>(
    () => allContacts.filter((c) => c.timezone),
    [allContacts],
  );

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="rounded-2xl bg-gm-surface-secondary p-6 mb-6">
          <FolderOpen className="h-12 w-12 text-gm-text-tertiary" />
        </div>
        <h2 className="text-xl font-semibold text-gm-text-primary mb-2">No Project Selected</h2>
        <p className="text-gm-text-secondary mb-6 max-w-sm">
          Select a project from the dropdown in the header, or create a new project to get started.
        </p>
        <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
      </div>
    );
  }

  if (dashLoading || statsLoading) return <DashboardSpinner />;

  if (dashError || statsError) {
    return <ErrorState message="Failed to load dashboard data." onRetry={() => { refetchDash(); refetchStats(); }} />;
  }

  // Resolve counters from either dashboard.stats (legacy) or top-level fields
  const d = dashboard || {};
  const s = (stats as Record<string, unknown>) || {};
  const counters: Record<string, number> = {
    documents: (d.documents?.total ?? d.stats?.documents ?? s.documents ?? 0) as number,
    facts: (d.totalFacts ?? d.stats?.facts ?? s.facts ?? 0) as number,
    questions: (d.totalQuestions ?? d.stats?.questions ?? s.questions ?? 0) as number,
    risks: (d.totalRisks ?? d.stats?.risks ?? s.risks ?? 0) as number,
    actions: (d.totalActions ?? d.stats?.actions ?? s.actions ?? 0) as number,
    decisions: (d.totalDecisions ?? d.stats?.decisions ?? s.decisions ?? 0) as number,
    contacts: (d.totalPeople ?? d.stats?.contacts ?? s.contacts ?? 0) as number,
    overdue: (d.overdueActions ?? 0) as number,
  };

  // Actions by status (prefer dashboard data, fallback to computing from actions list)
  const actionsByStatus: Record<string, number> = d.actionsByStatus
    ? d.actionsByStatus as Record<string, number>
    : allActions
      ? {
          completed: allActions.filter(a => a.status === 'completed').length,
          in_progress: allActions.filter(a => a.status === 'in_progress').length,
          pending: allActions.filter(a => a.status === 'pending').length,
          cancelled: allActions.filter(a => a.status === 'cancelled').length,
        }
      : {};

  const factsByCategory = d.factsByCategory as Record<string, number> | undefined;
  const questionsByPriority = d.questionsByPriority as Record<string, number> | undefined;
  const questionAging = d.questionAging as { fresh?: number; aging?: number; stale?: number; critical?: number } | undefined;
  const risksByImpact = d.risksByImpact as Record<string, number> | undefined;

  const sotAlerts = (sotAlertsData as { alerts?: SotAlert[] })?.alerts ?? [];
  const emailsNeedingResponse = (emailsData as { emails?: EmailNeedingResponse[] })?.emails ?? [];
  const sprints = (sprintsData as { sprints?: Sprint[] })?.sprints ?? [];
  const notifCount = (notifData as { count?: number })?.count ?? 0;
  const costs = costsData as CostsSummary | undefined;
  const conflicts = (conflictsData as { conflicts?: Conflict[]; analyzed_facts?: number })?.conflicts ?? [];
  const analyzedFacts = (conflictsData as { analyzed_facts?: number })?.analyzed_facts;
  const decisionConflicts = ((decisionConflictsData as Record<string, unknown>)?.conflicts || []) as Array<Record<string, unknown>>;
  const allConflicts = [...conflicts, ...decisionConflicts.map(dc => ({ explanation: String(dc.explanation || dc.message || ''), fact_a: '', fact_b: '', decision_a: String(dc.decision_a || dc.a || ''), decision_b: String(dc.decision_b || dc.b || '') }))];
  const contactsStats = contactsStatsData as ContactsStats | undefined;
  const convStats = convStatsData as ConversationsStats | undefined;
  const syncDash = (syncData as { dashboard?: SyncDashboard })?.dashboard;
  const trendInsights = (d.trendInsights as TrendInsight[]) ?? [];

  // Weekly activity — prefer trends API, fallback to dashboard.weeklyActivity
  const weeklyHistory = trends?.history ?? d.weeklyActivity ?? [];

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['health'] });
    queryClient.invalidateQueries({ queryKey: ['trends'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['costsSummary'] });
    queryClient.invalidateQueries({ queryKey: ['notificationsCount'] });
    queryClient.invalidateQueries({ queryKey: ['sotAlerts'] });
    queryClient.invalidateQueries({ queryKey: ['emailsNeedingResponse'] });
    queryClient.invalidateQueries({ queryKey: ['sprints'] });
    queryClient.invalidateQueries({ queryKey: ['conflicts'] });
    queryClient.invalidateQueries({ queryKey: ['contactsStats'] });
    queryClient.invalidateQueries({ queryKey: ['conversationsStats'] });
    queryClient.invalidateQueries({ queryKey: ['syncDashboard'] });
    queryClient.invalidateQueries({ queryKey: ['briefingHistory'] });
    setBriefingRefresh(true);
    setTimeout(() => setBriefingRefresh(false), 500);
  };

  // Build stat card sub-text from extra dashboard data
  function getStatSub(key: string): string {
    if (key === 'documents') return d.documents?.pending ? `+${d.documents.pending} pending` : '';
    if (key === 'facts') return d.factsVerifiedCount ? `${d.factsVerifiedCount} verified` : '';
    if (key === 'questions') {
      const aging = d.questionAging;
      return aging?.critical ? `${aging.critical} critical` : '';
    }
    if (key === 'risks') {
      const impact = d.risksByImpact as Record<string, number> | undefined;
      return impact?.high ? `${impact.high} high` : '';
    }
    if (key === 'overdue') return counters.overdue > 0 ? 'actions' : '';
    return '';
  }

  // Knowledge overview bar chart data
  const knowledgeChartData = [
    { name: 'Facts', count: counters.facts, fill: '#3b82f6' },
    { name: 'Questions', count: counters.questions, fill: '#f59e0b' },
    { name: 'Risks', count: counters.risks, fill: '#ef4444' },
    { name: 'Actions', count: counters.actions, fill: '#8b5cf6' },
    { name: 'Decisions', count: counters.decisions, fill: '#10b981' },
    { name: 'People', count: counters.contacts, fill: '#06b6d4' },
    { name: 'Docs', count: counters.documents, fill: '#6366f1' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gm-text-primary">Dashboard</h1>
          <p className="text-sm text-gm-text-secondary mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationsBadge count={notifCount} />
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Row 1: Health + Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <HealthCard health={health as HealthData | null | undefined} />
        <BriefingCard refresh={briefingRefresh} />
      </div>

      {/* Row 2: Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = counters[card.key] ?? 0;
          const sub = getStatSub(card.key);
          const isOverdue = card.key === 'overdue' && value > 0;
          return (
            <button
              key={card.key}
              onClick={() => navigate(card.route)}
              className="group relative rounded-xl border border-gm-border-primary bg-gm-surface-primary p-4 text-center
                         overflow-hidden transition-all duration-200
                         hover:shadow-gm-md hover:-translate-y-1 hover:border-gm-border-secondary
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gm-border-focus"
            >
              {/* Color top bar */}
              <div className="absolute top-0 left-0 right-0 h-1 transition-all duration-200 group-hover:h-1.5" style={{ backgroundColor: card.color }} />
              <div className="text-2xl mb-1 mt-1">
                <Icon className="h-5 w-5 mx-auto" style={{ color: card.color }} />
              </div>
              <div className="text-xl font-bold text-gm-text-primary tabular-nums">{value}</div>
              <div className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider mt-0.5">{card.label}</div>
              {sub && (
                <div className={`text-[10px] mt-0.5 font-medium ${isOverdue ? 'text-gm-status-danger' : 'text-gm-text-tertiary'}`}>
                  {sub}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 3: Charts — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ActionsDonutChart actionsByStatus={actionsByStatus} />
        <FactsCategoryChart factsByCategory={factsByCategory} />
        <WeeklyTrendsChart history={weeklyHistory as Array<{ date: string; facts?: number; questions?: number; risks?: number; actions?: number }>} insights={trendInsights} />
      </div>

      {/* Row 4: Secondary breakdowns — 3 columns, only renders items with data */}
      {(questionAging || questionsByPriority || risksByImpact || (d.documents?.pending)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {questionAging && <QuestionAgingChart aging={questionAging} />}
          {risksByImpact && <RisksImpactChart risksByImpact={risksByImpact} />}
          {questionsByPriority && <QuestionsPriorityChart questionsByPriority={questionsByPriority} />}
          {d.documents?.pending ? <DocProcessingBar documents={d.documents} /> : null}
        </div>
      )}

      {/* Row 5: Knowledge Overview + Cost + Sprint — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary mb-4">Knowledge Overview</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={knowledgeChartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gm-border-primary)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gm-text-tertiary)' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--gm-text-tertiary)' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--gm-surface-primary)',
                  border: '1px solid var(--gm-border-primary)',
                  borderRadius: '0.5rem',
                  boxShadow: 'var(--shadow-md)',
                  color: 'var(--gm-text-primary)',
                }}
                cursor={{ fill: 'var(--gm-surface-hover)', opacity: 0.5 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {knowledgeChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <CostWidget costs={costs} />
        <SprintWidget sprints={sprints} />
      </div>

      {/* Row 6: Alerts + Emails + Conflicts — 3 columns */}
      {(sotAlerts.length > 0 || emailsNeedingResponse.length > 0 || allConflicts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SotAlertsSection alerts={sotAlerts} />
          <EmailsNeedingResponseSection emails={emailsNeedingResponse} />
          <div>
            <ConflictsWidget conflicts={allConflicts} analyzedFacts={analyzedFacts} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => runFactCheck.mutate(undefined, { onSuccess: () => toast.success('Fact check complete') })}
                disabled={runFactCheck.isPending}
                className="px-2.5 py-1 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-[10px] font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1 transition-colors">
                {runFactCheck.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Fact Check
              </button>
              <button onClick={() => runDecisionCheck.mutate(undefined, { onSuccess: () => toast.success('Decision check complete') })}
                disabled={runDecisionCheck.isPending}
                className="px-2.5 py-1 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-[10px] font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1 transition-colors">
                {runDecisionCheck.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Decision Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 7: Contacts Stats + Conversations Stats + Sync — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ContactsStatsWidget stats={contactsStats} />
        <ConversationsStatsWidget stats={convStats} />
        <SyncWidget sync={syncDash} />
      </div>

      {/* Row 8: Golden Hours — full width */}
      <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-6 shadow-gm-sm">
        <GoldenHours contacts={teamContacts} allContacts={allContacts} />
      </div>

      {/* Row 9: Activity + Overdue — side by side */}
      {(d.recentActivity?.length > 0 || (d.overdueItems as Array<Record<string, unknown>> | undefined)?.length) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {d.recentActivity && d.recentActivity.length > 0 && (
            <div className="rounded-xl border border-gm-border-primary bg-gm-surface-primary p-5 shadow-gm-sm lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-gm-interactive-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Recent Activity</h2>
              </div>
              <ul className="divide-y divide-gm-border-primary">
                {d.recentActivity.slice(0, 8).map((activity: { description: string; timestamp: string }, i: number) => (
                  <li key={i} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 transition-colors hover:bg-gm-surface-hover rounded px-2 -mx-2">
                    <span className="text-sm text-gm-text-primary truncate mr-3">{activity.description || '—'}</span>
                    <span className="text-[10px] text-gm-text-tertiary whitespace-nowrap">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.overdueItems && (d.overdueItems as Array<Record<string, unknown>>).length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-gm-status-warning-bg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-gm-status-warning" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gm-text-tertiary">Overdue</h2>
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gm-status-warning text-white">
                  {(d.overdueItems as Array<Record<string, unknown>>).length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {(d.overdueItems as Array<{ id: string; content?: string; assignee?: string; due_date?: string }>).slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-gm-text-primary truncate mr-2">{item.content || item.id}</span>
                    {item.due_date && (
                      <span className="text-[10px] text-gm-status-danger whitespace-nowrap">
                        {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
