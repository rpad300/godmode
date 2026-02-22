import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useSprintEstimatePoints } from '../../hooks/useGodMode';

interface EstimatePointsButtonProps {
  sprintId: string;
  taskDescription: string;
  onEstimate?: (points: number) => void;
  className?: string;
}

export default function EstimatePointsButton({ sprintId, taskDescription, onEstimate, className }: EstimatePointsButtonProps) {
  const estimateMut = useSprintEstimatePoints();
  const [result, setResult] = useState<{ points: number; confidence: string; reasoning: string } | null>(null);

  const handleEstimate = () => {
    if (!taskDescription.trim()) { toast.error('Task description needed'); return; }
    estimateMut.mutate({ sprintId, task: taskDescription }, {
      onSuccess: (d: any) => {
        setResult(d);
        onEstimate?.(d.points);
        toast.success(`Estimated: ${d.points} points (${d.confidence} confidence)`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const confColor = result?.confidence === 'high'
    ? 'text-[var(--status-success)]'
    : result?.confidence === 'medium'
      ? 'text-[var(--status-warning)]'
      : 'text-orange-400';

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button onClick={handleEstimate} disabled={estimateMut.isPending}
        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
        title="AI estimate story points">
        {estimateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        Estimate
      </button>
      {result && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-[var(--accent-primary)] tabular-nums">{result.points} pts</span>
          <span className={cn('text-[9px]', confColor)}>({result.confidence})</span>
          {result.reasoning && (
            <span className="text-[9px] text-[var(--text-tertiary)] max-w-[200px] truncate" title={result.reasoning}>
              {result.reasoning}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
