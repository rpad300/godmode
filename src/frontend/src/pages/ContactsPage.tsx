<<<<<<< HEAD
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Mail, Building2, UsersRound, GitBranch, Search, Plus, Loader2, FileText } from 'lucide-react';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '@/hooks/useGodMode';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ContactForm from '@/components/contacts/ContactForm';
import ContactDetailModal from '@/components/contacts/ContactDetailModal';
import type { Contact } from '@/types/godmode';

type SubTab = 'contacts' | 'teams' | 'org';

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

const ContactsPage = () => {
  const [subtab, setSubtab] = useState<SubTab>('contacts');
  const [search, setSearch] = useState('');

  const { data: contactsData, isLoading } = useContacts();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const contacts = contactsData || [];

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.role.toLowerCase().includes(search.toLowerCase()) ||
    c.organization.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddContact = (data: Omit<Contact, 'id' | 'mentionCount'>) => {
    // Optimistic update handled by React Query invalidation
    createContact.mutate(data, {
      onSuccess: () => setShowAddModal(false)
    });
  };

  const handleEditContact = (data: Omit<Contact, 'id' | 'mentionCount'>) => {
    if (!editingContact) return;
    const updated = { ...editingContact, ...data };
    updateContact.mutate(updated, {
      onSuccess: () => {
        setSelectedContact(updated);
        setEditingContact(null);
      }
    });
  };

  const handleDeleteContact = (contactId: string) => {
    deleteContact.mutate(contactId, {
      onSuccess: () => setSelectedContact(null)
    });
  };

  const teams = [
    { name: 'Engineering', members: ['João Silva', 'Ana Rodrigues', 'Carlos Mendes', 'Pedro Santos'], lead: 'João Silva' },
    { name: 'Product', members: ['Maria Costa', 'Sofia Almeida'], lead: 'Maria Costa' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-secondary rounded-xl p-1">
            {([
              { id: 'contacts' as SubTab, label: 'Contacts', icon: UsersIcon },
              { id: 'teams' as SubTab, label: 'Teams', icon: UsersRound },
              { id: 'org' as SubTab, label: 'Org Chart', icon: GitBranch },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubtab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${subtab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Contacts tab */}
      {subtab === 'contacts' && (
        <>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map((contact, i) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedContact(contact)}
                    className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col items-center text-center cursor-pointer"
                  >
                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getGradient(contact.name)} flex items-center justify-center mb-4 shadow-md group-hover:scale-105 transition-transform overflow-hidden border-4 border-transparent`}>
                      {contact.avatarUrl || contact.avatar ? (
                        <img src={contact.avatarUrl || contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-white">{getInitials(contact.name)}</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{contact.name}</h3>
                    <span className="inline-block px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold mb-4">
                      {contact.role}
                    </span>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                      <Building2 className="w-3.5 h-3.5" /><span>{contact.organization}</span>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" /><span>{contact.email}</span>
                      </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-border w-full flex items-center justify-center">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${contact.mentionCount ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                        <FileText className="w-3.5 h-3.5" />
                        <span>{contact.mentionCount || 0} mentions</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Teams tab */}
      {subtab === 'teams' && (
        <TeamsTabContent />
      )}

      {/* Org Chart tab */}
      {subtab === 'org' && (
        <OrgChartTabContent />
      )}

      {/* Contact Detail Modal (tabbed) */}
      <ContactDetailModal
        contact={selectedContact}
        open={!!selectedContact && !editingContact}
        onClose={() => setSelectedContact(null)}
        onEdit={(c) => setEditingContact(c)}
        onDelete={handleDeleteContact}
      />

      {/* Edit Contact Modal */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            contact={editingContact}
            mode="edit"
            onSubmit={handleEditContact}
            onCancel={() => setEditingContact(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            mode="add"
            onSubmit={handleAddContact}
            onCancel={() => setShowAddModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};


// New Imports for Dynamic functionality
import { useProject } from '@/contexts/ProjectContext';
import { apiClient } from '@/lib/api-client';
import { ShieldCheck } from 'lucide-react';
import type { Category } from '@/types/godmode';
import { useEffect } from 'react'; // Ensure useEffect is imported or available

// Interface for Project Members (simplified for display)
interface ProjectMember {
  user_id: string;
  display_name?: string;
  role: string;
  user_role?: string;
  avatar_url?: string;
  linked_contact?: {
    organization?: string;
    avatar_url?: string;
  };
}

const TeamsTabContent = () => {
  const { currentProject } = useProject();
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject?.id]);

  const fetchData = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [catsRes, memsRes] = await Promise.all([
        apiClient.get<Category[]>(`/api/projects/${currentProject.id}/categories`),
        apiClient.get<{ members: ProjectMember[] }>(`/api/projects/${currentProject.id}/members`)
      ]);
      setCategories(catsRes || []);
      setMembers(memsRes.members || []);
    } catch (err) {
      console.error('Failed to fetch team data', err);
    } finally {
      setLoading(false);
    }
  };

  const getTeamMembers = (category: Category) => {
    const catRoleNames = currentProject?.settings?.roles
      ?.filter(r => r.category === category.id)
      .map(r => r.name) || [];

    return members.filter(m => {
      const roleName = m.user_role || m.role;
      return catRoleNames.includes(roleName);
    });
  };

  if (!currentProject) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Please select a project to view teams.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category, i) => {
        const teamMembers = getTeamMembers(category);
        const leadId = currentProject.settings?.category_leads?.[category.id];
        const lead = members.find(m => m.user_id === leadId);

        return (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${category.color || 'blue'}-500/10 text-${category.color || 'blue'}-500`}>
                  <UsersRound className="w-5 h-5" />
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
=======
import { useContacts } from '../hooks/useGodMode';
import { Users } from 'lucide-react';

export default function ContactsPage() {
  const { data, isLoading } = useContacts();
  const contacts = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[hsl(var(--muted-foreground))]">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contacts</h1>

      {contacts.length === 0 ? (
        <div className="rounded-lg border bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
          No contacts found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact, i) => (
            <div key={String(contact.id ?? i)} className="rounded-lg border bg-[hsl(var(--card))] p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{String(contact.name ?? 'Unknown')}</div>
                  {contact.role && (
                    <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {String(contact.role)}
                    </div>
                  )}
                  {contact.email && (
                    <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {String(contact.email)}
                    </div>
>>>>>>> origin/claude/migrate-to-react-uJJbl
                  )}
                </div>
              </div>
            </div>
<<<<<<< HEAD

            {/* Members Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teamMembers.map((m) => {
                const isLead = leadId === m.user_id;
                return (
                  <div
                    key={m.user_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isLead ? 'bg-amber-500/5 border-amber-500/20' : 'bg-background border-border'
                      }`}
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
                      <h4 className="text-sm font-medium text-foreground truncate">{m.display_name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{m.user_role || m.role}</span>
                        {m.linked_contact?.organization && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground truncate max-w-[100px]">
                              {m.linked_contact.organization}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {teamMembers.length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-muted-foreground italic border border-dashed border-border/50 rounded-lg">
                  No members assigned to this team yet.
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};


const OrgChartTabContent = () => {
  const { currentProject } = useProject();
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject?.id]);

  const fetchData = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [catsRes, memsRes] = await Promise.all([
        apiClient.get<Category[]>(`/api/projects/${currentProject.id}/categories`),
        apiClient.get<{ members: ProjectMember[] }>(`/api/projects/${currentProject.id}/members`)
      ]);
      setCategories(catsRes || []);
      setMembers(memsRes.members || []);
    } catch (err) {
      console.error('Failed to fetch org chart data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentProject) {
    return <div className="text-center py-10 text-muted-foreground">Select a project</div>;
  }

  // --- Build Hierarchy ---
  // Root: Project Name
  // Level 2: Categories (Leads)
  // Level 3: Members

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-6 overflow-x-auto">
      <h3 className="text-base font-semibold text-foreground mb-6">Organization Chart</h3>

      <div className="flex flex-col items-center min-w-[600px] pb-8">
        {/* 1. Root Node (Project) */}
        <div className="flex flex-col items-center relative z-10">
          <div className="px-6 py-3 rounded-xl border-2 border-primary bg-primary/10 shadow-sm mb-4 min-w-[120px] text-center">
            <p className="text-sm font-bold text-primary">{currentProject.name}</p>
            <p className="text-[10px] text-muted-foreground">Project Root</p>
          </div>
          {/* Vertical line from Root down to Branch Horizontal Line */}
          <div className="w-px h-8 bg-border"></div>
        </div>

        {/* 2. Branches Container (Categories) */}
        <div className="flex items-start justify-center gap-12 relative pt-4">
          {/* Horizontal Connector Line */}
          {/* We need a line that spans from the first child center to the last child center. 
                        A simple way is a border-top on a container div, but width depends on children.
                        Let's use a pseudo-element logic or a simple absolute div if we know widths.
                        Alternatively, use a 'grid' or flex with specific connectors.
                        Simpler approach: A line across the top of this container, masked by the center vertical line? 
                        
                        Better: Each child has a top vertical line that connects to a common horizontal bar.
                        The common horizontal bar connects to the parent's bottom vertical line.
                     */}

          <div className="absolute top-0 left-10 right-10 h-px bg-border hidden sm:block"></div> {/* Simplified horizontal bar */}

          {categories.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No categories defined.</div>
          )}

          {categories.map((cat, i) => {
            const leadId = currentProject.settings?.category_leads?.[cat.id];
            const lead = members.find(m => m.user_id === leadId);

            // Get members for this category
            const catRoleNames = currentProject?.settings?.roles
              ?.filter(r => r.category === cat.id)
              .map(r => r.name) || [];
            const catMembers = members.filter(m => {
              const roleName = m.user_role || m.role;
              return catRoleNames.includes(roleName) && m.user_id !== leadId;
            });

            const hasSubMembers = catMembers.length > 0;

            return (
              <div key={cat.id} className="flex flex-col items-center relative">
                {/* Vertical Connector from Horizontal Bar to Category Node */}
                {/* This visual hack works best if we had exact widths, but flex gap handles spacing. 
                                    We simulate the tree complexity: 
                                    Parent -> Down 8px -> Horizontal Bar -> Down 8px -> Child
                                */}
                <div className="absolute -top-4 w-px h-4 bg-border"></div>

                {/* Category/Lead Node */}
                <div className={`relative px-4 py-2 rounded-xl border ${lead ? 'border-amber-500/50 bg-amber-500/5' : 'border-secondary bg-secondary/30'} mb-4 text-center min-w-[140px] z-10`}>
                  {lead ? (
                    <>
                      <div className="flex justify-center mb-1">
                        {lead.avatar_url ? (
                          <img src={lead.avatar_url} className="w-8 h-8 rounded-full border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold border border-border">
                            {(lead.display_name?.[0] || '?').toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">{lead.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.display_name} Lead</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-muted-foreground">{cat.display_name}</p>
                      <p className="text-[10px] text-muted-foreground italic">No Lead</p>
                    </>
                  )}
                </div>

                {/* Level 3: Members */}
                {hasSubMembers && (
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border mb-2"></div>
                    <div className="flex flex-col gap-2">
                      {catMembers.map(m => (
                        <div key={m.user_id} className="relative px-4 py-2 rounded-xl border border-secondary bg-secondary/30 text-center min-w-[140px] z-10">
                          <div className="flex justify-center mb-1">
                            {m.avatar_url || m.linked_contact?.avatar_url ? (
                              <img
                                src={m.avatar_url || m.linked_contact?.avatar_url}
                                alt={m.display_name}
                                className="w-8 h-8 rounded-full border border-border object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold border border-border">
                                {(m.display_name?.[0] || '?').toUpperCase()}
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground">{m.display_name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.user_role || m.role}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 justify-center text-xs text-muted-foreground mt-8 border-t border-border pt-4">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-primary bg-primary/10" /> Project</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-amber-500/50 bg-amber-500/5" /> Team Lead</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-border bg-card" /> Member</span>
      </div>
    </motion.div>
  );
};

export default ContactsPage;
=======
          ))}
        </div>
      )}
    </div>
  );
}
>>>>>>> origin/claude/migrate-to-react-uJJbl
