/**
 * Purpose:
 *   Reusable sub-component for optionally associating an imported file
 *   with a sprint and/or task, using two cascading Select dropdowns.
 *
 * Responsibilities:
 *   - Sprint selector populated from mockSprints
 *   - Task selector populated from mockActions, filtered by the selected
 *     sprint when one is chosen
 *   - Both default to "none" (no association)
 *
 * Key dependencies:
 *   - mockSprints, mockActions (mock-data): static data sources
 *   - Select (shadcn/ui): dropdown component
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Currently uses mock data; will need to switch to real API data
 *     or accept sprints/actions as props when the backend is connected.
 *   - Changing the sprint does not auto-clear the task selection; the
 *     user may end up with a task that does not belong to the selected
 *     sprint if they change sprints after selecting a task.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockSprints, mockActions } from '@/data/mock-data';

interface Props {
  sprintId: string;
  taskId: string;
  onSprintChange: (v: string) => void;
  onTaskChange: (v: string) => void;
}

const SprintTaskAssociation = ({ sprintId, taskId, onSprintChange, onTaskChange }: Props) => {
  const filteredTasks = sprintId && sprintId !== 'none'
    ? mockActions.filter(a => a.sprintId === sprintId)
    : mockActions;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Associate with (optional)</p>
      <Select value={sprintId} onValueChange={onSprintChange}>
        <SelectTrigger className="w-full h-9 text-sm">
          <SelectValue placeholder="No sprint" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No sprint</SelectItem>
          {mockSprints.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={taskId} onValueChange={onTaskChange}>
        <SelectTrigger className="w-full h-9 text-sm">
          <SelectValue placeholder="No task" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No task</SelectItem>
          {filteredTasks.map(a => (
            <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SprintTaskAssociation;
