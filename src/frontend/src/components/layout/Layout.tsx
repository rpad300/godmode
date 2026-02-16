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
