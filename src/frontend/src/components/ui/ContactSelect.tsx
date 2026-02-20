/**
 * ContactSelect — custom dropdown for selecting contacts with rich badges.
 * Shows avatar, name, role, and organization for each contact.
 * Replaces native <select> wherever contacts need to be picked.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn, getInitials, resolveAvatarUrl } from '../../lib/utils';
import type { Contact } from '../../types/godmode';

interface ContactSelectProps {
  contacts: Contact[];
  value: string | null;
  onChange: (contactId: string | null) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

function ContactBadge({ contact, compact }: { contact: Contact; compact?: boolean }) {
  const avatar = resolveAvatarUrl(contact as any);
  return (
    <div className={cn('flex items-center gap-2 min-w-0', compact ? 'py-0' : 'py-0.5')}>
      {avatar ? (
        <img src={avatar} alt="" className={cn('rounded-full object-cover shrink-0 bg-secondary', compact ? 'w-5 h-5' : 'w-7 h-7')} />
      ) : (
        <div className={cn(
          'rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0',
          compact ? 'w-5 h-5 text-[8px]' : 'w-7 h-7 text-[10px]'
        )}>
          {getInitials(contact.name || '?')}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className={cn('font-medium text-foreground block truncate', compact ? 'text-[11px]' : 'text-xs')}>
          {contact.name}
        </span>
        {!compact && (contact.role || contact.organization) && (
          <span className="text-[10px] text-muted-foreground block truncate">
            {[contact.role, contact.organization].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      {contact.role && compact && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{contact.role}</span>
      )}
    </div>
  );
}

export function ContactSelect({ contacts, value, onChange, placeholder = 'No context', className, compact }: ContactSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = contacts.find(c => c.id === value) ?? null;

  const filtered = search.trim()
    ? contacts.filter(c => {
        const q = search.toLowerCase();
        return c.name?.toLowerCase().includes(q)
          || c.role?.toLowerCase().includes(q)
          || c.organization?.toLowerCase().includes(q)
          || c.email?.toLowerCase().includes(q);
      })
    : contacts;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const handleSelect = useCallback((id: string | null) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-left transition-colors hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring',
          compact ? 'py-1' : 'py-1.5'
        )}
      >
        {selected ? (
          <div className="flex-1 min-w-0">
            <ContactBadge contact={selected} compact={compact} />
          </div>
        ) : (
          <span className={cn('flex-1 text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
            {placeholder}
          </span>
        )}
        {selected && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSelect(null); }}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Search */}
          {contacts.length > 5 && (
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
              <Search className="w-3 h-3 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}

          {/* "No context" option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors border-b border-border/50',
              !value && 'bg-primary/5 text-primary font-medium'
            )}
          >
            {placeholder}
          </button>

          {/* Contact list */}
          <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No contacts found</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors',
                    c.id === value && 'bg-primary/5'
                  )}
                >
                  <ContactBadge contact={c} />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
