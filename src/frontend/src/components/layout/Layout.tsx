/**
 * Purpose:
 *   Root layout component for the react-router-based application shell.
 *   Composes Header, AppSidebar, and the routed <Outlet /> into a
 *   full-screen flexbox layout.
 *
 * Responsibilities:
 *   - Wires up theme toggling via useTheme hook
 *   - Manages project selection via useProject hook
 *   - Controls sidebar open/close state for mobile responsiveness
 *   - Renders the <Outlet /> for nested route content
 *
 * Key dependencies:
 *   - Header: top navigation bar (branding, project selector, theme toggle)
 *   - AppSidebar: side navigation and file management panel
 *   - useTheme: theme state and toggle function
 *   - useProject: project list, current project ID, and setter
 *   - react-router-dom (Outlet): renders matched child routes
 *
 * Side effects:
 *   - None directly; delegates to Header and AppSidebar
 *
 * Notes:
 *   - This is the react-router equivalent of AppLayout.tsx. Both exist
 *     in the codebase during a migration from tab-based to route-based
 *     navigation. Assumption: AppLayout will be deprecated.
 */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AppSidebar } from './AppSidebar';
import { useTheme } from '../../hooks/useTheme';
import { useProject } from '../../hooks/useProject';

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { projectId, setProjectId, projects } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        projects={projects}
        currentProjectId={projectId}
        onSelectProject={setProjectId}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
