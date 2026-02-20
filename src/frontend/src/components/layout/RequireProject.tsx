import { Outlet } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { useProject } from '../../hooks/useProject';

export function RequireProject() {
  const { projectId } = useProject();

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
          <FolderOpen className="w-8 h-8 text-[hsl(var(--primary))]" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">No Project Selected</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md">
            Select a project from the dropdown in the header to view this page.
            All data is scoped to the active project.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
