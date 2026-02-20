import { useState } from 'react';
import { resolveAvatarUrl, getInitials, cn } from '../../lib/utils';

interface PersonAvatarProps {
  person: Record<string, unknown> | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showInfo?: boolean;
  infoClassName?: string;
}

const SIZES = {
  xs: { box: 'w-6 h-6', text: 'text-[8px]', img: 'w-6 h-6' },
  sm: { box: 'w-8 h-8', text: 'text-[10px]', img: 'w-8 h-8' },
  md: { box: 'w-10 h-10', text: 'text-xs', img: 'w-10 h-10' },
  lg: { box: 'w-14 h-14', text: 'text-sm', img: 'w-14 h-14' },
  xl: { box: 'w-20 h-20', text: 'text-lg', img: 'w-20 h-20' },
};

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function PersonAvatar({ person, size = 'md', className, showInfo, infoClassName }: PersonAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const url = resolveAvatarUrl(person);
  const name = String(person?.name || person?.display_name || person?.username || person?.email || '');
  const initials = getInitials(name);
  const s = SIZES[size];

  const role = String(person?.cargo || person?.role || person?.title || '');
  const company = String(person?.empresa || person?.organization || person?.company || '');

  const avatar = url && !imgError ? (
    <img src={url} alt={name} onError={() => setImgError(true)}
      className={cn(s.img, 'rounded-full object-cover flex-shrink-0', className)} />
  ) : (
    <div className={cn(s.box, 'rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br', gradientFor(name), className)}>
      <span className={cn(s.text, 'font-bold text-white leading-none')}>{initials}</span>
    </div>
  );

  if (!showInfo) return avatar;

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', infoClassName)}>
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--gm-text-primary)] truncate">{name || 'Unknown'}</p>
        {(role || company) && (
          <p className="text-[10px] text-[var(--gm-text-tertiary)] truncate">
            {role}{role && company ? ' · ' : ''}{company}
          </p>
        )}
      </div>
    </div>
  );
}
