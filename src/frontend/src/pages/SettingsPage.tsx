import { useState, useCallback, useEffect } from 'react';
import {
  Settings, Sun, Moon, Monitor, Database, Trash2, User, Cpu, Save,
  Loader2, Key, Webhook, Plus, Copy, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  useResetData, useProjectConfig, useUpdateProjectConfig,
  useApiKeys, useCreateApiKey, useDeleteApiKey,
  useWebhooks, useCreateWebhook, useDeleteWebhook, useTestWebhook,
} from '../hooks/useGodMode';
import { useUser } from '../hooks/useUser';

type SettingsTab = 'profile' | 'project' | 'apikeys' | 'webhooks' | 'data';

function getStoredTheme(): string {
  try { return localStorage.getItem('godmode-theme') || 'system'; } catch { return 'system'; }
}

function getProjectId(): string {
  try { return localStorage.getItem('godmode_current_project') || 'default'; } catch { return 'default'; }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [theme, setTheme] = useState(getStoredTheme);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const { user, updateProfile } = useUser();
  const config = useProjectConfig();
  const updateConfig = useUpdateProjectConfig();
  const resetData = useResetData();

  const projectId = getProjectId();

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
    { key: 'apikeys', label: 'API Keys', icon: Key },
    { key: 'webhooks', label: 'Webhooks', icon: Webhook },
    { key: 'data', label: 'Data', icon: Database },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 max-w-2xl overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* API Keys Tab */}
      {activeTab === 'apikeys' && <ApiKeysTab projectId={projectId} />}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && <WebhooksTab projectId={projectId} />}

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

// ── API Keys Tab ──

function ApiKeysTab({ projectId }: { projectId: string }) {
  const apiKeys = useApiKeys(projectId);
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('90');
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  const keys = apiKeys.data?.keys ?? [];

  const handleCreate = () => {
    if (!keyName.trim()) return;
    createKey.mutate(
      { projectId, name: keyName.trim(), expires_in_days: Number(expiresInDays) || undefined },
      {
        onSuccess: (data: any) => {
          setNewRawKey(data.raw_key || null);
          setKeyName('');
          setShowCreate(false);
          toast.success('API key created');
        },
        onError: () => toast.error('Failed to create API key'),
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteKey.mutate(id, {
      onSuccess: () => toast.success('API key revoked'),
      onError: () => toast.error('Failed to revoke key'),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Keys</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Create Key
        </button>
      </div>

      {newRawKey && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-warning">Copy your new API key now — it won't be shown again.</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs font-mono text-foreground break-all">{newRawKey}</code>
            <button onClick={() => copyToClipboard(newRawKey)} className="px-3 py-2 rounded-lg bg-secondary hover:bg-muted">
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <button onClick={() => setNewRawKey(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key Name</label>
            <input
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Production API"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expires In (days)</label>
            <select
              value={expiresInDays}
              onChange={e => setExpiresInDays(e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="">Never</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreate} disabled={createKey.isPending || !keyName.trim()} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
              {createKey.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      )}

      {apiKeys.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : keys.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No API keys yet. Create one to access the API programmatically.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(key => (
            <div key={key.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{key.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {key.key_prefix && <span className="text-[10px] font-mono text-muted-foreground">{key.key_prefix}...</span>}
                  <span className="text-[10px] text-muted-foreground">Created {new Date(key.created_at).toLocaleDateString()}</span>
                  {key.expires_at && <span className="text-[10px] text-muted-foreground">Expires {new Date(key.expires_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <button onClick={() => handleDelete(key.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhooks Tab ──

function WebhooksTab({ projectId }: { projectId: string }) {
  const webhooks = useWebhooks(projectId);
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);

  const webhookList = webhooks.data?.webhooks ?? [];

  const availableEvents = [
    'document.processed', 'document.created', 'document.deleted',
    'entity.created', 'entity.updated', 'entity.deleted',
    'contact.created', 'contact.updated',
    'email.received', 'email.processed',
  ];

  const toggleEvent = (event: string) => {
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const handleCreate = () => {
    if (!url.trim() || events.length === 0) return;
    createWebhook.mutate(
      { projectId, url: url.trim(), events },
      {
        onSuccess: () => {
          toast.success('Webhook created');
          setUrl('');
          setEvents([]);
          setShowCreate(false);
        },
        onError: () => toast.error('Failed to create webhook'),
      },
    );
  };

  const handleTest = (id: string) => {
    testWebhook.mutate(id, {
      onSuccess: () => toast.success('Test webhook sent'),
      onError: () => toast.error('Test delivery failed'),
    });
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Webhooks</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Endpoint URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://your-server.com/webhook"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Events</label>
            <div className="flex flex-wrap gap-1.5">
              {availableEvents.map(event => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[10px] font-medium transition-colors border',
                    events.includes(event)
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleCreate} disabled={createWebhook.isPending || !url.trim() || events.length === 0} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
              {createWebhook.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      )}

      {webhooks.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : webhookList.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
          <Webhook className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No webhooks configured. Add one to receive real-time event notifications.
        </div>
      ) : (
        <div className="space-y-2">
          {webhookList.map(wh => (
            <div key={wh.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-mono text-foreground truncate flex-1 mr-2">{wh.url}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTest(wh.id)} disabled={testWebhook.isPending} className="px-2 py-1 rounded-md bg-secondary text-[10px] text-muted-foreground hover:text-foreground">
                    Test
                  </button>
                  <button onClick={() => deleteWebhook.mutate(wh.id, { onSuccess: () => toast.success('Webhook deleted') })} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {wh.events.map(evt => (
                  <span key={evt} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{evt}</span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Created {new Date(wh.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
