import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Sparkles, Loader2, ArrowLeft, Edit2, Clock, User, MessageCircle, X, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Question } from '@/types/godmode';
import OwnerBadge from './OwnerBadge';

type StatusFilter = 'all' | 'open' | 'answered' | 'dismissed';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const statusColor = (s: string) =>
  s === 'answered' ? 'bg-success/10 text-success' :
    s === 'dismissed' ? 'bg-muted text-muted-foreground' :
      'bg-primary/10 text-primary';

const priorityColor = (p: string) =>
  p === 'high' ? 'bg-destructive/10 text-destructive' :
    p === 'medium' ? 'bg-warning/10 text-warning' :
      'bg-muted text-muted-foreground';

// ─── Modal ───
const QuestionModal = ({ open, onClose, onSave, question, mode }: {
  open: boolean; onClose: () => void; onSave: (q: Question) => void;
  question?: Question | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Question, 'id'> = { content: '', priority: 'medium', status: 'open', source: '', assignee: '' };
  const [form, setForm] = useState<Omit<Question, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  useState(() => {
    if (question && mode === 'edit') {
      const { id, ...rest } = question;
      setForm(rest);
    } else {
      setForm(empty);
    }
  });

  const handleAiSuggest = async () => {
    setAiLoading('suggest');
    await new Promise(r => setTimeout(r, 1200));
    setForm(prev => ({ ...prev, content: prev.content || 'What are the key blockers for the current sprint delivery?' }));
    setAiLoading(null);
    toast.success('AI suggestion applied');
  };

  const handleAiAnswer = async () => {
    if (!form.content) { toast.error('Add a question first'); return; }
    setAiLoading('answer');
    await new Promise(r => setTimeout(r, 1500));
    setForm(prev => ({ ...prev, answer: '[AI] Based on project analysis: The primary blockers are resource allocation and pending security review. Recommend escalating to CTO.', status: 'answered' }));
    setAiLoading(null);
    toast.success('AI generated answer');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">{mode === 'create' ? 'New Question' : 'Edit Question'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiSuggest} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-50">
                  {aiLoading === 'suggest' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Suggest Question
                </button>
                <button type="button" onClick={handleAiAnswer} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50">
                  {aiLoading === 'answer' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Answer
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.content.trim()) return; onSave({ id: question?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Question *</label>
                  <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y" placeholder="Type your question..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Question['priority'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Question['status'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="open">Open</option><option value="answered">Answered</option><option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignee</label>
                    <input value={form.assignee || ''} onChange={e => setForm({ ...form, assignee: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Who should answer?" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</label>
                    <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Where did this come from?" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Answer</label>
                  <textarea value={form.answer || ''} onChange={e => setForm({ ...form, answer: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px] resize-y" placeholder="Answer (if known)..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">{mode === 'create' ? 'Create' : 'Save'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Detail View ───
const QuestionDetail = ({ question, onBack, onEdit }: { question: Question; onBack: () => void; onEdit: (q: Question) => void }) => {
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const handleAnalyze = async () => {
    setAiLoading('analyze');
    await new Promise(r => setTimeout(r, 1500));
    setAiInsights([
      `This question is ${question.priority} priority and currently ${question.status}.`,
      question.assignee ? `Assigned to ${question.assignee} — consider follow-up if unanswered for >48h.` : 'No assignee — recommend assigning to a domain expert.',
      `Source: "${question.source}" — cross-reference with related documents for context.`,
    ]);
    setAiLoading(null);
    toast.success('AI analysis complete');
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-foreground">Question Detail</h2><p className="text-xs text-muted-foreground">#{question.id}</p></div>
        <button onClick={handleAnalyze} disabled={!!aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading === 'analyze' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
        </button>
        <button onClick={() => onEdit(question)} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(question.status)}`}>{question.status}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${priorityColor(question.priority)}`}>{question.priority}</span>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Question</h3>
        <p className="text-sm text-foreground">{question.content}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignee</span></div>
          {question.assignee ? <OwnerBadge name={question.assignee} size="md" /> : <p className="text-sm text-muted-foreground">Unassigned</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><MessageCircle className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</span></div>
          <p className="text-sm text-foreground">{question.source}</p>
        </div>
      </div>
      {question.answer && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2">💡 Answer</h3>
          <p className="text-sm text-foreground">{question.answer}</p>
        </div>
      )}
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Insights</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-foreground">{ins}</li>)}</ul>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─── Main Panel ───
const QuestionsPanel = ({ initialData = [] }: { initialData?: Question[] }) => {
  const [questions, setQuestions] = useState<Question[]>(initialData);

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
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setQuestions(prev => [...prev, {
      id: `ai-${Date.now()}`,
      content: '[AI] What is the contingency plan if the MVP launch date slips?',
      priority: 'high',
      status: 'open',
      source: 'AI Analysis',
    }]);
    setAiLoading(false);
    toast.success('AI suggested a new question');
  };

  if (detailItem) {
    return <QuestionDetail question={detailItem} onBack={() => setDetailItem(null)} onEdit={q => { setDetailItem(null); setEditingItem(q); setModalMode('edit'); setModalOpen(true); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Open', value: stats.open, color: 'text-primary' },
          { label: 'Answered', value: stats.answered, color: 'text-success' },
          { label: 'Dismissed', value: stats.dismissed, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All statuses</option><option value="open">Open</option><option value="answered">Answered</option><option value="dismissed">Dismissed</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as PriorityFilter)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiSuggest} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Suggest
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No questions match the current filter</p>
        ) : filtered.map(q => (
          <motion.div key={q.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(q)}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">{q.content}</p>
              <div className="flex gap-1.5 flex-shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(q.priority)}`}>{q.priority}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(q.status)}`}>{q.status}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              {q.assignee ? <OwnerBadge name={q.assignee} size="sm" /> : <span className="text-[11px] text-muted-foreground">Unassigned</span>}
              <span className="text-[10px] text-muted-foreground">{q.source}</span>
            </div>
            {q.answer && <p className="text-xs text-accent mt-2 line-clamp-1">💡 {q.answer}</p>}
          </motion.div>
        ))}
      </div>
      <QuestionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} question={editingItem} mode={modalMode} />
    </div>
  );
};

export default QuestionsPanel;
