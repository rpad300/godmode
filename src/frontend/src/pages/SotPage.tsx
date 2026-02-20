/**
 * Source of Truth (SOT) page. Provides:
 *   - Overview dashboard: health score, insights, change delta, alerts
 *   - Tabbed CRUD for Questions, Facts, Risks, Actions, Decisions
 *   - Timeline of all project events
 *   - Version history with comparison
 *   - Export (Markdown / HTML / JSON)
 *   - Executive summary generation
 */
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Heart, Lightbulb, AlertTriangle, Clock, History, Download,
  FileText, ChevronRight, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Zap,
  FileJson, Globe, ChevronDown, ChevronUp, Trash2, RotateCw,
} from 'lucide-react';
import { ErrorState } from '../components/shared/ErrorState';
import { SotSkeleton } from '../components/shared/PageSkeleton';
import {
  useQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion,
  useFacts, useCreateFact, useUpdateFact, useDeleteFact,
  useRisks, useCreateRisk, useUpdateRisk, useDeleteRisk,
  useActions, useCreateAction, useUpdateAction, useDeleteAction,
  useDecisions, useCreateDecision, useUpdateDecision, useDeleteDecision,
  useHealth, useSotAlerts, useSotInsights, useSotDelta, useSotTimeline,
  useSotVersions, useSotCompare, useSotGenerateSummary,
  useDeletedFacts, useRestoreFact,
  useDeletedDecisions, useRestoreDecision,
  useDeletedRisks, useRestoreRisk,
  useDeletedActions, useRestoreAction,
} from '../hooks/useGodMode';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { apiClient } from '../lib/api-client';
import QuestionsPanel from '../components/sot/QuestionsPanel';
import FactsPanel from '../components/sot/FactsPanel';
import RisksPanel from '../components/sot/RisksPanel';
import ActionsPanel from '../components/sot/ActionsPanel';
import DecisionsPanel from '../components/sot/DecisionsPanel';
import UserStoriesPanel from '../components/sot/UserStoriesPanel';
import type { Question, Fact, Risk, Action, Decision } from '../types/godmode';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)]';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';

type MainTab = 'overview' | 'entities' | 'timeline' | 'history';
type EntityTab = 'questions' | 'facts' | 'risks' | 'actions' | 'decisions' | 'stories' | 'trash';

function r(v: unknown): Record<string, unknown> { return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; }

