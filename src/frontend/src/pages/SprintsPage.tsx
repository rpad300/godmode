/**
 * Sprint management page. Provides:
 *   - Sprint list with status overview
 *   - Sprint creation form
 *   - AI-powered task generation and application
 *   - Sprint reports (analysis, business summary, document, presentation)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, Calendar, Zap, FileText, Presentation,
  ChevronRight, ArrowLeft, CheckCircle, Circle, Clock, Target,
} from 'lucide-react';
import {
  useSprints, useCreateSprint, useSprint,
  useSprintGenerateTasks, useSprintApplyTasks,
  useSprintReport, useSprintReportAnalyze,
  useSprintReportDocument, useSprintReportPresentation,
} from '../hooks/useGodMode';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ErrorState } from '../components/shared/ErrorState';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)]';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-accent-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] disabled:opacity-50';
const INPUT = 'bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';

function r(v: unknown): Record<string, unknown> { return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; }

function CreateSprintForm({ onCreated }: { onCreated: () => void }) {
  const createSprint = useCreateSprint();
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', context: '', goals: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error('Name, start date, and end date are required');
      return;
    }
    createSprint.mutate({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      context: form.context || undefined,
      goals: form.goals ? form.goals.split('\n').filter(g => g.trim()) : undefined,
    }, {
      onSuccess: () => {
        toast.success('Sprint created');
        setForm({ name: '', start_date: '', end_date: '', context: '', goals: '' });
        onCreated();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn(CARD, 'p-5 space-y-4')}>
      <h3 className={SECTION_TITLE}>New Sprint</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-medium text-[var(--gm-text-tertiary)] mb-1">Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={cn(INPUT, 'w-full')} placeholder="Sprint 1" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--gm-text-tertiary)] mb-1">Start Date *</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--gm-text-tertiary)] mb-1">End Date *</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-[var(--gm-text-tertiary)] mb-1">Context (optional)</label>
        <input value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} className={cn(INPUT, 'w-full')} placeholder="Focus areas, constraints..." />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-[var(--gm-text-tertiary)] mb-1">Goals (one per line, optional)</label>
        <textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} rows={3} className={cn(INPUT, 'w-full resize-none')} placeholder="Complete feature X\nFix bug Y\nDeploy to production" />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={createSprint.isPending} className={BTN_PRIMARY}>
          {createSprint.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Create Sprint
        </button>
      </div>
    </form>
  );
}

function SprintDetail({ sprintId, onBack }: { sprintId: string; onBack: () => void }) {
  const { data: sprintData, isLoading } = useSprint(sprintId);
  const { data: reportData } = useSprintReport(sprintId);
  const generateTasks = useSprintGenerateTasks();
  const applyTasks = useSprintApplyTasks();
  const analyzeReport = useSprintReportAnalyze();
  const generateDoc = useSprintReportDocument();
  const generatePres = useSprintReportPresentation();

  const [generatedTasks, setGeneratedTasks] = useState<Array<Record<string, unknown>>>([]);
  const [analysisResult, setAnalysisResult] = useState<string>('');

  const sprint = r((sprintData as Record<string, unknown>)?.sprint ?? sprintData);
  const report = r(reportData);
  const reportTasks = (report.tasks ?? []) as Array<Record<string, unknown>>;

  const handleGenerateTasks = () => {
    generateTasks.mutate(sprintId, {
      onSuccess: (d) => {
        const tasks = (d as Record<string, unknown>)?.tasks as Array<Record<string, unknown>> ?? [];
        setGeneratedTasks(tasks);
        toast.success(`Generated ${tasks.length} tasks`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleApplyTasks = () => {
    if (generatedTasks.length === 0) { toast.error('Generate tasks first'); return; }
    applyTasks.mutate({ sprintId, tasks: generatedTasks }, {
      onSuccess: () => { toast.success('Tasks applied to sprint'); setGeneratedTasks([]); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleAnalyze = () => {
    analyzeReport.mutate(sprintId, {
      onSuccess: (d) => {
        const analysis = (d as Record<string, unknown>)?.analysis as string ?? '';
        setAnalysisResult(analysis);
        toast.success('Analysis complete');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleExportDoc = () => {
    generateDoc.mutate({ sprintId }, {
      onSuccess: (d) => {
        const html = (d as Record<string, unknown>)?.html as string ?? '';
        if (html) {
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `sprint-${sprintId}-report.html`; a.click();
          URL.revokeObjectURL(url);
          toast.success('Document downloaded');
        }
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleExportPres = () => {
    generatePres.mutate(sprintId, {
      onSuccess: (d) => {
        const html = (d as Record<string, unknown>)?.html as string ?? '';
        if (html) {
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `sprint-${sprintId}-presentation.html`; a.click();
          URL.revokeObjectURL(url);
          toast.success('Presentation downloaded');
        }
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>;

  const statusColor = (s: string) =>
    s === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
    s === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
    'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border-[var(--gm-border-primary)]';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[var(--gm-interactive-secondary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]">
          <ArrowLeft className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{(sprint.name || 'Sprint') as string}</h2>
          <p className="text-xs text-[var(--gm-text-tertiary)]">
            {sprint.start_date ? new Date(sprint.start_date as string).toLocaleDateString() : '?'} — {sprint.end_date ? new Date(sprint.end_date as string).toLocaleDateString() : '?'}
          </p>
        </div>
        <span className={cn('text-[10px] font-medium px-2.5 py-1 rounded-full border capitalize', statusColor((sprint.status || 'planned') as string))}>
          {(sprint.status || 'planned') as string}
        </span>
      </div>

      {/* Goals */}
      {Array.isArray(sprint.goals) && (sprint.goals as string[]).length > 0 && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className={SECTION_TITLE}>Goals</h3>
          <ul className="mt-2 space-y-1.5">
            {(sprint.goals as string[]).map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--gm-text-secondary)]">
                <Target className="w-3.5 h-3.5 text-[var(--gm-accent-primary)] mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions Row */}
      <div className="flex flex-wrap gap-2">
        <button onClick={handleGenerateTasks} disabled={generateTasks.isPending} className={BTN_PRIMARY}>
          {generateTasks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Generate Tasks (AI)
        </button>
        {generatedTasks.length > 0 && (
          <button onClick={handleApplyTasks} disabled={applyTasks.isPending} className={BTN_PRIMARY}>
            {applyTasks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Apply {generatedTasks.length} Tasks
          </button>
        )}
        <button onClick={handleAnalyze} disabled={analyzeReport.isPending} className={BTN_SECONDARY}>
          {analyzeReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          AI Analysis
        </button>
        <button onClick={handleExportDoc} disabled={generateDoc.isPending} className={BTN_SECONDARY}>
          {generateDoc.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          Export Document
        </button>
        <button onClick={handleExportPres} disabled={generatePres.isPending} className={BTN_SECONDARY}>
          {generatePres.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
          Export Presentation
        </button>
      </div>

      {/* Generated Tasks Preview */}
      {generatedTasks.length > 0 && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className={SECTION_TITLE}>Generated Tasks (Preview)</h3>
          <div className="mt-2 space-y-2">
            {generatedTasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--gm-bg-tertiary)]">
                <Circle className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-[var(--gm-text-primary)]">{(t.title || t.task || t.name || '—') as string}</span>
                  {t.description && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5">{t.description as string}</p>}
                </div>
                {t.priority && <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)] capitalize shrink-0">{t.priority as string}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {analysisResult && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className={SECTION_TITLE}>AI Analysis</h3>
          <div className="mt-2 prose prose-sm dark:prose-invert max-w-none text-[var(--gm-text-secondary)] whitespace-pre-wrap text-xs">
            {analysisResult}
          </div>
        </div>
      )}

      {/* Existing Tasks from Report */}
      {reportTasks.length > 0 && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className={SECTION_TITLE}>Sprint Tasks ({reportTasks.length})</h3>
          <div className="mt-2 space-y-1.5">
            {reportTasks.map((t, i) => {
              const status = (t.status || 'pending') as string;
              const done = status === 'completed' || status === 'done';
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--gm-surface-hover)]">
                  {done ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)] shrink-0" />}
                  <span className={cn('text-xs flex-1', done ? 'line-through text-[var(--gm-text-tertiary)]' : 'text-[var(--gm-text-primary)]')}>
                    {(t.title || t.task || t.name || '—') as string}
                  </span>
                  <span className="text-[9px] text-[var(--gm-text-tertiary)] capitalize">{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SprintsPage() {
  const sprintsQuery = useSprints();
  const { data: sprintsData, isLoading } = sprintsQuery;
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const sprints = ((sprintsData as Record<string, unknown>)?.sprints ?? (Array.isArray(sprintsData) ? sprintsData : [])) as Array<Record<string, unknown>>;

  if (selectedSprint) {
    return (
      <div className="p-6">
        <SprintDetail sprintId={selectedSprint} onBack={() => setSelectedSprint(null)} />
      </div>
    );
  }

  const statusIcon = (s: string) =>
    s === 'active' ? <Clock className="w-3.5 h-3.5 text-green-400" /> :
    s === 'completed' ? <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> :
    <Circle className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--gm-text-primary)]">Sprints</h1>
          <p className="text-xs text-[var(--gm-text-tertiary)]">{sprints.length} sprints</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> New Sprint
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <CreateSprintForm onCreated={() => setShowCreate(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {sprintsQuery.error ? (
        <ErrorState message="Failed to load sprints." onRetry={() => sprintsQuery.refetch()} />
      ) : isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : sprints.length === 0 ? (
        <div className={cn(CARD, 'p-12 text-center')}>
          <Calendar className="w-10 h-10 mx-auto text-[var(--gm-text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--gm-text-tertiary)]">No sprints yet. Create your first sprint to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map(s => {
            const status = (s.status || 'planned') as string;
            return (
              <motion.div
                key={String(s.id)}
                layout
                className={cn(CARD, 'p-4 hover:border-[var(--gm-accent-primary)]/30 transition-colors cursor-pointer')}
                onClick={() => setSelectedSprint(String(s.id))}
              >
                <div className="flex items-center gap-3">
                  {statusIcon(status)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--gm-text-primary)]">{(s.name || 'Unnamed Sprint') as string}</h3>
                    <p className="text-[10px] text-[var(--gm-text-tertiary)]">
                      {s.start_date ? new Date(s.start_date as string).toLocaleDateString() : '?'} — {s.end_date ? new Date(s.end_date as string).toLocaleDateString() : '?'}
                      {s.context && <span className="ml-2">· {(s.context as string).substring(0, 60)}{(s.context as string).length > 60 ? '...' : ''}</span>}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-medium px-2.5 py-1 rounded-full border capitalize',
                    status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border-[var(--gm-border-primary)]'
                  )}>{status}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
                </div>
                {Array.isArray(s.goals) && (s.goals as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                    {(s.goals as string[]).slice(0, 3).map((g, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">{g}</span>
                    ))}
                    {(s.goals as string[]).length > 3 && <span className="text-[9px] text-[var(--gm-text-tertiary)]">+{(s.goals as string[]).length - 3} more</span>}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
