import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Settings, Sun, Moon, Monitor, Database, Trash2, User, Cpu, Save,
  Loader2, Key, Webhook, Plus, Copy, X, TestTube, Zap, Download, RefreshCw, CheckCircle,
  Globe, Shield, Eye, BarChart3, Bot, ChevronRight, Check, Languages, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  useResetData, useProjectConfig, useUpdateProjectConfig,
  useApiKeys, useCreateApiKey, useDeleteApiKey,
  useWebhooks, useCreateWebhook, useDeleteWebhook, useTestWebhook,
  useLLMCapabilities, useLLMRoutingStatus, useUpdateLLMRouting,
  useTestLLMProvider, useOllamaModels, useOllamaTest,
  useOllamaRecommended, useOllamaPull, useModelUnload,
  useProjectProviders, useSaveProjectProviderKey, useDeleteProjectProviderKey,
} from '../hooks/useGodMode';
import type { ProjectProviderStatus } from '../hooks/useGodMode';
import { useLLMModelsByProvider } from '../hooks/useAdmin';
import { useUser } from '../hooks/useUser';
import { useProject } from '../hooks/useProject';

type SettingsTab = 'profile' | 'project' | 'apikeys' | 'webhooks' | 'data';

// ── Style tokens (aligned with ProfilePage) ─────────────────────────────────

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
const LABEL = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1.5';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'project', label: 'Project', icon: Cpu },
  { id: 'apikeys', label: 'API Keys', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'data', label: 'Data', icon: Database },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStoredTheme(): string {
  try { return localStorage.getItem('godmode-theme') || 'system'; } catch { return 'system'; }
}

function getProjectId(): string {
  try { return localStorage.getItem('godmode_current_project') || 'default'; } catch { return 'default'; }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="flex h-full">
      {/* Side Nav */}
      <div className="w-48 shrink-0 border-r border-[var(--gm-border-primary)] bg-[var(--gm-bg-primary)] overflow-y-auto">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--gm-border-primary)]">
          <div className="w-7 h-7 rounded-full bg-[var(--gm-interactive-primary)]/10 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-[var(--gm-accent-primary)]" />
          </div>
          <span className="text-sm font-bold text-[var(--gm-accent-primary)]">Settings</span>
        </div>
        <nav className="py-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={cn('w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors',
                  active ? 'text-[var(--gm-accent-primary)] bg-[var(--gm-surface-hover)] font-semibold' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)]')}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'profile' && <ProfileSection />}
        {activeTab === 'project' && <ProjectSection />}
        {activeTab === 'apikeys' && <ApiKeysSection projectId={getProjectId()} />}
        {activeTab === 'webhooks' && <WebhooksSection projectId={getProjectId()} />}
        {activeTab === 'data' && <DataSection />}
      </div>
    </div>
  );
}

// ── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, updateProfile } = useUser();
  const [theme, setTheme] = useState(getStoredTheme);
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [language, setLanguage] = useState('en');

  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [errorReporting, setErrorReporting] = useState(true);
  const [aiDataImprovement, setAiDataImprovement] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setTimezone(user.timezone || '');
      setLanguage((user as Record<string, unknown>).language as string || 'en');
    }
  }, [user]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('godmode-privacy');
      if (stored) {
        const p = JSON.parse(stored);
        setAnalyticsEnabled(p.analytics !== false);
        setErrorReporting(p.errorReporting !== false);
        setAiDataImprovement(p.aiDataImprovement === true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('godmode-theme', theme);
  }, [theme]);

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { display_name: displayName, timezone, theme, language } as Record<string, unknown>,
      { onSuccess: () => toast.success('Profile updated') },
    );
  };

  const handleSavePrivacy = () => {
    localStorage.setItem('godmode-privacy', JSON.stringify({ analytics: analyticsEnabled, errorReporting, aiDataImprovement }));
    toast.success('Privacy preferences saved');
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Profile" subtitle="Manage your account info, appearance, and privacy" />

      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={SECTION_TITLE}>User Profile</h3>
        <div>
          <label className={LABEL}><User className="w-3 h-3" /> Email</label>
          <input value={user?.email || ''} readOnly className={cn(INPUT, 'opacity-60 cursor-not-allowed')} />
        </div>
        <div>
          <label className={LABEL}>Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name..." className={INPUT} />
        </div>
        <div>
          <label className={LABEL}><Globe className="w-3 h-3" /> Timezone</label>
          <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="e.g. Europe/Lisbon" className={INPUT} />
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={handleSaveProfile} disabled={updateProfile.isPending} className={BTN_PRIMARY}>
            {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Profile
          </button>
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Appearance</h3>
        <div className="flex gap-2">
          {([
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'system', label: 'System', icon: Monitor },
          ] as const).map(option => {
            const Icon = option.icon;
            return (
              <button key={option.value} onClick={() => setTheme(option.value)}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-lg border text-xs transition-all duration-150',
                  theme === option.value
                    ? 'bg-[var(--gm-interactive-primary)]/10 border-[var(--gm-accent-primary)]/30 text-[var(--gm-text-primary)] font-medium'
                    : 'border-[var(--gm-border-primary)] hover:bg-[var(--gm-surface-hover)] text-[var(--gm-text-tertiary)]')}>
                <Icon className="h-3.5 w-3.5" /> {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}><Languages className="w-3 h-3 inline mr-1" /> Language</h3>
        <div className="flex gap-2">
          {([
            { value: 'en', label: 'English' },
            { value: 'pt', label: 'Português' },
            { value: 'es', label: 'Español' },
          ] as const).map(option => (
            <button key={option.value} onClick={() => setLanguage(option.value)}
              className={cn('px-4 py-2 rounded-lg border text-xs transition-all duration-150',
                language === option.value
                  ? 'bg-[var(--gm-interactive-primary)]/10 border-[var(--gm-accent-primary)]/30 text-[var(--gm-text-primary)] font-medium'
                  : 'border-[var(--gm-border-primary)] hover:bg-[var(--gm-surface-hover)] text-[var(--gm-text-tertiary)]')}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}><Shield className="w-3 h-3 inline mr-1" /> Data & Privacy</h3>
        {([
          { key: 'analytics', label: 'Analytics', desc: 'Help us improve by sharing anonymized usage data', icon: BarChart3, state: analyticsEnabled, setter: setAnalyticsEnabled },
          { key: 'errorReporting', label: 'Error Reporting', desc: 'Automatically report crashes and errors', icon: Eye, state: errorReporting, setter: setErrorReporting },
          { key: 'aiData', label: 'AI Data Improvement', desc: 'Allow anonymized data to improve AI model quality', icon: Bot, state: aiDataImprovement, setter: setAiDataImprovement },
        ] as const).map(opt => (
          <div key={opt.key} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <opt.icon className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
              <div>
                <p className="text-xs font-medium text-[var(--gm-text-primary)]">{opt.label}</p>
                <p className="text-[10px] text-[var(--gm-text-tertiary)]">{opt.desc}</p>
              </div>
            </div>
            <button onClick={() => opt.setter(!opt.state)}
              className={cn('relative w-9 h-5 rounded-full transition-colors', opt.state ? 'bg-[var(--gm-interactive-primary)]' : 'bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)]')}
              role="switch" aria-checked={opt.state}>
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', opt.state ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </button>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <button onClick={handleSavePrivacy} className={BTN_SECONDARY}>
            <Save className="w-3.5 h-3.5" /> Save Privacy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Section ──────────────────────────────────────────────────────────

function ProjectSection() {
  const { currentProject } = useProject();
  const config = useProjectConfig();
  const updateConfig = useUpdateProjectConfig();
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (currentProject?.name) {
      setProjectName(currentProject.name);
    } else if (config.data?.projectName) {
      setProjectName(config.data.projectName);
    }
  }, [currentProject, config.data]);

  const handleSaveProject = () => {
    updateConfig.mutate(
      { projectName },
      { onSuccess: () => toast.success('Project settings saved') },
    );
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Project" subtitle="Project name, API keys, AI configuration, and diagnostics" />

      <div className={cn(CARD, 'p-5 space-y-5')}>
        <h3 className={SECTION_TITLE}>Project Configuration</h3>
        {config.isLoading ? (
          <div className="flex items-center gap-2 py-4 text-[var(--gm-text-tertiary)] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading config...
          </div>
        ) : (
          <>
            <div>
              <label className={LABEL}>Project Name</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} className={INPUT} placeholder="My Project" />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleSaveProject} disabled={updateConfig.isPending} className={BTN_PRIMARY}>
                {updateConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Project
              </button>
            </div>
          </>
        )}
      </div>

      <LLMDiagnosticsSection />
      <OllamaSection />
    </div>
  );
}

// ── Project LLM Provider Keys + Task Config ──────────────────────────────────

function ProjectTaskModelSelector({ task, taskLabel, currentProvider, currentModel, providerList, onProviderChange, onModelChange }: {
  task: string;
  taskLabel: string;
  currentProvider: string;
  currentModel: string;
  providerList: Array<{ id: string; name: string }>;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}) {
  const { data: modelsData, isLoading: modelsLoading, isError: modelsError } = useLLMModelsByProvider(currentProvider || null);
  const [manualMode, setManualMode] = useState(false);

  const modelOptions = useMemo(() => {
    if (!modelsData) return [];
    const resp = modelsData as Record<string, unknown>;
    const text = (resp.textModels ?? []) as Array<{ id: string; name?: string; contextTokens?: number }>;
    const vision = (resp.visionModels ?? []) as Array<{ id: string; name?: string }>;
    const embedding = (resp.embeddingModels ?? []) as Array<{ id: string; name?: string }>;
    if (task === 'vision') return vision;
    if (task === 'embeddings') return embedding;
    return text;
  }, [modelsData, task]);

  const hasModels = modelOptions.length > 0;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-[var(--gm-text-primary)] capitalize">{taskLabel}</span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>PROVIDER</label>
          <select
            value={currentProvider}
            onChange={e => { onProviderChange(e.target.value); setManualMode(false); }}
            className={cn(INPUT, 'w-full text-xs')}
          >
            <option value="">Select...</option>
            {providerList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-[10px] text-[var(--gm-accent-primary)] mt-0.5 block">{providerList.length} provider(s) with project keys</span>
        </div>
        <div>
          <label className={LABEL}>MODEL</label>
          {modelsLoading && currentProvider ? (
            <div className={cn(INPUT, 'w-full text-xs flex items-center gap-2')}>
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              <span className="text-[var(--gm-text-tertiary)]">Loading models...</span>
            </div>
          ) : hasModels && !manualMode ? (
            <>
              <select
                value={currentModel}
                onChange={e => onModelChange(e.target.value)}
                className={cn(INPUT, 'w-full text-xs')}
              >
                <option value="">Select model...</option>
                {modelOptions.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                    {(m as Record<string, unknown>).contextTokens ? ` (${Math.round(Number((m as Record<string, unknown>).contextTokens) / 1000)}K ctx)` : ''}
                  </option>
                ))}
              </select>
              <button onClick={() => setManualMode(true)} className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5 block">
                or type manually
              </button>
            </>
          ) : (
            <>
              <input
                value={currentModel}
                onChange={e => onModelChange(e.target.value)}
                className={cn(INPUT, 'w-full text-xs')}
                placeholder={currentProvider ? 'e.g. gpt-4o' : 'Select a provider first'}
              />
              {hasModels && manualMode && (
                <button onClick={() => setManualMode(false)} className="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5 block">
                  back to dropdown
                </button>
              )}
              {modelsError && currentProvider && (
                <span className="text-[10px] text-amber-400 mt-0.5 block">Could not load models — type manually</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectProvidersSection({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useProjectProviders(projectId);
  const saveKey = useSaveProjectProviderKey();
  const deleteKey = useDeleteProjectProviderKey();
  const updateConfig = useUpdateProjectConfig();
  const config = useProjectConfig();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keyEdits, setKeyEdits] = useState<Record<string, string>>({});
  const [taskEdits, setTaskEdits] = useState<Record<string, { provider: string; model: string }>>({});

  const providers: ProjectProviderStatus[] = Array.isArray(data?.providers) ? data.providers : [];

  const llmConfig = config.data?.llm;
  const perTask = ((llmConfig as Record<string, unknown>)?.perTask ?? { text: {}, vision: {}, embeddings: {} }) as Record<string, Record<string, string>>;

  const configuredProviders = useMemo(() =>
    providers.filter(p => p.hasProjectKey).map(p => ({ id: p.id, name: p.name })),
  [providers]);

  const handleSaveKeys = useCallback(() => {
    const edits = Object.entries(keyEdits).filter(([, v]) => v.trim().length > 0);
    if (edits.length === 0) { toast.info('No changes to save'); return; }
    let savedCount = 0;
    const total = edits.length;
    for (const [id, key] of edits) {
      saveKey.mutate({ projectId, provider: id, apiKey: key }, {
        onSuccess: () => {
          savedCount++;
          if (savedCount === total) {
            toast.success(`${total} API key${total > 1 ? 's' : ''} saved to encrypted vault`);
            setKeyEdits({});
          }
        },
        onError: (e: Error) => toast.error(`Failed to save ${id}: ${e.message}`),
      });
    }
  }, [keyEdits, saveKey, projectId]);

  const handleDeleteKey = useCallback((providerId: string) => {
    deleteKey.mutate({ projectId, provider: providerId }, {
      onSuccess: () => toast.success(`${providerId} project key removed — will use system key`),
      onError: () => toast.error('Failed to remove key'),
    });
  }, [deleteKey, projectId]);

  const handleSaveTaskConfig = useCallback(() => {
    if (Object.keys(taskEdits).length === 0) { toast.info('No changes to save'); return; }
    updateConfig.mutate({ llm: { perTask: taskEdits } }, {
      onSuccess: () => { toast.success('Project AI configuration saved'); setTaskEdits({}); },
      onError: (e: Error) => toast.error(e.message),
    });
  }, [taskEdits, updateConfig]);

  const hasKeyEdits = Object.values(keyEdits).some(v => v.trim().length > 0);

  return (
    <div className="space-y-5">
      {/* Info box */}
      <div className={cn(CARD, 'p-4 border-l-2 border-[var(--gm-accent-primary)]')}>
        <h4 className="text-xs font-semibold text-[var(--gm-accent-primary)] mb-2">Project BYOK (Bring Your Own Key)</h4>
        <div className="text-[11px] text-[var(--gm-text-secondary)] space-y-1">
          <p>Set your own API keys per provider for this project. <strong>Project keys</strong> take priority over system keys — billing goes directly to your provider account.</p>
          <p>When no project key is set, the <span className="text-blue-400 font-medium">system key</span> is used and your project balance is debited.</p>
        </div>
      </div>

      {/* Provider API Keys */}
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <div className="flex items-center justify-between">
          <h3 className={SECTION_TITLE}><Key className="w-3 h-3 inline mr-1" /> Project LLM API Keys</h3>
          {!isLoading && (
            <span className="text-[10px] text-[var(--gm-text-tertiary)]">
              {providers.filter(p => p.hasProjectKey).length}/{providers.length} with project keys
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-[var(--gm-text-tertiary)] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading providers...
          </div>
        ) : isError ? (
          <p className="text-xs text-red-400">Failed to load provider status.</p>
        ) : (
          <>
            {providers.map(p => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--gm-accent-primary)]">{p.name}</span>
                  {p.hasProjectKey ? (
                    <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Project Key</span>
                  ) : p.hasSystemKey ? (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> System Key</span>
                  ) : (
                    <span className="text-[10px] text-amber-400">Not configured</span>
                  )}
                  {p.hasProjectKey && (
                    <button
                      onClick={() => handleDeleteKey(p.id)}
                      disabled={deleteKey.isPending}
                      className="text-[10px] text-red-400 hover:text-red-300 ml-1"
                      title="Remove project key"
                    >
                      <Trash2 className="w-3 h-3 inline" /> Remove
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type={showKeys[p.id] ? 'text' : 'password'}
                    value={keyEdits[p.id] ?? ''}
                    onChange={e => setKeyEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.masked || `Enter ${p.name} API key...`}
                    className={cn(INPUT, 'flex-1 font-mono text-xs')}
                  />
                  <button onClick={() => setShowKeys(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className={BTN_SECONDARY}>
                    {showKeys[p.id] ? 'Hide' : 'Show'}
                  </button>
                </div>
                {p.masked && p.hasProjectKey && !keyEdits[p.id] && (
                  <p className="text-[10px] text-[var(--gm-text-tertiary)] font-mono pl-1">Current: {p.masked}</p>
                )}
              </div>
            ))}
            <button onClick={handleSaveKeys} disabled={saveKey.isPending || !hasKeyEdits} className={BTN_PRIMARY}>
              {saveKey.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save to Encrypted Vault
            </button>
          </>
        )}
      </div>

      {/* Task-Specific AI Config (only providers with project keys) */}
      {configuredProviders.length > 0 && (
        <div className={cn(CARD, 'p-5 space-y-5')}>
          <div>
            <h3 className={SECTION_TITLE}>Task-Specific AI Configuration</h3>
            <p className="text-xs text-[var(--gm-text-tertiary)] mt-1">
              Override which provider and model to use for each AI task in this project. Only providers with project keys are available.
            </p>
          </div>
          {Object.entries(perTask).map(([task, cfg]) => {
            const taskLabel = task.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
            const currentProvider = taskEdits[task]?.provider ?? cfg?.provider ?? '';
            const currentModel = taskEdits[task]?.model ?? cfg?.model ?? '';
            return (
              <ProjectTaskModelSelector
                key={task}
                task={task}
                taskLabel={taskLabel}
                currentProvider={currentProvider}
                currentModel={currentModel}
                providerList={configuredProviders}
                onProviderChange={(provider) => setTaskEdits(prev => ({ ...prev, [task]: { provider, model: '' } }))}
                onModelChange={(model) => setTaskEdits(prev => ({ ...prev, [task]: { provider: prev[task]?.provider ?? cfg?.provider ?? '', model } }))}
              />
            );
          })}
          <div className="flex items-center gap-3">
            <button onClick={handleSaveTaskConfig} disabled={updateConfig.isPending || Object.keys(taskEdits).length === 0} className={BTN_PRIMARY}>
              {updateConfig.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save AI Configuration
            </button>
            <span className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overrides system config for this project</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LLM Diagnostics ──────────────────────────────────────────────────────────

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string') return v || '—';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : '—';
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return '—';
    return entries.map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}`).join(' · ');
  }
  return String(v);
}

function LLMDiagnosticsSection() {
  const capabilities = useLLMCapabilities();
  const routing = useLLMRoutingStatus();
  const testProvider = useTestLLMProvider();
  const [testTarget, setTestTarget] = useState('');

  const caps = (capabilities.data || {}) as Record<string, unknown>;
  const routingData = (routing.data || {}) as Record<string, unknown>;

  const providerNames: Record<string, string> = {
    ollama: 'Ollama', openai: 'OpenAI', google: 'Google Gemini', gemini: 'Google Gemini',
    grok: 'Grok / xAI', xai: 'Grok / xAI', deepseek: 'DeepSeek',
    anthropic: 'Claude / Anthropic', claude: 'Claude', kimi: 'Kimi', minimax: 'MiniMax',
  };

  return (
    <div className={cn(CARD, 'p-5 space-y-4')}>
      <h3 className={SECTION_TITLE}><Zap className="w-3 h-3 inline mr-1" /> LLM Diagnostics</h3>

      <div>
        <label className={LABEL}>Provider Capabilities</label>
        {capabilities.isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-accent-primary)]" /> : Object.keys(caps).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(caps).filter(([, v]) => v != null && typeof v === 'object' && !Array.isArray(v)).map(([providerId, capObj]) => {
              const capMap = capObj as Record<string, boolean>;
              return (
                <div key={providerId} className="bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-[var(--gm-text-primary)] mb-1">{providerNames[providerId] || providerId}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(capMap).map(([cap, supported]) => (
                      <span key={cap} className={cn('text-[10px] px-2 py-0.5 rounded-full', supported ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-[var(--gm-text-tertiary)]')}>
                        {supported ? <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" /> : null}
                        {cap.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-[10px] text-[var(--gm-text-tertiary)]">No capabilities data</p>}
      </div>

      <div>
        <label className={LABEL}>Routing Status</label>
        {routing.isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-accent-primary)]" /> : Object.keys(routingData).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(routingData).filter(([, v]) => v != null).slice(0, 10).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-1.5">
                <span className="text-[var(--gm-text-tertiary)] capitalize">{k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</span>
                <span className="text-[var(--gm-text-primary)] font-medium text-right max-w-[60%] truncate">{formatValue(v)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[10px] text-[var(--gm-text-tertiary)]">No routing data</p>}
      </div>

      <div className="flex items-center gap-2">
        <select value={testTarget} onChange={e => setTestTarget(e.target.value)} className={cn(INPUT, 'w-auto')}>
          <option value="">Select provider to test</option>
          {Object.entries(providerNames).filter(([k]) => !['gemini', 'xai', 'claude'].includes(k)).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button onClick={() => testProvider.mutate(testTarget, { onSuccess: () => toast.success(`${testTarget} connection OK`), onError: () => toast.error(`${testTarget} test failed`) })}
          disabled={testProvider.isPending || !testTarget} className={BTN_SECONDARY}>
          {testProvider.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />} Test Provider
        </button>
      </div>
    </div>
  );
}

// ── Ollama ────────────────────────────────────────────────────────────────────

function OllamaSection() {
  const ollamaTest = useOllamaTest();
  const ollamaModels = useOllamaModels();
  const recommended = useOllamaRecommended();
  const pull = useOllamaPull();
  const unload = useModelUnload();
  const [pullModel, setPullModel] = useState('');

  const models = ((ollamaModels.data as Record<string, unknown>)?.models || []) as Array<Record<string, unknown>>;
  const recs = ((recommended.data as Record<string, unknown>)?.models || []) as Array<Record<string, unknown>>;

  return (
    <div className={cn(CARD, 'p-5 space-y-4')}>
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}><Cpu className="w-3 h-3 inline mr-1" /> Ollama Local Models</h3>
        <div className="flex gap-2">
          <button onClick={() => ollamaTest.refetch()} disabled={ollamaTest.isFetching} className={BTN_SECONDARY}>
            {ollamaTest.isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />} Test
          </button>
          <button onClick={() => ollamaModels.refetch()} disabled={ollamaModels.isFetching} className={BTN_SECONDARY}>
            {ollamaModels.isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh
          </button>
        </div>
      </div>

      {models.length > 0 ? (
        <div className="space-y-1.5">
          <label className={LABEL}>Installed ({models.length})</label>
          {models.map((m, i) => (
            <div key={i} className="flex items-center justify-between bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-2">
              <div>
                <span className="text-xs font-medium text-[var(--gm-text-primary)]">{String(m.name || m.model || '')}</span>
                {m.size && <span className="text-[10px] text-[var(--gm-text-tertiary)] ml-2">{String(m.size)}</span>}
              </div>
              <button onClick={() => unload.mutate({ model: String(m.name || m.model) }, { onSuccess: () => toast.success('Model unloaded') })}
                disabled={unload.isPending}
                className="px-2 py-1 rounded text-[10px] text-[var(--gm-text-tertiary)] hover:bg-[var(--color-danger-500)]/10 hover:text-[var(--color-danger-500)] transition-colors">
                Unload
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--gm-text-tertiary)]">No models loaded. Click Refresh to check or pull a model below.</p>
      )}

      <div className="flex items-center gap-2">
        <input value={pullModel} onChange={e => setPullModel(e.target.value)} placeholder="Model name (e.g. llama3.2)" className={INPUT} />
        <button onClick={() => pull.mutate({ model: pullModel }, { onSuccess: () => { toast.success(`Pulling ${pullModel}...`); setPullModel(''); } })}
          disabled={pull.isPending || !pullModel.trim()} className={BTN_PRIMARY}>
          {pull.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Pull
        </button>
      </div>

      <button onClick={() => recommended.refetch()} className="text-xs text-[var(--gm-accent-primary)] underline">Load recommended models</button>
      {recs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recs.map((r, i) => (
            <button key={i} onClick={() => setPullModel(String(r.name || r.model || ''))}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)] font-medium hover:bg-[var(--gm-interactive-primary)]/20 transition-colors">
              {String(r.name || r.model || '')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── API Keys Section ─────────────────────────────────────────────────────────

function ApiKeysSection({ projectId }: { projectId: string }) {
  const { currentProject } = useProject();
  const resolvedProjectId = currentProject?.id || projectId;

  return (
    <div className="space-y-5">
      <SectionHeader title="API Keys" subtitle="Manage LLM provider API keys and AI configuration for this project" />
      <ProjectProvidersSection projectId={resolvedProjectId} />
    </div>
  );
}

// ── Webhooks Section ─────────────────────────────────────────────────────────

function WebhooksSection({ projectId }: { projectId: string }) {
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
        onSuccess: () => { toast.success('Webhook created'); setUrl(''); setEvents([]); setShowCreate(false); },
        onError: () => toast.error('Failed to create webhook'),
      },
    );
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Webhooks" subtitle="Configure endpoints to receive real-time event notifications" />

      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>Endpoints</h3>
        <button onClick={() => setShowCreate(!showCreate)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className={cn(CARD, 'p-4 space-y-3')}>
          <div>
            <label className={LABEL}>Endpoint URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} className={INPUT} placeholder="https://your-server.com/webhook" />
          </div>
          <div>
            <label className={LABEL}>Events</label>
            <div className="flex flex-wrap gap-1.5">
              {availableEvents.map(event => (
                <button key={event} onClick={() => toggleEvent(event)}
                  className={cn('px-2 py-1 rounded-md text-[10px] font-medium transition-colors border',
                    events.includes(event)
                      ? 'bg-[var(--gm-interactive-primary)]/10 border-[var(--gm-accent-primary)]/30 text-[var(--gm-accent-primary)]'
                      : 'bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]')}>
                  {event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className={BTN_SECONDARY}>Cancel</button>
            <button onClick={handleCreate} disabled={createWebhook.isPending || !url.trim() || events.length === 0} className={BTN_PRIMARY}>
              {createWebhook.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create
            </button>
          </div>
        </div>
      )}

      {webhooks.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : webhookList.length === 0 ? (
        <div className={cn(CARD, 'p-6 text-center')}>
          <Webhook className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--gm-text-tertiary)]" />
          <p className="text-xs text-[var(--gm-text-tertiary)]">No webhooks configured. Add one to receive real-time event notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhookList.map(wh => (
            <div key={wh.id} className={cn(CARD, 'p-4')}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-mono text-[var(--gm-text-primary)] truncate flex-1 mr-2">{wh.url}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => testWebhook.mutate(wh.id, { onSuccess: () => toast.success('Test sent'), onError: () => toast.error('Test failed') })}
                    disabled={testWebhook.isPending} className={BTN_SECONDARY}>Test</button>
                  <button onClick={() => deleteWebhook.mutate(wh.id, { onSuccess: () => toast.success('Webhook deleted') })}
                    className="p-1.5 text-[var(--gm-text-tertiary)] hover:text-[var(--color-danger-500)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {wh.events.map(evt => (
                  <span key={evt} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">{evt}</span>
                ))}
              </div>
              <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1.5">Created {new Date(wh.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data Section ─────────────────────────────────────────────────────────────

function DataSection() {
  const resetData = useResetData();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

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

  return (
    <div className="space-y-5">
      <SectionHeader title="Data" subtitle="Manage local cache and project data" />

      <div className={cn(CARD, 'p-5 space-y-3')}>
        <h3 className={SECTION_TITLE}>Local Data</h3>
        <p className="text-xs text-[var(--gm-text-tertiary)]">Clear cached data stored in your browser. This does not affect server data.</p>
        <button onClick={handleClearCache} className={BTN_SECONDARY}>
          <Database className="w-3.5 h-3.5" /> Clear Local Cache
        </button>
      </div>

      <div className={cn(CARD, 'p-5 space-y-3 border-[var(--color-danger-500)]/30')}>
        <h3 className="text-[10px] font-bold text-[var(--color-danger-500)] uppercase tracking-[0.1em]">Danger Zone</h3>
        <p className="text-xs text-[var(--gm-text-tertiary)]">
          Reset all project knowledge data. This permanently deletes facts, decisions, questions, risks, and actions.
        </p>
        {!clearDialogOpen ? (
          <button onClick={() => setClearDialogOpen(true)} className={BTN_DANGER}>
            <Trash2 className="w-3.5 h-3.5" /> Reset Project Data
          </button>
        ) : (
          <div className="bg-[var(--color-danger-500)]/5 border border-[var(--color-danger-500)]/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-[var(--color-danger-500)]">Are you sure? This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setClearDialogOpen(false)} className={BTN_SECONDARY}>Cancel</button>
              <button onClick={handleResetConfirm} disabled={resetData.isPending} className={BTN_DANGER}>
                {resetData.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Confirm Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
