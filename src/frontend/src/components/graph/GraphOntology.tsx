import { useState, useMemo } from 'react';
import {
  Loader2, Layers, GitBranch, Sparkles, CheckCircle, XCircle,
  Clock, Plus, AlertTriangle, BarChart3, Cpu, Settings, Trash2,
  Wand2, RefreshCw, History, Brain, Search,
  Play, Power, PowerOff, Wrench, Shield, Merge, Download,
  Activity, Zap, Network, Info, FlaskConical, FileText, Eye,
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
  useOntologySyncStatus, useOntologyJobs, useOntologyToggleJob,
  useOntologyExtractFromGraph, useOntologyMerge, useOntologyWorkerLog,
  useOntologyEnrichSuggestion,
  useInferenceRules, useInferenceStats, useRunInferenceRule,
  useEmbeddingsDashboard, useRegenerateEmbeddings,
  useSharedOntology, useToggleEntityShared,
  useOntologyVersions,
  useValidateEntity, useExtractFromText, useEnrichEntity,
} from '../../hooks/useGodMode';
import { cn } from '../../lib/utils';

type Tab = 'entities' | 'relations' | 'graph' | 'suggestions' | 'stats' | 'tools' | 'jobs' | 'changes' | 'inference' | 'embeddings' | 'shared' | 'versions' | 'test';

import { NODE_COLORS } from '@/lib/graph-transformer';

function getColor(name: string, fallback?: string): string {
  return NODE_COLORS[name] || fallback || '#64748b';
}

// ── Sync Status Badge ────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: Record<string, unknown> }) {
  const graphConnected = Boolean(status.graphConnected);
  const isListening = Boolean(status.isListening);
  const isSyncing = Boolean(status.syncInProgress);
  const isConnected = graphConnected || isListening;
  const source = status.ontologySource ? String(status.ontologySource) : '';
  const label = isSyncing ? 'Syncing' : isConnected ? (source === 'supabase' ? 'Synced' : 'Connected') : 'Disconnected';
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium',
      isConnected ? 'bg-gm-status-success-bg text-gm-status-success' :
      isSyncing ? 'bg-gm-status-warning-bg text-gm-status-warning' :
      'bg-gm-surface-secondary text-gm-text-tertiary'
    )}>
      <div className={cn('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-gm-status-success' : isSyncing ? 'bg-gm-status-warning animate-pulse' : 'bg-gm-text-tertiary')} />
      {label}
    </div>
  );
}

// ── Schema Version Badge ─────────────────────────────────────────────────────

function VersionBadge({ schema }: { schema: Record<string, unknown> }) {
  const version = schema.version || schema.schema_version || '';
  const entityCount = Object.keys((schema.entityTypes || schema.entities || {}) as Record<string, unknown>).length;
  const relCount = Object.keys((schema.relationTypes || schema.relations || {}) as Record<string, unknown>).length;
  return (
    <div className="flex items-center gap-2 text-[10px] text-gm-text-tertiary">
      {version && <span>v{String(version)}</span>}
      <span>{entityCount}E</span>
      <span>{relCount}R</span>
    </div>
  );
}

// ── Entity Detail Panel ──────────────────────────────────────────────────────

