import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, AlertCircle, XCircle, Activity } from 'lucide-react';
import type { SprintHealthScore } from '@/types/godmode';
import { SECTION_TITLE } from './styles';

interface HealthScoreWidgetProps {
  health: SprintHealthScore | null | undefined;
  isLoading?: boolean;
  compact?: boolean;
}

const riskConfig = {
  low: { color: 'text-[var(--status-success)]', bg: 'bg-[var(--status-success-bg)]', border: 'border-[var(--status-success)]/30', icon: CheckCircle, label: 'Healthy' },
  medium: { color: 'text-[var(--status-warning)]', bg: 'bg-[var(--status-warning-bg)]', border: 'border-[var(--status-warning)]/30', icon: AlertTriangle, label: 'At Risk' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertCircle, label: 'High Risk' },
  critical: { color: 'text-[var(--status-danger)]', bg: 'bg-[var(--status-danger-bg)]', border: 'border-[var(--status-danger)]/30', icon: XCircle, label: 'Critical' },
};

const factorLabels: Record<string, string> = {
  completion_rate: 'Completion',
  time_progress: 'Time Elapsed',
  velocity_trend: 'Velocity',
  overdue_ratio: 'On-time',
  distribution_balance: 'Balance',
};

function ScoreRing({ score, size = 64, strokeWidth = 5, color }: { score: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-hover)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700 ease-out" />
    </svg>
  );
}

export default function HealthScoreWidget({ health, isLoading, compact }: HealthScoreWidgetProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Activity className="w-5 h-5 text-[var(--text-tertiary)] animate-pulse" />
      </div>
    );
  }

  if (!health) return null;

  const cfg = riskConfig[health.risk_level] || riskConfig.medium;
  const RiskIcon = cfg.icon;
  const scoreColor = health.score >= 75 ? '#22c55e' : health.score >= 50 ? '#eab308' : health.score >= 25 ? '#f97316' : '#ef4444';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border', cfg.bg, cfg.border)}>
        <div className="relative w-8 h-8">
          <ScoreRing score={health.score} size={32} strokeWidth={3} color={scoreColor} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: scoreColor }}>
            {health.score}
          </span>
        </div>
        <div>
          <span className={cn('text-[10px] font-medium', cfg.color)}>{cfg.label}</span>
          {health.alerts.length > 0 && (
            <p className="text-[9px] text-[var(--text-tertiary)] truncate max-w-[140px]">{health.alerts[0]}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={SECTION_TITLE}>Sprint Health</span>
        <div className={cn('flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>
          <RiskIcon className="w-3 h-3" /> {cfg.label}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <ScoreRing score={health.score} size={64} strokeWidth={5} color={scoreColor} />
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: scoreColor }}>
            {health.score}
          </span>
        </div>
        <div className="flex-1 space-y-1.5">
          {Object.entries(health.factors).map(([key, val]) => {
            const isInverse = key === 'overdue_ratio';
            const displayVal = isInverse ? 100 - val : val;
            const barColor = displayVal >= 70 ? '#22c55e' : displayVal >= 40 ? '#eab308' : '#ef4444';
            return (
              <div key={key}>
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span className="text-[var(--text-tertiary)]">{factorLabels[key] || key}</span>
                  <span className="text-[var(--text-secondary)] tabular-nums">{displayVal}%</span>
                </div>
                <div className="h-1 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${displayVal}%`, backgroundColor: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {health.alerts.length > 0 && (
        <div className="space-y-1">
          {health.alerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-[var(--status-warning)]">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
