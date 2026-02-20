/**
 * Button Component
 * Primary interactive element with multiple variants
 */

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export const buttonVariants = ['primary', 'secondary', 'ghost', 'danger', 'success', 'outline'] as const;
export const buttonSizes = ['sm', 'md', 'lg'] as const;

export type ButtonVariant = typeof buttonVariants[number];
export type ButtonSize = typeof buttonSizes[number];

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-interactive-primary hover:bg-interactive-primary-hover text-text-on-brand shadow-sm',
  secondary: 'bg-interactive-secondary hover:bg-interactive-secondary-hover text-text-primary border border-border-primary',
  ghost: 'hover:bg-surface-hover text-text-primary',
  danger: 'bg-status-danger hover:bg-status-danger/90 text-white shadow-sm',
  success: 'bg-status-success hover:bg-status-success/90 text-white shadow-sm',
  outline: 'border-2 border-interactive-primary text-interactive-primary hover:bg-interactive-primary hover:text-text-on-brand',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-base px-4 py-2',
  lg: 'text-lg px-6 py-3',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'secondary', 
    size = 'md', 
    loading = false,
    icon,
    iconPosition = 'left',
    disabled,
    children, 
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {!loading && icon && iconPosition === 'left' && icon}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    );
  }
);

Button.displayName = 'Button';
