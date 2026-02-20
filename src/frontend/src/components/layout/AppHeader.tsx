import { useState, useEffect } from 'react';
import { Zap, Bell, Moon, Sun, User, Settings, LogOut, Keyboard, Check, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import type { TabId } from '@/types/godmode';
import { useProject } from '@/contexts/ProjectContext';
import { useNotificationsCount, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification } from '@/hooks/useGodMode';
import { useUser } from '@/hooks/useUser';
import { isValidAvatarUrl, getInitials } from '@/lib/utils';

interface AppHeaderProps {
  onNavigate: (tab: TabId) => void;
}

const AppHeader = ({ onNavigate }: AppHeaderProps) => {
  const { projects, currentProjectId, setCurrentProject } = useProject();
  const { data: notifData } = useNotificationsCount();
  const { data: notifListData, isLoading: notifLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();
  const { user } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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

  const notifCount = (notifData as any)?.count ?? 0;
  const notifications = (notifListData as any)?.notifications ?? [];
  const displayName = user?.display_name || user?.username || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '—';

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
              <option key={p.id} value={p.id}>{p.name || '(unnamed)'}</option>
            ))}
            <option value="create-new">+ New Project</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors relative" title="Notifications">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-12 w-80 max-h-[420px] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">No notifications</div>
                  ) : (
                    notifications.slice(0, 30).map((n: any) => (
                      <div key={n.id} className={`px-3 py-2.5 border-b border-border/50 flex items-start gap-2 group ${n.read ? 'opacity-60' : ''}`}>
                        <div className="flex-1 min-w-0">
                          {n.title && <p className="text-xs font-medium text-foreground truncate">{n.title}</p>}
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message || '—'}</p>
                          <span className="text-[9px] text-muted-foreground/60">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button onClick={() => markRead.mutate(n.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary" title="Mark read">
                              <Check className="w-3 h-3 text-muted-foreground" />
                            </button>
                          )}
                          <button onClick={() => deleteNotif.mutate(n.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10" title="Delete">
                            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <button onClick={() => setIsDark(!isDark)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors" title="Toggle theme">
          {isDark ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors border-2 border-primary/50 overflow-hidden"
          >
            {isValidAvatarUrl(user?.avatar_url) ? (
              <img src={user!.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span className="text-[10px] font-bold text-primary">{getInitials(displayName)}</span>
            )}
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-12 w-56 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
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
