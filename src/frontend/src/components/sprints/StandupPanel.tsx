import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, User, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useSprintStandup } from '../../hooks/useGodMode';
import type { SprintStandup, StandupEntry } from '@/types/godmode';
import { CARD_FLAT, SECTION_TITLE } from './styles';

interface StandupPanelProps {
  sprintId: string;
}

export default function StandupPanel({ sprintId }: StandupPanelProps) {
  const standupMut = useSprintStandup();
  const [standup, setStandup] = useState<SprintStandup | null>(null);

  const handleGenerate = () => {
    standupMut.mutate(sprintId, {
      onSuccess: (d: any) => {
        setStandup(d as SprintStandup);
        toast.success('Standup generated');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={SECTION_TITLE}>Daily Standup</span>
        <button onClick={handleGenerate} disabled={standupMut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50">
          {standupMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Standup
        </button>
      </div>

      {standup && (
        <>
          <p className="text-[10px] text-[var(--text-tertiary)]">{standup.date}</p>

          {standup.ai_summary && (
            <div className={cn(CARD_FLAT, 'p-3')}>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">AI Summary</span>
              <p className="mt-1 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{standup.ai_summary}</p>
            </div>
          )}

          <div className="space-y-2">
            {(standup.entries || []).map((entry, i) => (
              <div key={i} className={cn(CARD_FLAT, 'p-3')}>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span className="text-xs font-medium text-[var(--text-primary)]">{entry.person}</span>
                </div>
                <div className="space-y-1.5 pl-5">
                  {entry.done.length > 0 && (
                    <div>
                      <span className="text-[9px] text-[var(--status-success)] uppercase tracking-wider font-medium">Done</span>
                      {entry.done.map((d, j) => (
                        <div key={j} className="flex items-start gap-1.5 mt-0.5">
                          <CheckCircle className="w-3 h-3 text-[var(--status-success)] shrink-0 mt-0.5" />
                          <span className="text-[11px] text-[var(--text-secondary)]">{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.doing.length > 0 && (
                    <div>
                      <span className="text-[9px] text-[var(--accent-primary)] uppercase tracking-wider font-medium">Doing</span>
                      {entry.doing.map((d, j) => (
                        <div key={j} className="flex items-start gap-1.5 mt-0.5">
                          <ArrowRight className="w-3 h-3 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                          <span className="text-[11px] text-[var(--text-secondary)]">{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.blockers.length > 0 && (
                    <div>
                      <span className="text-[9px] text-[var(--status-danger)] uppercase tracking-wider font-medium">Blockers</span>
                      {entry.blockers.map((d, j) => (
                        <div key={j} className="flex items-start gap-1.5 mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-[var(--status-danger)] shrink-0 mt-0.5" />
                          <span className="text-[11px] text-[var(--text-secondary)]">{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.done.length === 0 && entry.doing.length === 0 && entry.blockers.length === 0 && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">No updates</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!standup && !standupMut.isPending && (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-4">Click "Generate Standup" to get today's team summary</p>
      )}
    </div>
  );
}
