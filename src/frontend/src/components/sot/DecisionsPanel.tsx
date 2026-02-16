import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Calendar, User, CheckCircle, X, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Decision } from '@/types/godmode';
import OwnerBadge from './OwnerBadge';

type StatusFilter = 'all' | Decision['status'];

const statusColor = (s: string) =>
  s === 'approved' ? 'bg-success/10 text-success' :
    s === 'rejected' ? 'bg-destructive/10 text-destructive' :
      'bg-primary/10 text-primary';

// ─── Modal ───
const DecisionModal = ({ open, onClose, onSave, decision, mode }: {
  open: boolean; onClose: () => void; onSave: (d: Decision) => void;
  decision?: Decision | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Decision, 'id'> = { title: '', description: '', owner: '', date: new Date().toISOString().split('T')[0], status: 'pending' };
  const [form, setForm] = useState<Omit<Decision, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  useState(() => {
    if (decision && mode === 'edit') { const { id, ...rest } = decision; setForm(rest); } else { setForm(empty); }
  });

  const handleAiImpact = async () => {
    if (!form.title) { toast.error('Add a title first'); return; }
    setAiLoading('impact');
    await new Promise(r => setTimeout(r, 1500));
    setForm(prev => ({ ...prev, description: `${prev.description}\n\n[AI Impact Analysis] This decision affects 3 teams and 5 active sprints. Estimated effort: 2-3 weeks. Key dependencies: infrastructure team availability, security review completion.`.trim() }));
    setAiLoading(null);
    toast.success('AI impact analysis added');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">{mode === 'create' ? 'New Decision' : 'Edit Decision'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiImpact} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50">
                  {aiLoading === 'impact' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Impact Analysis
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.title.trim()) return; onSave({ id: decision?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Decision title..." required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y" placeholder="Describe the decision and rationale..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</label>
                    <input value={form.owner || ''} onChange={e => setForm({ ...form, owner: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Decision maker..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Decision['status'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                    </select>
                  </div>
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
const DecisionDetail = ({ decision, onBack, onEdit }: { decision: Decision; onBack: () => void; onEdit: (d: Decision) => void }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const handleAnalyze = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setAiInsights([
      `Decision "${decision.title}" is currently ${decision.status}.`,
      `Made on ${decision.date} by ${decision.owner || 'unknown'}.`,
      `This decision impacts ${Math.floor(Math.random() * 4) + 2} actions and ${Math.floor(Math.random() * 3) + 1} risks in the current project.`,
      decision.status === 'pending' ? '⏳ Recommend scheduling a review meeting within the next 48h.' : `✅ Decision ${decision.status} — ensure all teams are aligned on implementation.`,
    ]);
    setAiLoading(false);
    toast.success('AI analysis complete');
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-foreground">{decision.title}</h2><p className="text-xs text-muted-foreground">Decision #{decision.id}</p></div>
        <button onClick={handleAnalyze} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
        </button>
        <button onClick={() => onEdit(decision)} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(decision.status)}`}>{decision.status}</span>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
        <p className="text-sm text-foreground whitespace-pre-wrap">{decision.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase">Decision Maker</span></div>
          {decision.owner ? <OwnerBadge name={decision.owner} size="md" /> : <p className="text-sm text-muted-foreground">Unknown</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase">Date</span></div>
          <p className="text-sm text-foreground">{decision.date}</p>
        </div>
      </div>
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
const DecisionsPanel = ({ initialData = [] }: { initialData?: Decision[] }) => {
  const [decisions, setDecisions] = useState<Decision[]>(initialData);

  useEffect(() => {
    if (initialData) setDecisions(initialData);
  }, [initialData]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Decision | null>(null);
  const [detailItem, setDetailItem] = useState<Decision | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return decisions;
    return decisions.filter(d => d.status === statusFilter);
  }, [decisions, statusFilter]);

  const stats = useMemo(() => ({
    total: decisions.length,
    approved: decisions.filter(d => d.status === 'approved').length,
    pending: decisions.filter(d => d.status === 'pending').length,
    rejected: decisions.filter(d => d.status === 'rejected').length,
  }), [decisions]);

  const handleSave = (d: Decision) => {
    setDecisions(prev => {
      const idx = prev.findIndex(x => x.id === d.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = d; return u; }
      return [...prev, d];
    });
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setDecisions(prev => [...prev, {
      id: `ai-${Date.now()}`,
      title: '[AI] Establish mandatory code review policy',
      description: 'AI analysis suggests formalizing code review requirements to improve code quality and reduce risk of production incidents.',
      owner: 'CTO',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
    }]);
    setAiLoading(false);
    toast.success('AI suggested a new decision');
  };

  if (detailItem) {
    return <DecisionDetail decision={detailItem} onBack={() => setDetailItem(null)} onEdit={d => { setDetailItem(null); setEditingItem(d); setModalMode('edit'); setModalOpen(true); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Approved', value: stats.approved, color: 'text-success' },
          { label: 'Pending', value: stats.pending, color: 'text-primary' },
          { label: 'Rejected', value: stats.rejected, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiSuggest} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Suggest
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Decision
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No decisions match the current filter</p>
        ) : filtered.map(d => (
          <motion.div key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(d)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{d.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(d.status)}`}>{d.status}</span>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              {d.owner ? <OwnerBadge name={d.owner} size="sm" /> : <span className="text-[10px] text-muted-foreground">No owner</span>}
              <span className="text-[10px] text-muted-foreground">📅 {d.date}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <DecisionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} decision={editingItem} mode={modalMode} />
    </div>
  );
};

export default DecisionsPanel;
