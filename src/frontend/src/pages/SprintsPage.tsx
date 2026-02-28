import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, Calendar, Zap, FileBarChart, ChevronRight,
  ArrowLeft, CheckCircle, Circle, Clock, Target, Trash2,
  Edit3, Play, Square, Sparkles, AlertTriangle, X,
  Copy, LayoutGrid, GanttChartSquare, Activity, Users, MessageSquare, BarChart3,
  PlusCircle, Unlink, FileText, Presentation, Building2, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { ErrorState } from '../components/shared/ErrorState';
import OwnerBadge from '../components/sot/OwnerBadge';
import BreakdownChart from '../components/sprints/BreakdownChart';
import BurndownChart from '../components/sprints/BurndownChart';
import VelocityChart from '../components/sprints/VelocityChart';
import HealthScoreWidget from '../components/sprints/HealthScoreWidget';
import KanbanBoard from '../components/sprints/KanbanBoard';
import GanttChart from '../components/sprints/GanttChart';
import RetrospectivePanel from '../components/sprints/RetrospectivePanel';
import StandupPanel from '../components/sprints/StandupPanel';
import CapacityPanel from '../components/sprints/CapacityPanel';
import EstimatePointsButton from '../components/sprints/EstimatePointsButton';
import {
  CARD, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, INPUT, SECTION_TITLE,
} from '../components/sprints/styles';
import type { Sprint, Action, ProposedTask, SprintReport, SprintGenerateResult } from '../types/godmode';
import {
  useSprints,
  useCreateSprint,
  useUpdateSprint,
  useDeleteSprint,
  useSprintStatusTransition,
  useSprint,
  useSprintGenerateTasks,
  useSprintApplyTasks,
  useSprintReport,
  useSprintReportAnalyze,
  useSprintBusinessReport,
  useSprintVelocity,
  useSprintHealth,
  useSprintClone,
  useUpdateAction,
  useCreateAction,
  useSprintReportDocument,
  useSprintReportPresentation,
  useDocuments,
  useUpdateDocument,
  type DocumentItem,
} from '../hooks/useGodMode';

const STYLE_OPTIONS = [
  { key: 'sprint_report_style_corporate_classic', label: 'Corporate Classic' },
  { key: 'sprint_report_style_modern_minimal', label: 'Modern Minimal' },
  { key: 'sprint_report_style_startup_tech', label: 'Startup Tech' },
  { key: 'sprint_report_style_consultancy', label: 'Consultancy' },
];

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openHtmlForPdf(html: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => win.print(), 600);
    });
  }
}

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: typeof Circle }> = {
  planning: { color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--surface-secondary)]', border: 'border-[var(--border-secondary)]', icon: Circle },
  active: { color: 'text-[var(--status-success)]', bg: 'bg-[var(--status-success-bg)]', border: 'border-[var(--status-success)]/30', icon: Clock },
  completed: { color: 'text-[var(--status-info)]', bg: 'bg-[var(--status-info-bg)]', border: 'border-[var(--status-info)]/30', icon: CheckCircle },
};

const taskStatusDot = (s: string) =>
  s === 'completed' ? 'bg-[var(--status-success)]' :
  s === 'in_progress' ? 'bg-[var(--status-info)]' :
  s === 'overdue' ? 'bg-[var(--status-danger)]' : 'bg-[var(--text-tertiary)]';

function normalizeSprint(raw: any): Sprint {
  return {
    id: raw.id,
    name: raw.name || '',
    start_date: raw.start_date || raw.startDate || '',
    end_date: raw.end_date || raw.endDate || '',
    context: raw.context || '',
    goals: raw.goals || [],
    status: raw.status || 'planning',
    analysis_start_date: raw.analysis_start_date || '',
    analysis_end_date: raw.analysis_end_date || '',
    project_id: raw.project_id || '',
    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',
  };
}

