import { useState } from 'react';
import { ArrowLeft, Edit2, Calendar, User, Flag, Clock, BookOpen, Target, Sparkles, Wand2, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { Action } from '@/types/godmode';
import { useSotChat } from '../../hooks/useGodMode';
import OwnerBadge from './OwnerBadge';

const statusColor = (s: string) =>
  s === 'completed' ? 'bg-success/10 text-success' :
    s === 'overdue' ? 'bg-destructive/10 text-destructive' :
      s === 'in_progress' ? 'bg-primary/10 text-primary' :
        'bg-muted text-[var(--gm-text-tertiary)]';

const priorityColor = (p: string) =>
  p === 'high' ? 'bg-destructive/10 text-destructive' :
    p === 'medium' ? 'bg-warning/10 text-warning' :
      'bg-muted text-[var(--gm-text-tertiary)]';

interface ActionDetailViewProps {
  action: Action;
  onBack: () => void;
  onEdit: (action: Action) => void;
  onDelete?: (id: string) => void;
}

const ActionDetailView = ({ action, onBack, onEdit, onDelete }: ActionDetailViewProps) => {
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const chatMut = useSotChat();

  const handleAiAnalyze = async () => {
    setAiLoading('analyze');
    chatMut.mutate({ message: `Analyze this action item and provide insights on urgency, dependencies, and risks:\nTitle: "${action.title}"\nDescription: "${action.description}"\nStatus: ${action.status}\nPriority: ${action.priority}\nOwner: ${action.owner || 'unassigned'}\nDeadline: ${action.deadline || 'none'}\nSprint: ${action.sprintId || 'none'}` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setAiInsights(resp.split('\n').filter(l => l.trim()));
        setAiLoading(null);
        toast.success('AI analysis complete');
      },
      onError: () => { setAiLoading(null); toast.error('AI analysis failed'); },
    });
  };

  const handleAiSuggestNextSteps = async () => {
    setAiLoading('steps');
    chatMut.mutate({ message: `Suggest 3 concrete next steps for this action:\nTitle: "${action.title}"\nDescription: "${action.description}"\nStatus: ${action.status}\nReturn each step on a new line.` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setAiInsights(prev => [...prev, ...resp.split('\n').filter(l => l.trim())]);
        setAiLoading(null);
        toast.success('AI suggested next steps');
      },
      onError: () => { setAiLoading(null); toast.error('AI suggestion failed'); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-[var(--gm-interactive-secondary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]"><ArrowLeft className="w-4 h-4 text-[var(--gm-text-tertiary)]" /></button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[var(--gm-text-primary)]">{action.title || action.task || action.content || '(untitled action)'}</h2>
          <p className="text-xs text-[var(--gm-text-tertiary)]">Action #{action.id}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAiAnalyze} disabled={!!aiLoading} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 flex items-center gap-1.5 disabled:opacity-50">
            {aiLoading === 'analyze' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Analyze
          </button>
          <button onClick={handleAiSuggestNextSteps} disabled={!!aiLoading} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 flex items-center gap-1.5 disabled:opacity-50">
            {aiLoading === 'steps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Suggest Steps
          </button>
          <button onClick={() => onEdit(action)} className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-secondary-foreground text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
          {onDelete && <button onClick={() => { onDelete(action.id); onBack(); }} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
        </div>
      </div>

      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(action.status)}`}>{(action.status || '').replace('_', ' ')}</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${priorityColor(action.priority)}`}>{action.priority} priority</span>
      </div>

      <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
        <h3 className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-2">Description</h3>
        <p className="text-sm text-[var(--gm-text-primary)] whitespace-pre-wrap">{action.description || '—'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Owner</span></div>
          {action.owner ? <OwnerBadge name={action.owner} size="md" /> : <p className="text-sm text-[var(--gm-text-tertiary)]">Unassigned</p>}
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Deadline</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{action.deadline || 'No deadline'}</p>
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Target className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Sprint</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{action.sprintId || 'No sprint'}</p>
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><BookOpen className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /><span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">User Story</span></div>
          <p className="text-sm text-[var(--gm-text-primary)]">{action.storyId || 'No story'}</p>
        </div>
      </div>

      {aiInsights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Insights</h3>
          <ul className="space-y-1.5">{aiInsights.map((insight, i) => <li key={i} className="text-sm text-[var(--gm-text-primary)]">{insight}</li>)}</ul>
        </motion.div>
      )}

      <div className="flex gap-4 text-[10px] text-[var(--gm-text-tertiary)]">
        {action.createdAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Created: {action.createdAt}</span>}
        {action.updatedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated: {action.updatedAt}</span>}
      </div>
    </motion.div>
  );
};

export default ActionDetailView;
