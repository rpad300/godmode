/**
 * Purpose:
 *   Main panel for managing project actions (tasks/to-dos) within the
 *   Source of Truth module. Supports multiple view modes, filtering,
 *   CRUD operations, and AI-powered action suggestions.
 *
 * Responsibilities:
 *   - Renders actions in three view modes: flat list, grouped by sprint,
 *     grouped by user story
 *   - Provides status and sprint filters with a summary stats strip
 *   - CRUD: create, edit (via ActionModal), delete, and view detail
 *     (via ActionDetailView)
 *   - AI Suggest: generates placeholder AI-suggested actions and appends
 *     them to the list (simulated with setTimeout)
 *   - Sprint management: create sprints via CreateSprintModal
 *   - Collapsible accordion groups with animated expand/collapse
 *
 * Key dependencies:
 *   - ActionModal: create/edit form modal
 *   - ActionDetailView: single action detail with AI analysis
 *   - CreateSprintModal: sprint creation form
 *   - OwnerBadge: avatar+name badge for action owners
 *   - framer-motion: layout animations and group expand/collapse
 *   - sonner (toast): user feedback notifications
 *   - Action, Sprint, UserStory (godmode types): data shapes
 *
 * Side effects:
 *   - None (state is managed locally; parent is notified via onSave/onDelete)
 *
 * Notes:
 *   - AI suggestions are simulated with hardcoded data and delays.
 *   - User stories array is empty (hardcoded `[]`); the "by story" view
 *     is prepared but non-functional until the API is connected.
 *   - Actions and sprints are controlled via props (initialData/initialSprints)
 *     but also maintain local state, which can desync if props change
 *     without remounting.
 */
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, List, Layers, BookOpen, Filter, Target, ChevronDown, ChevronRight, FileBarChart, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Action, Sprint, UserStory } from '@/types/godmode';
import ActionModal from './ActionModal';
import ActionDetailView from './ActionDetailView';
import CreateSprintModal from './CreateSprintModal';
import OwnerBadge from './OwnerBadge';

type ViewMode = 'list' | 'by_sprint' | 'by_story';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';

const statusColor = (s: string) =>
  s === 'completed' ? 'bg-success/10 text-success' :
    s === 'overdue' ? 'bg-destructive/10 text-destructive' :
      s === 'in_progress' ? 'bg-primary/10 text-primary' :
        'bg-muted text-muted-foreground';

const priorityColor = (p: string) =>
  p === 'high' ? 'bg-destructive/10 text-destructive' :
    p === 'medium' ? 'bg-warning/10 text-warning' :
      'bg-muted text-muted-foreground';

const sprintStatusColor = (s: string) =>
  s === 'active' ? 'bg-success/10 text-success' :
    s === 'completed' ? 'bg-muted text-muted-foreground' :
      'bg-primary/10 text-primary';

