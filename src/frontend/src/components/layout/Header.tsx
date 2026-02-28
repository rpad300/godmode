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
import { useState } from 'react';
import { Moon, Sun, Zap, Menu, LogOut, Bell, Plus } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { Project } from '../../hooks/useGodMode';
import { useNotificationsCount } from '../../hooks/useGodMode';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsPanel } from './NotificationsPanel';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onToggleSidebar: () => void;
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotificationsCount();
  const count = data?.count ?? 0;
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(prev => !prev)} title="Notifications" className="relative">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>
      <NotificationsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
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

        {projects.length > 0 ? (
          <select
            value={currentProjectId ?? ''}
            onChange={(e) => onSelectProject(e.target.value || null)}
            className="ml-4 h-9 rounded-md border bg-[hsl(var(--card))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            <option value="">Select Project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        ) : (
          <Link
            to="/projects"
            className="ml-4 inline-flex items-center gap-1.5 h-9 rounded-md border border-dashed border-[hsl(var(--primary))] bg-transparent px-3 text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Project
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearch />
        <NotificationsBell />
        <Button variant="ghost" size="icon" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <LogoutButton />
      </div>
    </header>
  );
}
