<<<<<<< HEAD
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Key, Globe, Database, Shield, Bell, Palette } from 'lucide-react';

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState('ai');

  const sections = [
    { id: 'ai', label: 'AI Providers', icon: Bot },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'general', label: 'General', icon: Globe },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="flex gap-6">
        {/* Settings Nav */}
        <div className="w-48 flex-shrink-0 space-y-0.5 hidden md:block">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {activeSection === 'ai' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-base font-semibold text-foreground mb-4">AI Provider Configuration</h3>
                <div className="space-y-4">
                  {/* Ollama */}
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <h4 className="text-sm font-medium text-foreground">Ollama (Local)</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success">Connected</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Primary</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">URL</span>
                        <span className="font-mono text-xs text-foreground">http://localhost:11434</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Chat Model</span>
                        <span className="font-mono text-xs text-foreground">qwen3:14b</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Embedding Model</span>
                        <span className="font-mono text-xs text-foreground">snowflake-arctic-embed:l</span>
                      </div>
                    </div>
                  </div>

                  {/* OpenAI */}
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        <h4 className="text-sm font-medium text-foreground">OpenAI</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Configured</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Fallback</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">API Key</span>
                      <span className="font-mono text-xs text-foreground">sk-•••••••••••••••3k2f</span>
                    </div>
                  </div>

                  {/* Claude */}
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        <h4 className="text-sm font-medium text-foreground">Anthropic (Claude)</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Configured</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">API Key</span>
                      <span className="font-mono text-xs text-foreground">sk-ant-•••••••••••q8x</span>
                    </div>
                  </div>

                  {/* DeepSeek */}
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">DeepSeek</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not configured</span>
                      </div>
                      <button className="text-xs text-primary hover:underline">Configure</button>
                    </div>
                  </div>

                  {/* Gemini */}
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">Google (Gemini)</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not configured</span>
                      </div>
                      <button className="text-xs text-primary hover:underline">Configure</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Processing Settings */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-base font-semibold text-foreground mb-4">Processing Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">Auto-process uploaded files</p>
                      <p className="text-xs text-muted-foreground">Automatically analyze files when uploaded</p>
                    </div>
                    <div className="w-10 h-6 bg-primary rounded-full relative cursor-pointer">
                      <div className="w-4 h-4 bg-primary-foreground rounded-full absolute top-1 right-1" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">Vision processing for images</p>
                      <p className="text-xs text-muted-foreground">Use OCR for scanned documents</p>
                    </div>
                    <div className="w-10 h-6 bg-primary rounded-full relative cursor-pointer">
                      <div className="w-4 h-4 bg-primary-foreground rounded-full absolute top-1 right-1" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">Daily briefing generation</p>
                      <p className="text-xs text-muted-foreground">Generate AI summary every morning</p>
                    </div>
                    <div className="w-10 h-6 bg-muted rounded-full relative cursor-pointer">
                      <div className="w-4 h-4 bg-muted-foreground rounded-full absolute top-1 left-1" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection !== 'ai' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground">
                {sections.find(s => s.id === activeSection)?.label} settings — connect to your GodMode backend to configure.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
=======
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
>>>>>>> origin/claude/migrate-to-react-uJJbl
