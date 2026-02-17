/**
 * Purpose:
 *   Alternative top-bar header used in the react-router-based layout.
 *   Provides branding, project selection, theme toggle, and logout.
 *
 * Responsibilities:
 *   - Renders the GodMode logo linking to the root route
 *   - Project selector dropdown driven by the projects prop
 *   - Dark/light theme toggle button (state managed by parent)
 *   - Hamburger menu button for toggling the sidebar on mobile
 *   - LogoutButton sub-component that calls AuthContext.logout and
 *     navigates to /login
 *
 * Key dependencies:
 *   - AuthContext (useAuth): provides the logout function
 *   - react-router-dom (useNavigate): post-logout redirect
 *   - Project type (useGodMode): project list shape
 *
 * Side effects:
 *   - LogoutButton triggers an async logout (clears session) and navigates
 *
 * Notes:
 *   - This header coexists with AppHeader.tsx; Header is used inside the
 *     react-router Layout while AppHeader is used in the legacy tab-based
 *     AppLayout. Assumption: one will be removed during consolidation.
 */
import { Moon, Sun, Zap, Menu, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { Project } from '../../hooks/useGodMode';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onToggleSidebar: () => void;
}

function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Sign out"
      onClick={async () => { await logout(); navigate('/login'); }}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
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
        <LogoutButton />
      </div>
    </header>
  );
}
