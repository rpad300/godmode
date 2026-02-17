import { useState, useMemo } from 'react';
import { useHistory } from '../hooks/useGodMode';
import {
  Calendar, Filter, Loader2, FileText, HelpCircle, ShieldAlert,
  Lightbulb, CheckSquare, GitCommit,
} from 'lucide-react';
import { cn } from '../lib/utils';

type EntityType = '' | 'question' | 'fact' | 'decision' | 'risk' | 'action' | 'document' | 'contact' | 'email';

const entityConfig: Record<string, { icon: typeof Calendar; color: string; label: string }> = {
  question: { icon: HelpCircle, color: 'text-blue-500 bg-blue-500/10', label: 'Question' },
  fact: { icon: Lightbulb, color: 'text-amber-500 bg-amber-500/10', label: 'Fact' },
  decision: { icon: GitCommit, color: 'text-purple-500 bg-purple-500/10', label: 'Decision' },
  risk: { icon: ShieldAlert, color: 'text-red-500 bg-red-500/10', label: 'Risk' },
  action: { icon: CheckSquare, color: 'text-green-500 bg-green-500/10', label: 'Action' },
  document: { icon: FileText, color: 'text-cyan-500 bg-cyan-500/10', label: 'Document' },
  contact: { icon: Calendar, color: 'text-pink-500 bg-pink-500/10', label: 'Contact' },
  email: { icon: Calendar, color: 'text-orange-500 bg-orange-500/10', label: 'Email' },
};

export default function TimelinePage() {
  const { data, isLoading } = useHistory();
  const [typeFilter, setTypeFilter] = useState<EntityType>('');

  const items = data ?? [];

  const filtered = useMemo(() => {
    if (!typeFilter) return items;
    return items.filter(item => {
      const entry = item as Record<string, unknown>;
      const type = String(entry.entity_type || entry.type || entry.table_name || '').toLowerCase();
      return type.includes(typeFilter);
    });
  }, [items, typeFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(item => {
      const entry = item as Record<string, unknown>;
      const ts = String(entry.timestamp || entry.changed_at || entry.created_at || '');
      const dateKey = ts ? new Date(ts).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown Date';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [filtered]);

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
        <h1 className="text-2xl font-bold text-foreground">Timeline</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} events</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {(['', 'question', 'fact', 'decision', 'risk', 'action', 'document'] as EntityType[]).map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors border',
              typeFilter === type
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {type ? (entityConfig[type]?.label || type) : 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          No timeline events{typeFilter ? ` for "${typeFilter}"` : ''}.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateKey, events]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{dateKey}</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2 ml-4 border-l-2 border-border pl-4">
                {events.map((item, i) => {
                  const entry = item as Record<string, unknown>;
                  const type = String(entry.entity_type || entry.type || entry.table_name || '').toLowerCase();
                  const conf = entityConfig[type] || { icon: Calendar, color: 'text-muted-foreground bg-secondary', label: type || 'Event' };
                  const Icon = conf.icon;
                  const ts = String(entry.timestamp || entry.changed_at || entry.created_at || '');
                  const operation = String(entry.operation || entry.action || '');

                  return (
                    <div key={i} className="bg-card border border-border rounded-xl p-3.5 flex items-start gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', conf.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{conf.label}</span>
                          {operation && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{operation}</span>}
                        </div>
                        <p className="text-sm text-foreground mt-1">
                          {String(entry.description || entry.content || entry.title || entry.filename || `${conf.label} ${operation || 'event'}`)}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {ts && <span className="text-[10px] text-muted-foreground">{new Date(ts).toLocaleTimeString()}</span>}
                          {entry.changed_by_email && <span className="text-[10px] text-muted-foreground">{String(entry.changed_by_email)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
