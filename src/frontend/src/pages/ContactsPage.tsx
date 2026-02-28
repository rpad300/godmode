/**
 * Purpose:
 *   Full CRUD management page for project contacts with favorites, filters,
 *   multi-select merge, duplicate detection, AI enrichment, import/export,
 *   and unmatched participant linking.
 *
 * Key dependencies:
 *   - useContacts / useCreateContact / useUpdateContact / useDeleteContact
 *   - useContactDuplicates / useMergeContacts / useEnrichContact
 *   - useExportContacts / useImportContacts
 *   - useUnmatchedParticipants / useLinkParticipant / useSyncPeopleToContacts
 *   - ContactForm / ContactDetail
 */
import { useState, useRef, useMemo } from 'react';
import {
  Users, Search, Plus, Loader2, Mail, Phone, Building2,
  Briefcase, X, Star, Filter, Download, Upload, Sparkles,
  AlertTriangle, Merge, CheckSquare, Square, UserPlus, Link2, RefreshCw,
  FileJson, FileSpreadsheet, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useContactDuplicates, useMergeContacts, useEnrichContact,
  useExportContacts, useImportContacts,
  useUnmatchedParticipants, useLinkParticipant, useSyncPeopleToContacts,
} from '../hooks/useGodMode';
import ContactForm from '../components/contacts/ContactForm';
import ContactDetail from '../components/contacts/ContactDetail';
import { cn, isValidAvatarUrl, getInitials, resolveAvatarUrl } from '../lib/utils';
import type { Contact } from '../types/godmode';

const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
const INPUT = 'w-full bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
const LABEL = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1.5';

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

