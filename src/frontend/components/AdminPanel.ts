/**
 * AdminPanel Component
 * Platform administration for superadmin users
 * Includes: LLM Config, Graph, Prompts, Processing, Audit Log
 */

import { createElement, on } from '../utils/dom';
import { http } from '../services/api';
import { toast } from '../services/toast';
import { appStore } from '../stores/app';
import { 
  billingService, 
  type ProjectBillingOverview, 
  type PricingConfig, 
  type PricingTier,
  formatEur, 
  formatTokens 
} from '../services/billing';

// Types
interface SystemConfig {
  id?: string;
  key: string;
  value: unknown;
  category: string;
  description?: string;
}

interface LLMProvider {
  id: string;
  name: string;
  enabled: boolean;
  models: string[];
  status?: 'healthy' | 'degraded' | 'offline';
}

interface AuditLogEntry {
  id: string;
  table_name: string;
  operation: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  changed_by_email?: string;
  changed_at: string;
}

interface SystemPrompt {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  prompt_template: string;
  uses_ontology: boolean;
}

// Ontology state (for Admin Ontology tab)
interface OntologyEntityType {
  name: string;
  properties?: string[];
  searchable?: string[];
  required?: string[];
  sharedEntity?: boolean;
}
interface OntologyRelationType {
  name: string;
  sourceType?: string;
  targetType?: string;
}
let ontologyEntities: OntologyEntityType[] = [];
let ontologyRelations: OntologyRelationType[] = [];
let ontologyLoaded = false;
let ontologyLoading = false;

// Graph overview state (for Graph section)
interface GraphListItem {
  graphName: string;
  projectId?: string | null;
  projectName?: string | null;
}
let graphList: GraphListItem[] = [];
let graphStatus: { enabled?: boolean; graphName?: string; stats?: { nodes?: number; relationships?: number } } | null = null;
let graphOverviewLoaded = false;
let graphOverviewLoading = false;
let graphPasswordSet = false; // Track if GRAPH_PASSWORD secret exists

// State
let currentSection = 'llm';
let systemConfig: Record<string, SystemConfig[]> = {};
let providers: LLMProvider[] = [];
let auditLogs: AuditLogEntry[] = [];
let systemPrompts: SystemPrompt[] = [];
let isLoading = false;

// Team Analysis settings state (per-project, loaded on demand)
interface TeamAnalysisSettings {
  enabled: boolean;
  access: 'admin_only' | 'all';
}
let teamAnalysisSettings: TeamAnalysisSettings = { enabled: true, access: 'admin_only' };
let teamAnalysisLoaded = false;
let teamAnalysisLoading = false;

// Billing state
let billingProjects: ProjectBillingOverview[] = [];
let globalPricingConfig: PricingConfig | null = null;
let globalPricingTiers: PricingTier[] = [];
let billingLoaded = false;
let billingLoading = false;

/**
 * Load system configuration
 */
async function loadSystemConfig(): Promise<void> {
  try {
    const response = await http.get<{ 
      llm_pertask?: { text?: { provider: string; model: string }; vision?: { provider: string; model: string }; embeddings?: { provider: string; model: string } };
      prompts?: Record<string, unknown>;
      processing?: Record<string, unknown>;
      graph?: Record<string, unknown>;
    }>('/api/system/config');
    
    // Convert to internal format grouped by category
    systemConfig = {};
    
    // LLM per-task configs
    if (response.data?.llm_pertask) {
      systemConfig['llm'] = [];
      const perTask = response.data.llm_pertask;
      if (perTask.text) {
        systemConfig['llm'].push({ key: 'text_provider', value: perTask.text, category: 'llm' });
      }
      if (perTask.vision) {
        systemConfig['llm'].push({ key: 'vision_provider', value: perTask.vision, category: 'llm' });
      }
      if (perTask.embeddings) {
        systemConfig['llm'].push({ key: 'embeddings_provider', value: perTask.embeddings, category: 'llm' });
      }
    }
    
    // Processing config
    if (response.data?.processing) {
      systemConfig['processing'] = [{ key: 'processing', value: response.data.processing, category: 'processing' }];
    }
    
    // Graph config
    if (response.data?.graph) {
      systemConfig['graph'] = [{ key: 'graph', value: response.data.graph, category: 'graph' }];
    }
    
    console.log('[AdminPanel] Loaded system config:', systemConfig);
  } catch (error) {
    console.warn('Failed to load system config:', error);
    systemConfig = {};
  }
}

/**
 * Load secrets to check if graph password is set
 */
async function loadSecrets(): Promise<void> {
  try {
    const response = await http.get<{ secrets: Array<{ name: string; masked_value?: string }> }>('/api/secrets');
    const secrets = response.data?.secrets || [];
    graphPasswordSet = secrets.some(s => s.name === 'GRAPH_PASSWORD');
    console.log('[AdminPanel] Graph password set:', graphPasswordSet);
  } catch (error) {
    console.warn('Failed to load secrets:', error);
    graphPasswordSet = false;
  }
}

/**
 * Load LLM providers status
 */
