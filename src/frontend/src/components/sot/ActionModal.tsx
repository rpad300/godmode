/**
 * Purpose:
 *   Modal form for creating or editing an action item, with AI-assisted
 *   title suggestion, description suggestion, and content refinement.
 *
 * Responsibilities:
 *   - Form fields: title, description, owner, deadline, status, priority,
 *     sprint, and user story (filtered by selected sprint)
 *   - AI toolbar: "Suggest Title", "Suggest Description", "Refine with AI"
 *   - Resets form state on open based on mode (create vs edit)
 *   - Submits with auto-generated ID and timestamps
 *
 * Key dependencies:
 *   - framer-motion (AnimatePresence): modal enter/exit animations
 *   - sonner (toast): AI suggestion feedback
 *   - Action, Sprint, UserStory (godmode types): data shapes
 *
 * Side effects:
 *   - None (AI features are simulated locally)
 *
 * Notes:
 *   - AI suggestions use hardcoded response arrays and random selection.
 *   - The user story dropdown is disabled when no sprint is selected.
 *   - storiesForSprint filters by form.sprintId; changing sprint clears
 *     the story selection.
 */
import { useState, useEffect } from 'react';
import { X, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Action, Sprint, UserStory } from '@/types/godmode';

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
  title: '',
  description: '',
  owner: '',
  deadline: '',
  status: 'pending',
  priority: 'medium',
  sprintId: '',
  storyId: '',
};

const ActionModal = ({ open, onClose, onSave, action, mode, sprints = [], userStories = [] }: ActionModalProps) => {
  const [form, setForm] = useState<Omit<Action, 'id'>>(emptyAction);

  useEffect(() => {
    if (action && mode === 'edit') {
      const { id, ...rest } = action;
      setForm(rest);
    } else {
      setForm(emptyAction);
    }
  }, [action, mode, open]);

  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const storiesForSprint = userStories.filter(s => s.sprintId === form.sprintId);

  const handleAiSuggest = async (field: 'title' | 'description') => {
    setAiLoading(field);
    // Simulate AI suggestion - replace with real AI call when backend is connected
    await new Promise(r => setTimeout(r, 1200));
    if (field === 'title') {
      const suggestions = [
        'Implement authentication flow for SSO integration',
        'Refactor data pipeline for improved throughput',
        'Design and implement user onboarding wizard',
        'Set up CI/CD pipeline with automated testing',
      ];
      setForm(prev => ({ ...prev, title: suggestions[Math.floor(Math.random() * suggestions.length)] }));
    } else {
      setForm(prev => ({
        ...prev,
        description: `${prev.description ? prev.description + '\n\n' : ''}[AI Suggested] Define clear acceptance criteria, identify dependencies, estimate effort in story points, and assign to the appropriate team member based on expertise.`,
      }));
    }
    setAiLoading(null);
    toast.success(`AI suggestion applied to ${field}`);
  };

  const handleAiRefine = async () => {
    if (!form.title && !form.description) {
      toast.error('Add a title or description first');
      return;
    }
    setAiLoading('refine');
    await new Promise(r => setTimeout(r, 1500));
    setForm(prev => ({
      ...prev,
      description: prev.description
        ? `${prev.description}\n\n[AI Refined] Clarified scope, added measurable outcomes, and identified potential blockers. Priority adjusted based on project timeline analysis.`
        : `[AI Refined] Based on "${prev.title}": Define scope boundaries, set measurable outcomes, identify blockers, and align with sprint goals.`,
    }));
    setAiLoading(null);
    toast.success('Action refined with AI');
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
          <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  {mode === 'create' ? 'New Action' : 'Edit Action'}
                </h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* AI Actions Bar */}
              <div className="px-5 pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAiSuggest('title')}
                  disabled={!!aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {aiLoading === 'title' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Suggest Title
                </button>
                <button
                  type="button"
                  onClick={() => handleAiSuggest('description')}
                  disabled={!!aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {aiLoading === 'description' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Suggest Description
                </button>
                <button
                  type="button"
                  onClick={handleAiRefine}
                  disabled={!!aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {aiLoading === 'refine' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Refine with AI
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Action title..."
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-y"
                    placeholder="Describe the action..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner</label>
                    <input
                      value={form.owner || ''}
                      onChange={e => setForm({ ...form, owner: e.target.value })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Assignee..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deadline</label>
                    <input
                      type="date"
                      value={form.deadline || ''}
                      onChange={e => setForm({ ...form, deadline: e.target.value })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value as Action['status'] })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
                    <select
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value as Action['priority'] })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sprint</label>
                    <select
                      value={form.sprintId || ''}
                      onChange={e => setForm({ ...form, sprintId: e.target.value, storyId: '' })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">No sprint</option>
                      {sprints.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User Story</label>
                    <select
                      value={form.storyId || ''}
                      onChange={e => setForm({ ...form, storyId: e.target.value })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={!form.sprintId}
                    >
                      <option value="">No story</option>
                      {storiesForSprint.map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    {mode === 'create' ? 'Create Action' : 'Save Changes'}
                  </button>
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
