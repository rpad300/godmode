import { useState, useEffect } from 'react';
import { Zap, Bell, Moon, Sun, User, Settings, LogOut, Keyboard } from 'lucide-react';
import type { TabId } from '@/types/godmode';
import { useProject } from '@/contexts/ProjectContext';

interface AppHeaderProps {
  onNavigate: (tab: TabId) => void;
}

const AppHeader = ({ onNavigate }: AppHeaderProps) => {
  const { projects, currentProjectId, setCurrentProject } = useProject();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleNav = (tab: TabId) => {
    setShowUserMenu(false);
    onNavigate(tab);
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 z-50 relative">
      <div className="flex items-center gap-3">
        <button onClick={() => handleNav('dashboard')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </span>
          <span className="text-lg font-bold gradient-text hidden sm:inline">GodMode</span>
        </button>
        <div className="hidden sm:flex items-center gap-2 ml-4">
          <select
            value={currentProjectId}
            onChange={(e) => setCurrentProject(e.target.value)}
            className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.length === 0 && <option value="default">Loading Projects...</option>}
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="create-new">+ New Project</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors relative" title="Notifications">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">3</span>
        </button>
        <button onClick={() => setIsDark(!isDark)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors" title="Toggle theme">
          {isDark ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors border-2 border-primary/50"
          >
            <User className="w-4 h-4 text-primary" />
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-12 w-56 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">RPAD</p>
                  <p className="text-xs text-muted-foreground">admin@godmode.ai</p>
                </div>
                <div className="p-1">
                  <button onClick={() => handleNav('profile')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary rounded-md transition-colors">
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button onClick={() => handleNav('settings')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary rounded-md transition-colors">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary rounded-md transition-colors">
                    <Keyboard className="w-4 h-4" /> Shortcuts
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
