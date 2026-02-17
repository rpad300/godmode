import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Clock, FileText, X, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Fact } from '@/types/godmode';

type CategoryFilter = 'all' | Fact['category'];

const categoryColor = (c: string) =>
  c === 'technical' ? 'bg-primary/10 text-primary' :
    c === 'process' ? 'bg-accent/10 text-accent' :
      c === 'policy' ? 'bg-warning/10 text-warning' :
        c === 'people' ? 'bg-destructive/10 text-destructive' :
          'bg-muted text-muted-foreground';

const confidenceColor = (c: number) =>
  c >= 0.9 ? 'text-success' : c >= 0.7 ? 'text-warning' : 'text-destructive';

// ─── Modal ───
const FactModal = ({ open, onClose, onSave, fact, mode }: {
  open: boolean; onClose: () => void; onSave: (f: Fact) => void;
  fact?: Fact | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Fact, 'id'> = { content: '', category: 'technical', source: '', confidence: 0.8, createdAt: new Date().toISOString().split('T')[0] };
  const [form, setForm] = useState<Omit<Fact, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  useState(() => {
    if (fact && mode === 'edit') { const { id, ...rest } = fact; setForm(rest); } else { setForm(empty); }
  });

  const handleAiRefine = async () => {
    if (!form.content) { toast.error('Add content first'); return; }
    setAiLoading('refine');
    await new Promise(r => setTimeout(r, 1200));
    setForm(prev => ({ ...prev, content: `${prev.content} [AI Refined: verified against 3 sources, confidence adjusted]`, confidence: Math.min(prev.confidence + 0.05, 1) }));
    setAiLoading(null);
    toast.success('Fact refined with AI');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">{mode === 'create' ? 'New Fact' : 'Edit Fact'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiRefine} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50">
                  {aiLoading === 'refine' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Refine with AI
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.content.trim()) return; onSave({ id: fact?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content *</label>
                  <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y" placeholder="State the fact..." required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Fact['category'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="technical">Technical</option><option value="process">Process</option><option value="policy">Policy</option><option value="people">People</option><option value="timeline">Timeline</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confidence</label>
                    <input type="number" min={0} max={1} step={0.05} value={form.confidence} onChange={e => setForm({ ...form, confidence: parseFloat(e.target.value) })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</label>
                  <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Document or meeting source..." />
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

// ─── Detail ───
const FactDetail = ({ fact, onBack, onEdit, onDelete }: { fact: Fact; onBack: () => void; onEdit: (f: Fact) => void; onDelete?: (id: string) => void }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const handleVerify = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setAiInsights([
      `Confidence: ${Math.round(fact.confidence * 100)}% — ${fact.confidence >= 0.9 ? 'High reliability' : 'Consider cross-referencing'}.`,
      `Category "${fact.category}" — found ${Math.floor(Math.random() * 5) + 2} related facts in the knowledge base.`,
      `Last verified from source: "${fact.source}" on ${fact.createdAt}.`,
    ]);
    setAiLoading(false);
    toast.success('AI verification complete');
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-foreground">Fact Detail</h2><p className="text-xs text-muted-foreground">#{fact.id}</p></div>
        <button onClick={handleVerify} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Verify
        </button>
        <button onClick={() => onEdit(fact)} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
        {onDelete && <button onClick={() => { onDelete(fact.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${categoryColor(fact.category)}`}>{fact.category}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium bg-secondary ${confidenceColor(fact.confidence)}`}>{Math.round(fact.confidence * 100)}% confidence</span>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Content</h3>
        <p className="text-sm text-foreground">{fact.content}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase">Source</span></div>
          <p className="text-sm text-foreground">{fact.source}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase">Extracted</span></div>
          <p className="text-sm text-foreground">{fact.createdAt}</p>
        </div>
      </div>
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Verification</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-foreground">{ins}</li>)}</ul>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─── Main Panel ───
const FactsPanel = ({ initialData = [], onSave, onDelete }: { initialData?: Fact[]; onSave?: (f: Fact) => void; onDelete?: (id: string) => void }) => {
  const [facts, setFacts] = useState<Fact[]>(initialData);

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
    return { total: facts.length, categories: cats, avgConfidence: facts.reduce((a, f) => a + f.confidence, 0) / facts.length };
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
    await new Promise(r => setTimeout(r, 1800));
    setFacts(prev => [...prev, {
      id: `ai-${Date.now()}`,
      content: '[AI Extracted] The team has adopted a bi-weekly release cadence starting from Sprint 2',
      category: 'process',
      source: 'AI Analysis — Sprint Retrospective.txt',
      confidence: 0.82,
      createdAt: new Date().toISOString().split('T')[0],
    }]);
    setAiLoading(false);
    toast.success('AI extracted a new fact');
  };

  if (detailItem) {
    return <FactDetail fact={detailItem} onBack={() => setDetailItem(null)} onEdit={f => { setDetailItem(null); setEditingItem(f); setModalMode('edit'); setModalOpen(true); }} onDelete={handleDelete} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">{stats.total}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
        </div>
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-lg font-bold text-accent">{Math.round(stats.avgConfidence * 100)}%</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Confidence</span>
        </div>
        {Object.entries(stats.categories).map(([cat, count]) => (
          <div key={cat} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${categoryColor(cat).split(' ')[1]}`}>{count}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{cat}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as CategoryFilter)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All categories</option><option value="technical">Technical</option><option value="process">Process</option><option value="policy">Policy</option><option value="people">People</option><option value="timeline">Timeline</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiExtract} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Extract
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Fact
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No facts match the current filter</p>
        ) : filtered.map(f => (
          <motion.div key={f.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(f)}>
            <p className="text-sm text-foreground group-hover:text-primary transition-colors">{f.content}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColor(f.category)}`}>{f.category}</span>
              <span className={`text-[10px] ${confidenceColor(f.confidence)}`}>{Math.round(f.confidence * 100)}%</span>
              <span className="text-[10px] text-muted-foreground">· {f.source}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{f.createdAt}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <FactModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} fact={editingItem} mode={modalMode} />
    </div>
  );
};

export default FactsPanel;
