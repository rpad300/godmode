import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Edit2, ArrowLeft, Settings2, Users, ShieldCheck, SlidersHorizontal,
  AlertTriangle, Trash2, Check, User, X, Copy, Link2, Mail, Sparkles, CheckSquare, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import { mockProjectRoles, mockContacts, type ProjectRole } from '@/data/mock-data';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Project, Contact, Category } from '@/types/godmode';

type ProjectTab = 'general' | 'members' | 'roles' | 'categories';

const projectTabs: { id: ProjectTab; label: string; icon: React.ElementType; count?: number }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'members', label: 'Members', icon: Users, count: 0 },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'categories', label: 'Categories', icon: SlidersHorizontal },

];

const ProjectsPage = () => {
  // START: Using real data from context
  const { projects, refreshProjects } = useProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
  const [showNewForm, setShowNewForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="text-base font-semibold text-foreground mb-3">Create New Project</h3>
            <div className="space-y-3">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Project name..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Description..."
                rows={2}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Select a company</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreateProject}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects List */}
      <div className="space-y-3">
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-card border rounded-xl p-5 transition-colors border-border hover:border-primary/20`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-secondary`}>
                  <FolderOpen className={`w-5 h-5 text-muted-foreground`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">{project.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{project.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* isActive logic removed as it was mock-dependent. Could restore if useProject provides current. */}
                <button
                  onClick={() => setSelectedProjectId(project.id)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          </motion.div>
        ))}
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
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <FolderOpen className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.description || 'No description'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {projectTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {(tab.id === 'members' ? members.length : tab.count) !== undefined && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
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
            onUpdate={onUpdate} // Use the prop passed to ProjectDetail
          />
        )}

      </div>
    </div>
  );
}

// ==================== GENERAL TAB ====================

