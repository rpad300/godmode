import { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, FolderOpen, Users2, Clock, Building2, Mail, Phone, Linkedin,
  MapPin, Globe, Briefcase, StickyNote, CheckCircle2, AlertTriangle,
  Plus, Trash2, Sparkles, ArrowRight, MessageSquare, FileText,
  Loader2, X, Link2 as LinkIcon, Pencil, ArrowLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useEnrichContact, useDeleteRelationship, useUnlinkParticipant } from '@/hooks/useGodMode';
import type { Contact, ContactRelationship, Project, ContactMention } from '@/types/godmode';
import { CommentsPanel } from '../shared/CommentsPanel';
import { AvatarUpload } from '../shared/AvatarUpload';
import { resolveAvatarUrl, getInitials } from '../../lib/utils';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';

const avatarGradients = [
  'from-rose-400 to-pink-500', 'from-violet-400 to-purple-500',
  'from-blue-400 to-cyan-500', 'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500', 'from-fuchsia-400 to-pink-500',
];

const getGradient = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
};

type ContactTab = 'info' | 'projects' | 'relations' | 'mentions' | 'activity';

interface ContactDetailProps {
  contact: Contact;
  onBack: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
  onUpdateProjects?: (contactId: string, projectIds: string[], primaryProjectId: string | null) => void;
}

interface DropdownOption { id: string; label: string; value: string; }

const contactTabs: { id: ContactTab; label: string; icon: React.ElementType }[] = [
  { id: 'info', label: 'Info', icon: User },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'relations', label: 'Relations', icon: Users2 },
  { id: 'mentions', label: 'Mentions', icon: MessageSquare },
  { id: 'activity', label: 'Activity', icon: Clock },
];

const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-3 border-b border-[var(--gm-border-primary)] last:border-0">
      <div className="flex items-center gap-2 text-sm text-[var(--gm-text-tertiary)]">
        <Icon className="w-4 h-4 text-[var(--gm-accent-primary)]" /> {label}
      </div>
      <p className="text-sm text-[var(--gm-text-primary)] break-all">{value}</p>
    </div>
  );
};

interface EditFieldProps {
  icon: React.ElementType; label: string; field: string;
  placeholder: string; value: string; onChange: (field: string, value: string) => void;
}

const EditInputField = ({ icon: Icon, label, field, placeholder, value, onChange, type = 'text' }: EditFieldProps & { type?: string }) => (
  <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
    <div className="flex items-center gap-2 text-sm text-[var(--gm-text-tertiary)]">
      <Icon className="w-4 h-4 text-[var(--gm-accent-primary)]" /> {label}
    </div>
    <Input value={value} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} type={type} className="h-8 text-sm" />
  </div>
);

