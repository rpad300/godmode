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
