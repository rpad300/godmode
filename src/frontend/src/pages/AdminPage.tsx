/**
 * Full superadmin administration area.
 * Every section hits real backend endpoints — no mock data.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Shield, Activity, FileText, Users as UsersIcon, Terminal,
  Plus, Trash2, CheckCircle, RotateCw, Save, Loader2, AlertTriangle,
  Edit3, X, History, Eye, EyeOff,
  ChevronRight, Network, Layers, Settings, FolderSync,
  CreditCard, Search, Pause, Play, RefreshCw,
  Cpu, Key, List, Ban, Upload, FolderTree, Link2, FileJson,
  Zap, Clock, File, Gauge, Database,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { ProviderIcon, getProviderColor } from '../components/ui/ProviderIcon';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import {
  useAdminStats, useSystemConfig, useUpdateSystemConfig, useApplyPreset,
  useAdminAuditLog, useSystemPrompts, useSavePrompt, usePromptVersions, usePromptVersionContent, useRestorePromptVersion, usePromptPreview, useOntologyContext,
  useSystemUsers, useCreateSystemUser, useUpdateSystemUser, useDeleteSystemUser,
  useProjectConfig, useUpdateProjectConfig,
  useLLMProviders, useLLMModels, useLLMMetadataModels, useLLMMetadataStatus, useLLMMetadataSync,
  useSystemProviderKeys, useSaveSystemProviderKey,
  useLLMQueueStatus, useLLMQueuePending, useLLMQueueRetryable, useLLMQueueHistory, useLLMQueueAction,
  useGraphConfig, useGraphStatus, useGraphInsights, useGraphList, useGraphMultiStats, useGraphSyncStatus,
  useGraphProviders, useGraphConnect, useGraphTest, useGraphSync, useGraphFullSync,
  useGraphCreateIndexes, useGraphCleanupOrphans, useGraphCleanupDuplicates, useGraphSyncCleanup,
  useGraphDeleteGraph, useGraphQuery, useGraphSyncProjects,
  useOntologySchema, useOntologyStats, useOntologyEntities, useOntologyRelations,
  useOntologySuggestions, useOntologyWorkerStatus, useOntologySyncStatus, useOntologyChanges,
  useOntologyCompliance, useOntologyDiff, useOntologyUnused,
  useOntologyAnalyzeGraph, useOntologyForceSync, useOntologyApproveSuggestion, useOntologyRejectSuggestion,
  useOntologyAutoApprove, useOntologyWorkerTrigger, useOntologyCleanup, useOntologyInferRelationships,
  useOntologyAddEntityType, useOntologyAddRelationType,
  useTeamAnalysisConfig, useUpdateTeamAnalysisConfig,
  useTeamProfiles, useTeamDynamics, useTeamRelationships,
  useRunTeamAnalysis, useAnalyzeProfile, useSyncTeamGraph, useTeamAdminProjects, useAdminRunProjectAnalysis,
  useGoogleDriveAdmin, useUpdateGoogleDriveAdmin, useGoogleDriveSync, useGoogleDriveBootstrap,
  useBillingProjects, useBillingPricing, useUpdateBillingPricing,
  useBillingExchangeRate, useUpdateExchangeRate, useRefreshExchangeRate, useBillingProjectAction,
  useAdminAuditLogs,
  usePendingFiles, useProcessFiles, useProcessStatus,
  useKnowledgeStatus, useKnowledgeSynthesize, useKnowledgeEmbed,
  useKnowledgeResynthesis, useKnowledgeRegenerate,
  type SystemStats, type PromptTemplate, type SystemUser,
} from '../hooks/useGodMode';

// ── Types ────────────────────────────────────────────────────────────────────

type AdminSection =
  | 'users' | 'system' | 'llm-providers' | 'model-metadata' | 'llm-queue'
  | 'graph' | 'ontology' | 'prompts' | 'processing' | 'team-analysis'
  | 'google-drive' | 'billing' | 'audit-log';

interface NavItem { key: AdminSection; label: string; icon: typeof Activity }

const NAV_ITEMS: NavItem[] = [
  { key: 'users', label: 'Users', icon: UsersIcon },
  { key: 'system', label: 'System', icon: Activity },
  { key: 'llm-providers', label: 'LLM Providers', icon: Key },
  { key: 'model-metadata', label: 'Model Metadata', icon: Cpu },
  { key: 'llm-queue', label: 'LLM Queue', icon: List },
  { key: 'graph', label: 'Graph', icon: Network },
  { key: 'ontology', label: 'Ontology', icon: Layers },
  { key: 'prompts', label: 'Prompts', icon: Terminal },
  { key: 'processing', label: 'Processing', icon: Settings },
  { key: 'team-analysis', label: 'Team Analysis', icon: UsersIcon },
  { key: 'google-drive', label: 'Google Drive', icon: FolderSync },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'audit-log', label: 'Audit Log', icon: FileText },
];

// ── Style tokens & shared helpers (extracted to admin/shared.tsx) ────────────
import {
  CARD, INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, SECTION_TITLE, TABLE_HEAD,
  Loading, ErrorBox, EmptyState, SectionHeader, StatCard, Toggle, r,
} from './admin/shared';

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Alert Banners — real data from /api/system/stats
// ══════════════════════════════════════════════════════════════════════════════

function AlertBanners() {
  const { data } = useAdminStats();
  const s = data as SystemStats | undefined;
  const alerts: Array<{ msg: string; severity: 'warning' | 'info' | 'danger' }> = [];
  if (s) {
    if (typeof s.disk === 'number' && s.disk > 75) alerts.push({ msg: `Disk usage at ${s.disk.toFixed(1)}% — consider cleanup of old embeddings`, severity: 'warning' });
    if (typeof s.cpu === 'number' && s.cpu > 90) alerts.push({ msg: `CPU usage critical at ${s.cpu.toFixed(1)}%`, severity: 'danger' });
    if (typeof s.ram === 'number' && s.ram > 85) alerts.push({ msg: `RAM usage high at ${s.ram.toFixed(1)}%`, severity: 'warning' });
    if (typeof s.latency === 'number' && s.latency > 200) alerts.push({ msg: `High latency: ${s.latency.toFixed(0)}ms`, severity: 'warning' });
  }
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-1.5 mb-4">
      {alerts.map((a, i) => (
        <div key={i} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium',
          a.severity === 'danger' ? 'bg-red-500/10 text-red-400' :
          a.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
          'bg-blue-500/10 text-blue-400')}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{a.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Users — /api/system/users CRUD
// Backend shape: { ok, users: SystemUser[], stats: { totalUsers, activeUsers, pendingInvitations } }
// ══════════════════════════════════════════════════════════════════════════════

function UsersSection() {
  const { data, isLoading, error } = useSystemUsers();
  const createUser = useCreateSystemUser();
  const updateUser = useUpdateSystemUser();
  const deleteUser = useDeleteSystemUser();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'user' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const resp = r(data);
  const allUsers = (resp.users ?? []) as SystemUser[];
  const stats = r(resp.stats);

  const filtered = useMemo(() => allUsers.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [allUsers, roleFilter, search]);

  const handleCreate = useCallback(() => {
    if (!form.email) { toast.error('Email is required'); return; }
    createUser.mutate(form, {
      onSuccess: () => { toast.success('User created'); setShowCreate(false); setForm({ email: '', name: '', password: '', role: 'user' }); },
      onError: (e: Error) => toast.error(e.message),
    });
  }, [form, createUser]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox msg="Unable to load users." />;

  return (
    <div className="space-y-5">
      <SectionHeader title="User Management" />
      {stats.totalUsers != null && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <StatCard label="Total Users" value={stats.totalUsers as number} />
          <StatCard label="Active" value={stats.activeUsers as number} color="var(--color-success-500)" />
          <StatCard label="Pending" value={stats.pendingInvitations as number} color="var(--color-warning-500)" />
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
          <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className={cn(INPUT, 'flex-1')} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={cn(INPUT, 'w-32')}>
          <option value="all">All Roles</option><option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option>
        </select>
        <button onClick={() => setShowCreate(!showCreate)} className={BTN_PRIMARY}><Plus className="w-3 h-3" /> Add User</button>
      </div>

      {showCreate && (
        <div className={cn(CARD, 'p-4 space-y-3')}>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INPUT} />
            <input placeholder="Display Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT} />
            <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={INPUT} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={INPUT}>
              <option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createUser.isPending} className={BTN_PRIMARY}>
              {createUser.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
            </button>
            <button onClick={() => setShowCreate(false)} className={BTN_SECONDARY}>Cancel</button>
          </div>
        </div>
      )}

      <div className={cn(CARD, 'overflow-hidden')}>
        <table className="w-full">
          <thead><tr className="border-b border-[var(--gm-border-primary)]">
            {['USER', 'EMAIL', 'ROLE', 'STATUS', 'LAST LOGIN', 'ACTIONS'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-3 text-left')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--gm-interactive-primary)]/15 text-[var(--gm-accent-primary)] font-bold flex items-center justify-center shrink-0 text-xs">
                      {(user.name || user.email || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[var(--gm-text-primary)]">{user.name || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--gm-text-tertiary)]">{user.email}</td>
                <td className="px-4 py-3">
                  <select value={user.role} onChange={e => updateUser.mutate({ id: user.id, role: e.target.value }, { onSuccess: () => toast.success('Role updated'), onError: (err: Error) => toast.error(err.message) })}
                    className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border-0',
                      user.role === 'superadmin' ? 'bg-red-500/20 text-red-400' : user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-primary)]')}>
                    <option value="user">user</option><option value="admin">admin</option><option value="superadmin">superadmin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                    user.status === 'active' ? 'bg-green-500/15 text-green-400' : user.status === 'banned' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--gm-text-tertiary)] tabular-nums">{user.lastActive ? new Date(user.lastActive).toLocaleString() : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => updateUser.mutate({ id: user.id, status: user.status === 'banned' ? 'active' : 'banned' }, { onSuccess: () => toast.success(user.status === 'banned' ? 'User unbanned' : 'User banned'), onError: (err: Error) => toast.error(err.message) })}
                      className="p-1 rounded hover:bg-[var(--gm-surface-hover)]" title={user.status === 'banned' ? 'Unban' : 'Ban'}>
                      {user.status === 'banned' ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <Ban className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                    {confirmDelete === user.id ? (
                      <>
                        <button onClick={() => deleteUser.mutate(user.id, { onSuccess: () => { toast.success('User deleted'); setConfirmDelete(null); }, onError: (err: Error) => toast.error(err.message) })} className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px]">Confirm</button>
                        <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 rounded text-[10px] text-[var(--gm-text-tertiary)]">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(user.id)} className="p-1 rounded hover:bg-[var(--gm-surface-hover)]"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-[var(--gm-text-tertiary)]">No users found.</div>}
      </div>
      <p className="text-[10px] text-[var(--gm-text-tertiary)] text-center">Showing {filtered.length} of {allUsers.length} users</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: System Health — /api/system/stats
// Backend: { cpu, ram, disk, latency, storageBreakdown, totalStorage, timestamp }
// ══════════════════════════════════════════════════════════════════════════════

function SystemSection() {
  const { data, isLoading, error, refetch } = useAdminStats();
  const s = data as (SystemStats & Record<string, unknown>) | undefined;
  if (isLoading) return <Loading />;
  if (error || !s) return <ErrorBox msg="Unable to load system stats." />;

  const srv = (s.server || {}) as Record<string, unknown>;
  const mem = (s.memory || {}) as Record<string, number>;
  const proc = (s.process || {}) as Record<string, number>;
  const dbStatus = (s.database || 'unknown') as string;

  const fmtUptime = (secs: number) => {
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
    return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
  };
  const fmtSize = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

  const thresholdColor = (val: number, warn: number, crit: number) =>
    val > crit ? '#ef4444' : val > warn ? '#f59e0b' : '#22c55e';

  const gauges = [
    { label: 'CPU', val: s.cpu, unit: '%', color: thresholdColor(s.cpu, 60, 80) },
    { label: 'RAM', val: s.ram, unit: '%', color: thresholdColor(s.ram, 60, 80) },
    { label: 'Disk', val: s.disk, unit: '%', color: thresholdColor(s.disk, 70, 90) },
    { label: 'Event Loop', val: s.latency, unit: 'ms', color: thresholdColor(s.latency, 50, 200) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="System Health" subtitle={s.timestamp ? `Last updated: ${new Date(s.timestamp).toLocaleString()}` : 'Real-time system monitoring'} />
        <button onClick={() => refetch()} className={BTN_SECONDARY}><RotateCw className="w-3 h-3" /> Refresh</button>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-4 gap-3">
        {gauges.map(g => (
          <div key={g.label} className={cn(CARD, 'p-4 text-center')}>
            <div className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">{g.label}</div>
            <div className="relative w-16 h-16 mx-auto mb-2">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--gm-bg-tertiary)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={g.color} strokeWidth="3"
                  strokeDasharray={`${Math.min(((typeof g.val === 'number' ? g.val : 0) / (g.unit === 'ms' ? 500 : 100)) * 97.4, 97.4)} 97.4`}
                  strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--gm-text-primary)] tabular-nums">
                {typeof g.val === 'number' ? (g.unit === 'ms' ? g.val : g.val.toFixed(0)) : g.val}
              </span>
            </div>
            <div className="text-[9px] font-medium tabular-nums" style={{ color: g.color }}>{g.unit}</div>
          </div>
        ))}
      </div>

      {/* Server + DB Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(CARD, 'p-4 space-y-2.5')}>
          <h3 className={SECTION_TITLE}>Server</h3>
          {[
            ['Node', String(srv.nodeVersion || '—')],
            ['Platform', `${srv.platform || '—'} / ${srv.arch || '—'}`],
            ['Hostname', String(s.hostname || '—')],
            ['PID', String(srv.pid || '—')],
            ['Uptime', typeof srv.uptime === 'number' ? fmtUptime(srv.uptime as number) : '—'],
            ['CPU Cores', String(s.cpuCores || '—')],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">{k}</span>
              <span className="text-xs text-[var(--gm-text-primary)] font-mono tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <div className={cn(CARD, 'p-4 space-y-2.5')}>
          <h3 className={SECTION_TITLE}>Runtime</h3>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Database</span>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
              dbStatus === 'connected' ? 'bg-green-500/10 text-green-400' :
              dbStatus === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400')}>
              {dbStatus}
            </span>
          </div>
          {[
            ['Heap Used', `${proc.heapUsedMB || 0} MB`],
            ['Heap Total', `${proc.heapTotalMB || 0} MB`],
            ['Heap %', `${proc.heapPercent || 0}%`],
            ['RSS', `${proc.rssMB || 0} MB`],
            ['System RAM', mem.totalMB ? `${fmtSize(mem.usedMB || 0)} / ${fmtSize(mem.totalMB)}` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">{k}</span>
              <span className="text-xs text-[var(--gm-text-primary)] font-mono tabular-nums">{v}</span>
            </div>
          ))}
          {proc.heapPercent > 0 && (
            <div className="h-1.5 rounded-full bg-[var(--gm-bg-tertiary)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${proc.heapPercent}%`, backgroundColor: thresholdColor(proc.heapPercent, 60, 85) }} />
            </div>
          )}
        </div>
      </div>

      {/* Storage */}
      {s.storageBreakdown && s.storageBreakdown.length > 0 && (
        <div className={cn(CARD, 'p-5')}>
          <h3 className={cn(SECTION_TITLE, 'mb-4')}>Storage</h3>
          <div className="space-y-4">
            {s.storageBreakdown.map((d: Record<string, unknown>, i: number) => {
              const sizeMB = Number(d.size || 0);
              const freeMB = Number(d.free || 0);
              const usedMB = sizeMB - freeMB;
              const usedPct = sizeMB > 0 ? Math.round((usedMB / sizeMB) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[var(--gm-text-primary)]">{String(d.category)}</span>
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums font-mono">
                      {fmtSize(usedMB)} / {fmtSize(sizeMB)} ({usedPct}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--gm-bg-tertiary)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${usedPct}%`, backgroundColor: thresholdColor(usedPct, 70, 90) }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-[var(--gm-text-tertiary)]">{fmtSize(freeMB)} free</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: LLM Providers — /api/config (GET+POST) for keys + task config
// GET returns MASKED keys: providers[id] has { apiKeyMasked, isConfigured, name }
//   apiKey is DELETED from the response — never sent to frontend
// POST /api/config body: { llm: { providers: { [id]: { apiKey } }, perTask } }
//   saves raw key to config.json + memory, key resolution chain:
//   body → config.json → Supabase secrets → env vars
// ══════════════════════════════════════════════════════════════════════════════

function LLMProvidersSection() {
  const { data: configData, isLoading } = useProjectConfig();
  const { data: providerData } = useLLMProviders();
  const { data: secretsData, isLoading: secretsLoading } = useSystemProviderKeys();
  const saveKey = useSaveSystemProviderKey();
  const updateConfig = useUpdateProjectConfig();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({});
  const [taskEdits, setTaskEdits] = useState<Record<string, { provider: string; model: string }>>({});

  const config = r(configData);
  const llm = r(config.llm);
  const providers = r(llm.providers) as Record<string, Record<string, unknown>>;
  const perTask = r(llm.perTask) as Record<string, Record<string, string>>;

  const provResp = r(providerData);
  const backendProviders = (provResp.providers ?? []) as Array<Record<string, unknown>>;

  // Real key status from Supabase secrets table (encrypted)
  const secretsResp = r(secretsData);
  const secretProviders = (secretsResp.providers ?? []) as Array<{
    id: string; aliases?: string[]; name?: string; configured: boolean; source: string | null; masked: string | null;
  }>;

  // Match a config/frontend provider ID to the corresponding Supabase secret entry
  // Handles aliases: claude→anthropic, gemini→google, xai→grok
  const findSecret = useCallback((id: string) => {
    return secretProviders.find(s => s.id === id || (s.aliases && s.aliases.includes(id)));
  }, [secretProviders]);

  const providerList = useMemo(() => {
    const seen = new Set<string>();
    const list = Object.entries(providers).map(([key, val]) => {
      const secretInfo = findSecret(key);
      const canonicalId = secretInfo?.id || key;
      seen.add(canonicalId);
      seen.add(key);
      return {
        id: canonicalId,
        name: secretInfo?.name || (val.name || key) as string,
        apiKeyMasked: secretInfo?.masked || (val.apiKeyMasked || null) as string | null,
        isConfigured: secretInfo?.configured || !!(val.isConfigured),
        keySource: secretInfo?.source || null,
      };
    });
    // Add secret providers not already represented
    secretProviders.forEach(sp => {
      if (!seen.has(sp.id)) {
        seen.add(sp.id);
        list.push({
          id: sp.id,
          name: sp.name || (sp.id || 'unknown').charAt(0).toUpperCase() + (sp.id || 'unknown').slice(1),
          apiKeyMasked: sp.masked,
          isConfigured: sp.configured,
          keySource: sp.source,
        });
      }
    });
    return list;
  }, [providers, secretProviders, findSecret]);

  const handleSaveKeys = useCallback(() => {
    const edits = Object.entries(keyEdits).filter(([, v]) => v.trim().length > 0);
    if (edits.length === 0) { toast.info('No changes to save'); return; }

    // Save each key to Supabase secrets via the dedicated endpoint
    let savedCount = 0;
    const total = edits.length;
    for (const [id, key] of edits) {
      saveKey.mutate({ provider: id, apiKey: key }, {
        onSuccess: () => {
          savedCount++;
          if (savedCount === total) {
            toast.success(`${total} API key${total > 1 ? 's' : ''} saved to encrypted vault`);
            setKeyEdits({});
          }
        },
        onError: (e: Error) => toast.error(`Failed to save ${id}: ${e.message}`),
      });
    }
  }, [keyEdits, saveKey]);

  const handleSaveTaskConfig = useCallback(() => {
    if (Object.keys(taskEdits).length === 0) { toast.info('No changes to save'); return; }
    updateConfig.mutate({ llm: { perTask: taskEdits } }, {
      onSuccess: () => { toast.success('LLM configuration saved'); setTaskEdits({}); },
      onError: (e: Error) => toast.error(e.message),
    });
  }, [taskEdits, updateConfig]);

  if (isLoading || secretsLoading) return <Loading />;

  const hasKeyEdits = Object.values(keyEdits).some(v => v.trim().length > 0);

  return (
    <div className="space-y-8">
      <SectionHeader title="LLM Providers" subtitle="System-level API keys stored encrypted in Supabase vault" />

      {/* Key resolution info box */}
      <div className={cn(CARD, 'p-4 border-l-2 border-[var(--gm-accent-primary)]')}>
        <h4 className="text-xs font-semibold text-[var(--gm-accent-primary)] mb-2">Key Resolution & Billing</h4>
        <div className="text-[11px] text-[var(--gm-text-secondary)] space-y-1">
          <p>The LLM service resolves API keys in this order: <strong>Project key</strong> (Supabase secrets, project scope) then <strong>System key</strong> (Supabase secrets, system scope) then <strong>Config file</strong> (fallback).</p>
          <p>When a project uses its <strong>own API key</strong> (BYOK), billing is <span className="text-green-400 font-medium">skipped</span> — the project pays the provider directly.</p>
          <p>When using <strong>system keys</strong>, the project balance is <span className="text-amber-400 font-medium">debited</span> with the configured markup.</p>
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <div className="flex items-center justify-between">
          <h3 className={SECTION_TITLE}>System LLM API Keys</h3>
          <span className="text-[10px] text-[var(--gm-text-tertiary)]">{providerList.filter(p => p.isConfigured).length}/{providerList.length} configured</span>
        </div>
        {providerList.map(p => (
          <div key={p.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--gm-accent-primary)]">{p.name || '(unnamed)'}</span>
              {p.isConfigured ? (
                <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Configured</span>
              ) : (
                <span className="text-[10px] text-amber-400">Not configured</span>
              )}
              {p.keySource && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded', p.keySource === 'system' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300')}>
                  {p.keySource} scope
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type={showKeys[p.id] ? 'text' : 'password'}
                value={keyEdits[p.id] ?? ''}
                onChange={e => setKeyEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                placeholder={p.apiKeyMasked || `Enter ${p.name} API key...`}
                className={cn(INPUT, 'flex-1 font-mono text-xs')}
              />
              <button onClick={() => setShowKeys(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className={BTN_SECONDARY}>
                {showKeys[p.id] ? 'Hide' : 'Show'}
              </button>
            </div>
            {p.apiKeyMasked && !keyEdits[p.id] && (
              <p className="text-[10px] text-[var(--gm-text-tertiary)] font-mono pl-1">Current: {p.apiKeyMasked}</p>
            )}
          </div>
        ))}
        <button onClick={handleSaveKeys} disabled={saveKey.isPending || !hasKeyEdits} className={BTN_PRIMARY}>
          {saveKey.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save to Encrypted Vault
        </button>
      </div>

      {/* Service API Keys section — stored in Supabase secrets just like LLM keys */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Service API Keys</h3>
        <p className="text-xs text-[var(--gm-text-tertiary)]">Keys for email, notifications and other services (stored encrypted in Supabase)</p>
        {(() => {
          const services = (secretsResp.services ?? []) as Array<{ id: string; name: string; configured: boolean; masked: string | null }>;
          const svcMeta: Record<string, { link: string }> = {
            resend: { link: 'https://resend.com/api-keys' },
            brave: { link: 'https://brave.com/search/api/' },
          };
          return services.length > 0 ? services.map(svc => (
            <div key={svc.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--gm-accent-primary)]">{svc.name || '(unnamed)'}</span>
                {svc.configured ? (
                  <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Configured</span>
                ) : (
                  <span className="text-[10px] text-amber-400">Not configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type={showKeys[svc.id] ? 'text' : 'password'}
                  value={keyEdits[svc.id] ?? ''}
                  onChange={e => setKeyEdits(prev => ({ ...prev, [svc.id]: e.target.value }))}
                  placeholder={svc.masked || `Enter ${svc.name} key...`}
                  className={cn(INPUT, 'flex-1 font-mono text-xs')}
                />
                <button onClick={() => setShowKeys(prev => ({ ...prev, [svc.id]: !prev[svc.id] }))} className={BTN_SECONDARY}>
                  {showKeys[svc.id] ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => {
                    const val = keyEdits[svc.id]?.trim();
                    if (!val) { toast.info('Enter a key first'); return; }
                    saveKey.mutate({ provider: svc.id, apiKey: val }, {
                      onSuccess: () => { toast.success(`${svc.name} key saved`); setKeyEdits(prev => { const n = { ...prev }; delete n[svc.id]; return n; }); },
                      onError: (e: Error) => toast.error(e.message),
                    });
                  }}
                  disabled={saveKey.isPending || !keyEdits[svc.id]?.trim()}
                  className={BTN_PRIMARY}
                >
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
              {svc.masked && !keyEdits[svc.id] && (
                <p className="text-[10px] text-[var(--gm-text-tertiary)] font-mono pl-1">Current: {svc.masked}</p>
              )}
              {svcMeta[svc.id]?.link && <p className="text-[10px] text-[var(--gm-text-tertiary)]">Get key at <a href={svcMeta[svc.id].link} target="_blank" rel="noreferrer" className="text-[var(--gm-accent-primary)] underline">{svcMeta[svc.id].link}</a></p>}
            </div>
          )) : (
            // Fallback if services not returned (backend not updated yet)
            ['resend', 'brave'].map(id => (
              <div key={id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--gm-accent-primary)]">{id === 'resend' ? 'Resend (Email)' : 'Brave Search'}</span>
                  <span className="text-[10px] text-amber-400">Not configured</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyEdits[id] ?? ''}
                    onChange={e => setKeyEdits(prev => ({ ...prev, [id]: e.target.value }))}
                    placeholder={`Enter ${id} API key...`}
                    className={cn(INPUT, 'flex-1 font-mono text-xs')}
                  />
                  <button
                    onClick={() => {
                      const val = keyEdits[id]?.trim();
                      if (!val) return;
                      saveKey.mutate({ provider: id, apiKey: val }, {
                        onSuccess: () => { toast.success(`${id} key saved`); setKeyEdits(prev => { const n = { ...prev }; delete n[id]; return n; }); },
                        onError: (e: Error) => toast.error(e.message),
                      });
                    }}
                    disabled={saveKey.isPending || !keyEdits[id]?.trim()}
                    className={BTN_PRIMARY}
                  >
                    <Save className="w-3 h-3" /> Save
                  </button>
                </div>
              </div>
            ))
          );
        })()}
      </div>

      {/* Task-Specific AI Config */}
      <div className={cn(CARD, 'p-5 space-y-5')}>
        <div>
          <h3 className={SECTION_TITLE}>Task-Specific AI Configuration</h3>
          <p className="text-xs text-[var(--gm-text-tertiary)] mt-1">Configure which provider and model to use for each AI task. These settings apply globally to the platform.</p>
        </div>
        {Object.entries(perTask).map(([task, cfg]) => {
          const taskLabel = task.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
          return (
            <div key={task} className="space-y-2">
              <span className="text-sm font-medium text-[var(--gm-text-primary)] capitalize">{taskLabel}</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn(TABLE_HEAD, 'block mb-1')}>PROVIDER</label>
                  <select value={taskEdits[task]?.provider ?? cfg?.provider ?? ''} onChange={e => setTaskEdits(prev => ({ ...prev, [task]: { provider: e.target.value, model: prev[task]?.model ?? cfg?.model ?? '' } }))} className={cn(INPUT, 'w-full text-xs')}>
                    <option value="">Select...</option>
                    {providerList.filter(p => p.isConfigured).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <span className="text-[10px] text-[var(--gm-accent-primary)] mt-0.5 block">{providerList.filter(p => p.isConfigured).length} provider(s) available</span>
                </div>
                <div>
                  <label className={cn(TABLE_HEAD, 'block mb-1')}>MODEL</label>
                  <input value={taskEdits[task]?.model ?? cfg?.model ?? ''} onChange={e => setTaskEdits(prev => ({ ...prev, [task]: { provider: prev[task]?.provider ?? cfg?.provider ?? '', model: e.target.value } }))} className={cn(INPUT, 'w-full text-xs')} placeholder="e.g. gpt-4o" />
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3">
          <button onClick={handleSaveTaskConfig} disabled={updateConfig.isPending || Object.keys(taskEdits).length === 0} className={BTN_PRIMARY}>
            {updateConfig.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save LLM Configuration
          </button>
          <span className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Changes apply immediately to all AI processing</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Model Metadata — /api/llm/models
// Backend: { provider, textModels, visionModels, embeddingModels }
// ══════════════════════════════════════════════════════════════════════════════

function ModelMetadataSection() {
  const { data: dbModelsData, isLoading: dbLoading, refetch: refetchDbModels } = useLLMMetadataModels();
  const { data: syncStatusData, refetch: refetchStatus } = useLLMMetadataStatus();
  const syncMutation = useLLMMetadataSync();
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  if (dbLoading) return <Loading />;

  const dbResp = r(dbModelsData);
  const dbModels = (dbResp.models ?? []) as Array<Record<string, unknown>>;
  const syncProviders = (r(syncStatusData).providers ?? []) as Array<Record<string, unknown>>;
  const syncResults = r(syncMutation.data);

  const allModels = dbModels.map(m => ({
    ...m,
    _type: (m.model_type || 'text') as string,
    _provider: (m.provider || 'unknown') as string,
  }));

  const byProvider = allModels.reduce<Record<string, typeof allModels>>((acc, m) => {
    if (!acc[m._provider]) acc[m._provider] = [];
    acc[m._provider].push(m);
    return acc;
  }, {});
  const providerNames = Object.keys(byProvider).sort();
  const uniqueProviderCount = providerNames.length;

  const fmtCtx = (tokens: unknown): string => {
    const n = Number(tokens);
    if (!n || isNaN(n)) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  };

  const fmtPrice = (raw: unknown): string => {
    const n = Number(raw);
    if (!n || isNaN(n)) return '—';
    return `$${n.toFixed(2)}`;
  };

  const filtered = allModels.filter(m => {
    if (filterProvider !== 'all' && m._provider !== filterProvider) return false;
    if (filterType !== 'all' && m._type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = String(m.display_name || m.model_id || '').toLowerCase();
      const id = String(m.model_id || '').toLowerCase();
      if (!name.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  const textFiltered = filtered.filter(m => m._type === 'text');
  const embedFiltered = filtered.filter(m => m._type === 'embedding');

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      await refetchDbModels();
      await refetchStatus();
      const res = r(result);
      toast.success(`Models synced — ${res.totalSynced ?? 0} updated across all providers`);
    } catch (e: any) {
      toast.error(e.message || 'Sync failed');
    }
  };

  const hasDbData = allModels.length > 0;

  return (
    <div className="space-y-6">
      <SectionHeader title="Model Metadata" subtitle={hasDbData ? `${allModels.length} models across ${uniqueProviderCount} provider(s)` : 'No models synced yet — click Sync to populate'} />

      {/* Sync Controls + Provider Status */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={SECTION_TITLE}>Provider Sync</h3>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">
              Fetches models from each provider API and persists to the database.
            </p>
          </div>
          <button onClick={handleSync} disabled={syncMutation.isPending} className={BTN_PRIMARY}>
            {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncMutation.isPending ? 'Syncing...' : 'Sync All Providers'}
          </button>
        </div>

        {/* Sync Results Badges */}
        {syncResults.results && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(syncResults.results as Record<string, Record<string, unknown>>).map(([prov, res]) => (
              <span key={prov} className={cn('inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-medium border',
                res.status === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                res.status === 'skipped' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                'bg-red-500/10 border-red-500/30 text-red-400')}>
                <ProviderIcon provider={prov} size={12} />
                <span className="font-semibold">{prov}</span>
                {res.status === 'success' && <> — {res.synced as number} synced</>}
                {res.status === 'skipped' && <> — {res.reason as string}</>}
                {res.status === 'error' && <> — error</>}
              </span>
            ))}
          </div>
        )}

        {/* Provider Status Row */}
        {(syncProviders.length > 0 || providerNames.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(syncProviders.length > 0 ? syncProviders : providerNames.map(id => ({ provider: id }))).map((sp, i) => {
              const pId = (sp.provider || '') as string;
              const count = (sp.active_models ?? sp.activeModels ?? byProvider[pId]?.length ?? 0) as number;
              const lastSync = sp.last_synced as string | undefined;
              const isSelected = filterProvider === pId;
              return (
                <button key={i} onClick={() => setFilterProvider(isSelected ? 'all' : pId)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left',
                    'bg-[var(--gm-bg-secondary)] border-[var(--gm-border-primary)] hover:border-[var(--gm-border-secondary)]',
                    isSelected && 'ring-1 ring-[var(--gm-accent-primary)]/50 border-[var(--gm-accent-primary)]/40',
                  )}>
                  <ProviderIcon provider={pId} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-[var(--gm-text-primary)] truncate capitalize">{pId}</div>
                    <div className="text-[10px] tabular-nums" style={{ color: getProviderColor(pId) }}>{count} models</div>
                    {lastSync && <div className="text-[8px] text-[var(--gm-text-tertiary)] truncate">{new Date(lastSync).toLocaleDateString()}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className={cn(CARD, 'p-3 flex items-center gap-3 flex-wrap')}>
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className={cn(INPUT, 'w-auto max-w-[180px]')}>
          <option value="all">All Providers</option>
          {providerNames.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={cn(INPUT, 'w-auto max-w-[140px]')}>
          <option value="all">All Types</option>
          <option value="text">Text</option>
          <option value="embedding">Embedding</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..."
          className={cn(INPUT, 'w-auto max-w-[220px]')} />
        <span className="text-[10px] text-[var(--gm-text-tertiary)] ml-auto tabular-nums">{filtered.length} of {allModels.length}</span>
      </div>

      {/* Text & Vision Models Table */}
      {textFiltered.length > 0 && (
        <div className={cn(CARD, 'overflow-hidden')}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--gm-border-primary)]">
            <h3 className={SECTION_TITLE}>Text & Vision Models</h3>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">{textFiltered.length} models</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--gm-border-primary)]">
                {['Model', 'Provider', 'Type', 'Context', '$/1M In', '$/1M Out'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
              </tr></thead>
              <tbody>
                {textFiltered.map((m, i) => {
                  const displayName = (m.display_name || '') as string;
                  const modelId = (m.model_id || '—') as string;
                  const prov = m._provider;
                  const hasVision = !!m.supports_vision;
                  return (
                    <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                      <td className="px-4 py-2.5">
                        {displayName && <div className="text-xs font-medium text-[var(--gm-text-primary)]">{displayName}</div>}
                        <div className="text-[10px] font-mono text-[var(--gm-text-tertiary)]">{modelId}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <ProviderIcon provider={prov} size={14} />
                          <span className="text-xs text-[var(--gm-text-secondary)] capitalize">{prov}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--gm-bg-tertiary)] text-[var(--gm-accent-primary)]">text</span>
                          {hasVision && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/15 text-purple-400">vision</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gm-text-primary)] tabular-nums font-semibold">{fmtCtx(m.context_tokens)}</td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] tabular-nums">{fmtPrice(m.price_input)}</td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] tabular-nums">{fmtPrice(m.price_output)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Embedding Models */}
      {embedFiltered.length > 0 && (
        <div className={cn(CARD, 'overflow-hidden')}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--gm-border-primary)]">
            <h3 className={SECTION_TITLE}>Embedding Models</h3>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">{embedFiltered.length} models</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--gm-border-primary)]">
                {['Model', 'Provider', 'Context', '$/1M In'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
              </tr></thead>
              <tbody>
                {embedFiltered.map((m, i) => {
                  const displayName = (m.display_name || '') as string;
                  const modelId = (m.model_id || '—') as string;
                  return (
                    <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                      <td className="px-4 py-2.5">
                        {displayName && <div className="text-xs font-medium text-[var(--gm-text-primary)]">{displayName}</div>}
                        <div className="text-[10px] font-mono text-[var(--gm-text-tertiary)]">{modelId}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <ProviderIcon provider={(m.provider || '') as string} size={14} />
                          <span className="text-xs text-[var(--gm-text-secondary)] capitalize">{(m.provider || '') as string}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gm-text-primary)] tabular-nums font-semibold">{fmtCtx(m.context_tokens)}</td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] tabular-nums">{fmtPrice(m.price_input)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasDbData && <EmptyState msg="No models in database yet. Click 'Sync All Providers' to fetch from APIs." />}
      {hasDbData && filtered.length === 0 && <EmptyState msg="No models match the current filters." />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: LLM Queue — /api/llm/queue/*
// Status: { isProcessing, isPaused, queueLength, currentRequest, stats: { total, successful, failed, avgProcessingTime }, pendingItems, database }
// ══════════════════════════════════════════════════════════════════════════════

function LLMQueueSection() {
  const { data: statusData, isLoading, refetch } = useLLMQueueStatus();
  const { data: pendingData } = useLLMQueuePending();
  const { data: retryableData } = useLLMQueueRetryable();
  const { data: historyData } = useLLMQueueHistory();
  const queueAction = useLLMQueueAction();
  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);

  if (isLoading) return <Loading />;

  const s = r(statusData);
  const stats = r(s.stats);
  const db = r(s.database);
  const pendingItems = ((r(pendingData).items ?? s.pendingItems ?? []) as Array<Record<string, unknown>>);
  const failedItems = ((r(retryableData).items ?? []) as Array<Record<string, unknown>>);
  const historyItems = ((r(historyData).items ?? r(historyData).history ?? []) as Array<Record<string, unknown>>);
  const costToday = db.totalCostTodayUsd ?? stats.totalCost ?? stats.costToday;

  const confirmClear = () => {
    if (!confirm('Clear all pending items from the queue? This cannot be undone.')) return;
    queueAction.mutate({ action: 'clear' }, { onSuccess: () => { toast.success('Queue cleared'); refetch(); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="LLM Processing Queue" subtitle="Monitor and control AI request processing — All requests are persisted in database" />

      {/* Status + Controls */}
      <div className={cn(CARD, 'p-5 space-y-3')}>
        <h3 className={SECTION_TITLE}>Queue Status</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {s.database != null && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-400">DB: Connected</span>}
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold',
            s.isPaused ? 'bg-amber-500/15 text-amber-400' : s.isProcessing ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400')}>
            {s.isPaused ? 'PAUSED' : s.isProcessing ? 'PROCESSING' : 'IDLE'}
          </span>
          <span className="text-xs text-[var(--gm-accent-primary)] tabular-nums">Queue: {s.queueLength ?? 0}</span>
          <span className="text-xs text-[var(--gm-text-tertiary)] tabular-nums">Processing: {s.isProcessing ? 1 : 0}</span>
          <button onClick={() => refetch()} className={BTN_SECONDARY}><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => queueAction.mutate({ action: 'pause' }, { onSuccess: () => { toast.success('Queue paused'); refetch(); }, onError: (e: Error) => toast.error(e.message) })} disabled={queueAction.isPending} className={BTN_DANGER}><Pause className="w-3 h-3" /> Pause</button>
          <button onClick={() => queueAction.mutate({ action: 'resume' }, { onSuccess: () => { toast.success('Queue resumed'); refetch(); }, onError: (e: Error) => toast.error(e.message) })} disabled={queueAction.isPending} className={BTN_PRIMARY}><Play className="w-3 h-3" /> Resume</button>
          <button onClick={confirmClear} disabled={queueAction.isPending} className={BTN_SECONDARY}>Clear Queue</button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
        <StatCard label="Pending" value={db.pendingCount ?? s.queueLength ?? pendingItems.length ?? 0} />
        <StatCard label="Processing" value={db.processingCount ?? (s.isProcessing ? 1 : 0)} />
        <StatCard label="Completed" value={db.completedToday ?? stats.successful ?? stats.completed ?? 0} color="var(--color-brand-500)" />
        <StatCard label="Failed" value={db.failedToday ?? stats.failed ?? 0} color="var(--color-danger-500)" />
        <StatCard label="Retry Pending" value={db.retryPendingCount ?? failedItems.length} />
        <StatCard label="Avg Time (ms)" value={db.avgProcessingTimeMs ?? stats.avgProcessingTime ? Number(db.avgProcessingTimeMs ?? stats.avgProcessingTime).toLocaleString() : '0'} />
        <StatCard label="Cost Today" value={costToday != null ? `$${Number(costToday).toFixed(4)}` : '$0'} color="var(--color-brand-500)" />
      </div>

      {/* Currently Processing */}
      {s.currentRequest && (
        <div className={cn(CARD, 'p-4')}>
          <h3 className={cn(SECTION_TITLE, 'mb-2')}>Currently Processing</h3>
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-[var(--gm-text-primary)]">{(s.currentRequest as Record<string, unknown>).context as string || (s.currentRequest as Record<string, unknown>).id as string}</div>
              <div className="flex items-center gap-3 mt-0.5">
                {(s.currentRequest as Record<string, unknown>).priority && <span className="text-[10px] text-[var(--gm-text-tertiary)]">Priority: {(s.currentRequest as Record<string, unknown>).priority as string}</span>}
                {(s.currentRequest as Record<string, unknown>).startedAt && <span className="text-[10px] text-[var(--gm-text-tertiary)]">Started: {new Date((s.currentRequest as Record<string, unknown>).startedAt as string).toLocaleString()}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Items */}
      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECTION_TITLE}>Pending Items</h3>
          <span className="text-xs text-[var(--gm-accent-primary)] tabular-nums">{pendingItems.length} items</span>
        </div>
        {pendingItems.length === 0 ? <p className="text-xs text-[var(--gm-text-tertiary)]">No items in queue</p> : (
          <table className="w-full">
            <thead><tr>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Context</th>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Priority</th>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Queued</th>
              <th className={cn(TABLE_HEAD, 'text-right py-2 px-2')}>Action</th>
            </tr></thead>
            <tbody>
              {pendingItems.slice(0, 20).map((item, i) => (
                <tr key={i} className="hover:bg-[var(--gm-surface-hover)] transition-colors">
                  <td className="text-xs text-[var(--gm-text-primary)] py-1.5 px-2 truncate max-w-[300px]">{(item.context || item.type || item.task || item.id || 'Unknown') as string}</td>
                  <td className="py-1.5 px-2">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                      (item.priority as string) === 'high' ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]')}>
                      {(item.priority || 'normal') as string}
                    </span>
                  </td>
                  <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2">{item.queuedAt ? new Date(item.queuedAt as string).toLocaleTimeString() : '—'}</td>
                  <td className="text-right py-1.5 px-2">
                    <button onClick={() => queueAction.mutate({ action: 'cancel', id: item.id as string }, { onSuccess: () => { toast.success('Cancelled'); refetch(); } })} className="text-[10px] text-red-400 hover:underline">Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Failed Items */}
      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECTION_TITLE}>Failed Items</h3>
          {failedItems.length > 0 && (
            <button onClick={() => queueAction.mutate({ action: 'retry-all' }, { onSuccess: () => { toast.success('Retrying all'); refetch(); } })} disabled={queueAction.isPending} className={BTN_DANGER}>
              <RotateCw className="w-3 h-3" /> Retry All
            </button>
          )}
        </div>
        {failedItems.length === 0 ? <p className="text-xs text-[var(--gm-text-tertiary)]">No failed items</p> : (
          <table className="w-full">
            <thead><tr>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Context</th>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Provider</th>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Attempts</th>
              <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Error</th>
              <th className={cn(TABLE_HEAD, 'text-right py-2 px-2')}>Actions</th>
            </tr></thead>
            <tbody>
              {failedItems.slice(0, 20).map((item, i) => (
                <tr key={i} className="hover:bg-[var(--gm-surface-hover)] transition-colors">
                  <td className="text-xs text-[var(--gm-text-primary)] py-1.5 px-2 truncate max-w-[200px]">{(item.context || item.type || 'Unknown') as string}</td>
                  <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2">{(item.provider || '—') as string}</td>
                  <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2 tabular-nums">{(item.attempts ?? item.attemptCount ?? '?') as string}/{(item.maxAttempts ?? item.maxRetries ?? '3') as string}</td>
                  <td className="text-[10px] text-red-400 py-1.5 px-2 truncate max-w-[200px]">{(item.error || item.errorMessage || 'Error') as string}</td>
                  <td className="text-right py-1.5 px-2 whitespace-nowrap">
                    <button onClick={() => queueAction.mutate({ action: 'retry', id: item.id as string }, { onSuccess: () => { toast.success('Retrying'); refetch(); } })} className="text-[10px] text-[var(--gm-accent-primary)] hover:underline mr-2">Retry</button>
                    <button onClick={() => queueAction.mutate({ action: 'retry', id: item.id as string + '?reset=true' }, { onSuccess: () => { toast.success('Reset & Retrying'); refetch(); } })} className="text-[10px] text-amber-400 hover:underline">Reset & Retry</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Processing History */}
      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECTION_TITLE}>Recent Processing History</h3>
          <span className="text-xs text-[var(--gm-text-tertiary)] tabular-nums">{historyItems.length} items</span>
        </div>
        {historyItems.length === 0 ? <p className="text-xs text-[var(--gm-text-tertiary)]">No processing history yet</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Context</th>
                <th className={cn(TABLE_HEAD, 'text-left py-2 px-2')}>Provider / Model</th>
                <th className={cn(TABLE_HEAD, 'text-center py-2 px-2')}>Status</th>
                <th className={cn(TABLE_HEAD, 'text-right py-2 px-2')}>Tokens</th>
                <th className={cn(TABLE_HEAD, 'text-right py-2 px-2')}>Time (ms)</th>
                <th className={cn(TABLE_HEAD, 'text-right py-2 px-2')}>Completed</th>
                <th className={cn(TABLE_HEAD, 'text-center py-2 px-2')}></th>
              </tr></thead>
              <tbody>
                {historyItems.slice(0, 50).map((item, i) => {
                  const ok = (item.status as string) === 'completed' || (item.status as string) === 'success';
                  const tokens = (item.inputTokens || item.tokensIn || 0) as number;
                  const tokensOut = (item.outputTokens || item.tokensOut || 0) as number;
                  return (
                    <tr key={i} className="hover:bg-[var(--gm-surface-hover)] transition-colors cursor-pointer" onClick={() => setSelectedRequest(item)}>
                      <td className="text-xs text-[var(--gm-text-primary)] py-1.5 px-2 truncate max-w-[200px]">{(item.context || item.type || item.task || item.id || '—') as string}</td>
                      <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2">{(item.provider || '—') as string}{item.model ? ` / ${item.model}` : ''}</td>
                      <td className="text-center py-1.5 px-2">
                        <span className={cn('inline-block w-2 h-2 rounded-full', ok ? 'bg-green-400' : 'bg-red-400')} />
                      </td>
                      <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2 text-right tabular-nums">{tokens > 0 ? `${tokens}→${tokensOut}` : '—'}</td>
                      <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2 text-right tabular-nums">{item.processingTime ?? item.durationMs ?? '—'}</td>
                      <td className="text-[10px] text-[var(--gm-text-tertiary)] py-1.5 px-2 text-right">{item.completedAt ? new Date(item.completedAt as string).toLocaleTimeString() : '—'}</td>
                      <td className="text-center py-1.5 px-2">
                        <button className="text-[10px] text-[var(--gm-accent-primary)] hover:underline">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {selectedRequest && <LLMRequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />}
    </div>
  );
}

function LLMRequestDetailModal({ request: req, onClose }: { request: Record<string, unknown>; onClose: () => void }) {
  const ok = (req.status as string) === 'completed' || (req.status as string) === 'success';
  const tokens = (req.inputTokens || req.tokensIn || 0) as number;
  const tokensOut = (req.outputTokens || req.tokensOut || 0) as number;
  const duration = (req.processingTime || req.durationMs || 0) as number;
  const cost = (req.estimatedCost || req.cost || 0) as number;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className={cn(CARD, 'relative w-[900px] max-w-[90vw] max-h-[85vh] flex flex-col')} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gm-border-primary)]">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', ok ? 'bg-green-500/15' : 'bg-red-500/15')}>
              {ok ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--gm-text-primary)]">LLM Request Details</h3>
              <p className="text-[10px] text-[var(--gm-text-tertiary)] font-mono">{(req.id || '—') as string}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status Bar */}
          <div className="flex flex-wrap gap-4 text-[10px]">
            <div><span className="text-[var(--gm-text-tertiary)]">Context:</span> <span className="text-[var(--gm-text-primary)] font-medium ml-1">{(req.context || req.type || '—') as string}</span></div>
            <div><span className="text-[var(--gm-text-tertiary)]">Provider:</span> <span className="text-[var(--gm-text-primary)] font-medium ml-1">{(req.provider || '—') as string}</span></div>
            <div><span className="text-[var(--gm-text-tertiary)]">Model:</span> <span className="text-[var(--gm-text-primary)] font-medium ml-1">{(req.model || '—') as string}</span></div>
            <div><span className="text-[var(--gm-text-tertiary)]">Status:</span> <span className={cn('font-semibold ml-1', ok ? 'text-green-400' : 'text-red-400')}>{(req.status || '—') as string}</span></div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Input Tokens" value={tokens.toLocaleString()} />
            <StatCard label="Output Tokens" value={tokensOut.toLocaleString()} />
            <StatCard label="Duration (ms)" value={Number(duration).toLocaleString()} />
            <StatCard label="Est. Cost" value={cost ? `$${Number(cost).toFixed(6)}` : '—'} />
          </div>

          {/* Timeline */}
          <div className={cn(CARD, 'p-4')}>
            <h4 className={cn(SECTION_TITLE, 'mb-2')}>Timeline</h4>
            <div className="flex flex-wrap gap-6 text-[10px]">
              <div><span className="text-[var(--gm-text-tertiary)]">Queued:</span> <span className="text-[var(--gm-text-primary)] ml-1">{req.queuedAt ? new Date(req.queuedAt as string).toLocaleString() : '—'}</span></div>
              <div><span className="text-[var(--gm-text-tertiary)]">Started:</span> <span className="text-[var(--gm-text-primary)] ml-1">{req.startedAt ? new Date(req.startedAt as string).toLocaleString() : '—'}</span></div>
              <div><span className="text-[var(--gm-text-tertiary)]">Completed:</span> <span className="text-[var(--gm-text-primary)] ml-1">{req.completedAt ? new Date(req.completedAt as string).toLocaleString() : '—'}</span></div>
            </div>
          </div>

          {/* Error */}
          {(req.error || req.errorMessage) && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <h4 className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Error</h4>
              <p className="text-[10px] text-red-300 font-mono whitespace-pre-wrap">{(req.error || req.errorMessage) as string}</p>
              {req.attempts && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-2">Attempt {req.attempts as number}/{(req.maxAttempts || req.maxRetries || 3) as number}</p>}
            </div>
          )}

          {/* Prompt / Input */}
          {(req.prompt || req.input) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className={SECTION_TITLE}>Prompt / Input</h4>
                <button onClick={() => copyText(String(req.prompt || req.input))} className={BTN_SECONDARY}>Copy</button>
              </div>
              <pre className="text-[10px] text-[var(--gm-text-secondary)] bg-[var(--gm-bg-tertiary)] rounded-lg p-3 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono">
                {String(req.prompt || req.input)}
              </pre>
            </div>
          )}

          {/* Response / Output */}
          {(req.response || req.output || req.result) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className={SECTION_TITLE}>Response / Output</h4>
                <button onClick={() => copyText(String(req.response || req.output || req.result))} className={BTN_SECONDARY}>Copy</button>
              </div>
              <pre className="text-[10px] text-[var(--gm-text-secondary)] bg-[var(--gm-bg-tertiary)] rounded-lg p-3 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono">
                {String(req.response || req.output || req.result)}
              </pre>
            </div>
          )}

          {/* Raw JSON */}
          <details className="group">
            <summary className="cursor-pointer text-[10px] text-[var(--gm-accent-primary)] hover:underline">Show Raw JSON Data</summary>
            <pre className="mt-2 text-[10px] text-[var(--gm-text-tertiary)] bg-[var(--gm-bg-tertiary)] rounded-lg p-3 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(req, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Graph Settings — /api/graph/config + /api/graph/status
// Config: { ok, config: { enabled, provider, graphName, ... }, source }
// Status: { ok, enabled, connected, nodes, relationships, nodeCount, edgeCount, stats, message }
// ══════════════════════════════════════════════════════════════════════════════

function GraphSection() {
  const { data: cfgData, isLoading } = useGraphConfig();
  const { data: stData, refetch: refetchStatus } = useGraphStatus();
  const { data: insightsData } = useGraphInsights();
  const { data: listData } = useGraphList();
  const { data: syncStatusData } = useGraphSyncStatus();
  const { data: providersData } = useGraphProviders();
  const graphConnect = useGraphConnect();
  const graphSync = useGraphSync();
  const fullSync = useGraphFullSync();
  const createIndexes = useGraphCreateIndexes();
  const cleanupOrphans = useGraphCleanupOrphans();
  const cleanupDups = useGraphCleanupDuplicates();
  const syncCleanup = useGraphSyncCleanup();
  const deleteGraph = useGraphDeleteGraph();
  const graphQuery = useGraphQuery();
  const syncProjects = useGraphSyncProjects();
  const [tab, setTab] = useState<'status' | 'operations' | 'graphs' | 'query'>('status');
  const [cypherQuery, setCypherQuery] = useState('');
  const [queryResult, setQueryResult] = useState<Record<string, unknown> | null>(null);

  if (isLoading) return <Loading />;

  const cfgResp = r(cfgData);
  const config = r(cfgResp.config);
  const status = r(stData);
  const insights = r(insightsData);
  const graphs = (r(listData).graphs ?? []) as Array<Record<string, unknown>>;
  const syncSt = r(syncStatusData);
  const providers = (r(providersData).providers ?? []) as Array<Record<string, unknown>>;
  const nodeCount = (status.nodeCount ?? status.nodes ?? 0) as number;
  const edgeCount = (status.edgeCount ?? status.relationships ?? 0) as number;
  const isConnected = !!status.connected;

  const insightMetrics = r(insights.metrics ?? insights);
  const recommendations = (insights.recommendations ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-5">
      <SectionHeader title="Knowledge Graph" subtitle={`${config.provider || '—'} · ${isConnected ? `${nodeCount} nodes · ${edgeCount} edges` : 'Not connected'}`} />

      {/* Tabs */}
      <div className={cn(CARD, 'p-1 flex gap-1')}>
        {(['status', 'operations', 'graphs', 'query'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 px-3 py-2 text-[11px] font-medium rounded-lg capitalize transition-colors',
              tab === t ? 'bg-[var(--gm-accent-primary)]/15 text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]')}>
            {t === 'status' ? 'Status & Config' : t === 'operations' ? 'Sync & Maintenance' : t === 'graphs' ? `Graphs (${graphs.length})` : 'Query'}
          </button>
        ))}
      </div>

      {/* ── Status Tab ── */}
      {tab === 'status' && (
        <div className="space-y-5">
          {/* Connection + Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(CARD, 'p-4 space-y-3')}>
              <div className="flex items-center justify-between">
                <h3 className={SECTION_TITLE}>Connection</h3>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', isConnected ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {[
                ['Provider', config.provider],
                ['Graph Name', config.graphName],
                ['Enabled', config.enabled ? 'Yes' : 'No'],
                ['Auto Connect', config.autoConnect ? 'Yes' : 'No'],
                ['Config Source', cfgResp.source],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">{k}</span>
                  <span className="text-xs text-[var(--gm-text-primary)] font-mono">{String(v ?? '—')}</span>
                </div>
              ))}
              {status.message && <p className="text-[10px] text-[var(--gm-text-tertiary)]">{status.message as string}</p>}
              <button onClick={() => refetchStatus()} className={cn(BTN_SECONDARY, 'w-full justify-center')}>
                <RotateCw className="w-3 h-3" /> Refresh Status
              </button>
            </div>

            <div className={cn(CARD, 'p-4 space-y-3')}>
              <h3 className={SECTION_TITLE}>Statistics</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Nodes" value={nodeCount} color="var(--gm-accent-primary)" />
                <StatCard label="Edges" value={edgeCount} color="var(--gm-accent-primary)" />
              </div>
              {(() => {
                const st = r(status.stats);
                return Object.keys(st).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(st).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-[10px] text-[var(--gm-text-tertiary)] capitalize">{k}</span>
                        <span className="text-xs text-[var(--gm-text-primary)] tabular-nums">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Insights */}
          {(Object.keys(insightMetrics).length > 0 || recommendations.length > 0) && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <h3 className={SECTION_TITLE}>Graph Insights</h3>
              {Object.keys(insightMetrics).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(insightMetrics).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <div className="text-[10px] text-[var(--gm-text-tertiary)] uppercase mb-1">{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</div>
                      <div className="text-sm font-bold text-[var(--gm-text-primary)] tabular-nums">{typeof v === 'number' ? (v < 1 ? (v as number).toFixed(3) : (v as number).toFixed(1)) : String(v)}</div>
                    </div>
                  ))}
                </div>
              )}
              {recommendations.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Recommendations</span>
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className={cn('shrink-0 mt-0.5', rec.priority === 'high' ? 'text-red-400' : rec.priority === 'medium' ? 'text-amber-400' : 'text-blue-400')}>●</span>
                      <span className="text-[var(--gm-text-secondary)]">{(rec.message || rec.text || rec.description) as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sync Status */}
          {Object.keys(syncSt).length > 0 && syncSt.ok !== undefined && (
            <div className={cn(CARD, 'p-4 space-y-2')}>
              <h3 className={SECTION_TITLE}>Sync Status</h3>
              {[
                ['Status', syncSt.status ?? syncSt.syncStatus ?? '—'],
                ['Last Sync', syncSt.lastSyncAt ? new Date(syncSt.lastSyncAt as string).toLocaleString() : '—'],
                ['Pending', syncSt.pending ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">{k}</span>
                  <span className="text-xs text-[var(--gm-text-primary)]">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Providers */}
          {providers.length > 0 && (
            <div className={cn(CARD, 'p-4')}>
              <h3 className={cn(SECTION_TITLE, 'mb-2')}>Available Providers</h3>
              <div className="flex flex-wrap gap-2">
                {providers.map((p, i) => (
                  <span key={i} className={cn('text-[10px] px-2.5 py-1 rounded-lg border font-medium',
                    (p.id || p.name) === config.provider ? 'bg-[var(--gm-accent-primary)]/15 border-[var(--gm-accent-primary)]/40 text-[var(--gm-accent-primary)]' :
                    'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>
                    {(p.name || p.id || '?') as string}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Operations Tab ── */}
      {tab === 'operations' && (
        <div className="space-y-5">
          <div className={cn(CARD, 'p-5 space-y-4')}>
            <h3 className={SECTION_TITLE}>Sync</h3>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => graphSync.mutate(undefined, { onSuccess: () => toast.success('Sync complete'), onError: (e: Error) => toast.error(e.message) })} disabled={graphSync.isPending} className={BTN_PRIMARY}>
                {graphSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Quick Sync
              </button>
              <button onClick={() => fullSync.mutate(undefined, { onSuccess: () => toast.success('Full sync complete'), onError: (e: Error) => toast.error(e.message) })} disabled={fullSync.isPending} className={BTN_PRIMARY}>
                {fullSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />} Full Sync
              </button>
              <button onClick={() => syncProjects.mutate(undefined, { onSuccess: () => toast.success('All projects synced'), onError: (e: Error) => toast.error(e.message) })} disabled={syncProjects.isPending} className={BTN_SECONDARY}>
                {syncProjects.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSync className="w-3.5 h-3.5" />} Sync All Projects
              </button>
            </div>
          </div>

          <div className={cn(CARD, 'p-5 space-y-4')}>
            <h3 className={SECTION_TITLE}>Indexes & Optimization</h3>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => createIndexes.mutate(undefined, { onSuccess: () => toast.success('Indexes created'), onError: (e: Error) => toast.error(e.message) })} disabled={createIndexes.isPending} className={BTN_SECONDARY}>
                {createIndexes.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Create Indexes
              </button>
            </div>
          </div>

          <div className={cn(CARD, 'p-5 space-y-4')}>
            <h3 className={SECTION_TITLE}>Cleanup</h3>
            <p className="text-[10px] text-[var(--gm-text-tertiary)]">Remove orphaned graphs, duplicate nodes, and stale relationships</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => cleanupOrphans.mutate(undefined, { onSuccess: (d) => toast.success(`Cleaned ${(d as Record<string, unknown>)?.deleted ?? '?'} orphans`), onError: (e: Error) => toast.error(e.message) })} disabled={cleanupOrphans.isPending} className={BTN_SECONDARY}>
                {cleanupOrphans.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Cleanup Orphan Graphs
              </button>
              <button onClick={() => cleanupDups.mutate(undefined, { onSuccess: () => toast.success('Duplicates cleaned'), onError: (e: Error) => toast.error(e.message) })} disabled={cleanupDups.isPending} className={BTN_SECONDARY}>
                {cleanupDups.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Cleanup Duplicates
              </button>
              <button onClick={() => syncCleanup.mutate(undefined, { onSuccess: () => toast.success('Sync cleanup done'), onError: (e: Error) => toast.error(e.message) })} disabled={syncCleanup.isPending} className={BTN_SECONDARY}>
                {syncCleanup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Sync Cleanup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Graphs Tab ── */}
      {tab === 'graphs' && (
        <div className="space-y-5">
          {graphs.length > 0 ? (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)]">
                <h3 className={SECTION_TITLE}>All Graphs</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--gm-border-primary)]">
                    {['Graph', 'Project', 'Nodes', 'Edges', 'Status', ''].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {graphs.map((g, i) => {
                      const name = (g.name || g.graphName || '—') as string;
                      const isCurrent = name === config.graphName;
                      return (
                        <tr key={i} className={cn('border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]', isCurrent && 'bg-[var(--gm-accent-primary)]/5')}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--gm-text-primary)]">{name}</span>
                              {isCurrent && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--gm-accent-primary)]/15 text-[var(--gm-accent-primary)] font-bold">ACTIVE</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-tertiary)]">{(g.projectName || g.projectId || '—') as string}</td>
                          <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-primary)] tabular-nums">{(g.nodeCount ?? g.nodes ?? '—') as string}</td>
                          <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-primary)] tabular-nums">{(g.edgeCount ?? g.edges ?? '—') as string}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                              g.orphan ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400')}>
                              {g.orphan ? 'Orphan' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {!isCurrent && (
                              <button onClick={() => { if (confirm(`Delete graph "${name}"?`)) deleteGraph.mutate(name, { onSuccess: () => toast.success(`Deleted ${name}`), onError: (e: Error) => toast.error(e.message) }); }} disabled={deleteGraph.isPending} className="text-[9px] text-red-400 hover:underline font-medium">
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState msg="No graphs found. Connect to a graph provider first." />
          )}
        </div>
      )}

      {/* ── Query Tab ── */}
      {tab === 'query' && (
        <div className="space-y-5">
          <div className={cn(CARD, 'p-5 space-y-3')}>
            <h3 className={SECTION_TITLE}>Cypher Query</h3>
            <textarea value={cypherQuery} onChange={e => setCypherQuery(e.target.value)}
              placeholder="MATCH (n) RETURN n LIMIT 10" rows={4}
              className={cn(INPUT, 'w-full font-mono text-xs resize-y')} />
            <button onClick={() => graphQuery.mutate({ query: cypherQuery }, {
              onSuccess: (d) => { setQueryResult(d as Record<string, unknown>); toast.success('Query executed'); },
              onError: (e: Error) => toast.error(e.message),
            })} disabled={graphQuery.isPending || !cypherQuery.trim()} className={BTN_PRIMARY}>
              {graphQuery.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Execute
            </button>
          </div>

          {queryResult && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <h3 className={SECTION_TITLE}>Result</h3>
              {(() => {
                const res = r(queryResult);
                const nodes = (res.nodes ?? []) as Array<Record<string, unknown>>;
                const edges = (res.edges ?? res.relationships ?? []) as Array<Record<string, unknown>>;
                const rows = (res.rows ?? res.data ?? []) as unknown[];

                return (
                  <div className="space-y-3">
                    {nodes.length > 0 && (
                      <div>
                        <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Nodes ({nodes.length})</span>
                        <div className="mt-1 max-h-48 overflow-y-auto">
                          {nodes.slice(0, 50).map((n, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--gm-border-primary)] last:border-0 text-[10px]">
                              <span className="text-[var(--gm-accent-primary)] font-medium">{(n.label || n.labels?.[0] || n.type || '?') as string}</span>
                              <span className="text-[var(--gm-text-primary)] truncate flex-1">{(n.name || n.title || n.id || JSON.stringify(n.properties || n).substring(0, 80)) as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {edges.length > 0 && (
                      <div>
                        <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Relationships ({edges.length})</span>
                        <div className="mt-1 max-h-48 overflow-y-auto">
                          {edges.slice(0, 50).map((e, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--gm-border-primary)] last:border-0 text-[10px]">
                              <span className="text-[var(--gm-text-primary)]">{(e.source || e.from || '?') as string}</span>
                              <span className="text-[var(--gm-accent-primary)] font-medium">→ {(e.type || e.label || '?') as string} →</span>
                              <span className="text-[var(--gm-text-primary)]">{(e.target || e.to || '?') as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {rows.length > 0 && nodes.length === 0 && edges.length === 0 && (
                      <pre className="text-[10px] text-[var(--gm-text-secondary)] font-mono bg-[var(--gm-bg-tertiary)] p-3 rounded-lg overflow-auto max-h-64">{JSON.stringify(rows, null, 2)}</pre>
                    )}
                    {nodes.length === 0 && edges.length === 0 && rows.length === 0 && (
                      <p className="text-[10px] text-[var(--gm-text-tertiary)]">No results returned.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Ontology — /api/ontology + /api/ontology/stats
// Ontology export: { ok, entityTypes: [...], relationTypes: [...], ... }
// Stats: { ok, stats: { [typeName]: count } }
// ══════════════════════════════════════════════════════════════════════════════

function OntologySection() {
  const { data, isLoading } = useOntologySchema();
  const { data: statsData } = useOntologyStats();
  const { data: sugData } = useOntologySuggestions();
  const { data: workerData } = useOntologyWorkerStatus();
  const { data: syncData } = useOntologySyncStatus();
  const { data: changesData } = useOntologyChanges();
  const complianceQ = useOntologyCompliance();
  const diffQ = useOntologyDiff();
  const unusedQ = useOntologyUnused();
  const analyzeGraph = useOntologyAnalyzeGraph();
  const forceSync = useOntologyForceSync();
  const approveSug = useOntologyApproveSuggestion();
  const rejectSug = useOntologyRejectSuggestion();
  const autoApprove = useOntologyAutoApprove();
  const workerTrigger = useOntologyWorkerTrigger();
  const cleanup = useOntologyCleanup();
  const inferRels = useOntologyInferRelationships();
  const addEntity = useOntologyAddEntityType();
  const addRelation = useOntologyAddRelationType();

  const [tab, setTab] = useState<'schema' | 'analysis' | 'maintenance'>('schema');
  const [newEntity, setNewEntity] = useState('');
  const [newRelation, setNewRelation] = useState('');

  if (isLoading) return <Loading />;

  const resp = r(data);
  const entities = (resp.entityTypes ?? resp.entities ?? []) as Array<Record<string, unknown>>;
  const relations = (resp.relationTypes ?? resp.relations ?? []) as Array<Record<string, unknown>>;
  const statsResp = r(statsData);
  const stats = r(statsResp.stats);
  const totalInstances = Object.values(stats).reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0);
  const typeColors = ['#38bdf8', '#34d399', '#fbbf24', '#818cf8', '#f472b6', '#94a3b8', '#fb923c', '#a78bfa'];

  const suggestions = (r(sugData).suggestions ?? []) as Array<Record<string, unknown>>;
  const workerStatus = r(workerData);
  const syncStatus = r(syncData);
  const changes = (r(changesData).changes ?? []) as Array<Record<string, unknown>>;
  const compliance = r(complianceQ.data);
  const diff = r(diffQ.data);
  const unused = r(unusedQ.data);
  const pendingSugs = suggestions.filter(s => s.status === 'pending' || !s.status);

  return (
    <div className="space-y-5">
      <SectionHeader title="Ontology" subtitle={`${entities.length} entity types · ${relations.length} relation types · ${totalInstances} instances`} />

      {/* Tabs */}
      <div className={cn(CARD, 'p-1 flex gap-1')}>
        {(['schema', 'analysis', 'maintenance'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 px-3 py-2 text-[11px] font-medium rounded-lg capitalize transition-colors',
              tab === t ? 'bg-[var(--gm-accent-primary)]/15 text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]')}>
            {t === 'schema' ? `Schema (${entities.length + relations.length})` : t === 'analysis' ? `Analysis (${pendingSugs.length} pending)` : 'Maintenance'}
          </button>
        ))}
      </div>

      {/* ── Schema Tab ── */}
      {tab === 'schema' && (
        <div className="space-y-5">
          {/* Entity Types */}
          <div className={cn(CARD, 'overflow-hidden')}>
            <div className="px-5 py-3 border-b border-[var(--gm-border-primary)] flex items-center justify-between">
              <h3 className={SECTION_TITLE}>Entity Types</h3>
              <div className="flex items-center gap-2">
                <input value={newEntity} onChange={e => setNewEntity(e.target.value)} placeholder="New entity type..." className={cn(INPUT, 'w-40 py-1 text-xs')} />
                <button disabled={!newEntity.trim() || addEntity.isPending} onClick={() => addEntity.mutate({ name: newEntity.trim() }, { onSuccess: () => { toast.success(`Entity type "${newEntity}" added`); setNewEntity(''); }, onError: (e: Error) => toast.error(e.message) })} className={BTN_PRIMARY}>
                  {addEntity.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                </button>
              </div>
            </div>
            {entities.map((e, i) => {
              const name = (e.name || e.label || e.type || 'Unknown') as string;
              const count = (stats[name] ?? e.count ?? 0) as number;
              const props = Array.isArray(e.properties) ? e.properties : [];
              const relsCount = Array.isArray(e.allowedRelations) ? e.allowedRelations.length : (e.relationCount ?? 0) as number;
              return (
                <div key={i} className="px-5 py-3 border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)] transition-colors">
                  <div className="flex items-center">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 mr-3" style={{ backgroundColor: (e.color as string) || typeColors[i % typeColors.length] }} />
                    <span className="text-xs font-semibold text-[var(--gm-text-primary)] flex-1">{name}</span>
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums px-2 py-0.5 rounded bg-[var(--gm-bg-tertiary)] mx-1">{count} instances</span>
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums mx-1">{props.length} props</span>
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums mx-1">{relsCount} rels</span>
                  </div>
                  {props.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ml-[22px]">
                      {props.map((p: Record<string, unknown>, j: number) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border border-[var(--gm-border-primary)]">
                          {(p.name || p) as string}{p.type ? `: ${p.type}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {entities.length === 0 && <EmptyState msg="No entity types defined." />}
          </div>

          {/* Relation Types */}
          <div className={cn(CARD, 'overflow-hidden')}>
            <div className="px-5 py-3 border-b border-[var(--gm-border-primary)] flex items-center justify-between">
              <h3 className={SECTION_TITLE}>Relation Types</h3>
              <div className="flex items-center gap-2">
                <input value={newRelation} onChange={e => setNewRelation(e.target.value)} placeholder="New relation type..." className={cn(INPUT, 'w-40 py-1 text-xs')} />
                <button disabled={!newRelation.trim() || addRelation.isPending} onClick={() => addRelation.mutate({ name: newRelation.trim() }, { onSuccess: () => { toast.success(`Relation type "${newRelation}" added`); setNewRelation(''); }, onError: (e: Error) => toast.error(e.message) })} className={BTN_PRIMARY}>
                  {addRelation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[var(--gm-border-primary)]">
                  {['Relation', 'From', 'To', 'Instances'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2 text-left')}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {relations.map((rel, i) => {
                    const name = (rel.name || rel.type || '—') as string;
                    return (
                      <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                        <td className="px-4 py-2 text-xs font-medium text-[var(--gm-text-primary)]">{name}</td>
                        <td className="px-4 py-2 text-[10px] text-[var(--gm-text-tertiary)]">{(rel.from || rel.source || '*') as string}</td>
                        <td className="px-4 py-2 text-[10px] text-[var(--gm-text-tertiary)]">{(rel.to || rel.target || '*') as string}</td>
                        <td className="px-4 py-2 text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">{(stats[name] ?? rel.count ?? 0) as number}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {relations.length === 0 && <EmptyState msg="No relation types defined." />}
          </div>
        </div>
      )}

      {/* ── Analysis Tab ── */}
      {tab === 'analysis' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className={cn(CARD, 'p-4 flex items-center gap-3 flex-wrap')}>
            <button onClick={() => analyzeGraph.mutate(undefined, { onSuccess: () => toast.success('Graph analysis complete'), onError: (e: Error) => toast.error(e.message) })} disabled={analyzeGraph.isPending} className={BTN_PRIMARY}>
              {analyzeGraph.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Analyze Graph
            </button>
            <button onClick={() => forceSync.mutate(undefined, { onSuccess: () => toast.success('Sync complete'), onError: (e: Error) => toast.error(e.message) })} disabled={forceSync.isPending} className={BTN_SECONDARY}>
              {forceSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Force Sync
            </button>
            <button onClick={() => inferRels.mutate(undefined, { onSuccess: () => toast.success('Relationship inference complete'), onError: (e: Error) => toast.error(e.message) })} disabled={inferRels.isPending} className={BTN_SECONDARY}>
              {inferRels.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Network className="w-3.5 h-3.5" />}
              Infer Relationships
            </button>
            {pendingSugs.length > 0 && (
              <button onClick={() => autoApprove.mutate({ minConfidence: 0.8 }, { onSuccess: (d) => toast.success(`Auto-approved ${(d as Record<string, unknown>)?.approved ?? '?'} suggestions`), onError: (e: Error) => toast.error(e.message) })} disabled={autoApprove.isPending} className={BTN_SECONDARY}>
                {autoApprove.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Auto-Approve ({pendingSugs.length})
              </button>
            )}
          </div>

          {/* Worker & Sync Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(CARD, 'p-4 space-y-2')}>
              <h3 className={SECTION_TITLE}>Worker Status</h3>
              {[
                ['Running', workerStatus.isRunning ? 'Yes' : 'No'],
                ['Last Run', workerStatus.lastRun ? new Date(workerStatus.lastRun as string).toLocaleString() : '—'],
                ['Total Runs', String(workerStatus.totalRuns ?? '—')],
                ['Last Result', String(workerStatus.lastResult ?? '—')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">{k}</span>
                  <span className="text-xs text-[var(--gm-text-primary)]">{v}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                {['full_analysis', 'entity_extraction', 'relation_inference'].map(t => (
                  <button key={t} onClick={() => workerTrigger.mutate({ type: t }, { onSuccess: () => toast.success(`Worker triggered: ${t}`), onError: (e: Error) => toast.error(e.message) })}
                    disabled={workerTrigger.isPending} className="text-[9px] px-2 py-1 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)] border border-[var(--gm-border-primary)]">
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn(CARD, 'p-4 space-y-2')}>
              <h3 className={SECTION_TITLE}>Sync Status</h3>
              {[
                ['Status', String(syncStatus.status ?? syncStatus.syncStatus ?? '—')],
                ['Last Sync', syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt as string).toLocaleString() : '—'],
                ['Entity Count', String(syncStatus.entityCount ?? '—')],
                ['Relation Count', String(syncStatus.relationCount ?? '—')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">{k}</span>
                  <span className="text-xs text-[var(--gm-text-primary)]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)]">
                <h3 className={SECTION_TITLE}>AI Suggestions ({pendingSugs.length} pending)</h3>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {suggestions.slice(0, 30).map((s, i) => {
                  const isPending = s.status === 'pending' || !s.status;
                  return (
                    <div key={i} className="flex items-center px-5 py-3 border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium border capitalize',
                            s.type === 'entity' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-400')}>
                            {(s.type || 'unknown') as string}
                          </span>
                          <span className="text-xs font-medium text-[var(--gm-text-primary)] truncate">{(s.name || s.label || s.suggestion || '—') as string}</span>
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full capitalize',
                            isPending ? 'bg-amber-500/10 text-amber-400' : s.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                            {(s.status || 'pending') as string}
                          </span>
                          {s.confidence && <span className="text-[9px] text-[var(--gm-text-tertiary)] tabular-nums">{(Number(s.confidence) * 100).toFixed(0)}%</span>}
                        </div>
                        {s.reason && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5 truncate">{s.reason as string}</p>}
                      </div>
                      {isPending && (
                        <div className="flex gap-1.5 ml-3 shrink-0">
                          <button onClick={() => approveSug.mutate({ id: s.id as string }, { onSuccess: () => toast.success('Approved'), onError: (e: Error) => toast.error(e.message) })} className="text-[9px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30">Approve</button>
                          <button onClick={() => rejectSug.mutate({ id: s.id as string }, { onSuccess: () => toast.success('Rejected'), onError: (e: Error) => toast.error(e.message) })} className="text-[9px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30">Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {suggestions.length === 0 && <EmptyState msg="No suggestions. Run 'Analyze Graph' to generate AI suggestions." />}

          {/* Change History */}
          {changes.length > 0 && (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)]">
                <h3 className={SECTION_TITLE}>Change History</h3>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {changes.slice(0, 20).map((ch, i) => (
                  <div key={i} className="flex items-center px-5 py-2 border-b border-[var(--gm-border-primary)] last:border-0 text-[10px]">
                    <span className="text-[var(--gm-text-tertiary)] w-36 shrink-0 tabular-nums">{ch.timestamp ? new Date(ch.timestamp as string).toLocaleString() : '—'}</span>
                    <span className={cn('px-1.5 py-0.5 rounded-full mr-2 capitalize font-medium border',
                      ch.action === 'add' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                      ch.action === 'remove' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                      'bg-blue-500/10 border-blue-500/30 text-blue-400')}>{(ch.action || '—') as string}</span>
                    <span className="text-[var(--gm-text-primary)] flex-1 truncate">{(ch.description || ch.detail || `${ch.type}: ${ch.name}`) as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Maintenance Tab ── */}
      {tab === 'maintenance' && (
        <div className="space-y-5">
          {/* Actions */}
          <div className={cn(CARD, 'p-4 flex items-center gap-3 flex-wrap')}>
            <button onClick={() => complianceQ.refetch()} disabled={complianceQ.isFetching} className={BTN_SECONDARY}>
              {complianceQ.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              Validate Compliance
            </button>
            <button onClick={() => diffQ.refetch()} disabled={diffQ.isFetching} className={BTN_SECONDARY}>
              {diffQ.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
              Diff Schema vs Graph
            </button>
            <button onClick={() => unusedQ.refetch()} disabled={unusedQ.isFetching} className={BTN_SECONDARY}>
              {unusedQ.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Find Unused Types
            </button>
          </div>

          {/* Compliance Results */}
          {compliance.ok && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <div className="flex items-center gap-3">
                <h3 className={SECTION_TITLE}>Compliance</h3>
                <span className={cn('text-xs font-bold tabular-nums', Number(compliance.score) >= 80 ? 'text-green-400' : Number(compliance.score) >= 50 ? 'text-amber-400' : 'text-red-400')}>
                  {compliance.score as number}%
                </span>
                <span className={cn('text-[9px] px-2 py-0.5 rounded-full',
                  compliance.valid ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400')}>
                  {compliance.valid ? 'Compliant' : 'Issues Found'}
                </span>
              </div>
              {Array.isArray(compliance.issues) && (compliance.issues as Array<Record<string, unknown>>).length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {(compliance.issues as Array<Record<string, unknown>>).map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className={cn('shrink-0 mt-0.5',
                        issue.type === 'error' ? 'text-red-400' : 'text-amber-400')}>
                        {issue.type === 'error' ? '●' : '▲'}
                      </span>
                      <span className="text-[var(--gm-text-secondary)]">{issue.message as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diff Results */}
          {diff.ok && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <h3 className={SECTION_TITLE}>Schema vs Graph Diff</h3>
              {diff.diff && (() => {
                const d = diff.diff as Record<string, unknown[]>;
                const sections = [
                  { key: 'missingInSchema', label: 'In graph but not in schema', color: 'text-amber-400' },
                  { key: 'missingInGraph', label: 'In schema but not in graph', color: 'text-blue-400' },
                  { key: 'matching', label: 'Matching', color: 'text-green-400' },
                ];
                return sections.map(({ key, label, color }) => {
                  const items = d[key];
                  if (!Array.isArray(items) || items.length === 0) return null;
                  return (
                    <div key={key}>
                      <span className={cn('text-[10px] font-medium', color)}>{label} ({items.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {items.map((item, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border border-[var(--gm-border-primary)]">
                            {typeof item === 'string' ? item : (item as Record<string, unknown>).name as string || '?'}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Unused Types */}
          {unused.ok && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <h3 className={SECTION_TITLE}>Unused Types</h3>
              {(() => {
                const ue = (unused.entities ?? []) as string[];
                const ur = (unused.relations ?? []) as string[];
                if (ue.length === 0 && ur.length === 0) return <p className="text-[10px] text-green-400">All types are in use.</p>;
                return (
                  <>
                    {ue.length > 0 && <div><span className="text-[10px] text-amber-400 font-medium">Unused entity types ({ue.length})</span><div className="flex flex-wrap gap-1 mt-1">{ue.map(n => <span key={n} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">{n}</span>)}</div></div>}
                    {ur.length > 0 && <div className="mt-2"><span className="text-[10px] text-amber-400 font-medium">Unused relation types ({ur.length})</span><div className="flex flex-wrap gap-1 mt-1">{ur.map(n => <span key={n} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">{n}</span>)}</div></div>}
                    <button onClick={() => cleanup.mutate({ entities: ue, relations: ur }, { onSuccess: () => toast.success('Cleanup complete'), onError: (e: Error) => toast.error(e.message) })} disabled={cleanup.isPending} className={BTN_PRIMARY}>
                      {cleanup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Cleanup Unused
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          {!compliance.ok && !diff.ok && !unused.ok && (
            <EmptyState msg="Run a check above to see results." />
          )}
        </div>
      )}

      {statsResp.message && <p className="text-xs text-[var(--gm-text-tertiary)]">{statsResp.message as string}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Prompts — /api/system/prompts CRUD with versioning
// ══════════════════════════════════════════════════════════════════════════════

const CATEGORY_COLORS: Record<string, string> = {
  extraction: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  analysis: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  template: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sprint: 'bg-green-500/15 text-green-400 border-green-500/30',
  report: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

function PromptsSection() {
  const { data, isLoading, error } = useSystemPrompts();
  const savePrompt = useSavePrompt();
  const restoreVersion = useRestorePromptVersion();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState<PromptTemplate | null>(null);
  const [versionsOpen, setVersionsOpen] = useState<string | null>(null);
  const templates = ((data as Record<string, unknown>)?.templates ?? []) as PromptTemplate[];

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox msg="Unable to load prompts." />;

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category))).sort()];

  const filtered = templates.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const byCat = templates.reduce<Record<string, number>>((a, t) => { a[t.category] = (a[t.category] || 0) + 1; return a; }, {});

  const handleToggleActive = (t: PromptTemplate) => {
    savePrompt.mutate({ key: t.id, is_active: !t.isActive }, {
      onSuccess: () => toast.success(`${t.name} ${t.isActive ? 'deactivated' : 'activated'}`),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Prompt Templates" subtitle={`${templates.length} templates with auto-versioning across ${Object.keys(byCat).length} categories`} />

      {/* Category Tabs + Search */}
      <div className={cn(CARD, 'p-3 flex items-center gap-2 flex-wrap')}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all capitalize',
              activeCategory === cat
                ? 'bg-[var(--gm-accent-primary)]/15 border-[var(--gm-accent-primary)]/40 text-[var(--gm-accent-primary)]'
                : 'bg-[var(--gm-bg-tertiary)] border-transparent text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]',
            )}>
            {cat === 'all' ? `All (${templates.length})` : `${cat} (${byCat[cat] || 0})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--gm-text-tertiary)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prompts..."
              className={cn(INPUT, 'w-48 pl-7 py-1.5 text-xs')} />
          </div>
        </div>
      </div>

      {/* Prompt Cards */}
      <div className="space-y-3">
        {filtered.map(t => (
          <div key={t.id} className={cn(CARD, 'overflow-hidden group', !t.isActive && 'opacity-60')}>
            <div className="px-5 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--gm-text-primary)]">{t.name || '(unnamed)'}</span>
                  <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium border capitalize', CATEGORY_COLORS[t.category] || 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border-[var(--gm-border-primary)]')}>
                    {t.category}
                  </span>
                  <button onClick={() => handleToggleActive(t)} className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium border cursor-pointer transition-colors',
                    t.isActive ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20')}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                {t.description && <p className="text-[11px] text-[var(--gm-text-tertiary)] mt-1 line-clamp-1">{t.description}</p>}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[9px] font-mono text-[var(--gm-text-tertiary)]">{t.id}</span>
                  <span className="text-[8px] text-[var(--gm-text-tertiary)]">·</span>
                  <span className="text-[9px] text-[var(--gm-text-tertiary)] tabular-nums">{t.lastModified}</span>
                  <span className="text-[8px] text-[var(--gm-text-tertiary)]">·</span>
                  {t.variables?.slice(0, 5).map(v => (
                    <span key={v} className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-accent-primary)] font-mono border border-[var(--gm-border-primary)]">{`{{${v}}}`}</span>
                  ))}
                  {(t.variables?.length || 0) > 5 && <span className="text-[8px] text-[var(--gm-text-tertiary)]">+{t.variables.length - 5} more</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setVersionsOpen(versionsOpen === t.id ? null : t.id)} title="Version History"
                  className="p-1.5 rounded-lg hover:bg-[var(--gm-surface-hover)] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
                  <History className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditorOpen(t)} className={BTN_PRIMARY}>
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
            </div>
            {/* Collapsed preview */}
            <div className="px-5 pb-3">
              <pre className="text-[10px] text-[var(--gm-text-tertiary)]/70 max-h-12 overflow-hidden whitespace-pre-wrap font-mono leading-relaxed">{t.prompt.substring(0, 300)}{t.prompt.length > 300 ? '…' : ''}</pre>
            </div>
            {/* Inline version history */}
            {versionsOpen === t.id && (
              <PromptVersionPanel promptKey={t.id} currentPrompt={t.prompt}
                onRestore={v => restoreVersion.mutate({ key: t.id, version: v }, { onSuccess: () => { toast.success(`Restored v${v}`); setVersionsOpen(null); }, onError: (e: Error) => toast.error(e.message) })} />
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && <EmptyState msg={search ? 'No prompts match your search.' : 'No prompt templates found.'} />}

      {/* Full-screen Editor Dialog */}
      {editorOpen && (
        <PromptEditorDialog prompt={editorOpen} onClose={() => setEditorOpen(null)}
          onSave={(text, reason, desc) => {
            const payload: Record<string, unknown> = { key: editorOpen.id };
            if (text !== editorOpen.prompt) { payload.prompt = text; if (reason) payload.change_reason = reason; }
            if (desc !== undefined && desc !== editorOpen.description) payload.description = desc;
            savePrompt.mutate(payload as any, {
              onSuccess: () => { toast.success('Prompt saved'); setEditorOpen(null); },
              onError: (e: Error) => toast.error(e.message),
            });
          }}
          isSaving={savePrompt.isPending}
        />
      )}
    </div>
  );
}

/* ── Prompt Editor Dialog ──────────────────────────────────────────────────── */
function PromptEditorDialog({ prompt, onClose, onSave, isSaving }: {
  prompt: PromptTemplate; onClose: () => void;
  onSave: (text: string, reason: string, description: string) => void; isSaving: boolean;
}) {
  const [text, setText] = useState(prompt.prompt);
  const [desc, setDesc] = useState(prompt.description || '');
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewType = ['document', 'transcript', 'conversation', 'vision', 'email'].includes(prompt.id) ? prompt.id : null;
  const { data: previewData } = usePromptPreview(tab === 'preview' && previewType ? previewType : null);
  const previewResp = r(previewData);

  const insertVariable = (varName: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const insertion = `{{${varName}}}`;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    setText(newText);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + insertion.length, start + insertion.length); });
  };

  const hasChanges = text !== prompt.prompt || desc !== (prompt.description || '');
  const lineCount = text.split('\n').length;

  return (
    <Dialog open onClose={onClose}>
      <DialogContent className="!max-w-5xl !max-h-[95vh] !p-0 flex flex-col bg-[var(--gm-surface-primary)] border-[var(--gm-border-primary)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--gm-border-primary)] flex items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[var(--gm-accent-primary)]" />
              <h2 className="text-sm font-bold text-[var(--gm-text-primary)]">{prompt.name || '(unnamed)'}</h2>
              <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium border capitalize', CATEGORY_COLORS[prompt.category] || 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border-[var(--gm-border-primary)]')}>
                {prompt.category}
              </span>
              <span className="text-[9px] font-mono text-[var(--gm-text-tertiary)]">{prompt.id}</span>
            </div>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add a description..."
              className="mt-1.5 w-full text-[11px] text-[var(--gm-text-secondary)] bg-transparent border-0 outline-none placeholder:text-[var(--gm-text-placeholder)]" />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--gm-surface-hover)]"><X className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
        </div>

        {/* Tab bar */}
        <div className="px-6 pt-2 flex items-center gap-1 border-b border-[var(--gm-border-primary)] shrink-0">
          {(['edit', 'preview'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3 py-2 text-[11px] font-medium capitalize border-b-2 -mb-px transition-colors',
                tab === t ? 'border-[var(--gm-accent-primary)] text-[var(--gm-accent-primary)]' : 'border-transparent text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]')}>
              {t === 'edit' ? 'Editor' : 'Preview'}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[var(--gm-text-tertiary)] tabular-nums">{lineCount} lines · {text.length} chars</span>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          {tab === 'edit' ? (
            <div className="flex flex-1 min-h-0">
              {/* Editor */}
              <div className="flex-1 overflow-auto p-4">
                <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
                  className="w-full h-full min-h-[400px] bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg p-4 font-mono text-xs text-[var(--gm-text-primary)] resize-none outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] leading-relaxed"
                  spellCheck={false} />
              </div>
              {/* Variables Sidebar */}
              <div className="w-56 border-l border-[var(--gm-border-primary)] overflow-y-auto p-3 shrink-0 bg-[var(--gm-bg-secondary)]">
                <div className={cn(SECTION_TITLE, 'mb-2')}>Variables</div>
                <p className="text-[9px] text-[var(--gm-text-tertiary)] mb-3">Click to insert at cursor position</p>
                <div className="space-y-1">
                  {prompt.variables.map(v => (
                    <button key={v} onClick={() => insertVariable(v)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-mono bg-[var(--gm-bg-tertiary)] text-[var(--gm-accent-primary)] hover:bg-[var(--gm-accent-primary)]/10 border border-[var(--gm-border-primary)] transition-colors truncate">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                {prompt.variables.length === 0 && <p className="text-[9px] text-[var(--gm-text-tertiary)] italic">No variables detected</p>}
                <div className={cn(SECTION_TITLE, 'mt-4 mb-2')}>Common Variables</div>
                <div className="space-y-1">
                  {['CONTENT', 'FILENAME', 'ONTOLOGY_CONTEXT', 'CONTACTS_INDEX', 'ORG_INDEX', 'PROJECT_INDEX'].filter(v => !prompt.variables.includes(v)).map(v => (
                    <button key={v} onClick={() => insertVariable(v)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-mono bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-accent-primary)]/10 border border-[var(--gm-border-primary)] transition-colors truncate">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-6">
              {previewType ? (
                previewResp.prompt ? (
                  <div className="space-y-4">
                    <div className={cn(SECTION_TITLE)}>Rendered Prompt ({previewType})</div>
                    <pre className="text-[11px] font-mono text-[var(--gm-text-secondary)] whitespace-pre-wrap leading-relaxed bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg p-4 max-h-[60vh] overflow-auto">
                      {typeof previewResp.prompt === 'string' ? previewResp.prompt :
                        typeof previewResp.prompt === 'object' && previewResp.prompt !== null
                          ? JSON.stringify(previewResp.prompt, null, 2) : String(previewResp.prompt)}
                    </pre>
                    {previewResp.ontologyContext && (
                      <>
                        <div className={cn(SECTION_TITLE, 'mt-4')}>Ontology Context</div>
                        <pre className="text-[10px] font-mono text-[var(--gm-text-tertiary)] whitespace-pre-wrap bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg p-3 max-h-40 overflow-auto">
                          {JSON.stringify(previewResp.ontologyContext, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--gm-text-tertiary)] py-8 text-center">Loading preview...</div>
                )
              ) : (
                <div className="space-y-3">
                  <div className={cn(SECTION_TITLE)}>Current Template</div>
                  <pre className="text-[11px] font-mono text-[var(--gm-text-secondary)] whitespace-pre-wrap leading-relaxed bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg p-4 max-h-[60vh] overflow-auto">{text}</pre>
                  <p className="text-[9px] text-[var(--gm-text-tertiary)]">Live preview is available for: document, transcript, conversation, vision, email prompts.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--gm-border-primary)] flex items-center gap-3 shrink-0 bg-[var(--gm-bg-secondary)]">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Change reason (optional)..."
            className={cn(INPUT, 'flex-1 py-1.5 text-xs')} />
          <button onClick={onClose} className={BTN_SECONDARY}><X className="w-3 h-3" /> Cancel</button>
          <button onClick={() => onSave(text, reason, desc)} disabled={isSaving || !hasChanges} className={BTN_PRIMARY}>
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Version History Panel ─────────────────────────────────────────────────── */
function PromptVersionPanel({ promptKey, currentPrompt, onRestore }: {
  promptKey: string; currentPrompt: string; onRestore: (v: number) => void;
}) {
  const { data, isLoading } = usePromptVersions(promptKey);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const { data: versionContent } = usePromptVersionContent(promptKey, viewingVersion);
  const resp = r(data);
  const versions = (resp.versions ?? []) as Array<Record<string, unknown>>;
  const vResp = r(versionContent);
  const vData = (vResp.version ?? {}) as Record<string, unknown>;

  if (isLoading) return <div className="px-5 pb-3 text-xs text-[var(--gm-text-tertiary)]"><Loader2 className="w-3 h-3 animate-spin inline mr-1" />Loading versions...</div>;
  if (versions.length === 0) return <div className="px-5 pb-3 text-xs text-[var(--gm-text-tertiary)] italic">No previous versions.</div>;

  return (
    <div className="border-t border-[var(--gm-border-primary)] bg-[var(--gm-bg-secondary)]">
      <div className="px-5 pt-3 pb-2 flex items-center justify-between">
        <span className={SECTION_TITLE}>Version History</span>
        <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">Current: v{resp.current_version as number ?? '?'} · {versions.length} previous</span>
      </div>
      <div className="px-5 pb-3 space-y-1">
        {versions.map(v => {
          const ver = v.version as number;
          const isViewing = viewingVersion === ver;
          return (
            <div key={v.id as string}>
              <div className={cn('flex items-center gap-3 text-xs py-1.5 px-2.5 rounded-lg transition-colors', isViewing ? 'bg-[var(--gm-accent-primary)]/10' : 'hover:bg-[var(--gm-surface-hover)]')}>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-accent-primary)] font-mono font-bold tabular-nums">v{ver}</span>
                <span className="text-[var(--gm-text-tertiary)] tabular-nums text-[10px]">{v.created_at ? new Date(v.created_at as string).toLocaleString() : '—'}</span>
                {v.change_reason && <span className="text-[10px] text-[var(--gm-text-secondary)] italic truncate max-w-[200px]">{v.change_reason as string}</span>}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setViewingVersion(isViewing ? null : ver)} className="text-[10px] text-[var(--gm-accent-primary)] hover:underline font-medium">
                    {isViewing ? 'Hide' : 'View'}
                  </button>
                  <button onClick={() => onRestore(ver)} className="text-[10px] text-amber-400 hover:underline font-medium">Restore</button>
                </div>
              </div>
              {isViewing && vData.prompt_template && (
                <div className="mt-1 mb-2 mx-2">
                  <pre className="text-[10px] font-mono text-[var(--gm-text-tertiary)] whitespace-pre-wrap bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg p-3 max-h-48 overflow-auto leading-relaxed">
                    {vData.prompt_template as string}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Processing — /api/process/*, /api/files, /api/system/config(processing)
// ══════════════════════════════════════════════════════════════════════════════

function KnowledgePipelineCard() {
  const { data: statusData } = useKnowledgeStatus();
  const synthesize = useKnowledgeSynthesize();
  const embed = useKnowledgeEmbed();
  const regen = useKnowledgeRegenerate();
  const resynth = useKnowledgeResynthesis();
  const ks = (statusData ?? {}) as Record<string, unknown>;

  return (
    <div className={cn(CARD, 'p-5 space-y-4')}>
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>Knowledge Pipeline</h3>
        <span className="text-[10px] text-[var(--gm-text-tertiary)]">
          Embeddings: {typeof ks.embeddingsCount === 'number' ? ks.embeddingsCount : '—'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => synthesize.mutate(undefined, { onSuccess: () => toast.success('Knowledge synthesis complete'), onError: (e: Error) => toast.error(e.message) })}
          disabled={synthesize.isPending}
          className={BTN_PRIMARY}
        >
          {synthesize.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Synthesize
        </button>
        <button
          onClick={() => embed.mutate(undefined, { onSuccess: () => toast.success('Embeddings generated'), onError: (e: Error) => toast.error(e.message) })}
          disabled={embed.isPending}
          className={BTN_PRIMARY}
        >
          {embed.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
          Generate Embeddings
        </button>
        <button
          onClick={() => resynth.mutate(undefined, { onSuccess: () => toast.success('Resynthesis complete'), onError: (e: Error) => toast.error(e.message) })}
          disabled={resynth.isPending}
          className={BTN_SECONDARY}
        >
          {resynth.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
          Resynthesis
        </button>
        <button
          onClick={() => regen.mutate(undefined, { onSuccess: () => toast.success('SOT regenerated'), onError: (e: Error) => toast.error(e.message) })}
          disabled={regen.isPending}
          className={BTN_SECONDARY}
        >
          {regen.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          Regenerate SOT
        </button>
      </div>
    </div>
  );
}

function ProcessingSection() {
  const { data: configData, isLoading: configLoading } = useSystemConfig();
  const updateConfig = useUpdateSystemConfig();
  const { data: statusData } = useProcessStatus();
  const { data: pendingFiles } = usePendingFiles();
  const processFiles = useProcessFiles();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const initialized = useRef(false);

  const config = r(configData);
  const proc = r(config.processing);
  const status = (statusData ?? {}) as Record<string, unknown>;
  const pending = (pendingFiles ?? []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (!initialized.current && Object.keys(proc).length > 0) {
      setForm({
        chunkSize: proc.chunkSize ?? 4000,
        chunkOverlap: proc.chunkOverlap ?? 200,
        similarityThreshold: proc.similarityThreshold ?? 0.9,
        pdfToImages: proc.pdfToImages ?? true,
        autoProcess: proc.autoProcess ?? true,
        temperature: proc.temperature ?? 0.7,
      });
      initialized.current = true;
    }
  }, [proc]);

  const handleSave = useCallback(() => {
    updateConfig.mutate({ key: 'processing', value: form, category: 'processing' }, {
      onSuccess: () => toast.success('Processing settings saved'),
      onError: (e: Error) => toast.error(e.message),
    });
  }, [form, updateConfig]);

  const handleProcess = () => {
    processFiles.mutate(undefined, {
      onSuccess: () => toast.success('Processing started'),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (configLoading) return <Loading />;

  const isProcessing = status.status === 'processing' || status.status === 'running';
  const progress = Number(status.progress ?? 0);
  const currentFile = (status.currentFile || '') as string;
  const totalFiles = Number(status.totalFiles ?? 0);
  const processedFiles = Number(status.processedFiles ?? 0);

  return (
    <div className="space-y-5">
      <SectionHeader title="Document Processing" subtitle="Pipeline status, controls, and configuration" />

      {/* Status & Controls */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <div className="flex items-center justify-between">
          <h3 className={SECTION_TITLE}>Pipeline Status</h3>
          <button onClick={handleProcess} disabled={processFiles.isPending || isProcessing} className={BTN_PRIMARY}>
            {(processFiles.isPending || isProcessing) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {isProcessing ? 'Processing...' : 'Process All Pending'}
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn(CARD, 'p-3.5')}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn('w-2 h-2 rounded-full', isProcessing ? 'bg-green-400 animate-pulse' : status.status === 'error' ? 'bg-red-400' : 'bg-[var(--gm-text-tertiary)]')} />
              <span className="text-[10px] font-medium text-[var(--gm-text-tertiary)] uppercase">Status</span>
            </div>
            <div className="text-sm font-bold text-[var(--gm-text-primary)] capitalize">{(status.status || 'idle') as string}</div>
          </div>
          <div className={cn(CARD, 'p-3.5')}>
            <div className="flex items-center gap-2 mb-1.5">
              <File className="w-3 h-3 text-[var(--gm-text-tertiary)]" />
              <span className="text-[10px] font-medium text-[var(--gm-text-tertiary)] uppercase">Pending</span>
            </div>
            <div className="text-sm font-bold text-[var(--gm-accent-primary)]">{pending.length}</div>
          </div>
          <div className={cn(CARD, 'p-3.5')}>
            <div className="flex items-center gap-2 mb-1.5">
              <Gauge className="w-3 h-3 text-[var(--gm-text-tertiary)]" />
              <span className="text-[10px] font-medium text-[var(--gm-text-tertiary)] uppercase">Progress</span>
            </div>
            <div className="text-sm font-bold text-[var(--gm-text-primary)] tabular-nums">{totalFiles > 0 ? `${processedFiles}/${totalFiles}` : '—'}</div>
          </div>
          <div className={cn(CARD, 'p-3.5')}>
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="w-3 h-3 text-[var(--gm-text-tertiary)]" />
              <span className="text-[10px] font-medium text-[var(--gm-text-tertiary)] uppercase">Completion</span>
            </div>
            <div className="text-sm font-bold text-[var(--gm-text-primary)] tabular-nums">{progress > 0 ? `${Math.round(progress)}%` : '—'}</div>
          </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="w-full h-2 rounded-full bg-[var(--gm-bg-tertiary)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--gm-accent-primary)] transition-all duration-500 ease-out" style={{ width: `${Math.max(progress, 2)}%` }} />
            </div>
            {currentFile && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-[var(--gm-accent-primary)]" />
                <span className="text-[10px] text-[var(--gm-text-tertiary)] font-mono truncate">{currentFile}</span>
              </div>
            )}
          </div>
        )}

        {/* Errors */}
        {status.errors && Array.isArray(status.errors) && (status.errors as unknown[]).length > 0 && (
          <div className="space-y-1">
            <span className={cn(SECTION_TITLE, 'text-red-400')}>Errors</span>
            {(status.errors as Array<Record<string, unknown>>).slice(0, 5).map((err, i) => (
              <div key={i} className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 font-mono">
                {(err.file || err.message || JSON.stringify(err)) as string}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Pipeline */}
      <KnowledgePipelineCard />

      {/* Pending Files */}
      {pending.length > 0 && (
        <div className={cn(CARD, 'overflow-hidden')}>
          <div className="px-5 py-3 border-b border-[var(--gm-border-primary)] flex items-center justify-between">
            <h3 className={SECTION_TITLE}>Pending Files</h3>
            <span className="text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">{pending.length} files waiting</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {pending.map((f, i) => (
              <div key={i} className="px-5 py-2 flex items-center gap-3 border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                <FileText className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--gm-text-primary)] truncate">{(f.name || f.filename || f.file || '—') as string}</div>
                  {f.type && <span className="text-[9px] text-[var(--gm-text-tertiary)]">{f.type as string}</span>}
                </div>
                {f.size && <span className="text-[9px] text-[var(--gm-text-tertiary)] tabular-nums shrink-0">{((Number(f.size) / 1024).toFixed(1))} KB</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className={cn(CARD, 'p-5 space-y-5')}>
        <div className="flex items-center justify-between">
          <h3 className={SECTION_TITLE}>Chunking & Extraction</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Chunk Size (tokens)</label>
            <input type="number" value={form.chunkSize ?? ''} onChange={e => setForm(f => ({ ...f, chunkSize: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} />
            <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">Size of each text chunk for LLM processing</p>
          </div>
          <div>
            <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Chunk Overlap (tokens)</label>
            <input type="number" value={form.chunkOverlap ?? ''} onChange={e => setForm(f => ({ ...f, chunkOverlap: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} />
            <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">Overlap between chunks to preserve context</p>
          </div>
          <div>
            <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Similarity Threshold</label>
            <input type="number" step="0.01" min="0" max="1" value={form.similarityThreshold ?? ''} onChange={e => setForm(f => ({ ...f, similarityThreshold: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} />
            <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">Cosine similarity for dedup (0.0 – 1.0)</p>
          </div>
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={SECTION_TITLE}>LLM & Generation</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Temperature</label>
            <input type="number" step="0.1" min="0" max="2" value={form.temperature ?? ''} onChange={e => setForm(f => ({ ...f, temperature: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} />
            <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">LLM creativity (0 = deterministic, 1+ = creative)</p>
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-xs text-[var(--gm-text-primary)] font-medium">PDF to Images</span>
                <p className="text-[9px] text-[var(--gm-text-tertiary)]">Convert PDFs to images for vision model processing</p>
              </div>
              <Toggle checked={!!form.pdfToImages} onChange={v => setForm(f => ({ ...f, pdfToImages: v }))} />
            </div>
          </div>
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Automation</h3>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-[var(--gm-text-primary)] font-medium">Auto-Process on Upload</span>
            <p className="text-[9px] text-[var(--gm-text-tertiary)]">Automatically process documents when uploaded</p>
          </div>
          <Toggle checked={!!form.autoProcess} onChange={v => setForm(f => ({ ...f, autoProcess: v }))} />
        </div>
      </div>

      <button onClick={handleSave} disabled={updateConfig.isPending} className={BTN_PRIMARY}>
        {updateConfig.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Processing Settings
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Team Analysis — /api/team-analysis/config (GET+PUT)
// GET: { ok, config: { analysisFrequency, includePersonality, includeSentiment, includeCommunication, includeCollaboration, minMeetingsForAnalysis, sentimentThreshold } }
// PUT body: partial config merge
// ══════════════════════════════════════════════════════════════════════════════

function TeamAnalysisSection() {
  const { data, isLoading } = useTeamAnalysisConfig();
  const update = useUpdateTeamAnalysisConfig();
  const { data: profilesData } = useTeamProfiles();
  const { data: dynamicsData } = useTeamDynamics();
  const { data: relData } = useTeamRelationships();
  const { data: adminProjData } = useTeamAdminProjects();
  const runAnalysis = useRunTeamAnalysis();
  const analyzeProfile = useAnalyzeProfile();
  const syncGraph = useSyncTeamGraph();
  const adminAnalyze = useAdminRunProjectAnalysis();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const initialized = useRef(false);
  const [tab, setTab] = useState<'overview' | 'config' | 'projects'>('overview');

  const resp = r(data);
  const cfg = r(resp.config);
  const profiles = (r(profilesData).profiles ?? []) as Array<Record<string, unknown>>;
  const dynamics = r(r(dynamicsData).analysis);
  const relationships = (r(relData).relationships ?? []) as Array<Record<string, unknown>>;
  const adminProjects = (r(adminProjData).projects ?? []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (!initialized.current && Object.keys(cfg).length > 0) {
      setForm({ ...cfg });
      initialized.current = true;
    }
  }, [cfg]);

  const handleSave = useCallback(() => {
    update.mutate(form as Record<string, unknown>, {
      onSuccess: () => toast.success('Configuration saved'),
      onError: (e: Error) => toast.error(e.message),
    });
  }, [form, update]);

  const handleRunAnalysis = () => {
    runAnalysis.mutate({ forceReanalysis: false }, {
      onSuccess: () => toast.success('Team analysis completed'),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (isLoading) return <Loading />;

  const cohesion = Number(dynamics.cohesion_score ?? 0);
  const tension = (dynamics.tension_level || '—') as string;
  const alliances = (dynamics.alliances ?? []) as unknown[];
  const tensions = (dynamics.tensions ?? []) as unknown[];

  const toggles: Array<{ key: string; label: string; desc: string }> = [
    { key: 'includePersonality', label: 'Personality Analysis', desc: 'Behavioral profiling and communication identity' },
    { key: 'includeSentiment', label: 'Sentiment Tracking', desc: 'Emotional tone and sentiment trends' },
    { key: 'includeCommunication', label: 'Communication Patterns', desc: 'Speaking style, directness, verbosity' },
    { key: 'includeCollaboration', label: 'Collaboration Metrics', desc: 'Teamwork, alignment, and cooperation signals' },
  ];

  const confidenceCounts = profiles.reduce<Record<string, number>>((a, p) => {
    const c = (p.confidence_level || 'low') as string;
    a[c] = (a[c] || 0) + 1;
    return a;
  }, {});

  return (
    <div className="space-y-5">
      <SectionHeader title="Team Behavioral Analysis" subtitle={`${profiles.length} profiles · ${relationships.length} relationships · Cohesion ${cohesion || '—'}%`} />

      {/* Tabs */}
      <div className={cn(CARD, 'p-1 flex gap-1')}>
        {(['overview', 'config', 'projects'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 px-3 py-2 text-[11px] font-medium rounded-lg capitalize transition-colors',
              tab === t ? 'bg-[var(--gm-accent-primary)]/15 text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-secondary)]')}>
            {t === 'overview' ? 'Overview & Analysis' : t === 'config' ? 'Configuration' : 'Projects'}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className={cn(CARD, 'p-4 flex items-center gap-3 flex-wrap')}>
            <button onClick={handleRunAnalysis} disabled={runAnalysis.isPending} className={BTN_PRIMARY}>
              {runAnalysis.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {runAnalysis.isPending ? 'Analyzing...' : 'Run Team Analysis'}
            </button>
            <button onClick={() => syncGraph.mutate(undefined, { onSuccess: () => toast.success('Graph synced'), onError: (e: Error) => toast.error(e.message) })}
              disabled={syncGraph.isPending} className={BTN_SECONDARY}>
              {syncGraph.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Network className="w-3.5 h-3.5" />}
              Sync to Graph
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Profiles" value={profiles.length} color="var(--gm-accent-primary)" />
            <StatCard label="Relationships" value={relationships.length} color="var(--gm-accent-primary)" />
            <StatCard label="Cohesion" value={cohesion > 0 ? `${cohesion}%` : '—'} color={cohesion >= 70 ? '#22c55e' : cohesion >= 40 ? '#f59e0b' : '#ef4444'} />
            <StatCard label="Alliances" value={alliances.length} color="#22c55e" />
            <StatCard label="Tensions" value={tensions.length} color="#ef4444" />
          </div>

          {/* Team Dynamics */}
          {dynamics.analysis_data && (
            <div className={cn(CARD, 'p-5 space-y-3')}>
              <h3 className={SECTION_TITLE}>Team Dynamics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Tension Level</span>
                  <div className={cn('text-sm font-bold capitalize', tension === 'high' ? 'text-red-400' : tension === 'medium' ? 'text-amber-400' : 'text-green-400')}>{tension}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Team Size</span>
                  <div className="text-sm font-bold text-[var(--gm-text-primary)]">{(dynamics.team_size || '—') as string}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] uppercase">Communication</span>
                  <div className="text-sm font-bold text-[var(--gm-text-primary)] truncate">{(dynamics.dominant_communication_pattern || '—') as string}</div>
                </div>
              </div>
            </div>
          )}

          {/* Profiles */}
          {profiles.length > 0 && (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)] flex items-center justify-between">
                <h3 className={SECTION_TITLE}>Behavioral Profiles</h3>
                <div className="flex gap-1.5">
                  {Object.entries(confidenceCounts).map(([level, count]) => (
                    <span key={level} className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium border capitalize',
                      level === 'very_high' || level === 'high' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                      level === 'medium' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                      'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>
                      {count} {level.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--gm-border-primary)]">
                    {['Person', 'Style', 'Motivation', 'Risk', 'Influence', 'Confidence', 'Transcripts', ''].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {profiles.map((p, i) => {
                      const contact = r(p.contact);
                      const name = (contact.full_name || contact.name || p.contact_id || '—') as string;
                      return (
                        <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                          <td className="px-4 py-2.5">
                            <div className="text-xs font-medium text-[var(--gm-text-primary)]">{name}</div>
                            {contact.role && <div className="text-[9px] text-[var(--gm-text-tertiary)]">{contact.role as string}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-secondary)] capitalize">{(p.communication_style || '—') as string}</td>
                          <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-secondary)] capitalize">{(p.dominant_motivation || '—') as string}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium capitalize',
                              p.risk_tolerance === 'high' ? 'bg-red-500/10 text-red-400' :
                              p.risk_tolerance === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-green-500/10 text-green-400')}>{(p.risk_tolerance || '—') as string}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-[var(--gm-bg-tertiary)] overflow-hidden">
                                <div className="h-full rounded-full bg-[var(--gm-accent-primary)]" style={{ width: `${Number(p.influence_score ?? 0)}%` }} />
                              </div>
                              <span className="text-[10px] text-[var(--gm-text-primary)] tabular-nums font-semibold">{(p.influence_score ?? 0) as number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium capitalize',
                              (p.confidence_level === 'high' || p.confidence_level === 'very_high') ? 'bg-green-500/10 text-green-400' :
                              p.confidence_level === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]')}>{((p.confidence_level || '—') as string).replace('_', ' ')}</span>
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">{(p.transcript_count ?? 0) as number}</td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => analyzeProfile.mutate({ personId: (p.contact_id || p.id) as string, forceReanalysis: true }, {
                              onSuccess: () => toast.success(`Re-analyzed ${name}`), onError: (e: Error) => toast.error(e.message)
                            })} disabled={analyzeProfile.isPending} className="text-[9px] text-[var(--gm-accent-primary)] hover:underline font-medium">
                              Re-analyze
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Relationships */}
          {relationships.length > 0 && (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)]">
                <h3 className={SECTION_TITLE}>Behavioral Relationships</h3>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--gm-border-primary)] sticky top-0 bg-[var(--gm-surface-primary)]">
                    {['From', 'To', 'Type', 'Strength', 'Confidence'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2 text-left')}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {relationships.map((rel, i) => (
                      <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                        <td className="px-4 py-2 text-xs text-[var(--gm-text-primary)]">{(rel.from_name || rel.from_contact_id || '—') as string}</td>
                        <td className="px-4 py-2 text-xs text-[var(--gm-text-primary)]">{(rel.to_name || rel.to_contact_id || '—') as string}</td>
                        <td className="px-4 py-2">
                          <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium capitalize border',
                            (rel.relationship_type === 'tension_with' || rel.relationship_type === 'competes_with') ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            (rel.relationship_type === 'aligned_with' || rel.relationship_type === 'supports' || rel.relationship_type === 'mentors') ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                            'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]')}>
                            {((rel.relationship_type || '—') as string).replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1.5 rounded-full bg-[var(--gm-bg-tertiary)] overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--gm-accent-primary)]" style={{ width: `${Math.round(Number(rel.strength ?? 0) * 100)}%` }} />
                            </div>
                            <span className="text-[9px] text-[var(--gm-text-tertiary)] tabular-nums">{(Number(rel.strength ?? 0) * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-[10px] text-[var(--gm-text-tertiary)] capitalize">{(rel.confidence || '—') as string}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {profiles.length === 0 && <EmptyState msg="No behavioral profiles yet. Run Team Analysis to start profiling." />}
        </div>
      )}

      {/* ── Config Tab ── */}
      {tab === 'config' && (
        <div className="space-y-5">
          <div className={cn(CARD, 'p-5 space-y-5')}>
            <h3 className={SECTION_TITLE}>Analysis Parameters</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Frequency</label>
                <select value={(form.analysisFrequency as string) || 'weekly'} onChange={e => setForm(f => ({ ...f, analysisFrequency: e.target.value }))} className={cn(INPUT, 'w-full')}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
                <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">How often to auto-run analysis</p>
              </div>
              <div>
                <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Min Meetings</label>
                <input type="number" min="1" value={form.minMeetingsForAnalysis ?? 3} onChange={e => setForm(f => ({ ...f, minMeetingsForAnalysis: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} />
                <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">Minimum transcripts before profiling</p>
              </div>
              <div>
                <label className={cn(TABLE_HEAD, 'block mb-1.5')}>Sentiment Threshold</label>
                <input type="number" step="0.1" min="-1" max="0" value={form.sentimentThreshold ?? -0.3} onChange={e => setForm(f => ({ ...f, sentimentThreshold: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} />
                <p className="text-[9px] text-[var(--gm-text-tertiary)] mt-1">Alert below this score (-1 to 0)</p>
              </div>
            </div>
          </div>

          <div className={cn(CARD, 'p-5 space-y-3')}>
            <h3 className={SECTION_TITLE}>Analysis Modules</h3>
            {toggles.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-xs font-medium text-[var(--gm-text-primary)]">{label}</span>
                  <p className="text-[9px] text-[var(--gm-text-tertiary)]">{desc}</p>
                </div>
                <Toggle checked={form[key] !== false} onChange={v => setForm(f => ({ ...f, [key]: v }))} />
              </div>
            ))}
          </div>

          <button onClick={handleSave} disabled={update.isPending} className={BTN_PRIMARY}>
            {update.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Configuration
          </button>
        </div>
      )}

      {/* ── Projects Tab ── */}
      {tab === 'projects' && (
        <div className="space-y-5">
          {adminProjects.length > 0 ? (
            <div className={cn(CARD, 'overflow-hidden')}>
              <div className="px-5 py-3 border-b border-[var(--gm-border-primary)]">
                <h3 className={SECTION_TITLE}>All Projects — Analysis Status</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--gm-border-primary)]">
                    {['Project', 'Enabled', 'Last Analysis', ''].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {adminProjects.map((proj, i) => (
                      <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                        <td className="px-4 py-2.5 text-xs font-medium text-[var(--gm-text-primary)]">{(proj.name || proj.id || '—') as string}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium',
                            proj.isEnabled ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                            {proj.isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-[var(--gm-text-tertiary)] tabular-nums">
                          {proj.lastAnalysisAt ? new Date(proj.lastAnalysisAt as string).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => adminAnalyze.mutate({ projectId: proj.id as string }, {
                            onSuccess: () => toast.success(`Analysis triggered for ${proj.name}`),
                            onError: (e: Error) => toast.error(e.message),
                          })} disabled={adminAnalyze.isPending} className={BTN_PRIMARY}>
                            {adminAnalyze.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Analyze
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState msg="No projects found or admin endpoint not available." />
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Google Drive — /api/system/google-drive (GET+POST)
// GET: { enabled, rootFolderId, hasSystemCredentials, bootstrappedAt, pendingProjects, configuredProjects }
// ══════════════════════════════════════════════════════════════════════════════

function GoogleDriveSection() {
  const { data, isLoading } = useGoogleDriveAdmin();
  const updateGD = useUpdateGoogleDriveAdmin();
  const sync = useGoogleDriveSync();
  const bootstrap = useGoogleDriveBootstrap();

  const [rootFolderEdit, setRootFolderEdit] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [jsonFileName, setJsonFileName] = useState('');
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const d = r(data);
  const enabled = !!d.enabled;
  const hasCredentials = !!d.hasSystemCredentials;
  const rootFolderId = (d.rootFolderId ?? '') as string;
  const bootstrappedAt = d.bootstrappedAt as string | null;
  const pendingProjects = (d.pendingProjects ?? []) as Array<Record<string, unknown>>;
  const configuredProjects = (d.configuredProjects ?? []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (!isLoading && data) {
      setRootFolderEdit(rootFolderId);
    }
  }, [isLoading, data, rootFolderId]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        JSON.parse(text);
        setServiceAccountJson(text);
        setDirty(true);
        toast.success('Service account JSON loaded');
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSave = useCallback(() => {
    const payload: Record<string, unknown> = {
      enabled,
      rootFolderId: rootFolderEdit.trim(),
    };
    if (serviceAccountJson) {
      payload.serviceAccountJson = serviceAccountJson;
    }
    updateGD.mutate(payload, {
      onSuccess: () => {
        toast.success('Configuration saved to Supabase vault');
        setServiceAccountJson('');
        setJsonFileName('');
        setDirty(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }, [enabled, rootFolderEdit, serviceAccountJson, updateGD]);

  if (isLoading) return <Loading />;

  const hasPendingChanges = dirty || rootFolderEdit !== rootFolderId;

  return (
    <div className="space-y-6">
      <SectionHeader title="Google Drive Integration" subtitle="Credentials stored encrypted in Supabase vault — never in .env" />

      {/* ── Connection Status ── */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Connection Status
          </h3>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', hasCredentials && enabled ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
            {hasCredentials && enabled ? 'Connected' : hasCredentials ? 'Disabled' : 'Not Configured'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-[var(--gm-text-tertiary)]">Service Account</span>
            <span className={cn('font-medium', hasCredentials ? 'text-green-400' : 'text-red-400')}>
              {hasCredentials ? 'Uploaded (encrypted)' : 'Not uploaded'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[var(--gm-text-tertiary)]">Root Folder</span>
            <span className={cn('font-mono text-[11px]', rootFolderId ? 'text-[var(--gm-text-primary)]' : 'text-red-400')}>
              {rootFolderId || 'Not set'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[var(--gm-text-tertiary)]">Integration</span>
            <span className={cn('font-medium', enabled ? 'text-green-400' : 'text-[var(--gm-text-tertiary)]')}>
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[var(--gm-text-tertiary)]">Last Bootstrap</span>
            <span className="text-[var(--gm-text-primary)] tabular-nums">
              {bootstrappedAt ? new Date(bootstrappedAt).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Configuration Form ── */}
      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={cn(SECTION_TITLE)}>Configuration</h3>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-[var(--gm-text-primary)] font-medium">Enable Integration</span>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5">Activate Google Drive sync for all projects</p>
          </div>
          <Toggle
            checked={enabled}
            onChange={v => updateGD.mutate(
              { enabled: v, rootFolderId: rootFolderEdit || rootFolderId },
              { onSuccess: () => toast.success(v ? 'Integration enabled' : 'Integration disabled'), onError: (e: Error) => toast.error(e.message) }
            )}
            disabled={updateGD.isPending}
          />
        </div>

        {/* Root Folder ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--gm-text-secondary)] flex items-center gap-1.5">
            <FolderTree className="w-3 h-3" /> Root Folder ID
          </label>
          <input
            type="text"
            value={rootFolderEdit}
            onChange={e => { setRootFolderEdit(e.target.value); setDirty(true); }}
            placeholder="e.g. 1ABC2DEF3GHI4JKL5MNO6PQR..."
            className={cn(INPUT, 'w-full font-mono text-[11px]')}
          />
          <p className="text-[10px] text-[var(--gm-text-tertiary)]">
            The Google Drive folder ID where all project folders will be created. Find it in the Drive folder URL after /folders/.
          </p>
        </div>

        {/* Service Account JSON */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--gm-text-secondary)] flex items-center gap-1.5">
            <FileJson className="w-3 h-3" /> Service Account JSON
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className={BTN_SECONDARY}>
                <Upload className="w-3 h-3" /> Upload JSON File
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
              {jsonFileName && (
                <span className="text-[10px] text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {jsonFileName}
                </span>
              )}
              {!jsonFileName && hasCredentials && (
                <span className="text-[10px] text-[var(--gm-text-tertiary)]">
                  Credentials already stored (encrypted in Supabase vault)
                </span>
              )}
            </div>
            <div className="relative">
              <textarea
                value={serviceAccountJson}
                onChange={e => { setServiceAccountJson(e.target.value); setDirty(true); }}
                placeholder='Or paste the service account JSON here...'
                rows={4}
                className={cn(INPUT, 'w-full font-mono text-[10px] leading-relaxed resize-none', !showJson && serviceAccountJson ? 'text-transparent' : '')}
              />
              {serviceAccountJson && (
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]"
                >
                  {showJson ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--gm-text-tertiary)]">
              Download from Google Cloud Console &gt; IAM &gt; Service Accounts &gt; Keys. The JSON is encrypted at rest via pgcrypto.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--gm-border-primary)]">
          <button onClick={handleSave} disabled={updateGD.isPending || !hasPendingChanges} className={BTN_PRIMARY}>
            {updateGD.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Configuration
          </button>
          {hasPendingChanges && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={cn(SECTION_TITLE)}>Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => bootstrap.mutate(undefined, {
              onSuccess: (res) => {
                const d = r(res);
                toast.success(d.message as string || 'Bootstrap complete');
              },
              onError: (e: Error) => toast.error(e.message),
            })}
            disabled={bootstrap.isPending || !hasCredentials || !enabled}
            className={BTN_PRIMARY}
          >
            {bootstrap.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderTree className="w-3 h-3" />}
            Bootstrap All Projects
          </button>
          <button
            onClick={() => sync.mutate(undefined, {
              onSuccess: () => toast.success('Sync started'),
              onError: (e: Error) => toast.error(e.message),
            })}
            disabled={sync.isPending || !hasCredentials || !enabled}
            className={BTN_SECONDARY}
          >
            {sync.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync Now
          </button>
        </div>
        {!hasCredentials && (
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Upload service account credentials to enable actions
          </p>
        )}
        {hasCredentials && !enabled && (
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Enable the integration to use these actions
          </p>
        )}
      </div>

      {/* ── Configured Projects ── */}
      {configuredProjects.length > 0 && (
        <div className={cn(CARD, 'p-5')}>
          <h3 className={cn(SECTION_TITLE, 'mb-3')}>Configured Projects ({configuredProjects.length})</h3>
          <div className="space-y-0">
            {configuredProjects.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-[var(--gm-border-primary)] last:border-0">
                <span className="text-[var(--gm-text-primary)] font-medium">{p.name as string}</span>
                <span className="text-[var(--gm-text-tertiary)] font-mono text-[10px]">{p.folderId as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending Projects ── */}
      {pendingProjects.length > 0 && (
        <div className={cn(CARD, 'p-5')}>
          <h3 className={cn(SECTION_TITLE, 'mb-3')}>Pending Projects ({pendingProjects.length})</h3>
          <div className="space-y-0">
            {pendingProjects.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-[var(--gm-border-primary)] last:border-0">
                <span className="text-[var(--gm-text-primary)]">{p.name as string}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Billing — /api/admin/billing/*
// Exchange rate: { success, ...config }
// Pricing: { success, config: { ... } }
// Projects: { success, projects: [...] }
// ══════════════════════════════════════════════════════════════════════════════

function BillingSection() {
  const { data: exData } = useBillingExchangeRate();
  const { data: pricingData } = useBillingPricing();
  const { data: projData, isLoading, refetch: refetchProjects } = useBillingProjects();
  const refreshRate = useRefreshExchangeRate();
  const updatePricing = useUpdateBillingPricing();
  const updateExRate = useUpdateExchangeRate();
  const projectAction = useBillingProjectAction();

  const [pricingForm, setPricingForm] = useState<Record<string, unknown>>({});
  const pricingInit = useRef(false);

  const rate = r(exData);
  const pricingConfig = r(r(pricingData).config);
  const projects = (r(projData).projects ?? []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (!pricingInit.current && Object.keys(pricingConfig).length > 0) {
      setPricingForm({ ...pricingConfig });
      pricingInit.current = true;
    }
  }, [pricingConfig]);

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Billing & Cost Control" subtitle="Manage project balances, pricing, and cost limits" />

      <div className={cn(CARD, 'p-5 space-y-3')}>
        <h3 className={SECTION_TITLE}>Exchange Rate (USD to EUR)</h3>
        {rate.auto != null && <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-[var(--gm-accent-primary)]" /><span className="text-xs text-[var(--gm-accent-primary)]">{rate.auto ? 'Automatic rate from API' : 'Manual rate'}</span></div>}
        <div className="text-xs"><span className="text-[var(--gm-accent-primary)]">Current Rate: </span><span className="text-lg font-bold text-[var(--gm-text-primary)] tabular-nums">{String(rate.currentRate ?? rate.rate ?? '—')}</span></div>
        <div className="text-[10px] text-[var(--gm-text-tertiary)]">Source: {String(rate.source ?? 'api')} · Updated: {(rate.lastUpdated || rate.updatedAt) ? new Date((rate.lastUpdated || rate.updatedAt) as string).toLocaleString() : '—'}</div>
        {!rate.auto && (
          <div>
            <label className={cn(TABLE_HEAD, 'block mb-1')}>Manual Rate</label>
            <input type="number" step="0.0001" min="0" defaultValue={Number(rate.manualRate ?? rate.currentRate ?? 0.92)}
              onBlur={e => updateExRate.mutate({ auto: false, manualRate: Number(e.target.value) }, { onSuccess: () => toast.success('Manual rate saved'), onError: (er: Error) => toast.error(er.message) })}
              className={cn(INPUT, 'w-40')} />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => refreshRate.mutate(undefined, { onSuccess: () => toast.success('Rate refreshed'), onError: (e: Error) => toast.error(e.message) })} disabled={refreshRate.isPending} className={BTN_SECONDARY}>
            {refreshRate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh Rate
          </button>
          <button onClick={() => updateExRate.mutate({ auto: !(rate.auto ?? true) }, { onSuccess: () => toast.success('Exchange rate mode updated'), onError: (e: Error) => toast.error(e.message) })} disabled={updateExRate.isPending} className={BTN_SECONDARY}>
            Switch to {rate.auto ? 'Manual' : 'Automatic'}
          </button>
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-3')}>
        <h3 className={SECTION_TITLE}>Global Pricing Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={cn(TABLE_HEAD, 'block mb-1')}>Fixed Markup (%)</label><input type="number" value={pricingForm.fixed_markup_percent ?? 0} onChange={e => setPricingForm(f => ({ ...f, fixed_markup_percent: Number(e.target.value) }))} className={cn(INPUT, 'w-full')} /></div>
          <div><label className={cn(TABLE_HEAD, 'block mb-1')}>Period Type</label>
            <select value={(pricingForm.period_type as string) ?? 'monthly'} onChange={e => setPricingForm(f => ({ ...f, period_type: e.target.value }))} className={cn(INPUT, 'w-full')}>
              <option value="monthly">Monthly</option><option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        <p className="text-[10px] text-[var(--gm-text-tertiary)]">Applied when no tier matches</p>
        <button onClick={() => updatePricing.mutate(pricingForm as Record<string, unknown>, { onSuccess: () => toast.success('Global pricing saved'), onError: (e: Error) => toast.error(e.message) })} disabled={updatePricing.isPending} className={BTN_PRIMARY}>
          {updatePricing.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Global Pricing
        </button>
      </div>

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="px-5 py-3 border-b border-[var(--gm-border-primary)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--gm-text-primary)]">Projects Billing</h3>
            <p className="text-[10px] text-[var(--gm-text-tertiary)]">{projects.length} projects · {projects.filter(p => p.blocked).length} blocked · {projects.filter(p => p.unlimited).length} unlimited</p>
          </div>
          <button onClick={() => refetchProjects()} className={BTN_SECONDARY}><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-[var(--gm-border-primary)]">
            {['PROJECT', 'BALANCE', 'STATUS', 'KEY SOURCE', 'TOKENS (PERIOD)', 'COST (PERIOD)', 'ACTIONS'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {projects.map((p, i) => {
              const keySources = (p.key_sources ?? {}) as Record<string, string>;
              const usesOwnKeys = !!(p.uses_own_keys);
              const allOwnKeys = !!(p.all_own_keys);
              const configuredSources = Object.entries(keySources);
              return (
                <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                  <td className="px-4 py-2.5 text-xs font-semibold text-[var(--gm-text-primary)]">{(p.name || p.project_name || p.project_id) as string}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--gm-text-secondary)] tabular-nums">{p.unlimited_balance ? '∞ Unlimited' : `${(p.balance_eur ?? p.balance ?? 0)} €`}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold',
                      p.is_blocked ? 'bg-red-500/15 text-red-400' : p.unlimited_balance ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400')}>
                      {p.is_blocked ? 'BLOCKED' : p.unlimited_balance ? 'UNLIMITED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {configuredSources.length === 0 ? (
                      <span className="text-[10px] text-[var(--gm-text-tertiary)]">No keys</span>
                    ) : allOwnKeys ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold" title="BYOK: billing skipped">BYOK</span>
                    ) : usesOwnKeys ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold" title="Mixed: some own keys, some system keys">MIXED</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold" title="Using system keys: billing active">SYSTEM</span>
                    )}
                    {configuredSources.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {configuredSources.map(([prov, src]) => (
                          <span key={prov} className={cn('text-[9px] px-1 py-px rounded', src === 'project' ? 'bg-purple-500/10 text-purple-300' : 'bg-blue-500/10 text-blue-300')}>
                            {prov}:{src[0]?.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] tabular-nums">{p.tokens_this_period != null ? `${(Number(p.tokens_this_period) / 1000).toFixed(1)}K` : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] tabular-nums">{p.billable_cost_this_period != null ? `${Number(p.billable_cost_this_period).toFixed(2)} €` : '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => projectAction.mutate({ projectId: (p.project_id || p.id) as string, action: 'block', data: { blocked: !p.is_blocked } }, { onSuccess: () => { toast.success(p.is_blocked ? 'Unblocked' : 'Blocked'); refetchProjects(); }, onError: (e: Error) => toast.error(e.message) })} className="p-1 rounded hover:bg-[var(--gm-surface-hover)]" title={p.is_blocked ? 'Unblock' : 'Block'}>
                        <Ban className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <button onClick={() => projectAction.mutate({ projectId: (p.project_id || p.id) as string, action: 'unlimited', data: { unlimited: !p.unlimited_balance } }, { onSuccess: () => { toast.success(p.unlimited_balance ? 'Limited' : 'Set unlimited'); refetchProjects(); }, onError: (e: Error) => toast.error(e.message) })} className="p-1 rounded hover:bg-[var(--gm-surface-hover)]" title={p.unlimited_balance ? 'Remove unlimited' : 'Set unlimited'}>
                        <span className="text-[10px]">{p.unlimited_balance ? '∞' : '$'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {projects.length === 0 && <div className="p-8 text-center text-sm text-[var(--gm-text-tertiary)]">No projects found.</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Audit Log — /api/admin/audit/logs
// Response: { success, logs: [...], total, page, limit }
// Also /api/system/audit for config-level audit
// ══════════════════════════════════════════════════════════════════════════════

function AuditLogSection() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: adminData, isLoading: adminLoading } = useAdminAuditLogs({ page, limit, search: search || undefined, filter: filter || undefined });
  const { data: sysData } = useAdminAuditLog();

  const adminResp = r(adminData);
  const adminLogs = (adminResp.logs ?? []) as Array<Record<string, unknown>>;
  const sysResp = r(sysData);
  const sysLogs = (sysResp.logs ?? []) as Array<Record<string, unknown>>;

  const allLogs = useMemo(() => {
    const merged = [...adminLogs, ...sysLogs];
    merged.sort((a, b) => {
      const da = new Date((a.changed_at || a.timestamp || a.created_at || '1970-01-01') as string).getTime() || 0;
      const db = new Date((b.changed_at || b.timestamp || b.created_at || '1970-01-01') as string).getTime() || 0;
      return db - da;
    });
    return merged;
  }, [adminLogs, sysLogs]);

  const total = (adminResp.total ?? allLogs.length) as number;

  if (adminLoading) return <Loading />;

  const getSeverityColor = (sev: string) => {
    if (sev === 'critical' || sev === 'error') return 'bg-red-500/15 text-red-400';
    if (sev === 'warning') return 'bg-amber-500/15 text-amber-400';
    return 'bg-blue-500/15 text-blue-400';
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Audit Log" />
      <div className="flex gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
          <input placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className={cn(INPUT, 'flex-1')} />
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className={cn(INPUT, 'w-28')}>
          <option value="">All</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
        </select>
      </div>
      <div className={cn(CARD, 'overflow-hidden')}>
        <table className="w-full">
          <thead><tr className="border-b border-[var(--gm-border-primary)]">
            {['TIMESTAMP', 'USER', 'ACTION', 'DETAILS', 'SEVERITY', 'IP'].map(h => <th key={h} className={cn(TABLE_HEAD, 'px-4 py-2.5 text-left')}>{h}</th>)}
          </tr></thead>
          <tbody>
            {allLogs.map((entry, i) => (
              <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)]">
                <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] tabular-nums whitespace-nowrap">
                  {(entry.changed_at || entry.timestamp || entry.created_at) ? new Date((entry.changed_at || entry.timestamp || entry.created_at) as string).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-xs font-medium text-[var(--gm-text-primary)]">{(entry.changed_by_email || entry.user || entry.actor || 'System') as string}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--gm-text-secondary)]">{(entry.action || entry.operation || entry.event_type || '—') as string}</td>
                <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] max-w-[200px] truncate">{(entry.details || entry.config_key || entry.table_name || entry.description || '') as string}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', getSeverityColor((entry.severity || entry.level || 'info') as string))}>
                    {(entry.severity || entry.level || 'info') as string}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-[var(--gm-text-tertiary)] font-mono">{(entry.ip || entry.ip_address || '') as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {allLogs.length === 0 && <div className="p-8 text-center text-sm text-[var(--gm-text-tertiary)]">No audit log entries.</div>}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[var(--gm-text-tertiary)]">{total} entries</p>
        {total > limit && (
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className={BTN_SECONDARY}>Previous</button>
            <span className="text-xs text-[var(--gm-text-tertiary)] self-center">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={allLogs.length < limit} className={BTN_SECONDARY}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [section, setSection] = useState<AdminSection>('users');

  return (
    <div className="flex h-full">
      <div className="w-48 shrink-0 border-r border-[var(--gm-border-primary)] bg-[var(--gm-bg-primary)] overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-[var(--gm-border-primary)]">
          <Shield className="w-4 h-4 text-[var(--gm-accent-primary)]" style={{ filter: 'drop-shadow(0 0 6px var(--gm-accent-primary))' }} />
          <span className="text-sm font-bold text-[var(--gm-accent-primary)]">Admin</span>
        </div>
        <nav className="py-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button key={item.key} onClick={() => setSection(item.key)}
                className={cn('w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors',
                  active ? 'text-[var(--gm-accent-primary)] bg-[var(--gm-surface-hover)] font-semibold' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]')}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <AlertBanners />
        {section === 'users' && <UsersSection />}
        {section === 'system' && <SystemSection />}
        {section === 'llm-providers' && <LLMProvidersSection />}
        {section === 'model-metadata' && <ModelMetadataSection />}
        {section === 'llm-queue' && <LLMQueueSection />}
        {section === 'graph' && <GraphSection />}
        {section === 'ontology' && <OntologySection />}
        {section === 'prompts' && <PromptsSection />}
        {section === 'processing' && <ProcessingSection />}
        {section === 'team-analysis' && <TeamAnalysisSection />}
        {section === 'google-drive' && <GoogleDriveSection />}
        {section === 'billing' && <BillingSection />}
        {section === 'audit-log' && <AuditLogSection />}
      </div>
    </div>
  );
}
