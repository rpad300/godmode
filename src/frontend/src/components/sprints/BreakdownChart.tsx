import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { SECTION_TITLE, STATUS_COLORS, ASSIGNEE_PALETTE } from './styles';

interface BarItem {
  label: string;
  value: number;
  color: string;
}

interface BreakdownChartProps {
  title: string;
  data: Record<string, number>;
  colorMap?: Record<string, string>;
}

export default function BreakdownChart({ title, data, colorMap }: BreakdownChartProps) {
  const bars = useMemo<BarItem[]>(() => {
    const entries = Object.entries(data).filter(([, v]) => v > 0);
    if (entries.length === 0) return [];
    return entries.map(([label, value], i) => ({
      label,
      value,
      color: colorMap?.[label] || STATUS_COLORS[label] || ASSIGNEE_PALETTE[i % ASSIGNEE_PALETTE.length],
    }));
  }, [data, colorMap]);

  const maxVal = useMemo(() => Math.max(...bars.map(b => b.value), 1), [bars]);
  const total = useMemo(() => bars.reduce((s, b) => s + b.value, 0), [bars]);

  if (bars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[var(--text-tertiary)]">
        <BarChart3 className="w-6 h-6 mb-1.5 opacity-40" />
        <p className="text-[10px]">No data available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className={SECTION_TITLE}>{title}</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{total} total</span>
      </div>
      <div className="space-y-2">
        {bars.map(bar => {
          const pct = Math.round((bar.value / maxVal) * 100);
          const sharePct = Math.round((bar.value / total) * 100);
          return (
            <div key={bar.label} className="group">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-[var(--text-secondary)] capitalize truncate max-w-[60%]">
                  {bar.label.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                  {bar.value} ({sharePct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: bar.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