async function loadProviders(): Promise<void> {
  // Default providers - all supported LLM providers
  const defaultProviders: LLMProvider[] = [
    { id: 'openai', name: 'OpenAI', enabled: false, models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
    { id: 'anthropic', name: 'Anthropic (Claude)', enabled: false, models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
    { id: 'google', name: 'Google AI (Gemini)', enabled: false, models: ['gemini-2.0-flash', 'gemini-pro', 'gemini-pro-vision'] },
    { id: 'xai', name: 'xAI (Grok)', enabled: false, models: ['grok-2', 'grok-beta'] },
    { id: 'deepseek', name: 'DeepSeek', enabled: false, models: ['deepseek-chat', 'deepseek-coder'] },
    { id: 'kimi', name: 'Kimi (Moonshot)', enabled: false, models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
    { id: 'minimax', name: 'MiniMax', enabled: false, models: ['abab5.5-chat', 'abab6-chat'] },
    { id: 'ollama', name: 'Ollama (Local)', enabled: true, models: ['llama2', 'mistral', 'codellama', 'qwen2.5'] },
  ];
  
  try {
    const response = await http.get<{ providers: LLMProvider[] }>('/api/llm/providers');
    const apiProviders = response.data?.providers;
    providers = Array.isArray(apiProviders) && apiProviders.length > 0 ? apiProviders : defaultProviders;
  } catch (error) {
    console.warn('Failed to load providers, using defaults:', error);
    providers = defaultProviders;
  }
}

/**
 * Load audit logs
 */
async function loadAuditLogs(): Promise<void> {
  try {
    const response = await http.get<{ logs: AuditLogEntry[] }>('/api/system/audit?limit=50');
    auditLogs = Array.isArray(response.data?.logs) ? response.data.logs : [];
  } catch (error) {
    console.warn('Failed to load audit logs:', error);
    auditLogs = [];
  }
}

/**
 * Load system prompts
 */
async function loadSystemPrompts(): Promise<void> {
  try {
    const response = await http.get<{ prompts: SystemPrompt[] }>('/api/system/prompts');
    systemPrompts = Array.isArray(response.data?.prompts) ? response.data.prompts : [];
  } catch (error) {
    console.warn('Failed to load system prompts:', error);
    // Use default prompts structure
    systemPrompts = [
      { id: '1', key: 'document', name: 'Document Extraction', description: 'Extract information from PDFs and text files', category: 'extraction', prompt_template: '', uses_ontology: true },
      { id: '2', key: 'transcript', name: 'Transcript Extraction', description: 'Extract information from meeting transcripts', category: 'extraction', prompt_template: '', uses_ontology: true },
      { id: '3', key: 'vision', name: 'Vision/Image Extraction', description: 'Extract information from images and diagrams', category: 'extraction', prompt_template: '', uses_ontology: true },
      { id: '4', key: 'conversation', name: 'Conversation Extraction', description: 'Extract information from chat conversations', category: 'extraction', prompt_template: '', uses_ontology: true },
      { id: '5', key: 'email', name: 'Email Extraction', description: 'Extract information from emails', category: 'extraction', prompt_template: '', uses_ontology: true },
      { id: '6', key: 'summary', name: 'Content Summary', description: 'Generate concise summaries', category: 'analysis', prompt_template: '', uses_ontology: false },
    ];
  }
}

/**
 * Load ontology data (entities and relations) for Admin Ontology tab
 */
async function loadOntologyData(): Promise<void> {
  ontologyLoading = true;
  try {
    const [entitiesRes, relationsRes] = await Promise.all([
      http.get<{ ok: boolean; entityTypes?: OntologyEntityType[] }>('/api/ontology/entities'),
      http.get<{ ok: boolean; relationTypes?: OntologyRelationType[] }>('/api/ontology/relations'),
    ]);
    ontologyEntities = entitiesRes.data?.entityTypes ?? [];
    ontologyRelations = relationsRes.data?.relationTypes ?? [];
    ontologyLoaded = true;
  } catch (error) {
    console.warn('Failed to load ontology:', error);
    ontologyEntities = [];
    ontologyRelations = [];
  } finally {
    ontologyLoading = false;
  }
}

/**
 * Load graph overview (list + status) for Graph section
 */
async function loadGraphOverview(): Promise<void> {
  graphOverviewLoading = true;
  try {
    const [listRes, statusRes] = await Promise.all([
      http.get<{ ok: boolean; graphs?: GraphListItem[]; error?: string }>('/api/graph/list'),
      http.get<{ enabled?: boolean; graphName?: string; stats?: { nodes?: number; relationships?: number } }>('/api/graph/status').catch(() => ({ data: {} })),
    ]);
    graphList = listRes.data?.graphs ?? [];
    if (listRes.data?.error) {
      graphList = [];
    }
    graphStatus = statusRes.data ?? null;
    graphOverviewLoaded = true;
  } catch (error) {
    console.warn('Failed to load graph overview:', error);
    graphList = [];
    graphStatus = null;
  } finally {
    graphOverviewLoading = false;
  }
}

/**
 * Save a config value
 */
async function saveConfig(key: string, value: unknown, category: string): Promise<void> {
  try {
    await http.post('/api/system/config', { key, value, category });
    toast.success('Configuration saved');
    await loadSystemConfig();
  } catch (error) {
    toast.error('Failed to save configuration');
  }
}

/**
 * Test provider connection
 */
async function testProvider(providerId: string): Promise<void> {
  try {
    const response = await http.post<{ ok: boolean; error?: { message: string }; models?: number }>(`/api/llm/test/${providerId}`);
    if (response.data.ok) {
      const models = response.data.models ? ` (${response.data.models} models)` : '';
      toast.success(`${providerId} connection successful${models}`);
    } else {
      toast.error(response.data.error?.message || 'Connection failed');
    }
  } catch (error) {
    toast.error('Connection test failed');
  }
}

/**
 * Get config value by key
 */
function getConfigValue(category: string, key: string, defaultValue: unknown = ''): unknown {
  const configs = systemConfig[category] || [];
  
  // For graph category, the config is stored as { key: 'graph', value: { enabled, graphName, provider } }
  if (category === 'graph') {
    const graphConfigEntry = configs.find(c => c.key === 'graph');
    if (graphConfigEntry?.value && typeof graphConfigEntry.value === 'object') {
      const graphValue = graphConfigEntry.value as Record<string, unknown>;
      return graphValue[key] ?? defaultValue;
    }
  }
  
  const config = configs.find(c => c.key === key);
  return config?.value ?? defaultValue;
}

/**
 * Render section navigation
 */
function renderNav(): string {
  const sections = [
    { id: 'llm', label: 'LLM Providers', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { id: 'models', label: 'Model Metadata', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'queue', label: 'LLM Queue', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { id: 'graph', label: 'Graph', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
    { id: 'ontology', label: 'Ontology', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { id: 'prompts', label: 'Prompts', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'processing', label: 'Processing', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'team-analysis', label: 'Team Analysis', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'billing', label: 'Billing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'audit', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  ];

  return sections.map(s => `
    <button class="admin-nav-btn ${currentSection === s.id ? 'active' : ''}" data-section="${s.id}">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${s.icon}"/>
      </svg>
      <span>${s.label}</span>
    </button>
  `).join('');
}

/**
 * Render LLM Providers section
 */
function renderLLMSection(): string {
  const taskTypes = ['text', 'vision', 'embeddings'];
  
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>LLM Provider Configuration</h3>
        <p>Configure AI providers for different task types</p>
      </div>

      <!-- Provider Status -->
      <div class="admin-card">
        <h4>Provider Health</h4>
        <div class="provider-grid">
          ${providers.map(p => `
            <div class="provider-card ${p.enabled ? 'enabled' : 'disabled'}">
              <div class="provider-header">
                <span class="provider-name">${p.name}</span>
                <span class="provider-status ${p.status || 'unknown'}">${p.status || 'unknown'}</span>
              </div>
              <div class="provider-models">${p.models.slice(0, 3).join(', ')}</div>
              <div class="provider-actions">
                <button class="btn-sm" data-test-provider="${p.id}">Test</button>
                <label class="toggle-switch">
                  <input type="checkbox" ${p.enabled ? 'checked' : ''} data-toggle-provider="${p.id}">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Task Configuration -->
      <div class="admin-card">
        <h4>Task-Specific AI Configuration</h4>
        <p class="text-muted">Configure which provider and model to use for each AI task. These settings apply globally to the platform and are persisted in Supabase.</p>
        
        ${taskTypes.map(task => {
          const taskConfig = getConfigValue('llm', task + '_provider', { provider: '', model: '' }) as { provider: string; model: string };
          const icons: Record<string, string> = { text: '💬', vision: '👁️', embeddings: '🔗' };
          const labels: Record<string, string> = { text: 'Text / Chat', vision: 'Vision / Images', embeddings: 'Embeddings' };
          const descs: Record<string, string> = { 
            text: 'Document analysis, chat, briefings, Q&A, extraction',
            vision: 'Image analysis, scanned documents, diagrams, charts',
            embeddings: 'Semantic search, similarity matching, RAG'
          };
          const icon = icons[task] || '⚙️';
          const label = labels[task] || task;
          const desc = descs[task] || '';
          const providerOpts = ['openai', 'anthropic', 'google', 'deepseek', 'grok', 'kimi', 'minimax', 'ollama'];
          const providerNames: Record<string, string> = {
            openai: 'OpenAI', anthropic: 'Anthropic (Claude)', google: 'Google AI (Gemini)',
            deepseek: 'DeepSeek', grok: 'xAI (Grok)', kimi: 'Kimi (Moonshot)', 
            minimax: 'MiniMax', ollama: 'Ollama (Local)'
          };
          
          return '<div class="task-config-row" style="margin-bottom: 20px; padding: 16px; background: var(--bg-secondary); border-radius: 12px;" data-task-row="' + task + '">' +
            '<div class="task-label" style="margin-bottom: 12px;">' +
              '<span style="font-size: 20px; margin-right: 8px;">' + icon + '</span>' +
              '<strong style="font-size: 16px;">' + label + '</strong>' +
              '<span class="text-muted" style="display: block; margin-top: 4px; margin-left: 32px; font-size: 13px;">' + desc + '</span>' +
            '</div>' +
            '<div class="task-selects" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-left: 32px;">' +
              '<div>' +
                '<label style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px; display: block;">Provider</label>' +
                '<select class="form-select provider-select" data-task="' + task + '" data-field="provider" style="width: 100%;">' +
                  '<option value=""' + (!taskConfig.provider ? ' selected' : '') + '>-- Select Provider --</option>' +
                  providerOpts.map(p => '<option value="' + p + '"' + (taskConfig.provider === p ? ' selected' : '') + '>' + providerNames[p] + '</option>').join('') +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px; display: block;">Model</label>' +
                '<select class="form-select model-select" data-task="' + task + '" data-field="model" style="width: 100%;">' +
                  '<option value="">-- Select Provider First --</option>' +
                  (taskConfig.model ? '<option value="' + taskConfig.model + '" selected>' + taskConfig.model + '</option>' : '') +
                '</select>' +
                '<span class="model-loading" data-task="' + task + '" style="display: none; font-size: 11px; color: var(--primary); margin-top: 4px;">Loading models...</span>' +
              '</div>' +
            '</div>' +
            '<div class="model-status" data-task="' + task + '" style="margin-top: 8px; margin-left: 32px; font-size: 11px; color: var(--text-tertiary);"></div>' +
          '</div>';
        }).join('')}
        
        <div style="display: flex; gap: 12px; align-items: center; margin-top: 20px;">
          <button class="btn-primary" id="save-llm-config">Save LLM Configuration</button>
          <span class="text-muted" style="font-size: 12px;">⚠️ Changes apply immediately to all AI processing</span>
        </div>
      </div>

      <!-- API Keys - LLM Providers -->
      <div class="admin-card">
        <h4>LLM API Keys</h4>
        <p class="text-muted">System-level API keys (stored encrypted in Supabase)</p>
        
        <div class="api-keys-grid" id="api-keys-container">
          <div class="form-group" data-secret-name="OPENAI_API_KEY">
            <label>OpenAI <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="openai-key" name="llm_key_openai_${Date.now()}" placeholder="sk-proj-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="openai-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="CLAUDE_API_KEY">
            <label>Anthropic (Claude) <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="anthropic-key" name="llm_key_claude_${Date.now()}" placeholder="sk-ant-api03-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="anthropic-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="GOOGLE_API_KEY">
            <label>Google AI (Gemini) <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="google-key" name="llm_key_google_${Date.now()}" placeholder="AIza..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="google-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="XAI_API_KEY">
            <label>xAI (Grok) <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="xai-key" name="llm_key_xai_${Date.now()}" placeholder="xai-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="xai-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="DEEPSEEK_API_KEY">
            <label>DeepSeek <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="deepseek-key" name="llm_key_deepseek_${Date.now()}" placeholder="sk-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="deepseek-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="KIMI_API_KEY">
            <label>Kimi (Moonshot) <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="kimi-key" name="llm_key_kimi_${Date.now()}" placeholder="sk-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="kimi-key">Show</button>
            </div>
          </div>
          
          <div class="form-group" data-secret-name="MINIMAX_API_KEY">
            <label>MiniMax <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
            <div class="input-group">
              <input type="text" id="minimax-key" name="llm_key_minimax_${Date.now()}" placeholder="MINIMAX-..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
              <button class="btn-icon" data-toggle-visibility="minimax-key">Show</button>
            </div>
          </div>
        </div>
        
        <div id="api-keys-loading" style="text-align: center; padding: 10px; color: var(--text-tertiary);">Loading configured keys...</div>
        <button class="btn-primary mt-4" id="save-api-keys">Save LLM API Keys</button>
      </div>

      <!-- Service API Keys -->
      <div class="admin-card">
        <h4>Service API Keys</h4>
        <p class="text-muted">Keys for email, notifications and other services</p>
        
        <div class="form-group" data-secret-name="RESEND_API_KEY">
          <label>Resend API Key (Email Service) <span class="key-status" style="font-size: 11px; margin-left: 8px;"></span></label>
          <div class="input-group">
            <input type="text" id="resend-key" name="service_key_resend_${Date.now()}" placeholder="re_..." class="form-input api-key-input" autocomplete="off" readonly onfocus="this.removeAttribute('readonly')">
            <button class="btn-icon" data-toggle-visibility="resend-key">Show</button>
          </div>
        </div>
        
        <button class="btn-primary mt-4" id="save-service-keys">Save Service Keys</button>
      </div>
    </div>
  `;
}

/**
 * Render Graph section (Supabase Graph)
 */
function renderGraphSection(): string {
  const graphConfig = {
    enabled: getConfigValue('graph', 'enabled', false) as boolean,
    graphName: getConfigValue('graph', 'graphName', 'godmode') as string,
  };

  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Graph Database Configuration</h3>
        <p>Supabase Graph for knowledge graph and GraphRAG</p>
      </div>

      <div class="admin-card">
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="graph-enabled" ${graphConfig.enabled ? 'checked' : ''}>
            <span>Enable Graph Database</span>
          </label>
        </div>

        <div class="form-group" style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: var(--text-secondary);">
            <strong>Provider:</strong> Supabase Graph (PostgreSQL-based)
          </p>
          <p style="margin: 8px 0 0; font-size: 13px; color: var(--text-muted);">
            Uses your existing Supabase connection. No additional configuration needed.
          </p>
        </div>

        <div class="form-group">
          <label>Graph Name</label>
          <input type="text" id="graph-name" value="${graphConfig.graphName}" class="form-input" placeholder="godmode">
        </div>

        <div class="btn-group mt-4">
          <button class="btn-primary" id="save-graph-config">Save Configuration</button>
          <button class="btn-secondary" id="test-graph-connection">Test Connection</button>
        </div>
      </div>

      <div class="admin-card" id="graph-overview-card">
        <h4>Graph overview</h4>
        <p class="text-muted">Current graph status. Enable and save configuration above first.</p>
        <div id="graph-overview-content">
          ${graphOverviewLoading ? '<p class="text-muted">Loading...</p>' : !graphOverviewLoaded ? '<button class="btn-secondary" id="load-graph-overview">Load overview</button>' : (graphList.length === 0 && !graphStatus?.enabled ? '<p class="text-muted">Graph not enabled or not connected. Enable and save configuration.</p><button class="btn-secondary mt-4" id="refresh-graph-overview">Refresh</button>' : `
            ${graphStatus?.enabled && (graphStatus.stats != null || graphStatus.graphName) ? `
              <div class="graph-status-row" style="margin-bottom: 12px;">
                <strong>Current graph:</strong> ${graphStatus.graphName ?? '—'}
                ${graphStatus.stats?.nodes !== undefined ? ` · Nodes: ${graphStatus.stats.nodes}` : ''}
                ${graphStatus.stats?.relationships !== undefined ? ` · Edges: ${graphStatus.stats.relationships}` : ''}
              </div>
            ` : ''}
            ${graphList.length > 0 ? `
              <table class="admin-table" style="width: 100%; margin-top: 8px;">
                <thead><tr><th>Graph name</th><th>Project</th></tr></thead>
                <tbody>
                  ${graphList.map(g => `<tr><td><code>${g.graphName}</code></td><td>${g.projectName ?? '—'}</td></tr>`).join('')}
                </tbody>
              </table>
            ` : ''}
            <div class="btn-group mt-4">
              <button class="btn-secondary" id="open-graph-tab">Open in Graph tab</button>
              <button class="btn-secondary" id="refresh-graph-overview">Refresh</button>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Ontology section
 */
function renderOntologySection(): string {
  if (ontologyLoading || !ontologyLoaded) {
    return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Ontology</h3>
        <p>Entity types and relation types used by extraction and GraphRAG</p>
      </div>
      <div class="admin-card">
        <p class="text-muted">${ontologyLoading ? 'Loading ontology...' : 'Click Load to fetch entity and relation types from the API.'}</p>
        ${!ontologyLoading ? '<button class="btn-primary" id="load-ontology">Load ontology</button>' : ''}
      </div>
    </div>
    `;
  }
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Ontology</h3>
        <p>Entity types and relation types used by extraction and GraphRAG</p>
      </div>

      <div class="admin-card">
        <h4>Entity types</h4>
        <p class="text-muted">Types of entities that can be extracted and stored in the graph.</p>
        ${ontologyEntities.length === 0 ? '<p class="text-muted">No entity types returned.</p>' : `
          <ul class="ontology-list">
            ${ontologyEntities.map(e => `
              <li><code>${e.name}</code>
                ${e.sharedEntity ? ' <span class="badge badge-info">shared</span>' : ''}
                ${e.properties?.length ? ` · properties: ${e.properties.join(', ')}` : ''}
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="admin-card">
        <h4>Relation types</h4>
        <p class="text-muted">Allowed relationships between entity types.</p>
        ${ontologyRelations.length === 0 ? '<p class="text-muted">No relation types returned.</p>' : `
          <ul class="ontology-list">
            ${ontologyRelations.map(r => `
              <li><code>${r.name}</code>
                ${(r as { sourceType?: string; targetType?: string }).sourceType ? ` (${(r as { sourceType?: string; targetType?: string }).sourceType} → ${(r as { sourceType?: string; targetType?: string }).targetType})` : ''}
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      <div class="btn-group mt-4">
        <button class="btn-secondary" id="reload-ontology">Reload ontology</button>
      </div>
    </div>
  `;
}

/**
 * Render Prompts section
 */
function renderPromptsSection(): string {
  // Group prompts by category
  const extractionPrompts = systemPrompts.filter(p => p.category === 'extraction');
  const analysisPrompts = systemPrompts.filter(p => p.category === 'analysis');
  const templatePrompts = systemPrompts.filter(p => p.category === 'template');

  const renderPromptCard = (p: SystemPrompt) => `
    <div class="admin-card prompt-card" data-prompt-id="${p.id}">
      <div class="prompt-header">
        <div>
          <h4>${p.name}</h4>
          <p class="text-muted">${p.description}</p>
        </div>
        <div class="prompt-badges">
          ${p.uses_ontology ? '<span class="badge badge-info">Ontology-Aware</span>' : ''}
          <span class="badge badge-secondary">${p.key}</span>
        </div>
      </div>
      <textarea class="form-textarea prompt-editor" data-prompt-key="${p.key}" rows="12" 
                placeholder="Enter prompt template...

Available placeholders:
{{CONTENT}} - The document/transcript content
{{FILENAME}} - The file/document name
{{TODAY}} - Current date
{{ONTOLOGY_SECTION}} - Ontology context (if uses_ontology=true)
{{ROLE_CONTEXT}} - User role context
{{PROJECT_CONTEXT}} - Project context">${p.prompt_template || ''}</textarea>
      <div class="prompt-actions">
        <button class="btn-sm btn-secondary" data-view-versions="${p.key}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          Version History
        </button>
        <span class="prompt-status" id="status-${p.key}"></span>
      </div>
      <div class="version-history hidden" id="versions-${p.key}">
        <div class="version-list"></div>
      </div>
    </div>
  `;

  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>AI Prompts Configuration</h3>
        <p>Customize ontology-aware prompts for AI extraction. All prompts support template variables.</p>
      </div>

      <div class="prompt-info admin-card">
        <h4>Template Variables</h4>
        <div class="variables-grid">
          <code>{{CONTENT}}</code> <span>Document/transcript content</span>
          <code>{{FILENAME}}</code> <span>File or document name</span>
          <code>{{TODAY}}</code> <span>Current date (YYYY-MM-DD)</span>
          <code>{{ONTOLOGY_SECTION}}</code> <span>Injected ontology context</span>
          <code>{{ROLE_CONTEXT}}</code> <span>User role context line</span>
          <code>{{PROJECT_CONTEXT}}</code> <span>Project context line</span>
          <code>{{CONTENT_LENGTH}}</code> <span>Content length in characters</span>
        </div>
      </div>

      <h4 class="section-subtitle">Extraction Prompts</h4>
      ${extractionPrompts.length > 0 ? extractionPrompts.map(renderPromptCard).join('') : '<p class="text-muted">Run migration 031 to create default prompts</p>'}

      ${analysisPrompts.length > 0 ? `
        <h4 class="section-subtitle">Analysis Prompts</h4>
        ${analysisPrompts.map(renderPromptCard).join('')}
      ` : ''}

      ${templatePrompts.length > 0 ? `
        <h4 class="section-subtitle">Template Sections</h4>
        ${templatePrompts.map(renderPromptCard).join('')}
      ` : ''}

      <div class="btn-group mt-4">
        <button class="btn-primary" id="save-prompts">Save All Prompts</button>
        <button class="btn-secondary" id="reload-prompts">Reload from Database</button>
      </div>
    </div>
  `;
}

/**
 * Render Processing section
 */
function renderProcessingSection(): string {
  const processing = {
    chunkSize: getConfigValue('processing', 'chunk_size', 1000) as number,
    chunkOverlap: getConfigValue('processing', 'chunk_overlap', 200) as number,
    maxTokens: getConfigValue('processing', 'max_tokens', 4096) as number,
    temperature: getConfigValue('processing', 'temperature', 0.7) as number,
    autoProcess: getConfigValue('processing', 'auto_process', true) as boolean,
    parallelJobs: getConfigValue('processing', 'parallel_jobs', 3) as number,
  };

  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Document Processing Settings</h3>
        <p>Configure how documents are processed and analyzed</p>
      </div>

      <div class="admin-card">
        <h4>Chunking Settings</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label>Chunk Size (tokens)</label>
            <input type="number" id="proc-chunk-size" value="${processing.chunkSize}" class="form-input" min="100" max="8000">
          </div>
          <div class="form-group">
            <label>Chunk Overlap (tokens)</label>
            <input type="number" id="proc-chunk-overlap" value="${processing.chunkOverlap}" class="form-input" min="0" max="1000">
          </div>
        </div>
      </div>

      <div class="admin-card">
        <h4>Generation Settings</h4>
        
        <div class="form-row">
          <div class="form-group">
            <label>Max Tokens</label>
            <input type="number" id="proc-max-tokens" value="${processing.maxTokens}" class="form-input" min="256" max="32000">
          </div>
          <div class="form-group">
            <label>Temperature</label>
            <input type="number" id="proc-temperature" value="${processing.temperature}" class="form-input" min="0" max="2" step="0.1">
          </div>
        </div>
      </div>

      <div class="admin-card">
        <h4>Job Settings</h4>
        
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="proc-auto-process" ${processing.autoProcess ? 'checked' : ''}>
            <span>Auto-process uploaded documents</span>
          </label>
        </div>
        
        <div class="form-group">
          <label>Parallel Jobs</label>
          <input type="number" id="proc-parallel-jobs" value="${processing.parallelJobs}" class="form-input" min="1" max="10">
        </div>
      </div>

      <button class="btn-primary" id="save-processing">Save Processing Settings</button>
    </div>
  `;
}

/**
 * Load Team Analysis settings for current project
 */
async function loadTeamAnalysisSettings(): Promise<void> {
  const state = appStore.getState();
  const projectId = state.currentProject?.id;
  
  if (!projectId) {
    teamAnalysisSettings = { enabled: true, access: 'admin_only' };
    teamAnalysisLoaded = true;
    return;
  }
  
  teamAnalysisLoading = true;
  
  try {
    const response = await http.get<{ ok: boolean; config: { enabled: boolean; access: string } }>('/api/team-analysis/config');
    teamAnalysisSettings = {
      enabled: response?.config?.enabled ?? true,
      access: (response?.config?.access as 'admin_only' | 'all') ?? 'admin_only'
    };
    teamAnalysisLoaded = true;
  } catch (error) {
    console.error('[AdminPanel] Error loading team analysis settings:', error);
    teamAnalysisSettings = { enabled: true, access: 'admin_only' };
    teamAnalysisLoaded = true;
  } finally {
    teamAnalysisLoading = false;
  }
}

/**
 * Save Team Analysis settings
 */
async function saveTeamAnalysisSettings(enabled: boolean, access: string): Promise<void> {
  const state = appStore.getState();
  const projectId = state.currentProject?.id;
  
  if (!projectId) {
    toast.error('No project selected');
    return;
  }
  
  try {
    await http.put('/api/team-analysis/config', {
      enabled,
      access
    });
    
    teamAnalysisSettings = { enabled, access: access as 'admin_only' | 'all' };
    toast.success('Team Analysis settings saved');
  } catch (error) {
    console.error('[AdminPanel] Error saving team analysis settings:', error);
    toast.error('Failed to save settings');
  }
}

/**
 * Render Team Analysis section
 */
function renderTeamAnalysisSection(): string {
  const state = appStore.getState();
  const projectId = state.currentProject?.id;
  const projectName = state.currentProject?.name || 'Unknown';
  
  if (!projectId) {
    return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Team Analysis Settings</h3>
        <p>Configure access control for behavioral analysis features</p>
      </div>
      
      <div class="admin-card">
        <div style="text-align: center; padding: 40px; color: var(--text-tertiary);">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48" style="margin: 0 auto 16px; opacity: 0.5;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p>Please select a project to configure Team Analysis settings.</p>
        </div>
      </div>
    </div>
    `;
  }
  
  if (teamAnalysisLoading || !teamAnalysisLoaded) {
    // Trigger load and show loading state
    if (!teamAnalysisLoading && !teamAnalysisLoaded) {
      loadTeamAnalysisSettings();
    }
    
    return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Team Analysis Settings</h3>
        <p>Configure access control for behavioral analysis features</p>
      </div>
      
      <div class="admin-card">
        <div style="text-align: center; padding: 40px; color: var(--text-tertiary);">
          <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    </div>
    `;
  }
  
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Team Analysis Settings</h3>
        <p>Configure access control for behavioral analysis features</p>
      </div>

      <!-- Current Project Info -->
      <div class="admin-card">
        <h4>Current Project</h4>
        <div style="display: flex; align-items: center; gap: 12px; margin-top: 12px;">
          <div style="width: 40px; height: 40px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            ${projectName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight: 500;">${projectName}</div>
            <div style="font-size: 12px; color: var(--text-tertiary);">ID: ${projectId}</div>
          </div>
        </div>
      </div>

      <!-- Feature Toggle -->
      <div class="admin-card">
        <h4>Feature Status</h4>
        <p class="text-muted" style="margin-bottom: 16px;">Enable or disable Team Analysis for this project</p>
        
        <div class="form-group">
          <label class="toggle-label" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
            <input type="checkbox" id="team-analysis-enabled" ${teamAnalysisSettings.enabled ? 'checked' : ''} style="width: 20px; height: 20px;">
            <div>
              <span style="font-weight: 500;">Enable Team Analysis</span>
              <p style="font-size: 12px; color: var(--text-tertiary); margin: 4px 0 0 0;">When enabled, users with access can analyze team member behavior from meeting transcripts</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Access Control -->
      <div class="admin-card">
        <h4>Access Control</h4>
        <p class="text-muted" style="margin-bottom: 16px;">Define who can access Team Analysis features</p>
        
        <div class="form-group">
          <label style="font-weight: 500; display: block; margin-bottom: 8px;">Access Level</label>
          <select id="team-analysis-access" class="form-input" style="width: 100%; max-width: 400px;">
            <option value="admin_only" ${teamAnalysisSettings.access === 'admin_only' ? 'selected' : ''}>Admins Only - Only project owner and admins can access</option>
            <option value="all" ${teamAnalysisSettings.access === 'all' ? 'selected' : ''}>All Members - All project members can access</option>
          </select>
          <p style="font-size: 12px; color: var(--text-tertiary); margin-top: 8px;">
            <strong>Admins Only:</strong> Restricts access to sensitive behavioral analysis to project owner and administrators.<br>
            <strong>All Members:</strong> Allows all project collaborators to view and run team analysis.
          </p>
        </div>
      </div>

      <!-- Analysis Scope Info -->
      <div class="admin-card">
        <h4>How It Works</h4>
        <div style="display: grid; gap: 16px; margin-top: 12px;">
          <div style="display: flex; gap: 12px; align-items: start;">
            <div style="min-width: 32px; height: 32px; background: var(--info); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">1</div>
            <div>
              <div style="font-weight: 500;">Contact-Based Analysis</div>
              <div style="font-size: 13px; color: var(--text-secondary);">Analysis is performed on contacts defined in the project. Contacts can have aliases to match different name variations in transcripts.</div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: start;">
            <div style="min-width: 32px; height: 32px; background: var(--info); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">2</div>
            <div>
              <div style="font-weight: 500;">Incremental Learning</div>
              <div style="font-size: 13px; color: var(--text-secondary);">Profiles are refined iteratively as more transcripts are processed, building evidence over time.</div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: start;">
            <div style="min-width: 32px; height: 32px; background: var(--info); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">3</div>
            <div>
              <div style="font-weight: 500;">Privacy Consideration</div>
              <div style="font-size: 13px; color: var(--text-secondary);">Behavioral analysis may contain sensitive insights. Configure access carefully.</div>
            </div>
          </div>
        </div>
      </div>

      <button class="btn-primary" id="save-team-analysis" style="margin-top: 8px;">Save Team Analysis Settings</button>
    </div>
  `;
}

/**
 * Render LLM Queue section
 */
function renderQueueSection(): string {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>LLM Processing Queue</h3>
        <p>Monitor and control AI request processing - All requests are persisted in database</p>
      </div>

      <!-- Queue Status -->
      <div class="admin-card" id="queue-status-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4>Queue Status</h4>
          <div style="display: flex; gap: 8px;">
            <span id="db-status-badge" class="badge" style="font-size: 11px;">DB: Checking...</span>
            <button class="btn-sm" id="refresh-queue-status">↻ Refresh</button>
          </div>
        </div>
        
        <div id="queue-status-content" style="text-align: center; padding: 20px; color: var(--text-tertiary);">
          Loading queue status...
        </div>
      </div>

      <!-- Queue Controls -->
      <div class="admin-card">
        <h4>Queue Controls</h4>
        <p class="text-muted">Control queue processing behavior</p>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;">
          <button class="btn-primary" id="queue-pause-btn">⏸ Pause Queue</button>
          <button class="btn-primary" id="queue-resume-btn">▶ Resume Queue</button>
          <button class="btn-secondary" id="queue-clear-btn" style="background: var(--warning); color: white;">🗑 Clear Queue</button>
        </div>
      </div>

      <!-- Statistics -->
      <div class="admin-card">
        <h4>Queue Statistics (Today)</h4>
        <div id="queue-stats-content" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-top: 16px;">
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: var(--primary);" id="stat-pending">-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Pending</div>
          </div>
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: var(--info);" id="stat-processing">-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Processing</div>
          </div>
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: var(--success);" id="stat-success">-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Completed</div>
          </div>
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: var(--error);" id="stat-failed">-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Failed</div>
          </div>
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: var(--warning);" id="stat-retry">-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Retry Pending</div>
          </div>
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold;" id="stat-avg-time">-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Avg Time (ms)</div>
          </div>
          <div class="stat-box" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: var(--success);" id="stat-cost">$-</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Cost Today</div>
          </div>
        </div>
      </div>

      <!-- Queue Items -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4>Pending Items</h4>
          <span id="pending-count" class="text-muted">0 items</span>
        </div>
        
        <div id="queue-items-content" style="max-height: 300px; overflow-y: auto;">
          <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
            No items in queue
          </div>
        </div>
      </div>

      <!-- Failed Items (Retryable) -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4>Failed Items</h4>
          <div style="display: flex; gap: 8px;">
            <button class="btn-sm btn-primary" id="retry-all-btn">↻ Retry All</button>
            <button class="btn-sm" id="refresh-failed-btn">↻ Refresh</button>
          </div>
        </div>
        
        <div id="failed-items-content" style="max-height: 300px; overflow-y: auto;">
          <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
            No failed items
          </div>
        </div>
      </div>

      <!-- Recent History -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4>Recent Processing History</h4>
          <button class="btn-sm" id="refresh-queue-history">↻ Refresh</button>
        </div>
        
        <div id="queue-history-content" style="max-height: 400px; overflow-y: auto;">
          <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
            Loading history...
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load billing data
 */
async function loadBillingData(): Promise<void> {
  if (billingLoading) return;
  billingLoading = true;
  
  try {
    // Load all data in parallel
    const [projects, config, tiersData] = await Promise.all([
      billingService.getAllProjectsBilling(),
      billingService.getGlobalPricingConfig(),
      billingService.getGlobalPricingTiers()
    ]);
    
    billingProjects = projects;
    globalPricingConfig = config;
    globalPricingTiers = tiersData.tiers;
    billingLoaded = true;
    
    console.log('[AdminPanel] Loaded billing data:', { 
      projects: projects.length, 
      config: !!config,
      tiers: tiersData.tiers.length 
    });
  } catch (error) {
    console.error('[AdminPanel] Error loading billing data:', error);
    toast.error('Failed to load billing data');
  } finally {
    billingLoading = false;
  }
}

/**
 * Render Billing section
 */
function renderBillingSection(): string {
  // Show loading state
  if (billingLoading && !billingLoaded) {
    return `
      <div class="admin-section">
        <div class="admin-section-header">
          <h3>Billing & Cost Control</h3>
          <p>Manage project balances, pricing, and cost limits</p>
        </div>
        <div class="admin-card" style="text-align: center; padding: 40px;">
          <div class="spinner"></div>
          <p style="margin-top: 16px;">Loading billing data...</p>
        </div>
      </div>
    `;
  }
  
  // Format tier display
  const tiersDisplay = globalPricingTiers.length > 0 
    ? globalPricingTiers.map((tier, i) => {
        const prevLimit = i > 0 ? globalPricingTiers[i - 1].token_limit : 0;
        const fromStr = formatTokens(prevLimit || 0);
        const toStr = tier.token_limit ? formatTokens(tier.token_limit) : '∞';
        return `${tier.name || `Tier ${i + 1}`}: ${fromStr}-${toStr} tokens → +${tier.markup_percent}%`;
      }).join('<br>')
    : 'No tiers configured (using fixed markup)';
  
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Billing & Cost Control</h3>
        <p>Manage project balances, pricing, and cost limits</p>
      </div>

      <!-- Global Pricing Configuration -->
      <div class="admin-card">
        <h4 style="margin-bottom: 16px;">Global Pricing Configuration</h4>
        
        <div class="admin-form-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label>Fixed Markup (%)</label>
            <input type="number" id="global-markup-percent" class="form-input" 
                   value="${globalPricingConfig?.fixed_markup_percent ?? 0}" min="0" max="500" step="0.1">
            <small class="text-muted">Applied when no tier matches</small>
          </div>
          
          <div class="form-group">
            <label>Period Type</label>
            <select id="global-period-type" class="form-input">
              <option value="monthly" ${globalPricingConfig?.period_type === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="weekly" ${globalPricingConfig?.period_type === 'weekly' ? 'selected' : ''}>Weekly</option>
            </select>
            <small class="text-muted">Tier reset period</small>
          </div>
          
          <div class="form-group">
            <label>USD to EUR Rate</label>
            <input type="number" id="global-usd-eur-rate" class="form-input" 
                   value="${globalPricingConfig?.usd_to_eur_rate ?? 0.92}" min="0.01" step="0.001">
            <small class="text-muted">For cost conversion</small>
          </div>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn-primary" id="save-global-pricing-btn">Save Global Pricing</button>
        </div>
      </div>
      
      <!-- Pricing Tiers -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h4>Pricing Tiers (Volume Discount)</h4>
            <p class="text-muted" style="font-size: 13px; margin-top: 4px;">
              Lower markup as projects consume more tokens per period
            </p>
          </div>
          <button class="btn-sm btn-primary" id="add-tier-btn">+ Add Tier</button>
        </div>
        
        <div id="pricing-tiers-list">
          ${globalPricingTiers.length > 0 ? globalPricingTiers.map((tier, i) => `
            <div class="tier-row" data-tier-index="${i}" style="display: grid; grid-template-columns: 150px 150px 120px auto; gap: 12px; align-items: center; padding: 12px; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 8px;">
              <input type="text" class="form-input tier-name" placeholder="Tier Name" value="${tier.name || `Tier ${i + 1}`}">
              <input type="number" class="form-input tier-limit" placeholder="Token Limit" value="${tier.token_limit || ''}" min="0" ${tier.token_limit === null ? 'disabled' : ''}>
              <div style="display: flex; align-items: center; gap: 4px;">
                <input type="number" class="form-input tier-markup" placeholder="Markup %" value="${tier.markup_percent}" min="0" step="0.1" style="width: 80px;">
                <span>%</span>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px;">
                  <input type="checkbox" class="tier-unlimited" ${tier.token_limit === null ? 'checked' : ''}>
                  Unlimited
                </label>
                <button class="btn-sm btn-danger remove-tier-btn" data-index="${i}">✕</button>
              </div>
            </div>
          `).join('') : `
            <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
              No tiers configured. Using fixed markup of ${globalPricingConfig?.fixed_markup_percent ?? 0}% for all usage.
            </div>
          `}
        </div>
        
        ${globalPricingTiers.length > 0 ? `
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
            <button class="btn-primary" id="save-tiers-btn">Save Tiers</button>
          </div>
        ` : ''}
      </div>

      <!-- Projects Billing Overview -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h4>Projects Billing</h4>
            <p class="text-muted" style="font-size: 13px; margin-top: 4px;">
              ${billingProjects.length} projects | 
              ${billingProjects.filter(p => p.is_blocked).length} blocked | 
              ${billingProjects.filter(p => p.unlimited_balance).length} unlimited
            </p>
          </div>
          <button class="btn-sm" id="refresh-billing-btn">↻ Refresh</button>
        </div>
        
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: var(--bg-tertiary);">
                <th style="text-align: left; padding: 8px;">Project</th>
                <th style="text-align: right; padding: 8px;">Balance</th>
                <th style="text-align: center; padding: 8px;">Status</th>
                <th style="text-align: right; padding: 8px;">Tokens (Period)</th>
                <th style="text-align: right; padding: 8px;">Cost (Period)</th>
                <th style="text-align: center; padding: 8px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${billingProjects.length > 0 ? billingProjects.map(p => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 12px 8px;">
                    <div style="font-weight: 500;">${escapeHtml(p.project_name)}</div>
                    ${p.current_tier_name ? `<small class="text-muted">Tier: ${p.current_tier_name}</small>` : ''}
                  </td>
                  <td style="text-align: right; padding: 8px;">
                    ${p.unlimited_balance 
                      ? '<span style="color: var(--success-color);">∞ Unlimited</span>' 
                      : formatEur(p.balance_eur)}
                  </td>
                  <td style="text-align: center; padding: 8px;">
                    ${p.is_blocked 
                      ? '<span class="badge badge-danger">Blocked</span>' 
                      : p.unlimited_balance
                        ? '<span class="badge badge-success">Unlimited</span>'
                        : '<span class="badge badge-primary">Active</span>'}
                  </td>
                  <td style="text-align: right; padding: 8px;">${formatTokens(p.tokens_this_period)}</td>
                  <td style="text-align: right; padding: 8px;">${formatEur(p.billable_cost_this_period)}</td>
                  <td style="text-align: center; padding: 8px;">
                    <div style="display: flex; justify-content: center; gap: 4px;">
                      <button class="btn-sm add-balance-btn" data-project-id="${p.project_id}" data-project-name="${escapeHtml(p.project_name)}" title="Add Balance">💰</button>
                      <button class="btn-sm toggle-unlimited-btn" data-project-id="${p.project_id}" data-unlimited="${p.unlimited_balance}" title="${p.unlimited_balance ? 'Disable Unlimited' : 'Enable Unlimited'}">
                        ${p.unlimited_balance ? '🔓' : '🔒'}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 20px; color: var(--text-tertiary);">
                    No projects found
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render Audit Log section
 */
function renderAuditSection(): string {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>Configuration Audit Log</h3>
        <p>Track all configuration changes</p>
      </div>

      <div class="admin-card">
        <div class="audit-filters">
          <select id="audit-filter-table" class="form-select">
            <option value="">All Tables</option>
            <option value="system_config">System Config</option>
            <option value="project_config">Project Config</option>
            <option value="secrets">Secrets</option>
          </select>
          <button class="btn-secondary" id="refresh-audit">Refresh</button>
        </div>

        <div class="audit-log-list">
          ${auditLogs.length === 0 ? `
            <div class="empty-state">
              <p>No audit logs found</p>
            </div>
          ` : auditLogs.map(log => `
            <div class="audit-log-item">
              <div class="audit-log-header">
                <span class="audit-operation ${log.operation.toLowerCase()}">${log.operation}</span>
                <span class="audit-table">${log.table_name}</span>
                <span class="audit-time">${new Date(log.changed_at).toLocaleString()}</span>
              </div>
              <div class="audit-log-details">
                <span class="audit-user">${log.changed_by_email || 'System'}</span>
                ${log.new_values ? `<pre class="audit-values">${JSON.stringify(log.new_values, null, 2)}</pre>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Model Metadata section
 */
function renderModelsSection(): string {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>LLM Model Metadata</h3>
        <p>Manage model information, pricing, and capabilities from database</p>
      </div>
      
      <!-- Sync Controls -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4>Sync Model Metadata</h4>
          <button class="btn btn-primary" id="sync-all-metadata-btn">
            ↻ Sync All Providers
          </button>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
          Fetch the latest model list from each configured provider API and update the database with current models and capabilities.
          Pricing information is updated from known sources.
        </p>
        
        <div id="metadata-sync-status" style="margin-bottom: 16px;">
          <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
            Loading sync status...
          </div>
        </div>
        
        <div id="metadata-sync-result" style="display: none;"></div>
      </div>
      
      <!-- Provider Status -->
      <div class="admin-card">
        <h4 style="margin-bottom: 16px;">Provider Model Count</h4>
        <div id="provider-model-counts">
          <div style="text-align: center; padding: 20px; color: var(--text-tertiary);">
            Loading...
          </div>
        </div>
      </div>
      
      <!-- Model Browser -->
      <div class="admin-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4>Browse Models</h4>
          <div style="display: flex; gap: 8px;">
            <select id="browse-provider-select" class="form-select" style="min-width: 150px;">
              <option value="">Select Provider</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="grok">Grok (xAI)</option>
              <option value="deepseek">DeepSeek</option>
            </select>
            <button class="btn btn-secondary" id="browse-models-btn">Load Models</button>
          </div>
        </div>
        
        <div id="models-browser-content">
          <div style="text-align: center; padding: 40px; color: var(--text-tertiary);">
            Select a provider to browse available models
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render current section content
 */
function renderSectionContent(): string {
  switch (currentSection) {
    case 'llm':
      return renderLLMSection();
    case 'models':
      return renderModelsSection();
    case 'graph':
      return renderGraphSection();
    case 'ontology':
      return renderOntologySection();
    case 'queue':
      return renderQueueSection();
    case 'prompts':
      return renderPromptsSection();
    case 'processing':
      return renderProcessingSection();
    case 'team-analysis':
      return renderTeamAnalysisSection();
    case 'billing':
      return renderBillingSection();
    case 'audit':
      return renderAuditSection();
    default:
      return renderLLMSection();
  }
}

/**
 * Bind section-specific events
 */
function bindSectionEvents(container: HTMLElement): void {
  // Nav buttons
  container.querySelectorAll('.admin-nav-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const newSection = btn.getAttribute('data-section') || 'llm';
      currentSection = newSection;
      
      // Load Team Analysis settings when switching to that section
      if (newSection === 'team-analysis') {
        teamAnalysisLoaded = false; // Force reload
        teamAnalysisLoading = false;
        renderAdminPanel(container);
        await loadTeamAnalysisSettings();
        renderAdminPanel(container);
      } else if (newSection === 'billing') {
        // Load billing data
        if (!billingLoaded) {
          billingLoading = true;
          renderAdminPanel(container);
          await loadBillingData();
          renderAdminPanel(container);
        } else {
          renderAdminPanel(container);
        }
      } else {
        renderAdminPanel(container);
      }
    });
  });

  // Toggle visibility buttons
  container.querySelectorAll('[data-toggle-visibility]').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const inputId = btn.getAttribute('data-toggle-visibility');
      if (inputId) {
        const input = container.querySelector(`#${inputId}`) as HTMLInputElement;
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
          (btn as HTMLElement).textContent = input.type === 'password' ? 'Show' : 'Hide';
        }
      }
    });
  });

  // Test provider buttons
  container.querySelectorAll('[data-test-provider]').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const providerId = btn.getAttribute('data-test-provider');
      if (providerId) {
        (btn as HTMLElement).textContent = 'Testing...';
        await testProvider(providerId);
        (btn as HTMLElement).textContent = 'Test';
      }
    });
  });

  // Cache for loaded models by provider
  const modelsCache: Record<string, { textModels: string[]; visionModels: string[]; embeddingModels: string[] }> = {};
  
  // Load models for a provider
  async function loadModelsForProvider(providerId: string, taskType: string): Promise<void> {
    const modelSelect = container.querySelector(`select.model-select[data-task="${taskType}"]`) as HTMLSelectElement;
    const loadingSpan = container.querySelector(`.model-loading[data-task="${taskType}"]`) as HTMLElement;
    const statusDiv = container.querySelector(`.model-status[data-task="${taskType}"]`) as HTMLElement;
    
    if (!modelSelect || !providerId) {
      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">-- Select Provider First --</option>';
      }
      return;
    }
    
    // Show loading state
    if (loadingSpan) loadingSpan.style.display = 'inline';
    modelSelect.disabled = true;
    
    try {
      // Check cache first
      if (!modelsCache[providerId]) {
        const response = await http.get<{ textModels: Array<{id: string; name?: string}>; visionModels: Array<{id: string; name?: string}>; embeddingModels: Array<{id: string; name?: string}> }>(`/api/llm/models?provider=${providerId}`);
        modelsCache[providerId] = {
          textModels: (response.data.textModels || []).map(m => m.id || m.name || '').filter(Boolean),
          visionModels: (response.data.visionModels || []).map(m => m.id || m.name || '').filter(Boolean),
          embeddingModels: (response.data.embeddingModels || []).map(m => m.id || m.name || '').filter(Boolean)
        };
      }
      
      // Determine which models to show based on task type
      let models: string[] = [];
      if (taskType === 'text') models = modelsCache[providerId].textModels;
      else if (taskType === 'vision') models = modelsCache[providerId].visionModels;
      else if (taskType === 'embeddings') models = modelsCache[providerId].embeddingModels;
      
      // Get current selected value
      const currentValue = modelSelect.value;
      
      // Populate dropdown
      modelSelect.innerHTML = '<option value="">-- Select Model --</option>' +
        models.map(m => `<option value="${m}"${m === currentValue ? ' selected' : ''}>${m}</option>`).join('');
      
      // Update status
      if (statusDiv) {
        statusDiv.textContent = models.length > 0 
          ? `${models.length} model(s) available` 
          : 'No models found for this task type. Check provider configuration.';
        statusDiv.style.color = models.length > 0 ? 'var(--success)' : 'var(--warning)';
      }
      
    } catch (error) {
      console.error(`Failed to load models for ${providerId}:`, error);
      modelSelect.innerHTML = '<option value="">Error loading models</option>';
      if (statusDiv) {
        statusDiv.textContent = 'Failed to load models. Check API key configuration.';
        statusDiv.style.color = 'var(--error)';
      }
    } finally {
      if (loadingSpan) loadingSpan.style.display = 'none';
      modelSelect.disabled = false;
    }
  }
  
  // Provider change handler - load models dynamically
  container.querySelectorAll('select.provider-select').forEach(select => {
    on(select as HTMLElement, 'change', async () => {
      const task = select.getAttribute('data-task');
      const provider = (select as HTMLSelectElement).value;
      if (task) {
        await loadModelsForProvider(provider, task);
      }
    });
    
    // Initial load if provider is already selected
    const task = select.getAttribute('data-task');
    const provider = (select as HTMLSelectElement).value;
    if (task && provider) {
      loadModelsForProvider(provider, task);
    }
  });

  // Save LLM config
  const saveLLMBtn = container.querySelector('#save-llm-config');
  if (saveLLMBtn) {
    on(saveLLMBtn as HTMLElement, 'click', async () => {
      const taskConfigs: Record<string, { provider: string; model: string }> = {};
      
      container.querySelectorAll('select[data-task]').forEach(el => {
        const task = el.getAttribute('data-task')!;
        const field = el.getAttribute('data-field')!;
        
        if (!taskConfigs[task]) {
          taskConfigs[task] = { provider: '', model: '' };
        }
        
        taskConfigs[task][field as 'provider' | 'model'] = (el as HTMLSelectElement).value;
      });

      try {
        for (const [task, config] of Object.entries(taskConfigs)) {
          if (config.provider) {
            await saveConfig(`${task}_provider`, config, 'llm');
          }
        }
        toast.success('LLM configuration saved to Supabase');
      } catch (error) {
        toast.error('Failed to save LLM configuration');
      }
    });
  }

  // Load existing API keys status
  async function loadApiKeysStatus(): Promise<void> {
    const loadingEl = container.querySelector('#api-keys-loading') as HTMLElement;
    try {
      const response = await http.get<{ success: boolean; secrets: Array<{ name: string; masked_value: string; is_valid: boolean }> }>('/api/secrets');
      if (response.data?.success && response.data.secrets) {
        for (const secret of response.data.secrets) {
          const formGroup = container.querySelector(`[data-secret-name="${secret.name}"]`);
          if (formGroup) {
            const statusSpan = formGroup.querySelector('.key-status') as HTMLElement;
            const input = formGroup.querySelector('input') as HTMLInputElement;
            if (statusSpan) {
              if (secret.masked_value) {
                statusSpan.textContent = '✓ Configured';
                statusSpan.style.color = 'var(--success)';
                if (input) {
                  input.placeholder = secret.masked_value;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load API keys status:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }
  
  // Load API keys status on render
  loadApiKeysStatus();

  // Save LLM API keys
  const saveKeysBtn = container.querySelector('#save-api-keys');
  if (saveKeysBtn) {
    on(saveKeysBtn as HTMLElement, 'click', async () => {
      const keys = [
        { id: 'openai-key', name: 'OPENAI_API_KEY' },
        { id: 'anthropic-key', name: 'CLAUDE_API_KEY' },
        { id: 'google-key', name: 'GOOGLE_API_KEY' },
        { id: 'xai-key', name: 'XAI_API_KEY' },
        { id: 'deepseek-key', name: 'DEEPSEEK_API_KEY' },
        { id: 'kimi-key', name: 'KIMI_API_KEY' },
        { id: 'minimax-key', name: 'MINIMAX_API_KEY' },
      ];

      try {
        let savedCount = 0;
        for (const key of keys) {
          const value = (container.querySelector(`#${key.id}`) as HTMLInputElement)?.value;
          if (value && value.trim()) {
            await http.post('/api/secrets', { name: key.name, value: value.trim(), scope: 'system' });
            savedCount++;
          }
        }
        if (savedCount > 0) {
          toast.success(`${savedCount} API key(s) saved securely`);
        } else {
          toast.info('No API keys to save');
        }
      } catch (error) {
        toast.error('Failed to save API keys');
      }
    });
  }

  // Save service API keys
  const saveServiceKeysBtn = container.querySelector('#save-service-keys');
  if (saveServiceKeysBtn) {
    on(saveServiceKeysBtn as HTMLElement, 'click', async () => {
      const resendKey = (container.querySelector('#resend-key') as HTMLInputElement)?.value;

      try {
        if (resendKey && resendKey.trim()) {
          await http.post('/api/secrets', { name: 'RESEND_API_KEY', value: resendKey.trim(), scope: 'system' });
          toast.success('Service API key saved securely');
        } else {
          toast.info('No service keys to save');
        }
      } catch (error) {
        toast.error('Failed to save service keys');
      }
    });
  }

  // ============ Queue Section Handlers ============
  
  // Load queue status
  // Interface for queue data
  interface QueueStatusData {
    isProcessing: boolean;
    isPaused: boolean;
    queueLength: number;
    currentRequest: { id: string; context: string; priority: string; startedAt: string } | null;
    stats: { total: number; successful: number; failed: number; avgProcessingTime: number };
    pendingItems: Array<{ id: string; context: string; priority: string; queuedAt: string }>;
    database?: {
      pendingCount: number;
      processingCount: number;
      retryPendingCount: number;
      completedToday: number;
      failedToday: number;
      avgProcessingTimeMs: number;
      totalCostTodayUsd: number;
    };
  }

  async function loadQueueStatus(): Promise<void> {
    const statusContent = container.querySelector('#queue-status-content');
    const itemsContent = container.querySelector('#queue-items-content');
    const pendingCount = container.querySelector('#pending-count');
    const dbStatusBadge = container.querySelector('#db-status-badge');
    
    try {
      const response = await http.get<QueueStatusData>('/api/llm/queue/status');
      const data = response.data;
      
      // Update DB status badge
      if (dbStatusBadge) {
        if (data.database) {
          dbStatusBadge.className = 'badge badge-success';
          dbStatusBadge.textContent = 'DB: Connected';
        } else {
          dbStatusBadge.className = 'badge badge-warning';
          dbStatusBadge.textContent = 'DB: Memory Only';
        }
      }
      
      // Update status
      if (statusContent) {
        const statusColor = data.isPaused ? 'var(--warning)' : (data.isProcessing ? 'var(--success)' : 'var(--text-tertiary)');
        const statusText = data.isPaused ? '⏸ PAUSED' : (data.isProcessing ? '🔄 PROCESSING' : '✓ IDLE');
        
        statusContent.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
            <div>
              <div style="font-size: 28px; font-weight: bold; color: ${statusColor};">${statusText}</div>
              <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">Queue Status</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: bold;">${data.queueLength}</div>
              <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">Items in Queue</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: bold; color: var(--primary);">${data.isProcessing ? '1' : '0'}</div>
              <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">Processing Now</div>
            </div>
          </div>
          ${data.currentRequest ? `
            <div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: left;">
              <strong>Currently Processing:</strong> ${data.currentRequest.context || 'Unknown'} 
              <span style="color: var(--text-tertiary);">(Priority: ${data.currentRequest.priority})</span>
              <span style="color: var(--text-tertiary); font-size: 11px; margin-left: 8px;">Started: ${new Date(data.currentRequest.startedAt).toLocaleTimeString()}</span>
            </div>
          ` : ''}
        `;
      }
      
      // Update pending items
      if (itemsContent && pendingCount) {
        const pendingLen = data.pendingItems?.length || 0;
        pendingCount.textContent = `${pendingLen} items`;
        
        if (pendingLen > 0) {
          itemsContent.innerHTML = `
            <table style="width: 100%; font-size: 13px;">
              <thead>
                <tr style="text-align: left; color: var(--text-tertiary); border-bottom: 1px solid var(--border);">
                  <th style="padding: 8px;">Context</th>
                  <th style="padding: 8px;">Priority</th>
                  <th style="padding: 8px;">Queued</th>
                  <th style="padding: 8px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${data.pendingItems.map(item => `
                  <tr style="border-bottom: 1px solid var(--border-light);">
                    <td style="padding: 8px;">${item.context || 'Unknown'}</td>
                    <td style="padding: 8px;"><span class="badge badge-${item.priority}">${item.priority}</span></td>
                    <td style="padding: 8px;">${new Date(item.queuedAt).toLocaleTimeString()}</td>
                    <td style="padding: 8px;"><button class="btn-sm btn-danger" data-cancel-item="${item.id}">Cancel</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        } else {
          itemsContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No items in queue</div>';
        }
      }
      
      // Update stats
      const db = data.database;
      const statPending = container.querySelector('#stat-pending');
      const statProcessing = container.querySelector('#stat-processing');
      const statSuccess = container.querySelector('#stat-success');
      const statFailed = container.querySelector('#stat-failed');
      const statRetry = container.querySelector('#stat-retry');
      const statAvgTime = container.querySelector('#stat-avg-time');
      const statCost = container.querySelector('#stat-cost');
      
      if (statPending) statPending.textContent = String(db?.pendingCount || data.queueLength || 0);
      if (statProcessing) statProcessing.textContent = String(db?.processingCount || (data.isProcessing ? 1 : 0));
      if (statSuccess) statSuccess.textContent = String(db?.completedToday || data.stats?.successful || 0);
      if (statFailed) statFailed.textContent = String(db?.failedToday || data.stats?.failed || 0);
      if (statRetry) statRetry.textContent = String(db?.retryPendingCount || 0);
      if (statAvgTime) statAvgTime.textContent = String(Math.round(db?.avgProcessingTimeMs || data.stats?.avgProcessingTime || 0));
      if (statCost) statCost.textContent = `$${(db?.totalCostTodayUsd || 0).toFixed(4)}`;
      
    } catch (error) {
      console.error('Failed to load queue status:', error);
      if (statusContent) {
        statusContent.innerHTML = '<div style="color: var(--error);">Failed to load queue status</div>';
      }
    }
  }
  
  // Load queue history
  async function loadQueueHistory(): Promise<void> {
    const historyContent = container.querySelector('#queue-history-content');
    
    try {
      const response = await http.get<{
        history: Array<{
          id: string;
          context: string;
          priority: string;
          status: string;
          processingTime: number;
          completedAt: string;
          provider?: string;
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          estimatedCost?: number;
          error?: string;
        }>;
      }>('/api/llm/queue/history?limit=50');
      
      const history = response.data?.history || [];
      
      if (historyContent) {
        if (history.length > 0) {
          historyContent.innerHTML = `
            <table style="width: 100%; font-size: 12px;">
              <thead>
                <tr style="text-align: left; color: var(--text-tertiary); border-bottom: 1px solid var(--border);">
                  <th style="padding: 6px;">Context</th>
                  <th style="padding: 6px;">Provider/Model</th>
                  <th style="padding: 6px;">Status</th>
                  <th style="padding: 6px;">Tokens</th>
                  <th style="padding: 6px;">Time</th>
                  <th style="padding: 6px;">Completed</th>
                  <th style="padding: 6px;">Details</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(item => `
                  <tr style="border-bottom: 1px solid var(--border-light);">
                    <td style="padding: 6px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.context || ''}">${item.context || 'Unknown'}</td>
                    <td style="padding: 6px; font-size: 11px; color: var(--text-secondary);">${item.provider || '-'}/${item.model || '-'}</td>
                    <td style="padding: 6px;">
                      <span style="color: ${item.status === 'completed' ? 'var(--success)' : 'var(--error)'};">
                        ${item.status === 'completed' ? '✓' : '✗'}
                      </span>
                      ${item.error ? `<span style="font-size: 10px; color: var(--error);" title="${item.error}">Error</span>` : ''}
                    </td>
                    <td style="padding: 6px; font-size: 11px;">${item.inputTokens || '-'}/${item.outputTokens || '-'}</td>
                    <td style="padding: 6px;">${item.processingTime || '-'}ms</td>
                    <td style="padding: 6px; font-size: 11px;">${item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}</td>
                    <td style="padding: 6px;"><button class="btn-sm" data-view-request="${item.id}">View</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        } else {
          historyContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No processing history yet</div>';
        }
      }
    } catch (error) {
      console.error('Failed to load queue history:', error);
      if (historyContent) {
        historyContent.innerHTML = '<div style="color: var(--error);">Failed to load history</div>';
      }
    }
  }
  
  // Show request details modal
  async function showRequestDetails(requestId: string): Promise<void> {
    try {
      const response = await http.get<{
        success: boolean;
        request: {
          id: string;
          context: string;
          request_type: string;
          provider: string;
          model: string;
          status: string;
          priority: string;
          input_data: Record<string, unknown>;
          output_data: Record<string, unknown> | null;
          output_text: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          total_tokens: number | null;
          estimated_cost_usd: number | null;
          processing_time_ms: number | null;
          attempt_count: number;
          max_attempts: number;
          last_error: string | null;
          error_details: Record<string, unknown> | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
      }>(`/api/llm/queue/${requestId}`);
      
      if (!response.data.success || !response.data.request) {
        toast.error('Request not found');
        return;
      }
      
      const req = response.data.request;
      
      // Escape HTML in strings to prevent XSS and template breaking
      const escapeHtml = (str: string | null | undefined): string => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      };
      
      // Format JSON with syntax highlighting
      const formatJsonHtml = (obj: unknown): string => {
        const json = JSON.stringify(obj, null, 2);
        return escapeHtml(json)
          .replace(/"([^"]+)":/g, '<span style="color: #0550ae;">"$1"</span>:')
          .replace(/: "([^"]*)"/g, ': <span style="color: #0a3069;">"$1"</span>')
          .replace(/: (\d+)/g, ': <span style="color: #0550ae;">$1</span>')
          .replace(/: (true|false|null)/g, ': <span style="color: #cf222e;">$1</span>');
      };
      
      // Format prompt text for readability
      const formatPromptText = (text: string | null | undefined): string => {
        if (!text) return '<span style="color: var(--text-tertiary);">(No content)</span>';
        return escapeHtml(text)
          .replace(/\\n/g, '\n')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/^(#{1,3})\s*(.+)$/gm, '<span style="color: var(--accent); font-weight: 600;">$2</span>')
          .replace(/^[-•]\s*(.+)$/gm, '  • $1')
          .replace(/---+/g, '<hr style="border: none; border-top: 1px solid var(--border); margin: 8px 0;">');
      };
      
      // Get status color and icon
      const getStatusInfo = (status: string) => {
        const statusMap: Record<string, { color: string; icon: string; bg: string }> = {
          completed: { color: 'var(--success)', icon: '✓', bg: 'rgba(34, 197, 94, 0.1)' },
          failed: { color: 'var(--error)', icon: '✗', bg: 'rgba(239, 68, 68, 0.1)' },
          processing: { color: 'var(--warning)', icon: '⟳', bg: 'rgba(234, 179, 8, 0.1)' },
          pending: { color: 'var(--text-secondary)', icon: '○', bg: 'var(--bg-tertiary)' },
          retry_pending: { color: 'var(--warning)', icon: '↻', bg: 'rgba(234, 179, 8, 0.1)' },
          cancelled: { color: 'var(--text-tertiary)', icon: '⊘', bg: 'var(--bg-tertiary)' }
        };
        return statusMap[status] || { color: 'var(--text-primary)', icon: '?', bg: 'var(--bg-secondary)' };
      };
      
      const statusInfo = getStatusInfo(req.status);
      const inputData = (req.input_data || {}) as Record<string, unknown>;
      const messages = inputData.messages as Array<{ content?: string }> | undefined;
      const promptText = (inputData.prompt as string) || messages?.[0]?.content || '';
      
      // Create modal - using unique ID to avoid duplicates
      const existingModal = document.getElementById('llm-request-details-modal');
      if (existingModal) {
        existingModal.remove();
      }
      
      const modal = document.createElement('div');
      modal.id = 'llm-request-details-modal';
      modal.className = 'modal open';
      modal.style.cssText = 'display: flex !important; z-index: 999999 !important;';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; width: 95%;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: ${statusInfo.bg}; border-radius: 8px; color: ${statusInfo.color};">${statusInfo.icon}</span>
              <div>
                <h3 style="margin: 0;">LLM Request Details</h3>
                <span style="font-size: 12px; color: var(--text-tertiary);">ID: ${req.id}</span>
              </div>
            </div>
            <button class="modal-close">&times;</button>
          </div>
          
          <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <!-- Status Bar -->
            <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px;">
              <div style="flex: 1; min-width: 120px;">
                <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Context</div>
                <div style="font-weight: 600; font-size: 16px; color: var(--accent);">${req.context || 'Unknown'}</div>
              </div>
              <div style="flex: 1; min-width: 120px;">
                <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Provider</div>
                <div style="font-weight: 600; font-size: 16px;">${req.provider || '-'}</div>
              </div>
              <div style="flex: 1; min-width: 120px;">
                <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Model</div>
                <div style="font-weight: 600; font-size: 14px; font-family: monospace;">${req.model || '-'}</div>
              </div>
              <div style="flex: 1; min-width: 100px;">
                <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Status</div>
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: ${statusInfo.bg}; border-radius: 12px; color: ${statusInfo.color}; font-weight: 600; font-size: 13px;">
                  ${statusInfo.icon} ${req.status}
                </div>
              </div>
            </div>
            
            <!-- Metrics -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">
              <div style="text-align: center; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${req.input_tokens?.toLocaleString() || '-'}</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Input Tokens</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${req.output_tokens?.toLocaleString() || '-'}</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Output Tokens</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: var(--text-primary);">${req.processing_time_ms ? `${(req.processing_time_ms / 1000).toFixed(1)}s` : '-'}</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Duration</div>
              </div>
              <div style="text-align: center; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: ${req.estimated_cost_usd ? 'var(--success)' : 'var(--text-tertiary)'};">$${req.estimated_cost_usd?.toFixed(4) || '-'}</div>
                <div style="font-size: 11px; color: var(--text-tertiary);">Est. Cost</div>
              </div>
            </div>
            
            <!-- Timeline -->
            <div style="display: flex; gap: 24px; margin-bottom: 24px; padding: 12px 16px; background: var(--bg-secondary); border-radius: 8px; font-size: 12px; flex-wrap: wrap;">
              <div><strong style="color: var(--text-tertiary);">Queued:</strong> ${req.queued_at ? new Date(req.queued_at).toLocaleString() : '-'}</div>
              <div><strong style="color: var(--text-tertiary);">Started:</strong> ${req.started_at ? new Date(req.started_at).toLocaleString() : '-'}</div>
              <div><strong style="color: var(--text-tertiary);">Completed:</strong> ${req.completed_at ? new Date(req.completed_at).toLocaleString() : '-'}</div>
            </div>
            
            ${req.last_error ? `
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--error); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="color: var(--error); font-size: 18px;">⚠</span>
                  <strong style="color: var(--error);">Error</strong>
                  <span style="font-size: 12px; color: var(--text-tertiary);">(Attempt ${req.attempt_count}/${req.max_attempts})</span>
                </div>
                <div style="font-size: 13px; color: var(--error); font-family: monospace; white-space: pre-wrap;">${escapeHtml(req.last_error)}</div>
              </div>
            ` : ''}
            
            <!-- Prompt / Input -->
            <div style="margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">📝</span> Prompt / Input
                </h4>
                <button class="btn btn-sm btn-secondary" id="copy-input-btn">Copy</button>
              </div>
              <div style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 16px; max-height: 250px; overflow-y: auto; font-size: 13px; line-height: 1.6; white-space: pre-wrap; font-family: inherit;" id="input-display">${formatPromptText(promptText as string)}</div>
            </div>
            
            <!-- Output -->
            <div style="margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">🤖</span> Response
                </h4>
                <button class="btn btn-sm btn-secondary" id="copy-output-btn">Copy</button>
              </div>
              <div style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 16px; max-height: 350px; overflow-y: auto; font-size: 13px; line-height: 1.6; white-space: pre-wrap;" id="output-display">${formatPromptText(req.output_text)}</div>
            </div>
            
            <!-- Raw Data Toggle -->
            <details style="margin-bottom: 16px;">
              <summary style="cursor: pointer; font-weight: 600; padding: 12px; background: var(--bg-secondary); border-radius: 8px; user-select: none;">
                <span style="margin-left: 8px;">📋 Raw Data (JSON)</span>
              </summary>
              <div style="margin-top: 12px;">
                <div style="margin-bottom: 16px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Input Data</span>
                    <button class="btn btn-xs btn-secondary" id="copy-input-json-btn">Copy JSON</button>
                  </div>
                  <pre style="background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 11px; max-height: 200px; overflow-y: auto; margin: 0;">${formatJsonHtml(req.input_data)}</pre>
                </div>
                ${req.output_data ? `
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Output Data</span>
                      <button class="btn btn-xs btn-secondary" id="copy-output-json-btn">Copy JSON</button>
                    </div>
                    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 11px; max-height: 200px; overflow-y: auto; margin: 0;">${formatJsonHtml(req.output_data)}</pre>
                  </div>
                ` : ''}
              </div>
            </details>
          </div>
          
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close-btn">Close</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close handlers
      modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
      modal.querySelector('.modal-close-btn')?.addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
      
      // ESC key to close
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);
      
      // Copy handlers
      modal.querySelector('#copy-input-btn')?.addEventListener('click', () => {
        const text = promptText || JSON.stringify(req.input_data, null, 2);
        navigator.clipboard.writeText(text as string);
        toast.success('Input copied to clipboard');
      });
      modal.querySelector('#copy-output-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(req.output_text || '');
        toast.success('Response copied to clipboard');
      });
      modal.querySelector('#copy-input-json-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(req.input_data, null, 2));
        toast.success('Input JSON copied to clipboard');
      });
      modal.querySelector('#copy-output-json-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(req.output_data, null, 2));
        toast.success('Output JSON copied to clipboard');
      });
      
    } catch (error) {
      console.error('Failed to load request details:', error);
      toast.error('Failed to load request details');
    }
  }
  
  // Load failed items
  async function loadFailedItems(): Promise<void> {
    const failedContent = container.querySelector('#failed-items-content');
    
    try {
      const response = await http.get<{
        items: Array<{
          id: string;
          context: string;
          priority: string;
          provider?: string;
          model?: string;
          attemptCount: number;
          maxAttempts: number;
          canRetry: boolean;
          error?: string;
          completedAt?: string;
        }>;
      }>('/api/llm/queue/retryable?limit=20');
      
      const items = response.data?.items || [];
      
      if (failedContent) {
        if (items.length > 0) {
          failedContent.innerHTML = `
            <table style="width: 100%; font-size: 12px;">
              <thead>
                <tr style="text-align: left; color: var(--text-tertiary); border-bottom: 1px solid var(--border);">
                  <th style="padding: 6px;">Context</th>
                  <th style="padding: 6px;">Provider</th>
                  <th style="padding: 6px;">Attempts</th>
                  <th style="padding: 6px;">Error</th>
                  <th style="padding: 6px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr style="border-bottom: 1px solid var(--border-light);">
                    <td style="padding: 6px;">${item.context || 'Unknown'}</td>
                    <td style="padding: 6px; font-size: 11px;">${item.provider || '-'}</td>
                    <td style="padding: 6px;">${item.attemptCount}/${item.maxAttempts}</td>
                    <td style="padding: 6px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--error);" title="${item.error || ''}">${item.error || '-'}</td>
                    <td style="padding: 6px;">
                      <button class="btn-sm btn-primary" data-retry-item="${item.id}" ${!item.canRetry ? 'disabled' : ''}>↻ Retry</button>
                      <button class="btn-sm" data-retry-reset-item="${item.id}" style="margin-left: 4px;">Reset & Retry</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        } else {
          failedContent.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No failed items</div>';
        }
      }
    } catch (error) {
      console.error('Failed to load failed items:', error);
      if (failedContent) {
        failedContent.innerHTML = '<div style="color: var(--error);">Failed to load failed items</div>';
      }
    }
  }
  
  // Refresh queue status button
  const refreshStatusBtn = container.querySelector('#refresh-queue-status');
  if (refreshStatusBtn) {
    on(refreshStatusBtn as HTMLElement, 'click', loadQueueStatus);
  }
  
  // Refresh history button
  const refreshHistoryBtn = container.querySelector('#refresh-queue-history');
  if (refreshHistoryBtn) {
    on(refreshHistoryBtn as HTMLElement, 'click', loadQueueHistory);
  }
  
  // Refresh failed button
  const refreshFailedBtn = container.querySelector('#refresh-failed-btn');
  if (refreshFailedBtn) {
    on(refreshFailedBtn as HTMLElement, 'click', loadFailedItems);
  }
  
  // Retry all failed items
  const retryAllBtn = container.querySelector('#retry-all-btn');
  if (retryAllBtn) {
    on(retryAllBtn as HTMLElement, 'click', async () => {
      try {
        // Get all retryable items and retry them
        const response = await http.get<{ items: Array<{ id: string; canRetry: boolean }> }>('/api/llm/queue/retryable?limit=50');
        const items = (response.data?.items || []).filter(i => i.canRetry);
        
        let successCount = 0;
        for (const item of items) {
          try {
            await http.post(`/api/llm/queue/${item.id}/retry`, { resetAttempts: false });
            successCount++;
          } catch {
            // Continue with others
          }
        }
        
        toast.success(`Queued ${successCount} items for retry`);
        loadQueueStatus();
        loadFailedItems();
      } catch (error) {
        toast.error('Failed to retry items');
      }
    });
  }
  
  // Pause queue button
  const pauseBtn = container.querySelector('#queue-pause-btn');
  if (pauseBtn) {
    on(pauseBtn as HTMLElement, 'click', async () => {
      try {
        await http.post('/api/llm/queue/pause');
        toast.success('Queue paused');
        loadQueueStatus();
      } catch (error) {
        toast.error('Failed to pause queue');
      }
    });
  }
  
  // Resume queue button
  const resumeBtn = container.querySelector('#queue-resume-btn');
  if (resumeBtn) {
    on(resumeBtn as HTMLElement, 'click', async () => {
      try {
        await http.post('/api/llm/queue/resume');
        toast.success('Queue resumed');
        loadQueueStatus();
      } catch (error) {
        toast.error('Failed to resume queue');
      }
    });
  }
  
  // Clear queue button
  const clearBtn = container.querySelector('#queue-clear-btn');
  if (clearBtn) {
    on(clearBtn as HTMLElement, 'click', async () => {
      if (confirm('Are you sure you want to clear all pending items from the queue?')) {
        try {
          await http.post('/api/llm/queue/clear');
          toast.success('Queue cleared');
          loadQueueStatus();
        } catch (error) {
          toast.error('Failed to clear queue');
        }
      }
    });
  }
  
  // Cancel individual item, retry handlers, and view details
  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    
    // View request details - use closest to handle click on button or its content
    const viewBtn = target.closest('[data-view-request]') as HTMLElement | null;
    if (viewBtn) {
      e.preventDefault();
      e.stopPropagation();
      const viewId = viewBtn.getAttribute('data-view-request');
      if (viewId) {
        showRequestDetails(viewId);
      }
      return;
    }
    
    // Cancel pending item
    const cancelBtn = target.closest('[data-cancel-item]') as HTMLElement | null;
    if (cancelBtn) {
      const cancelId = cancelBtn.getAttribute('data-cancel-item');
      if (cancelId) {
        try {
          await http.delete(`/api/llm/queue/${cancelId}`);
          toast.success('Item cancelled');
          loadQueueStatus();
        } catch (error) {
          toast.error('Failed to cancel item');
        }
        return;
      }
    }
    
    // Retry failed item
    const retryBtn = target.closest('[data-retry-item]') as HTMLElement | null;
    if (retryBtn) {
      const retryId = retryBtn.getAttribute('data-retry-item');
      if (retryId) {
        try {
          await http.post(`/api/llm/queue/${retryId}/retry`, { resetAttempts: false });
          toast.success('Item queued for retry');
          loadQueueStatus();
          loadFailedItems();
        } catch (error) {
          toast.error('Failed to retry item');
        }
        return;
      }
    }
    
    // Retry with reset
    const retryResetBtn = target.closest('[data-retry-reset-item]') as HTMLElement | null;
    if (retryResetBtn) {
      const retryResetId = retryResetBtn.getAttribute('data-retry-reset-item');
      if (retryResetId) {
        try {
          await http.post(`/api/llm/queue/${retryResetId}/retry`, { resetAttempts: true });
          toast.success('Item queued for retry (attempts reset)');
          loadQueueStatus();
          loadFailedItems();
        } catch (error) {
          toast.error('Failed to retry item');
        }
        return;
      }
    }
  });
  
  // ============ Models Section Handlers ============
  
  // Load metadata sync status
  async function loadMetadataSyncStatus(): Promise<void> {
    const statusDiv = container.querySelector('#metadata-sync-status');
    const countsDiv = container.querySelector('#provider-model-counts');
    
    try {
      const response = await http.get<{
        success: boolean;
        providers: Array<{
          provider: string;
          active_models: number;
          text_models: number;
          embedding_models: number;
          vision_models: number;
          last_synced: string | null;
        }>;
      }>('/api/llm/metadata/status');
      
      const providers = response.data?.providers || [];
      
      if (statusDiv) {
        if (providers.length > 0) {
          statusDiv.innerHTML = `
            <table style="width: 100%; font-size: 13px;">
              <thead>
                <tr style="text-align: left; color: var(--text-tertiary); border-bottom: 1px solid var(--border);">
                  <th style="padding: 8px;">Provider</th>
                  <th style="padding: 8px;">Text</th>
                  <th style="padding: 8px;">Vision</th>
                  <th style="padding: 8px;">Embeddings</th>
                  <th style="padding: 8px;">Total</th>
                  <th style="padding: 8px;">Last Synced</th>
                </tr>
              </thead>
              <tbody>
                ${providers.map(p => `
                  <tr style="border-bottom: 1px solid var(--border-light);">
                    <td style="padding: 8px; font-weight: 600; text-transform: capitalize;">${p.provider}</td>
                    <td style="padding: 8px;">${p.text_models || 0}</td>
                    <td style="padding: 8px;">${p.vision_models || 0}</td>
                    <td style="padding: 8px;">${p.embedding_models || 0}</td>
                    <td style="padding: 8px; font-weight: 600;">${p.active_models || 0}</td>
                    <td style="padding: 8px; font-size: 11px; color: var(--text-tertiary);">${p.last_synced ? new Date(p.last_synced).toLocaleString() : 'Never'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        } else {
          statusDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No metadata found. Click "Sync All Providers" to fetch model data.</div>';
        }
      }
      
      // Update counts display
      if (countsDiv && providers.length > 0) {
        const total = providers.reduce((sum, p) => sum + (p.active_models || 0), 0);
        countsDiv.innerHTML = `
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            ${providers.map(p => `
              <div style="flex: 1; min-width: 120px; text-align: center; padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700;">${p.active_models || 0}</div>
                <div style="font-size: 12px; color: var(--text-tertiary); text-transform: capitalize;">${p.provider}</div>
              </div>
            `).join('')}
            <div style="flex: 1; min-width: 120px; text-align: center; padding: 16px; background: var(--accent); border-radius: 8px; color: white;">
              <div style="font-size: 24px; font-weight: 700;">${total}</div>
              <div style="font-size: 12px; opacity: 0.9;">Total Models</div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to load metadata status:', error);
      if (statusDiv) {
        statusDiv.innerHTML = '<div style="color: var(--error);">Failed to load metadata status</div>';
      }
    }
  }
  
  // Sync all metadata
  const syncAllBtn = container.querySelector('#sync-all-metadata-btn');
  if (syncAllBtn) {
    on(syncAllBtn as HTMLElement, 'click', async () => {
      const resultDiv = container.querySelector('#metadata-sync-result');
      (syncAllBtn as HTMLButtonElement).disabled = true;
      (syncAllBtn as HTMLButtonElement).textContent = 'Syncing...';
      
      try {
        const response = await http.post<{
          success: boolean;
          providers: Record<string, { status: string; models?: number; synced?: number; error?: string; reason?: string }>;
          totalModels: number;
          errors: Array<{ provider: string; error: string }>;
        }>('/api/llm/metadata/sync', {});
        
        if (resultDiv) {
          (resultDiv as HTMLElement).style.display = 'block';
          const providers = response.data?.providers || {};
          const entries = Object.entries(providers);
          
          resultDiv.innerHTML = `
            <div style="padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
              <div style="font-weight: 600; margin-bottom: 12px;">Sync Results</div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${entries.map(([provider, result]) => `
                  <div style="padding: 8px 12px; background: ${result.status === 'success' ? 'rgba(34, 197, 94, 0.1)' : result.status === 'skipped' ? 'var(--bg-secondary)' : 'rgba(239, 68, 68, 0.1)'}; border-radius: 6px; font-size: 12px;">
                    <span style="font-weight: 600; text-transform: capitalize;">${provider}</span>
                    ${result.status === 'success' ? `<span style="color: var(--success);"> ✓ ${result.synced} models</span>` : ''}
                    ${result.status === 'skipped' ? `<span style="color: var(--text-tertiary);"> - ${result.reason}</span>` : ''}
                    ${result.status === 'error' ? `<span style="color: var(--error);"> ✗ ${result.error}</span>` : ''}
                  </div>
                `).join('')}
              </div>
              <div style="margin-top: 12px; font-size: 13px; color: var(--success);">
                Total: ${response.data?.totalModels || 0} models synced
              </div>
            </div>
          `;
        }
        
        toast.success(`Synced ${response.data?.totalModels || 0} models`);
        loadMetadataSyncStatus();
        
      } catch (error) {
        toast.error('Failed to sync metadata');
        if (resultDiv) {
          (resultDiv as HTMLElement).style.display = 'block';
          resultDiv.innerHTML = '<div style="color: var(--error);">Sync failed. Check console for details.</div>';
        }
      } finally {
        (syncAllBtn as HTMLButtonElement).disabled = false;
        (syncAllBtn as HTMLButtonElement).textContent = '↻ Sync All Providers';
      }
    });
  }
  
  // Browse models by provider
  const browseModelsBtn = container.querySelector('#browse-models-btn');
  if (browseModelsBtn) {
    on(browseModelsBtn as HTMLElement, 'click', async () => {
      const providerSelect = container.querySelector('#browse-provider-select') as HTMLSelectElement;
      const contentDiv = container.querySelector('#models-browser-content');
      const provider = providerSelect?.value;
      
      if (!provider) {
        toast.info('Please select a provider');
        return;
      }
      
      if (contentDiv) {
        contentDiv.innerHTML = '<div style="text-align: center; padding: 20px;">Loading models...</div>';
      }
      
      try {
        const response = await http.get<{
          success: boolean;
          textModels: Array<{ model_id: string; display_name: string; context_tokens: number; price_input: number; price_output: number }>;
          visionModels: Array<{ model_id: string; display_name: string }>;
          embeddingModels: Array<{ model_id: string; display_name: string }>;
        }>(`/api/llm/metadata/${provider}`);
        
        const { textModels = [], visionModels = [], embeddingModels = [] } = response.data || {};
        
        if (contentDiv) {
          if (textModels.length === 0 && embeddingModels.length === 0) {
            contentDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-tertiary);">No models found for this provider. Try syncing first.</div>';
          } else {
            contentDiv.innerHTML = `
              <div style="display: grid; gap: 16px;">
                ${textModels.length > 0 ? `
                  <div>
                    <h5 style="margin-bottom: 8px; color: var(--text-secondary);">Text Models (${textModels.length})</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px;">
                      ${textModels.map(m => `
                        <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px; font-size: 12px;">
                          <div style="font-weight: 600; margin-bottom: 4px;">${m.display_name || m.model_id}</div>
                          <div style="color: var(--text-tertiary); font-family: monospace; font-size: 11px;">${m.model_id}</div>
                          <div style="margin-top: 8px; display: flex; gap: 12px; color: var(--text-secondary);">
                            <span title="Context Window">📏 ${m.context_tokens ? (m.context_tokens / 1000).toFixed(0) + 'K' : '-'}</span>
                            <span title="Input Price">💰 $${m.price_input?.toFixed(2) || '-'}/1M</span>
                            <span title="Output Price">💵 $${m.price_output?.toFixed(2) || '-'}/1M</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
                ${embeddingModels.length > 0 ? `
                  <div>
                    <h5 style="margin-bottom: 8px; color: var(--text-secondary);">Embedding Models (${embeddingModels.length})</h5>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                      ${embeddingModels.map(m => `
                        <div style="padding: 8px 12px; background: var(--bg-tertiary); border-radius: 6px; font-size: 12px;">
                          ${m.display_name || m.model_id}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }
        }
      } catch (error) {
        if (contentDiv) {
          contentDiv.innerHTML = '<div style="color: var(--error);">Failed to load models</div>';
        }
      }
    });
  }
  
  // Auto-load metadata status if on models section
  if (currentSection === 'models') {
    loadMetadataSyncStatus();
  }
  
  // Auto-load queue data if on queue section
  if (currentSection === 'queue') {
    loadQueueStatus();
    loadQueueHistory();
    loadFailedItems();
  }

  // Save graph config (Supabase Graph)
  const saveGraphBtn = container.querySelector('#save-graph-config');
  if (saveGraphBtn) {
    on(saveGraphBtn as HTMLElement, 'click', async () => {
      // Build the graph config object for Supabase Graph
      const graphConfigValue = {
        enabled: (container.querySelector('#graph-enabled') as HTMLInputElement)?.checked ?? true,
        provider: 'supabase', // Always use Supabase graph
        graphName: (container.querySelector('#graph-name') as HTMLInputElement)?.value || 'godmode',
      };

      try {
        // Save as a single 'graph' key with the config object
        await saveConfig('graph', graphConfigValue, 'graph');
        
        toast.success('Graph configuration saved!');
        console.log('[AdminPanel] Saved graph config:', graphConfigValue);
      } catch (error) {
        console.error('[AdminPanel] Error saving graph config:', error);
        toast.error('Failed to save graph configuration');
      }
    });
  }

  // Test graph connection (Supabase Graph)
  const testGraphBtn = container.querySelector('#test-graph-connection');
  if (testGraphBtn) {
    on(testGraphBtn as HTMLElement, 'click', async () => {
      (testGraphBtn as HTMLElement).textContent = 'Testing...';
      try {
        // Supabase graph uses existing Supabase connection
        const testConfig = {
          provider: 'supabase',
          graphName: (container.querySelector('#graph-name') as HTMLInputElement)?.value || 'godmode',
        };
        
        console.log('[AdminPanel] Testing Supabase graph connection');
        
        const response = await http.post<{ success: boolean; ok?: boolean; message?: string; error?: string }>('/api/graph/test', testConfig);
        if (response.data.success || response.data.ok) {
          toast.success('Supabase graph connection successful!');
        } else {
          toast.error(response.data.message || response.data.error || 'Connection failed');
        }
      } catch (error) {
        console.error('[AdminPanel] Graph test error:', error);
        toast.error('Graph connection test failed');
      }
      (testGraphBtn as HTMLElement).textContent = 'Test Connection';
    });
  }

  // Load graph overview
  const loadGraphOverviewBtn = container.querySelector('#load-graph-overview');
  if (loadGraphOverviewBtn) {
    on(loadGraphOverviewBtn as HTMLElement, 'click', async () => {
      await loadGraphOverview();
      renderAdminPanel(container);
    });
  }
  const refreshGraphOverviewBtn = container.querySelector('#refresh-graph-overview');
  if (refreshGraphOverviewBtn) {
    on(refreshGraphOverviewBtn as HTMLElement, 'click', async () => {
      await loadGraphOverview();
      renderAdminPanel(container);
      toast.info('Graph overview refreshed');
    });
  }
  const openGraphTabBtn = container.querySelector('#open-graph-tab');
  if (openGraphTabBtn) {
    on(openGraphTabBtn as HTMLElement, 'click', () => {
      document.querySelector('.nav-item[data-tab="graph"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  // Load ontology
  const loadOntologyBtn = container.querySelector('#load-ontology');
  if (loadOntologyBtn) {
    on(loadOntologyBtn as HTMLElement, 'click', async () => {
      await loadOntologyData();
      renderAdminPanel(container);
    });
  }
  const reloadOntologyBtn = container.querySelector('#reload-ontology');
  if (reloadOntologyBtn) {
    on(reloadOntologyBtn as HTMLElement, 'click', async () => {
      ontologyLoaded = false;
      await loadOntologyData();
      renderAdminPanel(container);
      toast.info('Ontology reloaded');
    });
  }

  // Save prompts
  const savePromptsBtn = container.querySelector('#save-prompts');
  if (savePromptsBtn) {
    on(savePromptsBtn as HTMLElement, 'click', async () => {
      const promptElements = container.querySelectorAll('[data-prompt-key]');
      let savedCount = 0;
      
      for (const textarea of promptElements) {
        const key = textarea.getAttribute('data-prompt-key')!;
        const value = (textarea as HTMLTextAreaElement).value;
        
        if (value && value.trim()) {
          try {
            await http.put(`/api/system/prompts/${key}`, { prompt_template: value.trim() });
            savedCount++;
            
            // Update status indicator
            const statusEl = container.querySelector(`#status-${key}`);
            if (statusEl) {
              statusEl.textContent = '✓ Saved';
              statusEl.className = 'prompt-status saved';
            }
          } catch (error) {
            console.warn(`Failed to save prompt ${key}:`, error);
            const statusEl = container.querySelector(`#status-${key}`);
            if (statusEl) {
              statusEl.textContent = '✗ Error';
              statusEl.className = 'prompt-status error';
            }
          }
        }
      }
      
      if (savedCount > 0) {
        toast.success(`${savedCount} prompt(s) saved successfully`);
      } else {
        toast.info('No prompts to save');
      }
    });
  }

  // Reload prompts
  const reloadPromptsBtn = container.querySelector('#reload-prompts');
  if (reloadPromptsBtn) {
    on(reloadPromptsBtn as HTMLElement, 'click', async () => {
      await loadSystemPrompts();
      renderAdminPanel(container);
      toast.info('Prompts reloaded from database');
    });
  }

  // View version history
  container.querySelectorAll('[data-view-versions]').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const key = btn.getAttribute('data-view-versions')!;
      const historyDiv = container.querySelector(`#versions-${key}`) as HTMLElement;
      const listDiv = historyDiv?.querySelector('.version-list') as HTMLElement;
      
      if (!historyDiv || !listDiv) return;
      
      // Toggle visibility
      if (!historyDiv.classList.contains('hidden')) {
        historyDiv.classList.add('hidden');
        return;
      }
      
      // Load versions
      listDiv.innerHTML = '<p class="text-muted">Loading versions...</p>';
      historyDiv.classList.remove('hidden');
      
      try {
        const response = await http.get<{ current_version: number; versions: Array<{ id: string; version: number; created_at: string }> }>(`/api/system/prompts/${key}/versions`);
        const versions = response.data?.versions || [];
        const currentVersion = response.data?.current_version || 1;
        
        if (versions.length === 0) {
          listDiv.innerHTML = `
            <p class="text-muted">No previous versions. Current version: ${currentVersion}</p>
            <p class="text-sm text-muted">Versions are saved automatically when you edit a prompt.</p>
          `;
          return;
        }
        
        listDiv.innerHTML = `
          <p class="text-sm"><strong>Current version:</strong> ${currentVersion}</p>
          <div class="version-items">
            ${versions.map(v => `
              <div class="version-item">
                <div class="version-info">
                  <span class="version-number">v${v.version}</span>
                  <span class="version-date">${new Date(v.created_at).toLocaleString()}</span>
                </div>
                <div class="version-actions">
                  <button class="btn-sm" data-preview-version="${key}:${v.version}">Preview</button>
                  <button class="btn-sm btn-primary" data-restore-version="${key}:${v.version}">Restore</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        
        // Bind restore buttons
        listDiv.querySelectorAll('[data-restore-version]').forEach(restoreBtn => {
          on(restoreBtn as HTMLElement, 'click', async () => {
            const [promptKey, versionStr] = restoreBtn.getAttribute('data-restore-version')!.split(':');
            const version = parseInt(versionStr, 10);
            
            if (!confirm(`Restore prompt "${promptKey}" to version ${version}? The current version will be saved in history.`)) {
              return;
            }
            
            try {
              await http.post(`/api/system/prompts/${promptKey}/restore`, { version });
              toast.success(`Restored to version ${version}`);
              await loadSystemPrompts();
              renderAdminPanel(container);
            } catch (error) {
              toast.error('Failed to restore version');
            }
          });
        });
        
        // Bind preview buttons
        listDiv.querySelectorAll('[data-preview-version]').forEach(previewBtn => {
          on(previewBtn as HTMLElement, 'click', async () => {
            const [promptKey, versionStr] = previewBtn.getAttribute('data-preview-version')!.split(':');
            const version = parseInt(versionStr, 10);
            
            try {
              const response = await http.get<{ version: { prompt_template: string } }>(`/api/system/prompts/${promptKey}/versions/${version}`);
              const template = response.data?.version?.prompt_template || '';
              
              // Show in a modal or alert for now
              const previewModal = document.createElement('div');
              previewModal.className = 'modal-overlay';
              previewModal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow: auto;">
                  <div class="modal-header">
                    <h3>Version ${version} Preview</h3>
                    <button class="modal-close">&times;</button>
                  </div>
                  <div class="modal-body">
                    <pre style="white-space: pre-wrap; font-size: 12px; background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">${template.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                  </div>
                </div>
              `;
              document.body.appendChild(previewModal);
              
              previewModal.querySelector('.modal-close')?.addEventListener('click', () => {
                previewModal.remove();
              });
              previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) previewModal.remove();
              });
            } catch (error) {
              toast.error('Failed to load version preview');
            }
          });
        });
        
      } catch (error) {
        listDiv.innerHTML = '<p class="text-error">Failed to load version history</p>';
      }
    });
  });

  // Save processing
  const saveProcBtn = container.querySelector('#save-processing');
  if (saveProcBtn) {
    on(saveProcBtn as HTMLElement, 'click', async () => {
      await saveConfig('chunk_size', parseInt((container.querySelector('#proc-chunk-size') as HTMLInputElement)?.value || '1000'), 'processing');
      await saveConfig('chunk_overlap', parseInt((container.querySelector('#proc-chunk-overlap') as HTMLInputElement)?.value || '200'), 'processing');
      await saveConfig('max_tokens', parseInt((container.querySelector('#proc-max-tokens') as HTMLInputElement)?.value || '4096'), 'processing');
      await saveConfig('temperature', parseFloat((container.querySelector('#proc-temperature') as HTMLInputElement)?.value || '0.7'), 'processing');
      await saveConfig('auto_process', (container.querySelector('#proc-auto-process') as HTMLInputElement)?.checked, 'processing');
      await saveConfig('parallel_jobs', parseInt((container.querySelector('#proc-parallel-jobs') as HTMLInputElement)?.value || '3'), 'processing');
    });
  }

  // Save Team Analysis settings
  const saveTeamAnalysisBtn = container.querySelector('#save-team-analysis');
  if (saveTeamAnalysisBtn) {
    on(saveTeamAnalysisBtn as HTMLElement, 'click', async () => {
      const enabled = (container.querySelector('#team-analysis-enabled') as HTMLInputElement)?.checked ?? true;
      const access = (container.querySelector('#team-analysis-access') as HTMLSelectElement)?.value || 'admin_only';
      await saveTeamAnalysisSettings(enabled, access);
      renderAdminPanel(container);
    });
  }

  // =========================
  // BILLING SECTION EVENTS
  // =========================
  
  // Save global pricing config
  const saveGlobalPricingBtn = container.querySelector('#save-global-pricing-btn');
  if (saveGlobalPricingBtn) {
    on(saveGlobalPricingBtn as HTMLElement, 'click', async () => {
      const fixedMarkup = parseFloat((container.querySelector('#global-markup-percent') as HTMLInputElement)?.value || '0');
      const periodType = (container.querySelector('#global-period-type') as HTMLSelectElement)?.value || 'monthly';
      const usdToEur = parseFloat((container.querySelector('#global-usd-eur-rate') as HTMLInputElement)?.value || '0.92');
      
      const result = await billingService.setGlobalPricingConfig({
        fixed_markup_percent: fixedMarkup,
        period_type: periodType as 'monthly' | 'weekly',
        usd_to_eur_rate: usdToEur
      });
      
      if (result.success) {
        toast.success('Global pricing saved');
        billingLoaded = false;
        await loadBillingData();
        renderAdminPanel(container);
      } else {
        toast.error(result.error || 'Failed to save');
      }
    });
  }
  
  // Add tier button
  const addTierBtn = container.querySelector('#add-tier-btn');
  if (addTierBtn) {
    on(addTierBtn as HTMLElement, 'click', () => {
      // Add a new tier to the list
      globalPricingTiers.push({
        id: '',
        pricing_config_id: globalPricingConfig?.id || '',
        token_limit: 100000,
        markup_percent: 20,
        name: `Tier ${globalPricingTiers.length + 1}`,
        tier_order: globalPricingTiers.length
      });
      renderAdminPanel(container);
    });
  }
  
  // Remove tier buttons
  container.querySelectorAll('.remove-tier-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', () => {
      const index = parseInt(btn.getAttribute('data-index') || '0', 10);
      globalPricingTiers.splice(index, 1);
      renderAdminPanel(container);
    });
  });
  
  // Tier unlimited checkboxes
  container.querySelectorAll('.tier-unlimited').forEach(checkbox => {
    on(checkbox as HTMLElement, 'change', () => {
      const row = (checkbox as HTMLElement).closest('.tier-row') as HTMLElement;
      const limitInput = row?.querySelector('.tier-limit') as HTMLInputElement;
      if (limitInput) {
        limitInput.disabled = (checkbox as HTMLInputElement).checked;
        if ((checkbox as HTMLInputElement).checked) {
          limitInput.value = '';
        }
      }
    });
  });
  
  // Save tiers button
  const saveTiersBtn = container.querySelector('#save-tiers-btn');
  if (saveTiersBtn) {
    on(saveTiersBtn as HTMLElement, 'click', async () => {
      const tiers: Array<{ token_limit: number | null; markup_percent: number; name?: string }> = [];
      container.querySelectorAll('.tier-row').forEach(row => {
        const name = (row.querySelector('.tier-name') as HTMLInputElement)?.value || '';
        const limitValue = (row.querySelector('.tier-limit') as HTMLInputElement)?.value;
        const markup = parseFloat((row.querySelector('.tier-markup') as HTMLInputElement)?.value || '0');
        const unlimited = (row.querySelector('.tier-unlimited') as HTMLInputElement)?.checked;
        
        tiers.push({
          token_limit: unlimited ? null : (limitValue ? parseInt(limitValue, 10) : null),
          markup_percent: markup,
          name: name || undefined
        });
      });
      
      const result = await billingService.setGlobalPricingTiers(tiers);
      if (result.success) {
        toast.success('Pricing tiers saved');
        billingLoaded = false;
        await loadBillingData();
        renderAdminPanel(container);
      } else {
        toast.error(result.error || 'Failed to save tiers');
      }
    });
  }
  
  // Refresh billing button
  const refreshBillingBtn = container.querySelector('#refresh-billing-btn');
  if (refreshBillingBtn) {
    on(refreshBillingBtn as HTMLElement, 'click', async () => {
      billingLoaded = false;
      await loadBillingData();
      renderAdminPanel(container);
      toast.info('Billing data refreshed');
    });
  }
  
  // Add balance buttons
  container.querySelectorAll('.add-balance-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const projectId = btn.getAttribute('data-project-id');
      const projectName = btn.getAttribute('data-project-name');
      if (!projectId) return;
      
      const amount = prompt(`Enter amount in EUR to add to "${projectName}":`);
      if (!amount || isNaN(parseFloat(amount))) return;
      
      const result = await billingService.creditProjectBalance(projectId, parseFloat(amount));
      if (result.success) {
        toast.success(`Added €${parseFloat(amount).toFixed(2)} to ${projectName}. New balance: €${result.new_balance?.toFixed(2)}`);
        billingLoaded = false;
        await loadBillingData();
        renderAdminPanel(container);
      } else {
        toast.error(result.error || 'Failed to add balance');
      }
    });
  });
  
  // Toggle unlimited buttons
  container.querySelectorAll('.toggle-unlimited-btn').forEach(btn => {
    on(btn as HTMLElement, 'click', async () => {
      const projectId = btn.getAttribute('data-project-id');
      const isUnlimited = btn.getAttribute('data-unlimited') === 'true';
      if (!projectId) return;
      
      const action = isUnlimited ? 'disable unlimited mode' : 'enable unlimited mode';
      if (!confirm(`Are you sure you want to ${action} for this project?`)) return;
      
      const result = await billingService.setProjectUnlimited(projectId, !isUnlimited);
      if (result.success) {
        toast.success(`Unlimited mode ${isUnlimited ? 'disabled' : 'enabled'}`);
        billingLoaded = false;
        await loadBillingData();
        renderAdminPanel(container);
      } else {
        toast.error(result.error || 'Failed to update');
      }
    });
  });

  // Refresh audit
  const refreshAuditBtn = container.querySelector('#refresh-audit');
  if (refreshAuditBtn) {
    on(refreshAuditBtn as HTMLElement, 'click', async () => {
      await loadAuditLogs();
      renderAdminPanel(container);
    });
  }
}

/**
 * Render admin panel
 */
function renderAdminPanel(container: HTMLElement): void {
  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-header">
        <div class="admin-header-content">
          <div class="admin-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div class="admin-title">
            <h2>Platform Administration</h2>
            <p>System configuration for superadmins</p>
          </div>
        </div>
      </div>

      <div class="admin-body">
        <nav class="admin-nav">
          ${renderNav()}
        </nav>

        <main class="admin-content">
          ${isLoading ? '<div class="loading-spinner">Loading...</div>' : renderSectionContent()}
        </main>
      </div>
    </div>
  `;

  bindSectionEvents(container);
}

/**
 * Initialize and mount admin panel
 */
export async function initAdminPanel(container: HTMLElement): Promise<void> {
  // Check if user is superadmin
  const state = appStore.getState();
  if (state.currentUser?.role !== 'superadmin') {
    container.innerHTML = `
      <div class="admin-panel">
        <div class="admin-header">
          <h2>Access Denied</h2>
          <p>You need superadmin privileges to access this section.</p>
        </div>
      </div>
    `;
    return;
  }

  isLoading = true;
  renderAdminPanel(container);

  // Load data
  await Promise.all([
    loadSystemConfig(),
    loadProviders(),
    loadAuditLogs(),
    loadSystemPrompts(),
    loadSecrets(),
  ]);

  isLoading = false;
  renderAdminPanel(container);
}

export default initAdminPanel;