function EntityDetailPanel({ entity, onClose }: { entity: Record<string, unknown>; onClose: () => void }) {
  const name = String(entity.name || entity.type || entity.label || '');
  const desc = String(entity.description || '');
  const color = getColor(name, entity.color ? String(entity.color) : undefined);
  const props = (entity.properties || []) as Array<Record<string, unknown>> | Record<string, unknown>;
  const shared = Boolean(entity.sharedEntity || entity.shared);
  const embeddingTemplate = String(entity.embeddingTemplate || '');
  const count = Number(entity.count || entity.instances || 0);

  const propsArray = Array.isArray(props)
    ? props
    : Object.entries(props).map(([k, v]) => ({ name: k, ...(typeof v === 'object' && v !== null ? v as Record<string, unknown> : { type: String(v) }) }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-gm-surface-primary border border-gm-border-primary rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gm-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: color }}>
              {name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gm-text-primary">{name}</h3>
                {shared && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600/10 text-gm-interactive-primary font-medium">Shared</span>}
                {count > 0 && <span className="text-[10px] text-gm-text-tertiary">{count} instances</span>}
              </div>
              {desc && <p className="text-[11px] text-gm-text-tertiary mt-0.5">{desc}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gm-surface-hover transition-colors">
              <XCircle className="w-4 h-4 text-gm-text-tertiary" />
            </button>
          </div>
        </div>

        {propsArray.length > 0 && (
          <div className="p-5 border-b border-gm-border-primary">
            <h4 className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-3">Properties ({propsArray.length})</h4>
            <div className="space-y-1.5">
              {propsArray.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-gm-text-primary w-32 shrink-0">{String(p.name || p.key || '')}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">{String(p.type || 'string')}</span>
                  {p.required && <span className="text-[9px] text-gm-status-danger">required</span>}
                  {p.searchable && <span className="text-[9px] text-gm-interactive-primary">searchable</span>}
                  {p.description && <span className="text-[10px] text-gm-text-tertiary ml-auto truncate max-w-[150px]">{String(p.description)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {embeddingTemplate && (
          <div className="p-5">
            <h4 className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-2">Embedding Template</h4>
            <pre className="text-[10px] text-gm-text-primary bg-gm-surface-secondary rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{embeddingTemplate}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline Graph Visualization (SVG-based, no external deps) ─────────────────

function OntologyGraphView({ entities, relations }: { entities: Array<Record<string, unknown>>; relations: Array<Record<string, unknown>> }) {
  const layout = useMemo(() => {
    const nodeMap: Record<string, { x: number; y: number; color: string }> = {};
    const count = entities.length;
    if (count === 0) return { nodes: nodeMap, width: 600, height: 400 };

    const cols = Math.ceil(Math.sqrt(count));
    const spacingX = 180;
    const spacingY = 120;
    entities.forEach((e, i) => {
      const name = String(e.name || e.type || e.label || '');
      const row = Math.floor(i / cols);
      const col = i % cols;
      nodeMap[name] = {
        x: 60 + col * spacingX,
        y: 50 + row * spacingY,
        color: getColor(name, e.color ? String(e.color) : undefined),
      };
    });
    const maxCol = Math.min(count, cols);
    const maxRow = Math.ceil(count / cols);
    return { nodes: nodeMap, width: Math.max(600, 60 + maxCol * spacingX + 60), height: Math.max(400, 50 + maxRow * spacingY + 60) };
  }, [entities]);

  const edges = useMemo(() => {
    return relations.map(r => {
      const from = String(r.from || r.source || r.from_type || '');
      const to = String(r.to || r.target || r.to_type || '');
      const name = String(r.name || r.type || r.label || '');
      if (!layout.nodes[from] || !layout.nodes[to] || from === '*' || to === '*') return null;
      return { from, to, name };
    }).filter(Boolean) as Array<{ from: string; to: string; name: string }>;
  }, [relations, layout]);

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Network className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-xs text-gm-text-tertiary">No entities to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto bg-gm-surface-secondary rounded-xl border border-gm-border-primary">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full" style={{ minHeight: 400 }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>
        {edges.map((edge, i) => {
          const s = layout.nodes[edge.from];
          const t = layout.nodes[edge.to];
          if (!s || !t) return null;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const midX = s.x + dx / 2;
          const midY = s.y + dy / 2;
          const curveOffset = edge.from === edge.to ? 40 : 0;
          return (
            <g key={i}>
              {edge.from === edge.to ? (
                <path d={`M ${s.x + 30} ${s.y - 15} C ${s.x + 80} ${s.y - 60}, ${s.x - 20} ${s.y - 60}, ${s.x - 30} ${s.y - 15}`}
                  fill="none" stroke="#94a3b8" strokeWidth="1.2" markerEnd="url(#arrowhead)" strokeDasharray="4 2" />
              ) : (
                <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#94a3b8" strokeWidth="1.2" markerEnd="url(#arrowhead)" strokeDasharray="4 2" />
              )}
              <rect x={midX - 30 + curveOffset} y={midY - 8 - (curveOffset ? 40 : 0)} width="60" height="14" rx="4" fill="var(--gm-surface-primary)" fillOpacity="0.85" />
              <text x={midX + curveOffset} y={midY - (curveOffset ? 40 : 0)} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">
                {edge.name.length > 12 ? edge.name.slice(0, 12) + '…' : edge.name}
              </text>
            </g>
          );
        })}
        {Object.entries(layout.nodes).map(([name, node]) => (
          <g key={name}>
            <rect x={node.x - 45} y={node.y - 18} width="90" height="36" rx="10" fill={node.color + '18'} stroke={node.color + '40'} strokeWidth="1.5" />
            <circle cx={node.x - 30} cy={node.y} r="5" fill={node.color} />
            <text x={node.x + 2} y={node.y + 4} textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="600">
              {name.length > 10 ? name.slice(0, 10) + '…' : name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Relation Builder Dialog ──────────────────────────────────────────────────

function RelationBuilderInline({
  entityNames,
  onSave,
  onCancel,
  isPending,
}: {
  entityNames: string[];
  onSave: (data: { name: string; from: string; to: string; description: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [relName, setRelName] = useState('');
  const [desc, setDesc] = useState('');

  const formatted = relName.toUpperCase().replace(/\s+/g, '_');

  const handleSave = () => {
    if (!source || !target || !relName.trim()) {
      toast.error('Source, target, and name are required');
      return;
    }
    onSave({ name: formatted, from: source, to: target, description: desc });
  };

  return (
    <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border-2 border-gm-interactive-primary/20 space-y-3">
      {/* Preview */}
      <div className="flex items-center justify-center gap-3 py-2">
        <div className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
          source ? 'text-white' : 'bg-gm-surface-secondary text-gm-text-tertiary')}
          style={source ? { backgroundColor: getColor(source) } : {}}>
          {source || '?'}
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-mono text-gm-text-tertiary">{formatted || 'RELATION'}</span>
          <span className="text-gm-text-tertiary">→</span>
        </div>
        <div className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
          target ? 'text-white' : 'bg-gm-surface-secondary text-gm-text-tertiary')}
          style={target ? { backgroundColor: getColor(target) } : {}}>
          {target || '?'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={source} onChange={e => setSource(e.target.value)}
          className="bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-2 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
          <option value="">Source entity...</option>
          {entityNames.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={target} onChange={e => setTarget(e.target.value)}
          className="bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-2 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus">
          <option value="">Target entity...</option>
          {entityNames.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <input value={relName} onChange={e => setRelName(e.target.value)} placeholder="Relation name (e.g. WORKS_ON, BELONGS_TO)"
        className="w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus"
        onKeyDown={e => e.key === 'Enter' && handleSave()} />

      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
        className="w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-gm-text-tertiary hover:bg-gm-surface-secondary transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={isPending || !source || !target || !relName.trim()}
          className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1 transition-colors">
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function GraphOntology() {
  const [tab, setTab] = useState<Tab>('entities');
  const [search, setSearch] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [showRelBuilder, setShowRelBuilder] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Record<string, unknown> | null>(null);

  // Queries
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
  const jobsQ = useOntologyJobs();
  const workerLogQ = useOntologyWorkerLog();
  const inferenceRulesQ = useInferenceRules();
  const inferenceStatsQ = useInferenceStats();
  const embeddingsDashQ = useEmbeddingsDashboard();
  const sharedQ = useSharedOntology();
  const versionsQ = useOntologyVersions();

  // Mutations
  const approve = useOntologyApproveSuggestion();
  const reject = useOntologyRejectSuggestion();
  const enrichSuggestion = useOntologyEnrichSuggestion();
  const addEntity = useOntologyAddEntityType();
  const addRelation = useOntologyAddRelationType();
  const triggerWorker = useOntologyWorkerTrigger();
  const forceSync = useOntologyForceSync();
  const autoApprove = useOntologyAutoApprove();
  const analyzeGraph = useOntologyAnalyzeGraph();
  const cleanup = useOntologyCleanup();
  const inferRels = useOntologyInferRelationships();
  const toggleJob = useOntologyToggleJob();
  const extractFromGraph = useOntologyExtractFromGraph();
  const mergeOntology = useOntologyMerge();
  const runInference = useRunInferenceRule();
  const regenEmbeddings = useRegenerateEmbeddings();
  const toggleShared = useToggleEntityShared();
  const validateEntity = useValidateEntity();
  const extractFromText = useExtractFromText();
  const enrichEntity = useEnrichEntity();

  // Test tab state
  const [validateType, setValidateType] = useState('');
  const [validateJson, setValidateJson] = useState('{\n  "name": "example"\n}');
  const [extractText, setExtractText] = useState('');
  const [enrichType, setEnrichType] = useState('');
  const [enrichJson, setEnrichJson] = useState('{\n  "name": "example"\n}');

  // Data extraction
  const entities = ((entitiesQ.data as Record<string, unknown>)?.entityTypes || (entitiesQ.data as Record<string, unknown>)?.entities || (entitiesQ.data as Record<string, unknown>)?.types || []) as Array<Record<string, unknown>>;
  const relations = ((relationsQ.data as Record<string, unknown>)?.relationTypes || (relationsQ.data as Record<string, unknown>)?.relations || (relationsQ.data as Record<string, unknown>)?.types || []) as Array<Record<string, unknown>>;
  const suggestions = ((suggestionsQ.data as Record<string, unknown>)?.suggestions || []) as Array<Record<string, unknown>>;
  const statsData = (stats.data || {}) as Record<string, unknown>;
  const worker = (workerQ.data || {}) as Record<string, unknown>;
  const compliance = ((complianceQ.data as Record<string, unknown>)?.compliance || complianceQ.data || {}) as Record<string, unknown>;
  const complianceIssues = (compliance.issues || compliance.violations || []) as Array<Record<string, unknown>>;
  const complianceScore = Number(compliance.score || compliance.compliance_score || 0);
  const changes = ((changesQ.data as Record<string, unknown>)?.changes || changesQ.data || []) as Array<Record<string, unknown>>;
  const diff = (diffQ.data || {}) as Record<string, unknown>;
  const unused = ((unusedQ.data as Record<string, unknown>)?.unused || unusedQ.data || {}) as Record<string, unknown>;
  const unusedEntities = (unused.entities || []) as string[];
  const unusedRelations = (unused.relations || []) as string[];
  const syncStatusData = ((syncStatusQ.data as Record<string, unknown>)?.status || syncStatusQ.data || {}) as Record<string, unknown>;
  const jobs = ((jobsQ.data as Record<string, unknown>)?.jobs || []) as Array<Record<string, unknown>>;
  const workerLog = ((workerLogQ.data as Record<string, unknown>)?.log || []) as Array<Record<string, unknown>>;
  const schemaData = (schema.data || {}) as Record<string, unknown>;
  const inferenceRules = ((inferenceRulesQ.data as Record<string, unknown>)?.rules || []) as Array<Record<string, unknown>>;
  const inferenceCyphers = ((inferenceRulesQ.data as Record<string, unknown>)?.cyphers || []) as Array<Record<string, unknown>>;
  const inferenceStatsData = ((inferenceStatsQ.data as Record<string, unknown>)?.stats || {}) as Record<string, unknown>;
  const availableInferenceRules = ((inferenceStatsQ.data as Record<string, unknown>)?.availableRules || []) as Array<Record<string, unknown>>;
  const embeddingSummary = ((embeddingsDashQ.data as Record<string, unknown>)?.summary || {}) as Record<string, unknown>;
  const embeddingCoverage = ((embeddingsDashQ.data as Record<string, unknown>)?.coverageByType || {}) as Record<string, Record<string, unknown>>;
  const sharedEntities = ((sharedQ.data as Record<string, unknown>)?.sharedEntities || []) as Array<Record<string, unknown>>;
  const crossGraphRelations = ((sharedQ.data as Record<string, unknown>)?.crossGraphRelations || []) as Array<Record<string, unknown>>;
  const versionsData = (versionsQ.data || {}) as Record<string, unknown>;
  const versionHistory = ((versionsData as Record<string, unknown>)?.history || []) as Array<Record<string, unknown>>;

  // Filtered lists
  const searchLower = search.toLowerCase();
  const filteredEntities = useMemo(() =>
    search ? entities.filter(e => {
      const name = String(e.name || e.type || e.label || '').toLowerCase();
      const desc = String(e.description || '').toLowerCase();
      return name.includes(searchLower) || desc.includes(searchLower);
    }) : entities
  , [entities, searchLower]);

  const filteredRelations = useMemo(() =>
    search ? relations.filter(r => {
      const name = String(r.name || r.type || r.label || '').toLowerCase();
      const from = String(r.from || r.source || '').toLowerCase();
      const to = String(r.to || r.target || '').toLowerCase();
      return name.includes(searchLower) || from.includes(searchLower) || to.includes(searchLower);
    }) : relations
  , [relations, searchLower]);

  const entityNames = useMemo(() => entities.map(e => String(e.name || e.type || e.label || '')), [entities]);

  const pendingSuggestions = suggestions.filter(s => String(s.status) !== 'approved' && String(s.status) !== 'rejected');

  // Handlers
  const handleAddEntity = () => {
    if (!newEntityName.trim()) return;
    addEntity.mutate({ name: newEntityName.trim() }, {
      onSuccess: () => { toast.success('Entity type added'); setNewEntityName(''); },
      onError: () => toast.error('Failed to add entity type'),
    });
  };

  const handleAddRelation = (data: { name: string; from: string; to: string; description: string }) => {
    addRelation.mutate(data, {
      onSuccess: () => { toast.success('Relation type added'); setShowRelBuilder(false); },
      onError: () => toast.error('Failed to add relation type'),
    });
  };

  // Tabs definition
  const tabs: { key: Tab; label: string; icon: typeof Layers; count?: number }[] = [
    { key: 'entities', label: 'Entities', icon: Cpu, count: entities.length },
    { key: 'relations', label: 'Relations', icon: GitBranch, count: relations.length },
    { key: 'graph', label: 'Graph', icon: Network },
    { key: 'suggestions', label: 'AI', icon: Sparkles, count: pendingSuggestions.length },
    { key: 'stats', label: 'Stats', icon: BarChart3 },
    { key: 'tools', label: 'Tools', icon: Wrench },
    { key: 'inference', label: 'Rules', icon: Zap },
    { key: 'embeddings', label: 'Embed', icon: Brain },
    { key: 'shared', label: 'Shared', icon: Layers },
    { key: 'jobs', label: 'Jobs', icon: Settings },
    { key: 'versions', label: 'Versions', icon: History },
    { key: 'changes', label: 'Log', icon: Activity },
    { key: 'test', label: 'Test', icon: FlaskConical },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gm-border-primary bg-gm-surface-secondary shrink-0">
        <Layers className="w-4 h-4 text-gm-interactive-primary" />
        <span className="text-xs font-semibold text-gm-text-primary">Ontology</span>
        <VersionBadge schema={schemaData} />
        <div className="ml-auto flex items-center gap-2">
          {Object.keys(syncStatusData).length > 0 && <SyncBadge status={syncStatusData} />}
          <button onClick={() => forceSync.mutate(undefined, { onSuccess: () => toast.success('Sync triggered') })} disabled={forceSync.isPending}
            className="p-1 rounded-md hover:bg-gm-surface-hover transition-colors" title="Force sync">
            {forceSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gm-text-tertiary" /> : <RefreshCw className="w-3.5 h-3.5 text-gm-text-tertiary" />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 border-b border-gm-border-primary bg-gm-surface-secondary shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1 px-2.5 py-2 text-[10px] font-medium border-b-2 transition-colors',
                tab === t.key ? 'border-gm-interactive-primary text-gm-interactive-primary' : 'border-transparent text-gm-text-tertiary hover:text-gm-text-primary')}>
              <Icon className="w-3 h-3" /> {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded-full bg-gm-surface-secondary text-gm-text-tertiary">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search (for entities/relations tabs) */}
      {(tab === 'entities' || tab === 'relations') && (
        <div className="px-4 pt-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab}...`}
              className="w-full pl-8 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Entities Tab ─────────────────────────────────────────────── */}
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
                {filteredEntities.map((e, i) => {
                  const name = String(e.name || e.type || e.label || '');
                  const count = Number(e.count || e.instances || 0);
                  const props = (e.properties || []) as Array<Record<string, unknown>> | Record<string, unknown>;
                  const propsArr = Array.isArray(props) ? props : Object.entries(props).map(([k]) => ({ name: k }));
                  const color = getColor(name, e.color ? String(e.color) : undefined);
                  const desc = String(e.description || '');
                  const shared = Boolean(e.sharedEntity || e.shared);
                  return (
                    <div key={i} onClick={() => setSelectedEntity(e)}
                      className="bg-[var(--gm-surface-hover)] rounded-xl p-3 border border-gm-border-primary hover:border-blue-600/30 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: color }}>
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gm-text-primary truncate">{name}</span>
                            {shared && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary">S</span>}
                          </div>
                        </div>
                        {count > 0 && <span className="text-[10px] text-gm-text-tertiary shrink-0">{count}</span>}
                      </div>
                      {desc && <p className="text-[9px] text-gm-text-tertiary mb-1.5 line-clamp-1">{desc}</p>}
                      {propsArr.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {propsArr.slice(0, 4).map((p, j) => (
                            <span key={j} className="text-[8px] px-1 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary">{String((p as Record<string, unknown>).name || p)}</span>
                          ))}
                          {propsArr.length > 4 && <span className="text-[8px] text-gm-text-tertiary">+{propsArr.length - 4}</span>}
                        </div>
                      )}
                      <Eye className="w-3 h-3 text-gm-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Relations Tab ────────────────────────────────────────────── */}
        {tab === 'relations' && (
          <>
            {showRelBuilder ? (
              <RelationBuilderInline
                entityNames={entityNames}
                onSave={handleAddRelation}
                onCancel={() => setShowRelBuilder(false)}
                isPending={addRelation.isPending}
              />
            ) : (
              <button onClick={() => setShowRelBuilder(true)}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> New Relation
              </button>
            )}
            {relationsQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <div className="space-y-1.5">
                {filteredRelations.map((r, i) => {
                  const name = String(r.name || r.type || r.label || '');
                  const count = Number(r.count || r.instances || 0);
                  const from = String(r.from || r.source || r.from_type || '');
                  const to = String(r.to || r.target || r.to_type || '');
                  const desc = String(r.description || '');
                  return (
                    <div key={i} className="flex items-center gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-2.5 group">
                      {from && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${getColor(from)}20`, color: getColor(from) }}>{from}</span>}
                      <span className="text-xs font-medium text-gm-interactive-primary">→ {name.replace(/_/g, ' ')} →</span>
                      {to && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${getColor(to)}20`, color: getColor(to) }}>{to}</span>}
                      {desc && <span className="text-[9px] text-gm-text-tertiary truncate max-w-[150px] hidden group-hover:block">{desc}</span>}
                      {count > 0 && <span className="text-[10px] text-gm-text-tertiary ml-auto">{count}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Graph Tab ────────────────────────────────────────────────── */}
        {tab === 'graph' && (
          <OntologyGraphView entities={entities} relations={relations} />
        )}

        {/* ── AI Suggestions Tab ──────────────────────────────────────── */}
        {tab === 'suggestions' && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => analyzeGraph.mutate(undefined, { onSuccess: () => toast.success('Graph analysis started') })}
                disabled={analyzeGraph.isPending}
                className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-gm-interactive-primary text-xs font-medium hover:bg-blue-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {analyzeGraph.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} Analyze Graph
              </button>
              <button onClick={() => autoApprove.mutate({ minConfidence: 0.8 }, { onSuccess: () => toast.success('High-confidence suggestions auto-approved') })}
                disabled={autoApprove.isPending || pendingSuggestions.length === 0}
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
                <p className="text-[10px] text-gm-text-tertiary mt-1">Run "Analyze Graph" to generate suggestions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.map((s, i) => {
                  const sType = String(s.type || s.suggestion_type || '');
                  const name = String(s.name || s.suggested_name || s.content || '');
                  const reason = String(s.reason || s.explanation || s.description || '');
                  const confidence = Number(s.confidence || 0);
                  const status = String(s.status || 'pending');
                  const enrichment = s.enrichment as Record<string, unknown> | undefined;
                  const isPending = status === 'pending';
                  return (
                    <div key={i} className={cn('bg-[var(--gm-surface-hover)] rounded-xl p-3 border transition-colors',
                      isPending ? 'border-gm-border-primary' : status === 'approved' ? 'border-green-500/20 opacity-60' : 'border-red-500/20 opacity-60')}>
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-gm-interactive-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gm-text-primary">{name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary capitalize">{sType.replace(/_/g, ' ')}</span>
                            {confidence > 0 && (
                              <span className={cn('text-[10px] font-medium',
                                confidence >= 0.8 ? 'text-gm-status-success' : confidence >= 0.5 ? 'text-gm-status-warning' : 'text-gm-text-tertiary')}>
                                {Math.round(confidence * 100)}%
                              </span>
                            )}
                            {!isPending && <span className={cn('text-[9px] px-1 py-0.5 rounded', status === 'approved' ? 'bg-gm-status-success-bg text-gm-status-success' : 'bg-gm-status-danger-bg text-gm-status-danger')}>{status}</span>}
                          </div>
                          {reason && <p className="text-[10px] text-gm-text-tertiary mt-1">{reason}</p>}
                          {enrichment && (
                            <div className="mt-2 p-2 bg-gm-surface-secondary rounded-lg space-y-1">
                              {enrichment.description && <p className="text-[10px] text-gm-text-primary">{String(enrichment.description)}</p>}
                              {Array.isArray(enrichment.useCases) && enrichment.useCases.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {(enrichment.useCases as string[]).map((uc, j) => (
                                    <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-gm-surface-hover text-gm-text-tertiary">{uc}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isPending && (
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => enrichSuggestion.mutate(String(s.id), { onSuccess: () => toast.success('Enriched') })} disabled={enrichSuggestion.isPending}
                              className="p-1.5 rounded-lg bg-blue-600/10 text-gm-interactive-primary hover:bg-blue-600/20 transition-colors" title="AI Enrich">
                              <Brain className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => approve.mutate({ id: String(s.id) }, { onSuccess: () => toast.success('Approved') })} disabled={approve.isPending}
                              className="p-1.5 rounded-lg bg-gm-status-success-bg text-gm-status-success hover:bg-green-500/20 transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => reject.mutate({ id: String(s.id) }, { onSuccess: () => toast.success('Rejected') })} disabled={reject.isPending}
                              className="p-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger hover:bg-red-500/20 transition-colors">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Stats Tab ────────────────────────────────────────────────── */}
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

                {/* Usage Bar Charts */}
                {entities.length > 0 && (
                  <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
                    <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" /> Entity Types by Instance Count
                    </h4>
                    <div className="space-y-1.5">
                      {entities.slice(0, 10).map((e) => {
                        const name = String(e.name || e.type || e.label || '?');
                        const count = Number(e.count || e.instances || e.nodeCount || 0);
                        const maxCount = Math.max(...entities.slice(0, 10).map(x => Number(x.count || x.instances || x.nodeCount || 0)), 1);
                        return (
                          <div key={name} className="flex items-center gap-2">
                            <span className="text-[10px] text-gm-text-tertiary w-24 truncate text-right">{name}</span>
                            <div className="flex-1 h-4 bg-gm-surface-secondary rounded overflow-hidden">
                              <div className="h-full rounded transition-all" style={{
                                width: `${Math.max((count / maxCount) * 100, 2)}%`,
                                backgroundColor: getColor(name, '#6366f1'),
                              }} />
                            </div>
                            <span className="text-[10px] font-mono text-gm-text-tertiary w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {relations.length > 0 && (
                  <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
                    <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5" /> Relation Types by Instance Count
                    </h4>
                    <div className="space-y-1.5">
                      {relations.slice(0, 10).map((r) => {
                        const name = String(r.name || r.type || r.label || '?');
                        const count = Number(r.count || r.instances || r.edgeCount || 0);
                        const maxCount = Math.max(...relations.slice(0, 10).map(x => Number(x.count || x.instances || x.edgeCount || 0)), 1);
                        return (
                          <div key={name} className="flex items-center gap-2">
                            <span className="text-[10px] text-gm-text-tertiary w-24 truncate text-right">{name}</span>
                            <div className="flex-1 h-4 bg-gm-surface-secondary rounded overflow-hidden">
                              <div className="h-full rounded bg-gm-interactive-primary/70 transition-all" style={{
                                width: `${Math.max((count / maxCount) * 100, 2)}%`,
                              }} />
                            </div>
                            <span className="text-[10px] font-mono text-gm-text-tertiary w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Compliance Score */}
                {complianceScore > 0 && (
                  <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className="w-4 h-4 text-gm-interactive-primary" />
                      <h4 className="text-xs font-semibold text-gm-text-primary">Compliance Score</h4>
                      <span className={cn('text-sm font-bold ml-auto',
                        complianceScore >= 80 ? 'text-gm-status-success' :
                        complianceScore >= 50 ? 'text-gm-status-warning' : 'text-gm-status-danger')}>
                        {complianceScore}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gm-surface-secondary rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all',
                        complianceScore >= 80 ? 'bg-gm-status-success' :
                        complianceScore >= 50 ? 'bg-gm-status-warning' : 'bg-gm-status-danger')}
                        style={{ width: `${complianceScore}%` }} />
                    </div>
                  </div>
                )}

                {complianceIssues.length > 0 && (
                  <div className="bg-[var(--gm-status-warning-bg)] border border-yellow-500/20 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-gm-status-warning mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Compliance Issues ({complianceIssues.length})
                    </h4>
                    <div className="space-y-1.5">
                      {complianceIssues.slice(0, 8).map((issue, i) => (
                        <p key={i} className="text-xs text-gm-text-primary">{String(issue.message || issue.description || JSON.stringify(issue))}</p>
                      ))}
                      {complianceIssues.length > 8 && <p className="text-[10px] text-gm-text-tertiary">+{complianceIssues.length - 8} more</p>}
                    </div>
                  </div>
                )}

                <button onClick={() => complianceQ.refetch()} disabled={complianceQ.isFetching}
                  className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {complianceQ.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />} Check Compliance
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Tools Tab ────────────────────────────────────────────────── */}
        {tab === 'tools' && (
          <div className="space-y-4">
            {/* Extract from Graph */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Extract Ontology from Graph</h4>
              <p className="text-[10px] text-gm-text-tertiary">Reverse-engineer the ontology schema from existing graph data to discover entity types and relationships that exist in practice.</p>
              <button onClick={() => extractFromGraph.mutate(undefined, {
                onSuccess: (data: unknown) => {
                  const d = data as Record<string, unknown>;
                  const notInSchema = (d.notInSchema || (d.extracted as Record<string, unknown>)?.notInSchema || []) as string[];
                  toast.success(`Extraction complete${notInSchema.length ? ` — ${notInSchema.length} types not in schema` : ''}`);
                },
                onError: () => toast.error('Extraction failed'),
              })} disabled={extractFromGraph.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {extractFromGraph.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Extract
              </button>
            </div>

            {/* Diff */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Schema vs Graph Diff</h4>
              <p className="text-[10px] text-gm-text-tertiary">Compare the defined ontology schema with what actually exists in the graph database.</p>
              <button onClick={() => diffQ.refetch()} disabled={diffQ.isFetching}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {diffQ.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} Run Diff
              </button>
              {!diffQ.isLoading && Object.keys(diff).length > 0 && (
                <div className="space-y-2 text-xs mt-2">
                  {Object.entries(diff).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-gm-text-tertiary capitalize font-medium">{k.replace(/_/g, ' ')}</span>
                      <pre className="text-[10px] text-gm-text-primary mt-1 bg-gm-surface-secondary rounded-lg p-2 overflow-x-auto max-h-40">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Merge */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Merge className="w-3.5 h-3.5" /> Merge & Update</h4>
              <p className="text-[10px] text-gm-text-tertiary">Merge extracted ontology back into the schema, adding missing entity and relation types.</p>
              <button onClick={() => {
                extractFromGraph.mutate(undefined, {
                  onSuccess: (data: unknown) => {
                    const d = data as Record<string, unknown>;
                    mergeOntology.mutate({ source: d.extracted || d }, {
                      onSuccess: () => toast.success('Ontology merged successfully'),
                      onError: () => toast.error('Merge failed'),
                    });
                  },
                  onError: () => toast.error('Extract failed before merge'),
                });
              }} disabled={extractFromGraph.isPending || mergeOntology.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-status-warning-bg text-gm-status-warning text-xs font-medium hover:bg-yellow-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {(extractFromGraph.isPending || mergeOntology.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />} Extract & Merge
              </button>
            </div>

            {/* Unused Types */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-gm-status-warning" /> Unused Types</h4>
              <button onClick={() => unusedQ.refetch()} disabled={unusedQ.isFetching}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors mb-2">
                {unusedQ.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Find Unused
              </button>
              {unusedEntities.length > 0 && (
                <div>
                  <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-1.5">Entities ({unusedEntities.length})</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {unusedEntities.map(e => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium">{e}</span>
                    ))}
                  </div>
                  <button onClick={() => cleanup.mutate({ entities: unusedEntities }, { onSuccess: () => toast.success('Unused entities removed') })}
                    disabled={cleanup.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                    {cleanup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove Entities
                  </button>
                </div>
              )}
              {unusedRelations.length > 0 && (
                <div>
                  <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider mb-1.5">Relations ({unusedRelations.length})</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {unusedRelations.map(r => (
                      <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-gm-status-warning-bg text-gm-status-warning font-medium">{r}</span>
                    ))}
                  </div>
                  <button onClick={() => cleanup.mutate({ relations: unusedRelations }, { onSuccess: () => toast.success('Unused relations removed') })}
                    disabled={cleanup.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-status-danger-bg text-gm-status-danger text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                    {cleanup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove Relations
                  </button>
                </div>
              )}
              {unusedEntities.length === 0 && unusedRelations.length === 0 && !unusedQ.isFetching && (
                <p className="text-xs text-gm-text-tertiary">All types are in use (or click "Find Unused" to check).</p>
              )}
            </div>
          </div>
        )}

        {/* ── Jobs Tab ─────────────────────────────────────────────────── */}
        {tab === 'jobs' && (
          <div className="space-y-4">
            {/* Worker Status */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-gm-interactive-primary" />
                <h4 className="text-xs font-semibold text-gm-text-primary">Background Worker</h4>
                <div className={cn('ml-auto px-2 py-0.5 rounded-full text-[9px] font-medium',
                  worker.status === 'running' || worker.running ? 'bg-gm-status-success-bg text-gm-status-success' : 'bg-gm-surface-secondary text-gm-text-tertiary')}>
                  {String(worker.status || (worker.running ? 'Running' : 'Idle'))}
                </div>
              </div>
              {workerQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {worker.lastRun && (
                    <div>
                      <p className="text-[10px] text-gm-text-tertiary">Last Run</p>
                      <p className="text-gm-text-primary font-medium">{new Date(String(worker.lastRun || worker.last_run)).toLocaleString()}</p>
                    </div>
                  )}
                  {worker.nextRun && (
                    <div>
                      <p className="text-[10px] text-gm-text-tertiary">Next Run</p>
                      <p className="text-gm-text-primary font-medium">{new Date(String(worker.nextRun || worker.next_run)).toLocaleString()}</p>
                    </div>
                  )}
                  {(worker.totalRuns || worker.total_runs) && (
                    <div>
                      <p className="text-[10px] text-gm-text-tertiary">Total Runs</p>
                      <p className="text-gm-text-primary font-medium">{String(worker.totalRuns || worker.total_runs)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => triggerWorker.mutate({ type: 'full_analysis' }, { onSuccess: () => toast.success('Full analysis triggered') })} disabled={triggerWorker.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {triggerWorker.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} Full Analysis
              </button>
              <button onClick={() => triggerWorker.mutate({ type: 'inference' }, { onSuccess: () => toast.success('Inference triggered') })} disabled={triggerWorker.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                <Zap className="w-3.5 h-3.5" /> Inference Rules
              </button>
              <button onClick={() => triggerWorker.mutate({ type: 'dedup' }, { onSuccess: () => toast.success('Dedup triggered') })} disabled={triggerWorker.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                <Layers className="w-3.5 h-3.5" /> Deduplication
              </button>
              <button onClick={() => triggerWorker.mutate({ type: 'gap_detection' }, { onSuccess: () => toast.success('Gap detection triggered') })} disabled={triggerWorker.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                <Search className="w-3.5 h-3.5" /> Gap Detection
              </button>
              <button onClick={() => forceSync.mutate(undefined, { onSuccess: () => toast.success('Sync triggered') })} disabled={forceSync.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Force Sync
              </button>
            </div>

            {/* Scheduled Jobs */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Scheduled Jobs</h4>
              {jobsQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : jobs.length === 0 ? (
                <p className="text-xs text-gm-text-tertiary">No scheduled jobs configured</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job, i) => {
                    const name = String(job.name || job.type || job.id || '');
                    const enabled = Boolean(job.enabled ?? job.active ?? true);
                    const interval = String(job.interval || job.cron || job.schedule || '');
                    const lastRun = job.lastRun || job.last_run;
                    const jobStatus = String(job.status || (enabled ? 'active' : 'paused'));
                    const totalRuns = Number(job.stats && (job.stats as Record<string, unknown>).totalRuns) || Number(job.total_runs || 0);
                    return (
                      <div key={i} className="flex items-center gap-3 bg-gm-surface-secondary rounded-lg p-2.5">
                        <button onClick={() => toggleJob.mutate(String(job.id), { onSuccess: () => toast.success(`Job ${enabled ? 'disabled' : 'enabled'}`) })}
                          disabled={toggleJob.isPending}
                          className={cn('p-1 rounded-md transition-colors', enabled ? 'text-gm-status-success hover:bg-green-500/10' : 'text-gm-text-tertiary hover:bg-gm-surface-hover')}>
                          {enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gm-text-primary">{name}</span>
                            <span className={cn('text-[9px] px-1 py-0.5 rounded',
                              enabled ? 'bg-gm-status-success-bg text-gm-status-success' : 'bg-gm-surface-hover text-gm-text-tertiary')}>
                              {jobStatus}
                            </span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-gm-text-tertiary mt-0.5">
                            {interval && <span>{interval}</span>}
                            {lastRun && <span>Last: {new Date(String(lastRun)).toLocaleString()}</span>}
                            {totalRuns > 0 && <span>{totalRuns} runs</span>}
                          </div>
                        </div>
                        <button onClick={() => triggerWorker.mutate({ type: String(job.type || job.id) }, { onSuccess: () => toast.success('Job triggered') })}
                          disabled={triggerWorker.isPending}
                          className="p-1.5 rounded-lg bg-gm-interactive-primary/10 text-gm-interactive-primary hover:bg-gm-interactive-primary/20 transition-colors" title="Run now">
                          <Play className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Execution Log */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Execution Log</h4>
              {workerLogQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : workerLog.length === 0 ? (
                <p className="text-xs text-gm-text-tertiary">No execution history</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {workerLog.slice(0, 20).map((entry, i) => {
                    const jobType = String(entry.jobType || entry.job_type || entry.type || '');
                    const status = String(entry.status || '');
                    const started = entry.startedAt || entry.started_at || entry.created_at;
                    const duration = Number(entry.duration || entry.elapsed_ms || 0);
                    const error = String(entry.error || '');
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                          status === 'completed' ? 'bg-gm-status-success' :
                          status === 'failed' ? 'bg-gm-status-danger' :
                          status === 'started' ? 'bg-gm-status-warning animate-pulse' : 'bg-gm-text-tertiary')} />
                        <span className="text-gm-text-primary font-medium w-24 shrink-0 truncate">{jobType}</span>
                        <span className={cn('text-[10px] w-16 shrink-0',
                          status === 'completed' ? 'text-gm-status-success' : status === 'failed' ? 'text-gm-status-danger' : 'text-gm-text-tertiary')}>
                          {status}
                        </span>
                        {duration > 0 && <span className="text-[10px] text-gm-text-tertiary w-16 shrink-0">{duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}</span>}
                        {started && <span className="text-[10px] text-gm-text-tertiary">{new Date(String(started)).toLocaleString()}</span>}
                        {error && status === 'failed' && <span className="text-[10px] text-gm-status-danger truncate max-w-[150px]" title={error}>{error}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Changes/History Tab ──────────────────────────────────────── */}
        {tab === 'changes' && (
          <div className="space-y-4">
            {/* Sync Status */}
            {!syncStatusQ.isLoading && Object.keys(syncStatusData).length > 0 && (
              <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                <h4 className="text-xs font-semibold text-gm-text-primary mb-2 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Sync Status</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(syncStatusData).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-gm-text-tertiary capitalize shrink-0">{k.replace(/_/g, ' ')}</span>
                      <span className="text-gm-text-primary text-[10px] truncate">{v == null ? '—' : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Change Log */}
            <div>
              <h4 className="text-xs font-semibold text-gm-text-primary mb-3 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Change Log</h4>
              {changesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : changes.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                  <p className="text-xs text-gm-text-tertiary">No changes recorded</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {changes.slice(0, 50).map((c, i) => {
                    const changeType = String(c.change_type || c.action || c.type || '');
                    const targetName = String(c.target_name || c.target || c.entity || '');
                    const reason = String(c.reason || c.description || c.message || '');
                    const source = String(c.source || '');
                    const changedAt = c.changed_at || c.created_at;
                    const isAdd = changeType.includes('added') || changeType === 'add';
                    const isRemove = changeType.includes('removed') || changeType === 'remove';
                    return (
                      <div key={i} className="flex items-start gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-2.5 border border-gm-border-primary">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                          isAdd ? 'bg-gm-status-success' : isRemove ? 'bg-gm-status-danger' : 'bg-gm-status-warning')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary font-medium">{changeType.replace(/_/g, ' ')}</span>
                            {targetName && <span className="text-xs font-medium text-gm-text-primary">{targetName}</span>}
                          </div>
                          {reason && <p className="text-[10px] text-gm-text-tertiary mt-0.5">{reason}</p>}
                          <div className="flex gap-2 mt-0.5 text-[9px] text-gm-text-tertiary">
                            {source && <span>{source}</span>}
                            {changedAt && <span>{new Date(String(changedAt)).toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── Inference Rules Tab ────────────────────────────────────── */}
        {tab === 'inference' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Runs', value: inferenceStatsData.runsCompleted || 0 },
                { label: 'Inferred', value: inferenceStatsData.totalRelationshipsInferred || 0 },
                { label: 'Errors', value: inferenceStatsData.totalErrors || 0 },
                { label: 'Last Run', value: inferenceStatsData.lastRun ? new Date(String(inferenceStatsData.lastRun)).toLocaleDateString() : '—' },
              ].map((s, i) => (
                <div key={i} className="bg-gm-surface-secondary rounded-xl p-3 border border-gm-border-primary">
                  <p className="text-lg font-bold text-gm-text-primary">{String(s.value)}</p>
                  <p className="text-[10px] text-gm-text-tertiary">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Run All */}
            <div className="flex gap-2">
              <button onClick={() => runInference.mutate(undefined, { onSuccess: () => toast.success('All inference rules executed') })}
                disabled={runInference.isPending}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {runInference.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Run All Rules
              </button>
            </div>

            {/* Rules List */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Defined Rules</h4>
              {inferenceRulesQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : inferenceRules.length === 0 && inferenceCyphers.length === 0 ? (
                <p className="text-xs text-gm-text-tertiary">No inference rules defined</p>
              ) : (
                <div className="space-y-2">
                  {inferenceRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gm-surface-secondary rounded-lg p-2.5">
                      <Zap className="w-3.5 h-3.5 text-gm-status-warning shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gm-text-primary">{String(rule.name || rule.id || '')}</span>
                        {rule.description && <p className="text-[10px] text-gm-text-tertiary">{String(rule.description)}</p>}
                        {rule.type && <span className="text-[9px] px-1 py-0.5 rounded bg-gm-surface-hover text-gm-text-tertiary ml-1">{String(rule.type)}</span>}
                      </div>
                      <button onClick={() => runInference.mutate(String(rule.name || rule.id), { onSuccess: () => toast.success(`Rule "${rule.name}" executed`) })}
                        disabled={runInference.isPending}
                        className="p-1.5 rounded-lg bg-gm-interactive-primary/10 text-gm-interactive-primary hover:bg-gm-interactive-primary/20 transition-colors" title="Run rule">
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {inferenceCyphers.map((cypher, i) => (
                    <div key={`c-${i}`} className="bg-gm-surface-secondary rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-600/10 text-gm-interactive-primary font-medium">Cypher</span>
                        <span className="text-xs font-medium text-gm-text-primary">{String(cypher.name || '')}</span>
                      </div>
                      {cypher.description && <p className="text-[10px] text-gm-text-tertiary">{String(cypher.description)}</p>}
                      {cypher.cypher && <pre className="text-[9px] text-gm-text-tertiary mt-1 bg-gm-surface-hover rounded p-1.5 overflow-x-auto">{String(cypher.cypher)}</pre>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available (runtime) rules */}
            {availableInferenceRules.length > 0 && (
              <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
                <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Available Runtime Rules</h4>
                <div className="space-y-1.5">
                  {availableInferenceRules.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-gm-text-primary font-medium">{String(r.name || '')}</span>
                      {r.description && <span className="text-[10px] text-gm-text-tertiary">— {String(r.description)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Embeddings Dashboard Tab ─────────────────────────────────── */}
        {tab === 'embeddings' && (
          <div className="space-y-4">
            {embeddingsDashQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total Entities', value: embeddingSummary.totalEntities || 0 },
                    { label: 'With Embeddings', value: embeddingSummary.totalWithEmbeddings || 0 },
                    { label: 'Coverage', value: `${embeddingSummary.overallCoverage || 0}%` },
                    { label: 'Model', value: String(embeddingSummary.model || 'N/A') },
                  ].map((s, i) => (
                    <div key={i} className="bg-gm-surface-secondary rounded-xl p-3 border border-gm-border-primary">
                      <p className="text-lg font-bold text-gm-text-primary">{String(s.value)}</p>
                      <p className="text-[10px] text-gm-text-tertiary">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Overall Progress Bar */}
                <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gm-text-primary">Overall Coverage</h4>
                    <span className={cn('text-sm font-bold',
                      Number(embeddingSummary.overallCoverage || 0) >= 80 ? 'text-gm-status-success' :
                      Number(embeddingSummary.overallCoverage || 0) >= 50 ? 'text-gm-status-warning' : 'text-gm-status-danger')}>
                      {embeddingSummary.overallCoverage || 0}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gm-surface-secondary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all',
                      Number(embeddingSummary.overallCoverage || 0) >= 80 ? 'bg-gm-status-success' :
                      Number(embeddingSummary.overallCoverage || 0) >= 50 ? 'bg-gm-status-warning' : 'bg-gm-status-danger')}
                      style={{ width: `${embeddingSummary.overallCoverage || 0}%` }} />
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] text-gm-text-tertiary">
                    <span>Dimensions: {String(embeddingSummary.dimensions || 1024)}</span>
                    {Number(embeddingSummary.staleCount || 0) > 0 && <span className="text-gm-status-warning">{embeddingSummary.staleCount} stale</span>}
                  </div>
                </div>

                {/* Per-Type Coverage */}
                <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
                  <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Coverage by Type</h4>
                  {Object.keys(embeddingCoverage).length === 0 ? (
                    <p className="text-xs text-gm-text-tertiary">No coverage data available</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(embeddingCoverage).map(([type, data]) => {
                        const coverage = Number(data.coverage || 0);
                        const total = Number(data.total || 0);
                        const withEmb = Number(data.withEmbedding || 0);
                        return (
                          <div key={type} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gm-text-primary capitalize">{type}</span>
                                <span className="text-[10px] text-gm-text-tertiary">{withEmb}/{total}</span>
                              </div>
                              <span className={cn('text-[10px] font-medium',
                                coverage >= 80 ? 'text-gm-status-success' : coverage >= 50 ? 'text-gm-status-warning' : 'text-gm-status-danger')}>
                                {coverage}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gm-surface-secondary rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all',
                                coverage >= 80 ? 'bg-gm-status-success' : coverage >= 50 ? 'bg-gm-status-warning' : 'bg-gm-status-danger')}
                                style={{ width: `${coverage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Regenerate */}
                <div className="flex gap-2">
                  <button onClick={() => regenEmbeddings.mutate(undefined, { onSuccess: () => toast.success('Embedding regeneration queued for all types') })}
                    disabled={regenEmbeddings.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                    {regenEmbeddings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate All
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Shared / Cross-Project Tab ───────────────────────────────── */}
        {tab === 'shared' && (
          <div className="space-y-4">
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <h4 className="text-xs font-semibold text-gm-text-primary mb-1">Cross-Project Entities</h4>
              <p className="text-[10px] text-gm-text-tertiary mb-3">Shared entity types are visible across all projects. Toggle sharing per entity type.</p>
            </div>

            {/* All Entities with Share Toggle */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Entity Types</h4>
              {entitiesQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="space-y-1.5">
                  {entities.map((e, i) => {
                    const name = String(e.name || e.type || e.label || '');
                    const isShared = Boolean(e.sharedEntity || e.shared);
                    const color = getColor(name, e.color ? String(e.color) : undefined);
                    return (
                      <div key={i} className="flex items-center gap-3 bg-gm-surface-secondary rounded-lg p-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: color }}>
                          {name.charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-gm-text-primary flex-1">{name}</span>
                        <button
                          onClick={() => toggleShared.mutate({ name, shared: !isShared }, {
                            onSuccess: () => toast.success(`${name} is now ${!isShared ? 'shared' : 'project-only'}`),
                          })}
                          disabled={toggleShared.isPending}
                          className={cn('px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors',
                            isShared ? 'bg-gm-interactive-primary/10 text-gm-interactive-primary' : 'bg-gm-surface-hover text-gm-text-tertiary hover:bg-gm-surface-secondary')}>
                          {isShared ? 'Shared' : 'Project Only'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cross-Graph Relations */}
            {crossGraphRelations.length > 0 && (
              <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
                <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Cross-Graph Relations</h4>
                <div className="space-y-1.5">
                  {crossGraphRelations.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-gm-text-primary font-medium">{String(r.name || r.type || '')}</span>
                      {r.from && <span className="text-[10px] text-gm-text-tertiary">({String(r.from)} → {String(r.to)})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shared Entities Summary */}
            {sharedEntities.length > 0 && (
              <div className="bg-blue-600/5 rounded-xl p-4 border border-blue-600/10">
                <h4 className="text-xs font-semibold text-gm-interactive-primary mb-2">{sharedEntities.length} Shared Entity Types</h4>
                <div className="flex flex-wrap gap-1.5">
                  {sharedEntities.map((e, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gm-interactive-primary/10 text-gm-interactive-primary font-medium">
                      {String(e.name || '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Versions Tab ─────────────────────────────────────────────── */}
        {tab === 'versions' && (
          <div className="space-y-4">
            {/* Current Version */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gm-interactive-primary/10 flex items-center justify-center">
                  <History className="w-5 h-5 text-gm-interactive-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gm-text-primary">Current Version: {String(versionsData.currentVersion || '—')}</h4>
                  <p className="text-[10px] text-gm-text-tertiary">{String(versionsData.totalChanges || 0)} total changes recorded</p>
                </div>
              </div>
            </div>

            {/* Version History */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Version History</h4>
              {versionsQ.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : versionHistory.length === 0 ? (
                <p className="text-xs text-gm-text-tertiary">No version snapshots recorded</p>
              ) : (
                <div className="space-y-2">
                  {versionHistory.map((v, i) => (
                    <div key={i} className="bg-gm-surface-secondary rounded-lg p-3 border border-gm-border-primary">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gm-text-primary">v{String(v.version || '?')}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-hover text-gm-text-tertiary">{String(v.changeType || v.change_type || '').replace(/_/g, ' ')}</span>
                        {v.source && <span className="text-[9px] text-gm-text-tertiary">{String(v.source)}</span>}
                      </div>
                      {v.reason && <p className="text-[10px] text-gm-text-tertiary">{String(v.reason)}</p>}
                      <div className="flex gap-2 mt-1 text-[9px] text-gm-text-tertiary">
                        {v.changedBy && <span>by {String(v.changedBy)}</span>}
                        {v.changedAt && <span>{new Date(String(v.changedAt)).toLocaleString()}</span>}
                      </div>
                      {v.diff && Object.keys(v.diff as Record<string, unknown>).length > 0 && (
                        <pre className="text-[9px] text-gm-text-tertiary mt-2 bg-gm-surface-hover rounded p-2 overflow-x-auto max-h-20">{JSON.stringify(v.diff, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Test Tab ────────────────────────────────────────────────── */}
        {tab === 'test' && (
          <div className="space-y-4">

            {/* Validate Entity */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Validate Entity Against Schema
              </h4>
              <p className="text-[10px] text-gm-text-tertiary">Test whether an entity object conforms to its type definition in the ontology schema.</p>
              <div className="flex gap-2">
                <select value={validateType} onChange={e => setValidateType(e.target.value)}
                  className="flex-shrink-0 w-40 px-2 py-1.5 text-xs bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-gm-text-primary">
                  <option value="">Select type...</option>
                  {entities.map(e => {
                    const n = String(e.name || e.type || e.label || '');
                    return <option key={n} value={n}>{n}</option>;
                  })}
                </select>
              </div>
              <textarea value={validateJson} onChange={e => setValidateJson(e.target.value)} rows={5}
                className="w-full px-3 py-2 text-xs font-mono bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-gm-text-primary resize-y"
                placeholder='{"name": "example", "description": "..."}'
              />
              <button disabled={!validateType || validateEntity.isPending}
                onClick={() => {
                  try {
                    const parsed = JSON.parse(validateJson);
                    validateEntity.mutate({ type: validateType, entity: parsed });
                  } catch { toast.error('Invalid JSON'); }
                }}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {validateEntity.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />} Validate
              </button>
              {validateEntity.data && (
                <div className={cn('rounded-lg p-3 border text-xs',
                  (validateEntity.data as Record<string, unknown>).valid
                    ? 'bg-gm-status-success/10 border-gm-status-success/30 text-gm-status-success'
                    : 'bg-gm-status-danger/10 border-gm-status-danger/30 text-gm-status-danger')}>
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    {(validateEntity.data as Record<string, unknown>).valid
                      ? <><CheckCircle className="w-3.5 h-3.5" /> Valid</>
                      : <><XCircle className="w-3.5 h-3.5" /> Invalid</>}
                  </div>
                  {((validateEntity.data as Record<string, unknown>).errors as string[] || []).length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-gm-text-primary">
                      {((validateEntity.data as Record<string, unknown>).errors as string[]).map((err, i) => (
                        <li key={i} className="text-[10px]">- {err}</li>
                      ))}
                    </ul>
                  )}
                  {((validateEntity.data as Record<string, unknown>).missingRequired as string[] || []).length > 0 && (
                    <p className="text-[10px] text-gm-text-primary mt-1">Missing required: {((validateEntity.data as Record<string, unknown>).missingRequired as string[]).join(', ')}</p>
                  )}
                  {((validateEntity.data as Record<string, unknown>).unknownProperties as string[] || []).length > 0 && (
                    <p className="text-[10px] text-gm-text-primary mt-1">Unknown properties: {((validateEntity.data as Record<string, unknown>).unknownProperties as string[]).join(', ')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Extract Entities from Text */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Extract Entities from Text (AI)
              </h4>
              <p className="text-[10px] text-gm-text-tertiary">Paste any text and let the AI identify entities and relationships using the current ontology schema.</p>
              <textarea value={extractText} onChange={e => setExtractText(e.target.value)} rows={6}
                className="w-full px-3 py-2 text-xs bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-gm-text-primary resize-y"
                placeholder="Paste meeting notes, a document, or any text here..."
              />
              <button disabled={!extractText.trim() || extractFromText.isPending}
                onClick={() => extractFromText.mutate({
                  text: extractText,
                  existingEntities: entities.map(e => String(e.name || e.type || '')).filter(Boolean),
                })}
                className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {extractFromText.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Extract
              </button>
              {extractFromText.data && (
                <div className="space-y-3">
                  {((extractFromText.data as Record<string, unknown>).entities as Array<Record<string, unknown>> || []).length > 0 && (
                    <div className="bg-gm-surface-secondary rounded-lg p-3 border border-gm-border-primary space-y-2">
                      <h5 className="text-[10px] font-semibold text-gm-text-primary">Extracted Entities ({((extractFromText.data as Record<string, unknown>).entities as unknown[]).length})</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {((extractFromText.data as Record<string, unknown>).entities as Array<Record<string, unknown>>).map((ent, i) => (
                          <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-medium border border-gm-border-primary bg-gm-surface-hover text-gm-text-primary">
                            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: getColor(String(ent.type || ent.entityType || ''), '#6366f1') }} />
                            {String(ent.name || ent.value || '?')}
                            <span className="ml-1 text-gm-text-tertiary">{String(ent.type || ent.entityType || '')}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {((extractFromText.data as Record<string, unknown>).relationships as Array<Record<string, unknown>> || []).length > 0 && (
                    <div className="bg-gm-surface-secondary rounded-lg p-3 border border-gm-border-primary space-y-2">
                      <h5 className="text-[10px] font-semibold text-gm-text-primary">Extracted Relationships ({((extractFromText.data as Record<string, unknown>).relationships as unknown[]).length})</h5>
                      <div className="space-y-1">
                        {((extractFromText.data as Record<string, unknown>).relationships as Array<Record<string, unknown>>).map((rel, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-gm-text-primary">
                            <span className="font-medium">{String(rel.from || rel.source || '?')}</span>
                            <span className="px-1.5 py-0.5 rounded bg-gm-interactive-primary/10 text-gm-interactive-primary font-mono text-[9px]">{String(rel.type || rel.relationship || '?')}</span>
                            <span className="font-medium">{String(rel.to || rel.target || '?')}</span>
                            {rel.confidence && <span className="text-gm-text-tertiary">({Math.round(Number(rel.confidence) * 100)}%)</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {((extractFromText.data as Record<string, unknown>).entities as unknown[] || []).length === 0 &&
                   ((extractFromText.data as Record<string, unknown>).relationships as unknown[] || []).length === 0 && (
                    <p className="text-xs text-gm-text-tertiary">No entities or relationships found in the provided text.</p>
                  )}
                </div>
              )}
            </div>

            {/* Embedding Preview */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary space-y-3">
              <h4 className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Embedding Preview
              </h4>
              <p className="text-[10px] text-gm-text-tertiary">Preview the enriched text that would be generated for an entity before converting it to a vector embedding.</p>
              <div className="flex gap-2">
                <select value={enrichType} onChange={e => setEnrichType(e.target.value)}
                  className="flex-shrink-0 w-40 px-2 py-1.5 text-xs bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-gm-text-primary">
                  <option value="">Select type...</option>
                  {entities.map(e => {
                    const n = String(e.name || e.type || e.label || '');
                    return <option key={n} value={n}>{n}</option>;
                  })}
                </select>
              </div>
              <textarea value={enrichJson} onChange={e => setEnrichJson(e.target.value)} rows={4}
                className="w-full px-3 py-2 text-xs font-mono bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-gm-text-primary resize-y"
                placeholder='{"name": "...", "description": "..."}'
              />
              <button disabled={!enrichType || enrichEntity.isPending}
                onClick={() => {
                  try {
                    const parsed = JSON.parse(enrichJson);
                    enrichEntity.mutate({ type: enrichType, entity: parsed });
                  } catch { toast.error('Invalid JSON'); }
                }}
                className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                {enrichEntity.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Preview Embedding Text
              </button>
              {enrichEntity.data && (enrichEntity.data as Record<string, unknown>).enrichedText && (
                <div className="bg-gm-surface-secondary rounded-lg p-3 border border-gm-border-primary">
                  <h5 className="text-[10px] font-semibold text-gm-text-primary mb-2 flex items-center gap-1.5">
                    <Brain className="w-3 h-3" /> Generated Embedding Text
                  </h5>
                  <pre className="text-[10px] text-gm-text-primary whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {String((enrichEntity.data as Record<string, unknown>).enrichedText)}
                  </pre>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Entity Detail Modal */}
      {selectedEntity && (
        <EntityDetailPanel entity={selectedEntity} onClose={() => setSelectedEntity(null)} />
      )}
    </div>
  );
}
