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
