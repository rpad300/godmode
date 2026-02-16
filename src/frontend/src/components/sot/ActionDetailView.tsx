import { useState } from 'react';
import { ArrowLeft, Edit2, Calendar, User, Flag, Clock, BookOpen, Target, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { Action } from '@/types/godmode';
import { mockSprints, mockUserStories } from '@/data/mock-data';
import OwnerBadge from './OwnerBadge';

const statusColor = (s: string) =>
  s === 'completed' ? 'bg-success/10 text-success' :
    s === 'overdue' ? 'bg-destructive/10 text-destructive' :
      s === 'in_progress' ? 'bg-primary/10 text-primary' :
        'bg-muted text-muted-foreground';

const priorityColor = (p: string) =>
  p === 'high' ? 'bg-destructive/10 text-destructive' :
    p === 'medium' ? 'bg-warning/10 text-warning' :
      'bg-muted text-muted-foreground';

interface ActionDetailViewProps {
  action: Action;
  onBack: () => void;
  onEdit: (action: Action) => void;
}

const ActionDetailView = ({ action, onBack, onEdit }: ActionDetailViewProps) => {
  const sprint = mockSprints.find(s => s.id === action.sprintId);
  const story = mockUserStories.find(s => s.id === action.storyId);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  const handleAiAnalyze = async () => {
    setAiLoading('analyze');
    await new Promise(r => setTimeout(r, 1500));
    setAiInsights([
      `This action has ${action.status === 'overdue' ? 'high' : 'moderate'} urgency based on deadline analysis.`,
      `Suggested dependencies: Review related actions in ${sprint?.name || 'current backlog'}.`,
      `Risk assessment: ${action.priority === 'high' ? 'Blocking potential — escalate if not started within 2 days.' : 'On track — monitor weekly.'}`,
    ]);
    setAiLoading(null);
    toast.success('AI analysis complete');
  };

  const handleAiSuggestNextSteps = async () => {
    setAiLoading('steps');
    await new Promise(r => setTimeout(r, 1200));
    setAiInsights(prev => [
      ...prev,
      '📋 Next step: Break down into sub-tasks with clear deliverables.',
      '📋 Next step: Schedule review meeting with stakeholders.',
      '📋 Next step: Update acceptance criteria based on latest requirements.',
    ]);
    setAiLoading(null);
    toast.success('AI suggested next steps');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">{action.title}</h2>
          <p className="text-xs text-muted-foreground">Action #{action.id}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAiAnalyze}
            disabled={!!aiLoading}
            className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {aiLoading === 'analyze' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Analyze
          </button>
          <button
            onClick={handleAiSuggestNextSteps}
            disabled={!!aiLoading}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {aiLoading === 'steps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Suggest Steps
          </button>
          <button
            onClick={() => onEdit(action)}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor(action.status)}`}>
          {(action.status || '').replace('_', ' ')}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${priorityColor(action.priority)}`}>
          {action.priority} priority
        </span>
      </div>

      {/* Description */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
        <p className="text-sm text-foreground">{action.description}</p>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</span>
          </div>
          {action.owner ? (
            <OwnerBadge name={action.owner} size="md" />
          ) : (
            <p className="text-sm text-muted-foreground">Unassigned</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deadline</span>
          </div>
          <p className="text-sm text-foreground">{action.deadline || 'No deadline'}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sprint</span>
          </div>
          <p className="text-sm text-foreground">{sprint?.name || 'No sprint'}</p>
          {sprint && (
            <p className="text-[10px] text-muted-foreground mt-1">{sprint.startDate} — {sprint.endDate}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User Story</span>
          </div>
          <p className="text-sm text-foreground">{story?.title || 'No story'}</p>
        </div>
      </div>

      {/* Story acceptance criteria */}
      {story?.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Acceptance Criteria</h3>
          <ul className="space-y-1">
            {story.acceptanceCriteria.map((c, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-accent mt-0.5">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent/5 border border-accent/20 rounded-xl p-4"
        >
          <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Insights
          </h3>
          <ul className="space-y-1.5">
            {aiInsights.map((insight, i) => (
              <li key={i} className="text-sm text-foreground">{insight}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Timestamps */}
      <div className="flex gap-4 text-[10px] text-muted-foreground">
        {action.createdAt && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Created: {action.createdAt}
          </span>
        )}
        {action.updatedAt && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Updated: {action.updatedAt}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default ActionDetailView;