const EditSelectField = ({ icon: Icon, label, field, placeholder, value, onChange, options }: EditFieldProps & { options: DropdownOption[] }) => {
  const hasMatchingOption = options.some(o => o.value === value);
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
      <div className="flex items-center gap-2 text-sm text-[var(--gm-text-tertiary)]">
        <Icon className="w-4 h-4 text-[var(--gm-accent-primary)]" /> {label}
      </div>
      {options.length > 0 ? (
        <Select value={hasMatchingOption ? value : undefined} onValueChange={v => onChange(field, v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={value || placeholder} /></SelectTrigger>
          <SelectContent>
            {!hasMatchingOption && value && <SelectItem value={value}>{value}</SelectItem>}
            {options.map(o => <SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input value={value} onChange={e => onChange(field, e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
      )}
    </div>
  );
};

export default function ContactDetail({ contact, onBack, onEdit, onDelete, onUpdateProjects }: ContactDetailProps) {
  const [activeTab, setActiveTab] = useState<ContactTab>('info');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadedContactId = useRef<string | null>(null);

  const [editForm, setEditForm] = useState({
    name: '', role: '', organization: '', email: '', phone: '',
    linkedin: '', department: '', location: '', timezone: '', notes: '',
  });

  const [roleOptions, setRoleOptions] = useState<DropdownOption[]>([]);
  const [companyOptions, setCompanyOptions] = useState<DropdownOption[]>([]);
  const [timezoneOptions, setTimezoneOptions] = useState<DropdownOption[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [primaryProjectId, setPrimaryProjectId] = useState<string | null>(null);
  const [relations, setRelations] = useState<ContactRelationship[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [mentions, setMentions] = useState<ContactMention[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  const enrichContact = useEnrichContact();
  const deleteRelationship = useDeleteRelationship();
  const unlinkParticipant = useUnlinkParticipant();

  const [showAddRelation, setShowAddRelation] = useState(false);
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelType, setNewRelType] = useState('works_with');
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [contactAvatarUrl, setContactAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (loadedContactId.current === contact.id) return;
    loadedContactId.current = contact.id;
    setIsEditing(false);
    setActiveTab('info');
    setConfirmDelete(false);
    setContactAvatarUrl(resolveAvatarUrl(contact as any));
    loadData();
    loadDropdownMetadata();
  }, [contact.id]);

  useEffect(() => {
    setContactAvatarUrl(resolveAvatarUrl(contact as any));
  }, [contact]);

  const loadDropdownMetadata = useCallback(async () => {
    try {
      const [rolesData, timezonesData, companiesData] = await Promise.all([
        apiClient.get<any>('/api/role-templates').catch(() => ({ roles: [] })),
        apiClient.get<any>('/api/timezones').catch(() => ({ timezones: [] })),
        apiClient.get<any>('/api/contacts/metadata/companies').catch(() => ({ companies: [] })),
      ]);
      setRoleOptions((rolesData.roles || []).filter((r: any) => r && (r.name || r.display_name)).map((r: any) => ({
        id: r.id || r.name, label: r.display_name || r.name, value: r.display_name || r.name,
      })));
      setTimezoneOptions((timezonesData.timezones || []).filter((t: any) => t && t.name).map((t: any) => ({
        id: t.id || t.code || t.name, label: `${t.name} (${t.code || ''})`, value: t.code || t.name,
      })));
      setCompanyOptions((companiesData.companies || []).filter((c: any) => c && c.name).map((c: any) => ({
        id: c.id || c.name, label: c.name, value: c.name,
      })));
    } catch (err) {
      console.error('Failed to load dropdown metadata', err);
    }
  }, []);

  const enterEditMode = useCallback(() => {
    setEditForm({
      name: contact.name || '', role: contact.role || '', organization: contact.organization || '',
      email: contact.email || '', phone: contact.phone || '', linkedin: contact.linkedin || '',
      department: contact.department || '', location: contact.location || '',
      timezone: contact.timezone || '', notes: contact.notes || '',
    });
    setIsEditing(true);
    setActiveTab('info');
  }, [contact]);

  const handleSaveInline = useCallback(async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const resp = await apiClient.put<any>(`/api/contacts/${contact.id}`, editForm);
      if (resp.ok === false) { toast.error(resp.error || 'Failed to save contact'); return; }
      toast.success('Contact updated');
      setIsEditing(false);
      loadedContactId.current = null;
      loadData();
      loadDropdownMetadata();
      onEdit({ ...contact, ...editForm });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }, [contact, editForm, onEdit, loadDropdownMetadata]);

  const updateField = (field: string, value: string) =>
    setEditForm(prev => ({ ...prev, [field]: value }));

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, assignedData, relsData, activityData] = await Promise.all([
        apiClient.get<any>('/api/projects').catch(() => ({ projects: [] })),
        apiClient.get<any>(`/api/contacts/${contact.id}/projects`).catch(() => ({ projects: [] })),
        apiClient.get<any>(`/api/contacts/${contact.id}/relationships`).catch(() => ({ relationships: [] })),
        apiClient.get<any>(`/api/contacts/${contact.id}/activity`).catch(() => ({ activities: [] })),
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : (projectsData.projects || []));
      const assigned = assignedData.projects || [];
      const assignedIds = assigned.map((p: any) => p.id);
      setAssignedProjectIds(assignedIds);
      const primary = assigned.find((p: any) => p.is_primary);
      setPrimaryProjectId(primary ? primary.id : (assignedIds[0] || null));
      setRelations(relsData.relationships || []);
      setActivity(activityData.activities || []);
      try { const mentionsData = await apiClient.get<any>(`/api/contacts/${contact.id}/mentions`); setMentions(mentionsData.mentions || []); } catch { setMentions([]); }
      try { const contactsResp = await apiClient.get<any>('/api/contacts'); setAllContacts((contactsResp.contacts || []).filter((c: Contact) => c.id !== contact.id)); } catch { setAllContacts([]); }
    } catch (err) {
      console.error('Error loading contact details:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = async (projectId: string) => {
    const isAssigned = assignedProjectIds.includes(projectId);
    try {
      if (isAssigned) {
        await apiClient.delete(`/api/contacts/${contact.id}/projects/${projectId}`);
        const newIds = assignedProjectIds.filter(id => id !== projectId);
        const newPrimary = primaryProjectId === projectId ? null : primaryProjectId;
        setAssignedProjectIds(newIds);
        setPrimaryProjectId(newPrimary);
        onUpdateProjects?.(contact.id, newIds, newPrimary);
      } else {
        await apiClient.post(`/api/contacts/${contact.id}/projects`, { projectId });
        const newIds = [...assignedProjectIds, projectId];
        const newPrimary = primaryProjectId || projectId;
        setAssignedProjectIds(newIds);
        setPrimaryProjectId(newPrimary);
        onUpdateProjects?.(contact.id, newIds, newPrimary);
      }
    } catch (err) {
      console.error('Error toggling project:', err);
    }
  };

  const setPrimary = async (projectId: string) => {
    try {
      await apiClient.post(`/api/contacts/${contact.id}/projects`, { projectId, isPrimary: true });
      if (!assignedProjectIds.includes(projectId)) {
        setAssignedProjectIds(prev => [...prev, projectId]);
      }
      setPrimaryProjectId(projectId);
    } catch (err) {
      console.error('Error setting primary project', err);
    }
  };

  const handleAddRelationship = async () => {
    if (!newRelTarget) return;
    try {
      const targetContact = allContacts.find(c => c.id === newRelTarget);
      if (!targetContact) return;
      const response = await apiClient.post<{ relationship: ContactRelationship }>(`/api/contacts/${contact.id}/relationships`, {
        toContactId: targetContact.id, type: newRelType,
      });
      const newRel = response.relationship;
      setRelations(prev => [...prev, {
        id: newRel.id, type: newRelType, direction: 'forward',
        other_contact: { id: targetContact.id, name: targetContact.name, role: targetContact.role, avatarUrl: targetContact.avatarUrl },
      } as ContactRelationship]);
      setNewRelTarget('');
      setShowAddRelation(false);
    } catch (err) {
      console.error('Error adding relationship:', err);
    }
  };

  const tabCounts: Record<ContactTab, number | undefined> = {
    info: undefined,
    projects: assignedProjectIds.length,
    relations: relations.length,
    mentions: mentions.length,
    activity: activity.length > 0 ? activity.length : undefined,
  };

  return (
    <div className="p-6 space-y-4">
      {/* Back link */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors mb-2">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Contacts
      </button>

      {/* Header */}
      <div className={CARD}>
        <div className={`bg-gradient-to-r ${getGradient(contact.name)} p-6 pb-14 rounded-t-xl relative`}>
          <div className="flex gap-2 absolute top-4 right-4">
            <button className={BTN_SECONDARY + ' !bg-white/20 !text-white !border-0 hover:!bg-white/30 backdrop-blur-sm'}
              disabled={enrichContact.isPending}
              onClick={() => {
                enrichContact.mutate(contact.id, {
                  onSuccess: (data: any) => {
                    toast.success('AI enrichment complete');
                    if (data?.suggestions) {
                      const s = data.suggestions;
                      const fields: string[] = [];
                      if (s.role) fields.push(`Role: ${s.role}`);
                      if (s.department) fields.push(`Dept: ${s.department}`);
                      if (s.tags) fields.push(`Tags: ${(s.tags as string[]).join(', ')}`);
                      if (fields.length) toast.info(fields.join(' | '));
                    }
                    loadedContactId.current = null;
                    loadData();
                  },
                  onError: () => toast.error('Enrichment failed'),
                });
              }}>
              {enrichContact.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Enrich AI
            </button>
            <button className={BTN_SECONDARY + ' !bg-white/20 !text-white !border-0 hover:!bg-white/30 backdrop-blur-sm'}
              disabled={unlinkParticipant.isPending}
              onClick={() => {
                const name = contact.display_name || contact.name || '';
                if (!name) { toast.error('No participant name to unlink'); return; }
                unlinkParticipant.mutate(name, {
                  onSuccess: () => toast.success(`Unlinked participant "${name}"`),
                  onError: () => toast.error('Unlink failed'),
                });
              }}>
              {unlinkParticipant.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />} Unlink
            </button>
            <button
              className={BTN_SECONDARY + ` !border-0 backdrop-blur-sm ${isEditing ? '!bg-blue-500/40 !text-white hover:!bg-blue-500/50' : '!bg-white/20 !text-white hover:!bg-white/30'}`}
              onClick={isEditing ? () => setIsEditing(false) : enterEditMode}>
              <Pencil className="w-3.5 h-3.5" /> {isEditing ? 'View' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="px-6 -mt-10 relative z-10">
          <div className="flex items-end gap-4">
            <AvatarUpload
              currentUrl={contactAvatarUrl} name={contact.name}
              uploadEndpoint={`/api/contacts/${contact.id}/avatar`}
              deleteEndpoint={`/api/contacts/${contact.id}/avatar`}
              onUploaded={(url) => setContactAvatarUrl(url)}
              onRemoved={() => setContactAvatarUrl(null)}
              size="md" showUrlInput={false} className="!gap-0"
            />
            <div className="pb-1">
              <h2 className="text-xl font-bold text-white">{isEditing ? (editForm.name || contact.name) : contact.name || '(unnamed)'}</h2>
              <p className="text-sm text-slate-300">
                {(isEditing ? editForm.role : contact.role) || '—'}
                {(isEditing ? editForm.organization : contact.organization) && ` · ${isEditing ? editForm.organization : contact.organization}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--gm-border-primary)] overflow-x-auto mt-4 px-6">
          {contactTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
                ? 'text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]'
                : 'text-[var(--gm-text-tertiary)] border-transparent hover:text-[var(--gm-text-primary)]'}`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tabCounts[tab.id] !== undefined && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gm-accent-primary)]/10 text-[var(--gm-accent-primary)] font-semibold">
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--gm-accent-primary)]" />
          </div>
        )}

        {/* Tab content */}
        {!loading && (
          <div className="p-6">
            {/* Info Tab */}
            {activeTab === 'info' && (
              <>
                {isEditing ? (
                  <div className="space-y-3">
                    <EditInputField icon={User} label="Name *" field="name" placeholder="Full name" value={editForm.name} onChange={updateField} />
                    <EditSelectField icon={Briefcase} label="Role" field="role" options={roleOptions} placeholder="Select role..." value={editForm.role} onChange={updateField} />
                    <EditInputField icon={Mail} label="Email" field="email" placeholder="email@example.com" type="email" value={editForm.email} onChange={updateField} />
                    <EditInputField icon={Phone} label="Phone" field="phone" placeholder="+351 900 000 000" type="tel" value={editForm.phone} onChange={updateField} />
                    <EditSelectField icon={Building2} label="Organization" field="organization" options={companyOptions} placeholder="Select organization..." value={editForm.organization} onChange={updateField} />
                    <EditInputField icon={Linkedin} label="LinkedIn" field="linkedin" placeholder="https://linkedin.com/in/..." value={editForm.linkedin} onChange={updateField} />
                    <EditInputField icon={Briefcase} label="Department" field="department" placeholder="Engineering, Sales..." value={editForm.department} onChange={updateField} />
                    <EditInputField icon={MapPin} label="Location" field="location" placeholder="Lisbon, Portugal" value={editForm.location} onChange={updateField} />
                    <EditSelectField icon={Globe} label="Timezone" field="timezone" options={timezoneOptions} placeholder="Select timezone..." value={editForm.timezone} onChange={updateField} />
                    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
                      <div className="flex items-center gap-2 text-sm text-[var(--gm-text-tertiary)] pt-1.5">
                        <StickyNote className="w-4 h-4 text-[var(--gm-accent-primary)]" /> Notes
                      </div>
                      <textarea value={editForm.notes} onChange={e => updateField('notes', e.target.value)}
                        placeholder="Additional notes..." rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                    </div>
                    <div className="flex justify-end gap-2 pt-3">
                      <button className={BTN_SECONDARY} onClick={() => setIsEditing(false)}>Cancel</button>
                      <button className={BTN_PRIMARY} disabled={saving || !editForm.name.trim()} onClick={handleSaveInline}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <InfoRow icon={User} label="Name" value={contact.name} />
                    <InfoRow icon={Briefcase} label="Role" value={contact.role} />
                    <InfoRow icon={Mail} label="Email" value={contact.email} />
                    <InfoRow icon={Phone} label="Phone" value={contact.phone} />
                    <InfoRow icon={Building2} label="Organization" value={contact.organization} />
                    <InfoRow icon={Linkedin} label="LinkedIn" value={contact.linkedin} />
                    <InfoRow icon={Briefcase} label="Department" value={contact.department} />
                    <InfoRow icon={MapPin} label="Location" value={contact.location} />
                    <InfoRow icon={Globe} label="Timezone" value={contact.timezone} />
                    {contact.aliases && contact.aliases.length > 0 && (
                      <div className="grid grid-cols-[140px_1fr] gap-3 py-3 border-b border-[var(--gm-border-primary)] last:border-0">
                        <div className="flex items-center gap-2 text-sm text-[var(--gm-text-tertiary)]">
                          <User className="w-4 h-4 text-[var(--gm-accent-primary)]" /> Aliases
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {contact.aliases.map(a => (
                            <span key={a} className="text-xs px-1.5 py-0.5 bg-[var(--gm-bg-tertiary)] rounded text-[var(--gm-text-tertiary)]">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.notes && <InfoRow icon={StickyNote} label="Notes" value={contact.notes} />}
                  </div>
                )}
              </>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-1">
                {projects.map((p) => {
                  const isAssigned = assignedProjectIds.includes(p.id);
                  const isPrimary = primaryProjectId === p.id;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-3 border-b border-[var(--gm-border-primary)] last:border-0 hover:bg-[var(--gm-surface-hover)] px-2 rounded">
                      <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleProject(p.id)}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isAssigned ? 'border-[var(--gm-accent-primary)] bg-[var(--gm-interactive-primary)]' : 'border-[var(--gm-border-primary)] hover:border-[var(--gm-text-tertiary)]'}`}>
                          {isAssigned && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-sm ${isAssigned ? 'text-[var(--gm-text-primary)]' : 'text-[var(--gm-text-tertiary)]'}`}>{p.name}</span>
                          {p.description && <span className="text-[10px] text-[var(--gm-text-tertiary)] truncate max-w-[300px]">{p.description}</span>}
                        </div>
                      </div>
                      {isPrimary ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] font-semibold">Primary</span>
                      ) : isAssigned ? (
                        <button onClick={(e) => { e.stopPropagation(); setPrimary(p.id); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] transition-colors">
                          Set Primary
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Relations Tab */}
            {activeTab === 'relations' && (
              <>
                {relations.length > 0 ? (
                  <div className="space-y-2">
                    {relations.map((r, i) => {
                      const label = (r.type || '').replace('_', ' ');
                      const otherName = r.other_contact?.name || 'Unknown';
                      return (
                        <div key={i} className="flex items-center gap-3 py-3 border-b border-[var(--gm-border-primary)] last:border-0 group/rel">
                          <Users2 className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
                          <div className="flex-1 flex items-center gap-2 text-sm">
                            <span className="font-medium text-[var(--gm-text-primary)]">{contact.name}</span>
                            <span className="text-[var(--gm-text-tertiary)] text-xs px-1 bg-[var(--gm-bg-tertiary)] rounded">{label}</span>
                            <span className="font-medium text-[var(--gm-text-primary)]">{otherName}</span>
                          </div>
                          <button className="opacity-0 group-hover/rel:opacity-100 transition-opacity text-red-400/60 hover:text-red-400"
                            title="Remove relationship"
                            onClick={() => {
                              if (!r.other_contact?.id) return;
                              deleteRelationship.mutate(
                                { contactId: contact.id, toContactId: r.other_contact.id, type: r.type },
                                {
                                  onSuccess: () => { setRelations(prev => prev.filter((_, idx) => idx !== i)); toast.success('Relationship removed'); },
                                  onError: () => toast.error('Failed to remove relationship'),
                                },
                              );
                            }}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-[var(--gm-text-tertiary)]">
                    <Users2 className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">No relationships yet</p>
                  </div>
                )}

                {showAddRelation ? (
                  <div className="mt-3 p-3 rounded-lg border border-[var(--gm-border-primary)] bg-[var(--gm-bg-tertiary)] space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newRelTarget} onValueChange={setNewRelTarget}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Select contact" /></SelectTrigger>
                        <SelectContent>{allContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={newRelType} onValueChange={setNewRelType}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reports_to">Reports to</SelectItem>
                          <SelectItem value="manages">Manages</SelectItem>
                          <SelectItem value="leads">Leads</SelectItem>
                          <SelectItem value="works_with">Works with</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <button className={BTN_SECONDARY + ' flex-1'} onClick={() => { setShowAddRelation(false); setNewRelTarget(''); }}>Cancel</button>
                      <button className={BTN_PRIMARY + ' flex-1'} disabled={!newRelTarget} onClick={handleAddRelationship}>Add</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddRelation(true)} className="flex items-center gap-1.5 text-sm text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)] mt-4 transition-colors">
                    <Plus className="w-4 h-4" /> Add Relationship
                  </button>
                )}
              </>
            )}

            {/* Mentions Tab */}
            {activeTab === 'mentions' && (
              <>
                {mentions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex gap-2 pb-2 overflow-x-auto">
                      {['all', 'document', 'email', 'conversation'].map(type => (
                        <button key={type} onClick={() => setMentionFilter(type === 'all' ? null : type)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${(mentionFilter === type || (mentionFilter === null && type === 'all'))
                            ? 'bg-[var(--gm-accent-primary)]/10 text-[var(--gm-accent-primary)] border-[var(--gm-accent-primary)]/20'
                            : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] border-transparent hover:bg-[var(--gm-surface-hover)] hover:text-[var(--gm-text-primary)]'}`}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}s
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2 pr-2">
                      {mentions.filter(m => !mentionFilter || m.type === mentionFilter).map((mention) => (
                        <div key={mention.id} className="flex gap-3 py-3 border-b border-[var(--gm-border-primary)] last:border-0 group">
                          <div className="mt-0.5">
                            {mention.type === 'email' ? <Mail className="w-3.5 h-3.5 text-blue-400" /> :
                              mention.type === 'conversation' ? <MessageSquare className="w-3.5 h-3.5 text-violet-400" /> :
                                <FileText className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-medium text-[var(--gm-text-tertiary)] uppercase tracking-wider">{mention.source || '—'}</span>
                              <span className="text-[10px] text-[var(--gm-text-tertiary)] whitespace-nowrap ml-2">
                                {mention.date ? new Date(mention.date).toLocaleDateString() : '—'}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--gm-text-primary)] line-clamp-2 bg-[var(--gm-bg-tertiary)] p-2 rounded border border-[var(--gm-border-primary)] italic">
                              "{mention.text}"
                            </p>
                            {mention.link && (
                              <a href={mention.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-[var(--gm-accent-primary)] hover:underline inline-flex items-center gap-1 mt-1 font-medium transition-colors">
                                View Context <ArrowRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {mentions.filter(m => !mentionFilter || m.type === mentionFilter).length === 0 && (
                        <p className="text-center text-sm text-[var(--gm-text-tertiary)] py-8">No mentions found for this filter</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-[var(--gm-text-tertiary)]">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">No mentions found</p>
                  </div>
                )}
              </>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <>
                {activity.length > 0 ? (
                  <div className="space-y-2">
                    {activity.map((item) => (
                      <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-3 border-b border-[var(--gm-border-primary)] last:border-0">
                        {item.status === 'completed' || item.status === 'approved' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : item.status === 'overdue' || item.status === 'rejected' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-[var(--gm-text-tertiary)] shrink-0" />
                        )}
                        <span className="text-sm text-[var(--gm-text-primary)] flex-1 truncate">{item.description}</span>
                        <span className="text-[10px] text-[var(--gm-text-tertiary)] shrink-0">
                          {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-[var(--gm-text-tertiary)]">
                    <Clock className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">No activity recorded yet</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer: Danger Zone */}
        <div className="px-6 py-4 border-t border-[var(--gm-border-primary)]">
          <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
            <p className="text-xs font-semibold text-red-500 mb-1">Danger Zone</p>
            <p className="text-xs text-[var(--gm-text-tertiary)] mb-3">Deleting this contact will remove all associated data.</p>
            {!confirmDelete ? (
              <button className={BTN_DANGER.replace('bg-[var(--color-danger-500)]', 'bg-red-500/10').replace('text-white', 'text-red-500') + ' border border-red-500/30'}
                onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete Contact
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button className={BTN_DANGER} disabled={deleting} onClick={() => { setDeleting(true); onDelete(contact.id); }}>
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Confirm Delete
                </button>
                <button className={BTN_SECONDARY} onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className={CARD}>
        <CommentsPanel targetType="contact" targetId={contact.id} />
      </div>
    </div>
  );
}
