import { useCosts } from '../hooks/useGodMode';
import { DollarSign } from 'lucide-react';

export default function CostsPage() {
  const { data, isLoading } = useCosts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading costs...</div>
      </div>
    );
  }

  const costData = (data ?? {}) as Record<string, unknown>;
  const totalCost = costData.totalCost ?? costData.total ?? 0;
  const breakdown = (costData.breakdown ?? costData.models ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">LLM Costs</h1>

      <div className="rounded-lg border bg-[hsl(var(--card))] p-6 mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-green-500" />
          <div>
            <div className="text-3xl font-bold">${Number(totalCost).toFixed(4)}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Cost</div>
          </div>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
          <h2 className="text-lg font-semibold mb-4">Cost Breakdown</h2>
          <div className="space-y-2">
            {breakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <span>{String(item.model ?? item.name ?? 'Unknown')}</span>
                <span className="font-mono">${Number(item.cost ?? 0).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
