import { useState } from 'react';
import {
  Loader2, Layers, GitBranch, Sparkles, CheckCircle, XCircle,
  Clock, Plus, AlertTriangle, BarChart3, Cpu, Settings, Trash2,
  Wand2, RefreshCw, History, Diff, Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useOntologySchema, useOntologyStats, useOntologyEntities, useOntologyRelations,
  useOntologySuggestions, useOntologyWorkerStatus, useOntologyCompliance,
  useOntologyApproveSuggestion, useOntologyRejectSuggestion,
  useOntologyAddEntityType, useOntologyAddRelationType,
  useOntologyWorkerTrigger, useOntologyForceSync,
  useOntologyAutoApprove, useOntologyAnalyzeGraph, useOntologyChanges,
  useOntologyDiff, useOntologyCleanup, useOntologyUnused, useOntologyInferRelationships,
  useOntologySyncStatus,
} from '../../hooks/useGodMode';
import { cn } from '../../lib/utils';

type Tab = 'entities' | 'relations' | 'suggestions' | 'stats' | 'jobs' | 'changes' | 'cleanup';

const NODE_COLORS: Record<string, string> = {
  Project: '#6366f1', Person: '#ec4899', Team: '#8b5cf6',
  Document: '#06b6d4', Fact: '#f59e0b', Decision: '#a855f7',
  Risk: '#ef4444', Action: '#22c55e', Question: '#3b82f6',
  Email: '#f97316', Contact: '#ec4899', Sprint: '#14b8a6',
};

