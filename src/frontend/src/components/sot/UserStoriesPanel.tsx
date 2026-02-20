import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, Edit2, Trash2, X, BookOpen, Target, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useUserStories, useCreateUserStory, useUpdateUserStory, useDeleteUserStory,
  type UserStory,
} from '@/hooks/useGodMode';

type StatusFilter = 'all' | 'backlog' | 'in_progress' | 'done' | 'cancelled';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const statusColor = (s?: string) =>
  s === 'done' ? 'bg-green-500/10 text-green-400' :
  s === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
  s === 'cancelled' ? 'bg-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]' :
  'bg-amber-500/10 text-amber-400';

const priorityColor = (p?: string) =>
  p === 'high' ? 'bg-red-500/10 text-red-400' :
  p === 'medium' ? 'bg-amber-500/10 text-amber-400' :
  'bg-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)]';

const StoryModal = ({ open, onClose, story, mode }: {
  open: boolean; onClose: () => void;
  story?: UserStory | null; mode: 'create' | 'edit';
}) => {
  const createMut = useCreateUserStory();
  const updateMut = useUpdateUserStory();

  const empty = { title: '', description: '', acceptance_criteria: '', priority: 'medium', status: 'backlog' };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (story && mode === 'edit') {
      setForm({
        title: story.title || '',
        description: story.description || '',
        acceptance_criteria: story.acceptance_criteria || '',
        priority: story.priority || 'medium',
        status: story.status || 'backlog',
      });
    } else {
      setForm(empty);
    }
  }, [story, mode, open]);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (mode === 'edit' && story) {
      updateMut.mutate({ id: story.id, ...form }, {
        onSuccess: () => { toast.success('Story updated'); onClose(); },
        onError: () => toast.error('Failed to update'),
      });
    } else {
      createMut.mutate(form, {
        onSuccess: () => { toast.success('Story created'); onClose(); },
        onError: () => toast.error('Failed to create'),
      });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
          className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl w-full max-w-lg p-5 shadow-2xl"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--gm-text-primary)]">
              {mode === 'create' ? 'New User Story' : 'Edit User Story'}
            </h3>
            <button onClick={onClose} className="p-1 rounded text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--gm-text-secondary)] mb-1 block">Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)]"
                placeholder="As a user, I want to..." />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--gm-text-secondary)] mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] resize-y"
                placeholder="Detailed description..." />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--gm-text-secondary)] mb-1 block">Acceptance Criteria</label>
              <textarea value={form.acceptance_criteria} onChange={e => setForm(p => ({ ...p, acceptance_criteria: e.target.value }))}
                rows={3}
                className="w-full bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] resize-y font-mono text-xs"
                placeholder="Given... When... Then..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--gm-text-secondary)] mb-1 block">Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                  className="w-full bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)]">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--gm-text-secondary)] mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)]">
                  <option value="backlog">Backlog</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[var(--gm-border-primary)]">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-secondary)]">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--gm-accent-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function UserStoriesPanel() {
  const { data, isLoading } = useUserStories();
  const deleteMut = useDeleteUserStory();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<UserStory | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const stories = (data?.stories ?? []) as UserStory[];

  const filtered = useMemo(() => {
    let list = stories;
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter(s => s.priority === priorityFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
    }
    return list;
  }, [stories, statusFilter, priorityFilter, search]);

  const handleEdit = (story: UserStory) => {
    setEditTarget(story);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditTarget(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this user story?')) {
      deleteMut.mutate(id, { onSuccess: () => toast.success('Story deleted') });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StoryModal open={modalOpen} onClose={() => setModalOpen(false)} story={editTarget} mode={modalMode} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search stories..."
            className="bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-1.5 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-tertiary)] w-48" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--gm-text-primary)]">
            <option value="all">All statuses</option>
            <option value="backlog">Backlog</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as PriorityFilter)}
            className="bg-[var(--gm-surface-secondary)] border border-[var(--gm-border-primary)] rounded-lg px-2 py-1.5 text-xs text-[var(--gm-text-primary)]">
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--gm-accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Story
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-10 h-10 mx-auto text-[var(--gm-text-tertiary)] opacity-40 mb-3" />
          <p className="text-sm text-[var(--gm-text-tertiary)]">
            {stories.length === 0 ? 'No user stories yet. Create one above.' : 'No stories match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((story, i) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-4 hover:border-[var(--gm-accent-primary)]/20 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Target className="w-4 h-4 text-[var(--gm-accent-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-[var(--gm-text-primary)]">{story.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(story.status)}`}>
                      {(story.status || 'backlog').replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(story.priority)}`}>
                      {story.priority || 'medium'}
                    </span>
                  </div>
                  {story.description && (
                    <p className="text-xs text-[var(--gm-text-secondary)] line-clamp-2 mb-1">{story.description}</p>
                  )}
                  {story.acceptance_criteria && (
                    <p className="text-[10px] text-[var(--gm-text-tertiary)] font-mono line-clamp-1 mt-1">
                      AC: {story.acceptance_criteria}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => handleEdit(story)}
                    className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-secondary)] hover:text-[var(--gm-text-primary)]">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(story.id)}
                    className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
