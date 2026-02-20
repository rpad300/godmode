import { useContacts } from '../../hooks/useGodMode';
import { cn, isValidAvatarUrl, getInitials } from '../../lib/utils';

interface OwnerBadgeProps {
  name: string;
  role?: string;
  size?: 'sm' | 'md';
}

const GRADIENTS = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-red-400',
  'from-indigo-500 to-violet-400',
];

function hashGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

function hasPhoto(c: Record<string, unknown>) {
  return isValidAvatarUrl(c.avatarUrl) || isValidAvatarUrl(c.avatar) || isValidAvatarUrl(c.photo_url);
}

function findContact(contacts: Array<Record<string, unknown>>, name: string) {
  const q = name.toLowerCase().trim();

  const candidates: Record<string, unknown>[] = [];

  for (const c of contacts) {
    const cName = (c.name as string)?.toLowerCase() ?? '';
    const cEmail = (c.email as string)?.toLowerCase() ?? '';
    const aliases = ((c.aliases as string[]) ?? []).map(a => a.toLowerCase());

    // exact name or email
    if (cName === q || cEmail === q) { candidates.push(c); continue; }
    // exact alias
    if (aliases.includes(q)) { candidates.push(c); continue; }
    // name starts with query or query starts with name
    if (cName.startsWith(q + ' ') || q.startsWith(cName + ' ')) { candidates.push(c); continue; }
    // first-name match (min 3 chars)
    const first = cName.split(' ')[0];
    if (first && first.length >= 3 && q === first) { candidates.push(c); continue; }
    // partial alias
    if (aliases.some(a => a.length >= 3 && (q.includes(a) || a.includes(q)))) { candidates.push(c); continue; }
  }

  if (candidates.length === 0) return undefined;
  // prefer candidate with a photo
  return candidates.find(hasPhoto) ?? candidates[0];
}

const OwnerBadge = ({ name, role: roleProp, size = 'sm' }: OwnerBadgeProps) => {
  const { data: contactsData } = useContacts();
  const contacts = ((contactsData as Record<string, unknown>)?.contacts ?? []) as Array<Record<string, unknown>>;

  const match = findContact(contacts, name);

  const displayName = (match?.name as string) || name;
  const avatarRaw = match?.avatarUrl || match?.avatar || match?.photo_url;
  const avatar = (typeof avatarRaw === 'string' && avatarRaw.length > 0 && avatarRaw !== 'undefined' && avatarRaw !== 'null') ? avatarRaw : undefined;
  const contactRole = (match?.cargo || match?.role || roleProp || '') as string;
  const org = (match?.empresa || match?.organization || '') as string;
  const subtitle = [contactRole, org].filter(Boolean).join(' · ');

  const avatarDim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[11px]';
  const nameSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  const subSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="flex items-center gap-2 min-w-0">
      {avatar ? (
        <img src={avatar} alt={displayName} className={cn(avatarDim, 'rounded-full object-cover shrink-0')} />
      ) : (
        <div className={cn(avatarDim, 'rounded-full bg-gradient-to-br flex items-center justify-center shrink-0', hashGradient(displayName))}>
          <span className={cn(textSize, 'font-bold text-white')}>{getInitials(displayName)}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium text-[var(--gm-text-primary)] truncate', nameSize)}>{displayName}</p>
        {subtitle && (
          <p className={cn('text-[var(--gm-text-tertiary)] truncate', subSize)}>{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default OwnerBadge;
