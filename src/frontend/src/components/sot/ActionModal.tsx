import { useState, useEffect } from 'react';
import { X, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Action, Sprint, UserStory } from '@/types/godmode';
import { useAiSuggestTask, useSotChat } from '../../hooks/useGodMode';
import OwnerSelect from './OwnerSelect';

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (action: Action) => void;
  action?: Action | null;
  mode: 'create' | 'edit';
  sprints?: Sprint[];
  userStories?: UserStory[];
}

const emptyAction: Omit<Action, 'id'> = {
  task: '',
  description: '',
  owner: '',
  deadline: '',
  status: 'pending',
  priority: 'medium',
  sprint_id: '',
  parent_story_id: '',
};

const ActionModal = ({ open, onClose, onSave, action, mode, sprints = [], userStories = [] }: ActionModalProps) => {
  const [form, setForm] = useState<Omit<Action, 'id'>>(emptyAction);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const suggestTask = useAiSuggestTask();
  const chatMut = useSotChat();

  useEffect(() => {
    if (action && mode === 'edit') {
      const { id, ...rest } = action;
      setForm(rest);
    } else {
      setForm(emptyAction);
    }
  }, [action, mode, open]);

  const storiesForSprint = userStories.filter(s => s.sprintId === form.sprintId);

  const handleAiSuggest = async (field: 'title' | 'description') => {
    setAiLoading(field);
    if (field === 'title') {
      chatMut.mutate({ message: 'Suggest one concise action item title for this project. Return only the title text.' }, {
        onSuccess: (d) => {
          const resp = (d as Record<string, unknown>)?.response as string;
          if (resp) setForm(prev => ({ ...prev, title: resp.replace(/^["'\-*\d.]+\s*/, '').trim() }));
          setAiLoading(null);
          toast.success('AI suggestion applied to title');
        },
        onError: () => { setAiLoading(null); toast.error('AI suggestion failed'); },
      });
    } else {
      const input = form.task || 'a new project task';
      suggestTask.mutate({ user_input: input }, {
        onSuccess: (d) => {
          const parts: string[] = [];
          if (d.description) parts.push(d.description);
          if (d.definition_of_done) parts.push(`Definition of Done: ${d.definition_of_done}`);
          if (d.acceptance_criteria) parts.push(`Acceptance Criteria: ${d.acceptance_criteria}`);
          if (d.size_estimate) parts.push(`Estimate: ${d.size_estimate}`);
          const text = parts.join('\n\n');
          setForm(prev => ({ ...prev, description: prev.description ? `${prev.description}\n\n${text}` : text }));
          if (d.task && !form.task) setForm(prev => ({ ...prev, task: d.task }));
          setAiLoading(null);
          toast.success('AI suggestion applied to description');
        },
        onError: () => { setAiLoading(null); toast.error('AI suggestion failed'); },
      });
    }
  };

  const handleAiRefine = async () => {
    if (!form.task && !form.description) { toast.error('Add a title or description first'); return; }
    setAiLoading('refine');
    chatMut.mutate({ message: `Refine this action item. Clarify scope, add measurable outcomes, identify blockers:\nTask: "${form.task}"\nDescription: "${form.description}"` }, {
      onSuccess: (d) => {
        const resp = (d as Record<string, unknown>)?.response as string;
        if (resp) setForm(prev => ({ ...prev, description: prev.description ? `${prev.description}\n\n${resp}` : resp }));
        setAiLoading(null);
        toast.success('Action refined with AI');
      },
      onError: () => { setAiLoading(null); toast.error('AI refinement failed'); },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      id: action?.id || String(Date.now()),
      ...form,
      createdAt: action?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--gm-bg-elevated)] border border-[var(--gm-border-primary)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[var(--gm-border-primary)]" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.18), rgba(37,99,235,0.05))' }}>
                <h2 className="text-lg font-semibold text-white">{mode === 'create' ? 'New Action' : 'Edit Action'}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="px-5 pt-4 flex gap-2">
                <button type="button" onClick={() => handleAiSuggest('title')} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'title' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Suggest Title
                </button>
                <button type="button" onClick={() => handleAiSuggest('description')} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'description' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Suggest Description
                </button>
                <button type="button" onClick={handleAiRefine} disabled={!!aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                  {aiLoading === 'refine' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Refine with AI
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Title *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" placeholder="Action title..." required />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[80px] resize-y" placeholder="Describe the action..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <OwnerSelect value={form.owner || ''} onChange={v => setForm({ ...form, owner: v })} label="Owner" placeholder="Select assignee..." />
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Deadline</label>
                    <input type="date" value={form.deadline || ''} onChange={e => setForm({ ...form, deadline: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Action['status'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="overdue">Overdue</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Priority</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Action['priority'] })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Sprint</label>
                    <select value={form.sprintId || ''} onChange={e => setForm({ ...form, sprintId: e.target.value, storyId: '' })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]">
                      <option value="">No sprint</option>
                      {sprints.map(s => <option key={s.id} value={s.id}>{s.name || '(unnamed)'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">User Story</label>
                    <select value={form.storyId || ''} onChange={e => setForm({ ...form, storyId: e.target.value })} className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]" disabled={!form.sprintId}>
                      <option value="">No story</option>
                      {storiesForSprint.map(s => <option key={s.id} value={s.id}>{s.title || '(untitled)'}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-sm font-medium hover:bg-[var(--gm-surface-hover)]">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">{mode === 'create' ? 'Create Action' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ActionModal;
