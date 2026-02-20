import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onClose, onOpenChange, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      {children}
    </div>
  );
}

export function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-gm-surface-primary text-gm-text-primary border-gm-border-primary',
        'rounded-lg border shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto',
        className
      )}
      style={{
        backgroundColor: 'var(--gm-surface-primary, #1a1a2e)',
        color: 'var(--gm-text-primary, #e2e8f0)',
        borderColor: 'var(--gm-border-primary, #2d2d44)',
      }}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold text-white', className)}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn('text-sm text-gm-text-tertiary mt-1', className)}
      style={{ color: 'var(--gm-text-tertiary, #94a3b8)' }}
    >
      {children}
    </p>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)}>{children}</div>;
}
