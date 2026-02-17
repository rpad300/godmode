interface OwnerBadgeProps {
  name: string;
  role?: string;
  size?: 'sm' | 'md';
}

const avatarColors = [
  'bg-primary/20 text-primary',
  'bg-destructive/20 text-destructive',
  'bg-accent/20 text-accent',
  'bg-warning/20 text-warning',
  'bg-success/20 text-success',
];

const getColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const OwnerBadge = ({ name, role, size = 'sm' }: OwnerBadgeProps) => {
  const initials = getInitials(name);
  const color = getColor(name);

  const avatarSize = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';

  return (
    <div className="flex items-center gap-2">
      <div className={`${avatarSize} rounded-full ${color} font-semibold flex items-center justify-center flex-shrink-0`}>
        {initials}
      </div>
      <div className="min-w-0">
        <p className={`font-medium text-foreground truncate ${size === 'sm' ? 'text-[11px]' : 'text-sm'}`}>{name}</p>
        {role && (
          <p className={`text-muted-foreground truncate ${size === 'sm' ? 'text-[9px]' : 'text-[11px]'}`}>{role}</p>
        )}
      </div>
    </div>
  );
};

export default OwnerBadge;
