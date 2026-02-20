import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Calendar, User, X, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Decision } from '@/types/godmode';
import { useSotChat, useAiSuggestDecision, useAiSuggestDecisionOwner } from '../../hooks/useGodMode';
import OwnerBadge from './OwnerBadge';
import OwnerSelect from './OwnerSelect';

type StatusFilter = 'all' | Decision['status'];

const statusColor = (s: string) =>
  s === 'approved' ? 'bg-green-500/10 text-green-400' :
    s === 'rejected' ? 'bg-red-500/10 text-red-400' :
      'bg-blue-500/10 text-blue-400';

const DecisionModal = ({ open, onClose, onSave, decision, mode }: {
  open: boolean; onClose: () => void; onSave: (d: Decision) => void;
  decision?: Decision | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Decision, 'id'> = { content: '', rationale: '', owner: '', decision_date: new Date().toISOString().split('T')[0], status: 'pending' };
  const [form, setForm] = useState<Omit<Decision, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const suggestDecision = useAiSuggestDecision();
  const suggestOwner = useAiSuggestDecisionOwner();

  useEffect(() => {
    if (decision && mode === 'edit') { const { id, ...rest } = decision; setForm(rest); } else { setForm(empty); }
  }, [decision, mode, open]);

  const handleAiImpact = async () => {
    if (!form.content) { toast.error('Add a title first'); return; }
    setAiLoading('impact');
    suggestDecision.mutate({ content: form.content, rationale: form.rationale }, {
      onSuccess: (d) => {
        const parts: string[] = [];
        if (d.impact_summary) parts.push(d.impact_summary);
        if (d.rationale && form.rationale !== d.rationale) parts.push(d.rationale);
        if (d.summary) parts.push(d.summary);
        if (parts.length > 0) {
          const addition = parts.join('\n\n');
          setForm(prev => ({ ...prev, rationale: prev.rationale ? `${prev.rationale}\n\n${addition}` : addition }));
        }
        setAiLoading(null);
        toast.success('AI impact analysis added');
      },
      onError: () => { setAiLoading(null); toast.error('AI impact analysis failed'); },
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
                <h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{mode === 'create' ? 'New Decision' : 'Edit Decision'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center"><X className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiImpact} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'impact' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Impact Analysis
                </button>
                <button type="button" disabled={suggestOwner.isPending || !form.content.trim()}
                  onClick={() => suggestOwner.mutate({ content: form.content, rationale: form.rationale }, {
                    onSuccess: (d) => { const owners = d?.suggested_owners; if (owners?.[0]) { setForm(f => ({ ...f, owner: String(owners[0].name || owners[0].id || '') })); toast.success('Owner suggested by AI'); } },
                    onError: () => toast.error('Owner suggestion failed'),
                  })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 disabled:opacity-50">
                  {suggestOwner.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Suggest Owner
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.content.trim()) return; onSave({ id: decision?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Title *</label>
                  <input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" placeholder="Decision title..." required />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Rationale / Description</label>
                  <textarea value={form.rationale || ''} onChange={e => setForm({ ...form, rationale: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[80px] resize-y" placeholder="Describe the decision and rationale..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <OwnerSelect value={form.owner || ''} onChange={v => setForm({ ...form, owner: v })} label="Owner" placeholder="Decision maker..." />
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Date</label>
                    <input type="date" value={form.decision_date || ''} onChange={e => setForm({ ...form, decision_date: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Decision['status'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="pending">Pending</option><option value="active">Active</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                    </select>
                  </div>
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

const DecisionDetail = ({ decision, onBack, onEdit, onDelete }: { decision: Decision; onBack: () => void; onEdit: (d: Decision) => void; onDelete?: (id: string) => void }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const chatMut = useSotChat();

  const handleAnalyze = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: `Analyze this project decision and provide insights:\nTitle: "${decision.content}"\nRationale: "${decision.rationale || ''}"\nOwner: ${decision.owner || 'unknown'}\nDate: ${decision.decision_date || ''}\nStatus: ${decision.status}\nProvide: impact assessment, related actions/risks, and recommendations.` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setAiInsights(resp.split('\n').filter(l => l.trim()));
        setAiLoading(false);
        toast.success('AI analysis complete');
      },
      onError: () => { setAiLoading(false); toast.error('AI analysis failed'); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[var(--gm-interactive-secondary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]"><ArrowLeft className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{decision.content || decision.decision || decision.summary || '(untitled decision)'}</h2><p className="text-xs text-[var(--gm-text-tertiary)]">Decision #{decision.id?.substring(0, 8)}</p></div>
        <button onClick={handleAnalyze} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
        </button>
        <button onClick={() => onEdit(decision)} className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
        {onDelete && <button onClick={() => { onDelete(decision.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(decision.status)}`}>{decision.status || '—'}</span>
      </div>
      {decision.rationale && (
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <h3 className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">Rationale</h3>
          <p className="text-sm text-[var(--gm-text-primary)] whitespace-pre-wrap">{decision.rationale}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase">Decision Maker</span></div>
          {decision.owner ? <OwnerBadge name={decision.owner} size="md" /> : <p className="text-sm text-[var(--gm-text-tertiary)]">Unknown</p>}
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Calendar className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase">Date</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{decision.decision_date || '—'}</p>
        </div>
      </div>
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Insights</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-[var(--gm-text-primary)]">{ins}</li>)}</ul>
        </motion.div>
      )}
    </motion.div>
  );
};

const DecisionsPanel = ({ initialData = [], onSave, onDelete }: { initialData?: Decision[]; onSave?: (d: Decision) => void; onDelete?: (id: string) => void }) => {
  const [decisions, setDecisions] = useState<Decision[]>(initialData);
  const chatMut = useSotChat();

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
    active: decisions.filter(d => d.status === 'active').length,
    rejected: decisions.filter(d => d.status === 'rejected').length,
  }), [decisions]);

  const handleSave = (d: Decision) => {
    setDecisions(prev => {
      const idx = prev.findIndex(x => x.id === d.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = d; return u; }
      return [...prev, d];
    });
    onSave?.(d);
  };

  const handleDelete = (id: string) => {
    setDecisions(prev => prev.filter(x => x.id !== id));
    onDelete?.(id);
    toast.success('Decision deleted');
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: 'Based on the current project state, suggest one important decision that should be made. Return on line 1: the decision title. Line 2: brief rationale.' }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) {
          const lines = resp.split('\n').filter(l => l.trim());
          const content = lines[0]?.replace(/^["'\-*\d.]+\s*/, '').trim() || resp.trim();
          const rationale = lines.slice(1).join('\n').trim();
          const newD: Decision = {
            id: `ai-${Date.now()}`, content, rationale,
            owner: '', decision_date: new Date().toISOString().split('T')[0], status: 'pending',
          };
          setDecisions(prev => [...prev, newD]);
          onSave?.(newD);
        }
        setAiLoading(false);
        toast.success('AI suggested a new decision');
      },
      onError: () => { setAiLoading(false); toast.error('AI suggestion failed'); },
    });
  };

  if (detailItem) {
    return <DecisionDetail decision={detailItem} onBack={() => setDetailItem(null)} onEdit={d => { setDetailItem(null); setEditingItem(d); setModalMode('edit'); setModalOpen(true); }} onDelete={handleDelete} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--gm-text-primary)]' },
          { label: 'Approved', value: stats.approved, color: 'text-green-400' },
          { label: 'Pending', value: stats.pending, color: 'text-primary' },
          { label: 'Active', value: stats.active, color: 'text-purple-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
          <option value="all">All statuses</option><option value="approved">Approved</option><option value="active">Active</option><option value="pending">Pending</option><option value="rejected">Rejected</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiSuggest} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Suggest
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Decision
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-8">No decisions match the current filter</p>
        ) : filtered.map(d => (
          <motion.div key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3.5 hover:border-blue-500/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(d)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--gm-text-primary)] truncate group-hover:text-blue-400 transition-colors">{d.content || d.decision || d.summary || d.context || '(no title)'}</p>
                <p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5 line-clamp-1">{d.rationale || d.context || ''}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(d.status)}`}>{d.status || '—'}</span>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              {d.owner ? <OwnerBadge name={d.owner} size="sm" /> : <span className="text-[10px] text-[var(--gm-text-tertiary)]">No owner</span>}
              <span className="text-[10px] text-[var(--gm-text-tertiary)]">{d.decision_date || ''}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <DecisionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} decision={editingItem} mode={modalMode} />
    </div>
  );
};

export default DecisionsPanel;