function CreateSprintForm({ onCreated }: { onCreated: () => void }) {
  const createSprint = useCreateSprint();
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', context: '', goals: '', analysis_start_date: '', analysis_end_date: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error('Name, start date and end date are required');
      return;
    }
    createSprint.mutate({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      context: form.context || undefined,
      goals: form.goals ? form.goals.split('\n').filter(g => g.trim()) : undefined,
      analysis_start_date: form.analysis_start_date || undefined,
      analysis_end_date: form.analysis_end_date || undefined,
    }, {
      onSuccess: () => {
        toast.success('Sprint created');
        setForm({ name: '', start_date: '', end_date: '', context: '', goals: '', analysis_start_date: '', analysis_end_date: '' });
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
          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={cn(INPUT, 'w-full')} placeholder="Sprint 1" required />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">Start Date *</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={cn(INPUT, 'w-full')} required />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">End Date *</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={cn(INPUT, 'w-full')} required />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">Context</label>
        <input value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} className={cn(INPUT, 'w-full')} placeholder="Focus areas, constraints..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">Goals (one per line)</label>
          <textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} rows={3} className={cn(INPUT, 'w-full resize-none')} placeholder="Complete feature X&#10;Fix bug Y" />
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">Analysis Start Date</label>
            <input type="date" value={form.analysis_start_date} onChange={e => setForm(f => ({ ...f, analysis_start_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">Analysis End Date</label>
            <input type="date" value={form.analysis_end_date} onChange={e => setForm(f => ({ ...f, analysis_end_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
          </div>
        </div>
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

type DetailTab = 'overview' | 'kanban' | 'timeline' | 'burndown' | 'standup' | 'retro' | 'capacity' | 'documents' | 'report';

const DETAIL_TABS: { id: DetailTab; label: string; icon: typeof Circle }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'burndown', label: 'Burndown', icon: Activity },
  { id: 'standup', label: 'Standup', icon: MessageSquare },
  { id: 'capacity', label: 'Capacity', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'retro', label: 'Retro', icon: Target },
  { id: 'report', label: 'Report & Export', icon: FileBarChart },
];

function SprintDocumentsPanel({ sprintId }: { sprintId: string }) {
  const docs = useDocuments({ sprint_id: sprintId, limit: 100 });
  const updateDoc = useUpdateDocument();
  const docList: DocumentItem[] = docs.data?.documents ?? [];

  if (docs.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" /></div>;
  }

  if (docList.length === 0) {
    return (
      <div className={CARD + ' p-8 text-center'}>
        <FileText className="w-10 h-10 mx-auto mb-3 text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">No documents associated with this sprint.</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Import files from Krisp or assign existing documents to this sprint in the Files page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[var(--text-tertiary)]">{docList.length} document(s) in this sprint</p>
      </div>
      {docList.map(doc => {
        const d = doc as Record<string, unknown>;
        const fileSize = d.file_size as number | undefined;
        return (
          <div key={doc.id} className={CARD + ' p-3 flex items-center gap-3'}>
            <FileText className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{doc.original_filename || doc.filename}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {doc.type && <span className="text-[10px] text-[var(--text-tertiary)] capitalize">{doc.type}</span>}
                {doc.created_at && <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(doc.created_at).toLocaleDateString()}</span>}
                {fileSize && <span className="text-[10px] text-[var(--text-tertiary)]">{(fileSize / 1024).toFixed(1)} KB</span>}
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              doc.status === 'processed' || doc.status === 'completed' ? 'bg-green-500/10 text-green-400' :
              doc.status === 'processing' ? 'bg-blue-500/10 text-blue-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>{doc.status || '—'}</span>
            <button
              onClick={() => updateDoc.mutate({ id: doc.id, sprint_id: null }, {
                onSuccess: () => toast.success('Removed from sprint'),
              })}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
              title="Remove from sprint"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SprintDetail({ sprintId, onBack }: { sprintId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: sprintRaw, isLoading } = useSprint(sprintId);
  const { data: reportRaw, isLoading: reportLoading, error: reportError } = useSprintReport(sprintId);
  const { data: velocityRaw, error: velocityError } = useSprintVelocity(sprintId);
  const { data: healthRaw, isLoading: healthLoading, error: healthError } = useSprintHealth(sprintId);
  const generateTasks = useSprintGenerateTasks();
  const applyTasks = useSprintApplyTasks();
  const analyzeMut = useSprintReportAnalyze();
  const businessMut = useSprintBusinessReport();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();
  const transitionStatus = useSprintStatusTransition();
  const cloneSprint = useSprintClone();
  const updateAction = useUpdateAction();
  const createAction = useCreateAction();

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ task: '', owner: '', priority: 'medium' });
  const [generatedResult, setGeneratedResult] = useState<SprintGenerateResult | null>(null);
  const [selectedNewTasks, setSelectedNewTasks] = useState<Set<number>>(new Set());
  const [selectedExisting, setSelectedExisting] = useState<Set<string>>(new Set());
  const [analysisText, setAnalysisText] = useState('');
  const [businessText, setBusinessText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', context: '', goals: '', start_date: '', end_date: '', analysis_start_date: '', analysis_end_date: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const docMut = useSprintReportDocument();
  const presMut = useSprintReportPresentation();
  const [includeAnalysis, setIncludeAnalysis] = useState(true);
  const [includeBusiness, setIncludeBusiness] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState('sprint_report_style_corporate_classic');
  const [lastDocHtml, setLastDocHtml] = useState<string | null>(null);
  const [lastPresHtml, setLastPresHtml] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab('overview');
    setAnalysisText('');
    setBusinessText('');
    setEditing(false);
    setConfirmDelete(false);
    setIncludeAnalysis(true);
    setIncludeBusiness(true);
    setSelectedStyle('sprint_report_style_corporate_classic');
    setLastDocHtml(null);
    setLastPresHtml(null);
    setGeneratedResult(null);
    setShowAddTask(false);
  }, [sprintId]);

  const sprint = useMemo<Sprint>(() => {
    const d = (sprintRaw as any)?.sprint ?? sprintRaw;
    return d ? normalizeSprint(d) : { id: sprintId, name: '', start_date: '', end_date: '', status: 'planning' as const };
  }, [sprintRaw, sprintId]);

  const report = reportRaw as SprintReport | undefined;
  const actions = (report?.actions ?? []) as Action[];
  const breakdown = report?.breakdown ?? { by_status: {}, by_assignee: {} };
  const totalTasks = report?.total_tasks ?? actions.length;
  const graphContext = (report as any)?.graph_context as { sprint_name?: string; sprint_context?: string; assignees?: string[] } | null;
  const completedTasks = report?.completed_tasks ?? actions.filter(a => a.status === 'completed').length;
  const totalPoints = report?.total_task_points ?? 0;
  const completedPoints = report?.completed_task_points ?? 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const groupedActions = useMemo(() => {
    const groups: Record<string, Action[]> = {};
    actions.forEach(a => {
      const s = a.status || 'pending';
      if (!groups[s]) groups[s] = [];
      groups[s].push(a);
    });
    return groups;
  }, [actions]);

  const startEdit = useCallback(() => {
    setEditForm({
      name: sprint.name,
      context: sprint.context || '',
      goals: (sprint.goals || []).join('\n'),
      start_date: sprint.start_date?.slice(0, 10) || '',
      end_date: sprint.end_date?.slice(0, 10) || '',
      analysis_start_date: sprint.analysis_start_date?.slice(0, 10) || '',
      analysis_end_date: sprint.analysis_end_date?.slice(0, 10) || '',
    });
    setEditing(true);
  }, [sprint]);

  const saveEdit = () => {
    updateSprint.mutate({
      id: sprint.id,
      name: editForm.name,
      context: editForm.context || undefined,
      goals: editForm.goals ? editForm.goals.split('\n').filter(g => g.trim()) : [],
      start_date: editForm.start_date || undefined,
      end_date: editForm.end_date || undefined,
      analysis_start_date: editForm.analysis_start_date || undefined,
      analysis_end_date: editForm.analysis_end_date || undefined,
    } as any, {
      onSuccess: () => { toast.success('Sprint updated'); setEditing(false); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleDelete = () => {
    deleteSprint.mutate(sprint.id, {
      onSuccess: () => { toast.success('Sprint deleted'); onBack(); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleTransition = (status: 'planning' | 'active' | 'completed') => {
    transitionStatus.mutate({ sprintId: sprint.id, status }, {
      onSuccess: () => toast.success(`Sprint marked as ${status}`),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleGenerate = () => {
    generateTasks.mutate(sprintId, {
      onSuccess: (d: any) => {
        const result: SprintGenerateResult = {
          proposed_new_tasks: d?.proposed_new_tasks ?? [],
          existing_action_ids: d?.existing_action_ids ?? [],
          existing_details: d?.existing_details ?? [],
        };
        setGeneratedResult(result);
        const allNew = new Set<number>();
        result.proposed_new_tasks.forEach((_, i) => allNew.add(i));
        setSelectedNewTasks(allNew);
        const allExisting = new Set<string>(result.existing_action_ids);
        setSelectedExisting(allExisting);
        toast.success(`Generated ${result.proposed_new_tasks.length} new tasks, found ${result.existing_action_ids.length} existing`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleApply = () => {
    if (!generatedResult) return;
    const newTasks = generatedResult.proposed_new_tasks.filter((_, i) => selectedNewTasks.has(i));
    const existingIds = generatedResult.existing_action_ids.filter(id => selectedExisting.has(id));
    applyTasks.mutate({ sprintId, new_tasks: newTasks, existing_action_ids: existingIds }, {
      onSuccess: (d: any) => {
        toast.success(`Created ${d?.created ?? 0} tasks, linked ${d?.linked ?? 0} existing`);
        setGeneratedResult(null);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleAnalyze = () => {
    analyzeMut.mutate(sprintId, {
      onSuccess: (d: any) => { setAnalysisText(d?.ai_analysis || d?.analysis || ''); toast.success('Analysis complete'); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleBusiness = () => {
    businessMut.mutate(sprintId, {
      onSuccess: (d: any) => { setBusinessText(d?.business_report || d?.summary || ''); toast.success('Business report ready'); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleExportDoc = () => {
    docMut.mutate({ sprintId: sprint.id, style: selectedStyle, include_analysis: includeAnalysis, include_business: includeBusiness }, {
      onSuccess: (d: any) => {
        if (d?.html) {
          setLastDocHtml(d.html);
          downloadHtml(d.html, `sprint-${sprint.name || sprint.id}-report.html`);
          toast.success('Document downloaded');
        }
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleExportPres = () => {
    presMut.mutate({ sprintId: sprint.id, include_analysis: includeAnalysis, include_business: includeBusiness }, {
      onSuccess: (d: any) => {
        if (d?.html) {
          setLastPresHtml(d.html);
          downloadHtml(d.html, `sprint-${sprint.name || sprint.id}-presentation.html`);
          toast.success('Presentation downloaded');
        }
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleOpenDocForPdf = () => {
    if (lastDocHtml) {
      openHtmlForPdf(lastDocHtml);
    } else {
      docMut.mutate({ sprintId: sprint.id, style: selectedStyle, include_analysis: includeAnalysis, include_business: includeBusiness }, {
        onSuccess: (d: any) => {
          if (d?.html) { setLastDocHtml(d.html); openHtmlForPdf(d.html); }
        },
        onError: (e: Error) => toast.error(e.message),
      });
    }
  };

  const handleOpenPresForPdf = () => {
    if (lastPresHtml) {
      openHtmlForPdf(lastPresHtml);
    } else {
      presMut.mutate({ sprintId: sprint.id, include_analysis: includeAnalysis, include_business: includeBusiness }, {
        onSuccess: (d: any) => {
          if (d?.html) { setLastPresHtml(d.html); openHtmlForPdf(d.html); }
        },
        onError: (e: Error) => toast.error(e.message),
      });
    }
  };

  const handleClone = () => {
    cloneSprint.mutate({ sprintId: sprint.id }, {
      onSuccess: (d: any) => {
        toast.success(`Sprint cloned: ${d?.sprint?.name || 'Copy'}${d?.tasks_cloned ? ` with ${d.tasks_cloned} tasks` : ''}`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleKanbanStatusChange = useCallback((actionId: string, newStatus: Action['status']) => {
    updateAction.mutate({ id: actionId, status: newStatus }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
        queryClient.invalidateQueries({ queryKey: ['sprintReport', sprintId] });
        toast.success('Task status updated');
      },
      onError: () => toast.error('Failed to update status'),
    });
  }, [updateAction, queryClient, sprintId]);

  const handleAddTask = () => {
    if (!newTask.task.trim()) return;
    createAction.mutate({
      task: newTask.task.trim(),
      owner: newTask.owner.trim() || undefined,
      priority: newTask.priority,
      status: 'pending',
      sprint_id: sprintId,
    } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
        queryClient.invalidateQueries({ queryKey: ['sprintReport', sprintId] });
        toast.success('Task added to sprint');
        setNewTask({ task: '', owner: '', priority: 'medium' });
        setShowAddTask(false);
      },
      onError: () => toast.error('Failed to add task'),
    });
  };

  const handleRemoveFromSprint = useCallback((actionId: string) => {
    updateAction.mutate({ id: actionId, sprint_id: null } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
        queryClient.invalidateQueries({ queryKey: ['sprintReport', sprintId] });
        toast.success('Task removed from sprint');
      },
      onError: () => toast.error('Failed to remove task'),
    });
  }, [updateAction, queryClient, sprintId]);

  const velocity = velocityRaw as any;
  const health = healthRaw as any;

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-hover)]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-[var(--surface-hover)]" />
            <div className="h-3 w-32 rounded bg-[var(--surface-hover)]" />
          </div>
          <div className="h-6 w-20 rounded-full bg-[var(--surface-hover)]" />
        </div>
        <div className={cn(CARD, 'p-4 space-y-2')}>
          <div className="h-3 w-16 rounded bg-[var(--surface-hover)]" />
          <div className="h-3 w-full rounded bg-[var(--surface-hover)]" />
          <div className="h-3 w-3/4 rounded bg-[var(--surface-hover)]" />
        </div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-8 w-24 rounded-lg bg-[var(--surface-hover)]" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className={cn(CARD, 'p-3 h-20')} />)}
        </div>
      </div>
    );
  }

  const cfg = statusConfig[sprint.status] || statusConfig.planning;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1 w-8 h-8 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center hover:bg-[var(--surface-hover)] shrink-0">
          <ArrowLeft className="w-4 h-4 text-[var(--text-tertiary)]" />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={cn(INPUT, 'w-full text-lg font-bold')} />
              <input value={editForm.context} onChange={e => setEditForm(f => ({ ...f, context: e.target.value }))} className={cn(INPUT, 'w-full')} placeholder="Context..." />
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-0.5">
                  <span className="text-[9px] text-[var(--text-tertiary)] uppercase">Start Date</span>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[9px] text-[var(--text-tertiary)] uppercase">End Date</span>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[9px] text-[var(--text-tertiary)] uppercase">Analysis Start</span>
                  <input type="date" value={editForm.analysis_start_date} onChange={e => setEditForm(f => ({ ...f, analysis_start_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[9px] text-[var(--text-tertiary)] uppercase">Analysis End</span>
                  <input type="date" value={editForm.analysis_end_date} onChange={e => setEditForm(f => ({ ...f, analysis_end_date: e.target.value }))} className={cn(INPUT, 'w-full')} />
                </label>
              </div>
              <textarea value={editForm.goals} onChange={e => setEditForm(f => ({ ...f, goals: e.target.value }))} className={cn(INPUT, 'w-full resize-none')} rows={2} placeholder="Goals (one per line)" />
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={updateSprint.isPending} className={BTN_PRIMARY}>
                  {updateSprint.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Save
                </button>
                <button onClick={() => setEditing(false)} className={BTN_SECONDARY}><X className="w-3.5 h-3.5" /> Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">{sprint.name || 'Sprint'}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-[var(--text-tertiary)]">
                  {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : '?'} — {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : '?'}
                </span>
                {sprint.context && <span className="text-xs text-[var(--text-tertiary)]">· {sprint.context}</span>}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-[10px] font-medium px-2.5 py-1 rounded-full border capitalize', cfg.bg, cfg.color, cfg.border)}>
              <StatusIcon className="w-3 h-3 inline mr-1" />{sprint.status}
            </span>
          </div>
        )}
      </div>

      {/* Goals */}
      {!editing && sprint.goals && sprint.goals.length > 0 && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className={SECTION_TITLE}>Goals</h3>
          <ul className="mt-2 space-y-1.5">
            {sprint.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <Target className="w-3.5 h-3.5 text-[var(--accent-primary)] mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          <button onClick={startEdit} className={BTN_SECONDARY}><Edit3 className="w-3.5 h-3.5" /> Edit</button>

          {sprint.status === 'planning' && (
            <button onClick={() => handleTransition('active')} disabled={transitionStatus.isPending} className={cn(BTN_SECONDARY, 'text-[var(--status-success)] border-[var(--status-success)]/30')}>
              {transitionStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Start Sprint
            </button>
          )}
          {sprint.status === 'active' && (
            <button onClick={() => handleTransition('completed')} disabled={transitionStatus.isPending} className={cn(BTN_SECONDARY, 'text-[var(--status-info)] border-[var(--status-info)]/30')}>
              {transitionStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />} Complete Sprint
            </button>
          )}
          {sprint.status === 'completed' && (
            <button onClick={() => handleTransition('planning')} disabled={transitionStatus.isPending} className={BTN_SECONDARY}>
              {transitionStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5" />} Reopen
            </button>
          )}

          <div className="w-px h-6 bg-[var(--border-primary)] self-center" />

          <button onClick={handleGenerate} disabled={generateTasks.isPending} className={BTN_PRIMARY}>
            {generateTasks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Generate Tasks (AI)
          </button>
          <button onClick={handleAnalyze} disabled={analyzeMut.isPending} className={cn(BTN_SECONDARY, 'text-purple-400 border-purple-400/30')}>
            {analyzeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Analysis
          </button>
          <button onClick={handleBusiness} disabled={businessMut.isPending} className={cn(BTN_SECONDARY, 'text-emerald-400 border-emerald-400/30')}>
            {businessMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Business Report
          </button>
          <button onClick={handleClone} disabled={cloneSprint.isPending} className={BTN_SECONDARY}>
            {cloneSprint.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Clone
          </button>

          <div className="flex-1" />

          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={handleDelete} disabled={deleteSprint.isPending} className={BTN_DANGER}>
                {deleteSprint.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Confirm Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className={BTN_SECONDARY}><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className={BTN_DANGER}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          )}
        </div>
      )}

      {/* Generated Tasks Preview */}
      {generatedResult && (
        <div className={cn(CARD, 'p-4 space-y-3')}>
          <div className="flex items-center justify-between">
            <h3 className={SECTION_TITLE}>AI Generated Tasks</h3>
            <div className="flex gap-2">
              <button onClick={handleApply} disabled={applyTasks.isPending || (selectedNewTasks.size === 0 && selectedExisting.size === 0)} className={BTN_PRIMARY}>
                {applyTasks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Apply Selected ({selectedNewTasks.size + selectedExisting.size})
              </button>
              <button onClick={() => setGeneratedResult(null)} className={BTN_SECONDARY}><X className="w-3.5 h-3.5" /> Dismiss</button>
            </div>
          </div>

          {generatedResult.proposed_new_tasks.length > 0 && (
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">New Tasks ({generatedResult.proposed_new_tasks.length})</p>
              <div className="space-y-1.5">
                {generatedResult.proposed_new_tasks.map((t, i) => (
                  <label key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNewTasks.has(i)}
                      onChange={e => {
                        setSelectedNewTasks(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(i) : next.delete(i);
                          return next;
                        });
                      }}
                      className="mt-0.5 rounded border-[var(--border-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--text-primary)]">{t.task}</p>
                      {t.description && <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">{t.description}</p>}
                    </div>
                    {t.size_estimate && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--status-info-bg)] text-[var(--status-info)] shrink-0">{t.size_estimate}</span>}
                    {t.priority && <span className={cn('text-[9px] px-2 py-0.5 rounded-full shrink-0',
                      t.priority === 'high' || t.priority === 'urgent' ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger)]' :
                      t.priority === 'medium' ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]' : 'bg-[var(--surface-secondary)] text-[var(--text-tertiary)]'
                    )}>{t.priority}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {generatedResult.existing_details && generatedResult.existing_details.length > 0 && (
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Existing Actions to Link ({generatedResult.existing_details.length})</p>
              <div className="space-y-1.5">
                {generatedResult.existing_details.map(a => (
                  <label key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedExisting.has(a.id)}
                      onChange={e => {
                        setSelectedExisting(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(a.id) : next.delete(a.id);
                          return next;
                        });
                      }}
                      className="rounded border-[var(--border-primary)]"
                    />
                    <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{a.task}</span>
                    <span className="text-[9px] text-[var(--text-tertiary)] capitalize">{a.status}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {analysisText && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">AI Analysis</h3>
          <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{analysisText}</div>
        </div>
      )}

      {/* Business Report */}
      {businessText && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.1em]">Business Report</h3>
          <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{businessText}</div>
        </div>
      )}

      {/* Health Score (compact) */}
      <div className="flex items-center gap-3 flex-wrap">
        <HealthScoreWidget health={health} isLoading={healthLoading} compact />
        {velocity?.daily_progress && (
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {velocity.completed_tasks}/{velocity.total_tasks} tasks · {velocity.completed_points}/{velocity.total_points} pts
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[var(--surface-secondary)] rounded-xl p-1 border border-[var(--border-primary)] overflow-x-auto">
        {DETAIL_TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-[var(--interactive-primary)]/15 text-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              )}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              {reportLoading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                  <span className="text-xs text-[var(--text-tertiary)]">Loading report data...</span>
                </div>
              )}
              {(reportError || velocityError || healthError) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--status-danger)]/20">
                  <AlertTriangle className="w-4 h-4 text-[var(--status-danger)] shrink-0" />
                  <span className="text-xs text-[var(--status-danger)]">Some report data failed to load. Partial data may be shown.</span>
                </div>
              )}
              {/* Stats Cards */}
              {totalTasks > 0 && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Tasks', value: totalTasks },
                      { label: 'Completed', value: completedTasks, sub: totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '' },
                      { label: 'Total Points', value: report?.total_task_points ?? 0 },
                      { label: 'Done Points', value: report?.completed_task_points ?? 0 },
                    ].map(s => (
                      <div key={s.label} className={cn(CARD, 'p-3 text-center')}>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{s.label}</p>
                        {s.sub && <p className="text-xs text-[var(--accent-primary)] mt-0.5">{s.sub}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={cn(CARD, 'p-4')}><BreakdownChart title="By Status" data={breakdown.by_status} /></div>
                    <div className={cn(CARD, 'p-4')}><BreakdownChart title="By Assignee" data={breakdown.by_assignee} /></div>
                  </div>
                </>
              )}

              {/* Health Score (full) */}
              <div className={cn(CARD, 'p-4')}>
                <HealthScoreWidget health={health} isLoading={healthLoading} />
              </div>

              {/* Graph Context */}
              {graphContext && (graphContext.assignees?.length || graphContext.sprint_name) && (
                <div className={cn(CARD, 'p-4')}>
                  <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">Graph Context</h3>
                  <div className="mt-2 space-y-1.5">
                    {graphContext.sprint_name && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        <span className="text-[var(--text-tertiary)]">Sprint node:</span> {graphContext.sprint_name}
                        {graphContext.sprint_context && <span className="text-[var(--text-tertiary)]"> — {graphContext.sprint_context}</span>}
                      </p>
                    )}
                    {graphContext.assignees && graphContext.assignees.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-[var(--text-tertiary)]">Assignees:</span>
                        {graphContext.assignees.map(name => (
                          <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add Task */}
              <div className={cn(CARD, 'p-4')}>
                <div className="flex items-center justify-between">
                  <h3 className={SECTION_TITLE}>Sprint Tasks ({actions.length})</h3>
                  <button onClick={() => setShowAddTask(!showAddTask)} className={BTN_SECONDARY}>
                    <Plus className="w-3 h-3" /> Add Task
                  </button>
                </div>
                <AnimatePresence>
                  {showAddTask && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 space-y-2 p-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
                        <input
                          value={newTask.task}
                          onChange={e => setNewTask(f => ({ ...f, task: e.target.value }))}
                          className={cn(INPUT, 'w-full')}
                          placeholder="Task description..."
                          onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                        />
                        <div className="flex gap-2">
                          <input
                            value={newTask.owner}
                            onChange={e => setNewTask(f => ({ ...f, owner: e.target.value }))}
                            className={cn(INPUT, 'flex-1')}
                            placeholder="Owner (optional)"
                          />
                          <select
                            value={newTask.priority}
                            onChange={e => setNewTask(f => ({ ...f, priority: e.target.value }))}
                            className={cn(INPUT, 'w-28')}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <button onClick={handleAddTask} disabled={!newTask.task.trim() || createAction.isPending} className={BTN_PRIMARY}>
                            {createAction.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sprint Tasks grouped by status */}
              {actions.length > 0 && (
                <div className={cn(CARD, 'p-4')}>
                  <div className="mt-3 space-y-4">
                    {['in_progress', 'pending', 'overdue', 'completed'].map(status => {
                      const group = groupedActions[status];
                      if (!group || group.length === 0) return null;
                      return (
                        <div key={status}>
                          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full', taskStatusDot(status))} />
                            {status.replace('_', ' ')} ({group.length})
                          </p>
                          <div className="space-y-1">
                            {group.map(a => (
                              <div key={a.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--surface-hover)]">
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', taskStatusDot(a.status))} />
                                <span className={cn('text-xs flex-1 truncate', a.status === 'completed' ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]')}>
                                  {a.task || a.title || '(untitled)'}
                                </span>
                                {a.owner && <OwnerBadge name={a.owner} size="sm" />}
                                {a.task_points != null && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--status-info-bg)] text-[var(--accent-primary)] tabular-nums">{a.task_points}pt</span>}
                                <EstimatePointsButton sprintId={sprintId} taskDescription={a.task || a.title || ''} />
                                <button
                                  onClick={e => { e.stopPropagation(); handleRemoveFromSprint(a.id); }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--status-danger-bg)] text-[var(--status-danger)] transition-all"
                                  title="Remove from sprint"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sprint Knowledge Entities */}
              {report?.knowledge_counts && (report.knowledge_counts.facts > 0 || report.knowledge_counts.decisions > 0 || report.knowledge_counts.risks > 0 || report.knowledge_counts.questions > 0) && (
                <div className={cn(CARD, 'p-4')}>
                  <h3 className={cn(SECTION_TITLE, 'mb-3 flex items-center gap-1.5')}>
                    <Sparkles className="w-3.5 h-3.5" /> Knowledge Base
                  </h3>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Facts', count: report.knowledge_counts.facts, color: 'text-blue-400' },
                      { label: 'Decisions', count: report.knowledge_counts.decisions, color: 'text-emerald-400' },
                      { label: 'Risks', count: report.knowledge_counts.risks, color: 'text-orange-400' },
                      { label: 'Questions', count: report.knowledge_counts.questions, color: 'text-purple-400' },
                    ].map(item => (
                      <div key={item.label} className="text-center p-2 rounded-lg bg-[var(--surface-hover)]">
                        <p className={cn('text-lg font-bold tabular-nums', item.color)}>{item.count}</p>
                        <p className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {(report.facts?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                          <CheckCircle className="w-3 h-3 text-blue-400" /> Facts ({report.facts.length})
                        </summary>
                        <div className="mt-1.5 space-y-1 pl-4">
                          {report.facts.slice(0, 15).map((f, i) => (
                            <div key={f.id || i} className="text-xs text-[var(--text-secondary)] py-1 border-l-2 border-blue-400/30 pl-2">
                              <span className="text-[9px] text-blue-400 mr-1">[{f.category || 'general'}]</span>
                              {typeof f.content === 'string' ? f.content.slice(0, 200) : ''}
                            </div>
                          ))}
                          {report.facts.length > 15 && <p className="text-[9px] text-[var(--text-tertiary)] pl-2">+{report.facts.length - 15} more</p>}
                        </div>
                      </details>
                    )}
                    {(report.decisions?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                          <Target className="w-3 h-3 text-emerald-400" /> Decisions ({report.decisions.length})
                        </summary>
                        <div className="mt-1.5 space-y-1 pl-4">
                          {report.decisions.slice(0, 15).map((d, i) => (
                            <div key={d.id || i} className="text-xs text-[var(--text-secondary)] py-1 border-l-2 border-emerald-400/30 pl-2">
                              <span className="text-[9px] text-emerald-400 mr-1">[{(d as any).status || 'active'}]</span>
                              {typeof d.content === 'string' ? d.content.slice(0, 200) : ''}
                              {(d as any).owner && <span className="text-[9px] text-[var(--text-tertiary)] ml-1">({(d as any).owner})</span>}
                            </div>
                          ))}
                          {report.decisions.length > 15 && <p className="text-[9px] text-[var(--text-tertiary)] pl-2">+{report.decisions.length - 15} more</p>}
                        </div>
                      </details>
                    )}
                    {(report.risks?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                          <AlertTriangle className="w-3 h-3 text-orange-400" /> Risks ({report.risks.length})
                        </summary>
                        <div className="mt-1.5 space-y-1 pl-4">
                          {report.risks.slice(0, 15).map((r, i) => (
                            <div key={r.id || i} className="text-xs text-[var(--text-secondary)] py-1 border-l-2 border-orange-400/30 pl-2">
                              <span className={cn('text-[9px] mr-1', (r as any).status === 'open' ? 'text-orange-400' : 'text-[var(--text-tertiary)]')}>
                                [{(r as any).impact || 'medium'}/{(r as any).status || 'open'}]
                              </span>
                              {typeof r.content === 'string' ? r.content.slice(0, 200) : ''}
                            </div>
                          ))}
                          {report.risks.length > 15 && <p className="text-[9px] text-[var(--text-tertiary)] pl-2">+{report.risks.length - 15} more</p>}
                        </div>
                      </details>
                    )}
                    {(report.questions?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)]">
                          <MessageSquare className="w-3 h-3 text-purple-400" /> Questions ({report.questions.length})
                        </summary>
                        <div className="mt-1.5 space-y-1 pl-4">
                          {report.questions.slice(0, 15).map((q, i) => (
                            <div key={q.id || i} className="text-xs text-[var(--text-secondary)] py-1 border-l-2 border-purple-400/30 pl-2">
                              <span className={cn('text-[9px] mr-1', (q as any).status === 'answered' || (q as any).status === 'closed' ? 'text-[var(--text-tertiary)]' : 'text-purple-400')}>
                                [{(q as any).priority || 'medium'}/{(q as any).status || 'open'}]
                              </span>
                              {typeof q.content === 'string' ? q.content.slice(0, 200) : ''}
                            </div>
                          ))}
                          {report.questions.length > 15 && <p className="text-[9px] text-[var(--text-tertiary)] pl-2">+{report.questions.length - 15} more</p>}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'kanban' && (
            <div className={cn(CARD, 'p-4')}>
              <KanbanBoard actions={actions} onStatusChange={handleKanbanStatusChange} />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className={cn(CARD, 'p-4')}>
              <GanttChart actions={actions} sprintStart={sprint.start_date} sprintEnd={sprint.end_date} />
            </div>
          )}

          {activeTab === 'burndown' && (
            <div className="space-y-4">
              {velocity?.daily_progress ? (
                <div className={cn(CARD, 'p-4')}>
                  <BurndownChart dailyProgress={velocity.daily_progress} totalTasks={velocity.total_tasks} totalPoints={velocity.total_points} />
                </div>
              ) : (
                <div className={cn(CARD, 'p-8 text-center')}>
                  <Activity className="w-8 h-8 mx-auto text-[var(--text-tertiary)] mb-2" />
                  <p className="text-xs text-[var(--text-tertiary)]">Burndown data will appear as tasks are completed</p>
                </div>
              )}
              {velocity?.daily_progress && (
                <div className={cn(CARD, 'p-4')}>
                  <BurndownChart dailyProgress={velocity.daily_progress} totalTasks={velocity.total_tasks} totalPoints={velocity.total_points} usePoints />
                </div>
              )}
              {velocity?.velocity_history?.length > 0 && (
                <div className={cn(CARD, 'p-4')}>
                  <VelocityChart history={velocity.velocity_history} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'standup' && (
            <StandupPanel sprintId={sprintId} />
          )}

          {activeTab === 'capacity' && (
            <CapacityPanel sprintId={sprintId} actions={actions} />
          )}

          {activeTab === 'retro' && (
            <RetrospectivePanel sprintId={sprintId} />
          )}

          {activeTab === 'documents' && (
            <SprintDocumentsPanel sprintId={sprintId} />
          )}

          {activeTab === 'report' && (
            <div className="space-y-5">
              {reportLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Tasks', value: totalTasks, sub: '' },
                      { label: 'Completed', value: completedTasks, sub: `${completionPct}%` },
                      { label: 'Total Points', value: totalPoints, sub: '' },
                      { label: 'Done Points', value: completedPoints, sub: totalPoints > 0 ? `${Math.round((completedPoints / totalPoints) * 100)}%` : '' },
                    ].map(s => (
                      <div key={s.label} className={cn(CARD, 'p-3 text-center')}>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{s.label}</p>
                        {s.sub && <p className="text-xs text-[var(--accent-primary)] mt-0.5">{s.sub}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={cn(CARD, 'p-4')}>
                      <BreakdownChart title="By Status" data={breakdown.by_status} />
                    </div>
                    <div className={cn(CARD, 'p-4')}>
                      <BreakdownChart title="By Assignee" data={breakdown.by_assignee} />
                    </div>
                  </div>

                  {graphContext && (graphContext.assignees?.length || graphContext.sprint_name) && (
                    <div className={cn(CARD, 'p-4')}>
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">Graph Context</span>
                      <div className="mt-2 space-y-1.5">
                        {graphContext.sprint_name && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            <span className="text-[var(--text-tertiary)]">Sprint node:</span> {graphContext.sprint_name}
                            {graphContext.sprint_context && <span className="text-[var(--text-tertiary)]"> — {graphContext.sprint_context}</span>}
                          </p>
                        )}
                        {graphContext.assignees && graphContext.assignees.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-[var(--text-tertiary)]">Assignees:</span>
                            {graphContext.assignees.map(name => (
                              <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {actions.length > 0 && (
                    <div className={cn(CARD, 'p-4')}>
                      <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-[0.1em]">
                        Tasks ({actions.length})
                      </span>
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {actions.map(a => {
                          const done = a.status === 'completed';
                          return (
                            <div key={a.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--surface-hover)]">
                              {done
                                ? <CheckCircle className="w-3.5 h-3.5 text-[var(--status-success)] shrink-0" />
                                : <Circle className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />}
                              <span className={cn('text-xs flex-1 truncate', done ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]')}>
                                {a.task || a.title || '(untitled)'}
                              </span>
                              {a.owner && <span className="text-[10px] text-[var(--text-tertiary)] truncate max-w-[100px]">{a.owner}</span>}
                              <span className="text-[9px] text-[var(--text-tertiary)] capitalize shrink-0">{a.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleAnalyze} disabled={analyzeMut.isPending} className={cn(BTN_SECONDARY, 'text-purple-400 border-purple-400/30')}>
                      {analyzeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      AI Analysis
                    </button>
                    <button onClick={handleBusiness} disabled={businessMut.isPending} className={cn(BTN_SECONDARY, 'text-emerald-400 border-emerald-400/30')}>
                      {businessMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
                      Business Report
                    </button>
                  </div>

                  {analysisText && (
                    <div className={cn(CARD, 'p-4')}>
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">AI Analysis</span>
                      <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {analysisText}
                      </div>
                    </div>
                  )}

                  {businessText && (
                    <div className={cn(CARD, 'p-4')}>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.1em]">Business Report</span>
                      <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {businessText}
                      </div>
                    </div>
                  )}

                  <div className={cn(CARD, 'p-4 space-y-3')}>
                    <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-[0.1em]">Export</span>

                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                        <input type="checkbox" checked={includeAnalysis} onChange={e => setIncludeAnalysis(e.target.checked)} className="rounded border-[var(--border-primary)]" />
                        Include AI Analysis
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                        <input type="checkbox" checked={includeBusiness} onChange={e => setIncludeBusiness(e.target.checked)} className="rounded border-[var(--border-primary)]" />
                        Include Business Report
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">Document Style</label>
                      <div className="flex flex-wrap gap-1.5">
                        {STYLE_OPTIONS.map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => setSelectedStyle(opt.key)}
                            className={cn(
                              'px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors',
                              selectedStyle === opt.key
                                ? 'bg-[var(--interactive-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                                : 'bg-[var(--surface-secondary)] text-[var(--text-tertiary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={handleExportDoc} disabled={docMut.isPending} className={cn(BTN_PRIMARY)}>
                        {docMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                        Download A4 Document
                      </button>
                      <button onClick={handleExportPres} disabled={presMut.isPending} className={cn(BTN_SECONDARY, 'text-orange-400 border-orange-400/30')}>
                        {presMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
                        Download Presentation
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleOpenDocForPdf} disabled={docMut.isPending} className={BTN_SECONDARY}>
                        {docMut.isPending && !lastDocHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                        Open Document for PDF
                      </button>
                      <button onClick={handleOpenPresForPdf} disabled={presMut.isPending} className={BTN_SECONDARY}>
                        {presMut.isPending && !lastPresHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                        Open Presentation for PDF
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

    </div>
  );
}

export default function SprintsPage() {
  const sprintsQuery = useSprints();
  const { data: sprintsRaw, isLoading } = sprintsQuery;
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const sprints = useMemo<Sprint[]>(() => {
    const arr = (sprintsRaw as any)?.sprints ?? (Array.isArray(sprintsRaw) ? sprintsRaw : []);
    return arr.map((s: any) => normalizeSprint(s));
  }, [sprintsRaw]);

  const activeSprints = sprints.filter(s => s.status === 'active');
  const planningSprints = sprints.filter(s => s.status === 'planning');
  const completedSprints = sprints.filter(s => s.status === 'completed');

  if (selectedSprint) {
    return (
      <div className="p-6">
        <SprintDetail sprintId={selectedSprint} onBack={() => setSelectedSprint(null)} />
      </div>
    );
  }

  const renderSprintCard = (s: Sprint) => {
    const cfg = statusConfig[s.status] || statusConfig.planning;
    const StatusIcon = cfg.icon;
    return (
      <motion.div
        key={s.id}
        layout
        className={cn(CARD, 'p-4 hover:border-[var(--accent-primary)]/30 transition-colors cursor-pointer')}
        onClick={() => setSelectedSprint(s.id)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={cn('w-4 h-4 shrink-0', cfg.color)} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{s.name || 'Unnamed Sprint'}</h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {s.start_date ? new Date(s.start_date).toLocaleDateString() : '?'} — {s.end_date ? new Date(s.end_date).toLocaleDateString() : '?'}
              {s.context && <span className="ml-2">· {s.context.substring(0, 50)}{s.context.length > 50 ? '...' : ''}</span>}
            </p>
          </div>
          <span className={cn('text-[10px] font-medium px-2.5 py-1 rounded-full border capitalize', cfg.bg, cfg.color, cfg.border)}>
            {s.status}
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
        </div>
        {s.goals && s.goals.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
            {s.goals.slice(0, 3).map((g, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--surface-secondary)] text-[var(--text-tertiary)]">{g}</span>
            ))}
            {s.goals.length > 3 && <span className="text-[9px] text-[var(--text-tertiary)]">+{s.goals.length - 3} more</span>}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Sprints</h1>
          <p className="text-xs text-[var(--text-tertiary)]">
            {sprints.length} sprint{sprints.length !== 1 ? 's' : ''}
            {activeSprints.length > 0 && <span className="text-[var(--status-success)] ml-2">· {activeSprints.length} active</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> New Sprint
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <CreateSprintForm onCreated={() => setShowCreate(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {sprintsQuery.error ? (
        <ErrorState message="Failed to load sprints." onRetry={() => sprintsQuery.refetch()} />
      ) : isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => (
            <div key={i} className={cn(CARD, 'p-4')}>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-[var(--surface-hover)]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-40 rounded bg-[var(--surface-hover)]" />
                  <div className="h-3 w-56 rounded bg-[var(--surface-hover)]" />
                </div>
                <div className="h-5 w-16 rounded-full bg-[var(--surface-hover)]" />
              </div>
            </div>
          ))}
        </div>
      ) : sprints.length === 0 ? (
        <div className={cn(CARD, 'p-12 text-center')}>
          <Calendar className="w-10 h-10 mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--text-tertiary)]">No sprints yet. Create your first sprint to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeSprints.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-[var(--status-success)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Active ({activeSprints.length})
              </h2>
              <div className="space-y-3">{activeSprints.map(renderSprintCard)}</div>
            </div>
          )}
          {planningSprints.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Circle className="w-3.5 h-3.5" /> Planning ({planningSprints.length})
              </h2>
              <div className="space-y-3">{planningSprints.map(renderSprintCard)}</div>
            </div>
          )}
          {completedSprints.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Completed ({completedSprints.length})
              </h2>
              <div className="space-y-3">{completedSprints.map(renderSprintCard)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
