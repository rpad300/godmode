export const CARD =
  'rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-[var(--shadow-sm)]';

export const CARD_FLAT =
  'rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)]';

export const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ' +
  'bg-[var(--interactive-primary)] text-[var(--text-on-brand)] ' +
  'hover:bg-[var(--interactive-primary-hover)] transition-colors disabled:opacity-50';

export const BTN_SECONDARY =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ' +
  'bg-[var(--interactive-secondary)] text-[var(--text-primary)] ' +
  'hover:bg-[var(--interactive-secondary-hover)] border border-[var(--border-primary)] ' +
  'transition-colors disabled:opacity-50';

export const BTN_DANGER =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ' +
  'bg-[var(--status-danger-bg)] text-[var(--status-danger)] ' +
  'hover:opacity-80 transition-colors disabled:opacity-50';

export const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ' +
  'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50';

export const INPUT =
  'bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 ' +
  'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]/40';

export const SECTION_TITLE =
  'text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-[0.1em]';

export const BADGE = (color: 'success' | 'warning' | 'danger' | 'info' | 'neutral') => {
  const map = {
    success: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/30',
    warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30',
    danger:  'bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/30',
    info:    'bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info)]/30',
    neutral: 'bg-[var(--surface-secondary)] text-[var(--text-tertiary)] border-[var(--border-primary)]',
  };
  return `text-[10px] font-medium px-2.5 py-1 rounded-full border capitalize ${map[color]}`;
};

export const STATUS_COLORS: Record<string, string> = {
  pending:     'var(--color-neutral-500, #64748b)',
  in_progress: 'var(--color-brand-500, #3b82f6)',
  completed:   'var(--color-success-500, #22c55e)',
  overdue:     'var(--color-danger-500, #ef4444)',
  cancelled:   'var(--color-neutral-500, #6b7280)',
  planning:    'var(--color-brand-500, #3b82f6)',
  active:      'var(--color-success-500, #22c55e)',
  done:        'var(--color-success-500, #22c55e)',
};

export const ASSIGNEE_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#14b8a6',
];
