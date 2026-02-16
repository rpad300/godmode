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
