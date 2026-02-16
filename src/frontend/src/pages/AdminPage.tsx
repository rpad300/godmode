<<<<<<< HEAD
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Shield, Users, Activity, Database, Server, AlertTriangle, Search,
  Cpu, HardDrive, Zap, CheckCircle2, XCircle, Ban, Eye, EyeOff,
  Info, ScrollText, GitBranch, Share2, MessageSquare, Settings as Cog,
  CreditCard, List, Copy, RefreshCw, ChevronRight, Pencil, Save, X, Edit,
  FolderSync, Clock, ArrowRight, ExternalLink, Plus, Trash2, Play, Loader2, Pause
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SystemPromptsSection } from "../components/admin/SystemPromptsSection";
import { OntologyManagerSection } from "../components/admin/OntologyManagerSection";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import {
  adminUsers, generateSystemMetrics, auditLog, systemAlerts, storageBreakdown,
  llmProviders, serviceApiKeys, aiTaskConfigs, llmQueue, promptTemplates, processingRules,
  adminMenuItems, getModelsByProviderAndType, getAvailableProvidersForType,
  graphSettings, ontologyEntities, teamAnalysisConfig, driveConnection, billingData,
  type AdminSection, type AITaskConfig, type PromptTemplate, type PricingTier
} from '@/data/admin-data';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Server, Cpu, Database, List, GitBranch, Share2, MessageSquare,
  Cog, HardDrive, CreditCard, ScrollText,
};

const ROLE_STYLE: Record<string, string> = {
  superadmin: 'bg-destructive/10 text-destructive border-destructive/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  user: 'bg-muted text-muted-foreground border-border',
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-destructive/10 text-destructive',
};

const SEVERITY_STYLE: Record<string, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

