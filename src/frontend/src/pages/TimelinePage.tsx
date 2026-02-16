import { useHistory } from '../hooks/useGodMode';
import { Calendar } from 'lucide-react';

export default function TimelinePage() {
  const { data, isLoading } = useHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading timeline...</div>
      </div>
    );
  }

  const items = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Timeline</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          No timeline events yet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 rounded-lg border bg-[hsl(var(--card))] p-4">
              <Calendar className="h-5 w-5 text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm">{String((item as Record<string, unknown>).description ?? (item as Record<string, unknown>).content ?? '')}</p>
                {(item as Record<string, unknown>).timestamp && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    {new Date(String((item as Record<string, unknown>).timestamp)).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
