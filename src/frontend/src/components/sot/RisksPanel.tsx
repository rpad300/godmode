/**
 * Purpose:
 *   Self-contained panel for managing project risks within the Source of
 *   Truth module. Includes inline modal, detail view, and list with
 *   status/impact filtering and AI-powered risk scanning/analysis.
 *
 * Responsibilities:
 *   - RisksPanel (main): list view with dual filters (status + impact),
 *     stats strip (total, open, mitigated, critical), CRUD, AI Risk Scan
 *   - RiskDetail: detail view with computed risk score (Critical/High/
 *     Medium/Low based on impact x likelihood matrix), mitigation display,
 *     and AI analysis
 *   - RiskModal: create/edit form with "AI Mitigation" button that
 *     generates mitigation strategy suggestions
 *   - Impact and likelihood badges with color-coded severity
 *
 * Key dependencies:
 *   - OwnerBadge: risk owner display
 *   - framer-motion: animations
 *   - sonner (toast): user notifications
 *   - Risk (godmode types): risk data shape with impact/likelihood/mitigation
 *
 * Side effects:
 *   - None (state is local; parent notified via onSave/onDelete)
 *
 * Notes:
 *   - Same `useState()` initialization pattern; form may not reset
 *     correctly on edit target changes.
 *   - Risk score computation uses a simple matrix: high+high=Critical,
 *     either high=High, both medium=Medium, else Low.
 *   - AI features are simulated with hardcoded responses.
 */
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, ArrowLeft, Edit2, Shield, AlertTriangle, User, X, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Risk } from '@/types/godmode';
import OwnerBadge from './OwnerBadge';

type StatusFilter = 'all' | Risk['status'];
type ImpactFilter = 'all' | 'high' | 'medium' | 'low';

const statusColor = (s: string) =>
  s === 'mitigated' ? 'bg-success/10 text-success' :
    s === 'accepted' ? 'bg-warning/10 text-warning' :
      'bg-destructive/10 text-destructive';

const levelColor = (l: string) =>
  l === 'high' ? 'bg-destructive/10 text-destructive' :
    l === 'medium' ? 'bg-warning/10 text-warning' :
      'bg-muted text-muted-foreground';

