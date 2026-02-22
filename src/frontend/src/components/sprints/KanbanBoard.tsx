import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { Action } from '@/types/godmode';
import OwnerBadge from '../sot/OwnerBadge';
import { SECTION_TITLE } from './styles';

interface KanbanBoardProps {
  actions: Action[];
  onStatusChange: (actionId: string, newStatus: Action['status']) => void;
}

const COLUMNS: { id: Action['status']; label: string; color: string; dotColor: string }[] = [
  { id: 'pending', label: 'To Do', color: 'border-[var(--text-tertiary)]/30', dotColor: 'bg-[var(--text-tertiary)]' },
  { id: 'in_progress', label: 'In Progress', color: 'border-[var(--status-info)]/30', dotColor: 'bg-[var(--status-info)]' },
  { id: 'overdue', label: 'Overdue', color: 'border-[var(--status-danger)]/30', dotColor: 'bg-[var(--status-danger)]' },
  { id: 'completed', label: 'Done', color: 'border-[var(--status-success)]/30', dotColor: 'bg-[var(--status-success)]' },
];

export default function KanbanBoard({ actions, onStatusChange }: KanbanBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, actionId: string) => {
    setDragId(actionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', actionId);
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDragId(null);
    setDragOverCol(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const actionId = e.dataTransfer.getData('text/plain');
    if (actionId) {
      const action = actions.find(a => a.id === actionId);
      if (action && action.status !== colId) {
        onStatusChange(actionId, colId as Action['status']);
      }
    }
    setDragId(null);
    setDragOverCol(null);
  }, [actions, onStatusChange]);

  const priorityDot = (p: string) =>
    p === 'high' ? 'bg-[var(--status-danger)]' : p === 'medium' ? 'bg-[var(--status-warning)]' : 'bg-[var(--text-tertiary)]';

  return (
    <div>
      <span className={cn(SECTION_TITLE, 'block mb-3')}>Kanban Board</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const colActions = actions.filter(a => a.status === col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
              className={cn(
                'rounded-xl border bg-[var(--surface-secondary)] min-h-[200px] transition-colors',
                col.color,
                isOver && 'border-[var(--accent-primary)]/50 bg-[var(--status-info-bg)]'
              )}
            >
              <div className="px-3 py-2 border-b border-[var(--border-primary)] flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', col.dotColor)} />
                <span className="text-xs font-medium text-[var(--text-primary)]">{col.label}</span>
                <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">{colActions.length}</span>
              </div>
              <div className="p-2 space-y-1.5">
                {colActions.map(action => (
                  <div
                    key={action.id}
                    draggable
                    onDragStart={e => handleDragStart(e, action.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--accent-primary)]/30 transition-colors group',
                      dragId === action.id && 'opacity-40'
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[var(--text-primary)] line-clamp-2 leading-tight">
                          {action.task || action.title || '(untitled)'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {action.priority && (
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityDot(action.priority))} title={action.priority} />
                          )}
                          {action.task_points != null && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--status-info-bg)] text-[var(--accent-primary)] tabular-nums">{action.task_points}</span>
                          )}
                          {action.owner && <OwnerBadge name={action.owner} size="sm" />}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {colActions.length === 0 && (
                  <p className="text-[10px] text-[var(--text-tertiary)] text-center py-6">
                    {isOver ? 'Drop here' : 'No tasks'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
