import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Shield, AlertTriangle, User, X, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Risk } from '@/types/godmode';
import { useSotChat, useAiSuggestRisk } from '../../hooks/useGodMode';
import OwnerBadge from './OwnerBadge';
import OwnerSelect from './OwnerSelect';

type StatusFilter = 'all' | Risk['status'];
type ImpactFilter = 'all' | 'high' | 'medium' | 'low';

const statusColor = (s: string) =>
  s === 'mitigated' ? 'bg-green-500/10 text-green-400' :
    s === 'accepted' ? 'bg-yellow-500/10 text-yellow-400' :
      'bg-red-500/10 text-red-400';

const levelColor = (l: string) =>
  l === 'high' ? 'bg-red-500/10 text-red-400' :
    l === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
      'bg-white/5 text-slate-400';

const RiskModal = ({ open, onClose, onSave, risk, mode }: {
  open: boolean; onClose: () => void; onSave: (r: Risk) => void;
  risk?: Risk | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Risk, 'id'> = { content: '', impact: 'medium', likelihood: 'medium', status: 'open', owner: '', mitigation: '' };
  const [form, setForm] = useState<Omit<Risk, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const suggestRisk = useAiSuggestRisk();

  useEffect(() => {
    if (risk && mode === 'edit') { const { id, ...rest } = risk; setForm(rest); } else { setForm(empty); }
  }, [risk, mode, open]);

  const handleAiMitigation = async () => {
    if (!form.content) { toast.error('Add a description first'); return; }
    setAiLoading('mitigate');
    suggestRisk.mutate({ content: form.content, impact: form.impact, likelihood: form.likelihood }, {
      onSuccess: (d) => {
        if (d.suggested_mitigation) setForm(prev => ({ ...prev, mitigation: d.suggested_mitigation }));
        if (d.suggested_owner && !form.owner) setForm(prev => ({ ...prev, owner: d.suggested_owner }));
        setAiLoading(null);
        toast.success('AI suggested mitigation strategy');
      },
      onError: () => { setAiLoading(null); toast.error('AI mitigation failed'); },
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
                <h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{mode === 'create' ? 'New Risk' : 'Edit Risk'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--gm-surface-hover)] flex items-center justify-center"><X className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiMitigation} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'mitigate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Mitigation
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.content.trim()) return; onSave({ id: risk?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Risk *</label>
                  <input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" placeholder="Risk title..." required />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Mitigation Plan</label>
                  <textarea value={form.mitigation || ''} onChange={e => setForm({ ...form, mitigation: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[60px] resize-y" placeholder="Describe the risk..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Impact</label>
                    <select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value as Risk['impact'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Likelihood</label>
                    <select value={form.likelihood} onChange={e => setForm({ ...form, likelihood: e.target.value as Risk['likelihood'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Risk['status'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option>
                    </select>
                  </div>
                </div>
                <OwnerSelect value={form.owner || ''} onChange={v => setForm({ ...form, owner: v })} label="Owner" placeholder="Select risk owner..." />
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Mitigation</label>
                  <textarea value={form.mitigation || ''} onChange={e => setForm({ ...form, mitigation: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[60px] resize-y" placeholder="Mitigation strategy..." />
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

const RiskDetail = ({ risk, onBack, onEdit, onDelete }: { risk: Risk; onBack: () => void; onEdit: (r: Risk) => void; onDelete?: (id: string) => void }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const chatMut = useSotChat();

  const riskScore = risk.impact === 'high' && risk.likelihood === 'high' ? 'Critical' :
    (risk.impact === 'high' || risk.likelihood === 'high') ? 'High' :
      risk.impact === 'medium' && risk.likelihood === 'medium' ? 'Medium' : 'Low';

  const handleAnalyze = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: `Analyze this project risk and provide insights:\nRisk: "${risk.content}"\nImpact: ${risk.impact}, Likelihood: ${risk.likelihood}, Status: ${risk.status}\nOwner: ${risk.owner || 'none'}\nMitigation: ${risk.mitigation || 'none'}\nProvide: risk assessment, related risks, and recommendations.` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setAiInsights(resp.split('\n').filter(l => l.trim()));
        setAiLoading(false);
        toast.success('AI risk analysis complete');
      },
      onError: () => { setAiLoading(false); toast.error('AI analysis failed'); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[var(--gm-interactive-secondary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]"><ArrowLeft className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{risk.content || risk.description || '(untitled risk)'}</h2><p className="text-xs text-[var(--gm-text-tertiary)]">Risk #{risk.id?.substring(0, 8)}</p></div>
        <button onClick={handleAnalyze} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
        </button>
        <button onClick={() => onEdit(risk)} className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
        {onDelete && <button onClick={() => { onDelete(risk.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(risk.status)}`}>{risk.status || '—'}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${levelColor(risk.impact)}`}>Impact: {risk.impact || '—'}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${levelColor(risk.likelihood)}`}>Likelihood: {risk.likelihood || '—'}</span>
      </div>
      <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
        <h3 className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">Description</h3>
        <p className="text-sm text-[var(--gm-text-primary)]">{risk.mitigation || 'No mitigation plan defined'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase">Owner</span></div>
          {risk.owner ? <OwnerBadge name={risk.owner} size="md" /> : <p className="text-sm text-[var(--gm-text-tertiary)]">Unassigned</p>}
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase">Risk Score</span></div>
          <p className={`text-sm font-semibold ${riskScore === 'Critical' ? 'text-red-400' : riskScore === 'High' ? 'text-yellow-400' : 'text-[var(--gm-text-primary)]'}`}>{riskScore}</p>
        </div>
      </div>
      {risk.mitigation && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Mitigation</h3>
          <p className="text-sm text-[var(--gm-text-primary)]">{risk.mitigation}</p>
        </div>
      )}
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Analysis</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-[var(--gm-text-primary)]">{ins}</li>)}</ul>
        </motion.div>
      )}
    </motion.div>
  );
};

const RisksPanel = ({ initialData = [], onSave, onDelete }: { initialData?: Risk[]; onSave?: (r: Risk) => void; onDelete?: (id: string) => void }) => {
  const [risks, setRisks] = useState<Risk[]>(initialData);
  const chatMut = useSotChat();

  useEffect(() => {
    if (initialData) setRisks(initialData);
  }, [initialData]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Risk | null>(null);
  const [detailItem, setDetailItem] = useState<Risk | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = useMemo(() => {
    let result = risks;
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (impactFilter !== 'all') result = result.filter(r => r.impact === impactFilter);
    return result;
  }, [risks, statusFilter, impactFilter]);

  const stats = useMemo(() => ({
    total: risks.length,
    open: risks.filter(r => r.status === 'open').length,
    mitigated: risks.filter(r => r.status === 'mitigated').length,
    critical: risks.filter(r => r.impact === 'high' && r.likelihood === 'high').length,
  }), [risks]);

  const handleSave = (r: Risk) => {
    setRisks(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = r; return u; }
      return [...prev, r];
    });
    onSave?.(r);
  };

  const handleDelete = (id: string) => {
    setRisks(prev => prev.filter(x => x.id !== id));
    onDelete?.(id);
    toast.success('Risk deleted');
  };

  const handleAiScan = async () => {
    setAiLoading(true);
    chatMut.mutate({ message: 'Scan the project for potential risks not yet identified. Return on line 1: risk title. Line 2: brief description. Line 3: impact (high/medium/low). Line 4: likelihood (high/medium/low).' }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) {
          const lines = resp.split('\n').filter(l => l.trim());
          const title = lines[0]?.replace(/^["'\-*\d.]+\s*/, '').trim() || resp.trim();
          const desc = lines[1]?.replace(/^["'\-*\d.]+\s*/, '').trim() || '';
          const impMatch = resp.toLowerCase().match(/impact[:\s]*(high|medium|low)/);
          const likMatch = resp.toLowerCase().match(/likelihood[:\s]*(high|medium|low)/);
          const newR: Risk = {
            id: `ai-${Date.now()}`, content: title, mitigation: desc,
            impact: (impMatch?.[1] as Risk['impact']) || 'medium',
            likelihood: (likMatch?.[1] as Risk['likelihood']) || 'medium',
            status: 'open', owner: '',
          };
          setRisks(prev => [...prev, newR]);
          onSave?.(newR);
        }
        setAiLoading(false);
        toast.success('AI identified a new risk');
      },
      onError: () => { setAiLoading(false); toast.error('AI risk scan failed'); },
    });
  };

  if (detailItem) {
    return <RiskDetail risk={detailItem} onBack={() => setDetailItem(null)} onEdit={r => { setDetailItem(null); setEditingItem(r); setModalMode('edit'); setModalOpen(true); }} onDelete={handleDelete} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--gm-text-primary)]' },
          { label: 'Open', value: stats.open, color: 'text-red-400' },
          { label: 'Mitigated', value: stats.mitigated, color: 'text-green-400' },
          { label: 'Critical', value: stats.critical, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
          <option value="all">All statuses</option><option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option>
        </select>
        <select value={impactFilter} onChange={e => setImpactFilter(e.target.value as ImpactFilter)} className="bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-xs text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
          <option value="all">All impacts</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiScan} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Risk Scan
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Risk
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-8">No risks match the current filter</p>
        ) : filtered.map(r => (
          <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-3.5 hover:border-blue-500/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(r)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--gm-text-primary)] truncate group-hover:text-blue-400 transition-colors">{r.content || r.description || '(untitled risk)'}</p>
                <p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5 line-clamp-1">{r.mitigation || ''}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{r.status || '—'}</span>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${levelColor(r.impact)}`}>Impact: {r.impact || '—'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${levelColor(r.likelihood)}`}>Likelihood: {r.likelihood || '—'}</span>
              </div>
              {r.owner ? <OwnerBadge name={r.owner} size="sm" /> : <span className="text-[10px] text-[var(--gm-text-tertiary)]">No owner</span>}
            </div>
            {r.mitigation && <p className="text-xs text-green-400 mt-2 line-clamp-1">{r.mitigation}</p>}
          </motion.div>
        ))}
      </div>
      <RiskModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} risk={editingItem} mode={modalMode} />
    </div>
  );
};

export default RisksPanel;
