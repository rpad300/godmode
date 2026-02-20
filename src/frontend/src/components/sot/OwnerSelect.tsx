import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, User } from 'lucide-react';
import { useContacts } from '../../hooks/useGodMode';
import { cn, getInitials, isValidAvatarUrl } from '../../lib/utils';

interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
  organization?: string;
  avatarUrl?: string;
  avatar?: string;
  photo_url?: string;
  cargo?: string;
  empresa?: string;
  [key: string]: unknown;
}

interface OwnerSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

const COLORS = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-red-400',
  'from-indigo-500 to-violet-400',
];

function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function ContactAvatar({ contact, size = 'sm' }: { contact: Contact; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const txt = size === 'sm' ? 'text-[9px]' : 'text-[11px]';

  const avatarRaw = contact.avatarUrl || contact.avatar || contact.photo_url;
  const avatarSrc = isValidAvatarUrl(avatarRaw) ? avatarRaw : null;
  if (avatarSrc) {
    return <img src={avatarSrc} alt={contact.name} className={cn(dim, 'rounded-full object-cover')} />;
  }

  return (
    <div className={cn(dim, 'rounded-full bg-gradient-to-br flex items-center justify-center shrink-0', hashColor(contact.name))}>
      <span className={cn(txt, 'font-bold text-white')}>{getInitials(contact.name || '?')}</span>
    </div>
  );
}

export function ContactInline({ contact, size = 'sm' }: { contact: Contact; size?: 'sm' | 'md' }) {
  const role = contact.cargo || contact.role || '';
  const org = contact.empresa || contact.organization || '';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <ContactAvatar contact={contact} size={size} />
      <div className="min-w-0 flex-1">
        <div className={cn('font-medium truncate text-[var(--gm-text-primary)]', size === 'sm' ? 'text-[11px]' : 'text-xs')}>
          {contact.name}
        </div>
        {(role || org) && (
          <div className={cn('truncate text-[var(--gm-text-tertiary)]', size === 'sm' ? 'text-[9px]' : 'text-[10px]')}>
            {[role, org].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerSelect({ value, onChange, placeholder = 'Select owner...', label, className }: OwnerSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: contactsData } = useContacts();
  const contacts: Contact[] = ((contactsData as Record<string, unknown>)?.contacts as Contact[] ?? []);

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      (c.role || c.cargo || '')?.toLowerCase().includes(q) ||
      (c.organization || c.empresa || '')?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const selected = contacts.find(c => c.name === value || c.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && <label className="block text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider mb-1.5">{label}</label>}

      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] text-left hover:border-[var(--gm-accent-primary)]/50 transition-colors">
        {selected ? (
          <ContactInline contact={selected} size="sm" />
        ) : value ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-[var(--gm-bg-tertiary)] flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
            </div>
            <span className="text-[11px] text-[var(--gm-text-secondary)] truncate">{value}</span>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--gm-text-tertiary)] flex-1">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={(e) => { e.stopPropagation(); onChange(''); }} className="p-0.5 hover:bg-[var(--gm-bg-tertiary)] rounded cursor-pointer">
              <X className="w-3 h-3 text-[var(--gm-text-tertiary)]" />
            </span>
          )}
          <ChevronDown className={cn('w-3.5 h-3.5 text-[var(--gm-text-tertiary)] transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--gm-border-primary)]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--gm-bg-tertiary)]">
              <Search className="w-3.5 h-3.5 text-[var(--gm-text-tertiary)]" />
              <input ref={inputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..." className="flex-1 bg-transparent text-xs text-[var(--gm-text-primary)] outline-none placeholder:text-[var(--gm-text-tertiary)]" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length > 0 ? filtered.map((c) => (
              <button key={c.id} type="button"
                onClick={() => { onChange(c.name); setOpen(false); setSearch(''); }}
                className={cn('w-full px-2 py-2 rounded-lg flex items-center gap-2 hover:bg-[var(--gm-surface-hover)] transition-colors',
                  (c.name === value || c.id === value) && 'bg-[var(--gm-accent-primary)]/10')}>
                <ContactInline contact={c} size="sm" />
              </button>
            )) : (
              <div className="px-3 py-4 text-center">
                <User className="w-5 h-5 text-[var(--gm-text-tertiary)] mx-auto mb-1" />
                <p className="text-[10px] text-[var(--gm-text-tertiary)]">No contacts found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
