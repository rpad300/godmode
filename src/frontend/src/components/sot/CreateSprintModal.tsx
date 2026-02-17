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
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Sprint } from '@/types/godmode';

interface CreateSprintModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (sprint: Sprint) => void;
}

const CreateSprintModal = ({ open, onClose, onSave }: CreateSprintModalProps) => {
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    context: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      id: `sp-${Date.now()}`,
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      context: form.context,
      status: 'planning',
    });
    setForm({ name: '', startDate: '', endDate: '', context: '' });
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
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Create Sprint</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sprint Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Sprint 4 — Analytics"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={e => setForm({ ...form, startDate: e.target.value })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={e => setForm({ ...form, endDate: e.target.value })}
                      className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Context / Goals</label>
                  <textarea
                    value={form.context}
                    onChange={e => setForm({ ...form, context: e.target.value })}
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px] resize-y"
                    placeholder="Sprint goals and context..."
                  />
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
