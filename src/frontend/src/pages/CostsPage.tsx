import { useState, useMemo } from 'react';
import {
  DollarSign, Download, Loader2, BarChart3, TrendingUp, TrendingDown,
  Cpu, Layers, Zap, Clock, AlertTriangle, Settings, ChevronDown,
  ChevronUp, ArrowUpRight, ArrowDownRight, Minus, FileText,
  RefreshCw, Target, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCostsSummary, useRecentLLMRequests, useModelStats,
  usePricingTable, useBudget, useSetBudget, useResetCosts,
} from '../hooks/useGodMode';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/Dialog';
import { cn } from '../lib/utils';
import { apiClient } from '../lib/api-client';
import { ErrorState } from '../components/shared/ErrorState';

type Period = 'day' | 'week' | 'month' | 'all';

const periods: { value: Period; label: string; short: string }[] = [
  { value: 'day', label: 'Today', short: '24h' },
  { value: 'week', label: 'This Week', short: '7d' },
  { value: 'month', label: 'This Month', short: '30d' },
  { value: 'all', label: 'All Time', short: 'All' },
];

export default function CostsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [showBudget, setShowBudget] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentSearch, setRecentSearch] = useState('');
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>('model');

  const summary = useCostsSummary(period);
  const recent = useRecentLLMRequests(50);
  const modelStats = useModelStats();
  const pricing = usePricingTable();
  const budget = useBudget(period === 'day' || period === 'all' ? 'month' : period);
  const resetCosts = useResetCosts();

  const data = summary.data as Record<string, unknown> | undefined;
  const totalCost = Number(data?.total ?? 0);
  const byProvider = (data?.byProvider || {}) as Record<string, number>;
  const byModel = (data?.byModel || {}) as Record<string, number>;
  const byOperation = (data?.byOperation || {}) as Record<string, number>;
  const byContext = (data?.byContext || {}) as Record<string, number>;
  const dailyBreakdown = (data?.dailyBreakdown || []) as Array<{ date: string; cost: number; calls: number }>;
  const totalInputTokens = Number(data?.totalInputTokens ?? 0);
  const totalOutputTokens = Number(data?.totalOutputTokens ?? 0);
  const previousCost = data?.previousPeriodCost as number | null | undefined;
  const percentChange = data?.percentChange as number | null | undefined;
  const budgetLimit = data?.budgetLimit as number | null | undefined;
  const budgetUsedPercent = data?.budgetUsedPercent as number | null | undefined;
  const budgetAlertTriggered = !!data?.budgetAlertTriggered;
  const periodInfo = data?.period as Record<string, string> | undefined;

  const budgetData = (budget.data as Record<string, unknown>)?.budget as Record<string, unknown> | null;

  const recentRequests = useMemo(() => {
    const list = ((recent.data as Record<string, unknown>)?.requests || []) as Array<Record<string, unknown>>;
    if (!recentSearch.trim()) return list;
    const q = recentSearch.toLowerCase();
    return list.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [recent.data, recentSearch]);

  const maxDailyCost = Math.max(...dailyBreakdown.map(d => d.cost), 0.001);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const data = await apiClient.get<string | Record<string, unknown>>(`/api/costs/export?period=${period}&format=${format}`);
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const mime = format === 'csv' ? 'text/csv' : 'application/json';
      const blob = new Blob([content], { type: mime });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `llm-costs-${period}-${new Date().toISOString().split('T')[0]}.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleReset = () => {
    if (!confirm('Reset in-memory cost tracking? This does not affect persisted data.')) return;
    resetCosts.mutate(undefined, {
      onSuccess: () => toast.success('Cost tracking reset'),
      onError: () => toast.error('Failed to reset'),
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gm-text-primary">LLM Costs</h1>
          <p className="text-xs text-gm-text-tertiary mt-0.5">
            {periodInfo?.start && periodInfo?.end
              ? `${periodInfo.start.split('T')[0]} → ${periodInfo.end.split('T')[0]}`
              : periods.find(p => p.value === period)?.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-gm-surface-secondary rounded-lg border border-gm-border-primary overflow-hidden">
            {periods.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-gm-interactive-primary text-gm-text-on-brand'
                    : 'text-gm-text-tertiary hover:text-gm-text-primary')}>
                {p.short}
              </button>
            ))}
          </div>
          <button onClick={() => setShowBudget(true)} className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-xs text-gm-text-primary hover:bg-gm-surface-hover flex items-center gap-1.5 transition-colors">
            <Target className="w-3.5 h-3.5" /> Budget
          </button>
          <button onClick={() => setShowPricing(true)} className="px-3 py-1.5 rounded-lg bg-gm-surface-secondary border border-gm-border-primary text-xs text-gm-text-primary hover:bg-gm-surface-hover flex items-center gap-1.5 transition-colors">
            <Settings className="w-3.5 h-3.5" /> Pricing
          </button>
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-xs font-medium hover:bg-gm-interactive-primary-hover flex items-center gap-1.5 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-gm-surface-primary border border-gm-border-primary rounded-lg shadow-lg z-10 hidden group-hover:block">
              <button onClick={() => handleExport('json')} className="block w-full px-4 py-2 text-xs text-gm-text-primary hover:bg-gm-surface-hover text-left">JSON</button>
              <button onClick={() => handleExport('csv')} className="block w-full px-4 py-2 text-xs text-gm-text-primary hover:bg-gm-surface-hover text-left">CSV</button>
            </div>
          </div>
        </div>
      </div>

      {summary.error ? (
        <ErrorState message="Failed to load cost data." onRetry={() => summary.refetch()} />
      ) : summary.isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-gm-interactive-primary" /></div>
      ) : (
        <>
          {/* Budget Bar */}
          {budgetLimit && budgetLimit > 0 && (
            <div className={cn('rounded-xl p-4 border', budgetAlertTriggered ? 'bg-gm-status-danger-bg border-red-500/20' : 'bg-gm-surface-secondary border-gm-border-primary')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gm-text-primary flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-gm-interactive-primary" /> Budget
                </span>
                <span className="text-xs text-gm-text-tertiary">
                  ${totalCost.toFixed(2)} / ${budgetLimit.toFixed(2)} USD
                </span>
              </div>
              <div className="w-full h-2.5 bg-gm-surface-secondary rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all',
                  (budgetUsedPercent ?? 0) > 90 ? 'bg-gm-status-danger' :
                  (budgetUsedPercent ?? 0) > 70 ? 'bg-gm-status-warning' : 'bg-gm-interactive-primary')}
                  style={{ width: `${Math.min(budgetUsedPercent ?? 0, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gm-text-tertiary">{(budgetUsedPercent ?? 0).toFixed(1)}% used</span>
                {budgetAlertTriggered && (
                  <span className="text-[10px] text-gm-status-danger flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Budget alert triggered
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard icon={DollarSign} label="Total Cost" value={`$${totalCost.toFixed(4)}`} color="text-green-500" bgColor="bg-green-500/10" />
            <StatCard icon={Zap} label="Input Tokens" value={formatTokens(totalInputTokens)} color="text-gm-interactive-primary" bgColor="bg-blue-600/10" />
            <StatCard icon={Zap} label="Output Tokens" value={formatTokens(totalOutputTokens)} color="text-purple-500" bgColor="bg-purple-500/10" />
            <StatCard icon={BarChart3} label="Models Used" value={String(Object.keys(byModel).length)} color="text-orange-500" bgColor="bg-orange-500/10" />
            <StatCard icon={TrendingUp} label="vs Previous"
              value={percentChange != null ? `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%` : 'N/A'}
              color={percentChange != null ? (percentChange > 0 ? 'text-gm-status-danger' : percentChange < 0 ? 'text-gm-status-success' : 'text-gm-text-tertiary') : 'text-gm-text-tertiary'}
              bgColor={percentChange != null && percentChange > 0 ? 'bg-red-500/10' : percentChange != null && percentChange < 0 ? 'bg-green-500/10' : 'bg-gm-surface-secondary'}
              subIcon={percentChange != null ? (percentChange > 0 ? ArrowUpRight : percentChange < 0 ? ArrowDownRight : Minus) : undefined} />
          </div>

          {/* Daily Chart */}
          {dailyBreakdown.length > 0 && (
            <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Daily Cost Trend
              </h3>
              <div className="flex items-end gap-[2px] h-32">
                {dailyBreakdown.map((d, i) => {
                  const height = Math.max((d.cost / maxDailyCost) * 100, 2);
                  const dayLabel = d.date.split('-').slice(1).join('/');
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute bottom-full mb-1 bg-gm-surface-primary border border-gm-border-primary rounded-lg shadow-lg p-2 text-[10px] hidden group-hover:block z-10 whitespace-nowrap">
                        <p className="font-semibold text-gm-text-primary">{d.date}</p>
                        <p className="text-green-500">${d.cost.toFixed(4)}</p>
                        <p className="text-gm-text-tertiary">{d.calls} calls</p>
                      </div>
                      <div className={cn('w-full rounded-t transition-all hover:opacity-80',
                        d.cost > (budgetLimit ? budgetLimit / (dailyBreakdown.length || 30) : Infinity) ? 'bg-gm-status-warning' : 'bg-gm-interactive-primary')}
                        style={{ height: `${height}%`, minHeight: '2px' }} />
                      {dailyBreakdown.length <= 14 && (
                        <span className="text-[8px] text-gm-text-tertiary mt-1 -rotate-45 origin-top-left">{dayLabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Breakdowns Grid */}
          <div className="grid grid-cols-2 gap-3">
            <BreakdownCard title="By Provider" icon={Layers} data={byProvider} expanded={expandedBreakdown === 'provider'} onToggle={() => setExpandedBreakdown(expandedBreakdown === 'provider' ? null : 'provider')} totalCost={totalCost} />
            <BreakdownCard title="By Model" icon={Cpu} data={byModel} expanded={expandedBreakdown === 'model'} onToggle={() => setExpandedBreakdown(expandedBreakdown === 'model' ? null : 'model')} totalCost={totalCost} />
            <BreakdownCard title="By Operation" icon={Zap} data={byOperation} expanded={expandedBreakdown === 'operation'} onToggle={() => setExpandedBreakdown(expandedBreakdown === 'operation' ? null : 'operation')} totalCost={totalCost} />
            <BreakdownCard title="By Context" icon={FileText} data={byContext} expanded={expandedBreakdown === 'context'} onToggle={() => setExpandedBreakdown(expandedBreakdown === 'context' ? null : 'context')} totalCost={totalCost} />
          </div>

          {/* Recent Requests */}
          <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl">
            <button onClick={() => setShowRecent(!showRecent)} className="w-full flex items-center justify-between p-4 text-left">
              <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Recent LLM Requests
                {recentRequests.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gm-surface-secondary">{recentRequests.length}</span>}
              </h3>
              {showRecent ? <ChevronUp className="w-4 h-4 text-gm-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-gm-text-tertiary" />}
            </button>
            {showRecent && (
              <div className="px-4 pb-4 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gm-text-tertiary" />
                  <input value={recentSearch} onChange={e => setRecentSearch(e.target.value)} placeholder="Search requests..."
                    className="w-full pl-9 pr-3 py-1.5 bg-gm-surface-secondary border border-gm-border-primary rounded-lg text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
                </div>
                {recent.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gm-interactive-primary mx-auto my-4" />
                ) : recentRequests.length === 0 ? (
                  <p className="text-xs text-gm-text-tertiary text-center py-4">No recent requests.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {recentRequests.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 bg-[var(--gm-surface-hover)] rounded-lg p-2.5 group hover:bg-gm-surface-secondary transition-colors">
                        <Cpu className="w-3.5 h-3.5 text-gm-text-tertiary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gm-text-primary truncate">{String(r.model || r.llm_model || '—')}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gm-surface-secondary text-gm-text-tertiary capitalize">{String(r.operation || r.context || '—')}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gm-text-tertiary">
                            <span>{String(r.provider || r.llm_provider || '—')}</span>
                            {r.input_tokens && <span>{Number(r.input_tokens).toLocaleString()} in</span>}
                            {r.output_tokens && <span>{Number(r.output_tokens).toLocaleString()} out</span>}
                            {r.latency_ms && <span>{Number(r.latency_ms)}ms</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-medium text-green-500">${Number(r.cost_usd || r.cost || 0).toFixed(4)}</span>
                          {r.created_at && <p className="text-[10px] text-gm-text-tertiary">{new Date(String(r.created_at)).toLocaleTimeString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex justify-end">
            <button onClick={handleReset} disabled={resetCosts.isPending}
              className="px-3 py-1.5 rounded-lg text-xs text-gm-text-tertiary hover:text-gm-status-danger flex items-center gap-1.5 transition-colors">
              <RefreshCw className={cn('w-3.5 h-3.5', resetCosts.isPending && 'animate-spin')} /> Reset Tracking
            </button>
          </div>
        </>
      )}

      {/* Budget Modal */}
      <BudgetModal open={showBudget} onClose={() => setShowBudget(false)} currentBudget={budgetData} period={period === 'day' || period === 'all' ? 'month' : period} />

      {/* Pricing Modal */}
      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} pricing={((pricing.data as Record<string, unknown>)?.pricing || []) as Array<Record<string, unknown>>} isLoading={pricing.isLoading} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor, subIcon: SubIcon }: {
  icon: typeof DollarSign; label: string; value: string; color: string; bgColor: string; subIcon?: typeof ArrowUpRight;
}) {
  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl px-4 py-3">
      <div className="flex items-center gap-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className={cn('text-lg font-bold', color)}>{value}</span>
            {SubIcon && <SubIcon className={cn('w-3.5 h-3.5', color)} />}
          </div>
          <p className="text-[10px] text-gm-text-tertiary uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({ title, icon: Icon, data, expanded, onToggle, totalCost }: {
  title: string; icon: typeof Layers; data: Record<string, number>; expanded: boolean; onToggle: () => void; totalCost: number;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;

  return (
    <div className="bg-gm-surface-primary border border-gm-border-primary rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--gm-surface-hover)] transition-colors">
        <h3 className="text-xs font-semibold text-gm-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" /> {title}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gm-surface-secondary">{entries.length}</span>
        </h3>
        {expanded ? <ChevronUp className="w-4 h-4 text-gm-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-gm-text-tertiary" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {entries.map(([key, cost]) => {
            const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gm-text-primary truncate mr-2">{key}</span>
                  <span className="font-mono text-green-500 shrink-0">${cost.toFixed(4)}</span>
                </div>
                <div className="w-full h-1.5 bg-gm-surface-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gm-interactive-primary rounded-full transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                </div>
                <span className="text-[10px] text-gm-text-tertiary">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetModal({ open, onClose, currentBudget, period }: {
  open: boolean; onClose: () => void; currentBudget: Record<string, unknown> | null; period: string;
}) {
  const [limitUsd, setLimitUsd] = useState(String(currentBudget?.limit_usd || ''));
  const [alertPercent, setAlertPercent] = useState(String(currentBudget?.alert_threshold_percent || '80'));
  const setBudget = useSetBudget();

  const handleSave = () => {
    const limit = parseFloat(limitUsd);
    if (!limit || limit <= 0) { toast.error('Enter a valid budget limit'); return; }
    setBudget.mutate({ period, limit_usd: limit, alert_threshold_percent: parseInt(alertPercent) || 80 }, {
      onSuccess: () => { toast.success('Budget updated'); onClose(); },
      onError: () => toast.error('Failed to update budget'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base font-semibold text-gm-text-primary">Set Budget</DialogTitle>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Period</label>
            <p className="text-sm text-gm-text-primary capitalize mt-1">{period}</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Budget Limit (USD)</label>
            <input type="number" step="0.01" min="0" value={limitUsd} onChange={e => setLimitUsd(e.target.value)} placeholder="e.g. 50.00"
              className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-sm text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gm-text-tertiary uppercase tracking-wider">Alert Threshold (%)</label>
            <input type="number" min="0" max="100" value={alertPercent} onChange={e => setAlertPercent(e.target.value)} placeholder="80"
              className="mt-1 w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-2 text-sm text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
            <p className="text-[10px] text-gm-text-tertiary mt-1">Alert triggers when spend exceeds this % of the limit</p>
          </div>
          {currentBudget && (
            <div className="bg-gm-surface-secondary rounded-lg p-3">
              <p className="text-[10px] text-gm-text-tertiary">Current budget: ${Number(currentBudget.limit_usd || 0).toFixed(2)} USD ({currentBudget.alert_threshold_percent || 80}% alert)</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gm-surface-secondary text-gm-text-primary text-sm hover:bg-gm-surface-hover border border-gm-border-primary transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={setBudget.isPending}
              className="px-4 py-2 rounded-lg bg-gm-interactive-primary text-gm-text-on-brand text-sm font-medium hover:bg-gm-interactive-primary-hover disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              {setBudget.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} Save Budget
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PricingModal({ open, onClose, pricing, isLoading }: {
  open: boolean; onClose: () => void; pricing: Array<Record<string, unknown>>; isLoading: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = pricing.filter(p => !search || String(p.model || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden max-h-[80vh] flex flex-col">
        <DialogTitle className="text-base font-semibold text-gm-text-primary p-5 pb-0">Model Pricing</DialogTitle>
        <div className="px-5 pt-3 pb-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..."
            className="w-full bg-gm-surface-secondary border border-gm-border-primary rounded-lg px-3 py-1.5 text-xs text-gm-text-primary focus:outline-none focus:ring-2 focus:ring-gm-border-focus" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gm-interactive-primary mx-auto my-8" />
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gm-text-tertiary text-center py-8">No pricing data available.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gm-border-primary text-gm-text-tertiary">
                  <th className="py-2 text-left font-medium">Model</th>
                  <th className="py-2 text-right font-medium">Input / 1M tokens</th>
                  <th className="py-2 text-right font-medium">Output / 1M tokens</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)] transition-colors">
                    <td className="py-2 font-medium text-gm-text-primary">{String(p.model)}</td>
                    <td className="py-2 text-right font-mono text-gm-text-secondary">${Number(p.inputPer1M || 0).toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-gm-text-secondary">${Number(p.outputPer1M || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
