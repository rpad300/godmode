<<<<<<< HEAD
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Cpu, Cloud, TrendingDown, Activity, Zap, AlertTriangle,
  Server, ArrowDownRight, ArrowUpRight, Filter, Download, PiggyBank, BarChart3, Loader2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  generateCostEntries, aggregateDailyCosts, getModelBreakdown,
  getProviderSummary, getCostSummary, getProjections, type CostEntry
} from '@/data/cost-data';
import { useCosts } from '@/hooks/useGodMode';

const PROVIDER_COLORS: Record<string, string> = {
  'Ollama': 'hsl(142 70% 45%)',
  'OpenAI': 'hsl(200 100% 55%)',
  'Claude': 'hsl(38 92% 55%)',
};

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-success/10 text-success',
  cached: 'bg-info/10 text-info',
  error: 'bg-destructive/10 text-destructive',
};

const CostsPage = () => {
  const { data, isLoading } = useCosts();
  const [periodFilter, setPeriodFilter] = useState('30d');
  const [providerFilter, setProviderFilter] = useState('all');

  const allEntries = useMemo(() => (data?.costs || []) as CostEntry[], [data]);

  const filteredEntries = useMemo(() => {
    let entries = allEntries;
    const now = new Date('2026-02-11');

    if (periodFilter === '7d') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
      entries = entries.filter(e => new Date(e.date) >= cutoff);
    } else if (periodFilter === '14d') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 14);
      entries = entries.filter(e => new Date(e.date) >= cutoff);
    }

    if (providerFilter !== 'all') {
      entries = entries.filter(e => e.provider === providerFilter);
    }

    return entries;
  }, [allEntries, periodFilter, providerFilter]);

  const dailyAggregates = useMemo(() => aggregateDailyCosts(filteredEntries), [filteredEntries]);
  const modelBreakdown = useMemo(() => getModelBreakdown(filteredEntries), [filteredEntries]);
  const providerSummary = useMemo(() => getProviderSummary(filteredEntries), [filteredEntries]);
  const summary = useMemo(() => getCostSummary(filteredEntries), [filteredEntries]);
  const projections = useMemo(() => getProjections(aggregateDailyCosts(allEntries)), [allEntries]);

  const chartData = dailyAggregates.map(d => ({
    ...d,
    dateLabel: d.date.slice(5), // MM-DD
  }));

  const pieData = providerSummary.map(p => ({
    name: p.provider,
    value: p.requests,
    cost: p.cost,
    fill: PROVIDER_COLORS[p.provider] || 'hsl(var(--muted))',
  }));

  return (
    isLoading ? (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    ) :
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">LLM Costs</h1>
            <p className="text-sm text-muted-foreground mt-1">Track and optimize your AI processing spend</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="14d">Last 14 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="Ollama">Ollama</SelectItem>
                <SelectItem value="OpenAI">OpenAI</SelectItem>
                <SelectItem value="Claude">Claude</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Cost', value: `$${summary.totalCost.toFixed(2)}`, icon: DollarSign, color: 'text-primary', sub: `${summary.totalRequests} requests` },
            { label: 'Estimated Savings', value: `$${summary.estimatedSavings.toFixed(2)}`, icon: PiggyBank, color: 'text-success', sub: 'vs all-cloud pricing' },
            { label: 'Local Processing', value: `${summary.localProcessing}%`, icon: Cpu, color: 'text-accent', sub: `${summary.cacheHitRate}% cache hit` },
            { label: 'Total Tokens', value: `${(summary.totalTokens / 1000000).toFixed(1)}M`, icon: Activity, color: 'text-warning', sub: `$${summary.avgCostPerRequest}/req avg` },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color} opacity-70`} />
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-secondary/50 border border-border">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Overview
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Filter className="w-3.5 h-3.5 mr-1.5" />Details
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <TrendingDown className="w-3.5 h-3.5 mr-1.5" />Analytics
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            {/* Cost Trend Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Cost Trend</h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradOpenai" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(200 100% 55%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(200 100% 55%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradClaude" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38 92% 55%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(38 92% 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 15% 22%)" />
                    <XAxis dataKey="dateLabel" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: 'hsl(220 20% 92%)' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="openaiCost" name="OpenAI" stroke="hsl(200 100% 55%)" fill="url(#gradOpenai)" strokeWidth={2} />
                    <Area type="monotone" dataKey="claudeCost" name="Claude" stroke="hsl(38 92% 55%)" fill="url(#gradClaude)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Provider Donut */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Requests by Provider</h2>
                <div className="h-[240px] flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [`${value} requests`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Token Usage Bar */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Daily Token Usage</h2>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 15% 22%)" />
                      <XAxis dataKey="dateLabel" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [`${(value / 1000).toFixed(0)}K tokens`, '']}
                      />
                      <Bar dataKey="totalTokens" name="Tokens" fill="hsl(200 100% 55%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Provider Breakdown Bars */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Cost by Provider</h2>
              <div className="space-y-3">
                {providerSummary.map(p => (
                  <div key={p.provider}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {p.provider === 'Ollama' ? <Server className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                        {p.provider}
                      </span>
                      <span className="font-medium text-foreground font-mono text-xs">
                        {p.cost === 0 ? 'Free (local)' : `$${p.cost.toFixed(2)}`} · {p.percentage}% · {p.requests} req
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${p.percentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: PROVIDER_COLORS[p.provider] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-4">
            {/* Model Breakdown */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Model Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Model</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Requests</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Avg Tokens</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Avg Latency</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelBreakdown.map(m => (
                      <tr key={m.model} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-foreground">{m.model}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: PROVIDER_COLORS[m.provider], color: PROVIDER_COLORS[m.provider] }}>
                            {m.provider}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{m.requests}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">{m.avgTokensPerRequest.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">{m.avgLatency}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-foreground font-mono text-xs">{m.totalCost === 0 ? 'Free' : `$${m.totalCost.toFixed(2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Processing Log */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Processing Log</h2>
                <span className="text-[10px] text-muted-foreground">{filteredEntries.length} entries</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-secondary/80 backdrop-blur-sm">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Model</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Operation</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground uppercase hidden sm:table-cell">Status</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Tokens</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.slice(0, 50).map((entry, i) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-3 py-2 text-muted-foreground text-xs">{entry.date}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                            backgroundColor: `${PROVIDER_COLORS[entry.provider]}15`,
                            color: PROVIDER_COLORS[entry.provider],
                          }}>{entry.provider}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-xs hidden lg:table-cell">{entry.model}</td>
                        <td className="px-3 py-2 text-foreground text-xs hidden md:table-cell">{entry.operation}</td>
                        <td className="px-3 py-2 text-center hidden sm:table-cell">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[entry.status]}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">
                          {(entry.inputTokens + entry.outputTokens).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground font-mono text-xs">
                          {entry.cost === 0 ? 'Free' : `$${entry.cost.toFixed(3)}`}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-4">
            {/* Projections */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-primary" />Cost Projections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projections.map(p => (
                  <div key={p.period} className="bg-secondary/30 rounded-lg p-4 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">{p.period}</p>
                    <p className="text-xl font-bold text-foreground font-mono">${p.projected.toFixed(2)}</p>
                    {p.actual > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Actual: <span className="text-foreground font-mono">${p.actual.toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Savings Highlight */}
            <div className="bg-gradient-to-r from-success/5 to-success/10 border border-success/20 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <PiggyBank className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Local Processing Savings</h3>
                  <p className="text-2xl font-bold text-success font-mono">${summary.estimatedSavings.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    By running {summary.localProcessing}% of requests locally with Ollama, you've saved an estimated
                    ${summary.estimatedSavings.toFixed(2)} compared to using cloud APIs for everything.
                  </p>
                </div>
              </div>
            </div>

            {/* Efficiency Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Avg Cost/Request', value: `$${summary.avgCostPerRequest}`, icon: DollarSign },
                { label: 'Cache Hit Rate', value: `${summary.cacheHitRate}%`, icon: Zap },
                { label: 'Error Rate', value: `${summary.errorRate}%`, icon: AlertTriangle },
                { label: 'Cloud %', value: `${summary.cloudProcessing}%`, icon: Cloud },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-4 text-center"
                >
                  <m.icon className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
                  <p className="text-lg font-bold text-foreground font-mono">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{m.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Daily Requests Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Daily Request Volume</h2>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 15% 22%)" />
                    <XAxis dataKey="dateLabel" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="requests" name="Requests" fill="hsl(165 80% 45%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
};

export default CostsPage;
=======
import { useState } from 'react';
import { DollarSign, Download } from 'lucide-react';
import { useCosts } from '../hooks/useGodMode';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

type Period = 'day' | 'week' | 'month' | 'all';

const periods: { value: Period; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export default function CostsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading } = useCosts(period);

  const totalCost = data?.totalCost ?? data?.total ?? 0;
  const breakdown = data?.breakdown ?? data?.models ?? [];

  const handleExport = () => {
    const exportData = {
      period,
      totalCost,
      breakdown,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godmode-costs-${period}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">LLM Costs</h1>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[hsl(var(--muted-foreground))]">Loading costs...</div>
        </div>
      ) : (
        <>
          {/* Total Cost Card */}
          <div className="rounded-lg border bg-[hsl(var(--card))] p-6 mb-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-3xl font-bold">${Number(totalCost).toFixed(4)}</div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                  Total Cost ({periods.find((p) => p.value === period)?.label})
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          {breakdown.length > 0 ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <h2 className="text-lg font-semibold mb-4">Cost Breakdown by Model</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                    <th className="py-2 font-medium">Model</th>
                    <th className="py-2 font-medium text-right">Requests</th>
                    <th className="py-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((item, i) => (
                    <tr key={i} className={cn('border-b last:border-0', 'hover:bg-[hsl(var(--accent))]')}>
                      <td className="py-2">{item.model ?? item.name ?? 'Unknown'}</td>
                      <td className="py-2 text-right font-mono">
                        {item.requests != null ? item.requests.toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-right font-mono">${Number(item.cost ?? 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              No cost data for this period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
>>>>>>> origin/claude/migrate-to-react-uJJbl
