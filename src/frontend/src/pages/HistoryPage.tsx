<<<<<<< HEAD
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Download, Clock, Loader2 } from 'lucide-react';
import { useProjectActivity } from '@/hooks/useGodMode';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  // Default fallback
  info: { icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
};

const HistoryPage = () => {
  const { data: history = [], isLoading } = useProjectActivity();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
=======
import { useHistory } from '../hooks/useGodMode';
import { Clock } from 'lucide-react';

export default function HistoryPage() {
  const { data, isLoading } = useHistory();
  const items = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading history...</div>
>>>>>>> origin/claude/migrate-to-react-uJJbl
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Processing History</h1>
        <button className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      <div className="space-y-2">
        {history.map((entry: any, i: number) => {
          const status = entry.status && statusConfig[entry.status] ? entry.status : 'info';
          const { icon: StatusIcon, color, bg } = statusConfig[status];
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <StatusIcon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{entry.action}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${bg} ${color}`}>{entry.status || 'Info'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-xs text-muted-foreground">
                  <span>{entry.timestamp}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{entry.duration}</span>
                  {entry.factsFound > 0 && <span className="text-primary">{entry.factsFound} facts</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
        {history.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No activity history for this project.
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
=======
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
>>>>>>> origin/claude/migrate-to-react-uJJbl
