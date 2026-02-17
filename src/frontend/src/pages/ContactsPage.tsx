import { useState } from 'react';
import {
  Users, Search, Plus, Loader2, Mail, Phone, Building2,
  Briefcase, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '../hooks/useGodMode';
import ContactForm from '../components/contacts/ContactForm';
import ContactDetailModal from '../components/contacts/ContactDetailModal';
import type { Contact } from '../types/godmode';

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

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);

  const contactsQuery = useContacts({ search: search || undefined });
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  // The API may return { contacts: [...] } or just an array
  const rawData = contactsQuery.data;
  const contacts: Contact[] = Array.isArray(rawData)
    ? rawData as unknown as Contact[]
    : (rawData?.contacts as unknown as Contact[] ?? []);

  const handleCreate = (data: Omit<Contact, 'id' | 'mentionCount'>) => {
    createContact.mutate(data as Record<string, unknown>, {
      onSuccess: () => {
        toast.success('Contact created');
        setShowForm(false);
      },
      onError: () => toast.error('Failed to create contact'),
    });
  };

  const handleUpdate = (data: Omit<Contact, 'id' | 'mentionCount'>) => {
    if (!editContact) return;
    updateContact.mutate({ id: editContact.id, ...data } as { id: string; [key: string]: unknown }, {
      onSuccess: () => {
        toast.success('Contact updated');
        setEditContact(null);
        setShowForm(false);
      },
      onError: () => toast.error('Failed to update contact'),
    });
  };

  const handleDelete = (id: string) => {
    deleteContact.mutate(id, {
      onSuccess: () => {
        toast.success('Contact deleted');
        setDetailContact(null);
      },
      onError: () => toast.error('Failed to delete contact'),
    });
  };

  const handleEditFromDetail = (contact: Contact) => {
    setDetailContact(null);
    setEditContact(contact);
    setShowForm(true);
  };

  // Form view (add or edit)
  if (showForm) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setShowForm(false); setEditContact(null); }}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {editContact ? 'Edit Contact' : 'Add Contact'}
          </h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <ContactForm
            contact={editContact}
            mode={editContact ? 'edit' : 'add'}
            onSubmit={editContact ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditContact(null); }}
          />
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
        <button
          onClick={() => { setEditContact(null); setShowForm(true); }}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="w-full pl-9 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>

      {/* List */}
      {contactsQuery.isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          {search ? 'No contacts match your search.' : 'No contacts found. Add one to get started.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => setDetailContact(contact)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradient(contact.name)} flex items-center justify-center flex-shrink-0`}>
                  {contact.avatarUrl || contact.avatar ? (
                    <img src={contact.avatarUrl || contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{getInitials(contact.name)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {contact.name}
                  </p>
                  {contact.role && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground truncate">{contact.role}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {contact.organization && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{contact.organization}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span className="truncate">{contact.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <ContactDetailModal
        contact={detailContact}
        open={!!detailContact}
        onClose={() => setDetailContact(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDelete}
      />
    </div>
  );
}
