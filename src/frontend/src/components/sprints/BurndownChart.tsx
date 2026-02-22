import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { SECTION_TITLE } from './styles';

interface DailyPoint {
  date: string;
  remaining_tasks: number;
  remaining_points: number;
  completed_tasks: number;
  completed_points: number;
}

interface BurndownChartProps {
  dailyProgress: DailyPoint[];
  totalTasks: number;
  totalPoints: number;
  usePoints?: boolean;
}

export default function BurndownChart({ dailyProgress, totalTasks, totalPoints, usePoints = false }: BurndownChartProps) {
  const total = usePoints ? totalPoints : totalTasks;
  const data = useMemo(() => {
    if (!dailyProgress?.length) return [];
    return dailyProgress.map((d, i) => ({
      ...d,
      remaining: usePoints ? d.remaining_points : d.remaining_tasks,
      idealRemaining: total - (total / (dailyProgress.length - 1)) * i,
    }));
  }, [dailyProgress, total, usePoints]);

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
        <Activity className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">Burndown data will appear as tasks are completed</p>
      </div>
    );
  }

  const maxVal = Math.max(total, ...data.map(d => d.remaining));
  const chartH = 160;
  const chartW = 100;

  const toX = (i: number) => (i / (data.length - 1)) * chartW;
  const toY = (v: number) => chartH - (v / (maxVal || 1)) * chartH;

  const actualPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.remaining).toFixed(1)}`).join(' ');
  const idealPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.idealRemaining).toFixed(1)}`).join(' ');
  const areaPath = actualPath + ` L${chartW},${chartH} L0,${chartH} Z`;

  const todayIdx = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const idx = data.findIndex(d => d.date >= today);
    return idx >= 0 ? idx : data.length - 1;
  })();

  const labels = useMemo(() => {
    if (data.length <= 7) return data.map(d => d.date.slice(5));
    const step = Math.ceil(data.length / 6);
    return data.map((d, i) => i % step === 0 || i === data.length - 1 ? d.date.slice(5) : '');
  }, [data]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={SECTION_TITLE}>
          Burndown ({usePoints ? 'Points' : 'Tasks'})
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {data[todayIdx]?.remaining ?? 0} remaining of {total}
        </span>
      </div>
      <div className="relative" style={{ paddingBottom: '45%' }}>
        <svg viewBox={`-4 -4 ${chartW + 8} ${chartH + 24}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1="0" y1={toY(maxVal * f)} x2={chartW} y2={toY(maxVal * f)}
              stroke="var(--surface-hover)" strokeWidth="0.3" />
          ))}
          <path d={areaPath} fill="rgba(59,130,246,0.08)" />
          <path d={idealPath} fill="none" stroke="var(--border-secondary)" strokeWidth="0.5" strokeDasharray="2,2" />
          <path d={actualPath} fill="none" stroke="var(--color-brand-500, #3b82f6)" strokeWidth="1" strokeLinejoin="round" />
          {todayIdx < data.length && (
            <line x1={toX(todayIdx)} y1="0" x2={toX(todayIdx)} y2={chartH}
              stroke="rgba(250,204,21,0.3)" strokeWidth="0.5" strokeDasharray="1.5,1.5" />
          )}
          <circle cx={toX(todayIdx)} cy={toY(data[todayIdx]?.remaining ?? 0)} r="2" fill="var(--color-brand-500, #3b82f6)" />
          {labels.map((label, i) => label ? (
            <text key={i} x={toX(i)} y={chartH + 10} textAnchor="middle"
              className="fill-[var(--text-tertiary)]" fontSize="3.5">{label}</text>
          ) : null)}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-1 justify-center">
        <span className="flex items-center gap-1 text-[9px] text-[var(--text-tertiary)]">
          <span className="w-3 h-0.5 bg-[var(--color-brand-500)] rounded" /> Actual
        </span>
        <span className="flex items-center gap-1 text-[9px] text-[var(--text-tertiary)]">
          <span className="w-3 h-0.5 bg-[var(--border-secondary)] rounded border-dashed" /> Ideal
        </span>
      </div>
    </div>
  );
}
