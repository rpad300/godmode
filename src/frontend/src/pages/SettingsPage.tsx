import { useState, useCallback, useEffect } from 'react';
import {
  Settings, Sun, Moon, Monitor, Database, Trash2, User, Cpu, Save,
  Loader2, Key, Webhook, Plus, Copy, X, TestTube, Zap, Download, RefreshCw, CheckCircle,
  Globe, Shield, Eye, BarChart3, Bot, ChevronRight, Check, Languages,
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
} from '../hooks/useGodMode';
import { useUser } from '../hooks/useUser';

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
  const config = useProjectConfig();
  const updateConfig = useUpdateProjectConfig();
  const [projectName, setProjectName] = useState('');
  const [llmProvider, setLlmProvider] = useState('');

  useEffect(() => {
    if (config.data) {
      setProjectName(config.data.projectName || '');
      setLlmProvider(config.data.llm?.provider || '');
    }
  }, [config.data]);

  const handleSaveProject = () => {
    updateConfig.mutate(
      { projectName, llm: { ...config.data?.llm, provider: llmProvider } },
      { onSuccess: () => toast.success('Project settings saved') },
    );
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Project" subtitle="LLM configuration, diagnostics, and local model management" />

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
            <div>
              <label className={LABEL}>LLM Provider</label>
              <select value={llmProvider} onChange={e => setLlmProvider(e.target.value)} className={INPUT}>
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
                <label className={LABEL}>Configured Models</label>
                <div className="space-y-1">
                  {Object.entries(config.data.llm.models).map(([task, model]) => (
                    <div key={task} className="flex items-center justify-between text-xs bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-1.5">
                      <span className="text-[var(--gm-text-tertiary)] capitalize">{task.replace(/_/g, ' ')}</span>
                      <span className="text-[var(--gm-text-primary)] font-medium">{model as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

// ── LLM Diagnostics ──────────────────────────────────────────────────────────

function LLMDiagnosticsSection() {
  const capabilities = useLLMCapabilities();
  const routing = useLLMRoutingStatus();
  const testProvider = useTestLLMProvider();
  const [testTarget, setTestTarget] = useState('');

  const caps = (capabilities.data || {}) as Record<string, unknown>;
  const routingData = (routing.data || {}) as Record<string, unknown>;

  return (
    <div className={cn(CARD, 'p-5 space-y-4')}>
      <h3 className={SECTION_TITLE}><Zap className="w-3 h-3 inline mr-1" /> LLM Diagnostics</h3>

      <div>
        <label className={LABEL}>Capabilities</label>
        {capabilities.isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-accent-primary)]" /> : Object.keys(caps).length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(caps).filter(([, v]) => v != null).slice(0, 12).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-1.5">
                <span className="text-[var(--gm-text-tertiary)] capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-[var(--gm-text-primary)] font-medium">{typeof v === 'boolean' ? (v ? <CheckCircle className="w-3 h-3 text-green-500 inline" /> : '—') : String(v)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[10px] text-[var(--gm-text-tertiary)]">No capabilities data</p>}
      </div>

      <div>
        <label className={LABEL}>Routing Status</label>
        {routing.isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--gm-accent-primary)]" /> : Object.keys(routingData).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(routingData).filter(([, v]) => v != null).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-[var(--gm-text-tertiary)] capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-[var(--gm-text-primary)] font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[10px] text-[var(--gm-text-tertiary)]">No routing data</p>}
      </div>

      <div className="flex items-center gap-2">
        <select value={testTarget} onChange={e => setTestTarget(e.target.value)} className={cn(INPUT, 'w-auto')}>
          <option value="">Select provider to test</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
          <option value="ollama">Ollama</option>
          <option value="groq">Groq</option>
          <option value="deepseek">DeepSeek</option>
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="API Keys" subtitle="Create and manage API keys for programmatic access" />

      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>Your Keys</h3>
        <button onClick={() => setShowCreate(!showCreate)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> Create Key
        </button>
      </div>

      {newRawKey && (
        <div className={cn(CARD, 'p-4 space-y-2 border-amber-500/30')}>
          <p className="text-xs font-medium text-amber-500">Copy your new API key now — it won't be shown again.</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--gm-text-primary)] break-all">{newRawKey}</code>
            <button onClick={() => copyToClipboard(newRawKey)} className={BTN_SECONDARY}>
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => setNewRawKey(null)} className="text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]">Dismiss</button>
        </div>
      )}

      {showCreate && (
        <div className={cn(CARD, 'p-4 space-y-3')}>
          <div>
            <label className={LABEL}>Key Name</label>
            <input value={keyName} onChange={e => setKeyName(e.target.value)} className={INPUT} placeholder="e.g. Production API" />
          </div>
          <div>
            <label className={LABEL}>Expires In</label>
            <select value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} className={INPUT}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="">Never</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className={BTN_SECONDARY}>Cancel</button>
            <button onClick={handleCreate} disabled={createKey.isPending || !keyName.trim()} className={BTN_PRIMARY}>
              {createKey.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create
            </button>
          </div>
        </div>
      )}

      {apiKeys.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : keys.length === 0 ? (
        <div className={cn(CARD, 'p-6 text-center')}>
          <Key className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--gm-text-tertiary)]" />
          <p className="text-xs text-[var(--gm-text-tertiary)]">No API keys yet. Create one to access the API programmatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(key => (
            <div key={key.id} className={cn(CARD, 'p-4 flex items-center justify-between')}>
              <div>
                <p className="text-sm font-medium text-[var(--gm-text-primary)]">{key.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {key.key_prefix && <span className="text-[10px] font-mono text-[var(--gm-text-tertiary)]">{key.key_prefix}...</span>}
                  <span className="text-[10px] text-[var(--gm-text-tertiary)]">Created {key.created_at ? new Date(key.created_at).toLocaleDateString() : '—'}</span>
                  {key.expires_at && <span className="text-[10px] text-[var(--gm-text-tertiary)]">Expires {new Date(key.expires_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <button onClick={() => deleteKey.mutate(key.id, { onSuccess: () => toast.success('Key revoked') })}
                className="p-2 text-[var(--gm-text-tertiary)] hover:text-[var(--color-danger-500)] transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
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