const ALERT_ICON: Record<string, typeof Info> = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const ALERT_STYLE: Record<string, string> = { info: 'bg-info/10 text-info', success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning', error: 'bg-destructive/10 text-destructive' };

const QUEUE_STATUS: Record<string, string> = {
  queued: 'bg-warning/10 text-warning',
  processing: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const AdminPage = () => {
  const [activeSection, setActiveSection] = useState<AdminSection>('llm-providers');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [taskConfigs, setTaskConfigs] = useState<AITaskConfig[]>(aiTaskConfigs);

  // Real system stats
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  const { data: realSystemStats } = useQuery({
    queryKey: ['admin-system-stats'],
    queryFn: () => apiClient.getSystemStats(),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (realSystemStats) {
      setMetricsHistory(prev => {
        // Avoid adding same timestamp twice
        if (prev.length > 0 && prev[prev.length - 1].timestamp === realSystemStats.timestamp) return prev;

        // Add random request count since backend doesn't track it yet
        const statsWithRequests = {
          ...realSystemStats,
          requests: Math.floor(Math.random() * 50) + 10,
          // Ensure timestamp is readable time for chart x-axis
          timestamp: new Date(realSystemStats.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const newHistory = [...prev, statsWithRequests];
        // Keep last 24 points
        if (newHistory.length > 24) return newHistory.slice(newHistory.length - 24);
        return newHistory;
      });
    } else if (metricsHistory.length === 0) {
      // Initialize with one mock point to prevent empty charts if query is slow
      setMetricsHistory(generateSystemMetrics().slice(-1));
    }
  }, [realSystemStats]);

  const systemMetrics = metricsHistory;


  const filteredUsers = useMemo(() => {
    return adminUsers.filter(u => {
      const matchSearch = !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [userSearch, roleFilter]);



  const toggleKeyVisibility = (id: string) => setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));

  const updateTaskConfig = (index: number, field: 'selectedProvider' | 'selectedModel', value: string) => {
    setTaskConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'selectedProvider') {
        const models = getModelsByProviderAndType(value, updated[index].type);
        updated[index].selectedModel = models[0]?.id || '';
      }
      return updated;
    });
  };

  const totalStorage = realSystemStats?.totalStorage || 0;
  // Fallback to storageBreakdown from import if real stats not ready, or use real stats breakdown
  const currentStorageBreakdown = realSystemStats?.storageBreakdown || storageBreakdown;
  const latestMetric = systemMetrics[systemMetrics.length - 1] || { cpu: 0, ram: 0, disk: 0, latency: 0 };

  const renderSection = () => {
    switch (activeSection) {
      case 'users':
        return <UsersSection filteredUsers={filteredUsers} userSearch={userSearch} setUserSearch={setUserSearch} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />;
      case 'system':
        return <SystemSection systemMetrics={systemMetrics} storageBreakdown={currentStorageBreakdown} totalStorage={totalStorage} latestMetric={latestMetric} />;
      case 'llm-providers':
        return <LLMProvidersSection showKeys={showKeys} toggleKeyVisibility={toggleKeyVisibility} taskConfigs={taskConfigs} updateTaskConfig={updateTaskConfig} />;
      case 'model-metadata':
        return <ModelMetadataSection />;
      case 'llm-queue':
        return <LLMQueueSection />;
      case 'prompts':
        return <SystemPromptsSection />;
      case 'processing':
        return <ProcessingSection />;
      case 'audit-log':
        return <AuditLogSection />;
      case 'graph':
        return <GraphSettingsSection />;
      case 'ontology':
        return <OntologyManagerSection />;
      case 'team-analysis':
        return <TeamAnalysisSettingsSection />;
      case 'google-drive':
        return <GoogleDriveSection />;
      case 'billing':
        return <BillingSection />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Admin Sub-Sidebar */}
      <div className="w-52 border-r border-border flex-shrink-0 overflow-y-auto scrollbar-thin" style={{ background: 'var(--gradient-sidebar)' }}>
        <div className="p-3">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Shield className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-foreground">Admin</span>
          </div>
          <div className="space-y-0.5">
            {adminMenuItems.map(item => {
              const Icon = ICON_MAP[item.iconName] || Cog;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all ${isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 max-w-[1200px]">
        {/* System Alerts (always visible at top) */}
        {systemAlerts.filter(a => !a.acknowledged).length > 0 && (
          <div className="space-y-2">
            {systemAlerts.filter(a => !a.acknowledged).map(alert => {
              const Icon = ALERT_ICON[alert.type];
              return (
                <div key={alert.id} className={`flex items-center gap-3 p-2.5 rounded-lg text-xs ${ALERT_STYLE[alert.type]}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1">{alert.message}</span>
                  <span className="text-[10px] opacity-60">{alert.timestamp.split(' ')[1]}</span>
                </div>
              );
            })}
          </div>
        )}

        {renderSection()}
      </div>
    </div>
  );
};

// ==================== LLM PROVIDERS SECTION ====================

function LLMProvidersSection({
  showKeys, toggleKeyVisibility, taskConfigs, updateTaskConfig
}: {
  showKeys: Record<string, boolean>;
  toggleKeyVisibility: (id: string) => void;
  taskConfigs: AITaskConfig[];
  updateTaskConfig: (i: number, f: 'selectedProvider' | 'selectedModel', v: string) => void;
}) {
  const [providers, setProviders] = useState(llmProviders);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiClient.get<any>('/api/system/config/llm');
        if (res.ok && res.value?.providers) {
          setProviders(prev => prev.map(p => {
            const backendConfig = res.value.providers[p.id];
            return backendConfig ? { ...p, concurrency: backendConfig.concurrency ?? p.concurrency } : p;
          }));
        }
      } catch (e) {
        console.error('Failed to fetch LLM config', e);
      }
    };
    fetchConfig();
  }, []);

  const updateConcurrency = (id: string, value: number) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, concurrency: value } : p));
  };

  const handleSaveKeys = async () => {
    setSaving(true);
    try {
      // Construct config object to save
      const providersConfig: Record<string, any> = {};
      providers.forEach(p => {
        providersConfig[p.id] = {
          concurrency: p.concurrency
          // In a real app we'd also save API keys here if changed, 
          // but for now we focus on concurrency as keys are likely handled safely elsewhere
        };
      });

      // We need to be careful not to overwrite other LLM settings.
      // Ideally we fetch current, merge, and save.
      // For this MVP, we'll assume we are patching defaults or existing structure.
      const currentRes = await apiClient.get<any>('/api/system/config/llm');
      const currentLLM = currentRes.ok ? currentRes.value : {};

      const newLLM = {
        ...currentLLM,
        providers: {
          ...(currentLLM.providers || {}),
          ...providersConfig
        }
      };

      const res = await apiClient.put<any>('/api/system/config/llm', { value: newLLM });
      if (!res.ok) throw new Error(res.error || 'Failed to save');

      toast.success('LLM provider settings saved');
    } catch (e: any) {
      toast.error('Failed to save settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* LLM API Keys */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">LLM API Keys</h2>
        <p className="text-xs text-muted-foreground mb-5">System-level API keys (stored encrypted in Supabase)</p>
        <div className="space-y-4">
          {providers.map(provider => (
            <div key={provider.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-primary">{provider.displayName}</span>
                {provider.configured && (
                  <span className="text-[10px] text-success flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                )}
              </div>
              {provider.id !== 'ollama' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2">
                    <code className="text-xs text-muted-foreground font-mono">
                      {showKeys[provider.id] ? `${provider.apiKeyPrefix}xxxxxxxxxxxxxxxxxxxxxxxx` : provider.maskedKey}
                    </code>
                  </div>
                  <button
                    onClick={() => toggleKeyVisibility(provider.id)}
                    className="px-3 py-2 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    {showKeys[provider.id] ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}
              <div className="mt-2 flex items-center gap-3">
                <div className="w-32">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Max Concurrent Jobs</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={provider.concurrency || 2}
                    onChange={e => updateConcurrency(provider.id, parseInt(e.target.value) || 1)}
                    className="h-7 text-xs bg-secondary/50 border-border"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveKeys}
          disabled={saving}
          className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save LLM Settings
        </button>
      </div>

      {/* Service API Keys */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Service API Keys</h2>
        <p className="text-xs text-muted-foreground mb-5">Keys for email, notifications and other services</p>
        <div className="space-y-4">
          {serviceApiKeys.map(key => (
            <div key={key.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-primary">{key.name}</span>
                {key.configured && (
                  <span className="text-[10px] text-success flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2">
                  <code className="text-xs text-muted-foreground font-mono">
                    {showKeys[key.id] ? `${key.maskedKey.replace('****', 'xxxxxxxxxxxx')}` : key.maskedKey}
                  </code>
                </div>
                <button
                  onClick={() => toggleKeyVisibility(key.id)}
                  className="px-3 py-2 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  {showKeys[key.id] ? 'Hide' : 'Show'}
                </button>
              </div>
              {key.helpText && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {key.helpText} {key.helpUrl && <a href={key.helpUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{key.helpUrl}</a>}
                </p>
              )}
            </div>
          ))}
        </div>
        <button className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          Save Service Keys
        </button>
      </div>

      {/* Task-Specific AI Configuration */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Task-Specific AI Configuration</h2>
        <p className="text-xs text-muted-foreground mb-5">Configure which provider and model to use for each AI task. These settings apply globally to the platform.</p>
        <div className="space-y-6">
          {taskConfigs.map((task, i) => {
            const availableProviders = getAvailableProvidersForType(task.type);
            const availableModels = getModelsByProviderAndType(task.selectedProvider, task.type);
            return (
              <div key={task.type} className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-foreground">{task.icon} {task.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{task.description}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Provider</label>
                    <Select value={task.selectedProvider} onValueChange={v => updateTaskConfig(i, 'selectedProvider', v)}>
                      <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProviders.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Model</label>
                    <Select value={task.selectedModel} onValueChange={v => updateTaskConfig(i, 'selectedModel', v)}>
                      <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-success">{availableModels.length} model(s) available</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            Save LLM Configuration
          </button>
          <span className="text-[10px] text-warning flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Changes apply immediately to all AI processing
          </span>
        </div>
      </div>
    </div >
  );
}

// ==================== MODEL METADATA SECTION ====================

function ModelMetadataSection() {
  const allModels = llmProviders.flatMap(p => p.models.map(m => ({ ...m, providerName: p.displayName })));
  const providerSummaries = llmProviders.map(p => ({
    name: p.displayName,
    total: p.models.length,
    text: p.models.filter(m => m.type === 'text').length,
    vision: p.models.filter(m => m.type === 'vision').length,
    embedding: p.models.filter(m => m.type === 'embedding').length,
    image: p.models.filter(m => m.type === 'image').length,
    isLocal: p.id === 'ollama',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Model Metadata</h1>
        <p className="text-xs text-muted-foreground">{allModels.length} models across {llmProviders.length} providers</p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {providerSummaries.map(p => (
          <div key={p.name} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">{p.name}</span>
              {p.isLocal && <Badge variant="outline" className="text-[9px]">Local</Badge>}
            </div>
            <p className="text-2xl font-bold font-mono text-primary">{p.total}</p>
            <p className="text-[10px] text-muted-foreground mb-2">models</p>
            <div className="flex flex-wrap gap-1">
              {p.text > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{p.text} text</span>}
              {p.vision > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">{p.vision} vision</span>}
              {p.embedding > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success">{p.embedding} embed</span>}
              {p.image > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/80 text-accent-foreground">{p.image} image</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">All Models</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Model</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Max Tokens</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Cost/1K In</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Cost/1K Out</th>
              </tr>
            </thead>
            <tbody>
              {allModels.map(m => (
                <tr key={`${m.provider}-${m.id}`} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{m.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.providerName}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">{m.maxTokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">{m.costPer1kInput === 0 ? 'Free' : `$${m.costPer1kInput}`}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">{m.costPer1kOutput === 0 ? 'Free' : `$${m.costPer1kOutput}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== LLM QUEUE SECTION ====================

function LLMQueueSection() {
  const queryClient = useQueryClient();
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // Queries
  const { data: queueStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['llm-queue-status'],
    queryFn: () => apiClient.getLLMQueueStatus(),
    refetchInterval: 3000 // Poll every 3 seconds
  });

  const { data: queueHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['llm-queue-history'],
    queryFn: () => apiClient.getLLMQueueHistory(20),
    refetchInterval: 5000
  });

  const { data: retryableItems, isLoading: isLoadingRetryable } = useQuery({
    queryKey: ['llm-queue-retryable'],
    queryFn: () => apiClient.getLLMQueueRetryable(),
    refetchInterval: 10000
  });

  const { data: pendingItems } = useQuery({
    queryKey: ['llm-queue-pending'],
    queryFn: () => apiClient.getLLMQueuePending(20),
    refetchInterval: 3000
  });

  // Mutations
  const pauseQueueMutation = useMutation({
    mutationFn: () => apiClient.pauseLLMQueue(),
    onSuccess: () => {
      toast.success('Queue paused');
      queryClient.invalidateQueries({ queryKey: ['llm-queue-status'] });
    },
    onError: (err: any) => toast.error(`Failed to pause queue: ${err.message}`)
  });

  const resumeQueueMutation = useMutation({
    mutationFn: () => apiClient.resumeLLMQueue(),
    onSuccess: () => {
      toast.success('Queue resumed');
      queryClient.invalidateQueries({ queryKey: ['llm-queue-status'] });
    },
    onError: (err: any) => toast.error(`Failed to resume queue: ${err.message}`)
  });

  const clearQueueMutation = useMutation({
    mutationFn: () => apiClient.clearLLMQueue(),
    onSuccess: () => {
      toast.success('Queue cleared');
      queryClient.invalidateQueries({ queryKey: ['llm-queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['llm-queue-pending'] });
    },
    onError: (err: any) => toast.error(`Failed to clear queue: ${err.message}`)
  });

  const retryItemMutation = useMutation({
    mutationFn: (id: string) => apiClient.retryLLMQueueItem(id),
    onSuccess: () => {
      toast.success('Item queued for retry');
      queryClient.invalidateQueries({ queryKey: ['llm-queue-retryable'] });
      queryClient.invalidateQueries({ queryKey: ['llm-queue-status'] });
    },
    onError: (err: any) => toast.error(`Failed to retry item: ${err.message}`)
  });

  const cancelItemMutation = useMutation({
    mutationFn: (id: string) => apiClient.cancelLLMQueueItem(id),
    onSuccess: () => {
      toast.success('Item cancelled');
      queryClient.invalidateQueries({ queryKey: ['llm-queue-pending'] });
      queryClient.invalidateQueries({ queryKey: ['llm-queue-status'] });
    },
    onError: (err: any) => toast.error(`Failed to cancel item: ${err.message}`)
  });

  // Derived state
  const isPaused = queueStatus?.isPaused || false;
  const stats = queueStatus?.stats || { total: 0, successful: 0, failed: 0, avgProcessingTime: 0 };
  const historyItems = queueHistory?.history || [];
  const failedItemsList = retryableItems?.items || [];
  const pendingItemsList = pendingItems?.items || [];

  // Calculate cost today (if available in stats, otherwise 0)
  const costToday = queueStatus?.stats?.costToday || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">LLM Processing Queue</h1>
        <p className="text-xs text-muted-foreground">Monitor and control AI request processing - Live Data</p>
      </div>

      {/* Queue Status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Queue Status</h2>
        <div className="flex items-center gap-3 mb-3">
          <Badge variant={queueStatus?.database ? "outline" : "destructive"} className="text-[10px] font-mono">
            DB: {queueStatus?.database ? 'CONNECTED' : 'DISCONNECTED'}
          </Badge>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['llm-queue-status'] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingStatus ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="space-y-1">
          <p className={`text-xs flex items-center gap-1 ${isPaused ? 'text-warning' : 'text-success'}`}>
            {isPaused ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {isPaused ? 'PAUSED' : (queueStatus?.isProcessing ? 'PROCESSING' : 'IDLE')}
          </p>
          <p className="text-xs text-primary">Queue Status</p>
          <p className="text-sm font-mono text-foreground">{queueStatus?.queueLength || 0}</p>
          <p className="text-xs text-primary">Items in Queue</p>
          <p className="text-sm font-mono text-foreground">{queueStatus?.currentRequest ? 1 : 0}</p>
          <p className="text-xs text-primary">Processing Now</p>
        </div>
      </div>

      {/* Queue Controls */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Queue Controls</h2>
        <p className="text-xs text-muted-foreground mb-3">Control queue processing behavior</p>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <button
              onClick={() => resumeQueueMutation.mutate()}
              disabled={resumeQueueMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium hover:bg-success/30 transition-colors"
            >
              <Play className="w-3 h-3" /> Resume Queue
            </button>
          ) : (
            <button
              onClick={() => pauseQueueMutation.mutate()}
              disabled={pauseQueueMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors"
            >
              <Pause className="w-3 h-3" /> Pause Queue
            </button>
          )}

          <button
            onClick={() => clearQueueMutation.mutate()}
            disabled={clearQueueMutation.isPending || (queueStatus?.queueLength || 0) === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            <Trash2 className="w-3 h-3" /> Clear Queue
          </button>
        </div>
      </div>

      {/* Queue Statistics (Today) */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Queue Statistics (Total)</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
          {[
            { label: 'PENDING', value: queueStatus?.queueLength || 0 },
            { label: 'PROCESSING', value: queueStatus?.currentRequest ? 1 : 0 },
            { label: 'COMPLETED', value: stats.successful },
            { label: 'FAILED', value: stats.failed },
            { label: 'RETRY PENDING', value: failedItemsList.length },
            { label: 'AVG TIME (MS)', value: Math.round(stats.avgProcessingTime || 0).toLocaleString() },
          ].map(s => (
            <div key={s.label} className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold font-mono text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Items */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Pending Items</h2>
        <p className="text-xs text-primary">{pendingItemsList.length} items</p>

        {pendingItemsList.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Context</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Priority</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Type</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingItemsList.map((item: any) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-foreground">{item.context}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLE[item.priority] || ''}`}>
                        {item.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.requestType}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => cancelItemMutation.mutate(item.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                        title="Cancel"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">No items in queue</p>
        )}
      </div>

      {/* Failed Items */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Failed Items (Retryable)</h2>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['llm-queue-retryable'] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingRetryable ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {failedItemsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Context</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Attempts</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Error</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedItemsList.map((item: any) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-foreground">{item.context}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.provider}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{item.attemptCount}/{item.maxAttempts}</td>
                    <td className="px-4 py-2.5 text-xs text-destructive max-w-[200px] truncate" title={item.error}>{item.error}</td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => retryItemMutation.mutate(item.id)}
                          disabled={retryItemMutation.isPending}
                          className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No failed items</p>
        )}
      </div>

      {/* Recent Processing History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Processing History</h2>
        </div>
        <div className="p-4 border-b border-border">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['llm-queue-history'] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Context</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Provider/Model</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Tokens</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Time</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Completed</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.map((entry: any) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-foreground">{entry.context}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{entry.provider}/{entry.model}</td>
                  <td className="px-4 py-2.5 text-center">
                    {entry.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success mx-auto" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs font-mono text-foreground">{entry.inputTokens || 0}/{entry.outputTokens || 0}</td>
                  <td className="px-4 py-2.5 text-center text-xs font-mono text-muted-foreground">{entry.processingTime}ms</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(entry.completedAt).toLocaleString()}</td>
                </tr>
              ))}
              {historyItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No history available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



// ==================== PROCESSING SECTION ====================

function ProcessingSection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullConfig, setFullConfig] = useState<any>(null);

  // Processing Settings
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.90);
  const [pdfToImages, setPdfToImages] = useState(true);

  // Token Policy (mapped to tokenPolicy.perTask.processing.maxOutputTokens)
  const [maxTokens, setMaxTokens] = useState(4096);

  // UI-only / Mock settings (no backend support yet or not in this config section)
  const [temperature, setTemperature] = useState(0.7);
  const [autoProcess, setAutoProcess] = useState(true);
  // parallelJobs removed in favor of per-provider concurrency

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>('/api/system/config');
        if (res.ok) {
          setFullConfig(res);
          // Map Processing Settings
          const proc = res.processing || {};
          setChunkSize(proc.chunkSize || 1000);
          setChunkOverlap(proc.chunkOverlap || 200);
          setSimilarityThreshold(proc.similarityThreshold || 0.90);
          setPdfToImages(proc.pdfToImages !== false);
          setAutoProcess(proc.autoProcess !== false);
          setTemperature(proc.temperature || 0.7);

          // Map Token Policy
          if (res.tokenPolicy?.perTask?.processing?.maxOutputTokens) {
            setMaxTokens(res.tokenPolicy.perTask.processing.maxOutputTokens);
          }
        }
      } catch (error) {
        console.error('Failed to load processing config', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save Processing Settings
      const procData = {
        chunkSize,
        chunkOverlap,
        similarityThreshold,
        pdfToImages,
        autoProcess,
        temperature
      };

      const res1 = await apiClient.put<any>('/api/system/config/processing', { value: procData });
      if (!res1.ok) throw new Error(res1.error || 'Failed to save processing settings');

      // 2. Save Token Policy (if we have reference to full structure)
      if (fullConfig && fullConfig.tokenPolicy) {
        const newPolicy = { ...fullConfig.tokenPolicy };
        if (!newPolicy.perTask) newPolicy.perTask = {};
        if (!newPolicy.perTask.processing) newPolicy.perTask.processing = {};

        newPolicy.perTask.processing.maxOutputTokens = maxTokens;

        const res2 = await apiClient.put<any>('/api/system/config/tokenPolicy', { value: newPolicy });
        if (!res2.ok) throw new Error(res2.error || 'Failed to save token policy');
      }

      toast.success('Processing settings saved successfully');

      // Refresh full config to ensure sync
      const refresh = await apiClient.get<any>('/api/system/config');
      if (refresh.ok) setFullConfig(refresh);

    } catch (error: any) {
      console.error('Save error', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Document Processing Settings</h1>
        <p className="text-xs text-muted-foreground">Configure how documents are processed and analyzed</p>
        <div className="border-b border-border mt-3" />
      </div>

      {/* Chunking Settings */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Chunking & Extraction</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-primary mb-1 block">Chunk Size (tokens)</label>
            <Input type="number" value={chunkSize} onChange={e => setChunkSize(Number(e.target.value))} className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-primary mb-1 block">Chunk Overlap (tokens)</label>
            <Input type="number" value={chunkOverlap} onChange={e => setChunkOverlap(Number(e.target.value))} className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-primary mb-1 block">Similarity Threshold (0.0 - 1.0)</label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={similarityThreshold}
              onChange={e => setSimilarityThreshold(Number(e.target.value))}
              className="h-9 text-xs bg-secondary border-border"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={pdfToImages} onCheckedChange={setPdfToImages} className="scale-75" />
            <span className="text-xs font-medium text-foreground">Extract PDF Pages as Images</span>
          </div>
        </div>
      </div>

      {/* Generation Settings */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Generation Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-primary mb-1 block">Max Output Tokens</label>
            <Input type="number" value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-primary mb-1 block">Temperature</label>
            <Input type="number" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="h-9 text-xs bg-secondary border-border" />
          </div>
        </div>
      </div>

      {/* Job Settings */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Job Settings</h2>
        <div className="flex items-center gap-2 mb-4">
          <Switch checked={autoProcess} onCheckedChange={setAutoProcess} className="scale-75" />
          <span className="text-xs font-medium text-foreground">Auto-process uploaded documents</span>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saving ? 'Saving...' : 'Save Processing Settings'}
      </Button>
    </div>
  );
}

// ==================== USERS SECTION ====================

function UsersSection({ filteredUsers, userSearch, setUserSearch, roleFilter, setRoleFilter }: {
  filteredUsers: any[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
}) {
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Real Data Fetching via System API
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-system-users'],
    queryFn: () => apiClient.getSystemUsers(),
  });

  const users = usersData?.users || [];

  // Filtering Logic
  const displayUsers = users.filter((user: any) => {
    const matchesSearch = (user.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Mutations using System API
  const addUserMutation = useMutation({
    mutationFn: (newUser: any) => apiClient.addSystemUser(newUser),
    onSuccess: () => {
      toast.success('User added successfully');
      setIsAddUserOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });
    },
    onError: (err: any) => toast.error(`Failed to add user: ${err.message}`)
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => apiClient.updateSystemUser(id, updates),
    onSuccess: (data, variables) => {
      // If we were editing a user from the dialog, close it
      if (editingUser && editingUser.id === variables.id) {
        setIsEditUserOpen(false);
        setEditingUser(null);
      }
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });
    },
    onError: (err: any) => toast.error(`Failed to update user: ${err.message}`)
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteSystemUser(id),
    onSuccess: () => {
      toast.success('User removed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });
    },
    onError: (err: any) => toast.error(`Failed to remove user: ${err.message}`)
  });

  // Handlers
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newUser = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
    };
    addUserMutation.mutate(newUser);
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const updates: any = {
      name: formData.get('name'),
      role: formData.get('role'),
    };

    // Only add password if provided (it's optional during edit)
    const password = formData.get('password');
    if (password && typeof password === 'string' && password.length > 0) {
      updates.password = password;
    }

    updateUserMutation.mutate({ id: editingUser.id, updates });
  };

  const openEditUser = (user: any) => {
    setEditingUser(user);
    setIsEditUserOpen(true);
  };

  const handleToggleStatus = (user: any) => {
    // Logic: if active/pending -> suspend (ban). If banned -> activate.
    // The backend handles 'banned' vs 'active' status updates.
    const isBanned = user.status === 'banned';
    const newStatus = isBanned ? 'active' : 'banned';

    // Check if trying to ban self
    // (In a real app, check current user ID. For now just confirm)

    if (confirm(`Are you sure you want to ${newStatus === 'active' ? 'unban' : 'ban'} ${user.name}?`)) {
      updateUserMutation.mutate({ id: user.id, updates: { status: newStatus } });
    }
  };

  const handleDelete = (user: any) => {
    if (confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Platform Users</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..." className="pl-8 h-8 text-xs w-full sm:w-[180px] bg-secondary border-border" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="superadmin">Superadmin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">+ Add User</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Platform User</DialogTitle>
                <DialogDescription>Create a new user account with platform access.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input name="name" required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input name="email" type="email" required placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input name="password" type="password" required placeholder="••••••••" minLength={6} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select name="role" defaultValue="user">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addUserMutation.isPending}>
                    {addUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update details for {editingUser?.name}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input name="name" defaultValue={editingUser?.name} required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input name="email" value={editingUser?.email} disabled className="bg-muted opacity-70" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password (Optional)</label>
                  <Input name="password" type="password" placeholder="Leave blank to keep current" minLength={6} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select name="role" defaultValue={editingUser?.role || 'user'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={updateUserMutation.isPending}>
                    {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">User</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Role</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Last Login</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Joined</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingUsers ? (
              <tr><td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">Loading users...</td></tr>
            ) : displayUsers.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">No users found</td></tr>
            ) : (
              displayUsers.map((user: any, i: number) => (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {user.name && user.name.length > 0 ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                      </div>
                      <span className="text-foreground font-medium text-xs">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${ROLE_STYLE[user.role] || 'bg-muted text-muted-foreground'}`}>{user.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[user.status] === 'active' ? 'bg-success/10 text-success' : user.status === 'banned' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{user.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden md:table-cell">{user.lastActive ? new Date(user.lastActive).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden md:table-cell">{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEditUser(user)} className="p-1 rounded hover:bg-primary/10 transition-colors" title="Edit User"><Edit className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" /></button>
                      {user.status === 'banned' || user.status === 'suspended' ? (
                        <button onClick={() => handleToggleStatus(user)} className="p-1 rounded hover:bg-success/10 transition-colors" title="Activate/Unban User"><CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground hover:text-success" /></button>
                      ) : (
                        <button onClick={() => handleToggleStatus(user)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Ban/Suspend User"><Ban className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                      )}
                      <button onClick={() => handleDelete(user)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete User"><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
        Showing {displayUsers.length} of {users.length} users
      </div>
    </div>
  );
}

// ==================== SYSTEM SECTION ====================

function SystemSection({ systemMetrics, storageBreakdown, totalStorage, latestMetric }: {
  systemMetrics: ReturnType<typeof generateSystemMetrics>;
  storageBreakdown: typeof import('@/data/admin-data').storageBreakdown;
  totalStorage: number;
  latestMetric: ReturnType<typeof generateSystemMetrics>[0];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'CPU', value: `${latestMetric.cpu}%`, color: 'text-primary' },
          { label: 'RAM', value: `${latestMetric.ram}%`, color: 'text-accent' },
          { label: 'Disk', value: `${latestMetric.disk}%`, color: 'text-warning' },
          { label: 'Latency', value: `${latestMetric.latency}ms`, color: 'text-success' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">CPU & RAM (24h)</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={systemMetrics}>
                <defs>
                  <linearGradient id="gradCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200 100% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(200 100% 55%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(165 80% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(165 80% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 15% 22%)" />
                <XAxis dataKey="timestamp" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v}%`, '']} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="cpu" name="CPU" stroke="hsl(200 100% 55%)" fill="url(#gradCpu)" strokeWidth={2} />
                <Area type="monotone" dataKey="ram" name="RAM" stroke="hsl(165 80% 45%)" fill="url(#gradRam)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Storage Breakdown</h2>
          <div className="flex items-center gap-6">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={storageBreakdown} dataKey="size" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                    {storageBreakdown.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v} MB`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {storageBreakdown.map(b => (
                <div key={b.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="text-muted-foreground">{b.category}</span>
                  </div>
                  <span className="font-mono text-foreground">{b.size} MB</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">Total</span>
                <span className="text-foreground font-mono">{totalStorage} MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Request Volume (24h)</h2>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={systemMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 15% 22%)" />
              <XAxis dataKey="timestamp" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(220 10% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(230 22% 14%)', border: '1px solid hsl(230 15% 22%)', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="requests" name="Requests" fill="hsl(165 80% 45%)" radius={[3, 3, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ==================== AUDIT LOG SECTION ====================

function AuditLogSection() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditSearch) params.append('search', auditSearch);
      if (auditFilter && auditFilter !== 'all') params.append('filter', auditFilter);

      const data = await apiClient.get<any>(`/api/admin/audit/logs?${params.toString()}`);
      if (data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs();
    }, 500); // Debounce search
    return () => clearTimeout(timer);
  }, [auditSearch, auditFilter]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Audit Log</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              placeholder="Search actions, users..."
              className="pl-8 h-8 text-xs w-full sm:w-[200px] bg-secondary border-border"
            />
          </div>
          <Select value={auditFilter} onValueChange={setAuditFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={fetchAuditLogs}
            className="p-1.5 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-secondary/80 backdrop-blur-sm">
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Timestamp</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">User</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Action</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Details</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden sm:table-cell">Severity</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">IP</th>
            </tr>
          </thead>
          <tbody>
            {auditLoading && auditLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">Loading logs...</td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">No audit logs found</td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground font-medium">{log.user}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground">{log.action}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell max-w-[250px] truncate" title={String(log.details)}>{String(log.details)}</td>
                  <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${log.severity === 'error' || log.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                      log.severity === 'warning' ? 'bg-warning/10 text-warning' :
                        'bg-info/10 text-info'
                      }`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground text-xs font-mono hidden lg:table-cell">{log.ip || '-'}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
        Showing {auditLogs.length} entries
      </div>
    </div>
  );
}

// ==================== GRAPH SETTINGS SECTION ====================

function GraphSettingsSection() {
  const [settings, setSettings] = useState(graphSettings);
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Graph Settings</h2>
        <p className="text-xs text-muted-foreground mb-5">Configure knowledge graph visualization and behavior</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Layout Algorithm</label>
            <Select value={settings.layout} onValueChange={v => setSettings(s => ({ ...s, layout: v as typeof s.layout }))}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="force">Force-Directed</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Node Size</label>
            <Select value={settings.nodeSize} onValueChange={v => setSettings(s => ({ ...s, nodeSize: v as typeof s.nodeSize }))}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="by-connections">By Connections</SelectItem>
                <SelectItem value="by-importance">By Importance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Max Nodes</label>
            <Input type="number" value={settings.maxNodes} onChange={e => setSettings(s => ({ ...s, maxNodes: +e.target.value }))} className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Max Edges</label>
            <Input type="number" value={settings.maxEdges} onChange={e => setSettings(s => ({ ...s, maxEdges: +e.target.value }))} className="h-9 text-xs bg-secondary border-border" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {[
            { label: 'Show Node Labels', key: 'showLabels' as const, value: settings.showLabels },
            { label: 'Show Edge Labels', key: 'showEdgeLabels' as const, value: settings.showEdgeLabels },
            { label: 'Cluster by Type', key: 'clusterByType' as const, value: settings.clusterByType },
            { label: 'Enable Physics', key: 'physics' as const, value: settings.physics },
          ].map(toggle => (
            <div key={toggle.key} className="flex items-center justify-between">
              <span className="text-xs text-foreground">{toggle.label}</span>
              <Switch checked={toggle.value} onCheckedChange={v => setSettings(s => ({ ...s, [toggle.key]: v }))} className="scale-75" />
            </div>
          ))}
        </div>
        <button className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          Save Graph Settings
        </button>
      </div>
    </div>
  );
}



// ==================== TEAM ANALYSIS SETTINGS ====================

function TeamAnalysisSettingsSection() {
  const [config, setConfig] = useState(teamAnalysisConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<any>('/api/team-analysis/config');
        if (data.ok && data.config) {
          setConfig(prev => ({ ...prev, ...data.config }));
        }
      } catch (error) {
        console.error('Failed to fetch team analysis config', error);
        toast.error('Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveAndRun = async () => {
    setSaving(true);
    try {
      const saveRes = await apiClient.put<any>('/api/team-analysis/config', config);
      if (!saveRes.ok) throw new Error(saveRes.error || 'Failed to save config');

      const analyzeRes = await apiClient.post<any>('/api/team-analysis/team/analyze', {
        forceReanalysis: true
      });
      if (!analyzeRes.ok) throw new Error(analyzeRes.error || 'Analysis failed to start');

      toast.success('Configuration saved and analysis started successfully');
    } catch (error: any) {
      console.error('Team analysis error', error);
      toast.error(error.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Team Analysis Configuration</h2>
        <p className="text-xs text-muted-foreground mb-5">Configure automated team analysis parameters</p>

        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading configuration...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Analysis Frequency</label>
                <Select value={config.analysisFrequency} onValueChange={(v: any) => setConfig(c => ({ ...c, analysisFrequency: v }))}>
                  <SelectTrigger className="h-9 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Min Meetings Required</label>
                <Input type="number" value={config.minMeetingsForAnalysis} onChange={(e) => setConfig(c => ({ ...c, minMeetingsForAnalysis: parseInt(e.target.value) || 0 }))} className="h-9 text-xs bg-secondary border-border" />
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { label: 'Personality Analysis', key: 'includePersonality' as const, value: config.includePersonality },
                { label: 'Sentiment Tracking', key: 'includeSentiment' as const, value: config.includeSentiment },
                { label: 'Communication Patterns', key: 'includeCommunication' as const, value: config.includeCommunication },
                { label: 'Collaboration Metrics', key: 'includeCollaboration' as const, value: config.includeCollaboration },
              ].map(toggle => (
                <div key={toggle.key} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{toggle.label}</span>
                  <Switch checked={toggle.value} onCheckedChange={(v) => setConfig(c => ({ ...c, [toggle.key]: v }))} className="scale-75" />
                </div>
              ))}
            </div>

            <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Last Analysis:</span><span className="text-foreground font-mono">{config.lastAnalysis}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Next Scheduled:</span><span className="text-foreground font-mono">{config.nextScheduled}</span></div>
            </div>

            <button
              onClick={handleSaveAndRun}
              disabled={saving}
              className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving & Running...
                </>
              ) : (
                'Save & Run Analysis Now'
              )}
            </button>
          </>
        )}
      </div>

      <TeamAnalysisProjectsTable />
    </div>
  );
}

function TeamAnalysisProjectsTable() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/api/team-analysis/admin/projects');
      if (res.ok && res.projects) {
        setProjects(res.projects);
      }
    } catch (error) {
      console.error('Failed to fetch projects', error);
      toast.error('Failed to load projects list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAnalyzeProject = async (projectId: string) => {
    setAnalyzingIds(prev => new Set(prev).add(projectId));
    try {
      const res = await apiClient.post<any>(`/api/team-analysis/admin/projects/${projectId}/analyze`, {
        forceReanalysis: true
      });

      if (!res.ok) throw new Error(res.error || 'Analysis failed');

      toast.success('Analysis completed successfully');
      // Refresh list to update timestamp
      fetchProjects();
    } catch (error: any) {
      console.error('Project analysis error', error);
      toast.error(error.message || 'Analysis failed');
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Project Analysis Status</h2>
          <p className="text-xs text-muted-foreground">Monitor and trigger analysis for individual projects</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProjects} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs h-8">Project Name</TableHead>
              <TableHead className="text-xs h-8">Status</TableHead>
              <TableHead className="text-xs h-8">Last Analysis</TableHead>
              <TableHead className="text-xs h-8 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  Loading projects...
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  No projects found
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id} className="h-10">
                  <TableCell className="text-xs font-medium">{project.name}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={project.isEnabled ? 'default' : 'secondary'} className="text-[10px] h-5">
                      {project.isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {project.lastAnalysisAt
                      ? new Date(project.lastAnalysisAt).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleAnalyzeProject(project.id)}
                      disabled={analyzingIds.has(project.id)}
                    >
                      {analyzingIds.has(project.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==================== GOOGLE DRIVE SECTION ====================

function GoogleDriveSection() {
  const [config, setConfig] = useState({
    enabled: false,
    rootFolderId: '',
    hasSystemCredentials: false,
    bootstrappedAt: null as string | null,
    pendingProjects: [] as { id: string, name: string }[],
    configuredProjects: [] as { id: string, name: string, folderId: string }[]
  });
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<any>('/api/system/google-drive');
      setConfig(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load Google Drive config');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.post('/api/system/google-drive', {
        enabled: config.enabled,
        rootFolderId: config.rootFolderId,
        serviceAccountJson: serviceAccountJson || undefined
      });
      toast.success('Configuration saved');
      setServiceAccountJson('');
      loadConfig();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    try {
      const res: any = await apiClient.post('/api/system/google-drive/bootstrap-all', {});
      toast.success(res.message);
      loadConfig();
    } catch (error) {
      console.error(error);
      toast.error('Bootstrap failed');
    } finally {
      setIsBootstrapping(false);
    }
  };

  if (isLoading && !config.hasSystemCredentials && !config.rootFolderId) {
    return <div className="p-10 text-center text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" /> Google Drive Integration (System)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Configure system-wide Google Drive integration (Service Account)</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${config.enabled ? 'border-success/30 text-success' : 'border-muted'}`}>
            {config.enabled ? '● Enabled' : '○ Disabled'}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
            <span className="text-xs font-medium text-foreground">Enable Integration</span>
            <Switch checked={config.enabled} onCheckedChange={v => setConfig(prev => ({ ...prev, enabled: v }))} />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Root Folder ID</label>
            <Input
              value={config.rootFolderId}
              onChange={e => setConfig(prev => ({ ...prev, rootFolderId: e.target.value }))}
              className="bg-secondary/50 border-border text-xs"
              placeholder="Folder ID from Google Drive URL"
            />
            <p className="text-[10px] text-muted-foreground mt-1">The ID of the folder where all project folders will be created.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Service Account JSON</label>
            <textarea
              value={serviceAccountJson}
              onChange={e => setServiceAccountJson(e.target.value)}
              className="w-full h-32 bg-secondary/50 border border-border rounded-md p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={config.hasSystemCredentials ? "(Credentials are set. Paste new JSON to update)" : "Paste content of service-account.json here"}
            />
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] ${config.hasSystemCredentials ? 'text-success' : 'text-warning'} flex items-center gap-1`}>
                {config.hasSystemCredentials ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {config.hasSystemCredentials ? 'Credentials configured' : 'No credentials set'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save Configuration
            </button>
          </div>

          {/* Pending Projects List */}
          {config.enabled && config.hasSystemCredentials && (
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-foreground">
                  Pending Projects ({config.pendingProjects.length})
                </h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={isBootstrapping || config.pendingProjects.length === 0}
                      className={`px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-2 ${config.pendingProjects.length > 0 ? 'border-primary/30 text-primary' : ''}`}
                    >
                      {isBootstrapping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FolderSync className="w-3 h-3" />}
                      {config.pendingProjects.length > 0
                        ? `Bootstrap ${config.pendingProjects.length} Pending Projects`
                        : 'All Projects Optimized'}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Bootstrap Project Folders?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create the necessary Google Drive folder structures for <strong>{config.pendingProjects.length}</strong> pending projects.
                        <br /><br />
                        This action is safe to run multiple times. It will verify existing folders and only create missing ones.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBootstrap}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {config.pendingProjects.length > 0 ? (
                <div className="bg-secondary/20 rounded-lg border border-border overflow-hidden">
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-secondary/40 sticky top-0">
                        <tr>
                          <th className="p-2 font-medium text-muted-foreground">Project Name</th>
                          <th className="p-2 font-medium text-muted-foreground">ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.pendingProjects.map((p) => (
                          <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                            <td className="p-2 text-foreground font-medium">{p.name}</td>
                            <td className="p-2 text-muted-foreground font-mono">{p.id.substring(0, 8)}...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground bg-secondary/10 rounded-lg border border-border border-dashed">
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-success/50" />
                  All projects have Google Drive folders configured.
                </div>
              )}
            </div>
          )}

          {/* Configured Projects List */}
          {config.enabled && config.hasSystemCredentials && config.configuredProjects && config.configuredProjects.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-foreground mb-3">
                Active Projects ({config.configuredProjects.length})
              </h3>

              <div className="bg-secondary/20 rounded-lg border border-border overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-secondary/40 sticky top-0">
                      <tr>
                        <th className="p-2 font-medium text-muted-foreground w-1/3">Project Name</th>
                        <th className="p-2 font-medium text-muted-foreground w-1/3">ID</th>
                        <th className="p-2 font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.configuredProjects.map((p) => (
                        <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                          <td className="p-2 text-foreground font-medium">{p.name}</td>
                          <td className="p-2 text-muted-foreground font-mono">{p.id.split('-')[0]}...</td>
                          <td className="p-2 text-right">
                            <a
                              href={`https://drive.google.com/drive/folders/${p.folderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 hover:underline transition-colors"
                            >
                              Open Folder <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {config.bootstrappedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Last bootstrap run: {new Date(config.bootstrappedAt).toLocaleString()}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}


// ==================== BILLING SECTION ====================

function BillingSection() {
  const [exchangeRate, setExchangeRate] = useState(billingData.exchangeRate);
  const [pricing, setPricing] = useState(billingData.globalPricing);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [projects, setProjects] = useState<any[]>([]); // Using any for flexibility with backend response
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [balanceDialog, setBalanceDialog] = useState<{ isOpen: boolean, projectId: string | null, currentBalance: number | null }>({ isOpen: false, projectId: null, currentBalance: null });
  const [balanceAmount, setBalanceAmount] = useState('');
  const [blockDialog, setBlockDialog] = useState<{ isOpen: boolean, projectId: string | null, isBlocked: boolean }>({ isOpen: false, projectId: null, isBlocked: false });

  // Audit Log State removed (moved to AuditLogSection)

  // Computed metrics
  const totalProjects = projects.length;
  const blockedProjects = projects.filter(p => p.status === 'blocked').length;
  const unlimitedProjects = projects.filter(p => p.status === 'unlimited').length;

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      // Parallel fetch for speed
      const [rateRes, pricingRes, tiersRes, projectsRes] = await Promise.all([
        apiClient.get<any>('/api/admin/billing/exchange-rate').catch(() => ({ data: null })),
        apiClient.get<any>('/api/admin/billing/pricing').catch(() => ({ data: null })),
        apiClient.get<any>('/api/admin/billing/pricing/tiers').catch(() => ({ data: null })),
        apiClient.get<any>('/api/admin/billing/projects').catch(() => ({ data: null }))
      ]);

      if (rateRes?.success || rateRes?.data?.success) {
        const data = rateRes.success ? rateRes : rateRes.data;
        setExchangeRate({
          autoFromApi: data.auto,
          currentRate: data.currentRate,
          source: data.source,
          lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never'
        });
      }

      if (pricingRes?.success || pricingRes?.data?.success) {
        const data = pricingRes.success ? pricingRes : pricingRes.data;
        if (data.config) {
          setPricing({
            fixedMarkup: data.config.fixed_markup_percent,
            periodType: data.config.period_type
          });
        }
      }

      if (tiersRes?.success || tiersRes?.data?.success) {
        const data = tiersRes.success ? tiersRes : tiersRes.data;
        setTiers((data.tiers || []).map((t: any) => ({
          id: t.id || `tier-${Math.random()}`,
          name: t.name,
          minTokens: t.token_limit,
          maxTokens: null, // Backend specific
          markup: t.markup_percent
        })));
      }

      if (projectsRes?.success || projectsRes?.data?.success) {
        const data = projectsRes.success ? projectsRes : projectsRes.data;
        setProjects((data.projects || []).map((p: any) => {
          let statusString = 'active';
          if (p.status === 'blocked') statusString = 'blocked';
          else if (p.unlimited_balance) statusString = 'unlimited';
          else if (p.is_blocked) statusString = 'no_balance'; // Blocked due to balance

          return {
            id: p.project_id,
            name: p.project_name,
            balance: p.unlimited_balance ? null : p.balance_eur,
            status: statusString,
            rawStatus: p.status, // Keep raw status for toggle logic
            tokensPeriod: p.tokens_this_period,
            costPeriod: p.billable_cost_this_period
          };
        }));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    fetchBillingData();
  }, []);



  const handleSaveExchangeRate = async () => {
    try {
      await apiClient.post('/api/admin/billing/exchange-rate', {
        auto: exchangeRate.autoFromApi,
        manualRate: exchangeRate.currentRate
      });
      toast.success('Exchange rate settings saved');
    } catch (error) {
      toast.error('Failed to save exchange rate settings');
    }
  };

  const handleRefreshExchangeRate = async () => {
    try {
      const { data } = await apiClient.post<any>('/api/admin/billing/exchange-rate/refresh', {});
      if (data.success) {
        toast.success(`Exchange rate updated: ${data.rate}`);
        setExchangeRate(prev => ({ ...prev, currentRate: data.rate, lastUpdated: new Date().toLocaleString() }));
      }
    } catch (error) {
      toast.error('Failed to refresh exchange rate');
    }
  };

  const handleSaveGlobalPricing = async () => {
    try {
      await apiClient.post('/api/admin/billing/pricing', {
        fixed_markup_percent: pricing.fixedMarkup,
        period_type: pricing.periodType,
        usd_to_eur_rate: exchangeRate.currentRate
      });
      toast.success('Global pricing configuration saved');
    } catch (error) {
      toast.error('Failed to save global pricing');
    }
  };

  const handleSaveTiers = async () => {
    try {
      const tiersPayload = tiers.map(t => ({
        token_limit: t.minTokens,
        markup_percent: t.markup,
        name: t.id
      }));
      await apiClient.post('/api/admin/billing/pricing/tiers', { tiers: tiersPayload });
      toast.success('Pricing tiers saved');
    } catch (error) {
      toast.error('Failed to save pricing tiers');
    }
  };

  const openBalanceDialog = (projectId: string, currentBalance: number | null) => {
    setBalanceDialog({ isOpen: true, projectId, currentBalance });
    setBalanceAmount('');
  };

  const submitBalanceUpdate = async () => {
    if (!balanceDialog.projectId) return;
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error("Please enter a valid non-zero amount");
      return;
    }

    try {
      await apiClient.post(`/api/admin/billing/projects/${balanceDialog.projectId}/balance`, { amount, description: 'Admin manual update' });
      toast.success('Balance updated');
      setBalanceDialog({ ...balanceDialog, isOpen: false });
      fetchBillingData();
    } catch (error) {
      toast.error('Failed to update balance');
    }
  };

  const openBlockDialog = (projectId: string, isBlocked: boolean) => {
    setBlockDialog({ isOpen: true, projectId, isBlocked });
  };

  const confirmBlockToggle = async () => {
    if (!blockDialog.projectId) return;

    try {
      await apiClient.post(`/api/admin/billing/projects/${blockDialog.projectId}/block`, { blocked: !blockDialog.isBlocked });
      toast.success(`Project ${!blockDialog.isBlocked ? 'blocked' : 'unblocked'}`);
      setBlockDialog({ ...blockDialog, isOpen: false });
      fetchBillingData();
    } catch (error) {
      toast.error('Failed to update project status');
    }
  };

  const handleUnlimitedToggle = async (projectId: string, currentStatus: boolean) => {
    try {
      await apiClient.post(`/api/admin/billing/projects/${projectId}/unlimited`, { unlimited: !currentStatus });
      toast.success(`Project funds set to ${!currentStatus ? 'Unlimited' : 'Limited'}`);
      fetchBillingData();
    } catch (error) {
      toast.error('Failed to update unlimited status');
    }
  };

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const addTier = () => {
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].minTokens || 0) + 100000 : 0; // Simple increment
    setTiers([...tiers, { id: `new-tier-${Date.now()}`, minTokens: lastMax, maxTokens: null, markup: 0 }]);
  };

  const removeTier = (id: string) => setTiers(tiers.filter(t => t.id !== id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Billing & Cost Control</h1>
        <p className="text-xs text-muted-foreground">Manage project balances, pricing, and cost limits</p>
      </div>


      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Exchange Rate (USD to EUR)</h2>
        <div className="flex items-center gap-2 mb-4">
          <Switch
            checked={exchangeRate.autoFromApi}
            onCheckedChange={(checked) => setExchangeRate({ ...exchangeRate, autoFromApi: checked })}
          />
          <span className="text-xs text-primary">Automatic rate from API</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">Fetches live USD/EUR rate daily (Frankfurter API)</p>

        <div className="space-y-2 mb-4 bg-secondary/20 p-3 rounded-lg border border-border">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Current Rate (USD to EUR)</p>
            <p className="text-xl font-mono text-foreground font-bold">{exchangeRate.currentRate?.toFixed(5) || '---'}</p>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                Source: <span className="text-foreground font-medium">{exchangeRate.source || 'Unknown'}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Updated: {exchangeRate.lastUpdated}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshExchangeRate}
            className="px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Rate
          </button>
        </div>
        <button
          onClick={handleSaveExchangeRate}
          className="mt-4 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
        >
          Save Exchange Rate Settings
        </button>
      </div>

      {/* Global Pricing Configuration */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Global Pricing Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fixed Markup (%)</label>
            <Input
              type="number"
              value={pricing.fixedMarkup}
              onChange={e => setPricing({ ...pricing, fixedMarkup: Number(e.target.value) })}
              className="h-9 text-xs bg-secondary border-border"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Applied when no tier matches</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Period Type</label>
            <Select value={pricing.periodType} onValueChange={(v: 'monthly' | 'weekly' | 'daily') => setPricing({ ...pricing, periodType: v })}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Tier reset period</p>
          </div>
        </div>
        <button
          onClick={handleSaveGlobalPricing}
          className="mt-4 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
        >
          Save Global Pricing
        </button>
      </div>

      {/* Pricing Tiers */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Pricing Tiers (Volume Discount)</h2>
            <p className="text-xs text-primary">Lower markup as projects consume more tokens per period</p>
          </div>
          <button
            onClick={handleSaveTiers}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="w-3 h-3 mr-1" /> Save Tiers
          </button>
        </div>

        <button onClick={addTier} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors mb-3">
          <Plus className="w-3 h-3" /> Add Tier
        </button>
        {tiers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tiers configured. Using fixed markup of {pricing.fixedMarkup}% for all usage.</p>
        ) : (
          <div className="space-y-2">
            {tiers.map(tier => (
              <div key={tier.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-border">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Min Tokens</label>
                    <Input
                      type="number"
                      value={tier.minTokens}
                      onChange={e => setTiers(tiers.map(t => t.id === tier.id ? { ...t, minTokens: Number(e.target.value) } : t))}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Markup %</label>
                    <Input type="number" value={tier.markup} className="h-7 text-xs"
                      onChange={e => setTiers(tiers.map(t => t.id === tier.id ? { ...t, markup: Number(e.target.value) } : t))}
                    />
                  </div>
                </div>
                <button onClick={() => removeTier(tier.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects Billing */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Projects Billing</h2>
          <p className="text-xs text-muted-foreground mt-1">{totalProjects} projects | {blockedProjects} blocked | {unlimitedProjects} unlimited</p>
        </div>
        <div className="p-4 border-b border-border">
          <button
            onClick={fetchBillingData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Project</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Balance</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Tokens (Period)</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Cost (Period)</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-xs text-foreground">{p.name}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{p.balance === null ? '∞ Unlimited' : `€${(p.balance || 0).toFixed(2)}`}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${p.status === 'unlimited' ? 'bg-primary/10 text-primary' :
                      p.status === 'blocked' ? 'bg-destructive/10 text-destructive' :
                        p.status === 'no_balance' ? 'bg-warning/10 text-warning' :
                          'bg-success/10 text-success'
                      }`}>
                      {p.status === 'no_balance' ? 'LOW FUNDS' : p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-foreground">{formatTokens(p.tokensPeriod || 0)}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-foreground">{(p.costPeriod || 0).toFixed(2)} €</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openBalanceDialog(p.id, p.balance)}
                        className="p-1.5 rounded hover:bg-warning/10 transition-colors"
                        title="Edit balance"
                      >
                        <Pencil className="w-3.5 h-3.5 text-warning" />
                      </button>
                      <button
                        onClick={() => openBlockDialog(p.id, p.rawStatus === 'blocked')}
                        className={`p-1.5 rounded transition-colors ${p.rawStatus === 'blocked' ? 'hover:bg-success/10 text-success' : 'hover:bg-destructive/10 text-destructive'}`}
                        title={p.rawStatus === 'blocked' ? "Unblock project" : "Block project"}
                      >
                        {p.rawStatus === 'blocked' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleUnlimitedToggle(p.id, p.status === 'unlimited')}
                        className={`p-1.5 rounded transition-colors ${p.status === 'unlimited' ? 'hover:bg-primary/10 text-primary' : 'hover:bg-primary/20 text-muted-foreground'}`}
                        title={p.status === 'unlimited' ? "Disable Unlimited Funds" : "Set Unlimited Funds"}
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">No projects found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={balanceDialog.isOpen} onOpenChange={open => setBalanceDialog({ ...balanceDialog, isOpen: open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Project Balance</DialogTitle>
            <DialogDescription>
              Add funds (credit) or remove funds (debit) from the project balance.
              <br />
              Current Balance: <span className="font-mono font-medium text-foreground">{balanceDialog.currentBalance === null ? 'Unlimited' : `€${(balanceDialog.currentBalance || 0).toFixed(2)}`}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Amount (€)</Label>
              <Input
                id="amount"
                type="number"
                value={balanceAmount}
                onChange={e => setBalanceAmount(e.target.value)}
                placeholder="0.00 (use negative to debit)"
                className="col-span-3 bg-secondary/50"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && submitBalanceUpdate()}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setBalanceDialog({ ...balanceDialog, isOpen: false })}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary/50 transition-colors mr-2"
            >
              Cancel
            </button>
            <button
              onClick={submitBalanceUpdate}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Update Balance
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockDialog.isOpen} onOpenChange={open => setBlockDialog({ ...blockDialog, isOpen: open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>{blockDialog.isBlocked ? 'unblock' : 'block'}</strong> the project.
              {blockDialog.isBlocked ? ' The project will regain access to the API.' : ' Blocked projects cannot access the API or generate costs.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlockToggle} className={blockDialog.isBlocked ? "bg-success hover:bg-success/90 text-success-foreground" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}>
              {blockDialog.isBlocked ? 'Unblock Project' : 'Block Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminPage;
=======
import { useState } from 'react';
import { Shield, Activity, Server, FileText, Clock } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { useAdminStats, useAdminProviders, useAdminAuditLog } from '../hooks/useGodMode';

type AdminTab = 'stats' | 'providers' | 'audit';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');

  const stats = useAdminStats();
  const providers = useAdminProviders();
  const audit = useAdminAuditLog();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { key: 'stats' as AdminTab, label: 'System Stats', icon: Activity },
          { key: 'providers' as AdminTab, label: 'LLM Providers', icon: Server },
          { key: 'audit' as AdminTab, label: 'Audit Log', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* System Stats */}
      {activeTab === 'stats' && (
        <div>
          {stats.isLoading ? (
            <div className="text-[hsl(var(--muted-foreground))]">Loading stats...</div>
          ) : stats.error ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              Unable to load system stats. You may not have admin access.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(stats.data ?? {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border bg-[hsl(var(--card))] p-4">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {typeof value === 'number' ? value.toLocaleString() : String(value ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LLM Providers */}
      {activeTab === 'providers' && (
        <div>
          {providers.isLoading ? (
            <div className="text-[hsl(var(--muted-foreground))]">Loading providers...</div>
          ) : providers.error ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              Unable to load LLM providers. You may not have admin access.
            </div>
          ) : (
            <div className="space-y-3">
              {(providers.data ?? []).map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-lg border bg-[hsl(var(--card))] p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {provider.name}
                      <Badge
                        variant={provider.enabled ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {provider.status && (
                        <Badge
                          variant={
                            provider.status === 'healthy'
                              ? 'default'
                              : provider.status === 'degraded'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="text-[10px]"
                        >
                          {provider.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Models: {provider.models.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
              {(providers.data ?? []).length === 0 && (
                <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
                  No LLM providers configured.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <div>
          {audit.isLoading ? (
            <div className="text-[hsl(var(--muted-foreground))]">Loading audit log...</div>
          ) : audit.error ? (
            <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
              Unable to load audit log. You may not have admin access.
            </div>
          ) : (
            <div className="space-y-2">
              {(audit.data ?? []).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border bg-[hsl(var(--card))] p-3 flex items-center gap-3"
                >
                  <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <Badge variant="outline" className="text-[10px] mr-2">
                        {entry.operation}
                      </Badge>
                      {entry.table_name}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {entry.changed_by_email ?? 'System'} &middot;{' '}
                      {new Date(entry.changed_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {(audit.data ?? []).length === 0 && (
                <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
                  No audit log entries.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
>>>>>>> origin/claude/migrate-to-react-uJJbl
