/**
 * Input Component
 * Text input field with various states and features
 */

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const baseStyles = 'flex items-center border rounded-lg transition-all focus-within:ring-2 focus-within:ring-border-focus bg-surface-primary';

const inputStyles = 'flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-placeholder disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className,
    error,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled,
    ...props 
  }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <div 
          className={cn(
            baseStyles,
            error ? 'border-status-danger' : 'border-border-primary',
            fullWidth && 'w-full',
            disabled && 'opacity-50',
            className
          )}
        >
          {icon && iconPosition === 'left' && (
            <div className="pl-3 text-text-tertiary">{icon}</div>
          )}
          <input
            ref={ref}
            className={cn(
              inputStyles,
              icon ? (iconPosition === 'left' ? 'pl-2 pr-3' : 'pl-3 pr-2') : 'px-3',
              'py-2'
            )}
            disabled={disabled}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="pr-3 text-text-tertiary">{icon}</div>
          )}
        </div>
        {error && (
          <span className="text-sm text-status-danger">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
