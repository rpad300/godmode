import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Clock, User, MessageCircle, X, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Question } from '@/types/godmode';
import { useSotChat, useEnrichQuestions } from '../../hooks/useGodMode';
import OwnerBadge from './OwnerBadge';
import OwnerSelect from './OwnerSelect';

type StatusFilter = 'all' | 'open' | 'answered' | 'dismissed';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const statusColor = (s: string) =>
  s === 'answered' ? 'bg-green-500/10 text-green-400' :
    s === 'dismissed' ? 'bg-white/5 text-slate-400' :
      'bg-blue-500/10 text-blue-400';

const priorityColor = (p: string) =>
  p === 'high' ? 'bg-red-500/10 text-red-400' :
    p === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
      'bg-white/5 text-slate-400';

const QuestionModal = ({ open, onClose, onSave, question, mode }: {
  open: boolean; onClose: () => void; onSave: (q: Question) => void;
  question?: Question | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Question, 'id'> = { content: '', priority: 'medium', status: 'open', source: '', assignee: '' };
  const [form, setForm] = useState<Omit<Question, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const chatMut = useSotChat();

  useEffect(() => {
    if (question && mode === 'edit') {
      const { id, ...rest } = question;
      setForm(rest);
    } else {
      setForm(empty);
    }
  }, [question, mode, open]);

  const handleAiSuggest = async () => {
    setAiLoading('suggest');
    chatMut.mutate({ message: 'Suggest one important question that should be asked about this project. Return only the question text, no explanation.' }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setForm(prev => ({ ...prev, content: resp.replace(/^["']|["']$/g, '').trim() }));
        setAiLoading(null);
        toast.success('AI suggestion applied');
      },
      onError: () => { setAiLoading(null); toast.error('AI suggestion failed'); },
    });
  };

  const handleAiAnswer = async () => {
    if (!form.content) { toast.error('Add a question first'); return; }
    setAiLoading('answer');
    chatMut.mutate({ message: `Answer this question based on the project knowledge: "${form.content}". Be concise and factual.` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setForm(prev => ({ ...prev, answer: resp, status: 'answered' }));
        setAiLoading(null);
        toast.success('AI generated answer');
      },
      onError: () => { setAiLoading(null); toast.error('AI answer failed'); },
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--gm-bg-elevated)] border border-[var(--gm-border-primary)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[var(--gm-border-primary)]">
                <h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{mode === 'create' ? 'New Question' : 'Edit Question'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center"><X className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiSuggest} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 disabled:opacity-50">
                  {aiLoading === 'suggest' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Suggest Question
                </button>
                <button type="button" onClick={handleAiAnswer} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'answer' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Answer
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.content.trim()) return; onSave({ id: question?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Question *</label>
                  <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[80px] resize-y" placeholder="Type your question..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Priority</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Question['priority'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Question['status'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="open">Open</option><option value="answered">Answered</option><option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <OwnerSelect value={form.assignee || ''} onChange={v => setForm({ ...form, assignee: v })} label="Assignee" placeholder="Select assignee..." />
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Source</label>
                    <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" placeholder="Where did this come from?" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Answer</label>
                  <textarea value={form.answer || ''} onChange={e => setForm({ ...form, answer: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[60px] resize-y" placeholder="Answer (if known)..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-sm font-medium hover:bg-[var(--gm-surface-hover)]">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">{mode === 'create' ? 'Create' : 'Save'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const QuestionDetail = ({ question, onBack, onEdit, onDelete }: { question: Question; onBack: () => void; onEdit: (q: Question) => void; onDelete?: (id: string) => void }) => {
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const chatMut = useSotChat();

  const handleAnalyze = async () => {
    setAiLoading('analyze');
    chatMut.mutate({ message: `Analyze this project question and provide 3 actionable insights:\nQuestion: "${question.content}"\nStatus: ${question.status}\nPriority: ${question.priority}\nAssignee: ${question.assignee || 'none'}\nSource: ${question.source || 'unknown'}` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setAiInsights(resp.split('\n').filter(l => l.trim()));
        setAiLoading(null);
        toast.success('AI analysis complete');
      },
      onError: () => { setAiLoading(null); toast.error('AI analysis failed'); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[var(--gm-interactive-secondary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]"><ArrowLeft className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">Question Detail</h2><p className="text-xs text-[var(--gm-text-tertiary)]">#{question.id}</p></div>
        <button onClick={handleAnalyze} disabled={!!aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading === 'analyze' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
        </button>
        <button onClick={() => onEdit(question)} className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
        {onDelete && <button onClick={() => { onDelete(question.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(question.status)}`}>{question.status || '—'}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${priorityColor(question.priority)}`}>{question.priority || '—'}</span>
      </div>
      <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
        <h3 className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">Question</h3>
        <p className="text-sm text-[var(--gm-text-primary)]">{question.content || '(no content)'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Assignee</span></div>
          {question.assignee ? <OwnerBadge name={question.assignee} size="md" /> : <p className="text-sm text-[var(--gm-text-tertiary)]">Unassigned</p>}
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><MessageCircle className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Source</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{question.source || '—'}</p>
        </div>
      </div>
      {question.answer && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2">Answer</h3>
          <p className="text-sm text-[var(--gm-text-primary)]">{question.answer}</p>
        </div>
      )}
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Insights</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-[var(--gm-text-primary)]">{ins}</li>)}</ul>
        </motion.div>
      )}
    </motion.div>
  );
};

const QuestionsPanel = ({ initialData = [], onSave, onDelete }: { initialData?: Question[]; onSave?: (q: Question) => void; onDelete?: (id: string) => void }) => {
  const [questions, setQuestions] = useState<Question[]>(initialData);
  const chatMut = useSotChat();
  const enrichMut = useEnrichQuestions();

  useEffect(() => {
    if (initialData) setQuestions(initialData);
  }, [initialData]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Question | null>(null);
  const [detailItem, setDetailItem] = useState<Question | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = useMemo(() => {
    let result = questions;
    if (statusFilter !== 'all') result = result.filter(q => q.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter(q => q.priority === priorityFilter);
    return result;
  }, [questions, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: questions.length,
    open: questions.filter(q => q.status === 'open').length,
    answered: questions.filter(q => q.status === 'answered').length,
    dismissed: questions.filter(q => q.status === 'dismissed').length,
  }), [questions]);

  const handleSave = (q: Question) => {
    setQuestions(prev => {
      const idx = prev.findIndex(x => x.id === q.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = q; return u; }
      return [...prev, q];
    });
    onSave?.(q);
  };

  const handleDelete = (id: string) => {
    setQuestions(prev => prev.filter(x => x.id !== id));
    onDelete?.(id);
    toast.success('Question deleted');
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: 'Based on the current project knowledge, suggest one new important question that should be raised. Return the question text only, and a suggested priority (high/medium/low) on a second line.' }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) {
          const lines = resp.split('\n').filter(l => l.trim());
          const content = lines[0]?.replace(/^["'\-*\d.]+\s*/, '').trim() || resp.trim();
          const priMatch = resp.toLowerCase().match(/(high|medium|low)/);
          const newQ: Question = { id: `ai-${Date.now()}`, content, priority: (priMatch?.[1] as Question['priority']) || 'medium', status: 'open', source: 'AI Analysis' };
          setQuestions(prev => [...prev, newQ]);
          onSave?.(newQ);
        }
        setAiLoading(false);
        toast.success('AI suggested a new question');
      },
      onError: () => { setAiLoading(false); toast.error('AI suggestion failed'); },
    });
  };

  if (detailItem) {
    return <QuestionDetail question={detailItem} onBack={() => setDetailItem(null)} onEdit={q => { setDetailItem(null); setEditingItem(q); setModalMode('edit'); setModalOpen(true); }} onDelete={handleDelete} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--gm-text-primary)]' },
          { label: 'Open', value: stats.open, color: 'text-primary' },
          { label: 'Answered', value: stats.answered, color: 'text-green-400' },
          { label: 'Dismissed', value: stats.dismissed, color: 'text-[var(--gm-text-tertiary)]' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
          <option value="all">All statuses</option><option value="open">Open</option><option value="answered">Answered</option><option value="dismissed">Dismissed</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as PriorityFilter)} className="bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
          <option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => enrichMut.mutate(undefined, { onSuccess: (r) => toast.success(`Enriched ${r?.enriched ?? 0} questions with AI-assigned people`) })}
          disabled={enrichMut.isPending}
          className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50"
        >
          {enrichMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Enrich
        </button>
        <button onClick={handleAiSuggest} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Suggest
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-8">No questions match the current filter</p>
        ) : filtered.map(q => (
          <motion.div key={q.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3.5 hover:border-blue-500/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(q)}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[var(--gm-text-primary)] group-hover:text-blue-400 transition-colors flex-1">{q.content || '(no content)'}</p>
              <div className="flex gap-1.5 flex-shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(q.priority)}`}>{q.priority || '—'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(q.status)}`}>{q.status || '—'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              {q.assignee ? <OwnerBadge name={q.assignee} size="sm" /> : <span className="text-[11px] text-[var(--gm-text-tertiary)]">Unassigned</span>}
              <span className="text-[10px] text-[var(--gm-text-tertiary)]">{q.source || ''}</span>
            </div>
            {q.answer && <p className="text-xs text-purple-400 mt-2 line-clamp-1">{q.answer}</p>}
          </motion.div>
        ))}
      </div>
      <QuestionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} question={editingItem} mode={modalMode} />
    </div>
  );
};

export default QuestionsPanel;