// ─── Modal ───
const RiskModal = ({ open, onClose, onSave, risk, mode }: {
  open: boolean; onClose: () => void; onSave: (r: Risk) => void;
  risk?: Risk | null; mode: 'create' | 'edit';
}) => {
  const empty: Omit<Risk, 'id'> = { title: '', description: '', impact: 'medium', likelihood: 'medium', status: 'open', owner: '', mitigation: '' };
  const [form, setForm] = useState<Omit<Risk, 'id'>>(empty);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  useState(() => {
    if (risk && mode === 'edit') { const { id, ...rest } = risk; setForm(rest); } else { setForm(empty); }
  });

  const handleAiMitigation = async () => {
    if (!form.title) { toast.error('Add a title first'); return; }
    setAiLoading('mitigate');
    await new Promise(r => setTimeout(r, 1500));
    setForm(prev => ({ ...prev, mitigation: `[AI] For "${prev.title}": Implement redundancy measures, establish monitoring alerts, create incident response playbook, and schedule quarterly reviews.` }));
    setAiLoading(null);
    toast.success('AI suggested mitigation strategy');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">{mode === 'create' ? 'New Risk' : 'Edit Risk'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={handleAiMitigation} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50">
                  {aiLoading === 'mitigate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} AI Mitigation
                </button>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (!form.title.trim()) return; onSave({ id: risk?.id || String(Date.now()), ...form }); onClose(); }} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Risk title..." required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px] resize-y" placeholder="Describe the risk..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Impact</label>
                    <select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value as Risk['impact'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Likelihood</label>
                    <select value={form.likelihood} onChange={e => setForm({ ...form, likelihood: e.target.value as Risk['likelihood'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Risk['status'] })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</label>
                  <input value={form.owner || ''} onChange={e => setForm({ ...form, owner: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Risk owner..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitigation</label>
                  <textarea value={form.mitigation || ''} onChange={e => setForm({ ...form, mitigation: e.target.value })} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px] resize-y" placeholder="Mitigation strategy..." />
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
const RiskDetail = ({ risk, onBack, onEdit, onDelete }: { risk: Risk; onBack: () => void; onEdit: (r: Risk) => void; onDelete?: (id: string) => void }) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const riskScore = risk.impact === 'high' && risk.likelihood === 'high' ? 'Critical' :
    (risk.impact === 'high' || risk.likelihood === 'high') ? 'High' :
      risk.impact === 'medium' && risk.likelihood === 'medium' ? 'Medium' : 'Low';

  const handleAnalyze = async () => {
    setAiLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setAiInsights([
      `Risk score: ${riskScore} — ${riskScore === 'Critical' ? 'Requires immediate action' : 'Monitor regularly'}.`,
      risk.mitigation ? `Mitigation in place: "${risk.mitigation}" — verify effectiveness quarterly.` : 'No mitigation defined — high priority to establish one.',
      `Found ${Math.floor(Math.random() * 3) + 1} related risks in the knowledge base that may compound this issue.`,
    ]);
    setAiLoading(false);
    toast.success('AI risk analysis complete');
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
        <div className="flex-1"><h2 className="text-lg font-semibold text-foreground">{risk.title}</h2><p className="text-xs text-muted-foreground">Risk #{risk.id}</p></div>
        <button onClick={handleAnalyze} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
        </button>
        <button onClick={() => onEdit(risk)} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
        {onDelete && <button onClick={() => { onDelete(risk.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
      </div>
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(risk.status)}`}>{risk.status}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${levelColor(risk.impact)}`}>Impact: {risk.impact}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${levelColor(risk.likelihood)}`}>Likelihood: {risk.likelihood}</span>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
        <p className="text-sm text-foreground">{risk.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase">Owner</span></div>
          {risk.owner ? <OwnerBadge name={risk.owner} size="md" /> : <p className="text-sm text-muted-foreground">Unassigned</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground uppercase">Risk Score</span></div>
          <p className={`text-sm font-semibold ${riskScore === 'Critical' ? 'text-destructive' : riskScore === 'High' ? 'text-warning' : 'text-foreground'}`}>{riskScore}</p>
        </div>
      </div>
      {risk.mitigation && (
        <div className="bg-success/5 border border-success/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-success uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Mitigation</h3>
          <p className="text-sm text-foreground">{risk.mitigation}</p>
        </div>
      )}
      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Analysis</h3>
          <ul className="space-y-1.5">{aiInsights.map((ins, i) => <li key={i} className="text-sm text-foreground">{ins}</li>)}</ul>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─── Main Panel ───
const RisksPanel = ({ initialData = [], onSave, onDelete }: { initialData?: Risk[]; onSave?: (r: Risk) => void; onDelete?: (id: string) => void }) => {
  const [risks, setRisks] = useState<Risk[]>(initialData);

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
    await new Promise(r => setTimeout(r, 1800));
    setRisks(prev => [...prev, {
      id: `ai-${Date.now()}`,
      title: '[AI] Data privacy compliance gap',
      description: 'AI detected potential GDPR compliance gap in data processing pipeline — user consent flow incomplete.',
      impact: 'high',
      likelihood: 'medium',
      status: 'open',
      owner: 'Security Team',
    }]);
    setAiLoading(false);
    toast.success('AI identified a new risk');
  };

  if (detailItem) {
    return <RiskDetail risk={detailItem} onBack={() => setDetailItem(null)} onEdit={r => { setDetailItem(null); setEditingItem(r); setModalMode('edit'); setModalOpen(true); }} onDelete={handleDelete} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Open', value: stats.open, color: 'text-destructive' },
          { label: 'Mitigated', value: stats.mitigated, color: 'text-success' },
          { label: 'Critical', value: stats.critical, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All statuses</option><option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option>
        </select>
        <select value={impactFilter} onChange={e => setImpactFilter(e.target.value as ImpactFilter)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All impacts</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <div className="flex-1" />
        <button onClick={handleAiScan} disabled={aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Risk Scan
        </button>
        <button onClick={() => { setEditingItem(null); setModalMode('create'); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Risk
        </button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No risks match the current filter</p>
        ) : filtered.map(r => (
          <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => setDetailItem(r)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.description}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{r.status}</span>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${levelColor(r.impact)}`}>Impact: {r.impact}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${levelColor(r.likelihood)}`}>Likelihood: {r.likelihood}</span>
              </div>
              {r.owner ? <OwnerBadge name={r.owner} size="sm" /> : <span className="text-[10px] text-muted-foreground">No owner</span>}
            </div>
            {r.mitigation && <p className="text-xs text-success mt-2 line-clamp-1">🛡️ {r.mitigation}</p>}
          </motion.div>
        ))}
      </div>
      <RiskModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} risk={editingItem} mode={modalMode} />
    </div>
  );
};

export default RisksPanel;
