import {
  Loader2, Users, GitBranch, Target, BarChart3, Sparkles,
  TrendingUp, Link2, Layers, Cpu,
} from 'lucide-react';
import {
  useGraphInsights, useGraphRAGCommunities, useGraphRAGCentrality, useGraphRAGBridges,
} from '../../hooks/useGodMode';
import { cn } from '../../lib/utils';

import { NODE_COLORS } from '@/lib/graph-transformer';

export default function GraphAnalytics() {
  const insights = useGraphInsights();
  const communities = useGraphRAGCommunities();
  const centrality = useGraphRAGCentrality();
  const bridges = useGraphRAGBridges();

  const data = insights.data as Record<string, unknown> | undefined;
  const stats = (data?.stats || data) as Record<string, unknown> | undefined;
  const nodeCount = Number(stats?.nodeCount ?? stats?.node_count ?? 0);
  const edgeCount = Number(stats?.edgeCount ?? stats?.edge_count ?? 0);
  const density = Number(stats?.density ?? 0);
  const avgDegree = Number(stats?.avgDegree ?? stats?.avg_degree ?? 0);
  const entityDistribution = (stats?.entityDistribution ?? stats?.distribution ?? stats?.byLabel ?? {}) as Record<string, number>;
  const recommendations = (data?.recommendations || []) as string[];

  const communityList = ((communities.data as Record<string, unknown>)?.communities || []) as Array<Record<string, unknown>>;
  const centralNodes = ((centrality.data as Record<string, unknown>)?.nodes || []) as Array<Record<string, unknown>>;
  const bridgeNodes = ((bridges.data as Record<string, unknown>)?.bridges || []) as Array<Record<string, unknown>>;

  const isLoading = insights.isLoading;
  const maxDistCount = Math.max(...Object.values(entityDistribution), 1);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={Cpu} label="Nodes" value={String(nodeCount)} color="text-gm-interactive-primary" bgColor="bg-blue-600/10" />
        <StatCard icon={Link2} label="Edges" value={String(edgeCount)} color="text-purple-500" bgColor="bg-purple-500/10" />
        <StatCard icon={BarChart3} label="Density" value={density.toFixed(4)} color="text-orange-500" bgColor="bg-orange-500/10" />
        <StatCard icon={TrendingUp} label="Avg Degree" value={avgDegree.toFixed(2)} color="text-green-500" bgColor="bg-green-500/10" />
      </div>

      {/* Entity Distribution */}
      {Object.keys(entityDistribution).length > 0 && (
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Entity Distribution
          </h3>
          <div className="space-y-2">
            {Object.entries(entityDistribution).sort(([, a], [, b]) => b - a).map(([type, count]) => {
              const pct = (count / maxDistCount) * 100;
              const color = NODE_COLORS[type] || '#64748b';
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium" style={{ color }}>{type}</span>
                    <span className="text-gm-text-tertiary font-mono">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-gm-surface-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Key People (Centrality) */}
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Key People
            {centrality.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          </h3>
          {centralNodes.length === 0 ? (
            <p className="text-xs text-gm-text-tertiary text-center py-4">No centrality data</p>
          ) : (
            <div className="space-y-2">
              {centralNodes.slice(0, 10).map((node, i) => {
                const name = String(node.name || node.label || node.id || '');
                const score = Number(node.score || node.centrality || node.degree || 0);
                const type = String(node.type || node.label || '');
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: NODE_COLORS[type] || '#ec4899' }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gm-text-primary truncate">{name}</p>
                      <div className="w-full h-1 bg-gm-surface-secondary rounded-full mt-0.5">
                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(score * 100, 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-gm-text-tertiary font-mono shrink-0">{score.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bridge Nodes */}
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" /> Bridge Nodes
            {bridges.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          </h3>
          {bridgeNodes.length === 0 ? (
            <p className="text-xs text-gm-text-tertiary text-center py-4">No bridge data</p>
          ) : (
            <div className="space-y-2">
              {bridgeNodes.slice(0, 10).map((node, i) => {
                const name = String(node.name || node.label || node.id || '');
                const score = Number(node.score || node.betweenness || 0);
                const type = String(node.type || node.label || '');
                return (
                  <div key={i} className="flex items-center gap-2 bg-[var(--gm-surface-hover)] rounded-lg p-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[type] || '#64748b' }} />
                    <span className="text-xs text-gm-text-primary truncate flex-1">{name}</span>
                    <span className="text-[10px] text-gm-text-tertiary capitalize">{type}</span>
                    <span className="text-[10px] text-gm-text-tertiary font-mono">{score.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Communities */}
      {communityList.length > 0 && (
        <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Communities
            {communities.isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gm-surface-secondary">{communityList.length}</span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {communityList.map((c, i) => {
              const members = (c.members || c.nodes || []) as Array<Record<string, unknown>>;
              const name = String(c.name || c.label || `Community ${i + 1}`);
              return (
                <div key={i} className="bg-[var(--gm-surface-hover)] rounded-lg p-3">
                  <p className="text-xs font-medium text-gm-text-primary mb-1">{name}</p>
                  <p className="text-[10px] text-gm-text-tertiary">{members.length} members</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {members.slice(0, 5).map((m, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary truncate max-w-[80px]">
                        {String(m.name || m.label || m.id || '')}
                      </span>
                    ))}
                    {members.length > 5 && <span className="text-[9px] text-gm-text-tertiary">+{members.length - 5}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-blue-600/5 border-l-[3px] border-gm-interactive-primary rounded-r-lg p-4">
          <h3 className="text-[10px] font-semibold text-gm-interactive-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Recommendations
          </h3>
          <ul className="space-y-1.5">
            {recommendations.map((r, i) => (
              <li key={i} className="text-xs text-gm-text-primary flex items-start gap-2">
                <span className="text-gm-interactive-primary mt-0.5">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor }: {
  icon: typeof Cpu; label: string; value: string; color: string; bgColor: string;
}) {
  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl px-4 py-3">
      <div className="flex items-center gap-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <div>
          <span className={cn('text-lg font-bold', color)}>{value}</span>
          <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}
