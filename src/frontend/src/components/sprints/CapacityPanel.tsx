import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Plus, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useSprintCapacity } from '../../hooks/useGodMode';
import type { SprintCapacity, Action } from '@/types/godmode';
import { CARD_FLAT, INPUT, SECTION_TITLE } from './styles';

interface CapacityPanelProps {
  sprintId: string;
  actions: Action[];
}

export default function CapacityPanel({ sprintId, actions }: CapacityPanelProps) {
  const capacityMut = useSprintCapacity();
  const [capacities, setCapacities] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ capacity: SprintCapacity[]; ai_recommendation: string | null } | null>(null);
  const [newPerson, setNewPerson] = useState('');
  const [newPoints, setNewPoints] = useState('');

  const owners = useMemo(() => {
    const set = new Set<string>();
    actions.forEach(a => { if (a.owner?.trim()) set.add(a.owner.trim()); });
    Object.keys(capacities).forEach(k => set.add(k));
    return Array.from(set).sort();
  }, [actions, capacities]);

  const addPerson = () => {
    if (!newPerson.trim() || !newPoints) return;
    setCapacities(prev => ({ ...prev, [newPerson.trim()]: Number(newPoints) || 0 }));
    setNewPerson('');
    setNewPoints('');
  };

  const handleAnalyze = () => {
    if (Object.keys(capacities).length === 0) {
      toast.error('Set capacity for at least one person');
      return;
    }
    capacityMut.mutate({ sprintId, capacities }, {
      onSuccess: (d: any) => {
        setResult(d);
        toast.success('Capacity analysis complete');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={SECTION_TITLE}>Capacity Planning</span>
        <button onClick={handleAnalyze} disabled={capacityMut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50">
          {capacityMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Analyze Capacity
        </button>
      </div>

      <div className={cn(CARD_FLAT, 'p-3 space-y-2')}>
        <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Team Capacity (points per sprint)</span>
        {owners.map(person => (
          <div key={person} className="flex items-center gap-2">
            <Users className="w-3 h-3 text-[var(--text-tertiary)]" />
            <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{person}</span>
            <input
              type="number" min="0"
              value={capacities[person] ?? ''}
              onChange={e => setCapacities(prev => ({ ...prev, [person]: Number(e.target.value) || 0 }))}
              placeholder="pts"
              className={cn(INPUT, 'w-16 text-center')}
            />
            {capacities[person] !== undefined && (
              <button onClick={() => setCapacities(prev => { const n = { ...prev }; delete n[person]; return n; })}
                className="text-[var(--text-tertiary)] hover:text-[var(--status-danger)]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <input value={newPerson} onChange={e => setNewPerson(e.target.value)} placeholder="Name" className={cn(INPUT, 'flex-1')} />
          <input type="number" min="0" value={newPoints} onChange={e => setNewPoints(e.target.value)} placeholder="pts"
            className={cn(INPUT, 'w-16 text-center')} onKeyDown={e => e.key === 'Enter' && addPerson()} />
          <button onClick={addPerson} className="w-7 h-7 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </button>
        </div>
      </div>

      {result && (
        <>
          <div className="space-y-2">
            {result.capacity.map(c => {
              const pct = c.utilization;
              const barColor = c.over_allocated ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e';
              const barWidth = Math.min(100, pct);
              return (
                <div key={c.person} className={cn(CARD_FLAT, 'p-3')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--text-primary)]">{c.person}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: barColor }}>
                      {c.assigned_points}/{c.available_points} pts ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                  </div>
                  {c.over_allocated && (
                    <p className="text-[9px] text-[var(--status-danger)] mt-1">Over-allocated by {c.assigned_points - c.available_points} points</p>
                  )}
                </div>
              );
            })}
          </div>

          {result.ai_recommendation && (
            <div className={cn(CARD_FLAT, 'p-4')}>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">AI Recommendation</span>
              <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{result.ai_recommendation}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
