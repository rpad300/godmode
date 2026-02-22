/**
 * Purpose:
 *   Modal form for creating a new sprint with name, date range, and
 *   context/goals description.
 *
 * Responsibilities:
 *   - Renders a form with sprint name (required), start date, end date,
 *     and context/goals textarea
 *   - Generates a sprint ID using timestamp prefix "sp-"
 *   - Sets initial status to "planning"
 *   - Resets form fields after successful submission
 *
 * Key dependencies:
 *   - framer-motion (AnimatePresence): modal enter/exit animations
 *   - Sprint (godmode types): sprint data shape
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Does not validate that end date is after start date.
 *   - Sprint ID uses Date.now() which could collide in rapid creation
 *     scenarios, but is acceptable for the current use case.
 */
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Sprint } from '@/types/godmode';
import { useCreateSprint } from '../../hooks/useKrisp';

interface CreateSprintModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (sprint: Sprint) => void;
}

const CreateSprintModal = ({ open, onClose, onSave }: CreateSprintModalProps) => {
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    context: '',
    goals: '',
    analysis_start_date: '',
    analysis_end_date: '',
  });
  const createMut = useCreateSprint();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date || !form.end_date) return;
    createMut.mutate({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      context: form.context || undefined,
      goals: form.goals.trim() ? form.goals.split('\n').filter(g => g.trim()) : undefined,
      analysis_start_date: form.analysis_start_date || undefined,
      analysis_end_date: form.analysis_end_date || undefined,
    }, {
      onSuccess: (data) => {
        const sprint = (data as { sprint: Sprint }).sprint;
        onSave?.(sprint);
        toast.success('Sprint created');
        setForm({ name: '', start_date: '', end_date: '', context: '', goals: '', analysis_start_date: '', analysis_end_date: '' });
        onClose();
      },
      onError: () => toast.error('Failed to create sprint'),
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-[var(--gm-bg-elevated)] border border-[var(--gm-border-primary)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[var(--gm-border-primary)]" style={{ background: 'linear-gradient(to right, rgba(37,99,235,0.18), rgba(37,99,235,0.05))' }}>
                <h2 className="text-lg font-semibold text-white">Create Sprint</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Sprint Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]"
                    placeholder="e.g. Sprint 4 — Analytics"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Start Date *</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                      className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">End Date *</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Context</label>
                  <input
                    value={form.context}
                    onChange={e => setForm({ ...form, context: e.target.value })}
                    className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]"
                    placeholder="Sprint context..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Goals (one per line)</label>
                  <textarea
                    value={form.goals}
                    onChange={e => setForm({ ...form, goals: e.target.value })}
                    className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)] min-h-[60px] resize-y"
                    placeholder="Define key goals for this sprint..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Analysis Start</label>
                    <input
                      type="date"
                      value={form.analysis_start_date}
                      onChange={e => setForm({ ...form, analysis_start_date: e.target.value })}
                      className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">Analysis End</label>
                    <input
                      type="date"
                      value={form.analysis_end_date}
                      onChange={e => setForm({ ...form, analysis_end_date: e.target.value })}
                      className="mt-1 w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gm-border-focus)]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] text-sm font-medium hover:bg-[var(--gm-surface-hover)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Sprint
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

export default CreateSprintModal;
