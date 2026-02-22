import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { GanttChartSquare } from 'lucide-react';
import type { Action } from '@/types/godmode';
import { SECTION_TITLE, STATUS_COLORS } from './styles';

interface GanttChartProps {
  actions: Action[];
  sprintStart: string;
  sprintEnd: string;
}

const statusColor = (s: string) => STATUS_COLORS[s] || STATUS_COLORS.pending;

export default function GanttChart({ actions, sprintStart, sprintEnd }: GanttChartProps) {
  const data = useMemo(() => {
    const start = new Date(sprintStart).getTime();
    const end = new Date(sprintEnd).getTime();
    const range = Math.max(1, end - start);

    return actions.slice(0, 20).map(a => {
      const taskStart = a.created_at ? new Date(a.created_at).getTime() : start;
      const taskEnd = a.deadline ? new Date(a.deadline).getTime() : end;
      const left = Math.max(0, Math.min(100, ((taskStart - start) / range) * 100));
      const width = Math.max(2, Math.min(100 - left, ((taskEnd - taskStart) / range) * 100));
      const hasDeps = (a.depends_on?.length ?? 0) > 0;
      return { action: a, left, width, hasDeps };
    });
  }, [actions, sprintStart, sprintEnd]);

  const today = useMemo(() => {
    const start = new Date(sprintStart).getTime();
    const end = new Date(sprintEnd).getTime();
    const now = Date.now();
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }, [sprintStart, sprintEnd]);

  const dateLabels = useMemo(() => {
    const start = new Date(sprintStart);
    const end = new Date(sprintEnd);
    const range = (end.getTime() - start.getTime()) / 86400000;
    const step = Math.max(1, Math.ceil(range / 6));
    const labels: { label: string; pct: number }[] = [];
    for (let i = 0; i <= range; i += step) {
      const d = new Date(start.getTime() + i * 86400000);
      labels.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, pct: (i / range) * 100 });
    }
    return labels;
  }, [sprintStart, sprintEnd]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
        <GanttChartSquare className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">No tasks to display on the timeline</p>
      </div>
    );
  }

  return (
    <div>
      <span className={cn(SECTION_TITLE, 'block mb-3')}>Timeline</span>

      <div className="relative h-5 mb-1">
        {dateLabels.map((d, i) => (
          <span key={i} className="absolute text-[8px] text-[var(--text-tertiary)] -translate-x-1/2" style={{ left: `${d.pct}%` }}>
            {d.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="absolute top-0 bottom-0 w-px bg-[var(--status-warning)]/30 z-10" style={{ left: `${today}%` }} />

        <div className="space-y-1">
          {data.map(({ action, left, width, hasDeps }) => (
            <div key={action.id} className="flex items-center gap-2 group h-7">
              <div className="w-24 shrink-0 truncate text-[10px] text-[var(--text-secondary)] pr-1" title={action.task || action.title}>
                {(action.task || action.title || '').slice(0, 18)}{(action.task || '').length > 18 ? '\u2026' : ''}
              </div>
              <div className="flex-1 relative h-full">
                <div className="absolute inset-0 bg-[var(--surface-secondary)] rounded" />
                <div
                  className={cn(
                    'absolute h-4 top-1.5 rounded-sm transition-all cursor-default',
                    hasDeps && 'ring-1 ring-purple-500/40'
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: statusColor(action.status),
                    opacity: action.status === 'completed' ? 0.6 : 0.8,
                  }}
                  title={`${action.task || action.title} (${action.status})${action.owner ? ` \u2014 ${action.owner}` : ''}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 justify-center">
        {[
          { label: 'Pending', key: 'pending' },
          { label: 'In Progress', key: 'in_progress' },
          { label: 'Completed', key: 'completed' },
          { label: 'Overdue', key: 'overdue' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-[8px] text-[var(--text-tertiary)]">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[l.key] }} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
