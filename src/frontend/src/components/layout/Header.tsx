import { Moon, Sun, Zap, Menu } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Project } from '../../hooks/useGodMode';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onToggleSidebar: () => void;
}

export function Header({
  theme,
  onToggleTheme,
  projects,
  currentProjectId,
  onSelectProject,
  onToggleSidebar,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-14 px-4 border-b bg-[hsl(var(--card))]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>

        <a href="/" className="flex items-center gap-2 font-semibold text-lg">
          <Zap className="h-5 w-5" />
          <span>GodMode</span>
        </a>

        <select
          value={currentProjectId ?? ''}
          onChange={(e) => onSelectProject(e.target.value || null)}
          className="ml-4 h-9 rounded-md border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">Select Project...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
