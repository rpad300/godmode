import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Clock, FileText, X, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Fact } from '@/types/godmode';
import { useSotChat, useAiSimilarFacts } from '../../hooks/useGodMode';

type CategoryFilter = 'all' | Fact['category'];

const categoryColor = (c: string) =>
  c === 'technical' ? 'bg-blue-500/10 text-blue-400' :
    c === 'process' ? 'bg-purple-500/10 text-purple-400' :
      c === 'policy' ? 'bg-yellow-500/10 text-yellow-400' :
        c === 'people' ? 'bg-red-500/10 text-red-400' :
          'bg-white/5 text-slate-400';

const confidenceColor = (c: number) =>
  c >= 0.9 ? 'text-green-400' : c >= 0.7 ? 'text-yellow-400' : 'text-red-400';

const FactModal = ({ open, onClose, onSave, fact, mode }: {
  open: boolean; onClose: () => void; onSave: (f: Fact) => void;
  fact?: Fact | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Fact, 'id'> = { content: '', category: 'technical', source: '', confidence: 0.8, createdAt: new Date().toISOString().split('T')[0] };
  const [form, setForm] = useState<Omit<Fact, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const chatMut = useSotChat();

  useEffect(() => {
    if (fact && mode === 'edit') { const { id, ...rest } = fact; setForm(rest); } else { setForm(empty); }
  }, [fact, mode, open]);

  const handleAiRefine = async () => {
    if (!form.content) { toast.error('Add content first'); return; }
    setAiLoading('refine');
    chatMut.mutate({ message: `Refine and verify this fact against project knowledge. Rewrite it more precisely if needed and estimate confidence (0.0-1.0):\n"${form.content}"` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) {
          const confMatch = resp.match(/(\d\.\d+)/);
          setForm(prev => ({
            ...prev,
            content: resp.replace(/confidence[:\s]*\d\.\d+/i, '').trim(),
            confidence: confMatch ? Math.min(parseFloat(confMatch[1]), 1) : Math.min(prev.confidence + 0.05, 1),
          }));
        }
        setAiLoading(null);
        toast.success('Fact refined with AI');
      },
      onError: () => { setAiLoading(null); toast.error('AI refinement failed'); },
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
                <h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{mode === 'create' ? 'New Fact' : 'Edit Fact'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center"><X className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiRefine} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'refine' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Refine with AI
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.content.trim()) return; onSave({ id: fact?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Content *</label>
                  <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[80px] resize-y" placeholder="State the fact..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Fact['category'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="technical">Technical</option><option value="process">Process</option><option value="policy">Policy</option><option value="people">People</option><option value="timeline">Timeline</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Confidence</label>
                    <input type="number" min={0} max={1} step={0.05} value={form.confidence} onChange={e => setForm({ ...form, confidence: parseFloat(e.target.value) })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Source</label>
                  <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" placeholder="Document or meeting source..." />
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

const FactDetail = ({ fact, onBack, onEdit, onDelete }: { fact: Fact; onBack: () => void; onEdit: (f: Fact) => void; onDelete?: (id: string) => void }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const chatMut = useSotChat();
  const similarFacts = useAiSimilarFacts(fact.id);

  const handleVerify = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: `Verify this fact against the project knowledge base. Check accuracy, find related/conflicting facts, and assess confidence:\nFact: "${fact.content}"\nCategory: ${fact.category}\nCurrent confidence: ${Math.round(fact.confidence * 100)}%\nSource: ${fact.source}` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setAiInsights(resp.split('\n').filter(l => l.trim()));
        setAiLoading(false);
        toast.success('AI verification complete');
      },
      onError: () => { setAiLoading(false); toast.error('AI verification failed'); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[var(--gm-interactive-secondary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]"><ArrowLeft className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">Fact Detail</h2><p className="text-xs text-[var(--gm-text-tertiary)]">#{fact.id}</p></div>
        <button onClick={handleVerify} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Verify
        </button>
        <button onClick={() => onEdit(fact)} className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
        {onDelete && <button onClick={() => { onDelete(fact.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${categoryColor(fact.category)}`}>{fact.category || '—'}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium bg-[var(--gm-interactive-secondary)] ${confidenceColor(fact.confidence)}`}>{Math.round(fact.confidence * 100)}% confidence</span>
      </div>
      <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
        <h3 className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">Content</h3>
        <p className="text-sm text-[var(--gm-text-primary)]">{fact.content || '(no content)'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase">Source</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{fact.source || '—'}</p>
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase">Extracted</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{fact.createdAt || '—'}</p>
        </div>
      </div>
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Verification</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-[var(--gm-text-primary)]">{ins}</li>)}</ul>
        </motion.div>
      )}
      {similarFacts.data && similarFacts.data.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Similar Facts</h3>
          <ul className="space-y-2">{similarFacts.data.map((sf, i) => (
            <li key={i} className="text-sm text-[var(--gm-text-primary)] bg-[var(--gm-surface-primary)] rounded-lg p-3 border border-[var(--gm-border-primary)]">
              <p>{(sf as Record<string, unknown>).content as string ?? '—'}</p>
              {(sf as Record<string, unknown>).similarity != null && (
                <span className="text-xs text-[var(--gm-text-tertiary)] mt-1 inline-block">{Math.round(Number((sf as Record<string, unknown>).similarity) * 100)}% match</span>
              )}
            </li>
          ))}</ul>
        </motion.div>
      )}
      {similarFacts.isLoading && (
        <div className="flex items-center gap-2 text-xs text-[var(--gm-text-tertiary)]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading similar facts...</div>
      )}
    </motion.div>
  );
};

const FactsPanel = ({ initialData = [], onSave, onDelete }: { initialData?: Fact[]; onSave?: (f: Fact) => void; onDelete?: (id: string) => void }) => {
  const [facts, setFacts] = useState<Fact[]>(initialData);
  const chatMut = useSotChat();

  useEffect(() => {
    if (initialData) setFacts(initialData);
  }, [initialData]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Fact | null>(null);
  const [detailItem, setDetailItem] = useState<Fact | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return facts;
    return facts.filter(f => f.category === categoryFilter);
  }, [facts, categoryFilter]);

  const stats = useMemo(() => {
    const cats: Record<string, number> = {};
    facts.forEach(f => { cats[f.category] = (cats[f.category] || 0) + 1; });
    return { total: facts.length, categories: cats, avgConfidence: facts.length ? facts.reduce((a, f) => a + f.confidence, 0) / facts.length : 0 };
  }, [facts]);

  const handleSave = (f: Fact) => {
    setFacts(prev => {
      const idx = prev.findIndex(x => x.id === f.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = f; return u; }
      return [...prev, f];
    });
    onSave?.(f);
  };

  const handleDelete = (id: string) => {
    setFacts(prev => prev.filter(x => x.id !== id));
    onDelete?.(id);
    toast.success('Fact deleted');
  };

  const handleAiExtract = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: 'Based on the project knowledge, extract one important fact that is not yet documented. Return on line 1: the fact text. Line 2: category (technical/process/policy/people/timeline). Line 3: confidence (0.0-1.0).' }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) {
          const lines = resp.split('\n').filter(l => l.trim());
          const content = lines[0]?.replace(/^["'\-*\d.]+\s*/, '').trim() || resp.trim();
          const catMatch = resp.toLowerCase().match(/(technical|process|policy|people|timeline)/);
          const confMatch = resp.match(/(\d\.\d+)/);
          const newF: Fact = {
            id: `ai-${Date.now()}`, content,
            category: (catMatch?.[1] as Fact['category']) || 'technical',
            source: 'AI Analysis', confidence: confMatch ? parseFloat(confMatch[1]) : 0.8,
            createdAt: new Date().toISOString().split('T')[0],
          };
          setFacts(prev => [...prev, newF]);
          onSave?.(newF);
        }
        setAiLoading(false);
        toast.success('AI extracted a new fact');
      },
      onError: () => { setAiLoading(false); toast.error('AI extraction failed'); },
    });
  };

  if (detailItem) {
    return <FactDetail fact={detailItem} onBack={() => setDetailItem(null)} onEdit={f => { setDetailItem(null); setEditingItem(f); setModalMode('edit'); setModalOpen(true); }} onDelete={handleDelete} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-lg font-bold text-[var(--gm-text-primary)]">{stats.total}</span>
          <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">Total</span>
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-lg font-bold text-purple-400">{Math.round(stats.avgConfidence * 100)}%</span>
          <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">Avg Confidence</span>
        </div>
        {Object.entries(stats.categories).map(([cat, count]) => (
          <div key={cat} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${categoryColor(cat).split(' ')[1]}`}>{count}</span>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{cat}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as CategoryFilter)} className="bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
          <option value="all">All categories</option><option value="technical">Technical</option><option value="process">Process</option><option value="policy">Policy</option><option value="people">People</option><option value="timeline">Timeline</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiExtract} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Extract
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Fact
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-8">No facts match the current filter</p>
        ) : filtered.map(f => (
          <motion.div key={f.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3.5 hover:border-blue-500/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(f)}>
            <p className="text-sm text-[var(--gm-text-primary)] group-hover:text-blue-400 transition-colors">{f.content || '(no content)'}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColor(f.category)}`}>{f.category || '—'}</span>
              <span className={`text-[10px] ${confidenceColor(f.confidence)}`}>{Math.round(f.confidence * 100)}%</span>
              <span className="text-[10px] text-[var(--gm-text-tertiary)]">· {f.source || '—'}</span>
              <span className="text-[10px] text-[var(--gm-text-tertiary)] ml-auto">{f.createdAt || '—'}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <FactModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} fact={editingItem} mode={modalMode} />
    </div>
  );
};

export default FactsPanel;
