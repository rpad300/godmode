import { useState, useCallback, useEffect } from 'react';
import {
  Settings, Sun, Moon, Monitor, Database, Trash2, User, Cpu, Save,
  Loader2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useResetData, useProjectConfig, useUpdateProjectConfig } from '../hooks/useGodMode';
import { useUser } from '../hooks/useUser';

type SettingsTab = 'profile' | 'project' | 'data';

function getStoredTheme(): string {
  try { return localStorage.getItem('godmode-theme') || 'system'; } catch { return 'system'; }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [theme, setTheme] = useState(getStoredTheme);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const { user, updateProfile } = useUser();
  const config = useProjectConfig();
  const updateConfig = useUpdateProjectConfig();
  const resetData = useResetData();

  // Local form state
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [projectName, setProjectName] = useState('');
  const [llmProvider, setLlmProvider] = useState('');

  // Sync from server
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setTimezone(user.timezone || '');
    }
  }, [user]);

  useEffect(() => {
    if (config.data) {
      setProjectName(config.data.projectName || '');
      setLlmProvider(config.data.llm?.provider || '');
    }
  }, [config.data]);

  // Apply theme
  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('godmode-theme', theme);
  }, [theme]);

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { display_name: displayName, timezone, theme },
      { onSuccess: () => toast.success('Profile updated') },
    );
  };

  const handleSaveProject = () => {
    updateConfig.mutate(
      { projectName, llm: { ...config.data?.llm, provider: llmProvider } },
      { onSuccess: () => toast.success('Project settings saved') },
    );
  };

  const handleClearCache = useCallback(() => {
    const keys = Object.keys(localStorage).filter(
      k => k.startsWith('godmode-') && k !== 'godmode-theme' && k !== 'godmode-project-id'
    );
    keys.forEach(k => localStorage.removeItem(k));
    toast.success(`Cleared ${keys.length} cached items`);
  }, []);

  const handleResetConfirm = useCallback(() => {
    resetData.mutate({ clearArchived: true }, {
      onSuccess: () => { toast.success('Project data reset'); setClearDialogOpen(false); },
      onSettled: () => setClearDialogOpen(false),
    });
  }, [resetData]);

  const tabs: { key: SettingsTab; label: string; icon: typeof Settings }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'project', label: 'Project', icon: Cpu },
    { key: 'data', label: 'Data & Privacy', icon: Database },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 max-w-md">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-lg">
          {/* User info */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User Profile</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <p className="text-sm text-foreground mt-1">{user?.email || '—'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timezone</label>
              <input
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Europe/Lisbon"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
            >
              {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Profile
            </button>
          </div>

          {/* Appearance */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Appearance</h3>
            <div className="flex gap-2">
              {([
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ] as const).map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors',
                      theme === option.value
                        ? 'bg-primary/10 border-primary/30 text-foreground font-medium'
                        : 'border-border hover:bg-secondary text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" /> {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Choose your preferred color scheme.</p>
          </div>
        </div>
      )}

      {/* Project Tab */}
      {activeTab === 'project' && (
        <div className="space-y-6 max-w-lg">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project Configuration</h3>
            {config.isLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading config...
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project Name</label>
                  <input
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="My Project"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">LLM Provider</label>
                  <select
                    value={llmProvider}
                    onChange={e => setLlmProvider(e.target.value)}
                    className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select provider</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="ollama">Ollama (local)</option>
                    <option value="groq">Groq</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
                {config.data?.llm?.models && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Configured Models</label>
                    <div className="mt-1 space-y-1">
                      {Object.entries(config.data.llm.models).map(([task, model]) => (
                        <div key={task} className="flex items-center justify-between text-xs bg-secondary/50 rounded-lg px-3 py-1.5">
                          <span className="text-muted-foreground capitalize">{task.replace(/_/g, ' ')}</span>
                          <span className="text-foreground font-medium">{model as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSaveProject}
                  disabled={updateConfig.isPending}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updateConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Project Settings
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6 max-w-lg">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Local Data</h3>
            <p className="text-sm text-muted-foreground">Clear cached data stored in your browser. This does not affect server data.</p>
            <button onClick={handleClearCache} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Clear Local Cache
            </button>
          </div>

          <div className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-medium text-destructive uppercase tracking-wider">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">
              Reset all project knowledge data. This permanently deletes facts, decisions, questions, risks, and actions.
            </p>
            {!clearDialogOpen ? (
              <button onClick={() => setClearDialogOpen(true)} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Reset Project Data
              </button>
            ) : (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-destructive">Are you sure? This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setClearDialogOpen(false)} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">
                    Cancel
                  </button>
                  <button onClick={handleResetConfirm} disabled={resetData.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 flex items-center gap-1.5 disabled:opacity-50">
                    {resetData.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Confirm Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
