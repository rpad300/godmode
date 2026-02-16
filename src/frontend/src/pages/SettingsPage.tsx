import { useState, useCallback, useEffect } from 'react';
import { Settings, Sun, Moon, Monitor, Database, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useResetData } from '../hooks/useGodMode';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/Dialog';

type SettingsTab = 'general' | 'data';

function getStoredTheme(): string {
  try {
    return localStorage.getItem('godmode-theme') || 'system';
  } catch {
    return 'system';
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [theme, setTheme] = useState(getStoredTheme);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const resetData = useResetData();

  // Apply theme
  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('godmode-theme', theme);
  }, [theme]);

  const handleClearCache = useCallback(() => {
    try {
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith('godmode-') && k !== 'godmode-theme' && k !== 'godmode-project-id'
      );
      keys.forEach((k) => localStorage.removeItem(k));
      alert(`Cleared ${keys.length} cached items`);
    } catch {}
  }, []);

  const handleResetConfirm = useCallback(() => {
    resetData.mutate({ clearArchived: true }, {
      onSettled: () => setClearDialogOpen(false),
    });
  }, [resetData]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'general'
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]'
              : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          )}
        >
          <Sun className="h-4 w-4" />
          General
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'data'
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]'
              : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          )}
        >
          <Database className="h-4 w-4" />
          Data & Privacy
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6 max-w-lg">
          {/* Theme */}
          <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
            <h3 className="text-sm font-semibold uppercase text-[hsl(var(--muted-foreground))] mb-3">
              Appearance
            </h3>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="flex gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-colors',
                      theme === option.value
                        ? 'bg-[hsl(var(--accent))] border-[hsl(var(--ring))] font-medium'
                        : 'hover:bg-[hsl(var(--accent))]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
              Choose your preferred color scheme. System follows your OS setting.
            </p>
          </div>
        </div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6 max-w-lg">
          {/* Clear Cache */}
          <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
            <h3 className="text-sm font-semibold uppercase text-[hsl(var(--muted-foreground))] mb-3">
              Local Data
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
              Clear cached data stored in your browser. This does not affect server data.
            </p>
            <Button variant="secondary" onClick={handleClearCache}>
              <Database className="h-4 w-4" />
              Clear Local Cache
            </Button>
          </div>

          {/* Reset Project Data */}
          <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--card))] p-4">
            <h3 className="text-sm font-semibold uppercase text-[hsl(var(--destructive))] mb-3">
              Danger Zone
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
              Reset all project knowledge data. This will permanently delete facts, decisions,
              questions, risks, and actions. Team, contacts, and cost data will be preserved.
            </p>
            <Button variant="destructive" onClick={() => setClearDialogOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Reset Project Data
            </Button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Reset Project Data</DialogTitle>
          <DialogDescription>
            Are you sure? This will permanently delete all knowledge data for the current project.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleResetConfirm}
            disabled={resetData.isPending}
          >
            {resetData.isPending ? 'Resetting...' : 'Reset Data'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