export default function SotPage() {
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [entityTab, setEntityTab] = useState<EntityTab>('questions');
  const [compareV1, setCompareV1] = useState<string>('');
  const [compareV2, setCompareV2] = useState<string>('');
  const [expandedInsights, setExpandedInsights] = useState(true);

  // Overview data
  const { data: healthData } = useHealth();
  const { data: alertsData } = useSotAlerts();
  const { data: insightsData } = useSotInsights();
  const { data: deltaData } = useSotDelta();

  // Entities
  const questions = useQuestions();
  const facts = useFacts();
  const risks = useRisks();
  const actions = useActions();
  const decisions = useDecisions();

  // Mutations
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const createFact = useCreateFact();
  const updateFact = useUpdateFact();
  const deleteFact = useDeleteFact();
  const createRisk = useCreateRisk();
  const updateRisk = useUpdateRisk();
  const deleteRisk = useDeleteRisk();
  const createAction = useCreateAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();
  const createDecision = useCreateDecision();
  const updateDecision = useUpdateDecision();
  const deleteDecision = useDeleteDecision();

  // Trash
  const deletedFacts = useDeletedFacts();
  const restoreFact = useRestoreFact();
  const deletedDecisions = useDeletedDecisions();
  const restoreDecision = useRestoreDecision();
  const deletedRisks = useDeletedRisks();
  const restoreRisk = useRestoreRisk();
  const deletedActions = useDeletedActions();
  const restoreAction = useRestoreAction();

  // Timeline
  const { data: timelineData, isLoading: timelineLoading } = useSotTimeline(100);

  // History
  const { data: versionsData } = useSotVersions();
  const compareQuery = useSotCompare(compareV1, compareV2);
  const genSummary = useSotGenerateSummary();

  // Derived
  const health = r(healthData);
  const alerts = ((r(alertsData).alerts ?? []) as Array<Record<string, unknown>>);
  const insights = ((r(insightsData).insights ?? []) as Array<Record<string, unknown>>);
  const delta = r(deltaData);
  const changes = (delta.changes ?? []) as Array<Record<string, unknown>>;
  const timeline = ((r(timelineData).timeline ?? []) as Array<Record<string, unknown>>);
  const versions = ((r(versionsData).versions ?? []) as Array<Record<string, unknown>>);
  const diff = r(compareQuery.data);

  const healthScore = Number(health.score ?? 0);
  const healthColor = healthScore >= 70 ? '#22c55e' : healthScore >= 40 ? '#f59e0b' : '#ef4444';

  const dFacts = ((deletedFacts.data as Record<string, unknown>)?.facts ?? []) as unknown[];
  const dDecs = ((deletedDecisions.data as Record<string, unknown>)?.decisions ?? []) as unknown[];
  const dRisks = ((deletedRisks.data as Record<string, unknown>)?.risks ?? []) as unknown[];
  const dActs = ((deletedActions.data as Record<string, unknown>)?.actions ?? []) as unknown[];
  const trashCount = dFacts.length + dDecs.length + dRisks.length + dActs.length;

  const entityTabs: { key: EntityTab; label: string; count: number }[] = [
    { key: 'questions', label: 'Questions', count: (questions.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'facts', label: 'Facts', count: (facts.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'risks', label: 'Risks', count: (risks.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'actions', label: 'Actions', count: (actions.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'decisions', label: 'Decisions', count: (decisions.data as unknown[] | undefined)?.length ?? 0 },
    { key: 'stories', label: 'User Stories', count: 0 },
    { key: 'trash', label: 'Trash', count: trashCount },
  ];
  const totalEntities = entityTabs.reduce((s, t) => s + t.count, 0);

  const isLoading = questions.isLoading || facts.isLoading || risks.isLoading || actions.isLoading || decisions.isLoading;
  const hasError = questions.isError || facts.isError || risks.isError || actions.isError || decisions.isError;
  const refetchAll = () => { questions.refetch(); facts.refetch(); risks.refetch(); actions.refetch(); decisions.refetch(); };

  function makeSaveHandler(
    serverData: Array<{ id: string }> | undefined,
    createMut: { mutate: (data: Record<string, unknown>) => void },
    updateMut: { mutate: (data: { id: string; [key: string]: unknown }) => void },
  ) {
    return (item: { id: string; [key: string]: unknown }) => {
      const exists = serverData?.some(x => x.id === item.id);
      if (exists) { updateMut.mutate(item); } else { const { id: _clientId, ...data } = item; createMut.mutate(data); }
    };
  }

  const handleExport = async (format: 'markdown' | 'html' | 'json') => {
    try {
      const data = await apiClient.get<string | Record<string, unknown>>(`/api/sot/export/${format}`);
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const mime = format === 'json' ? 'application/json' : 'text/plain';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sot-export.${format === 'markdown' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

  // Timeline grouping by date
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, Array<Record<string, unknown>>> = {};
    for (const ev of timeline) {
      const d = ev.date || ev.created_at || ev.timestamp;
      const day = d ? new Date(d as string).toLocaleDateString() : 'Unknown';
      if (!groups[day]) groups[day] = [];
      groups[day].push(ev);
    }
    return Object.entries(groups);
  }, [timeline]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--gm-text-primary)]">Source of Truth</h1>
          <p className="text-xs text-[var(--gm-text-tertiary)]">{totalEntities} entities · {alerts.length} alerts · Score {healthScore}%</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('markdown')} aria-label="Export as Markdown" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)]">
            <FileText className="w-3 h-3" /> MD
          </button>
          <button onClick={() => handleExport('html')} aria-label="Export as HTML" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)]">
            <Globe className="w-3 h-3" /> HTML
          </button>
          <button onClick={() => handleExport('json')} aria-label="Export as JSON" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)]">
            <FileJson className="w-3 h-3" /> JSON
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className={cn(CARD, 'p-1 flex gap-1')} role="tablist">
        {([
          { key: 'overview' as MainTab, label: 'Overview', icon: Heart },
          { key: 'entities' as MainTab, label: `Entities (${totalEntities})`, icon: FileText },
          { key: 'timeline' as MainTab, label: `Timeline (${timeline.length})`, icon: Clock },
          { key: 'history' as MainTab, label: `History (${versions.length})`, icon: History },
        ]).map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            role="tab" aria-selected={mainTab === t.key}
            className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-lg transition-colors',
              mainTab === t.key ? 'bg-[var(--gm-accent-primary)]/15 text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]')}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {mainTab === 'overview' && (
        <div className="space-y-5">
          {/* Health + Delta Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Health Score */}
            <div className={cn(CARD, 'p-5 flex items-center gap-5')}>
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--gm-bg-tertiary)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={healthColor} strokeWidth="3"
                    strokeDasharray={`${(healthScore / 100) * 97.4} 97.4`} strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums" style={{ color: healthColor }}>{healthScore}</span>
              </div>
              <div>
                <div className={SECTION_TITLE}>Health Score</div>
                <p className="text-xs text-[var(--gm-text-secondary)] mt-1 capitalize">{(health.status || '—') as string}</p>
                {Array.isArray(health.factors) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(health.factors as Array<Record<string, unknown>>).slice(0, 3).map((f, i) => (
                      <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">{(f.name || f.label || f.factor) as string}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Change Delta */}
            <div className={cn(CARD, 'p-5')}>
              <div className={SECTION_TITLE}>Changes Since Last View</div>
              {delta.isFirstView ? (
                <p className="text-xs text-[var(--gm-text-tertiary)] mt-2">First view — no prior snapshot</p>
              ) : changes.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {changes.map((ch, i) => {
                    const change = Number(ch.change ?? 0);
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--gm-text-secondary)] capitalize">{(ch.metric || '—') as string}</span>
                        <span className={cn('flex items-center gap-1 font-medium tabular-nums',
                          change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-[var(--gm-text-tertiary)]')}>
                          {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : change < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {change > 0 ? '+' : ''}{change}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[var(--gm-text-tertiary)] mt-2">No changes since last view</p>
              )}
              {delta.summary && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-2">{delta.summary as string}</p>}
            </div>

            {/* Alerts Summary */}
            <div className={cn(CARD, 'p-5')}>
              <div className={SECTION_TITLE}>Alerts ({alerts.length})</div>
              {alerts.length > 0 ? (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {alerts.slice(0, 8).map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                        a.severity === 'critical' ? 'bg-red-500' : a.severity === 'high' ? 'bg-orange-500' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500')} />
                      <div className="min-w-0">
                        <span className="text-[10px] font-medium text-[var(--gm-text-primary)] block truncate">{(a.title || a.message || '—') as string}</span>
                        {a.message && a.title && <span className="text-[9px] text-[var(--gm-text-tertiary)] block truncate">{a.message as string}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-green-400 mt-2">No active alerts</p>
              )}
            </div>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className={cn(CARD, 'overflow-hidden')}>
              <button onClick={() => setExpandedInsights(!expandedInsights)}
                className="w-full px-5 py-3 flex items-center justify-between border-b border-[var(--gm-border-primary)] hover:bg-[var(--gm-surface-hover)]">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-[var(--gm-accent-primary)]" />
                  <span className={SECTION_TITLE}>Insights ({insights.length})</span>
                </div>
                {expandedInsights ? <ChevronUp className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />}
              </button>
              {expandedInsights && (
                <div className="divide-y divide-[var(--gm-border-primary)]">
                  {insights.map((ins, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-[var(--gm-surface-hover)]">
                      <span className="text-lg shrink-0">{(ins.icon || '💡') as string}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--gm-text-primary)]">{(ins.title || '—') as string}</span>
                          {ins.category && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] capitalize">{ins.category as string}</span>}
                        </div>
                        <p className="text-[10px] text-[var(--gm-text-secondary)] mt-0.5">{(ins.message || '—') as string}</p>
                        {ins.suggestion && <p className="text-[10px] text-[var(--gm-accent-primary)] mt-1">→ {ins.suggestion as string}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Executive Summary */}
          <div className={cn(CARD, 'p-4 flex items-center gap-3')}>
            <button onClick={() => genSummary.mutate(undefined, {
              onSuccess: (d) => {
                const content = (d as Record<string, unknown>)?.content || (d as Record<string, unknown>)?.summary;
                if (content) toast.success('Executive summary generated');
                else toast.info('No summary content returned');
              },
              onError: (e: Error) => toast.error(e.message),
            })} disabled={genSummary.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--gm-accent-primary)] text-white hover:opacity-90 transition-opacity">
              {genSummary.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Generate Executive Summary
            </button>
            <span className="text-[10px] text-[var(--gm-text-tertiary)]">AI-generated summary of health, risks, and key decisions</span>
          </div>
        </div>
      )}

      {/* ── ENTITIES TAB ── */}
      {mainTab === 'entities' && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-[var(--gm-bg-tertiary)] rounded-xl p-1" role="tablist">
            {entityTabs.map((tab) => (
              <button key={tab.key} onClick={() => setEntityTab(tab.key)}
                role="tab" aria-selected={entityTab === tab.key}
                className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative',
                  entityTab === tab.key ? 'bg-[var(--gm-surface-primary)] text-[var(--gm-text-primary)] shadow-sm' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]')}>
                {tab.label}
                <span className="ml-1.5 text-[10px] opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          {hasError ? (
            <ErrorState message="Failed to load Source of Truth data." onRetry={refetchAll} />
          ) : isLoading ? (
            <SotSkeleton />
          ) : (
            <motion.div key={entityTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {entityTab === 'questions' && <QuestionsPanel initialData={(questions.data ?? []) as Question[]} onSave={makeSaveHandler(questions.data as { id: string }[], createQuestion, updateQuestion)} onDelete={(id) => deleteQuestion.mutate(id)} />}
              {entityTab === 'facts' && <FactsPanel initialData={(facts.data ?? []) as Fact[]} onSave={makeSaveHandler(facts.data as { id: string }[], createFact, updateFact)} onDelete={(id) => deleteFact.mutate(id)} />}
              {entityTab === 'risks' && <RisksPanel initialData={(risks.data ?? []) as Risk[]} onSave={makeSaveHandler(risks.data as { id: string }[], createRisk, updateRisk)} onDelete={(id) => deleteRisk.mutate(id)} />}
              {entityTab === 'actions' && <ActionsPanel initialData={(actions.data ?? []) as Action[]} onSave={makeSaveHandler(actions.data as { id: string }[], createAction, updateAction)} onDelete={(id) => deleteAction.mutate(id)} />}
              {entityTab === 'decisions' && <DecisionsPanel initialData={(decisions.data ?? []) as Decision[]} onSave={makeSaveHandler(decisions.data as { id: string }[], createDecision, updateDecision)} onDelete={(id) => deleteDecision.mutate(id)} />}
              {entityTab === 'stories' && <UserStoriesPanel />}
              {entityTab === 'trash' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[var(--gm-text-tertiary)]">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Deleted entities ({trashCount})</span>
                  </div>
                  {trashCount === 0 ? (
                    <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-12">Trash is empty</p>
                  ) : (
                    <div className="space-y-2">
                      {(dFacts as Array<Record<string, unknown>>).map(item => (
                        <div key={String(item.id)} className="flex items-center gap-3 bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3">
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">fact</span>
                          <span className="flex-1 text-sm text-[var(--gm-text-secondary)] truncate">{(item.content || '—') as string}</span>
                          <button onClick={() => { restoreFact.mutate(String(item.id)); toast.success('Fact restored'); }}
                            disabled={restoreFact.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                            <RotateCw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      ))}
                      {(dDecs as Array<Record<string, unknown>>).map(item => (
                        <div key={String(item.id)} className="flex items-center gap-3 bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3">
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">decision</span>
                          <span className="flex-1 text-sm text-[var(--gm-text-secondary)] truncate">{(item.content || '—') as string}</span>
                          <button onClick={() => { restoreDecision.mutate(String(item.id)); toast.success('Decision restored'); }}
                            disabled={restoreDecision.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                            <RotateCw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      ))}
                      {(dRisks as Array<Record<string, unknown>>).map(item => (
                        <div key={String(item.id)} className="flex items-center gap-3 bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3">
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">risk</span>
                          <span className="flex-1 text-sm text-[var(--gm-text-secondary)] truncate">{(item.content || '—') as string}</span>
                          <button onClick={() => { restoreRisk.mutate(String(item.id)); toast.success('Risk restored'); }}
                            disabled={restoreRisk.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                            <RotateCw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      ))}
                      {(dActs as Array<Record<string, unknown>>).map(item => (
                        <div key={String(item.id)} className="flex items-center gap-3 bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3">
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">action</span>
                          <span className="flex-1 text-sm text-[var(--gm-text-secondary)] truncate">{(item.task || item.content || '—') as string}</span>
                          <button onClick={() => { restoreAction.mutate(String(item.id)); toast.success('Action restored'); }}
                            disabled={restoreAction.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                            <RotateCw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* ── TIMELINE TAB ── */}
      {mainTab === 'timeline' && (
        <div className="space-y-4">
          {timelineLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-[var(--gm-accent-primary)]" /></div>
          ) : groupedTimeline.length > 0 ? (
            <div className="space-y-6">
              {groupedTimeline.map(([day, events]) => (
                <div key={day}>
                  <div className="sticky top-0 z-10 py-1.5 px-3 bg-[var(--gm-bg-primary)]">
                    <span className="text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-wider">{day}</span>
                  </div>
                  <div className="relative ml-4 border-l-2 border-[var(--gm-border-primary)] space-y-0">
                    {events.map((ev, i) => {
                      const type = (ev.type || ev.entity_type || 'event') as string;
                      const typeColors: Record<string, string> = {
                        decision: 'bg-purple-500', risk: 'bg-red-500', action: 'bg-amber-500', fact: 'bg-blue-500',
                        question: 'bg-cyan-500', document: 'bg-green-500', email: 'bg-pink-500', conversation: 'bg-indigo-500',
                      };
                      const time = ev.date || ev.created_at || ev.timestamp;
                      return (
                        <div key={i} className="relative pl-6 py-2.5 hover:bg-[var(--gm-surface-hover)] transition-colors rounded-r-lg">
                          <span className={cn('absolute left-[-5px] top-3.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--gm-bg-primary)]', typeColors[type] || 'bg-gray-500')} />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-medium capitalize border',
                                  type === 'risk' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                  type === 'decision' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                                  type === 'action' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                  'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>{type}</span>
                                <span className="text-xs font-medium text-[var(--gm-text-primary)] truncate">{(ev.title || ev.content || ev.name || '—') as string}</span>
                              </div>
                              {ev.description && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5 truncate">{(ev.description || ev.content) as string}</p>}
                            </div>
                            <span className="text-[9px] text-[var(--gm-text-tertiary)] tabular-nums shrink-0 mt-0.5">
                              {time ? new Date(time as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn(CARD, 'p-8 text-center')}>
              <Clock className="w-8 h-8 text-[var(--gm-text-tertiary)] mx-auto mb-2" />
              <p className="text-sm text-[var(--gm-text-tertiary)]">No timeline events yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {mainTab === 'history' && (
        <div className="space-y-5">
          {/* Version List */}
          {versions.length > 0 ? (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)] flex items-center justify-between">
                <span className={SECTION_TITLE}>Version History</span>
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">{versions.length} snapshots</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[var(--gm-border-primary)]">
                {versions.map((v, i) => (
                  <div key={i} className="px-5 py-3 flex items-center hover:bg-[var(--gm-surface-hover)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--gm-accent-primary)] tabular-nums">v{(v.version_number || i + 1) as number}</span>
                        <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">
                          {v.created_at ? new Date(v.created_at as string).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[9px] text-[var(--gm-text-tertiary)]">
                        {v.facts_count != null && <span>{v.facts_count as number} facts</span>}
                        {v.decisions_count != null && <span>{v.decisions_count as number} decisions</span>}
                        {v.risks_count != null && <span>{v.risks_count as number} risks</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setCompareV1(String(v.version_number ?? v.id))}
                        className={cn('text-[9px] px-2 py-1 rounded border', compareV1 === String(v.version_number ?? v.id) ? 'bg-[var(--gm-accent-primary)]/15 border-[var(--gm-accent-primary)]/40 text-[var(--gm-accent-primary)]' : 'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>
                        V1
                      </button>
                      <button onClick={() => setCompareV2(String(v.version_number ?? v.id))}
                        className={cn('text-[9px] px-2 py-1 rounded border', compareV2 === String(v.version_number ?? v.id) ? 'bg-[var(--gm-accent-primary)]/15 border-[var(--gm-accent-primary)]/40 text-[var(--gm-accent-primary)]' : 'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>
                        V2
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={cn(CARD, 'p-8 text-center')}>
              <History className="w-8 h-8 text-[var(--gm-text-tertiary)] mx-auto mb-2" />
              <p className="text-sm text-[var(--gm-text-tertiary)]">No version history yet</p>
            </div>
          )}

          {/* Compare */}
          {compareV1 && compareV2 && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <div className="flex items-center justify-between">
                <span className={SECTION_TITLE}>Compare v{compareV1} ↔ v{compareV2}</span>
                {compareQuery.isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--gm-accent-primary)]" />}
              </div>
              {diff.ok ? (
                <pre className="text-[10px] text-[var(--gm-text-secondary)] font-mono bg-[var(--gm-bg-tertiary)] p-3 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
                  {JSON.stringify(diff, null, 2)}
                </pre>
              ) : compareQuery.isError ? (
                <p className="text-xs text-red-400">Failed to compare versions</p>
              ) : !compareQuery.isFetching ? (
                <p className="text-xs text-[var(--gm-text-tertiary)]">Select V1 and V2 to compare</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