function ContactAvatarImg({ contact, size = 'md' }: { contact: Record<string, unknown>; size?: 'sm' | 'md' | 'lg' }) {
  const name = String(contact.name || '?');
  const url = resolveAvatarUrl(contact);
  const dim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';
  const textSz = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-lg' : 'text-xs';
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br ${getGradient(name)} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {url ? (
        <img src={url} alt={name} className="w-full h-full rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <span className={`${textSz} font-bold text-white`}>{getInitials(name)}</span>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);

  // Filters
  const [orgFilter, setOrgFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Duplicates
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [mergePrimary, setMergePrimary] = useState<Record<number, string>>({});

  // Import
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unmatched
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Record<string, string>>({});

  // Queries & mutations
  const contactsQuery = useContacts({ search: search || undefined, organization: orgFilter || undefined });
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const duplicatesQuery = useContactDuplicates();
  const mergeContacts = useMergeContacts();
  const enrichContact = useEnrichContact();
  const exportContacts = useExportContacts();
  const importContacts = useImportContacts();
  const unmatchedQuery = useUnmatchedParticipants();
  const linkParticipant = useLinkParticipant();
  const syncPeople = useSyncPeopleToContacts();

  const rawData = contactsQuery.data;
  const allContacts: Contact[] = Array.isArray(rawData)
    ? rawData as unknown as Contact[]
    : (rawData?.contacts as unknown as Contact[] ?? []);

  // Derive org and tag lists for filter dropdowns
  const organizations = useMemo(() => {
    const orgs = new Set<string>();
    allContacts.forEach(c => { if (c.organization) orgs.add(c.organization); });
    return Array.from(orgs).sort();
  }, [allContacts]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allContacts.forEach(c => {
      const ct = c.tags;
      if (Array.isArray(ct)) ct.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [allContacts]);

  // Client-side filtering (tag, favorites) on top of API-side search/org filtering
  const contacts = useMemo(() => {
    let result = allContacts;
    if (tagFilter) {
      result = result.filter(c => {
        return Array.isArray(c.tags) && c.tags.includes(tagFilter);
      });
    }
    if (showFavoritesOnly) {
      result = result.filter(c => c.is_favorite || c.isFavorite);
    }
    return result;
  }, [allContacts, tagFilter, showFavoritesOnly]);

  const favorites = useMemo(
    () => allContacts.filter(c => c.is_favorite || c.isFavorite),
    [allContacts]
  );

  const duplicates: any[] = (duplicatesQuery.data as any)?.duplicates || [];

  const unmatched: { name: string; count?: number }[] = (unmatchedQuery.data as any)?.unmatched || [];

  // Handlers
  const handleCreate = (data: Omit<Contact, 'id' | 'mentionCount'>) => {
    createContact.mutate(data as Record<string, unknown>, {
      onSuccess: () => { toast.success('Contact created'); setShowForm(false); },
      onError: () => toast.error('Failed to create contact'),
    });
  };

  const handleUpdate = (data: Omit<Contact, 'id' | 'mentionCount'>) => {
    if (!editContact) return;
    updateContact.mutate({ id: editContact.id, ...data } as { id: string; [key: string]: unknown }, {
      onSuccess: () => { toast.success('Contact updated'); setEditContact(null); setShowForm(false); },
      onError: () => toast.error('Failed to update contact'),
    });
  };

  const handleDelete = (id: string) => {
    deleteContact.mutate(id, {
      onSuccess: () => { toast.success('Contact deleted'); setDetailContact(null); },
      onError: () => toast.error('Failed to delete contact'),
    });
  };

  const handleEditFromDetail = (_contact: Contact) => {
    // Refresh the contacts list to reflect inline edits from the detail modal
    contactsQuery.refetch();
  };

  const toggleFavorite = (contact: Contact) => {
    const isFav = contact.is_favorite || contact.isFavorite;
    updateContact.mutate({ id: contact.id, is_favorite: !isFav } as { id: string; [key: string]: unknown }, {
      onSuccess: () => toast.success(isFav ? 'Removed from favorites' : 'Added to favorites'),
      onError: () => toast.error('Failed to update'),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMergeSelected = () => {
    if (selectedIds.size < 2) { toast.error('Select at least 2 contacts to merge'); return; }
    mergeContacts.mutate(Array.from(selectedIds), {
      onSuccess: () => { toast.success('Contacts merged'); setSelectedIds(new Set()); setSelectMode(false); },
      onError: () => toast.error('Merge failed'),
    });
  };

  const handleMergeDuplicateGroup = (groupIndex: number, group: any[]) => {
    const primary = mergePrimary[groupIndex];
    if (!primary) { toast.error('Select a primary contact'); return; }
    const ids = group.map((c: any) => c.id);
    mergeContacts.mutate(ids, {
      onSuccess: () => { toast.success('Duplicates merged'); duplicatesQuery.refetch(); },
      onError: () => toast.error('Merge failed'),
    });
  };

  const handleEnrich = (id: string) => {
    enrichContact.mutate(id, {
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
        contactsQuery.refetch();
      },
      onError: () => toast.error('Enrichment failed'),
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const isCSV = file.name.endsWith('.csv');
      if (isCSV) {
        importContacts.mutate({ format: 'csv', data: text }, {
          onSuccess: (r: any) => { toast.success(`Imported ${r?.added || 0} contacts`); setShowImport(false); },
          onError: () => toast.error('Import failed'),
        });
      } else {
        try {
          const json = JSON.parse(text);
          importContacts.mutate({ format: 'json', data: json }, {
            onSuccess: (r: any) => { toast.success(`Imported ${r?.added || 0} contacts`); setShowImport(false); },
            onError: () => toast.error('Import failed'),
          });
        } catch { toast.error('Invalid JSON file'); }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLinkParticipant = (name: string, contactId: string) => {
    linkParticipant.mutate({ participantName: name, contactId }, {
      onSuccess: () => toast.success(`Linked "${name}"`),
      onError: () => toast.error('Link failed'),
    });
  };

  // Detail view (replaces list)
  if (detailContact) {
    return (
      <ContactDetail
        contact={detailContact}
        onBack={() => setDetailContact(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDelete}
      />
    );
  }

  // Form view (add or edit)
  if (showForm) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setShowForm(false); setEditContact(null); }}
            className="w-8 h-8 rounded-lg bg-[var(--gm-bg-tertiary)] flex items-center justify-center hover:bg-[var(--gm-surface-hover)]"
          >
            <X className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
          </button>
          <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">
            {editContact ? 'Edit Contact' : 'Add Contact'}
          </h1>
        </div>
        <div className="bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-xl p-5">
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-[var(--gm-text-primary)]">Contacts</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sync people */}
          <button
            onClick={() => syncPeople.mutate(undefined, {
              onSuccess: (r: any) => toast.success(`Synced: ${r?.added || 0} added`),
              onError: () => toast.error('Sync failed'),
            })}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"
            title="Sync people from documents to contacts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncPeople.isPending ? 'animate-spin' : ''}`} /> Sync People
          </button>

          {/* Unmatched */}
          {unmatched.length > 0 && (
            <button
              onClick={() => setShowUnmatched(!showUnmatched)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 text-xs hover:bg-amber-500/20 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> {unmatched.length} Unmatched
            </button>
          )}

          {/* Duplicates */}
          {duplicates.length > 0 && (
            <button
              onClick={() => setShowDuplicates(!showDuplicates)}
              className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 text-xs hover:bg-orange-500/20 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> {duplicates.length} Duplicate groups
            </button>
          )}

          {/* Select mode */}
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${selectMode ? 'bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)]' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]'}`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> Select
          </button>

          {/* Export */}
          <div className="relative group">
            <button className="px-2.5 py-1.5 rounded-lg bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[120px]">
              <button onClick={() => exportContacts.mutate('json')} className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--gm-surface-hover)] flex items-center gap-2 rounded-t-lg">
                <FileJson className="w-3.5 h-3.5" /> JSON
              </button>
              <button onClick={() => exportContacts.mutate('csv')} className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--gm-surface-hover)] flex items-center gap-2 rounded-b-lg">
                <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] text-xs hover:bg-[var(--gm-surface-hover)] flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json,.csv" className="hidden" onChange={handleImportFile} />

          {/* Add */}
          <button
            onClick={() => { setEditContact(null); setShowForm(true); }}
            className="px-3 py-1.5 rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-xs font-medium hover:bg-[var(--gm-interactive-primary-hover)] flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </button>
        </div>
      </div>

      {/* Search + Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg text-xs text-[var(--gm-text-primary)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)]"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${(orgFilter || tagFilter || showFavoritesOnly) ? 'bg-[var(--gm-interactive-primary)]/10 text-[var(--gm-accent-primary)] border border-[var(--gm-accent-primary)]/30' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]'}`}
        >
          <Filter className="w-3.5 h-3.5" /> Filters
          {(orgFilter || tagFilter || showFavoritesOnly) && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-[10px]">
              {[orgFilter, tagFilter, showFavoritesOnly].filter(Boolean).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${showFavoritesOnly ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)] hover:bg-[var(--gm-surface-hover)]'}`}
        >
          <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-amber-500' : ''}`} /> Favorites {favorites.length > 0 && `(${favorites.length})`}
        </button>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--gm-text-tertiary)]">Organization:</label>
            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              className="px-2 py-1 bg-[var(--gm-bg-primary)] border border-[var(--gm-border-primary)] rounded text-xs text-[var(--gm-text-primary)]"
            >
              <option value="">All</option>
              {organizations.map(org => <option key={org} value={org}>{org}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--gm-text-tertiary)]">Tag:</label>
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="px-2 py-1 bg-[var(--gm-bg-primary)] border border-[var(--gm-border-primary)] rounded text-xs text-[var(--gm-text-primary)]"
            >
              <option value="">All</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
          {(orgFilter || tagFilter) && (
            <button
              onClick={() => { setOrgFilter(''); setTagFilter(''); }}
              className="text-xs text-[var(--gm-accent-primary)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Selection bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gm-interactive-primary)]/5 border border-[var(--gm-accent-primary)]/20">
          <span className="text-xs text-[var(--gm-accent-primary)] font-medium">{selectedIds.size} selected</span>
          <button
            onClick={handleMergeSelected}
            disabled={selectedIds.size < 2 || mergeContacts.isPending}
            className="px-2.5 py-1 rounded bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Merge className="w-3.5 h-3.5" /> Merge Selected
          </button>
          <button onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }} className="text-xs text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]">
            Cancel
          </button>
        </div>
      )}

      {/* Unmatched panel */}
      {showUnmatched && unmatched.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-500" /> Unmatched Participants ({unmatched.length})
            </h3>
            <button onClick={() => setShowUnmatched(false)} className="text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-[var(--gm-text-tertiary)]">These names were found in documents but don't match any contact. Link them to existing contacts.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {unmatched.map((u) => (
              <div key={u.name} className="flex items-center gap-2 p-2 rounded bg-[var(--gm-bg-primary)] border border-[var(--gm-border-primary)]">
                <span className="text-xs font-medium text-[var(--gm-text-primary)] flex-1">{u.name}</span>
                {u.count && <span className="text-[10px] text-[var(--gm-text-tertiary)]">{u.count} mentions</span>}
                <select
                  value={linkTarget[u.name] || ''}
                  onChange={e => setLinkTarget(prev => ({ ...prev, [u.name]: e.target.value }))}
                  className="px-2 py-1 bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded text-xs max-w-[150px]"
                >
                  <option value="">Link to...</option>
                  {allContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  disabled={!linkTarget[u.name]}
                  onClick={() => linkTarget[u.name] && handleLinkParticipant(u.name, linkTarget[u.name])}
                  className="px-2 py-1 rounded bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] text-[10px] disabled:opacity-40 flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" /> Link
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicates panel */}
      {showDuplicates && duplicates.length > 0 && (
        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--gm-text-primary)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Duplicate Groups ({duplicates.length})
            </h3>
            <button onClick={() => setShowDuplicates(false)} className="text-[var(--gm-text-tertiary)] hover:text-[var(--gm-text-primary)]"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {duplicates.map((group: any, gi: number) => {
              const items = Array.isArray(group) ? group : group.contacts || [group];
              return (
                <div key={gi} className="p-3 rounded-lg bg-[var(--gm-bg-primary)] border border-[var(--gm-border-primary)] space-y-2">
                  <p className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider">Group {gi + 1} — Select primary</p>
                  {items.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-[var(--gm-surface-hover)]">
                      <input
                        type="radio"
                        name={`merge-group-${gi}`}
                        checked={mergePrimary[gi] === c.id}
                        onChange={() => setMergePrimary(prev => ({ ...prev, [gi]: c.id }))}
                        className="accent-primary"
                      />
                      <span className="text-xs text-[var(--gm-text-primary)]">{c.name}</span>
                      {c.email && <span className="text-[10px] text-[var(--gm-text-tertiary)]">({c.email})</span>}
                    </label>
                  ))}
                  <button
                    onClick={() => handleMergeDuplicateGroup(gi, items)}
                    disabled={!mergePrimary[gi] || mergeContacts.isPending}
                    className="px-2.5 py-1 rounded bg-orange-500 text-white text-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    <Merge className="w-3 h-3" /> Merge Group
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorites horizontal scroll */}
      {favorites.length > 0 && !showFavoritesOnly && (
        <div>
          <p className="text-xs text-[var(--gm-text-tertiary)] mb-2 flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Favorites
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {favorites.map(c => (
              <button
                key={c.id}
                onClick={() => setDetailContact(c)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--gm-surface-primary)] border border-[var(--gm-border-primary)] hover:border-[var(--gm-accent-primary)]/30 flex-shrink-0"
              >
                <ContactAvatarImg contact={c as unknown as Record<string, unknown>} size="sm" />
                <div className="text-left">
                  <p className="text-xs font-medium text-[var(--gm-text-primary)]">{c.name}</p>
                  {c.role && <p className="text-[10px] text-[var(--gm-text-tertiary)]">{c.role}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-[var(--gm-text-tertiary)]">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>

      {/* List */}
      {contactsQuery.isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gm-accent-primary)]" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] p-8 text-center text-[var(--gm-text-tertiary)]">
          <Users className="h-12 w-12 mx-auto mb-4 text-[var(--gm-text-tertiary)]/40" />
          {search || orgFilter || tagFilter ? 'No contacts match your filters.' : 'No contacts found. Add one to get started.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.map((contact) => {
            const isFav = contact.is_favorite || contact.isFavorite;
            const isSelected = selectedIds.has(contact.id);
            return (
              <div
                key={contact.id}
                className={`bg-[var(--gm-surface-primary)] border rounded-xl p-4 hover:border-[var(--gm-accent-primary)]/30 transition-colors cursor-pointer group relative ${isSelected ? 'border-[var(--gm-accent-primary)] bg-[var(--gm-interactive-primary)]/5' : 'border-[var(--gm-border-primary)]'}`}
                onClick={() => selectMode ? toggleSelect(contact.id) : setDetailContact(contact)}
              >
                {/* Select checkbox */}
                {selectMode && (
                  <div className="absolute top-3 left-3 z-10">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[var(--gm-accent-primary)]" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--gm-text-tertiary)]" />
                    )}
                  </div>
                )}

                {/* Favorite star */}
                <button
                  className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(contact); }}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-4 h-4 ${isFav ? 'fill-amber-500 text-amber-500' : 'text-[var(--gm-text-tertiary)] hover:text-amber-500'}`} />
                </button>

                {/* AI Enrich button */}
                <button
                  className="absolute top-3 right-9 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleEnrich(contact.id); }}
                  title="Enrich with AI"
                >
                  <Sparkles className={`w-4 h-4 text-violet-400 hover:text-violet-300 ${enrichContact.isPending ? 'animate-pulse' : ''}`} />
                </button>

                <div className={`flex items-center gap-3 ${selectMode ? 'ml-5' : ''}`}>
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradient(contact.name)} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                    {resolveAvatarUrl(contact as any) ? (
                      <img src={resolveAvatarUrl(contact as any)!} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white">{getInitials(contact.name)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--gm-text-primary)] truncate group-hover:text-[var(--gm-accent-primary)] transition-colors">
                      {contact.name || '(unnamed)'}
                      {isFav && <Star className="w-3 h-3 inline ml-1 fill-amber-500 text-amber-500" />}
                    </p>
                    {contact.role && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-[var(--gm-text-tertiary)]" />
                        <span className="text-[10px] text-[var(--gm-text-tertiary)] truncate">{contact.role}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {contact.organization && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)]">
                      <Building2 className="w-3 h-3" />
                      <span className="truncate">{contact.organization}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)]">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--gm-text-tertiary)]">
                      <Phone className="w-3 h-3" />
                      <span className="truncate">{contact.phone}</span>
                    </div>
                  )}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--gm-bg-tertiary)] text-[var(--gm-text-tertiary)]">{tag}</span>
                      ))}
                      {contact.tags.length > 4 && (
                        <span className="text-[9px] text-[var(--gm-text-tertiary)]">+{contact.tags.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
