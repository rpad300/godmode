import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, X, Loader2, Sparkles, ThumbsUp, ThumbsDown, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { useSprintRetrospective } from '../../hooks/useGodMode';
import { CARD_FLAT, INPUT, SECTION_TITLE } from './styles';

interface RetrospectivePanelProps {
  sprintId: string;
}

function EditableList({ items, onAdd, onRemove, placeholder, color }: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  color: string;
}) {
  const [input, setInput] = useState('');
  const handleAdd = () => {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput('');
  };
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', color)} />
          <span className="text-xs text-[var(--text-secondary)] flex-1">{item}</span>
          <button onClick={() => onRemove(i)} className="text-[var(--text-tertiary)] hover:text-[var(--status-danger)] opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className={cn(INPUT, 'w-full')} placeholder={placeholder} />
        <button onClick={handleAdd} className="shrink-0 w-7 h-7 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        </button>
      </div>
    </div>
  );
}

export default function RetrospectivePanel({ sprintId }: RetrospectivePanelProps) {
  const retroMut = useSprintRetrospective();
  const [wentWell, setWentWell] = useState<string[]>([]);
  const [wentWrong, setWentWrong] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState('');

  const handleGenerate = () => {
    retroMut.mutate({ sprintId, went_well: wentWell, went_wrong: wentWrong, action_items: actionItems }, {
      onSuccess: (d: any) => {
        setAiSuggestions(d?.ai_suggestions || '');
        toast.success('Retrospective generated');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={SECTION_TITLE}>Sprint Retrospective</span>
        <button onClick={handleGenerate} disabled={retroMut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50">
          {retroMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI Insights
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={cn(CARD_FLAT, 'p-3')}>
          <div className="flex items-center gap-1.5 mb-2">
            <ThumbsUp className="w-3.5 h-3.5 text-[var(--status-success)]" />
            <span className="text-xs font-medium text-[var(--status-success)]">What Went Well</span>
          </div>
          <EditableList
            items={wentWell}
            onAdd={item => setWentWell(prev => [...prev, item])}
            onRemove={idx => setWentWell(prev => prev.filter((_, i) => i !== idx))}
            placeholder="Add positive..."
            color="bg-[var(--status-success)]"
          />
        </div>

        <div className={cn(CARD_FLAT, 'p-3')}>
          <div className="flex items-center gap-1.5 mb-2">
            <ThumbsDown className="w-3.5 h-3.5 text-[var(--status-danger)]" />
            <span className="text-xs font-medium text-[var(--status-danger)]">What Needs Improvement</span>
          </div>
          <EditableList
            items={wentWrong}
            onAdd={item => setWentWrong(prev => [...prev, item])}
            onRemove={idx => setWentWrong(prev => prev.filter((_, i) => i !== idx))}
            placeholder="Add improvement..."
            color="bg-[var(--status-danger)]"
          />
        </div>

        <div className={cn(CARD_FLAT, 'p-3')}>
          <div className="flex items-center gap-1.5 mb-2">
            <ListChecks className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="text-xs font-medium text-[var(--accent-primary)]">Action Items</span>
          </div>
          <EditableList
            items={actionItems}
            onAdd={item => setActionItems(prev => [...prev, item])}
            onRemove={idx => setActionItems(prev => prev.filter((_, i) => i !== idx))}
            placeholder="Add action item..."
            color="bg-[var(--accent-primary)]"
          />
        </div>
      </div>

      {aiSuggestions && (
        <div className={cn(CARD_FLAT, 'p-4')}>
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.1em]">AI Insights</span>
          <div className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{aiSuggestions}</div>
        </div>
      )}
    </div>
  );
}