export default function GraphOntology() {
  const [tab, setTab] = useState<Tab>('entities');
  const [newEntityName, setNewEntityName] = useState('');
  const [newRelName, setNewRelName] = useState('');

  const schema = useOntologySchema();
  const stats = useOntologyStats();
  const entitiesQ = useOntologyEntities();
  const relationsQ = useOntologyRelations();
  const suggestionsQ = useOntologySuggestions();
  const workerQ = useOntologyWorkerStatus();
  const complianceQ = useOntologyCompliance();

  const changesQ = useOntologyChanges();
  const diffQ = useOntologyDiff();
  const unusedQ = useOntologyUnused();
  const syncStatusQ = useOntologySyncStatus();

  const approve = useOntologyApproveSuggestion();
  const reject = useOntologyRejectSuggestion();
  const addEntity = useOntologyAddEntityType();
  const addRelation = useOntologyAddRelationType();
  const triggerWorker = useOntologyWorkerTrigger();
  const forceSync = useOntologyForceSync();
  const autoApprove = useOntologyAutoApprove();
  const analyzeGraph = useOntologyAnalyzeGraph();
  const cleanup = useOntologyCleanup();
  const inferRels = useOntologyInferRelationships();

  const entities = ((entitiesQ.data as Record<string, unknown>)?.entities || (entitiesQ.data as Record<string, unknown>)?.types || []) as Array<Record<string, unknown>>;
  const relations = ((relationsQ.data as Record<string, unknown>)?.relations || (relationsQ.data as Record<string, unknown>)?.types || []) as Array<Record<string, unknown>>;
  const suggestions = ((suggestionsQ.data as Record<string, unknown>)?.suggestions || []) as Array<Record<string, unknown>>;
  const statsData = (stats.data || {}) as Record<string, unknown>;
  const worker = (workerQ.data || {}) as Record<string, unknown>;
  const compliance = ((complianceQ.data as Record<string, unknown>)?.compliance || complianceQ.data || {}) as Record<string, unknown>;
  const complianceIssues = (compliance.issues || compliance.violations || []) as Array<Record<string, unknown>>;
  const changes = ((changesQ.data as Record<string, unknown>)?.changes || changesQ.data || []) as Array<Record<string, unknown>>;
  const diff = (diffQ.data || {}) as Record<string, unknown>;
  const unused = ((unusedQ.data as Record<string, unknown>)?.unused || unusedQ.data || {}) as Record<string, unknown>;
  const unusedEntities = (unused.entities || []) as string[];
  const unusedRelations = (unused.relations || []) as string[];
  const syncStatusData = (syncStatusQ.data || {}) as Record<string, unknown>;

  const tabs: { key: Tab; label: string; icon: typeof Layers; count?: number }[] = [
    { key: 'entities', label: 'Entities', icon: Cpu, count: entities.length },
    { key: 'relations', label: 'Relations', icon: GitBranch, count: relations.length },
    { key: 'suggestions', label: 'AI Suggestions', icon: Sparkles, count: suggestions.length },
    { key: 'stats', label: 'Stats', icon: BarChart3 },
    { key: 'changes', label: 'Changes', icon: History },
    { key: 'cleanup', label: 'Cleanup', icon: Trash2 },
    { key: 'jobs', label: 'Jobs', icon: Settings },
  ];

  const handleAddEntity = () => {
    if (!newEntityName.trim()) return;
    addEntity.mutate({ name: newEntityName.trim() }, {
      onSuccess: () => { toast.success('Entity type added'); setNewEntityName(''); },
      onError: () => toast.error('Failed to add entity type'),
    });
  };

  const handleAddRelation = () => {
    if (!newRelName.trim()) return;
    addRelation.mutate({ name: newRelName.trim() }, {
      onSuccess: () => { toast.success('Relation type added'); setNewRelName(''); },
      onError: () => toast.error('Failed to add relation type'),
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex gap-1 px-4 border-b border-gm-border-primary bg-gm-surface-secondary shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium border-b-2 transition-colors',
                tab === t.key ? 'border-gm-interactive-primary text-gm-interactive-primary' : 'border-transparent text-gm-text-tertiary hover:text-gm-text-primary')}>
              <Icon className="w-3 h-3" /> {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'entities' && (
          <>
            <div className="flex gap-2 items-center">
              <input value={newEntityName} onChange={e => setNewEntityName(e.target.value)} placeholder="New entity type..."
                className="flex-1 bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
                onKeyDown={e => e.key === 'Enter' && handleAddEntity()} />
              <button onClick={handleAddEntity} disabled={addEntity.isPending || !newEntityName.trim()}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {entitiesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <div className="grid grid-cols-3 gap-2">
                {entities.map((e, i) => {
                  const name = String(e.name || e.type || e.label || '');
                  const count = Number(e.count || e.instances || 0);
                  const props = (e.properties || []) as Array<Record<string, unknown>>;
                  const color = NODE_COLORS[name] || (e.color ? String(e.color) : '#64748b');
                  return (
                    <div key={i} className="bg-[var(--gm-surface-hover)] rounded-xl p-3 border border-gm-border-primary hover:border-blue-600/20 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-semibold text-gm-text-primary">{name}</span>
                        {count > 0 && <span className="text-[10px] text-gm-text-tertiary ml-auto">{count}</span>}
                      </div>
                      {props.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {props.slice(0, 4).map((p, j) => (
                            <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">{String(p.name || p)}</span>
                          ))}
                          {props.length > 4 && <span className="text-[9px] text-gm-text-tertiary">+{props.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'relations' && (
          <>
            <div className="flex gap-2 items-center">
              <input value={newRelName} onChange={e => setNewRelName(e.target.value)} placeholder="New relation type..."
                className="flex-1 bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
                onKeyDown={e => e.key === 'Enter' && handleAddRelation()} />
              <button onClick={handleAddRelation} disabled={addRelation.isPending || !newRelName.trim()}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {relationsQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <div className="space-y-1.5">
                {relations.map((r, i) => {
                  const name = String(r.name || r.type || r.label || '');
                  const count = Number(r.count || r.instances || 0);
                  const from = String(r.from || r.source || r.from_type || '');
                  const to = String(r.to || r.target || r.to_type || '');
                  return (
                    <div key={i} className="flex items-center gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-2.5">
                      {from && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${NODE_COLORS[from] || '#64748b'}20`, color: NODE_COLORS[from] || '#64748b' }}>{from}</span>}
                      <span className="text-xs font-medium text-gm-interactive-primary">→ {name.replace(/_/g, ' ')} →</span>
                      {to && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${NODE_COLORS[to] || '#64748b'}20`, color: NODE_COLORS[to] || '#64748b' }}>{to}</span>}
                      {count > 0 && <span className="text-[10px] text-gm-text-tertiary ml-auto">{count}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'suggestions' && (
          <>
            <div className="flex gap-2 items-center">
              <button onClick={() => analyzeGraph.mutate(undefined, { onSuccess: () => toast.success('Graph analysis started — new suggestions will appear shortly') })}
                disabled={analyzeGraph.isPending}
                className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-gm-interactive-primary text-xs font-medium hover:bg-blue-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {analyzeGraph.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} Analyze Graph
              </button>
              <button onClick={() => autoApprove.mutate({ minConfidence: 0.8 }, { onSuccess: () => toast.success('High-confidence suggestions auto-approved') })}
                disabled={autoApprove.isPending || suggestions.length === 0}
                className="px-3 py-1.5 rounded-lg bg-gm-status-success-bg text-gm-status-success text-xs font-medium hover:bg-green-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {autoApprove.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Auto-Approve (≥80%)
              </button>
              <button onClick={() => inferRels.mutate(undefined, { onSuccess: () => toast.success('Relationship inference started') })}
                disabled={inferRels.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {inferRels.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />} Infer Relations
              </button>
            </div>
            {suggestionsQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : suggestions.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-xs text-gm-text-tertiary">No AI suggestions pending</p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.map((s, i) => {
                  const type = String(s.type || s.suggestion_type || '');
                  const name = String(s.name || s.suggested_name || s.content || '');
                  const reason = String(s.reason || s.explanation || '');
                  const confidence = Number(s.confidence || 0);
                  return (
                    <div key={i} className="bg-[var(--gm-surface-hover)] rounded-xl p-3 border border-gm-border-primary">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-gm-interactive-primary shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gm-text-primary">{name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary capitalize">{type}</span>
                            {confidence > 0 && <span className="text-[10px] text-gm-text-tertiary">{Math.round(confidence * 100)}%</span>}
                          </div>
                          {reason && <p className="text-[10px] text-gm-text-tertiary mt-1">{reason}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => approve.mutate({ id: String(s.id) }, { onSuccess: () => toast.success('Approved') })} disabled={approve.isPending}
                            className="p-1.5 rounded-lg bg-gm-status-success-bg text-gm-status-success hover:bg-green-500/20 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => reject.mutate({ id: String(s.id) }, { onSuccess: () => toast.success('Rejected') })} disabled={reject.isPending}
                            className="p-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger hover:bg-red-500/20 transition-colors">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
            {stats.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(statsData).filter(([, v]) => typeof v === 'number').slice(0, 9).map(([key, val]) => (
                    <div key={key} className="bg-gm-surface-secondary rounded-xl p-3 border border-gm-border-primary">
                      <p className="text-lg font-bold text-gm-text-primary">{String(val)}</p>
                      <p className="text-[10px] text-gm-text-tertiary capitalize">{key.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>

                {complianceIssues.length > 0 && (
                  <div className="bg-[var(--gm-status-warning-bg)] border border-yellow-500/20 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-gm-status-warning mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Compliance Issues ({complianceIssues.length})
                    </h4>
                    <div className="space-y-1.5">
                      {complianceIssues.slice(0, 5).map((issue, i) => (
                        <p key={i} className="text-xs text-gm-text-primary">{String(issue.message || issue.description || JSON.stringify(issue))}</p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'changes' && (
          <div className="space-y-4">
            {/* Diff */}
            {!diffQ.isLoading && Object.keys(diff).length > 0 && (
              <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                <h4 className="text-xs font-semibold text-gm-text-primary mb-3 flex items-center gap-1.5"><Diff className="w-3.5 h-3.5" /> Ontology Diff</h4>
                <div className="space-y-2 text-xs">
                  {Object.entries(diff).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-gm-text-tertiary capitalize font-medium">{k.replace(/_/g, ' ')}</span>
                      <pre className="text-[10px] text-gm-text-primary mt-1 bg-gm-surface-secondary rounded-lg p-2 overflow-x-auto">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Change Log */}
            {changesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : changes.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-xs text-gm-text-tertiary">No changes recorded</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {changes.slice(0, 30).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-2.5 border border-gm-border-primary">
                    <div className={cn('w-2 h-2 rounded-full mt-1 shrink-0',
                      String(c.action || c.type) === 'add' ? 'bg-gm-status-success' :
                      String(c.action || c.type) === 'remove' ? 'bg-gm-status-danger' : 'bg-gm-status-warning')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gm-text-primary">{String(c.description || c.message || c.action || '')}</p>
                      <p className="text-[10px] text-gm-text-tertiary">{String(c.target || c.entity || '')} · {c.created_at ? new Date(String(c.created_at)).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sync Status */}
            {!syncStatusQ.isLoading && Object.keys(syncStatusData).length > 0 && (
              <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                <h4 className="text-xs font-semibold text-gm-text-primary mb-2 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Sync Status</h4>
                <div className="space-y-1 text-xs">
                  {Object.entries(syncStatusData).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-gm-text-tertiary capitalize w-28 shrink-0">{k.replace(/_/g, ' ')}</span>
                      <span className="text-gm-text-primary text-[10px]">{v == null ? '—' : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'cleanup' && (
          <div className="space-y-4">
            {/* Unused Types */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-gm-status-warning" /> Unused Types</h4>
              {unusedQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  {unusedEntities.length > 0 ? (
                    <div>
                      <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-1.5">Entities ({unusedEntities.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {unusedEntities.map(e => (
                          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium">{e}</span>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-xs text-gm-text-tertiary">All entity types in use</p>}

                  {unusedRelations.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-1.5">Relations ({unusedRelations.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {unusedRelations.map(r => (
                          <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cleanup Action */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Cleanup Unused</h4>
              <p className="text-[10px] text-gm-text-tertiary">Remove unused entity and relation types from the ontology schema.</p>
              <div className="flex gap-2">
                {unusedEntities.length > 0 && (
                  <button
                    onClick={() => cleanup.mutate({ entities: unusedEntities }, { onSuccess: () => toast.success('Unused entities removed') })}
                    disabled={cleanup.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {cleanup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove Entities
                  </button>
                )}
                {unusedRelations.length > 0 && (
                  <button
                    onClick={() => cleanup.mutate({ relations: unusedRelations }, { onSuccess: () => toast.success('Unused relations removed') })}
                    disabled={cleanup.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {cleanup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove Relations
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'jobs' && (
          <div className="space-y-4">
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <h4 className="text-xs font-semibold text-gm-text-primary mb-2">Background Worker</h4>
              {workerQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="space-y-1 text-xs text-gm-text-secondary">
                  <p>Status: <span className={cn('font-medium', worker.status === 'running' || worker.running ? 'text-gm-status-success' : 'text-gm-text-tertiary')}>{String(worker.status || (worker.running ? 'Running' : 'Idle'))}</span></p>
                  {worker.lastRun && <p>Last run: {new Date(String(worker.lastRun || worker.last_run)).toLocaleString()}</p>}
                  {worker.nextRun && <p>Next run: {new Date(String(worker.nextRun || worker.next_run)).toLocaleString()}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => triggerWorker.mutate(undefined, { onSuccess: () => toast.success('Worker triggered') })} disabled={triggerWorker.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {triggerWorker.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Trigger Worker
              </button>
              <button onClick={() => forceSync.mutate(undefined, { onSuccess: () => toast.success('Sync triggered') })} disabled={forceSync.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {forceSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />} Force Sync
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
