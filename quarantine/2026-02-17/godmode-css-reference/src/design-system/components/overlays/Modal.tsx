/**
 * Modal Component
 * Dialog overlay with glassmorphism backdrop
 */

import { useEffect, forwardRef, HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { trapFocus } from '../../utils/a11y';
import { Keys } from '../../utils/keyboard';

export const modalSizes = ['sm', 'md', 'lg'] as const;
export type ModalSize = typeof modalSizes[number];

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ 
    open,
    onClose,
    title,
    size = 'md',
    footer,
    closeOnBackdrop = true,
    className,
    children,
    ...props 
  }, ref) => {
    useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === Keys.Escape) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }, [open, onClose]);

    useEffect(() => {
      if (!open) return;
      
      const modalElement = document.querySelector('[role="dialog"]') as HTMLElement;
      if (modalElement) {
        const cleanup = trapFocus(modalElement);
        return cleanup;
      }
    }, [open]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-bg-overlay backdrop-blur-sm"
          onClick={closeOnBackdrop ? onClose : undefined}
          aria-hidden="true"
        />
        
        {/* Modal */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          className={cn(
            'relative bg-surface-primary border border-border-primary rounded-xl shadow-glass w-full flex flex-col max-h-[90vh]',
            sizeStyles[size],
            className
          )}
          {...props}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
              <h2 id="modal-title" className="text-xl font-semibold text-text-primary">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface-hover"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>
          
          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-border-primary">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';
