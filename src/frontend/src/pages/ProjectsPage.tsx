/**
 * Purpose:
 *   Comprehensive project management page with CRUD for projects and four detail
 *   tabs: General settings, Members (with drag-and-drop team assignment), Roles
 *   configuration, and Categories management.
 *
 * Responsibilities:
 *   - List all projects from context, create new projects linked to a company
 *   - ProjectDetail view with tabbed sub-pages:
 *     - General: edit name, description, role, role prompt, company; delete project
 *     - Members: invite via email or existing contacts, assign roles via dropdown or
 *       drag-and-drop between category groups, set team leads
 *     - Roles: manage project roles (toggle active, assign to categories, create custom)
 *     - Categories: CRUD for team categories (groups), assign leads per category
 *
 * Key dependencies:
 *   - useProject (ProjectContext): project list and refresh
 *   - apiClient: direct REST calls for projects, members, roles, categories
 *   - framer-motion: animated transitions and drag-and-drop visual feedback
 *   - AlertDialog / Dialog / Select (shadcn): modal confirmations and selection UIs
 *   - mockProjectRoles: template roles merged with actual project roles
 *
 * Side effects:
 *   - Network: extensive CRUD operations across projects, members, roles, categories
 *   - Fetches companies list for project creation dropdown
 *
 * Notes:
 *   - Imports are split across the file (apiClient, date-fns, AlertDialog are imported
 *     mid-file after the GeneralTab component). This is unconventional but functional.
 *   - Role assignment uses `user_role` field to avoid 400 errors from the system `role`
 *     enum constraint on the backend.
 *   - Drag-and-drop in the Members "Teams" view uses native HTML5 drag events.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Edit2, ArrowLeft, Settings2, Users, ShieldCheck, SlidersHorizontal,
  AlertTriangle, Trash2, Check, User, X, Copy, Link2, Mail, Sparkles, CheckSquare, GripVertical,
  UserPlus, UsersRound, Loader2, Clock, Activity, Download, Upload, Star, Play, Key, TestTube,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, isValidAvatarUrl, getInitials, resolveAvatarUrl } from '@/lib/utils';

// ── Style tokens (aligned with ProfilePage) ─────────────────────────────────
const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
const LABEL = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1.5';
import { useProject } from '@/contexts/ProjectContext';
import { mockProjectRoles, type ProjectRole } from '@/data/mock-data';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Project, Contact, Category } from '@/types/godmode';
import {
  useProjectInvites, useCreateInvite, useGenerateInviteLink, useRevokeInvite,
  useTeams, useCreateTeam, useDeleteTeam, useUpdateTeam, useAddTeamMember, useRemoveTeamMember,
  useAcceptInvite, useAuditLog,
  useProjectActivity, type ActivityEntry,
  useProjectStats, useActivateProject, useSetDefaultProject,
  useExportProject, useImportProject,
  useProjectProviders, useSetProjectProviderKey, useDeleteProjectProviderKey, useValidateProjectProviderKey,
} from '@/hooks/useGodMode';

type ProjectTab = 'general' | 'members' | 'roles' | 'categories' | 'invites' | 'teams' | 'providers' | 'activity';

const projectTabs: { id: ProjectTab; label: string; icon: React.ElementType; count?: number }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'members', label: 'Members', icon: Users, count: 0 },
  { id: 'invites', label: 'Invites', icon: UserPlus },
  { id: 'teams', label: 'Teams', icon: UsersRound },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'categories', label: 'Categories', icon: SlidersHorizontal },
  { id: 'providers', label: 'AI Providers', icon: Key },
  { id: 'activity', label: 'Activity', icon: Activity },
];

const ProjectsPage = () => {
  const { projects, refreshProjects, currentProjectId } = useProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const activateProject = useActivateProject();
  const setDefaultProject = useSetDefaultProject();
  const exportProject = useExportProject();
  const importProject = useImportProject();
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [importName, setImportName] = useState('');

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
  const [showNewForm, setShowNewForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const handleActivate = (projectId: string) => {
    activateProject.mutate(projectId, {
      onSuccess: () => { toast.success('Project activated'); refreshProjects(); },
      onError: () => toast.error('Failed to activate project'),
    });
  };

  const handleSetDefault = (projectId: string) => {
    setDefaultProject.mutate(projectId, {
      onSuccess: () => { toast.success('Default project set'); refreshProjects(); },
      onError: () => toast.error('Failed to set default'),
    });
  };

  const handleExport = () => {
    exportProject.mutate(undefined, {
      onSuccess: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `project-export-${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Project exported');
      },
      onError: () => toast.error('Export failed'),
    });
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importData);
      importProject.mutate({ data: parsed, name: importName || undefined }, {
        onSuccess: () => { toast.success('Project imported'); setShowImport(false); setImportData(''); setImportName(''); refreshProjects(); },
        onError: () => toast.error('Import failed'),
      });
    } catch {
      toast.error('Invalid JSON data');
    }
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const data = await apiClient.get<{ companies: { id: string; name: string }[] }>('/api/companies');
        if (data.companies) {
          setCompanies(data.companies);
          if (data.companies.length > 0) setSelectedCompanyId(data.companies[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch companies:', error);
      }
    };
    fetchCompanies();
  }, []);

  const handleCreateProject = async () => {
    if (!formName.trim() || !selectedCompanyId) {
      toast.error('Please enter a project name and select a company.');
      return;
    }

    try {
      setIsCreating(true);
      await apiClient.post('/api/projects', {
        name: formName,
        description: formDesc,
        company_id: selectedCompanyId
      });

      setFormDesc('');
      setShowNewForm(false);
      refreshProjects();
      toast.success('Project created successfully');
    } catch (error) {
      console.error('Failed to create project:', error);
      // specific error already handled by apiClient for 500s, but we catch it here so we might want to show it if it wasn't shown?
      // actually apiClient throws, so we can show it here.
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedProjectId && selectedProject) {
    return <ProjectDetail project={selectedProject as any} onBack={() => setSelectedProjectId(null)} onUpdate={refreshProjects} />;
  } else if (selectedProjectId && !selectedProject) {
    // Project not found (maybe deleted), reset
    setSelectedProjectId(null);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-[var(--gm-text-primary)]">Projects</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exportProject.isPending} className={BTN_SECONDARY}>
            {exportProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Export
          </button>
          <button onClick={() => setShowImport(!showImport)} className={BTN_SECONDARY}>
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={() => setShowNewForm(!showNewForm)} className={BTN_PRIMARY}>
            <Plus className="w-3.5 h-3.5" /> New Project
          </button>
        </div>
      </div>

      {/* Import Form */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={cn(CARD, 'p-5')}>
            <h3 className={SECTION_TITLE}>Import Project</h3>
            <div className="space-y-3 mt-3">
              <div>
                <label className={LABEL}>Project Name (optional)</label>
                <input value={importName} onChange={e => setImportName(e.target.value)} placeholder="Project name..." className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>JSON Data</label>
                <textarea value={importData} onChange={e => setImportData(e.target.value)} placeholder="Paste exported JSON data here..." rows={5}
                  className={cn(INPUT, 'resize-none font-mono')} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowImport(false)} className={BTN_SECONDARY}>Cancel</button>
                <button onClick={handleImport} disabled={importProject.isPending || !importData.trim()} className={BTN_PRIMARY}>
                  {importProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(CARD, 'p-5')}
          >
            <h3 className={SECTION_TITLE}>Create New Project</h3>
            <div className="space-y-3 mt-3">
              <div>
                <label className={LABEL}>Project Name *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Project name..." className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Description</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Description..." rows={2} className={cn(INPUT, 'resize-none')} />
              </div>
              <div>
                <label className={LABEL}>Company</label>
                <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className={INPUT}>
                  <option value="" disabled>Select a company</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowNewForm(false)} className={BTN_SECONDARY}>Cancel</button>
                <button onClick={handleCreateProject} disabled={isCreating} className={BTN_PRIMARY}>
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects List */}
      <div className="space-y-3">
        {projects.map((project, i) => {
          const isActive = currentProjectId === project.id;
          const isDefault = (project as Record<string, unknown>).is_default === true;
          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(CARD, 'p-5',
                isActive && 'border-[var(--gm-accent-primary)]/40 ring-1 ring-[var(--gm-accent-primary)]/20')}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    isActive ? 'bg-[var(--gm-interactive-primary)]/10' : 'bg-[var(--gm-bg-tertiary)]')}>
                    <FolderOpen className={cn('w-5 h-5', isActive ? 'text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)]')} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--gm-text-primary)]">{project.name || '(unnamed project)'}</h3>
                      {isActive && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)]">Active</span>
                      )}
                      {isDefault && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Default</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--gm-text-tertiary)] font-mono">{project.id}</p>
                    {project.description && <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5 truncate max-w-md">{project.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isActive && (
                    <button onClick={() => handleActivate(project.id)} disabled={activateProject.isPending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)] text-[10px] font-medium hover:bg-[var(--gm-interactive-primary)]/20 transition-colors">
                      <Play className="w-3 h-3" /> Switch
                    </button>
                  )}
                  {!isDefault && (
                    <button onClick={() => handleSetDefault(project.id)} disabled={setDefaultProject.isPending}
                      className={BTN_SECONDARY} title="Set as default project">
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => setSelectedProjectId(project.id)} className={BTN_SECONDARY}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== PROJECT DETAIL ====================

// ==================== PROJECT DETAIL ====================

function ProjectDetail({ project, onBack, onUpdate }: { project: Project; onBack: () => void; onUpdate: () => void }) {
  const [activeTab, setActiveTab] = useState<ProjectTab>('general');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const data = await apiClient.get<{ members: ProjectMember[] }>(`/api/projects/${project.id}/members`);
      if (data.members) {
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdate = () => {
    onUpdate();
    if (activeTab === 'members') fetchMembers();
  };

  useEffect(() => {
    fetchMembers();
  }, [project.id]);

  return (
    <div className="p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--gm-interactive-primary)]/10 flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-[var(--gm-accent-primary)]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--gm-text-primary)]">{project.name || '(unnamed project)'}</h1>
          <p className="text-xs text-[var(--gm-text-tertiary)]">{project.description || 'No description'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--gm-border-primary)] overflow-x-auto">
        {projectTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
              ? 'text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]'
              : 'text-[var(--gm-text-tertiary)] border-transparent hover:text-[var(--gm-text-primary)]'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {(tab.id === 'members' ? members.length : tab.count) !== undefined && (
              <span className="text-[10px] bg-[var(--gm-bg-tertiary)] px-1.5 py-0.5 rounded-full">
                {tab.id === 'members' ? members.length : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && <GeneralTab project={project} onUpdate={onUpdate} onBack={onBack} />}
        {activeTab === 'members' && (
          <MembersTab
            project={project}
            members={members}
            loading={loadingMembers}
            onUpdate={fetchMembers}
          />
        )}
        {activeTab === 'roles' && (
          <RolesTab
            project={project}
            onUpdate={handleUpdate}
          />
        )}
        {activeTab === 'categories' && (
          <CategoriesTab
            project={project}
            members={members}
            onUpdate={onUpdate}
          />
        )}
        {activeTab === 'invites' && <InvitesTab projectId={project.id} />}
        {activeTab === 'teams' && <TeamsTab />}
        {activeTab === 'providers' && <ProvidersTab projectId={project.id} />}
        {activeTab === 'activity' && <ActivityTab projectId={project.id} />}
      </div>
    </div>
  );
}

// ==================== GENERAL TAB ====================

function ProjectStatsBar({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectStats(projectId);
  if (isLoading || !data) return null;
  const stats = data as Record<string, unknown>;
  const items = Object.entries(stats).filter(([, v]) => typeof v === 'number').slice(0, 8);
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {items.map(([key, val]) => (
        <div key={key} className="bg-[var(--gm-bg-tertiary)] rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-[var(--gm-text-primary)]">{String(val)}</p>
          <p className="text-[10px] text-[var(--gm-text-tertiary)] capitalize">{key.replace(/[_-]/g, ' ')}</p>
        </div>
      ))}
    </div>
  );
}

function GeneralTab({ project, onUpdate, onBack }: { project: any; onUpdate: () => void; onBack: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [role, setRole] = useState(project.role || '');
  const [rolePrompt, setRolePrompt] = useState(project.rolePrompt || '');
  const [company, setCompany] = useState(project.company_id || project.company || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [roleTemplates, setRoleTemplates] = useState<{ id: string; name: string; display_name?: string }[]>([]);

  useEffect(() => {
    apiClient.get<{ roles: any[] }>('/api/role-templates')
      .then(data => setRoleTemplates(data.roles || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/api/projects/${project.id}`, {
        name, description, role, rolePrompt, company_id: company,
      });
      toast.success('Project updated');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/api/projects/${project.id}`);
      toast.success('Project deleted');
      onUpdate();
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <ProjectStatsBar projectId={project.id} />
      <div className={cn(CARD, 'p-5 space-y-5')}>
        <div>
          <label className={LABEL}>
            <FolderOpen className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /> Project Name *
          </label>
          <Input value={name} onChange={e => setName(e.target.value)} className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm" />
        </div>

        <div>
          <label className={LABEL}>
            ≡ Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the project"
            rows={4}
            className={cn(INPUT, 'resize-y')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>
              <User className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /> Your Role
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm">
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {roleTemplates.filter(r => r.name || r.display_name).map(r => (
                  <SelectItem key={r.id || r.name} value={r.display_name || r.name}>
                    {r.display_name || r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Your role in this project (used for AI context)</p>
          </div>
          <div>
            <label className={LABEL}>
              💬 Role Prompt
            </label>
            <Input value={rolePrompt} onChange={e => setRolePrompt(e.target.value)} className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm" />
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Brief description of your responsibilities</p>
          </div>
        </div>

        <div>
          <label className={LABEL}>
            <FolderOpen className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" /> Company
          </label>
          <Input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Company this project belongs to..."
            className={INPUT}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={BTN_PRIMARY}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--color-danger-500)] mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-[var(--gm-text-tertiary)] mb-3">Deleting a project will permanently remove all associated data including questions, decisions, risks, and contacts.</p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-danger-500)]/30 text-[var(--color-danger-500)] text-sm font-medium hover:bg-[var(--color-danger-500)]/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={BTN_DANGER}
            >
              {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==================== MEMBERS TAB ====================

import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ... existing imports ...

interface ProjectMember {
  user_id: string;
  role: string;
  user_role?: string;
  joined_at: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  linked_contact?: {
    id: string;
    name: string;
    email?: string;
    organization?: string;
    avatar_url?: string;
  } | null;
}

function MembersTab({
  project,
  members,
  loading,
  onUpdate
}: {
  project: Project;
  members: ProjectMember[];
  loading: boolean;
  onUpdate: () => void;
}) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'teams'>('list');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [project.id]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await apiClient.get<Category[]>(`/api/projects/${project.id}/categories`);
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      setRemoving(memberToRemove.user_id);
      await apiClient.delete(`/api/projects/${project.id}/members/${memberToRemove.user_id}`);
      onUpdate();
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    } finally {
      setRemoving(null);
      setMemberToRemove(null);
    }
  };

  const handleRoleChange = async (userId: string, newRoleName: string) => {
    try {
      // We need to determine if this newRoleName corresponds to a system role or a custom role title.
      // But based on the error, let's assume `role` column is restricted (enum) and `user_role` is the free text title.
      // However, roles defined in settings are "Project Roles". 
      // If the backend 400s on `role`, it's likely an enum constraint.
      // Let's try updating `user_role` instead if the `role` is just "member".

      // WAIT: The roles in settings have IDs and Names. 
      // If we are assigning a "Role" to a user, are we assigning the `role` (enum) or `user_role` (title)?
      // If the project allows custom roles, `role` in DB should probably be 'member' and `user_role` should be 'Designer'.
      // OR `role` should be a foreign key to something? No, it's usually text.

      // Strategy: Try to update `user_role` with the role name, and keep `role` as 'member' (or whatever it was).
      // But the UI shows `member.role`. 

      // Let's try sending BOTH, or just `user_role`. 
      // If I look at `handleUpdate` in `ProjectsPage.tsx`, it uses `role`?

      // Let's try updating `role` AND `user_role` to be safe, or just `user_role` if `role` fails.
      // Actually, looking at the error `400 Bad Request`, it confirms a constraint.

      // I will update `user_role` property in the PUT request.
      // Update only user_role to avoid 400 Bad Request (system role constraint)
      await apiClient.put(`/api/projects/${project.id}/members/${userId}`, {
        user_role: newRoleName
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to update member role:', error);
    }
  };

  // Group members by category based on their role
  const getTeamMembers = (category: Category) => {
    return members.filter(m => {
      const memberRole = m.user_role || m.role;
      const role = project.settings?.roles?.find(r => r.name === memberRole);

      // DEBUG: Log mismatch failures for first member to reduce spam
      // if (m === members[0]) {
      //   console.log('Checking member:', m.display_name, 'Role:', memberRole, 'FoundRole:', role, 'CatID:', category.id, 'Match:', role?.category === category.id);
      // }

      const match = role?.category === category.id;
      if (match) return true;
      return false;
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, memberId: string) => {
    e.dataTransfer.setData('text/plain', memberId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetCategoryId: string | null) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('text/plain');
    if (!memberId) return;

    // Find member
    const member = members.find(m => m.user_id === memberId);
    if (!member) return;

    // Determine new role
    let newRoleName = '';
    if (targetCategoryId) {
      // Find existing role in this category or default to first available
      const categoryRoles = project.settings?.roles?.filter(r => r.category === targetCategoryId) || [];
      if (categoryRoles.length > 0) {
        newRoleName = categoryRoles[0].name;
      } else {
        // check if there is a 'Member' role for this category
        const defaultRole = categoryRoles.find(r => r.name === 'Member') || categoryRoles[0];
        newRoleName = defaultRole?.name || 'Member'; // fallback to Member if no specific roles
      }
    } else {
      // Dropped on "Unassigned" - clear role
      newRoleName = '';
    }

    const currentRole = member.user_role || member.role;
    if (newRoleName !== currentRole) {
      await handleRoleChange(memberId, newRoleName);
    }
  };

  const getUnassignedMembers = () => {
    return members.filter(m => {
      const memberRole = m.user_role || m.role;
      const role = project.settings?.roles?.find(r => r.name === memberRole);

      const isUnassigned = !role || !role.category || !categories.find(c => c.id === role.category);
      if (isUnassigned && m.display_name === 'RPAD') { // Debug specific user
        console.log('Unassigned Debug (RPAD):', { memberRole, roleFound: !!role, roleCategory: role?.category, catExists: !!categories.find(c => c.id === role?.category) });
      }
      return isUnassigned;
    });
  };

  const setCategoryLead = async (categoryId: string, userId: string) => {
    try {
      const updatedSettings = {
        ...project.settings,
        category_leads: {
          ...project.settings?.category_leads,
          [categoryId]: userId
        }
      };
      await apiClient.put(`/api/projects/${project.id}`, { settings: updatedSettings });
      onUpdate(); // Trigger parent refresh to update project context
    } catch (error) {
      console.error('Failed to set lead:', error);
      toast.error('Failed to set team lead');
    }
  };

  const existingContactIds = members
    .map(m => m.linked_contact?.id)
    .filter((id): id is string => !!id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4" /> TEAM MEMBERS ({members.length})
            </h3>
            <div className="flex bg-[var(--gm-bg-tertiary)] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-[var(--gm-surface-primary)] text-[var(--gm-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]'
                  }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('teams')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'teams' ? 'bg-[var(--gm-surface-primary)] text-[var(--gm-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]'
                  }`}
              >
                Teams
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className={BTN_PRIMARY}
          >
            <Users className="w-4 h-4" /> Invite
          </button>
        </div>

        {loading || loadingCategories ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--gm-accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--gm-bg-tertiary)] flex items-center justify-center mb-3">
              <Users className="w-8 h-8 text-[var(--gm-text-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--gm-text-tertiary)] mb-4">No team members yet</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className={BTN_PRIMARY}
            >
              Invite Member
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="grid gap-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)]/20 hover:bg-[var(--gm-bg-tertiary)]/40 transition-colors">
                <div className="flex items-center gap-3">
                  {isValidAvatarUrl(member.avatar_url) || isValidAvatarUrl(member.linked_contact?.avatar_url) ? (
                    <img
                      src={(isValidAvatarUrl(member.avatar_url) ? member.avatar_url : member.linked_contact?.avatar_url)!}
                      alt={member.display_name || member.linked_contact?.name || 'Member'}
                      className="w-10 h-10 rounded-full object-cover bg-[var(--gm-bg-tertiary)]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--gm-interactive-primary)]/10 flex items-center justify-center text-[var(--gm-accent-primary)] font-bold">
                      {getInitials(member.display_name || member.username || member.linked_contact?.name)}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-[var(--gm-text-primary)]">
                      {member.display_name || member.linked_contact?.name || member.username || 'Unknown User'}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-[var(--gm-text-tertiary)]">
                      <span>{member.user_role || member.role}</span>
                      {member.linked_contact?.organization && (
                        <>
                          <span>•</span>
                          <span>{member.linked_contact.organization}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-right text-[var(--gm-text-tertiary)]">
                    <p>Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '—'}</p>
                  </div>
                  <button
                    onClick={() => setMemberToRemove(member)}
                    disabled={removing === member.user_id}
                    className="p-2 text-[var(--gm-text-tertiary)] hover:text-[var(--color-danger-500)] transition-colors disabled:opacity-50"
                  >
                    {removing === member.user_id ? (
                      <div className="w-4 h-4 border-2 border-[var(--color-danger-500)] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => {
              const teamMembers = getTeamMembers(category);
              const leadId = project.settings?.category_leads?.[category.id];
              const lead = members.find(m => m.user_id === leadId);

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(CARD, 'p-5')}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, category.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${category.color || 'blue'}-500/10 text-${category.color || 'blue'}-500`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
                          {category.display_name}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">{teamMembers.length}</span>
                        </h3>
                        {lead && (
                          <p className="text-xs text-[var(--gm-text-tertiary)] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-500" />
                            Lead: <span className="font-medium text-[var(--gm-text-primary)]">{lead.display_name}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {teamMembers.map((m) => {
                      const isLead = leadId === m.user_id;
                      return (
                        <div
                          key={m.user_id}
                          className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing group relative ${isLead ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[var(--gm-bg-primary)] border-[var(--gm-border-primary)] hover:border-[var(--gm-accent-primary)]/30'
                            }`}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, m.user_id)}
                        >
                          {/* Avatar */}
                          <div className="relative">
                            {isValidAvatarUrl(m.avatar_url) || isValidAvatarUrl(m.linked_contact?.avatar_url) ? (
                              <img
                                src={(isValidAvatarUrl(m.avatar_url) ? m.avatar_url : m.linked_contact?.avatar_url)!}
                                alt={m.display_name}
                                className="w-10 h-10 rounded-full object-cover border border-[var(--gm-border-primary)]"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[var(--gm-bg-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--gm-text-tertiary)] border border-[var(--gm-border-primary)]">
                                {getInitials(m.display_name)}
                              </div>
                            )}
                            {isLead && (
                              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-[var(--gm-bg-primary)]">
                                <ShieldCheck className="w-3 h-3" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-[var(--gm-text-primary)] truncate">{m.display_name}</h4>
                              {m.linked_contact?.organization && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] truncate max-w-[100px]">
                                  {m.linked_contact.organization}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <Select
                                value={m.user_role || m.role || ''}
                                onValueChange={(value) => handleRoleChange(m.user_id, value === 'no-role' ? '' : value)}
                              >
                                <SelectTrigger className="h-5 text-[11px] bg-transparent border-none p-0 text-[var(--gm-text-tertiary)] focus:ring-0 shadow-none w-auto gap-1 hover:text-[var(--gm-text-primary)]">
                                  <SelectValue placeholder="No Role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no-role">No Role</SelectItem>
                                  {categories.map(cat => {
                                    const catRoles = project.settings?.roles?.filter(r => r.category === cat.id) || [];
                                    if (catRoles.length === 0) return null;
                                    return (
                                      <SelectGroup key={cat.id}>
                                        <SelectLabel className="text-[10px] font-bold text-[var(--gm-text-tertiary)] px-2 py-1.5">{cat.display_name}</SelectLabel>
                                        {catRoles.map(r => (
                                          <SelectItem key={r.id} value={r.name} className="text-[10px]">{r.name}</SelectItem>
                                        ))}
                                      </SelectGroup>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCategoryLead(category.id, m.user_id);
                              }}
                              className={`p-2 rounded-lg transition-colors ${isLead
                                ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                                : 'text-[var(--gm-text-tertiary)] hover:text-amber-500 hover:bg-amber-500/10'
                                }`}
                              title={isLead ? "Current Team Lead" : "Make Team Lead"}
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-[var(--gm-border-primary)] mx-1" />
                            <div className="p-2 text-[var(--gm-text-tertiary)] cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {teamMembers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-[var(--gm-border-primary)]/50 rounded-xl bg-[var(--gm-bg-tertiary)]/5">
                        <Users className="w-8 h-8 text-[var(--gm-text-tertiary)]/30 mb-2" />
                        <p className="text-xs text-[var(--gm-text-tertiary)]">Drag members here to assign them to {category.display_name}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Unassigned Section */}
            {getUnassignedMembers().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] border-dashed rounded-xl p-5"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
              >
                <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Unassigned Members
                  <span className="text-[10px] bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] px-2 py-0.5 rounded-full">{getUnassignedMembers().length}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {getUnassignedMembers().map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-3 bg-[var(--gm-bg-tertiary)]/10 border border-[var(--gm-border-primary)]/50 hover:border-amber-500/50 rounded-xl p-3 cursor-grab active:cursor-grabbing group relative transition-colors"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, m.user_id)}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        {isValidAvatarUrl(m.avatar_url) || isValidAvatarUrl(m.linked_contact?.avatar_url) ? (
                          <img
                            src={(isValidAvatarUrl(m.avatar_url) ? m.avatar_url : m.linked_contact?.avatar_url)!}
                            alt={m.display_name}
                            className="w-10 h-10 rounded-full object-cover border border-[var(--gm-border-primary)]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[var(--gm-bg-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--gm-text-tertiary)] border border-[var(--gm-border-primary)]">
                            {(m.display_name?.[0] || '?').toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-[10px]">
                          !
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-[var(--gm-text-primary)] truncate">{m.display_name}</h4>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={m.user_role || m.role || ''}
                            onValueChange={(val) => handleRoleChange(m.user_id, val)}
                          >
                            <SelectTrigger className="h-6 text-[11px] bg-[var(--gm-bg-primary)] border-[var(--gm-border-primary)] w-full">
                              <SelectValue placeholder="Select Role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-role">No Role</SelectItem>
                              {categories.map(cat => {
                                const catRoles = project.settings?.roles?.filter(r => r.category === cat.id) || [];
                                if (catRoles.length === 0) return null;
                                return (
                                  <SelectGroup key={cat.id}>
                                    <SelectLabel className="text-[10px] font-bold text-[var(--gm-text-tertiary)] px-2 py-1.5">{cat.display_name}</SelectLabel>
                                    {catRoles.map(r => (
                                      <SelectItem key={r.id} value={r.name} className="text-[10px]">{r.name}</SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Drag Handle */}
                      <div className="text-[var(--gm-text-tertiary)] opacity-50 group-hover:opacity-100">
                        <GripVertical className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <InviteMemberModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        projectId={project.id}
        onMemberAdded={onUpdate}
        existingContactIds={existingContactIds}
      />

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.display_name || memberToRemove?.linked_contact?.name || 'this member'}</strong> from the project?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)]"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ==================== INVITE MEMBER MODAL ====================

function InviteMemberModal({
  open,
  onClose,
  projectId,
  onMemberAdded,
  existingContactIds = []
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onMemberAdded: () => void;
  existingContactIds?: string[];
}) {
  const [inviteTab, setInviteTab] = useState<'email' | 'contacts'>('contacts');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (open && inviteTab === 'contacts') {
      fetchContacts();
    }
  }, [open, inviteTab]);

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await apiClient.get<{ contacts: Contact[] }>('/api/contacts');
      if (data.contacts) {
        const availableContacts = data.contacts.filter(c => !existingContactIds.includes(c.id));
        setContacts(availableContacts);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSendingInvite(true);
    try {
      await apiClient.post(`/api/projects/${projectId}/members/invite`, {
        email: email.trim(),
        message: message.trim() || undefined,
      });
      toast.success('Invitation sent');
      setEmail('');
      setMessage('');
      onMemberAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAddContact = async () => {
    if (!selectedContact) return;

    try {
      setAdding(true);
      await apiClient.post(`/api/projects/${projectId}/members/add-contact`, {
        contact_id: selectedContact
      });
      onMemberAdded();
      onClose();
    } catch (error) {
      console.error('Failed to add contact:', error);
      toast.error('Failed to add contact to team');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[var(--gm-surface-primary)] border-[var(--gm-border-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--gm-text-primary)]">Invite Team Member</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-[var(--gm-border-primary)] mb-4">
          <button
            onClick={() => setInviteTab('email')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${inviteTab === 'email' ? 'text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] border-transparent'
              }`}
          >
            New Email
          </button>
          <button
            onClick={() => setInviteTab('contacts')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${inviteTab === 'contacts' ? 'text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)] border-transparent'
              }`}
          >
            Existing Contacts
          </button>
        </div>

        {inviteTab === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--gm-text-primary)] mb-1 block">Email Address *</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@example.com" className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm" />
              <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">They will receive an email invitation to join this project</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--gm-text-primary)] mb-1 block">Access Level</label>
              <p className="text-sm text-[var(--gm-text-primary)]">Member - Can view and edit data</p>
              <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">You can assign a project role after they join.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--gm-text-primary)] mb-1 block">Personal Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a personal note to the invitation..."
                rows={3}
                className={cn(INPUT, 'resize-none')}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button
                onClick={handleSendInvitation}
                disabled={sendingInvite || !email.trim()}
                className={BTN_PRIMARY}
              >
                {sendingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loadingContacts ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--gm-accent-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-[var(--gm-text-tertiary)] text-sm">
                No contacts found.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                {contacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selectedContact === contact.id
                      ? 'bg-[var(--gm-interactive-primary)]/10 border-[var(--gm-accent-primary)] shadow-[var(--shadow-sm)]'
                      : 'bg-[var(--gm-surface-primary)] hover:bg-[var(--gm-surface-hover)] border-[var(--gm-border-primary)] hover:border-[var(--gm-border-primary)]/80'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selectedContact === contact.id ? 'border-[var(--gm-accent-primary)] bg-[var(--gm-interactive-primary)]' : 'border-[var(--gm-text-tertiary)]'}`}>
                      {selectedContact === contact.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--gm-text-on-brand)]" />}
                    </div>

                    {resolveAvatarUrl(contact as any) ? (
                      <img
                        src={resolveAvatarUrl(contact as any)!}
                        alt={contact.name}
                        className="w-10 h-10 rounded-full object-cover bg-[var(--gm-bg-tertiary)]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--gm-interactive-primary)]/10 flex items-center justify-center text-[var(--gm-accent-primary)] font-bold text-sm">
                        {getInitials(contact.name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${selectedContact === contact.id ? 'text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-primary)]'}`}>
                        {contact.name || '(unnamed)'}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {contact.organization && (
                          <p className="text-[10px] text-[var(--gm-text-tertiary)] font-medium">
                            {contact.organization}
                          </p>
                        )}
                        <p className="text-[10px] text-[var(--gm-text-tertiary)] truncate">
                          {contact.email || 'No email'}
                        </p>
                      </div>
                    </div>

                    {contact.role && (
                      <div className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-primary)]">
                        {contact.role}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-[var(--gm-text-primary)] mb-1 block">Access Level</label>
              <p className="text-sm text-[var(--gm-text-primary)]">Member - Can view and edit data</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddContact}
                disabled={!selectedContact || adding}
                className={cn(BTN_PRIMARY, 'disabled:cursor-not-allowed')}
              >
                {adding ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Users className="w-4 h-4" />}
                Add to Team
              </button>
            </div>

            <div className="text-[10px] text-[var(--gm-text-tertiary)] space-y-0.5">
              <p><span className="font-medium text-[var(--gm-accent-primary)]">Add to Team:</span> Adds contact as team member directly.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== ROLES TAB ====================

// ==================== ROLES TAB ====================

function RolesTab({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [showAddRole, setShowAddRole] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, [project.id]);

  const fetchCategories = async () => {
    try {
      const data = await apiClient.get<Category[]>(`/api/projects/${project.id}/categories`);
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const projectRoles = project.settings?.roles || [];

  // Combine custom roles with templates (mock roles)
  // If a mock role ID exists in projectRoles, use the projectRole version
  const combinedRoles = [...mockProjectRoles];

  // Update templates with active status if they exist in project settings
  const displayRoles = combinedRoles.map(template => {
    const existing = projectRoles.find(r => r.name === template.name); // Match by name or ID? Mock IDs are '1', '2'. Real IDs are UUIDs.
    // If we have a real role with same name, use its status.
    // Actually, let's list all projectRoles. And suggest templates that differ.
    // But for now, let's just list projectRoles.
    // If projectRoles is empty, we show checking logic.
    return template;
  });

  // Better approach:
  // Show all roles from project.settings.roles.
  // If empty, allow "Import Defaults" or just Add.
  // Implementation:
  // mergedRoles = unique by name?
  const mergedRoles = [...projectRoles];

  // Add templates that are NOT in projectRoles (by name)
  mockProjectRoles.forEach(template => {
    if (!mergedRoles.find(r => r.name === template.name)) {
      mergedRoles.push({ ...template, active: false, id: `template-${template.id}` });
    }
  });

  const toggleRole = async (role: ProjectRole) => {
    try {
      setProcessing(role.id);

      // If it's a template (id starts with template-), we need to Create it
      if (role.id.toString().startsWith('template-')) {
        const newRole = {
          name: role.name,
          description: role.description,
          active: true
        };
        await apiClient.post(`/api/projects/${project.id}/roles`, newRole);
      } else {
        // It's a real role, toggle active
        await apiClient.put(`/api/projects/${project.id}/roles/${role.id}`, {
          active: !role.active
        });
      }
      onUpdate();
    } catch (error) {
      console.error('Error toggling role:', error);
      toast.error('Failed to update role');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> PROJECT ROLES
          </h3>
          <button
            onClick={() => setShowAddRole(true)}
            className={BTN_PRIMARY}
          >
            <Plus className="w-4 h-4" /> Add Role
          </button>
        </div>
        <p className="text-xs text-[var(--gm-text-tertiary)] mb-4">Define roles and responsibilities for this project.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mergedRoles.map(role => (
            <div
              key={role.id}
              className={`p-4 rounded-xl border transition-colors ${role.active === true ? 'border-[var(--gm-accent-primary)]/30 bg-[var(--gm-interactive-primary)]/5' : 'border-[var(--gm-border-primary)]'
                }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${role.active === true ? 'bg-[var(--gm-interactive-primary)]/10' : 'bg-[var(--gm-bg-tertiary)]'}`}>
                  <User className={`w-4 h-4 ${role.active === true ? 'text-[var(--gm-accent-primary)]' : 'text-[var(--gm-text-tertiary)]'}`} />
                </div>
                <h4 className="text-sm font-semibold text-[var(--gm-text-primary)]">{role.name || '(unnamed role)'}</h4>
              </div>
              <p className="text-xs text-[var(--gm-text-tertiary)] mb-3">{role.description || '—'}</p>
              <div className="mt-3 pt-3 border-t border-[var(--gm-border-primary)] flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={role.active === true}
                    onChange={() => toggleRole(role)}
                    disabled={!!processing}
                    className="accent-[var(--gm-accent-primary)] w-4 h-4"
                  />
                  <span className="text-xs text-[var(--gm-text-primary)]">
                    {processing === role.id
                      ? 'Updating...'
                      : role.active === true
                        ? 'Active'
                        : 'Inactive'}
                  </span>
                </label>

                {role.active && (
                  <select
                    className="max-w-[120px] text-[10px] bg-[var(--gm-bg-tertiary)]/50 border-none rounded px-2 py-1 text-[var(--gm-text-primary)] focus:ring-0"
                    value={role.category || ''}
                    onChange={async (e) => {
                      const newCategory = e.target.value;
                      try {
                        // Update role with new category
                        // Assuming endpoint PUT /api/projects/:pid/roles/:rid supports partial update
                        // If role is a template, this might be tricky. But we only show this for active roles (which should be real roles).
                        if (!role.id.toString().startsWith('template-')) {
                          await apiClient.put(`/api/projects/${project.id}/roles/${role.id}`, { category: newCategory });
                          onUpdate();
                        }
                      } catch (err) {
                        console.error('Failed to update role category', err);
                      }
                    }}
                  >
                    <option value="">No Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.display_name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddRoleModal
        open={showAddRole}
        onClose={() => setShowAddRole(false)}
        projectId={project.id}
        onRoleAdded={onUpdate}
      />
    </motion.div>
  );
}

// ==================== ADD ROLE MODAL ====================

function AddRoleModal({ open, onClose, projectId, onRoleAdded }: { open: boolean; onClose: () => void; projectId: string; onRoleAdded: () => void }) {
  const [roleName, setRoleName] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await apiClient.get<Category[]>(`/api/projects/${projectId}/categories`);
      setCategories(data);
      if (data.length > 0 && !category) {
        setCategory(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCreateRole = async () => {
    if (!roleName.trim()) return;

    try {
      setLoading(true);
      await apiClient.post(`/api/projects/${projectId}/roles`, {
        name: roleName,
        category, // This will be the category ID now
        description,
        role_context: context,
        active: true
      });
      onRoleAdded();
      onClose();
      // Reset form
      setRoleName('');
      setDescription('');
      setContext('');
      if (categories.length > 0) setCategory(categories[0].id);
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-[var(--gm-surface-primary)] border-[var(--gm-border-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--gm-text-primary)]">Add New Role</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={LABEL}>Role Name *</label>
            <Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g., Senior Developer, Tech Lead" className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm" />
          </div>
          <div>
            <label className={LABEL}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loadingCategories}
              className={INPUT}
            >
              {loadingCategories ? (
                <option>Loading categories...</option>
              ) : (
                categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.display_name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this role" className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm" />
          </div>
          <div>
            <label className={LABEL}>Role Context (for AI)</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Describe this role's responsibilities, priorities, and how the AI should adapt responses..."
              rows={4}
              className={cn(INPUT, 'resize-y')}
            />
          </div>
          <button
            onClick={() => toast.info('AI enhancement will use the project context to suggest role descriptions')}
            className="flex items-center gap-2 text-sm text-[var(--gm-accent-primary)] font-medium hover:text-[var(--gm-accent-primary)]/80 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Enhance with AI
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button
            onClick={handleCreateRole}
            disabled={loading || !roleName.trim()}
            className={BTN_PRIMARY}
          >
            {loading ? 'Creating...' : 'Create Role'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== CATEGORIES TAB ====================

function CategoriesTab({
  project,
  members,
  onUpdate
}: {
  project: Project;
  members: ProjectMember[];
  onUpdate: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Category[]>(`/api/projects/${project.id}/categories`);
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [project.id]);

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      await apiClient.delete(`/api/projects/${project.id}/categories/${categoryToDelete.id}`);
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
    } finally {
      setCategoryToDelete(null);
    }
  };

  const handleSetLead = async (categoryId: string, userId: string) => {
    try {
      const currentLeads = project.settings?.category_leads || {};
      const updatedSettings = {
        ...project.settings,
        category_leads: {
          ...currentLeads,
          [categoryId]: userId
        }
      };
      // Use PUT acting as partial update for settings based on backend analysis
      await apiClient.put(`/api/projects/${project.id}`, { settings: updatedSettings });
      onUpdate();
    } catch (error) {
      console.error('Failed to set lead:', error);
      toast.error('Failed to set team lead');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className={cn(CARD, 'p-5')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> PROJECT CATEGORIES
          </h3>
          <button
            onClick={() => { setEditingCategory(null); setShowAddModal(true); }}
            className={BTN_PRIMARY}
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--gm-accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-[var(--gm-text-tertiary)] text-sm">
            No categories found.
          </div>
        ) : (
          <div className="grid gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)]/20 hover:bg-[var(--gm-bg-tertiary)]/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-${cat.color || 'blue'}-500/10 text-${cat.color || 'blue'}-500`}>
                    {getInitials(cat.display_name)}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[var(--gm-text-primary)]">{cat.display_name}</h4>
                    <p className="text-xs text-[var(--gm-text-tertiary)]">{cat.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Lead Selector */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[var(--gm-text-tertiary)] mb-0.5">Team Lead</span>
                    <Select
                      value={project.settings?.category_leads?.[cat.id] || ''}
                      onValueChange={(value) => handleSetLead(cat.id, value)}
                    >
                      <SelectTrigger className="h-6 text-[10px] bg-[var(--gm-bg-primary)] border-[var(--gm-border-primary)] w-[140px]">
                        <SelectValue placeholder="No Lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-lead">No Lead Assigned</SelectItem>
                        {members.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id} className="text-[10px]">{m.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${!(cat as any).project_id ? 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-primary)]' : 'bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)]'}`}>
                    {!(cat as any).project_id ? 'Global' : 'Project'}
                  </span>
                  {/* Only allow editing/deleting project-specific categories */}
                  {(cat as any).project_id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingCategory(cat); setShowAddModal(true); }}
                        className="p-1.5 text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(cat)}
                        className="p-1.5 text-[var(--gm-text-tertiary)] hover:text-[var(--color-danger-500)] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddCategoryModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        projectId={project.id}
        onSuccess={fetchCategories}
        initialData={editingCategory}
      />

      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category <strong>{categoryToDelete?.display_name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function AddCategoryModal({ open, onClose, projectId, onSuccess, initialData }: { open: boolean; onClose: () => void; projectId: string; onSuccess: () => void; initialData: Category | null }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setDisplayName(initialData.display_name);
        setDescription(initialData.description || '');
      } else {
        setName('');
        setDisplayName('');
        setDescription('');
      }
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    if (!name.trim() || !displayName.trim()) return;

    try {
      setLoading(true);
      const payload = {
        name: name.toLowerCase().replace(/\s+/g, '_'), // Ensure internal name is slug-like
        display_name: displayName,
        description,
        color: 'blue' // Default color for now
      };

      if (initialData) {
        await apiClient.put(`/api/projects/${projectId}/categories/${initialData.id}`, payload);
      } else {
        await apiClient.post(`/api/projects/${projectId}/categories`, payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.error('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-[var(--gm-surface-primary)] border-[var(--gm-border-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--gm-text-primary)]">{initialData ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className={LABEL}>Display Name *</label>
            <Input
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value);
                if (!initialData && (!name || name === displayName.toLowerCase().replace(/\s+/g, '_').slice(0, -1))) {
                  setName(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }
              }}
              placeholder="e.g. Frontend Team"
              className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm"
            />
          </div>
          <div>
            <label className={LABEL}>Internal Name (Slug) *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. frontend_team" className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm font-mono" />
            <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-1">Unique identifier used in system.</p>
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." className="bg-[var(--gm-bg-tertiary)] border-[var(--gm-border-primary)] text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className={BTN_SECONDARY}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={BTN_PRIMARY}
            >
              {loading ? 'Saving...' : (initialData ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



// ==================== INVITES TAB ====================

function InvitesTab({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [acceptToken, setAcceptToken] = useState('');

  const { data, isLoading } = useProjectInvites(projectId);
  const createMut = useCreateInvite();
  const linkMut = useGenerateInviteLink();
  const revokeMut = useRevokeInvite();
  const acceptMut = useAcceptInvite();

  const invites = data?.invites ?? [];

  const handleInvite = async () => {
    if (!email.trim()) { toast.error('Email is required'); return; }
    try {
      const result = await createMut.mutateAsync({ projectId, email: email.trim(), role });
      if (result.invite_url) {
        await navigator.clipboard.writeText(result.invite_url);
        toast.success(`Invite sent! Link copied to clipboard.${result.email_sent ? ' Email sent.' : ''}`);
      } else {
        toast.success('Invite created');
      }
      setEmail('');
    } catch {
      toast.error('Failed to create invite');
    }
  };

  const handleGenerateLink = async () => {
    try {
      const result = await linkMut.mutateAsync(projectId);
      if (result.link) {
        await navigator.clipboard.writeText(result.link);
        toast.success('Invite link copied to clipboard');
      }
    } catch {
      toast.error('Failed to generate link');
    }
  };

  const handleAcceptInvite = async () => {
    if (!acceptToken.trim()) { toast.error('Token is required'); return; }
    try {
      await acceptMut.mutateAsync(acceptToken.trim());
      toast.success('Invite accepted! You have joined the project.');
      setAcceptToken('');
    } catch {
      toast.error('Failed to accept invite — token may be invalid or expired');
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn(CARD, 'p-5 space-y-4')}>
        <h3 className={SECTION_TITLE}>Invite Members</h3>
        <div className="flex gap-2">
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address..." className="flex-1" onKeyDown={e => e.key === 'Enter' && handleInvite()} />
          <select value={role} onChange={e => setRole(e.target.value)} className={INPUT}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="read">Read Only</option>
          </select>
          <button onClick={handleInvite} disabled={createMut.isPending} className={BTN_PRIMARY}>
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Invite
          </button>
        </div>
        <button onClick={handleGenerateLink} disabled={linkMut.isPending} className={cn(BTN_SECONDARY, 'disabled:opacity-50')}>
          {linkMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Generate Shareable Link
        </button>
      </div>

      {/* Accept Invite */}
      <div className={cn(CARD, 'p-5 space-y-3')}>
        <h3 className={SECTION_TITLE}>Accept an Invite</h3>
        <p className="text-xs text-[var(--gm-text-tertiary)]">Paste an invite token to join a project you've been invited to.</p>
        <div className="flex gap-2">
          <Input
            value={acceptToken}
            onChange={e => setAcceptToken(e.target.value)}
            placeholder="Paste invite token..."
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAcceptInvite()}
          />
          <button onClick={handleAcceptInvite} disabled={acceptMut.isPending || !acceptToken.trim()}
            className={BTN_PRIMARY}>
            {acceptMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />} Accept
          </button>
        </div>
      </div>

      <div className={cn(CARD, 'p-5')}>
        <h3 className={cn(SECTION_TITLE, 'mb-3')}>Pending Invites</h3>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[var(--gm-text-tertiary)] text-center py-6">No pending invites</p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--gm-border-primary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-4 h-4 text-[var(--gm-accent-primary)]" />
                  <div>
                    <p className="text-sm text-[var(--gm-text-primary)]">{inv.email || 'Link invite'}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--gm-text-tertiary)]">
                      <span className="capitalize">{inv.role}</span>
                      {inv.expires_at && (
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => revokeMut.mutate(inv.id)} disabled={revokeMut.isPending} className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TEAMS TAB ====================

function TeamsTab() {
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#3b82f6');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingMemberTeamId, setAddingMemberTeamId] = useState<string | null>(null);
  const [newMemberContactId, setNewMemberContactId] = useState('');

  const { data, isLoading } = useTeams();
  const createMut = useCreateTeam();
  const deleteMut = useDeleteTeam();
  const updateMut = useUpdateTeam();
  const addMemberMut = useAddTeamMember();
  const removeMemberMut = useRemoveTeamMember();

  const teams = data?.teams ?? [];

  const handleCreate = async () => {
    if (!teamName.trim()) { toast.error('Team name is required'); return; }
    try {
      await createMut.mutateAsync({ name: teamName.trim(), color: teamColor });
      toast.success('Team created');
      setTeamName('');
      setCreating(false);
    } catch {
      toast.error('Failed to create team');
    }
  };

  const handleRename = async (teamId: string) => {
    if (!editName.trim()) { toast.error('Team name is required'); return; }
    try {
      await updateMut.mutateAsync({ id: teamId, name: editName.trim() });
      toast.success('Team renamed');
      setEditingTeamId(null);
    } catch {
      toast.error('Failed to rename team');
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!newMemberContactId.trim()) { toast.error('Contact ID is required'); return; }
    try {
      await addMemberMut.mutateAsync({ teamId, contactId: newMemberContactId.trim() });
      toast.success('Member added');
      setNewMemberContactId('');
      setAddingMemberTeamId(null);
    } catch {
      toast.error('Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId: string, contactId: string) => {
    try {
      await removeMemberMut.mutateAsync({ teamId, contactId });
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>Teams ({teams.length})</h3>
        <button onClick={() => setCreating(!creating)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> New Team
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={cn(CARD, 'p-4 space-y-3')}>
              <div className="flex gap-2">
                <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team name..." className="flex-1" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                <input type="color" value={teamColor} onChange={e => setTeamColor(e.target.value)} className="w-10 h-10 rounded-lg border border-[var(--gm-border-primary)] cursor-pointer" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={createMut.isPending} className={BTN_PRIMARY}>
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create
                </button>
                <button onClick={() => setCreating(false)} className={BTN_SECONDARY}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--gm-text-tertiary)]">No teams yet. Create one to get started.</div>
      ) : (
        <div className="space-y-2">
          {teams.map(team => (
            <motion.div key={team.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className={cn(CARD, 'p-4 hover:border-[var(--gm-accent-primary)]/20')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || '#3b82f6' }} />
                  {editingTeamId === team.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="h-7 text-sm w-48"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(team.id);
                          if (e.key === 'Escape') setEditingTeamId(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => handleRename(team.id)} disabled={updateMut.isPending}
                        className="p-1 rounded text-[var(--gm-accent-primary)] hover:bg-[var(--gm-interactive-primary)]/10 transition-colors">
                        {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditingTeamId(null)} className="p-1 rounded text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)] transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--gm-text-primary)]">{team.name}</h4>
                        {team.description && <p className="text-xs text-[var(--gm-text-tertiary)]">{team.description}</p>}
                      </div>
                      <button
                        onClick={() => { setEditingTeamId(team.id); setEditName(team.name); }}
                        className="p-1 rounded text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] hover:bg-[var(--gm-surface-hover)] transition-colors"
                        title="Rename team"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {team.memberCount ?? 0} members
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAddingMemberTeamId(addingMemberTeamId === team.id ? null : team.id)}
                    className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:text-[var(--gm-accent-primary)] hover:bg-[var(--gm-interactive-primary)]/10 transition-colors"
                    title="Add member"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMut.mutate(team.id)} disabled={deleteMut.isPending}
                    className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add member input */}
              <AnimatePresence>
                {addingMemberTeamId === team.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--gm-border-primary)]">
                      <Input
                        value={newMemberContactId}
                        onChange={e => setNewMemberContactId(e.target.value)}
                        placeholder="Contact ID..."
                        className="flex-1 h-8 text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleAddMember(team.id)}
                      />
                      <button onClick={() => handleAddMember(team.id)} disabled={addMemberMut.isPending || !newMemberContactId.trim()}
                        className={BTN_PRIMARY}>
                        {addMemberMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Add
                      </button>
                      <button onClick={() => setAddingMemberTeamId(null)} className="p-1.5 rounded-lg text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Member list with remove buttons */}
              {team.memberDetails && team.memberDetails.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {team.memberDetails.map((m, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[10px] text-[var(--gm-text-primary)] group/member">
                      <User className="w-3 h-3" /> {m.name || m.contactId}
                      {m.isLead && <span className="text-amber-400">★</span>}
                      {m.role && <span className="text-[var(--gm-text-tertiary)]">({m.role})</span>}
                      <button
                        onClick={() => handleRemoveMember(team.id, m.contactId)}
                        disabled={removeMemberMut.isPending}
                        className="ml-0.5 p-0.5 rounded-full text-[var(--gm-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/member:opacity-100 transition-all"
                        title="Remove member"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== PROVIDERS TAB (BYOK) ====================

function ProvidersTab({ projectId }: { projectId: string }) {
  const { data, isLoading, refetch } = useProjectProviders(projectId);
  const setKey = useSetProjectProviderKey();
  const deleteKey = useDeleteProjectProviderKey();
  const validateKey = useValidateProjectProviderKey();
  const [editProvider, setEditProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const providers = data?.providers ?? [];

  const handleSaveKey = (provider: string) => {
    if (!apiKeyInput.trim()) return;
    setKey.mutate({ projectId, provider, apiKey: apiKeyInput.trim() }, {
      onSuccess: () => { toast.success(`${provider} key saved`); setEditProvider(null); setApiKeyInput(''); refetch(); },
      onError: () => toast.error('Failed to save key'),
    });
  };

  const handleDeleteKey = (provider: string) => {
    deleteKey.mutate({ projectId, provider }, {
      onSuccess: () => { toast.success(`${provider} key removed`); refetch(); },
      onError: () => toast.error('Failed to remove key'),
    });
  };

  const handleValidate = (provider: string) => {
    validateKey.mutate({ projectId, provider }, {
      onSuccess: () => toast.success(`${provider} key is valid`),
      onError: () => toast.error(`${provider} key validation failed`),
    });
  };

  const knownProviders = ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'ollama'];
  const displayProviders = knownProviders.map(name => {
    const existing = providers.find((p: Record<string, unknown>) => p.provider === name || p.name === name);
    return { name, hasKey: !!(existing as Record<string, unknown>)?.has_key, ...((existing || {}) as Record<string, unknown>) };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>AI Provider Keys (BYOK)</h3>
        <p className="text-[10px] text-[var(--gm-text-tertiary)]">Bring your own API keys for each provider</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
      ) : (
        <div className="space-y-2">
          {displayProviders.map(p => (
            <div key={p.name} className={cn(CARD, 'p-4')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    p.hasKey ? 'bg-green-500/10' : 'bg-[var(--gm-bg-tertiary)]')}>
                    <Key className={cn('w-4 h-4', p.hasKey ? 'text-green-500' : 'text-[var(--gm-text-tertiary)]')} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--gm-text-primary)] capitalize">{p.name}</p>
                    <p className="text-[10px] text-[var(--gm-text-tertiary)]">
                      {p.hasKey ? 'Key configured' : 'No key set — uses system default'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.hasKey && (
                    <>
                      <button onClick={() => handleValidate(p.name)} disabled={validateKey.isPending} className={BTN_SECONDARY}>
                        <TestTube className="w-3 h-3" /> Test
                      </button>
                      <button onClick={() => handleDeleteKey(p.name)} disabled={deleteKey.isPending}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[var(--gm-text-tertiary)] hover:text-[var(--color-danger-500)] transition-colors">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </>
                  )}
                  <button onClick={() => { setEditProvider(editProvider === p.name ? null : p.name); setApiKeyInput(''); }}
                    className={BTN_SECONDARY}>
                    {editProvider === p.name ? 'Cancel' : p.hasKey ? 'Update' : 'Set Key'}
                  </button>
                </div>
              </div>
              {editProvider === p.name && (
                <div className="mt-3 flex gap-2">
                  <input value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
                    type="password" placeholder={`Enter ${p.name} API key...`} className={INPUT} />
                  <button onClick={() => handleSaveKey(p.name)} disabled={setKey.isPending || !apiKeyInput.trim()} className={BTN_PRIMARY}>
                    {setKey.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== ACTIVITY TAB ====================

function ActivityTab({ projectId }: { projectId: string }) {
  const [activeSubTab, setActiveSubTab] = useState<'activity' | 'audit'>('activity');
  const { data, isLoading } = useProjectActivity(projectId, { limit: 50 });
  const { data: auditData, isLoading: auditLoading } = useAuditLog(projectId, { limit: 50 });
  const activities = data?.activities ?? [];
  const auditEntries = auditData?.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>
          {activeSubTab === 'activity' ? `Recent Activity (${data?.total ?? 0})` : `Audit Log (${auditData?.total ?? 0})`}
        </h3>
        <div className="flex bg-[var(--gm-bg-tertiary)] rounded-lg p-0.5">
          <button onClick={() => setActiveSubTab('activity')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeSubTab === 'activity' ? 'bg-[var(--gm-surface-primary)] text-[var(--gm-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]')}>
            Activity
          </button>
          <button onClick={() => setActiveSubTab('audit')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeSubTab === 'audit' ? 'bg-[var(--gm-surface-primary)] text-[var(--gm-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]')}>
            Audit Log
          </button>
        </div>
      </div>

      {activeSubTab === 'activity' ? (
        <>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--gm-text-tertiary)]">No activity recorded yet.</div>
          ) : (
            <div className="space-y-1">
              {activities.map((entry, i) => (
                <div key={entry.id || i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--gm-surface-hover)] transition-colors">
                  <Activity className="w-3.5 h-3.5 text-[var(--gm-accent-primary)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--gm-text-primary)]">
                      {entry.actor_name && <span className="font-medium">{entry.actor_name} </span>}
                      {entry.action?.replace(/[._]/g, ' ')}
                      {entry.target_type && <span className="text-[var(--gm-text-tertiary)]"> on {entry.target_type}</span>}
                    </p>
                  </div>
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] flex-shrink-0">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {auditLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--gm-accent-primary)]" /></div>
          ) : auditEntries.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--gm-text-tertiary)]">No audit entries yet.</div>
          ) : (
            <div className="space-y-1">
              {auditEntries.map((entry: Record<string, unknown>, i: number) => (
                <div key={(entry.id as string) || i} className={cn(CARD, 'flex items-center gap-3 p-3')}>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--gm-text-primary)]">
                      {entry.actor_name && <span className="font-medium">{entry.actor_name as string} </span>}
                      <span>{((entry.action as string) || '').replace(/[._]/g, ' ')}</span>
                      {entry.target_type && <span className="text-[var(--gm-text-tertiary)]"> on {entry.target_type as string}</span>}
                    </p>
                    {entry.details && (
                      <p className="text-[10px] text-[var(--gm-text-tertiary)] mt-0.5 truncate max-w-md">
                        {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--gm-text-tertiary)] flex-shrink-0">
                    {entry.created_at ? new Date(entry.created_at as string).toLocaleString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProjectsPage;
