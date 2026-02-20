import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export const CARD = 'rounded-xl border border-[var(--gm-border-primary)] bg-[var(--gm-surface-primary)] shadow-[var(--shadow-sm)] transition-all duration-200';
export const INPUT = 'bg-[var(--gm-bg-tertiary)] border border-[var(--gm-border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--gm-text-primary)] placeholder:text-[var(--gm-text-placeholder)] focus:outline-none focus:border-[var(--gm-border-focus)] focus:shadow-[var(--shadow-focus)] transition-all duration-150';
export const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-primary)] text-[var(--gm-text-on-brand)] hover:bg-[var(--gm-interactive-primary-hover)] shadow-sm transition-all duration-150 disabled:opacity-50';
export const BTN_SECONDARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--gm-interactive-secondary)] text-[var(--gm-text-primary)] hover:bg-[var(--gm-interactive-secondary-hover)] border border-[var(--gm-border-primary)] transition-all duration-150';
export const BTN_DANGER = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] shadow-sm transition-all duration-150 disabled:opacity-50';
export const SECTION_TITLE = 'text-[10px] font-bold text-[var(--gm-accent-primary)] uppercase tracking-[0.1em]';
export const TABLE_HEAD = 'text-[10px] font-bold text-[var(--gm-text-tertiary)] uppercase tracking-wider';

export function Loading() {
  return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--gm-accent-primary)]" /></div>;
}
export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className={cn(CARD, 'p-10 text-center flex flex-col items-center gap-3')}>
      <AlertTriangle className="w-5 h-5 text-[var(--color-warning-500)]" />
      <span className="text-sm text-[var(--gm-text-secondary)]">{msg}</span>
    </div>
  );
}
export function EmptyState({ msg }: { msg: string }) {
  return <div className={cn(CARD, 'p-10 text-center text-[var(--gm-text-tertiary)] text-sm')}>{msg}</div>;
}
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[var(--gm-text-primary)]">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--gm-text-tertiary)] mt-0.5">{subtitle}</p>}
    </div>
  );
}
export function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className={cn(CARD, 'p-4 text-center')}>
      <div className="text-2xl font-bold tabular-nums" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[10px] text-[var(--gm-text-tertiary)] uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[var(--gm-border-primary)] transition-colors duration-200 disabled:opacity-50"
      style={{ backgroundColor: checked ? 'var(--color-brand-500)' : 'var(--gm-bg-tertiary)' }}>
      <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}

export const r = (d: unknown) => (d ?? {}) as Record<string, unknown>;