const ActionsPanel = ({ initialData = [], initialSprints = [], onSave, onDelete }: { initialData?: Action[]; initialSprints?: Sprint[]; onSave?: (a: Action) => void; onDelete?: (id: string) => void }) => {
  const [actions, setActions] = useState<Action[]>(initialData);
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);

  useEffect(() => {
    if (initialData) setActions(initialData);
    if (initialSprints) setSprints(initialSprints);
  }, [initialData, initialSprints]);
  const [viewMode, setViewMode] = useState<ViewMode>('by_sprint');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sprintFilter, setSprintFilter] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['sp-2', 'sp-1', 'sp-3', 'no-sprint']));

  // Modal states
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalMode, setActionModalMode] = useState<'create' | 'edit'>('create');
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [detailAction, setDetailAction] = useState<Action | null>(null);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);

  const handleAiSuggestActions = async () => {
    setAiSuggestLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    const suggested: Action[] = [
      {
        id: `ai-${Date.now()}-1`,
        title: '[AI] Review and update project documentation',
        description: 'AI detected outdated documentation based on recent changes. Suggested review and update.',
        status: 'pending',
        priority: 'medium',
        owner: 'AI Suggested',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        sprintId: sprints.find(s => s.status === 'active')?.id,
        createdAt: new Date().toISOString().split('T')[0],
      },
      {
        id: `ai-${Date.now()}-2`,
        title: '[AI] Address overdue risk mitigations',
        description: 'AI identified unaddressed risks that need immediate mitigation actions.',
        status: 'pending',
        priority: 'high',
        owner: 'AI Suggested',
        deadline: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        sprintId: sprints.find(s => s.status === 'active')?.id,
        createdAt: new Date().toISOString().split('T')[0],
      },
    ];
    setActions(prev => [...prev, ...suggested]);
    setAiSuggestLoading(false);
    toast.success(`AI suggested ${suggested.length} new actions`);
  };

  // Filter actions
  const filtered = useMemo(() => {
    let result = actions;
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (sprintFilter) result = result.filter(a => a.sprintId === sprintFilter);
    return result;
  }, [actions, statusFilter, sprintFilter]);

  // Stats for report strip
  const stats = useMemo(() => ({
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    completed: actions.filter(a => a.status === 'completed').length,
    overdue: actions.filter(a => a.status === 'overdue').length,
  }), [actions]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveAction = (action: Action) => {
    setActions(prev => {
      const idx = prev.findIndex(a => a.id === action.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = action;
        return updated;
      }
      return [...prev, action];
    });
    onSave?.(action);
  };

  const handleDeleteAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
    onDelete?.(id);
    toast.success('Action deleted');
  };

  const handleCreateSprint = (sprint: Sprint) => {
    setSprints(prev => [...prev, sprint]);
    setExpandedGroups(prev => new Set([...prev, sprint.id]));
  };

  const openEditModal = (action: Action) => {
    setEditingAction(action);
    setActionModalMode('edit');
    setActionModalOpen(true);
  };

  // If viewing detail
  if (detailAction) {
    return (
      <ActionDetailView
        action={detailAction}
        onBack={() => setDetailAction(null)}
        onEdit={(a) => {
          setDetailAction(null);
          openEditModal(a);
        }}
        onDelete={handleDeleteAction}
      />
    );
  }

  // Render an action card
  const ActionCard = ({ action }: { action: Action }) => (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors cursor-pointer group"
      onClick={() => setDetailAction(action)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{action.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(action.priority)}`}>{action.priority}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(action.status)}`}>{(action.status || '').replace('_', ' ')}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        {action.owner ? (
          <OwnerBadge name={action.owner} size="sm" />
        ) : (
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        )}
        {action.deadline && <span className="text-[10px] text-muted-foreground">📅 {action.deadline}</span>}
      </div>
    </motion.div>
  );

  // Group by sprint
  const renderBySprint = () => {
    const groups = sprints.map(sprint => ({
      sprint,
      actions: filtered.filter(a => a.sprintId === sprint.id),
    }));
    const unassigned = filtered.filter(a => !a.sprintId);

    return (
      <div className="space-y-3">
        {groups.map(({ sprint, actions: sprintActions }) => (
          <div key={sprint.id} className="bg-secondary/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(sprint.id)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              {expandedGroups.has(sprint.id)
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground flex-1">{sprint.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sprintStatusColor(sprint.status)}`}>{sprint.status}</span>
              <span className="text-[10px] text-muted-foreground">{sprintActions.length} actions</span>
            </button>
            <AnimatePresence>
              {expandedGroups.has(sprint.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {sprint.context && (
                    <p className="text-xs text-muted-foreground px-4 pb-2">{sprint.context}</p>
                  )}
                  <div className="px-3 pb-3 space-y-2">
                    {sprintActions.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No actions in this sprint</p>
                    ) : (
                      sprintActions.map(a => <ActionCard key={a.id} action={a} />)
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div className="bg-secondary/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup('no-sprint')}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              {expandedGroups.has('no-sprint')
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
              <span className="text-sm font-medium text-muted-foreground flex-1">No Sprint</span>
              <span className="text-[10px] text-muted-foreground">{unassigned.length} actions</span>
            </button>
            <AnimatePresence>
              {expandedGroups.has('no-sprint') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-3 pb-3 space-y-2"
                >
                  {unassigned.map(a => <ActionCard key={a.id} action={a} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  // Group by story (user stories fetched from API will be added later)
  const userStories: UserStory[] = [];
  const renderByStory = () => {
    const storiesWithActions = userStories.map(story => ({
      story,
      actions: filtered.filter(a => a.storyId === story.id),
    })).filter(g => g.actions.length > 0);
    const noStory = filtered.filter(a => !a.storyId);

    return (
      <div className="space-y-3">
        {storiesWithActions.map(({ story, actions: storyActions }) => {
          const sprint = sprints.find(s => s.id === story.sprintId);
          return (
            <div key={story.id} className="bg-secondary/30 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(story.id)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
              >
                {expandedGroups.has(story.id)
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                }
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground flex-1 truncate">{story.title}</span>
                {sprint && <span className="text-[10px] text-muted-foreground">{sprint.name}</span>}
                <span className="text-[10px] text-muted-foreground">{storyActions.length}</span>
              </button>
              <AnimatePresence>
                {expandedGroups.has(story.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-3 pb-3 space-y-2"
                  >
                    {storyActions.map(a => <ActionCard key={a.id} action={a} />)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {noStory.length > 0 && (
          <div className="bg-secondary/30 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup('no-story')}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              {expandedGroups.has('no-story')
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
              <span className="text-sm font-medium text-muted-foreground flex-1">No Story</span>
              <span className="text-[10px] text-muted-foreground">{noStory.length}</span>
            </button>
            <AnimatePresence>
              {expandedGroups.has('no-story') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-3 pb-3 space-y-2"
                >
                  {noStory.map(a => <ActionCard key={a.id} action={a} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  // Flat list
  const renderList = () => (
    <div className="space-y-2">
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No actions match the current filter</p>
      ) : (
        filtered.map(a => <ActionCard key={a.id} action={a} />)
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Report strip */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pending', value: stats.pending, color: 'text-muted-foreground' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-primary' },
          { label: 'Completed', value: stats.completed, color: 'text-success' },
          { label: 'Overdue', value: stats.overdue, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View mode tabs */}
        <div className="flex bg-secondary rounded-lg p-0.5">
          {([
            { id: 'list' as ViewMode, icon: List, label: 'List' },
            { id: 'by_sprint' as ViewMode, icon: Layers, label: 'Sprints' },
            { id: 'by_story' as ViewMode, icon: BookOpen, label: 'Stories' },
          ]).map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === v.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <v.icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        {/* Sprint filter (list mode) */}
        {viewMode === 'list' && (
          <select
            value={sprintFilter}
            onChange={e => setSprintFilter(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All sprints</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={() => setSprintModalOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <Target className="w-3.5 h-3.5" /> Sprint
        </button>
        <button
          onClick={handleAiSuggestActions}
          disabled={aiSuggestLoading}
          className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {aiSuggestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI Suggest
        </button>
        <button
          onClick={() => {
            setEditingAction(null);
            setActionModalMode('create');
            setActionModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Action
        </button>
      </div>

      {/* Content */}
      <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {viewMode === 'list' && renderList()}
        {viewMode === 'by_sprint' && renderBySprint()}
        {viewMode === 'by_story' && renderByStory()}
      </motion.div>

      {/* Modals */}
      <ActionModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        onSave={handleSaveAction}
        action={editingAction}
        mode={actionModalMode}
      />
      <CreateSprintModal
        open={sprintModalOpen}
        onClose={() => setSprintModalOpen(false)}
        onSave={handleCreateSprint}
      />
    </div>
  );
};

export default ActionsPanel;
