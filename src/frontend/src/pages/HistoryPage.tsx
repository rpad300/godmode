import { useHistory } from '../hooks/useGodMode';
import { Clock } from 'lucide-react';

export default function HistoryPage() {
  const { data, isLoading } = useHistory();
  const items = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading history...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Processing History</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          <Clock className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
          No processing history yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const entry = item as Record<string, unknown>;
            return (
              <div key={i} className="rounded-lg border bg-[hsl(var(--card))] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {String(entry.filename ?? entry.description ?? `Processing #${i + 1}`)}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {entry.timestamp ? new Date(String(entry.timestamp)).toLocaleString() : ''}
                  </span>
                </div>
                {entry.status && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {String(entry.status)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
