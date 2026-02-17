import { useState, useMemo } from 'react';
import { useHistory } from '../hooks/useGodMode';
import { Clock, Loader2, Download, Search, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

type StatusFilter = '' | 'processed' | 'processing' | 'pending' | 'failed' | 'completed';

export default function HistoryPage() {
  const { data, isLoading } = useHistory();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const items = data ?? [];

  const filtered = useMemo(() => {
    return items.filter(item => {
      const entry = item as Record<string, unknown>;
      if (statusFilter) {
        const status = String(entry.status || '').toLowerCase();
        if (status !== statusFilter) return false;
      }
      if (search) {
        const text = JSON.stringify(entry).toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Processing History</h1>
        <div className="flex gap-2">
          <span className="text-xs text-muted-foreground self-center">{filtered.length} entries</span>
          {filtered.length > 0 && (
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-muted flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-9 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="processed">Processed</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          {items.length === 0 ? 'No processing history yet.' : 'No matches for your filters.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => {
            const entry = item as Record<string, unknown>;
            const status = String(entry.status || 'unknown');
            const statusCls =
              status === 'processed' || status === 'completed' ? 'bg-success/10 text-success' :
              status === 'processing' ? 'bg-primary/10 text-primary' :
              status === 'pending' ? 'bg-warning/10 text-warning' :
              'bg-destructive/10 text-destructive';
            const ts = String(entry.timestamp || entry.changed_at || entry.created_at || entry.processed_at || '');
            const isExpanded = expandedId === i;

            return (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                <div
                  className="p-3.5 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : i)}
                >
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {String(entry.filename || entry.description || entry.operation || entry.table_name || `Entry #${i + 1}`)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.type && <span className="text-[10px] text-muted-foreground capitalize">{String(entry.type)}</span>}
                      {entry.table_name && <span className="text-[10px] text-muted-foreground capitalize">{String(entry.table_name)}</span>}
                      {entry.operation && <span className="text-[10px] text-muted-foreground capitalize">{String(entry.operation)}</span>}
                    </div>
                  </div>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium capitalize', statusCls)}>{status}</span>
                  {ts && <span className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(ts).toLocaleString()}</span>}
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                </div>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t border-border pt-3">
                    <pre className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-3 overflow-x-auto max-h-48">
                      {JSON.stringify(entry, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
