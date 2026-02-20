import { useState } from 'react';
import {
  Loader2, Settings, Plug, TestTube, Database, Trash2, RefreshCw,
  CheckCircle, AlertTriangle, Server, Layers, Zap, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGraphConfig, useGraphStatus, useGraphProviders, useGraphList,
  useGraphConnect, useGraphTest, useGraphFullSync, useGraphSyncCleanup,
  useGraphCreateIndexes, useGraphCleanupOrphans, useGraphCleanupDuplicates,
  useGraphDeleteGraph, useGraphSyncStatus, useGraphMultiStats,
} from '../../hooks/useGodMode';
import { cn } from '../../lib/utils';

type Tab = 'connection' | 'management' | 'graphs' | 'status';

export default function GraphSettings() {
  const [tab, setTab] = useState<Tab>('connection');
  const [connectForm, setConnectForm] = useState({ uri: '', username: '', password: '', database: '' });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const config = useGraphConfig();
  const status = useGraphStatus();
  const providers = useGraphProviders();
  const graphList = useGraphList();
  const syncStatus = useGraphSyncStatus();
  const multiStats = useGraphMultiStats();

  const connectMut = useGraphConnect();
  const testMut = useGraphTest();
  const fullSync = useGraphFullSync();
  const syncCleanup = useGraphSyncCleanup();
  const createIndexes = useGraphCreateIndexes();
  const cleanOrphans = useGraphCleanupOrphans();
  const cleanDuplicates = useGraphCleanupDuplicates();
  const deleteGraph = useGraphDeleteGraph();

  const configData = (config.data || {}) as Record<string, unknown>;
  const statusData = (status.data || {}) as Record<string, unknown>;
  const providerList = ((providers.data as Record<string, unknown>)?.providers || []) as Array<Record<string, unknown>>;
  const graphs = ((graphList.data as Record<string, unknown>)?.graphs || graphList.data || []) as Array<Record<string, unknown>>;
  const syncStatusData = (syncStatus.data || {}) as Record<string, unknown>;
  const multiStatsData = (multiStats.data || {}) as Record<string, unknown>;

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: 'connection', label: 'Connection', icon: Plug },
    { key: 'management', label: 'Management', icon: Settings },
    { key: 'graphs', label: 'Graphs', icon: Database },
    { key: 'status', label: 'Status', icon: Server },
  ];

  const handleConnect = () => {
    connectMut.mutate(connectForm, {
      onSuccess: () => { toast.success('Connected to graph database'); config.refetch(); status.refetch(); },
      onError: () => toast.error('Connection failed'),
    });
  };

  const handleTest = () => {
    testMut.mutate(connectForm.uri ? connectForm : {}, {
      onSuccess: (r) => {
        const ok = (r as Record<string, unknown>)?.ok;
        if (ok) toast.success('Connection test passed');
        else toast.warning('Connection test returned issues');
      },
      onError: () => toast.error('Connection test failed'),
    });
  };

  const handleDeleteGraph = (name: string) => {
    deleteGraph.mutate(name, {
      onSuccess: () => { toast.success(`Graph "${name}" deleted`); graphList.refetch(); setDeleteTarget(null); },
      onError: () => toast.error('Delete failed'),
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-1 px-4 border-b border-gm-border-primary bg-gm-surface-secondary shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium border-b-2 transition-colors',
                tab === t.key ? 'border-gm-interactive-primary text-gm-interactive-primary' : 'border-transparent text-gm-text-tertiary hover:text-gm-text-primary')}>
              <Icon className="w-3 h-3" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'connection' && (
          <>
            {/* Current Config */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <h4 className="text-xs font-semibold text-gm-text-primary mb-3 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Current Connection
              </h4>
              {config.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="space-y-1.5 text-xs">
                  {Object.entries(configData).filter(([k]) => !k.toLowerCase().includes('password')).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gm-text-tertiary capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-gm-text-primary font-medium">{String(v ?? '—')}</span>
                    </div>
                  ))}
                  {Object.keys(configData).length === 0 && <p className="text-gm-text-tertiary">No connection configured</p>}
                </div>
              )}
            </div>

            {/* Providers */}
            {providerList.length > 0 && (
              <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                <h4 className="text-xs font-semibold text-gm-text-primary mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Available Providers
                </h4>
                <div className="space-y-2">
                  {providerList.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className={cn('w-2 h-2 rounded-full', p.available ? 'bg-gm-status-success' : 'bg-gm-text-tertiary')} />
                      <span className="text-gm-text-primary font-medium">{String(p.name || p.type || p.provider || '—')}</span>
                      {p.version && <span className="text-gm-text-tertiary">v{String(p.version)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connect Form */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <h4 className="text-xs font-semibold text-gm-text-primary mb-3">Connect to Graph Database</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">URI</label>
                  <input value={connectForm.uri} onChange={e => setConnectForm(p => ({ ...p, uri: e.target.value }))}
                    placeholder="bolt://localhost:7687"
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">Username</label>
                    <input value={connectForm.username} onChange={e => setConnectForm(p => ({ ...p, username: e.target.value }))}
                      placeholder="neo4j"
                      className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">Password</label>
                    <input type="password" value={connectForm.password} onChange={e => setConnectForm(p => ({ ...p, password: e.target.value }))}
                      className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">Database</label>
                  <input value={connectForm.database} onChange={e => setConnectForm(p => ({ ...p, database: e.target.value }))}
                    placeholder="neo4j"
                    className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleTest} disabled={testMut.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                    {testMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />} Test
                  </button>
                  <button onClick={handleConnect} disabled={connectMut.isPending}
                    className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                    {connectMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />} Connect
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'management' && (
          <div className="space-y-4">
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <h4 className="text-xs font-semibold text-gm-text-primary mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Sync & Indexing
              </h4>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => fullSync.mutate(undefined, { onSuccess: () => toast.success('Full sync started') })}
                  disabled={fullSync.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {fullSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Full Sync
                </button>
                <button onClick={() => createIndexes.mutate(undefined, { onSuccess: () => toast.success('Indexes created') })}
                  disabled={createIndexes.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {createIndexes.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />} Create Indexes
                </button>
                <button onClick={() => syncCleanup.mutate(undefined, { onSuccess: () => toast.success('Sync cleanup done') })}
                  disabled={syncCleanup.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {syncCleanup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />} Sync Cleanup
                </button>
              </div>
            </div>

            <div className="bg-[var(--gm-status-danger-bg)] rounded-xl p-4 border border-red-500/20">
              <h4 className="text-xs font-semibold text-gm-status-danger mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Cleanup Operations
              </h4>
              <p className="text-[10px] text-gm-text-tertiary mb-3">These operations modify graph data. Use with caution.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => cleanOrphans.mutate(undefined, { onSuccess: (r) => toast.success(`Cleaned ${(r as Record<string, unknown>)?.removed ?? ''} orphan nodes`) })}
                  disabled={cleanOrphans.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-status-warning-bg text-gm-status-warning text-xs font-medium hover:bg-yellow-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {cleanOrphans.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Clean Orphans
                </button>
                <button onClick={() => cleanDuplicates.mutate(undefined, { onSuccess: (r) => toast.success(`Merged ${(r as Record<string, unknown>)?.merged ?? ''} duplicates`) })}
                  disabled={cleanDuplicates.isPending}
                  className="px-3 py-1.5 rounded-lg bg-gm-status-warning-bg text-gm-status-warning text-xs font-medium hover:bg-yellow-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {cleanDuplicates.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Clean Duplicates
                </button>
              </div>
            </div>

            {/* Sync Status */}
            <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
              <h4 className="text-xs font-semibold text-gm-text-primary mb-3">Sync Status</h4>
              {syncStatus.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="space-y-1.5 text-xs">
                  {Object.entries(syncStatusData).filter(([, v]) => v != null).slice(0, 10).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gm-text-tertiary capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-gm-text-primary font-medium">
                        {typeof v === 'boolean' ? (v ? '✓' : '✗') : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'graphs' && (
          <div className="space-y-4">
            {graphList.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <>
                {Array.isArray(graphs) && graphs.length > 0 ? (
                  <div className="space-y-2">
                    {graphs.map((g, i) => {
                      const name = String(g.name || g.graph || g.id || `graph-${i}`);
                      const nodeCount = Number(g.node_count || g.nodes || 0);
                      const edgeCount = Number(g.edge_count || g.edges || 0);
                      return (
                        <div key={i} className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary flex items-center gap-3">
                          <Database className="w-5 h-5 text-gm-interactive-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gm-text-primary">{name}</p>
                            <p className="text-[10px] text-gm-text-tertiary">{nodeCount} nodes · {edgeCount} edges</p>
                          </div>
                          {deleteTarget === name ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleDeleteGraph(name)} disabled={deleteGraph.isPending}
                                className="px-2 py-1 rounded text-[10px] bg-gm-status-danger text-white font-medium">
                                {deleteGraph.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                              </button>
                              <button onClick={() => setDeleteTarget(null)} className="px-2 py-1 rounded text-[10px] bg-gm-surface-secondary text-gm-text-tertiary">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteTarget(name)}
                              className="p-1.5 rounded-lg text-gm-text-tertiary hover:bg-gm-status-danger-bg hover:text-gm-status-danger transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Database className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="text-xs text-gm-text-tertiary">No graphs found</p>
                  </div>
                )}

                {/* Multi-Stats */}
                {Object.keys(multiStatsData).length > 0 && (
                  <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                    <h4 className="text-xs font-semibold text-gm-text-primary mb-3">Multi-Graph Stats</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {Object.entries(multiStatsData).filter(([, v]) => typeof v === 'number').slice(0, 6).map(([k, v]) => (
                        <div key={k} className="text-center">
                          <p className="text-lg font-bold text-gm-text-primary">{String(v)}</p>
                          <p className="text-[10px] text-gm-text-tertiary capitalize">{k.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'status' && (
          <div className="space-y-4">
            {status.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto" /> : (
              <>
                <div className="bg-[var(--gm-surface-hover)] rounded-xl p-4 border border-gm-border-primary">
                  <h4 className="text-xs font-semibold text-gm-text-primary mb-3 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" /> Graph Database Status
                  </h4>
                  <div className="space-y-2 text-xs">
                    {Object.entries(statusData).filter(([, v]) => v != null).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-gm-text-tertiary capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className={cn('font-medium',
                          v === 'healthy' || v === true || v === 'connected' ? 'text-gm-status-success' :
                          v === 'degraded' || v === 'warning' ? 'text-gm-status-warning' :
                          v === 'error' || v === false || v === 'disconnected' ? 'text-gm-status-danger' :
                          'text-gm-text-primary')}>
                          {typeof v === 'boolean' ? (v ? <CheckCircle className="w-3.5 h-3.5 inline" /> : <AlertTriangle className="w-3.5 h-3.5 inline" />) : String(v)}
                        </span>
                      </div>
                    ))}
                    {Object.keys(statusData).length === 0 && <p className="text-gm-text-tertiary">No status data available</p>}
                  </div>
                </div>

                <button onClick={() => { status.refetch(); syncStatus.refetch(); config.refetch(); }}
                  className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-gm-text-primary text-xs font-medium hover:bg-gm-surface-hover flex items-center gap-1.5 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
