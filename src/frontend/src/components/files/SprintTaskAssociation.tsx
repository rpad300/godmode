import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSprints, useActions } from '@/hooks/useGodMode';

interface Props {
  sprintId: string;
  taskId: string;
  onSprintChange: (v: string) => void;
  onTaskChange: (v: string) => void;
}

const SprintTaskAssociation = ({ sprintId, taskId, onSprintChange, onTaskChange }: Props) => {
  const { data: sprintsData } = useSprints();
  const { data: actionsData } = useActions();

  const sprints = (sprintsData as any)?.sprints ?? (Array.isArray(sprintsData) ? sprintsData : []);
  const actions = Array.isArray(actionsData) ? actionsData : [];

  const filteredTasks = sprintId && sprintId !== 'none'
    ? actions.filter((a: any) => a.sprintId === sprintId || a.sprint_id === sprintId)
    : actions;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Associate with (optional)</p>
      <Select value={sprintId} onValueChange={onSprintChange}>
        <SelectTrigger className="w-full h-9 text-sm">
          <SelectValue placeholder="No sprint" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No sprint</SelectItem>
          {sprints.map((s: any) => (
            <SelectItem key={s.id} value={s.id}>{s.name || '(unnamed)'}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={taskId} onValueChange={onTaskChange}>
        <SelectTrigger className="w-full h-9 text-sm">
          <SelectValue placeholder="No task" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No task</SelectItem>
          {filteredTasks.map((a: any) => (
            <SelectItem key={a.id} value={a.id}>{a.title || a.task || '(untitled)'}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SprintTaskAssociation;
