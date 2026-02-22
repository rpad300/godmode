import { useState, useEffect } from 'react';
import { X, Loader2, FileText, Presentation, Zap, Building2, CheckCircle, Circle, Download, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Sprint, SprintReport, Action } from '@/types/godmode';
import {
  useSprintReport,
  useSprintReportAnalyze,
  useSprintBusinessReport,
  useSprintReportDocument,
  useSprintReportPresentation,
} from '../../hooks/useGodMode';
import BreakdownChart from './BreakdownChart';
import { CARD_FLAT, SECTION_TITLE, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './styles';

interface SprintReportModalProps {
  open: boolean;
  onClose: () => void;
  sprint: Sprint;
}

const CARD = CARD_FLAT;
const BTN = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors';

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

export default function SprintReportModal({ open, onClose, sprint }: SprintReportModalProps) {
  const { data: reportData, isLoading: reportLoading } = useSprintReport(open ? sprint.id : null);
  const analyzeMut = useSprintReportAnalyze();
  const businessMut = useSprintBusinessReport();
  const docMut = useSprintReportDocument();
  const presMut = useSprintReportPresentation();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const [analysisText, setAnalysisText] = useState('');
  const [businessText, setBusinessText] = useState('');
  const [includeAnalysis, setIncludeAnalysis] = useState(true);
  const [includeBusiness, setIncludeBusiness] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState(STYLE_OPTIONS[0].key);
  const [lastDocHtml, setLastDocHtml] = useState<string | null>(null);
  const [lastPresHtml, setLastPresHtml] = useState<string | null>(null);

  const report = reportData as SprintReport | undefined;
  const actions = (report?.actions ?? []) as Action[];
  const breakdown = report?.breakdown ?? { by_status: {}, by_assignee: {} };
  const graphContext = (report as any)?.graph_context as { sprint_name?: string; sprint_context?: string; assignees?: string[] } | null;
  const totalTasks = report?.total_tasks ?? actions.length;
  const completedTasks = report?.completed_tasks ?? actions.filter(a => a.status === 'completed').length;
  const totalPoints = report?.total_task_points ?? 0;
  const completedPoints = report?.completed_task_points ?? 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleAnalyze = () => {
    analyzeMut.mutate(sprint.id, {
      onSuccess: (d: any) => {
        setAnalysisText(d?.ai_analysis || d?.analysis || '');
        toast.success('Analysis complete');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleBusiness = () => {
    businessMut.mutate(sprint.id, {
      onSuccess: (d: any) => {
        setBusinessText(d?.business_report || d?.summary || '');
        toast.success('Business report ready');
      },
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
          if (d?.html) {
            setLastDocHtml(d.html);
            openHtmlForPdf(d.html);
          }
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
          if (d?.html) {
            setLastPresHtml(d.html);
            openHtmlForPdf(d.html);
          }
        },
        onError: (e: Error) => toast.error(e.message),
      });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Sprint Report – ${sprint.name}`}
              className="bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-primary)] shrink-0"
                style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.18), rgba(37,99,235,0.05))' }}>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Sprint Report</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">{sprint.name}</p>
                </div>
                <button onClick={onClose} aria-label="Close report" className="w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center">
                  <X className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {reportLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                  </div>
                ) : (
                  <>
                    {/* Stats Cards */}
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

                    {/* Breakdown Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={cn(CARD, 'p-4')}>
                        <BreakdownChart title="By Status" data={breakdown.by_status} />
                      </div>
                      <div className={cn(CARD, 'p-4')}>
                        <BreakdownChart title="By Assignee" data={breakdown.by_assignee} />
                      </div>
                    </div>

                    {/* Graph Context */}
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

                    {/* Task List */}
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

                    {/* AI Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleAnalyze} disabled={analyzeMut.isPending} className={cn(BTN, 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20')}>
                        {analyzeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        AI Analysis
                      </button>
                      <button onClick={handleBusiness} disabled={businessMut.isPending} className={cn(BTN, 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20')}>
                        {businessMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
                        Business Report
                      </button>
                    </div>

                    {/* AI Analysis Result */}
                    {analysisText && (
                      <div className={cn(CARD, 'p-4')}>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">AI Analysis</span>
                        <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                          {analysisText}
                        </div>
                      </div>
                    )}

                    {/* Business Report Result */}
                    {businessText && (
                      <div className={cn(CARD, 'p-4')}>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.1em]">Business Report</span>
                        <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                          {businessText}
                        </div>
                      </div>
                    )}

                    {/* Export Section */}
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
                        <button onClick={handleExportDoc} disabled={docMut.isPending} className={cn(BTN, 'bg-[var(--interactive-primary)] text-[var(--text-on-brand)] hover:bg-[var(--interactive-primary-hover)]')}>
                          {docMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          Download A4 Document
                        </button>
                        <button onClick={handleExportPres} disabled={presMut.isPending} className={cn(BTN, 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20')}>
                          {presMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
                          Download Presentation
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={handleOpenDocForPdf} disabled={docMut.isPending} className={cn(BTN, 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)]')}>
                          {docMut.isPending && !lastDocHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                          Open Document for PDF
                        </button>
                        <button onClick={handleOpenPresForPdf} disabled={presMut.isPending} className={cn(BTN, 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)]')}>
                          {presMut.isPending && !lastPresHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                          Open Presentation for PDF
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
