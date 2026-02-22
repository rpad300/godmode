import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { SECTION_TITLE } from './styles';

interface VelocityEntry {
  sprint_name: string;
  completed_points: number;
  completed_tasks: number;
  total_points: number;
  total_tasks: number;
}

interface VelocityChartProps {
  history: VelocityEntry[];
}

export default function VelocityChart({ history }: VelocityChartProps) {
  const data = useMemo(() => {
    if (!history?.length) return [];
    return history.slice(-8);
  }, [history]);

  const avgVelocity = useMemo(() => {
    if (!data.length) return 0;
    return Math.round(data.reduce((s, d) => s + d.completed_points, 0) / data.length);
  }, [data]);

  const maxVal = useMemo(() => Math.max(...data.map(d => Math.max(d.total_points, d.completed_points)), 1), [data]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
        <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">Velocity data builds as you complete sprints</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className={SECTION_TITLE}>Velocity</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">Avg: {avgVelocity} pts/sprint</span>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 100 }}>
        {data.map((d, i) => {
          const totalH = (d.total_points / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div className="w-full flex flex-col items-center justify-end" style={{ height: 80 }}>
                <div className="w-full rounded-t relative overflow-hidden" style={{ height: `${totalH}%`, minHeight: 2 }}>
                  <div className="absolute inset-0 bg-[var(--surface-hover)] rounded-t" />
                  <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-brand-500)]/80 rounded-t transition-all" style={{ height: `${d.total_points > 0 ? (d.completed_points / d.total_points) * 100 : 0}%` }} />
                </div>
              </div>
              <span className="text-[8px] text-[var(--text-tertiary)] truncate max-w-full text-center leading-tight"
                title={d.sprint_name}>
                {d.sprint_name.length > 8 ? d.sprint_name.slice(0, 7) + '\u2026' : d.sprint_name}
              </span>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded px-1.5 py-0.5 text-[8px] text-[var(--text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {d.completed_points}/{d.total_points} pts
              </div>
            </div>
          );
        })}
      </div>
      {avgVelocity > 0 && (
        <div className="mt-2 h-px w-full relative">
          <div className="absolute inset-x-0 border-t border-dashed border-[var(--status-warning)]/30" />
          <span className="absolute right-0 -top-2 text-[8px] text-[var(--status-warning)]/60">avg</span>
        </div>
      )}
    </div>
  );
}