function GeneralTab({ project, onUpdate, onBack }: { project: any; onUpdate: () => void; onBack: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [role, setRole] = useState(project.role || '');
  const [rolePrompt, setRolePrompt] = useState(project.rolePrompt || '');
  const [company, setCompany] = useState(project.company_id || project.company || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> Project Name *
          </label>
          <Input value={name} onChange={e => setName(e.target.value)} className="bg-background border-border text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
            ≡ Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the project"
            rows={4}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Your Role
            </label>
            <Input value={role} onChange={e => setRole(e.target.value)} className="bg-background border-border text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">Your role in this project (used for AI context)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
              💬 Role Prompt
            </label>
            <Input value={rolePrompt} onChange={e => setRolePrompt(e.target.value)} className="bg-background border-border text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">Brief description of your responsibilities</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> Company
          </label>
          <Input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Company this project belongs to..."
            className="w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Deleting a project will permanently remove all associated data including questions, decisions, risks, and contacts.</p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
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
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> TEAM MEMBERS ({members.length})
            </h3>
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('teams')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'teams' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Teams
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" /> Invite
          </button>
        </div>

        {loading || loadingCategories ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">No team members yet</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Invite Member
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="grid gap-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  {member.avatar_url || member.linked_contact?.avatar_url ? (
                    <img
                      src={member.avatar_url || member.linked_contact?.avatar_url}
                      alt={member.display_name || member.linked_contact?.name || 'Member'}
                      className="w-10 h-10 rounded-full object-cover bg-secondary"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(member.display_name?.[0] || member.username?.[0] || member.linked_contact?.name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {member.display_name || member.linked_contact?.name || member.username || 'Unknown User'}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  <div className="text-xs text-right text-muted-foreground">
                    <p>Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => setMemberToRemove(member)}
                    disabled={removing === member.user_id}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {removing === member.user_id ? (
                      <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
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
                  className="bg-card border border-border rounded-xl p-5"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, category.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${category.color || 'blue'}-500/10 text-${category.color || 'blue'}-500`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                          {category.display_name}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{teamMembers.length}</span>
                        </h3>
                        {lead && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-500" />
                            Lead: <span className="font-medium text-foreground">{lead.display_name}</span>
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
                          className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing group relative ${isLead ? 'bg-amber-500/5 border-amber-500/20' : 'bg-background border-border hover:border-primary/30'
                            }`}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, m.user_id)}
                        >
                          {/* Avatar */}
                          <div className="relative">
                            {m.avatar_url || m.linked_contact?.avatar_url ? (
                              <img
                                src={m.avatar_url || m.linked_contact?.avatar_url}
                                alt={m.display_name}
                                className="w-10 h-10 rounded-full object-cover border border-border"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground border border-border">
                                {(m.display_name?.[0] || '?').toUpperCase()}
                              </div>
                            )}
                            {isLead && (
                              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border-2 border-background">
                                <ShieldCheck className="w-3 h-3" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-foreground truncate">{m.display_name}</h4>
                              {m.linked_contact?.organization && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground truncate max-w-[100px]">
                                  {m.linked_contact.organization}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <Select
                                value={m.user_role || m.role || ''}
                                onValueChange={(value) => handleRoleChange(m.user_id, value === 'no-role' ? '' : value)}
                              >
                                <SelectTrigger className="h-5 text-[11px] bg-transparent border-none p-0 text-muted-foreground focus:ring-0 shadow-none w-auto gap-1 hover:text-foreground">
                                  <SelectValue placeholder="No Role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no-role">No Role</SelectItem>
                                  {categories.map(cat => {
                                    const catRoles = project.settings?.roles?.filter(r => r.category === cat.id) || [];
                                    if (catRoles.length === 0) return null;
                                    return (
                                      <SelectGroup key={cat.id}>
                                        <SelectLabel className="text-[10px] font-bold text-muted-foreground px-2 py-1.5">{cat.display_name}</SelectLabel>
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
                                : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10'
                                }`}
                              title={isLead ? "Current Team Lead" : "Make Team Lead"}
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <div className="p-2 text-muted-foreground cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {teamMembers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border/50 rounded-xl bg-secondary/5">
                        <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">Drag members here to assign them to {category.display_name}</p>
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
                className="bg-card border border-border border-dashed rounded-xl p-5"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
              >
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Unassigned Members
                  <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{getUnassignedMembers().length}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {getUnassignedMembers().map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-3 bg-secondary/10 border border-border/50 hover:border-amber-500/50 rounded-xl p-3 cursor-grab active:cursor-grabbing group relative transition-colors"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, m.user_id)}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        {m.avatar_url || m.linked_contact?.avatar_url ? (
                          <img
                            src={m.avatar_url || m.linked_contact?.avatar_url}
                            alt={m.display_name}
                            className="w-10 h-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground border border-border">
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
                          <h4 className="text-sm font-medium text-foreground truncate">{m.display_name}</h4>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={m.user_role || m.role || ''}
                            onValueChange={(val) => handleRoleChange(m.user_id, val)}
                          >
                            <SelectTrigger className="h-6 text-[11px] bg-background border-border w-full">
                              <SelectValue placeholder="Select Role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-role">No Role</SelectItem>
                              {categories.map(cat => {
                                const catRoles = project.settings?.roles?.filter(r => r.category === cat.id) || [];
                                if (catRoles.length === 0) return null;
                                return (
                                  <SelectGroup key={cat.id}>
                                    <SelectLabel className="text-[10px] font-bold text-muted-foreground px-2 py-1.5">{cat.display_name}</SelectLabel>
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
                      <div className="text-muted-foreground opacity-50 group-hover:opacity-100">
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Invite Team Member</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border mb-4">
          <button
            onClick={() => setInviteTab('email')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${inviteTab === 'email' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
              }`}
          >
            New Email
          </button>
          <button
            onClick={() => setInviteTab('contacts')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${inviteTab === 'contacts' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
              }`}
          >
            Existing Contacts
          </button>
        </div>

        {inviteTab === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Email Address *</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@example.com" className="bg-background border-border text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">They will receive an email invitation to join this project</p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Access Level</label>
              <p className="text-sm text-foreground">Member - Can view and edit data</p>
              <p className="text-[10px] text-muted-foreground mt-1">You can assign a project role after they join.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Personal Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a personal note to the invitation..."
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSendInvitation}
                disabled={sendingInvite || !email.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sendingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loadingContacts ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No contacts found.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                {contacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selectedContact === contact.id
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-card hover:bg-secondary/50 border-border hover:border-border/80'
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selectedContact === contact.id ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                      {selectedContact === contact.id && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                    </div>

                    {contact.avatarUrl || contact.avatar ? (
                      <img
                        src={contact.avatarUrl || contact.avatar}
                        alt={contact.name}
                        className="w-10 h-10 rounded-full object-cover bg-secondary"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {(contact.name || '?').substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${selectedContact === contact.id ? 'text-primary' : 'text-foreground'}`}>
                        {contact.name}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {contact.organization && (
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {contact.organization}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground truncate">
                          {contact.email || 'No email'}
                        </p>
                      </div>
                    </div>

                    {contact.role && (
                      <div className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {contact.role}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Access Level</label>
              <p className="text-sm text-foreground">Member - Can view and edit data</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddContact}
                disabled={!selectedContact || adding}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Users className="w-4 h-4" />}
                Add to Team
              </button>
            </div>

            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p><span className="font-medium text-primary">Add to Team:</span> Adds contact as team member directly.</p>
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
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> PROJECT ROLES
          </h3>
          <button
            onClick={() => setShowAddRole(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Role
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Define roles and responsibilities for this project.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mergedRoles.map(role => (
            <div
              key={role.id}
              className={`p-4 rounded-xl border transition-colors ${role.active === true ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${role.active === true ? 'bg-primary/10' : 'bg-secondary'}`}>
                  <User className={`w-4 h-4 ${role.active === true ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <h4 className="text-sm font-semibold text-foreground">{role.name}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{role.description}</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={role.active === true}
                    onChange={() => toggleRole(role)}
                    disabled={!!processing}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-xs text-foreground">
                    {processing === role.id
                      ? 'Updating...'
                      : role.active === true
                        ? 'Active'
                        : 'Inactive'}
                  </span>
                </label>

                {role.active && (
                  <select
                    className="max-w-[120px] text-[10px] bg-secondary/50 border-none rounded px-2 py-1 text-foreground focus:ring-0"
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
      <DialogContent className="sm:max-w-[450px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add New Role</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Role Name *</label>
            <Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g., Senior Developer, Tech Lead" className="bg-background border-border text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loadingCategories}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            <label className="text-xs font-medium text-foreground mb-1 block">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this role" className="bg-background border-border text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Role Context (for AI)</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Describe this role's responsibilities, priorities, and how the AI should adapt responses..."
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
          <button
            onClick={() => toast.info('AI enhancement will use the project context to suggest role descriptions')}
            className="flex items-center gap-2 text-sm text-accent font-medium hover:text-accent/80 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Enhance with AI
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreateRole}
            disabled={loading || !roleName.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
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
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> PROJECT CATEGORIES
          </h3>
          <button
            onClick={() => { setEditingCategory(null); setShowAddModal(true); }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No categories found.
          </div>
        ) : (
          <div className="grid gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-${cat.color || 'blue'}-500/10 text-${cat.color || 'blue'}-500`}>
                    {cat.display_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{cat.display_name}</h4>
                    <p className="text-xs text-muted-foreground">{cat.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Lead Selector */}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Team Lead</span>
                    <Select
                      value={project.settings?.category_leads?.[cat.id] || ''}
                      onValueChange={(value) => handleSetLead(cat.id, value)}
                    >
                      <SelectTrigger className="h-6 text-[10px] bg-background border-border w-[140px]">
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

                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${!(cat as any).project_id ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
                    {!(cat as any).project_id ? 'Global' : 'Project'}
                  </span>
                  {/* Only allow editing/deleting project-specific categories */}
                  {(cat as any).project_id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingCategory(cat); setShowAddModal(true); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(cat)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
      <DialogContent className="sm:max-w-[450px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{initialData ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Display Name *</label>
            <Input
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value);
                // Auto-generate slug if adding new and slug is empty or matches previous slug
                if (!initialData && (!name || name === displayName.toLowerCase().replace(/\s+/g, '_').slice(0, -1))) {
                  setName(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }
              }}
              placeholder="e.g. Frontend Team"
              className="bg-background border-border text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Internal Name (Slug) *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. frontend_team" className="bg-background border-border text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground mt-1">Unique identifier used in system.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description..." className="bg-background border-border text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : (initialData ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



export default ProjectsPage;
