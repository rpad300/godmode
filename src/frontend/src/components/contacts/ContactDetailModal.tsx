import { useState, useEffect } from 'react';
import { User, FolderOpen, Users2, Clock, Building2, Mail, Phone, Linkedin, MapPin, Globe, Briefcase, StickyNote, CheckCircle2, AlertTriangle, Plus, Trash2, Sparkles, ArrowRight, ArrowLeft, MessageSquare, FileText, FileAudio } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import type { Contact, ContactRelationship, Project, ContactMention } from '@/types/godmode';

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const avatarGradients = [
  'from-rose-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-blue-400 to-cyan-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-fuchsia-400 to-pink-500',
];

const getGradient = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
};

interface ContactDetailModalProps {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
  onUpdateProjects?: (contactId: string, projectIds: string[], primaryProjectId: string | null) => void;
}

const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4 text-destructive/70" /> {label}
      </div>
      <p className="text-sm text-foreground break-all">{value}</p>
    </div>
  );
};

const ContactDetailModal = ({ contact, open, onClose, onEdit, onDelete, onUpdateProjects }: ContactDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [primaryProjectId, setPrimaryProjectId] = useState<string | null>(null);

  const [relations, setRelations] = useState<ContactRelationship[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [mentions, setMentions] = useState<ContactMention[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  // UI State
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelType, setNewRelType] = useState('works_with');
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);

  useEffect(() => {
    if (contact && open) {
      loadData();
    }
  }, [contact, open]);

  const loadData = async () => {
    if (!contact) return;
    setLoading(true);
    try {
      // 1. Projects (all available)
      // The API returns the list directly or wrapped? Usually wrapped for list endpoints, but let's check apiClient implementation or assume consistency with routes
      // /api/projects -> usually returns { projects: [...] } or just [...]
      // Looking at Contact routes, they return { projects: [...] }. Assuming /api/projects is similar.
      // If /api/projects returns array directly (legacy), try that.
      // Let's assume standardized response { ok: true, projects: [] } based on other routes seen.
      // But verify_endpoints or similar might be needed if I'm unsure.
      // Wait, handleProjects in routes.js usually follows the pattern.
      // Safest to handle both or expect standard wrapper.
      // Contact routes used `jsonResponse(res, { ok: true, projects })`.

      const projectsData = await apiClient.get<any>('/api/projects');
      setProjects(Array.isArray(projectsData) ? projectsData : (projectsData.projects || []));

      // 2. Assigned Projects
      const assignedData = await apiClient.get<{ projects: any[] }>(`/api/contacts/${contact.id}/projects`);
      const assigned = assignedData.projects || [];
      const assignedIds = assigned.map((p: any) => p.id); // Note: Route maps internal project_id to id
      setAssignedProjectIds(assignedIds);
      const primary = assigned.find((p: any) => p.is_primary);
      setPrimaryProjectId(primary ? primary.id : (assignedIds[0] || null));

      // 3. Relationships
      const relsData = await apiClient.get<{ relationships: ContactRelationship[] }>(`/api/contacts/${contact.id}/relationships`);
      setRelations(relsData.relationships || []);

      // 4. Activity
      const activityData = await apiClient.get<{ activities: any[] }>(`/api/contacts/${contact.id}/activity`);
      setActivity(activityData.activities || []);

      // 5. Mentions
      try {
        const mentionsData = await apiClient.get<{ mentions: ContactMention[] }>(`/api/contacts/${contact.id}/mentions`);
        setMentions(mentionsData.mentions || []);
      } catch (e) {
        console.error("Error loading mentions", e);
      }

      // 6. Contacts for dropdown
      const contactsResp = await apiClient.get<{ contacts: Contact[] }>('/api/contacts');
      const contactsList = contactsResp.contacts || [];
      setAllContacts(contactsList.filter((c: Contact) => c.id !== contact.id));

    } catch (err) {
      console.error("Error loading contact details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!contact) return null;

  const toggleProject = async (projectId: string) => {
    const isAssigned = assignedProjectIds.includes(projectId);
    try {
      if (isAssigned) {
        await apiClient.delete(`/api/contacts/${contact.id}/projects/${projectId}`);
        setAssignedProjectIds(prev => prev.filter(id => id !== projectId));
        if (primaryProjectId === projectId) setPrimaryProjectId(null);
      } else {
        await apiClient.post(`/api/contacts/${contact.id}/projects`, { projectId });
        setAssignedProjectIds(prev => [...prev, projectId]);
        if (!primaryProjectId) setPrimaryProjectId(projectId);
      }
      onUpdateProjects?.(contact.id, assignedProjectIds, primaryProjectId);
    } catch (err) {
      console.error("Error toggling project:", err);
    }
  };

  const setPrimary = async (projectId: string) => {
    try {
      // First ensure it's assigned
      if (!assignedProjectIds.includes(projectId)) {
        await apiClient.post(`/api/contacts/${contact.id}/projects`, { projectId, isPrimary: true });
        setAssignedProjectIds(prev => [...prev, projectId]);
      } else {
        // Update existing to primary (implies backend logic to unset others, or just marking this one)
        await apiClient.post(`/api/contacts/${contact.id}/projects`, { projectId, isPrimary: true });
      }
      setPrimaryProjectId(projectId);
    } catch (err) {
      console.error("Error setting primary project", err);
    }
  };

  const handleAddRelationship = async () => {
    if (!newRelTarget) return;
    try {
      const targetContact = allContacts.find(c => c.id === newRelTarget);
      if (!targetContact) return;

      const response = await apiClient.post<{ relationship: ContactRelationship }>(`/api/contacts/${contact.id}/relationships`, {
        toContactId: targetContact.id,
        type: newRelType
      });

      const newRel = response.relationship;

      // Optimistic update (or use backend response if complete)
      setRelations(prev => [...prev, {
        id: newRel.id,
        type: newRelType,
        direction: 'forward',
        other_contact: {
          id: targetContact.id,
          name: targetContact.name,
          role: targetContact.role,
          avatarUrl: targetContact.avatarUrl
        }
      } as ContactRelationship]);

      setNewRelTarget('');
      setShowAddRelation(false);
    } catch (err) {
      console.error("Error adding relationship:", err);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Contact Details</DialogTitle>
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${getGradient(contact.name)} p-6 pb-12 relative`}>
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors">
            <span className="sr-only">Close</span>
          </button>
          <Button variant="secondary" size="sm" className="absolute top-4 right-4 gap-1.5 bg-white/20 text-white border-0 hover:bg-white/30 backdrop-blur-sm" onClick={() => onEdit(contact)}>
            <Sparkles className="w-3.5 h-3.5" /> Edit Contact
          </Button>
        </div>

        {/* Avatar + Name overlapping header */}
        <div className="px-6 -mt-10 relative z-10">
          <div className="flex items-end gap-4">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getGradient(contact.name)} flex items-center justify-center shadow-lg border-4 border-background`}>
              {contact.avatarUrl || contact.avatar ? (
                <img src={contact.avatarUrl || contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-white">{getInitials(contact.name)}</span>
              )}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-foreground">{contact.name}</h2>
              <p className="text-sm text-muted-foreground">{contact.role}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
              {[
                { id: 'info', label: 'Info', icon: User, count: undefined },
                { id: 'projects', label: 'Projects', icon: FolderOpen, count: assignedProjectIds.length },
                { id: 'relations', label: 'Relations', icon: Users2, count: relations.length },
                { id: 'mentions', label: 'Mentions', icon: MessageSquare, count: mentions.length },
                { id: 'activity', label: 'Activity', icon: Clock, count: activity.length > 0 ? activity.length : undefined },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:text-destructive data-[state=active]:shadow-none bg-transparent px-4 py-2.5 text-sm gap-1.5"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="mt-4 pb-0">
              <div className="divide-y divide-border">
                <InfoRow icon={User} label="Name *" value={contact.name} />
                <InfoRow icon={Briefcase} label="Role" value={contact.role} />
                <InfoRow icon={Mail} label="Email" value={contact.email} />
                <InfoRow icon={Phone} label="Phone" value={contact.phone} />
                <InfoRow icon={Building2} label="Organization" value={contact.organization} />
                <InfoRow icon={Linkedin} label="LinkedIn" value={contact.linkedin} />
                <InfoRow icon={Briefcase} label="Department" value={contact.department} />
                <InfoRow icon={MapPin} label="Location" value={contact.location} />
                <InfoRow icon={Globe} label="Timezone" value={contact.timezone} />
                {contact.aliases && contact.aliases.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4 text-destructive/70" /> Aliases
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {contact.aliases.map(a => (
                        <span key={a} className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {contact.notes && <InfoRow icon={StickyNote} label="Notes" value={contact.notes} />}
              </div>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="mt-4 pb-0">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {projects.map((p) => {
                  const isAssigned = assignedProjectIds.includes(p.id);
                  const isPrimary = primaryProjectId === p.id;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-secondary/10 px-2 rounded">
                      <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleProject(p.id)}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isAssigned ? 'border-primary bg-primary' : 'border-border hover:border-muted-foreground'}`}>
                          {isAssigned && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-sm ${isAssigned ? 'text-foreground' : 'text-muted-foreground'}`}>{p.name}</span>
                          {p.description && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.description}</span>}
                        </div>
                      </div>
                      {isPrimary ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground font-semibold">Primary</span>
                      ) : isAssigned ? (
                        <button onClick={(e) => { e.stopPropagation(); setPrimary(p.id); }} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          Set Primary
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Relations Tab */}
            <TabsContent value="relations" className="mt-4 pb-0">
              {relations.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {relations.map((r, i) => {
                    const label = (r.type || '').replace('_', ' ');
                    const otherName = r.other_contact?.name || 'Unknown';
                    const Icon = r.direction === 'forward' ? ArrowRight : ArrowLeft;

                    return (
                      <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <Users2 className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 flex items-center gap-2 text-sm">
                          <span className="font-medium text-foreground">{contact.name}</span>
                          <span className="text-muted-foreground text-xs px-1 bg-secondary rounded">{label}</span>
                          <span className="font-medium text-foreground">{otherName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Users2 className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">No relationships yet</p>
                </div>
              )}

              {showAddRelation ? (
                <div className="mt-3 p-3 rounded-lg border border-border bg-secondary/30 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newRelTarget} onValueChange={setNewRelTarget}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {allContacts.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newRelType} onValueChange={setNewRelType}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reports_to">Reports to</SelectItem>
                        <SelectItem value="manages">Manages</SelectItem>
                        <SelectItem value="leads">Leads</SelectItem>
                        <SelectItem value="works_with">Works with</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowAddRelation(false); setNewRelTarget(''); }}>
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" disabled={!newRelTarget} onClick={handleAddRelationship}>
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddRelation(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors">
                  <Plus className="w-4 h-4" /> Add Relationship
                </button>
              )}
            </TabsContent>

            {/* Mentions Tab */}
            <TabsContent value="mentions" className="mt-4 pb-0">
              {mentions.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-2 pb-2 overflow-x-auto">
                    {['all', 'document', 'email', 'conversation'].map(type => (
                      <button
                        key={type}
                        onClick={() => setMentionFilter(type === 'all' ? null : type)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${(mentionFilter === type || (mentionFilter === null && type === 'all'))
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
                          }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}s
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {mentions
                      .filter(m => !mentionFilter || m.type === mentionFilter)
                      .map((mention) => (
                        <div key={mention.id} className="flex gap-3 py-3 border-b border-border last:border-0 group">
                          <div className="mt-0.5">
                            {mention.type === 'email' ? <Mail className="w-3.5 h-3.5 text-blue-400" /> :
                              mention.type === 'conversation' ? <MessageSquare className="w-3.5 h-3.5 text-violet-400" /> :
                                <FileText className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{mention.source}</span>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                {new Date(mention.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-foreground line-clamp-2 bg-secondary/20 p-2 rounded border border-border/50 italic">
                              "{mention.text}"
                            </p>
                            {mention.link && (
                              <a href={mention.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 font-medium transition-colors">
                                View Context <ArrowRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    {mentions.filter(m => !mentionFilter || m.type === mentionFilter).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">No mentions found for this filter</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">No mentions found</p>
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4 pb-0">
              {activity.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activity.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                      {item.status === 'completed' || item.status === 'approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : item.status === 'overdue' || item.status === 'rejected' ? (
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm text-foreground flex-1 truncate">{item.description}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Clock className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">No activity recorded yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-4">
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5" onClick={() => onDelete(contact.id)}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="gap-1.5 bg-destructive hover:bg-destructive/90" onClick={() => onEdit(contact)}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactDetailModal;
